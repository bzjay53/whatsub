/**
 * Whatsub 자막 주입 스크립트
 * 웹페이지에 자막을 표시하는 기능을 담당합니다.
 */

// 디버그 모드 설정
const DEBUG_MODE = true;

// 로깅 함수
function log(...args) {
  if (DEBUG_MODE) {
    console.log('[Whatsub Injected]', ...args);
  }
}

function logError(...args) {
  console.error('[Whatsub Injected]', ...args);
}

// 샌드박스 프레임 감지
function isInSandboxedFrame() {
  try {
    // about:blank 확인
    if (window.location.href === 'about:blank') {
      return true;
    }
    
    // iframe 확인
    if (window !== window.top) {
      try {
        // 액세스 가능 여부 테스트 (실패하면 샌드박스)
        window.top.location.href;
        return false;
      } catch (e) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    logError('샌드박스 감지 중 오류:', e);
    return true; // 안전을 위해 true 반환
  }
}

// 상태 관리 객체
const state = {
  initialized: false,
  subtitleContainer: null,
  originalTextElement: null,
  translatedTextElement: null,
  hideTimeout: null,
  inSandboxedFrame: isInSandboxedFrame(),
  settings: {
    fontSize: 'medium',
    position: 'bottom',
    backgroundColor: 'semi-transparent',
    textColor: 'white',
    showOriginal: true,
    showTranslated: true
  }
};

// 스타일 매핑
const styleMap = {
  fontSize: {
    small: '16px',
    medium: '20px',
    large: '24px',
    xlarge: '28px'
  },
  backgroundColor: {
    transparent: 'rgba(0, 0, 0, 0.1)',
    'semi-transparent': 'rgba(0, 0, 0, 0.7)',
    solid: 'rgba(0, 0, 0, 0.9)'
  }
};

// 초기화 함수
function initialize() {
  log('초기화 시작');
  
  // 이미 초기화된 경우 중복 초기화 방지
  if (state.initialized) {
    log('이미 초기화되었습니다');
    return;
  }
  
  // 샌드박스 프레임인 경우 초기화 중단
  if (state.inSandboxedFrame) {
    logError('샌드박스 프레임에서는 실행할 수 없습니다.');
    return;
  }
  
  try {
    // 메시지 리스너 설정
    setupMessageListener();
    
    // 초기화 완료
    state.initialized = true;
    
    // 준비 완료 메시지 전송
    window.postMessage({
      type: 'SUBTITLE_SCRIPT_READY',
      source: 'whatsub-injected-script'
    }, '*');
    
    log('초기화 완료');
  } catch (error) {
    logError('초기화 중 오류:', error);
  }
}

// 메시지 리스너 설정
function setupMessageListener() {
  log('메시지 리스너 설정');
  
  // 샌드박스 프레임인 경우 리스너 설정 중단
  if (state.inSandboxedFrame) {
    logError('샌드박스 프레임에서는 메시지 리스너를 설정할 수 없습니다.');
    return;
  }
  
  window.addEventListener('message', function(event) {
    // 다른 출처의 메시지 무시
    if (event.source !== window) {
      return;
    }
    
    // content-script로부터의 메시지인지 확인
    if (!event.data || event.data.source !== 'whatsub-content-script') {
      return;
    }
    
    // 메시지 타입에 따른 처리
    const messageType = event.data.type;
    log('메시지 수신:', messageType);
    
    try {
      switch (messageType) {
        case 'CHECK_AVAILABILITY':
          handleCheckAvailability(event.data);
          break;
          
        case 'TEST_SUBTITLE':
          handleTestSubtitle(event.data);
          break;
          
        case 'SHOW_SUBTITLE':
          handleShowSubtitle(event.data);
          break;
          
        case 'HIDE_SUBTITLE':
          handleHideSubtitle(event.data);
          break;
          
        case 'UPDATE_SETTINGS':
          handleUpdateSettings(event.data);
          break;
          
        default:
          log('알 수 없는 메시지 타입:', messageType);
      }
    } catch (error) {
      logError('메시지 처리 중 오류:', error);
      
      // 오류 응답 전송
      sendErrorResponse(messageType, error);
    }
  });
}

// 가용성 확인 처리
function handleCheckAvailability(message) {
  log('가용성 확인 요청 처리');
  
  // 응답 전송
  window.postMessage({
    type: 'AVAILABILITY_RESPONSE',
    source: 'whatsub-injected-script',
    success: true
  }, '*');
}

// 테스트 자막 처리
function handleTestSubtitle(message) {
  log('테스트 자막 요청 처리');
  
  try {
    const data = message.data || {};
    
    // 자막 컨테이너 생성 또는 가져오기
    if (!state.subtitleContainer) {
      createSubtitleContainer();
    }
    
    if (!state.subtitleContainer) {
      throw new Error('자막 컨테이너를 생성할 수 없습니다');
    }
    
    // 자막 표시
    showSubtitle(data.original, data.translated, data.duration);
    
    // 성공 응답 전송
    window.postMessage({
      type: 'TEST_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: true
    }, '*');
  } catch (error) {
    logError('테스트 자막 처리 중 오류:', error);
    
    // 오류 응답 전송
    window.postMessage({
      type: 'TEST_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: false,
      error: error.message
    }, '*');
  }
}

// 자막 표시 처리
function handleShowSubtitle(message) {
  log('자막 표시 요청 처리');
  
  try {
    const data = message.data || {};
    
    // 필수 데이터 확인
    if (!data.original) {
      throw new Error('자막 텍스트가 없습니다');
    }
    
    // 자막 컨테이너 생성 또는 가져오기
    if (!state.subtitleContainer) {
      createSubtitleContainer();
    }
    
    if (!state.subtitleContainer) {
      throw new Error('자막 컨테이너를 생성할 수 없습니다');
    }
    
    // 자막 표시
    showSubtitle(data.original, data.translated, data.duration);
    
    // 성공 응답 전송
    window.postMessage({
      type: 'SHOW_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: true
    }, '*');
  } catch (error) {
    logError('자막 표시 중 오류:', error);
    
    // 오류 응답 전송
    window.postMessage({
      type: 'SHOW_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: false,
      error: error.message
    }, '*');
  }
}

// 자막 숨김 처리
function handleHideSubtitle(message) {
  log('자막 숨김 요청 처리');
  
  try {
    hideSubtitle();
    
    // 성공 응답 전송
    window.postMessage({
      type: 'HIDE_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: true
    }, '*');
  } catch (error) {
    logError('자막 숨김 중 오류:', error);
    
    // 오류 응답 전송
    window.postMessage({
      type: 'HIDE_SUBTITLE_RESPONSE',
      source: 'whatsub-injected-script',
      success: false,
      error: error.message
    }, '*');
  }
}

// 설정 업데이트 처리
function handleUpdateSettings(message) {
  log('설정 업데이트 요청 처리');
  
  try {
    const newSettings = message.data || {};
    
    // 설정 업데이트
    Object.keys(newSettings).forEach(key => {
      if (state.settings[key] !== undefined) {
        state.settings[key] = newSettings[key];
      }
    });
    
    // 자막 컨테이너가 존재하면 스타일 업데이트
    if (state.subtitleContainer) {
      updateSubtitleStyles();
    }
    
    // 성공 응답 전송
    window.postMessage({
      type: 'UPDATE_SETTINGS_RESPONSE',
      source: 'whatsub-injected-script',
      success: true
    }, '*');
  } catch (error) {
    logError('설정 업데이트 중 오류:', error);
    
    // 오류 응답 전송
    window.postMessage({
      type: 'UPDATE_SETTINGS_RESPONSE',
      source: 'whatsub-injected-script',
      success: false,
      error: error.message
    }, '*');
  }
}

// 오류 응답 전송
function sendErrorResponse(messageType, error) {
  const responseType = messageType.replace(/^([A-Z_]+)$/, '$1_RESPONSE');
  
  window.postMessage({
    type: responseType,
    source: 'whatsub-injected-script',
    success: false,
    error: error.message || '알 수 없는 오류'
  }, '*');
}

// 자막 컨테이너 생성
function createSubtitleContainer() {
  log('자막 컨테이너 생성');
  
  try {
    // 기존 컨테이너 제거
    if (state.subtitleContainer) {
      state.subtitleContainer.remove();
    }
    
    // 자막 컨테이너 생성
    const container = document.createElement('div');
    container.id = 'whatsub-subtitle-container';
    
    // 기본 스타일 설정
    container.style.position = 'fixed';
    container.style.bottom = '70px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '99999';
    container.style.maxWidth = '90%';
    container.style.textAlign = 'center';
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.3s ease';
    container.style.pointerEvents = 'none';
    
    // 원본 텍스트 요소
    const originalText = document.createElement('div');
    originalText.id = 'whatsub-original-text';
    originalText.style.backgroundColor = styleMap.backgroundColor[state.settings.backgroundColor];
    originalText.style.color = state.settings.textColor;
    originalText.style.padding = '8px 16px';
    originalText.style.borderRadius = '4px';
    originalText.style.fontSize = styleMap.fontSize[state.settings.fontSize];
    originalText.style.fontWeight = 'bold';
    originalText.style.textShadow = '1px 1px 1px black';
    originalText.style.lineHeight = '1.5';
    originalText.style.marginBottom = '4px';
    originalText.style.display = state.settings.showOriginal ? 'block' : 'none';
    
    // 번역 텍스트 요소
    const translatedText = document.createElement('div');
    translatedText.id = 'whatsub-translated-text';
    translatedText.style.backgroundColor = styleMap.backgroundColor[state.settings.backgroundColor];
    translatedText.style.color = state.settings.textColor;
    translatedText.style.padding = '8px 16px';
    translatedText.style.borderRadius = '4px';
    translatedText.style.fontSize = styleMap.fontSize[state.settings.fontSize];
    translatedText.style.fontWeight = 'bold';
    translatedText.style.textShadow = '1px 1px 1px black';
    translatedText.style.lineHeight = '1.5';
    translatedText.style.display = state.settings.showTranslated ? 'block' : 'none';
    
    // 요소 추가
    container.appendChild(originalText);
    container.appendChild(translatedText);
    
    // 상태 저장
    state.subtitleContainer = container;
    state.originalTextElement = originalText;
    state.translatedTextElement = translatedText;
    
    // DOM에 컨테이너 추가
    document.body.appendChild(container);
    
    // 자막 위치 설정
    updateSubtitlePosition();
    
    // 비디오 요소 감지 및 이벤트 리스너 추가
    setupVideoEvents();
    
    log('자막 컨테이너 생성 완료');
    return container;
  } catch (error) {
    logError('자막 컨테이너 생성 중 오류:', error);
    return null;
  }
}

// 자막 표시
function showSubtitle(originalText, translatedText, duration = 3000) {
  log('자막 표시:', originalText, translatedText);
  
  try {
    // 자막 컨테이너 확인
    if (!state.subtitleContainer) {
      createSubtitleContainer();
    }
    
    // 자막 텍스트 설정
    if (state.originalTextElement && originalText) {
      state.originalTextElement.textContent = originalText;
      state.originalTextElement.style.display = state.settings.showOriginal ? 'block' : 'none';
    }
    
    if (state.translatedTextElement && translatedText) {
      state.translatedTextElement.textContent = translatedText;
      state.translatedTextElement.style.display = state.settings.showTranslated ? 'block' : 'none';
    }
    
    // 타이머 초기화
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
      state.hideTimeout = null;
    }
    
    // 자막 표시
    state.subtitleContainer.style.opacity = '1';
    
    // 지정된 시간 후 자막 숨김
    if (duration > 0) {
      state.hideTimeout = setTimeout(() => {
        hideSubtitle();
      }, duration);
    }
    
    return true;
  } catch (error) {
    logError('자막 표시 중 오류:', error);
    return false;
  }
}

