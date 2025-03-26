// Chrome API를 위한 타입 정의
interface Chrome {
  runtime: {
    sendMessage: (message: any) => void;
  };
}

declare const chrome: Chrome | undefined; 