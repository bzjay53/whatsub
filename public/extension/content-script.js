/**
 * WhatSub - 콘텐츠 스크립트
 * 웹페이지에 자막 UI와 기능을 주입하는 스크립트입니다.
 * 버전: 0.2.2
 */

// 전역 변수 선언
let subtitleContainer = null;
let subtitleText = null;
let controlsContainer = null;
let languageSelector = null;
let commentsContainer = null;
let modalOverlay = null;
let shareModal = null;
let interactionButtonsContainer = null; // 좋아요, 싫어요, 추천 버튼을 담을 컨테이너

let draggableSubtitle = false;
let subtitlePosition = { x: 0, y: 0 };
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let videoElement = null;
let controlsTimeout = null;
let inactiveTimeout = null; // 마우스 비활성 타이머
let isMouseActive = true; // 마우스 활성 상태
let lastMouseMoveTime = Date.now(); // 마지막 마우스 움직임 시간
let isTranscriptionActive = false; // 현재 음성-텍스트 변환 상태
let settings = {
  enabled: true,
  language: 'ko',
  translationEnabled: false,
  translationLanguage: 'ko',
  fontSize: 'medium',
  backgroundColor: 'rgba(0,0,0,0.7)',
  textColor: 'white',
  outlineEnabled: false,
  position: 'bottom',
  commentEnabled: true
};

// force-subtitle.js 감지 (충돌 방지)
let isForceSubtitleLoaded = false;
// inject-subtitle.js 통신 변수
let injectSubtitleAvailable = false;

// 페이지 로드 시 inject-subtitle.js와 통신 테스트
function testInjectScriptAvailability() {
  console.log('[WhatSub] 인젝션 스크립트 가용성 테스트 시작');
  
  // 페이지에 메시지 전송
  window.postMessage({
    from: 'whatsub_content',
    action: 'ping',
    timestamp: Date.now()
  }, '*');
  
  // 1초 후 다시 시도
  setTimeout(() => {
    if (!injectSubtitleAvailable) {
      console.log('[WhatSub] 인젝션 스크립트 응답 없음, 재시도');
      
      // 페이지에 메시지 다시 전송
      window.postMessage({
        from: 'whatsub_content',
        action: 'ping',
        timestamp: Date.now()
      }, '*');
    }
  }, 1000);
}

// 메시지 리스너 설정 
window.addEventListener('message', function(event) {
  // 같은 출처 확인
  if (event.source !== window) return;
  
  // 인젝션 스크립트로부터 메시지 수신
  if (event.data && event.data.from === 'whatsub_injection') {
    console.log('[WhatSub] 인젝션 스크립트로부터 메시지 수신:', event.data.action);
    
    // 인젝션 스크립트 가용성 설정
    if (!injectSubtitleAvailable) {
      console.log('[WhatSub] 인젝션 스크립트 연결 확인됨');
      injectSubtitleAvailable = true;
    }
    
    // 인젝션 스크립트로부터의 메시지 처리
    switch (event.data.action) {
      case 'pong':
        console.log('[WhatSub] 인젝션 스크립트 응답 성공:', event.data.timestamp);
        injectSubtitleAvailable = true;
        break;
        
      case 'videoEvent':
        // 비디오 요소 이벤트 처리
        handleVideoEvent(event.data);
        break;
        
      // 기타 메시지 처리...
    }
  }
});

// 메시지 리스너 설정 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[WhatSub] 배경 스크립트로부터 메시지 수신:', request.action);
  
  switch (request.action) {
    case 'updateSubtitle':
      // 자막 텍스트 업데이트
      if (injectSubtitleAvailable) {
        // inject-subtitle.js로 메시지 전달
        window.postMessage({
          from: 'whatsub_content',
          action: 'showSubtitle',
          text: request.text,
          duration: request.duration || 5000
        }, '*');
        sendResponse({ success: true, via: 'injection' });
      } else if (window.whatsub && window.whatsub.updateSubtitleText) {
        // force-subtitle.js의 함수 사용
        window.whatsub.updateSubtitleText(request.text);
        sendResponse({ success: true, via: 'force' });
      } else {
        // 기존 방식 사용
        updateSubtitleText(request.text);
        sendResponse({ success: true, via: 'content' });
      }
      break;
      
    case 'toggleCaptions':
    case 'toggleSubtitles':
      if (injectSubtitleAvailable) {
        // inject-subtitle.js로 메시지 전달
        window.postMessage({
          from: 'whatsub_content',
          action: 'toggleSubtitle',
          visible: request.enabled
        }, '*');
        sendResponse({ success: true, via: 'injection' });
      } else if (window.whatsub) {
        // force-subtitle.js가 로드된 경우
        sendResponse({ success: true, note: "force-subtitle.js에서 처리됨", via: 'force' });
      } else {
        // 기존 방식 사용
        toggleSubtitles(request.enabled);
        sendResponse({ success: true, via: 'content' });
      }
      break;
      
    // 나머지 메시지 처리...
    default:
      // 다른 메시지는 기존 로직으로 처리
      sendResponse({ success: false, error: "지원되지 않는 액션" });
  }
  return true;  // 비동기 응답을 위해 true 반환
});

