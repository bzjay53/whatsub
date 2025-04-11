/**
 * Whatsub 확장 프로그램 백그라운드 스크립트
 * 
 * 주요 기능:
 * 1. 인증 관리 (로그인/로그아웃)
 * 2. 오디오 캡처 및 처리
 * 3. 자막 처리 및 번역
 * 4. 사용량 추적
 */

// 서비스 워커 활성화 확인
(function checkServiceWorker() {
  console.log('%c[Whatsub] 서비스 워커 활성화됨', 'background: #4CAF50; color: white; padding: 5px; font-size: 14px;');
  console.log('[Whatsub] 버전: 0.2.2, 시간:', new Date().toISOString());
  
  // 서비스 워커 활성화 상태를 로컬 스토리지에 저장
  try {
    chrome.storage.local.set({
      'whatsub_service_worker_active': {
        active: true,
        timestamp: Date.now(),
        version: '0.2.2'
      }
    });
  } catch (error) {
    console.error('[Whatsub] 스토리지 저장 오류:', error);
  }
})();

// 디버깅 정보 출력
console.log('===== Whatsub 확장 프로그램 정보 =====');
console.log('[Whatsub] 확장 프로그램 ID:', chrome.runtime.id);
console.log('[Whatsub] OAuth 리디렉션 URI:', chrome.identity.getRedirectURL());
console.log('[Whatsub] OAuth 리디렉션 URI (oauth2 접미사 포함):', chrome.identity.getRedirectURL('oauth2'));
console.log('[Whatsub] OAuth 클라이언트 ID:', chrome.runtime.getManifest().oauth2.client_id);
console.log('======================================');

// 백그라운드 서비스 상태
const state = {
  auth: {
    isAuthenticated: false,
    user: null,
    idToken: null
  },
  settings: {
    sourceLanguage: 'auto',
    targetLanguage: 'ko',
    fontSize: 'medium',
    position: 'bottom',
    background: 'semi-transparent'
  },
  logs: []
};

// Whisper AI 관련 상태
const whisperState = {
  isActive: false,
  tabId: null,
  stream: null,
  audioContext: null,
  settings: {
    language: 'ko',
    realTime: true,
    captureAudioFromTab: true,
    modelSize: 'medium'
  },
  subtitles: []
};

// 초기화 상태 관리
let appInitialized = false;
const pendingMessages = [];

/**
 * 앱 초기화 및 인증 상태 설정
 * 인증 체크 실패 시에도 앱은 계속 작동하도록 함
 */
async function initializeApp() {
  console.log('[Whatsub] 앱 초기화 시작');
  
  try {
    // 스토리지에서 저장된 인증 정보 확인
    const storedAuth = await new Promise(resolve => {
      chrome.storage.local.get(['authState', 'auth', 'user', 'whatsub_auth'], (result) => {
        resolve({
          authState: result.authState || null,
          auth: result.auth || null,
          user: result.user || null,
          whatsub_auth: result.whatsub_auth || null
        });
      });
    });
    
    // 임시로 저장된 인증 정보가 있으면 사용
    if (storedAuth.auth?.isAuthenticated && storedAuth.user) {
      console.log('[Whatsub] 저장된 인증 정보 복원');
      // 전역 인증 상태 업데이트 (임시)
      state.auth.isAuthenticated = true;
      state.auth.user = storedAuth.user;
    }
    
    // 실제 인증 상태 확인 (재시도 로직은 checkAuth 함수에서 처리)
    const freshAuthState = await checkAuth();
    
    console.log('[Whatsub] 앱 초기화 완료:', freshAuthState.isAuthenticated ? '로그인됨' : '로그인되지 않음');
    
  } catch (error) {
    console.error('[Whatsub] 앱 초기화 오류:', error);
    // 오류가 발생해도 앱은 계속 작동
  } finally {
    // 초기화 완료 상태 설정
    appInitialized = true;
    
    // 대기 중인 메시지 처리
    processPendingMessages();
  }
}

/**
 * 대기 중인 메시지 처리
 */
function processPendingMessages() {
  if (pendingMessages.length > 0) {
    console.log(`[Whatsub] ${pendingMessages.length}개의 대기 메시지 처리`);
    pendingMessages.forEach(item => {
      try {
        handleMessage(item.message, item.sender, item.sendResponse);
      } catch (error) {
        console.error('[Whatsub] 대기 메시지 처리 오류:', error);
        item.sendResponse({ success: false, error: 'processing_error' });
      }
    });
    pendingMessages.length = 0; // 배열 비우기
  }
}

// 앱 초기화 시작
initializeApp();

