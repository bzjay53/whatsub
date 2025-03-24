// Whatsub 팝업 스크립트
document.addEventListener('DOMContentLoaded', initializePopup);

// 전역 상태 관리
const state = {
  isAuthenticated: false,
  user: null,
  currentTab: 'signin',
  activeTabId: null,
  settings: null,
  isLoading: false,
  isInitialized: false,
  usageData: null
};

// 팝업 초기화 함수
async function initializePopup() {
  console.log('팝업 초기화 시작...');
  showLoading(true);
  
  try {
    // 탭 버튼 이벤트 리스너
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // 로그인 버튼 리스너
    document.getElementById('google-signin').addEventListener('click', handleGoogleSignIn);
    
    // 로그아웃 버튼 리스너
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    
    // 설정 관련 이벤트 리스너 등록
    document.getElementById('save-settings-button')?.addEventListener('click', saveSettings);
    document.getElementById('reset-settings-button')?.addEventListener('click', resetSettings);
    document.getElementById('subtitle-toggle')?.addEventListener('change', toggleSubtitle);
    
    // 인증 상태 확인
    await checkAuthState();
    
    // 로컬 스토리지 변경 감지 리스너
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // 메시지 리스너 등록
    chrome.runtime.onMessage.addListener(handleMessage);
    
  } catch (error) {
    console.error('팝업 초기화 오류:', error);
    showStatus('error', '초기화 오류: ' + error.message);
  } finally {
    showLoading(false);
    state.isInitialized = true;
  }
}

// 인증 상태 확인
async function checkAuthState() {
  try {
    // 로컬 스토리지에서 직접 인증 정보 확인 (빠른 응답)
    const authData = await chrome.storage.local.get(['whatsub_auth']);
    
    if (authData.whatsub_auth?.token && authData.whatsub_auth?.user) {
      // 로컬 스토리지에 인증 정보가 있다면 우선 이를 사용
      const { user, token, loginTime } = authData.whatsub_auth;
      
      // 토큰 유효 기간 확인 (12시간)
      const isTokenExpired = loginTime && (Date.now() - loginTime > 12 * 60 * 60 * 1000);
      
      if (isTokenExpired) {
        console.log('저장된 토큰이 만료되었습니다. 토큰 갱신 필요');
        // 토큰 갱신 시도
        await refreshAuthToken();
        return;
      }
      
      console.log('로컬 저장소에서 인증 상태 복원:', user?.email);
      updateAuthState(true, user);
      
      // 최신 정보 백그라운드에 요청 (UI 블로킹하지 않음)
      chrome.runtime.sendMessage({ action: 'checkAuth' })
        .then(response => {
          if (response?.success && !response.isLoggedIn) {
            // 백그라운드에서는 로그아웃 상태일 경우 로컬 정보 갱신
            console.log('백그라운드에서 로그아웃 상태 확인됨');
            updateAuthState(false, null);
          }
        })
        .catch(err => console.warn('백그라운드 인증 확인 오류 (무시됨):', err));
      
    } else {
      // 로컬 스토리지에 정보가 없는 경우 백그라운드에 확인
      console.log('로컬 저장소에 인증 정보 없음, 백그라운드에 확인 요청');
      
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response?.success) {
        updateAuthState(response.isLoggedIn, response.user);
      } else {
        // 백그라운드 응답 실패
        updateAuthState(false, null);
        showStatus('error', '인증 상태 확인 오류: ' + (response?.error || '알 수 없는 오류'));
      }
    }
    
    // 인증 상태에 따라 적절한 탭 표시
    switchToAppropriateTab();
    
  } catch (error) {
    console.error('인증 상태 확인 오류:', error);
    updateAuthState(false, null);
    showStatus('error', '인증 확인 오류: ' + error.message);
    switchTab('signin');
  }
}

