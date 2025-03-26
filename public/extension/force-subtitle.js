/**
 * force-subtitle.js
 * 
 * 이 스크립트는 유튜브 및 기타 비디오 사이트에서 자막을 주입하기 위한 것입니다.
 * content-script.js와 함께 작동하여 DOM이 로드되기 전에도 자막 관련 작업을 수행합니다.
 */

(function() {
  console.log('[Whatsub] 자막 강제 표시 스크립트 로드됨');
  
  // 설정 상태를 저장할 변수
  let subtitleEnabled = true;
  let currentVideoElement = null;
  let subtitleContainer = null;
  let draggable = false;
  let subtitleStyle = {
    fontSize: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    textColor: '#ffffff',
    position: 'bottom'
  };
  
  // 스토리지에서 설정 가져오기
  chrome.storage.sync.get(['subtitleEnabled', 'subtitleStyle'], function(result) {
    if (result.subtitleEnabled !== undefined) {
      subtitleEnabled = result.subtitleEnabled;
    }
    
    if (result.subtitleStyle) {
      subtitleStyle = { ...subtitleStyle, ...result.subtitleStyle };
    }
    
    // 페이지 로드 시 비디오 요소 검사
    checkForVideoElements();
  });
  
  // 메시지 리스너 설정
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleSubtitles') {
      subtitleEnabled = !subtitleEnabled;
      chrome.storage.sync.set({ subtitleEnabled: subtitleEnabled });
      updateSubtitleVisibility();
      sendResponse({ success: true, enabled: subtitleEnabled });
    } else if (request.action === 'updateSubtitleStyle') {
      subtitleStyle = { ...subtitleStyle, ...request.style };
      chrome.storage.sync.set({ subtitleStyle: subtitleStyle });
      updateSubtitleStyle();
      sendResponse({ success: true });
    } else if (request.action === 'resetPosition') {
      resetSubtitlePosition();
      sendResponse({ success: true });
    } else if (request.action === 'getStatus') {
      sendResponse({ 
        enabled: subtitleEnabled, 
        style: subtitleStyle,
        videoDetected: !!currentVideoElement
      });
    }
    return true;
  });

  // 비디오 요소 감지 함수
  function checkForVideoElements() {
    const videos = document.querySelectorAll('video');
    
    if (videos.length > 0 && !currentVideoElement) {
      // 가장 큰 비디오 요소 선택 (주 콘텐츠일 가능성이 높음)
      let largestVideo = videos[0];
      let maxArea = videos[0].offsetWidth * videos[0].offsetHeight;
      
      videos.forEach(video => {
        const area = video.offsetWidth * video.offsetHeight;
        if (area > maxArea) {
          maxArea = area;
          largestVideo = video;
        }
      });
      
      currentVideoElement = largestVideo;
      setupSubtitles(currentVideoElement);
    }
    
    // 주기적으로 비디오 요소 확인 (SPA 지원)
    setTimeout(checkForVideoElements, 2000);
  }
  
  // 자막 컨테이너 설정
  function setupSubtitles(videoElement) {
    console.log('[Whatsub] 비디오 요소 감지됨:', videoElement);
    
    // 이미 존재하는 자막 컨테이너 확인
    if (subtitleContainer) {
      document.body.removeChild(subtitleContainer);
    }
    
    // 자막 컨테이너 생성
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'whatsub-subtitle-container';
    subtitleContainer.style.position = 'fixed';
    subtitleContainer.style.zIndex = '9999999';
    subtitleContainer.style.textAlign = 'center';
    subtitleContainer.style.padding = '10px 15px';
    subtitleContainer.style.borderRadius = '5px';
    subtitleContainer.style.userSelect = 'none';
    subtitleContainer.style.transition = 'opacity 0.3s ease';
    subtitleContainer.style.maxWidth = '80%';
    subtitleContainer.style.left = '50%';
    subtitleContainer.style.transform = 'translateX(-50%)';
    subtitleContainer.style.bottom = '80px';
    subtitleContainer.style.display = subtitleEnabled ? 'block' : 'none';
    
    // 초기 스타일 적용
    updateSubtitleStyle();
    
    // 테스트 자막 텍스트 추가
    subtitleContainer.textContent = 'Whatsub 자막이 준비되었습니다';
    
    // 자막 드래그 기능 추가
    setupDraggable(subtitleContainer);
    
    // 비디오 이벤트 리스너 추가
    videoElement.addEventListener('play', handleVideoPlay);
    videoElement.addEventListener('pause', handleVideoPause);
    videoElement.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    // 바디에 자막 컨테이너 추가
    document.body.appendChild(subtitleContainer);
    
    // 배경 서비스에 비디오 감지 알림
    chrome.runtime.sendMessage({
      action: 'videoDetected',
      url: window.location.href,
      title: document.title
    });
  }
  
  // 자막 스타일 업데이트
  function updateSubtitleStyle() {
    if (!subtitleContainer) return;
    
    subtitleContainer.style.fontSize = subtitleStyle.fontSize;
    subtitleContainer.style.backgroundColor = subtitleStyle.backgroundColor;
    subtitleContainer.style.color = subtitleStyle.textColor;
    
    if (subtitleStyle.position === 'top') {
      subtitleContainer.style.bottom = 'auto';
      subtitleContainer.style.top = '80px';
    } else {
      subtitleContainer.style.top = 'auto';
      subtitleContainer.style.bottom = '80px';
    }
  }
  
  // 자막 표시 여부 업데이트
  function updateSubtitleVisibility() {
    if (subtitleContainer) {
      subtitleContainer.style.display = subtitleEnabled ? 'block' : 'none';
    }
  }
  
  // 자막 위치 초기화
  function resetSubtitlePosition() {
    if (subtitleContainer) {
      subtitleContainer.style.left = '50%';
      subtitleContainer.style.transform = 'translateX(-50%)';
      
      if (subtitleStyle.position === 'top') {
        subtitleContainer.style.bottom = 'auto';
        subtitleContainer.style.top = '80px';
      } else {
        subtitleContainer.style.top = 'auto';
        subtitleContainer.style.bottom = '80px';
      }
    }
  }
  
  // 자막 드래그 기능 설정
  function setupDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    element.style.cursor = 'move';
    
    element.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
      
      draggable = true;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // 이전 transform 속성 제거
      element.style.transform = 'none';
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.top = (element.offsetTop - pos2) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      
      // 드래그 후 위치 저장
      setTimeout(() => {
        draggable = false;
      }, 100);
    }
  }
  
  // 비디오 이벤트 핸들러
  function handleVideoPlay() {
    console.log('[Whatsub] 비디오 재생 시작');
    chrome.runtime.sendMessage({
      action: 'videoPlayStateChanged',
      playing: true,
      url: window.location.href
    });
  }
  
  function handleVideoPause() {
    console.log('[Whatsub] 비디오 일시 정지');
    chrome.runtime.sendMessage({
      action: 'videoPlayStateChanged',
      playing: false,
      url: window.location.href
    });
  }
  
  function handleVideoTimeUpdate() {
    if (!currentVideoElement || !subtitleEnabled) return;
    
    // 여기서 필요한 경우 현재 재생 시간 정보를 백그라운드로 전송
    // 현재는 1초에 한 번만 전송하도록 조절
    if (currentVideoElement.currentTime % 1 < 0.1) {
      chrome.runtime.sendMessage({
        action: 'videoTimeUpdate',
        currentTime: currentVideoElement.currentTime,
        duration: currentVideoElement.duration,
        url: window.location.href
      });
    }
  }
  
  // 자막 텍스트 업데이트 (백그라운드에서 호출됨)
  function updateSubtitleText(text) {
    if (!subtitleContainer || !subtitleEnabled) return;
    
    if (!text || text.trim() === '') {
      subtitleContainer.style.opacity = '0';
    } else {
      subtitleContainer.textContent = text;
      subtitleContainer.style.opacity = '1';
    }
  }
  
  // API 노출 (백그라운드에서 접근할 수 있도록)
  window.whatsub = {
    updateSubtitleText: updateSubtitleText
  };
  
  // 초기 실행
  console.log('[Whatsub] 자막 모듈 초기화 완료');
})(); 