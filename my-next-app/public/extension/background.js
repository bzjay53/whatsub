import { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE_ID, SUBSCRIPTION_PLANS } from './lib/airtable-config.js';
import { getUserByEmail, createUser, updateUser, getAirtableHeaders, getAirtableUrl } from './lib/airtable-api.js';
import { getCurrentUser, checkSubscription, updateUsage, canUseFeature, signInWithGoogle, signOut } from './lib/firebase-sdk.js';

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
        plan: 'free',
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
    }
};

// 탭 활성화 감지
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    state.activeTabId = activeInfo.tabId;
});

// 탭 업데이트 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        activeTabId = tabId;
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

// 초기화 처리
async function handleInitialize() {
    try {
        // 설정 로드
        await loadSettings();
        
        // 사용자 인증 상태 로드
        await loadAuthStatus();
        
        // 활성 탭 가져오기
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
            state.activeTabId = activeTab.id;
            initializeTabState(activeTab.id);
        }
        
        state.isInitialized = true;
        
        return {
            success: true,
            state: {
                isInitialized: state.isInitialized,
                activeTabId: state.activeTabId,
                settings: state.settings,
                auth: state.auth
            }
        };
    } catch (error) {
        console.error('초기화 중 오류:', error);
        return { success: false, error: error.message };
    }
}

// 사용자 인증 상태 로드
async function loadAuthStatus() {
    try {
        const data = await chrome.storage.local.get(['user', 'usage']);
        const user = data.user;
        
        if (user && user.email) {
            console.log('로그인된 사용자:', user.email);
            
            state.auth.isAuthenticated = true;
            state.auth.user = user;
            
            // 구독 상태 확인
            try {
                const subscription = await checkSubscription(user.email);
                console.log('구독 상태:', subscription);
                state.auth.plan = subscription;
                
                // Whisper 및 번역 사용량 제한 설정
                if (subscription === 'premium') {
                    state.usage.whisper.limit = SUBSCRIPTION_PLANS.premium.whisperLimit;
                    state.usage.translation.limit = SUBSCRIPTION_PLANS.premium.translationLimit;
                } else {
                    state.usage.whisper.limit = SUBSCRIPTION_PLANS.free.whisperLimit;
                    state.usage.translation.limit = SUBSCRIPTION_PLANS.free.translationLimit;
                }
            } catch (error) {
                console.warn('구독 상태 확인 오류:', error);
                state.auth.plan = 'free';
            }
            
            // 사용량 정보 로드
            if (data.usage) {
                state.usage = data.usage;
            } else {
                // 기본 사용량 설정
                const usage = {
                    whisper: {
                        used: 0,
                        limit: state.usage.whisper.limit
                    },
                    translation: {
                        used: 0,
                        limit: state.usage.translation.limit
                    }
                };
                await chrome.storage.local.set({ usage });
                state.usage = usage;
            }
        } else {
            console.log('로그인되지 않은 상태');
            state.auth.isAuthenticated = false;
            state.auth.user = null;
            state.auth.plan = 'free';
        }
    } catch (error) {
        console.error('인증 상태 로드 오류:', error);
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.plan = 'free';
    }
}

// 확장 프로그램이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('확장 프로그램 설치/업데이트:', details.reason);
    
    // 설치 시 초기화
    if (details.reason === 'install') {
        console.log('Whatsub 확장 프로그램이 설치되었습니다.');
        chrome.tabs.create({ url: 'welcome.html' });
    }
    
    // 업데이트 시 초기화
    if (details.reason === 'update') {
        console.log('Whatsub 확장 프로그램이 업데이트되었습니다.');
    }
    await handleInitialize();
});

// 탭이 업데이트될 때 content script 재주입 여부 확인
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes("youtube.com")) {
        try {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(error => {
                console.error('스크립트 실행 중 오류 발생:', error);
            });
        } catch (error) {
            console.error('executeScript 호출 중 오류 발생:', error);
        }
    }
});

