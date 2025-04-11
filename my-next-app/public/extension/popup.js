// 상태 관리 객체
const state = {
  currentTab: 'signin',
  isAuthenticated: false,
  user: null,
  usageData: null,
  isDevMode: false,
  isAdmin: false,
  subtitleActive: false,
  dualSubtitleActive: false
};

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug('[Whatsub] 메시지 수신:', message.action);
  
  if (message.action === 'checkAuth') {
    // 전역 authService 객체가 없을 경우 대비
    try {
      // 간단히 인증되었다고 가정 (개발 단계용)
      sendResponse({ isAuthenticated: true });
      console.log('[Whatsub] 인증 상태 확인: 개발 모드에서 항상 인증됨으로 처리');
    } catch (error) {
      console.error('[Whatsub] 인증 상태 확인 중 오류:', error);
      sendResponse({ isAuthenticated: false, error: '인증 상태 확인 중 오류가 발생했습니다.' });
    }
    return true;
  }
  
  // 자막 토글 상태 동기화 (자막 창에서 변경된 상태를 팝업에 반영)
  if (message.action === 'updateFilterToggle') {
    console.log('[Whatsub] 자막 필터 상태 업데이트:', message.enabled);
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.checked = message.enabled;
      state.subtitleActive = message.enabled;
      
      // 스토리지에 상태 저장
      chrome.storage.sync.set({ 
        subtitleEnabled: message.enabled
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('[Whatsub] 필터 상태 저장 중 오류:', chrome.runtime.lastError);
        } else {
          console.log('[Whatsub] 자막 필터 상태가 저장되었습니다:', message.enabled);
        }
      });
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // 필터 언어 상태 동기화 (자막 창에서 변경된 언어를 팝업에 반영)
  if (message.action === 'updateFilterLanguage') {
    console.log('[Whatsub] 필터 언어 업데이트:', message.language);
    const filterLanguage = document.getElementById('filter-language');
    if (filterLanguage) {
      filterLanguage.value = message.language;
      
      // 스토리지에 상태 저장
      chrome.storage.sync.set({ 
        subtitleLanguage: message.language
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('[Whatsub] 언어 설정 저장 중 오류:', chrome.runtime.lastError);
        } else {
          console.log('[Whatsub] 자막 언어 설정이 저장되었습니다:', message.language);
        }
      });
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // 이중 자막 토글 상태 동기화 (자막 창에서 변경된 상태를 팝업에 반영)
  if (message.action === 'updateDualSubtitleToggle') {
    console.log('[Whatsub] 이중 자막 상태 업데이트:', message.enabled);
    const dualSubtitle = document.getElementById('dual-subtitle');
    if (dualSubtitle) {
      dualSubtitle.checked = message.enabled;
      state.dualSubtitleActive = message.enabled;
      
      // 스토리지에 설정 업데이트
      chrome.storage.sync.get(['subtitleSettings'], function(data) {
        const settings = data.subtitleSettings || {};
        const updatedSettings = {
          ...settings,
          dualSubtitles: message.enabled
        };
        
        chrome.storage.sync.set({ 
          subtitleSettings: updatedSettings 
        }, function() {
          if (chrome.runtime.lastError) {
            console.error('[Whatsub] 이중 자막 설정 저장 중 오류:', chrome.runtime.lastError);
          } else {
            console.log('[Whatsub] 이중 자막 설정이 저장되었습니다:', message.enabled);
          }
        });
      });
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

/**
 * 백그라운드 서비스에 메시지를 전송합니다.
 * @dependency background.js의 메시지 처리 함수
 * @relatedFiles background.js
 * @messageFlow popup.js → background.js
 * 
 * @param {string} action - 메시지 작업 유형
 * @param {object} params - 메시지 파라미터
 * @param {function} callback - 응답을 처리할 콜백 함수
 */
function sendMessage(action, params, callback) {
  try {
    console.debug(`[Whatsub] 백그라운드로 메시지 전송: ${action}`, params);
    chrome.runtime.sendMessage({ action, ...params }, function(response) {
      if (chrome.runtime.lastError) {
        console.debug('[Whatsub] 메시지 전송 오류:', chrome.runtime.lastError.message);
        if (callback) {
          callback({ 
            success: false, 
            error: chrome.runtime.lastError.message || '메시지 전송 중 오류가 발생했습니다.' 
          });
        }
        return;
      }
      
      if (callback) {
        // 응답이 undefined인 경우에도 안전하게 처리
        callback(response || { success: false, error: '응답을 받지 못했습니다.' });
      }
    });
  } catch (error) {
    console.error(`[Whatsub] sendMessage 함수 오류 (${action}):`, error);
    if (callback) {
      callback({ success: false, error: error.message || '메시지 전송 중 예외가 발생했습니다.' });
    }
  }
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
        
        // 디버그 정보 영역 표시/숨김 - 기본적으로 항상 숨김
        if (debugInfo) {
          debugInfo.style.display = 'none';
        }
      });
      
      // 개발자 모드 변경 이벤트
      devModeCheckbox.addEventListener('change', function(e) {
        state.isDevMode = e.target.checked;
        chrome.storage.sync.set({devMode: state.isDevMode});
        
        // 모드 변경해도 UI에는 표시하지 않음
        console.log('개발자 모드:', state.isDevMode ? '활성화됨' : '비활성화됨');
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
        state.subtitleActive = isEnabled;
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
    
    // 이중 자막 표시 토글 이벤트 리스너 추가
    const dualSubtitle = document.getElementById('dual-subtitle');
    if (dualSubtitle) {
      dualSubtitle.addEventListener('change', function(e) {
        const isEnabled = e.target.checked;
        state.dualSubtitleActive = isEnabled;
        
        // 현재 저장된 설정 가져오기
        chrome.storage.sync.get(['subtitleSettings'], function(data) {
          const settings = data.subtitleSettings || {};
          
          // 설정 업데이트
          const updatedSettings = {
            ...settings,
            dualSubtitles: isEnabled
          };
          
          // 설정 저장
          chrome.storage.sync.set({ subtitleSettings: updatedSettings });
          
          // 현재 활성화된 탭 가져오기
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
              // 콘텐츠 스크립트에 메시지 전송
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateSettings',
                settings: { dualSubtitles: isEnabled }
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.debug('[Whatsub] 설정 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError.message);
                }
              });
              
              // 자막 창의 듀얼 자막 토글 업데이트
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateDualSubtitleToggle',
                enabled: isEnabled
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.debug('[Whatsub] 듀얼 자막 토글 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError.message);
                }
              });
            }
          });
        });
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
function toggleSubtitleFilter(isEnabled) {
  try {
    // 현재 활성 탭 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.debug('[Whatsub] 활성 탭을 찾을 수 없습니다.');
        showMessage('활성 탭을 찾을 수 없습니다.', 'warning');
        return;
      }
      
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.id) {
        console.debug('[Whatsub] 유효한 탭 ID를 찾을 수 없습니다.');
        showMessage('유효한 탭 ID를 찾을 수 없습니다.', 'warning');
        return;
      }
      
      // 상태 업데이트
      state.subtitleActive = isEnabled;
      
      // 콘텐츠 스크립트에 메시지 전송
      const message = {
        action: 'toggleSubtitles',
        enabled: isEnabled,
        universalMode: true
      };
      
      // 콜백 패턴으로 메시지 전송
      chrome.tabs.sendMessage(currentTab.id, message, function(response) {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 자막 토글 메시지 전송 중 오류:', chrome.runtime.lastError.message);
          // 오류가 발생해도 UI는 업데이트
        }
        
        // 확장 프로그램 아이콘 상태 업데이트 표시
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
          filterToggle.checked = isEnabled;
        }
        
        const dualSubtitleToggle = document.getElementById('dual-subtitle-toggle');
        
        // 스토리지에 상태 저장
        chrome.storage.sync.set({ 
          subtitleEnabled: isEnabled,
          universalMode: true,
          dualSubtitleEnabled: dualSubtitleToggle ? dualSubtitleToggle.checked : false
        });
        
        // 자막이 활성화되면 테스트 자막 표시
        if (isEnabled) {
          setTimeout(() => {
            // 테스트 자막 표시
            chrome.tabs.sendMessage(currentTab.id, {
              action: 'showTestSubtitle',
              original: '자막 테스트 문구입니다.',
              translated: '이 자막은 테스트용으로 표시됩니다.',
              universalMode: true
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.debug('[Whatsub] 테스트 자막 표시 중 오류:', chrome.runtime.lastError.message);
              }
            });
          }, 1000); // 1초 후 테스트 자막 표시
        }
      });
    });
  } catch (error) {
    console.debug('[Whatsub] 자막 필터 토글 중 오류:', error);
    showMessage('자막 필터 토글 중 오류가 발생했습니다.', 'warning');
  }
}

