/**
 * Chrome API 유틸리티
 * 
 * Chrome 확장 프로그램 API를 Promise 기반으로 래핑하여 async/await 패턴을 사용할 수 있게 합니다.
 * 일관된 에러 처리와 타임아웃 처리도 제공합니다.
 */

// 기본 타임아웃 설정 (ms)
const DEFAULT_TIMEOUT = 5000;

/**
 * Promise 래핑된 chrome.tabs.sendMessage
 * 
 * @param {number} tabId - 메시지를 보낼 탭 ID
 * @param {any} message - 전송할 메시지 객체
 * @param {Object} options - 옵션 객체
 * @param {number} options.timeout - 타임아웃 (ms)
 * @returns {Promise<any>} 응답 Promise
 */
function sendTabMessage(tabId, message, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  
  return new Promise((resolve, reject) => {
    // 타임아웃 처리
    const timeoutId = setTimeout(() => {
      reject(new Error('Message sending timed out'));
    }, timeout);
    
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);
        
        // 런타임 에러 처리
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * 안전한 chrome.tabs.sendMessage (에러가 발생해도 실패하지 않음)
 * 
 * @param {number} tabId - 메시지를 보낼 탭 ID
 * @param {any} message - 전송할 메시지 객체
 * @param {Function} onError - 에러 발생 시 콜백 (선택사항)
 */
function sendTabMessageSafe(tabId, message, onError) {
  try {
    chrome.tabs.sendMessage(
      tabId, 
      message, 
      function(response) {
        if (chrome.runtime.lastError && typeof onError === 'function') {
          onError(chrome.runtime.lastError);
        }
      }
    );
  } catch (error) {
    if (typeof onError === 'function') {
      onError(error);
    }
  }
}

/**
 * Promise 래핑된 chrome.runtime.sendMessage
 * 
 * @param {any} message - 전송할 메시지 객체
 * @param {Object} options - 옵션 객체
 * @param {number} options.timeout - 타임아웃 (ms)
 * @returns {Promise<any>} 응답 Promise
 */
function sendRuntimeMessage(message, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  
  return new Promise((resolve, reject) => {
    // 타임아웃 처리
    const timeoutId = setTimeout(() => {
      reject(new Error('Message sending timed out'));
    }, timeout);
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        // 런타임 에러 처리
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.storage.local.get
 * 
 * @param {string|string[]|Object} keys - 가져올 키 또는 키 배열
 * @returns {Promise<Object>} 저장된 데이터 Promise
 */
function getLocalStorage(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.storage.local.set
 * 
 * @param {Object} items - 저장할 데이터 객체
 * @returns {Promise<void>} 완료 Promise
 */
function setLocalStorage(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.storage.sync.get
 * 
 * @param {string|string[]|Object} keys - 가져올 키 또는 키 배열
 * @returns {Promise<Object>} 저장된 데이터 Promise
 */
function getSyncStorage(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.storage.sync.set
 * 
 * @param {Object} items - 저장할 데이터 객체
 * @returns {Promise<void>} 완료 Promise
 */
function setSyncStorage(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.tabs.query
 * 
 * @param {Object} queryInfo - 탭 쿼리 객체
 * @returns {Promise<chrome.tabs.Tab[]>} 탭 배열 Promise
 */
function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(tabs);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 현재 활성 탭 가져오기
 * 
 * @returns {Promise<chrome.tabs.Tab>} 현재 활성 탭 Promise
 */
async function getCurrentTab() {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  
  if (!tabs || tabs.length === 0) {
    throw new Error('No active tab found');
  }
  
  return tabs[0];
}

/**
 * Promise 래핑된 chrome.identity.getAuthToken
 * 
 * @param {Object} details - 인증 토큰 옵션
 * @returns {Promise<string>} 인증 토큰 Promise
 */
function getAuthToken(details = { interactive: true }) {
  return new Promise((resolve, reject) => {
    try {
      chrome.identity.getAuthToken(details, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!token) {
          reject(new Error('Token could not be retrieved'));
          return;
        }
        
        resolve(token);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Promise 래핑된 chrome.identity.removeCachedAuthToken
 * 
 * @param {Object} details - 토큰 정보
 * @returns {Promise<void>} 완료 Promise
 */
function removeCachedAuthToken(details) {
  return new Promise((resolve, reject) => {
    try {
      chrome.identity.removeCachedAuthToken(details, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// API 객체 노출
const chromeApi = {
  // 메시지 관련
  sendTabMessage,
  sendTabMessageSafe,
  sendRuntimeMessage,
  
  // 스토리지 관련
  getLocalStorage,
  setLocalStorage,
  getSyncStorage,
  setSyncStorage,
  
  // 탭 관련
  queryTabs,
  getCurrentTab,
  
  // 인증 관련
  getAuthToken,
  removeCachedAuthToken
};

// 전역 등록 (개발 편의성)
if (typeof window !== 'undefined') {
  window.whatsub = window.whatsub || {};
  window.whatsub.chromeApi = chromeApi;
}

// 모듈 내보내기
export default chromeApi; 