// 상태 관리 객체
const state = {
  currentTab: 'signin',
  isAuthenticated: false,
  user: null,
  usageData: null,
  isDevMode: false,
  isAdmin: false,
  subtitleActive: false
};

/**
 * Whatsub 팝업 - 통신 함수
 * background.js로 메시지를 전송하고 응답을 받는 함수
 */
async function sendMessage(action, data = {}) {
  try {
    console.log(`sendMessage 호출: ${action}`, data);
    
    // 5초 타임아웃으로 메시지 전송
    const response = await Promise.race([
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, ...data }, (result) => {
          console.log(`sendMessage 응답: ${action}`, result);
          resolve(result);
        });
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          console.warn(`sendMessage 타임아웃: ${action}`);
          resolve({ success: false, error: 'timeout' });
        }, 5000);
      })
    ]);
    
    return response;
  } catch (error) {
    console.error(`sendMessage 오류: ${action}`, error);
    return { success: false, error: error.message || '알 수 없는 오류' };
  }
}

// 메시지 핸들러 등록 (팝업에서 메시지 수신)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('팝업에서 메시지 수신:', message.action);
  
  try {
    switch (message.action) {
      case 'openPopup':
        // 특정 탭으로 이동 요청
        if (message.tab) {
          // 탭 전환
          switchTab(message.tab);
          sendResponse({ success: true });
        }
        break;
        
      // 다른 메시지 처리 추가 가능
      
      default:
        console.warn('알 수 없는 메시지 액션:', message.action);
        sendResponse({ success: false, error: '알 수 없는 메시지 액션' });
    }
  } catch (error) {
    console.error('메시지 처리 오류:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // 비동기 응답 처리
});

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
    
    // 개발자 모드 관련 코드 제거 (디버그 정보 항상 숨김)
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
      debugInfo.style.display = 'none';
    }
    
    // 디버그 버튼 이벤트 리스너
    const checkAuthBtn = document.getElementById('check-auth-btn');
    const reloadBtn = document.getElementById('reload-btn');
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
    
    // 메인 탭의 이중 자막 토글 이벤트 리스너 추가
    const dualSubtitleMainToggle = document.getElementById('dual-subtitle-main');
    if (dualSubtitleMainToggle) {
      dualSubtitleMainToggle.addEventListener('change', function(e) {
        toggleDualSubtitles(e.target.checked);
      });
    }
    
    // 설정 탭의 이중 자막 토글 이벤트 리스너 추가
    const dualSubtitleToggle = document.getElementById('dual-subtitle');
    if (dualSubtitleToggle) {
      dualSubtitleToggle.addEventListener('change', function(e) {
        toggleDualSubtitles(e.target.checked);
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

// 자막 필터링 토글
async function toggleSubtitleFilter(isEnabled) {
  try {
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('활성화된 탭을 찾을 수 없습니다.');
      return;
    }
    
    // 상태 저장
    state.subtitleActive = isEnabled;
    chrome.storage.sync.set({ subtitleEnabled: isEnabled });
    
    // 백그라운드 스크립트로 메시지 전송 (background.js가 다시 content script로 메시지 전달)
    await sendMessage('toggleSubtitleFilter', { 
      enabled: isEnabled,
      tabId: tabs[0].id
    });
    
    showMessage(isEnabled ? '자막이 활성화되었습니다.' : '자막이 비활성화되었습니다.');
    
    // 자막 활성화 시 음성 인식 시작
    if (isEnabled) {
      // 백그라운드에 음성 인식 시작 메시지 전송
      const response = await sendMessage('startSpeechRecognition', { 
        tabId: tabs[0].id,
        useWhisper: true,
        universalMode: true,
        enableCommunitySubtitles: true,
        whisperSettings: {
          language: document.getElementById('filter-language').value || 'ko',
          realTime: true,
          captureAudioFromTab: true,
          modelSize: 'medium' // 또는 'tiny', 'base', 'small', 'medium', 'large'
        }
      });
      
      if (response && response.success) {
        console.log('음성 인식 시작됨:', response);
      } else {
        console.error('음성 인식 시작 실패:', response?.error || '알 수 없는 오류');
        showMessage('음성 인식 시작에 실패했습니다.', 'error');
      }
    } else {
      // 백그라운드에 음성 인식 중지 메시지 전송
      await sendMessage('stopSpeechRecognition', { tabId: tabs[0].id });
    }
  } catch (error) {
    console.error('자막 필터링 토글 중 오류 발생:', error);
    showMessage('자막 기능 제어 중 오류가 발생했습니다.', 'error');
  }
}

// 필터 언어 변경
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
    
    // 자막이 활성화된 상태에서 언어가 변경되면 Whisper 언어 설정도 변경
    if (state.subtitleActive) {
      const response = await sendMessage('updateWhisperSettings', {
        tabId: tabs[0].id,
        settings: {
          language: language
        }
      });
      
      if (response && response.success) {
        console.log('Whisper 언어 설정 변경 성공');
      } else {
        console.error('Whisper 언어 설정 변경 실패:', response?.error || '알 수 없는 오류');
      }
    }
    
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
    
    // 메인 탭의 이중 자막 설정 동기화
    const dualSubtitleMain = document.getElementById('dual-subtitle-main');
    if (dualSubtitleMain) dualSubtitleMain.checked = dualSubtitles;
    
    // 설정 객체 생성
    const settings = {
      position: captionPosition,
      fontSize: fontSize,
      background: background,
      dualSubtitles: dualSubtitles
    };
    
    // 백그라운드 스크립트로 메시지 전송 (background.js가 다시 content script로 메시지 전달)
    const response = await sendMessage('updateSettings', { settings });
    
    // 로컬 스토리지에 설정 저장
    chrome.storage.sync.set({ subtitleSettings: settings });
    
    if (response && response.success) {
      showMessage('자막 설정이 저장되었습니다.', 'success');
    } else {
      console.warn('자막 설정 저장 응답 문제:', response);
      showMessage('자막 설정이 저장되었지만, 현재 탭에 적용하지 못했습니다.', 'warning');
    }
  } catch (error) {
    console.error('자막 설정 저장 중 오류 발생:', error);
    showMessage('설정 저장 중 오류가 발생했습니다.', 'error');
  }
}

