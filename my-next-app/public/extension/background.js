/**
 * WhatsUb 확장 프로그램 백그라운드 스크립트
 * 
 * 주요 기능:
 * 1. 인증 관리 (로그인/로그아웃)
 * 2. 오디오 캡처 및 처리
 * 3. 자막 처리 및 번역
 * 4. 사용량 추적
 */

// import 문을 제거하고 직접 참조 방식으로 변경
// 필요한 함수들은 firefox-sdk.js에서 전역 함수로 로드됨

// 리디렉션 URI 확인 코드 추가
console.log('===== 디버깅 정보 =====');
console.log('Chrome 리디렉션 URL:', chrome.identity.getRedirectURL('oauth2'));
console.log('OAuth 클라이언트 ID:', chrome.runtime.getManifest().oauth2.client_id);
console.log('=====================');

// 로그 관련 변수 및 함수를 파일 상단에 정의
// 로그 저장 스케줄링 변수
let logSaveTimeout = null;

// 로그 메시지 문자열 변환 헬퍼 함수
function formatLogMessage(message, details = null) {
    try {
        if (typeof message === 'object') {
            return JSON.stringify(message);
        }
        return message;
    } catch (e) {
        return String(message);
    }
}

// 로그 관리 기본 함수
function logError(message, details = null) {
    const formattedMessage = formatLogMessage(message);
    console.error(`[Whatsub] ${formattedMessage}`, details || '');
    return addLog('error', formattedMessage, details);
}

function logWarning(message, details = null) {
    const formattedMessage = formatLogMessage(message);
    console.warn(`[Whatsub] ${formattedMessage}`, details || '');
    return addLog('warn', formattedMessage, details);
}

function logInfo(message, details = null) {
    const formattedMessage = formatLogMessage(message);
    console.info(`[Whatsub] ${formattedMessage}`, details || '');
    return addLog('info', formattedMessage, details);
}

function logDebug(message, details = null) {
    const formattedMessage = formatLogMessage(message);
    console.log(`[Whatsub] ${formattedMessage}`, details || '');
    return addLog('debug', formattedMessage, details);
}

// 로그 관리 함수
function addLog(level, message, details = null) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            details
        };
        
        // 상태 객체가 초기화되지 않은 경우 처리
        if (!state || !state.logs) {
            console.error(`[Whatsub] 상태 객체가 초기화되지 않았습니다. 로그를 저장할 수 없습니다: ${message}`);
            // 콘솔에만 출력
            console[level](`[Whatsub] ${message}`, details || '');
            return logEntry;
        }
        
        // 로그 배열에 추가
        state.logs.unshift(logEntry);
        
        // 최대 1000개 로그만 유지
        if (state.logs.length > 1000) {
            state.logs.pop();
        }
        
        // 콘솔에도 출력
        switch (level) {
            case 'error':
                console.error(`[Whatsub] ${message}`, details || '');
                break;
            case 'warn':
                console.warn(`[Whatsub] ${message}`, details || '');
                break;
            case 'info':
                console.info(`[Whatsub] ${message}`, details || '');
                break;
            default:
                console.log(`[Whatsub] ${message}`, details || '');
        }
        
        // 로그 저장 스케줄링
        scheduleLogSave();
        
        return logEntry;
    } catch (error) {
        console.error(`[Whatsub] 로그 생성 중 오류 발생: ${error.message}`, error);
        return {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: '로그 생성 오류',
            details: error.message
        };
    }
}

// 로그 저장 스케줄링 (일정 시간 내 여러 번의 저장 요청을 하나로 합침)
function scheduleLogSave() {
    try {
        if (logSaveTimeout) {
            clearTimeout(logSaveTimeout);
        }
        
        logSaveTimeout = setTimeout(() => {
            saveLogs();
            logSaveTimeout = null;
        }, 5000); // 5초 후 저장
    } catch (error) {
        console.error(`[Whatsub] 로그 저장 스케줄링 오류: ${error.message}`, error);
    }
}

// 로그를 로컬 스토리지에 저장
async function saveLogs() {
    try {
        if (!state || !state.logs) {
            console.error('[Whatsub] 상태 객체가 초기화되지 않았습니다. 로그를 저장할 수 없습니다.');
            return;
        }
        
        await chrome.storage.local.set({ logs: state.logs.slice(0, 200) }); // 최근 200개만 저장
        console.log('[Whatsub] 로그가 저장되었습니다.');
    } catch (error) {
        console.error('[Whatsub] 로그 저장 오류:', error);
    }
}

// 로컬 스토리지에서 로그 로드
async function loadLogs() {
    try {
        if (!state) {
            console.error('[Whatsub] 상태 객체가 초기화되지 않았습니다. 로그를 로드할 수 없습니다.');
            return;
        }
        
        const data = await chrome.storage.local.get('logs');
        if (data.logs && Array.isArray(data.logs)) {
            state.logs = data.logs;
            console.log(`[Whatsub] ${state.logs.length}개의 로그가 로드되었습니다.`);
        }
    } catch (error) {
        console.error('[Whatsub] 로그 로드 오류:', error);
    }
}

// 모듈을 직접 로드하는 방식으로 변경
// Airtable과 Firebase SDK 기능을 직접 구현

// 전역 변수 선언
let audioContext = null;
let mediaStreamSource = null;
let audioStream = null;

// Chrome Extension의 background script
let activeTabId = null;
let isInitialized = false;