// 초기화 함수
function initialize() {
  console.log('[WhatSub] 콘텐츠 스크립트 초기화 시작');
  
  try {
    // 테스트 메시지 표시
    showTestMessage('WhatsUb 테스트 중 - 버전 0.2.2');
    
    // inject-subtitle.js 통신 테스트
    testInjectScriptAvailability();
    
    // force-subtitle.js가 로드되었는지 확인
    if (window.whatsub) {
      console.log('[WhatSub] force-subtitle.js가 이미 로드됨, 중복 초기화 방지');
      isForceSubtitleLoaded = true;
      return;
    }
    
    // DOM이 완전히 로드되었는지 확인
    if (document.readyState === 'loading') {
      console.log('[WhatSub] DOM 로딩 중... 이벤트 리스너 등록');
      document.addEventListener('DOMContentLoaded', initializeAfterDOMLoaded);
      return;
    } else {
      console.log('[WhatSub] DOM 이미 로드됨, 바로 초기화 진행');
      initializeAfterDOMLoaded();
    }
  } catch (error) {
    console.error('[WhatSub] 초기화 중 오류 발생:', error);
    
    // 오류 발생 시 화면에 표시할 디버그 메시지
    showDebugMessage('WhatSub 초기화 중 오류: ' + error.message);
  }
}

// DOM이 로드된 후 초기화 작업 수행
function initializeAfterDOMLoaded() {
  console.log('[WhatSub] DOM 로드 후 초기화 시작');
  
  try {
    // force-subtitle.js가 로드되었는지 다시 확인
    if (window.whatsub || isForceSubtitleLoaded) {
      console.log('[WhatSub] force-subtitle.js가 활성화됨, 기존 초기화 스킵');
      return;
    }
    
    // 설정 로드
    loadSettings();
    
    // UI 요소 생성
    createUI();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 컨트롤러 표시 (항상 표시)
    showControls();
    showUIElements();
    
    // 자막 서비스 시작
    startTranscriptionService();
    
    // 자막 활성화 (무조건 초기화 시 활성화)
    setTimeout(() => {
      console.log('[WhatSub] 자막 활성화 및 UI 표시');
      toggleSubtitles(true);
      
      // 비디오/오디오 없는 경우 음성 인식 자동 시작
      if (!videoElement) {
        console.log('[WhatSub] 비디오 요소 없음, 음성 인식 시작');
        startSpeechRecognition();
      }
      
      // 디버그 메시지 표시
      showDebugMessage('WhatSub 자막 시스템이 활성화되었습니다!');
    }, 1000);
    
    // YouTube 페이지 확인 (YouTube일 경우 전용 프로세서 주입)
    injectYouTubeProcessor();
    
    console.log('[WhatSub] 초기화 완료');
  } catch (error) {
    console.error('[WhatSub] 초기화 작업 중 오류 발생:', error);
    
    // 오류 발생 시 화면에 표시할 디버그 메시지
    showDebugMessage('WhatSub 초기화 작업 중 오류: ' + error.message);
  }
}

// 디버그 메시지 표시 함수
function showDebugMessage(message) {
  try {
    // 이미 디버그 메시지 컨테이너가 있는지 확인
    let debugContainer = document.getElementById('whatsub-debug-container');
    
    if (!debugContainer) {
      // 디버그 메시지 컨테이너 생성
      debugContainer = document.createElement('div');
      debugContainer.id = 'whatsub-debug-container';
      debugContainer.style.position = 'fixed';
      debugContainer.style.top = '10px';
      debugContainer.style.right = '10px';
      debugContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      debugContainer.style.color = 'white';
      debugContainer.style.padding = '10px';
      debugContainer.style.borderRadius = '5px';
      debugContainer.style.fontSize = '14px';
      debugContainer.style.zIndex = '2147483647';
      debugContainer.style.maxWidth = '300px';
      
      document.body.appendChild(debugContainer);
    }
    
    // 로그 메시지 추가
    const logMessage = document.createElement('div');
    logMessage.textContent = new Date().toLocaleTimeString() + ': ' + message;
    logMessage.style.marginBottom = '5px';
    
    debugContainer.appendChild(logMessage);
    
    // 5초 후 메시지 제거
    setTimeout(() => {
      if (logMessage.parentNode === debugContainer) {
        debugContainer.removeChild(logMessage);
      }
      
      // 메시지가 없으면 컨테이너도 제거
      if (debugContainer.children.length === 0) {
        document.body.removeChild(debugContainer);
      }
    }, 5000);
  } catch (error) {
    console.error('[WhatSub] 디버그 메시지 표시 중 오류:', error);
  }
}

// 설정 로드
function loadSettings() {
  chrome.storage.local.get(['subtitleSettings'], (result) => {
    if (result.subtitleSettings) {
      settings = { ...settings, ...result.subtitleSettings };
      console.log('[WhatSub] 설정 로드됨:', settings);
    }
  });
}

