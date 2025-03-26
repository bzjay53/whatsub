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
    
    // 자막 필터링 토글 이벤트 리스너 추가
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('change', function(e) {
        const isEnabled = e.target.checked;
        toggleSubtitleFilter(isEnabled);
      });
    }
    
    // 필터 언어 선택 이벤트 리스너 추가
    const filterLanguage = document.getElementById('filter-language');
    if (filterLanguage) {
      filterLanguage.addEventListener('change', function(e) {
        const language = e.target.value;
        changeFilterLanguage(language);
      });
    }
    
    // 자막 설정 저장 버튼 이벤트 리스너
    const saveSettingsBtn = document.getElementById('save-settings');
    const saveSettings2Btn = document.getElementById('save-settings-2');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', saveSubtitleSettings);
    }
    if (saveSettings2Btn) {
      saveSettings2Btn.addEventListener('click', saveSubtitleSettings);
    }
    
    // 설정 초기화 버튼 이벤트 리스너
    const resetSettingsBtn = document.getElementById('reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', resetSettings);
    }
    
    // 자동 시작 토글 이벤트 리스너
    const autoStartToggle = document.getElementById('auto-start');
    if (autoStartToggle) {
      chrome.storage.sync.get('autoStart', function(data) {
        autoStartToggle.checked = data.autoStart === true;
      });
      
      autoStartToggle.addEventListener('change', function(e) {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ autoStart: isEnabled });
        showMessage(isEnabled ? '자동 시작이 활성화되었습니다.' : '자동 시작이 비활성화되었습니다.');
      });
    }
    
    // 테스트 자막 표시 버튼
    const testSubtitleBtn = document.getElementById('test-subtitle-btn');
    if (testSubtitleBtn) {
      testSubtitleBtn.addEventListener('click', showTestSubtitle);
    }
    
    // 인증 상태 확인
    checkAuthState();
    
    // 자막 설정 불러오기
    loadSubtitleSettings();
    
    console.log('팝업 초기화 완료');
  } catch (error) {
    console.error('팝업 초기화 오류:', error);
    showMessage('초기화 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
  } finally {
    hideLoading();
  }
}

// 새로 추가된 함수: 자막 필터링 토글
async function toggleSubtitleFilter(isEnabled) {
  try {
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('활성화된 탭을 찾을 수 없습니다.');
      return;
    }
    
    // 콘텐츠 스크립트에 메시지 전송
    await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'toggleSubtitles',
      enabled: isEnabled
    });
    
    // 상태 저장
    chrome.storage.sync.set({ subtitleEnabled: isEnabled });
    
    showMessage(isEnabled ? '자막 필터링이 활성화되었습니다.' : '자막 필터링이 비활성화되었습니다.');
  } catch (error) {
    console.error('자막 필터링 토글 중 오류 발생:', error);
    showMessage('자막 기능 제어 중 오류가 발생했습니다.', 'error');
  }
}

// 새로 추가된 함수: 필터 언어 변경
async function changeFilterLanguage(language) {
  try {
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('활성화된 탭을 찾을 수 없습니다.');
      return;
    }
    
    // 콘텐츠 스크립트에 메시지 전송
    await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'changeLanguage',
      language: language
    });
    
    // 상태 저장
    chrome.storage.sync.set({ subtitleLanguage: language });
    
    showMessage(`번역 언어가 변경되었습니다: ${getLanguageName(language)}`);
  } catch (error) {
    console.error('필터 언어 변경 중 오류 발생:', error);
    showMessage('언어 설정 변경 중 오류가 발생했습니다.', 'error');
  }
}

// 언어 코드에서 언어 이름 가져오기
function getLanguageName(code) {
  const languages = {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    zh: '중국어'
  };
  return languages[code] || code;
}

// 자막 설정 저장
async function saveSubtitleSettings() {
  try {
    // 설정 값 가져오기
    const captionPosition = document.getElementById('caption-position').value;
    const fontSize = document.getElementById('font-size').value;
    const background = document.getElementById('background-opacity').value;
    const dualSubtitles = document.getElementById('dual-subtitle').checked;
    
    // 설정 객체 생성
    const settings = {
      position: captionPosition,
      fontSize: fontSize,
      background: background,
      dualSubtitles: dualSubtitles
    };
    
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      // 콘텐츠 스크립트에 메시지 전송
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateSettings',
        settings: settings
      });
    }
    
    // 로컬 스토리지에 설정 저장
    chrome.storage.sync.set({ subtitleSettings: settings });
    
    showMessage('자막 설정이 저장되었습니다.', 'success');
  } catch (error) {
    console.error('자막 설정 저장 중 오류 발생:', error);
    showMessage('설정 저장 중 오류가 발생했습니다.', 'error');
  }
}

