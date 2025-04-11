class AudioCaptureService {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.isCapturing = false;
        this.onAudioData = null;
    }

    async initialize() {
        try {
            this.audioContext = new AudioContext();
            return true;
        } catch (error) {
            console.error('오디오 컨텍스트 초기화 실패:', error);
            return false;
        }
    }

    async startCapture() {
        if (this.isCapturing) {
            return;
        }

        try {
            // 탭의 오디오 스트림 가져오기
            this.stream = await chrome.tabCapture.capture({
                audio: true,
                video: false
            });

            if (!this.stream) {
                throw new Error('오디오 스트림을 가져올 수 없습니다.');
            }

            // 오디오 컨텍스트 설정
            this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
            this.analyserNode = this.audioContext.createAnalyser();
            this.sourceNode.connect(this.analyserNode);

            // 미디어 레코더 설정
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm'
            });

            // 오디오 데이터 처리
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.onAudioData) {
                    this.onAudioData(event.data);
                }
            };

            // 레코딩 시작
            this.mediaRecorder.start(1000); // 1초마다 데이터 전송
            this.isCapturing = true;

            return true;
        } catch (error) {
            console.error('오디오 캡처 시작 실패:', error);
            await this.stopCapture();
            throw error;
        }
    }

    async stopCapture() {
        try {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }

            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
                this.audioContext = null;
            }

            this.isCapturing = false;
            return true;
        } catch (error) {
            console.error('오디오 캡처 중지 실패:', error);
            return false;
        }
    }

    setAudioDataCallback(callback) {
        this.onAudioData = callback;
    }

    isActive() {
        return this.isCapturing;
    }
}

// 서비스 내보내기
export default AudioCaptureService; 