// 자막 숨김
function hideSubtitle() {
  log('자막 숨김');
  
  try {
    if (state.subtitleContainer) {
      state.subtitleContainer.style.opacity = '0';
    }
    
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
      state.hideTimeout = null;
    }
    
    return true;
  } catch (error) {
    logError('자막 숨김 중 오류:', error);
    return false;
  }
}

// 자막 스타일 업데이트
function updateSubtitleStyles() {
  log('자막 스타일 업데이트');
  
  try {
    if (!state.subtitleContainer) {
      return false;
    }
    
    // 원본 텍스트 요소 스타일 업데이트
    if (state.originalTextElement) {
      state.originalTextElement.style.backgroundColor = 
        styleMap.backgroundColor[state.settings.backgroundColor];
      state.originalTextElement.style.color = state.settings.textColor;
      state.originalTextElement.style.fontSize = 
        styleMap.fontSize[state.settings.fontSize];
      state.originalTextElement.style.display = 
        state.settings.showOriginal ? 'block' : 'none';
    }
    
    // 번역 텍스트 요소 스타일 업데이트
    if (state.translatedTextElement) {
      state.translatedTextElement.style.backgroundColor = 
        styleMap.backgroundColor[state.settings.backgroundColor];
      state.translatedTextElement.style.color = state.settings.textColor;
      state.translatedTextElement.style.fontSize = 
        styleMap.fontSize[state.settings.fontSize];
      state.translatedTextElement.style.display = 
        state.settings.showTranslated ? 'block' : 'none';
    }
    
    // 자막 위치 업데이트
    updateSubtitlePosition();
    
    return true;
  } catch (error) {
    logError('자막 스타일 업데이트 중 오류:', error);
    return false;
  }
}

