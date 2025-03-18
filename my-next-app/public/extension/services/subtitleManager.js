import speechRecognition from './speechRecognition';
import subtitleDisplay from '../components/SubtitleDisplay';
import translationService from './translationService';
import errorHandler from './errorHandler';
import monitoringService from './monitoringService';
import audioService from './audioService';
import authService from './authService';
import debugLogger from './debugLogger';

class SubtitleManager {
    constructor() {
        this.isActive = false;
        this.settings = {
            targetLanguage: 'ko',
            enableTranslation: true,
            syncDelay: 0
        };
        this.currentSession = null;
        this.subtitleContainer = null;
        this.subtitleEnabled = false;
        this.syncValue = 0;
        this.recognition = null;
        this.isRecognizing = false;
        this.audioContext = null;
        this.audioSource = null;
        this.audioProcessor = null;
        this.audioData = [];
        this.SAMPLE_RATE = 16000;

        // 이벤트 바인딩
        this.handleAudioStream = this.handleAudioStream.bind(this);
        this.processAudioData = this.processAudioData.bind(this);
        this.updateSubtitleText = this.updateSubtitleText.bind(this);
    }

    async initialize() {
        try {
            debugLogger.log('SubtitleManager', 'initialize', '자막 관리자 초기화 시작');
            this.createSubtitleContainer();
            await this.restoreSettings();
            this.initSpeechRecognition();
            debugLogger.log('SubtitleManager', 'initialize', '자막 관리자 초기화 완료');
        } catch (error) {
            debugLogger.error('SubtitleManager', 'initialize', error);
            throw new Error('자막 관리자 초기화 실패: ' + error.message);
        }
    }

    createSubtitleContainer() {
        if (this.subtitleContainer) return;

        this.subtitleContainer = document.createElement('div');
        this.subtitleContainer.id = 'whatsub-container';
        this.subtitleContainer.className = 'draggable';
        this.subtitleContainer.style.display = 'none';

        // 원본 자막을 위한 div 생성
        const originalSubtitle = document.createElement('div');
        originalSubtitle.className = 'subtitle-text original-subtitle';
        this.subtitleContainer.appendChild(originalSubtitle);

        // 번역된 자막을 위한 div 생성
        const translatedSubtitle = document.createElement('div');
        translatedSubtitle.className = 'subtitle-text translated-subtitle';
        this.subtitleContainer.appendChild(translatedSubtitle);

        document.body.appendChild(this.subtitleContainer);
        this.setupDraggable();
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
            
            if (e.target === this.subtitleContainer) {
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

                this.setTranslate(currentX, currentY, this.subtitleContainer);
            }
        };

