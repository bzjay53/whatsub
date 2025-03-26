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

// 페이지 로드 시 스타일 적용
loadStyles();

// 스타일 주입 함수
function injectStyles() {
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
  
  console.log('[Whatsub] 스타일이 주입되었습니다.');
}

// 전체 상태 객체
const state = {
  subtitlesEnabled: false,
  autoSubtitlesEnabled: false,
  commentsEnabled: false,
  dualSubtitlesEnabled: false,
  floatingCommentsEnabled: false, // 흐르는 댓글 표시 여부
  currentLanguage: 'ko',
  originalLanguage: 'auto',
  defaultSettings: {
    fontSize: 'medium',
    position: 'bottom',
    background: 'semi-transparent'
  },
  subtitleSettings: {
    fontSize: 'medium',
    position: 'bottom',
    background: 'semi-transparent',
    targetLanguage: 'ko',
    sourceLanguage: 'auto',
    dualSubtitles: false
  },
  commentSettings: {
    fontSize: 'small',
    speed: 'normal',
    opacity: 0.8,
    maxDisplayed: 10
  },
  userId: null,                      // 사용자 ID
  isLoggedIn: false,                 // 로그인 상태
  subtitleActive: false,             // 자막 활성화 상태
  subtitleLanguage: 'ko',            // 자막 언어 (기본값: 한국어)
  subtitlePosition: 'bottom',        // 자막 위치 (bottom, middle, top)
  subtitleFontSize: 'medium',        // 자막 폰트 크기 (small, medium, large, xlarge)
  subtitleBackground: 'medium',      // 자막 배경 (none, low, medium, high)
  dualSubtitles: false,              // 이중 자막 모드 (원본 + 번역)
  currentText: '',                   // 현재 표시 중인 자막 텍스트
  speechRecognitionActive: false,    // 음성 인식 활성화 상태
  universalMode: false,              // 유니버설 모드 (모든 페이지에서 자막 표시)
  overlayActive: false,              // 오버레이 UI 활성화 상태
  debug: false,                      // 디버그 모드
  translationCache: {},              // 번역 결과 캐시 (성능 최적화)
  lastRecognitionTime: 0             // 마지막 인식 시간 (타임스탬프)
};

// 사용자 상태 객체 추가
const userState = {
  isLoggedIn: false,
  subscriptionType: 'free', // 'free' 또는 'premium'
  features: {
    autoSubtitles: false,
    dualSubtitles: false,
    comments: false,
    floatingComments: false
  }
};

// 자막 컨테이너 요소
let subtitleContainer = null;
let subtitleTextContainer = null;
let originalTextElement = null;
let translatedTextElement = null;
let commentsContainer = null; // 댓글 컨테이너 추가
let currentSubtitleText = null;
let currentSubtitleId = null;
let currentVideoId = null;
let currentTimestamp = 0;

// 자막 관련 설정
let lastSubtitleText = '';
let isYouTubePage = false;
let youtubeObserver = null;

// 언어 목록 정의
const languages = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: '영어' },
  { code: 'ja', name: '일본어' },
  { code: 'zh', name: '중국어' },
  { code: 'es', name: '스페인어' },
  { code: 'fr', name: '프랑스어' }
];

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
  try {
    // 번역할 텍스트가 없으면 무시
    if (!text || text.trim() === '') {
      updateSubtitles(text, '');
      return;
    }
    
    // 현재 설정된 언어 확인
    const targetLanguage = state.subtitleSettings.targetLanguage || state.currentLanguage || 'ko';
    
    console.log(`[Whatsub] 자막 번역 시도: ${text.substring(0, 30)}... -> ${targetLanguage}`);
    
    // 번역 요청
    const response = await chrome.runtime.sendMessage({
      action: 'translateText',
      text: text,
      source: state.originalLanguage || 'auto',
      target: targetLanguage
    });
    
    // 응답 처리
    if (response && response.success) {
      console.log(`[Whatsub] 번역 완료: ${response.translatedText.substring(0, 30)}...`);
      updateSubtitles(text, response.translatedText);
    } else {
      console.error('[Whatsub] 번역 응답 오류:', response?.error);
      // 번역 실패시에도 원본은 표시
      updateSubtitles(text, '');
    }
  } catch (error) {
    console.error('[Whatsub] 자막 번역 중 오류:', error);
    // 오류 발생시에도 원본은 표시
    updateSubtitles(text, '');
  }
}

// 자막 업데이트 함수
function updateSubtitles(originalText, translatedText) {
  // 자막 텍스트 저장
  currentSubtitleText = originalText;
  currentTranslatedText = translatedText;
  
  // 자막 요소 업데이트
  if (originalTextElement) {
    originalTextElement.textContent = originalText || "";
    originalTextElement.style.display = originalText ? "block" : "none";
  }
  
  if (translatedTextElement) {
    translatedTextElement.textContent = translatedText || "";
    translatedTextElement.style.display = (translatedText && state.subtitleSettings.dualSubtitles) ? "block" : "none";
  }
  
  // 자막 컨테이너가 숨겨져 있으면 표시
  if (subtitleContainer && subtitleContainer.style.display === "none") {
    subtitleContainer.style.display = "block";
  }
}

