// 백그라운드 스크립트를 통해 Airtable API 사용
// import { signInWithGoogle, signOut, getCurrentUser, checkSubscription } from '../lib/firebase-sdk.js';

// DOM 요소
const elements = {
    // 인증 관련
    authSection: document.getElementById('auth-section'),
    authStatus: document.getElementById('auth-status'),
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
    loginButton: document.getElementById('login-button'),
    logoutButton: document.getElementById('logout-button'),
    currentPlan: document.getElementById('current-plan'),

    // 상태 표시
    status: document.getElementById('status'),

    // 자막 제어
    toggleButton: document.getElementById('toggleButton'),
    
    // 구독 정보
    subscriptionInfo: document.getElementById('subscription-info'),
    whisperUsage: document.getElementById('whisper-usage'),
    whisperProgress: document.getElementById('whisper-progress'),
    translationUsage: document.getElementById('translation-usage'),
    translationProgress: document.getElementById('translation-progress'),
    upgradeButton: document.getElementById('upgrade-button')
};

// 상태 관리
let state = {
    isAuthenticated: false,
    user: null,
    subtitleEnabled: false,
    plan: 'free',
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

// 초기화 함수
async function initialize() {
    try {
        // 상태 메시지 업데이트
        updateStatus('초기화 중...', 'info');
        
        // 백그라운드 스크립트에 초기화 메시지 전송
        const response = await chrome.runtime.sendMessage({ action: 'initialize' });
        
        if (response && response.success) {
            // 인증 상태 확인
            const authResponse = await chrome.runtime.sendMessage({ action: 'checkAuth' });
            
            if (authResponse && authResponse.isLoggedIn && authResponse.user) {
                state.isAuthenticated = true;
                state.user = authResponse.user;
                
                // 구독 상태 확인
                const subscriptionResponse = await chrome.runtime.sendMessage({ 
                    action: 'checkSubscription',
                    email: state.user.email
                });
                
                if (subscriptionResponse && subscriptionResponse.success) {
                    state.plan = subscriptionResponse.subscription || 'free';
                }
                
                // 사용량 정보 가져오기
                const usageData = await chrome.storage.local.get('usage');
                if (usageData.usage) {
                    state.usage = usageData.usage;
                }
            }
        }
        
        // UI 업데이트
        updateAuthUI();
        updateUsageUI();
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        updateStatus('준비 완료', 'success');
    } catch (error) {
        console.error('초기화 오류:', error);
        updateStatus('초기화 실패: ' + error.message, 'error');
    }
}

// 인증 UI 업데이트
function updateAuthUI() {
    if (state.isAuthenticated && state.user) {
        elements.authStatus.style.display = 'none';
        elements.userInfo.style.display = 'flex';
        elements.userName.textContent = state.user.name || state.user.email;
        
        // 프로필 이미지 설정
        if (state.user.photoURL) {
            elements.userAvatar.src = state.user.photoURL;
        } else {
            elements.userAvatar.src = '../assets/default-avatar.svg';
        }
        
        // 구독 정보 표시
        elements.currentPlan.textContent = state.plan === 'premium' ? '프리미엄' : '무료';
        if (state.plan === 'premium') {
            elements.currentPlan.classList.add('premium');
        } else {
            elements.currentPlan.classList.remove('premium');
        }
        
        // 구독 정보 섹션 표시
        elements.subscriptionInfo.style.display = 'block';
    } else {
        elements.authStatus.style.display = 'flex';
        elements.userInfo.style.display = 'none';
        elements.subscriptionInfo.style.display = 'none';
    }
}

// 사용량 UI 업데이트
function updateUsageUI() {
    // Whisper 사용량
    const whisperPercentage = Math.min(100, (state.usage.whisper.used / state.usage.whisper.limit) * 100);
    elements.whisperProgress.style.width = `${whisperPercentage}%`;
    elements.whisperUsage.textContent = `${state.usage.whisper.used}/${state.usage.whisper.limit}분`;
    
    // 번역 사용량
    const translationPercentage = Math.min(100, (state.usage.translation.used / state.usage.translation.limit) * 100);
    elements.translationProgress.style.width = `${translationPercentage}%`;
    elements.translationUsage.textContent = `${state.usage.translation.used}/${state.usage.translation.limit}자`;
    
    // 무료 계정인 경우 업그레이드 버튼 표시
    if (state.plan === 'free') {
        elements.upgradeButton.style.display = 'block';
    } else {
        elements.upgradeButton.style.display = 'none';
    }
}

// 토글 버튼 상태 업데이트
function updateToggleButton() {
    elements.toggleButton.textContent = state.subtitleEnabled ? '자막 중지' : '자막 시작';
    elements.toggleButton.classList.toggle('active', state.subtitleEnabled);
}

// 상태 메시지 업데이트
function updateStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = `status-message ${type}`;
    
    // 3초 후 메시지 숨김
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            elements.status.className = 'status-message hidden';
        }, 3000);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 버튼
    elements.loginButton?.addEventListener('click', handleLogin);
    
    // 로그아웃 버튼
    elements.logoutButton?.addEventListener('click', handleLogout);
    
    // 자막 토글 버튼
    elements.toggleButton?.addEventListener('click', toggleSubtitles);
    
    // 업그레이드 버튼
    elements.upgradeButton?.addEventListener('click', () => {
        // 프리미엄 구독 페이지 열기 (도메인 접근 문제로 대체 URL 사용)
        chrome.tabs.create({ url: 'https://whatsub-extension.web.app/premium' });
    });
}

