/**
 * @file content-script.js
 * @description 웹페이지에 주입되는 컨텐츠 스크립트. 자막 표시 UI와 기본 이벤트 처리를 담당합니다.
 * 
 * @dependencies
 * - components/SubtitleDisplay.js: 자막 UI 표시 컴포넌트
 * - components/CommentDisplay.js: 실시간 댓글 표시 컴포넌트
 * - background.js: 백그라운드 통신을 통한 데이터 처리
 * - popup.js: 설정 상태 동기화
 * 
 * @communication
 * - receive: toggleSubtitles, updateSettings, showTestSubtitle, whisperStarted, whisperStopped
 * - send: updateFilterToggle, updateDualSubtitleToggle, saveSettings
 * 
 * @example
 * // 자막 토글 메시지 수신 처리
 * if (message.action === 'toggleSubtitles') {
 *   state.subtitlesEnabled = message.enabled;
 *   if (state.subtitlesEnabled) {
 *     setupSubtitles();
 *   } else {
 *     removeSubtitles();
 *   }
 *   sendResponse({ success: true });
 * }
 */

// Whatsub 콘텐츠 스크립트 (기본 버전)
console.log('[Whatsub] 콘텐츠 스크립트가 로드되었습니다. 버전: 0.2.2');

// CSS 스타일 로드
function loadStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles/subtitles.css');
  link.id = 'whatsub-styles';
  document.head.appendChild(link);
  
  // Font Awesome 로드
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
  document.head.appendChild(fontAwesome);
  
  console.log('[Whatsub] 자막 스타일이 로드되었습니다.');
}

// 스타일을 직접 주입하는 함수
function injectStyles(styles) {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
  console.log('[Whatsub] 자막 스타일이 주입되었습니다.');
  return styleElement;
}

// 페이지 로드 시 스타일 적용
loadStyles();

// 전역 상태 관리
const state = {
  subtitlesEnabled: true,
  currentLanguage: 'ko',
  autoSubtitlesEnabled: false,
  universalMode: false, // 모든 웹사이트에서 작동하는 모드
  subtitleSettings: {
    position: 'bottom',
    fontSize: 'medium',
    background: 'semi',
    dualSubtitles: false,
    dualLanguage: 'en'
  }
};

// 자막 컨테이너 요소
let subtitleContainer = null;
let originalTextElement = null;
let translatedTextElement = null;

// 자막 관련 설정
let currentSubtitleText = '';
let lastSubtitleText = '';
let isYouTubePage = false;
let youtubeObserver = null;

// 유튜브 페이지 감지
function checkIfYouTubePage() {
  const isYT = window.location.hostname.includes('youtube.com');
  
  if (isYT) {
    console.log('[Whatsub] 유튜브 페이지 감지됨');
    isYouTubePage = true;
    
    // 유튜브 자막 요소 감시 시작
    startYouTubeObserver();
  } else {
    isYouTubePage = false;
  }
  
  return isYT;
}

// 유튜브 자막 요소 감시 설정
function startYouTubeObserver() {
  if (youtubeObserver) {
    youtubeObserver.disconnect();
  }
  
  // 자막 요소 감시를 위한 MutationObserver
  youtubeObserver = new MutationObserver(function(mutations) {
    if (!state.subtitlesEnabled) return;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' || mutation.type === 'subtree') {
        checkForYouTubeSubtitles();
      }
    });
  });
  
  // 문서 전체 감시 설정
  youtubeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[Whatsub] 유튜브 자막 감시 시작됨');
}

// 유튜브 자막 체크 함수
function checkForYouTubeSubtitles() {
  // 유튜브의 자막 요소 찾기 (선택자는 변경될 수 있음)
  const subtitleElements = document.querySelectorAll('.ytp-caption-segment');
  
  if (subtitleElements.length === 0) {
    // 자막이 없는 경우, 다른 선택자 시도
    const altSubtitleElements = document.querySelectorAll('.captions-text');
    
    if (altSubtitleElements.length === 0) {
      return; // 자막 요소가 없음
    }
    
    // 대체 선택자에서 자막 텍스트 추출
    currentSubtitleText = Array.from(altSubtitleElements)
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0)
      .join(' ');
  } else {
    // 기본 자막 요소에서 자막 텍스트 추출
    currentSubtitleText = Array.from(subtitleElements)
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0)
      .join(' ');
  }
  
  // 자막이 변경된 경우에만 처리
  if (currentSubtitleText && currentSubtitleText !== lastSubtitleText) {
    lastSubtitleText = currentSubtitleText;
    
    // 번역 실행
    translateSubtitle(currentSubtitleText);
  }
}

