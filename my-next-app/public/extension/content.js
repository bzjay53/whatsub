// IIFE를 사용하여 전역 네임스페이스 오염 방지
(async function() {
    // 전역 상태 관리
    const state = {
        subtitleContainer: null,
        subtitleEnabled: false,
        syncValue: 0,
        recognition: null,
        isRecognizing: false,
        audioContext: null,
        audioSource: null,
        audioProcessor: null,
        audioData: [],
        SAMPLE_RATE: 16000,
        isInitialized: false,
        services: {},
        settings: {}
    };

    // 전역 서비스 객체들
    const services = {
        statusIndicator: null,
        audioService: null,
        subtitleDisplay: null,
        authService: null,
        debugLogger: null
    };

    // 서비스 초기화 상태 관리
    let servicesInitialized = false;
    const serviceNames = ['debugLogger', 'statusIndicator', 'audioService', 'subtitleService'];
    const serviceStates = new Map();

    // 자막 표시 서비스
    class SubtitleDisplay {
        constructor() {
            this.container = null;
            this.originalSubtitle = null;
            this.translatedSubtitle = null;
            this.isVisible = false;
            this.settings = {
                fontSize: '20px',
                textColor: '#FFFFFF',
                backgroundColor: '#000000',
                opacity: 0.8
            };
        }

        async initialize() {
            try {
                this.createContainer();
                this.setupDraggable();
                return true;
            } catch (error) {
                console.error('자막 표시 초기화 실패:', error);
                return false;
            }
        }

        createContainer() {
            if (this.container) return;

            this.container = document.createElement('div');
            this.container.id = 'whatsub-container';
            this.container.className = 'draggable';
            this.container.style.display = 'none';

            // 원본 자막을 위한 div 생성
            this.originalSubtitle = document.createElement('div');
            this.originalSubtitle.className = 'subtitle-text original-subtitle';
            this.container.appendChild(this.originalSubtitle);

            // 번역된 자막을 위한 div 생성
            this.translatedSubtitle = document.createElement('div');
            this.translatedSubtitle.className = 'subtitle-text translated-subtitle';
            this.container.appendChild(this.translatedSubtitle);

            document.body.appendChild(this.container);
        }

        setupDraggable() {
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            const dragStart = (e) => {
                if (e.type === "mousedown") {
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                } else {
                    initialX = e.touches[0].clientX - xOffset;
                    initialY = e.touches[0].clientY - yOffset;
                }
                
                if (e.target === this.container) {
                    isDragging = true;
                }
            };

            const dragEnd = () => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            };

            const drag = (e) => {
                if (isDragging) {
                    e.preventDefault();

                    if (e.type === "mousemove") {
                        currentX = e.clientX - initialX;
                        currentY = e.clientY - initialY;
                    } else {
                        currentX = e.touches[0].clientX - initialX;
                        currentY = e.touches[0].clientY - initialY;
                    }

                    xOffset = currentX;
                    yOffset = currentY;

                    this.setTranslate(currentX, currentY);
                }
            };

            this.container.addEventListener("mousedown", dragStart, false);
            document.addEventListener("mousemove", drag, false);
            document.addEventListener("mouseup", dragEnd, false);
            this.container.addEventListener("touchstart", dragStart, false);
            document.addEventListener("touchmove", drag, false);
            this.container.addEventListener("touchend", dragEnd, false);
        }

        setTranslate(xPos, yPos) {
            this.container.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }

        setVisibility(visible) {
            this.isVisible = visible;
            if (this.container) {
                this.container.style.display = visible ? 'block' : 'none';
            }
        }

        updateText(original, translated = '') {
            if (this.originalSubtitle) {
                this.originalSubtitle.textContent = original;
            }
            if (this.translatedSubtitle) {
                this.translatedSubtitle.textContent = translated;
            }
        }

        applySettings(settings) {
            this.settings = { ...this.settings, ...settings };
            if (this.container) {
                Object.assign(this.container.style, {
                    fontSize: this.settings.fontSize,
                    color: this.settings.textColor,
                    backgroundColor: this.settings.backgroundColor,
                    opacity: this.settings.opacity
                });
            }
        }

        destroy() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            this.container = null;
            this.originalSubtitle = null;
            this.translatedSubtitle = null;
        }
    }

    // 자막 표시/숨김 토글
    async function toggleSubtitles() {
        try {
            if (!state.isInitialized) {
                throw new Error('서비스가 초기화되지 않았습니다.');
            }

            if (!services.subtitleDisplay || !services.audioCapture) {
                throw new Error('필수 서비스를 찾을 수 없습니다.');
            }

            state.subtitleEnabled = !state.subtitleEnabled;
            
            if (state.subtitleEnabled) {
                // 자막 활성화
                await services.audioCapture.startCapture();
                services.subtitleDisplay.setVisibility(true);
                services.statusIndicator.updateStatus('자막 서비스가 시작되었습니다.', 'success');
            } else {
                // 자막 비활성화
                await services.audioCapture.stopCapture();
                services.subtitleDisplay.setVisibility(false);
                services.statusIndicator.updateStatus('자막 서비스가 중지되었습니다.', 'info');
            }

            return {
                success: true,
                state: {
                    subtitleEnabled: state.subtitleEnabled
                }
            };
        } catch (error) {
            services.debugLogger.error('자막 토글 오류: ' + error.message);
            // 에러 발생 시 상태 초기화
            state.subtitleEnabled = false;
            services.subtitleDisplay?.setVisibility(false);
            await services.audioCapture?.stopCapture();
            throw error;
        }
    }

    // 자막 싱크 조절
    async function adjustSync(value) {
        try {
            if (!services.audioService) {
                throw new Error('오디오 서비스가 초기화되지 않았습니다.');
            }
            state.syncValue = value;
            services.audioService.adjustSync(value);
            await chrome.storage.local.set({ syncValue: value });
            services.statusIndicator?.updateStatus(`자막 싱크가 ${value > 0 ? '+' : ''}${value}초로 조정되었습니다.`, 'info');
        } catch (error) {
            console.error('싱크 조절 오류:', error);
            services.statusIndicator?.updateStatus('싱크 조절 중 오류가 발생했습니다.', 'error');
        }
    }

    // 자막 스타일 업데이트
    async function updateSubtitleStyle(settings) {
        try {
            await chrome.storage.local.set({ 
                subtitleSettings: {
                    ...settings,
                    lastModified: new Date().toISOString()
                }
            });
            services.subtitleDisplay.applySettings(settings);
            services.statusIndicator.updateStatus('자막 스타일이 업데이트되었습니다.', 'success');
        } catch (error) {
            console.error('자막 스타일 업데이트 오류:', error);
            services.statusIndicator.updateStatus('자막 스타일 업데이트 중 오류가 발생했습니다.', 'error');
        }
    }

    // 자막 텍스트 업데이트 함수
    function updateSubtitleText(text) {
        if (!state.subtitleContainer) return;
        
        const originalSubtitle = state.subtitleContainer.querySelector('.original-subtitle');
        if (originalSubtitle) {
            originalSubtitle.textContent = text;
        }
    }

    // 음성 인식 초기화 함수
    function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }

        state.recognition = new webkitSpeechRecognition();
        state.recognition.continuous = true;
        state.recognition.interimResults = true;
        state.recognition.lang = 'ko-KR';  // 기본 언어를 한국어로 설정

        state.recognition.onstart = () => {
            state.isRecognizing = true;
            console.log('음성 인식이 시작되었습니다.');
        };

        state.recognition.onend = () => {
            state.isRecognizing = false;
            console.log('음성 인식이 중지되었습니다.');
            // 음성 인식이 중단되면 자동으로 재시작
            if (state.subtitleEnabled) {
                state.recognition.start();
            }
        };

        state.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // 자막 표시 업데이트
            if (finalTranscript || interimTranscript) {
                updateSubtitleText(finalTranscript || interimTranscript);
            }
        };

        state.recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
        };
    }

    // 오디오 스트림 처리 함수
    function handleAudioStream() {
        if (!state.audioContext) {
            state.audioContext = new AudioContext();
        }

        // 음성 인식 시작
        if (!state.recognition) {
            initSpeechRecognition();
        }
        
        if (!state.isRecognizing) {
            state.recognition.start();
        }
    }

    // 오디오 데이터 처리 함수
    async function handleAudioData(audioData) {
        try {
            if (!state.subtitleEnabled) return;

            // 오디오 데이터를 백그라운드로 전송
            await chrome.runtime.sendMessage({
                action: 'processAudio',
                data: await audioData.arrayBuffer()
            });
        } catch (error) {
            services.debugLogger.error('오디오 데이터 처리 오류: ' + error.message);
        }
    }

    // 음성 감지 함수
    function detectVoice(audioData) {
        // 간단한 음성 감지 알고리즘
        // RMS(Root Mean Square) 값을 계산하여 일정 임계값 이상인지 확인
        const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
        const threshold = 0.01; // 임계값 (조정 가능)
        
        return rms > threshold;
    }

    // 서비스 초기화 함수
    async function initializeServices() {
        try {
            // 디버그 로거 초기화
            services.debugLogger = {
                log: (message) => console.log('[WhatsUp]', message),
                error: (message) => console.error('[WhatsUp]', message),
                warn: (message) => console.warn('[WhatsUp]', message),
                info: (message) => console.info('[WhatsUp]', message)
            };

            // 상태 표시기 초기화
            services.statusIndicator = {
                element: null,
                timeout: null,
                createStatusElement() {
                    if (!this.element) {
                        this.element = document.createElement('div');
                        this.element.className = 'status-indicator';
                        document.body.appendChild(this.element);
                    }
                },
                updateStatus(message, type = 'info') {
                    this.createStatusElement();
                    this.element.textContent = message;
                    this.element.className = `status-indicator status-${type}`;
                    this.element.style.opacity = '1';

                    if (this.timeout) {
                        clearTimeout(this.timeout);
                    }

                    this.timeout = setTimeout(() => {
                        this.element.style.opacity = '0';
                    }, 3000);
                }
            };

            // 자막 표시 서비스 초기화
            services.subtitleDisplay = new SubtitleDisplay();
            await services.subtitleDisplay.initialize();

            // 오디오 서비스 초기화
            services.audioService = {
                syncValue: 0,
                translationEnabled: true,
                sourceLanguage: 'en',
                targetLanguage: 'ko',
                adjustSync(value) {
                    this.syncValue = value;
                },
                setTranslationOptions(enabled, source, target) {
                    this.translationEnabled = enabled;
                    this.sourceLanguage = source;
                    this.targetLanguage = target;
                }
            };

            // 인증 서비스 초기화
            services.authService = {
                async checkAuth() {
                    return new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
                            resolve(response);
                        });
                    });
                }
            };

            // 모든 서비스가 초기화되었음을 알림
            state.isInitialized = true;
            services.statusIndicator.updateStatus('서비스가 초기화되었습니다.', 'success');
            
            return true;
        } catch (error) {
            console.error('서비스 초기화 오류:', error);
            services.statusIndicator?.updateStatus('서비스 초기화 중 오류가 발생했습니다.', 'error');
            return false;
        }
    }

    // 초기화 함수
    async function initialize() {
        try {
            // 서비스 초기화
            const servicesInitialized = await initializeServices();
            if (!servicesInitialized) {
                throw new Error('서비스 초기화에 실패했습니다.');
            }

            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 설정 복원
            await restoreSettings();
            
            state.isInitialized = true;
            services.statusIndicator.updateStatus('초기화가 완료되었습니다.', 'success');
        } catch (error) {
            console.error('초기화 오류:', error);
            if (services.statusIndicator) {
                services.statusIndicator.updateStatus('초기화 중 오류가 발생했습니다: ' + error.message, 'error');
            }
            throw error;
        }
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 기존 리스너 제거
        window.removeEventListener('unload', cleanup);
        
        // 페이지 언로드 시 정리
        window.addEventListener('unload', cleanup);

        // 메시지 리스너
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // 초기화 상태 확인
            if (!state.isInitialized && message.action !== 'getState') {
                sendResponse({ success: false, error: '서비스가 초기화되지 않았습니다.' });
                return false;
            }

            // 즉시 응답이 가능한 경우
            if (message.action === 'getState') {
                sendResponse({ 
                    success: true, 
                    state: {
                        isInitialized: state.isInitialized,
                        services: Object.keys(services)
                    }
                });
                return false;
            }

            // 비동기 처리가 필요한 경우
            handleMessage(message, sender)
                .then(response => {
                    try {
                        sendResponse(response);
                    } catch (error) {
                        console.error('응답 전송 실패:', error);
                    }
                })
                .catch(error => {
                    console.error('메시지 처리 오류:', error);
                    try {
                        sendResponse({ 
                            success: false, 
                            error: error.message || '알 수 없는 오류가 발생했습니다.' 
                        });
                    } catch (sendError) {
                        console.error('오류 응답 전송 실패:', sendError);
                    }
                });

            return true; // 비동기 응답을 위해 true 반환
        });
    }

    // 리소스 정리
    async function cleanup() {
        try {
            if (state.subtitleEnabled) {
                if (services.audioCapture) {
                    await services.audioCapture.stopCapture();
                }
                if (services.subtitleDisplay) {
                    services.subtitleDisplay.setVisibility(false);
                    if (services.subtitleDisplay.container && services.subtitleDisplay.container.parentNode) {
                        services.subtitleDisplay.container.parentNode.removeChild(services.subtitleDisplay.container);
                    }
                }
            }
            state.isInitialized = false;
            state.subtitleEnabled = false;
        } catch (error) {
            console.error('리소스 정리 중 오류:', error);
        }
    }

    // 메시지 핸들러
    async function handleMessage(message, sender) {
        try {
            let response;
            
            switch (message.action) {
                case 'toggleSubtitles':
                    response = await toggleSubtitles();
                    break;

                case 'adjustSync':
                    await adjustSync(message.value);
                    response = { success: true };
                    break;

                case 'updateStyle':
                    await updateSubtitleStyle(message.settings);
                    response = { success: true };
                    break;

                case 'updateSubtitle':
                    if (state.subtitleEnabled && services.subtitleDisplay) {
                        services.subtitleDisplay.updateText(message.text, message.translation);
                    }
                    response = { success: true };
                    break;

                case 'getStatus':
                    response = {
                        success: true,
                        enabled: state.subtitleEnabled,
                        syncValue: state.syncValue
                    };
                    break;

                case 'updateSettings':
                    if (services.subtitleDisplay) {
                        services.subtitleDisplay.applySettings(message.settings);
                    }
                    response = { success: true };
                    break;

                default:
                    throw new Error(`알 수 없는 액션: ${message.action}`);
            }

            return response;
        } catch (error) {
            services.debugLogger?.error('메시지 처리 오류: ' + error.message);
            services.statusIndicator?.updateStatus('요청 처리 중 오류가 발생했습니다.', 'error');
            throw error;
        }
    }

    // 초기화 시작
    async function restoreSettings() {
        try {
            const data = await chrome.storage.local.get([
                'subtitleSettings',
                'syncValue',
                'lastUsed',
                'subtitleEnabled',
                'translationEnabled',
                'sourceLanguage',
                'targetLanguage'
            ]);

            // 자막 설정 복원
            if (data.subtitleSettings) {
                services.subtitleDisplay?.applySettings(data.subtitleSettings);
            }

            // 싱크 값 복원
            if (typeof data.syncValue === 'number' && services.audioService) {
                services.audioService.adjustSync(data.syncValue);
            }

            // 번역 설정 복원
            if (services.audioService) {
                services.audioService.setTranslationOptions(
                    data.translationEnabled !== false,
                    data.sourceLanguage || 'en',
                    data.targetLanguage || 'ko'
                );
            }

            // 자막 상태 복원
            if (data.subtitleEnabled && data.lastUsed) {
                const now = new Date();
                const lastUsed = new Date(data.lastUsed);
                const hoursDiff = (now - lastUsed) / (1000 * 60 * 60);
                
                if (hoursDiff <= 24) {
                    await toggleSubtitles();
                }
            }

            services.statusIndicator?.updateStatus('설정이 복원되었습니다.', 'success');
        } catch (error) {
            console.error('설정 복원 오류:', error);
            services.statusIndicator?.updateStatus('설정을 복원하는 중 오류가 발생했습니다.', 'error');
        }
    }

    // 초기 번역 설정 로드
    chrome.storage.local.get(
        ['translationEnabled', 'sourceLanguage', 'targetLanguage'],
        (result) => {
            services.audioService.setTranslationOptions(
                result.translationEnabled !== false,
                result.sourceLanguage || 'en',
                result.targetLanguage || 'ko'
            );
        }
    );

    // DOM이 로드된 후 초기화 시작
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(); 