/**
 * WhatsUb 자막 콘텐츠 스크립트
 * 웹 페이지와 확장 프로그램 간의 통신을 담당합니다.
 */

(function() {
  // 설정
  const DEBUG = false;
  
  // 상태 변수
  let isInitialized = false;
  let isSubtitleActive = false;
  let subtitleSettings = {
    language: 'ko',
    style: {
      fontSize: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white'
    }
  };
  
  // 비디오 정보 추적
  let currentVideoInfo = null;
  let speechRecognitionActive = false;
  
  // 초기화 함수
  function initialize() {
    if (isInitialized) return;
    isInitialized = true;
    
    // 인젝션 스크립트 주입
    injectSubtitleScript();
    
    // 메시지 리스너 설정
    setupMessageListeners();
    
    // 비디오 확인 간격 설정
    setInterval(checkForVideos, 5000);
    
    // 초기화 완료 메시지
    logDebug('WhatsUb 자막 콘텐츠 스크립트 초기화 완료');
    
    // 배경 스크립트에 초기화 완료 알림
    sendMessageToBackground({
      action: 'contentScriptInitialized',
      url: window.location.href
    });
  }
  
  // 자막 스크립트 주입
  function injectSubtitleScript() {
    try {
      // 이미 주입된 스크립트가 있는지 확인
      if (document.querySelector('script[data-whatsub-injected="true"]')) {
        logDebug('인젝션 스크립트가 이미 주입되어 있습니다.');
        return;
      }
      
      // 스크립트 요소 생성
      const script = document.createElement('script');
      script.setAttribute('data-whatsub-injected', 'true');
      
      // 인젝션 스크립트 로드
      script.src = chrome.runtime.getURL('inject-subtitle.js');
      script.onload = function() {
        logDebug('인젝션 스크립트 로드 완료');
        this.remove(); // 로드 후 스크립트 태그 제거
      };
      
      // 문서에 스크립트 추가
      (document.head || document.documentElement).appendChild(script);
      logDebug('인젝션 스크립트 주입 완료');
    } catch (error) {
      console.error('[WhatsUb 콘텐츠 스크립트] 스크립트 주입 오류:', error);
    }
  }
  
  // 페이지 내 비디오 요소 확인
  function checkForVideos() {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0 && !document.querySelector('script[data-whatsub-injected="true"]')) {
      logDebug(`${videos.length}개의 비디오 요소 발견, 인젝션 스크립트 재주입`);
      injectSubtitleScript();
    }
  }
  
  // 메시지 리스너 설정
  function setupMessageListeners() {
    // 웹 페이지로부터의 메시지 수신 (인젝션 스크립트)
    window.addEventListener('message', function(event) {
      // 같은 출처 확인
      if (event.source !== window) return;
      
      // 인젝션 스크립트의 메시지인지 확인
      if (event.data && event.data.from === 'whatsub_injection') {
        handleInjectionMessage(event.data);
      }
    });
    
    // 확장 프로그램 배경 스크립트로부터의 메시지 수신
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message && message.from === 'whatsub_background') {
        handleBackgroundMessage(message, sendResponse);
        // 비동기 응답 지원
        return true;
      }
    });
  }
  
  // 인젝션 스크립트로부터의 메시지 처리
  function handleInjectionMessage(message) {
    logDebug('인젝션 스크립트로부터 메시지 수신:', message);
    
    switch (message.action) {
      case 'videoEvent':
        // 비디오 이벤트 처리 (재생/일시정지)
        currentVideoInfo = message.videoInfo;
        sendMessageToBackground({
          action: 'videoEvent',
          eventType: message.eventType,
          videoInfo: message.videoInfo
        });
        break;
        
      case 'videoTimeUpdate':
        // 비디오 시간 업데이트 처리
        currentVideoInfo = message.videoInfo;
        // 필요한 경우 배경 스크립트에 전달
        if (speechRecognitionActive) {
          sendMessageToBackground({
            action: 'videoTimeUpdate',
            videoInfo: message.videoInfo
          });
        }
        break;
        
      case 'videoInfo':
        // 비디오 정보 처리
        currentVideoInfo = message.videoInfo;
        sendMessageToBackground({
          action: 'videoInfo',
          videoInfo: message.videoInfo
        });
        break;
    }
  }
  
  // 배경 스크립트로부터의 메시지 처리
  function handleBackgroundMessage(message, sendResponse) {
    logDebug('배경 스크립트로부터 메시지 수신:', message);
    
    switch (message.action) {
      case 'showSubtitle':
        // 자막 표시 요청
        sendMessageToInjection({
          action: 'showSubtitle',
          text: message.text,
          duration: message.duration || 5000
        });
        
        sendResponse({ success: true });
        break;
        
      case 'hideSubtitle':
        // 자막 숨김 요청
        sendMessageToInjection({
          action: 'hideSubtitle'
        });
        
        sendResponse({ success: true });
        break;
        
      case 'toggleSubtitle':
        // 자막 토글 요청
        isSubtitleActive = message.visible !== undefined ? message.visible : !isSubtitleActive;
        
        sendMessageToInjection({
          action: 'toggleSubtitle',
          visible: isSubtitleActive
        });
        
        sendResponse({ success: true, active: isSubtitleActive });
        break;
        
      case 'updateSettings':
        // 설정 업데이트 요청
        if (message.settings) {
          subtitleSettings = { ...subtitleSettings, ...message.settings };
          
          sendMessageToInjection({
            action: 'updateSettings',
            settings: subtitleSettings
          });
        }
        
        sendResponse({ success: true, settings: subtitleSettings });
        break;
        
      case 'getVideoInfo':
        // 비디오 정보 요청
        sendMessageToInjection({
          action: 'getVideoInfo'
        });
        
        // 현재 가진 정보로 즉시 응답
        sendResponse({ 
          success: true, 
          videoInfo: currentVideoInfo,
          hasVideo: !!document.querySelector('video')
        });
        break;
        
      case 'startSpeechRecognition':
        // 음성 인식 시작 요청
        speechRecognitionActive = true;
        sendResponse({ success: true });
        break;
        
      case 'stopSpeechRecognition':
        // 음성 인식 중지 요청
        speechRecognitionActive = false;
        sendResponse({ success: true });
        break;
    }
  }
  
  // 배경 스크립트로 메시지 전송
  function sendMessageToBackground(message) {
    message.from = 'whatsub_content';
    message.url = window.location.href;
    
    chrome.runtime.sendMessage(message)
      .catch(error => {
        // 연결 오류 처리 (배경 스크립트가 비활성화된 경우 등)
        if (!chrome.runtime.lastError) {
          console.error('[WhatsUb] 배경 스크립트 메시지 전송 오류:', error);
        }
      });
  }
  
  // 인젝션 스크립트로 메시지 전송
  function sendMessageToInjection(message) {
    message.from = 'whatsub_content';
    window.postMessage(message, '*');
  }
  
  // 디버그 로그
  function logDebug(...args) {
    if (DEBUG) {
      console.log('[WhatsUb 콘텐츠]', ...args);
    }
  }
  
  // 현재 페이지가 자막 처리가 필요한지 확인
  function shouldProcessPage() {
    const url = window.location.href;
    
    // 유튜브 동영상 페이지 확인
    if (url.includes('youtube.com/watch')) {
      return true;
    }
    
    // 비메오 동영상 페이지 확인
    if (url.includes('vimeo.com') && !url.includes('/manage') && !url.includes('/settings')) {
      return true;
    }
    
    // 넷플릭스 동영상 페이지 확인
    if (url.includes('netflix.com/watch')) {
      return true;
    }
    
    // 다음/카카오 TV 확인
    if (url.includes('tv.kakao.com/channel') || url.includes('tv.kakao.com/v/')) {
      return true;
    }
    
    // 네이버 TV 확인
    if (url.includes('tv.naver.com/v/')) {
      return true;
    }
    
    // 기타 일반 웹페이지는 비디오 태그의 존재 여부로 판단
    return document.querySelector('video') !== null;
  }
  
  // 페이지가 처리 가능한 경우에만 초기화
  if (shouldProcessPage()) {
    // DOM이 완전히 로드된 후 초기화
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  } else {
    logDebug('현재 페이지는 자막 처리 대상이 아닙니다:', window.location.href);
  }
})(); 