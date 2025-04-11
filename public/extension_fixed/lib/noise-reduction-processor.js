/**
 * WhatsUb 확장 프로그램을 위한 노이즈 감소 AudioWorklet 프로세서
 * AudioWorklet 프로세서는 효율적인 실시간 오디오 처리를 위해 사용됩니다.
 */

class NoiseReductionProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // 기본 설정
        this.bufferSize = options.processorOptions?.bufferSize || 2048;
        this.noiseFloor = options.processorOptions?.noiseFloor || 0.015;
        this.reductionAmount = options.processorOptions?.reductionAmount || 0.7;
        this.attackTime = options.processorOptions?.attackTime || 0.02;
        this.releaseTime = options.processorOptions?.releaseTime || 0.3;
        
        // 처리 상태
        this.enabled = true;
        this.inputBuffer = new Float32Array(this.bufferSize);
        this.inputBufferIndex = 0;
        this.noiseProfile = new Float32Array(this.bufferSize);
        this.hasNoiseProfile = false;
        this.calibrationCount = 0;
        
        // 노이즈 감소 알고리즘을 위한 시간 상수 계산
        const sampleRate = 48000;  // AudioWorklet의 기본 샘플 레이트
        this.attackCoef = Math.exp(-1 / (sampleRate * this.attackTime));
        this.releaseCoef = Math.exp(-1 / (sampleRate * this.releaseTime));
        
        // 노이즈 게이트 상태
        this.envelopeFollower = 0;
        
        // 메시지 핸들러 설정
        this.port.onmessage = this.handleMessage.bind(this);
        
        console.log('NoiseReductionProcessor 초기화됨', {
            bufferSize: this.bufferSize,
            noiseFloor: this.noiseFloor,
            reductionAmount: this.reductionAmount
        });
    }
    
    // 메시지 핸들러
    handleMessage(event) {
        const data = event.data;
        
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'enable':
                this.enabled = !!data.value;
                console.log(`노이즈 감소 ${this.enabled ? '활성화' : '비활성화'}`);
                break;
                
            case 'setParams':
                if (data.noiseFloor !== undefined) {
                    this.noiseFloor = data.noiseFloor;
                }
                if (data.reductionAmount !== undefined) {
                    this.reductionAmount = data.reductionAmount;
                }
                if (data.attackTime !== undefined) {
                    this.attackTime = data.attackTime;
                    this.attackCoef = Math.exp(-1 / (sampleRate * this.attackTime));
                }
                if (data.releaseTime !== undefined) {
                    this.releaseTime = data.releaseTime;
                    this.releaseCoef = Math.exp(-1 / (sampleRate * this.releaseTime));
                }
                
                console.log('노이즈 감소 매개변수 업데이트됨', {
                    noiseFloor: this.noiseFloor,
                    reductionAmount: this.reductionAmount
                });
                break;
                
            case 'calibrate':
                this.calibrationCount = 0;
                this.noiseProfile.fill(0);
                this.hasNoiseProfile = false;
                console.log('노이즈 프로파일 보정 시작');
                break;
        }
    }
    
    // 노이즈 프로파일 구축 (처음 몇 프레임의 오디오 데이터를 사용)
    buildNoiseProfile(inputBuffer) {
        if (this.calibrationCount < 10) {
            // 현재 입력 버퍼의 에너지 계산
            let rms = 0;
            for (let i = 0; i < inputBuffer.length; i++) {
                rms += inputBuffer[i] * inputBuffer[i];
            }
            rms = Math.sqrt(rms / inputBuffer.length);
            
            // 매우 조용한 음향만 노이즈 프로파일에 추가
            if (rms < 0.01) {
                // 노이즈 프로파일 업데이트
                for (let i = 0; i < inputBuffer.length; i++) {
                    const absVal = Math.abs(inputBuffer[i]);
                    this.noiseProfile[i] = Math.max(this.noiseProfile[i], absVal);
                }
                this.calibrationCount++;
                
                if (this.calibrationCount >= 10) {
                    // 노이즈 프로파일 구축 완료
                    this.hasNoiseProfile = true;
                    
                    // 약간의 여유 추가
                    for (let i = 0; i < this.noiseProfile.length; i++) {
                        this.noiseProfile[i] *= 1.2;
                    }
                    
                    console.log('노이즈 프로파일 구축 완료');
                }
            }
        }
    }
    
    // 오디오 데이터 처리
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        // 입력이 없으면 처리 중단
        if (!input || !input[0] || input[0].length === 0) {
            return true;
        }
        
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        // 노이즈 감소가 비활성화된 경우 오디오 통과
        if (!this.enabled) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            
            this.sendAudioData(inputChannel);
            return true;
        }
        
        // 노이즈 프로파일이 없는 경우 구축 시도
        if (!this.hasNoiseProfile) {
            this.buildNoiseProfile(inputChannel);
        }
        
        // 노이즈 감소 처리
        for (let i = 0; i < inputChannel.length; i++) {
            // 입력 신호 크기
            const inputMagnitude = Math.abs(inputChannel[i]);
            
            // 포락선 팔로워 업데이트 (신호 레벨 추적)
            if (inputMagnitude > this.envelopeFollower) {
                this.envelopeFollower = this.attackCoef * this.envelopeFollower + (1 - this.attackCoef) * inputMagnitude;
            } else {
                this.envelopeFollower = this.releaseCoef * this.envelopeFollower + (1 - this.releaseCoef) * inputMagnitude;
            }
            
            // 게인 계산 (노이즈 감소 적용)
            let gain = 1.0;
            
            if (this.hasNoiseProfile) {
                // 노이즈 프로파일 기반 게인 계산
                const profileSample = this.noiseProfile[i % this.noiseProfile.length];
                const noiseThreshold = Math.max(profileSample, this.noiseFloor);
                
                if (this.envelopeFollower < noiseThreshold) {
                    // 노이즈로 간주되는 신호 감쇠
                    gain = 1.0 - this.reductionAmount;
                } else if (this.envelopeFollower < noiseThreshold * 2) {
                    // 노이즈와 신호 사이의 영역 부드럽게 전환
                    const range = noiseThreshold;
                    const position = this.envelopeFollower - noiseThreshold;
                    const ratio = position / range;
                    gain = ratio + (1.0 - ratio) * (1.0 - this.reductionAmount);
                }
            } else {
                // 단순 노이즈 게이트 (노이즈 프로파일이 없는 경우)
                if (this.envelopeFollower < this.noiseFloor) {
                    gain = 1.0 - this.reductionAmount;
                } else if (this.envelopeFollower < this.noiseFloor * 2) {
                    const ratio = (this.envelopeFollower - this.noiseFloor) / this.noiseFloor;
                    gain = ratio + (1.0 - ratio) * (1.0 - this.reductionAmount);
                }
            }
            
            // 게인 적용
            outputChannel[i] = inputChannel[i] * gain;
        }
        
        // 처리된 오디오 데이터 전송
        this.sendAudioData(outputChannel);
        
        // 프로세서 계속 실행
        return true;
    }
    
    // 처리된 오디오 데이터를 메인 스레드로 전송
    sendAudioData(buffer) {
        // 버퍼에 오디오 데이터 추가
        for (let i = 0; i < buffer.length; i++) {
            this.inputBuffer[this.inputBufferIndex++] = buffer[i];
            
            // 버퍼가 가득 차면 메인 스레드로 전송
            if (this.inputBufferIndex >= this.bufferSize) {
                this.port.postMessage({
                    type: 'audioData',
                    buffer: this.inputBuffer.slice(0)
                });
                
                // 버퍼 초기화
                this.inputBufferIndex = 0;
            }
        }
    }
}

// AudioWorklet 프로세서 등록
registerProcessor('noise-reduction-processor', NoiseReductionProcessor); 