// UI 요소 생성
function createUI() {
  console.log('[WhatSub] UI 요소 생성 시작');
  
  try {
    // body가 있는지 확인
    if (!document.body) {
      console.error('[WhatSub] document.body가 없음, UI 생성 불가');
      return;
    }
    
    // 자막 컨테이너 생성
    if (!subtitleContainer) {
      console.log('[WhatSub] 자막 컨테이너 생성');
      subtitleContainer = document.createElement('div');
      subtitleContainer.className = 'whatsub-container';
      subtitleContainer.style.display = 'none';
      
      subtitleText = document.createElement('p');
      subtitleText.className = 'whatsub-text';
      subtitleText.textContent = '자막이 준비되었습니다. 곧 표시됩니다...'; // 기본 텍스트 추가
      subtitleContainer.appendChild(subtitleText);
      
      // 인라인 스타일 추가 (CSS가 로드되지 않은 경우를 대비)
      subtitleContainer.style.position = 'fixed';
      subtitleContainer.style.bottom = '100px';
      subtitleContainer.style.left = '50%';
      subtitleContainer.style.transform = 'translateX(-50%)';
      subtitleContainer.style.zIndex = '2147483647';
      subtitleContainer.style.textAlign = 'center';
      subtitleContainer.style.padding = '12px 24px';
      subtitleContainer.style.borderRadius = '8px';
      subtitleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      subtitleContainer.style.color = 'white';
      subtitleContainer.style.fontFamily = 'Arial, sans-serif';
      subtitleContainer.style.fontSize = '22px';
      subtitleContainer.style.fontWeight = '600';
      subtitleContainer.style.lineHeight = '1.5';
      subtitleContainer.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.4)';
      subtitleContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      subtitleContainer.style.minWidth = '300px';
      subtitleContainer.style.minHeight = '50px';
      
      document.body.appendChild(subtitleContainer);
      console.log('[WhatSub] 자막 컨테이너가 DOM에 추가됨');
    }
    
    // 상호작용 버튼 컨테이너 (좋아요, 싫어요, 추천)
    if (!interactionButtonsContainer) {
      interactionButtonsContainer = document.createElement('div');
      interactionButtonsContainer.className = 'whatsub-interaction-buttons';
      
      // 좋아요 버튼
      const likeButton = document.createElement('button');
      likeButton.className = 'whatsub-interaction-button like-button';
      likeButton.innerHTML = '👍';
      likeButton.title = '좋아요';
      likeButton.addEventListener('click', () => {
        likeSubtitle();
        likeButton.classList.toggle('active');
        dislikeButton.classList.remove('active');
      });
      
      // 싫어요 버튼
      const dislikeButton = document.createElement('button');
      dislikeButton.className = 'whatsub-interaction-button dislike-button';
      dislikeButton.innerHTML = '👎';
      dislikeButton.title = '싫어요';
      dislikeButton.addEventListener('click', () => {
        dislikeSubtitle();
        dislikeButton.classList.toggle('active');
        likeButton.classList.remove('active');
      });
      
      // 추천 버튼
      const recommendButton = document.createElement('button');
      recommendButton.className = 'whatsub-interaction-button recommend-button';
      recommendButton.innerHTML = '⭐';
      recommendButton.title = '추천';
      recommendButton.addEventListener('click', () => {
        recommendSubtitle();
        recommendButton.classList.toggle('active');
      });
      
      interactionButtonsContainer.appendChild(likeButton);
      interactionButtonsContainer.appendChild(dislikeButton);
      interactionButtonsContainer.appendChild(recommendButton);
      
      document.body.appendChild(interactionButtonsContainer);
    }
    
    // 컨트롤 패널 생성
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'whatsub-controls'; // 'hidden' 클래스 제거하여 바로 표시
      
      // 위치 조정 버튼
      const positionButton = document.createElement('button');
      positionButton.className = 'whatsub-control-button position-button';
      positionButton.innerHTML = '⇅';
      positionButton.title = '자막 위치 변경';
      positionButton.addEventListener('click', toggleSubtitlePosition);
      
      // 언어 선택 버튼
      const languageButton = document.createElement('button');
      languageButton.className = 'whatsub-control-button language-button';
      languageButton.innerHTML = '🌐';
      languageButton.title = '언어 선택';
      languageButton.addEventListener('click', toggleLanguageSelector);
      
      // 자막 토글 버튼
      const toggleButton = document.createElement('button');
      toggleButton.className = 'whatsub-control-button toggle-button';
      toggleButton.innerHTML = '✓';
      toggleButton.title = '자막 켜기/끄기';
      toggleButton.addEventListener('click', () => toggleSubtitles(!settings.enabled));
      
      // 자막 크기 버튼
      const sizeButton = document.createElement('button');
      sizeButton.className = 'whatsub-control-button size-button';
      sizeButton.innerHTML = 'Aa';
      sizeButton.title = '자막 크기 변경';
      sizeButton.addEventListener('click', cycleFontSize);
      
      // 드래그 모드 버튼
      const dragButton = document.createElement('button');
      dragButton.className = 'whatsub-control-button drag-button';
      dragButton.innerHTML = '✥';
      dragButton.title = '자막 위치 이동';
      dragButton.addEventListener('click', toggleDraggableMode);
      
      // 댓글 토글 버튼
      const commentButton = document.createElement('button');
      commentButton.className = 'whatsub-control-button comment-button';
      commentButton.innerHTML = '💬';
      commentButton.title = '댓글 켜기/끄기';
      commentButton.addEventListener('click', toggleComments);
      
      // 공유 버튼
      const shareButton = document.createElement('button');
      shareButton.className = 'whatsub-control-button share-button';
      shareButton.innerHTML = '⤴';
      shareButton.title = '자막 공유';
      shareButton.addEventListener('click', showShareModal);
      
      // 음성 인식 버튼 추가
      const speechButton = document.createElement('button');
      speechButton.className = 'whatsub-control-button speech-button';
      speechButton.innerHTML = '🎤';
      speechButton.title = '음성 인식 시작/중지';
      speechButton.addEventListener('click', toggleSpeechRecognition);
      
      // 버튼들을 컨트롤 패널에 추가
      controlsContainer.appendChild(positionButton);
      controlsContainer.appendChild(languageButton);
      controlsContainer.appendChild(toggleButton);
      controlsContainer.appendChild(sizeButton);
      controlsContainer.appendChild(dragButton);
      controlsContainer.appendChild(commentButton);
      controlsContainer.appendChild(shareButton);
      controlsContainer.appendChild(speechButton);
      
      document.body.appendChild(controlsContainer);
    }
    
    // 언어 선택기 생성
    if (!languageSelector) {
      languageSelector = document.createElement('div');
      languageSelector.className = 'whatsub-language-selector hidden';
      document.body.appendChild(languageSelector);
    }
    
    // 댓글 컨테이너 생성
    if (!commentsContainer) {
      commentsContainer = document.createElement('div');
      commentsContainer.className = 'whatsub-comments-container';
      document.body.appendChild(commentsContainer);
    }
    
    // 모달 오버레이 생성
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.className = 'whatsub-modal-overlay hidden';
      modalOverlay.addEventListener('click', hideModals);
      document.body.appendChild(modalOverlay);
    }
    
    // 공유 모달 생성
    if (!shareModal) {
      shareModal = document.createElement('div');
      shareModal.className = 'whatsub-share-modal hidden';
      
      const modalHeader = document.createElement('div');
      modalHeader.className = 'whatsub-share-modal-header';
      
      const modalTitle = document.createElement('div');
      modalTitle.className = 'whatsub-share-modal-title';
      modalTitle.textContent = '자막 공유';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'whatsub-share-modal-close';
      closeButton.innerHTML = '×';
      closeButton.addEventListener('click', hideModals);
      
      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeButton);
      
      const modalBody = document.createElement('div');
      modalBody.className = 'whatsub-share-modal-body';
      
      const commentInput = document.createElement('input');
      commentInput.className = 'whatsub-share-input';
      commentInput.type = 'text';
      commentInput.placeholder = '댓글을 입력하세요 (선택사항)';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'whatsub-share-buttons';
      
      const cancelButton = document.createElement('button');
      cancelButton.className = 'whatsub-share-button secondary';
      cancelButton.textContent = '취소';
      cancelButton.addEventListener('click', hideModals);
      
      const shareButton = document.createElement('button');
      shareButton.className = 'whatsub-share-button primary';
      shareButton.textContent = '공유하기';
      shareButton.addEventListener('click', () => shareSubtitles(commentInput.value));
      
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(shareButton);
      
      modalBody.appendChild(commentInput);
      modalBody.appendChild(buttonContainer);
      
      shareModal.appendChild(modalHeader);
      shareModal.appendChild(modalBody);
      
      document.body.appendChild(shareModal);
    }
    
    // 설정에 따라 UI 업데이트
    applySettings();
  } catch (error) {
    console.error('[WhatSub] UI 요소 생성 중 오류:', error);
    showDebugMessage('UI 요소 생성 중 오류: ' + error.message);
  }
}