// 오디오 캡처 함수
async function captureTab() {
    try {
        // 현재 활성 탭 가져오기
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        // 탭 캡처 시작
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: tab.id.toString()
                }
            }
        });

        return stream;
    } catch (error) {
        console.error('Tab capture error:', error);
        throw error;
    }
}

// 메시지 핸들러 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('메시지 수신:', message.action, message);

    // 비동기 응답을 위한 코드
    const handleAsyncMessage = async () => {
        try {
            switch (message.action) {
                case 'initialize':
                    const initResult = await handleInitialize();
                    sendResponse(initResult);
                    break;

                case 'getState':
                    const state = await getState();
                    sendResponse(state);
                    break;

                case 'updateSettings':
                    const updateResult = await handleUpdateSettings(message.settings);
                    sendResponse(updateResult);
                    break;

                case 'signInWithGoogle':
                    const signInResult = await handleSignInWithGoogle();
                    sendResponse(signInResult);
                    break;

                case 'signOut':
                    const signOutResult = await handleLogout();
                    sendResponse(signOutResult);
                    break;

                case 'checkSubscription':
                    const subscriptionResult = await handleCheckSubscription();
                    sendResponse(subscriptionResult);
                    break;

                case 'updateUsage':
                    await handleUpdateUsage(message, sender, sendResponse);
                    break;

                case 'canUseFeature':
                    const canUseResult = await handleCanUseFeature(message.feature);
                    sendResponse(canUseResult);
                    break;

                // ... other message handlers ...

                default:
                    console.warn('처리되지 않은 메시지:', message.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('메시지 처리 중 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    // 비동기 처리를 위해 true 반환
    handleAsyncMessage();
    return true;
});

// 탭의 스크립트 실행
async function executeContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        return { success: true };
    } catch (error) {
        console.error('스크립트 실행 오류:', error);
        return { success: false, error: error.message };
    }
}

// 탭 오디오 캡처 시작
async function startTabCapture(tabId) {
    try {
        // 기존 캡처 중지
        if (state.audioStream) {
            stopTabCapture();
        }

        // 현재 활성 탭 가져오기
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('활성 탭을 찾을 수 없습니다.');
            }
            tabId = tab.id;
        }

        // 탭의 오디오 스트림 캡처
        const stream = await new Promise((resolve, reject) => {
            chrome.tabCapture.capture({
                audio: true,
                video: false
            }, (stream) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(stream);
                }
            });
        });

        if (!stream) {
            throw new Error('오디오 스트림을 캡처할 수 없습니다.');
        }

        state.audioStream = stream;
        state.activeTabId = tabId;

        // AudioContext 생성
        if (!state.audioContext) {
            state.audioContext = new AudioContext();
        }

        // 미디어 스트림 소스 생성
        state.mediaStreamSource = state.audioContext.createMediaStreamSource(stream);

        // 스크립트 프로세서 노드 생성
        const processor = state.audioContext.createScriptProcessor(4096, 1, 1);
        
        // 오디오 처리
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            // 오디오 데이터를 content script로 전송
            chrome.tabs.sendMessage(tabId, {
                action: 'audioData',
                data: Array.from(inputData)
            }).catch(error => {
                console.error('오디오 데이터 전송 오류:', error);
            });
        };

        // 노드 연결
        state.mediaStreamSource.connect(processor);
        processor.connect(state.audioContext.destination);

        return { success: true };
    } catch (error) {
        console.error('탭 캡처 오류:', error);
        return { success: false, error: error.message };
    }
}

// 탭 오디오 캡처 중지
function stopTabCapture() {
    try {
        if (state.audioStream) {
            state.audioStream.getTracks().forEach(track => track.stop());
            state.audioStream = null;
        }
        if (state.audioContext) {
            state.audioContext.close();
            state.audioContext = null;
        }
        state.mediaStreamSource = null;
        state.activeTabId = null;
        return { success: true };
    } catch (error) {
        console.error('캡처 중지 오류:', error);
        return { success: false, error: error.message };
    }
}

