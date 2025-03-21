// YouTube 페이지에 삽입될 콘텐츠 스크립트
console.log('WhatsUb 콘텐츠 스크립트가 로드되었습니다.');

// 확장 프로그램 상태 초기화
let isInitialized = false;
let isSubtitleEnabled = false;
let currentSubtitles = null;
let selectedLanguage = 'ko';

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSubtitles') {
    isSubtitleEnabled = message.enabled;
    if (isSubtitleEnabled) {
      showSubtitles();
    } else {
      hideSubtitles();
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'changeLanguage') {
    selectedLanguage = message.language;
    if (isSubtitleEnabled && currentSubtitles) {
      translateSubtitles(currentSubtitles, selectedLanguage);
    }
    sendResponse({ success: true });
  }
  
  return true;
});

// 페이지 초기화 함수
function initializeExtension() {
  if (isInitialized) return;
  
  // YouTube 비디오 페이지인지 확인
  if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/watch')) {
    console.log('YouTube 비디오 페이지가 감지되었습니다.');
    
    // 자막 컨테이너 생성
    createSubtitleContainer();
    
    // 사용자 인터페이스 초기화
    initializeUI();
    
    isInitialized = true;
  }
}

// 자막 컨테이너 생성
function createSubtitleContainer() {
  const subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'whatsub-container';
  subtitleContainer.style.display = 'none';
  
  document.body.appendChild(subtitleContainer);
}

// 사용자 인터페이스 초기화
function initializeUI() {
  // 자막 활성화 버튼 추가
  // 실제 구현에서는 YouTube 플레이어 컨트롤에 버튼 추가
  console.log('WhatsUb UI가 초기화되었습니다.');
  
  // 백그라운드 스크립트에 페이지 로드 알림
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href
  });
}

// 자막 표시 함수
function showSubtitles() {
  const subtitleContainer = document.getElementById('whatsub-container');
  if (subtitleContainer) {
    subtitleContainer.style.display = 'block';
    console.log('자막이 활성화되었습니다.');
  }
}

// 자막 숨김 함수
function hideSubtitles() {
  const subtitleContainer = document.getElementById('whatsub-container');
  if (subtitleContainer) {
    subtitleContainer.style.display = 'none';
    console.log('자막이 비활성화되었습니다.');
  }
}

// 자막 번역 함수 (실제 구현에서는 백그라운드에서 처리)
function translateSubtitles(subtitles, targetLanguage) {
  console.log(`자막을 ${targetLanguage}로 번역합니다.`);
  // 실제 구현에서는 백그라운드로 번역 요청
  chrome.runtime.sendMessage({
    action: 'translateSubtitles',
    subtitles: subtitles,
    targetLanguage: targetLanguage
  }, (response) => {
    if (response && response.success) {
      updateSubtitles(response.translatedSubtitles);
    }
  });
}

// 자막 업데이트 함수
function updateSubtitles(subtitles) {
  const subtitleContainer = document.getElementById('whatsub-container');
  if (subtitleContainer) {
    // 실제 구현에서는 자막 텍스트 업데이트
    console.log('자막이 업데이트되었습니다.');
  }
}

// 페이지 로드 시 초기화
window.addEventListener('load', initializeExtension);

// URL 변경 감지 (YouTube SPA 지원)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('페이지 URL이 변경되었습니다:', url);
    initializeExtension();
  }
}).observe(document, { subtree: true, childList: true });

// 초기화 실행
initializeExtension(); 