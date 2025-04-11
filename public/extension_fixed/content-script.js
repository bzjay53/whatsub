// Whatsub 콘텐츠 스크립트 (기본 버전)
console.log('[Whatsub] 콘텐츠 스크립트가 로드되었습니다. 버전: 0.2.2');

// CSS 스타일 로드
function loadStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles/subtitles.css');
  link.id = 'whatsub-styles';
  document.head.appendChild(link);
  console.log('[Whatsub] 자막 스타일이 로드되었습니다.');
}

// 페이지 로드 시 스타일 적용
loadStyles();

// 확장 프로그램 상태 초기화
let isInitialized = false;
let isSubtitleEnabled = false;
let selectedLanguage = 'ko';
let subtitleContainer = null;
let originalSubtitleElement = null;
let translatedSubtitleElement = null;
let subtitleSettings = {
  position: 'bottom',
  fontSize: 'medium',
  background: 'semi',
  dualSubtitles: true,
  customPosition: null
};

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
    if (!isSubtitleEnabled) return;
    
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
    if (selectedLanguage !== detectedLanguage) {
      // 백그라운드 서비스에 번역 요청
      chrome.runtime.sendMessage({
        action: 'translateText',
        text: text,
        source: detectedLanguage,
        target: selectedLanguage
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

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Whatsub] 콘텐츠 스크립트 메시지 수신:', message.action);
  
  if (message.action === 'toggleSubtitles') {
    isSubtitleEnabled = message.enabled;
    if (isSubtitleEnabled) {
      showSubtitles();
      
      // 유튜브 페이지인 경우 자막 감시 시작
      if (isYouTubePage || checkIfYouTubePage()) {
        // 현재 표시 중인 자막 체크
        checkForYouTubeSubtitles();
      }
    } else {
      hideSubtitles();
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'changeLanguage') {
    selectedLanguage = message.language;
    
    // 자막이 활성화된 상태면 현재 자막을 새 언어로 다시 번역
    if (isSubtitleEnabled && currentSubtitleText) {
      translateSubtitle(currentSubtitleText);
    }
    
    sendResponse({ success: true });
  }
  
  if (message.action === 'updateSettings') {
    if (message.settings) {
      subtitleSettings = { ...subtitleSettings, ...message.settings };
      applySettings();
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkStatus') {
    sendResponse({ 
      isInitialized,
      isSubtitleEnabled,
      selectedLanguage,
      settings: subtitleSettings,
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
    const testOriginal = message.original || '이것은 테스트 자막입니다.';
    const testTranslated = message.translated || 'This is a test subtitle.';
    updateSubtitles(testOriginal, testTranslated);
    sendResponse({ success: true });
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
      isInitialized = false;
      isSubtitleEnabled = false;
      
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
  
  return true;
});

// 페이지 초기화 함수
function initializeExtension() {
  if (isInitialized) return;
  
  // 자막 컨테이너 생성
  createSubtitleContainer();
  
  // 설정 적용
  applySettings();
  
  // 유튜브 페이지 확인
  checkIfYouTubePage();
  
  // 백그라운드 스크립트에 페이지 로드 알림
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href,
    isYouTubePage: isYouTubePage
  });
  
  isInitialized = true;
  console.log('[Whatsub] 확장 프로그램이 초기화되었습니다.');
  
  // 자동 시작 설정 확인
  chrome.storage.sync.get(['autoStart', 'subtitleEnabled', 'subtitleLanguage'], function(data) {
    if (data.autoStart === true) {
      // 자동 시작이 활성화되어 있고, 이전에 자막이 활성화되어 있었다면 자막 표시
      if (data.subtitleEnabled === true) {
        isSubtitleEnabled = true;
        showSubtitles();
        
        // 언어 설정도 복원
        if (data.subtitleLanguage) {
          selectedLanguage = data.subtitleLanguage;
        }
        
        // 유튜브 페이지인 경우 자막 체크 시작
        if (isYouTubePage) {
          checkForYouTubeSubtitles();
        }
        
        console.log('[Whatsub] 자막이 자동으로 활성화되었습니다.');
      }
    }
  });
}

// 자막 컨테이너 생성
function createSubtitleContainer() {
  // 기존 컨테이너 제거
  if (subtitleContainer) {
    subtitleContainer.remove();
  }
  
  // 새 컨테이너 생성
  subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'whatsub-container';
  subtitleContainer.classList.add('subtitle-animated', 'draggable');
  
  // 자막 요소 생성
  originalSubtitleElement = document.createElement('div');
  originalSubtitleElement.className = 'original-subtitle';
  
  translatedSubtitleElement = document.createElement('div');
  translatedSubtitleElement.className = 'translated-subtitle';
  
  // 컨트롤 패널 생성
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'subtitle-controls';
  
  // 설정 버튼
  const settingsButton = document.createElement('div');
  settingsButton.className = 'subtitle-control-button';
  settingsButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  settingsButton.title = '자막 설정';
  settingsButton.addEventListener('click', toggleSettingsPanel);
  
  // 재설정 버튼
  const resetButton = document.createElement('div');
  resetButton.className = 'subtitle-control-button';
  resetButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="M12 8v4l3 3"/></svg>';
  resetButton.title = '위치 초기화';
  resetButton.addEventListener('click', resetPosition);
  
  // 닫기 버튼
  const closeButton = document.createElement('div');
  closeButton.className = 'subtitle-control-button';
  closeButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  closeButton.title = '자막 닫기';
  closeButton.addEventListener('click', () => {
    hideSubtitles();
    // 백그라운드에 자막 비활성화 알림
    chrome.runtime.sendMessage({ action: 'disableSubtitles' });
  });
  
  // 컨트롤 패널에 버튼 추가
  controlsContainer.appendChild(settingsButton);
  controlsContainer.appendChild(resetButton);
  controlsContainer.appendChild(closeButton);
  
  // 설정 패널 생성
  createSettingsPanel();
  
  // 컨테이너에 요소 추가
  subtitleContainer.appendChild(originalSubtitleElement);
  subtitleContainer.appendChild(translatedSubtitleElement);
  subtitleContainer.appendChild(controlsContainer);
  
  // 드래그 가능하게 설정
  makeDraggable(subtitleContainer);
  
  // 문서에 추가
  document.body.appendChild(subtitleContainer);
  subtitleContainer.style.display = 'none';
  
  console.log('자막 컨테이너가 생성되었습니다.');
}

// 설정 패널 생성
function createSettingsPanel() {
  // 기존 패널 제거
  const existingPanel = document.getElementById('whatsub-settings-panel');
  if (existingPanel) existingPanel.remove();
  
  // 새 패널 생성
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'whatsub-settings-panel';
  settingsPanel.className = 'subtitle-settings-panel';
  
  // 패널 헤더
  const header = document.createElement('div');
  header.className = 'settings-header';
  header.innerHTML = '<h3>자막 설정</h3><div class="close-button">✕</div>';
  header.querySelector('.close-button').addEventListener('click', () => {
    settingsPanel.classList.remove('visible');
  });
  
  // 위치 설정
  const positionSection = document.createElement('div');
  positionSection.className = 'settings-option';
  positionSection.innerHTML = `
    <label class="settings-option-label">자막 위치</label>
    <div class="settings-option-choices">
      <button class="option-button" data-position="top">상단</button>
      <button class="option-button" data-position="middle">중앙</button>
      <button class="option-button" data-position="bottom">하단</button>
    </div>
  `;
  
  // 배경 설정
  const backgroundSection = document.createElement('div');
  backgroundSection.className = 'settings-option';
  backgroundSection.innerHTML = `
    <label class="settings-option-label">배경 투명도</label>
    <div class="settings-option-choices">
      <button class="option-button" data-background="transparent">투명</button>
      <button class="option-button" data-background="semi">중간</button>
      <button class="option-button" data-background="solid">진하게</button>
    </div>
  `;
  
  // 폰트 크기 설정
  const fontSizeSection = document.createElement('div');
  fontSizeSection.className = 'settings-option';
  fontSizeSection.innerHTML = `
    <label class="settings-option-label">폰트 크기</label>
    <div class="settings-option-choices">
      <button class="option-button" data-font-size="small">작게</button>
      <button class="option-button" data-font-size="medium">중간</button>
      <button class="option-button" data-font-size="large">크게</button>
    </div>
  `;
  
  // 이중 자막 설정
  const dualSubtitleSection = document.createElement('div');
  dualSubtitleSection.className = 'settings-checkbox';
  dualSubtitleSection.innerHTML = `
    <input type="checkbox" id="dual-subtitle-option" ${subtitleSettings.dualSubtitles ? 'checked' : ''}>
    <label for="dual-subtitle-option">번역 자막 표시</label>
  `;
  
  // 설정 적용 버튼
  const actionsSection = document.createElement('div');
  actionsSection.className = 'settings-action';
  actionsSection.innerHTML = `
    <button class="settings-button">설정 적용</button>
  `;
  
  // 패널에 섹션 추가
  settingsPanel.appendChild(header);
  settingsPanel.appendChild(positionSection);
  settingsPanel.appendChild(backgroundSection);
  settingsPanel.appendChild(fontSizeSection);
  settingsPanel.appendChild(dualSubtitleSection);
  settingsPanel.appendChild(actionsSection);
  
  // 이벤트 리스너 설정
  const positionButtons = positionSection.querySelectorAll('.option-button');
  positionButtons.forEach(button => {
    if (button.dataset.position === subtitleSettings.position) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      positionButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      subtitleSettings.position = button.dataset.position;
    });
  });
  
  const backgroundButtons = backgroundSection.querySelectorAll('.option-button');
  backgroundButtons.forEach(button => {
    if (button.dataset.background === subtitleSettings.background) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      backgroundButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      subtitleSettings.background = button.dataset.background;
    });
  });
  
  const fontSizeButtons = fontSizeSection.querySelectorAll('.option-button');
  fontSizeButtons.forEach(button => {
    if (button.dataset.fontSize === subtitleSettings.fontSize) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      fontSizeButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      subtitleSettings.fontSize = button.dataset.fontSize;
    });
  });
  
  const dualSubtitleCheckbox = dualSubtitleSection.querySelector('#dual-subtitle-option');
  dualSubtitleCheckbox.addEventListener('change', () => {
    subtitleSettings.dualSubtitles = dualSubtitleCheckbox.checked;
  });
  
  // 설정 적용 버튼 이벤트
  actionsSection.querySelector('.settings-button').addEventListener('click', () => {
    applySettings();
    saveSettings();
    settingsPanel.classList.remove('visible');
  });
  
  // 문서에 추가
  subtitleContainer.appendChild(settingsPanel);
}

