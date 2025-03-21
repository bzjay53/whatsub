// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userPlan = document.getElementById('user-plan');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const optionsButton = document.getElementById('options-button');
const upgradeButton = document.getElementById('upgrade-button');
const openAppButton = document.getElementById('open-app-button');
const whisperUsageText = document.querySelector('#whisper-usage .usage-text');
const translationUsageText = document.querySelector('#translation-usage .usage-text');
const whisperProgressBar = document.querySelector('#whisper-usage .progress-bar');
const translationProgressBar = document.querySelector('#translation-usage .progress-bar');
const errorDisplay = document.getElementById('error-display');
// 자막 상태를 에러 디스플레이에 표시합니다
// const subtitleStatus = document.getElementById('subtitle-status');
// const startSubtitlesButton = document.getElementById('start-subtitles');

// 상태 관리
let state = {
  isLoggedIn: false,
  user: null,
  subscription: 'free',
  usage: {
    whisper: {
      used: 0,
      limit: 60
    },
    translation: {
      used: 0,
      limit: 5000
    }
  }
};

// 상태 메시지를 표시하는 함수
function showStatusMessage(message, type = 'info', duration = 0) {
  const statusContainer = document.getElementById('statusContainer');
  
  if (!statusContainer) {
    console.error('상태 메시지 컨테이너를 찾을 수 없습니다.');
    return;
  }
  
  // 이전 타이머 취소
  if (window.statusTimer) {
    clearTimeout(window.statusTimer);
  }
  
  // 상태 메시지 요소 생성
  const statusElement = document.createElement('div');
  statusElement.className = `status-message ${type}`;
  statusElement.textContent = message;
  
  // 닫기 버튼 추가
  const closeButton = document.createElement('span');
  closeButton.className = 'close-status';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => {
    statusContainer.innerHTML = '';
  };
  
  statusElement.appendChild(closeButton);
  
  // 상태 메시지 표시
  statusContainer.innerHTML = '';
  statusContainer.appendChild(statusElement);
  
  // 자동 닫기 타이머 설정 (오류는 수동으로 닫아야 함)
  if (duration > 0 && type !== 'error') {
    window.statusTimer = setTimeout(() => {
      if (statusContainer.contains(statusElement)) {
        statusContainer.innerHTML = '';
      }
    }, duration);
  }
}

// 상태 메시지를 숨기는 함수
function hideStatusMessage() {
  if (errorDisplay) {
    errorDisplay.textContent = '';
    errorDisplay.style.display = 'none';
    errorDisplay.classList.remove('error');
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('팝업 초기화 중...');
  
  // DOM 요소 확인
  console.log('로그인 섹션:', loginSection);
  console.log('대시보드 섹션:', dashboardSection);
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  try {
    // 인증 상태 확인
    await checkAuthStatus();
    
    // 사용량 정보 업데이트
    if (state.isLoggedIn) {
      await updateUsageDisplay();
    }
  } catch (error) {
    console.error('초기화 오류:', error);
    showError('확장 프로그램을 초기화하는 중 오류가 발생했습니다.');
  }
});