// 자막 번역 함수
async function translateSubtitle(text) {
  if (!text || text.trim().length === 0) return;
  
  try {
    // 언어 감지 (생략 가능)
    // const detectedLanguage = await detectLanguage(text);
    const detectedLanguage = 'en'; // 예시: 기본적으로 영어로 가정
    
    // 원본 자막 표시
    updateSubtitles(text);
    
    // 번역이 필요한 경우 (선택된 언어와 감지된 언어가 다른 경우)
    if (state.currentLanguage !== detectedLanguage) {
      // 백그라운드 서비스에 번역 요청
      chrome.runtime.sendMessage({
        action: 'translateText',
        text: text,
        source: detectedLanguage,
        target: state.currentLanguage
      }, function(response) {
        if (response && response.success && response.translatedText) {
          // 번역된 텍스트 표시
          updateSubtitles(text, response.translatedText);
        }
      });
    }
  } catch (error) {
    console.error('[Whatsub] 자막 번역 중 오류:', error);
  }
}

/**
 * 자막 이벤트 핸들러 설정
 * 자막 토글, 언어 변경, 위치 변경 등 다양한 이벤트를 처리합니다.
 * 
 * @listens chrome.runtime.onMessage - 크롬 익스텐션 메시지 이벤트
 * @fires updateFilterToggle - 자막 필터 토글 상태 업데이트 메시지
 * @fires updateDualSubtitleToggle - 이중 자막 토글 상태 업데이트 메시지
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Whatsub] 콘텐츠 스크립트 메시지 수신:', message.action);
  
  // 자막 토글
  if (message.action === 'toggleSubtitles') {
    state.subtitlesEnabled = message.enabled;
    state.universalMode = message.universalMode || false;
    
    if (state.subtitlesEnabled) {
      if (isYouTube() || state.universalMode) {
        setupSubtitles();
      }
    } else {
      removeSubtitles();
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'changeLanguage') {
    state.currentLanguage = message.language;
    
    // 자막이 활성화된 상태면 현재 자막을 새 언어로 다시 번역
    if (state.subtitlesEnabled && currentSubtitleText) {
      translateSubtitle(currentSubtitleText);
    }
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'updateSettings') {
    if (message.settings) {
      state.subtitleSettings = { ...state.subtitleSettings, ...message.settings };
      updateSubtitleStyle();
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkStatus') {
    sendResponse({ 
      isInitialized: true,
      isSubtitleEnabled: state.subtitlesEnabled,
      selectedLanguage: state.currentLanguage,
      settings: state.subtitleSettings,
      isYouTubePage: isYouTubePage
    });
  }
  
  if (message.action === 'updateSubtitles') {
    updateSubtitles(message.original, message.translated);
    sendResponse({ success: true });
  }
  
  if (message.action === 'resetPosition') {
    resetPosition();
    sendResponse({ success: true });
  }
  
  // 시뮬레이션된 자막 표시 (테스트용)
  if (message.action === 'showTestSubtitle') {
    if (state.subtitlesEnabled || message.universalMode) {
      showSubtitle(message.original, message.translated);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '자막이 활성화되지 않았습니다.' });
    }
  }
  
  // 로그아웃 시 세션 스토리지 정리 처리
  if (message.action === 'clearSessionStorage') {
    try {
      // Whatsub 관련 세션 스토리지 항목 정리
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('whatsub') || key.includes('auth') || key.includes('token'))) {
          keysToRemove.push(key);
        }
      }
      
      // 식별된 키 제거
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      console.log('[Whatsub] 세션 스토리지 정리됨');
      
      // 페이지 상태 초기화
      state.subtitlesEnabled = false;
      state.currentLanguage = 'ko';
      state.subtitleSettings = {
        position: 'bottom',
        fontSize: 'medium',
        background: 'semi',
        dualSubtitles: false
      };
      
      sendResponse({ 
        success: true, 
        message: '세션 스토리지가 정리되었습니다.',
        clearedItems: keysToRemove.length
      });
    } catch (error) {
      console.error('[Whatsub] 세션 스토리지 정리 오류:', error);
      sendResponse({ 
        success: false, 
        error: error.message || '세션 스토리지 정리 중 오류가 발생했습니다.' 
      });
    }
  }
  
  // Whisper AI 관련 메시지 처리
  if (message.action === 'whisperStarted') {
    console.log('[Whatsub] Whisper 음성 인식 시작됨:', message.settings);
    setupSubtitles(); // 자막 UI 설정
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'whisperStopped') {
    console.log('[Whatsub] Whisper 음성 인식 중지됨');
    removeSubtitles(); // 자막 UI 제거
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'whisperSettingsUpdated') {
    console.log('[Whatsub] Whisper 설정 업데이트됨:', message.settings);
    // 설정 적용
    if (message.settings) {
      state.currentLanguage = message.settings.language || state.currentLanguage;
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'newSubtitle') {
    // Whisper에서 새로운 자막 텍스트가 인식되었을 때
    console.log('[Whatsub] 새 자막 수신됨:', message.data);
    
    if (message.data) {
      // 자막 표시
      showSubtitle(message.data.text, message.data.translation);
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateDualSubtitleToggle') {
    // 듀얼 자막 토글 상태 업데이트
    state.subtitleSettings.dualSubtitles = message.enabled;
    
    // 듀얼 자막 토글 체크박스 업데이트
    const dualSubtitleToggle = document.getElementById('whatsub-dual-subtitle-toggle');
    if (dualSubtitleToggle) {
      dualSubtitleToggle.checked = message.enabled;
    }
    
    // 듀얼 언어 선택기 표시/숨김
    const dualLanguageSelector = document.getElementById('whatsub-dual-language-selector');
    if (dualLanguageSelector) {
      dualLanguageSelector.style.display = message.enabled ? 'flex' : 'none';
    }
    
    // 자막 업데이트
    updateSubtitleStyle();
    if (originalTextElement && translatedTextElement) {
      translatedTextElement.style.display = message.enabled ? 'block' : 'none';
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

/**
 * 자막 설정 저장
 * 변경된 자막 설정을 백그라운드 스크립트에 전송하여 저장합니다.
 * 
 * @fires saveSettings - 설정 저장 메시지
 */
