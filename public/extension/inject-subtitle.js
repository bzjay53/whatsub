/**
 * WhatsUb 자막 인젝션 스크립트
 * 비디오 요소에 자막을 추가하는 기능을 담당합니다.
 */

(function() {
  // 디버그 로그 활성화 여부
  const DEBUG = true;
  
  // 자막 컨테이너의 기본 스타일
  const DEFAULT_SUBTITLE_STYLE = {
    position: 'absolute',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '20px',
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: '9999',
    maxWidth: '80%',
    textShadow: '1px 1px 1px rgba(0, 0, 0, 0.8)',
    userSelect: 'none',
    transition: 'opacity 0.3s ease'
  };

  // 상태 변수
  let subtitleContainer = null;
  let currentVideoElement = null;
  let isSubtitleVisible = false;
  let currentSubtitleText = '';
  let subtitleLanguage = 'ko';
  let lastTimeUpdate = 0;
  let videoObserver = null;
  let autoHideTimer = null;
  
  // 초기화 함수
  function initialize() {
    logDebug('WhatsUb 자막 인젝션 스크립트 초기화 시작');
    
    // 이미 존재하는 비디오 요소 처리
    scanForVideoElements();
    
    // DOM 변경 감지를 위한 옵저버 설정
    setupMutationObserver();
    
    // 메시지 리스너 설정
    setupMessageListener();
    
    // 디버그 메시지
    logDebug('WhatsUb 자막 인젝션 스크립트 초기화 완료');
    
    // 초기화 완료 표시 (디버깅용)
    console.log('%c[WhatsUb 인젝션] 스크립트가 성공적으로 로드되었습니다. 버전: 0.2.2', 'background: #4CAF50; color: white; padding: 5px; border-radius: 3px; font-weight: bold;');
  }
  
  // 비디오 요소 스캔
  function scanForVideoElements() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (!video.dataset.whatsubInjected) {
        attachToVideo(video);
      }
    });
  }
  
  // DOM 변경 감지를 위한 옵저버 설정
  function setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            // 노드가 비디오인 경우
            if (node.nodeName === 'VIDEO') {
              attachToVideo(node);
            }
            // 노드가 엘리먼트이고 내부에 비디오가 있는 경우
            else if (node.nodeType === Node.ELEMENT_NODE) {
              const videos = node.querySelectorAll('video');
              videos.forEach(video => {
                if (!video.dataset.whatsubInjected) {
                  attachToVideo(video);
                }
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // 비디오 요소에 이벤트 리스너 연결
  function attachToVideo(videoElement) {
    if (videoElement.dataset.whatsubInjected) return;
    
    videoElement.dataset.whatsubInjected = 'true';
    
    // 비디오 요소에 이벤트 리스너 추가
    videoElement.addEventListener('play', () => handleVideoEvent(videoElement, 'play'));
    videoElement.addEventListener('pause', () => handleVideoEvent(videoElement, 'pause'));
    videoElement.addEventListener('timeupdate', () => handleVideoTimeUpdate(videoElement));
    
    // 비디오 요소가 이미 재생 중인 경우 처리
    if (!videoElement.paused) {
      handleVideoEvent(videoElement, 'play');
    }
    
    logDebug('비디오 요소에 WhatsUb 연결됨', videoElement);
  }
  
  // 비디오 이벤트 처리
  function handleVideoEvent(videoElement, eventType) {
    currentVideoElement = videoElement;
    
    // 비디오 정보를 콘텐츠 스크립트에 전송
    sendMessageToContentScript({
      action: 'videoEvent',
      eventType: eventType,
      videoInfo: {
        src: videoElement.src || document.location.href,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        paused: videoElement.paused
      }
    });
    
    // 재생 이벤트인 경우 자막 컨테이너 생성
    if (eventType === 'play' && !subtitleContainer) {
      createSubtitleContainer(videoElement);
    }
  }
  
  // 비디오 시간 업데이트 처리
  function handleVideoTimeUpdate(videoElement) {
    // 최소 200ms마다 한 번씩만 처리 (성능 최적화)
    const now = Date.now();
    if (now - lastTimeUpdate < 200) return;
    lastTimeUpdate = now;
    
    // 비디오 현재 시간 정보를 콘텐츠 스크립트에 전송
    sendMessageToContentScript({
      action: 'videoTimeUpdate',
      videoInfo: {
        src: videoElement.src || document.location.href,
        currentTime: videoElement.currentTime,
        duration: videoElement.duration
      }
    });
  }
  
  // 메시지 리스너 설정
  function setupMessageListener() {
    window.addEventListener('message', event => {
      // whatsub 확장 프로그램의 메시지인지 확인
      if (event.data && event.data.from === 'whatsub_content') {
        handleContentScriptMessage(event.data);
      }
    });
  }
  
  // 콘텐츠 스크립트 메시지 처리
  function handleContentScriptMessage(message) {
    logDebug('수신된 메시지:', message);
    
    switch (message.action) {
      case 'ping':
        // ping에 응답
        sendMessageToContentScript({
          action: 'pong',
          timestamp: message.timestamp
        });
        break;
        
      case 'showSubtitle':
        showSubtitle(message.text, message.duration);
        break;
        
      case 'hideSubtitle':
        hideSubtitle();
        break;
        
      case 'updateSettings':
        updateSettings(message.settings);
        break;
        
      case 'toggleSubtitle':
        toggleSubtitleVisibility(message.visible);
        break;
        
      case 'getVideoInfo':
        sendVideoInfo();
        break;
    }
  }
  
  // 자막 컨테이너 생성
  function createSubtitleContainer(videoElement) {
    // 기존 컨테이너가 있으면 제거
    if (subtitleContainer) {
      subtitleContainer.remove();
    }
    
    // 새 자막 컨테이너 생성
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'whatsub-subtitle-container';
    
    // 기본 스타일 적용
    Object.assign(subtitleContainer.style, DEFAULT_SUBTITLE_STYLE);
    
    // 자막 컨테이너 숨김 상태로 시작
    subtitleContainer.style.opacity = '0';
    subtitleContainer.style.pointerEvents = 'none';
    
    // 비디오 컨테이너 또는 부모 요소에 자막 컨테이너 추가
    const videoContainer = findVideoContainer(videoElement);
    videoContainer.appendChild(subtitleContainer);
    
    // 비디오 크기 변화 감지를 위한 ResizeObserver
    if (videoObserver) {
      videoObserver.disconnect();
    }
    
    videoObserver = new ResizeObserver(() => {
      adjustSubtitlePosition();
    });
    
    videoObserver.observe(videoElement);
    
    // 초기 위치 조정
    adjustSubtitlePosition();
    
    logDebug('자막 컨테이너 생성됨');
  }
  
  // 비디오 컨테이너 찾기
  function findVideoContainer(videoElement) {
    // YouTube 특정 처리
    if (window.location.hostname.includes('youtube.com')) {
      const ytPlayerContainer = document.querySelector('.html5-video-container');
      if (ytPlayerContainer) return ytPlayerContainer;
    }
    
    // 비디오 요소의 부모가 있으면 사용, 없으면 body 사용
    return videoElement.parentElement || document.body;
  }
  
  // 자막 위치 조정
  function adjustSubtitlePosition() {
    if (!subtitleContainer || !currentVideoElement) return;
    
    // 비디오 위치 및 크기 가져오기
    const videoRect = currentVideoElement.getBoundingClientRect();
    
    // 위치 조정
    if (videoRect.width > 0 && videoRect.height > 0) {
      subtitleContainer.style.width = `${Math.min(videoRect.width * 0.8, 800)}px`;
      
      // YouTube나 다른 사이트 특정 조정이 필요한 경우
      if (window.location.hostname.includes('youtube.com')) {
        subtitleContainer.style.bottom = '80px'; // YouTube 컨트롤 위에 위치
      } else {
        subtitleContainer.style.bottom = '60px';
      }
    }
  }
  
  // 자막 표시
  function showSubtitle(text, duration = 5000) {
    if (!subtitleContainer) return;
    
    // 자막 텍스트 업데이트
    currentSubtitleText = text;
    subtitleContainer.textContent = text;
    
    // 자막이 보이도록 설정
    subtitleContainer.style.opacity = '1';
    isSubtitleVisible = true;
    
    // 이전 타이머 제거
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    
    // 자동 숨김 타이머 설정
    if (duration > 0) {
      autoHideTimer = setTimeout(() => {
        hideSubtitle();
      }, duration);
    }
  }
  
  // 자막 숨기기
  function hideSubtitle() {
    if (!subtitleContainer) return;
    
    subtitleContainer.style.opacity = '0';
    isSubtitleVisible = false;
    
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }
  
  // 자막 가시성 토글
  function toggleSubtitleVisibility(visible) {
    if (visible === undefined) {
      visible = !isSubtitleVisible;
    }
    
    if (visible) {
      if (currentSubtitleText) {
        showSubtitle(currentSubtitleText, 0); // 무기한 표시
      }
    } else {
      hideSubtitle();
    }
  }
  
  // 설정 업데이트
  function updateSettings(settings) {
    if (!settings) return;
    
    // 언어 설정
    if (settings.language) {
      subtitleLanguage = settings.language;
    }
    
    // 스타일 설정
    if (settings.style) {
      updateSubtitleStyle(settings.style);
    }
    
    logDebug('설정 업데이트됨', settings);
  }
  
  // 자막 스타일 업데이트
  function updateSubtitleStyle(style) {
    if (!subtitleContainer || !style) return;
    
    if (style.fontSize) {
      subtitleContainer.style.fontSize = style.fontSize;
    }
    
    if (style.backgroundColor) {
      subtitleContainer.style.backgroundColor = style.backgroundColor;
    }
    
    if (style.color) {
      subtitleContainer.style.color = style.color;
    }
    
    if (style.position) {
      // 위치 설정 (top, bottom, etc.)
      Object.keys(style.position).forEach(key => {
        subtitleContainer.style[key] = style.position[key];
      });
      
      // transform 재설정 (left: 50%일 때 필요)
      if (subtitleContainer.style.left === '50%') {
        subtitleContainer.style.transform = 'translateX(-50%)';
      } else {
        subtitleContainer.style.transform = '';
      }
    }
  }
  
  // 현재 비디오 정보 전송
  function sendVideoInfo() {
    if (!currentVideoElement) return;
    
    sendMessageToContentScript({
      action: 'videoInfo',
      videoInfo: {
        src: currentVideoElement.src || document.location.href,
        currentTime: currentVideoElement.currentTime,
        duration: currentVideoElement.duration,
        paused: currentVideoElement.paused,
        volume: currentVideoElement.volume,
        muted: currentVideoElement.muted,
        width: currentVideoElement.offsetWidth,
        height: currentVideoElement.offsetHeight
      }
    });
  }
  
  // 콘텐츠 스크립트에 메시지 전송
  function sendMessageToContentScript(message) {
    message.from = 'whatsub_injection';
    window.postMessage(message, '*');
  }
  
  // 디버그 로그
  function logDebug(...args) {
    if (DEBUG) {
      console.log('[WhatsUb 인젝션]', ...args);
    }
  }
  
  // 스크립트 초기화
  initialize();
})(); 