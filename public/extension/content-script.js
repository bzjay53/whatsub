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

// 자막 컨테이너 생성 함수
function createSubtitleContainer() {
  // 기존 컨테이너가 있으면 제거
  const existingContainer = document.getElementById('whatsub-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 새 컨테이너 생성
  const container = document.createElement('div');
  container.id = 'whatsub-container';
  container.className = 'whatsub-container';
  
  // 자막 텍스트 컨테이너
  const subtitleText = document.createElement('div');
  subtitleText.id = 'whatsub-subtitle-text';
  subtitleText.className = 'whatsub-subtitle-text';
  
  // 원본 자막과 번역 자막 영역 추가
  const originalText = document.createElement('div');
  originalText.id = 'whatsub-original-text';
  originalText.className = 'whatsub-original-text';
  
  const translatedText = document.createElement('div');
  translatedText.id = 'whatsub-translated-text';
  translatedText.className = 'whatsub-translated-text';
  
  subtitleText.appendChild(originalText);
  subtitleText.appendChild(translatedText);
  
  // 컨트롤 버튼들 추가
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'whatsub-controls';
  controlsContainer.className = 'whatsub-controls';
  
  // 자막 제어 버튼 추가
  controlsContainer.innerHTML = `
    <button id="whatsub-toggle-btn" class="whatsub-btn" title="자막 켜기/끄기">
      <span class="material-icons">subtitles</span>
    </button>
    <button id="whatsub-dual-btn" class="whatsub-btn" title="이중 자막 켜기/끄기">
      <span class="material-icons">translate</span>
    </button>
    <select id="whatsub-language" class="whatsub-select" title="번역 언어">
      <option value="ko">한국어</option>
      <option value="en">영어</option>
      <option value="ja">일본어</option>
      <option value="zh">중국어</option>
    </select>
    <button id="whatsub-settings-btn" class="whatsub-btn" title="설정">
      <span class="material-icons">settings</span>
    </button>
    <button id="whatsub-move-btn" class="whatsub-btn" title="위치 이동">
      <span class="material-icons">open_with</span>
    </button>
  `;
  
  // 컨테이너에 요소 추가
  container.appendChild(subtitleText);
  container.appendChild(controlsContainer);
  
  // 문서에 컨테이너 추가
  document.body.appendChild(container);
  
  // 위치 드래그 가능하게 설정
  makeDraggable(container);
  
  // 컨트롤 버튼 이벤트 리스너 추가
  setupControlListeners();
  
  // 설정 적용
  applySettings();
  
  return container;
}

// 컨트롤 버튼에 이벤트 리스너 추가
function setupControlListeners() {
  // 자막 토글 버튼
  const toggleBtn = document.getElementById('whatsub-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      const container = document.getElementById('whatsub-container');
      if (container) {
        const isActive = !container.classList.contains('hidden');
        if (isActive) {
          container.classList.add('hidden');
        } else {
          container.classList.remove('hidden');
        }
      }
    });
  }
  
  // 이중 자막 토글 버튼
  const dualBtn = document.getElementById('whatsub-dual-btn');
  if (dualBtn) {
    dualBtn.addEventListener('click', function() {
      const translatedText = document.getElementById('whatsub-translated-text');
      if (translatedText) {
        const isVisible = translatedText.style.display !== 'none';
        translatedText.style.display = isVisible ? 'none' : 'block';
      }
    });
  }
  
  // 언어 선택 드롭다운
  const languageSelect = document.getElementById('whatsub-language');
  if (languageSelect) {
    languageSelect.addEventListener('change', function(e) {
      // 현재는 아무 작업도 하지 않음 (백엔드와 연동 필요)
      console.log('언어 변경:', e.target.value);
    });
  }
  
  // 설정 버튼
  const settingsBtn = document.getElementById('whatsub-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      // 팝업 열도록 크롬 API 호출
      chrome.runtime.sendMessage({
        action: 'openPopup',
        tab: 'settings'
      });
    });
  }
}

