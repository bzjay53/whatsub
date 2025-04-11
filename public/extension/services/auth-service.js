/**
 * Whatsub 인증 서비스
 * 
 * 사용자 인증 관련 기능을 제공합니다.
 * - 로그인/로그아웃
 * - 인증 상태 관리
 * - 토큰 관리
 */

import chromeApi from './chrome-api.js';
import logger from './logger.js';

// 인증 관련 상수
const AUTH_CONSTANTS = {
  STORAGE_KEYS: {
    AUTH_STATE: 'whatsub_auth',
    AUTH_TOKEN: 'authToken',
    USER: 'user',
    LEGACY_AUTH: 'auth',
    LEGACY_AUTH_STATE: 'authState'
  },
  ERROR_TYPES: {
    USER_CANCELLED: 'user_cancelled',
    NETWORK_ERROR: 'network_error',
    AUTH_FAILED: 'auth_failed',
    TOKEN_INVALID: 'token_invalid',
    NO_TOKEN: 'no_token',
    USER_INFO_FAILED: 'user_info_failed'
  }
};

// 인증 상태
let authState = {
  isAuthenticated: false,
  user: null,
  idToken: null,
  lastChecked: null
};

// 이벤트 리스너 목록
const authListeners = [];

/**
 * 인증 상태 변경 이벤트 구독
 * 
 * @param {Function} listener - 상태 변경 시 호출될 콜백 함수
 * @returns {Function} 구독 취소 함수
 */
function subscribeToAuthChanges(listener) {
  if (typeof listener !== 'function') {
    throw new Error('Listener must be a function');
  }
  
  authListeners.push(listener);
  
  // 즉시 현재 상태 전달
  try {
    listener({ ...authState });
  } catch (error) {
    logger.error('Auth listener error:', error);
  }
  
  // 구독 취소 함수 반환
  return function unsubscribe() {
    const index = authListeners.indexOf(listener);
    if (index !== -1) {
      authListeners.splice(index, 1);
    }
  };
}

/**
 * 인증 상태 변경 알림
 * 
 * @param {Object} newState - 새 인증 상태
 */
function notifyAuthStateChanged(newState) {
  authState = { ...newState, lastChecked: Date.now() };
  
  // 모든 리스너에게 상태 변경 알림
  authListeners.forEach(listener => {
    try {
      listener({ ...authState });
    } catch (error) {
      logger.error('Auth listener error:', error);
    }
  });
}

/**
 * 구글 로그인
 * 
 * @returns {Promise<Object>} 로그인 결과
 */
async function signInWithGoogle() {
  try {
    logger.info('Google 로그인 시작...');
    
    // 로그인 전 기존 인증 데이터 클리어
    await clearAuthData();
    
    // manifest.json에서 OAuth 클라이언트 ID 가져오기
    const clientId = chrome.runtime.getManifest().oauth2?.client_id;
    
    // 클라이언트 ID가 기본값인 경우 오류 처리
    if (!clientId) {
      logger.error('OAuth 클라이언트 ID가 설정되지 않았습니다.');
      return { 
        success: false, 
        error: 'invalid_client', 
        message: 'OAuth 클라이언트 ID가 설정되지 않았습니다.' 
      };
    }
    
    logger.debug('사용할 클라이언트 ID:', clientId);
    
    // 기존 캐시된 토큰 제거
    try {
      await chromeApi.removeCachedAuthToken({ token: '' });
      logger.debug('캐시된 토큰 제거 완료');
    } catch (clearError) {
      logger.warn('캐시된 토큰 제거 중 오류 (무시됨):', clearError);
    }
    
    // Chrome Identity API를 사용하여 로그인
    logger.debug('OAuth 인증 흐름 시작...');
    const token = await chromeApi.getAuthToken({ interactive: true });
    
    if (!token) {
      logger.error('토큰을 가져올 수 없습니다.');
      return {
        success: false,
        error: AUTH_CONSTANTS.ERROR_TYPES.NO_TOKEN,
        message: '인증 토큰을 가져올 수 없습니다.'
      };
    }
    
    logger.debug('액세스 토큰 획득 성공, 사용자 정보 요청 중...');
    
    // 토큰으로 사용자 정보 가져오기
    const userInfo = await fetchUserInfo(token);
    
    if (!userInfo || !userInfo.email) {
      logger.error('사용자 정보를 가져올 수 없습니다.');
      return {
        success: false,
        error: AUTH_CONSTANTS.ERROR_TYPES.USER_INFO_FAILED,
        message: '사용자 정보를 가져올 수 없습니다.'
      };
    }
    
    logger.info('사용자 정보 획득 성공:', userInfo.email);
    
    // 사용자 데이터 구성
    const userData = {
      uid: userInfo.sub || userInfo.id || Math.random().toString(36).substring(2),
      email: userInfo.email,
      displayName: userInfo.name || userInfo.email.split('@')[0],
      photoURL: userInfo.picture
    };
    
    // 로컬 스토리지에 사용자 정보 저장
    await saveAuthData(userData, token);
    
    // 상태 업데이트
    notifyAuthStateChanged({
      isAuthenticated: true,
      user: userData,
      idToken: token
    });
    
    return {
      success: true,
      message: '로그인 성공',
      user: userData,
      token: token
    };
  } catch (error) {
    logger.error('로그인 중 오류 발생:', error);
    
    // 세부 오류 정보 추출
    let errorType = 'unknown';
    let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    
    if (errorMessage.includes('canceled') || errorMessage.includes('취소')) {
      errorType = AUTH_CONSTANTS.ERROR_TYPES.USER_CANCELLED;
      errorMessage = '사용자가 로그인을 취소했습니다.';
    } else if (errorMessage.includes('network')) {
      errorType = AUTH_CONSTANTS.ERROR_TYPES.NETWORK_ERROR;
      errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorType: errorType,
      originalError: error.toString()
    };
  }
}