// 자막 위치 업데이트
function updateSubtitlePosition() {
  log('자막 위치 업데이트');
  
  try {
    if (!state.subtitleContainer) {
      return false;
    }
    
    // 전체화면 모드 확인
    const fullscreenElement = 
      document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement || 
      document.msFullscreenElement;
    
    // 위치 조정
    switch (state.settings.position) {
      case 'top':
        state.subtitleContainer.style.top = '40px';
        state.subtitleContainer.style.bottom = 'auto';
        break;
        
      case 'middle':
        state.subtitleContainer.style.top = '50%';
        state.subtitleContainer.style.bottom = 'auto';
        state.subtitleContainer.style.transform = 'translate(-50%, -50%)';
        break;
        
      case 'bottom':
      default:
        state.subtitleContainer.style.bottom = fullscreenElement ? '80px' : '70px';
        state.subtitleContainer.style.top = 'auto';
        state.subtitleContainer.style.transform = 'translateX(-50%)';
        break;
    }
    
    return true;
  } catch (error) {
    logError('자막 위치 업데이트 중 오류:', error);
    return false;
  }
}

// 비디오 이벤트 설정
function setupVideoEvents() {
  log('비디오 이벤트 설정');
  
  try {
    // 현재 존재하는 비디오 요소에 이벤트 리스너 추가
    const videos = document.querySelectorAll('video');
    videos.forEach(attachVideoEventListeners);
    
    // 새로운 비디오 요소 감지를 위한 DOM 변경 감시
    if (!state.videoObserver) {
      state.videoObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              // 노드가 비디오인 경우
              if (node.nodeName === 'VIDEO') {
                attachVideoEventListeners(node);
              }
              // 노드에 비디오가 포함된 경우
              else if (node.querySelectorAll) {
                const videos = node.querySelectorAll('video');
                videos.forEach(attachVideoEventListeners);
              }
            });
          }
        });
      });
      
      // 문서 전체를 감시
      state.videoObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
    
    // 전체화면 변경 감지
    document.addEventListener('fullscreenchange', updateSubtitlePosition);
    document.addEventListener('webkitfullscreenchange', updateSubtitlePosition);
    document.addEventListener('mozfullscreenchange', updateSubtitlePosition);
    document.addEventListener('MSFullscreenChange', updateSubtitlePosition);
    
    return true;
  } catch (error) {
    logError('비디오 이벤트 설정 중 오류:', error);
    return false;
  }
}

// 비디오 요소에 이벤트 리스너 추가
function attachVideoEventListeners(video) {
  if (!video || video._whatsubListenersAttached) {
    return;
  }
  
  log('비디오 요소에 이벤트 리스너 추가');
  
  try {
    // 플레이 상태 변경 시 자막 위치 조정
    video.addEventListener('play', updateSubtitlePosition);
    video.addEventListener('pause', updateSubtitlePosition);
    video.addEventListener('resize', updateSubtitlePosition);
    
    // 플래그 설정
    video._whatsubListenersAttached = true;
  } catch (error) {
    logError('비디오 이벤트 리스너 추가 중 오류:', error);
  }
}

// 초기화 실행
initialize(); 