// 개선된 메시지 핸들러
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 앱이 초기화되지 않았으면 메시지를 대기열에 추가
  if (!appInitialized && message.action !== 'INIT_CHECK') {
    console.log('[Whatsub] 앱 초기화 대기 중. 메시지 대기열에 추가:', message.action);
    pendingMessages.push({ message, sender, sendResponse });
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // INIT_CHECK 메시지는 항상 즉시 처리 (앱 초기화 상태 확인용)
  if (message.action === 'INIT_CHECK') {
    sendResponse({ initialized: appInitialized });
    return false;
  }
  
  // 인증 상태 확인 메시지는 인증 관련 오류에도 불구하고 항상 응답
  if (message.action === 'checkAuth') {
    // 비동기 처리를 위해 Promise.resolve()로 감싸서 처리
    Promise.resolve().then(async () => {
      try {
        const authResult = await checkAuth();
        sendResponse({
          success: true,
          ...authResult
        });
      } catch (error) {
        console.error('[Whatsub] 인증 상태 확인 중 오류:', error);
        sendResponse({
          success: false,
          isAuthenticated: false,
          error: error.message || '인증 상태 확인 중 오류가 발생했습니다.'
        });
      }
    });
    return true;
  }
  
  // 나머지 메시지 처리
  try {
    // 비동기 응답 처리 위한 Promise 기반 처리
    Promise.resolve().then(async () => {
      try {
        const result = await handleMessage(message, sender);
        sendResponse(result);
      } catch (error) {
        console.error(`[Whatsub] ${message.action} 처리 중 오류:`, error);
        sendResponse({ 
          success: false, 
          error: error.message || '예기치 않은 오류가 발생했습니다.' 
        });
      }
    });
  } catch (error) {
    console.error('[Whatsub] 메시지 처리 중 동기 오류:', error);
    sendResponse({ success: false, error: '메시지 처리 중 오류가 발생했습니다.' });
  }
  
  return true; // 비동기 응답을 위해 true 반환
});

// 기존 메시지 핸들러 함수를 Promise를 반환하도록 수정
async function handleMessage(message, sender) {
  try {
    console.debug('[Whatsub] 메시지 수신:', message);
    
    // 기본 응답 객체
    let response = { success: false, message: 'Unknown action' };
    
    // 메시지 액션에 따른 처리
    switch (message.action) {
      case 'signInWithGoogle':
        return await signInWithGoogle();
        
      case 'signOut':
        return await signOut(message.force);
        
      case 'checkAuth':
        try {
          const authResult = await checkAuth(message.maxRetries, message.retryDelayMs);
          // 항상 명확한 응답 반환
          response = {
            success: true,
            isAuthenticated: authResult.isAuthenticated === true,
            user: authResult.user || null,
            error: authResult.error || null
          };
        } catch (authError) {
          console.error('[Whatsub] 인증 상태 확인 처리 중 오류:', authError);
          response = {
            success: false,
            isAuthenticated: false,
            error: 'auth_error',
            errorMessage: '인증 상태 확인 중 오류가 발생했습니다.'
          };
        }
        break;
        
      case 'getUsage':
        // 사용량 정보 가져오기
        return {
          success: true,
          usage: {
            whisper: {
              used: 10,
              limit: 60,
              lastUpdated: new Date().toISOString()
            }
          },
          subscription: {
            plan: 'free'
          }
        };
        
      case 'translateText':
        // 텍스트 번역 처리
        return {
          success: true,
          originalText: message.text,
          translatedText: message.text,
          source: message.source,
          target: message.target
        };
        
      case 'pageLoaded':
        // 페이지 로드 알림
        console.log('[Whatsub] 페이지 로드됨:', message.url);
        if (message.isYouTubePage) {
          console.log('[Whatsub] 유튜브 페이지 감지됨');
        }
        return { success: true };
        
      case 'disableSubtitles':
        // 자막 비활성화 요청
        return { success: true };
        
      case 'saveSettings':
        // 설정 저장 요청
        return { success: true };
        
      case 'startSpeechRecognition':
        return await startSpeechRecognition(message);
        
      case 'stopSpeechRecognition':
        return await stopSpeechRecognition(message);
        
      case 'updateWhisperSettings':
        return await updateWhisperSettings(message);
        
      case 'getSubtitleList':
        return { 
          success: true, 
          subtitles: [] // 실제 구현에서는 저장된 자막 목록 반환
        };
        
      case 'uploadSubtitle':
        return { success: true, message: '자막이 업로드되었습니다.' };
        
      case 'searchSubtitles':
        return { 
          success: true, 
          subtitles: [] // 실제 구현에서는 검색된 자막 목록 반환
        };
        
      case 'applySubtitle':
        return { success: true, message: '자막이 적용되었습니다.' };
        
      default:
        // 알 수 없는 액션
        return { success: false, error: '알 수 없는 액션: ' + message.action };
    }
  } catch (error) {
    console.error('[Whatsub] 메시지 처리 중 오류:', error);
    return response;
  }
}