// 토큰 갱신 시도
async function refreshAuthToken() {
  try {
    // 백그라운드에 새 토큰 요청
    const response = await chrome.runtime.sendMessage({ 
      action: 'signInWithGoogle',
      silent: true // 조용한 갱신 시도
    });
    
    if (response?.success) {
      console.log('토큰 갱신 성공:', response.user?.email);
      updateAuthState(true, response.user);
      switchTab('main');
    } else {
      console.warn('토큰 갱신 실패:', response?.error);
      // 갱신 실패 시 로그인 화면으로
      updateAuthState(false, null);
      switchTab('signin');
    }
  } catch (error) {
    console.error('토큰 갱신 중 오류:', error);
    updateAuthState(false, null);
    switchTab('signin');
  }
}

// 인증 상태 변경 시 UI 업데이트
function updateAuthState(isAuthenticated, user) {
  state.isAuthenticated = isAuthenticated;
  state.user = user;
  
  if (isAuthenticated && user) {
    // 사용자 정보 표시
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) userNameEl.textContent = user.displayName || '이름 없음';
    if (userEmailEl) userEmailEl.textContent = user.email || '';
    if (userAvatarEl && user.photoURL) userAvatarEl.src = user.photoURL;
  }
}

// 적절한 탭으로 전환
function switchToAppropriateTab() {
  if (state.isAuthenticated) {
    switchTab('main');
  } else {
    switchTab('signin');
  }
}

// 탭 전환 함수
function switchTab(tabName) {
  // 모든 탭 컨텐츠 비활성화
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // 선택한 탭 활성화
  const selectedTab = document.getElementById(tabName + '-tab');
  if (selectedTab) {
    selectedTab.classList.add('active');
    state.currentTab = tabName;
  }
  
  // 탭 버튼 상태 업데이트
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
}