// 메시지 리스너 설정
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    try {
      console.log('[Whatsub] 메시지 수신:', request.action);
      
      switch(request.action) {
        case 'toggleSubtitles':
          // 자막 켜기/끄기
          state.subtitlesEnabled = request.enabled;
          if (state.subtitlesEnabled) {
            setupSubtitles();
          } else {
            removeSubtitles();
          }
          sendResponse({ success: true });
          break;
          
        case 'changeLanguage':
          // 언어 변경
          state.subtitleSettings.targetLanguage = request.language;
          // 현재 표시 중인 자막이 있으면 다시 번역
          if (currentSubtitleText) {
            translateSubtitle(currentSubtitleText);
          }
          sendResponse({ success: true });
          break;
          
        case 'showTestSubtitle':
          // 테스트 자막 표시
          showSubtitle(request.original, request.translated);
          sendResponse({ success: true });
          break;
          
        case 'updateSettings':
          // 설정 업데이트
          if (request.settings) {
            Object.assign(state.subtitleSettings, request.settings);
            updateSubtitleStyle();
            saveSettings();
          }
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: '알 수 없는 명령입니다.' });
      }
      
      return true; // 비동기 응답을 위해 true 반환
    } catch (error) {
      console.error('[Whatsub] 메시지 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  });
}

// 자막 설정 저장
function saveSettings() {
  chrome.runtime.sendMessage({
    action: 'saveSettings',
    settings: {
      subtitleEnabled: state.subtitlesEnabled,
      subtitleSettings: state.subtitleSettings,
      commentsEnabled: state.commentsEnabled,
      floatingCommentsEnabled: state.floatingCommentsEnabled,
      currentLanguage: state.currentLanguage
    }
  });
}

// 자막 스타일 업데이트
function updateSubtitleStyle() {
  if (!subtitleContainer || !subtitleTextContainer) return;
  
  // 위치 설정
  switch(state.subtitleSettings.position) {
    case 'top':
      subtitleContainer.style.top = '10%';
      subtitleContainer.style.bottom = 'auto';
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
    originalTextElement.style.color = '#ffffff';
    originalTextElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
    originalTextElement.style.marginBottom = '4px';
  }
  
  if (translatedTextElement) {
    translatedTextElement.style.fontSize = fontSizeMap[state.subtitleSettings.fontSize];
    translatedTextElement.style.color = '#ffffff';
    translatedTextElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
    translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
  }
  
  if (subtitleTextContainer) {
    subtitleTextContainer.style.backgroundColor = backgroundMap[state.subtitleSettings.background];
    subtitleTextContainer.style.padding = '8px 16px';
    subtitleTextContainer.style.borderRadius = '4px';
    subtitleTextContainer.style.maxWidth = '80vw';
    subtitleTextContainer.style.textAlign = 'center';
  }
  
  if (subtitleContainer) {
    subtitleContainer.style.transition = 'all 0.3s ease';
  }
}

// 자막 표시 설정
function setupSubtitles() {
  console.log('[Whatsub] 자막 설정 시작...');
  
  try {
    if (!subtitleContainer) {
      createSubtitleContainer();
    }
    
    // 자막 컨테이너 추가
    injectSubtitleContainer();
    
    // 컨트롤 패널 추가
    injectControlPanel();
    
    // 댓글 컨테이너 추가
    injectCommentsContainer();
    
    // 흐름 댓글 컨테이너 추가
    injectFloatingCommentsContainer();
    
    // 현재 URL이 YouTube인지 확인하고 처리
    if (isYouTube()) {
      // YouTube 특화 로직
      setupYouTubeSubtitles();
    }
    
    // 자막 상태 업데이트
    state.subtitlesEnabled = true;
    
    // 자막 컨테이너 표시
    if (subtitleContainer) {
      subtitleContainer.style.display = 'block';
      // 초기 자막이 없는 경우를 위한 처리
      if (!currentSubtitleText) {
        showSubtitle("자막이 준비되었습니다. 미디어가 재생되면 자막이 표시됩니다.", 
                    "Subtitles are ready. When media plays, subtitles will be displayed.");
      }
    }
    
    // 설정 저장
    saveSettings();
    
    console.log('[Whatsub] 자막 설정 완료');
  } catch (error) {
    console.error('[Whatsub] 자막 설정 중 오류:', error);
  }
}

// 자막 컨테이너 주입
function injectSubtitleContainer() {
  // 이미 존재하는지 확인
  if (!document.getElementById('whatsub-subtitle-container') && subtitleContainer) {
    document.body.appendChild(subtitleContainer);
  }
}

// 컨트롤 패널 주입
function injectControlPanel() {
  // 컨트롤 패널 추가 - 이미 createSubtitleContainer에서 처리됨
  setupControlPanelEvents();
}

// 댓글 컨테이너 주입
function injectCommentsContainer() {
  // 이미 createSubtitleContainer에서 처리됨
  setupCommentsFeature();
}

// YouTube 자막 설정
function setupYouTubeSubtitles() {
  // YouTube 자막 요소 감시 시작
  startYouTubeObserver();
  
  // 초기 자막 상태 확인
  checkForYouTubeSubtitles();
}

// 자막 제거
function removeSubtitles() {
  console.log('[Whatsub] 자막 제거');
  if (subtitleContainer) {
    subtitleContainer.style.display = 'none';
  }
  // 자막 상태 업데이트
  state.subtitlesEnabled = false;
  saveSettings();
}

// 자막 표시
function showSubtitle(originalText, translatedText) {
  try {
    if (!subtitleContainer) {
      createSubtitleContainer();
      document.body.appendChild(subtitleContainer);
    }
    
    if (!originalTextElement || !translatedTextElement) {
      console.error('[Whatsub] 자막 요소가 초기화되지 않았습니다.');
      return false;
    }
    
    // 원본 자막 설정
    if (originalText) {
      originalTextElement.textContent = originalText;
      originalTextElement.style.display = 'block';
    } else {
      originalTextElement.style.display = 'none';
    }
    
    // 번역 자막 설정
    if (translatedText) {
      translatedTextElement.textContent = translatedText;
      translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
    } else {
      translatedTextElement.style.display = 'none';
    }
    
    // 자막 컨테이너 표시
    if (subtitleContainer) {
      subtitleContainer.style.display = 'block';
      
      // 현재 자막 텍스트 저장
      currentSubtitleText = originalText;
      
      // 자막 ID 생성
      currentSubtitleId = hashSubtitle(originalText);
      
      // 현재 동영상 ID 저장
      currentVideoId = getVideoId();
      
      // 현재 시간 저장
      currentTimestamp = getCurrentTime();
      
      // 댓글 업데이트
      if (state.commentsEnabled) {
        loadComments(currentVideoId, currentSubtitleId);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[Whatsub] 자막 표시 중 오류:', error);
    return false;
  }
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
  try {
    console.log('[Whatsub] 컨트롤 패널 이벤트 설정 중...');
    
    // 자막 켜기/끄기 토글
    const subtitleToggle = document.getElementById('whatsub-toggle-subtitles');
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
      });
    }
    
    // 자동 자막 토글 이벤트
    const autoSubtitleToggle = document.getElementById('whatsub-auto-subtitles');
    if (autoSubtitleToggle) {
      autoSubtitleToggle.checked = state.autoSubtitlesEnabled;
      autoSubtitleToggle.disabled = !userState.features.autoSubtitles;
      
      autoSubtitleToggle.addEventListener('change', function() {
        if (!userState.features.autoSubtitles) {
          this.checked = false;
          alert('자동 자막 기능은 프리미엄 회원만 사용할 수 있습니다.');
          return;
        }
        
        state.autoSubtitlesEnabled = this.checked;
        
        // 자동 자막 기능 토글
        if (state.autoSubtitlesEnabled) {
          console.log('[Whatsub] 자동 자막 활성화 시도');
          whisperAI.start();
        } else {
          console.log('[Whatsub] 자동 자막 비활성화');
          whisperAI.stop();
        }
        
        // 상태 저장
        saveSettings();
      });
    }
    
    // 듀얼 자막 토글 이벤트
    const dualSubtitleToggle = document.getElementById('whatsub-dual-subtitles');
    const singleLanguageSelector = document.querySelector('.whatsub-single-language');
    const dualLanguageSelector = document.querySelector('.whatsub-dual-language');
    
    if (dualSubtitleToggle) {
      dualSubtitleToggle.checked = state.subtitleSettings.dualSubtitles;
      
      // 초기 상태에 따라 표시할 언어 선택기 결정
      if (singleLanguageSelector && dualLanguageSelector) {
        if (state.subtitleSettings.dualSubtitles) {
          singleLanguageSelector.style.display = 'none';
          dualLanguageSelector.style.display = 'block';
        } else {
          singleLanguageSelector.style.display = 'flex';
          dualLanguageSelector.style.display = 'none';
        }
      }
      
      dualSubtitleToggle.addEventListener('change', function() {
        state.subtitleSettings.dualSubtitles = this.checked;
        
        // 언어 선택기 전환
        if (singleLanguageSelector && dualLanguageSelector) {
          if (state.subtitleSettings.dualSubtitles) {
            singleLanguageSelector.style.display = 'none';
            dualLanguageSelector.style.display = 'block';
          } else {
            singleLanguageSelector.style.display = 'flex';
            dualLanguageSelector.style.display = 'none';
          }
        }
        
        // 설정 저장
        chrome.runtime.sendMessage({
          action: 'updateSettings',
          settings: { dualSubtitles: state.subtitleSettings.dualSubtitles }
        });
        
        // 자막 업데이트
        updateSubtitleStyle();
        if (originalTextElement && translatedTextElement) {
          translatedTextElement.style.display = state.subtitleSettings.dualSubtitles ? 'block' : 'none';
        }
      });
    }
    
    // 단일 언어 선택 이벤트
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
        // 현재 자막 다시 번역
        if (currentSubtitleText) {
          translateSubtitle(currentSubtitleText);
        }
      });
    }
    
    // 듀얼 모드 원본 언어 선택 이벤트
    const originalLanguageSelect = document.getElementById('whatsub-original-language-select');
    if (originalLanguageSelect) {
      // 현재 원본 언어 선택
      Array.from(originalLanguageSelect.options).forEach(option => {
        if (option.value === state.originalLanguage) {
          option.selected = true;
        }
      });
      
      originalLanguageSelect.addEventListener('change', function() {
        state.originalLanguage = this.value;
        
        // 원본 언어와 번역 언어가 동일한 경우, 번역 언어 자동 변경
        const translatedLanguageSelect = document.getElementById('whatsub-translated-language-select');
        if (translatedLanguageSelect && state.originalLanguage === state.currentLanguage) {
          // 기본 대체 언어 설정 (영어가 아니면 영어로, 영어면 한국어로)
          const fallbackLanguage = state.originalLanguage === 'en' ? 'ko' : 'en';
          state.currentLanguage = fallbackLanguage;
          
          // 번역 언어 드롭다운 업데이트
          Array.from(translatedLanguageSelect.options).forEach(option => {
            option.selected = option.value === fallbackLanguage;
          });
        }
        
        // 언어 변경 메시지 전송
        chrome.runtime.sendMessage({
          action: 'changeOriginalLanguage',
          language: state.originalLanguage
        });
        
        // 현재 자막 다시 번역
        if (currentSubtitleText) {
          translateSubtitle(currentSubtitleText);
        }
      });
    }
    
    // 듀얼 모드 번역 언어 선택 이벤트
    const translatedLanguageSelect = document.getElementById('whatsub-translated-language-select');
    if (translatedLanguageSelect) {
      // 현재 번역 언어 선택
      Array.from(translatedLanguageSelect.options).forEach(option => {
        if (option.value === state.currentLanguage) {
          option.selected = true;
        }
      });
      
      translatedLanguageSelect.addEventListener('change', function() {
        // 원본 언어와 동일한 언어로 설정하지 못하도록 방지
        if (this.value === state.originalLanguage) {
          alert('원본 언어와 동일한 언어로 설정할 수 없습니다.');
          
          // 이전 선택으로 되돌림
          Array.from(this.options).forEach(option => {
            option.selected = option.value === state.currentLanguage;
          });
          return;
        }
        
        state.currentLanguage = this.value;
        
        // 언어 변경 메시지 전송
        chrome.runtime.sendMessage({
          action: 'changeLanguage',
          language: state.currentLanguage
        });
        
        // 현재 자막 다시 번역
        if (currentSubtitleText) {
          translateSubtitle(currentSubtitleText);
        }
      });
    }
    
    // 언어 전환 버튼 이벤트
    const swapButton = document.getElementById('whatsub-language-swap');
    if (swapButton) {
      swapButton.addEventListener('click', function() {
        // 현재 선택된 언어 가져오기
        const originalSelect = document.getElementById('whatsub-original-language-select');
        const translatedSelect = document.getElementById('whatsub-translated-language-select');
        
        if (originalSelect && translatedSelect) {
          // 현재 값 저장
          const originalValue = originalSelect.value;
          const translatedValue = translatedSelect.value;
          
          // 값 교환
          state.originalLanguage = translatedValue;
          state.currentLanguage = originalValue;
          
          // 드롭다운 업데이트
          Array.from(originalSelect.options).forEach(option => {
            option.selected = option.value === translatedValue;
          });
          
          Array.from(translatedSelect.options).forEach(option => {
            option.selected = option.value === originalValue;
          });
          
          // 언어 변경 메시지 전송
          chrome.runtime.sendMessage({
            action: 'changeOriginalLanguage',
            language: state.originalLanguage
          });
          
          chrome.runtime.sendMessage({
            action: 'changeLanguage',
            language: state.currentLanguage
          });
          
          // 자막 업데이트
          if (currentSubtitleText) {
            translateSubtitle(currentSubtitleText);
          }
        }
      });
    }
    
    // 댓글 토글 이벤트
    const commentsToggle = document.getElementById('whatsub-comments-toggle');
    if (commentsToggle) {
      commentsToggle.checked = state.commentsEnabled;
      commentsToggle.addEventListener('change', function() {
        state.commentsEnabled = this.checked;
        
        if (state.commentsEnabled) {
          showComments();
          // 현재 자막에 댓글 로드
          loadComments(currentVideoId || getVideoId(), currentSubtitleId);
        } else {
          hideComments();
        }
        
        // 설정 저장
        saveSettings();
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
        saveSettings();
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
        saveSettings();
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
        saveSettings();
      });
    });
    
    // 자막 토글과 자동 자막 토글 연동
    setupSubtitleToggleSync();
    
    console.log('[Whatsub] 컨트롤 패널 이벤트 설정 완료');
  } catch (error) {
    console.error('[Whatsub] 컨트롤 패널 이벤트 설정 오류:', error);
  }
}