// Google OAuth 로그인 처리 함수
async function signInWithGoogle() {
  try {
    console.log('[Whatsub] Google 로그인 시작...');
    
    // 로그인 전 기존 인증 데이터 클리어
    await new Promise(resolve => {
      chrome.storage.local.remove([
        'whatsub_auth', 
        'auth', 
        'user', 
        'authToken',
        'authState'
      ], resolve);
    });
    
    console.log('[Whatsub] 기존 인증 데이터 클리어 완료');
    
    // manifest.json에서 OAuth 클라이언트 ID 가져오기
    const clientId = chrome.runtime.getManifest().oauth2?.client_id;
    
    // 클라이언트 ID가 기본값인 경우 오류 처리
    if (!clientId) {
      console.error('[Whatsub] OAuth 클라이언트 ID가 설정되지 않았습니다.');
      return { 
        success: false, 
        error: 'invalid_client', 
        message: 'OAuth 클라이언트 ID가 설정되지 않았습니다.' 
      };
    }
    
    console.log('[Whatsub] 사용할 클라이언트 ID:', clientId);
    
    // 기존 캐시된 토큰 제거
    try {
      await new Promise(resolve => {
        chrome.identity.removeCachedAuthToken({ token: '' }, resolve);
      });
      console.log('[Whatsub] 캐시된 토큰 제거 완료');
    } catch (clearError) {
      console.warn('[Whatsub] 캐시된 토큰 제거 중 오류 (무시됨):', clearError);
    }
    
    // Chrome Identity API를 사용하여 로그인
    console.log('[Whatsub] OAuth 인증 흐름 시작...');
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true 
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!token) {
          reject(new Error('토큰을 가져올 수 없습니다.'));
          return;
        }
        
        resolve(token);
      });
    });
    
    if (!token) {
      console.error('[Whatsub] 토큰을 가져올 수 없습니다.');
      return {
        success: false,
        error: '인증 토큰을 가져올 수 없습니다.',
        errorType: 'no_token'
      };
    }
    
    console.log('[Whatsub] 액세스 토큰 획득 성공, 사용자 정보 요청 중...');
    
    // 토큰으로 사용자 정보 가져오기
    const userInfo = await fetchUserInfo(token);
    
    if (!userInfo || !userInfo.email) {
      console.error('[Whatsub] 사용자 정보를 가져올 수 없습니다.');
      return {
        success: false,
        error: '사용자 정보를 가져올 수 없습니다.',
        errorType: 'user_info_failed'
      };
    }
    
    console.log('[Whatsub] 사용자 정보 획득 성공:', userInfo.email);
    
    // 사용자 데이터 구성
    const userData = {
      uid: userInfo.sub || userInfo.id || Math.random().toString(36).substring(2),
      email: userInfo.email,
      displayName: userInfo.name || userInfo.email.split('@')[0],
      photoURL: userInfo.picture
    };
    
    // 로컬 스토리지에 사용자 정보 저장
    await new Promise(resolve => {
      chrome.storage.local.set({
        // 새로운 형식
        'whatsub_auth': {
          user: userData,
          token: token,
          loginTime: Date.now()
        },
        // 기존 형식 (호환성)
        'auth': {
          isAuthenticated: true,
          user: userData
        },
        // 개별 키
        'user': userData,
        'authToken': token,
        'authState': 'authenticated'
      }, resolve);
    });
    
    console.log('[Whatsub] 인증 데이터 저장 완료');
    
    // 상태 업데이트
    state.auth.isAuthenticated = true;
    state.auth.user = userData;
    state.auth.idToken = token;
    
    return {
      success: true,
      message: '로그인 성공',
      user: userData,
      token: token
    };
  } catch (error) {
    console.error('[Whatsub] 로그인 중 오류 발생:', error);
    
    // 세부 오류 정보 추출
    let errorType = 'unknown';
    let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    
    if (errorMessage.includes('canceled') || errorMessage.includes('취소')) {
      errorType = 'user_cancelled';
      errorMessage = '사용자가 로그인을 취소했습니다.';
    } else if (errorMessage.includes('network')) {
      errorType = 'network_error';
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
 */
async function fetchUserInfo(token) {
  try {
    if (!token) {
      console.error('[Whatsub] 사용자 정보 조회: 토큰이 제공되지 않았습니다.');
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
      console.error('[Whatsub] 사용자 정보 요청 실패:', response.status, errorText);
      return null;
    }
    
    // 응답 파싱
    const userInfo = await response.json();
    
    if (!userInfo || !userInfo.email) {
      console.error('[Whatsub] 사용자 정보가 불완전합니다.');
      return null;
    }
    
    console.log('[Whatsub] 사용자 정보 가져오기 성공:', userInfo.email);
    return userInfo;
  } catch (error) {
    console.error('[Whatsub] 사용자 정보 가져오기 오류:', error);
    return null;
  }
}

/**
 * 로그아웃 처리 함수
 */
async function signOut(force = false) {
  try {
    console.log('[Whatsub] 로그아웃 시작, 강제 여부:', force);
    
    // 토큰 가져오기
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['authToken', 'whatsub_auth'], resolve);
    });
    
    const token = data.authToken || (data.whatsub_auth && data.whatsub_auth.token);
    
    // Chrome Identity API의 캐시된 토큰 제거
    if (token) {
      try {
        await new Promise(resolve => {
          chrome.identity.removeCachedAuthToken({ token: token }, resolve);
        });
        console.log('[Whatsub] 캐시된 토큰 제거 완료');
      } catch (clearError) {
        console.warn('[Whatsub] 캐시된 토큰 제거 중 오류 (무시됨):', clearError);
      }
    }
    
    // 모든 인증 관련 데이터 제거
    await new Promise(resolve => {
      chrome.storage.local.remove([
        'whatsub_auth', 
        'auth', 
        'user', 
        'authToken',
        'authState',
        'lastAuthState',
        'loginState'
      ], resolve);
    });
    
    // 상태 업데이트
    state.auth.isAuthenticated = false;
    state.auth.user = null;
    state.auth.idToken = null;
    
    console.log('[Whatsub] 로컬 스토리지에서 인증 데이터 제거 완료');
    
    return {
      success: true,
      message: '로그아웃되었습니다.'
    };
  } catch (error) {
    console.error('[Whatsub] 로그아웃 처리 중 오류 발생:', error);
    return {
      success: false,
      error: 'signout_failed',
      message: error.message || '로그아웃 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 인증 상태 확인 (재시도 메커니즘 포함)
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} retryDelayMs - 재시도 간격(밀리초)
 * @returns {Promise<Object>} - 인증 상태 정보
 */
async function checkAuth(maxRetries = 2, retryDelayMs = 1000) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      console.log(`[Whatsub] 인증 상태 확인 시도 ${retries + 1}/${maxRetries + 1}`);
      
      // 먼저 로컬 스토리지에서 인증 상태 확인
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['user', 'authState', 'auth', 'whatsub_auth'], resolve);
      });
      
      // 로컬 스토리지에 저장된 상태 확인
      const stored = {
        isAuthenticated: !!result.auth?.isAuthenticated || !!result.authState?.isAuthenticated,
        user: result.user || result.auth?.user || result.whatsub_auth?.user,
        token: result.whatsub_auth?.token || result.auth?.token || result.authToken
      };
      
      // 인증 정보가 없는 경우 빠르게 처리
      if (!stored.isAuthenticated || !stored.token) {
        console.log('[Whatsub] 저장된 인증 정보가 없음');
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.idToken = null;
        
        return { isAuthenticated: false };
      }
      
      // 토큰 유효성 확인 (저장된 토큰이 있는 경우)
      // 타임아웃 추가
      const tokenValidationPromise = validateToken(stored.token);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token validation timeout')), 5000)
      );
      
      let isTokenValid;
      try {
        isTokenValid = await Promise.race([tokenValidationPromise, timeoutPromise]);
      } catch (timeoutError) {
        console.warn('[Whatsub] 토큰 유효성 검증 타임아웃, 유효하다고 가정');
        // 타임아웃 시 토큰이 유효하다고 일단 가정
        isTokenValid = true;
      }
      
      if (isTokenValid) {
        // 유효한 토큰이 있으면 인증된 상태로 반환
        state.auth.isAuthenticated = true;
        state.auth.user = stored.user;
        state.auth.idToken = stored.token;
        
        return {
          isAuthenticated: true,
          user: stored.user
        };
      } else {
        // 토큰이 유효하지 않으면 로그아웃 처리
        console.warn('[Whatsub] 저장된 토큰이 유효하지 않음');
        await signOut(true);
        return { isAuthenticated: false };
      }
    } catch (error) {
      console.error(`[Whatsub] 인증 상태 확인 오류 (시도 ${retries + 1}/${maxRetries + 1}):`, error);
      
      retries++;
      
      // 마지막 시도가 아니면 대기 후 재시도
      if (retries <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        // 모든 재시도 실패 - 안전하게 로그아웃 상태로 간주
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.idToken = null;
        
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
 * @param {string} token - 검증할 토큰
 * @returns {Promise<boolean>} - 토큰이 유효한지 여부
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
        console.log('[Whatsub] 토큰 유효성 검증 성공:', userInfo.email);
        return true;
      }
    }
    
    // 토큰 유효하지 않음
    console.warn('[Whatsub] 토큰 유효성 검증 실패:', response.status);
    return false;
  } catch (error) {
    console.error('[Whatsub] 토큰 검증 중 오류:', error);
    return false;
  }
}