function saveSubtitleSettings() {
  chrome.runtime.sendMessage({
    action: 'saveSettings',
    settings: {
      subtitleSettings: state.subtitleSettings
    }
  });
}

/**
 * 자막 스타일 업데이트
 * 설정에 따라 자막 컨테이너의 스타일을 업데이트합니다.
 * 
 * @requires subtitleContainer - 자막 컨테이너 DOM 요소
 * @requires originalTextElement - 원본 자막 텍스트 DOM 요소
 * @requires translatedTextElement - 번역된 자막 텍스트 DOM 요소
 */
function updateSubtitleStyle() {
  if (!subtitleContainer) return;
  
  // 위치 설정
  switch(state.subtitleSettings.position) {
    case 'top':
      subtitleContainer.style.top = '10%';
      subtitleContainer.style.bottom = 'auto';
      break;
    case 'bottom':
      subtitleContainer.style.top = 'auto';
      subtitleContainer.style.bottom = '10%';
      break;
    default:
      subtitleContainer.style.top = 'auto';
      subtitleContainer.style.bottom = '10%';
  }
  
  // 폰트 사이즈 설정
  const fontSizeMap = {
    'small': '16px',
    'medium': '20px',
    'large': '24px'
  };
  
  // 배경 투명도 설정
  const backgroundMap = {
    'transparent': 'rgba(0, 0, 0, 0.4)',
    'semi': 'rgba(0, 0, 0, 0.7)',
    'solid': 'rgba(0, 0, 0, 0.9)'
  };
  
  // 스타일 적용
  if (originalTextElement) {
    originalTextElement.style.fontSize = fontSizeMap[state.subtitleSettings.fontSize];
  }
  
  if (translatedTextElement) {
    translatedTextElement.style.fontSize = fontSizeMap[state.subtitleSettings.fontSize];
    translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
  }
  
  if (subtitleContainer) {
    subtitleContainer.style.backgroundColor = backgroundMap[state.subtitleSettings.background];
  }
}

/**
 * 자막 표시 설정
 * 자막 컨테이너를 생성하고 표시합니다.
 * 
 * @requires state.subtitlesEnabled - 자막 활성화 상태
 * @fires createSubtitleContainer - 자막 컨테이너 생성 함수 호출
 */
function setupSubtitles() {
  console.log('자막 설정 시작...');
  
  // 인증 상태와 상관없이 자막 표시 (인증 확인 제거)
  if (!subtitleContainer) {
    createSubtitleContainer();
  }
  
  // 현재 URL이 YouTube인지 확인하고 처리
  if (isYouTube()) {
    // YouTube 특화 로직
    setupYouTubeSubtitles();
  }
  
  // 자막 컨테이너 표시
  subtitleContainer.style.display = 'block';
  
  console.log('자막 설정 완료');
}

// YouTube 자막 설정
function setupYouTubeSubtitles() {
  // YouTube 특화 코드 (필요한 경우)
  console.log('YouTube 자막 처리 로직');
}

/**
 * 자막 제거
 * 자막 컨테이너를 숨기거나 제거합니다.
 * 
 * @requires subtitleContainer - 자막 컨테이너 DOM 요소
 */
function removeSubtitles() {
  if (subtitleContainer) {
    // 자막 컨테이너 숨기기
    subtitleContainer.style.display = 'none';
  }
}

