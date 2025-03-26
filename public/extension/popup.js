/**
 * Whatsub 팝업 스크립트
 * 
 * 주요 기능:
 * 1. 탭 전환 및 UI 관리
 * 2. 자막 설정 저장 및 로드
 * 3. 인증 상태 관리
 * 4. 외부 링크 처리
 */

document.addEventListener('DOMContentLoaded', initializePopup);

// 팝업 초기화
function initializePopup() {
    console.log('[Whatsub] 팝업 초기화 중...');
    
    // 테스트 메시지 표시
    alert('Whatsub 확장 프로그램(버전 0.2.2) 테스트 중입니다. 정상 작동 확인됨.');
    
    // 버튼 및 UI 요소 참조
    const tabButtons = document.querySelectorAll('.tab-button');
    const subtitleEnabledCheckbox = document.getElementById('subtitle-enabled');
    const fontSizeSelect = document.getElementById('font-size');
    const textColorSelect = document.getElementById('text-color');
    const backgroundColorSelect = document.getElementById('background-color');
    const subtitlePositionSelect = document.getElementById('subtitle-position');
    const saveSubtitleSettingsButton = document.getElementById('save-subtitle-settings');
    const resetSubtitlePositionButton = document.getElementById('reset-subtitle-position');
    const googleLoginButton = document.getElementById('google-login');
    const logoutButton = document.getElementById('logout-button');
    const signupButton = document.getElementById('signup-button');
    const helpLink = document.getElementById('help-link');
    const termsLink = document.getElementById('terms-link');
    const feedbackLink = document.getElementById('feedback-link');
    const contactEmailLink = document.getElementById('contact-email');
    const websiteLink = document.getElementById('website-link');
    const subscriptionButton = document.getElementById('subscription-button');
    const subtitleTestLink = document.getElementById('subtitle-test-link');
    
    // 개발자 모드 여부 체크 (개발 중에만 디버그 정보 표시)
    const isDeveloperMode = !chrome.runtime.getManifest().update_url;
    
    if (isDeveloperMode) {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.style.display = 'block';
        }
    }
    
    // 탭 전환 이벤트 설정
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 현재 활성화된 탭 비활성화
            document.querySelector('.tab-button.active').classList.remove('active');
            document.querySelector('.tab-content.active').classList.remove('active');
            
            // 클릭한 탭 활성화
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // 자막 설정 로드
    loadSubtitleSettings();
    
    // 자막 설정 저장 버튼 이벤트
    if (saveSubtitleSettingsButton) {
        saveSubtitleSettingsButton.addEventListener('click', saveSubtitleSettings);
    }
    
    // 자막 위치 초기화 버튼 이벤트
    if (resetSubtitlePositionButton) {
        resetSubtitlePositionButton.addEventListener('click', resetSubtitlePosition);
    }
    
    // 구글 로그인 버튼 이벤트
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', handleGoogleSignIn);
    }
    
    // 로그아웃 버튼 이벤트
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    
    // 회원가입 버튼 이벤트
    if (signupButton) {
        signupButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/signup');
        });
    }
    
    // 자막 테스트 페이지 링크 이벤트
    if (subtitleTestLink) {
        subtitleTestLink.addEventListener('click', () => {
            goToSubtitleTestPage();
        });
    }
    
    // 자막 테스트 버튼 이벤트
    const testSubtitleButton = document.getElementById('test-subtitle-button');
    if (testSubtitleButton) {
        testSubtitleButton.addEventListener('click', testSubtitle);
    }
    
    // 외부 링크 이벤트
    if (helpLink) helpLink.addEventListener('click', () => {
        openExternalPage('https://whatsub.netlify.app/help');
    });
    
    if (termsLink) termsLink.addEventListener('click', () => {
        openExternalPage('https://whatsub.netlify.app/terms');
    });
    
    if (feedbackLink) feedbackLink.addEventListener('click', () => {
        handleFeedback();
    });
    
    if (contactEmailLink) contactEmailLink.addEventListener('click', () => {
        handleFeedback();
    });
    
    if (websiteLink) websiteLink.addEventListener('click', () => {
        openExternalPage('https://whatsub.netlify.app');
    });
    
    if (subscriptionButton) subscriptionButton.addEventListener('click', () => {
        openExternalPage('https://whatsub.netlify.app/pricing');
    });
    
    // 인증 상태 확인
    checkAuthState();

    // 토글 버튼 이벤트 설정
    const toggleSubtitleButton = document.getElementById('toggleSubtitle');
    if (toggleSubtitleButton) {
        toggleSubtitleButton.addEventListener('click', toggleSubtitle);
        
        // 현재 상태 확인하여 버튼 텍스트 설정
        chrome.storage.sync.get(['subtitleEnabled'], (result) => {
            const enabled = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
            toggleSubtitleButton.textContent = enabled ? '자막 끄기' : '자막 켜기';
        });
    }
}