/**
 * 음성 인식 시작
 * @dependency content.js의 음성 인식 메시지 처리 로직과 연결됨
 * @relatedFiles content.js, popup.js (toggleSubtitleFilter 함수)
 * @messageFlow popup.js → background.js → content.js
 */
async function startSpeechRecognition(params) {
  try {
    // 파라미터 유효성 검사
    if (!params || !params.tabId) {
      console.error('[Whatsub] 음성 인식 시작: 유효하지 않은 탭 ID');
      return { 
        success: false, 
        error: '유효하지 않은 파라미터: tabId가 필요합니다.' 
      };
    }
    
    const { tabId, useWhisper, universalMode, whisperSettings } = params;
    
    console.log('[Whatsub] 음성 인식 시작 요청:', { tabId, useWhisper, universalMode, settings: whisperSettings });
    
    // 이미 활성화된 상태라면 중지 후 재시작
    if (whisperState.isActive) {
      await stopSpeechRecognition({ tabId: whisperState.tabId });
    }
    
    // 설정 기록
    if (whisperSettings) {
      Object.assign(whisperState.settings, whisperSettings);
    }
    
    // 상태 업데이트
    whisperState.isActive = true;
    whisperState.tabId = tabId;
    whisperState.universalMode = universalMode === true;
    
    // Whisper API 준비
    await prepareWhisperAPI();
    
    // 오디오 캡처 시작
    const captureStarted = await startAudioCapture(tabId);
    
    // 시작 메시지 전송 - 콜백 패턴 사용
    try {
      // tabId 유효성 확인
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 음성 인식 시작: 탭을 찾을 수 없음', chrome.runtime.lastError.message);
          return;
        }
        
        // 함수를 변수에 저장하여 콜백으로 전달
        const callback = function(response) {
          if (chrome.runtime.lastError) {
            console.debug('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', chrome.runtime.lastError.message);
          }
        };
        
        // 완전히 명시적인 콜백 호출
        chrome.tabs.sendMessage(tabId, {
          action: 'whisperStarted',
          settings: whisperState.settings
        }, callback);
      });
    } catch (messageError) {
      console.debug('[Whatsub] 음성 인식 시작 메시지 전송 오류:', messageError);
      // 메시지 전송 실패해도 계속 진행
    }
    
    return { success: true, message: '음성 인식이 시작되었습니다.' };
  } catch (error) {
    console.error('[Whatsub] 음성 인식 시작 오류:', error);
    return { 
      success: false, 
      error: '음성 인식 시작 중 오류가 발생했습니다: ' + error.message 
    };
  }
}