/**
 * 자막 표시
 * 원본 텍스트와 번역 텍스트를 화면에 표시합니다.
 * 
 * @param {string} original - 원본 자막 텍스트
 * @param {string} translated - 번역된 자막 텍스트
 * @requires subtitleContainer - 자막 컨테이너 DOM 요소
 * @requires originalTextElement - 원본 자막 텍스트 DOM 요소
 * @requires translatedTextElement - 번역된 자막 텍스트 DOM 요소
 */
function showSubtitle(original, translated) {
  if (!subtitleContainer) {
    setupSubtitles();
  }
  
  // 자막 컨테이너가 여전히 없으면 실패
  if (!subtitleContainer) {
    console.error('[Whatsub] 자막 컨테이너를 생성할 수 없습니다.');
    return false;
  }
  
  // 현재 자막 텍스트 저장 (나중에 피드백 등에 사용)
  currentSubtitleText = original;
  
  // 자막 텍스트 설정
  if (originalTextElement) {
    originalTextElement.innerHTML = original || '';
  }
  
  if (translatedTextElement) {
    translatedTextElement.innerHTML = translated || '';
    translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
  }
  
  // 자막 컨테이너 표시
  subtitleContainer.style.display = 'block';
  
  return true;
}

// 자막 드래그 가능하게 만들기
function makeSubtitleDraggable() {
  if (!subtitleContainer) return;
  
  let offsetX, offsetY, isDragging = false;
  
  // 드래그 시작
  subtitleContainer.addEventListener('mousedown', function(e) {
    isDragging = true;
    
    // 변환을 제거하고 현재 위치로 설정
    const rect = subtitleContainer.getBoundingClientRect();
    subtitleContainer.style.transform = 'none';
    subtitleContainer.style.left = rect.left + 'px';
    subtitleContainer.style.top = rect.top + 'px';
    
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    // 커서 변경
    subtitleContainer.style.cursor = 'grabbing';
  });
  
  // 드래그 중
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    // 새 위치 계산
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;
    
    // 위치 업데이트
    subtitleContainer.style.left = newLeft + 'px';
    subtitleContainer.style.top = newTop + 'px';
    subtitleContainer.style.bottom = 'auto';
  });
  
  // 드래그 종료
  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      subtitleContainer.style.cursor = 'grab';
    }
  });
  
  // 마우스 진입 시 커서 변경
  subtitleContainer.addEventListener('mouseenter', function() {
    subtitleContainer.style.cursor = 'grab';
  });
  
  // 마우스 이탈 시 커서 원복
  subtitleContainer.addEventListener('mouseleave', function() {
    if (!isDragging) {
      subtitleContainer.style.cursor = 'default';
    }
  });
  
  // 더블 클릭으로 위치 초기화
  subtitleContainer.addEventListener('dblclick', function() {
    // 원래 위치로 돌아가기
    subtitleContainer.style.left = '50%';
    
    switch (state.subtitleSettings.position) {
      case 'top':
        subtitleContainer.style.top = '10%';
        subtitleContainer.style.bottom = 'auto';
        subtitleContainer.style.transform = 'translateX(-50%)';
        break;
      case 'middle':
        subtitleContainer.style.top = '50%';
        subtitleContainer.style.bottom = 'auto';
        subtitleContainer.style.transform = 'translate(-50%, -50%)';
        break;
      case 'bottom':
      default:
        subtitleContainer.style.top = 'auto';
        subtitleContainer.style.bottom = '10%';
        subtitleContainer.style.transform = 'translateX(-50%)';
        break;
    }
  });
}

// YouTube 확인 함수
function isYouTube() {
  return window.location.hostname.includes('youtube.com');
}