// 전역 상태 관리
const state = {
    audioStream: null,
    audioContext: null,
    mediaStreamSource: null,
    activeTabId: null,
    settings: {
        translationEnabled: true,
        sourceLanguage: 'auto',
        targetLanguage: 'ko',
        subtitleSettings: {},
        syncValue: 0
    },
    services: new Map(),
    tabs: new Map(),  // 탭 상태를 저장할 Map 추가
    isInitialized: false,
    // 사용자 인증 관련 상태
    auth: {
        isAuthenticated: false,
        user: null,
        idToken: null,
        accessToken: null,
        plan: 'free',
        lastError: null,
        oauthClientId: null,
        isConfigured: false
    },
    // 사용량 관련 상태
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
    ui: {
        currentTab: 'signin',
        loading: false,
        error: null
    },
    isProcessing: false,
    logs: [], // 로그 저장 배열
    authState: 'unauthenticated', // 'unauthenticated', 'authenticating', 'authenticated'
    whisperApiEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    whisperApiKey: '', // API 키는 안전하게 관리해야 함
    translateApiEndpoint: 'https://api.openai.com/v1/chat/completions',
    translateApiKey: '', // API 키는 안전하게 관리해야 함
    debugMode: false
};

// 탭 활성화 감지
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    state.activeTabId = activeInfo.tabId;
});

// 탭 업데이트 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        state.activeTabId = tabId;
    }
});

// 탭 상태 초기화
function initializeTabState(tabId) {
    if (!state.tabs.has(tabId)) {
        state.tabs.set(tabId, {
            isInitialized: false,
            services: new Map(),
            settings: { ...state.settings }
        });
    }
    return state.tabs.get(tabId);
}

// OAuth 인증 초기화
async function initializeAuth() {
    try {
        console.log("[Whatsub] 인증 정보 초기화 중...");
        
        // manifest에서 OAuth 클라이언트 ID 읽기
        const manifest = chrome.runtime.getManifest();
        if (manifest && manifest.oauth2) {
            state.auth.oauthClientId = manifest.oauth2.client_id;
            console.log("[Whatsub] OAuth 클라이언트 ID 로드됨:", state.auth.oauthClientId);
            
            // OAuth 클라이언트 ID가 자리 표시자이거나 유효하지 않은지 확인
            if (state.auth.oauthClientId.includes("YOUR_") || 
                state.auth.oauthClientId.includes("PLACEHOLDER") || 
                state.auth.oauthClientId.endsWith("example.com") ||
                state.auth.oauthClientId.length < 20) {
                console.warn("[Whatsub] 유효하지 않은 OAuth 클라이언트 ID:", state.auth.oauthClientId);
                state.auth.lastError = "유효한 OAuth 클라이언트 ID가 설정되지 않았습니다. manifest.json 파일을 수정하여 OAuth 클라이언트 ID를 설정해주세요.";
                state.auth.isConfigured = false;
            } else {
                state.auth.isConfigured = true;
            }
        } else {
            console.error("[Whatsub] manifest.json에서 OAuth 구성을 찾을 수 없습니다.");
            state.auth.lastError = "OAuth 구성이 누락되었습니다.";
            state.auth.isConfigured = false;
        }
        
        // 로컬 스토리지에서 인증 상태 복원
        await restoreAuthState();
        
        return state.auth.isAuthenticated;
    } catch (error) {
        console.error("[Whatsub] 인증 초기화 오류:", error);
        state.auth.lastError = error.message;
        state.auth.isAuthenticated = false;
        state.auth.isConfigured = false;
        return false;
    }
}

// 로컬 스토리지에서 인증 상태 복원
async function restoreAuthState() {
    try {
        const authData = await chrome.storage.local.get(['auth']);
        if (authData && authData.auth) {
            // 필수 속성 확인
            if (authData.auth.user && authData.auth.user.email && authData.auth.idToken) {
                console.log("[Whatsub] 저장된 인증 상태 복원:", authData.auth.user.email);
                state.auth.isAuthenticated = true;
                state.auth.user = authData.auth.user;
                state.auth.idToken = authData.auth.idToken;
                state.auth.accessToken = authData.auth.accessToken;
                state.auth.plan = authData.auth.plan || 'free';
                
                // 추가 속성 복사
                if (authData.auth.lastLogin) {
                    state.auth.lastLogin = authData.auth.lastLogin;
                }
                
                return true;
            }
        }
        console.log("[Whatsub] 저장된 인증 정보가 없거나 유효하지 않습니다.");
        return false;
    } catch (error) {
        console.error("[Whatsub] 인증 상태 복원 오류:", error);
        return false;
    }
}

// 인증 상태 저장
async function saveAuthState() {
    try {
        const authData = {
            isAuthenticated: state.auth.isAuthenticated,
            user: state.auth.user,
            idToken: state.auth.idToken,
            accessToken: state.auth.accessToken,
            plan: state.auth.plan,
            lastLogin: new Date().toISOString()
        };
        
        await chrome.storage.local.set({ auth: authData });
        console.log("[Whatsub] 인증 상태 저장 완료");
        return true;
    } catch (error) {
        console.error("[Whatsub] 인증 상태 저장 오류:", error);
        return false;
    }
}

// Airtable API 모듈 참조 - 미리 로드
let airtableApi = null;
let firebaseSDK = null;

