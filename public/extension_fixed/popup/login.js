import { signInWithGoogle, signOut, getCurrentUser, checkSubscription } from '../lib/firebase-sdk.js';
import { SUBSCRIPTION_PLANS } from '../lib/airtable-config.js';

// DOM 요소
const loginBox = document.getElementById('loginBox');
const userInfoBox = document.getElementById('userInfoBox');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const checkSubscriptionBtn = document.getElementById('checkSubscriptionBtn');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const subscriptionStatusBadge = document.getElementById('subscriptionStatusBadge');
const whisperUsageBar = document.getElementById('whisperUsageBar');
const whisperUsageText = document.getElementById('whisperUsageText');
const translationUsageBar = document.getElementById('translationUsageBar');
const translationUsageText = document.getElementById('translationUsageText');

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
    // 현재 로그인된 사용자 확인
    const user = getCurrentUser();

    if (user) {
        // 사용자가 로그인되어 있으면 사용자 정보 표시
        displayUserInfo(user);
        
        // 구독 정보 로드
        await loadSubscriptionInfo(user.email);
    } else {
        // 로그인 폼 표시
        showLoginForm();
    }
    
    // 이벤트 리스너 설정
    setupEventListeners();
});

// 사용자 정보 표시
function displayUserInfo(user) {
    // 사용자 정보 업데이트
    userPhoto.src = user.photoURL || '../icons/default-avatar.png';
    userName.textContent = user.name || '이름 없음';
    userEmail.textContent = user.email || '';
    
    // UI 전환
    loginBox.classList.add('hide');
    userInfoBox.classList.remove('hide');
}

// 로그인 폼 표시
function showLoginForm() {
    loginBox.classList.remove('hide');
    userInfoBox.classList.add('hide');
}

// 구독 정보 로드
async function loadSubscriptionInfo(email) {
    try {
        const subscription = await checkSubscription(email);
        
        // 구독 타입에 따라 배지 업데이트
        if (subscription.subscriptionType === 'premium' && subscription.isActive) {
            subscriptionStatusBadge.textContent = '프리미엄';
            subscriptionStatusBadge.className = 'status-badge premium';
        } else {
            subscriptionStatusBadge.textContent = '무료';
            subscriptionStatusBadge.className = 'status-badge free';
        }
        
        // Whisper 사용량 표시
        const whisperUsage = subscription.usage.whisper;
        const whisperPercentage = (whisperUsage.used / whisperUsage.limit) * 100;
        whisperUsageBar.style.width = `${Math.min(100, whisperPercentage)}%`;
        whisperUsageText.textContent = `${whisperUsage.used}/${whisperUsage.limit}분`;
        
        // 번역 사용량 표시
        const translationUsage = subscription.usage.translation;
        const translationPercentage = (translationUsage.used / translationUsage.limit) * 100;
        translationUsageBar.style.width = `${Math.min(100, translationPercentage)}%`;
        translationUsageText.textContent = `${translationUsage.used.toLocaleString()}/${translationUsage.limit.toLocaleString()}자`;
        
        // 사용량이 많으면 경고 스타일 적용
        if (whisperPercentage > 90) {
            whisperUsageBar.classList.add('warning');
        } else {
            whisperUsageBar.classList.remove('warning');
        }
        
        if (translationPercentage > 90) {
            translationUsageBar.classList.add('warning');
        } else {
            translationUsageBar.classList.remove('warning');
        }
        
        return subscription;
    } catch (error) {
        console.error('구독 정보 로드 오류:', error);
        showNotification('구독 정보를 로드하는 중 오류가 발생했습니다.', 'error');
        return null;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // Google 로그인 버튼
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
    
    // 로그아웃 버튼
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut();
            showLoginForm();
            showNotification('로그아웃 되었습니다.', 'success');
        } catch (error) {
            console.error('로그아웃 오류:', error);
            showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
        }
    });
    
    // 구독 상태 확인 버튼
    checkSubscriptionBtn.addEventListener('click', async () => {
        const user = getCurrentUser();
        if (user) {
            showNotification('구독 정보를 확인 중...', 'info');
            await loadSubscriptionInfo(user.email);
            showNotification('구독 정보가 업데이트 되었습니다.', 'success');
        } else {
            showNotification('로그인이 필요합니다.', 'error');
        }
    });
}

// 알림 표시
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 페이지에 추가
    document.body.appendChild(notification);
    
    // 일정 시간 후 자동 제거
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Google 로그인 처리
async function handleGoogleLogin() {
    try {
        const messageElement = document.getElementById('message');
        
        // Chrome Identity API를 사용하여 Google 인증 토큰 가져오기
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
            if (chrome.runtime.lastError) {
                showMessage('로그인 오류: ' + chrome.runtime.lastError.message, false);
                return;
            }
            
            try {
                // Google API로 사용자 정보 가져오기
                const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (!response.ok) {
                    throw new Error('Google 사용자 정보를 가져올 수 없습니다.');
                }
                
                const userInfo = await response.json();
                
                // 사용자 정보 구성
                const userData = {
                    email: userInfo.email,
                    displayName: userInfo.name,
                    photoURL: userInfo.picture,
                    uid: userInfo.sub
                };
                
                // 로컬 스토리지에 사용자 정보 저장
                await chrome.storage.local.set({
                    user: userData,
                    authToken: token
                });
                
                // 배경 스크립트에 로그인 알림
                chrome.runtime.sendMessage({
                    action: 'userLoggedIn',
                    user: userData
                });
                
                // 성공 메시지 표시
                showMessage('로그인 성공! 잠시 후 창이 닫힙니다.', true);
                
                // 로그인 성공 후 팝업 창 닫기 (0.5초 후)
                setTimeout(() => {
                    window.close();
                }, 1500);
                
            } catch (error) {
                showMessage('로그인 오류: ' + error.message, false);
            }
        });
    } catch (error) {
        showMessage('로그인 오류: ' + error.message, false);
    }
}

// 사용자 로그인 상태 확인
async function checkAuthStatus() {
    try {
        const data = await chrome.storage.local.get(['user', 'authToken']);
        
        if (data.user && data.authToken) {
            // 이미 로그인되어 있으면 메인 팝업으로 리다이렉트
            showMessage('이미 로그인되어 있습니다. 메인 화면으로 이동합니다.', true);
            
            // 잠시 후 창 닫기
            setTimeout(() => {
                window.close();
            }, 1500);
        }
    } catch (error) {
        console.error('인증 상태 확인 오류:', error);
    }
}

// 메시지 표시 함수
function showMessage(message, isSuccess) {
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = isSuccess ? 'success' : '';
    }
} 