// 자막 설정 불러오기
function loadSubtitleSettings() {
  chrome.storage.sync.get(['subtitleEnabled', 'subtitleLanguage', 'subtitleSettings', 'universalMode'], function(data) {
    // 자막 필터링 활성화 상태 설정
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.checked = data.subtitleEnabled === true;
      state.subtitleActive = data.subtitleEnabled === true;
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
      const dualSubtitleMain = document.getElementById('dual-subtitle-main');
      
      if (captionPosition && data.subtitleSettings.position) {
        captionPosition.value = data.subtitleSettings.position;
      }
      
      if (fontSize && data.subtitleSettings.fontSize) {
        fontSize.value = data.subtitleSettings.fontSize;
      }
      
      if (backgroundOpacity && data.subtitleSettings.background) {
        backgroundOpacity.value = data.subtitleSettings.background;
      }
      
      // 이중 자막 설정 동기화
      const isDualMode = data.subtitleSettings.dualSubtitles !== false;
      if (dualSubtitle) {
        dualSubtitle.checked = isDualMode;
      }
      if (dualSubtitleMain) {
        dualSubtitleMain.checked = isDualMode;
      }
    }
    
    // 초기 상태에서 자막이 활성화되어 있다면 자막 서비스 강제 시작
    if (data.subtitleEnabled === true) {
      console.log('자막 자동 활성화 시도');
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
          // 먼저 콘텐츠 스크립트 직접 호출 시도
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleSubtitles',
            enabled: true
          }).catch(() => {
            console.log('직접 호출 실패, 백그라운드 경유 시도');
            // 실패 시 백그라운드 통해 전달
            sendMessage('toggleSubtitleFilter', {
              enabled: true,
              tabId: tabs[0].id
            });
          });
          
          // 음성 인식 시작
          sendMessage('startSpeechRecognition', { 
            tabId: tabs[0].id,
            useWhisper: true,
            universalMode: true
          });
        }
      });
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
        // 관리자 계정인 경우 무제한 표시
        if (state.isAdmin) {
          subscriptionStatus.textContent = '현재 플랜: 관리자 (무제한)';
        } else {
          const planName = response.subscription.plan === 'free' ? '무료' : 
                          (response.subscription.plan === 'pro' ? '프로' : '프리미엄');
          subscriptionStatus.textContent = `현재 플랜: ${planName}`;
        }
      }
      
      // 사용량 정보 표시
      const usageText = document.getElementById('usage-text');
      const usageFill = document.getElementById('usage-fill');
      
      if (usageText && usageFill) {
        // 관리자 계정인 경우 무제한 표시
        if (state.isAdmin) {
          usageText.textContent = '무제한 사용 가능';
          usageFill.style.width = '100%';
          usageFill.style.backgroundColor = '#4caf50'; // 초록색
        } else if (response.usage.whisper) {
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
    
    // 사용자 정보 일시적 초기화
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) userNameEl.textContent = '';
    if (userEmailEl) userEmailEl.textContent = '';
    if (userAvatarEl) userAvatarEl.src = 'icons/default-avatar.png';
    
    // 백그라운드 서비스에 로그인 요청
    const response = await sendMessage('signInWithGoogle');
    
    if (response && response.success) {
      console.log('로그인 성공:', response.user);
      showMessage('로그인 성공', 'success');
      
      // 사용자 정보 저장 및 UI 업데이트
      state.isAuthenticated = true;
      state.user = response.user;
      
      // 관리자 계정 체크 (bzjay53@gmail.com)
      if (state.user && state.user.email === 'bzjay53@gmail.com') {
        state.isAdmin = true;
        console.log('관리자 계정으로 로그인되었습니다.');
        // 관리자 계정은 사용량 제한 없음
        state.usageData = {
          whisper: {
            used: 0,
            limit: Infinity,
            unlimited: true
          }
        };
      }
      
      // 즉시 사용자 정보 업데이트
      updateUserInfoImmediate(response.user);
      
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

// 즉시 사용자 정보를 업데이트하는 함수 (로그인 직후 호출)
function updateUserInfoImmediate(user) {
  if (!user) return;
  
  try {
    // DOM 요소 확인
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');
    
    // 즉시 상태 업데이트
    if (userNameEl) {
      userNameEl.textContent = user.displayName || (user.email ? user.email.split('@')[0] : '사용자');
    }
    
    if (userEmailEl) {
      userEmailEl.textContent = user.email || '';
    }
    
    if (userAvatarEl) {
      if (user.photoURL) {
        userAvatarEl.src = user.photoURL;
      } else {
        userAvatarEl.src = 'icons/default-avatar.png';
      }
    }
    
    // 사용자 정보 컨테이너 표시
    const userInfoContainerEl = document.getElementById('user-info-container');
    if (userInfoContainerEl) userInfoContainerEl.style.display = 'block';
    
    // 로그인 필요 메시지 숨김
    const loginRequiredEl = document.getElementById('login-required-message');
    if (loginRequiredEl) loginRequiredEl.style.display = 'none';
    
    // 컨트롤 컨테이너 표시
    const controlsContainerEl = document.getElementById('controls-container');
    if (controlsContainerEl) controlsContainerEl.style.display = 'block';
    
    console.log('[Whatsub] 사용자 정보 즉시 업데이트 완료:', user.email);
  } catch (error) {
    console.error('[Whatsub] 사용자 정보 업데이트 중 오류:', error);
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

// 인증 상태 확인 (재시도 메커니즘 포함)
async function checkAuthState(retryCount = 2, retryDelay = 1000) {
  try {
    showLoading('인증 상태 확인 중...');
    
    // 최대 재시도 횟수만큼 시도
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // 백그라운드 서비스에 인증 상태 요청
        const response = await sendMessage('checkAuth');
        console.log(`[Whatsub] 인증 상태 확인 응답 (시도 ${attempt + 1}/${retryCount + 1}):`, response);
        
        // 타임아웃이나 오류 발생 시 로컬 스토리지에서 확인
        if (response.fallback || response.error) {
          console.warn('[Whatsub] 백그라운드 통신 실패, 로컬 스토리지에서 인증 상태 확인');
          
          const authData = await new Promise(resolve => {
            chrome.storage.local.get(['auth', 'whatsub_auth', 'user'], resolve);
          });
          
          // 스토리지에서 인증 상태 복원
          if (authData.auth?.isAuthenticated && authData.user) {
            console.log('[Whatsub] 로컬 스토리지에서 인증 상태 복원 성공');
            
            // 상태 업데이트
            state.isAuthenticated = true;
            state.user = authData.user;
            
            // 관리자 계정 체크
            checkAdminAccount();
            
            // 디버그 정보 업데이트
            updateDebugInfo({ 
              authState: 'restored_from_storage', 
              isAdmin: state.isAdmin,
              storageData: authData 
            });
            
            // UI 업데이트
            updateMainTabContent();
            updateAuthState();
            
            hideLoading();
            return { isAuthenticated: true, user: authData.user, restoredFromStorage: true };
          }
          
          // 재시도할 경우 대기
          if (attempt < retryCount) {
            console.log(`[Whatsub] 재시도 대기 중... (${retryDelay}ms)`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // 모든 재시도 실패, 로그아웃 상태로 처리
          console.warn('[Whatsub] 인증 상태 확인 실패, 로그아웃 상태로 처리');
          handleUnauthenticatedState();
          hideLoading();
          return { isAuthenticated: false, error: 'auth_check_failed' };
        }
        
        // 정상 응답 처리
        state.isAuthenticated = response.isAuthenticated;
        state.user = response.user;
        
        // 관리자 계정 체크
        checkAdminAccount();
        
        // 디버그 정보 업데이트
        updateDebugInfo({ authState: response, isAdmin: state.isAdmin });
        
        // UI 업데이트
        updateMainTabContent();
        updateAuthState();
        
        hideLoading();
        return response;
      } catch (attemptError) {
        console.error(`[Whatsub] 인증 확인 시도 ${attempt + 1} 실패:`, attemptError);
        
        // 마지막 시도가 아니면 재시도
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // 모든 재시도 실패
        throw attemptError;
      }
    }
  } catch (error) {
    console.error('[Whatsub] 인증 상태 확인 오류:', error);
    
    // 오류가 UI에 표시되지 않도록 함
    // 디버그 정보 에러 표시
    updateDebugInfo({ authError: error.message });
    
    // 로그인 안 된 상태로 간주
    handleUnauthenticatedState();
    
    // 오류 반환 (호출자가 처리할 수 있도록)
    return { isAuthenticated: false, error: error.message };
  } finally {
    hideLoading();
  }
}

// 관리자 계정 체크 함수
function checkAdminAccount() {
  // 관리자 계정 체크 (bzjay53@gmail.com)
  if (state.user && state.user.email === 'bzjay53@gmail.com') {
    state.isAdmin = true;
    console.log('[Whatsub] 관리자 계정으로 로그인되었습니다.');
    // 관리자 계정은 사용량 제한 없음
    state.usageData = {
      whisper: {
        used: 0,
        limit: Infinity,
        unlimited: true
      }
    };
  } else {
    state.isAdmin = false;
  }
}

// 인증되지 않은 상태 처리
function handleUnauthenticatedState() {
  state.isAuthenticated = false;
  state.user = null;
  state.isAdmin = false;
  updateMainTabContent();
  updateAuthState();
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
  // 무조건 콘솔에만 출력, UI에는 표시하지 않음
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
  
  // 콘솔에만 출력
  if (state.isDevMode) {
    console.log('디버그 정보:', debugInfo);
  }
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

// 로딩 인디케이터 표시 (메시지 포함 가능)
function showLoading(message = '로딩 중...') {
  try {
    let loadingEl = document.getElementById('loading-indicator');
    
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.id = 'loading-indicator';
      loadingEl.className = 'loading';
      
      loadingEl.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">${message}</p>
        </div>
      `;
      
      document.body.appendChild(loadingEl);
    } else {
      // 이미 존재하는 경우 메시지만 업데이트
      const textEl = loadingEl.querySelector('.loading-text');
      if (textEl) textEl.textContent = message;
      loadingEl.style.display = 'flex';
    }
  } catch (error) {
    console.error('[Whatsub] 로딩 표시 오류:', error);
  }
}

// 로딩 인디케이터 숨기기
function hideLoading() {
  try {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  } catch (error) {
    console.error('[Whatsub] 로딩 숨기기 오류:', error);
  }
}

// 메시지 표시 (토스트 스타일)
function showMessage(message, type = 'info') {
  try {
    // 기존 메시지 컨테이너 확인
    let containerEl = document.getElementById('toast-container');
    
    // 컨테이너가 없으면 생성
    if (!containerEl) {
      containerEl = document.createElement('div');
      containerEl.id = 'toast-container';
      document.body.appendChild(containerEl);
    }
    
    // 새 토스트 메시지 생성
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.textContent = message;
    
    // 컨테이너에 추가
    containerEl.appendChild(toastEl);
    
    // 애니메이션을 위한 타이밍 조정
    setTimeout(() => toastEl.classList.add('show'), 10);
    
    // 1초 후 제거 (원래 5초였음)
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 300); // 페이드 아웃 후 제거
    }, 1000);
    
    // 콘솔에도 기록
    console.log(`[Whatsub] ${type.toUpperCase()}: ${message}`);
  } catch (error) {
    console.error('[Whatsub] 메시지 표시 오류:', error);
  }
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
    
    // 자막 필터 토글 켜기 (필요한 경우)
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle && !filterToggle.checked) {
      filterToggle.checked = true;
      await toggleSubtitleFilter(true);
    }
    
    // 백그라운드 스크립트로 테스트 자막 표시 요청
    const response = await sendMessage('testSubtitle', {
      tabId: tabs[0].id
    });
    
    if (response && response.success) {
      showMessage('테스트 자막이 표시되었습니다.', 'success');
    } else {
      showMessage(response?.error || '테스트 자막 표시 중 오류가 발생했습니다.', 'error');
    }
  } catch (error) {
    console.error('테스트 자막 표시 중 오류 발생:', error);
    showMessage('테스트 자막 표시 중 오류가 발생했습니다.', 'error');
  }
}

// 커뮤니티 자막 관련 이벤트 리스너 등록
function initializeCommunitySubtitles() {
  const uploadBtn = document.getElementById('upload-subtitle');
  const downloadBtn = document.getElementById('download-subtitle');
  
  if (uploadBtn) uploadBtn.addEventListener('click', handleSubtitleUpload);
  if (downloadBtn) downloadBtn.addEventListener('click', handleSubtitleDownload);
  
  // 초기 자막 목록 로드
  loadSubtitleList();
}

// 자막 업로드 처리
async function handleSubtitleUpload() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      showLoading();
      showMessage('자막 파일을 업로드하는 중...', 'info');
      
      const formData = new FormData();
      formData.append('subtitle', file);
      formData.append('userId', state.user.uid);
      formData.append('userName', state.user.displayName || state.user.email);
      
      // 백그라운드로 업로드 요청 전송
      const response = await sendMessage('uploadSubtitle', {
        fileName: file.name,
        fileData: await file.text(),
        metadata: {
          uploadedBy: state.user.email,
          timestamp: new Date().toISOString()
        }
      });
      
      if (response.success) {
        showMessage('자막이 성공적으로 업로드되었습니다.', 'success');
        loadSubtitleList(); // 목록 새로고침
      } else {
        showMessage('자막 업로드에 실패했습니다.', 'error');
      }
    };
    
    input.click();
  } catch (error) {
    console.error('자막 업로드 중 오류:', error);
    showMessage('자막 업로드 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 자막 다운로드 처리
async function handleSubtitleDownload() {
  try {
    showLoading();
    showMessage('사용 가능한 자막을 확인하는 중...', 'info');
    
    // 현재 페이지 URL 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0].url;
    
    // 백그라운드로 자막 검색 요청 전송
    const response = await sendMessage('searchSubtitles', {
      url: currentUrl
    });
    
    if (response.success && response.subtitles.length > 0) {
      // 자막 목록 표시
      displaySubtitleList(response.subtitles);
    } else {
      showMessage('사용 가능한 자막이 없습니다.', 'warning');
    }
  } catch (error) {
    console.error('자막 검색 중 오류:', error);
    showMessage('자막 검색 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 자막 목록 표시
function displaySubtitleList(subtitles) {
  const listContainer = document.getElementById('subtitle-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  subtitles.forEach(subtitle => {
    const item = document.createElement('div');
    item.className = 'subtitle-item';
    
    item.innerHTML = `
      <div class="subtitle-info">
        <div class="subtitle-title">${subtitle.fileName}</div>
        <div class="subtitle-meta">
          업로드: ${subtitle.metadata.uploadedBy}<br>
          날짜: ${new Date(subtitle.metadata.timestamp).toLocaleDateString()}
        </div>
      </div>
      <div class="subtitle-actions">
        <button class="action-button" onclick="applySubtitle('${subtitle.id}')">적용</button>
      </div>
    `;
    
    listContainer.appendChild(item);
  });
}

// 자막 적용
async function applySubtitle(subtitleId) {
  try {
    showLoading();
    showMessage('자막을 적용하는 중...', 'info');
    
    const response = await sendMessage('applySubtitle', { subtitleId });
    
    if (response.success) {
      showMessage('자막이 성공적으로 적용되었습니다.', 'success');
    } else {
      showMessage('자막 적용에 실패했습니다.', 'error');
    }
  } catch (error) {
    console.error('자막 적용 중 오류:', error);
    showMessage('자막 적용 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// 자막 목록 로드 함수
async function loadSubtitleList() {
  try {
    if (!state.isAuthenticated || !state.user) {
      console.log('인증되지 않은 상태에서 자막 목록을 불러올 수 없습니다.');
      return;
    }
    
    // 현재 페이지 URL 가져오기 (현재 페이지 관련 자막 목록을 불러오기 위함)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0].url;
    
    // 백그라운드로 자막 목록 요청 전송
    const response = await sendMessage('getSubtitleList', {
      url: currentUrl
    });
    
    if (response && response.success && response.subtitles) {
      displaySubtitleList(response.subtitles);
    } else {
      // 자막 목록이 없으면 안내 메시지 표시
      const listContainer = document.getElementById('subtitle-list');
      if (listContainer) {
        listContainer.innerHTML = '<div class="no-subtitles">현재 페이지에 사용 가능한 자막이 없습니다.</div>';
      }
    }
  } catch (error) {
    console.error('자막 목록 로드 중 오류:', error);
    // 오류 발생 시 빈 컨테이너로 설정
    const listContainer = document.getElementById('subtitle-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="no-subtitles">자막 목록을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

// 전역 함수로 설정 (HTML에서 직접 호출 가능하게)
window.applySubtitle = applySubtitle;

// 문서 로드 완료 시 초기화 함수 실행
document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log('DOM 로드 완료');
    
    // 로딩 숨기기
    hideLoading();
    
    // 확장 프로그램 상태 초기화
    initializePopup();
    
    // 커뮤니티 자막 기능 초기화
    initializeCommunitySubtitles();
    
    // 메인 탭으로 즉시 전환
    switchTab('main');
    
    // 인증 상태는 비동기적으로 확인하되, 오류가 발생해도 UI에 표시하지 않음
    checkAuthState().catch(error => {
      console.error('인증 상태 확인 중 백그라운드 연결 오류:', error);
      // 오류가 발생해도 UI에는 표시하지 않고 콘솔에만 기록
    });
    
  } catch (error) {
    console.error('초기화 중 오류 발생:', error);
    // 오류가 발생해도 메인 탭을 보여줌
    switchTab('main');
    hideLoading();
  }
});

// 이중 자막 토글 함수
async function toggleDualSubtitles(isEnabled) {
  try {
    // 메인 탭과 설정 탭의 토글 동기화
    const dualSubtitleMain = document.getElementById('dual-subtitle-main');
    const dualSubtitle = document.getElementById('dual-subtitle');
    
    if (dualSubtitleMain) dualSubtitleMain.checked = isEnabled;
    if (dualSubtitle) dualSubtitle.checked = isEnabled;
    
    // 현재 활성화된 탭 가져오기
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('활성화된 탭을 찾을 수 없습니다.');
      return;
    }
    
    // 설정 업데이트
    const settings = {
      dualSubtitles: isEnabled
    };
    
    // 백그라운드 스크립트로 메시지 전송
    await sendMessage('updateSettings', { settings });
    
    // 로컬 스토리지에 설정 저장
    chrome.storage.sync.get('subtitleSettings', function(data) {
      const currentSettings = data.subtitleSettings || {};
      chrome.storage.sync.set({ 
        subtitleSettings: { 
          ...currentSettings, 
          dualSubtitles: isEnabled 
        } 
      });
    });
    
    showMessage(isEnabled ? '이중 자막이 활성화되었습니다.' : '이중 자막이 비활성화되었습니다.');
  } catch (error) {
    console.error('이중 자막 토글 중 오류 발생:', error);
    showMessage('이중 자막 설정 중 오류가 발생했습니다.', 'error');
  }
}