// 설정 패널 토글
function toggleSettingsPanel() {
  const settingsPanel = document.getElementById('whatsub-settings-panel');
  if (settingsPanel) {
    settingsPanel.classList.toggle('visible');
  }
}

// 설정 적용
function applySettings() {
  if (!subtitleContainer) return;
  
  // 위치 클래스 설정
  subtitleContainer.classList.remove('bg-transparent', 'bg-semi', 'bg-solid');
  subtitleContainer.classList.add(`bg-${subtitleSettings.background}`);
  
  // 폰트 크기 클래스 설정
  subtitleContainer.classList.remove('font-small', 'font-medium', 'font-large');
  subtitleContainer.classList.add(`font-${subtitleSettings.fontSize}`);
  
  // 번역 자막 표시 여부
  if (translatedSubtitleElement) {
    translatedSubtitleElement.style.display = subtitleSettings.dualSubtitles ? 'block' : 'none';
  }
  
  // 위치 조정
  if (subtitleSettings.position === 'custom' && subtitleSettings.customPosition) {
    subtitleContainer.style.transform = 'none';
    subtitleContainer.style.left = `${subtitleSettings.customPosition.x}px`;
    subtitleContainer.style.top = `${subtitleSettings.customPosition.y}px`;
  } else {
    resetPosition();
  }
  
  console.log('자막 설정이 적용되었습니다:', subtitleSettings);
}