        this.subtitleContainer.addEventListener("mousedown", dragStart, false);
        document.addEventListener("mousemove", drag, false);
        document.addEventListener("mouseup", dragEnd, false);
        this.subtitleContainer.addEventListener("touchstart", dragStart, false);
        document.addEventListener("touchmove", drag, false);
        document.addEventListener("touchend", dragEnd, false);
    }

    setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    async start() {
        try {
            debugLogger.log('SubtitleManager', 'start', '자막 서비스 시작 시도');
            
            // 자막 활성화 전 권한 확인
            const canUseWhisper = await authService.canUseWhisperAI();
            if (!canUseWhisper) {
                throw new Error('Whisper AI 사용 권한이 없습니다. Pro 플랜으로 업그레이드해 주세요.');
            }

            // 사용량 확인
            const usage = await authService.getRemainingUsage();
            if (usage.whisperMinutes <= 0) {
                throw new Error('Whisper AI 사용 시간이 모두 소진되었습니다. 사용량을 확인해 주세요.');
            }

            // 자막 서비스 시작
            await audioService.startCapture();
            this.setVisibility(true);
            this.subtitleEnabled = true;
            
            // 상태 저장
            await chrome.storage.local.set({ 
                subtitleEnabled: true,
                lastUsed: new Date().toISOString()
            });

            debugLogger.log('SubtitleManager', 'start', '자막 서비스 시작 완료');
        } catch (error) {
            debugLogger.error('SubtitleManager', 'start', error);
            throw error;
        }
    }

    async stop() {
        try {
            debugLogger.log('SubtitleManager', 'stop', '자막 서비스 중지 시도');
            
            await audioService.stopCapture();
            this.setVisibility(false);
            this.subtitleEnabled = false;
            
            // 상태 저장
            await chrome.storage.local.set({ 
                subtitleEnabled: false,
                lastUsed: new Date().toISOString()
            });

            debugLogger.log('SubtitleManager', 'stop', '자막 서비스 중지 완료');
        } catch (error) {
            debugLogger.error('SubtitleManager', 'stop', error);
            throw error;
        }
    }

    setVisibility(visible) {
        if (this.subtitleContainer) {
            this.subtitleContainer.style.display = visible ? 'block' : 'none';
        }
    }

    isRunning() {
        return this.subtitleEnabled;
    }

    async updateSettings(settings) {
        try {
            debugLogger.log('SubtitleManager', 'updateSettings', { settings });
            
            await chrome.storage.local.set({ 
                subtitleSettings: {
                    ...settings,
                    lastModified: new Date().toISOString()
                }
            });

            // 번역 설정 업데이트
            if (settings.sourceLanguage || settings.targetLanguage) {
                audioService.setTranslationOptions(
                    settings.enableTranslation,
                    settings.sourceLanguage,
                    settings.targetLanguage
                );
            }

            debugLogger.log('SubtitleManager', 'updateSettings', '설정 업데이트 완료');
        } catch (error) {
            debugLogger.error('SubtitleManager', 'updateSettings', error);
            throw error;
        }
    }

    async restoreSettings() {
        try {
            debugLogger.log('SubtitleManager', 'restoreSettings', '설정 복원 시도');
            
            const data = await chrome.storage.local.get([
                'subtitleEnabled',
                'subtitleSettings',
                'syncValue',
                'lastUsed'
            ]);

            // 싱크 값 복원
            if (data.syncValue !== undefined) {
                this.syncValue = data.syncValue;
                audioService.adjustSync(this.syncValue);
            }

            // 자막 스타일 복원
            if (data.subtitleSettings) {
                await this.updateSettings(data.subtitleSettings);
            }

            debugLogger.log('SubtitleManager', 'restoreSettings', '설정 복원 완료');
        } catch (error) {
            debugLogger.error('SubtitleManager', 'restoreSettings', error);
            throw error;
        }
    }

    async initializeComponents() {
        try {
            console.log('컴포넌트 초기화 시작...');

            // 음성 인식 서비스 초기화
            await speechRecognition.initialize();
            console.log('음성 인식 서비스 초기화 완료');

            // 자막 표시 컴포넌트 초기화
            if (!subtitleDisplay.isInitialized) {
                subtitleDisplay.initialize();
                console.log('자막 표시 컴포넌트 초기화 완료');
            }

            // 이벤트 리스너 설정
            this.setupEventListeners();
            console.log('이벤트 리스너 설정 완료');
        } catch (error) {
            console.error('컴포넌트 초기화 실패:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // 음성 인식 결과 처리
        speechRecognition.onTranscript = async (transcript) => {
            if (!this.isActive) return;

            try {
                console.log('음성 인식 결과 수신:', transcript);

                // 동기화 딜레이 적용
                if (this.settings.syncDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.settings.syncDelay));
                }

                // 번역 처리
                let translatedText = '';
                if (this.settings.enableTranslation) {
                    try {
                        console.log('번역 시작...');
                        translatedText = await translationService.translate(
                            transcript,
                            'auto',
                            this.settings.targetLanguage
                        );
                        console.log('번역 완료:', translatedText);
                    } catch (error) {
                        console.error('번역 실패:', error);
                        monitoringService.logWarning('번역 실패', { error });
                    }
                }

                // 자막 업데이트
                console.log('자막 업데이트 시작...');
                subtitleDisplay.updateText(transcript, translatedText);
                console.log('자막 업데이트 완료');

            } catch (error) {
                console.error('음성 인식 결과 처리 실패:', error);
                monitoringService.logWarning('음성 인식 결과 처리 실패', { error });
            }
        };

        // 음성 인식 오류 처리
        speechRecognition.onError = (error) => {
            console.error('음성 인식 오류 발생:', error);
            monitoringService.logWarning('음성 인식 오류', { error });
            this.stop();
        };
    }

    getCurrentSession() {
        return this.currentSession;
    }
}

export default new SubtitleManager(); 
export default new SubtitleManager(); 