// 설정 적용
function applySettings() {
  console.log('[WhatSub] 설정 적용 시작');
  
  try {
    if (subtitleContainer) {
      // 글꼴 크기 설정
      if (settings.fontSize === 'small') {
        subtitleContainer.classList.add('small-text');
        subtitleContainer.classList.remove('large-text');
      } else if (settings.fontSize === 'large') {
        subtitleContainer.classList.add('large-text');
        subtitleContainer.classList.remove('small-text');
      } else {
        subtitleContainer.classList.remove('small-text', 'large-text');
      }
      
      // 아웃라인 설정
      if (settings.outlineEnabled) {
        subtitleContainer.classList.add('outline-white');
      } else {
        subtitleContainer.classList.remove('outline-white');
      }
      
      // 위치 설정
      if (settings.position === 'top') {
        subtitleContainer.style.bottom = 'auto';
        subtitleContainer.style.top = '80px';
      } else {
        subtitleContainer.style.top = 'auto';
        subtitleContainer.style.bottom = '80px';
      }
      
      // 배경색 및 텍스트 색상 설정
      subtitleContainer.style.backgroundColor = settings.backgroundColor;
      subtitleContainer.style.color = settings.textColor;
      
      // 드래그 가능 모드 설정
      if (draggableSubtitle) {
        subtitleContainer.classList.add('draggable');
      } else {
        subtitleContainer.classList.remove('draggable');
      }
      
      // 항상 자막 컨테이너가 보이도록 강제 설정
      if (settings.enabled) {
        subtitleContainer.style.display = 'block';
        console.log('[WhatSub] 자막 컨테이너 표시 설정됨');
      } else {
        subtitleContainer.style.display = 'none';
      }
    } else {
      console.warn('[WhatSub] 자막 컨테이너가 없어 설정을 적용할 수 없음');
    }
  } catch (error) {
    console.error('[WhatSub] 설정 적용 중 오류:', error);
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 키보드 단축키 리스너
  document.addEventListener('keydown', (e) => {
    // Alt+S: 자막 토글
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      toggleSubtitles(!settings.enabled);
    }
    
    // Alt+P: 자막 위치 변경
    if (e.altKey && e.key === 'p') {
      e.preventDefault();
      toggleSubtitlePosition();
    }
    
    // Esc: 모달 닫기
    if (e.key === 'Escape') {
      hideModals();
    }
  });
  
  // 자막 컨테이너 드래그 이벤트 리스너
  if (subtitleContainer) {
    subtitleContainer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // 터치 이벤트 지원
    subtitleContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      startDrag({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        drag({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });
    
    document.addEventListener('touchend', endDrag);
  }
  
  // 비디오 감지 이벤트
  document.addEventListener('play', detectVideoElement, true);
  
  // 마우스 이동 시 컨트롤 표시
  document.addEventListener('mousemove', showControls);
  
  // 마우스 움직임 감지 (UI 표시/숨김)
  document.addEventListener('mousemove', handleMouseMove);
  
  // 마우스 클릭 감지 (활동으로 간주)
  document.addEventListener('click', handleUserActivity);
  
  // 키보드 활동 감지
  document.addEventListener('keydown', handleUserActivity);
  
  // 스크롤 감지
  document.addEventListener('scroll', handleUserActivity);
  
  // 페이지 가시성 변경 감지
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// 비디오 요소 감지
function detectVideoElement(e) {
  if (e.target.tagName === 'VIDEO' && e.target.duration > 0) {
    videoElement = e.target;
    console.log('[WhatSub] 비디오 요소 감지됨:', videoElement);
    
    // 비디오가 감지되면 컨트롤 표시
    showControls();
  }
}

// 컨트롤 표시
function showControls() {
  if (!controlsContainer) return;
  
  // 단순히 사용자 활동 처리 함수 호출
  handleUserActivity();
}

// 언어 선택기 토글
function toggleLanguageSelector() {
  if (!languageSelector) return;
  
  const isHidden = languageSelector.classList.contains('hidden');
  
  if (isHidden) {
    // 언어 선택기 표시
    languageSelector.classList.remove('hidden');
    
    // 언어 목록 가져오기
    chrome.runtime.sendMessage({ action: 'getAvailableLanguages' }, (response) => {
      if (response && response.success) {
        updateLanguageSelector(response.languages, response.selectedLanguage);
      }
    });
  } else {
    // 언어 선택기 숨기기
    languageSelector.classList.add('hidden');
  }
}

// 언어 선택기 업데이트
function updateLanguageSelector(languages, selectedLanguage) {
  if (!languageSelector) return;
  
  // 기존 항목 제거
  languageSelector.innerHTML = '';
  
  // 언어 목록이 없는 경우
  if (!languages || languages.length === 0) {
    const noLanguage = document.createElement('div');
    noLanguage.className = 'whatsub-language-item';
    noLanguage.textContent = '사용 가능한 언어가 없습니다.';
    languageSelector.appendChild(noLanguage);
    return;
  }
  
  // 언어 항목 추가
  languages.forEach(lang => {
    const langItem = document.createElement('div');
    langItem.className = 'whatsub-language-item';
    if (lang.code === selectedLanguage) {
      langItem.classList.add('selected');
    }
    langItem.textContent = lang.name;
    langItem.dataset.code = lang.code;
    
    langItem.addEventListener('click', () => {
      setSubtitleLanguage(lang.code);
      toggleLanguageSelector(); // 선택 후 닫기
    });
    
    languageSelector.appendChild(langItem);
  });
  
  // 번역 항목 추가 (한국어로 번역 등)
  const translateHeader = document.createElement('div');
  translateHeader.className = 'whatsub-language-item translate-header';
  translateHeader.textContent = '번역';
  translateHeader.style.fontWeight = 'bold';
  translateHeader.style.borderTop = '1px solid #eee';
  translateHeader.style.marginTop = '8px';
  translateHeader.style.paddingTop = '8px';
  
  languageSelector.appendChild(translateHeader);
  
  const translateLanguages = [
    { code: 'ko', name: '한국어로 번역' },
    { code: 'en', name: '영어로 번역' },
    { code: 'ja', name: '일본어로 번역' },
    { code: 'zh-CN', name: '중국어로 번역' }
  ];
  
  translateLanguages.forEach(lang => {
    const langItem = document.createElement('div');
    langItem.className = 'whatsub-language-item';
    
    if (settings.translationEnabled && settings.translationLanguage === lang.code) {
      langItem.classList.add('selected');
    }
    
    langItem.textContent = lang.name;
    langItem.dataset.code = lang.code;
    
    langItem.addEventListener('click', () => {
      setTranslationLanguage(lang.code);
      toggleLanguageSelector(); // 선택 후 닫기
    });
    
    languageSelector.appendChild(langItem);
  });
}

// 자막 언어 설정
function setSubtitleLanguage(languageCode) {
  console.log(`[WhatSub] 자막 언어 변경: ${languageCode}`);
  
  settings.language = languageCode;
  settings.translationEnabled = false; // 번역 비활성화
  
  // 스토리지에 설정 저장
  saveSettings();
  
  // 백그라운드 스크립트에 언어 변경 알림
  chrome.runtime.sendMessage({
    action: 'setLanguage',
    languageCode: languageCode
  });
}

// 번역 언어 설정
function setTranslationLanguage(languageCode) {
  console.log(`[WhatSub] 번역 언어 변경: ${languageCode}`);
  
  settings.translationEnabled = true;
  settings.translationLanguage = languageCode;
  
  // 스토리지에 설정 저장
  saveSettings();
  
  // 백그라운드 스크립트에 번역 설정 알림
  chrome.runtime.sendMessage({
    action: 'setTranslation',
    enabled: true,
    languageCode: languageCode
  });
}

// 자막 토글
function toggleSubtitles(enabled) {
  console.log(`[WhatSub] 자막 토글 호출됨, enabled=${enabled}`);
  
  try {
    settings.enabled = enabled === undefined ? !settings.enabled : enabled;
    
    if (subtitleContainer) {
      subtitleContainer.style.display = settings.enabled ? 'block' : 'none';
      console.log(`[WhatSub] 자막 컨테이너 표시 상태: ${subtitleContainer.style.display}`);
      
      // 자막이 활성화될 때 강제로 보여주기
      if (settings.enabled) {
        // 위치 조정
        subtitleContainer.style.position = 'fixed';
        subtitleContainer.style.zIndex = '2147483647';
        
        // 테스트 메시지 표시
        updateSubtitleText("WhatSub 자막 시스템 활성화됨 - 테스트 메시지");
      }
    } else {
      console.warn('[WhatSub] 자막 컨테이너가 없음, 다시 생성 시도');
      createUI();
    }
    
    // 스토리지에 설정 저장
    saveSettings();
    
    // 백그라운드 스크립트에 자막 상태 알림
    chrome.runtime.sendMessage({
      action: 'toggleCaptions',
      enabled: settings.enabled
    });
    
    console.log(`[WhatSub] 자막 ${settings.enabled ? '활성화' : '비활성화'} 완료`);
  } catch (error) {
    console.error('[WhatSub] 자막 토글 중 오류:', error);
    showDebugMessage('자막 토글 중 오류: ' + error.message);
  }
}

// 자막 위치 토글
function toggleSubtitlePosition() {
  settings.position = settings.position === 'bottom' ? 'top' : 'bottom';
  
  // 설정 적용
  applySettings();
  
  // 스토리지에 설정 저장
  saveSettings();
  
  console.log(`[WhatSub] 자막 위치 변경: ${settings.position}`);
}

// 글꼴 크기 순환
function cycleFontSize() {
  const sizes = ['small', 'medium', 'large'];
  const currentIndex = sizes.indexOf(settings.fontSize);
  const nextIndex = (currentIndex + 1) % sizes.length;
  
  settings.fontSize = sizes[nextIndex];
  
  // 설정 적용
  applySettings();
  
  // 스토리지에 설정 저장
  saveSettings();
  
  console.log(`[WhatSub] 자막 크기 변경: ${settings.fontSize}`);
}

// 드래그 가능 모드 토글
function toggleDraggableMode() {
  draggableSubtitle = !draggableSubtitle;
  
  // 설정 적용
  applySettings();
  
  console.log(`[WhatSub] 드래그 모드 ${draggableSubtitle ? '활성화' : '비활성화'}`);
}

// 자막 드래그 시작
function startDrag(e) {
  if (!draggableSubtitle || !subtitleContainer) return;
  
  isDragging = true;
  
  const rect = subtitleContainer.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  console.log('[WhatSub] 자막 드래그 시작');
}

// 자막 드래그 중
function drag(e) {
  if (!isDragging || !subtitleContainer) return;
  
  // 화면 경계 내로 제한
  const x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - subtitleContainer.offsetWidth));
  const y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - subtitleContainer.offsetHeight));
  
  // 자막 위치 업데이트
  subtitleContainer.style.left = `${x}px`;
  subtitleContainer.style.top = `${y}px`;
  subtitleContainer.style.transform = 'none';
  subtitleContainer.style.bottom = 'auto';
  
  // 위치 저장
  subtitlePosition = { x, y };
}

