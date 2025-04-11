/**
 * WhaSub 로깅 서비스
 * 
 * 확장 프로그램 전반에 걸쳐 일관된 로깅 인터페이스를 제공합니다.
 * 로그 레벨, 그룹화, 저장 등 다양한 기능을 지원합니다.
 */

// 로그 레벨 정의
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 999 // 로깅 비활성화
};

// 현재 환경 설정
const DEFAULT_CONFIG = {
  level: LOG_LEVELS.INFO, // 기본 로그 레벨
  prefix: '[Whatsub]',    // 로그 접두사
  console: true,          // 콘솔에 출력 여부
  storage: false,         // 로그 저장 여부
  maxStoredLogs: 100,     // 최대 저장 로그 수
  sendToServer: false,    // 서버에 로그 전송 여부
  serverUrl: ''           // 로그 서버 URL
};

// 설정 및 상태
let config = { ...DEFAULT_CONFIG };
let logHistory = [];

/**
 * 설정 업데이트
 * @param {Object} newConfig - 새 설정 객체
 */
function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  
  if (config.level <= LOG_LEVELS.DEBUG) {
    debug('로거 설정 업데이트됨:', config);
  }
}

/**
 * 로그 히스토리 저장
 * @param {string} level - 로그 레벨
 * @param {string} message - 로그 메시지
 * @param {any[]} args - 추가 인자
 */
function storeLog(level, message, args) {
  if (!config.storage) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    data: args.length > 0 ? args : undefined
  };
  
  logHistory.push(logEntry);
  
  // 최대 저장 로그 수 제한
  if (logHistory.length > config.maxStoredLogs) {
    logHistory.shift();
  }
  
  // 필요한 경우 로컬 스토리지에 저장
  if (config.persistLogs) {
    try {
      chrome.storage.local.set({ 'whatsub_logs': logHistory.slice(-50) }); // 최근 50개만 저장
    } catch (error) {
      console.error(`${config.prefix} 로그 저장 오류:`, error);
    }
  }
  
  // 서버에 로그 전송
  if (config.sendToServer && config.serverUrl) {
    sendLogToServer(logEntry);
  }
}

/**
 * 서버에 로그 전송
 * @param {Object} logEntry - 로그 엔트리 객체
 */
function sendLogToServer(logEntry) {
  // 개발 중이므로 실제로 전송하지 않고 주석 처리
  /*
  fetch(config.serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(logEntry)
  }).catch(err => console.error(`${config.prefix} 로그 서버 전송 실패:`, err));
  */
}

/**
 * 기본 로그 출력 함수
 * @param {string} level - 로그 레벨
 * @param {string} levelLabel - 로그 레벨 텍스트
 * @param {string} message - 로그 메시지
 * @param {any[]} args - 추가 인자
 */
function logWithLevel(level, levelLabel, message, ...args) {
  // 현재 로그 레벨보다 낮은 로그는 무시
  if (level < config.level) return;
  
  const formattedMessage = `${config.prefix} [${levelLabel}] ${message}`;
  
  // 콘솔에 출력
  if (config.console) {
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.log(formattedMessage, ...args);
        break;
      case LOG_LEVELS.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LOG_LEVELS.ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
  }
  
  // 로그 저장
  storeLog(levelLabel, message, args);
}

/**
 * 디버그 레벨 로그
 * @param {string} message - 로그 메시지
 * @param {...any} args - 추가 인자
 */
function debug(message, ...args) {
  logWithLevel(LOG_LEVELS.DEBUG, 'DEBUG', message, ...args);
}

/**
 * 정보 레벨 로그
 * @param {string} message - 로그 메시지
 * @param {...any} args - 추가 인자
 */
function info(message, ...args) {
  logWithLevel(LOG_LEVELS.INFO, 'INFO', message, ...args);
}

/**
 * 경고 레벨 로그
 * @param {string} message - 로그 메시지
 * @param {...any} args - 추가 인자
 */
function warn(message, ...args) {
  logWithLevel(LOG_LEVELS.WARN, 'WARN', message, ...args);
}

/**
 * 에러 레벨 로그
 * @param {string} message - 로그 메시지
 * @param {...any} args - 추가 인자
 */
function error(message, ...args) {
  logWithLevel(LOG_LEVELS.ERROR, 'ERROR', message, ...args);
}

/**
 * 로그 그룹 시작
 * @param {string} label - 그룹 레이블
 */
function group(label) {
  if (config.level <= LOG_LEVELS.INFO && config.console) {
    console.group(`${config.prefix} ${label}`);
  }
}

/**
 * 로그 그룹 종료
 */
function groupEnd() {
  if (config.level <= LOG_LEVELS.INFO && config.console) {
    console.groupEnd();
  }
}

/**
 * 로그 히스토리 가져오기
 * @returns {Array} 로그 히스토리 배열
 */
function getLogHistory() {
  return [...logHistory];
}

/**
 * 로그 히스토리 지우기
 */
function clearLogHistory() {
  logHistory = [];
  
  if (config.persistLogs) {
    try {
      chrome.storage.local.remove('whatsub_logs');
    } catch (error) {
      console.error(`${config.prefix} 저장된 로그 삭제 오류:`, error);
    }
  }
  
  if (config.level <= LOG_LEVELS.INFO) {
    info('로그 히스토리가 지워졌습니다.');
  }
}

/**
 * 개발 모드 로그 활성화
 */
function enableDevMode() {
  updateConfig({ level: LOG_LEVELS.DEBUG });
  debug('개발 모드 로깅이 활성화되었습니다.');
}

/**
 * 프로덕션 모드 로그 활성화
 */
function disableDevMode() {
  updateConfig({ level: LOG_LEVELS.INFO });
  info('개발 모드 로깅이 비활성화되었습니다.');
}

// 로거 인스턴스 생성 및 외부 노출
const logger = {
  debug,
  info,
  warn,
  error,
  group,
  groupEnd,
  updateConfig,
  getLogHistory,
  clearLogHistory,
  enableDevMode,
  disableDevMode,
  LOG_LEVELS
};

// 전역 로거로 등록 (개발 편의성)
if (typeof window !== 'undefined') {
  window.whatsub = window.whatsub || {};
  window.whatsub.logger = logger;
}

// 모듈 내보내기
export default logger; 