// 자막 설정 로드
function loadSubtitleSettings() {
    chrome.storage.sync.get(['subtitleEnabled', 'subtitleStyle'], (result) => {
        const subtitleEnabledCheckbox = document.getElementById('subtitle-enabled');
        const fontSizeSelect = document.getElementById('font-size');
        const textColorSelect = document.getElementById('text-color');
        const backgroundColorSelect = document.getElementById('background-color');
        const subtitlePositionSelect = document.getElementById('subtitle-position');
        
        if (subtitleEnabledCheckbox) {
            subtitleEnabledCheckbox.checked = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
        }
        
        if (result.subtitleStyle) {
            const style = result.subtitleStyle;
            
            if (fontSizeSelect && style.fontSize) {
                fontSizeSelect.value = style.fontSize;
            }
            
            if (textColorSelect && style.textColor) {
                textColorSelect.value = style.textColor;
            }
            
            if (backgroundColorSelect && style.backgroundColor) {
                backgroundColorSelect.value = style.backgroundColor;
            }
            
            if (subtitlePositionSelect && style.position) {
                subtitlePositionSelect.value = style.position;
            }
        }
    });
}

// 자막 설정 저장
function saveSubtitleSettings() {
    const subtitleEnabledCheckbox = document.getElementById('subtitle-enabled');
    const fontSizeSelect = document.getElementById('font-size');
    const textColorSelect = document.getElementById('text-color');
    const backgroundColorSelect = document.getElementById('background-color');
    const subtitlePositionSelect = document.getElementById('subtitle-position');
    
    const subtitleEnabled = subtitleEnabledCheckbox.checked;
    const subtitleStyle = {
        fontSize: fontSizeSelect.value,
        textColor: textColorSelect.value,
        backgroundColor: backgroundColorSelect.value,
        position: subtitlePositionSelect.value
    };
    
    chrome.storage.sync.set({ 
        subtitleEnabled: subtitleEnabled,
        subtitleStyle: subtitleStyle
    }, () => {
        // 활성 탭에 설정 변경 알림
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleSubtitles',
                    enabled: subtitleEnabled
                }).catch(err => console.error('[Whatsub] 자막 토글 메시지 전송 오류:', err));
                
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSubtitleStyle',
                    style: subtitleStyle
                }).catch(err => console.error('[Whatsub] 자막 스타일 업데이트 메시지 전송 오류:', err));
            }
        });
        
        showMessage('설정이 저장되었습니다.');
    });
}

// 자막 위치 초기화
function resetSubtitlePosition() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'resetPosition'
            }).catch(err => console.error('[Whatsub] 자막 위치 초기화 메시지 전송 오류:', err));
            
            showMessage('자막 위치가 초기화되었습니다.');
        }
    });
}

// 구글 로그인 처리
function handleGoogleSignIn() {
    showMessage('로그인 중...', true);
    
    // 개발자 모드일 경우에만 디버그 로그 표시
    const isDeveloperMode = !chrome.runtime.getManifest().update_url;
    if (isDeveloperMode) {
        logDebug('Google 로그인 시도 중...');
    }
    
    chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, (response) => {
        if (chrome.runtime.lastError) {
            // 오류 처리
            showMessage('로그인 실패: ' + chrome.runtime.lastError.message, false, true);
            if (isDeveloperMode) {
                logDebug('로그인 오류: ' + chrome.runtime.lastError.message);
            }
            return;
        }
        
        if (response && response.success) {
            // 로그인 성공
            showMessage('로그인 성공', true);
            if (isDeveloperMode) {
                logDebug('사용자 정보 획득: ' + response.user.email);
            }
            
            // 인증 상태 업데이트
            updateAuthState({
                isLoggedIn: true,
                user: response.user
            });
            
            // 메인 탭으로 전환
            switchTab('main');
        } else {
            // 로그인 실패
            showMessage(response ? response.error : '로그인 실패', false, true);
            if (isDeveloperMode) {
                logDebug('로그인 실패: ' + (response ? response.error : '알 수 없는 오류'));
            }
        }
    });
}

// 로그아웃 처리
function handleLogout() {
    showMessage('로그아웃 중...', true);
    
    chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
        if (chrome.runtime.lastError) {
            // 오류 처리
            showMessage('로그아웃 실패: ' + chrome.runtime.lastError.message, false, true);
            return;
        }
        
        if (response && response.success) {
            // 로그아웃 성공
            showMessage('로그아웃 완료', true);
            
            // 인증 상태 업데이트
            updateAuthState({
                isLoggedIn: false,
                user: null
            });
            
            // 로그인 탭으로 전환
            switchTab('signin');
        } else {
            // 로그아웃 실패
            showMessage(response ? response.error : '로그아웃 실패', false, true);
        }
    });
}