// 자막 설정 불러오기
function loadSubtitleSettings() {
  chrome.storage.sync.get(['subtitleEnabled', 'subtitleLanguage', 'subtitleSettings'], function(data) {
    // 자막 필터링 활성화 상태 설정
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.checked = data.subtitleEnabled === true;
    }
    
    // 필터 언어 설정
    const filterLanguage = document.getElementById('filter-language');
    if (filterLanguage && data.subtitleLanguage) {
      filterLanguage.value = data.subtitleLanguage;
    }
    
    // 자막 위치 및 폰트 크기 설정
    if (data.subtitleSettings) {
      const captionPosition = document.getElementById('caption-position');
      const fontSize = document.getElementById('font-size');
      const backgroundOpacity = document.getElementById('background-opacity');
      const dualSubtitle = document.getElementById('dual-subtitle');
      
      if (captionPosition && data.subtitleSettings.position) {
        captionPosition.value = data.subtitleSettings.position;
      }
      
      if (fontSize && data.subtitleSettings.fontSize) {
        fontSize.value = data.subtitleSettings.fontSize;
      }
      
      if (backgroundOpacity && data.subtitleSettings.background) {
        backgroundOpacity.value = data.subtitleSettings.background;
      }
      
      if (dualSubtitle) {
        dualSubtitle.checked = data.subtitleSettings.dualSubtitles !== false;
      }
    }
  });
}

// 기존 설정 초기화
function resetSettings() {
  // 기본 설정 값
  const defaultSettings = {
    subtitleEnabled: false,
    subtitleLanguage: 'ko',
    subtitleSettings: {
      position: 'bottom',
      fontSize: 'medium',
      background: 'semi',
      dualSubtitles: true
    }
  };
  
  // 스토리지에 기본 설정 저장
  chrome.storage.sync.set(defaultSettings, function() {
    // UI 업데이트
    loadSubtitleSettings();
    
    showMessage('설정이 초기화되었습니다.', 'success');
  });
}

// 사용량 데이터 로드
async function loadUsageData() {
  try {
    if (!state.isAuthenticated) return;
    
    // 백그라운드에 사용량 데이터 요청
    const response = await sendMessage('getUsage');
    
    if (response && response.success) {
      // 사용량 데이터 저장
      state.usageData = response.usage;
      
      // 구독 정보 표시
      const subscriptionStatus = document.getElementById('subscription-status');
      if (subscriptionStatus && response.subscription) {
        const planName = response.subscription.plan === 'free' ? '무료' : 
                        (response.subscription.plan === 'pro' ? '프로' : '프리미엄');
        subscriptionStatus.textContent = `현재 플랜: ${planName}`;
      }
      
      // 사용량 정보 표시
      const usageText = document.getElementById('usage-text');
      const usageFill = document.getElementById('usage-fill');
      
      if (usageText && usageFill && response.usage.whisper) {
        const used = response.usage.whisper.used || 0;
        const limit = response.usage.whisper.limit || 60;
        const percentage = Math.min(Math.round((used / limit) * 100), 100);
        
        usageText.textContent = `오늘 ${used}/${limit}분 사용함`;
        usageFill.style.width = `${percentage}%`;
        
        // 사용량에 따른 색상 변경
        if (percentage >= 90) {
          usageFill.style.backgroundColor = '#e53935'; // 빨간색
        } else if (percentage >= 70) {
          usageFill.style.backgroundColor = '#ff9800'; // 주황색
        } else {
          usageFill.style.backgroundColor = '#4caf50'; // 초록색
        }
      }
      
      // 디버그 정보 업데이트
      updateDebugInfo({ usageData: response.usage });
    }
  } catch (error) {
    console.error('사용량 데이터 로드 중 오류:', error);
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
    
    // 백그라운드 서비스에 인증 상태 요청
    const response = await sendMessage('checkAuth');
    console.log('인증 상태 확인 응답:', response);
    
    // 상태 업데이트
    state.isAuthenticated = response.isAuthenticated;
    state.user = response.user;
    
    // 디버그 정보 업데이트
    updateDebugInfo({ authState: response });
    
    // 로그인 상태에 따라 UI 업데이트
    if (state.isAuthenticated && state.user) {
      console.log('로그인 상태입니다:', state.user.email);
      
      // 현재 탭이 로그인 탭이면 메인 탭으로 이동
      if (state.currentTab === 'signin') {
        switchTab('main');
      } else {
        // 현재 탭은 유지하되 메인 탭 컨텐츠 업데이트
        updateMainTabContent();
      }
    } else {
      console.log('로그인되지 않은 상태입니다.');
      
      // 로그인 여부에 따른 탭 접근 제어는 유지하되, 강제 이동은 하지 않음
      if (state.currentTab === 'main') {
        updateMainTabContent();
      }
    }
  } catch (error) {
    console.error('인증 상태 확인 오류:', error);
    showMessage('인증 상태 확인 중 오류가 발생했습니다.', 'error');
    
    // 디버그 정보 에러 표시
    updateDebugInfo({ authError: error.message });
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
function updateDebugInfo(info = {}) {
  if (!state.isDevMode) return;
  
  const debugInfoContent = document.getElementById('debug-info-content');
  if (!debugInfoContent) return;
  
  // 디버그 정보 객체 생성
  const debugInfo = {
    time: new Date().toISOString(),
    currentTab: state.currentTab,
    authState: state.isAuthenticated ? 'authenticated' : 'unauthenticated',
    user: state.isAuthenticated && state.user ? {
      email: state.user.email,
      name: state.user.displayName,
      uid: state.user.uid
    } : null,
    usageData: state.usageData,
    ...info
  };
  
  // 디버그 정보 표시
  debugInfoContent.textContent = JSON.stringify(debugInfo, null, 2);
}

// 탭 전환
function switchTab(tabName) {
  // 모든 탭 콘텐츠 숨기기
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  
  // 모든 탭 버튼 비활성화
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });
  
  // 선택한 탭 활성화
  const selectedTab = document.getElementById(`${tabName}-tab`);
  const selectedButton = document.getElementById(`tab-${tabName}`);
  
  if (selectedTab) {
    selectedTab.classList.add('active');
    selectedTab.style.display = 'block';
  }
  
  if (selectedButton) {
    selectedButton.classList.add('active');
  }
  
  // 상태 업데이트
  state.currentTab = tabName;
  
  // 로컬 스토리지에 현재 탭 저장
  chrome.storage.local.set({ lastTab: tabName });
  
  // 메인 탭 접근 권한 확인
  if (tabName === 'main') {
    updateMainTabContent();
  }
  
  console.log(`탭 전환: ${tabName}`);
}