// 설정 로드
async function loadSettings() {
    try {
        const data = await chrome.storage.local.get(null);
        state.settings = {
            translationEnabled: data.translationEnabled !== false,
            sourceLanguage: data.sourceLanguage || 'auto',
            targetLanguage: data.targetLanguage || 'ko',
            subtitleSettings: data.subtitleSettings || {},
            syncValue: data.syncValue || 0
        };
    } catch (error) {
        console.error('설정 로드 오류:', error);
        throw error;
    }
}

// 오디오 처리 상태
let audioProcessingState = {
    isProcessing: false,
    currentBuffer: null,
    whisperModel: null
};

// Whisper 모델 초기화
async function initializeWhisperModel() {
    try {
        if (!audioProcessingState.whisperModel) {
            // Whisper 모델 로드 (실제 구현에서는 적절한 모델 로드 로직 필요)
            audioProcessingState.whisperModel = {
                transcribe: async (buffer) => {
                    // 임시 구현: 실제로는 Whisper API 호출 필요
                    return {
                        text: "음성 인식 결과가 여기에 표시됩니다.",
                        language: "ko"
                    };
                }
            };
        }
        return true;
    } catch (error) {
        console.error('Whisper 모델 초기화 실패:', error);
        return false;
    }
}

// 오디오 데이터 처리
async function processAudioData(audioData, sender) {
    try {
        if (!audioProcessingState.whisperModel) {
            await initializeWhisperModel();
        }

        // 오디오 데이터가 충분히 쌓였는지 확인
        if (!audioProcessingState.currentBuffer) {
            audioProcessingState.currentBuffer = audioData;
        } else {
            // 버퍼 합치기
            const newBuffer = new Uint8Array(audioProcessingState.currentBuffer.byteLength + audioData.byteLength);
            newBuffer.set(new Uint8Array(audioProcessingState.currentBuffer), 0);
            newBuffer.set(new Uint8Array(audioData), audioProcessingState.currentBuffer.byteLength);
            audioProcessingState.currentBuffer = newBuffer.buffer;
        }

        // 버퍼가 일정 크기(예: 30초) 이상이면 처리
        if (audioProcessingState.currentBuffer.byteLength >= 30 * 16000 * 2) { // 30초 * 샘플레이트 * 2바이트
            if (!audioProcessingState.isProcessing) {
                audioProcessingState.isProcessing = true;

                try {
                    // Whisper 모델로 음성 인식
                    const result = await audioProcessingState.whisperModel.transcribe(audioProcessingState.currentBuffer);

                    // 결과를 컨텐츠 스크립트로 전송
                    if (sender.tab?.id) {
                        await chrome.tabs.sendMessage(sender.tab.id, {
                            action: 'updateSubtitle',
                            text: result.text
                        });
                    }

                    // 번역이 필요한 경우 번역 처리
                    if (state.settings.translateEnabled) {
                        const translatedText = await translateText(result.text, result.language, state.settings.targetLanguage);
                        if (sender.tab?.id) {
                            await chrome.tabs.sendMessage(sender.tab.id, {
                                action: 'updateSubtitle',
                                text: result.text,
                                translation: translatedText
                            });
                        }
                    }
                } finally {
                    // 처리 완료 후 상태 초기화
                    audioProcessingState.isProcessing = false;
                    audioProcessingState.currentBuffer = null;
                }
            }
        }
    } catch (error) {
        console.error('오디오 처리 오류:', error);
        audioProcessingState.isProcessing = false;
        audioProcessingState.currentBuffer = null;
    }
}

// 자막 토글 함수
async function toggleSubtitles() {
    try {
        // 현재 활성 탭 가져오기
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('활성 탭을 찾을 수 없습니다.');
        }
        
        const tabId = tab.id;
        const tabState = initializeTabState(tabId);
        
        // 토글 상태 변경
        const isEnabled = !tabState.subtitleEnabled;
        tabState.subtitleEnabled = isEnabled;
        
        // 탭에 상태 변경 메시지 전송
        chrome.tabs.sendMessage(tabId, {
            action: 'toggleSubtitles',
            enabled: isEnabled
        });
        
        // 활성화된 경우 오디오 캡처 시작, 비활성화된 경우 중지
        if (isEnabled) {
            await startTabCapture(tabId);
        } else {
            stopTabCapture();
        }
        
        return {
            success: true,
            state: {
                subtitleEnabled: isEnabled
            }
        };
    } catch (error) {
        console.error('자막 토글 오류:', error);
        return { success: false, error: error.message };
    }
}

