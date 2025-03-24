/**
 * 노이즈 감소를 위한 AudioWorklet 프로세서
 * ScriptProcessorNode 대신 AudioWorklet을 사용하여 오디오를 처리하는 현대적인 접근 방식입니다.
 */
class NoiseReductionProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // 기본 설정 초기화
    this.enabled = true;
    this.threshold = options?.processorOptions?.threshold || 0.01;    // 노이즈 게이트 임계값 (0.0 ~ 1.0)
    this.smoothingFactor = options?.processorOptions?.smoothingFactor || 0.2; // 평활화 계수 (0.0 ~ 1.0)
    this.frameSize = 128;       // 처리할 프레임 크기
    this.sampleRate = sampleRate || 48000; // 샘플링 레이트
    
    // 상태 변수 초기화
    this.rmsValue = 0;          // 현재 RMS 값
    this.noiseFloor = 0.005;    // 노이즈 플로어 추정치
    this.attackTime = 0.01;     // 어택 타임 (초)
    this.releaseTime = 0.1;     // 릴리즈 타임 (초)
    
    // 어택 및 릴리즈 계수 계산
    this.attackCoef = Math.exp(-1 / (this.sampleRate * this.attackTime));
    this.releaseCoef = Math.exp(-1 / (this.sampleRate * this.releaseTime));
    
    // 이전 게인 값
    this.prevGain = 1.0;
    
    // 버퍼링을 위한 변수
    this.bufferSize = 2048;
    this.bufferIndex = 0;
    this.buffer = new Float32Array(this.bufferSize);
    
    // 메시지 핸들러 설정
    this.port.onmessage = this.handleMessage.bind(this);
    
    console.log('[AudioWorklet] 노이즈 감소 프로세서가 초기화되었습니다.', {
      threshold: this.threshold,
      smoothingFactor: this.smoothingFactor,
      sampleRate: this.sampleRate
    });
  }
  
  /**
   * AudioWorklet 메시지 핸들러
   */
  handleMessage(event) {
    const { data } = event;
    
    if (data.command === 'setOptions') {
      // 옵션 업데이트
      const options = data.options || {};
      
      if (options.hasOwnProperty('enabled')) {
        this.enabled = !!options.enabled;
        console.log(`[AudioWorklet] 노이즈 감소 상태 변경: ${this.enabled}`);
      }
      
      if (options.hasOwnProperty('threshold')) {
        this.threshold = Math.max(0, Math.min(1, options.threshold));
        console.log(`[AudioWorklet] 노이즈 임계값 변경: ${this.threshold}`);
      }
      
      if (options.hasOwnProperty('smoothingFactor')) {
        this.smoothingFactor = Math.max(0, Math.min(1, options.smoothingFactor));
        console.log(`[AudioWorklet] 평활화 계수 변경: ${this.smoothingFactor}`);
      }
      
      // 처리 계수 재계산
      if (options.hasOwnProperty('attackTime')) {
        this.attackTime = Math.max(0.001, options.attackTime);
        this.attackCoef = Math.exp(-1 / (this.sampleRate * this.attackTime));
        console.log(`[AudioWorklet] 어택 타임 변경: ${this.attackTime}`);
      }
      
      if (options.hasOwnProperty('releaseTime')) {
        this.releaseTime = Math.max(0.001, options.releaseTime);
        this.releaseCoef = Math.exp(-1 / (this.sampleRate * this.releaseTime));
        console.log(`[AudioWorklet] 릴리즈 타임 변경: ${this.releaseTime}`);
      }
      
      // 응답 전송
      this.port.postMessage({ 
        type: 'optionsUpdated',
        options: {
          enabled: this.enabled,
          threshold: this.threshold,
          smoothingFactor: this.smoothingFactor,
          attackTime: this.attackTime,
          releaseTime: this.releaseTime
        }
      });
    }
  }
  
  /**
   * 입력 버퍼의 RMS 값 계산
   * @param {Float32Array} buffer - 오디오 샘플 버퍼
   * @return {number} RMS 값
   */
  calculateRMS(buffer) {
    // 버퍼가 비어있거나 유효하지 않은 경우 처리
    if (!buffer || buffer.length === 0) return 0;
    
    let sum = 0;
    
    // 제곱합 계산 (최적화 버전)
    const len = buffer.length;
    for (let i = 0; i < len; i++) {
      const val = buffer[i];
      sum += val * val;
    }
    
    // 평균과 제곱근 계산
    return Math.sqrt(sum / len);
  }
  
  /**
   * 노이즈 게이트 적용
   * @param {Float32Array} buffer - 처리할 오디오 버퍼
   * @param {number} threshold - 임계값
   */
  applyNoiseGate(buffer, threshold) {
    if (!buffer) return buffer;
    
    const len = buffer.length;
    for (let i = 0; i < len; i++) {
      if (Math.abs(buffer[i]) < threshold) {
        buffer[i] = 0;
      }
    }
    return buffer;
  }
  
  /**
   * 동적 노이즈 감소 적용
   * @param {Float32Array} input - 입력 오디오 버퍼
   * @param {Float32Array} output - 출력 오디오 버퍼
   */
  applyDynamicNoiseReduction(input, output) {
    // 입력이나 출력 버퍼가 유효하지 않은 경우 처리
    if (!input || !output || input.length === 0 || output.length === 0) return;
    
    // 현재 프레임의 RMS 값 계산
    const currentRMS = this.calculateRMS(input);
    
    // RMS 값 평활화
    this.rmsValue = this.smoothingFactor * currentRMS + (1 - this.smoothingFactor) * this.rmsValue;
    
    // 신호가 임계값보다 크면 노이즈 플로어 업데이트
    if (this.rmsValue > this.threshold * 5) {
      this.noiseFloor = Math.min(this.noiseFloor, this.rmsValue * 0.1);
    }
    
    // 신호 대 노이즈 비율(SNR) 계산
    const snr = this.rmsValue / Math.max(0.0001, this.noiseFloor); // 0으로 나누기 방지
    
    // 게인 값 계산 (신호가 강할수록 게인 높음)
    let targetGain = Math.min(1.0, snr - 1);
    targetGain = Math.max(0, targetGain); // 0 이상 보장
    
    // 어택 또는 릴리즈 적용
    if (targetGain > this.prevGain) {
      // 어택 (신호 증가)
      this.prevGain = this.attackCoef * this.prevGain + (1 - this.attackCoef) * targetGain;
    } else {
      // 릴리즈 (신호 감소)
      this.prevGain = this.releaseCoef * this.prevGain + (1 - this.releaseCoef) * targetGain;
    }
    
    // 게인 적용
    const len = Math.min(input.length, output.length);
    for (let i = 0; i < len; i++) {
      output[i] = input[i] * this.prevGain;
    }
  }
  
  /**
   * 버퍼에 입력 데이터 추가 및 메인 스레드로 전송
   * @param {Float32Array} inputData - 입력 오디오 데이터
   */
  addToBufferAndSend(inputData) {
    if (!inputData || inputData.length === 0) return;
    
    // 현재 프레임을 버퍼에 추가
    const frameLength = inputData.length;
    const remainingSpace = this.bufferSize - this.bufferIndex;
    
    if (frameLength <= remainingSpace) {
      // 버퍼에 모두 추가할 수 있는 경우
      this.buffer.set(inputData, this.bufferIndex);
      this.bufferIndex += frameLength;
    } else {
      // 버퍼가 찼을 경우 현재 버퍼를 보내고 재설정
      // 남은 공간만큼만 채우고
      const firstPart = inputData.subarray(0, remainingSpace);
      this.buffer.set(firstPart, this.bufferIndex);
      
      // 버퍼를 메인 스레드로 전송
      this.sendBufferToMainThread();
      
      // 새 버퍼 시작
      const secondPart = inputData.subarray(remainingSpace);
      this.buffer.set(secondPart, 0);
      this.bufferIndex = secondPart.length;
    }
    
    // 버퍼가 가득 찼을 때 전송
    if (this.bufferIndex >= this.bufferSize) {
      this.sendBufferToMainThread();
    }
  }
  
  /**
   * 버퍼를 메인 스레드로 전송
   */
  sendBufferToMainThread() {
    if (this.bufferIndex === 0) return;
    
    // 현재 버퍼의 사용된 부분만 복사하여 전송
    const dataToSend = this.buffer.slice(0, this.bufferIndex);
    
    this.port.postMessage({
      audioBuffer: dataToSend
    });
    
    // 버퍼 인덱스 재설정
    this.bufferIndex = 0;
  }
  
  /**
   * 오디오 처리 메서드 - WebAudio API에서 자동 호출됩니다
   */
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    // 입력 데이터가 있는지 확인
    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
      return true;
    }
    
    try {
      // 각 채널 처리
      for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];
        
        if (!inputChannel || !outputChannel) continue;
        
        // 데이터 복사 (원본 보존)
        const inputCopy = new Float32Array(inputChannel);
        
        if (this.enabled) {
          // 노이즈 게이트 적용 (기본적인 노이즈 제거)
          this.applyNoiseGate(inputCopy, this.threshold);
          
          // 동적 노이즈 감소 적용
          this.applyDynamicNoiseReduction(inputCopy, outputChannel);
        } else {
          // 노이즈 감소 비활성화 상태이면 입력을 그대로 출력
          outputChannel.set(inputCopy);
        }
        
        // 첫 번째 채널의 처리된 데이터만 메인 스레드로 전송
        if (channel === 0) {
          this.addToBufferAndSend(outputChannel);
        }
      }
    } catch (error) {
      console.error('[AudioWorklet] 오디오 처리 중 오류 발생:', error);
    }
    
    // true를 반환하여 계속 처리
    return true;
  }
}

// 프로세서 등록
registerProcessor('noise-reduction-processor', NoiseReductionProcessor); 