// 필터 언어 변경
/**
 * 자막 필터 언어를 변경하고 관련 설정을 업데이트합니다.
 * @dependency content.js의 changeLanguage 메시지 처리, background.js의 updateWhisperSettings
 * @relatedFiles content.js, background.js, chrome.storage
 * @messageFlow popup.js → content.js, popup.js → background.js
 */
function changeFilterLanguage(language) {
  try {
    // 현재 활성화된 탭 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.debug('[Whatsub] 활성화된 탭을 찾을 수 없습니다.');
        showMessage('활성화된 탭을 찾을 수 없습니다.', 'warning');
        return;
      }
      
      // 탭 ID 유효성 검사
      const tabId = tabs[0].id;
      
      // 콘텐츠 스크립트에 메시지 전송 - 콜백 패턴 사용
      chrome.tabs.sendMessage(tabId, {
        action: 'changeLanguage',
        language: language
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 언어 변경 메시지 전송 중 오류:', chrome.runtime.lastError.message);
          // 오류가 발생해도 계속 진행
        }
        
        // 상태 저장
        chrome.storage.sync.set({ subtitleLanguage: language });
        
        // 자막이 활성화된 상태에서 언어가 변경되면 Whisper 언어 설정도 변경
        if (state.subtitleActive) {
          // 백그라운드에 Whisper 설정 업데이트 요청
          chrome.runtime.sendMessage({
            action: 'updateWhisperSettings',
            tabId: tabId,
            settings: {
              language: language
            }
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.debug('[Whatsub] Whisper 설정 업데이트 중 오류:', chrome.runtime.lastError.message);
            } else if (response && response.success) {
              console.log('Whisper 언어 설정 변경 성공');
            } else {
              console.debug('[Whatsub] Whisper 언어 설정 변경 실패:', response?.error || '알 수 없는 오류');
            }
            
            showMessage(`번역 언어가 변경되었습니다: ${getLanguageName(language)}`);
          });
        } else {
          showMessage(`번역 언어가 변경되었습니다: ${getLanguageName(language)}`);
        }
      });
    });
  } catch (error) {
    console.debug('[Whatsub] 필터 언어 변경 중 오류 발생:', error);
    showMessage('언어 설정 변경 중 오류가 발생했습니다.', 'warning');
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
/**
 * 사용자가 설정한 자막 설정을 저장하고 적용합니다.
 * @dependency content.js의 updateSettings 메시지 처리
 * @relatedFiles content.js (SubtitleDisplay.updateSettings 메서드), chrome.storage
 * @messageFlow popup.js → content.js
 */
function saveSubtitleSettings() {
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
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.error('[Whatsub] 활성화된 탭을 찾을 수 없습니다.');
        showMessage('활성화된 탭을 찾을 수 없습니다.', 'error');
        return;
      }
      
      // 콘텐츠 스크립트에 메시지 전송 - 콜백 패턴 사용
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateSettings',
        settings: settings
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('[Whatsub] 설정 업데이트 메시지 전송 중 오류:', chrome.runtime.lastError);
          // 오류가 발생해도 계속 진행
        }
        
        // 로컬 스토리지에 설정 저장
        chrome.storage.sync.set({ subtitleSettings: settings }, function() {
          if (chrome.runtime.lastError) {
            console.error('[Whatsub] 설정 저장 중 오류:', chrome.runtime.lastError);
            showMessage('설정 저장 중 오류가 발생했습니다.', 'error');
          } else {
            showMessage('자막 설정이 저장되었습니다.', 'success');
          }
        });
      });
    });
  } catch (error) {
    console.error('자막 설정 저장 중 오류 발생:', error);
    showMessage('설정 저장 중 오류가 발생했습니다.', 'error');
  }
}

