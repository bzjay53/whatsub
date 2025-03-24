// WhatsUb 콘텐츠 스크립트 (기본 버전)
console.log('WhatsUb 콘텐츠 스크립트가 로드되었습니다.');

// 확장 프로그램 상태 초기화
let isInitialized = false;
let isSubtitleEnabled = false;
let selectedLanguage = 'ko';
let subtitleContainer = null;

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('콘텐츠 스크립트 메시지 수신:', message.action);
  
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
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkStatus') {
    sendResponse({ 
      isInitialized,
      isSubtitleEnabled,
      selectedLanguage
    });
  }
  
  return true;
});

// 페이지 초기화 함수
function initializeExtension() {
  if (isInitialized) return;
  
  // 자막 컨테이너 생성
  createSubtitleContainer();
  
  // 백그라운드 스크립트에 페이지 로드 알림
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href
  });
  
  isInitialized = true;
  console.log('WhatsUb 확장 프로그램이 초기화되었습니다.');
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
  subtitleContainer.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 18px;
    z-index: 9999;
    text-align: center;
    max-width: 80%;
    display: none;
    user-select: none;
    pointer-events: auto;
    font-family: 'Arial', sans-serif;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  `;
  
  // 드래그 가능하게 설정
  makeDraggable(subtitleContainer);
  
  // 문서에 추가
  document.body.appendChild(subtitleContainer);
  console.log('자막 컨테이너가 생성되었습니다.');
}

// 드래그 기능 구현
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  element.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // 마우스 위치 가져오기
    pos3 = e.clientX;
    pos4 = e.clientY;
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
    // 요소가 가운데 정렬에서 벗어날 때 transform 수정
    element.style.transform = 'none';
  }
  
  function closeDragElement() {
    // 움직임 중지
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// 자막 표시 함수
function showSubtitles() {
  if (!subtitleContainer) {
    createSubtitleContainer();
  }
  
  subtitleContainer.style.display = 'block';
  console.log('자막이 활성화되었습니다.');
}

// 자막 텍스트 업데이트
function updateSubtitles(text, translatedText = '') {
  if (!subtitleContainer) {
    createSubtitleContainer();
  }
  
  // 원본 텍스트 표시
  let htmlContent = `<div style="margin-bottom: 5px;">${text}</div>`;
  
  // 번역 텍스트가 있는 경우 추가
  if (translatedText) {
    htmlContent += `<div style="color: #4fc3f7;">${translatedText}</div>`;
  }
  
  subtitleContainer.innerHTML = htmlContent;
}

// 자막 숨김 함수
function hideSubtitles() {
  if (subtitleContainer) {
    subtitleContainer.style.display = 'none';
    console.log('자막이 비활성화되었습니다.');
  }
}

// 페이지 로드 시 초기화
window.addEventListener('load', initializeExtension);

// 초기화 실행 (load 이벤트 전에도 실행)
initializeExtension();

// 테스트용 자막 표시 (실제로는 백그라운드에서 전달받음)
setTimeout(() => {
  if (isInitialized) {
    updateSubtitles('WhatsUb 확장 프로그램이 정상적으로 로드되었습니다.', 'WhatsUb extension loaded successfully.');
    showSubtitles();
    
    // 3초 후 숨김
    setTimeout(() => {
      hideSubtitles();
    }, 3000);
  }
}, 1000); 