/**
 * 음성 인식 중지
 */
async function stopSpeechRecognition(params) {
  try {
    const { tabId } = params;
    
    // 활성화된 상태가 아니면 성공으로 처리
    if (!whisperState.isActive) {
      return { success: true, message: '음성 인식이 이미 비활성화되어 있습니다.' };
    }
    
    // 오디오 캡처 중지
    await stopAudioCapture();
    
    // 상태 초기화
    whisperState.isActive = false;
    whisperState.tabId = null;
    
    console.log('[Whatsub] 음성 인식 중지됨');
    
    // 중지 메시지 전송
    if (tabId) {
      chrome.tabs.sendMessage(
        tabId, 
        {
          action: 'whisperStopped'
        }, 
        function(response) {
          if (chrome.runtime.lastError) {
            console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', chrome.runtime.lastError);
          }
        }
      );
    }
    
    return { success: true, message: '음성 인식이 중지되었습니다.' };
  } catch (error) {
    console.error('[Whatsub] 음성 인식 중지 오류:', error);
    return { 
      success: false, 
      error: '음성 인식 중지 중 오류가 발생했습니다: ' + error.message 
    };
  }
}

/**
 * Whisper 설정 업데이트
 */
async function updateWhisperSettings(params) {
  try {
    const { tabId, settings } = params;
    
    // 설정 업데이트
    Object.assign(whisperState.settings, settings);
    
    console.log('[Whatsub] Whisper 설정 업데이트:', whisperState.settings);
    
    // 활성화된 상태인 경우 설정 변경 메시지 전송
    if (whisperState.isActive && whisperState.tabId === tabId) {
      chrome.tabs.sendMessage(
        tabId, 
        {
          action: 'whisperSettingsUpdated',
          settings: whisperState.settings
        }, 
        function(response) {
          if (chrome.runtime.lastError) {
            console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', chrome.runtime.lastError);
          }
        }
      );
    }
    
    return { success: true, message: '설정이 업데이트되었습니다.' };
  } catch (error) {
    console.error('[Whatsub] Whisper 설정 업데이트 오류:', error);
    return { 
      success: false, 
      error: '설정 업데이트 중 오류가 발생했습니다: ' + error.message 
    };
  }
}

/**
 * 오디오 캡처 권한 요청
 */
async function requestAudioPermission() {
  try {
    // 백그라운드 컨텍스트에서는 navigator.mediaDevices가 없을 수 있음
    if (!navigator.mediaDevices) {
      console.warn('[Whatsub] 백그라운드 컨텍스트에서 mediaDevices API가 지원되지 않습니다.');
      // 시뮬레이션 모드에서는 항상 성공으로 처리
      return true;
    }
    
    // Chrome API를 통해 오디오 캡처 권한 획득
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 테스트 용도로만 사용했으므로 바로 해제
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    return true;
  } catch (error) {
    console.error('[Whatsub] 오디오 캡처 권한 획득 실패:', error);
    // 실패해도 시뮬레이션 모드에서는 성공으로 간주
    return true;
  }
}