// 설정 저장
function saveSettings() {
  chrome.storage.local.set({ subtitleSettings });
  
  // 백그라운드에 설정 업데이트 알림
  chrome.runtime.sendMessage({ 
    action: 'saveSettings', 
    settings: subtitleSettings 
  });
}

// 자막 위치 초기화
function resetPosition() {
  if (!subtitleContainer) return;
  
  // 커스텀 위치 설정 제거
  subtitleSettings.position = 'bottom';
  subtitleSettings.customPosition = null;
  
  // 스타일 초기화
  subtitleContainer.style.left = '50%';
  subtitleContainer.style.transform = 'translateX(-50%)';
  
  // 위치에 따른 top 값 설정
  switch (subtitleSettings.position) {
    case 'top':
      subtitleContainer.style.top = '60px';
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
      subtitleContainer.style.bottom = '60px';
      break;
  }
  
  saveSettings();
}

// 드래그 기능 구현
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let isDragging = false;
  
  element.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    // 설정 패널이나 버튼 클릭 시 드래그 방지
    if (e.target.closest('.subtitle-controls') || 
        e.target.closest('.subtitle-settings-panel') || 
        e.target.nodeName === 'BUTTON' || 
        e.target.nodeName === 'INPUT') {
      return;
    }
    
    e.preventDefault();
    isDragging = true;
    element.classList.add('dragging');
    
    // 마우스 위치 가져오기
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    // 새 위치 계산
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // 요소 위치 설정
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.bottom = 'auto';
    // 요소가 가운데 정렬에서 벗어날 때 transform 수정
    element.style.transform = 'none';
    
    // 커스텀 위치 설정
    subtitleSettings.position = 'custom';
    subtitleSettings.customPosition = {
      x: element.offsetLeft,
      y: element.offsetTop
    };
  }
  
  function closeDragElement() {
    // 움직임 중지
    isDragging = false;
    element.classList.remove('dragging');
    document.onmouseup = null;
    document.onmousemove = null;
    
    // 이동 후 설정 저장
    if (subtitleSettings.position === 'custom') {
      saveSettings();
    }
  }
}