// 자막 드래그 종료
function endDrag() {
  if (isDragging) {
    isDragging = false;
    console.log('[WhatSub] 자막 드래그 종료');
    
    // 위치를 설정에 저장
    settings.customPosition = subtitlePosition;
    saveSettings();
  }
}

// 댓글 토글
function toggleComments() {
  settings.commentEnabled = !settings.commentEnabled;
  
  // 스토리지에 설정 저장
  saveSettings();
  
  console.log(`[WhatSub] 댓글 표시 ${settings.commentEnabled ? '활성화' : '비활성화'}`);
}

// 새 댓글 추가
function addComment(text, timestamp, userId = null) {
  if (!commentsContainer || !settings.commentEnabled) return;
  
  const comment = document.createElement('div');
  comment.className = 'whatsub-comment';
  comment.textContent = text;
  
  // 랜덤한 높이 위치 지정
  const randomTop = Math.floor(Math.random() * (commentsContainer.offsetHeight - 40));
  comment.style.top = `${randomTop}px`;
  
  commentsContainer.appendChild(comment);
  
  // 애니메이션 완료 후 제거
  setTimeout(() => {
    comment.remove();
  }, 8000);
  
  console.log(`[WhatSub] 댓글 추가: ${text}`);
}

// 공유 모달 표시
function showShareModal() {
  if (!modalOverlay || !shareModal) return;
  
  modalOverlay.classList.remove('hidden');
  shareModal.classList.remove('hidden');
}