// 자막 설정 불러오기
function loadSubtitleSettings() {
  try {
    // 스토리지에서 설정 불러오기
    chrome.storage.sync.get(['subtitleSettings', 'subtitleEnabled', 'subtitleLanguage'], function(data) {
      if (chrome.runtime.lastError) {
        console.debug('[Whatsub] 설정 불러오기 중 오류 발생:', chrome.runtime.lastError);
        return;
      }
      
      // 불러온 설정 적용
      if (data.subtitleSettings) {
        const settings = data.subtitleSettings;
        
        // 자막 위치 설정
        const positionSelect = document.getElementById('caption-position');
        if (positionSelect && settings.position) {
          positionSelect.value = settings.position;
        }
        
        // 글꼴 크기 설정
        const fontSizeSelect = document.getElementById('font-size');
        if (fontSizeSelect && settings.fontSize) {
          fontSizeSelect.value = settings.fontSize;
        }
        
        // 배경 투명도 설정
        const backgroundSelect = document.getElementById('background-opacity');
        if (backgroundSelect && settings.background) {
          backgroundSelect.value = settings.background;
        }
        
        // 듀얼 자막 설정
        const dualSubtitleToggle = document.getElementById('dual-subtitle');
        if (dualSubtitleToggle && settings.dualSubtitles !== undefined) {
          dualSubtitleToggle.checked = settings.dualSubtitles;
          state.dualSubtitleActive = settings.dualSubtitles;
        }
      }
      
      // 자막 활성화 상태 설정
      const filterToggle = document.getElementById('filter-toggle');
      if (filterToggle && data.subtitleEnabled !== undefined) {
        filterToggle.checked = data.subtitleEnabled;
        state.subtitleActive = data.subtitleEnabled;
        
        // 현재 탭의 자막 상태 확인하여 동기화
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'checkStatus' }, function(response) {
              if (chrome.runtime.lastError) {
                console.debug('[Whatsub] 상태 확인 메시지 전송 중 오류:', chrome.runtime.lastError.message);
                return;
              }
              
              if (response && response.isSubtitleEnabled !== undefined) {
                // 콘텐츠 스크립트의 상태와 팝업의 상태가 다를 경우 동기화
                if (response.isSubtitleEnabled !== state.subtitleActive) {
                  filterToggle.checked = response.isSubtitleEnabled;
                  state.subtitleActive = response.isSubtitleEnabled;
                }
              }
            });
          }
        });
      }
      
      // 언어 설정
      const languageSelect = document.getElementById('filter-language');
      if (languageSelect && data.subtitleLanguage) {
        languageSelect.value = data.subtitleLanguage;
      }
      
      console.log('[Whatsub] 자막 설정 로드 완료');
    });
  } catch (error) {
    console.error('자막 설정을 불러오는 중 오류가 발생했습니다:', error);
  }
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
    const response = await sendMessage('getUsage', {}, function(response) {
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
    });
  } catch (error) {
    console.error('사용량 데이터 로드 중 오류:', error);
  }
}