// 확장 프로그램 초기화 시 필요한 모듈 로드
async function loadModules() {
    try {
        console.log('[Background] 필요한 모듈 로드 중...');
        
        // 기존 ESM 모듈을 JSON으로 가져오는 방식으로 변경
        const firebaseSDKUrl = chrome.runtime.getURL('lib/firebase-sdk.js');
        const airtableApiUrl = chrome.runtime.getURL('lib/airtable-api.js');
        
        // 파일 내용을 텍스트로 가져옴
        const firebaseSDKResponse = await fetch(firebaseSDKUrl);
        const airtableApiResponse = await fetch(airtableApiUrl);
        
        // 텍스트 내용 저장
        const firebaseSDKText = await firebaseSDKResponse.text();
        const airtableApiText = await airtableApiResponse.text();
        
        // 모듈 로드 성공 로깅
        console.log('[Background] 모듈 로드 완료');
        
        // 글로벌 변수에 모듈 할당 - 실제로는 파싱된 객체가 아닌 텍스트 내용
        // 여기서는 파일을 로드했음을 나타내는 용도로만 사용
        firebaseSDK = { loaded: true };
        airtableApi = { loaded: true };
        
        return true;
    } catch (error) {
        console.error('[Background] 모듈 로드 오류:', error);
        return false;
    }
}

// 백그라운드 스크립트 초기화 시 모듈 로드
loadModules().then(success => {
    console.log('[Background] 모듈 로드 상태:', success ? '성공' : '실패');
});

// 인증 관련 메시지 핸들러
async function handleAuthMessage(message, sender, sendResponse) {
    const { action } = message;
    
    switch (action) {
        case 'signInWithGoogle':
            handleGoogleSignIn(message, sender, sendResponse);
            return true;
            
        case 'signOut':
            handleSignOut(message, sender, sendResponse);
            return true;
            
        case 'checkAuth':
            handleCheckAuth(sendResponse);
            return true;
            
        default:
            return false;
    }
}

// Google 로그인 요청 처리
async function handleGoogleSignIn(message, sender, sendResponse) {
    try {
        // 로그인 상태 확인
        if (state.auth.isAuthenticated && state.auth.user) {
            console.log("[Whatsub] 이미 로그인되어 있습니다:", state.auth.user.email);
            sendResponse({
                success: true,
                isAuthenticated: true,
                user: state.auth.user,
                message: "이미 로그인되어 있습니다."
            });
            return;
        }
        
        // OAuth 클라이언트 ID 검증
        if (!state.auth.isConfigured) {
            console.error("[Whatsub] OAuth가 올바르게 구성되지 않았습니다.");
            sendResponse({
                success: false,
                error: state.auth.lastError || "OAuth 구성이 올바르지 않습니다. manifest.json의 OAuth 클라이언트 ID를 확인하세요.",
                errorType: "invalid_configuration"
            });
            return;
        }
        
        // 리디렉션 URI 미리 획득하여 로그에 기록
        const redirectUri = chrome.identity.getRedirectURL('oauth2');
        console.log("[Whatsub] 사용할 리디렉션 URI:", redirectUri);
        console.log("[Whatsub] 이 URI를 Google 개발자 콘솔(https://console.cloud.google.com/apis/credentials)에 등록해야 합니다.");
        
        // Google 로그인 수행
        console.log("[Whatsub] Google 로그인 시작...");
        const signInModule = await loadFirebaseSDK();
        
        // 로그인 함수 존재 여부 확인
        if (!signInModule || typeof signInModule.signInWithGoogle !== 'function') {
            console.error("[Whatsub] Firebase SDK를 로드할 수 없거나 로그인 함수가 없습니다.");
            sendResponse({
                success: false,
                error: "로그인 모듈을 로드할 수 없습니다.",
                errorType: "module_load_error"
            });
            return;
        }
        
        // 로그인 실행
        const result = await signInModule.signInWithGoogle();
        
        if (result.success && result.user) {
            // 로그인 성공
            state.auth.isAuthenticated = true;
            state.auth.user = result.user;
            state.auth.idToken = result.token;
            state.auth.accessToken = result.token;
            state.auth.lastError = null;
            
            // 저장
            await saveAuthState();
            
            console.log("[Whatsub] 로그인 성공:", result.user.email);
            sendResponse({
                success: true,
                isAuthenticated: true,
                user: result.user,
                message: "로그인 성공"
            });
        } else {
            // 로그인 실패
            state.auth.isAuthenticated = false;
            state.auth.lastError = result.error || "알 수 없는 로그인 오류";
            
            console.error("[Whatsub] 로그인 실패:", result.error, "타입:", result.errorType);
            
            // redirect_uri_mismatch 오류 처리 개선
            if (result.errorType === 'redirect_uri_mismatch') {
                console.error("[Whatsub] 리디렉션 URI 불일치 오류가 발생했습니다.");
                console.error("[Whatsub] Google 개발자 콘솔에 다음 URI를 등록해야 합니다:", redirectUri);
                console.error("[Whatsub] 개발자 콘솔 링크: https://console.cloud.google.com/apis/credentials");
                
                result.error = `Google 개발자 콘솔에 다음 리디렉션 URI를 등록해야 합니다: ${redirectUri}\n\n1. https://console.cloud.google.com/apis/credentials 접속\n2. OAuth 클라이언트 ID 클릭\n3. 승인된 리디렉션 URI 섹션에 위 URI 추가`;
                result.redirectUri = redirectUri;
            }
            
            sendResponse({
                success: false,
                error: result.error,
                errorType: result.errorType || "unknown_error",
                invalidClientId: result.invalidClientId || false,
                redirectUri: result.redirectUri
            });
        }
    } catch (error) {
        console.error("[Whatsub] 로그인 처리 중 오류 발생:", error);
        state.auth.lastError = error.message;
        sendResponse({
            success: false,
            error: error.message,
            errorType: "exception"
        });
    }
}