// 모달 숨기기
function hideModals() {
  if (modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
  
  if (shareModal) {
    shareModal.classList.add('hidden');
  }
  
  if (languageSelector) {
    languageSelector.classList.add('hidden');
  }
}

// 자막 공유
function shareSubtitles(comment) {
  if (!videoElement) {
    alert('공유할 동영상을 찾을 수 없습니다.');
    return;
  }
  
  const currentTime = videoElement.currentTime;
  const videoId = getVideoId();
  
  if (!videoId) {
    alert('동영상 ID를 찾을 수 없습니다.');
    return;
  }
  
  console.log(`[WhatSub] 자막 공유: 비디오 ID=${videoId}, 시간=${currentTime}, 댓글=${comment}`);
  
  // 백그라운드 스크립트에 공유 요청
  chrome.runtime.sendMessage({
    action: 'shareSubtitle',
    videoId: videoId,
    timestamp: currentTime,
    comment: comment
  }, (response) => {
    if (response && response.success) {
      alert('자막이 성공적으로 공유되었습니다.');
    } else {
      alert('자막 공유에 실패했습니다. 다시 시도해주세요.');
    }
    
    hideModals();
  });
}

// 비디오 ID 가져오기
function getVideoId() {
  // YouTube 비디오 ID 추출
  if (window.location.hostname.includes('youtube.com') && window.location.pathname.startsWith('/watch')) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }
  
  // 다른 비디오 사이트의 ID 추출 로직 추가 가능
  // 예: Vimeo, Dailymotion 등
  
  // 비디오 ID를 찾을 수 없는 경우 페이지 URL을 해시화하여 고유 ID 생성
  return null;
}

// 설정 저장
function saveSettings() {
  chrome.storage.local.set({ subtitleSettings: settings });
}

// YouTube 자막 프로세서 주입
function injectYouTubeProcessor() {
  if (window.location.hostname.includes('youtube.com')) {
    console.log('[WhatSub] YouTube 페이지 감지: 자막 프로세서 주입');
    
    // 스크립트 요소 생성
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('processors/youtube-subtitles.js');
    script.type = 'module';
    
    // 에러 핸들링
    script.onerror = (error) => {
      console.error('[WhatSub] YouTube 자막 프로세서 로드 오류:', error);
    };
    
    // 문서에 스크립트 추가
    (document.head || document.documentElement).appendChild(script);
  }
}