// 구글 로그인 처리
/**
 * Google OAuth를 통해 사용자 로그인을 처리합니다.
 * @dependency background.js의 signInWithGoogle 함수
 * @relatedFiles background.js (signInWithGoogle, fetchUserInfo 함수)
 * @messageFlow popup.js → background.js
 */
function handleGoogleSignIn() {
  try {
    showLoading();
    showMessage('로그인 중...', 'info');
    
    // 백그라운드 서비스에 로그인 요청 - 콜백 패턴 사용
    sendMessage('signInWithGoogle', {}, function(response) {
      if (!response || !response.success) {
        console.error('로그인 실패:', response?.error || '알 수 없는 오류');
        showMessage(response?.error || '로그인에 실패했습니다.', 'error');
        switchTab('signin');
        hideLoading();
        return;
      }
      
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
      
      // 사용자 정보 표시
      updateAuthState();
      
      // 메인 탭으로 전환
      switchTab('main');
      hideLoading();
    });
  } catch (error) {
    console.error('로그인 중 오류 발생:', error);
    showMessage('로그인 중 오류가 발생했습니다.', 'error');
    hideLoading();
  }
}

// 회원가입 처리
function handleSignup() {
  openExternalPage('https://whatsub.netlify.app/signup');
}

// 로그아웃 처리
/**
 * 사용자 로그아웃을 처리합니다.
 * @dependency background.js의 signOut 함수
 * @relatedFiles background.js (signOut 함수)
 * @messageFlow popup.js → background.js
 */