// 로그아웃 요청 처리
async function handleSignOut(message, sender, sendResponse) {
    try {
        // 인증 상태 초기화
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.idToken = null;
        state.auth.accessToken = null;
        
        // 로컬 스토리지에서 인증 정보 제거
        await chrome.storage.local.remove(['auth']);
        
        console.log("[Whatsub] 로그아웃 성공");
        sendResponse({
            success: true,
            message: "로그아웃 성공"
        });
    } catch (error) {
        console.error("[Whatsub] 로그아웃 중 오류 발생:", error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 인증 상태 확인
async function handleCheckAuth(sendResponse) {
    try {
        // manifest.json에서 OAuth 클라이언트 ID 가져오기
        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2?.client_id;
        
        // 클라이언트 ID 유효성 검사
        const isClientIdValid = clientId && 
                               !clientId.includes('YOUR_') && 
                               !clientId.includes('${') && 
                               !clientId.includes('PLACEHOLDER') &&
                               clientId.length > 10;
        
        let clientIdMessage = null;
        
        if (!isClientIdValid) {
            clientIdMessage = '유효한 OAuth 클라이언트 ID가 설정되지 않았습니다.';
        }
        
        console.log('인증 상태 확인', { 
            isLoggedIn: state.auth.isAuthenticated,
            clientIdValid: isClientIdValid,
            userEmail: state.auth.user?.email || '로그인 안됨'
        });
        
        // 응답 반환
        sendResponse({
            success: true,
            isLoggedIn: state.auth.isAuthenticated,
            user: state.auth.user,
            clientIdValid: isClientIdValid,
            clientIdMessage: clientIdMessage
        });
    } catch (error) {
        console.error('인증 상태 확인 오류', { error: error.message });
        sendResponse({
            success: false,
            error: `인증 상태를 확인하는 중 오류가 발생했습니다: ${error.message}`
        });
    }
}

// 탭 캡처 시작
async function handleStartTabCapture(sendResponse) {
    try {
        console.log("[Whatsub] 탭 캡처 시작...");
        
        if (!state.activeTabId) {
            state.activeTabId = await getCurrentActiveTabId();
        }
        
        const stream = await chrome.tabCapture.capture({
            audio: true,
            video: false,
            audioConstraints: {
                mandatory: {
                    echoCancellation: true,
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                }
            }
        });
        
        if (stream) {
            // 기존 스트림 정리
            if (state.audioStream) {
                state.audioStream.getTracks().forEach(track => track.stop());
            }
            
            state.audioStream = stream;
            console.log("[Whatsub] 탭 캡처 성공");
            
            sendResponse({
                success: true,
                stream: stream
            });
        } else {
            console.error("[Whatsub] 탭 캡처 실패: 스트림을 가져올 수 없습니다.");
            sendResponse({
                success: false,
                error: "탭 캡처 권한을 얻을 수 없습니다. tabCapture 권한을 확인하세요."
            });
        }
    } catch (error) {
        console.error("[Whatsub] 탭 캡처 오류:", error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 현재 활성 탭 ID 가져오기
async function getCurrentActiveTabId() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            return tabs[0].id;
        }
    } catch (error) {
        console.error("[Whatsub] 활성 탭 ID 가져오기 오류:", error);
    }
    return null;
}

// 설정 로드
async function loadSettings() {
    try {
        return new Promise((resolve) => {
            // 기본 설정 정의
            const defaultSettings = {
                fontSize: 20,
                fontFamily: 'Arial',
                fontColor: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                position: 'bottom',
                translationEnabled: true,
                targetLanguage: 'ko',
                sourceLanguage: 'auto',
                syncValue: 0,
                noiseReduction: true,
                useWorklet: true
            };
            
            chrome.storage.sync.get('settings', (data) => {
                // Chrome API 오류 확인
                if (chrome.runtime.lastError) {
                    logError('설정 로드 중 오류 발생', chrome.runtime.lastError);
                    // 오류 발생 시 기본 설정 사용
                    resolve({
                        success: true,
                        settings: defaultSettings
                    });
                    return;
                }
                
                // 기본 설정과 병합
                const settings = { ...defaultSettings, ...(data.settings || {}) };
                
                // 상태에 설정 저장
                state.settings = { ...state.settings, ...settings };
                
                logInfo('설정 로드 완료', settings);
                resolve({
                    success: true,
                    settings: settings
                });
            });
        });
    } catch (error) {
        logError('설정 로드 오류', error);
        return {
            success: false,
            error: error.message,
            settings: defaultSettings
        };
    }
}

// 오디오 처리
async function handleProcessAudio(message, sender, sendResponse) {
    try {
        if (state.isProcessing) {
            console.log("[Whatsub] 이미 오디오 처리 중. 이전 요청 스킵.");
            sendResponse({ success: false, error: "이미 처리 중입니다." });
            return;
        }
        
        state.isProcessing = true;
        console.log("[Whatsub] 오디오 처리 시작...");
        
        // 인증 확인
        if (!state.auth.isAuthenticated) {
            console.warn("[Whatsub] 인증되지 않은 상태에서 오디오 처리 요청");
            state.isProcessing = false;
            sendResponse({ success: false, error: "인증이 필요합니다." });
            return;
        }
        
        // 사용량 제한 확인
        if (state.auth.plan === 'free' && state.usage.whisper.used >= state.usage.whisper.limit) {
            console.warn("[Whatsub] 무료 플랜 사용량 초과");
            state.isProcessing = false;
            sendResponse({ 
                success: false, 
                error: "무료 플랜의 STT 사용량을 초과했습니다. 업그레이드 해주세요.",
                limitExceeded: true
            });
            return;
        }
        
        // 오디오 데이터 가져오기
        const audioBlob = message.audio;
        
        if (!audioBlob) {
            console.error("[Whatsub] 오디오 데이터가 없습니다.");
            state.isProcessing = false;
            sendResponse({ success: false, error: "오디오 데이터가 없습니다." });
            return;
        }
        
        // 설정 가져오기
        const settings = message.settings || {};
        const sourceLanguage = settings.sourceLanguage || state.settings.sourceLanguage || 'auto';
        const targetLanguage = settings.targetLanguage || state.settings.targetLanguage || 'ko';
        
        console.log(`[Whatsub] 오디오 처리 설정: 소스=${sourceLanguage}, 타겟=${targetLanguage}`);
        
        // TODO: Whisper API 또는 다른 STT 서비스를 사용하여 오디오 처리
        // 이 부분은 실제 구현을 위해 필요한 API 키와 서비스 설정이 필요
        
        // 임시 처리 (실제로는 API 호출이 필요)
        setTimeout(() => {
            // 현재 시간을 텍스트로 변환 (임시 데모용)
            const currentTime = new Date().toLocaleTimeString();
            
            const transcription = {
                original: `오디오 캡처 테스트 중 (${currentTime})`,
                translated: `Testing audio capture (${currentTime})`
            };
            
            // 사용량 업데이트
            state.usage.whisper.used += 1;
            
            console.log("[Whatsub] 오디오 처리 완료:", transcription);
            state.isProcessing = false;
            
            // 응답 전송
            sendResponse({
                success: true,
                transcription: transcription
            });
        }, 500);
        
        // true를 반환하여 비동기 응답을 사용함을 알림
        return true;
    } catch (error) {
        console.error("[Whatsub] 오디오 처리 오류:", error);
        state.isProcessing = false;
        sendResponse({ success: false, error: error.message });
    }
}

// 피드백 제출 처리
async function handleSendFeedback(message, sender, sendResponse) {
    try {
        const { type, subtitle } = message;
        
        // 사용자 정보 가져오기
        const userEmail = state.auth.user ? state.auth.user.email : '익명';
        
        // 피드백 데이터 구성
        const feedbackData = {
            type,
            subtitle,
            email: userEmail,
            url: sender.tab ? sender.tab.url : 'unknown',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        console.log("[Whatsub] 받은 피드백:", feedbackData);
        
        // 로컬 스토리지에 피드백 저장 (백엔드 연동 전까지 임시 저장)
        const storedData = await chrome.storage.local.get(['feedback']);
        const feedbackList = storedData.feedback || [];
        
        // 최신 피드백을 맨 앞에 추가
        feedbackList.unshift(feedbackData);
        
        // 최대 100개까지만 유지
        if (feedbackList.length > 100) {
            feedbackList.length = 100;
        }
        
        await chrome.storage.local.set({ feedback: feedbackList });
        
        sendResponse({
            success: true,
            message: "피드백이 저장되었습니다. 감사합니다!"
        });
    } catch (error) {
        console.error("[Whatsub] 피드백 처리 오류:", error);
        sendResponse({
            success: false,
            error: "피드백을 처리하는 중 오류가 발생했습니다: " + error.message
        });
    }
}

// 초기화 처리
async function initialize() {
    try {
        logInfo('백그라운드 서비스 초기화 중...');
        
        // 로그 로드
        await loadLogs();
        
        // 설정 로드
        await loadSettings();
        
        // 사용자 인증 상태 로드
        await initializeAuth();
        
        // 활성 탭 가져오기
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
            state.activeTabId = activeTab.id;
            initializeTabState(activeTab.id);
        }
        
        state.isInitialized = true;
        logInfo('백그라운드 서비스 초기화 완료');
        return true;
    } catch (error) {
        logError('초기화 오류', error);
        return false;
    }
}

// 메시지 리스너 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logDebug('받은 메시지', message.action);
    
    // promise를 사용하는 비동기 응답을 위한 처리
    const sendAsyncResponse = async (promise) => {
        try {
            const result = await promise;
            sendResponse(result);
        } catch (error) {
            logError('메시지 처리 오류', error);
            sendResponse({ 
                success: false, 
                error: '메시지 처리 중 오류가 발생했습니다: ' + error.message 
            });
        }
    };
    
    // 처리가 진행되지 않는 경우 기본 오류 처리
    const errorTimeout = setTimeout(() => {
        logError('메시지 처리 시간 초과', { action: message.action });
        sendResponse({ 
            success: false, 
            error: '요청 처리 시간이 초과되었습니다. 다시 시도해주세요.' 
        });
    }, 10000); // 10초 타임아웃
    
    try {
        switch (message.action) {
            case 'logEvent':
                sendAsyncResponse(handleLogEvent(message, sender));
                clearTimeout(errorTimeout);
                return true;
                
            case 'getLogs':
                sendAsyncResponse(handleGetLogs(message));
                clearTimeout(errorTimeout);
                return true;
                
            case 'checkAuth':
                sendAsyncResponse(handleCheckAuth(sendResponse));
                clearTimeout(errorTimeout);
                return true;
                
            case 'signInWithGoogle':
                // 클라이언트 ID를 받아서 처리
                handleGoogleSignIn(message, sender, sendResponse);
                clearTimeout(errorTimeout);
                return true;
                
            case 'signOut':
                sendAsyncResponse(handleSignOut(message, sender, sendResponse));
                clearTimeout(errorTimeout);
                return true;
                
            case 'startTabCapture':
                // 탭 캡처 요청은 즉시 응답을 반환하지 않고 콜백을 사용
                handleStartTabCapture(sendResponse);
                clearTimeout(errorTimeout);
                return true;
                
            case 'processAudio':
                // 오디오 처리 요청은 콜백을 사용
                handleProcessAudio(message, sender, sendResponse);
                clearTimeout(errorTimeout);
                return true;
                
            case 'getSettings':
                sendAsyncResponse(loadSettings());
                clearTimeout(errorTimeout);
                return true;
                
            case 'saveSettings':
                sendAsyncResponse(saveSettings(message.settings));
                clearTimeout(errorTimeout);
                return true;
                
            case 'checkSubscription':
                sendAsyncResponse(handleCheckSubscription(message.email));
                clearTimeout(errorTimeout);
                return true;
                
            case 'getUsage':
                sendAsyncResponse(handleGetUsage(message.email));
                clearTimeout(errorTimeout);
                return true;
                
            case 'sendFeedback':
                sendAsyncResponse(handleSendFeedback(message, sender, sendResponse));
                clearTimeout(errorTimeout);
                return true;
                
            case 'getLogStats':
                sendAsyncResponse(handleGetLogStats());
                clearTimeout(errorTimeout);
                return true;
                
            case 'clearLogs':
                sendAsyncResponse(handleClearLogs());
                clearTimeout(errorTimeout);
                return true;
                
            case 'setDebugMode':
                state.debugMode = message.enabled;
                chrome.storage.local.set({ debugMode: state.debugMode });
                sendResponse({ success: true });
                return false;
                
            default:
                logWarning('알 수 없는 메시지 액션', message.action);
                clearTimeout(errorTimeout);
                sendResponse({ 
                    success: false, 
                    error: `지원되지 않는 액션입니다: ${message.action}` 
                });
                return false;
        }
    } catch (error) {
        logError('메시지 처리 중 예외 발생', { action: message.action, error: error.message });
        clearTimeout(errorTimeout);
        sendResponse({ 
            success: false, 
            error: '메시지 처리 중 오류가 발생했습니다: ' + error.message 
        });
        return false;
    }
});

// 확장 프로그램 시작 시 초기화 실행
initialize();

// 로그 가져오기 처리
async function handleGetLogs(message) {
    try {
        const { limit = 100, level = null } = message;
        
        // 레벨로 필터링
        let filteredLogs = state.logs;
        if (level) {
            filteredLogs = state.logs.filter(log => log.level === level);
        }
        
        // 개수 제한
        const limitedLogs = filteredLogs.slice(0, limit);
        
        return {
            success: true,
            logs: limitedLogs,
            total: state.logs.length
        };
    } catch (error) {
        console.error('[Whatsub] 로그 가져오기 오류:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 콘텐츠 스크립트 로그 이벤트 처리
async function handleLogEvent(message, sender) {
    try {
        const { level, message: logMessage, details, source, url } = message;
        
        // 로그 객체 생성
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: logMessage,
            details: details,
            source: source || 'unknown',
            url: url || (sender.tab ? sender.tab.url : 'unknown'),
            tabId: sender.tab ? sender.tab.id : null
        };
        
        // 로그 배열에 추가
        state.logs.unshift(logEntry);
        
        // 최대 1000개 로그만 유지
        if (state.logs.length > 1000) {
            state.logs.pop();
        }
        
        // 로그 저장 스케줄링
        scheduleLogSave();
        
        return { success: true };
    } catch (error) {
        console.error('[Whatsub] 로그 이벤트 처리 오류:', error);
        return { success: false, error: error.message };
    }
}

// 설정 저장
async function saveSettings(settings) {
    return new Promise((resolve) => {
        try {
            // 설정 저장
            chrome.storage.sync.set({ settings }, () => {
                const error = chrome.runtime.lastError;
                if (error) {
                    logError('설정 저장 오류', error);
                    resolve({ success: false, error: error.message });
                    return;
                }
                
                // 상태 업데이트
                state.settings = { ...state.settings, ...settings };
                
                logInfo('설정 저장 완료', settings);
                resolve({ success: true });
            });
        } catch (error) {
            logError('설정 저장 중 예외 발생', error);
            resolve({ success: false, error: error.message });
        }
    });
}

// 팝업을 위한 로그 분석 통계 가져오기
async function handleGetLogStats() {
    try {
        // 로그 레벨별 카운트
        const stats = {
            total: state.logs.length,
            error: state.logs.filter(log => log.level === 'error').length,
            warn: state.logs.filter(log => log.level === 'warn').length,
            info: state.logs.filter(log => log.level === 'info').length,
            debug: state.logs.filter(log => log.level === 'debug').length,
            lastLogTime: state.logs.length > 0 ? state.logs[0].timestamp : null
        };
        
        return {
            success: true,
            stats
        };
    } catch (error) {
        logError('로그 통계 가져오기 오류', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 로그 지우기 처리
async function handleClearLogs() {
    try {
        // 로그 배열 초기화
        state.logs = [];
        
        // 로컬 스토리지에서도 제거
        await chrome.storage.local.remove('logs');
        
        logInfo('로그가 모두 삭제되었습니다.');
        
        return {
            success: true,
            message: '로그가 모두 삭제되었습니다.'
        };
    } catch (error) {
        logError('로그 삭제 오류', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 구독 확인 처리
async function handleCheckSubscription(email) {
    try {
        if (!email) {
            return {
                success: false,
                error: '이메일이 제공되지 않았습니다.'
            };
        }
        
        // 사용자 인증 확인
        if (!state.auth.isAuthenticated) {
            return {
                success: false,
                error: '인증되지 않은 사용자입니다.'
            };
        }
        
        logInfo('구독 확인 요청', { email });
        
        // 실제 구현에서는 Airtable 등에서 구독 정보 확인
        // 여기서는 간단한 예제로 기본 플랜 반환
        
        // 로컬 스토리지에서 사용자별 설정 확인
        const userData = await chrome.storage.local.get(['subscription_' + email]);
        
        // 기본 구독 정보
        const subscription = {
            plan: userData['subscription_' + email]?.plan || 'free',
            status: 'active',
            startDate: userData['subscription_' + email]?.startDate || new Date().toISOString(),
            endDate: null,
            limits: {
                whisper: 60,
                translation: 5000
            }
        };
        
        return {
            success: true,
            subscription
        };
    } catch (error) {
        logError('구독 확인 오류', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 사용량 가져오기 처리
async function handleGetUsage(email) {
    try {
        if (!email) {
            return {
                success: false,
                error: '이메일이 제공되지 않았습니다.'
            };
        }
        
        // 사용자 인증 확인
        if (!state.auth.isAuthenticated) {
            return {
                success: false,
                error: '인증되지 않은 사용자입니다.'
            };
        }
        
        logInfo('사용량 확인 요청', { email });
        
        // 로컬 스토리지에서 사용량 확인
        const usageData = await chrome.storage.local.get(['usage_' + email]);
        
        // 기본 사용량 정보
        const usage = {
            whisper: {
                used: usageData['usage_' + email]?.whisper?.used || 0,
                limit: state.usage.whisper.limit
            },
            translation: {
                used: usageData['usage_' + email]?.translation?.used || 0,
                limit: state.usage.translation.limit
            },
            lastUpdated: new Date().toISOString()
        };
        
        return {
            success: true,
            usage
        };
    } catch (error) {
        logError('사용량 확인 오류', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 오류 메시지를 콘솔에 출력하고 팝업으로 사용자에게 알림
function showErrorNotification(message, title = '오류 발생') {
    console.error(message);
    
    // 팝업에 오류 메시지 전달
    chrome.runtime.sendMessage({
        action: 'showNotification',
        data: {
            type: 'error',
            title: title,
            message: message
        }
    });
}

// 로그인 오류 처리 및 사용자에게 안내 메시지 표시
function handleLoginError(error) {
    console.error('[Background] 로그인 오류:', error);
    
    let errorMessage = '로그인 중 오류가 발생했습니다.';
    let errorTitle = '로그인 실패';
    
    if (error.errorType === 'redirect_uri_mismatch') {
        errorTitle = 'OAuth 리디렉션 URI 불일치';
        errorMessage = `Google 개발자 콘솔에 다음 리디렉션 URI를 등록해야 합니다: ${error.redirectUri || '확인할 수 없음'}`;
        
        // 개발자를 위한 자세한 안내
        console.error('[Background] 리디렉션 URI 불일치 해결 방법:');
        console.error('1. Google 개발자 콘솔(https://console.developers.google.com/)에 로그인');
        console.error('2. 해당 프로젝트의 OAuth 동의 화면 및 사용자 인증 정보에서 리디렉션 URI 설정');
        console.error(`3. 다음 URI를 추가: ${error.redirectUri || '확인할 수 없음'}`);
        
    } else if (error.errorType === 'invalid_client') {
        errorTitle = '잘못된 OAuth 클라이언트 ID';
        errorMessage = '유효하지 않은 OAuth 클라이언트 ID가 사용되었습니다. manifest.json의 client_id를 확인하세요.';
        
    } else if (error.errorType === 'access_denied') {
        errorTitle = '로그인 취소됨';
        errorMessage = '사용자가 로그인을 취소했습니다.';
        
    } else if (error.errorType === 'no_token') {
        errorTitle = '인증 토큰 오류';
        errorMessage = '인증 토큰을 가져올 수 없습니다.';
        
    } else if (error.errorType === 'user_info_failed') {
        errorTitle = '사용자 정보 오류';
        errorMessage = '사용자 정보를 가져올 수 없습니다.';
    }
    
    // 사용자에게 오류 메시지 알림
    showErrorNotification(errorMessage, errorTitle);
    
    return {
        success: false,
        error: errorMessage
    };
}

// Firebase SDK 모듈 로드
async function loadFirebaseSDK() {
    try {
        console.log('[Background] Firebase SDK 로드 시작');
        
        // 리디렉션 URI 미리 확인하고 로깅
        const redirectUri = chrome.identity.getRedirectURL('oauth2');
        console.log('[Background] 사용되는 OAuth 리디렉션 URI:', redirectUri);
        console.log('[Background] Google 개발자 콘솔에 등록 필요:', redirectUri);
        
        // 인라인으로 최소 기능 구현
        const inlineSignInWithGoogle = async () => {
            try {
                const manifest = chrome.runtime.getManifest();
                if (!manifest.oauth2 || !manifest.oauth2.client_id) {
                    console.log('[Firebase] OAuth 클라이언트 ID가 누락되었습니다.');
                    return {
                        success: false,
                        error: 'OAuth 클라이언트 ID가 설정되지 않았습니다.',
                        errorType: 'missing_client_id'
                    };
                }
                
                const clientId = manifest.oauth2.client_id;
                console.log('[Firebase] 사용할 클라이언트 ID:', clientId);
                
                if (clientId.includes('YOUR_') || clientId.includes('PLACEHOLDER') || clientId.length < 10) {
                    console.error('[Firebase] 유효하지 않은 OAuth 클라이언트 ID:', clientId);
                    return {
                        success: false,
                        error: '유효한 OAuth 클라이언트 ID가 설정되지 않았습니다.',
                        errorType: 'invalid_client_id',
                        invalidClientId: true
                    };
                }
                
                const redirectUrl = chrome.identity.getRedirectURL('oauth2');
                console.log('[Firebase] 리디렉션 URL:', redirectUrl);
                
                const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
                authUrl.searchParams.append('client_id', clientId);
                authUrl.searchParams.append('response_type', 'token');
                authUrl.searchParams.append('redirect_uri', redirectUrl);
                authUrl.searchParams.append('scope', 'openid email profile');
                
                console.log('[Firebase] 인증 URL:', authUrl.toString());
                
                // Chrome Identity API를 사용하여 로그인
                const responseUrl = await new Promise((resolve, reject) => {
                    chrome.identity.launchWebAuthFlow({
                        url: authUrl.toString(),
                        interactive: true
                    }, (redirectUrl) => {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || '인증 흐름 오류';
                            console.error('[Firebase] OAuth 흐름 오류:', errorMessage);
                            
                            if (errorMessage.includes('canceled')) {
                                reject(new Error('사용자가 로그인을 취소했습니다.'));
                                return;
                            }
                            
                            reject(new Error(`인증 흐름 오류: ${errorMessage}`));
                            return;
                        }
                        
                        if (!redirectUrl) {
                            console.error('[Firebase] 리디렉션 URL이 비어 있습니다.');
                            reject(new Error('리디렉션 URL이 비어 있습니다'));
                            return;
                        }
                        
                        resolve(redirectUrl);
                    });
                });
                
                if (!responseUrl) {
                    console.error('[Firebase] 로그인 응답 URL이 없습니다.');
                    return {
                        success: false,
                        error: '응답이 없습니다.',
                        errorType: 'no_response'
                    };
                }
                
                console.log('[Firebase] 인증 응답 받음, 토큰 파싱 중...');
                
                // 응답 URL에서 토큰 파싱
                const url = new URL(responseUrl);
                const params = new URLSearchParams(url.hash.substring(1));
                const token = params.get('access_token');
                const error = params.get('error');
                const errorDescription = params.get('error_description');
                
                if (error) {
                    console.error('[Firebase] OAuth 오류:', error, errorDescription || '');
                    
                    if (error === 'access_denied') {
                        return {
                            success: false,
                            error: '사용자가 로그인을 취소했습니다.',
                            errorType: 'access_denied'
                        };
                    } else if (error === 'invalid_client') {
                        return {
                            success: false,
                            error: 'OAuth 클라이언트 ID가 유효하지 않습니다.',
                            errorType: 'invalid_client',
                            invalidClientId: true
                        };
                    } else if (error === 'redirect_uri_mismatch') {
                        // 리디렉션 URI 불일치 오류 상세 로깅
                        console.error('[Firebase] 리디렉션 URI 불일치 오류');
                        console.error('[Firebase] 사용되는 리디렉션 URI:', redirectUrl);
                        console.error('[Firebase] Google 개발자 콘솔에 등록해야 합니다: https://console.cloud.google.com/apis/credentials');
                        
                        return {
                            success: false,
                            error: `리디렉션 URI 불일치 오류: Google 개발자 콘솔에 다음 URI를 등록해야 합니다 - ${redirectUrl}`,
                            errorType: 'redirect_uri_mismatch',
                            redirectUri: redirectUrl
                        };
                    }
                    
                    return {
                        success: false,
                        error: `OAuth 오류: ${error}`,
                        errorType: error
                    };
                }
                
                if (!token) {
                    console.error('[Firebase] 토큰을 가져올 수 없습니다.');
                    return {
                        success: false,
                        error: '인증 토큰을 가져올 수 없습니다.',
                        errorType: 'no_token'
                    };
                }
                
                console.log('[Firebase] 액세스 토큰 획득 성공, 사용자 정보 요청 중...');
                
                // 사용자 정보 가져오기
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!userInfoResponse.ok) {
                    console.error('[Firebase] 사용자 정보 요청 실패:', userInfoResponse.status);
                    return {
                        success: false,
                        error: '사용자 정보를 가져올 수 없습니다.',
                        errorType: 'user_info_failed'
                    };
                }
                
                const userInfo = await userInfoResponse.json();
                
                if (!userInfo || !userInfo.email) {
                    console.error('[Firebase] 사용자 정보가 불완전합니다.');
                    return {
                        success: false,
                        error: '사용자 정보가 불완전합니다.',
                        errorType: 'incomplete_user_info'
                    };
                }
                
                console.log('[Firebase] 사용자 로그인 성공:', userInfo.email);
                
                // 사용자 객체 생성
                const user = {
                    uid: userInfo.sub,
                    email: userInfo.email,
                    displayName: userInfo.name,
                    photoURL: userInfo.picture,
                    provider: 'google',
                    subscription: 'free',
                    usageLimit: 100,
                    usageCount: 0
                };
                
                return {
                    success: true,
                    user: user,
                    token: token
                };
            } catch (error) {
                console.error('[Firebase] Google 로그인 오류:', error);
                return {
                    success: false,
                    error: error.message || '로그인 중 오류가 발생했습니다.',
                    errorType: 'unknown_error'
                };
            }
        };
        
        // 함수를 포함한 객체 반환
        console.log('[Background] Firebase SDK 인라인 구현 완료');
        return {
            signInWithGoogle: inlineSignInWithGoogle
        };
    } catch (error) {
        console.error('[Background] Firebase SDK 로드 중 예외 발생:', error);
        return null;
    }
} 