// 설정 로드
function loadSettings() {
  console.log('[Whatsub] 설정 로드 시작...');
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
      
      if (response.settings.originalLanguage) {
        state.originalLanguage = response.settings.originalLanguage;
      }
      
      if (response.settings.autoSubtitlesEnabled !== undefined) {
        state.autoSubtitlesEnabled = response.settings.autoSubtitlesEnabled;
      }
      
      if (response.settings.commentsEnabled !== undefined) {
        state.commentsEnabled = response.settings.commentsEnabled;
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
      
      // 댓글 기능 상태 업데이트
      if (state.commentsEnabled && commentsContainer) {
        commentsContainer.style.display = 'flex';
      } else if (commentsContainer) {
        commentsContainer.style.display = 'none';
      }
      
      // 컨트롤 패널 이벤트 다시 설정
      setupControlPanelEvents();
    }
  });
}

// 초기화 함수
function init() {
  try {
    console.log('Whatsub 콘텐츠 스크립트 초기화 시작...');
    
    // 스타일 로드
    loadStyles();
    
    // 로컬 스토리지에서 설정 로드
    chrome.storage.sync.get(
      ['subtitleEnabled', 'subtitleLanguage', 'subtitleSettings', 'universalMode'], 
      function(data) {
        console.log('설정 로드 결과:', data);
        
        // 자막 활성화 상태 설정
        state.subtitleActive = data.subtitleEnabled === true;
        
        // 언어 설정
        if (data.subtitleLanguage) {
          state.subtitleLanguage = data.subtitleLanguage;
        }
        
        // 자막 설정 적용
        if (data.subtitleSettings) {
          if (data.subtitleSettings.position) {
            state.subtitlePosition = data.subtitleSettings.position;
          }
          if (data.subtitleSettings.fontSize) {
            state.subtitleFontSize = data.subtitleSettings.fontSize;
          }
          if (data.subtitleSettings.background) {
            state.subtitleBackground = data.subtitleSettings.background;
          }
          if (data.subtitleSettings.hasOwnProperty('dualSubtitles')) {
            state.dualSubtitles = data.subtitleSettings.dualSubtitles;
          }
        }
        
        // 유니버설 모드 설정
        state.universalMode = data.universalMode === true;
        
        // 로그
        console.log('Whatsub 설정 로드 완료:', {
          활성화: state.subtitleActive,
          언어: state.subtitleLanguage,
          이중자막: state.dualSubtitles,
          위치: state.subtitlePosition,
          폰트크기: state.subtitleFontSize,
          배경: state.subtitleBackground,
          유니버설모드: state.universalMode
        });
        
        // 자막이 활성화되어 있으면 초기 설정
        if (state.subtitleActive) {
          setupSubtitleContainer();
          console.log('자막 컨테이너 초기 설정 완료');
        }
      }
    );
    
    // 메시지 리스너 설정
    setupMessageListeners();
    
    console.log('Whatsub 콘텐츠 스크립트 초기화 완료');
    
    // 15초 후 자막 컨테이너 생성 확인
    setTimeout(() => {
      if (state.subtitleActive) {
        const container = document.getElementById('whatsub-subtitles');
        if (!container) {
          console.log('자막 컨테이너가 없어 다시 생성');
          setupSubtitleContainer();
        }
      }
    }, 15000);
    
  } catch (error) {
    console.error('Whatsub 초기화 중 오류 발생:', error);
  }
}

// 자막 컨테이너 생성 함수 수정
function createSubtitleContainer() {
  // 기존 자막 컨테이너가 있으면 제거
  const existingContainer = document.getElementById('whatsub-subtitle-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 새로운 자막 컨테이너 생성
  subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'whatsub-subtitle-container';
  subtitleContainer.className = 'whatsub-subtitle-container';
  
  // 기본 스타일 설정
  subtitleContainer.style.position = 'fixed';
  subtitleContainer.style.left = '50%';
  subtitleContainer.style.transform = 'translateX(-50%)';
  subtitleContainer.style.zIndex = '999999';
  
  // 자막 텍스트 컨테이너
  subtitleTextContainer = document.createElement('div');
  subtitleTextContainer.className = 'whatsub-subtitle-text-container';
  subtitleTextContainer.style.pointerEvents = 'none'; // 자막 텍스트는 클릭 불가
  
  // 원본 텍스트 요소
  originalTextElement = document.createElement('div');
  originalTextElement.className = 'whatsub-subtitle-text whatsub-original-text';
  originalTextElement.style.display = 'none';
  originalTextElement.style.pointerEvents = 'none';
  
  // 번역 텍스트 요소
  translatedTextElement = document.createElement('div');
  translatedTextElement.className = 'whatsub-subtitle-text whatsub-translated-text';
  translatedTextElement.style.display = 'none';
  translatedTextElement.style.pointerEvents = 'none';
  
  // 요소 추가
  subtitleTextContainer.appendChild(originalTextElement);
  subtitleTextContainer.appendChild(translatedTextElement);
  subtitleContainer.appendChild(subtitleTextContainer);
  
  // 컨트롤 패널 추가
  const controlPanel = createControlPanel();
  controlPanel.style.pointerEvents = 'auto'; // 컨트롤 패널은 클릭 가능
  controlPanel.style.opacity = '1';
  controlPanel.style.transition = 'opacity 0.5s ease-in-out';
  subtitleContainer.appendChild(controlPanel);
  
  // 드래그 기능 추가
  makeSubtitleDraggable();
  
  // 자막 스타일 업데이트
  updateSubtitleStyle();
  
  // 초기에는 숨김
  subtitleContainer.style.display = 'none';
  
  // 마우스 움직임 감지 설정
  setupMouseMovementDetection(subtitleContainer, controlPanel);
  
  return subtitleContainer;
}

// 마우스가 특정 요소 위에 있는지 확인
function isMouseOverElement(element) {
  const rect = element.getBoundingClientRect();
  // event 객체를 직접 사용하는 대신 마우스 이벤트에서 받아오도록 수정
  
  return function(e) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    return (
      mouseX >= rect.left &&
      mouseX <= rect.right &&
      mouseY >= rect.top &&
      mouseY <= rect.bottom
    );
  };
}