// 컨트롤 패널 이벤트 핸들러
function setupControlPanelEvents() {
  // 자막 켜기/끄기 토글
  const subtitleToggle = document.getElementById('whatsub-subtitle-toggle');
  if (subtitleToggle) {
    subtitleToggle.checked = state.subtitlesEnabled;
    subtitleToggle.addEventListener('change', function() {
      state.subtitlesEnabled = this.checked;
      if (state.subtitlesEnabled) {
        setupSubtitles();
      } else {
        removeSubtitles();
      }
      // 상태 저장
      chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { subtitleEnabled: state.subtitlesEnabled }
      });
      
      // 팝업에 상태 변경 알림 (확장 팝업의 필터 토글과 동기화)
      chrome.runtime.sendMessage({
        action: 'updateFilterToggle',
        enabled: state.subtitlesEnabled
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 필터 토글 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError.message);
        }
      });
    });
  }

  // 언어 선택 이벤트
  const languageSelect = document.getElementById('whatsub-language-select');
  if (languageSelect) {
    // 현재 언어 선택
    Array.from(languageSelect.options).forEach(option => {
      if (option.value === state.currentLanguage) {
        option.selected = true;
      }
    });
    
    languageSelect.addEventListener('change', function() {
      state.currentLanguage = this.value;
      // 언어 변경 메시지 전송
      chrome.runtime.sendMessage({
        action: 'changeLanguage',
        language: state.currentLanguage
      });
      
      // 팝업의 필터 언어 선택과 동기화
      chrome.runtime.sendMessage({
        action: 'updateFilterLanguage',
        language: state.currentLanguage
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 필터 언어 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError.message);
        }
      });
      
      // 현재 자막 다시 번역
      if (currentSubtitleText) {
        translateSubtitle(currentSubtitleText);
      }
    });
  }

  // 듀얼 자막 토글 이벤트
  const dualSubtitleToggle = document.getElementById('whatsub-dual-subtitle-toggle');
  if (dualSubtitleToggle) {
    dualSubtitleToggle.checked = state.subtitleSettings.dualSubtitles;
    dualSubtitleToggle.addEventListener('change', function() {
      state.subtitleSettings.dualSubtitles = this.checked;
      
      // 듀얼 언어 선택기 표시/숨김
      const dualLanguageSelector = document.getElementById('whatsub-dual-language-selector');
      if (dualLanguageSelector) {
        dualLanguageSelector.style.display = this.checked ? 'flex' : 'none';
      }
      
      // 설정 저장
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { dualSubtitles: state.subtitleSettings.dualSubtitles }
      });
      
      // 팝업의 이중 자막 토글과 동기화
      chrome.runtime.sendMessage({
        action: 'updateDualSubtitleToggle',
        enabled: state.subtitleSettings.dualSubtitles
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 이중 자막 토글 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError.message);
        }
      });
      
      // 자막 업데이트
      updateSubtitleStyle();
      if (originalTextElement && translatedTextElement) {
        translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
      }
    });
  }

  // 듀얼 언어 선택 이벤트
  const dualLanguageSelect = document.getElementById('whatsub-dual-language-select');
  if (dualLanguageSelect) {
    // 현재 듀얼 언어 선택
    if (state.subtitleSettings.dualLanguage) {
      Array.from(dualLanguageSelect.options).forEach(option => {
        if (option.value === state.subtitleSettings.dualLanguage) {
          option.selected = true;
        }
      });
    }
    
    dualLanguageSelect.addEventListener('change', function() {
      state.subtitleSettings.dualLanguage = this.value;
      
      // 설정 저장
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { dualLanguage: state.subtitleSettings.dualLanguage }
      });
      
      // 현재 자막 다시 번역 (필요한 경우)
      if (currentSubtitleText && state.subtitleSettings.dualSubtitles) {
        // 듀얼 언어로 다시 번역
        chrome.runtime.sendMessage({
          action: 'translateText',
          text: currentSubtitleText,
          source: 'auto',
          target: state.subtitleSettings.dualLanguage
        }, function(response) {
          if (response && response.success && response.translatedText) {
            // 듀얼 자막 텍스트 업데이트
            if (translatedTextElement) {
              translatedTextElement.textContent = response.translatedText;
            }
          }
        });
      }
    });
  }

  // 자동 자막 토글 이벤트
  const autoSubtitleToggle = document.getElementById('whatsub-auto-subtitle-toggle');
  if (autoSubtitleToggle) {
    autoSubtitleToggle.checked = state.autoSubtitlesEnabled;
    autoSubtitleToggle.addEventListener('change', function() {
      state.autoSubtitlesEnabled = this.checked;
      // 자동 자막 기능 토글
      chrome.runtime.sendMessage({
        action: state.autoSubtitlesEnabled ? 'startSpeechRecognition' : 'stopSpeechRecognition',
        tabId: chrome.runtime.id
      });
    });
  }

  // 피드백 버튼 이벤트
  const likeBtn = document.getElementById('whatsub-like-btn');
  const dislikeBtn = document.getElementById('whatsub-dislike-btn');
  const recommendBtn = document.getElementById('whatsub-recommend-btn');

  if (likeBtn) {
    likeBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      if (this.classList.contains('active') && dislikeBtn) {
        dislikeBtn.classList.remove('active');
      }
      // 피드백 전송
      if (this.classList.contains('active') && currentSubtitleText) {
        chrome.runtime.sendMessage({
          action: 'sendFeedback',
          type: 'like',
          subtitleText: currentSubtitleText
        });
      }
    });
  }

  if (dislikeBtn) {
    dislikeBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      if (this.classList.contains('active') && likeBtn) {
        likeBtn.classList.remove('active');
      }
      // 피드백 전송
      if (this.classList.contains('active') && currentSubtitleText) {
        chrome.runtime.sendMessage({
          action: 'sendFeedback',
          type: 'dislike',
          subtitleText: currentSubtitleText
        });
      }
    });
  }

  if (recommendBtn) {
    recommendBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      // 추천 전송
      if (this.classList.contains('active') && currentSubtitleText) {
        chrome.runtime.sendMessage({
          action: 'sendFeedback',
          type: 'recommend',
          subtitleText: currentSubtitleText
        });
      }
    });
  }

  // 설정 버튼 및 패널 이벤트
  const settingsBtn = document.getElementById('whatsub-settings-btn');
  const settingsPanel = document.getElementById('whatsub-settings-panel');
  const closeSettingsBtn = document.getElementById('whatsub-close-settings');

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', function() {
      settingsPanel.classList.toggle('visible');
    });
  }

  if (closeSettingsBtn && settingsPanel) {
    closeSettingsBtn.addEventListener('click', function() {
      settingsPanel.classList.remove('visible');
    });
  }

  // 위치 버튼 이벤트
  const positionButtons = document.querySelectorAll('.whatsub-settings-choices [data-position]');
  positionButtons.forEach(button => {
    if (button.getAttribute('data-position') === state.subtitleSettings.position) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', function() {
      positionButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      state.subtitleSettings.position = this.getAttribute('data-position');
      updateSubtitleStyle();
      saveSubtitleSettings();
    });
  });

  // 글꼴 크기 버튼 이벤트
  const fontSizeButtons = document.querySelectorAll('.whatsub-settings-choices [data-font-size]');
  fontSizeButtons.forEach(button => {
    if (button.getAttribute('data-font-size') === state.subtitleSettings.fontSize) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', function() {
      fontSizeButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      state.subtitleSettings.fontSize = this.getAttribute('data-font-size');
      updateSubtitleStyle();
      saveSubtitleSettings();
    });
  });

  // 투명도 버튼 이벤트
  const opacityButtons = document.querySelectorAll('.whatsub-settings-choices [data-opacity]');
  opacityButtons.forEach(button => {
    // opacity와 background 설정을 매핑
    const opacityToBackground = {
      'low': 'transparent',
      'medium': 'semi',
      'high': 'solid'
    };
    
    const backgroundToOpacity = {
      'transparent': 'low',
      'semi': 'medium',
      'solid': 'high'
    };
    
    if (backgroundToOpacity[state.subtitleSettings.background] === button.getAttribute('data-opacity')) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', function() {
      opacityButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      state.subtitleSettings.background = opacityToBackground[this.getAttribute('data-opacity')];
      updateSubtitleStyle();
      saveSubtitleSettings();
    });
  });
}

