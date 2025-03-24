// 상태 관리 객체
const state = {
  currentTab: 'signin',
  isAuthenticated: false,
  user: null,
  usageData: null,
  isDevMode: false
};

/**
 * Whatsub 팝업 - 통신 함수
 * background.js로 메시지를 전송하고 응답을 받는 함수
 */
async function sendMessage(action, data = {}) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('메시지 전송 오류:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    } catch (error) {
      console.error('메시지 전송 중 오류 발생:', error);
      reject(error);
    }
  });
}

// Whatsub 팝업 초기화 함수
function initializePopup() {
  try {
    console.log('팝업 초기화 시작...');
    showLoading();
    
    // 탭 버튼 이벤트 리스너 등록
    const mainTabBtn = document.getElementById('tab-main');
    const settingsTabBtn = document.getElementById('tab-settings');
    const helpTabBtn = document.getElementById('tab-help');
    
    if (mainTabBtn) mainTabBtn.addEventListener('click', () => switchTab('main'));
    if (settingsTabBtn) settingsTabBtn.addEventListener('click', () => switchTab('settings'));
    if (helpTabBtn) helpTabBtn.addEventListener('click', () => switchTab('help'));
    
    // 로그인 버튼 이벤트 리스너
    const googleSigninBtn = document.getElementById('google-signin');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const gotoLoginBtn = document.getElementById('goto-login');
    
    if (googleSigninBtn) googleSigninBtn.addEventListener('click', handleGoogleSignIn);
    if (loginBtn) loginBtn.addEventListener('click', handleGoogleSignIn);
    if (signupBtn) signupBtn.addEventListener('click', handleSignup);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (gotoLoginBtn) gotoLoginBtn.addEventListener('click', () => switchTab('signin'));
    
    // 피드백 및 링크 이벤트 리스너
    const feedbackLink = document.getElementById('feedback-link');
    const privacyLink = document.getElementById('privacy-link');
    const termsLink = document.getElementById('terms-link');
    const helpCenterLink = document.getElementById('help-center-link');
    
    if (feedbackLink) feedbackLink.addEventListener('click', handleFeedback);
    if (privacyLink) privacyLink.addEventListener('click', () => openExternalPage('https://whatsub.netlify.app/privacy'));
    if (termsLink) termsLink.addEventListener('click', () => openExternalPage('https://whatsub.netlify.app/terms'));
    if (helpCenterLink) helpCenterLink.addEventListener('click', () => openExternalPage('https://whatsub.netlify.app/help'));
    
    // 개발자 모드 설정 확인
    const devModeCheckbox = document.getElementById('dev-mode');
    const debugInfo = document.getElementById('debug-info');
    const checkAuthBtn = document.getElementById('check-auth-btn');
    const reloadBtn = document.getElementById('reload-btn');
    
    if (devModeCheckbox) {
      // 개발자 모드 상태 가져오기
      chrome.storage.sync.get('devMode', function(data) {
        state.isDevMode = data.devMode === true;
        devModeCheckbox.checked = state.isDevMode;
        
        // 디버그 정보 영역 표시/숨김
        if (debugInfo) {
          debugInfo.style.display = state.isDevMode ? 'block' : 'none';
        }
      });
      
      // 개발자 모드 변경 이벤트
      devModeCheckbox.addEventListener('change', function(e) {
        state.isDevMode = e.target.checked;
        chrome.storage.sync.set({devMode: state.isDevMode});
        
        if (debugInfo) {
          debugInfo.style.display = state.isDevMode ? 'block' : 'none';
        }
      });
    }
    
    // 디버그 버튼 이벤트 리스너
    if (checkAuthBtn) checkAuthBtn.addEventListener('click', checkAuthState);
    if (reloadBtn) reloadBtn.addEventListener('click', reloadPage);
    
    // 인증 상태 확인
    checkAuthState();
    
    console.log('팝업 초기화 완료');
  } catch (error) {
    console.error('팝업 초기화 오류:', error);
    showMessage('초기화 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
  } finally {
    hideLoading();
  }
}

// 사용량 데이터 로드
async function loadUsageData(email) {
  if (!email || !state.isAuthenticated) {
    console.log('이메일이 없거나 로그인되지 않아 사용량 데이터를 로드하지 않음');
    return;
  }
  
  try {
    // 백그라운드에 사용량 정보 요청
    const response = await sendMessage('getUsage', { email });
    
    if (response?.success) {
      state.usageData = response.usage;
      
      // UI 업데이트
      const usageTextEl = document.getElementById('usage-text');
      const usageFillEl = document.getElementById('usage-fill');
      const subscriptionStatusEl = document.getElementById('subscription-status');
      
      if (usageTextEl && state.usageData) {
        const { whisper } = state.usageData;
        const usagePercent = Math.min(100, (whisper.used / whisper.limit) * 100);
        
        usageTextEl.textContent = `오늘 ${whisper.used}/${whisper.limit}분 사용함`;
        
        if (usageFillEl) {
          usageFillEl.style.width = `${usagePercent}%`;
          
          // 사용량에 따른 색상 변경
          if (usagePercent > 90) {
            usageFillEl.style.backgroundColor = '#e74c3c'; // 빨간색
          } else if (usagePercent > 70) {
            usageFillEl.style.backgroundColor = '#f39c12'; // 주황색
          }
        }
      }
      
      if (subscriptionStatusEl && state.user) {
        const planName = response.subscription?.plan || 'free';
        subscriptionStatusEl.textContent = `현재 플랜: ${planName === 'free' ? '무료' : '프리미엄'}`;
      }
    }
  } catch (error) {
    console.error('사용량 데이터 로드 중 오류 발생:', error);
  }
}

// 구글 로그인 처리
async function handleGoogleSignIn() {
  try {
    showLoading();
    showMessage('로그인 중...', 'info');
    
    // 백그라운드 서비스에 로그인 요청
    const response = await sendMessage('signInWithGoogle');
    
    if (response && response.success) {
      console.log('로그인 성공:', response.user);
      showMessage('로그인 성공', 'success');
      
      // 사용자 정보 저장 및 UI 업데이트
      state.isAuthenticated = true;
      state.user = response.user;
      
      // 사용자 정보 표시
      updateAuthState();
      
      // 메인 탭으로 전환
      switchTab('main');
    } else {
      console.error('로그인 실패:', response?.error || '알 수 없는 오류');
      showMessage(response?.error || '로그인에 실패했습니다.', 'error');
      switchTab('signin');
    }
  } catch (error) {
    console.error('로그인 중 오류 발생:', error);
    showMessage('로그인 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 회원가입 처리
function handleSignup() {
  openExternalPage('https://whatsub.netlify.app/signup');
}

// 로그아웃 처리
async function handleLogout() {
  try {
    showLoading();
    showMessage('로그아웃 중...', 'info');
    
    // 백그라운드 서비스에 로그아웃 요청
    const response = await sendMessage('signOut');
    
    if (response && response.success) {
      console.log('로그아웃 성공');
      showMessage('로그아웃 되었습니다.', 'success');
      
      // 상태 초기화
      state.isAuthenticated = false;
      state.user = null;
      state.usageData = null;
      
      // UI 업데이트
      updateAuthState();
      
      // 로그인 탭으로 전환
      switchTab('signin');
    } else {
      console.error('로그아웃 실패:', response?.error || '알 수 없는 오류');
      showMessage(response?.error || '로그아웃에 실패했습니다.', 'error');
    }
  } catch (error) {
    console.error('로그아웃 중 오류 발생:', error);
    showMessage('로그아웃 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 인증 상태 확인
async function checkAuthState() {
  try {
    showLoading();
    
    // 백그라운드 서비스에 인증 상태 확인 요청
    const response = await sendMessage('checkAuth');
    
    if (response && response.isAuthenticated) {
      // 인증된 상태
      state.isAuthenticated = true;
      state.user = response.user;
      
      console.log('인증 상태 확인: 로그인됨', state.user);
      
      // UI 업데이트
      updateAuthState();
      
      // 메인 탭으로 전환 (처음 로드 시에만)
      if (!state.currentTab || state.currentTab === 'signin') {
        switchTab('main');
      }
      
      // 사용량 데이터 로드
      if (state.user && state.user.email) {
        loadUsageData(state.user.email);
      }
    } else {
      // 인증되지 않은 상태
      state.isAuthenticated = false;
      state.user = null;
      
      console.log('인증 상태 확인: 로그인되지 않음');
      
      // UI 업데이트
      updateAuthState();
      
      // 로그인 탭으로 전환 (처음 로드 시에만)
      if (!state.currentTab || state.currentTab === 'main') {
        switchTab('signin');
      }
    }
  } catch (error) {
    console.error('인증 상태 확인 중 오류 발생:', error);
    showMessage('인증 상태 확인 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 인증 상태에 따른 UI 업데이트
function updateAuthState() {
  // 사용자 정보 UI 업데이트
  const userNameEl = document.getElementById('user-name');
  const userEmailEl = document.getElementById('user-email');
  const userAvatarEl = document.getElementById('user-avatar');
  
  if (state.isAuthenticated && state.user) {
    // 사용자 정보 표시
    if (userNameEl) userNameEl.textContent = state.user.displayName || state.user.email.split('@')[0];
    if (userEmailEl) userEmailEl.textContent = state.user.email;
    if (userAvatarEl && state.user.photoURL) userAvatarEl.src = state.user.photoURL;
    
    // 로그인 필요 메시지 숨김
    const loginRequiredEl = document.getElementById('login-required-message');
    if (loginRequiredEl) loginRequiredEl.style.display = 'none';
    
    // 사용자 정보 컨테이너 표시
    const userInfoContainerEl = document.getElementById('user-info-container');
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'block';
    
    // 컨트롤 컨테이너 표시
    const controlsContainerEl = document.getElementById('controls-container');
    if (controlsContainerEl) controlsContainerEl.style.display = 'block';
  } else {
    // 로그인 상태가 아닐 때
    // 로그인 필요 메시지 표시
    const loginRequiredEl = document.getElementById('login-required-message');
    if (loginRequiredEl) loginRequiredEl.style.display = 'block';
    
    // 사용자 정보 컨테이너 숨김
    const userInfoContainerEl = document.getElementById('user-info-container');
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'none';
    
    // 컨트롤 컨테이너 숨김
    const controlsContainerEl = document.getElementById('controls-container');
    if (controlsContainerEl) controlsContainerEl.style.display = 'none';
  }
  
  // 디버그 정보 업데이트
  updateDebugInfo();
}

// 디버그 정보 업데이트
function updateDebugInfo() {
  if (!state.isDevMode) return;
  
  const debugInfoEl = document.getElementById('debug-info-content');
  if (!debugInfoEl) return;
  
  // 디버그 정보 생성
  const debugInfo = {
    isAuthenticated: state.isAuthenticated,
    currentTab: state.currentTab,
    user: state.user ? {
      email: state.user.email,
      displayName: state.user.displayName,
      uid: state.user.uid
    } : null,
    usageData: state.usageData
  };
  
  // JSON으로 표시
  debugInfoEl.textContent = JSON.stringify(debugInfo, null, 2);
}

// 탭 전환
function switchTab(tabId) {
  console.log(`탭 전환: ${state.currentTab} -> ${tabId}`);
  
  // 모든 탭 숨김
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // 탭 버튼 선택 상태 업데이트
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => button.classList.remove('active'));
  
  // 선택한 탭 표시
  const selectedTab = document.getElementById(`${tabId}-tab`);
  if (selectedTab) {
    selectedTab.classList.add('active');
    state.currentTab = tabId;
    
    // 탭 버튼 선택 표시
    const tabButton = document.getElementById(`tab-${tabId}`);
    if (tabButton) tabButton.classList.add('active');
  }
  
  // 로그인 확인 및 메인 탭 접근 제어
  if (tabId === 'main' && !state.isAuthenticated) {
    // 로그인이 필요한 경우 로그인 필요 메시지 표시
    const loginRequiredEl = document.getElementById('login-required-message');
    if (loginRequiredEl) loginRequiredEl.style.display = 'block';
    
    // 콘텐츠 컨테이너 숨김
    const userInfoContainerEl = document.getElementById('user-info-container');
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'none';
    
    const controlsContainerEl = document.getElementById('controls-container');
    if (controlsContainerEl) controlsContainerEl.style.display = 'none';
  }
  
  // 디버그 정보 업데이트
  updateDebugInfo();
}

// 피드백 처리
function handleFeedback() {
  const email = state.user?.email || '';
  const subject = 'WhaSub 피드백';
  const body = `
  WhaSub 버전: ${chrome.runtime.getManifest().version}
  브라우저: ${navigator.userAgent}
  
  피드백 내용:
  
  `;
  
  // mailto 대신 웹 페이지로 이동
  openExternalPage(`https://whatsub.netlify.app/feedback`);
}

// 외부 페이지 열기
function openExternalPage(url) {
  chrome.tabs.create({ url });
}

// 페이지 새로고침
function reloadPage() {
  location.reload();
}

// 로딩 표시
function showLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'flex';
}

// 로딩 숨김
function hideLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
}

// 메시지 표시
function showMessage(message, type = 'info') {
  console.log(`메시지 표시: ${message} (${type})`);
  
  // 기존 메시지 제거
  const existingMessages = document.querySelectorAll('.message');
  existingMessages.forEach(el => el.remove());
  
  // 새 메시지 생성
  const messageEl = document.createElement('div');
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  
  // 메시지 추가
  document.body.appendChild(messageEl);
  
  // 자동 제거 타이머
  setTimeout(() => {
    messageEl.classList.add('fade-out');
    setTimeout(() => messageEl.remove(), 500);
  }, 3000);
}

// 문서 로드 완료 시 초기화 함수 실행
document.addEventListener('DOMContentLoaded', initializePopup);