// 마우스 움직임 감지 설정 수정
function setupMouseMovementDetection(container, controlPanel) {
  let hideTimeout;
  const hideDelay = 3000; // 3초 후 숨김
  let lastMouseEvent = null;
  
  function showControlPanel(e) {
    lastMouseEvent = e;
    
    if (controlPanel) {
      controlPanel.style.opacity = '1';
    }
    
    // 이전 타이머 취소
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    
    // 새 타이머 설정
    hideTimeout = setTimeout(() => {
      if (controlPanel && lastMouseEvent && !isMouseOverElement(controlPanel)(lastMouseEvent)) {
        controlPanel.style.opacity = '0';
      }
    }, hideDelay);
  }
  
  // 마우스 움직임 이벤트
  container.addEventListener('mousemove', showControlPanel);
  
  // 마우스 진입/이탈 이벤트
  container.addEventListener('mouseenter', showControlPanel);
  
  controlPanel.addEventListener('mouseenter', (e) => {
    lastMouseEvent = e;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    controlPanel.style.opacity = '1';
  });
  
  controlPanel.addEventListener('mouseleave', (e) => {
    lastMouseEvent = e;
    hideTimeout = setTimeout(() => {
      controlPanel.style.opacity = '0';
    }, hideDelay);
  });
  
  // 초기 실행 (3초 후 자동으로 숨김)
  hideTimeout = setTimeout(() => {
    if (controlPanel) {
      controlPanel.style.opacity = '0';
    }
  }, hideDelay);
}

// 댓글 컨테이너 생성
function createCommentsContainer() {
  const container = document.createElement('div');
  container.id = 'whatsub-comments-container';
  container.className = 'whatsub-comments-container';
  container.style.display = 'none'; // 초기에는 숨겨진 상태
  
  // 댓글 헤더
  const commentsHeader = document.createElement('div');
  commentsHeader.className = 'whatsub-comments-header';
  commentsHeader.innerHTML = `
    <span class="whatsub-comments-title">댓글 <span class="whatsub-comments-count">0</span></span>
    <div class="whatsub-comments-buttons">
      <button id="whatsub-load-test-comments" class="whatsub-test-btn" title="테스트 댓글 로드">
        테스트 댓글
      </button>
      <button id="whatsub-close-comments" class="whatsub-close-btn" title="댓글창 닫기">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  // 댓글 목록
  const commentsList = document.createElement('div');
  commentsList.id = 'whatsub-comments-list';
  commentsList.className = 'whatsub-comments-list';
  
  // 댓글 입력
  const commentInput = document.createElement('div');
  commentInput.className = 'whatsub-comment-input-container';
  commentInput.innerHTML = `
    <textarea id="whatsub-comment-input" placeholder="댓글을 입력하세요..."></textarea>
    <div class="whatsub-comment-options">
      <input type="number" id="whatsub-comment-time" min="0" step="1" placeholder="시간(초)" title="이 댓글이 표시될 영상 시간(초)" value="${getCurrentTime() || 0}">
      <select id="whatsub-comment-type">
        <option value="normal">일반 댓글</option>
        <option value="floating">흐름 댓글</option>
      </select>
      <button id="whatsub-comment-submit" class="whatsub-comment-submit-btn" title="댓글 제출">
        <i class="fas fa-paper-plane"></i> 전송
      </button>
    </div>
  `;
  
  // 컨테이너에 추가
  container.appendChild(commentsHeader);
  container.appendChild(commentsList);
  container.appendChild(commentInput);
  
  return container;
}

// 댓글 기능 초기화 수정
function setupCommentsFeature() {
  // 댓글 토글 이벤트
  const commentsToggle = document.getElementById('whatsub-comments-toggle');
  if (commentsToggle) {
    commentsToggle.checked = state.commentsEnabled;
    commentsToggle.addEventListener('change', function() {
      state.commentsEnabled = this.checked;
      
      if (state.commentsEnabled) {
        showComments();
      } else {
        hideComments();
      }
      
      // 설정 저장
      saveSettings();
    });
  }
  
  // 댓글 닫기 버튼 이벤트
  const closeCommentsBtn = document.getElementById('whatsub-close-comments');
  if (closeCommentsBtn) {
    closeCommentsBtn.addEventListener('click', function() {
      hideComments();
      
      // 댓글 창만 닫고 흐름 댓글은 유지
    });
  }
  
  // 테스트 댓글 버튼 이벤트
  const loadTestCommentsBtn = document.getElementById('whatsub-load-test-comments');
  if (loadTestCommentsBtn) {
    loadTestCommentsBtn.addEventListener('click', function() {
      loadTestComments();
      
      // 테스트 모드 활성화 메시지
      const commentsList = document.getElementById('whatsub-comments-list');
      if (commentsList) {
        const testModeMsg = document.createElement('div');
        testModeMsg.className = 'whatsub-test-mode-message';
        testModeMsg.textContent = '테스트 모드: 5초 간격으로 자동 댓글이 표시됩니다';
        commentsList.insertBefore(testModeMsg, commentsList.firstChild);
      }
    });
  }
  
  // 댓글 제출 버튼 이벤트
  const commentSubmitBtn = document.getElementById('whatsub-comment-submit');
  const commentInput = document.getElementById('whatsub-comment-input');
  
  if (commentSubmitBtn && commentInput) {
    commentSubmitBtn.addEventListener('click', function() {
      submitComment(commentInput.value);
    });
    
    // 엔터 키로 제출
    commentInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment(this.value);
      }
    });
  }
  
  // 댓글 작성 버튼 이벤트
  const commentBtn = document.getElementById('whatsub-comment-btn');
  if (commentBtn) {
    commentBtn.addEventListener('click', function() {
      // 댓글 폼 표시
      showComments();
      
      // 입력 필드에 포커스
      const commentInput = document.getElementById('whatsub-comment-input');
      if (commentInput) {
        commentInput.focus();
      }
    });
  }
  
  // 초기화 시 비디오 타임스탬프에 맞는 댓글 로드
  loadCommentsForCurrentTime();
  
  // 비디오 시간 변경 감지를 위한 타이머 설정
  setInterval(checkVideoTimeForComments, 1000);
}

// 댓글 제출 함수
function submitComment(text) {
  if (!text || text.trim() === '') return;
  
  const commentInput = document.getElementById('whatsub-comment-input');
  if (!commentInput) return;
  
  // 시간 및 유형 데이터 가져오기
  const timeInput = document.getElementById('whatsub-comment-time');
  const typeSelect = document.getElementById('whatsub-comment-type');
  
  // 값 확인 후 기본값 설정
  const timestamp = timeInput ? parseFloat(timeInput.value) || getCurrentTime() || 0 : getCurrentTime() || 0;
  const commentType = typeSelect ? typeSelect.value : 'normal';
  
  // 입력 필드 초기화
  commentInput.value = '';
  
  // 현재 비디오 정보와 시간 가져오기
  const videoInfo = {
    videoId: currentVideoId || getVideoId() || 'test_video',
    subtitleId: currentSubtitleId || 'test_subtitle',
    subtitleText: currentSubtitleText || 'Test subtitle',
    timestamp: timestamp,
    text: text.trim(),
    type: commentType
  };
  
  console.log('[Whatsub] 댓글 제출:', videoInfo);
  
  // 테스트 모드: 서버 전송 없이 즉시 표시
  const commentId = `test_${Date.now()}`;
  const newComment = {
    id: commentId,
    user: {
      name: '테스트 사용자',
      avatar: 'https://via.placeholder.com/24'
    },
    text: text.trim(),
    timestamp: new Date().toISOString(),
    likes: 0,
    videoTime: timestamp
  };
  
  // 댓글 목록에 추가 (일반 댓글인 경우)
  if (commentType === 'normal' || commentType === 'both') {
    addCommentToList(newComment);
    updateCommentsCount();
  }
  
  // 흐름 댓글로 표시 (흐름 댓글인 경우)
  if (commentType === 'floating' || commentType === 'both') {
    displayFloatingComment(newComment);
  }
  
  showMessage('댓글이 추가되었습니다.');
}

// 댓글 창 표시 및 초기화
function showComments() {
  const commentsContainer = document.getElementById('whatsub-comments-container');
  if (!commentsContainer) return;
  
  commentsContainer.style.display = 'flex';
  state.commentsShown = true;
  
  // 댓글 입력창에 포커스
  setTimeout(() => {
    const commentInput = document.getElementById('whatsub-comment-input');
    if (commentInput) {
      commentInput.focus();
    }
  }, 100);
  
  // 상태 저장
  saveSettings();
}

// 댓글 창 숨기기
function hideComments() {
  const commentsContainer = document.getElementById('whatsub-comments-container');
  if (!commentsContainer) return;
  
  commentsContainer.style.display = 'none';
  state.commentsShown = false;
  
  // 상태 저장
  saveSettings();
}

// 댓글 컨테이너 생성
function createCommentsContainer() {
  const container = document.createElement('div');
  container.id = 'whatsub-comments-container';
  container.className = 'whatsub-comments-container';
  container.style.display = 'none'; // 초기에는 숨겨진 상태
  
  // 댓글 헤더
  const commentsHeader = document.createElement('div');
  commentsHeader.className = 'whatsub-comments-header';
  commentsHeader.innerHTML = `
    <span class="whatsub-comments-title">댓글 <span class="whatsub-comments-count">0</span></span>
    <div class="whatsub-comments-buttons">
      <button id="whatsub-load-test-comments" class="whatsub-test-btn" title="테스트 댓글 로드">
        테스트 댓글
      </button>
      <button id="whatsub-close-comments" class="whatsub-close-btn" title="댓글창 닫기">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  // 댓글 목록
  const commentsList = document.createElement('div');
  commentsList.id = 'whatsub-comments-list';
  commentsList.className = 'whatsub-comments-list';
  
  // 댓글 입력
  const commentInput = document.createElement('div');
  commentInput.className = 'whatsub-comment-input-container';
  commentInput.innerHTML = `
    <textarea id="whatsub-comment-input" placeholder="댓글을 입력하세요..."></textarea>
    <div class="whatsub-comment-options">
      <input type="number" id="whatsub-comment-time" min="0" step="1" placeholder="시간(초)" title="이 댓글이 표시될 영상 시간(초)" value="${getCurrentTime() || 0}">
      <select id="whatsub-comment-type">
        <option value="normal">일반 댓글</option>
        <option value="floating">흐름 댓글</option>
      </select>
      <button id="whatsub-comment-submit" class="whatsub-comment-submit-btn" title="댓글 제출">
        <i class="fas fa-paper-plane"></i> 전송
      </button>
    </div>
  `;
  
  // 컨테이너에 추가
  container.appendChild(commentsHeader);
  container.appendChild(commentsList);
  container.appendChild(commentInput);
  
  return container;
}