// 설정 로드
function loadSettings() {
  console.log('[Whatsub] 설정 로드 시작...');
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
      if (response && response.settings) {
        console.log('[Whatsub] 설정 로드됨:', response.settings);
        
        // 기본 설정
        if (response.settings.subtitleEnabled !== undefined) {
          state.subtitlesEnabled = response.settings.subtitleEnabled;
        }
        
        if (response.settings.language) {
          state.currentLanguage = response.settings.language;
        }
        
        if (response.settings.autoSubtitlesEnabled !== undefined) {
          state.autoSubtitlesEnabled = response.settings.autoSubtitlesEnabled;
        }
        
        // 자막 설정
        if (response.settings.subtitleSettings) {
          const settings = response.settings.subtitleSettings;
          
          if (settings.position) {
            state.subtitleSettings.position = settings.position;
          }
          
          if (settings.fontSize) {
            state.subtitleSettings.fontSize = settings.fontSize;
          }
          
          if (settings.background) {
            state.subtitleSettings.background = settings.background;
          }
          
          if (settings.dualSubtitles !== undefined) {
            state.subtitleSettings.dualSubtitles = settings.dualSubtitles;
          }
          
          if (settings.dualLanguage) {
            state.subtitleSettings.dualLanguage = settings.dualLanguage;
          }
        }
        
        // 설정에 따라 자막 표시 상태 업데이트
        if (state.subtitlesEnabled) {
          setupSubtitles();
        } else {
          removeSubtitles();
        }
        
        // 자동 자막 상태 업데이트
        if (state.autoSubtitlesEnabled) {
          chrome.runtime.sendMessage({
            action: 'startSpeechRecognition',
            tabId: chrome.runtime.id
          });
        }
        
        // 컨트롤 패널 이벤트 다시 설정
        setupControlPanelEvents();
      }
      resolve(); // Promise 해결
    });
  });
}

