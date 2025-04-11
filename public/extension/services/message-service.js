/**
 * Whatsub 메시지 서비스
 * 
 * 확장 프로그램 내 메시지 처리를 담당합니다:
 * - 백그라운드 스크립트와 콘텐츠 스크립트 간 통신
 * - 팝업과 백그라운드 스크립트 간 통신
 * - 메시지 라우팅 및 처리
 */

import logger from './logger.js';
import chromeApi from './chrome-api.js';

// 상수 정의
const MESSAGE_CONSTANTS = {
  ACTIONS: {
    // 인증 관련
    SIGN_IN: 'signInWithGoogle',
    SIGN_OUT: 'signOut',
    CHECK_AUTH: 'checkAuth',
    
    // 자막 관련
    TOGGLE_SUBTITLES: 'toggleSubtitles',
    UPDATE_SETTINGS: 'updateSettings',
    CHANGE_LANGUAGE: 'changeLanguage',
    RESET_POSITION: 'resetPosition',
    
    // 음성 인식 관련
    START_SPEECH_RECOGNITION: 'startSpeechRecognition',
    STOP_SPEECH_RECOGNITION: 'stopSpeechRecognition',
    UPDATE_WHISPER_SETTINGS: 'updateWhisperSettings',
    WHISPER_STARTED: 'whisperStarted',
    WHISPER_STOPPED: 'whisperStopped',
    NEW_SUBTITLE: 'newSubtitle',
    
    // 기타
    INIT_CHECK: 'INIT_CHECK',
    PAGE_LOADED: 'pageLoaded',
    GET_USAGE: 'getUsage',
    TRANSLATE_TEXT: 'translateText'
  },
  ERROR_TYPES: {
    TIMEOUT: 'timeout',
    RUNTIME_ERROR: 'runtime_error',
    HANDLER_NOT_FOUND: 'handler_not_found'
  }
};

// 메시지 핸들러 레지스트리
const messageHandlers = new Map();

// 대기 중인 메시지 큐
let pendingMessages = [];
let isProcessingPending = false;

/**
 * 메시지 핸들러 등록
 * 
 * @param {string} action - 처리할 메시지 액션
 * @param {Function} handler - 메시지 처리 핸들러 함수
 * @returns {Function} 핸들러 제거 함수
 */
function registerHandler(action, handler) {
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }
  
  messageHandlers.set(action, handler);
  logger.debug(`메시지 핸들러 등록: ${action}`);
  
  // 핸들러 제거 함수 반환
  return function unregister() {
    messageHandlers.delete(action);
    logger.debug(`메시지 핸들러 제거: ${action}`);
  };
}

/**
 * 메시지 처리
 * 
 * @param {Object} message - 처리할 메시지
 * @param {Object} sender - 메시지 발신자 정보
 * @returns {Promise<any>} 처리 결과
 */
async function handleMessage(message, sender) {
  try {
    const { action } = message;
    
    if (!action) {
      logger.warn('액션이 없는 메시지 수신:', message);
      return {
        success: false,
        error: 'Missing action in message'
      };
    }
    
    logger.debug(`메시지 수신: ${action}`);
    
    // 등록된 핸들러가 있는지 확인
    const handler = messageHandlers.get(action);
    
    if (!handler) {
      logger.warn(`핸들러를 찾을 수 없음: ${action}`);
      return {
        success: false,
        error: 'Handler not found',
        errorType: MESSAGE_CONSTANTS.ERROR_TYPES.HANDLER_NOT_FOUND
      };
    }
    
    // 핸들러 호출
    const result = await handler(message, sender);
    return result;
    
  } catch (error) {
    logger.error('메시지 처리 중 오류:', error);
    return {
      success: false,
      error: error.message || '메시지 처리 중 오류가 발생했습니다',
      errorType: 'processing_error'
    };
  }
}

/**
 * 대기 중인 메시지 처리
 */
async function processPendingMessages() {
  if (isProcessingPending || pendingMessages.length === 0) {
    return;
  }
  
  isProcessingPending = true;
  logger.debug(`${pendingMessages.length}개의 대기 메시지 처리 시작`);
  
  try {
    // 현재 큐의 복사본 생성 (처리 중 새 메시지 추가 가능)
    const messagesToProcess = [...pendingMessages];
    pendingMessages = [];
    
    // 메시지 순차 처리
    for (const item of messagesToProcess) {
      try {
        const result = await handleMessage(item.message, item.sender);
        if (item.sendResponse) {
          item.sendResponse(result);
        }
      } catch (error) {
        logger.error('대기 메시지 처리 오류:', error);
        if (item.sendResponse) {
          item.sendResponse({
            success: false,
            error: 'processing_error',
            message: error.message || '메시지 처리 중 오류가 발생했습니다'
          });
        }
      }
    }
    
    logger.debug('대기 메시지 처리 완료');
  } finally {
    isProcessingPending = false;
    
    // 처리 중 추가된 메시지가 있으면 계속 처리
    if (pendingMessages.length > 0) {
      processPendingMessages();
    }
  }
}

