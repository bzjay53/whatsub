// 오디오 캡처 및 처리 서비스
const audioService = {
    isInitialized: false,
    stream: null,
    mediaRecorder: null,
    audioContext: null,
    audioData: [],
    syncValue: 0,
    translationEnabled: true,
    sourceLanguage: 'ko',
    targetLanguage: 'en',

    initialize() {
        if (this.isInitialized) return true;
        
        try {
            // 의존성 체크
            const requiredServices = [
                'whisperApi',
                'translationService',
                'statusIndicator',
                'offlineRecognition',
                'monitoringService',
                'debugLogger',
                'errorHandler'
            ];

            for (const service of requiredServices) {
                if (!window[service]) {
                    throw new Error(`${service} 서비스가 로드되지 않았습니다.`);
                }
            }

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.isInitialized = true;
            window.debugLogger?.log('AudioService', 'initialize', '오디오 서비스가 초기화되었습니다.');
            return true;
        } catch (error) {
            window.debugLogger?.error('AudioService', 'initialize', error);
            window.statusIndicator?.updateStatus('오디오 서비스 초기화 실패', 'error');
            return false;
        }
    },

    async startCapture() {
        try {
            if (!this.isInitialized) {
                if (!this.initialize()) {
                    throw new Error('오디오 서비스가 초기화되지 않았습니다.');
                }
            }

            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioData.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioData, { type: 'audio/wav' });
                this.audioData = [];
                await this.processAudio(audioBlob);
            };

            this.mediaRecorder.start(1000);
            window.debugLogger?.log('AudioService', 'startCapture', '오디오 캡처가 시작되었습니다.');
            window.statusIndicator?.updateStatus('오디오 캡처 시작', 'info');
            return true;
        } catch (error) {
            window.debugLogger?.error('AudioService', 'startCapture', error);
            window.statusIndicator?.updateStatus('오디오 캡처 시작 실패', 'error');
            return false;
        }
    },

    async stopCapture() {
        try {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            window.debugLogger?.log('AudioService', 'stopCapture', '오디오 캡처가 중지되었습니다.');
            window.statusIndicator?.updateStatus('오디오 캡처 중지', 'info');
        } catch (error) {
            window.debugLogger?.error('AudioService', 'stopCapture', error);
            window.statusIndicator?.updateStatus('오디오 캡처 중지 실패', 'error');
        }
    },

    adjustSync(value) {
        this.syncValue = value;
        window.debugLogger?.log('AudioService', 'adjustSync', `싱크 값이 ${value}로 조정되었습니다.`);
    },

    setTranslationOptions(enabled, sourceLang, targetLang) {
        this.translationEnabled = enabled;
        this.sourceLanguage = sourceLang;
        this.targetLanguage = targetLang;
        window.debugLogger?.log('AudioService', 'setTranslationOptions', 
            `번역 설정이 업데이트되었습니다: ${enabled}, ${sourceLang} → ${targetLang}`);
    },

    async processAudio(audioBlob) {
        try {
            window.debugLogger?.log('AudioService', 'processAudio', '오디오 처리 시작');
            
            // 음성 인식 처리
            const text = await window.whisperApi.transcribe(audioBlob);
            
            // 번역 처리
            let translation = '';
            if (this.translationEnabled && text) {
                translation = await window.translationService.translate(
                    text,
                    this.sourceLanguage,
                    this.targetLanguage
                );
            }

            // 자막 업데이트
            if (text || translation) {
                window.subtitleService.updateSubtitle(text, translation);
                window.debugLogger?.log('AudioService', 'processAudio', '자막 업데이트 완료');
            }
        } catch (error) {
            window.debugLogger?.error('AudioService', 'processAudio', error);
            window.statusIndicator?.updateStatus('오디오 처리 중 오류가 발생했습니다.', 'error');
        }
    }
};

// 전역 객체에 등록
window.audioService = audioService;

// 초기화
audioService.initialize(); 