// 이벤트 리스너 설정
function setupEventListeners() {
  // 로그인 버튼
  loginButton.addEventListener('click', async () => {
    try {
      // 로그인 상태 표시
      showStatusMessage('Google 계정으로 로그인 중...', 'info');
      
      // 로그인 버튼 비활성화 및 로딩 상태 표시
      const loginButton = document.getElementById('login-button');
      loginButton.disabled = true;
      loginButton.innerHTML = '<span class="spinner"></span> 로그인 중...';
      
      // 백그라운드 스크립트에 로그인 메시지 전송
      const response = await chrome.runtime.sendMessage({ action: 'login' });
      
      // 로그인 응답 처리
      if (response.success) {
        console.log('로그인 성공:', response);
        
        // 로그인 상태 저장
        state.isLoggedIn = true;
        state.user = response.userData;
        
        // 사용자 정보 표시
        displayUserInfo(response.userData);
        
        // 구독 정보 업데이트
        updateSubscriptionInfo(response.userData.subscription || 'free');
        
        // 사용량 정보 업데이트
        await updateUsageDisplay();
        
        // Airtable 연결 상태에 따른 메시지 표시
        if (!response.airtableSuccess) {
          showStatusMessage('로그인 성공! 사용자 데이터 저장에 문제가 있지만 기본 기능은 정상적으로 작동합니다.', 'warning', 5000);
        } else {
          showStatusMessage('로그인 성공!', 'success', 3000);
        }
      } else {
        console.error('로그인 실패:', response.error);
        
        // 오류 메시지 처리
        let errorMessage = response.error || '로그인 중 오류가 발생했습니다.';
        
        // 특정 오류 메시지에 대한 사용자 친화적인 메시지 제공
        if (errorMessage.includes('액세스 권한')) {
          errorMessage = '계속하려면 Google 계정 액세스를 허용해주세요.';
        } else if (errorMessage.includes('OAuth 설정 오류')) {
          errorMessage = '확장 프로그램 인증 설정에 문제가 있습니다. 최신 버전으로 업데이트하거나 지원팀에 문의해주세요.';
        } else if (errorMessage.includes('canceled')) {
          errorMessage = '로그인이 취소되었습니다. 다시 시도해주세요.';
        }
        
        showStatusMessage(errorMessage, 'error');
        
        // 로그인 버튼 상태 복원
        updateLoginSection(false);
      }
    } catch (error) {
      console.error('로그인 처리 중 오류 발생:', error);
      showStatusMessage(`로그인 오류: ${error.message}`, 'error');
      
      // 로그인 버튼 상태 복원
      updateLoginSection(false);
    }
  });
  
  // 로그아웃 버튼
  logoutButton.addEventListener('click', async () => {
    try {
      const response = await sendMessage({
        action: 'signOut'
      });
      
      if (response && response.success) {
        state.isLoggedIn = false;
        state.user = null;
        state.subscription = 'free';
        
        // 상태 업데이트
        displayLoggedOut();
      } else {
        showError(response?.error || '로그아웃에 실패했습니다');
      }
    } catch (error) {
      showError(`로그아웃 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  });
  
  // 업그레이드 버튼
  upgradeButton.addEventListener('click', handleUpgradeClick);
  
  // 웹 앱 열기 버튼
  openAppButton.addEventListener('click', handleOpenAppClick);
}

// 인증 상태 확인
async function checkAuthStatus() {
  try {
    const response = await sendMessage({
      action: 'GET_USER'
    });
    
    console.log('인증 상태 응답:', response);
    
    if (response.success && response.isAuthenticated && response.user) {
      state.isLoggedIn = true;
      state.user = response.user;
      
      // 사용자 정보 표시
      displayUserInfo(response.user);
      
      // 구독 상태 확인
      await checkSubscription(response.user.email);
    } else {
      // 로그아웃 상태 표시
      displayLoggedOut();
    }
  } catch (error) {
    console.error('인증 상태 확인 오류:', error);
    displayLoggedOut();
  }
}

// 로그인 상태 표시
function displayUserInfo(user) {
  try {
    // 사용자 정보 섹션 표시
    console.log('로그인 상태 표시', loginSection, dashboardSection);
    
    if (loginSection) {
      loginSection.style.display = 'none';
    }
    
    if (dashboardSection) {
      dashboardSection.style.display = 'block';
    }
    
    // 사용자 정보 업데이트
    if (userAvatar && user.photoURL) {
      userAvatar.src = user.photoURL;
    } else if (userAvatar) {
      userAvatar.src = 'assets/default-avatar.svg';
    }
    
    if (userName) {
      userName.textContent = user.name || '사용자';
    }
    
    if (userEmail) {
      userEmail.textContent = user.email || '';
    }
    
    // 구독 정보 업데이트
    if (userPlan) {
      if (state.subscription === 'premium') {
        userPlan.textContent = '프리미엄';
        userPlan.className = 'badge premium';
      } else {
        userPlan.textContent = '무료';
        userPlan.className = 'badge free';
      }
    }
  } catch (error) {
    console.error('사용자 정보 표시 오류:', error);
  }
}

// 로그아웃 상태 표시
function displayLoggedOut() {
  try {
    console.log('로그아웃 상태 표시', loginSection, dashboardSection);
    
    // 로그인 섹션 표시
    if (loginSection) {
      loginSection.style.display = 'block';
    }
    
    if (dashboardSection) {
      dashboardSection.style.display = 'none';
    }
    
    // 상태 초기화
    state.isLoggedIn = false;
    state.user = null;
    state.subscription = 'free';
    
    // 사용량 디스플레이 초기화
    updateUsageDisplay();
  } catch (error) {
    console.error('로그아웃 상태 표시 오류:', error);
  }
}

// 구독 상태 확인
async function checkSubscription(email) {
  try {
    if (!email) {
      console.warn('이메일이 제공되지 않아 구독 상태를 확인할 수 없습니다.');
      return;
    }
    
    console.log('구독 상태 확인 중:', email);
    const response = await sendMessage({
      action: 'CHECK_SUBSCRIPTION'
    });
    
    console.log('구독 상태 응답:', response);
    
    if (response && response.success) {
      state.subscription = response.subscription;
      
      // 사용량 정보 업데이트
      await updateUsageDisplay();
      
      return response.subscription;
    } else {
      console.warn('구독 상태 확인 실패:', response?.error || '알 수 없는 오류');
      state.subscription = 'free';
      
      return 'free';
    }
  } catch (error) {
    console.error('구독 상태 확인 오류:', error);
    state.subscription = 'free';
    
    return 'free';
  }
}

// 사용량 정보 표시 업데이트
async function updateUsageDisplay() {
  try {
    // 사용량 정보 로드
    const data = await chrome.storage.local.get('usage');
    const usage = data.usage || {
      whisper: { used: 0, limit: 60 },
      translation: { used: 0, limit: 5000 }
    };
    
    console.log('사용량 정보:', usage);
    
    // 상태 업데이트
    state.usage = usage;
    
    // 현재 구독에 따른 제한 설정
    if (state.subscription === 'premium') {
      state.usage.whisper.limit = 500; // 프리미엄 한도
      state.usage.translation.limit = 50000; // 프리미엄 한도
    } else {
      state.usage.whisper.limit = 60; // 무료 한도
      state.usage.translation.limit = 5000; // 무료 한도
    }
    
    // UI 업데이트
    const whisperPercent = Math.min(100, (state.usage.whisper.used / state.usage.whisper.limit) * 100);
    const translationPercent = Math.min(100, (state.usage.translation.used / state.usage.translation.limit) * 100);
    
    // Whisper 사용량 텍스트
    if (whisperUsageText) {
      whisperUsageText.textContent = `${state.usage.whisper.used} / ${state.usage.whisper.limit} 분`;
    }
    
    // 번역 사용량 텍스트
    if (translationUsageText) {
      translationUsageText.textContent = `${state.usage.translation.used} / ${state.usage.translation.limit} 자`;
    }
    
    // 프로그레스 바 업데이트
    if (whisperProgressBar) {
      whisperProgressBar.style.width = `${whisperPercent}%`;
    }
    
    if (translationProgressBar) {
      translationProgressBar.style.width = `${translationPercent}%`;
    }
    
    // 구독 타입에 따른 UI 업데이트
    if (state.subscription === 'premium' && upgradeButton) {
      upgradeButton.style.display = 'none';
    } else if (upgradeButton) {
      upgradeButton.style.display = 'block';
    }
  } catch (error) {
    console.error('사용량 정보 업데이트 오류:', error);
  }
}

// 자막 시작
async function startSubtitles() {
  try {
    // 기능 사용 가능 여부 확인
    const canUseResult = await chrome.runtime.sendMessage({ 
      action: 'canUseFeature',
      feature: 'whisper'
    });
    
    console.log('기능 사용 가능 여부:', canUseResult);
    
    if (!canUseResult.canUse) {
      // 사용 제한에 도달한 경우
      showStatusMessage(canUseResult.message || '자막 기능을 사용할 수 없습니다');
      return;
    }
    
    // 현재 활성 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showStatusMessage('활성 탭을 찾을 수 없습니다');
      return;
    }
    
    const activeTab = tabs[0];
    
    // 지원되는 사이트인지 확인
    if (!isSupportedSite(activeTab.url)) {
      showStatusMessage('현재 사이트는 지원되지 않습니다');
      return;
    }
    
    // 컨텐츠 스크립트 실행
    chrome.runtime.sendMessage({ 
      action: 'executeScript',
      tabId: activeTab.id
    }, (response) => {
      if (response && response.success) {
        showStatusMessage('자막 준비 중...');
        
        // 캡처 시작
        chrome.runtime.sendMessage({ 
          action: 'startCapture',
          tabId: activeTab.id
        }, (captureResponse) => {
          if (captureResponse && captureResponse.success) {
            showStatusMessage('자막 활성화됨');
          } else {
            showStatusMessage(captureResponse?.error || '자막 활성화 실패');
          }
        });
      } else {
        showStatusMessage(response?.error || '스크립트 실행 실패');
      }
    });
  } catch (error) {
    console.error('자막 시작 오류:', error);
    showStatusMessage('자막 시작 중 오류가 발생했습니다');
  }
}

// 지원되는 사이트인지 확인
function isSupportedSite(url) {
  if (!url) return false;
  
  // 지원되는 도메인 목록
  const supportedDomains = [
    'youtube.com',
    'youtu.be',
    'netflix.com',
    'disneyplus.com',
    'hulu.com',
    'amazon.com/Prime-Video',
    'primevideo.com',
    'hbomax.com',
    'twitch.tv',
    'vimeo.com',
    'dailymotion.com',
    'ted.com'
  ];
  
  return supportedDomains.some(domain => url.includes(domain));
}

// 메시지 리스너 - 백그라운드 스크립트에서 상태 변경 감지
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('메시지 수신:', message);
  
  switch (message.action) {
    case 'authStateChanged':
      // 인증 상태가 변경됨
      checkAuthStatus().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'usageUpdated':
      // 사용량이 업데이트됨
      updateUsageDisplay().then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});

// 메시지 전송 헬퍼 함수
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 에러 표시
function showError(message) {
  errorDisplay.textContent = message;
  errorDisplay.style.display = 'block';
  errorDisplay.classList.add('error');
  
  // 5초 후에 에러 메시지 사라짐
  setTimeout(() => {
    errorDisplay.style.opacity = '0';
    setTimeout(() => {
      errorDisplay.style.display = 'none';
      errorDisplay.style.opacity = '1';
      errorDisplay.classList.remove('error');
    }, 500);
  }, 5000);
}

// 업그레이드 버튼 클릭 처리
function handleUpgradeClick() {
  // 프리미엄 구독 페이지로 연결
  chrome.tabs.create({ url: 'https://whatsub-extension.web.app/premium' });
}

// 웹 앱 열기 버튼 클릭 처리
function handleOpenAppClick() {
  // Whatsub 웹 앱 메인 페이지로 연결
  chrome.tabs.create({ url: 'https://whatsub-extension.web.app' });
}

// 로그인/로그아웃 섹션 업데이트
function updateLoginSection(isLoggedIn) {
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  
  if (isLoggedIn) {
    // 로그인 상태
    loginButton.style.display = 'none';
    document.getElementById('loginPrompt').style.display = 'none';
    document.getElementById('userSection').style.display = 'block';
    logoutButton.style.display = 'block';
  } else {
    // 로그아웃 상태
    loginButton.disabled = false;
    loginButton.innerHTML = '<img src="assets/google-icon.svg" alt="Google" class="google-icon"> Google로 로그인';
    loginButton.style.display = 'block';
    document.getElementById('loginPrompt').style.display = 'block';
    document.getElementById('userSection').style.display = 'none';
    logoutButton.style.display = 'none';
  }
} 