// 자막 업데이트
function updateSubtitleText(text) {
  console.log(`[WhatSub] 자막 텍스트 업데이트: "${text}"`);
  
  try {
    if (!subtitleContainer || !subtitleText) {
      console.warn('[WhatSub] 자막 컨테이너 또는 텍스트 요소가 없음, 다시 생성 시도');
      createUI();
      
      // 여전히 요소가 없으면 함수 종료
      if (!subtitleContainer || !subtitleText) {
        console.error('[WhatSub] 자막 요소 생성 실패, 업데이트 불가');
        return;
      }
    }
    
    // 자막 텍스트 업데이트
    subtitleText.textContent = text;
    
    // 자막이 있고 활성화된 경우 표시
    if (text && settings.enabled) {
      subtitleContainer.style.display = 'block';
      console.log('[WhatSub] 자막 텍스트 업데이트 후 표시됨');
    } else if (!text && settings.enabled) {
      // 텍스트가 없어도 자막 컨테이너는 유지 (자막이 없다는 메시지 표시)
      subtitleText.textContent = "자막을 준비 중입니다...";
      subtitleContainer.style.display = 'block';
    } else {
      subtitleContainer.style.display = 'none';
    }
  } catch (error) {
    console.error('[WhatSub] 자막 업데이트 중 오류:', error);
    showDebugMessage('자막 업데이트 중 오류: ' + error.message);
  }
}

// 자막 서비스 시작 (모든 웹페이지에서 작동)
function startTranscriptionService() {
  // 페이지 내 비디오/오디오 요소 탐색
  findMediaElements();
  
  // 비디오 요소가 없거나 자막이 없는 경우 모든 페이지에서 자체 음성 인식 시도
  if (!videoElement) {
    console.log('[WhatSub] 미디어 요소를 찾을 수 없습니다. 자체 음성 인식 시도...');
    startSpeechRecognition();
  }
}

// 페이지 내 모든 미디어 요소 찾기
function findMediaElements() {
  // 비디오 요소 찾기
  const videoElements = document.querySelectorAll('video');
  if (videoElements.length > 0) {
    videoElement = videoElements[0]; // 첫번째 비디오 요소 사용
    console.log('[WhatSub] 비디오 요소 발견:', videoElement);
    
    // 비디오 이벤트 리스너 추가
    videoElement.addEventListener('play', () => {
      console.log('[WhatSub] 비디오 재생 시작');
      showControls();
    });
    
    videoElement.addEventListener('pause', () => {
      console.log('[WhatSub] 비디오 일시 정지');
    });
    
    // 비디오가 있지만 자막이 없는 경우 자동으로 음성 인식 시작
    chrome.runtime.sendMessage({ 
      action: 'fetchSubtitles',
      videoId: getVideoId() || 'page_' + window.location.hostname
    }, (response) => {
      if (!response || !response.success || !response.data.subtitles || response.data.subtitles.length === 0) {
        startSpeechRecognition();
      }
    });
    
    return;
  }
  
  // 오디오 요소 찾기
  const audioElements = document.querySelectorAll('audio');
  if (audioElements.length > 0) {
    // 오디오 요소가 있는 경우 자동으로 음성 인식 시작
    console.log('[WhatSub] 오디오 요소 발견:', audioElements[0]);
    startSpeechRecognition();
    return;
  }
  
  // iframe 내부의 요소도 검색 (보안 정책상 가능한 경우에만)
  try {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.contentDocument) {
        const iframeVideos = iframe.contentDocument.querySelectorAll('video');
        if (iframeVideos.length > 0) {
          videoElement = iframeVideos[0];
          console.log('[WhatSub] iframe 내부 비디오 요소 발견:', videoElement);
          showControls();
          return;
        }
      }
    }
  } catch (error) {
    console.log('[WhatSub] iframe 내부 접근 오류 (동일 출처 정책):', error);
  }
}

// 자체 음성 인식 시작 (페이지에 비디오가 없는 경우에도 작동)
function startSpeechRecognition() {
  if (isTranscriptionActive) return;
  
  isTranscriptionActive = true;
  console.log('[WhatSub] 자체 음성 인식 시작');
  
  // 배경 스크립트에 음성 인식 요청
  chrome.runtime.sendMessage({
    action: 'startSpeechRecognition'
  }, (response) => {
    if (response && response.success) {
      console.log('[WhatSub] 음성 인식 서비스 시작됨');
      
      // 음성 인식 시작 시 임시 자막 표시
      updateSubtitleText("음성 인식을 준비 중입니다. 잠시만 기다려주세요...");
    } else {
      console.error('[WhatSub] 음성 인식 서비스 시작 실패');
      isTranscriptionActive = false;
    }
  });
  
  // 자막 UI 표시
  if (subtitleContainer) {
    subtitleContainer.style.display = 'block';
  }
  
  showControls();
}

// 좋아요 버튼 클릭
function likeSubtitle() {
  console.log('[WhatSub] 자막 좋아요');
  
  chrome.runtime.sendMessage({
    action: 'rateSubtitle',
    type: 'like',
    videoId: getVideoId() || 'page_' + window.location.hostname,
    timestamp: videoElement ? videoElement.currentTime : 0
  });
}

// 싫어요 버튼 클릭
function dislikeSubtitle() {
  console.log('[WhatSub] 자막 싫어요');
  
  chrome.runtime.sendMessage({
    action: 'rateSubtitle',
    type: 'dislike',
    videoId: getVideoId() || 'page_' + window.location.hostname,
    timestamp: videoElement ? videoElement.currentTime : 0
  });
}

