/**
 * 패스스루 오디오 워크렛 프로세서
 * 
 * 이 프로세서는 오디오 데이터를 그대로 통과시키는 간단한 프로세서입니다.
 * 주요 기능:
 * 1. 입력 오디오 데이터를 출력으로 그대로 전달
 * 2. 처리된 오디오 데이터를 메인 스레드로 전송
 */

class PassthroughProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // 메시지 핸들러 설정
    this.port.onmessage = (event) => {
      if (event.data.command === 'setOptions') {
        // 옵션 설정 처리 (필요한 경우)
        this.port.postMessage({ status: 'optionsUpdated' });
      }
    };
  }
  
  /**
   * 오디오 처리 메서드
   * - 입력 데이터를 출력으로 복사
   * - 처리된 오디오 버퍼를 메인 스레드로 전송
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
      
      // 데이터 복사
      for (let i = 0; i < inputChannel.length; i++) {
        outputChannel[i] = inputChannel[i];
      }
    }
    
    // 오디오 데이터를 메인 스레드로 전송 (처리용)
    if (input[0]) {
      this.port.postMessage({
        audioBuffer: input[0].slice()
      });
    }
    
    // true를 반환하여 프로세서가 계속 실행되도록 함
    return true;
  }
}

// 프로세서 등록
registerProcessor('passthrough-processor', PassthroughProcessor); 