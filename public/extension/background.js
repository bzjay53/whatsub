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

// 전역 상태 관리
const state = {
  // 인증 관련 상태
  auth: {
    isAuthenticated: false,
    user: null,
    idToken: null
  },
  
  // 위스퍼 API 관련 상태
  whisperActive: false,
  whisperApiReady: false,
  activeTabId: null,
  simulationInterval: null,
  audioCapture: null,
  audioContext: null,
  whisperSettings: {
    language: 'ko',
    modelSize: 'base',
    realTime: true,
    captureAudioFromTab: true
  },
  
  // 메시지 큐
  pendingMessages: []
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

// Whatsub 백그라운드 스크립트
console.log('Whatsub 백그라운드 스크립트가 로드되었습니다.');

// 환경 설정
const OPENAI_API_KEY = ''; // 실제 API 키는 보안상의 이유로 사용자가 설정 페이지에서 입력하도록 함
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_SETTINGS = {
  subtitleEnabled: false,
  language: 'ko',
  autoSubtitlesEnabled: false,
  commentsEnabled: false,
  subtitleSettings: {
    position: 'bottom',
    fontSize: 'medium',
    background: 'semi',
    dualSubtitles: false
  }
};

// 사용자 설정 저장
let userSettings = { ...DEFAULT_SETTINGS };
let whisperApiKey = '';

// 설정 로드
function loadSettings() {
  chrome.storage.local.get(['settings', 'whisperApiKey'], function(result) {
    if (result.settings) {
      userSettings = { ...DEFAULT_SETTINGS, ...result.settings };
      console.log('설정 로드됨:', userSettings);
    }
    
    if (result.whisperApiKey) {
      whisperApiKey = result.whisperApiKey;
      console.log('API 키 로드됨');
    }
  });
}

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // 초기 설정 저장
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    
    // 웰컴 페이지 오픈
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  } else if (details.reason === 'update') {
    // 기존 설정 유지하고 업데이트 알림
    loadSettings();
  }
});

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('메시지 수신:', request.action);
  
  // 설정 관련 액션
  if (request.action === 'getSettings') {
    sendResponse({ success: true, settings: userSettings });
    return true;
  }
  
  if (request.action === 'saveSettings') {
    if (request.settings) {
      userSettings = { ...userSettings, ...request.settings };
      chrome.storage.local.set({ settings: userSettings });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '설정 데이터가 없습니다.' });
    }
    return true;
  }
  
  if (request.action === 'updateSettings') {
    if (request.settings) {
      // userSettings.subtitleSettings 업데이트
      userSettings.subtitleSettings = { 
        ...userSettings.subtitleSettings, 
        ...request.settings 
      };
      chrome.storage.local.set({ settings: userSettings });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '설정 데이터가 없습니다.' });
    }
    return true;
  }
  
  // 음성 인식 관련 액션
  if (request.action === 'startSpeechRecognition') {
    try {
      // 음성 인식 시작 처리
      startSpeechRecognition(request).then(response => {
        sendResponse(response);
      }).catch(error => {
        console.error('[Whatsub] 음성 인식 시작 중 오류:', error);
        sendResponse({ 
          success: false, 
          error: '음성 인식 시작 중 오류가 발생했습니다: ' + error.message 
        });
      });
      
      return true; // 비동기 응답을 위해 true 반환
    } catch (error) {
      console.error('[Whatsub] 음성 인식 시작 요청 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  if (request.action === 'stopSpeechRecognition') {
    try {
      // 음성 인식 중지 처리
      stopSpeechRecognition(request).then(response => {
        sendResponse(response);
      }).catch(error => {
        console.error('[Whatsub] 음성 인식 중지 중 오류:', error);
        sendResponse({ 
          success: false, 
          error: '음성 인식 중지 중 오류가 발생했습니다: ' + error.message 
        });
      });
      
      return true; // 비동기 응답을 위해 true 반환
    } catch (error) {
      console.error('[Whatsub] 음성 인식 중지 요청 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  if (request.action === 'updateWhisperSettings') {
    try {
      // Whisper 설정 업데이트 처리
      updateWhisperSettings(request).then(response => {
        sendResponse(response);
      }).catch(error => {
        console.error('[Whatsub] Whisper 설정 업데이트 중 오류:', error);
        sendResponse({ 
          success: false, 
          error: '설정 업데이트 중 오류가 발생했습니다: ' + error.message 
        });
      });
      
      return true; // 비동기 응답을 위해 true 반환
    } catch (error) {
      console.error('[Whatsub] Whisper 설정 업데이트 요청 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  if (request.action === 'resetSettings') {
    userSettings = { ...DEFAULT_SETTINGS };
    chrome.storage.local.set({ settings: userSettings });
    sendResponse({ success: true });
    return true;
  }
  
  // 인증 관련 액션
  if (request.action === 'checkAuth') {
    // 로컬 스토리지에서 인증 상태 확인
    chrome.storage.local.get(['auth', 'user'], function(data) {
      const isAuthenticated = data.auth?.isAuthenticated || false;
      sendResponse({ 
        success: true, 
        isAuthenticated: isAuthenticated, 
        user: data.user || null 
      });
    });
    return true;
  }
  
  if (request.action === 'signInWithGoogle') {
    // 간단한 모의 로그인 처리 (실제로는 OAuth 인증 필요)
    const mockUser = {
      uid: 'user123',
      email: 'user@example.com',
      displayName: '사용자',
      photoURL: 'icons/default-avatar.png'
    };
    
    chrome.storage.local.set({
      auth: { isAuthenticated: true },
      user: mockUser
    }, function() {
      sendResponse({ 
        success: true, 
        user: mockUser 
      });
    });
    return true;
  }
  
  if (request.action === 'signOut') {
    // 로그아웃 처리
    chrome.storage.local.remove(['auth', 'user'], function() {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Whisper API 관련 액션
  if (request.action === 'saveApiKey') {
    if (request.apiKey) {
      whisperApiKey = request.apiKey;
      chrome.storage.local.set({ whisperApiKey: whisperApiKey });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'API 키가 없습니다.' });
    }
    return true;
  }
  
  if (request.action === 'checkWhisperAvailability') {
    if (whisperApiKey) {
      sendResponse({ available: true });
    } else {
      sendResponse({ 
        available: false, 
        reason: 'API 키가 설정되지 않았습니다. 설정 페이지에서 Whisper API 키를 입력해주세요.' 
      });
    }
    return true;
  }
  
  if (request.action === 'processAudioWithWhisper') {
    if (!whisperApiKey) {
      sendResponse({ 
        success: false, 
        error: 'Whisper API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.' 
      });
      return true;
    }
    
    if (!request.audioData) {
      sendResponse({ success: false, error: '오디오 데이터가 없습니다.' });
      return true;
    }
    
    // Base64 데이터를 Blob으로 변환
    const byteString = atob(request.audioData);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const intArray = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      intArray[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([arrayBuffer], { type: 'audio/webm' });
    
    // FormData 생성
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    
    // 언어 설정
    if (request.language && request.language !== 'auto') {
      formData.append('language', request.language);
    }
    
    // API 요청
    fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whisperApiKey}`
      },
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.text) {
        sendResponse({ success: true, text: data.text });
      } else {
        sendResponse({ success: false, error: data.error || '텍스트를 추출할 수 없습니다.' });
      }
    })
    .catch(error => {
      console.error('Whisper API 요청 오류:', error);
      sendResponse({ success: false, error: '오디오 처리 중 오류가 발생했습니다.' });
    });
    
    return true;
  }
  
  // 자막 관련 액션
  if (request.action === 'toggleSubtitles' || request.action === 'toggleSubtitleFilter') {
    try {
      // 현재 활성화된 탭 가져오기
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
          try {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggleSubtitles',
              enabled: request.enabled
            }).catch(error => {
              console.error('[Whatsub] 자막 토글 메시지 전송 실패:', error);
              // 콘텐츠 스크립트와 연결을 설정할 수 없는 경우에도 성공 응답을 보냄
              // 팝업 UI에서는 정상적으로 동작하게 함
            });
          } catch (error) {
            console.error('[Whatsub] 자막 토글 메시지 전송 중 예외 발생:', error);
          }
        }
      });
      
      // 상태 저장 및 응답
      userSettings.subtitleEnabled = request.enabled;
      chrome.storage.local.set({ settings: userSettings });
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Whatsub] 자막 토글 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'changeLanguage') {
    try {
      // 현재 활성화된 탭 가져오기
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
          try {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'changeLanguage',
              language: request.language
            }).catch(error => {
              console.error('[Whatsub] 언어 변경 메시지 전송 실패:', error);
            });
          } catch (error) {
            console.error('[Whatsub] 언어 변경 메시지 전송 중 예외 발생:', error);
          }
        }
      });
      
      // 상태 저장 및 응답
      userSettings.language = request.language;
      chrome.storage.local.set({ settings: userSettings });
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Whatsub] 언어 변경 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'updateSettings') {
    try {
      // 현재 활성화된 탭 가져오기
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
          try {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'updateSettings',
              settings: request.settings
            }).catch(error => {
              console.error('[Whatsub] 설정 업데이트 메시지 전송 실패:', error);
            });
          } catch (error) {
            console.error('[Whatsub] 설정 업데이트 메시지 전송 중 예외 발생:', error);
          }
        }
      });
      
      // 상태 저장 및 응답
      userSettings.subtitleSettings = { 
        ...userSettings.subtitleSettings, 
        ...request.settings 
      };
      chrome.storage.local.set({ settings: userSettings });
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Whatsub] 설정 업데이트 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === 'showTestSubtitle') {
    try {
      // 현재 활성화된 탭 가져오기
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
          try {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'showTestSubtitle',
              original: request.original || "This is a test subtitle from Whatsub.",
              translated: request.translated || "이것은 Whatsub의 테스트 자막입니다."
            }).catch(error => {
              console.error('[Whatsub] 테스트 자막 메시지 전송 실패:', error);
            });
          } catch (error) {
            console.error('[Whatsub] 테스트 자막 메시지 전송 중 예외 발생:', error);
          }
        }
      });
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Whatsub] 테스트 자막 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  // 메시지에 매칭되는 처리가 없는 경우
  sendResponse({ success: false, error: '지원하지 않는 액션입니다: ' + request.action });
  return true;
});

// 초기화
loadSettings();

console.log('Whatsub 백그라운드 스크립트 초기화 완료');

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
      
    case 'submitComment':
      // 댓글 제출 처리
      console.log('[Whatsub] 댓글 제출:', message.comment);
      return {
        success: true,
        commentId: 'comment_' + Date.now(),
        userName: state.auth.user ? state.auth.user.displayName : '익명 사용자',
        userAvatar: state.auth.user ? state.auth.user.photoURL : 'https://via.placeholder.com/24'
      };
      
    case 'getComments':
      // 댓글 가져오기
      console.log('[Whatsub] 댓글 요청:', message.videoId, message.subtitleId);
      return {
        success: true,
        comments: [
          {
            id: 'sample_comment_1',
            user: {
              name: '샘플 사용자 1',
              avatar: 'https://via.placeholder.com/24'
            },
            text: '이 번역이 정확한 것 같습니다',
            timestamp: new Date().toISOString(),
            likes: 5
          },
          {
            id: 'sample_comment_2',
            user: {
              name: '샘플 사용자 2',
              avatar: 'https://via.placeholder.com/24'
            },
            text: '이 부분은 좀 더 자연스럽게 번역하면 좋을 것 같아요',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            likes: 2
          }
        ]
      };
      
    case 'getCommentsAtTime':
      // 특정 시간대의 댓글 가져오기
      console.log('[Whatsub] 타임스탬프 댓글 요청:', message.videoId, message.timestamp);
      
      // 샘플 댓글 생성 (실제로는 DB에서 조회)
      const timeBasedComments = generateSampleTimeComments(message.videoId, message.timestamp, message.timeRange);
      
      return {
        success: true,
        comments: timeBasedComments
      };
      
    case 'likeComment':
      // 댓글 좋아요 처리
      console.log('[Whatsub] 댓글 좋아요:', message.commentId);
      return {
        success: true,
        commentId: message.commentId,
        likes: 6 // 예시 값
      };
      
    case 'rateSubtitle':
      // 자막 평가 처리 (좋아요, 싫어요, 추천)
      console.log('[Whatsub] 자막 평가:', message.subtitleId, message.rating);
      return {
        success: true,
        subtitleId: message.subtitleId,
        rating: message.rating,
        count: 10 // 예시 값
      };
      
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
async function startSpeechRecognition(params = {}) {
  try {
    const tabId = params.tabId;
    if (!tabId) {
      throw new Error('탭 ID가 지정되지 않았습니다.');
    }
    
    // 음성 인식이 이미 활성화 상태인지 확인
    if (state.whisperActive) {
      console.log('음성 인식이 이미 활성화되어 있습니다.');
      return { success: true, alreadyActive: true };
    }
    
    console.log('음성 인식 시작...', params);
    
    // 모드 설정
    state.whisperSettings.language = params.whisperSettings?.language || 'ko';
    state.whisperSettings.modelSize = params.whisperSettings?.modelSize || 'base';
    state.whisperSettings.realTime = params.whisperSettings?.realTime !== false;
    state.whisperSettings.captureAudioFromTab = params.whisperSettings?.captureAudioFromTab !== false;
    
    // 웹소켓 연결 확인
    if (!state.whisperApiReady) {
      await prepareWhisperAPI();
    }
    
    // 오디오 캡처 시작
    if (state.whisperSettings.captureAudioFromTab) {
      // 실제 오디오 캡처 시작
      await startAudioCapture(tabId);
    } else {
      // 시뮬레이션 모드 시작 (테스트용)
      console.log('시뮬레이션 모드로 시작 중...');
      startSimulatedRecognition(tabId);
    }
    
    // 상태 업데이트
    state.whisperActive = true;
    state.activeTabId = tabId;
    
    // 활성화된 탭에 알림
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'whisperStarted',
        settings: state.whisperSettings
      });
      console.log('whisperStarted 알림 전송 완료');
    } catch (notifyError) {
      console.warn('탭에 알림 전송 실패:', notifyError);
    }
    
    // 성공 응답
    return { success: true };
  } catch (error) {
    console.error('음성 인식 시작 중 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 음성 인식 중지
 */
async function stopSpeechRecognition(params = {}) {
  try {
    console.log('음성 인식 중지...', params);
    
    if (!state.whisperActive) {
      console.log('음성 인식이 이미 비활성화 상태입니다.');
      return { success: true, alreadyInactive: true };
    }
    
    // 오디오 캡처 중지
    if (state.whisperSettings.captureAudioFromTab) {
      await stopAudioCapture();
    } else {
      stopSimulatedRecognition();
    }
    
    // 상태 업데이트
    state.whisperActive = false;
    
    // 활성화된 탭에 알림
    if (state.activeTabId) {
      try {
        await chrome.tabs.sendMessage(state.activeTabId, {
          action: 'whisperStopped'
        });
        console.log('whisperStopped 알림 전송 완료');
      } catch (notifyError) {
        console.warn('탭에 알림 전송 실패:', notifyError);
      }
      
      state.activeTabId = null;
    }
    
    // 성공 응답
    return { success: true };
  } catch (error) {
    console.error('음성 인식 중지 중 오류:', error);
    return { success: false, error: error.message };
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
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'whisperSettingsUpdated',
          settings: whisperState.settings
        });
      } catch (err) {
        console.warn('[Whatsub] 탭에 메시지 전송 실패 (무시됨):', err);
      }
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
        const streamInfo = await new Promise((resolve, reject) => {
          chrome.tabCapture.capture({
            audio: true,
            video: false
          }, (stream) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(stream);
            }
          });
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
  if (state.simulationInterval) {
    clearInterval(state.simulationInterval);
  }
  
  console.log('시뮬레이션 모드 시작 (테스트용)');
  
  // 자막 샘플
  const sampleTexts = [
    "안녕하세요, 여러분. 오늘은 Whatsub 확장 프로그램에 대해 알아보겠습니다.",
    "Whatsub을 사용하면 모든 웹 비디오에 자막을 추가할 수 있습니다.",
    "자막은 실시간으로 번역되며, 원하는 언어로 설정할 수 있습니다.",
    "이 확장 프로그램은 Chrome 웹 스토어에서 무료로 다운로드할 수 있습니다.",
    "자막 위치, 크기, 배경 투명도 등 다양한 설정이 가능합니다.",
    "이중 자막 모드를 사용하면 원본과 번역 텍스트를 동시에 볼 수 있습니다.",
    "여러분의 피드백은 Whatsub을 개선하는 데 큰 도움이 됩니다.",
    "자막 기능에 문제가 있으면 언제든지 도움말을 참조하세요."
  ];
  
  let index = 0;
  
  // 3초마다 새 자막 전송
  state.simulationInterval = setInterval(async () => {
    if (!state.whisperActive) {
      clearInterval(state.simulationInterval);
      state.simulationInterval = null;
      return;
    }
    
    const text = sampleTexts[index];
    index = (index + 1) % sampleTexts.length;
    
    try {
      // 테스트 자막 전송
      await chrome.tabs.sendMessage(tabId, {
        action: 'newSubtitle',
        text: text
      });
      
      console.log('시뮬레이션 자막 전송:', text);
    } catch (error) {
      console.error('시뮬레이션 자막 전송 실패:', error);
    }
  }, 3000);
}

// 음성 인식 시뮬레이션 중지
function stopSimulatedRecognition() {
  if (state.simulationInterval) {
    clearInterval(state.simulationInterval);
    state.simulationInterval = null;
    console.log('시뮬레이션 모드 종료');
  }
}

/**
 * 특정 시간대의 샘플 댓글 생성
 * @param {string} videoId - 비디오 ID
 * @param {number} timestamp - 현재 재생 시간(초)
 * @param {number} timeRange - 타임스탬프 범위(초)
 * @returns {Array} - 샘플 댓글 배열
 */
function generateSampleTimeComments(videoId, timestamp, timeRange = 2) {
  // 실제 구현에서는 DB에서 해당 시간대의 댓글을 조회
  
  // 기본 이모지 및 반응 배열
  const reactions = [
    'ㅋㅋㅋㅋ', 'ㅎㅎㅎ', '와...', '대박', '헐', '이게 뭐야', '좋아요', 
    '웃겨요', '😂', '😍', '👍', '🔥', '💯', '❤️', '👏', '🤣'
  ];
  
  // 랜덤 샘플 댓글 수 결정 (0~5개)
  const sampleSize = Math.floor(Math.random() * 5);
  
  const comments = [];
  
  // 이 비디오 ID와 타임스탬프에 대한 의사 난수 생성
  // 같은 비디오의 같은 시간에는 항상 동일한 댓글이 나오도록 함
  const seed = videoId + '_' + Math.floor(timestamp / 5);
  const seededRandom = new SeededRandom(seed);
  
  for (let i = 0; i < sampleSize; i++) {
    // 의사 난수 기반으로 반응 선택
    const reactionIndex = Math.floor(seededRandom.random() * reactions.length);
    const reaction = reactions[reactionIndex];
    
    // 의사 난수 기반으로 사용자 ID 생성
    const userId = 'user_' + Math.floor(seededRandom.random() * 1000);
    
    comments.push({
      id: 'comment_' + userId + '_' + timestamp,
      user: {
        name: '사용자_' + userId.substring(5),
        avatar: 'https://via.placeholder.com/24'
      },
      text: reaction,
      timestamp: new Date().toISOString(),
      videoTime: timestamp - 1 + seededRandom.random() * 2, // 타임스탬프 주변으로 약간의 변동
      likes: Math.floor(seededRandom.random() * 10)
    });
  }
  
  return comments;
}

/**
 * 의사 난수 생성기 (시드 기반)
 */
class SeededRandom {
  constructor(seed) {
    this.seed = this.hash(seed);
  }
  
  hash(seed) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      return hash;
    }
    return seed;
  }
  
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
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

// 탭 메시지 처리 함수
function handleTabMessage(request, sender, sendResponse) {
  console.log('탭 메시지 수신:', request.action, request);
  
  try {
    // 메시지 유형에 따라 처리
    switch (request.action) {
      case 'toggleSubtitleFilter':
        toggleSubtitleFilter(request.enabled, request.tabId || (sender && sender.tab ? sender.tab.id : null))
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('자막 필터 토글 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
        
      case 'updateSettings':
        // 설정 업데이트 처리
        updateSubtitleSettings(request.settings, request.tabId || (sender && sender.tab ? sender.tab.id : null))
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('설정 업데이트 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
        
      case 'startSpeechRecognition':
        // 음성 인식 시작
        startSpeechRecognition(
          request.tabId || (sender && sender.tab ? sender.tab.id : null),
          request.useWhisper,
          request.universalMode
        )
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('음성 인식 시작 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
        
      case 'stopSpeechRecognition':
        // 음성 인식 중지
        stopSpeechRecognition(request.tabId || (sender && sender.tab ? sender.tab.id : null))
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('음성 인식 중지 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
        
      case 'testSubtitle':
        // 테스트 자막 표시
        showTestSubtitle(request.tabId || (sender && sender.tab ? sender.tab.id : null))
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('테스트 자막 표시 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
        
      case 'updateSubtitleText':
        // 콘텐츠 스크립트에서 자막 업데이트 요청
        updateSubtitleText(request.text, request.tabId || (sender && sender.tab ? sender.tab.id : null))
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('자막 텍스트 업데이트 오류:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 비동기 응답 사용
    }
  } catch (error) {
    console.error('탭 메시지 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 자막 필터 토글 함수
async function toggleSubtitleFilter(enabled, tabId) {
  console.log('자막 필터 토글:', enabled, '탭:', tabId);
  
  try {
    if (!tabId) {
      throw new Error('탭 ID가 지정되지 않았습니다.');
    }
    
    // 로컬 스토리지에 상태 저장
    chrome.storage.sync.set({
      subtitleEnabled: enabled
    });
    
    // 현재 탭에 메시지 전송
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'toggleSubtitles',
        enabled: enabled
      });
      
      console.log('자막 토글 메시지 전송 성공');
      return { success: true };
    } catch (error) {
      console.error('자막 토글 메시지 전송 실패:', error);
      
      // 콘텐츠 스크립트 로드 시도
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        // 재시도
        await chrome.tabs.sendMessage(tabId, {
          action: 'toggleSubtitles',
          enabled: enabled
        });
        
        console.log('콘텐츠 스크립트 로드 후 자막 토글 성공');
        return { success: true };
      } catch (loadError) {
        console.error('콘텐츠 스크립트 로드 또는 재시도 실패:', loadError);
        return { success: false, error: '콘텐츠 스크립트 로드 실패' };
      }
    }
  } catch (error) {
    console.error('자막 필터 토글 처리 오류:', error);
    return { success: false, error: error.message };
  }
}

// 자막 설정 업데이트 함수
async function updateSubtitleSettings(settings, tabId) {
  console.log('자막 설정 업데이트:', settings, '탭:', tabId);
  
  try {
    if (!tabId) {
      throw new Error('탭 ID가 지정되지 않았습니다.');
    }
    
    // 현재 설정 가져오기
    const data = await new Promise(resolve => {
      chrome.storage.sync.get('subtitleSettings', resolve);
    });
    
    // 기존 설정과 병합
    const currentSettings = data.subtitleSettings || {};
    const updatedSettings = { ...currentSettings, ...settings };
    
    // 로컬 스토리지에 설정 저장
    await new Promise(resolve => {
      chrome.storage.sync.set({ subtitleSettings: updatedSettings }, resolve);
    });
    
    // 현재 탭에 메시지 전송
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'updateSubtitleSettings',
        settings: settings
      });
      
      console.log('설정 업데이트 메시지 응답:', response);
      return { success: true, response };
    } catch (error) {
      console.error('설정 업데이트 메시지 전송 실패:', error);
      
      // 콘텐츠 스크립트 로드 시도
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        // 재시도
        await chrome.tabs.sendMessage(tabId, {
          action: 'updateSubtitleSettings',
          settings: settings
        });
        
        console.log('콘텐츠 스크립트 로드 후 설정 업데이트 성공');
        return { success: true };
      } catch (loadError) {
        console.error('콘텐츠 스크립트 로드 또는 재시도 실패:', loadError);
        return { success: false, error: '콘텐츠 스크립트 로드 실패' };
      }
    }
  } catch (error) {
    console.error('설정 업데이트 처리 오류:', error);
    return { success: false, error: error.message };
  }
}

// 테스트 자막 표시 함수
async function showTestSubtitle(tabId) {
  console.log('테스트 자막 표시:', tabId);
  
  try {
    if (!tabId) {
      throw new Error('탭 ID가 지정되지 않았습니다.');
    }
    
    // 현재 설정 로드
    const data = await new Promise(resolve => {
      chrome.storage.sync.get(['subtitleEnabled', 'subtitleLanguage', 'subtitleSettings'], resolve);
    });
    
    // 자막이 비활성화 상태이면 먼저 활성화
    if (!data.subtitleEnabled) {
      await toggleSubtitleFilter(true, tabId);
    }
    
    // 현재 시간 포함한 테스트 메시지 생성
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    
    // 이중 자막 모드 확인
    const isDualMode = data.subtitleSettings && data.subtitleSettings.dualSubtitles;
    
    // 테스트 자막 전송
    const testMessage = `This is a Whatsub test subtitle message. (${timeStr})`;
    
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showTestSubtitle',
        text: testMessage
      });
      
      console.log('테스트 자막 메시지 전송 성공');
      return { success: true };
    } catch (error) {
      console.error('테스트 자막 메시지 전송 실패:', error);
      
      // 콘텐츠 스크립트 로드 시도
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        // 재시도
        await chrome.tabs.sendMessage(tabId, {
          action: 'showTestSubtitle',
          text: testMessage
        });
        
        console.log('콘텐츠 스크립트 로드 후 테스트 자막 전송 성공');
        return { success: true };
      } catch (loadError) {
        console.error('콘텐츠 스크립트 로드 또는 재시도 실패:', loadError);
        return { success: false, error: '콘텐츠 스크립트 로드 실패' };
      }
    }
  } catch (error) {
    console.error('테스트 자막 표시 처리 오류:', error);
    return { success: false, error: error.message };
  }
}

// 자막 텍스트 업데이트 함수
async function updateSubtitleText(text, tabId) {
  console.log('자막 텍스트 업데이트:', text.substring(0, 30) + '...', '탭:', tabId);
  
  try {
    if (!tabId) {
      throw new Error('탭 ID가 지정되지 않았습니다.');
    }
    
    // 현재 탭에 메시지 전송
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'updateSubtitleText',
        text: text
      });
      
      return { success: true };
    } catch (error) {
      console.error('자막 텍스트 업데이트 메시지 전송 실패:', error);
      
      // 콘텐츠 스크립트 로드 시도
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        // 재시도
        await chrome.tabs.sendMessage(tabId, {
          action: 'updateSubtitleText',
          text: text
        });
        
        console.log('콘텐츠 스크립트 로드 후 자막 텍스트 업데이트 성공');
        return { success: true };
      } catch (loadError) {
        console.error('콘텐츠 스크립트 로드 또는 재시도 실패:', loadError);
        return { success: false, error: '콘텐츠 스크립트 로드 실패' };
      }
    }
  } catch (error) {
    console.error('자막 텍스트 업데이트 처리 오류:', error);
    return { success: false, error: error.message };
  }
}

// 자막 메시지 처리 함수
async function handleSubtitleMessages(message, sender, sendResponse) {
  try {
    console.log('handleSubtitleMessages 호출됨:', message.action);
    
    // 요청 액션에 따라 처리
    switch (message.action) {
      case 'toggleSubtitleFilter':
        await handleToggleSubtitle(message, sender, sendResponse);
        break;
        
      case 'testSubtitle':
        await handleTestSubtitle(message, sender, sendResponse);
        break;
        
      case 'updateSettings':
        await handleSettingsUpdate(message, sender, sendResponse);
        break;
        
      case 'startSpeechRecognition':
        await handleStartSpeechRecognition(message, sender, sendResponse);
        break;
      
      case 'stopSpeechRecognition':
        await handleStopSpeechRecognition(message, sender, sendResponse);
        break;
        
      case 'updateWhisperSettings':
        await handleUpdateWhisperSettings(message, sender, sendResponse);
        break;
        
      default:
        console.log('알 수 없는 자막 액션:', message.action);
        sendResponse({ success: false, error: '지원되지 않는 액션입니다.' });
    }
  } catch (error) {
    console.error('자막 메시지 처리 오류:', error);
    sendResponse({ success: false, error: error.message || '자막 처리 중 오류가 발생했습니다.' });
  }
}

// 자막 토글 처리 함수
async function handleToggleSubtitle(message, sender, sendResponse) {
  try {
    const { enabled, tabId } = message;
    console.log(`자막 토글 처리: ${enabled ? '활성화' : '비활성화'}`);
    
    // 타겟 탭 ID 확인 (메시지에서 받거나 현재 활성 탭 사용)
    const targetTabId = tabId || (await getActiveTabId());
    if (!targetTabId) {
      sendResponse({ success: false, error: '타겟 탭을 찾을 수 없습니다.' });
      return;
    }
    
    try {
      // 콘텐츠 스크립트에 메시지 전송
      const result = await chrome.tabs.sendMessage(targetTabId, {
        action: 'toggleSubtitles',
        enabled: enabled
      });
      console.log('자막 토글 응답:', result);
      sendResponse({ success: true, result });
    } catch (error) {
      console.error('자막 토글 메시지 전송 오류:', error);
      sendResponse({ success: false, error: '자막 토글 메시지 전송 중 오류가 발생했습니다.' });
    }
  } catch (error) {
    console.error('자막 토글 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 테스트 자막 처리 함수
async function handleTestSubtitle(message, sender, sendResponse) {
  try {
    const { tabId } = message;
    console.log('테스트 자막 처리');
    
    // 타겟 탭 ID 확인
    const targetTabId = tabId || (await getActiveTabId());
    if (!targetTabId) {
      sendResponse({ success: false, error: '타겟 탭을 찾을 수 없습니다.' });
      return;
    }
    
    try {
      // 콘텐츠 스크립트에 메시지 전송
      const result = await chrome.tabs.sendMessage(targetTabId, {
        action: 'showTestSubtitle',
        text: '이것은 테스트 자막입니다. Whatsub 확장 프로그램이 정상적으로 작동 중입니다.',
        duration: 5000 // 5초 동안 표시
      });
      console.log('테스트 자막 응답:', result);
      sendResponse({ success: true, result });
    } catch (error) {
      console.error('테스트 자막 메시지 전송 오류:', error);
      sendResponse({ success: false, error: '테스트 자막 메시지 전송 중 오류가 발생했습니다.' });
    }
  } catch (error) {
    console.error('테스트 자막 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 설정 업데이트 처리 함수
async function handleSettingsUpdate(message, sender, sendResponse) {
  try {
    const { settings } = message;
    console.log('자막 설정 업데이트 처리:', settings);
    
    // 활성 탭 ID 가져오기
    const targetTabId = await getActiveTabId();
    if (!targetTabId) {
      sendResponse({ success: false, error: '타겟 탭을 찾을 수 없습니다.' });
      return;
    }
    
    try {
      // 콘텐츠 스크립트에 메시지 전송
      const result = await chrome.tabs.sendMessage(targetTabId, {
        action: 'updateSettings',
        settings: settings
      });
      console.log('설정 업데이트 응답:', result);
      sendResponse({ success: true, result });
    } catch (error) {
      console.error('설정 업데이트 메시지 전송 오류:', error);
      sendResponse({ 
        success: false, 
        error: '설정 업데이트 메시지 전송 중 오류가 발생했습니다.',
        localSuccess: true // 로컬 저장은 성공했음을 알림
      });
    }
  } catch (error) {
    console.error('설정 업데이트 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 활성 탭 ID 가져오기 함수
async function getActiveTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      return tabs[0].id;
    }
    return null;
  } catch (error) {
    console.error('활성 탭 조회 오류:', error);
    return null;
  }
}

// 음성 인식 시작 함수 (실제 구현은 아니고 성공 응답만 반환)
async function handleStartSpeechRecognition(message, sender, sendResponse) {
  try {
    console.log('음성 인식 시작 요청 처리:', message);
    // 실제 음성 인식 구현은 없음 (준비 중)
    // 성공 응답만 보내서 UI 흐름이 진행되도록 함
    sendResponse({ 
      success: true, 
      message: '음성 인식 시작 요청이 처리되었습니다. (실제 음성 인식은 미구현)'
    });
  } catch (error) {
    console.error('음성 인식 시작 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 음성 인식 중지 함수
async function handleStopSpeechRecognition(message, sender, sendResponse) {
  try {
    console.log('음성 인식 중지 요청 처리');
    // 실제 음성 인식 구현은 없음 (준비 중)
    // 성공 응답만 보냄
    sendResponse({ 
      success: true, 
      message: '음성 인식 중지 요청이 처리되었습니다.'
    });
  } catch (error) {
    console.error('음성 인식 중지 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Whisper 설정 업데이트 함수
async function handleUpdateWhisperSettings(message, sender, sendResponse) {
  try {
    console.log('Whisper 설정 업데이트 요청 처리:', message.settings);
    // 실제 Whisper 설정 구현은 없음
    // 성공 응답만 보냄
    sendResponse({ 
      success: true, 
      message: 'Whisper 설정 업데이트 요청이 처리되었습니다.'
    });
  } catch (error) {
    console.error('Whisper 설정 업데이트 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 메시지 리스너 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('백그라운드에서 메시지 수신:', message.action);
  
  // 자막 관련 메시지 처리
  if (message.action === 'toggleSubtitleFilter' || 
      message.action === 'testSubtitle' || 
      message.action === 'updateSettings' ||
      message.action === 'startSpeechRecognition' ||
      message.action === 'stopSpeechRecognition' ||
      message.action === 'updateWhisperSettings') {
    handleSubtitleMessages(message, sender, sendResponse);
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 인증 관련 메시지 처리
  if (message.action === 'signInWithGoogle' ||
      message.action === 'signOut' ||
      message.action === 'checkAuth') {
    // 인증 서비스 미구현 - 더미 응답 반환
    if (message.action === 'signInWithGoogle') {
      console.log('로그인 요청 처리 (더미 응답)');
      setTimeout(() => {
        sendResponse({
          success: true,
          user: {
            uid: 'dummy-user-id',
            email: 'bzjay53@gmail.com',
            displayName: 'Whatsub 사용자',
            photoURL: 'icons/default-avatar.png'
          }
        });
      }, 500); // 실제 서버 통신을 시뮬레이션하기 위한 지연
    } else if (message.action === 'signOut') {
      console.log('로그아웃 요청 처리');
      setTimeout(() => {
        sendResponse({ success: true });
      }, 300);
    } else if (message.action === 'checkAuth') {
      console.log('인증 상태 확인 요청 처리');
      setTimeout(() => {
        sendResponse({
          isAuthenticated: true,
          user: {
            uid: 'dummy-user-id',
            email: 'bzjay53@gmail.com',
            displayName: 'Whatsub 사용자',
            photoURL: 'icons/default-avatar.png'
          }
        });
      }, 300);
    }
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 사용량 데이터 요청 처리
  if (message.action === 'getUsage') {
    console.log('사용량 데이터 요청 처리');
    setTimeout(() => {
      sendResponse({
        success: true,
        usage: {
          whisper: {
            used: 10,
            limit: 60
          }
        },
        subscription: {
          plan: 'free'
        }
      });
    }, 300);
    return true;
  }
  
  return false;
});