// 자막 표시 함수
function showSubtitles() {
  if (!subtitleContainer) {
    createSubtitleContainer();
    applySettings();
  }
  
  subtitleContainer.style.display = 'block';
  console.log('자막이 활성화되었습니다.');
}

// 자막 텍스트 업데이트
function updateSubtitles(text, translatedText = '') {
  if (!subtitleContainer) {
    createSubtitleContainer();
    applySettings();
  }
  
  // 컨테이너가 숨겨져 있으면 표시
  if (subtitleContainer.style.display === 'none') {
    showSubtitles();
  }
  
  // 원본 텍스트 표시
  originalSubtitleElement.textContent = text || '';
  
  // 번역 텍스트가 있는 경우 추가
  translatedSubtitleElement.textContent = translatedText || '';
  translatedSubtitleElement.style.display = 
    (subtitleSettings.dualSubtitles && translatedText) ? 'block' : 'none';
}

// 자막 숨김 함수
function hideSubtitles() {
  if (subtitleContainer) {
    subtitleContainer.style.display = 'none';
    console.log('자막이 비활성화되었습니다.');
  }
}

// 초기 설정 로드
function loadSettings() {
  chrome.storage.local.get('subtitleSettings', (data) => {
    if (data.subtitleSettings) {
      subtitleSettings = { ...subtitleSettings, ...data.subtitleSettings };
      console.log('저장된 설정 로드됨:', subtitleSettings);
      
      if (subtitleContainer) {
        applySettings();
      }
    }
  });
}

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
  initializeExtension();
  loadSettings();
});

// 초기화 실행 (load 이벤트 전에도 실행)
initializeExtension();
loadSettings(); 