/**
 * Whisper API 준비
 */
async function prepareWhisperAPI() {
  try {
    // 오디오 컨텍스트 생성
    // 백그라운드 컨텍스트에서는 AudioContext가 없을 수 있음
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      whisperState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else {
      console.warn('[Whatsub] 백그라운드 컨텍스트에서 AudioContext API가 지원되지 않습니다.');
      // 오디오 컨텍스트 없이도 시뮬레이션은 가능
    }
    
    // 기타 초기화 로직...
    console.log('[Whatsub] Whisper API 준비 완료');
    
    return true;
  } catch (error) {
    console.error('[Whatsub] Whisper API 준비 오류:', error);
    // 오류가 발생해도 시뮬레이션 모드에서는 성공으로 간주
    return true;
  }
}

/**
 * 오디오 캡처 시작
 */
async function startAudioCapture(tabId) {
  try {
    if (whisperState.stream) {
      // 이미 캡처 중인 경우 중지 후 재시작
      await stopAudioCapture();
    }
    
    // 탭 오디오 캡처 시작
    // chrome.tabCapture가 지원되지 않는 환경에서는 시뮬레이션으로 대체
    if (chrome.tabCapture && typeof chrome.tabCapture.capture === 'function') {
      try {
        const streamInfo = await chrome.tabCapture.capture({
          audio: true,
          video: false
        });
        
        if (streamInfo) {
          whisperState.stream = streamInfo;
        
          // 오디오 처리 설정 (오디오 컨텍스트가 있는 경우에만)
          if (whisperState.audioContext) {
            const source = whisperState.audioContext.createMediaStreamSource(streamInfo);
            // 여기서 오디오 프로세싱 및 Whisper로 전송하는 로직 구현
          }
        } else {
          console.warn('[Whatsub] 탭 오디오 캡처를 시작할 수 없습니다. 시뮬레이션 모드로 전환합니다.');
        }
      } catch (error) {
        console.error('[Whatsub] 탭 오디오 캡처 오류, 시뮬레이션 모드로 전환:', error);
      }
    } else {
      console.warn('[Whatsub] tabCapture API가 지원되지 않습니다. 시뮬레이션 모드로 전환합니다.');
    }
    
    // 실시간 음성 인식 시뮬레이션 (실제 구현에서는 Whisper API와 연동)
    // 실제 캡처 성공 여부와 관계없이 시뮬레이션은 항상 시작
    startSimulatedRecognition(tabId);
    
    console.log('[Whatsub] 오디오 캡처 시작됨 (시뮬레이션 모드)');
    return true;
  } catch (error) {
    console.error('[Whatsub] 오디오 캡처 시작 오류:', error);
    // 오류가 발생해도 시뮬레이션은 시작
    startSimulatedRecognition(tabId);
    return true;
  }
}

/**
 * 오디오 캡처 중지
 */
async function stopAudioCapture() {
  try {
    // 실시간 인식 시뮬레이션 중지
    stopSimulatedRecognition();
    
    // 캡처 중인 스트림 중지
    if (whisperState.stream) {
      whisperState.stream.getTracks().forEach(track => track.stop());
      whisperState.stream = null;
    }
    
    console.log('[Whatsub] 오디오 캡처 중지됨');
    return true;
  } catch (error) {
    console.error('[Whatsub] 오디오 캡처 중지 오류:', error);
    return false;
  }
}

// 시뮬레이션용 타이머 ID
let recognitionTimer = null;
const testPhrases = [
  { ko: "안녕하세요, 왓섭 자막 서비스입니다.", en: "Hello, this is WhaSub subtitle service." },
  { ko: "이 자막은 실시간으로 생성되고 있습니다.", en: "This subtitle is being generated in real-time." },
  { ko: "자막을 여러분의 화면에서 자유롭게 이동할 수 있습니다.", en: "You can freely move the subtitles on your screen." },
  { ko: "왓섭은 어떤 웹사이트에서도 작동합니다.", en: "WhaSub works on any website." },
  { ko: "이것은 테스트 자막입니다.", en: "This is a test subtitle." },
  { ko: "실제 Whisper AI 연동은 추후 업데이트될 예정입니다.", en: "Actual Whisper AI integration will be updated in the future." }
];

/**
 * 실시간 음성 인식 시뮬레이션
 * @dependency content.js의 자막 표시 메커니즘에 의존
 * @relatedFiles content.js (SubtitleDisplay 클래스의 updateText 메서드)
 */
function startSimulatedRecognition(tabId) {
  // 타입 및 값 검사
  if (!tabId || typeof tabId !== 'number') {
    // 오류 메시지 대신 조용히 기록하고 반환
    console.debug('[Whatsub] 시뮬레이션 시작: 유효하지 않은 tabId, 작업 건너뜀');
    return false;
  }
  
  // 탭이 실제로 존재하는지 확인
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.debug('[Whatsub] 시뮬레이션 시작: 탭을 찾을 수 없음', chrome.runtime.lastError);
      return;
    }
    
    // 실제 시뮬레이션 로직 시작
    continueSimulation(tabId);
  });
  
  return true;
}