// 추천 버튼 클릭
function recommendSubtitle() {
  console.log('[WhatSub] 자막 추천');
  
  chrome.runtime.sendMessage({
    action: 'rateSubtitle',
    type: 'recommend',
    videoId: getVideoId() || 'page_' + window.location.hostname,
    timestamp: videoElement ? videoElement.currentTime : 0
  });
}

// 음성 인식 토글
function toggleSpeechRecognition() {
  if (isTranscriptionActive) {
    stopSpeechRecognition();
  } else {
    startSpeechRecognition();
  }
}

// 음성 인식 중지
function stopSpeechRecognition() {
  if (!isTranscriptionActive) return;
  
  console.log('[WhatSub] 자체 음성 인식 중지');
  
  chrome.runtime.sendMessage({
    action: 'stopSpeechRecognition'
  }, (response) => {
    if (response && response.success) {
      console.log('[WhatSub] 음성 인식 서비스 중지됨');
    }
  });
  
  isTranscriptionActive = false;
  
  // 자막 숨김
  if (subtitleContainer && !settings.enabled) {
    subtitleContainer.style.display = 'none';
  }
}

// 마우스 움직임 처리
function handleMouseMove(e) {
  // 마우스 위치 저장 (필요한 경우 사용)
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  // 사용자 활동 처리
  handleUserActivity();
}

// 사용자 활동 처리 (마우스 움직임, 클릭, 키보드 등)
function handleUserActivity() {
  lastMouseMoveTime = Date.now();
  
  // 마우스가 비활성 상태였다면 활성화
  if (!isMouseActive) {
    isMouseActive = true;
    showUIElements();
  }
  
  // 타이머 초기화
  clearTimeout(inactiveTimeout);
  
  // 2초 후에 비활성 상태로 전환 (요구사항에 맞춤)
  inactiveTimeout = setTimeout(() => {
    isMouseActive = false;
    hideUIElements();
  }, 2000);
}

// UI 요소 표시
function showUIElements() {
  if (controlsContainer) {
    controlsContainer.classList.remove('hidden', 'fade-out');
    controlsContainer.classList.add('fade-in');
  }
  
  if (interactionButtonsContainer) {
    interactionButtonsContainer.classList.remove('hidden', 'fade-out');
    interactionButtonsContainer.classList.add('fade-in');
  }
}

// UI 요소 숨김 (자막 텍스트와 댓글은 유지)
function hideUIElements() {
  if (controlsContainer) {
    controlsContainer.classList.remove('fade-in');
    controlsContainer.classList.add('fade-out');
  }
  
  if (interactionButtonsContainer) {
    interactionButtonsContainer.classList.remove('fade-in');
    interactionButtonsContainer.classList.add('fade-out');
  }
  
  // 모달이 열려있는 경우 닫지 않음
  if (!modalOverlay || modalOverlay.classList.contains('hidden')) {
    if (languageSelector) {
      languageSelector.classList.add('hidden');
    }
  }
}

// 페이지 가시성 변경 처리
function handleVisibilityChange() {
  if (document.hidden) {
    // 페이지가 보이지 않을 때
    clearTimeout(inactiveTimeout);
    hideUIElements();
  } else {
    // 페이지가 다시 보일 때
    handleUserActivity();
  }
}

// 비디오 이벤트 처리
function handleVideoEvent(data) {
  console.log('[WhatSub] 비디오 이벤트:', data.eventType);
  
  // 필요한 경우 배경 스크립트에 전달
  chrome.runtime.sendMessage({
    action: 'videoEvent',
    eventType: data.eventType,
    videoInfo: data.videoInfo
  }).catch(err => {
    console.error('[WhatSub] 배경 스크립트 메시지 전송 오류:', err);
  });
}

// 인젝션 스크립트에 자막 표시 요청
function showSubtitleViaInjection(text, duration = 5000) {
  if (injectSubtitleAvailable) {
    window.postMessage({
      from: 'whatsub_content',
      action: 'showSubtitle',
      text: text,
      duration: duration
    }, '*');
    return true;
  }
  return false;
}

// 테스트 메시지 표시 함수
function showTestMessage(message) {
  // 테스트 메시지 컨테이너 생성
  const testContainer = document.createElement('div');
  testContainer.id = 'whatsub-test-message';
  testContainer.style.position = 'fixed';
  testContainer.style.top = '10px';
  testContainer.style.left = '10px';
  testContainer.style.backgroundColor = '#FF5722';
  testContainer.style.color = 'white';
  testContainer.style.padding = '10px 15px';
  testContainer.style.borderRadius = '5px';
  testContainer.style.zIndex = '2147483647';
  testContainer.style.fontFamily = 'Arial, sans-serif';
  testContainer.style.fontSize = '14px';
  testContainer.style.fontWeight = 'bold';
  testContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  testContainer.style.transition = 'opacity 0.5s ease';
  testContainer.textContent = message;
  
  // 문서에 추가
  document.body.appendChild(testContainer);
  
  // 5초 후 사라지게 설정
  setTimeout(() => {
    testContainer.style.opacity = '0';
    setTimeout(() => {
      if (testContainer.parentNode) {
        testContainer.parentNode.removeChild(testContainer);
      }
    }, 500);
  }, 5000);
}

// 콘텐츠 스크립트 초기화 호출
try {
  console.log('[WhatSub] 콘텐츠 스크립트 진입점, initialize() 호출');
  initialize();
} catch (error) {
  console.error('[WhatSub] 진입점 호출 중 오류:', error);
} 