document.addEventListener('DOMContentLoaded', () => {
    // 상태 표시 요소
    const statusContainer = document.getElementById('statusContainer');
    const loadingElement = document.getElementById('loading');
    
    // 탭 관련 요소
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 로그인 관련 요소
    const googleSigninButton = document.getElementById('google-signin');
    const logoutButton = document.getElementById('logout-button');
    
    // 사용자 정보 요소
    const userInfoElement = document.getElementById('user-info');
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const userAvatarElement = document.getElementById('user-avatar');
    
    // 자막 서비스 관련 요소
    const subtitleToggle = document.getElementById('subtitle-toggle');
    const usageText = document.getElementById('usage-text');
    const usageFill = document.getElementById('usage-fill');
    const subscriptionStatus = document.getElementById('subscription-status');
    
    // 설정 관련 요소
    const sourceLanguage = document.getElementById('source-language');
    const targetLanguage = document.getElementById('target-language');
    const noiseReductionToggle = document.getElementById('noise-reduction-toggle');
    const fontSize = document.getElementById('font-size');
    const backgroundOpacity = document.getElementById('background-opacity');
    const subtitlePosition = document.getElementById('subtitle-position');
    const saveSettingsButton = document.getElementById('save-settings-button');
    const resetSettingsButton = document.getElementById('reset-settings-button');
    
    // 도움말 관련 요소
    const feedbackButton = document.getElementById('feedback-button');
    
    // 초기 상태 설정
    let state = {
        currentTab: 'signin',
        isLoggedIn: false,
        user: null,
        settings: {
            sourceLanguage: 'auto',
            targetLanguage: 'ko',
            noiseReduction: true,
            fontSize: 'medium',
            backgroundOpacity: 'semi',
            subtitlePosition: 'bottom'
        },
        subtitleEnabled: false,
        usage: {
            minutes: 0,
            totalMinutes: 60,
            percentage: 0
        }
    };
    
    // 탭 전환 함수
    function switchTab(tabName) {
        // 이전 탭 비활성화
        tabButtons.forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // 모든 탭 콘텐츠 숨기기
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // 선택한 탭 보이기
        const activeTabContent = document.getElementById(`${tabName}-tab`);
        if (activeTabContent) {
            activeTabContent.classList.add('active');
        }
        
        state.currentTab = tabName;
    }
    
    // 탭 버튼 이벤트 리스너
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });
    
    // 상태 메시지 표시 함수
    function showStatus(message, type = 'info') {
        statusContainer.textContent = message;
        statusContainer.className = `status ${type}`;
        
        // 5초 후 메시지 숨기기
        setTimeout(() => {
            statusContainer.className = 'status';
        }, 5000);
    }
    
    // 로딩 인디케이터 표시/숨기기 함수
    function showLoading(show = true) {
        if (show) {
            loadingElement.classList.add('show');
        } else {
            loadingElement.classList.remove('show');
        }
    }
    
    // 사용자 정보 업데이트 함수
    function updateUserInfo(user) {
        if (user) {
            userNameElement.textContent = user.displayName || '사용자';
            userEmailElement.textContent = user.email || '';
            if (user.photoURL) {
                userAvatarElement.src = user.photoURL;
            }
            
            // 구독 상태 업데이트
            subscriptionStatus.textContent = `현재 플랜: ${user.subscription || '무료'}`;
        }
    }
    
    // 사용량 업데이트 함수
    function updateUsage(usage) {
        if (usage) {
            const percentage = Math.min(100, (usage.minutes / usage.totalMinutes) * 100);
            usageText.textContent = `오늘 ${usage.minutes}/${usage.totalMinutes}분 사용함`;
            usageFill.style.width = `${percentage}%`;
            
            // 사용량에 따라 색상 변경
            if (percentage > 90) {
                usageFill.style.backgroundColor = '#f44336'; // 빨간색
            } else if (percentage > 70) {
                usageFill.style.backgroundColor = '#ff9800'; // 주황색
            } else {
                usageFill.style.backgroundColor = '#4285f4'; // 파란색
            }
        }
    }
    
    // 설정 로드 함수
    function loadSettings() {
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                state.settings = { ...state.settings, ...result.settings };
                
                // UI 업데이트
                sourceLanguage.value = state.settings.sourceLanguage;
                targetLanguage.value = state.settings.targetLanguage;
                noiseReductionToggle.checked = state.settings.noiseReduction;
                fontSize.value = state.settings.fontSize;
                backgroundOpacity.value = state.settings.backgroundOpacity;
                subtitlePosition.value = state.settings.subtitlePosition;
            }
        });
        
        // 자막 상태 로드
        chrome.storage.local.get(['subtitleEnabled'], (result) => {
            if (result.subtitleEnabled !== undefined) {
                state.subtitleEnabled = result.subtitleEnabled;
                subtitleToggle.checked = state.subtitleEnabled;
            }
        });
    }
    
    // 설정 저장 함수
    function saveSettings() {
        // UI에서 설정 값 가져오기
        state.settings = {
            sourceLanguage: sourceLanguage.value,
            targetLanguage: targetLanguage.value,
            noiseReduction: noiseReductionToggle.checked,
            fontSize: fontSize.value,
            backgroundOpacity: backgroundOpacity.value,
            subtitlePosition: subtitlePosition.value
        };
        
        // 로컬 스토리지에 저장
        chrome.storage.local.set({ settings: state.settings }, () => {
            showStatus('설정이 저장되었습니다.', 'success');
            
            // 활성 탭에 설정 변경 알림
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: state.settings
                });
            });
        });
    }
    
    // 설정 초기화 함수
    function resetSettings() {
        state.settings = {
            sourceLanguage: 'auto',
            targetLanguage: 'ko',
            noiseReduction: true,
            fontSize: 'medium',
            backgroundOpacity: 'semi',
            subtitlePosition: 'bottom'
        };
        
        // UI 업데이트
        sourceLanguage.value = state.settings.sourceLanguage;
        targetLanguage.value = state.settings.targetLanguage;
        noiseReductionToggle.checked = state.settings.noiseReduction;
        fontSize.value = state.settings.fontSize;
        backgroundOpacity.value = state.settings.backgroundOpacity;
        subtitlePosition.value = state.settings.subtitlePosition;
        
        // 로컬 스토리지에 저장
        chrome.storage.local.set({ settings: state.settings }, () => {
            showStatus('설정이 초기화되었습니다.', 'success');
            
            // 활성 탭에 설정 변경 알림
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: state.settings
                });
            });
        });
    }
    
    // 자막 토글 함수
    function toggleSubtitle() {
        state.subtitleEnabled = subtitleToggle.checked;
        
        // 로컬 스토리지에 저장
        chrome.storage.local.set({ subtitleEnabled: state.subtitleEnabled });
        
        // 활성 탭에 자막 상태 변경 알림
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: state.subtitleEnabled ? 'startSubtitles' : 'stopSubtitles'
            });
        });
    }
    
    // 로그인 오류 처리 개선
    function handleLoginError(error) {
        console.error('로그인 오류:', error);
        
        // 상태 메시지 표시
        const statusContainer = document.getElementById('statusContainer');
        statusContainer.className = 'status error';
        
        if (error && error.errorType === 'redirect_uri_mismatch') {
            // 리디렉션 URI 불일치 오류 처리
            statusContainer.innerHTML = `
                <h3>리디렉션 URI 불일치 오류</h3>
                <p>Google 로그인을 위해서는 올바른 리디렉션 URI를 Google Cloud Console에 등록해야 합니다.</p>
                <p>다음 리디렉션 URI를 복사하여 Google Cloud Console에 등록하세요:</p>
                <code id="redirect-uri-display">${error.redirectUri || chrome.identity.getRedirectURL('oauth2')}</code>
                <button id="copy-redirect-uri" class="copy-button">복사</button>
                <ol>
                    <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>에 접속하세요.</li>
                    <li>해당 OAuth 클라이언트 ID를 클릭하세요.</li>
                    <li>승인된 리디렉션 URI 항목에 위 URI를 추가하세요.</li>
                    <li>저장 후 다시 로그인을 시도하세요.</li>
                </ol>
            `;
            
            // 복사 버튼 기능 추가
            const copyButton = document.getElementById('copy-redirect-uri');
            if (copyButton) {
                copyButton.addEventListener('click', function() {
                    const redirectUri = document.getElementById('redirect-uri-display').textContent;
                    navigator.clipboard.writeText(redirectUri).then(function() {
                        copyButton.textContent = '복사됨!';
                        copyButton.classList.add('copied');
                        setTimeout(function() {
                            copyButton.textContent = '복사';
                            copyButton.classList.remove('copied');
                        }, 2000);
                    });
                });
            }
        } else {
            // 기타 오류 메시지 처리
            statusContainer.textContent = error && error.message ? 
                `로그인 오류: ${error.message}` : 
                '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
        
        // 로딩 상태 해제
        hideLoading();
    }
    
    // Google 로그인 함수
    function signInWithGoogle() {
        showLoading(true);
        
        // 오류 처리를 위한 타임아웃 설정
        const timeoutId = setTimeout(() => {
            showLoading(false);
            showStatus('요청 시간 초과. 브라우저를 다시 시작하고 다시 시도하세요.', 'error');
        }, 15000); // 15초 제한
        
        try {
            chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, (response) => {
                clearTimeout(timeoutId); // 타임아웃 취소
                showLoading(false);
                
                // 응답이 없는 경우 오류 처리
                if (!response) {
                    console.error('응답이 없습니다. 브라우저 확장 오류일 수 있습니다.');
                    showStatus('응답이 없습니다. 브라우저를 다시 시작하고 다시 시도하세요.', 'error');
                    return;
                }
                
                if (response.success) {
                    state.isLoggedIn = true;
                    state.user = response.user;
                    
                    updateUserInfo(state.user);
                    
                    // 사용량 정보 가져오기
                    chrome.runtime.sendMessage({ action: 'getUsage' }, (usageResponse) => {
                        if (usageResponse && usageResponse.success) {
                            state.usage = usageResponse.usage;
                            updateUsage(state.usage);
                        }
                    });
                    
                    // 메인 탭으로 전환
                    switchTab('main');
                    
                    showStatus('로그인되었습니다.', 'success');
                } else {
                    console.error('로그인 오류:', response.error);
                    
                    if (response.invalidClientId) {
                        showStatus('유효한 OAuth 클라이언트 ID가 설정되지 않았습니다. manifest.json 파일을 수정하여 OAuth 클라이언트 ID를 설정해주세요.', 'error');
                    } else if (response.errorType === 'redirect_uri_mismatch') {
                        showStatus('OAuth 리디렉션 URI가 Google 콘솔에 등록되지 않았습니다.', 'error');
                        handleLoginError(response.error);
                    } else if (response.error === 'access_denied') {
                        showStatus('Google 로그인이 취소되었습니다.', 'warning');
                    } else {
                        showStatus('로그인 오류: ' + (response.error || '알 수 없는 오류'), 'error');
                    }
                }
            });
        } catch (e) {
            clearTimeout(timeoutId);
            showLoading(false);
            console.error('메시지 전송 중 예외 발생:', e);
            showStatus('오류: ' + e.message, 'error');
        }
    }
    
    // 로그아웃 프레임 생성 함수
    function createLogoutFrame(url) {
        console.log('로그아웃 프레임 생성:', url);
        try {
            // 기존 로그아웃 프레임 제거
            const existingFrame = document.getElementById('google-logout-frame');
            if (existingFrame) {
                existingFrame.remove();
            }
            
            // 새 로그아웃 프레임 생성
            const iframe = document.createElement('iframe');
            iframe.id = 'google-logout-frame';
            iframe.src = url;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            // 5초 후 프레임 제거
            setTimeout(() => {
                if (iframe && iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }, 5000);
            
            return true;
        } catch (error) {
            console.error('로그아웃 프레임 생성 오류:', error);
            return false;
        }
    }
    
    // 메시지 리스너 등록
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('팝업에서 메시지 수신:', message.action);
        
        // 로그아웃 프레임 생성 요청 처리
        if (message.action === 'createLogoutFrame' && message.url) {
            const result = createLogoutFrame(message.url);
            sendResponse({ success: result });
            return true;
        }
        
        // 인증 상태 변경 알림 처리
        if (message.action === 'authStateChanged') {
            console.log('인증 상태 변경 감지:', message.data);
            
            if (!message.data.isAuthenticated) {
                // 로그아웃 상태로 변경
                state.isLoggedIn = false;
                state.user = null;
                
                // UI 업데이트
                if (userNameElement) userNameElement.textContent = '';
                if (userEmailElement) userEmailElement.textContent = '';
                if (userAvatarElement) userAvatarElement.src = '';
                
                // 로그인 탭으로 전환
                switchTab('signin');
            }
            
            return true;
        }
        
        return false;
    });
    
    // 로그아웃 함수 개선
    function signOut() {
        showLoading(true);
        console.log('로그아웃 시작...');
        
        // 로그아웃 타임아웃 설정 - 15초 후 강제 완료
        const timeoutId = setTimeout(() => {
            showLoading(false);
            console.warn('로그아웃 시간 초과');
            
            // 타임아웃 발생 시 UI는 로그아웃된 상태로 강제 전환
            state.isLoggedIn = false;
            state.user = null;
            switchTab('signin');
            
            // 수동 로그아웃 안내
            showStatus('로그아웃 시간이 초과되었습니다. UI를 로그아웃 상태로 전환했습니다. 브라우저 확장 페이지에서 Google 계정 연결을 해제하세요.', 'warning');
            
            // Google 계정 관리 페이지로 이동 안내
            const manageLink = document.createElement('a');
            manageLink.href = 'https://myaccount.google.com/permissions';
            manageLink.target = '_blank';
            manageLink.textContent = 'Google 계정 권한 관리';
            manageLink.className = 'auth-link';
            
            statusContainer.appendChild(document.createElement('br'));
            statusContainer.appendChild(manageLink);
        }, 15000);
        
        // 로그아웃 전 직접 토큰 무효화 시도
        try {
            // 1. 현재 토큰 가져오기
            chrome.identity.getAuthToken({ interactive: false }, async (token) => {
                if (token) {
                    console.log('현재 활성 토큰 발견, 폐기 시도...');
                    
                    // 2. Google OAuth 토큰 폐기 API 호출
                    try {
                        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });
                        console.log('토큰 폐기 API 호출 완료');
                    } catch (err) {
                        console.warn('토큰 폐기 API 오류(계속 진행):', err);
                    }
                    
                    // 3. 캐시에서 토큰 제거
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        console.log('토큰 캐시 제거 완료');
                    });
                }
            });
        } catch (err) {
            console.warn('토큰 사전 폐기 중 오류(계속 진행):', err);
        }
        
        // 로그아웃 메시지 전송
        chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
            clearTimeout(timeoutId);
            showLoading(false);
            
            if (response && response.success) {
                console.log('로그아웃 성공');
                
                // 상태 완전 초기화
                state.isLoggedIn = false;
                state.user = null;
                state.usage = {
                    minutes: 0,
                    totalMinutes: 60,
                    percentage: 0
                };
                
                // UI 업데이트
                updateUsage(state.usage);
                
                // 사용자 정보 UI 초기화
                if (userNameElement) userNameElement.textContent = '';
                if (userEmailElement) userEmailElement.textContent = '';
                if (userAvatarElement) userAvatarElement.src = '';
                
                // 로그인 탭으로 전환
                switchTab('signin');
                
                // 로그아웃 프레임 생성 (Google 로그아웃)
                createLogoutFrame('https://accounts.google.com/logout');
                
                // 캐시 초기화를 위해 약간의 지연 후 상태 확인
                setTimeout(() => {
                    // 상태가 실제로 변경되었는지 한 번 더 확인
                    chrome.runtime.sendMessage({ action: 'checkAuth' }, (checkResponse) => {
                        if (checkResponse && checkResponse.isLoggedIn) {
                            console.warn('로그아웃 처리 후에도 여전히 로그인 상태로 나타납니다.');
                            
                            // 경고 메시지와 함께 Google 계정 관리 링크 제공
                            showStatus('완전한 로그아웃이 되지 않았습니다. Google 계정 연결을 수동으로 해제하세요.', 'warning');
                            
                            const manageLink = document.createElement('a');
                            manageLink.href = 'https://myaccount.google.com/permissions';
                            manageLink.target = '_blank';
                            manageLink.textContent = 'Google 계정 권한 관리';
                            manageLink.className = 'auth-link';
                            
                            statusContainer.appendChild(document.createElement('br'));
                            statusContainer.appendChild(manageLink);
                            
                            // 브라우저 확장 관리 페이지 링크도 추가
                            const extensionsLink = document.createElement('a');
                            extensionsLink.href = 'chrome://extensions/?id=' + chrome.runtime.id;
                            extensionsLink.textContent = '확장 프로그램 관리';
                            extensionsLink.className = 'auth-link';
                            extensionsLink.style.marginLeft = '10px';
                            
                            statusContainer.appendChild(extensionsLink);
                        } else {
                            console.log('로그아웃 확인 완료');
                            showStatus('성공적으로 로그아웃되었습니다.', 'success');
                        }
                    });
                }, 2000);
            } else {
                console.error('로그아웃 실패:', response ? response.error : '응답 없음');
                showStatus('로그아웃 중 오류가 발생했습니다: ' + (response ? response.error : '응답 없음'), 'error');
                
                // 로그아웃에 실패하더라도 UI는 로그아웃 상태로 전환
                state.isLoggedIn = false;
                state.user = null;
                switchTab('signin');
            }
        });
    }
    
    // 피드백 전송 함수
    function sendFeedback() {
        // 피드백 모달 구현 (향후 구현)
        showStatus('피드백 기능은 곧 제공될 예정입니다.', 'info');
    }
    
    // 버튼 이벤트 리스너 등록
    googleSigninButton.addEventListener('click', signInWithGoogle);
    logoutButton.addEventListener('click', signOut);
    subtitleToggle.addEventListener('change', toggleSubtitle);
    saveSettingsButton.addEventListener('click', saveSettings);
    resetSettingsButton.addEventListener('click', resetSettings);
    feedbackButton.addEventListener('click', sendFeedback);
    
    // 초기화 함수
    function initialize() {
        // 설정 로드
        loadSettings();
        
        // 로그인 상태 확인
        chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
            if (response.isLoggedIn && response.user) {
                state.isLoggedIn = true;
                state.user = response.user;
                
                updateUserInfo(state.user);
                
                // 사용량 정보 가져오기
                chrome.runtime.sendMessage({ action: 'getUsage' }, (usageResponse) => {
                    if (usageResponse.success) {
                        state.usage = usageResponse.usage;
                        updateUsage(state.usage);
                    }
                });
                
                // 메인 탭으로 전환
                switchTab('main');
            } else {
                // 로그인 탭으로 전환
                switchTab('signin');
            }
        });
    }
    
    // 초기화 실행
    initialize();
}); 