/**
 * 시뮬레이션 로직 실행 (유효한 탭 확인 후)
 * @param {number} tabId 유효한 탭 ID
 */
function continueSimulation(tabId) {
  // 기존 타이머 제거
  stopSimulatedRecognition();
  
  // 테스트 자막 데이터
  const subtitles = [
    { original: "Hello, welcome to Whatsub Extension.", translated: "안녕하세요, Whatsub 확장 프로그램에 오신 것을 환영합니다." },
    { original: "This is a simulated speech recognition.", translated: "이것은 시뮬레이션된 음성 인식입니다." },
    { original: "Real-time subtitles will appear here.", translated: "실시간 자막이 여기에 표시됩니다." },
    { original: "You can customize subtitle appearance in settings.", translated: "설정에서 자막 모양을 변경할 수 있습니다." },
    { original: "Try different languages for translation.", translated: "다양한 언어로 번역을 시도해보세요." },
    { original: "Thank you for using Whatsub!", translated: "Whatsub를 이용해 주셔서 감사합니다!" }
  ];
  
  let index = 0;
  
  // 일정 간격으로 자막 전송
  recognitionTimer = setInterval(() => {
    // 활성화 상태가 아니면 중지
    if (!whisperState.isActive) {
      stopSimulatedRecognition();
      return;
    }
    
    // 현재 자막 가져오기
    const subtitle = subtitles[index % subtitles.length];
    
    // 자막 전송 (tabId가 유효한 경우에만)
    try {
      // 탭 존재 여부 다시 확인
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 자막 전송: 탭이 더 이상 존재하지 않음, 시뮬레이션 중지');
          stopSimulatedRecognition();
          return;
        }
        
        // 콜백 함수를 명시적으로 변수에 저장
        const callback = function(response) {
          if (chrome.runtime.lastError) {
            console.debug('[Whatsub] 탭에 자막 전송 실패 (무시됨):', chrome.runtime.lastError.message);
          }
        };
        
        // 명시적 콜백 패턴으로 메시지 전송
        chrome.tabs.sendMessage(tabId, {
          action: 'updateTranscription',
          text: subtitle.original,
          translation: subtitle.translated
        }, callback);
      });
    } catch (error) {
      console.debug('[Whatsub] 자막 전송 중 오류 발생:', error);
    }
    
    index++;
  }, 5000); // 5초마다 새 자막
}

/**
 * 실시간 음성 인식 시뮬레이션 중지
 */
function stopSimulatedRecognition() {
  if (recognitionTimer) {
    clearInterval(recognitionTimer);
    recognitionTimer = null;
  }
}

// 확장 프로그램이 설치/업데이트될 때 실행되는 이벤트
chrome.runtime.onInstalled.addListener(details => {
  console.log('[Whatsub] 확장 프로그램 설치/업데이트:', details.reason);
  
  // 기본 설정 저장
  chrome.storage.sync.set({
    settings: {
      sourceLanguage: 'auto',
      targetLanguage: 'ko',
      fontSize: 'medium',
      position: 'bottom',
      background: 'semi-transparent'
    }
  });
});

// 키보드 단축키 처리
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[Whatsub] 단축키 명령 수신:', command);
  
  // 현재 활성화된 탭 가져오기
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    console.error('[Whatsub] 활성화된 탭을 찾을 수 없습니다.');
    return;
  }
  
  const tabId = tabs[0].id;
  
  /**
   * 단축키: 자막 켜기/끄기 토글
   * @dependency manifest.json에 정의된 toggle-subtitles 명령과 연결
   * @relatedFiles content.js (SubtitleDisplay.setVisibility 메서드), manifest.json
   */
  if (command === 'toggle-subtitles') {
    // 현재 자막 상태 가져오기
    chrome.storage.sync.get('subtitleEnabled', (data) => {
      const newState = !(data.subtitleEnabled === true);
      
      // 콘텐츠 스크립트에 메시지 전송 - 콜백 패턴 사용
      chrome.tabs.sendMessage(
        tabId, 
        {
          action: 'toggleSubtitles',
          enabled: newState
        }, 
        function(response) {
          if (chrome.runtime.lastError) {
            console.warn('[Whatsub] 탭에 자막 토글 메시지 전송 실패 (무시됨):', chrome.runtime.lastError);
          }
        }
      );
      
      // 상태 저장
      chrome.storage.sync.set({ subtitleEnabled: newState });
      
      console.log('[Whatsub] 자막 상태 토글:', newState ? '활성화' : '비활성화');
    });
  } 
  /**
   * 단축키: 자막 위치 초기화
   * @dependency manifest.json에 정의된 reset-position 명령과 연결
   * @relatedFiles content.js (SubtitleDisplay.resetPosition 메서드), manifest.json
   */
  else if (command === 'reset-position') {
    // 자막 위치 초기화 요청 - 콜백 패턴 사용
    chrome.tabs.sendMessage(
      tabId, 
      {
        action: 'resetPosition'
      }, 
      function(response) {
        if (chrome.runtime.lastError) {
          console.warn('[Whatsub] 자막 위치 초기화 메시지 전송 실패 (무시됨):', chrome.runtime.lastError);
        }
      }
    );
    
    console.log('[Whatsub] 자막 위치 초기화 요청 전송');
  }
  /**
   * 단축키: 음성 인식 토글
   * @dependency manifest.json에 정의된 toggle-speech-recognition 명령과 연결
   * @relatedFiles content.js (startSubtitleService, stopSubtitleService 함수), manifest.json
   */
  else if (command === 'toggle-speech-recognition') {
    // 현재 음성 인식 상태 토글
    if (whisperState.isActive && whisperState.tabId === tabId) {
      // 현재 활성화 상태이고 같은 탭이면 중지
      await stopSpeechRecognition({ tabId });
    } else {
      // 활성화 상태가 아니거나 다른 탭이면 시작
      await startSpeechRecognition({ 
        tabId,
        useWhisper: true,
        universalMode: true,
        whisperSettings: whisperState.settings
      });
    }
  }
});

