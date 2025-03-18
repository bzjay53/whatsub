// 전역 변수 선언
let audioContext = null;
let mediaStreamSource = null;
let audioStream = null;

// Chrome Extension의 background script
let activeTabId = null;
let isInitialized = false;

// 상태 관리
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
    isInitialized: false
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
                settings: state.settings
            }
        };
    } catch (error) {
        console.error('초기화 중 오류:', error);
        return { success: false, error: error.message };
    }
}

// 확장 프로그램이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        console.log('확장 프로그램이 설치되었습니다.');
    } else if (details.reason === 'update') {
        console.log('확장 프로그램이 업데이트되었습니다.');
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

// 탭 오디오 캡처 시작
async function startTabCapture(tabId) {
    try {
        // 기존 캡처 중지
        if (state.audioStream) {
            stopTabCapture();
        }

        // 탭의 오디오 스트림 캡처
        const stream = await chrome.tabCapture.capture({
            audio: true,
            video: false
        });

        if (!stream) {
            throw new Error('오디오 스트림을 캡처할 수 없습니다.');
        }

        state.audioStream = stream;

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

        // content script에 스트림 준비 완료 알림
        chrome.tabs.sendMessage(tabId, {
            action: 'audioStreamReady'
        }).catch(error => {
            console.error('스트림 준비 알림 오류:', error);
        });

        return { success: true };
    } catch (error) {
        console.error('탭 캡처 오류:', error);
        throw error;
    }
}

// 탭 오디오 캡처 중지
function stopTabCapture() {
    try {
        if (state.audioStream) {
            state.audioStream.getTracks().forEach(track => track.stop());
            state.audioStream = null;
        }
        if (state.mediaStreamSource) {
            state.mediaStreamSource.disconnect();
            state.mediaStreamSource = null;
        }
        if (state.audioContext) {
            state.audioContext.close();
            state.audioContext = null;
        }
    } catch (error) {
        console.error('탭 캡처 중지 오류:', error);
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

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id || state.activeTabId;
    let currentTabState;

    const handleAsyncMessage = async () => {
        try {
            switch (message.action) {
                case 'initialize':
                    const initResult = await handleInitialize();
                    sendResponse(initResult);
                    break;

                case 'checkAuth':
                    // 인증 상태 확인
                    sendResponse({
                        success: true,
                        isAuthenticated: true, // 임시로 true 반환
                        user: {
                            name: "테스트 사용자",
                            email: "test@example.com"
                        },
                        plan: "free"
                    });
                    break;

                case 'openLoginPage':
                    chrome.tabs.create({ url: chrome.runtime.getURL('/public/extension/popup/login.html') });
                    sendResponse({ success: true });
                    break;

                case 'openSignupPage':
                    chrome.tabs.create({ url: chrome.runtime.getURL('/public/extension/popup/signup.html') });
                    sendResponse({ success: true });
                    break;

                case 'openUpgradePage':
                    chrome.tabs.create({ url: chrome.runtime.getURL('/public/extension/popup/upgrade.html') });
                    sendResponse({ success: true });
                    break;

                case 'logout':
                    if (tabId) {
                        currentTabState = initializeTabState(tabId);
                        currentTabState.isAuthenticated = false;
                        currentTabState.user = null;
                    }
                    sendResponse({ success: true });
                    break;

                case 'updateStatus':
                    if (!message.status) {
                        throw new Error('상태 정보가 필요합니다.');
                    }
                    if (tabId) {
                        currentTabState = initializeTabState(tabId);
                        currentTabState.status = message.status;
                    }
                    sendResponse({ success: true });
                    break;

                case 'toggleSubtitles':
                    if (!tabId) {
                        throw new Error('탭 ID가 필요합니다.');
                    }
                    currentTabState = initializeTabState(tabId);
                    currentTabState.subtitleEnabled = !currentTabState.subtitleEnabled;
                    
                    if (currentTabState.subtitleEnabled) {
                        await startTabCapture(tabId);
                    } else {
                        stopTabCapture();
                    }
                    
                    sendResponse({ 
                        success: true,
                        state: {
                            subtitleEnabled: currentTabState.subtitleEnabled
                        }
                    });
                    break;

                case 'updateSettings':
                    if (!message.settings) {
                        throw new Error('설정 데이터가 필요합니다.');
                    }
                    if (tabId) {
                        currentTabState = initializeTabState(tabId);
                        currentTabState.settings = { ...currentTabState.settings, ...message.settings };
                    }
                    state.settings = { ...state.settings, ...message.settings };
                    await chrome.storage.local.set(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'processAudio':
                    await processAudioData(message.data, sender);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: `알 수 없는 액션: ${message.action}` });
                    break;
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    handleAsyncMessage();
    return true; // 비동기 응답을 위해 true 반환
});

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

// Service Worker 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
        }).then(registration => {
            console.log('Service Worker 등록 성공:', registration.scope);
        }).catch(error => {
            console.error('Service Worker 등록 실패:', error);
        });
    });
} 