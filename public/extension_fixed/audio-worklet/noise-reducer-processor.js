/**
 * 노이즈 감소 AudioWorklet 프로세서
 * 
 * 기본적인 노이즈 감소 기능을 제공하는 AudioWorkletProcessor 구현
 * 문제가 있으면 오디오 데이터를 그대로 전달합니다.
 */

class NoiseReducerProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // 파라미터 초기화
        this.bufferSize = options.processorOptions?.bufferSize || 4096;
        this.noiseReductionLevel = options.processorOptions?.noiseReductionLevel || 0.2;
        this.isEnabled = true;
        
        // 노이즈 레벨 추정을 위한 변수
        this.noiseEstimate = 0.01;
        this.noiseHistory = [];
        this.noiseHistoryMaxSize = 10;
        
        // 현재 버퍼 위치
        this.bufferIndex = 0;
        this.buffer = new Float32Array(this.bufferSize);
        
        // 메시지 처리 설정
        this.port.onmessage = (event) => {
            if (event.data.command === 'setOptions') {
                this.handleSetOptions(event.data.options);
            }
        };
        
        console.log('[NoiseReducerProcessor] 초기화됨');
    }
    
    // 옵션 설정 핸들러
    handleSetOptions(options) {
        if (options.enabled !== undefined) {
            this.isEnabled = options.enabled;
        }
        
        if (options.noiseReductionLevel !== undefined) {
            this.noiseReductionLevel = options.noiseReductionLevel;
        }
        
        console.log('[NoiseReducerProcessor] 옵션 업데이트:', 
                    '활성화:', this.isEnabled, 
                    '감소 레벨:', this.noiseReductionLevel);
    }
    
    // 노이즈 레벨 추정
    estimateNoiseLevel(input) {
        // 단순한 RMS 값 계산
        let sumSquares = 0;
        for (let i = 0; i < input.length; i++) {
            sumSquares += input[i] * input[i];
        }
        
        const rms = Math.sqrt(sumSquares / input.length);
        
        // 노이즈 히스토리 업데이트
        this.noiseHistory.push(rms);
        if (this.noiseHistory.length > this.noiseHistoryMaxSize) {
            this.noiseHistory.shift();
        }
        
        // 히스토리 중 낮은 값들의 평균 계산 (노이즈로 간주)
        const sortedHistory = [...this.noiseHistory].sort((a, b) => a - b);
        const lowerHalf = sortedHistory.slice(0, Math.max(1, Math.floor(sortedHistory.length / 2)));
        
        let sum = 0;
        for (const value of lowerHalf) {
            sum += value;
        }
        
        // 노이즈 추정값 업데이트 (점진적 변화를 위해 이전 값 일부 유지)
        this.noiseEstimate = this.noiseEstimate * 0.7 + (sum / lowerHalf.length) * 0.3;
        
        return this.noiseEstimate;
    }
    
    // 노이즈 감소 적용
    applyNoiseReduction(input, noiseLevel) {
        const output = new Float32Array(input.length);
        
        // 임계값 설정 (노이즈 레벨 * 노이즈 감소 레벨)
        const threshold = noiseLevel * this.noiseReductionLevel;
        
        for (let i = 0; i < input.length; i++) {
            const absValue = Math.abs(input[i]);
            
            // 신호가 임계값보다 큰 경우 원본 값 사용
            if (absValue > threshold) {
                // 소프트 게이팅 적용 (부드러운 전환)
                const factor = Math.min(1, (absValue - threshold) / threshold);
                output[i] = input[i] * factor;
            } else {
                // 임계값보다 작은 경우 노이즈로 간주하고 감쇠
                output[i] = input[i] * 0.1;
            }
        }
        
        return output;
    }
    
    // 오디오 처리 메서드 (AudioWorkletProcessor에서 필수 구현)
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        
        // 입력이 없는 경우 처리 종료
        if (!input || !input.length || !input[0] || !input[0].length) {
            return true;
        }
        
        // 채널 데이터
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        // 버퍼에 데이터 추가
        for (let i = 0; i < inputChannel.length; i++) {
            this.buffer[this.bufferIndex++] = inputChannel[i];
            
            // 버퍼 처리 및 초기화
            if (this.bufferIndex >= this.bufferSize) {
                // 노이즈 감소 활성화 상태인 경우
                if (this.isEnabled) {
                    try {
                        // 노이즈 레벨 추정
                        const noiseLevel = this.estimateNoiseLevel(this.buffer);
                        
                        // 노이즈 감소 적용 및 메인 스레드로 전송
                        const processedBuffer = this.applyNoiseReduction(this.buffer, noiseLevel);
                        this.port.postMessage({ audioBuffer: processedBuffer });
                    } catch (error) {
                        // 오류 발생 시 원본 데이터 전달
                        console.error('[NoiseReducerProcessor] 처리 오류:', error);
                        this.port.postMessage({ audioBuffer: this.buffer.slice() });
                    }
                } else {
                    // 노이즈 감소 비활성화 상태인 경우 원본 데이터 전달
                    this.port.postMessage({ audioBuffer: this.buffer.slice() });
                }
                
                // 버퍼 초기화
                this.bufferIndex = 0;
            }
        }
        
        // 출력 채널에 입력 복사 (오디오 그래프 연속성 유지)
        for (let i = 0; i < inputChannel.length; i++) {
            outputChannel[i] = inputChannel[i];
        }
        
        // 계속 처리 (true 반환)
        return true;
    }
}

// AudioWorkletProcessor 등록
registerProcessor('noise-reducer-processor', NoiseReducerProcessor); 