// 댓글 제출 함수
function submitComment(text) {
  if (!text || text.trim() === '') return;
  
  const commentInput = document.getElementById('whatsub-comment-input');
  if (!commentInput) return;
  
  // 시간 및 유형 데이터 가져오기
  const timeInput = document.getElementById('whatsub-comment-time');
  const typeSelect = document.getElementById('whatsub-comment-type');
  
  // 값 확인 후 기본값 설정
  const timestamp = timeInput ? parseFloat(timeInput.value) || getCurrentTime() || 0 : getCurrentTime() || 0;
  const commentType = typeSelect ? typeSelect.value : 'normal';
  
  // 입력 필드 초기화
  commentInput.value = '';
  
  // 현재 비디오 정보와 시간 가져오기
  const videoInfo = {
    videoId: currentVideoId || getVideoId() || 'test_video',
    subtitleId: currentSubtitleId || 'test_subtitle',
    subtitleText: currentSubtitleText || 'Test subtitle',
    timestamp: timestamp,
    text: text.trim(),
    type: commentType
  };
  
  console.log('[Whatsub] 댓글 제출:', videoInfo);
  
  // 테스트 모드: 서버 전송 없이 즉시 표시
  const commentId = `test_${Date.now()}`;
  const newComment = {
    id: commentId,
    user: {
      name: '테스트 사용자',
      avatar: 'https://via.placeholder.com/24'
    },
    text: text.trim(),
    timestamp: new Date().toISOString(),
    likes: 0,
    videoTime: timestamp
  };
  
  // 댓글 목록에 추가 (일반 댓글인 경우)
  if (commentType === 'normal' || commentType === 'both') {
    addCommentToList(newComment);
    updateCommentsCount();
  }
  
  // 흐름 댓글로 표시 (흐름 댓글인 경우)
  if (commentType === 'floating' || commentType === 'both') {
    displayFloatingComment(newComment);
  }
  
  showMessage('댓글이 추가되었습니다.');
}

// 댓글 이벤트 설정
function setupCommentEvents() {
  try {
    console.log('[Whatsub] 댓글 이벤트 설정 중...');
    
    // 댓글 닫기 버튼
    const closeCommentsBtn = document.getElementById('whatsub-close-comments');
    if (closeCommentsBtn) {
      closeCommentsBtn.addEventListener('click', function() {
        hideComments();
      });
    }
    
    // 댓글 제출 버튼
    const commentSubmitBtn = document.getElementById('whatsub-comment-submit');
    if (commentSubmitBtn) {
      commentSubmitBtn.addEventListener('click', function() {
        const commentInput = document.getElementById('whatsub-comment-input');
        if (commentInput && commentInput.value.trim()) {
          submitComment(commentInput.value);
        }
      });
    }
    
    // 댓글 입력창 엔터키 이벤트
    const commentInput = document.getElementById('whatsub-comment-input');
    if (commentInput) {
      commentInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (this.value.trim()) {
            submitComment(this.value);
          }
        }
      });
    }
    
    // 테스트 댓글 로드 버튼
    const testCommentsBtn = document.getElementById('whatsub-load-test-comments');
    if (testCommentsBtn) {
      testCommentsBtn.addEventListener('click', function() {
        loadTestComments();
      });
    }
    
    console.log('[Whatsub] 댓글 이벤트 설정 완료');
  } catch (error) {
    console.error('[Whatsub] 댓글 이벤트 설정 오류:', error);
  }
}

