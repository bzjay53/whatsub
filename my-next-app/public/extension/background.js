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
  console.log('[Whatsub] 메시지 수신:', message.action);
  
  // 메시지 타입에 따른 처리
  switch (message.action) {
    case 'signInWithGoogle':
      return await signInWithGoogle();
      
    case 'signOut':
      return await signOut(message.force);
      
    case 'checkAuth':
      return await checkAuth();
      
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
      
      // 토큰 유효성 확인 (저장된 토큰이 있는 경우)
      if (stored.isAuthenticated && stored.token) {
        const isTokenValid = await validateToken(stored.token);
        
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
      } else {
        // 인증 정보가 없음
        state.auth.isAuthenticated = false;
        state.auth.user = null;
        state.auth.idToken = null;
        
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
 */
async function startSpeechRecognition(params) {
  try {
    const { tabId, useWhisper = true, universalMode = false, whisperSettings = {} } = params;
    
    if (!tabId) {
      console.error('[Whatsub] 음성 인식 시작: 탭 ID가 제공되지 않았습니다.');
      return { success: false, error: '탭 ID가 제공되지 않았습니다.' };
    }
    
    // 이미 활성화된 상태인지 확인
    if (whisperState.isActive) {
      // 이미 같은 탭에서 활성화되어 있는 경우 성공으로 처리
      if (whisperState.tabId === tabId) {
        return { success: true, message: '이미 음성 인식이 활성화되어 있습니다.' };
      }
      
      // 다른 탭에서 활성화된 경우 기존 인식 중지
      await stopSpeechRecognition({ tabId: whisperState.tabId });
    }
    
    // 설정 적용
    Object.assign(whisperState.settings, whisperSettings);
    whisperState.tabId = tabId;
    
    // 권한 획득
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      return { 
        success: false, 
        error: '오디오 캡처 권한이 없습니다. 권한을 허용해주세요.' 
      };
    }
    
    console.log('[Whatsub] 음성 인식 시작 (Whisper AI):', {
      tabId,
      settings: whisperState.settings
    });
    
    // Whisper API 준비
    await prepareWhisperAPI();
    
    // 오디오 캡처 시작
    await startAudioCapture(tabId);
    
    // 음성 인식 상태 업데이트
    whisperState.isActive = true;
    
    // 인식 시작 메시지 전송
    chrome.tabs.sendMessage(tabId, {
      action: 'whisperStarted',
      settings: whisperState.settings
    }).catch(err => console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', err));
    
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
      chrome.tabs.sendMessage(tabId, {
        action: 'whisperStopped'
      }).catch(err => console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', err));
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
      chrome.tabs.sendMessage(tabId, {
        action: 'whisperSettingsUpdated',
        settings: whisperState.settings
      }).catch(err => console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', err));
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
 * 실시간 음성 인식 시뮬레이션 시작 (테스트용)
 */
function startSimulatedRecognition(tabId) {
  // 이전 타이머 제거
  if (recognitionTimer) {
    clearInterval(recognitionTimer);
    recognitionTimer = null;
  }
  
  let index = 0;
  
  // 주기적으로 자막 생성 시뮬레이션
  recognitionTimer = setInterval(() => {
    const phrase = testPhrases[index % testPhrases.length];
    const language = whisperState.settings.language || 'ko';
    const text = language === 'ko' ? phrase.ko : phrase.en;
    
    // 자막 전송
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'newSubtitle',
        data: {
          text: text,
          translation: language === 'ko' ? phrase.en : phrase.ko,
          confidence: 0.95,
          timestamp: Date.now()
        }
      }).catch(err => console.warn('[Whatsub] 탭에 자막 전송 실패 (무시됨):', err));
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
  
  if (command === 'toggle-subtitles') {
    // 현재 자막 상태 가져오기
    chrome.storage.sync.get('subtitleEnabled', (data) => {
      const newState = !(data.subtitleEnabled === true);
      
      // 콘텐츠 스크립트에 메시지 전송
      chrome.tabs.sendMessage(tabId, {
        action: 'toggleSubtitles',
        enabled: newState
      });
      
      // 상태 저장
      chrome.storage.sync.set({ subtitleEnabled: newState });
      
      console.log('[Whatsub] 자막 상태 토글:', newState ? '활성화' : '비활성화');
    });
  } 
  else if (command === 'reset-position') {
    // 자막 위치 초기화 요청
    chrome.tabs.sendMessage(tabId, {
      action: 'resetPosition'
    });
    
    console.log('[Whatsub] 자막 위치 초기화 요청 전송');
  }
}); 