function handleLogout() {
  try {
    showLoading();
    showMessage('로그아웃 중...', 'info');
    
    // 백그라운드 서비스에 로그아웃 요청 - 콜백 패턴 사용
    sendMessage('signOut', {}, function(response) {
      if (!response || !response.success) {
        console.error('로그아웃 실패:', response?.error || '알 수 없는 오류');
        showMessage(response?.error || '로그아웃에 실패했습니다.', 'error');
        hideLoading();
        return;
      }
      
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
      hideLoading();
    });
  } catch (error) {
    console.error('로그아웃 중 오류 발생:', error);
    showMessage('로그아웃 중 오류가 발생했습니다.', 'error');
    hideLoading();
  }
}

// 인증 상태 확인 (재시도 메커니즘 포함)
/**
 * 사용자의 인증 상태를 확인합니다. 실패 시 재시도합니다.
 * @dependency background.js의 checkAuth 함수
 * @relatedFiles background.js (checkAuth, validateToken 함수)
 * @messageFlow popup.js → background.js
 * 
 * @param {number} retryCount - 최대 재시도 횟수
 * @param {number} retryDelay - 재시도 간격(밀리초)
 * @param {function} callback - 응답을 처리할 콜백 함수
 */
function checkAuthState(retryCount = 2, retryDelay = 1000, callback) {
  let attempt = 0;
  
  function attemptAuthCheck() {
    try {
      showLoading('인증 상태 확인 중...');
      
      // 백그라운드 서비스에 인증 상태 요청 - 콜백 패턴 사용
      sendMessage('checkAuth', {}, function(response) {
        // 응답이 없거나 오류가 있는 경우 처리
        if (!response || response.error) {
          console.debug(`[Whatsub] 인증 상태 확인 응답 오류 (시도 ${attempt + 1}/${retryCount + 1}):`, response?.error || '응답 없음');
          handleRetryOrFallback();
          return;
        }
        
        console.debug(`[Whatsub] 인증 상태 확인 응답 (시도 ${attempt + 1}/${retryCount + 1}):`, response);
        
        // 타임아웃이나 오류 발생 시 로컬 스토리지에서 확인
        if (response.fallback) {
          console.debug('[Whatsub] 백그라운드 통신 실패, 로컬 스토리지에서 인증 상태 확인');
          checkLocalStorageAuth();
          return;
        }
        
        // 정상 응답 처리
        state.isAuthenticated = response.isAuthenticated === true;
        state.user = response.user || null;
        
        // 관리자 계정 체크
        checkAdminAccount();
        
        // UI 업데이트
        updateMainTabContent();
        updateAuthState();
        
        hideLoading();
        
        if (callback) {
          callback(response);
        }
      });
    } catch (error) {
      console.debug(`[Whatsub] 인증 상태 확인 중 오류 (시도 ${attempt + 1}/${retryCount + 1}):`, error);
      handleRetryOrFallback();
    }
  }
  
  // 로컬 스토리지에서 인증 상태 확인
  function checkLocalStorageAuth() {
    chrome.storage.local.get(['auth', 'whatsub_auth', 'user'], function(authData) {
      // 스토리지에서 인증 상태 복원
      if (authData.auth?.isAuthenticated && authData.user) {
        console.debug('[Whatsub] 로컬 스토리지에서 인증 상태 복원 성공');
        
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
        
        if (callback) {
          callback({ isAuthenticated: true, user: authData.user, restoredFromStorage: true });
        }
        return;
      }
      
      // 로컬 스토리지에도 인증 정보가 없으면 재시도 또는 실패 처리
      handleRetryOrFallback();
    });
  }
  
  // 재시도 또는 실패 처리
  function handleRetryOrFallback() {
    // 재시도할 경우 대기
    if (attempt < retryCount) {
      console.debug(`[Whatsub] 재시도 대기 중... (${retryDelay}ms)`);
      attempt++;
      setTimeout(attemptAuthCheck, retryDelay);
      return;
    }
    
    // 모든 재시도 실패, 로그아웃 상태로 처리
    console.debug('[Whatsub] 인증 상태 확인 실패, 로그아웃 상태로 처리');
    handleUnauthenticatedState();
    hideLoading();
    
    if (callback) {
      callback({ isAuthenticated: false, error: 'auth_check_failed' });
    }
  }
  
  // 초기 시도 시작
  attemptAuthCheck();
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
function showMessage(message, type = 'info', duration = 1000) {
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
    
    // 일정 시간 후 제거 (1초로 변경)
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 300); // 페이드 아웃 후 제거
    }, duration);
    
    // 콘솔에도 기록
    console.log(`[Whatsub] ${type.toUpperCase()}: ${message}`);
  } catch (error) {
    console.error('[Whatsub] 메시지 표시 오류:', error);
  }
}

