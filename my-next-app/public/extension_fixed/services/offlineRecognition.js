// 오프라인 음성 인식 서비스
const offlineRecognition = {
    isInitialized: true,
    recognition: null,
    language: 'ko-KR',
    isListening: false,

    initialize() {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('[whatsub] 음성 인식이 지원되지 않는 브라우저입니다.');
            return false;
        }

        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;

        this.setupEventListeners();
        return true;
    },

    setupEventListeners() {
        if (!this.recognition) return;

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            if (result.isFinal) {
                console.log('[whatsub] 음성 인식 결과:', result[0].transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[whatsub] 음성 인식 오류:', event.error);
        };
    },

    start() {
        if (!this.recognition || this.isListening) return;
        
        try {
            this.recognition.start();
            this.isListening = true;
            console.log('[whatsub] 오프라인 음성 인식 시작');
        } catch (error) {
            console.error('[whatsub] 음성 인식 시작 실패:', error);
        }
    },

    stop() {
        if (!this.recognition || !this.isListening) return;
        
        try {
            this.recognition.stop();
            this.isListening = false;
            console.log('[whatsub] 오프라인 음성 인식 중지');
        } catch (error) {
            console.error('[whatsub] 음성 인식 중지 실패:', error);
        }
    },

    setLanguage(lang) {
        this.language = lang;
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }
};

// 전역 객체에 등록
window.offlineRecognition = offlineRecognition;

// 초기화
offlineRecognition.initialize(); 