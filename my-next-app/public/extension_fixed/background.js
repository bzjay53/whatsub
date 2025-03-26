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
 * 인증 상태 확인
 */
async function checkAuth() {
  try {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['user', 'authState'], resolve);
    });
    
    const isAuthenticated = result.user && result.authState === 'authenticated';
    
    // 상태 업데이트
    state.auth.isAuthenticated = isAuthenticated;
    if (isAuthenticated) {
      state.auth.user = result.user;
    }
    
    return {
      isAuthenticated: isAuthenticated,
      user: isAuthenticated ? result.user : null
    };
  } catch (error) {
    console.error('[Whatsub] 인증 상태 확인 오류:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

/**
 * 메시지 핸들러
 */
function handleMessage(message, sender, sendResponse) {
  console.log('[Whatsub] 메시지 수신:', message);
  
  const asyncResponse = async (fn) => {
    try {
      const result = await fn();
      sendResponse(result);
    } catch (error) {
      console.error('[Whatsub] 메시지 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
  };
  
  // 액션 별 처리
  switch (message.action) {
    case 'signInWithGoogle':
      asyncResponse(async () => {
        const result = await signInWithGoogle();
        return result;
      });
      break;
      
    case 'signOut':
      asyncResponse(async () => {
        const result = await signOut(message.force);
        return result;
      });
      break;
      
    case 'checkAuth':
      asyncResponse(async () => {
        const result = await checkAuth();
        return result;
      });
      break;
      
    case 'getUsage':
      // 사용량 정보 가져오기
      asyncResponse(async () => {
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
      });
      break;
      
    case 'translateText':
      // 텍스트 번역 처리
      asyncResponse(async () => {
        try {
          const { text, source, target } = message;
          
          if (!text || text.trim().length === 0) {
            return {
              success: false,
              error: '번역할 텍스트가 없습니다.'
            };
          }
          
          // 이 버전에서는 간단한 테스트 번역만 제공
          let translatedText = '';
          
          // 간단한 번역 테스트를 위한 사전식 매핑
          const enToKoDict = {
            'hello': '안녕하세요',
            'world': '세계',
            'how are you': '어떻게 지내세요',
            'thank you': '감사합니다',
            'good morning': '좋은 아침입니다',
            'good afternoon': '좋은 오후입니다',
            'good evening': '좋은 저녁입니다',
            'goodbye': '안녕히 가세요',
            'what is your name': '이름이 뭐예요',
            'nice to meet you': '만나서 반갑습니다',
            'i love you': '사랑합니다',
            'welcome': '환영합니다',
            'please': '제발',
            'sorry': '죄송합니다',
            'excuse me': '실례합니다',
            'yes': '네',
            'no': '아니오',
            'maybe': '아마도',
            'of course': '물론입니다',
            'i understand': '이해합니다',
            'i don\'t understand': '이해하지 못합니다',
            'help': '도와주세요',
            'wait': '기다려주세요',
            'stop': '멈추세요',
            'go': '가세요',
            'come': '오세요',
            'eat': '먹어요',
            'drink': '마셔요',
            'sleep': '자요',
            'wake up': '일어나세요',
            'work': '일해요',
            'play': '놀아요',
            'study': '공부해요',
            'read': '읽어요',
            'write': '써요',
            'speak': '말해요',
            'listen': '들어요',
            'watch': '봐요',
            'think': '생각해요',
            'feel': '느껴요',
            'know': '알아요',
            'want': '원해요',
            'need': '필요해요',
            'can': '할 수 있어요',
            'cannot': '할 수 없어요',
            'should': '해야 해요',
            'must': '반드시 해야 해요',
            'may': '~해도 됩니다',
            'might': '~할지도 모릅니다'
          };
          
          // 테스트 번역 매핑
          if (source === 'en' && target === 'ko') {
            // 입력된 텍스트에서 등록된 단어나 문구가 있는지 확인
            const lowerText = text.toLowerCase();
            
            // 사전에서 매치되는 항목 찾기
            const matches = Object.keys(enToKoDict).filter(key => 
              lowerText.includes(key.toLowerCase())
            );
            
            if (matches.length > 0) {
              translatedText = text;
              
              // 매치된 각 항목을 번역으로 대체
              matches.forEach(match => {
                const regex = new RegExp(match, 'gi');
                translatedText = translatedText.replace(regex, enToKoDict[match]);
              });
            } else {
              // 매칭되는 항목이 없으면 '번역된' 접두사 추가
              translatedText = `[번역됨] ${text}`;
            }
          } else {
            // 다른 언어 조합은 단순 접두사로 표시
            translatedText = `[${target}로 번역됨] ${text}`;
          }
          
          // 실제 서비스에서는 여기에 API 호출을 추가
          
          return {
            success: true,
            originalText: text,
            translatedText: translatedText,
            source: source,
            target: target
          };
        } catch (error) {
          console.error('[Whatsub] 텍스트 번역 중 오류:', error);
          return {
            success: false,
            error: error.message || '번역 중 오류가 발생했습니다.'
          };
        }
      });
      break;
      
    case 'pageLoaded':
      // 페이지 로드 알림
      console.log('[Whatsub] 페이지 로드됨:', message.url);
      if (message.isYouTubePage) {
        console.log('[Whatsub] 유튜브 페이지 감지됨');
      }
      sendResponse({ success: true });
      break;
      
    case 'disableSubtitles':
      // 자막 비활성화 요청
      asyncResponse(async () => {
        chrome.storage.sync.set({ subtitleEnabled: false });
        return { success: true };
      });
      break;
      
    case 'saveSettings':
      // 설정 저장 요청
      asyncResponse(async () => {
        chrome.storage.sync.set({ subtitleSettings: message.settings });
        return { success: true };
      });
      break;
      
    default:
      // 알 수 없는 액션
      sendResponse({ success: false, error: '알 수 없는 액션: ' + message.action });
      break;
  }
  
  // true를 반환하여 비동기 sendResponse 허용
  return true;
}

// 메시지 리스너 등록
chrome.runtime.onMessage.addListener(handleMessage);

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

// 확장 프로그램 시작 시 인증 상태 체크
checkAuth().then(authState => {
  console.log('[Whatsub] 시작 시 인증 상태:', authState.isAuthenticated ? '로그인됨' : '로그인되지 않음');
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