// 커뮤니티 서비스와 댓글 관련 컴포넌트 로드
function loadCommunityComponents() {
  try {
    // 컴포넌트 및 서비스 파일 로드 설정
    const components = [
      { name: 'CommentDisplay', path: 'components/CommentDisplay.js' },
      { name: 'communityService', path: 'services/communityService.js' },
      { name: 'videoCommentService', path: 'services/videoCommentService.js' }
    ];
    
    components.forEach(component => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(component.path);
      script.id = `whatsub-${component.name.toLowerCase()}`;
      script.onload = () => {
        console.log(`[Whatsub] ${component.name} 컴포넌트 로드 완료`);
        script.remove(); // DOM에서 스크립트 태그 제거 (이미 실행됨)
      };
      script.onerror = (error) => {
        console.error(`[Whatsub] ${component.name} 컴포넌트 로드 실패:`, error);
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error('[Whatsub] 커뮤니티 컴포넌트 로드 중 오류:', error);
  }
}

// 초기화 함수
function init() {
  console.log('[Whatsub] 콘텐츠 스크립트 초기화 시작');
  
  // 유튜브 페이지 감지
  checkIfYouTubePage();
  
  // 기본 자막 컨테이너 생성
  createSubtitleContainer();
  
  // 메시지 리스너 설정
  setupMessageListeners();
  
  // 설정에 따라 자막 활성화
  loadSettings()
    .then(() => {
      if (state.subtitlesEnabled && (isYouTube() || state.universalMode)) {
        setupSubtitles();
      }
    })
    .catch(error => {
      console.debug('[Whatsub] 설정 로드 중 오류 (무시됨):', error);
    });
  
  // 커뮤니티 기능 로드
  loadCommunityComponents();
  
  console.log('[Whatsub] 콘텐츠 스크립트 초기화 완료');
}

// 자막 컨테이너 생성
function createSubtitleContainer() {
  // 기존 자막 컨테이너가 있으면 제거
  if (subtitleContainer) {
    document.body.removeChild(subtitleContainer);
  }
  
  // 새로운 자막 컨테이너 생성
  subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'whatsub-subtitle-container';
  subtitleContainer.className = 'whatsub-subtitle-container';
  
  // 유니버설 모드일 때는 항상 드래그 가능하게 설정
  subtitleContainer.setAttribute('draggable', 'true');
  
  // 원본 텍스트 요소
  originalTextElement = document.createElement('div');
  originalTextElement.className = 'whatsub-subtitle-text whatsub-original-text';
  
  // 번역 텍스트 요소
  translatedTextElement = document.createElement('div');
  translatedTextElement.className = 'whatsub-subtitle-text whatsub-translated-text';
  
  // 요소 추가
  subtitleContainer.appendChild(originalTextElement);
  subtitleContainer.appendChild(translatedTextElement);
  
  // 컨트롤 패널 추가
  const controlPanel = createControlPanel();
  subtitleContainer.appendChild(controlPanel);
  
  // 드래그 기능 추가
  makeSubtitleDraggable();
  
  // 자막 스타일 업데이트
  updateSubtitleStyle();
  
  // 문서에 추가
  document.body.appendChild(subtitleContainer);
  
  // 초기에는 숨김
  subtitleContainer.style.display = 'none';
  
  // 이벤트 핸들러 설정
  setTimeout(() => {
    setupControlPanelEvents();
  }, 100);
  
  return subtitleContainer;
}

// 컨트롤 패널 생성
function createControlPanel() {
  const controlPanel = document.createElement('div');
  controlPanel.className = 'whatsub-control-panel';
  
  // 자막 켜기/끄기 토글
  const subtitleToggle = document.createElement('div');
  subtitleToggle.className = 'whatsub-control-item';
  subtitleToggle.innerHTML = `
    <span class="whatsub-label">자막</span>
    <label class="whatsub-toggle">
      <input type="checkbox" id="whatsub-subtitle-toggle" checked>
      <span class="whatsub-toggle-slider"></span>
    </label>
  `;
  
  // 자막 언어 선택
  const languageSelector = document.createElement('div');
  languageSelector.className = 'whatsub-control-item';
  languageSelector.innerHTML = `
    <span class="whatsub-label">언어</span>
    <select class="whatsub-select" id="whatsub-language-select">
      <option value="ko">한국어</option>
      <option value="en">영어</option>
      <option value="ja">일본어</option>
      <option value="zh">중국어</option>
      <option value="es">스페인어</option>
      <option value="fr">프랑스어</option>
    </select>
  `;
  
  // 듀얼 자막 토글
  const dualSubtitleToggle = document.createElement('div');
  dualSubtitleToggle.className = 'whatsub-control-item';
  dualSubtitleToggle.innerHTML = `
    <span class="whatsub-label">듀얼 자막</span>
    <label class="whatsub-toggle">
      <input type="checkbox" id="whatsub-dual-subtitle-toggle">
      <span class="whatsub-toggle-slider"></span>
    </label>
  `;
  
  // 듀얼 자막 언어 선택 (초기에는 숨김)
  const dualLanguageSelector = document.createElement('div');
  dualLanguageSelector.className = 'whatsub-control-item';
  dualLanguageSelector.id = 'whatsub-dual-language-selector';
  dualLanguageSelector.style.display = state.subtitleSettings.dualSubtitles ? 'flex' : 'none';
  dualLanguageSelector.innerHTML = `
    <span class="whatsub-label">듀얼 언어</span>
    <select class="whatsub-select" id="whatsub-dual-language-select">
      <option value="ko">한국어</option>
      <option value="en" selected>영어</option>
      <option value="ja">일본어</option>
      <option value="zh">중국어</option>
      <option value="es">스페인어</option>
      <option value="fr">프랑스어</option>
    </select>
  `;
  
  // 자동 자막 토글
  const autoSubtitleToggle = document.createElement('div');
  autoSubtitleToggle.className = 'whatsub-control-item';
  autoSubtitleToggle.innerHTML = `
    <span class="whatsub-label">자동 인식</span>
    <label class="whatsub-toggle">
      <input type="checkbox" id="whatsub-auto-subtitle-toggle">
      <span class="whatsub-toggle-slider"></span>
    </label>
  `;
  
  // 피드백 버튼들
  const feedbackButtons = document.createElement('div');
  feedbackButtons.className = 'whatsub-feedback-buttons';
  feedbackButtons.innerHTML = `
    <button class="whatsub-feedback-btn whatsub-like-btn" id="whatsub-like-btn" title="좋아요">
      <i class="fas fa-thumbs-up"></i>
    </button>
    <button class="whatsub-feedback-btn whatsub-dislike-btn" id="whatsub-dislike-btn" title="싫어요">
      <i class="fas fa-thumbs-down"></i>
    </button>
    <button class="whatsub-feedback-btn whatsub-recommend-btn" id="whatsub-recommend-btn" title="추천하기">
      <i class="fas fa-star"></i>
    </button>
  `;
  
  // 설정 버튼
  const settingsButton = document.createElement('button');
  settingsButton.className = 'whatsub-settings-btn';
  settingsButton.id = 'whatsub-settings-btn';
  settingsButton.innerHTML = '<i class="fas fa-cog"></i>';
  settingsButton.title = '자막 설정';
  
  // 설정 패널
  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'whatsub-settings-panel';
  settingsPanel.id = 'whatsub-settings-panel';
  settingsPanel.innerHTML = `
    <div class="whatsub-settings-header">
      <h3>자막 설정</h3>
      <button class="whatsub-close-btn" id="whatsub-close-settings">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="whatsub-settings-options">
      <div class="whatsub-settings-option">
        <div class="whatsub-settings-label">자막 위치</div>
        <div class="whatsub-settings-choices">
          <button class="whatsub-option-button" data-position="top">상단</button>
          <button class="whatsub-option-button active" data-position="bottom">하단</button>
        </div>
      </div>
      <div class="whatsub-settings-option">
        <div class="whatsub-settings-label">글꼴 크기</div>
        <div class="whatsub-settings-choices">
          <button class="whatsub-option-button" data-font-size="small">작게</button>
          <button class="whatsub-option-button active" data-font-size="medium">중간</button>
          <button class="whatsub-option-button" data-font-size="large">크게</button>
        </div>
      </div>
      <div class="whatsub-settings-option">
        <div class="whatsub-settings-label">배경 투명도</div>
        <div class="whatsub-settings-choices">
          <button class="whatsub-option-button" data-opacity="low">낮음</button>
          <button class="whatsub-option-button active" data-opacity="medium">중간</button>
          <button class="whatsub-option-button" data-opacity="high">높음</button>
        </div>
      </div>
    </div>
  `;
  
  // 컨트롤 패널에 요소들 추가
  controlPanel.appendChild(subtitleToggle);
  controlPanel.appendChild(languageSelector);
  controlPanel.appendChild(dualSubtitleToggle);
  controlPanel.appendChild(dualLanguageSelector);
  controlPanel.appendChild(autoSubtitleToggle);
  controlPanel.appendChild(feedbackButtons);
  controlPanel.appendChild(settingsButton);
  controlPanel.appendChild(settingsPanel);
  
  return controlPanel;
}

// 메시지 리스너 설정 함수 (호환성 유지)
function setupMessageListeners() {
  console.log('[Whatsub] 메시지 리스너가 이미 설정되어 있습니다.');
  // 메시지 리스너는 이미 전역 스코프에 설정되어 있음
}

// 초기화 실행
init(); 