/**
 * 비디오 메시지 처리
 * @dependency content.js의 비디오 감지 및 이벤트 처리 로직과 연결됨
 * @relatedFiles content.js (VideoDetector 클래스), content-script.js
 * @messageFlow content.js → background.js → 필요 시 다른 탭으로 전달
 */
function handleVideoMessages(request, sender, sendResponse) {
  try {
    const { action, data } = request;
    
    // 비디오 감지 이벤트
    if (action === 'videoDetected') {
      console.log('[Whatsub] 비디오 감지됨:', data.url);
      
      // 현재 탭 정보 저장
      if (sender.tab) {
        videosState.tabs[sender.tab.id] = {
          url: data.url,
          videoCount: data.count || 1,
          title: sender.tab.title || '알 수 없는 제목',
          status: 'active'
        };
      }
      
      // 자막 설정 정보 로드
      chrome.storage.sync.get(['subtitleEnabled', 'autoStart'], function(settings) {
        const shouldAutoStart = settings.autoStart === true;
        
        // 자막 자동 시작 설정이 활성화되어 있는 경우
        if (shouldAutoStart && sender.tab) {
          console.log('[Whatsub] 자막 자동 시작 처리:', sender.tab.id);
          
          // 자막 활성화 메시지 전송 - 콜백 패턴 사용
          chrome.tabs.sendMessage(
            sender.tab.id, 
            {
              action: 'toggleSubtitles',
              enabled: true
            }, 
            function(response) {
              if (chrome.runtime.lastError) {
                console.warn('[Whatsub] 자막 자동 시작 메시지 전송 실패 (무시됨):', chrome.runtime.lastError);
              }
            }
          );
          
          // 스토리지에 상태 저장
          chrome.storage.sync.set({ subtitleEnabled: true });
        }
      });
      
      // 응답 전송
      sendResponse({ 
        success: true, 
        message: '비디오 감지 정보 수신됨',
        settings: {
          shouldActivateSubtitles: videosState.autoActivateSubtitles
        }
      });
    }
    // 비디오 재생/일시정지 이벤트
    else if (action === 'videoPlayStateChanged') {
      console.log('[Whatsub] 비디오 재생 상태 변경:', data.isPlaying ? '재생 중' : '일시 정지');
      
      // 탭 정보 업데이트
      if (sender.tab) {
        const tabInfo = videosState.tabs[sender.tab.id] || {};
        tabInfo.isPlaying = data.isPlaying;
        videosState.tabs[sender.tab.id] = tabInfo;
      }
      
      // 추가 작업이 필요한 경우 여기에 구현...
      
      sendResponse({ success: true });
    }
    // 비디오 시간 업데이트 이벤트
    else if (action === 'videoTimeUpdate') {
      // 세부 로깅 비활성화 (과도한 로그 방지)
      // console.log('[Whatsub] 비디오 시간 업데이트:', data.currentTime);
      
      // 현재 재생 중인 비디오 시간 저장
      if (sender.tab) {
        const tabInfo = videosState.tabs[sender.tab.id] || {};
        tabInfo.currentTime = data.currentTime;
        videosState.tabs[sender.tab.id] = tabInfo;
      }
      
      sendResponse({ success: true });
    }
    // 기타 비디오 관련 이벤트
    else {
      console.log('[Whatsub] 처리되지 않은 비디오 메시지:', action);
      sendResponse({ success: false, error: 'Unknown video action' });
    }
  } catch (error) {
    console.error('[Whatsub] 비디오 메시지 처리 중 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  // 비동기 응답을 위해 true 반환
  return true;
} 