// 탭 제거 시 상태 정리
chrome.tabs.onRemoved.addListener((tabId) => {
    state.tabs.delete(tabId);
});

// 확장 프로그램 설치/업데이트 시 설정 로드
chrome.runtime.onInstalled.addListener(loadSettings);

// 브라우저 시작 시 설정 로드
loadSettings();

// 탭이 닫히거나 변경될 때 캡처 중지
chrome.tabs.onRemoved.addListener(() => {
    stopTabCapture();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        stopTabCapture();
    }
});

// 기본 background script
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// 사용자 로그인 처리
async function handleLogin(data) {
    try {
        state.ui.loading = true;
        state.ui.error = null;
        
        console.log('Google 로그인 시작...');
        const userCredential = await signInWithGoogle();
        console.log('Google 로그인 성공:', userCredential);
        
        if (!userCredential || !userCredential.user) {
            throw new Error('로그인 실패: 사용자 정보가 없습니다.');
        }
        
        const user = userCredential.user;
        
        // Airtable에 사용자 정보 저장
        try {
            const userData = {
                Email: user.email,
                Name: user.displayName || '',
                'Profile Picture': user.photoURL || '',
                'Last Login': new Date().toISOString().split('T')[0]
            };
            
            // 기존 사용자가 있는지 확인하고 없으면 생성
            const existingUser = await getUserByEmail(user.email);
            if (existingUser) {
                console.log('기존 사용자 업데이트:', user.email);
                await updateUser(existingUser.id, userData);
            } else {
                console.log('새 사용자 생성:', user.email);
                await createUser(userData);
            }
        } catch (airtableError) {
            console.error('Airtable 사용자 정보 저장 오류:', airtableError);
            
            // Airtable 오류는 로그인 실패로 처리하지 않음
            // 대신 사용자에게 알려줄 메시지를 설정
            chrome.storage.local.set({
                'airtable_error': {
                    message: `Airtable 오류: ${airtableError.message}`,
                    timestamp: new Date().getTime()
                }
            });
        }
        
        // 상태 업데이트
        state.auth.isAuthenticated = true;
        state.auth.user = user;
        state.auth.error = null;
        state.ui.currentTab = 'dashboard';
        state.ui.loading = false;
        
        console.log('로그인 완료:', state.auth.user);
        
        // 구독 정보 확인
        await handleCheckSubscription();
        
        return { 
            success: true, 
            user: state.auth.user,
            subscription: state.usage // 구독 및 사용량 정보 포함
        };
    } catch (error) {
        console.error('로그인 오류:', error);
        
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.error = error.message;
        state.ui.loading = false;
        
        return { 
            success: false, 
            error: `로그인 실패: ${error.message}` 
        };
    }
}

// 구독 정보 확인 핸들러
async function handleCheckSubscription() {
    try {
        if (!state.auth.isAuthenticated || !state.auth.user) {
            return { 
                success: false, 
                error: '인증되지 않은 사용자' 
            };
        }
        
        console.log('구독 정보 확인:', state.auth.user.email);
        
        // Airtable에서 사용자 정보와 사용량 조회
        const userRecord = await getUserFromAirtable(state.auth.user.email);
        
        if (!userRecord) {
            throw new Error('사용자 정보를 찾을 수 없습니다');
        }
        
        const fields = userRecord.fields;
        const subscriptionType = fields['Subscription Type'] || 'free';
        
        // 구독 플랜 정보 가져오기
        const planInfo = SUBSCRIPTION_PLANS[subscriptionType] || SUBSCRIPTION_PLANS.free;
        
        // 상태 업데이트
        state.usage = {
            whisper: {
                limit: planInfo.whisperLimit,
                used: fields['Whisper Minutes Used'] || 0
            },
            translation: {
                limit: planInfo.translationLimit,
                used: fields['Translation Characters Used'] || 0
            },
            subscriptionType: subscriptionType
        };
        
        // 로컬 저장소에도 업데이트
        await updateLocalUsage('whisper', state.usage.whisper.used);
        await updateLocalUsage('translation', state.usage.translation.used);
        
        console.log('구독 정보 업데이트 완료:', state.usage);
        
        return { 
            success: true, 
            usage: state.usage
        };
    } catch (error) {
        console.error('구독 정보 확인 오류:', error);
        return { 
            success: false, 
            error: `구독 정보 확인 실패: ${error.message}` 
        };
    }
}