// Google 로그인 처리
async function handleGoogleSignIn() {
  console.log('Google 로그인 시작...');
  showLoading(true);
  clearStatus();
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'signInWithGoogle'
    });
    
    console.log('로그인 응답:', response);
    
    if (response?.success) {
      // 로그인 성공
      updateAuthState(true, response.user);
      switchTab('main');
      showStatus('success', '로그인 성공');
      
      // 사용량 데이터 로드
      loadUsageData(response.user.email);
    } else {
      // 로그인 실패
      updateAuthState(false, null);
      
      // 오류 유형에 따른 메시지 처리
      let errorMessage = '로그인 실패: ' + (response?.error || '알 수 없는 오류');
      
      if (response?.errorType === 'user_cancelled') {
        errorMessage = '로그인이 취소되었습니다.';
      } else if (response?.errorType === 'invalid_client') {
        errorMessage = 'OAuth 클라이언트 ID 오류가 발생했습니다. 설정을 확인하세요.';
      } else if (response?.errorType === 'network_error') {
        errorMessage = '네트워크 연결을 확인하세요.';
      }
      
      showStatus('error', errorMessage);
    }
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    updateAuthState(false, null);
    showStatus('error', '로그인 처리 중 오류: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 로그아웃 처리
async function handleLogout() {
  console.log('로그아웃 시작...');
  showLoading(true);
  clearStatus();
  
  try {
    // 로그아웃 타임아웃 설정 (15초)
    const logoutPromise = chrome.runtime.sendMessage({ action: 'signOut' });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('로그아웃 시간 초과')), 15000);
    });
    
    // 먼저 완료되는 Promise 처리
    const response = await Promise.race([logoutPromise, timeoutPromise]);
    
    if (response?.success) {
      console.log('로그아웃 성공');
      
      // 로컬 인증 정보 확실히 제거
      await chrome.storage.local.remove(['whatsub_auth', 'auth', 'user', 'authToken']);
      
      updateAuthState(false, null);
      switchTab('signin');
      showStatus('success', '로그아웃 되었습니다.');
    } else {
      console.warn('로그아웃 실패:', response?.error);
      showStatus('error', '로그아웃 실패: ' + (response?.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('로그아웃 처리 중 오류:', error);
    
    // 시간 초과 오류 특별 처리
    if (error.message === '로그아웃 시간 초과') {
      showStatus('warning', '로그아웃 처리 시간이 오래 걸립니다. 브라우저를 다시 시작해보세요.');
      
      // 강제 로그아웃 처리
      updateAuthState(false, null);
      await chrome.storage.local.remove(['whatsub_auth', 'auth', 'user', 'authToken']);
      switchTab('signin');
    } else {
      showStatus('error', '로그아웃 처리 중 오류: ' + error.message);
    }
  } finally {
    showLoading(false);
  }
}

// 메시지 처리 핸들러
function handleMessage(message, sender, sendResponse) {
  console.log('메시지 수신:', message.action);
  
  switch (message.action) {
    case 'authStateChanged':
      // 인증 상태 변경 알림 처리
      const { isAuthenticated, user } = message.data;
      console.log('인증 상태 변경:', isAuthenticated);
      
      // UI 업데이트
      updateAuthState(isAuthenticated, user);
      
      // 적절한 탭으로 전환
      if (state.isInitialized) {
        switchToAppropriateTab();
      }
      
      sendResponse({ success: true });
      return true;
      
    case 'createLogoutFrame':
      // 로그아웃 프레임 생성 (구글 쿠키 삭제용)
      console.log('로그아웃 프레임 생성 요청 처리');
      createLogoutFrame();
      sendResponse({ success: true });
      return true;
      
    default:
      return false;
  }
}

// 구글 로그아웃 프레임 생성 (쿠키 삭제용)
function createLogoutFrame() {
  try {
    // 기존 프레임 제거
    const existingFrame = document.getElementById('google-logout-frame');
    if (existingFrame) {
      existingFrame.remove();
    }
    
    // 구글 로그아웃 URL로 iframe 생성
    const iframe = document.createElement('iframe');
    iframe.id = 'google-logout-frame';
    iframe.src = 'https://accounts.google.com/logout';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // 5초 후 프레임 제거
    setTimeout(() => {
      iframe.remove();
    }, 5000);
    
    console.log('로그아웃 프레임 생성 완료');
    return true;
  } catch (error) {
    console.error('로그아웃 프레임 생성 오류:', error);
    return false;
  }
}

// 로컬 스토리지 변경 처리
function handleStorageChange(changes, namespace) {
  if (namespace === 'local' && changes.whatsub_auth) {
    console.log('인증 상태 스토리지 변경 감지');
    
    const newValue = changes.whatsub_auth.newValue;
    const oldValue = changes.whatsub_auth.oldValue;
    
    // 로그인/로그아웃 상태 변경 감지
    if (newValue && newValue.user && (!oldValue || !oldValue.user)) {
      // 로그인됨
      console.log('스토리지 변경: 로그인됨');
      updateAuthState(true, newValue.user);
      switchToAppropriateTab();
    } else if ((!newValue || !newValue.user) && oldValue && oldValue.user) {
      // 로그아웃됨
      console.log('스토리지 변경: 로그아웃됨');
      updateAuthState(false, null);
      switchToAppropriateTab();
    }
  }
}

// 자막 토글 처리
async function toggleSubtitle(event) {
  const isEnabled = event.target.checked;
  console.log('자막 상태 변경:', isEnabled);
  
  try {
    // 현재 활성화된 탭에 메시지 전송
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleSubtitle',
        data: { enabled: isEnabled }
      });
    }
    
    // 설정 저장
    await chrome.storage.sync.set({
      subtitleEnabled: isEnabled
    });
    
    showStatus('success', isEnabled ? '자막이 활성화되었습니다.' : '자막이 비활성화되었습니다.');
  } catch (error) {
    console.error('자막 토글 오류:', error);
    showStatus('error', '자막 설정 변경 중 오류가 발생했습니다.');
  }
}