// 드래그 가능하게 만드는 함수
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  const moveBtn = document.getElementById('whatsub-move-btn');
  if (!moveBtn) return;
  
  moveBtn.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // 마우스 위치 가져오기
    pos3 = e.clientX;
    pos4 = e.clientY;
    // 마우스 이벤트 등록
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // 새 위치 계산
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // 요소 위치 설정
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    // 마우스 이벤트 해제
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// 설정 적용 함수
function applySettings() {
  chrome.storage.sync.get('subtitleSettings', function(data) {
    const settings = data.subtitleSettings || {};
    const container = document.getElementById('whatsub-container');
    
    if (!container) return;
    
    // 위치 설정
    if (settings.position === 'top') {
      container.style.top = '10%';
      container.style.bottom = 'auto';
    } else if (settings.position === 'middle') {
      container.style.top = '50%';
      container.style.bottom = 'auto';
      container.style.transform = 'translateY(-50%)';
    } else {
      // 기본값: 하단
      container.style.top = 'auto';
      container.style.bottom = '10%';
    }
    
    // 폰트 크기 설정
    const subtitleText = document.getElementById('whatsub-subtitle-text');
    if (subtitleText) {
      if (settings.fontSize === 'small') {
        subtitleText.style.fontSize = '16px';
      } else if (settings.fontSize === 'large') {
        subtitleText.style.fontSize = '24px';
      } else {
        // 기본값: 중간
        subtitleText.style.fontSize = '20px';
      }
    }
    
    // 배경 투명도 설정
    if (settings.background === 'transparent') {
      container.style.backgroundColor = 'transparent';
    } else if (settings.background === 'solid') {
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    } else {
      // 기본값: 반투명
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    }
    
    // 이중 자막 설정
    const translatedText = document.getElementById('whatsub-translated-text');
    if (translatedText) {
      translatedText.style.display = settings.dualSubtitles === false ? 'none' : 'block';
    }
  });
}

// 자막 표시 함수
function displaySubtitle(text, isTranslation = false) {
  // 자막 컨테이너가 없으면 생성
  let container = document.getElementById('whatsub-container');
  if (!container) {
    container = createSubtitleContainer();
  }
  
  // 컨테이너가 숨겨져 있으면 표시
  container.classList.remove('hidden');
  
  // 원본 또는 번역 텍스트에 내용 설정
  if (isTranslation) {
    const translatedText = document.getElementById('whatsub-translated-text');
    if (translatedText) {
      translatedText.textContent = text;
    }
  } else {
    const originalText = document.getElementById('whatsub-original-text');
    if (originalText) {
      originalText.textContent = text;
    }
  }
}

// 테스트 자막 표시 함수
function showTestSubtitle(text, duration = 5000) {
  // 원본 자막 표시
  displaySubtitle(text || '이것은 테스트 자막입니다.');
  
  // 번역 자막 표시 (이중 자막 테스트)
  displaySubtitle('This is a test subtitle.', true);
  
  // 지정된 시간 후 자막 숨기기
  setTimeout(() => {
    displaySubtitle('');
    displaySubtitle('', true);
  }, duration);
}

// 자막 토글 함수
function toggleSubtitles(enabled) {
  // 자막 컨테이너가 없으면 생성
  let container = document.getElementById('whatsub-container');
  if (!container) {
    container = createSubtitleContainer();
  }
  
  // 활성화/비활성화 설정
  if (enabled) {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
  
  return { success: true, enabled };
}

// 메시지 핸들러 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('컨텐츠 스크립트에서 메시지 수신:', message.action);
  
  try {
    switch(message.action) {
      case 'toggleSubtitles':
        const result = toggleSubtitles(message.enabled);
        sendResponse(result);
        break;
        
      case 'showTestSubtitle':
        showTestSubtitle(message.text, message.duration);
        sendResponse({ success: true });
        break;
        
      case 'updateSettings':
        applySettings();
        sendResponse({ success: true });
        break;
        
      case 'changeLanguage':
        // 현재는 언어 변경 기능이 없으므로 성공만 반환
        sendResponse({ success: true, language: message.language });
        break;
        
      default:
        console.warn('알 수 없는 메시지 액션:', message.action);
        sendResponse({ success: false, error: '알 수 없는 액션' });
    }
  } catch (error) {
    console.error('메시지 처리 중 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // 비동기 응답 처리
});

// 초기화 함수
function initialize() {
  console.log('Whatsub 콘텐츠 스크립트 초기화...');
  
  // 자동 시작 설정 확인
  chrome.storage.sync.get(['autoStart', 'subtitleEnabled'], function(data) {
    const autoStart = data.autoStart === true;
    const subtitleEnabled = data.subtitleEnabled === true;
    
    console.log('자동 시작:', autoStart, '자막 활성화:', subtitleEnabled);
    
    // 자동 시작 또는 자막이 활성화되어 있으면 자막 컨테이너 생성
    if (autoStart || subtitleEnabled) {
      const container = createSubtitleContainer();
      // 활성화되어 있지 않으면 숨김
      if (!subtitleEnabled) {
        container.classList.add('hidden');
      }
    }
  });
  
  // 도메인 기반으로 자동 활성화 (선택적)
  const currentDomain = window.location.hostname;
  if (currentDomain.includes('youtube.com')) {
    console.log('YouTube 감지, 자막 기능 준비');
    createSubtitleContainer();
  }
}

// 페이지 로드 시 초기화
initialize();