// 피드백 처리
function handleFeedback() {
    const email = 'contact@whatsub.io';
    const subject = 'Whatsub 피드백';
    const body = '안녕하세요,\n\n이곳에 메시지를 작성해 주세요.\n\n';
    
    chrome.tabs.create({
        url: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    });
}

// 외부 페이지 열기
function openExternalPage(url) {
    chrome.tabs.create({ url: url });
}

// 인증 상태 확인
function checkAuthState() {
    chrome.runtime.sendMessage({ action: 'checkAuthState' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Whatsub] 인증 상태 확인 오류:', chrome.runtime.lastError);
            return;
        }
        
        updateAuthState(response);
    });
}

// 인증 상태 업데이트
function updateAuthState(authState) {
    // 로그인 상태에 따라 UI 업데이트
    const loginInfo = document.getElementById('login-info');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    
    if (authState && authState.isLoggedIn && authState.user) {
        // 로그인 상태
        if (loginInfo) loginInfo.style.display = 'none';
        if (userInfo) userInfo.style.display = 'block';
        if (userEmail) userEmail.textContent = authState.user.email || '';
        
        // 사용량 정보 로드
        loadUsageData(authState.user);
        
        // 메인 탭 콘텐츠 업데이트
        updateMainTabContent();
    } else {
        // 로그아웃 상태
        if (loginInfo) loginInfo.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        
        // 메인 탭 콘텐츠 업데이트
        updateMainTabContent();
    }
}

// 메인 탭 콘텐츠 업데이트
function updateMainTabContent() {
    chrome.runtime.sendMessage({ action: 'checkAuthState' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Whatsub] 인증 상태 확인 오류:', chrome.runtime.lastError);
            return;
        }
        
        const loginInfo = document.getElementById('login-info');
        const userInfo = document.getElementById('user-info');
        
        if (response && response.isLoggedIn && response.user) {
            // 로그인 상태
            if (loginInfo) loginInfo.style.display = 'none';
            if (userInfo) userInfo.style.display = 'block';
        } else {
            // 로그아웃 상태
            if (loginInfo) loginInfo.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    });
}

// 탭 전환
function switchTab(tabId) {
    const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (tabButton) {
        tabButton.click();
    }
}

// 메시지 표시
function showMessage(message, autoHide = true, isError = false) {
    const messageContainer = document.getElementById('message-container');
    const messageElement = document.getElementById('message');
    
    if (messageContainer && messageElement) {
        messageElement.textContent = message;
        messageContainer.style.display = 'block';
        
        if (isError) {
            messageContainer.classList.add('error');
        } else {
            messageContainer.classList.remove('error');
        }
        
        if (autoHide) {
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
    }
}

// 디버그 로그 출력 (개발자 모드에서만 사용)
function logDebug(message) {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        debugLog.appendChild(logEntry);
        
        // 로그가 너무 많으면 오래된 것부터 삭제
        while (debugLog.children.length > 10) {
            debugLog.removeChild(debugLog.firstChild);
        }
    }
}

// 사용량 데이터 로드
function loadUsageData(user) {
    if (!user || !user.email) return;
    
    chrome.runtime.sendMessage({ 
        action: 'getUserUsage',
        email: user.email 
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Whatsub] 사용량 정보 로드 오류:', chrome.runtime.lastError);
            return;
        }
        
        if (response && response.success) {
            const remainingTime = document.getElementById('remaining-time');
            const subscriptionStatus = document.getElementById('subscription-status');
            
            if (remainingTime) {
                remainingTime.textContent = response.remainingMinutes || '0';
            }
            
            if (subscriptionStatus) {
                subscriptionStatus.textContent = response.subscriptionTier || '무료';
            }
        }
    });
}

// 자막 테스트 페이지로 이동하는 기능
function goToSubtitleTestPage() {
    console.log('[Whatsub] 자막 테스트 페이지로 이동합니다.');
    chrome.tabs.create({
        url: chrome.runtime.getURL('test-subtitle.html')
    });
}

// 자막 토글 함수
function toggleSubtitle() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const activeTab = tabs[0];
            
            // 현재 자막 상태 확인 후 토글
            chrome.storage.sync.get(['subtitleEnabled'], (result) => {
                const currentState = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
                const newState = !currentState;
                
                // 상태 저장
                chrome.storage.sync.set({ subtitleEnabled: newState });
                
                // 현재 탭에 메시지 전송
                chrome.tabs.sendMessage(activeTab.id, {
                    action: 'toggleSubtitles',
                    enabled: newState
                }).then(response => {
                    console.log('[Whatsub] 자막 토글 응답:', response);
                    
                    // 버튼 텍스트 업데이트
                    const toggleButton = document.getElementById('toggleSubtitle');
                    if (toggleButton) {
                        toggleButton.textContent = newState ? '자막 끄기' : '자막 켜기';
                    }
                }).catch(error => {
                    console.error('[Whatsub] 자막 토글 오류:', error);
                });
            });
        }
    });
} 