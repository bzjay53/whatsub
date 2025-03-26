// 서비스 및 라이브러리는 import 하지 않고 글로벌로 사용합니다.
// 이 파일은 현재 사용되지 않으며, 모든 기능은 background.js로 이전되었습니다.

/**
 * 백그라운드 서비스 - 확장프로그램 기능 처리
 * 
 * 이 모듈은 확장 프로그램의 핵심 기능을 처리하는 백그라운드 서비스를 제공합니다.
 * - 인증 상태 관리
 * - 메시지 라우팅
 * - API 통신
 * - 스토리지 접근
 */

// 백그라운드 서비스 클래스
class BackgroundService {
    constructor() {
        this.initialized = false;
        this.activeTabId = null;
        this.audioStream = null;
        this.isProcessing = false;
        
        // 상태 관리
        this.state = {
            settings: {
                translationEnabled: true,
                sourceLanguage: 'auto',
                targetLanguage: 'ko',
                subtitleSettings: {},
                syncValue: 0
            },
            auth: {
                isAuthenticated: false,
                user: null,
                idToken: null,
                plan: 'free'
            },
            usage: {
                whisper: {
                    used: 0,
                    limit: 60
                },
                translation: {
                    used: 0,
                    limit: 5000
                }
            },
            logs: []
        };
        
        // 탭 리스너 설정
        this._setupTabListeners();
        
        // 즉시 스토리지 검사 및 정리 (비동기)
        this._immediateStorageCheck();
    }
    
