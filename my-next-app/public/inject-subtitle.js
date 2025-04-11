/**
 * inject-subtitle.js
 * 
 * 페이지에 직접 주입되어 자막 기능을 제공하는 스크립트입니다.
 * content-script.js에서 window.postMessage를 통해 통신합니다.
 */

(function() {
  // 디버그 모드 설정
  const DEBUG = true;
  
  // 로그 함수
  function log(...args) {
    if (DEBUG) {
      console.log('[Whatsub Injected]', ...args);
    }
  }
  
  // 오류 로그 함수
  function logError(...args) {
    console.error('[Whatsub Injected Error]', ...args);
  }
  
  // 상태 객체
  const state = {
    initialized: false,
    subtitleContainer: null,
    originalTextElement: null,
    translatedTextElement: null,
    settings: {
      fontSize: 'medium',
      position: 'bottom',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      fontColor: '#FFFFFF',
      dualSubtitles: false
    }
  };

  // 자막 스타일 매핑
  const styleMap = {
    fontSize: {
      small: '16px',
      medium: '20px',
      large: '24px'
    },
    backgroundColor: {
      transparent: 'rgba(0, 0, 0, 0.4)',
      semi: 'rgba(0, 0, 0, 0.7)',
      solid: 'rgba(0, 0, 0, 0.9)'
    }
  };
  
  // 초기화 함수
  function initialize() {
    if (state.initialized) {
      log('이미 초기화됨, 무시');
      return;
    }

    log('자막 주입 스크립트 초기화 시작');
    
    // 메시지 리스너 설정
    setupMessageListener();
    
    // 가용성 확인 응답 - content-script에 작동 중임을 알림
    window.postMessage({
      from: 'whatsub_inject',
      action: 'availabilityResponse',
      status: 'ready'
    }, '*');
    
    state.initialized = true;
    log('자막 주입 스크립트 초기화 완료');
  }
  
  // 메시지 리스너 설정
  function setupMessageListener() {
    window.addEventListener('message', function(event) {
      // 보안: 메시지 출처 확인
      if (!event.data || event.data.from !== 'whatsub_content') {
        return;
      }
      
      try {
        const message = event.data;
        log('메시지 수신:', message.action);
        
        switch (message.action) {
          case 'checkAvailability':
            // 가용성 확인 응답
            window.postMessage({
              from: 'whatsub_inject',
              action: 'availabilityResponse',
              status: 'ready'
            }, '*');
            break;
            
          case 'showSubtitle':
            // 자막 표시
            showSubtitle(
              message.originalText, 
              message.translatedText, 
              message.duration || 5000
            );
            break;
            
          case 'hideSubtitle':
            // 자막 숨기기
            hideSubtitle();
            break;
            
          case 'updateSettings':
            // 설정 업데이트
            updateSettings(message.settings);
            break;
            
          default:
            log('알 수 없는 메시지 액션:', message.action);
        }
      } catch (error) {
        logError('메시지 처리 중 오류:', error);
      }
    });
    
    log('메시지 리스너 설정 완료');
  }
  
  // 자막 컨테이너 생성
  function createSubtitleContainer() {
    try {
      // 기존 컨테이너가 있으면 제거
      if (state.subtitleContainer) {
        document.body.removeChild(state.subtitleContainer);
      }
      
      // 컨테이너 생성
      const container = document.createElement('div');
      container.id = 'whatsub-injected-subtitle-container';
      container.style.position = 'fixed';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.bottom = '10%';
      container.style.padding = '10px 20px';
      container.style.borderRadius = '8px';
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      container.style.color = '#fff';
      container.style.textAlign = 'center';
      container.style.zIndex = '2147483647'; // 최상위 z-index
      container.style.transition = 'all 0.3s ease';
      container.style.maxWidth = '80%';
      container.style.display = 'none';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      
      // 원본 텍스트 요소
      const originalText = document.createElement('div');
      originalText.className = 'whatsub-injected-original-text';
      originalText.style.fontSize = styleMap.fontSize.medium;
      originalText.style.margin = '5px 0';
      originalText.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
      originalText.style.width = '100%';
      
      // 번역 텍스트 요소
      const translatedText = document.createElement('div');
      translatedText.className = 'whatsub-injected-translated-text';
      translatedText.style.fontSize = styleMap.fontSize.medium;
      translatedText.style.margin = '5px 0';
      translatedText.style.opacity = '0.9';
      translatedText.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
      translatedText.style.width = '100%';
      translatedText.style.display = 'none'; // 기본으로 숨김
      
      // 컨테이너에 추가
      container.appendChild(originalText);
      container.appendChild(translatedText);
      
      // 문서에 추가
      document.body.appendChild(container);
      
      // 상태 저장
      state.subtitleContainer = container;
      state.originalTextElement = originalText;
      state.translatedTextElement = translatedText;
      
      log('자막 컨테이너 생성됨');
      return container;
    } catch (error) {
      logError('자막 컨테이너 생성 오류:', error);
      return null;
    }
  }
  
  // 자막 표시 함수
  function showSubtitle(originalText, translatedText, duration = 5000) {
    try {
      // 컨테이너가 없으면 생성
      if (!state.subtitleContainer) {
        createSubtitleContainer();
      }
      
      if (!state.subtitleContainer) {
        logError('자막 컨테이너를 생성할 수 없음');
        return false;
      }
      
      // 텍스트 설정
      if (state.originalTextElement && originalText) {
        state.originalTextElement.textContent = originalText;
        state.originalTextElement.style.display = 'block';
      }
      
      if (state.translatedTextElement && translatedText) {
        state.translatedTextElement.textContent = translatedText;
        // 이중 자막 설정에 따라 표시 여부 결정
        state.translatedTextElement.style.display = state.settings.dualSubtitles ? 'block' : 'none';
      } else if (state.translatedTextElement) {
        state.translatedTextElement.style.display = 'none';
      }
      
      // 컨테이너 표시
      state.subtitleContainer.style.display = 'flex';
      
      // 지정된 시간 후 자동 숨김
      if (duration > 0) {
        setTimeout(hideSubtitle, duration);
      }
      
      log('자막 표시됨');
      return true;
    } catch (error) {
      logError('자막 표시 오류:', error);
      return false;
    }
  }
  
  // 자막 숨김 함수
  function hideSubtitle() {
    try {
      if (state.subtitleContainer) {
        state.subtitleContainer.style.display = 'none';
        log('자막 숨김');
      }
    } catch (error) {
      logError('자막 숨김 오류:', error);
    }
  }
  
  // 설정 업데이트 함수
  function updateSettings(newSettings) {
    try {
      if (!newSettings) return;
      
      // 설정 병합
      Object.assign(state.settings, newSettings);
      
      // 컨테이너가 없으면 생성
      if (!state.subtitleContainer) {
        createSubtitleContainer();
      }
      
      if (!state.subtitleContainer) return;
      
      // 스타일 적용
      // 위치
      if (state.settings.position === 'top') {
        state.subtitleContainer.style.bottom = 'auto';
        state.subtitleContainer.style.top = '10%';
      } else {
        state.subtitleContainer.style.top = 'auto';
        state.subtitleContainer.style.bottom = '10%';
      }
      
      // 글꼴 크기
      const fontSize = styleMap.fontSize[state.settings.fontSize] || '20px';
      if (state.originalTextElement) {
        state.originalTextElement.style.fontSize = fontSize;
      }
      if (state.translatedTextElement) {
        state.translatedTextElement.style.fontSize = fontSize;
      }
      
      // 배경 색상
      const bgColor = styleMap.backgroundColor[state.settings.backgroundColor] || 'rgba(0, 0, 0, 0.7)';
      state.subtitleContainer.style.backgroundColor = bgColor;
      
      // 이중 자막 설정
      if (state.translatedTextElement) {
        state.translatedTextElement.style.display = 
          state.settings.dualSubtitles && state.translatedTextElement.textContent ? 'block' : 'none';
      }
      
      log('설정 업데이트됨:', state.settings);
    } catch (error) {
      logError('설정 업데이트 오류:', error);
    }
  }
  
  // 초기화 실행
  initialize();
})(); 