// 흐름 댓글 표시
function displayFloatingComment(comment) {
  // 흐름 댓글 컨테이너가 없으면 생성
  let floatingContainer = document.getElementById('whatsub-floating-comments');
  if (!floatingContainer) {
    floatingContainer = document.createElement('div');
    floatingContainer.id = 'whatsub-floating-comments';
    floatingContainer.style.position = 'absolute';
    floatingContainer.style.width = '100%';
    floatingContainer.style.height = '100%';
    floatingContainer.style.top = '0';
    floatingContainer.style.left = '0';
    floatingContainer.style.pointerEvents = 'none'; // 마우스 이벤트를 통과시킴
    floatingContainer.style.zIndex = '9999';
    floatingContainer.style.overflow = 'hidden';
    
    // 비디오 컨테이너에 추가
    const videoContainer = document.querySelector('.video-container') || 
                           document.querySelector('.html5-video-container') ||
                           document.querySelector('video').parentElement;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(floatingContainer);
    } else {
      document.body.appendChild(floatingContainer);
    }
  }
  
  // 새 흐름 댓글 생성
  const floatingComment = document.createElement('div');
  floatingComment.className = 'whatsub-floating-comment';
  floatingComment.setAttribute('data-id', comment.id || '');
  
  // 스타일 설정
  floatingComment.style.position = 'absolute';
  floatingComment.style.right = '0';
  floatingComment.style.color = '#fff';
  floatingComment.style.padding = '5px 10px';
  floatingComment.style.borderRadius = '4px';
  floatingComment.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  floatingComment.style.fontSize = '16px';
  floatingComment.style.whiteSpace = 'nowrap';
  floatingComment.style.maxWidth = '80%';
  floatingComment.style.textOverflow = 'ellipsis';
  floatingComment.style.overflow = 'hidden';
  floatingComment.style.pointerEvents = 'none';
  floatingComment.style.transform = 'translateZ(0)'; // 하드웨어 가속
  
  // 애니메이션 스타일 추가
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes whatsub-float-right-to-left {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      10% {
        transform: translateX(80%);
        opacity: 1;
      }
      90% {
        transform: translateX(-80%);
        opacity: 1;
      }
      100% {
        transform: translateX(-100%);
        opacity: 0;
      }
    }
    
    .whatsub-floating-comment {
      animation: whatsub-float-right-to-left 8s linear forwards;
    }
  `;
  document.head.appendChild(styleElement);
  
  // 랜덤 위치 설정
  const containerHeight = floatingContainer.offsetHeight || 600;
  const randomTop = Math.floor(Math.random() * (containerHeight - 60)) + 30;
  floatingComment.style.top = `${randomTop}px`;
  
  // 닉네임과 내용 구분 (닉네임은 다른 색으로 표시)
  const username = comment.user?.name || '익명';
  floatingComment.innerHTML = `<span style="color: #ffcc00; margin-right: 5px;">${username}:</span> ${comment.text}`;
  
  // 컨테이너에 추가
  floatingContainer.appendChild(floatingComment);
  
  // 댓글이 화면 밖으로 나가면 제거
  setTimeout(() => {
    if (floatingComment.parentNode) {
      floatingComment.parentNode.removeChild(floatingComment);
    }
  }, 8500);
}

// 댓글 목록에 댓글 추가
function addCommentToList(comment) {
  const commentsList = document.getElementById('whatsub-comments-list');
  if (!commentsList) return;
  
  // 새 댓글 아이템 생성
  const commentItem = document.createElement('div');
  commentItem.className = 'whatsub-comment-item';
  commentItem.setAttribute('data-id', comment.id || '');
  
  // 포맷팅된 시간
  const commentDate = new Date(comment.timestamp);
  const formattedDate = `${commentDate.getFullYear()}-${String(commentDate.getMonth() + 1).padStart(2, '0')}-${String(commentDate.getDate()).padStart(2, '0')} ${String(commentDate.getHours()).padStart(2, '0')}:${String(commentDate.getMinutes()).padStart(2, '0')}`;
  
  // 댓글 내용 구성
  commentItem.innerHTML = `
    <div class="whatsub-comment-header">
      <div class="whatsub-comment-user">
        <img src="${comment.user?.avatar || 'https://via.placeholder.com/24'}" alt="User" class="whatsub-user-avatar">
        <span class="whatsub-user-name">${comment.user?.name || '익명'}</span>
      </div>
      <div class="whatsub-comment-time">
        <span title="영상 시간">${formatTime(comment.videoTime || 0)}</span>
        <span class="whatsub-comment-date" title="댓글 작성 시간">${formattedDate}</span>
      </div>
    </div>
    <div class="whatsub-comment-text">${comment.text}</div>
    <div class="whatsub-comment-actions">
      <button class="whatsub-comment-like" title="좋아요" data-id="${comment.id}">
        <i class="fas fa-thumbs-up"></i> <span class="whatsub-like-count">${comment.likes || 0}</span>
      </button>
      <button class="whatsub-comment-seek" title="이 시간으로 이동" data-time="${comment.videoTime || 0}">
        <i class="fas fa-play"></i> 이동
      </button>
    </div>
  `;
  
  // 이벤트 리스너 추가
  setTimeout(() => {
    // 좋아요 버튼
    const likeButton = commentItem.querySelector('.whatsub-comment-like');
    if (likeButton) {
      likeButton.addEventListener('click', function() {
        const commentId = this.getAttribute('data-id');
        if (!commentId) return;
        
        // 좋아요 수 증가 (테스트)
        const likeCount = this.querySelector('.whatsub-like-count');
        if (likeCount) {
          const currentLikes = parseInt(likeCount.textContent || '0');
          likeCount.textContent = currentLikes + 1;
        }
        
        // 좋아요 정보 전송 (테스트 모드에서는 생략)
        console.log(`[Whatsub] 댓글 좋아요: ${commentId}`);
      });
    }
    
    // 시간 이동 버튼
    const seekButton = commentItem.querySelector('.whatsub-comment-seek');
    if (seekButton) {
      seekButton.addEventListener('click', function() {
        const seekTime = parseFloat(this.getAttribute('data-time') || '0');
        
        // 비디오 시간 이동
        seekToTime(seekTime);
      });
    }
  }, 0);
  
  // 댓글 목록 상단에 추가
  commentsList.insertBefore(commentItem, commentsList.firstChild);
}

// 댓글 카운트 업데이트
function updateCommentsCount() {
  const commentCount = document.querySelector('.whatsub-comments-count');
  if (!commentCount) return;
  
  const commentsList = document.getElementById('whatsub-comments-list');
  if (!commentsList) return;
  
  // 댓글 수 업데이트
  const count = commentsList.querySelectorAll('.whatsub-comment-item').length;
  commentCount.textContent = count.toString();
}

// 비디오 시간 이동
function seekToTime(seconds) {
  const video = document.querySelector('video');
  if (!video) return;
  
  // 비디오 시간 설정
  video.currentTime = seconds;
  
  // 일시정지 상태였다면 재생
  if (video.paused) {
    video.play().catch(error => {
      console.error('[Whatsub] 비디오 재생 오류:', error);
    });
  }
  
  showMessage(`${formatTime(seconds)} 위치로 이동했습니다.`, 'info');
}

// 시간 포맷팅 (예: 65 => "1:05")
function formatTime(timeInSeconds) {
  if (isNaN(timeInSeconds)) return '0:00';
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// 현재 재생 시간을 기준으로 댓글 로드
function loadCommentsForCurrentTime() {
  // 실제 구현에서는 서버에서 현재 재생 시간 근처의 댓글을 로드
  // 테스트 구현에서는 무작위 댓글 생성
  console.log('[Whatsub] 현재 시간 댓글 로드 (테스트)');
}

// 비디오 시간 변경 감지
function checkVideoTimeForComments() {
  // 현재 비디오 재생 시간 근처의 댓글 표시 (실제 구현)
  // 테스트 용도로는 생략
}

// 테스트 댓글 로드
function loadTestComments() {
  const testComments = [
    {
      id: 'test_1',
      user: { name: '홍길동', avatar: 'https://via.placeholder.com/24' },
      text: '이 부분에서 정말 감동받았습니다! 자막 번역이 너무 좋네요.',
      timestamp: new Date().toISOString(),
      likes: 5,
      videoTime: getCurrentTime() - 10
    },
    {
      id: 'test_2',
      user: { name: '김철수', avatar: 'https://via.placeholder.com/24' },
      text: '이 장면 번역이 이상한데요? "The weather is nice"가 "오늘 날씨가 좋습니다"가 아니라 "오늘 기분이 좋습니다"로 번역되었어요.',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      likes: 2,
      videoTime: getCurrentTime() + 5
    },
    {
      id: 'test_3',
      user: { name: '이영희', avatar: 'https://via.placeholder.com/24' },
      text: '자동 자막 기능이 생각보다 정확하네요! 스피치가 빠른데도 잘 인식합니다.',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      likes: 8,
      videoTime: getCurrentTime() + 30
    }
  ];
  
  // 댓글 목록 초기화
  const commentsList = document.getElementById('whatsub-comments-list');
  if (commentsList) {
    commentsList.innerHTML = '';
  }
  
  // 테스트 댓글 추가
  testComments.forEach(comment => {
    addCommentToList(comment);
  });
  
  // 댓글 카운트 업데이트
  updateCommentsCount();
  
  // 랜덤 간격으로 흐름 댓글 표시
  testComments.forEach((comment, index) => {
    setTimeout(() => {
      displayFloatingComment(comment);
    }, index * 1500);
  });
  
  showMessage('테스트 댓글이 로드되었습니다.', 'success');
}

// 비디오 시간대로 이동
function seekToVideoTime(timeInSeconds) {
  const video = document.querySelector('video');
  if (video && !isNaN(timeInSeconds)) {
    video.currentTime = timeInSeconds;
    video.play();
  }
}

// 비디오 시간 포맷 (00:00 형식)
function formatVideoTime(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// 댓글 시간 포맷
function formatCommentTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

// 댓글 좋아요 기능
function likeComment(commentId) {
  chrome.runtime.sendMessage({
    action: 'likeComment',
    commentId: commentId
  }, function(response) {
    if (response && response.success) {
      // 좋아요 카운트 업데이트
      const commentItem = document.querySelector(`.whatsub-comment-item[data-id="${commentId}"]`);
      if (commentItem) {
        const likeCount = commentItem.querySelector('.whatsub-comment-like-count');
        if (likeCount) {
          likeCount.textContent = response.likes;
        }
        
        // 좋아요 버튼 활성화
        const likeButton = commentItem.querySelector('.whatsub-comment-like');
        if (likeButton) {
          likeButton.classList.add('active');
        }
      }
    }
  });
}

// 흐름 댓글 컨테이너 추가
function injectFloatingCommentsContainer() {
  try {
    // 흐름 댓글 컨테이너가 있는지 확인
    let floatingContainer = document.getElementById('whatsub-floating-comments');
    if (!floatingContainer) {
      floatingContainer = document.createElement('div');
      floatingContainer.id = 'whatsub-floating-comments';
      floatingContainer.style.position = 'absolute';
      floatingContainer.style.width = '100%';
      floatingContainer.style.height = '100%';
      floatingContainer.style.top = '0';
      floatingContainer.style.left = '0';
      floatingContainer.style.pointerEvents = 'none'; // 마우스 이벤트를 통과시킴
      floatingContainer.style.zIndex = '9999';
      floatingContainer.style.overflow = 'hidden';
      
      // 비디오 컨테이너나 body에 추가
      const videoContainer = document.querySelector('.video-container') || 
                            document.querySelector('.html5-video-container') ||
                            document.querySelector('video')?.parentElement;
      if (videoContainer) {
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(floatingContainer);
      } else {
        document.body.appendChild(floatingContainer);
      }
      
      console.log('[Whatsub] 흐름 댓글 컨테이너 추가됨');
    }
  } catch (error) {
    console.error('[Whatsub] 흐름 댓글 컨테이너 추가 중 오류:', error);
  }
}

// 댓글 표시
function showComments() {
  if (!commentsContainer) {
    console.log('[Whatsub] 댓글 컨테이너가 초기화되지 않았습니다.');
    return;
  }
  
  // 댓글 컨테이너 표시
  commentsContainer.style.display = 'flex';
  state.commentsShown = true;
  
  // 현재 비디오 ID와 자막 ID가 있으면 댓글 로드
  if (currentVideoId && currentSubtitleId) {
    loadComments(currentVideoId, currentSubtitleId);
  }
  
  // 상태 저장
  saveSettings();
  
  console.log('[Whatsub] 댓글이 표시되었습니다.');
}

// 댓글 숨기기
function hideComments() {
  if (!commentsContainer) return;
  
  commentsContainer.style.display = 'none';
  state.commentsShown = false;
  
  // 상태 저장
  saveSettings();
  
  console.log('[Whatsub] 댓글이 숨겨졌습니다.');
}

// 자막 텍스트로부터 해시값 생성
function hashSubtitle(text) {
  if (!text) return 'empty';
  
  // 간단한 해시 알고리즘
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // 해시값을 16진수 문자열로 변환
  return Math.abs(hash).toString(16);
}

// 특정 비디오 및 자막 ID에 해당하는 댓글 로드
function loadComments(videoId, subtitleId) {
  if (!videoId || !subtitleId) return;
  
  console.log(`[Whatsub] 댓글 로드 중: 비디오 ID=${videoId}, 자막 ID=${subtitleId}`);
  
  // 테스트 환경에서는 로컬에서 댓글 생성
  if (!window.testCommentsMap) {
    window.testCommentsMap = {};
  }
  
  // 해당 자막에 대한 댓글이 없으면 빈 배열 생성
  const commentsKey = `${videoId}_${subtitleId}`;
  if (!window.testCommentsMap[commentsKey]) {
    window.testCommentsMap[commentsKey] = [];
    
    // 테스트를 위해 무작위 댓글 생성
    if (Math.random() > 0.6) {
      const randomComments = [
        {
          id: `${commentsKey}_1`,
          user: { name: '홍길동', avatar: 'https://via.placeholder.com/24' },
          text: '이 부분 정확한 번역이네요!',
          timestamp: new Date().toISOString(),
          likes: Math.floor(Math.random() * 10),
          videoTime: getCurrentTime()
        },
        {
          id: `${commentsKey}_2`,
          user: { name: '김철수', avatar: 'https://via.placeholder.com/24' },
          text: '이 문장이 원문과 좀 다른 의미로 번역된 것 같아요',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          likes: Math.floor(Math.random() * 5),
          videoTime: getCurrentTime() + 2
        }
      ];
      
      // 무작위로 1~2개 댓글 선택
      const commentCount = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < commentCount; i++) {
        window.testCommentsMap[commentsKey].push(randomComments[i]);
      }
    }
  }
  
  // 댓글 목록 요소 가져오기
  const commentsList = document.getElementById('whatsub-comments-list');
  if (!commentsList) return;
  
  // 기존 댓글 비우기
  commentsList.innerHTML = '';
  
  // 댓글 추가
  const comments = window.testCommentsMap[commentsKey] || [];
  comments.forEach(comment => {
    addCommentToList(comment);
  });
  
  // 댓글 수 업데이트
  updateCommentsCount();
  
  // 흐름 댓글 표시 (실제 구현에서는 조건부로 표시)
  if (state.floatingCommentsEnabled && comments.length > 0) {
    comments.forEach((comment, index) => {
      setTimeout(() => {
        displayFloatingComment(comment);
      }, index * 1500);
    });
  }
}

// 메시지 표시 함수
function showMessage(message, type = 'info') {
  console.log(`[Whatsub] ${message}`);
  
  // 메시지 컨테이너 생성
  let messageContainer = document.getElementById('whatsub-message-container');
  if (!messageContainer) {
    messageContainer = document.createElement('div');
    messageContainer.id = 'whatsub-message-container';
    messageContainer.style.position = 'fixed';
    messageContainer.style.bottom = '20px';
    messageContainer.style.right = '20px';
    messageContainer.style.zIndex = '9999999';
    document.body.appendChild(messageContainer);
  }
  
  // 메시지 요소 생성
  const messageEl = document.createElement('div');
  messageEl.className = `whatsub-message ${type}`;
  messageEl.textContent = message;
  messageEl.style.padding = '10px 15px';
  messageEl.style.marginBottom = '10px';
  messageEl.style.backgroundColor = type === 'error' ? '#f44336' : 
                                   type === 'success' ? '#4caf50' : 
                                   type === 'warning' ? '#ff9800' : '#2196f3';
  messageEl.style.color = 'white';
  messageEl.style.borderRadius = '4px';
  messageEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  messageEl.style.transition = 'all 0.3s ease';
  messageEl.style.opacity = '0';
  
  // 컨테이너에 추가
  messageContainer.appendChild(messageEl);
  
  // 애니메이션
  setTimeout(() => {
    messageEl.style.opacity = '1';
  }, 10);
  
  // 3초 후 제거
  setTimeout(() => {
    messageEl.style.opacity = '0';
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 300);
  }, 3000);
}

// 자막 설정 업데이트 함수
function updateSubtitleSettings(settings) {
  console.log('자막 설정 업데이트:', settings);
  
  try {
    // 전역 설정 상태 업데이트
    if (settings) {
      if (settings.position) state.subtitlePosition = settings.position;
      if (settings.fontSize) state.subtitleFontSize = settings.fontSize;
      if (settings.background) state.subtitleBackground = settings.background;
      if (settings.hasOwnProperty('dualSubtitles')) state.dualSubtitles = settings.dualSubtitles;
      
      // 현재 UI가 존재하면 설정 즉시 적용
      const subtitleContainer = document.getElementById('whatsub-subtitles');
      if (subtitleContainer) {
        applySubtitleStyles(subtitleContainer, settings);
        
        // 이중 자막 설정이 변경되었을 경우 자막 컨테이너 재구성
        if (settings.hasOwnProperty('dualSubtitles')) {
          setupSubtitleContainer(true); // 강제 업데이트
        }
        
        // 현재 활성화된 자막 다시 표시 (설정 변경에 맞춰 업데이트)
        if (state.currentText) {
          updateSubtitleText(state.currentText);
        }
      }
      
      return { success: true };
    }
  } catch (error) {
    console.error('자막 설정 업데이트 중 오류:', error);
  }
  
  return { success: false };
}

// 자막 컨테이너 설정
function setupSubtitleContainer(forceUpdate = false) {
  try {
    let subtitleContainer = document.getElementById('whatsub-subtitles');
    
    // 이미 존재하고 강제 업데이트가 아니면 기존 컨테이너 반환
    if (subtitleContainer && !forceUpdate) {
      return subtitleContainer;
    }
    
    // 기존 컨테이너가 있으면 제거 (재구성)
    if (subtitleContainer) {
      subtitleContainer.remove();
    }
    
    // 새 자막 컨테이너 생성
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'whatsub-subtitles';
    subtitleContainer.classList.add('whatsub-subtitles');
    
    // 이중 자막 사용시 컨테이너 내부 구조 변경
    if (state.dualSubtitles) {
      // 원본 자막 컨테이너
      const originalContainer = document.createElement('div');
      originalContainer.id = 'whatsub-original-subtitle';
      originalContainer.classList.add('whatsub-subtitle-text');
      subtitleContainer.appendChild(originalContainer);
      
      // 번역 자막 컨테이너
      const translatedContainer = document.createElement('div');
      translatedContainer.id = 'whatsub-translated-subtitle';
      translatedContainer.classList.add('whatsub-subtitle-text');
      subtitleContainer.appendChild(translatedContainer);
    } else {
      // 단일 자막 컨테이너
      const textContainer = document.createElement('div');
      textContainer.id = 'whatsub-subtitle-text';
      textContainer.classList.add('whatsub-subtitle-text');
      subtitleContainer.appendChild(textContainer);
    }
    
    // 자막 스타일 적용
    applySubtitleStyles(subtitleContainer);
    
    // 문서에 추가
    document.body.appendChild(subtitleContainer);
    console.log('자막 컨테이너 설정 완료', state.dualSubtitles ? '(이중 자막 모드)' : '(단일 자막 모드)');
    
    return subtitleContainer;
  } catch (error) {
    console.error('자막 컨테이너 설정 중 오류:', error);
    return null;
  }
}

// 자막 텍스트 업데이트
function updateSubtitleText(text) {
  try {
    // 빈 텍스트는 무시
    if (!text || text.trim() === '') return;
    
    // 상태 업데이트
    state.currentText = text;
    
    // 자막 UI가 없으면 생성
    let subtitleContainer = document.getElementById('whatsub-subtitles');
    if (!subtitleContainer) {
      subtitleContainer = setupSubtitleContainer();
    }
    
    // 자막 텍스트 업데이트 (이중 자막 모드에 따라 처리)
    if (state.dualSubtitles) {
      // 이중 자막 모드
      const originalSubtitle = document.getElementById('whatsub-original-subtitle');
      const translatedSubtitle = document.getElementById('whatsub-translated-subtitle');
      
      if (originalSubtitle && translatedSubtitle) {
        // 원본 텍스트 설정
        originalSubtitle.textContent = text;
        
        // 번역 텍스트 설정 (번역이 필요한 경우)
        if (state.subtitleLanguage && state.subtitleLanguage !== 'auto') {
          translateSubtitleText(text, state.subtitleLanguage)
            .then(translatedText => {
              translatedSubtitle.textContent = translatedText || '(번역 불가)';
            })
            .catch(error => {
              console.error('자막 번역 오류:', error);
              translatedSubtitle.textContent = '(번역 오류)';
            });
        } else {
          translatedSubtitle.textContent = '(언어 자동 감지 중...)';
        }
      }
    } else {
      // 단일 자막 모드
      const subtitleText = document.getElementById('whatsub-subtitle-text');
      if (subtitleText) {
        // 자막 번역 모드일 경우
        if (state.subtitleLanguage && state.subtitleLanguage !== 'auto') {
          translateSubtitleText(text, state.subtitleLanguage)
            .then(translatedText => {
              subtitleText.textContent = translatedText || text;
            })
            .catch(error => {
              console.error('자막 번역 오류:', error);
              subtitleText.textContent = text;
            });
        } else {
          // 번역이 필요 없는 경우 원본 표시
          subtitleText.textContent = text;
        }
      }
    }
    
    // 자막 컨테이너 표시
    subtitleContainer.style.display = 'block';
    
  } catch (error) {
    console.error('자막 텍스트 업데이트 오류:', error);
  }
}

// 자막 텍스트 번역 함수
async function translateSubtitleText(text, targetLang) {
  if (!text || text.trim() === '') return '';
  if (!targetLang || targetLang === 'auto') return text;
  
  try {
    // 캐시된 번역이 있는지 확인
    const cacheKey = `${text}_${targetLang}`;
    if (state.translationCache[cacheKey]) {
      return state.translationCache[cacheKey];
    }
    
    // 번역 API 호출
    const response = await fetch('https://api.whatsub.co/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        target: targetLang,
        source: 'auto'
      })
    });
    
    if (!response.ok) {
      throw new Error(`번역 요청 실패: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.translatedText) {
      // 번역 결과 캐싱
      state.translationCache[cacheKey] = data.translatedText;
      return data.translatedText;
    }
    
    return text;
  } catch (error) {
    console.error('번역 오류:', error);
    return text;
  }
}