/**
 * 메시지를 대기열에 추가
 * 
 * @param {Object} message - 대기시킬 메시지
 * @param {Object} sender - 메시지 발신자 정보
 * @param {Function} sendResponse - 응답 콜백
 */
function addToPendingQueue(message, sender, sendResponse) {
  pendingMessages.push({ message, sender, sendResponse });
  logger.debug(`메시지 대기열에 추가: ${message.action}`);
}

/**
 * 탭에 메시지 전송
 * 
 * @param {number} tabId - 메시지를 전송할 탭 ID
 * @param {Object} message - 전송할 메시지
 * @param {Object} options - 전송 옵션
 * @returns {Promise<any>} 응답 Promise
 */
function sendToTab(tabId, message, options = {}) {
  return chromeApi.sendTabMessage(tabId, message, options);
}

/**
 * 탭에 메시지 안전하게 전송 (실패해도 오류 발생 안함)
 * 
 * @param {number} tabId - 메시지를 전송할 탭 ID
 * @param {Object} message - 전송할 메시지
 */
function sendToTabSafe(tabId, message) {
  chromeApi.sendTabMessageSafe(tabId, message, (error) => {
    if (error) {
      logger.warn(`[${message.action}] 탭 메시지 전송 실패 (무시됨):`, error);
    }
  });
}

/**
 * 현재 활성 탭에 메시지 전송
 * 
 * @param {Object} message - 전송할 메시지
 * @param {Object} options - 전송 옵션
 * @returns {Promise<any>} 응답 Promise
 */
async function sendToActiveTab(message, options = {}) {
  try {
    const tab = await chromeApi.getCurrentTab();
    return await sendToTab(tab.id, message, options);
  } catch (error) {
    logger.error('활성 탭에 메시지 전송 실패:', error);
    throw error;
  }
}

/**
 * 백그라운드 스크립트에 메시지 전송
 * 
 * @param {Object} message - 전송할 메시지
 * @param {Object} options - 전송 옵션
 * @param {number} options.timeout - 타임아웃 (ms)
 * @returns {Promise<any>} 응답 Promise
 */
function sendToBackground(message, options = {}) {
  const timeout = options.timeout || 10000; // 기본 타임아웃 10초로 증가
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      logger.warn(`메시지 응답 타임아웃: ${message.action} (${timeout}ms)`);
      resolve({ 
        success: false, 
        error: `응답 타임아웃 (${timeout}ms)`, 
        errorType: MESSAGE_CONSTANTS.ERROR_TYPES.TIMEOUT 
      });
    }, timeout);
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          logger.error(`메시지 전송 오류 (${message.action}):`, chrome.runtime.lastError);
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
            errorType: MESSAGE_CONSTANTS.ERROR_TYPES.RUNTIME_ERROR
          });
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error(`메시지 전송 예외 (${message.action}):`, error);
      resolve({
        success: false,
        error: error.message,
        errorType: 'exception'
      });
    }
  });
}

/**
 * 메시지 리스너 설정
 * 
 * @param {Object} options - 리스너 옵션
 * @param {boolean} options.handlePending - 대기 메시지 처리 여부
 */
function setupMessageListener(options = {}) {
  const { handlePending = true } = options;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 초기화 중이고 대기 메시지 처리 옵션이 활성화된 경우
    if (handlePending && !isInitialized() && message.action !== MESSAGE_CONSTANTS.ACTIONS.INIT_CHECK) {
      addToPendingQueue(message, sender, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    }
    
    // INIT_CHECK 메시지는 항상 즉시 처리
    if (message.action === MESSAGE_CONSTANTS.ACTIONS.INIT_CHECK) {
      sendResponse({ initialized: isInitialized() });
      return false;
    }
    
    // 비동기 처리를 위한 Promise 기반 응답
    Promise.resolve().then(async () => {
      try {
        const result = await handleMessage(message, sender);
        sendResponse(result);
      } catch (error) {
        logger.error(`메시지 처리 오류 (${message.action}):`, error);
        sendResponse({
          success: false,
          error: error.message || '예기치 않은 오류가 발생했습니다'
        });
      }
    });
    
    return true; // 비동기 응답을 위해 true 반환
  });
  
  logger.info('메시지 리스너 설정 완료');
}

// 초기화 상태
let initialized = false;

/**
 * 초기화 상태 확인
 * 
 * @returns {boolean} 초기화 완료 여부
 */
function isInitialized() {
  return initialized;
}

/**
 * 초기화 완료 설정
 * 
 * @param {boolean} value - 초기화 상태 값
 */
function setInitialized(value = true) {
  initialized = value;
  
  if (value && pendingMessages.length > 0) {
    processPendingMessages();
  }
}

// 서비스 객체 노출
const messageService = {
  registerHandler,
  handleMessage,
  sendToTab,
  sendToTabSafe,
  sendToActiveTab,
  sendToBackground,
  setupMessageListener,
  isInitialized,
  setInitialized,
  addToPendingQueue,
  processPendingMessages,
  MESSAGE_CONSTANTS
};

// 전역 등록 (개발 편의성)
if (typeof window !== 'undefined') {
  window.whatsub = window.whatsub || {};
  window.whatsub.messageService = messageService;
}

// 모듈 내보내기
export default messageService; 