/**
 * 사용자 정보 가져오기
 * 
 * @param {string} token - 액세스 토큰
 * @returns {Promise<Object|null>} 사용자 정보 또는 null
 */
async function fetchUserInfo(token) {
  try {
    if (!token) {
      logger.error('사용자 정보 조회: 토큰이 제공되지 않았습니다.');
      return null;
    }
    
    // Google userinfo 엔드포인트에 요청
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('사용자 정보 요청 실패:', response.status, errorText);
      return null;
    }
    
    // 응답 파싱
    const userInfo = await response.json();
    
    if (!userInfo || !userInfo.email) {
      logger.error('사용자 정보가 불완전합니다.');
      return null;
    }
    
    logger.debug('사용자 정보 가져오기 성공:', userInfo.email);
    return userInfo;
  } catch (error) {
    logger.error('사용자 정보 가져오기 오류:', error);
    return null;
  }
}

/**
 * 로그아웃
 * 
 * @param {boolean} force - 강제 로그아웃 여부
 * @returns {Promise<Object>} 로그아웃 결과
 */
async function signOut(force = false) {
  try {
    logger.info('로그아웃 시작, 강제 여부:', force);
    
    // 토큰 가져오기
    const data = await chromeApi.getLocalStorage([
      AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, 
      AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE
    ]);
    
    const token = data[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN] || 
                 (data[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE] && 
                  data[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE].token);
    
    // Chrome Identity API의 캐시된 토큰 제거
    if (token) {
      try {
        await chromeApi.removeCachedAuthToken({ token: token });
        logger.debug('캐시된 토큰 제거 완료');
      } catch (clearError) {
        logger.warn('캐시된 토큰 제거 중 오류 (무시됨):', clearError);
      }
    }
    
    // 인증 데이터 클리어
    await clearAuthData();
    
    // 상태 업데이트
    notifyAuthStateChanged({
      isAuthenticated: false,
      user: null,
      idToken: null
    });
    
    logger.info('로그아웃 완료');
    
    return {
      success: true,
      message: '로그아웃되었습니다.'
    };
  } catch (error) {
    logger.error('로그아웃 처리 중 오류 발생:', error);
    return {
      success: false,
      error: 'signout_failed',
      message: error.message || '로그아웃 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 인증 상태 확인
 * 
 * @param {Object} options - 옵션 객체
 * @param {number} options.maxRetries - 최대 재시도 횟수
 * @param {number} options.retryDelayMs - 재시도 간격(밀리초)
 * @returns {Promise<Object>} 인증 상태
 */
async function checkAuth(options = {}) {
  const maxRetries = options.maxRetries || 2;
  const retryDelayMs = options.retryDelayMs || 1000;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      logger.debug(`인증 상태 확인 시도 ${retries + 1}/${maxRetries + 1}`);
      
      // 로컬 스토리지에서 인증 상태 확인
      const result = await chromeApi.getLocalStorage([
        AUTH_CONSTANTS.STORAGE_KEYS.USER,
        AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH_STATE,
        AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH,
        AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE
      ]);
      
      // 저장된 상태 확인
      const stored = {
        isAuthenticated: !!result[AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH]?.isAuthenticated || 
                         !!result[AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH_STATE]?.isAuthenticated,
        user: result[AUTH_CONSTANTS.STORAGE_KEYS.USER] || 
              result[AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH]?.user || 
              result[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE]?.user,
        token: result[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE]?.token || 
               result[AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH]?.token || 
               result[AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN]
      };
      
      // 토큰 유효성 확인 (저장된 토큰이 있는 경우)
      if (stored.isAuthenticated && stored.token) {
        const isTokenValid = await validateToken(stored.token);
        
        if (isTokenValid) {
          // 유효한 토큰이 있으면 인증된 상태로 반환
          notifyAuthStateChanged({
            isAuthenticated: true,
            user: stored.user,
            idToken: stored.token
          });
          
          return {
            isAuthenticated: true,
            user: stored.user
          };
        } else {
          // 토큰이 유효하지 않으면 로그아웃 처리
          logger.warn('저장된 토큰이 유효하지 않음');
          await signOut(true);
          return { isAuthenticated: false };
        }
      } else {
        // 인증 정보가 없음
        notifyAuthStateChanged({
          isAuthenticated: false,
          user: null,
          idToken: null
        });
        
        return { isAuthenticated: false };
      }
    } catch (error) {
      logger.error(`인증 상태 확인 오류 (시도 ${retries + 1}/${maxRetries + 1}):`, error);
      
      retries++;
      
      // 마지막 시도가 아니면 대기 후 재시도
      if (retries <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        // 모든 재시도 실패 - 안전하게 로그아웃 상태로 간주
        notifyAuthStateChanged({
          isAuthenticated: false,
          user: null,
          idToken: null
        });
        
        return { 
          isAuthenticated: false, 
          error: 'max_retries_exceeded',
          errorMessage: '인증 상태 확인 중 오류가 발생했습니다.'
        };
      }
    }
  }
}

/**
 * 토큰 유효성 검증
 * 
 * @param {string} token - 검증할 토큰
 * @returns {Promise<boolean>} 토큰 유효 여부
 */
async function validateToken(token) {
  try {
    if (!token) return false;
    
    // Google 사용자 정보 API로 토큰 유효성 검증
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 응답 상태 확인
    if (response.ok) {
      const userInfo = await response.json();
      
      // 사용자 정보가 있는지 확인
      if (userInfo && userInfo.email) {
        logger.debug('토큰 유효성 검증 성공:', userInfo.email);
        return true;
      }
    }
    
    // 토큰 유효하지 않음
    logger.warn('토큰 유효성 검증 실패:', response.status);
    return false;
  } catch (error) {
    logger.error('토큰 검증 중 오류:', error);
    return false;
  }
}

/**
 * 인증 데이터 저장
 * 
 * @param {Object} userData - 사용자 데이터
 * @param {string} token - 인증 토큰
 * @returns {Promise<void>}
 */
async function saveAuthData(userData, token) {
  try {
    // 신규 형식
    await chromeApi.setLocalStorage({
      [AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE]: {
        user: userData,
        token: token,
        loginTime: Date.now()
      },
      // 하위 호환성을 위한 기존 형식
      [AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH]: {
        isAuthenticated: true,
        user: userData
      },
      [AUTH_CONSTANTS.STORAGE_KEYS.USER]: userData,
      [AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN]: token,
      [AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH_STATE]: 'authenticated'
    });
    
    logger.debug('인증 데이터 저장 완료');
  } catch (error) {
    logger.error('인증 데이터 저장 중 오류:', error);
    throw error;
  }
}

/**
 * 인증 데이터 삭제
 * 
 * @returns {Promise<void>}
 */
async function clearAuthData() {
  try {
    await chromeApi.getLocalStorage([
      AUTH_CONSTANTS.STORAGE_KEYS.AUTH_STATE,
      AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH,
      AUTH_CONSTANTS.STORAGE_KEYS.USER,
      AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN,
      AUTH_CONSTANTS.STORAGE_KEYS.LEGACY_AUTH_STATE,
      'lastAuthState',
      'loginState'
    ]);
    
    logger.debug('인증 데이터 제거 완료');
  } catch (error) {
    logger.error('인증 데이터 제거 중 오류:', error);
    throw error;
  }
}

/**
 * 현재 인증 상태 가져오기
 * 
 * @returns {Object} 현재 인증 상태
 */
function getCurrentAuthState() {
  return { ...authState };
}

// 서비스 객체 노출
const authService = {
  signInWithGoogle,
  signOut,
  checkAuth,
  validateToken,
  getCurrentAuthState,
  subscribeToAuthChanges,
  AUTH_CONSTANTS
};

// 전역 등록 (개발 편의성)
if (typeof window !== 'undefined') {
  window.whatsub = window.whatsub || {};
  window.whatsub.authService = authService;
}

// 초기화
(async function init() {
  try {
    // 시작 시 인증 상태 확인
    await checkAuth();
  } catch (error) {
    logger.error('인증 서비스 초기화 오류:', error);
  }
})();

// 모듈 내보내기
export default authService; 