    // 탭 이벤트 리스너 설정
    _setupTabListeners() {
        try {
            // 탭 활성화 감지
            chrome.tabs.onActivated.addListener(async (activeInfo) => {
                this.activeTabId = activeInfo.tabId;
            });
            
            // 탭 업데이트 감지
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status === 'complete' && tab.active) {
                    this.activeTabId = tabId;
                }
            });
        } catch (error) {
            console.error('[BackgroundService] 탭 리스너 설정 오류:', error);
        }
    }
    
    // 즉시 스토리지 검사
    async _immediateStorageCheck() {
        try {
            console.log('[BackgroundService] 시작 시 즉시 스토리지 검사 중...');
            
            // 스토리지에서 인증 관련 데이터 확인
            const authData = await chrome.storage.local.get([
                'whatsub_auth', 
                'auth', 
                'user', 
                'authToken'
            ]);
            
            // 불완전한 로그인 상태 감지
            const hasPartialAuth = 
                (authData.whatsub_auth || authData.auth || authData.user || authData.authToken) &&
                !(authData.whatsub_auth?.token && authData.whatsub_auth?.user && 
                  authData.authToken && authData.auth?.isAuthenticated);
                
            if (hasPartialAuth) {
                console.warn('[BackgroundService] 불완전한 인증 상태 감지, 정리 진행');
                
                // 인증 데이터 정리
                await chrome.storage.local.remove([
                    'whatsub_auth', 'auth', 'user', 'authToken',
                    'lastAuthState', 'loginState'
                ]);
                
                // 인증 메모리 상태 초기화
                this.state.auth.isAuthenticated = false;
                this.state.auth.user = null;
                this.state.auth.idToken = null;
                
                console.log('[BackgroundService] 불완전한 인증 상태 정리 완료');
            }
        } catch (error) {
            console.error('[BackgroundService] 즉시 스토리지 검사 오류:', error);
            // 오류가 발생해도 초기화 계속 진행
        }
    }
    
    // 서비스 초기화
    async initialize() {
        if (this.initialized) {
            console.log('[BackgroundService] 이미 초기화되었습니다.');
            return true;
        }
        
        console.log('[BackgroundService] 초기화 중...');
        
        try {
            // 설정 로드
            await this.loadSettings();
            
            // 로그 로드
            await this.loadLogs();
            
            // 인증 상태 복원 (Firebase 초기화 전에 상태 확인)
            // 이미 저장된 상태가 있는 경우 고려
            console.log('[BackgroundService] 인증 상태 검증 시작');
            const hasRestoredState = await this.restoreAuthState();
            
            // Firebase 서비스 초기화
            const initialized = await FirebaseService.initialize();
            
            if (initialized) {
                // Firebase 인증 상태 리스너 설정
                this._setupAuthStateListener();
                
                // 이미 복원된 인증 상태와 Firebase 상태 비교 및 일관성 보장
                if (hasRestoredState) {
                    console.log('[BackgroundService] 저장된 인증 상태와 Firebase 상태 일관성 확인');
                    const currentUser = FirebaseService.auth.currentUser;
                    
                    // 불일치 상태 감지 (로컬은 로그인, Firebase는 로그아웃)
                    if (this.state.auth.isAuthenticated && !currentUser) {
                        console.warn('[BackgroundService] 인증 상태 불일치: 세션 만료 가능성');
                        // 상태 초기화 (로그아웃 상태로)
                        this.state.auth.isAuthenticated = false;
                        this.state.auth.user = null;
                        this.state.auth.idToken = null;
                        
                        // 변경된 상태 저장
                        await this.saveAuthState();
                        
                        // 상태 변경 브로드캐스트
                        await this.broadcastAuthStateChanged();
                    }
                }
            } else {
                console.error('[BackgroundService] Firebase 서비스 초기화 실패');
            }
            
            // 메시지 리스너 설정
            this._setupMessageListeners();
            
            // 초기화 완료
            this.initialized = true;
            console.log('[BackgroundService] 초기화 완료');
            return true;
        } catch (error) {
            console.error('[BackgroundService] 초기화 오류:', error);
            return false;
        }
    }
    
    // 인증 상태 리스너 설정
    _setupAuthStateListener() {
        FirebaseService.auth.onAuthStateChanged(async (user) => {
            console.log('[BackgroundService] 인증 상태 변경:', user ? '로그인됨' : '로그아웃됨');
            
            if (user) {
                // 사용자 인증됨
                this.state.auth.isAuthenticated = true;
                this.state.auth.user = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL
                };
                
                // 사용자 토큰 가져오기
                try {
                    // user.getIdToken() 함수 호출 대신 chrome.storage.local에서 저장된 토큰 가져오기
                    const authData = await new Promise(resolve => {
                        chrome.storage.local.get(['authToken', 'whatsub_auth'], resolve);
                    });
                    
                    // 저장된 토큰 사용
                    this.state.auth.idToken = authData.authToken || 
                                             (authData.whatsub_auth && authData.whatsub_auth.token) || 
                                             null;
                                             
                    if (!this.state.auth.idToken) {
                        console.warn('[BackgroundService] 저장된 토큰을 찾을 수 없습니다.');
                    }
                } catch (error) {
                    console.error('[BackgroundService] 토큰 가져오기 오류:', error);
                }
                
                // 구독 정보 가져오기
                try {
                    const subscriptionInfo = await FirebaseService.getSubscriptionInfo();
                    this.state.auth.plan = subscriptionInfo.role;
                    
                    // 사용량 한도 업데이트
                    this._updateUsageLimits(subscriptionInfo.role);
                } catch (error) {
                    console.error('[BackgroundService] 구독 정보 가져오기 오류:', error);
                }
                
                // 인증 상태 저장
                await this.saveAuthState();
                
                // 콘텐츠 스크립트에 인증 상태 변경 알림
                this.notifyAuthStateChanged(true);
            } else {
                // 사용자 로그아웃됨
                this.state.auth.isAuthenticated = false;
                this.state.auth.user = null;
                this.state.auth.idToken = null;
                this.state.auth.plan = 'free';
                
                // 기본 사용량 한도로 재설정
                this._updateUsageLimits('free');
                
                // 인증 상태 저장
                await this.saveAuthState();
                
                // 콘텐츠 스크립트에 인증 상태 변경 알림
                this.notifyAuthStateChanged(false);
            }
        });
    }
    
    // 메시지 리스너 설정
    _setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // 비동기 응답을 위해 true 반환
            this._handleMessage(message, sender, sendResponse);
            return true;
        });
    }
    
    // 메시지 핸들러
    async _handleMessage(message, sender, sendResponse) {
        try {
            const { action } = message;
            let response = { success: false, error: '알 수 없는 액션' };
            
            switch (action) {
                case 'signIn':
                    response = await this.handleSignIn();
                    break;
                    
                case 'signOut':
                    response = await this.handleSignOut(message.force);
                    break;
                    
                case 'signInWithGoogle':
                    response = await this.handleGoogleSignIn(message);
                    break;
                    
                case 'checkAuth':
                    response = await this.handleCheckAuth();
                    break;
                
                case 'updateAuthState':
                    response = await this.handleUpdateAuthState(message.data);
                    break;
                    
                case 'getSettings':
                    response = await this.handleGetSettings();
                    break;
                    
                case 'saveSettings':
                    response = await this.handleSaveSettings(message.settings);
                    break;
                    
                case 'startCapture':
                    response = await this.handleStartCapture();
                    break;
                    
                case 'processAudio':
                    response = await this.handleProcessAudio(message);
                    break;
                    
                case 'checkSubscription':
                    response = await this.handleCheckSubscription(message.email);
                    break;
                    
                case 'getUsage':
                    response = await this.handleGetUsage(message.email);
                    break;
                    
                case 'sendFeedback':
                    response = await this.handleSendFeedback(message, sender);
                    break;
                    
                case 'getLogs':
                    response = await this.handleGetLogs();
                    break;
                    
                case 'clearLogs':
                    response = await this.handleClearLogs();
                    break;
                    
                default:
                    console.warn('[BackgroundService] 알 수 없는 액션:', action);
                    break;
            }
            
            sendResponse(response);
        } catch (error) {
            console.error('[BackgroundService] 메시지 처리 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // 사용량 한도 업데이트
    _updateUsageLimits(role) {
        switch (role) {
            case 'premium':
                this.state.usage.whisper.limit = 600; // 10시간
                this.state.usage.translation.limit = 50000; // 50,000 자
                break;
            case 'basic':
                this.state.usage.whisper.limit = 300; // 5시간
                this.state.usage.translation.limit = 20000; // 20,000 자
                break;
            case 'free':
            default:
                this.state.usage.whisper.limit = 60; // 1시간
                this.state.usage.translation.limit = 5000; // 5,000 자
                break;
        }
    }
    
    // 인증 상태 변경 알림
    async notifyAuthStateChanged(isAuthenticated) {
        try {
            // 모든 탭에 인증 상태 변경 메시지 전송
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'authStateChanged',
                        isAuthenticated,
                        user: this.state.auth.user,
                        plan: this.state.auth.plan
                    }).catch(() => {
                        // 일부 탭에서는 메시지 전송이 실패할 수 있음 (콘텐츠 스크립트가 로드되지 않은 경우)
                    });
                } catch (error) {
                    // 개별 탭 메시지 전송 실패 무시
                }
            }
            
            // 팝업에 인증 상태 변경 알림을 위해 런타임 메시지 전송
            chrome.runtime.sendMessage({
                action: 'authStateChanged',
                isAuthenticated,
                user: this.state.auth.user,
                plan: this.state.auth.plan
            }).catch(() => {
                // 팝업이 열려있지 않을 수 있으므로 오류 무시
            });
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 변경 알림 오류:', error);
        }
    }
    
    // 인증 상태 저장
    async saveAuthState() {
        try {
            console.log('[BackgroundService] 인증 상태 저장 중...');
            
            // 로컬 스토리지에 저장
            await chrome.storage.local.set({
                auth: {
                    isAuthenticated: this.state.auth.isAuthenticated,
                    user: this.state.auth.user,
                    plan: this.state.auth.plan
                }
            });
            
            console.log('[BackgroundService] 인증 상태 저장 완료');
            return true;
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 저장 오류:', error);
            return false;
        }
    }
    
    // 모든 인증 상태 삭제
    async clearAuthState() {
        try {
            console.log('[BackgroundService] 인증 상태 삭제 중...');
            
            // 삭제할 모든 인증 관련 키
            const keysToRemove = [
                'auth',
                'authToken',
                'whatsub_auth',
                'user',
                'lastAuthState',
                'loginState',
                'whatsub_user',
                'whatsub_settings'
            ];
            
            // 로컬 스토리지에서 모든 인증 관련 데이터 삭제
            await chrome.storage.local.remove(keysToRemove);
            
            // 메모리 상태도 초기화
            this.state.auth.isAuthenticated = false;
            this.state.auth.user = null;
            this.state.auth.idToken = null;
            this.state.auth.plan = 'free';
            
            console.log('[BackgroundService] 인증 상태 삭제 완료');
            return true;
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 삭제 오류:', error);
            return false;
        }
    }
    
    // 인증 상태 복원
    async restoreAuthState() {
        try {
            console.log('[BackgroundService] 인증 상태 복원 중...');
            
            // 로컬 스토리지에서 가져오기
            const data = await chrome.storage.local.get('auth');
            
            if (data.auth) {
                // 상태 업데이트
                this.state.auth = {
                    ...this.state.auth,
                    ...data.auth
                };
                
                console.log('[BackgroundService] 인증 상태 복원 완료:', this.state.auth.isAuthenticated);
            } else {
                console.log('[BackgroundService] 저장된 인증 상태 없음');
            }
            
            return this.state.auth.isAuthenticated;
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 복원 오류:', error);
            return false;
        }
    }
    
    // 설정 로드
    async loadSettings() {
        try {
            console.log('[BackgroundService] 설정 로드 중...');
            
            // 로컬 스토리지에서 설정 가져오기
            const data = await chrome.storage.local.get('settings');
            
            if (data.settings) {
                this.state.settings = {
                    ...this.state.settings,
                    ...data.settings
                };
                console.log('[BackgroundService] 설정 로드 완료');
            } else {
                console.log('[BackgroundService] 저장된 설정이 없어 기본값 사용');
            }
            
            // 인증된 사용자 설정 가져오기
            if (this.state.auth.isAuthenticated && FirebaseService.initialized) {
                try {
                    const userSettings = await FirebaseService.getUserSettings();
                    if (userSettings) {
                        this.state.settings = {
                            ...this.state.settings,
                            translationEnabled: true,
                            sourceLanguage: userSettings.sourceLanguage || this.state.settings.sourceLanguage,
                            targetLanguage: userSettings.targetLanguage || this.state.settings.targetLanguage,
                            subtitleSettings: userSettings.subtitleSettings || this.state.settings.subtitleSettings
                        };
                        
                        // 변경된 설정 저장
                        await this.saveSettings(this.state.settings);
                        
                        console.log('[BackgroundService] 사용자 설정 로드 완료');
                    }
                } catch (error) {
                    console.warn('[BackgroundService] 사용자 설정 로드 실패:', error);
                }
            }
            
            return this.state.settings;
        } catch (error) {
            console.error('[BackgroundService] 설정 로드 오류:', error);
            return this.state.settings;
        }
    }
    
    // 설정 저장
    async saveSettings(settings) {
        try {
            console.log('[BackgroundService] 설정 저장 중...');
            
            // 상태 업데이트
            this.state.settings = {
                ...this.state.settings,
                ...settings
            };
            
            // 로컬 스토리지에 저장
            await chrome.storage.local.set({ settings: this.state.settings });
            
            // 인증된 사용자 설정 저장
            if (this.state.auth.isAuthenticated && FirebaseService.initialized) {
                try {
                    await FirebaseService.saveUserSettings({
                        sourceLanguage: this.state.settings.sourceLanguage,
                        targetLanguage: this.state.settings.targetLanguage,
                        subtitlePosition: this.state.settings.subtitleSettings?.position || 'bottom',
                        fontSize: this.state.settings.subtitleSettings?.fontSize || 'medium',
                        background: this.state.settings.subtitleSettings?.background || 'semi',
                        dualSubtitles: this.state.settings.subtitleSettings?.dualSubtitles || true
                    });
                    
                    console.log('[BackgroundService] Firebase에 사용자 설정 저장 완료');
                } catch (error) {
                    console.warn('[BackgroundService] Firebase 사용자 설정 저장 실패:', error);
                }
            }
            
            console.log('[BackgroundService] 설정 저장 완료');
            return true;
        } catch (error) {
            console.error('[BackgroundService] 설정 저장 오류:', error);
            return false;
        }
    }
    
    // 로그 로드
    async loadLogs() {
        try {
            console.log('[BackgroundService] 로그 로드 중...');
            
            const data = await chrome.storage.local.get('logs');
            if (data.logs && Array.isArray(data.logs)) {
                this.state.logs = data.logs;
                console.log(`[BackgroundService] ${this.state.logs.length}개의 로그가 로드됨`);
            }
            
            return this.state.logs;
        } catch (error) {
            console.error('[BackgroundService] 로그 로드 오류:', error);
            return [];
        }
    }
    
    // 로그 저장
    async saveLogs() {
        try {
            console.log('[BackgroundService] 로그 저장 중...');
            
            await chrome.storage.local.set({ logs: this.state.logs.slice(0, 200) }); // 최근 200개만 저장
            console.log('[BackgroundService] 로그 저장 완료');
            return true;
        } catch (error) {
            console.error('[BackgroundService] 로그 저장 오류:', error);
            return false;
        }
    }
    
    // 구글 로그인 처리
    async handleGoogleSignIn(message) {
        console.log('[BackgroundService] Google 로그인 처리 시작...');
        
        try {
            // Google 로그인 시도
            const result = await window.firebaseSDK.signInWithGoogle();
            
            // 로그인 결과 확인
            if (!result.success || !result.user) {
                console.error('[BackgroundService] 로그인 실패:', result.error || '알 수 없는 오류');
                return {
                    success: false,
                    error: result.error || '로그인 실패',
                    errorType: result.errorType || 'unknown'
                };
            }
            
            console.log('[BackgroundService] 로그인 성공:', result.user.email);
            const user = result.user;
            
            // Firebase 사용자 정보 저장
            await this.firebaseService.storeUserData(user);
            
            // 인증 상태 업데이트
            this.updateAuthState({
                isAuthenticated: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    photoURL: user.photoURL
                },
                idToken: result.token
            });
            
            // 구독 정보 가져오기
            await this.loadSubscriptionInfo();
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0]
                }
            };
        } catch (error) {
            console.error('[BackgroundService] 로그인 처리 중 오류:', error);
            return {
                success: false,
                error: error.message || '로그인 처리 중 오류가 발생했습니다',
                errorType: 'login_process_error'
            };
        }
    }
    
    // 로그아웃 처리
    async handleSignOut(force = false) {
        console.log('[BackgroundService] 로그아웃 처리 시작...');
        
        try {
            // 로그아웃 시도
            const result = await window.firebaseSDK.signOut(force);
            
            if (!result.success) {
                console.error('[BackgroundService] 로그아웃 실패:', result.error);
                
                // 강제 로그아웃 요청이 아니고 오류가 발생한 경우
                if (!force) {
                    return {
                        success: false,
                        error: result.error || '로그아웃 처리 중 오류가 발생했습니다'
                    };
                }
            }
            
            // 인증 상태 초기화
            this.updateAuthState({
                isAuthenticated: false,
                user: null,
                idToken: null
            });
            
            console.log('[BackgroundService] 로그아웃 완료');
            return {
                success: true
            };
        } catch (error) {
            console.error('[BackgroundService] 로그아웃 처리 중 오류:', error);
            
            // 강제 로그아웃인 경우 항상 성공으로 처리
            if (force) {
                this.updateAuthState({
                    isAuthenticated: false,
                    user: null,
                    idToken: null
                });
                
                return {
                    success: true,
                    forced: true
                };
            }
            
            return {
                success: false,
                error: error.message || '로그아웃 처리 중 오류가 발생했습니다'
            };
        }
    }
    
    // 인증 상태 변경 이벤트 브로드캐스트
    broadcastAuthStateChanged() {
        try {
            chrome.runtime.sendMessage({
                action: 'authStateChanged',
                data: { 
                    isAuthenticated: this.state.auth.isAuthenticated,
                    user: this.state.auth.user
                }
            });
        } catch (error) {
            console.warn('[BackgroundService] 인증 상태 변경 이벤트 전송 오류:', error);
        }
    }
    
    // 인증 상태 확인 처리
    async handleCheckAuth() {
        try {
            console.log('[BackgroundService] 인증 상태 확인 요청 처리...');
            
            // 1. 메모리 상태 먼저 확인
            let isLoggedIn = this.state.auth.isAuthenticated;
            let user = this.state.auth.user;
            
            // 2. 로컬 스토리지의 인증 데이터 확인
            const storageData = await chrome.storage.local.get([
                'whatsub_auth', 'authToken', 'auth', 'user'
            ]);
            
            // 모든 소스에서 토큰 및 사용자 정보 확인
            const hasTokenInStorage = !!(
                storageData.authToken || 
                (storageData.whatsub_auth?.token) || 
                (storageData.auth?.token)
            );
            
            const hasUserInStorage = !!(
                storageData.user || 
                (storageData.whatsub_auth?.user) || 
                (storageData.auth?.user)
            );
            
            console.log('[BackgroundService] 인증 상태 점검:', { 
                memory: isLoggedIn, 
                storage: {
                    token: hasTokenInStorage,
                    user: hasUserInStorage
                }
            });
            
            // 3. 상태 불일치 확인 및 처리
            if (isLoggedIn && !hasTokenInStorage) {
                // 메모리는 로그인 상태인데 스토리지에 토큰이 없음 → 로그아웃 상태로 조정
                console.warn('[BackgroundService] 불일치 감지: 메모리는 로그인 상태지만 스토리지에 토큰 없음');
                isLoggedIn = false;
                user = null;
                this.state.auth.isAuthenticated = false;
                this.state.auth.user = null;
                
                // 모든 인증 상태 정리
                await this.clearAuthState();
            } 
            else if (!isLoggedIn && hasTokenInStorage) {
                // 메모리는 로그아웃 상태인데 스토리지에 토큰이 있음
                console.warn('[BackgroundService] 불일치 감지: 메모리는 로그아웃 상태지만 스토리지에 토큰 있음');
                
                // 토큰이 유효한지 확인
                const token = storageData.authToken || 
                             (storageData.whatsub_auth && storageData.whatsub_auth.token) ||
                             (storageData.auth && storageData.auth.token);
                
                // 저장된 로그인 시간 확인 (12시간 이상 지났으면 유효하지 않음으로 간주)
                const loginTime = storageData.whatsub_auth?.loginTime || 0;
                const isTokenExpired = loginTime && (Date.now() - loginTime > 12 * 60 * 60 * 1000);
                
                if (isTokenExpired) {
                    console.warn('[BackgroundService] 저장된 토큰이 만료됨 (12시간 이상 경과)');
                    // 토큰 만료됨, 정리 필요
                    await this.clearAuthState();
                }
                else if (token && hasUserInStorage) {
                    try {
                        // 토큰 유효성 검증 시도
                        const isValid = await this._validateToken(token);
                        
                        if (isValid) {
                            // 스토리지에서 사용자 정보 가져오기
                            const storedUser = storageData.user || 
                                              storageData.whatsub_auth?.user || 
                                              storageData.auth?.user;
                                              
                            if (storedUser) {
                                console.log('[BackgroundService] 스토리지에서 사용자 정보 복원 성공');
                                this.state.auth.isAuthenticated = true;
                                this.state.auth.user = storedUser;
                                isLoggedIn = true;
                                user = storedUser;
                            }
                        } else {
                            console.warn('[BackgroundService] 토큰 유효성 검증 실패, 인증 정보 정리');
                            await this.clearAuthState();
                        }
                    } catch (validationError) {
                        console.error('[BackgroundService] 토큰 검증 오류:', validationError);
                        // 검증 중 오류 발생, 정리 수행
                        await this.clearAuthState();
                    }
                } else {
                    // 토큰 또는 사용자 정보 중 하나라도 없으면 정리
                    console.warn('[BackgroundService] 불완전한 인증 정보 감지, 정리 필요');
                    await this.clearAuthState();
                }
            }
            
            // 4. 일관적인 결과 반환
            return {
                success: true,
                isLoggedIn: this.state.auth.isAuthenticated,
                user: this.state.auth.user
            };
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 확인 오류:', error);
            return {
                success: false,
                isLoggedIn: false,
                error: error.message
            };
        }
    }
    
    // 토큰 유효성 검증
    async _validateToken(token) {
        try {
            if (!token) return false;
            
            // Google 사용자 정보 API로 토큰 유효성 검증
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // 200 응답은 토큰이 유효함을 의미
            if (response.ok) {
                console.log('[BackgroundService] 토큰 유효성 검증 성공');
                return true;
            }
            
            console.warn('[BackgroundService] 토큰 유효성 검증 실패:', response.status);
            return false;
        } catch (error) {
            console.error('[BackgroundService] 토큰 검증 중 오류:', error);
            return false;
        }
    }
    
    // 구독 확인
    async handleCheckSubscription(email) {
        try {
            if (!email && this.state.auth.user) {
                email = this.state.auth.user.email;
            }
            
            if (!email) {
                return {
                    success: false,
                    error: '사용자 이메일이 필요합니다.'
                };
            }
            
            console.log('[BackgroundService] 구독 확인 중...', email);
            
            // Firebase 서비스가 초기화되었는지 확인
            if (!FirebaseService.initialized) {
                await FirebaseService.initialize();
            }
            
            if (!this.state.auth.isAuthenticated) {
                return {
                    success: true,
                    plan: 'free',
                    isActive: false,
                    features: FirebaseService.getFeaturesByRole('free')
                };
            }
            
            // 구독 정보 가져오기
            const subscriptionInfo = await FirebaseService.getSubscriptionInfo();
            
            // 상태 업데이트
            this.state.auth.plan = subscriptionInfo.role;
            this._updateUsageLimits(subscriptionInfo.role);
            
            return {
                success: true,
                ...subscriptionInfo
            };
        } catch (error) {
            console.error('[BackgroundService] 구독 확인 오류:', error);
            return {
                success: false,
                error: error.message || '구독 정보를 확인하는 중 오류가 발생했습니다.'
            };
        }
    }
    
    // 사용량 확인
    async handleGetUsage(email) {
        try {
            if (!email && this.state.auth.user) {
                email = this.state.auth.user.email;
            }
            
            if (!email) {
                return {
                    success: false,
                    error: '사용자 이메일이 필요합니다.'
                };
            }
            
            console.log('[BackgroundService] 사용량 확인 중...', email);
            
            // Firebase 서비스가 초기화되었는지 확인
            if (!FirebaseService.initialized) {
                await FirebaseService.initialize();
            }
            
            if (!this.state.auth.isAuthenticated) {
                return {
                    success: true,
                    usage: this.state.usage,
                    subscription: {
                        plan: 'free',
                        isActive: false
                    }
                };
            }
            
            // 현재 사용량 가져오기
            const usageInfo = await FirebaseService.getCurrentUsage();
            
            // 구독 정보 가져오기
            const subscriptionInfo = await FirebaseService.getSubscriptionInfo();
            
            // 사용량 정보 업데이트
            const usage = {
                whisper: {
                    used: usageInfo.monthlyMinutes || 0,
                    limit: subscriptionInfo.minutesLimit || 60
                },
                translation: {
                    used: (usageInfo.monthlyMinutes || 0) * 1000, // 대략적인 번역 글자 수 계산
                    limit: subscriptionInfo.minutesLimit * 1000 || 5000
                }
            };
            
            // 상태 업데이트
            this.state.usage = usage;
            
            return {
                success: true,
                usage,
                subscription: {
                    plan: subscriptionInfo.role,
                    isActive: subscriptionInfo.isActive,
                    expiresAt: subscriptionInfo.expiresAt
                },
                isLimitReached: usageInfo.isLimitReached
            };
        } catch (error) {
            console.error('[BackgroundService] 사용량 확인 오류:', error);
            return {
                success: false,
                error: error.message || '사용량 정보를 확인하는 중 오류가 발생했습니다.'
            };
        }
    }
    
    // 설정 가져오기
    async handleGetSettings() {
        return {
            success: true,
            settings: this.state.settings
        };
    }
    
    // 설정 저장
    async handleSaveSettings(settings) {
        try {
            const result = await this.saveSettings(settings);
            
            return {
                success: result,
                settings: this.state.settings
            };
        } catch (error) {
            console.error('[BackgroundService] 설정 저장 오류:', error);
            
            return {
                success: false,
                error: error.message || '설정 저장 중 오류가 발생했습니다.'
            };
        }
    }
    
    // 로그 가져오기
    async handleGetLogs() {
        return {
            success: true,
            logs: this.state.logs
        };
    }
    
    // 로그 초기화
    async handleClearLogs() {
        try {
            this.state.logs = [];
            await this.saveLogs();
            
            return {
                success: true,
                message: '로그가 초기화되었습니다.'
            };
        } catch (error) {
            console.error('[BackgroundService] 로그 초기화 오류:', error);
            
            return {
                success: false,
                error: error.message || '로그 초기화 중 오류가 발생했습니다.'
            };
        }
    }
    
    // 인증 상태 업데이트 처리
    async handleUpdateAuthState(data) {
        try {
            console.log('[BackgroundService] 인증 상태 업데이트 요청:', data?.isAuthenticated);
            
            if (!data) {
                return {
                    success: false,
                    error: '업데이트할 인증 데이터가 없습니다.'
                };
            }
            
            // 상태 업데이트
            this.state.auth.isAuthenticated = !!data.isAuthenticated;
            
            // 사용자 정보 업데이트 (있는 경우에만)
            if (data.user) {
                this.state.auth.user = data.user;
            } else if (!data.isAuthenticated) {
                // 로그아웃 상태로 변경 시 사용자 정보 삭제
                this.state.auth.user = null;
            }
            
            // 이벤트 전파
            this.broadcastAuthStateChanged();
            
            console.log('[BackgroundService] 인증 상태 업데이트 완료:', this.state.auth.isAuthenticated);
            
            return {
                success: true,
                message: '인증 상태가 업데이트되었습니다.'
            };
        } catch (error) {
            console.error('[BackgroundService] 인증 상태 업데이트 오류:', error);
            return {
                success: false,
                error: error.message || '인증 상태 업데이트 중 오류가 발생했습니다.'
            };
        }
    }
}

// 글로벌 객체로 노출
window.BackgroundService = BackgroundService; 