// 설정 저장
async function saveSettings() {
  console.log('설정 저장 시작...');
  showLoading(true);
  
  try {
    // 설정값 가져오기
    const settings = {
      sourceLanguage: document.getElementById('source-language').value,
      targetLanguage: document.getElementById('target-language').value,
      fontSize: document.getElementById('font-size').value,
      backgroundOpacity: document.getElementById('background-opacity').value,
      subtitlePosition: document.getElementById('subtitle-position').value,
      noiseReduction: document.getElementById('noise-reduction-toggle').checked
    };
    
    console.log('저장할 설정:', settings);
    
    // 설정 저장
    await chrome.storage.sync.set({ settings });
    
    // 모든 탭에 설정 변경 알림
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          data: { settings }
        }).catch(() => {
          // 특정 탭에서 메시지 전송 실패는 무시
        });
      } catch (tabError) {
        // 탭별 메시지 전송 오류 무시
      }
    }
    
    showStatus('success', '설정이 저장되었습니다.');
  } catch (error) {
    console.error('설정 저장 오류:', error);
    showStatus('error', '설정 저장 중 오류가 발생했습니다: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 설정 초기화
async function resetSettings() {
  console.log('설정 초기화 시작...');
  showLoading(true);
  
  try {
    // 기본 설정
    const defaultSettings = {
      sourceLanguage: 'auto',
      targetLanguage: 'ko',
      fontSize: 'medium',
      backgroundOpacity: 'semi',
      subtitlePosition: 'bottom',
      noiseReduction: true
    };
    
    // 설정 저장
    await chrome.storage.sync.set({ settings: defaultSettings });
    
    // UI 업데이트
    document.getElementById('source-language').value = defaultSettings.sourceLanguage;
    document.getElementById('target-language').value = defaultSettings.targetLanguage;
    document.getElementById('font-size').value = defaultSettings.fontSize;
    document.getElementById('background-opacity').value = defaultSettings.backgroundOpacity;
    document.getElementById('subtitle-position').value = defaultSettings.subtitlePosition;
    document.getElementById('noise-reduction-toggle').checked = defaultSettings.noiseReduction;
    
    showStatus('success', '설정이 기본값으로 초기화되었습니다.');
  } catch (error) {
    console.error('설정 초기화 오류:', error);
    showStatus('error', '설정 초기화 중 오류가 발생했습니다: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 사용량 데이터 로드
async function loadUsageData(email) {
  if (!email) return;
  
  try {
    // 백그라운드에 사용량 정보 요청
    const response = await chrome.runtime.sendMessage({
      action: 'getUsage',
      email
    });
    
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
      
      if (subscriptionStatusEl) {
        const planName = state.user.subscription || 'free';
        subscriptionStatusEl.textContent = `현재 플랜: ${planName === 'free' ? '무료' : '프리미엄'}`;
      }
    }
  } catch (error) {
    console.warn('사용량 데이터 로드 오류:', error);
  }
}

// Helper 함수들

// 로딩 표시
function showLoading(isLoading) {
  state.isLoading = isLoading;
  const loadingEl = document.getElementById('loading');
  
  if (loadingEl) {
    if (isLoading) {
      loadingEl.classList.add('show');
    } else {
      loadingEl.classList.remove('show');
    }
  }
}

// 상태 메시지 표시
function showStatus(type, message) {
  const statusContainer = document.getElementById('statusContainer');
  
  if (!statusContainer) return;
  
  statusContainer.textContent = message;
  statusContainer.className = 'status'; // 클래스 초기화
  
  if (type) {
    statusContainer.classList.add(type);
  }
  
  // 성공 메시지는 3초 후 자동으로 사라짐
  if (type === 'success') {
    setTimeout(() => {
      statusContainer.className = 'status';
    }, 3000);
  }
}

// 상태 메시지 초기화
function clearStatus() {
  const statusContainer = document.getElementById('statusContainer');
  if (statusContainer) {
    statusContainer.className = 'status';
    statusContainer.textContent = '';
  }
} 