// 테스트 자막 표시 함수
function showTestSubtitle() {
  try {
    // 현재 활성화된 탭 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.debug('[Whatsub] 활성화된 탭을 찾을 수 없습니다.');
        showMessage('테스트 자막을 표시할 탭을 찾을 수 없습니다.', 'warning');
        return;
      }
      
      const tabId = tabs[0].id;
      
      // 탭 존재 여부 확인
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.debug('[Whatsub] 유효하지 않은 탭:', chrome.runtime.lastError.message);
          showMessage('테스트 자막을 표시할 유효한 탭을 찾을 수 없습니다.', 'warning');
          return;
        }
        
        // 테스트 자막 텍스트 준비
        const originalText = "WhatSub 확장 프로그램의 자막 테스트입니다.";
        const translatedText = "This is a subtitle test for WhatSub extension.";
        
        // 콘텐츠 스크립트에 메시지 전송 (콜백 패턴 사용)
        chrome.tabs.sendMessage(tabId, {
          action: 'showTestSubtitle',
          original: originalText,
          translated: translatedText,
          universalMode: true
        }, function(response) {
          // 오류 처리
          if (chrome.runtime.lastError) {
            console.debug('[Whatsub] 테스트 자막 표시 중 오류:', chrome.runtime.lastError.message);
            showMessage('테스트 자막 표시 중 오류가 발생했습니다', 'warning');
            return;
          }
          
          // 응답 처리
          if (response && response.success) {
            // 필터 토글 켜기
            const filterToggle = document.getElementById('filter-toggle');
            if (filterToggle && !filterToggle.checked) {
              filterToggle.checked = true;
              toggleSubtitleFilter(true);
            }
            
            showMessage('테스트 자막이 표시되었습니다.', 'success');
          } else {
            const errorMsg = response ? response.error || '알 수 없는 오류' : '응답이 없습니다';
            showMessage('테스트 자막 표시 중 오류가 발생했습니다: ' + errorMsg, 'error');
          }
        });
      });
    });
  } catch (error) {
    console.debug('[Whatsub] 테스트 자막 표시 중 오류 발생:', error);
    showMessage('테스트 자막 표시 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
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
      }, function(response) {
        if (response.success) {
          showMessage('자막이 성공적으로 업로드되었습니다.', 'success');
          loadSubtitleList(); // 목록 새로고침
        } else {
          showMessage('자막 업로드에 실패했습니다.', 'error');
        }
      });
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
    }, function(response) {
      if (response.success && response.subtitles.length > 0) {
        // 자막 목록 표시
        displaySubtitleList(response.subtitles);
      } else {
        showMessage('사용 가능한 자막이 없습니다.', 'warning');
      }
    });
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
    
    const response = await sendMessage('applySubtitle', { subtitleId }, function(response) {
      if (response.success) {
        showMessage('자막이 성공적으로 적용되었습니다.', 'success');
      } else {
        showMessage('자막 적용에 실패했습니다.', 'error');
      }
    });
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
    }, function(response) {
      if (response && response.success && response.subtitles) {
        displaySubtitleList(response.subtitles);
      } else {
        // 자막 목록이 없으면 안내 메시지 표시
        const listContainer = document.getElementById('subtitle-list');
        if (listContainer) {
          listContainer.innerHTML = '<div class="no-subtitles">현재 페이지에 사용 가능한 자막이 없습니다.</div>';
        }
      }
    });
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
    checkAuthState(2, 1000, function(response) {
      if (!response || !response.isAuthenticated) {
        console.error('인증 상태 확인 결과: 인증되지 않음');
      }
    });
    
  } catch (error) {
    console.error('초기화 중 오류 발생:', error);
    // 오류가 발생해도 메인 탭을 보여줌
    switchTab('main');
    hideLoading();
  }
});