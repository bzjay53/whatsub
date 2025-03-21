// 여러 로깅 레벨을 지원하는 디버그 로거 서비스
// 개발 중에는 활성화하고 프로덕션에서는 비활성화할 수 있습니다.

// 기본 로그 함수
function log(message) {
  console.log(`[whatsub] ${message}`);
}

function error(message) {
  console.error(`[whatsub] ${message}`);
}

function warn(message) {
  console.warn(`[whatsub] ${message}`);
}

// 개발 환경에서만 로그를 출력하는 설정
const DEBUG_MODE = true;

// 로거 객체
const logger = {
  log: (...args) => console.log('[Whatsub]', ...args),
  error: (...args) => console.error('[Whatsub]', ...args),
  warn: (...args) => console.warn('[Whatsub]', ...args)
};

// 디버그 유틸리티
window.debugUtil = {
    log: (...args) => console.log('[Whatsub]', ...args),
    error: (...args) => console.error('[Whatsub]', ...args),
    warn: (...args) => console.warn('[Whatsub]', ...args)
}; 