// 사용량 업데이트에 대한 메시지 처리 함수
async function handleUpdateUsage(message, sender, sendResponse) {
    try {
        const { type, amount } = message;
        
        if (!state.auth.isAuthenticated || !state.auth.user || !state.auth.user.email) {
            console.error('사용량 업데이트 실패: 인증되지 않은 사용자');
            sendResponse({ success: false, error: '인증되지 않은 사용자' });
            return;
        }
        
        console.log(`handleUpdateUsage 호출: ${type}, ${amount}`);
        
        // Firebase SDK의 updateUsage 함수를 사용
        const result = await updateUsage(state.auth.user.email, type, amount);
        
        // 상태 업데이트
        if (result.success) {
            if (type === 'whisper') {
                state.usage.whisper.used += Number(amount);
            } else if (type === 'translation') {
                state.usage.translation.used += Number(amount);
            }
        }
        
        sendResponse({ success: result.success });
    } catch (error) {
        console.error('사용량 업데이트 중 오류 발생:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 로컬 사용량 업데이트
async function updateLocalUsage(type, amount) {
    try {
        const key = `${type}Used`;
        await chrome.storage.local.set({ [key]: amount });
        
        return {
            success: true,
            [key]: amount
        };
    } catch (error) {
        console.error(`${type} 사용량 업데이트 오류:`, error);
        return {
            success: false,
            error: `${type} 사용량 업데이트 실패: ${error.message}`
        };
    }
}

// 사용량 조회 핸들러
async function handleGetUsage() {
    try {
        // 로컬 스토리지에서 사용량 정보 조회
        const data = await chrome.storage.local.get(['whisperUsed', 'translationUsed']);
        
        const whisperUsed = data.whisperUsed || 0;
        const translationUsed = data.translationUsed || 0;
        
        // 상태 업데이트
        state.usage.whisper.used = whisperUsed;
        state.usage.translation.used = translationUsed;
        
        return {
            success: true,
            usage: state.usage
        };
    } catch (error) {
        console.error('사용량 조회 오류:', error);
        return {
            success: false,
            error: `사용량 조회 실패: ${error.message}`
        };
    }
}

// 설정 업데이트 핸들러
async function handleUpdateSettings(settings) {
    try {
        if (!settings) {
            return {
                success: false,
                error: '유효하지 않은 설정'
            };
        }
        
        // 상태 업데이트
        state.settings = {
            ...state.settings,
            ...settings
        };
        
        // 로컬 스토리지에 저장
        await chrome.storage.local.set({ settings: state.settings });
        
        return {
            success: true,
            settings: state.settings
        };
    } catch (error) {
        console.error('설정 업데이트 오류:', error);
        return {
            success: false,
            error: `설정 업데이트 실패: ${error.message}`
        };
    }
}

// 설정 조회 핸들러
async function handleGetSettings() {
    try {
        // 로컬 스토리지에서 설정 조회
        const data = await chrome.storage.local.get('settings');
        
        if (data.settings) {
            // 상태 업데이트
            state.settings = {
                ...state.settings,
                ...data.settings
            };
        }
        
        return {
            success: true,
            settings: state.settings
        };
    } catch (error) {
        console.error('설정 조회 오류:', error);
        return {
            success: false,
            error: `설정 조회 실패: ${error.message}`
        };
    }
}

// 전체 상태 조회 핸들러
async function handleGetState() {
    return {
        success: true,
        state: state
    };
}

async function handleCanUseFeature(feature) {
    try {
        const result = await canUseFeature(feature);
        return result;
    } catch (error) {
        console.error('기능 사용 가능 여부 확인 오류:', error);
        return {
            canUse: false,
            error: error.message
        };
    }
}

// Google 로그인 처리
async function handleSignInWithGoogle() {
    try {
        console.log('구글 로그인 처리 시작...');
        
        // Manifest에서 OAuth 클라이언트 ID 확인
        const manifest = chrome.runtime.getManifest();
        if (!manifest.oauth2 || !manifest.oauth2.client_id) {
            console.error('OAuth 클라이언트 ID가 manifest.json에 없거나 유효하지 않습니다.');
            throw new Error('OAuth 설정 오류: 클라이언트 ID를 확인해주세요.');
        }
        
        // Google 로그인 실행
        const token = await signInWithGoogle().catch(error => {
            console.error('Google 로그인 실패:', error);
            
            // 사용자가 취소한 경우 특별 처리
            if (error.message && (
                error.message.includes('취소') || 
                error.message.includes('canceled') || 
                error.message.includes('not approve'))) {
                throw new Error('Google 계정 접근 권한을 허용해주세요.');
            }
            
            // 클라이언트 ID 오류 특별 처리
            if (error.message && (
                error.message.includes('invalid_client') || 
                error.message.includes('client_id'))) {
                throw new Error('OAuth 설정 오류: 유효하지 않은 클라이언트 ID입니다. 관리자에게 문의해주세요.');
            }
            
            throw error;
        });
        
        // 액세스 토큰 구문 분석
        const accessToken = extractAccessToken(token);
        if (!accessToken) {
            throw new Error('액세스 토큰을 가져올 수 없습니다.');
        }
        
        // Google 사용자 정보 가져오기
        const userInfo = await fetchUserInfo(accessToken);
        if (!userInfo || !userInfo.email) {
            throw new Error('사용자 정보를 가져올 수 없습니다.');
        }
        
        // 사용자 정보 및 로그인 상태 저장
        let airtableSuccess = true;
        let userSubscription = 'free';
        
        // Airtable에 사용자 정보 저장 (오류가 있어도 로그인 진행)
        try {
            console.log('Airtable 사용자 정보 확인 중...');
            
            // Airtable에서 사용자 조회
            const existingUser = await getUserByEmail(userInfo.email);
            
            if (existingUser) {
                console.log('기존 사용자 발견:', existingUser);
                userSubscription = existingUser.fields.Subscription || 'free';
            } else {
                console.log('신규 사용자 생성 중...');
                
                // 새 사용자 생성
                const newUser = await createUser({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    subscription: 'free',
                    usage: 0,
                    created_at: new Date().toISOString()
                });
                
                console.log('신규 사용자 생성 완료:', newUser);
            }
        } catch (airtableError) {
            console.warn('Airtable 작업 실패, 기본 기능은 계속 유지됩니다:', airtableError);
            airtableSuccess = false;
        }
        
        // 로그인 성공으로 처리
        const userId = generateUserId(userInfo.email);
        const userData = {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            subscription: userSubscription,
            lastLogin: new Date().toISOString()
        };
        
        // 로컬 스토리지에 사용자 정보 저장
        await chrome.storage.local.set({
            userId: userId,
            userData: userData,
            isLoggedIn: true,
            loginTime: Date.now(),
            airtableSuccess: airtableSuccess
        });
        
        console.log('로그인 성공! 사용자 ID:', userId);
        
        // 로그인 상태를 클라이언트에 알림
        return {
            success: true,
            userData: userData,
            airtableSuccess: airtableSuccess
        };
    } catch (error) {
        console.error('로그인 처리 오류:', error);
        
        // 특정 오류 메시지 처리
        let errorMessage = error.message || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
        
        // 오류 응답 반환
        return {
            success: false,
            error: errorMessage
        };
    }
} 