// 메인 탭 콘텐츠 업데이트 (로그인 상태에 따라)
function updateMainTabContent() {
  const loginRequiredEl = document.getElementById('login-required-message');
  const userInfoContainerEl = document.getElementById('user-info-container');
  const controlsContainerEl = document.getElementById('controls-container');
  
  // 인증 상태에 따라 표시 내용 변경
  if (!state.isAuthenticated) {
    // 로그인이 필요한 경우
    if (loginRequiredEl) loginRequiredEl.style.display = 'block';
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'none';
    if (controlsContainerEl) controlsContainerEl.style.display = 'none';
  } else {
    // 로그인 된 경우
    if (loginRequiredEl) loginRequiredEl.style.display = 'none';
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'block';
    if (controlsContainerEl) controlsContainerEl.style.display = 'block';
    
    // 사용자 정보 업데이트
    updateUserInfo();
  }
}

// 사용자 정보 업데이트
function updateUserInfo() {
  if (state.user) {
    // 사용자명 업데이트
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
      userNameEl.textContent = state.user.displayName || state.user.email.split('@')[0];
    }
    
    // 이메일 업데이트
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
      userEmailEl.textContent = state.user.email;
    }
    
    // 프로필 이미지 업데이트
    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl && state.user.photoURL) {
      userAvatarEl.src = state.user.photoURL;
    }
  }
  
  // 사용량 데이터 로드
  loadUsageData();
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

// 테스트 자막 표시 함수
async function showTestSubtitle() {
  try {
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('활성화된 탭을 찾을 수 없습니다.');
      showMessage('테스트 자막을 표시할 탭을 찾을 수 없습니다.', 'error');
      return;
    }
    
    // 테스트 자막 텍스트 준비
    const originalText = "This is a test subtitle for WhatSub extension.";
    const translatedText = "이것은 WhatSub 확장 프로그램을 위한 테스트 자막입니다.";
    
    // 콘텐츠 스크립트에 메시지 전송
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'showTestSubtitle',
      original: originalText,
      translated: translatedText
    });
    
    // 자막 활성화가 안 되어 있다면 활성화
    if (response && response.success) {
      // 필터 토글 켜기
      const filterToggle = document.getElementById('filter-toggle');
      if (filterToggle && !filterToggle.checked) {
        filterToggle.checked = true;
        toggleSubtitleFilter(true);
      }
      
      showMessage('테스트 자막이 표시되었습니다.', 'success');
    } else {
      showMessage('테스트 자막 표시 중 오류가 발생했습니다.', 'error');
    }
  } catch (error) {
    console.error('테스트 자막 표시 중 오류 발생:', error);
    showMessage('테스트 자막 표시 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
  }
}

// 문서 로드 완료 시 초기화 함수 실행
document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log('DOM 로드 완료');
    
    // 확장 프로그램 상태 초기화
    initializePopup();
    
    // 초기 탭 설정
    chrome.storage.local.get('lastTab', function(result) {
      // 저장된 마지막 탭이 있으면 해당 탭으로, 없으면 기본 탭으로
      const initialTab = result.lastTab || (state.isAuthenticated ? 'main' : 'signin');
      switchTab(initialTab);
    });
  } catch (error) {
    console.error('초기화 중 오류 발생:', error);
  }
});