import monitoringService from './monitoringService';
import audioCapture from './audioCapture';
import errorHandler from './errorHandler';

class SpeechRecognitionService {
    constructor() {
        this.isInitialized = false;
        this.isRecognizing = false;
        this.whisperSession = null;
        this.onTranscript = null;
        this.language = 'ko';
        this.bufferSize = 4096;
        this.sampleRate = 16000;
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.processor = null;
        this.audioQueue = [];
        this.processingInterval = null;
        this.onError = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        return errorHandler.retryOperation(async () => {
            try {
                this.audioContext = new AudioContext({
                    sampleRate: this.sampleRate,
                    latencyHint: 'interactive'
                });

                // 오디오 처리 노드 생성
                this.processor = this.audioContext.createScriptProcessor(
                    this.bufferSize,
                    1, // 입력 채널 수
                    1  // 출력 채널 수
                );

                this.processor.onaudioprocess = this.handleAudioProcess.bind(this);
                this.isInitialized = true;

                console.log('음성 인식 서비스가 초기화되었습니다.');
            } catch (error) {
                console.error('음성 인식 서비스 초기화 실패:', error);
                throw error;
            }
        });
    }

    async start() {
        return errorHandler.retryOperation(async () => {
            if (!this.isInitialized) {
                await this.initialize();
            }

            try {
                // 기존 세션 정리
                await this.stop();

                // 오디오 캡처 시작
                const stream = await audioCapture.startCapture();
                if (!stream) {
                    throw new Error('오디오 스트림을 가져올 수 없습니다.');
                }

                // 새로운 Whisper 세션 시작
                this.whisperSession = await this.createWhisperSession();
                
                // 오디오 입력 설정
                this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
                this.mediaStreamSource.connect(this.processor);
                this.processor.connect(this.audioContext.destination);

                // 오디오 처리 시작
                this.isRecognizing = true;
                this.startAudioProcessing();

                console.log('음성 인식이 시작되었습니다.');
            } catch (error) {
                await audioCapture.stopCapture();
                throw error;
            }
        });
    }

    async createWhisperSession() {
        return errorHandler.retryOperation(async () => {
            try {
                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${await this.getApiKey()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'whisper-1',
                        language: this.language,
                        response_format: 'json'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Whisper 세션 생성 실패: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Whisper 세션 생성 오류:', error);
                throw error;
            }
        });
    }

    async getApiKey() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['openai_api_key'], (result) => {
                if (result.openai_api_key) {
                    resolve(result.openai_api_key);
                } else {
                    reject(new Error('API 키를 찾을 수 없습니다.'));
                }
            });
        });
    }

    handleAudioProcess(event) {
        if (!this.isRecognizing) return;

        const startTime = performance.now();
        try {
            const inputData = event.inputBuffer.getChannelData(0);
            
            // 오디오 데이터 최적화
            const processedData = this.processAudioData(inputData);
            
            // 오디오 큐에 추가
            this.audioQueue.push(processedData);

            monitoringService.logAudioProcessing(
                performance.now() - startTime,
                true
            );
        } catch (error) {
            console.error('오디오 처리 오류:', error);
            monitoringService.logAudioProcessing(
                performance.now() - startTime,
                false
            );
        }
    }

    processAudioData(audioData) {
        // 음성 활성화 감지 (VAD)
        if (this.isSilent(audioData)) {
            return null;
        }

        // 16비트 PCM으로 변환
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF;
        }

        return pcmData;
    }

    isSilent(audioData) {
        const threshold = 0.01;
        let sum = 0;
        
        for (let i = 0; i < audioData.length; i++) {
            sum += Math.abs(audioData[i]);
        }
        
        const average = sum / audioData.length;
        return average < threshold;
    }

    startAudioProcessing() {
        this.processingInterval = setInterval(async () => {
            if (this.audioQueue.length === 0) return;

            const audioChunk = this.audioQueue.splice(0, this.audioQueue.length);
            if (!audioChunk.some(chunk => chunk !== null)) return;

            const startTime = performance.now();
            try {
                // Whisper API로 전송
                const transcript = await this.sendToWhisper(audioChunk);
                
                if (transcript && this.onTranscript) {
                    this.onTranscript(transcript);
                }

                monitoringService.logRecognitionRequest(
                    performance.now() - startTime,
                    true
                );
            } catch (error) {
                console.error('음성 인식 오류:', error);
                monitoringService.logRecognitionRequest(
                    performance.now() - startTime,
                    false
                );
            }
        }, 1000); // 1초마다 처리
    }

    async sendToWhisper(audioChunk) {
        return errorHandler.retryOperation(async () => {
            try {
                const wavBlob = this.createWavBlob(audioChunk);

                const formData = new FormData();
                formData.append('file', wavBlob, 'audio.wav');
                formData.append('model', 'whisper-1');
                formData.append('language', this.language);
                formData.append('response_format', 'json');

                const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${await this.getApiKey()}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Whisper API 요청 실패: ${response.status}`);
                }

                const result = await response.json();
                return result.text;
            } catch (error) {
                console.error('Whisper API 오류:', error);
                throw error;
            }
        });
    }

    createWavBlob(audioData) {
        // WAV 헤더 생성
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        // RIFF 청크
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + audioData.length * 2, true);
        writeString(view, 8, 'WAVE');

        // fmt 청크
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);

        // 데이터 청크
        writeString(view, 36, 'data');
        view.setUint32(40, audioData.length * 2, true);

        // WAV 파일 생성
        const blob = new Blob([
            wavHeader,
            audioData
        ], { type: 'audio/wav' });

        return blob;
    }

    async stop() {
        this.isRecognizing = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }

        if (this.processor) {
            this.processor.disconnect();
        }

        // 오디오 캡처 중지
        await audioCapture.stopCapture();

        this.audioQueue = [];
        console.log('음성 인식이 중지되었습니다.');
    }

    setLanguage(lang) {
        this.language = lang;
    }

    destroy() {
        this.stop();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
    }

    handleError(error) {
        const formattedError = errorHandler.formatErrorMessage(error);
        if (this.onError) {
            this.onError(formattedError);
        }
        console.error('음성 인식 오류:', formattedError);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export default new SpeechRecognitionService(); 