/**
 * 노이즈 감소 오디오 워크렛 프로세서
 * 
 * 이 프로세서는 다음 두 가지 방법으로 노이즈를 감소시킵니다:
 * 1. 간단한 노이즈 게이트: 특정 임계값 이하의 오디오 신호를 차단합니다.
 * 2. RMS(Root Mean Square) 기반 동적 노이즈 감소: 신호 강도에 따라 노이즈 감소 강도를 조절합니다.
 */

class NoiseReductionProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // 설정 초기화
    this.enabled = true;
    this.threshold = 0.01;      // 노이즈 게이트 임계값 (0.0 ~ 1.0)
    this.smoothingFactor = 0.2; // 평활화 계수 (0.0 ~ 1.0)
    this.frameSize = 128;       // 처리할 프레임 크기
    
    // 상태 변수 초기화
    this.rmsValue = 0;          // 현재 RMS 값
    this.noiseFloor = 0.005;    // 노이즈 플로어 추정치
    this.attackTime = 0.01;     // 어택 타임 (초)
    this.releaseTime = 0.1;     // 릴리즈 타임 (초)
    this.sampleRate = sampleRate || 44100; // 샘플링 레이트
    
    // 어택 및 릴리즈 계수 계산
    this.attackCoef = Math.exp(-1 / (this.sampleRate * this.attackTime));
    this.releaseCoef = Math.exp(-1 / (this.sampleRate * this.releaseTime));
    
    // 이전 게인 값
    this.prevGain = 1.0;
    
    // 메시지 핸들러 설정
    this.port.onmessage = (event) => {
      if (event.data.command === 'setOptions') {
        // 옵션 업데이트
        const options = event.data.options || {};
        
        if (options.hasOwnProperty('enabled')) {
          this.enabled = !!options.enabled;
        }
        
        if (options.hasOwnProperty('threshold')) {
          this.threshold = Math.max(0, Math.min(1, options.threshold));
        }
        
        if (options.hasOwnProperty('smoothingFactor')) {
          this.smoothingFactor = Math.max(0, Math.min(1, options.smoothingFactor));
        }
        
        // 처리 계수 재계산
        if (options.hasOwnProperty('attackTime')) {
          this.attackTime = Math.max(0.001, options.attackTime);
          this.attackCoef = Math.exp(-1 / (this.sampleRate * this.attackTime));
        }
        
        if (options.hasOwnProperty('releaseTime')) {
          this.releaseTime = Math.max(0.001, options.releaseTime);
          this.releaseCoef = Math.exp(-1 / (this.sampleRate * this.releaseTime));
        }
        
        this.port.postMessage({ status: 'optionsUpdated' });
      }
    };
  }
  
  /**
   * 입력 버퍼의 RMS 값 계산
   * @param {Float32Array} buffer - 오디오 샘플 버퍼
   * @return {number} RMS 값
   */
  calculateRMS(buffer) {
    let sum = 0;
    
    // 제곱합 계산
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    
    // 평균과 제곱근 계산
    return Math.sqrt(sum / buffer.length);
  }
  
  /**
   * 노이즈 게이트 적용
   * @param {Float32Array} buffer - 처리할 오디오 버퍼
   * @param {number} threshold - 임계값
   */
  applyNoiseGate(buffer, threshold) {
    for (let i = 0; i < buffer.length; i++) {
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
    // 현재 프레임의 RMS 값 계산
    const currentRMS = this.calculateRMS(input);
    
    // RMS 값 평활화
    this.rmsValue = this.smoothingFactor * currentRMS + (1 - this.smoothingFactor) * this.rmsValue;
    
    // 신호가 임계값보다 크면 노이즈 플로어 업데이트
    if (this.rmsValue > this.threshold * 5) {
      this.noiseFloor = Math.min(this.noiseFloor, this.rmsValue * 0.1);
    }
    
    // 신호 대 노이즈 비율(SNR) 계산
    const snr = this.rmsValue / this.noiseFloor;
    
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
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] * this.prevGain;
    }
  }
  
  /**
   * 오디오 처리 메서드
   */
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    // 입력 데이터가 있는지 확인
    if (input.length === 0 || input[0].length === 0) {
      return true;
    }
    
    // 각 채널 처리
    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      // 입력 버퍼 복사 (원본 데이터 보존)
      const bufferCopy = new Float32Array(inputChannel.length);
      bufferCopy.set(inputChannel);
      
      if (this.enabled) {
        // 노이즈 게이트 적용 (기본적인 노이즈 제거)
        this.applyNoiseGate(bufferCopy, this.threshold);
        
        // 동적 노이즈 감소 적용
        this.applyDynamicNoiseReduction(bufferCopy, outputChannel);
      } else {
        // 노이즈 감소 비활성화 상태이면 입력을 그대로 출력
        outputChannel.set(bufferCopy);
      }
    }
    
    // 오디오 데이터를 메인 스레드로 전송 (처리용)
    if (input[0]) {
      // 항상 첫 번째 채널 데이터 전송
      this.port.postMessage({
        audioBuffer: output[0].slice()
      });
    }
    
    // true를 반환하여 프로세서가 계속 실행되도록 함
    return true;
  }
}

// 프로세서 등록
registerProcessor('noise-reduction-processor', NoiseReductionProcessor);
