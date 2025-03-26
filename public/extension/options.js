/**
 * Whatsub 설정 페이지 스크립트
 */

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', initializeOptions);

// 전역 변수 선언
let defaultSettings = {
  subtitleEnabled: true,
  subtitleStyle: {
    fontSize: '20px',
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom'
  },
  autoStart: true,
  dataUsage: 'medium',
  speechLanguage: 'ko-KR',
  openaiApiKey: ''
};

let currentSettings = { ...defaultSettings };
let hasChanges = false;

// 초기화 함수
function initializeOptions() {
  console.log('[Whatsub] 설정 페이지 초기화');
  
  // 설정 로드
  loadSettings();
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 컬러 프리뷰 초기화
  updateColorPreviews();
}

// 설정 로드
function loadSettings() {
  chrome.storage.sync.get(['subtitleEnabled', 'subtitleStyle', 'autoStart', 'dataUsage', 'speechLanguage', 'openaiApiKey'], (result) => {
    console.log('[Whatsub] 설정 로드:', result);
    
    // 설정 병합
    if (result.subtitleEnabled !== undefined) {
      currentSettings.subtitleEnabled = result.subtitleEnabled;
    }
    
    if (result.subtitleStyle) {
      currentSettings.subtitleStyle = { ...currentSettings.subtitleStyle, ...result.subtitleStyle };
    }
    
    if (result.autoStart !== undefined) {
      currentSettings.autoStart = result.autoStart;
    }
    
    if (result.dataUsage) {
      currentSettings.dataUsage = result.dataUsage;
    }
    
    if (result.speechLanguage) {
      currentSettings.speechLanguage = result.speechLanguage;
    }
    
    if (result.openaiApiKey) {
      currentSettings.openaiApiKey = result.openaiApiKey;
    }
    
    // UI 업데이트
    updateUI();
  });
}

// UI 업데이트
function updateUI() {
  console.log('[Whatsub] UI 업데이트');
  
  // 자막 활성화
  document.getElementById('subtitle-enabled').checked = currentSettings.subtitleEnabled;
  
  // 자막 스타일 설정
  document.getElementById('font-size').value = currentSettings.subtitleStyle.fontSize;
  document.getElementById('text-color').value = currentSettings.subtitleStyle.textColor;
  document.getElementById('background-color').value = currentSettings.subtitleStyle.backgroundColor;
  document.getElementById('subtitle-position').value = currentSettings.subtitleStyle.position;
  
  // 일반 설정
  document.getElementById('auto-start').checked = currentSettings.autoStart;
  document.getElementById('data-usage').value = currentSettings.dataUsage;
  document.getElementById('speech-language').value = currentSettings.speechLanguage;
  
  // API 키
  document.getElementById('openai-api-key').value = currentSettings.openaiApiKey;
  
  // 컬러 프리뷰 업데이트
  updateColorPreviews();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 설정 변경 감지
  document.querySelector('.settings-card').addEventListener('change', handleSettingChange);
  
  // 저장 버튼
  document.getElementById('save-button').addEventListener('click', saveSettings);
  
  // 초기화 버튼
  document.getElementById('reset-button').addEventListener('click', resetSettings);
  
  // 색상 선택 변경 시 프리뷰 업데이트
  document.getElementById('text-color').addEventListener('change', updateColorPreviews);
  document.getElementById('background-color').addEventListener('change', updateColorPreviews);
}

// 설정 변경 처리
function handleSettingChange(event) {
  const target = event.target;
  const id = target.id;
  
  if (id === 'subtitle-enabled') {
    currentSettings.subtitleEnabled = target.checked;
  } else if (id === 'auto-start') {
    currentSettings.autoStart = target.checked;
  } else if (id === 'font-size') {
    currentSettings.subtitleStyle.fontSize = target.value;
  } else if (id === 'text-color') {
    currentSettings.subtitleStyle.textColor = target.value;
  } else if (id === 'background-color') {
    currentSettings.subtitleStyle.backgroundColor = target.value;
  } else if (id === 'subtitle-position') {
    currentSettings.subtitleStyle.position = target.value;
  } else if (id === 'data-usage') {
    currentSettings.dataUsage = target.value;
  } else if (id === 'speech-language') {
    currentSettings.speechLanguage = target.value;
  } else if (id === 'openai-api-key') {
    currentSettings.openaiApiKey = target.value;
  }
  
  hasChanges = true;
}

// 색상 프리뷰 업데이트
function updateColorPreviews() {
  const textColorPreview = document.getElementById('text-color-preview');
  const bgColorPreview = document.getElementById('bg-color-preview');
  
  const textColor = document.getElementById('text-color').value;
  const bgColor = document.getElementById('background-color').value;
  
  if (textColorPreview) {
    textColorPreview.style.backgroundColor = textColor;
  }
  
  if (bgColorPreview) {
    bgColorPreview.style.backgroundColor = bgColor;
  }
}

// 설정 저장
function saveSettings() {
  console.log('[Whatsub] 설정 저장:', currentSettings);
  
  chrome.storage.sync.set({
    subtitleEnabled: currentSettings.subtitleEnabled,
    subtitleStyle: currentSettings.subtitleStyle,
    autoStart: currentSettings.autoStart,
    dataUsage: currentSettings.dataUsage,
    speechLanguage: currentSettings.speechLanguage,
    openaiApiKey: currentSettings.openaiApiKey
  }, () => {
    showMessage('설정이 저장되었습니다.', 'success');
    hasChanges = false;
    
    // 활성 탭에 설정 변경 알림
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // 자막 활성화 상태 변경 알림
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleSubtitles',
          enabled: currentSettings.subtitleEnabled
        }).catch(err => console.error('[Whatsub] 자막 토글 메시지 전송 오류:', err));
        
        // 자막 스타일 변경 알림
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSubtitleStyle',
          style: currentSettings.subtitleStyle
        }).catch(err => console.error('[Whatsub] 자막 스타일 업데이트 메시지 전송 오류:', err));
      }
    });
  });
}

// 설정 초기화
function resetSettings() {
  if (confirm('모든 설정을 기본값으로 되돌리시겠습니까?')) {
    currentSettings = { ...defaultSettings };
    updateUI();
    hasChanges = true;
    showMessage('설정이 기본값으로 초기화되었습니다. 저장 버튼을 클릭하여 적용하세요.', 'success');
  }
}

// 메시지 표시
function showMessage(message, type = 'success') {
  const messageContainer = document.getElementById('message-container');
  
  if (messageContainer) {
    messageContainer.textContent = message;
    messageContainer.className = 'alert ' + type;
    
    // 3초 후 메시지 숨기기
    setTimeout(() => {
      messageContainer.className = 'alert';
      messageContainer.textContent = '';
    }, 3000);
  }
}

// 페이지 이탈 시 변경 사항 확인
window.addEventListener('beforeunload', (e) => {
  if (hasChanges) {
    // 표준 확인 메시지
    e.preventDefault();
    e.returnValue = '저장되지 않은 변경 사항이 있습니다. 정말 나가시겠습니까?';
  }
}); 