// 자막 스타일 적용
function applySubtitleStyles(container, settings) {
  if (!container) return;
  
  try {
    // 설정값 적용 또는 기본값 사용
    const position = (settings && settings.position) || state.subtitlePosition || 'bottom';
    const fontSize = (settings && settings.fontSize) || state.subtitleFontSize || 'medium';
    const background = (settings && settings.background) || state.subtitleBackground || 'medium';
    
    // 기본 스타일 설정
    container.style.textAlign = 'center';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontWeight = 'bold';
    container.style.color = '#ffffff';
    container.style.textShadow = '1px 1px 1px rgba(0, 0, 0, 0.8)';
    container.style.padding = '10px';
    container.style.width = '90%';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none';
    container.style.position = 'fixed';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    
    // 위치 설정
    switch (position) {
      case 'top':
        container.style.top = '50px';
        container.style.bottom = 'auto';
        break;
      case 'middle':
        container.style.top = '50%';
        container.style.bottom = 'auto';
        container.style.transform = 'translate(-50%, -50%)';
        break;
      case 'bottom':
      default:
        container.style.bottom = '50px';
        container.style.top = 'auto';
        break;
    }
    
    // 폰트 크기 설정
    switch (fontSize) {
      case 'small':
        container.style.fontSize = '16px';
        break;
      case 'medium':
        container.style.fontSize = '20px';
        break;
      case 'large':
        container.style.fontSize = '24px';
        break;
      case 'xlarge':
        container.style.fontSize = '28px';
        break;
      default:
        container.style.fontSize = '20px';
    }
    
    // 배경 투명도 설정
    let bgOpacity = 0.5;
    switch (background) {
      case 'none':
        bgOpacity = 0;
        break;
      case 'low':
        bgOpacity = 0.3;
        break;
      case 'medium':
        bgOpacity = 0.5;
        break;
      case 'high':
        bgOpacity = 0.7;
        break;
      default:
        bgOpacity = 0.5;
    }
    
    container.style.backgroundColor = `rgba(0, 0, 0, ${bgOpacity})`;
    container.style.borderRadius = '8px';
    
    // 이중 자막 모드일 경우 추가 스타일
    if (state.dualSubtitles) {
      const originalSubtitle = document.getElementById('whatsub-original-subtitle');
      const translatedSubtitle = document.getElementById('whatsub-translated-subtitle');
      
      if (originalSubtitle && translatedSubtitle) {
        originalSubtitle.style.marginBottom = '10px';
        originalSubtitle.style.fontSize = container.style.fontSize;
        translatedSubtitle.style.fontSize = 
          parseFloat(container.style.fontSize) * 0.85 + 'px'; // 번역 자막은 약간 작게
      }
    }
    
  } catch (error) {
    console.error('자막 스타일 적용 오류:', error);
  }
}