// 로그인 처리
async function handleLogin() {
    try {
        updateStatus('로그인 중...', 'info');
        
        // Chrome Identity API를 사용하여 Google 인증
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
            if (chrome.runtime.lastError) {
                updateStatus('로그인 실패: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            // Google 사용자 정보 가져오기
            try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (!userInfoResponse.ok) {
                    throw new Error(`Google API 오류: ${userInfoResponse.status}`);
                }
                
                const googleUser = await userInfoResponse.json();
                
                if (!googleUser || !googleUser.email) {
                    throw new Error('Google에서 사용자 정보를 가져올 수 없습니다.');
                }
                
                // 사용자 데이터 구성
                const userData = {
                    uid: googleUser.sub || googleUser.id,
                    email: googleUser.email,
                    name: googleUser.name,
                    photoURL: googleUser.picture,
                    Email: googleUser.email,  // Airtable API 호환을 위해 추가
                    Name: googleUser.name     // Airtable API 호환을 위해 추가
                };
                
                // 백그라운드 스크립트에 로그인 사용자 정보 전송
                const response = await chrome.runtime.sendMessage({
                    action: 'userLoggedIn',
                    user: userData
                });
                
                if (response && response.success) {
                    state.isAuthenticated = true;
                    state.user = userData;
                    
                    // 구독 상태 확인
                    const subscriptionResponse = await chrome.runtime.sendMessage({ 
                        action: 'checkSubscription',
                        email: userData.email
                    });
                    
                    if (subscriptionResponse && subscriptionResponse.success) {
                        state.plan = subscriptionResponse.subscription || 'free';
                    }
                    
                    // 사용량 정보 가져오기
                    const usageData = await chrome.storage.local.get('usage');
                    if (usageData.usage) {
                        state.usage = usageData.usage;
                    }
                    
                    updateAuthUI();
                    updateUsageUI();
                    updateStatus('로그인 성공', 'success');
                } else {
                    throw new Error(response.error || '로그인에 실패했습니다.');
                }
            } catch (error) {
                console.error('Google 로그인 오류:', error);
                updateStatus('로그인 실패: ' + error.message, 'error');
            }
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        updateStatus('로그인 실패: ' + error.message, 'error');
    }
}

// 로그아웃 처리
async function handleLogout() {
    try {
        updateStatus('로그아웃 중...', 'info');
        
        // Chrome Identity API 토큰 제거
        chrome.identity.clearAllCachedAuthTokens(() => {
            if (chrome.runtime.lastError) {
                console.warn('토큰 제거 오류:', chrome.runtime.lastError.message);
            }
        });
        
        // 백그라운드 스크립트에 로그아웃 메시지 전송
        const response = await chrome.runtime.sendMessage({ action: 'userLoggedOut' });
        
        if (response && response.success) {
            state.isAuthenticated = false;
            state.user = null;
            state.plan = 'free';
            state.usage = {
                whisper: { used: 0, limit: 60 },
                translation: { used: 0, limit: 5000 }
            };
            
            updateAuthUI();
            updateStatus('로그아웃 성공', 'success');
        } else {
            throw new Error(response.error || '로그아웃에 실패했습니다.');
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        updateStatus('로그아웃 실패: ' + error.message, 'error');
    }
}

// 자막 토글
async function toggleSubtitles() {
    try {
        state.subtitleEnabled = !state.subtitleEnabled;
        updateToggleButton();
        
        if (state.subtitleEnabled) {
            updateStatus('자막을 활성화하는 중...', 'info');
            // 여기에 자막 활성화 로직 구현
            updateStatus('자막이 활성화되었습니다.', 'success');
        } else {
            updateStatus('자막을 비활성화하는 중...', 'info');
            // 여기에 자막 비활성화 로직 구현
            updateStatus('자막이 비활성화되었습니다.', 'success');
        }
    } catch (error) {
        console.error('자막 토글 오류:', error);
        updateStatus('자막 설정 실패: ' + error.message, 'error');
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initialize); 