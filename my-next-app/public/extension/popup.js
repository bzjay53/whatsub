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
    
    // 리디렉션 URI 오류 처리 함수
    function handleRedirectUriError(clientId) {
        // 기존 탭 콘텐츠 숨기기
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // 리디렉션 URI 오류 섹션 생성
        const errorSection = document.createElement('div');
        errorSection.id = 'redirect-uri-error';
        errorSection.innerHTML = `
            <h3>OAuth 클라이언트 ID 설정 필요</h3>
            <p>Google 로그인 설정이 올바르지 않습니다. 다음 단계를 통해 수정할 수 있습니다:</p>
            <ol>
                <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>에서 클라이언트 ID를 만들거나 수정하세요.</li>
                <li>다음 리디렉션 URI를 OAuth 클라이언트 허용 목록에 추가하세요:</li>
            </ol>
            <code>${chrome.identity.getRedirectURL()}</code>
            <div>
                <button id="copy-redirect-uri">URI 복사</button>
                <button id="retry-login">다시 시도</button>
            </div>
        `;
        
        document.body.appendChild(errorSection);
        
        // 복사 버튼 이벤트 리스너
        document.getElementById('copy-redirect-uri').addEventListener('click', () => {
            navigator.clipboard.writeText(chrome.identity.getRedirectURL())
                .then(() => {
                    showStatus('리디렉션 URI가 클립보드에 복사되었습니다.', 'success');
                })
                .catch(err => {
                    showStatus('복사에 실패했습니다.', 'error');
                });
        });
        
        // 다시 시도 버튼 이벤트 리스너
        document.getElementById('retry-login').addEventListener('click', () => {
            document.body.removeChild(errorSection);
            tabContents.forEach(content => {
                if (content.id === 'signin-tab') {
                    content.classList.add('active');
                }
            });
            signInWithGoogle();
        });
    }
    
    // Google 로그인 함수
    function signInWithGoogle() {
        showLoading(true);
        
        chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, (response) => {
            showLoading(false);
            
            if (response.success) {
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
                
                showStatus('로그인되었습니다.', 'success');
            } else {
                console.error('로그인 오류:', response.error);
                
                if (response.error === 'invalid_client') {
                    handleRedirectUriError();
                } else if (response.error === 'access_denied') {
                    showStatus('Google 로그인이 취소되었습니다.', 'warning');
                } else {
                    showStatus('로그인 오류: ' + response.error, 'error');
                }
            }
        });
    }
    
    // 로그아웃 함수
    function signOut() {
        showLoading(true);
        
        chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
            showLoading(false);
            
            if (response.success) {
                state.isLoggedIn = false;
                state.user = null;
                
                // 로그인 탭으로 전환
                switchTab('signin');
                
                showStatus('로그아웃되었습니다.', 'success');
            } else {
                showStatus('로그아웃 오류: ' + response.error, 'error');
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