// 메시지 핸들러 설정
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('content script - 메시지 수신:', request.action);
  try {
    switch (request.action) {
      case 'toggleSubtitles':
        // 자막 토글 처리
        const success = toggleSubtitles(request.enabled);
        sendResponse({ success });
        break;
        
      case 'updateSubtitleSettings':
        // 자막 설정 업데이트
        const result = updateSubtitleSettings(request.settings);
        sendResponse(result);
        break;
        
      case 'updateSubtitleText':
        // 자막 텍스트 업데이트
        updateSubtitleText(request.text);
        sendResponse({ success: true });
        break;
        
      case 'showTestSubtitle':
        // 테스트 자막 표시
        updateSubtitleText(request.text || "이것은 테스트 자막입니다. This is a test subtitle.");
        sendResponse({ success: true });
        break;
        
      case 'whisperStarted':
        // 음성 인식 시작 알림
        console.log('음성 인식이 시작되었습니다.');
        // 필요시 UI 업데이트 (예: 상태 표시)
        sendResponse({ success: true });
        break;
        
      case 'whisperStopped':
        // 음성 인식 중지 알림
        console.log('음성 인식이 중지되었습니다.');
        // 필요시 UI 업데이트 (예: 상태 표시)
        sendResponse({ success: true });
        break;
        
      case 'newSubtitle':
        // 새 자막 텍스트 수신
        if (request.text) {
          updateSubtitleText(request.text);
        }
        sendResponse({ success: true });
        break;
        
      case 'changeLanguage':
        // 자막 언어 변경
        state.subtitleLanguage = request.language;
        // 현재 표시 중인 자막이 있다면 언어에 맞게 업데이트
        if (state.currentText) {
          updateSubtitleText(state.currentText);
        }
        sendResponse({ success: true });
        break;
        
      case 'checkStatus':
        // 상태 반환
        sendResponse({
          subtitleActive: state.subtitleActive,
          subtitleLanguage: state.subtitleLanguage,
          dualSubtitles: state.dualSubtitles,
          currentSettings: {
            position: state.subtitlePosition,
            fontSize: state.subtitleFontSize,
            background: state.subtitleBackground
          }
        });
        break;
        
      default:
        console.warn('알 수 없는 메시지 액션:', request.action);
        sendResponse({ success: false, error: '알 수 없는 메시지 액션' });
    }
  } catch (error) {
    console.error('메시지 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  // 비동기 응답 처리
  return true;
});

// 자막 토글 함수
function toggleSubtitles(enabled) {
  console.log('자막 토글:', enabled);
  
  try {
    // 상태 업데이트
    state.subtitleActive = enabled;
    
    if (enabled) {
      // 자막 활성화
      setupSubtitleContainer();
      
      // 로컬 스토리지에서 설정 로드
      chrome.storage.sync.get(['subtitleLanguage', 'subtitleSettings'], function(data) {
        // 언어 설정 적용
        if (data.subtitleLanguage) {
          state.subtitleLanguage = data.subtitleLanguage;
        }
        
        // 자막 설정 적용
        if (data.subtitleSettings) {
          if (data.subtitleSettings.position) {
            state.subtitlePosition = data.subtitleSettings.position;
          }
          if (data.subtitleSettings.fontSize) {
            state.subtitleFontSize = data.subtitleSettings.fontSize;
          }
          if (data.subtitleSettings.background) {
            state.subtitleBackground = data.subtitleSettings.background;
          }
          if (data.subtitleSettings.hasOwnProperty('dualSubtitles')) {
            state.dualSubtitles = data.subtitleSettings.dualSubtitles;
          }
          
          // 자막 컨테이너 설정 적용
          setupSubtitleContainer(true); // 강제 업데이트
        }
      });
      
      // 유니버설 모드 확인
      chrome.storage.sync.get('universalMode', function(data) {
        state.universalMode = data.universalMode === true;
      });
      
      console.log('자막 활성화 완료');
    } else {
      // 자막 비활성화 - 모든 자막 UI 제거
      const subtitleContainer = document.getElementById('whatsub-subtitles');
      if (subtitleContainer) {
        subtitleContainer.remove();
      }
      
      console.log('자막 비활성화 완료');
    }
    
    return true;
  } catch (error) {
    console.error('자막 토글 오류:', error);
    return false;
  }
}