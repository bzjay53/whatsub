// DOM 요소
const elements = {
    // 인증 관련
    authSection: document.getElementById('auth-section'),
    authStatus: document.getElementById('auth-status'),
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
    loginButton: document.getElementById('login-button'),
    signupButton: document.getElementById('signup-button'),
    logoutButton: document.getElementById('logout-button'),

    // 상태 표시
    status: document.getElementById('status'),

    // 자막 제어
    toggleButton: document.getElementById('toggle-button'),
    
    // Whisper AI
    whisperToggle: document.getElementById('whisper-toggle'),
    whisperUsage: document.getElementById('whisper-usage'),
    
    // 자막 파일 관리
    uploadButton: document.getElementById('upload-button'),
    downloadButton: document.getElementById('download-button'),
    saveButton: document.getElementById('save-button'),
    shareButton: document.getElementById('share-button'),
    
    // 번역 설정
    translationToggle: document.getElementById('translation-toggle'),
    sourceLanguage: document.getElementById('source-language'),
    targetLanguage: document.getElementById('target-language'),
    translationUsage: document.getElementById('translation-usage'),
    translationProgress: document.getElementById('translation-progress'),
    
    // 자막 설정
    syncAdjust: document.getElementById('sync-adjust'),
    syncValue: document.getElementById('sync-value'),
    fontSize: document.getElementById('font-size'),
    fontSizeValue: document.getElementById('font-size-value'),
    opacity: document.getElementById('opacity'),
    opacityValue: document.getElementById('opacity-value'),
    textColor: document.getElementById('text-color'),
    bgColor: document.getElementById('bg-color'),
    
    // 구독 정보
    currentPlan: document.getElementById('current-plan'),
    upgradeButton: document.getElementById('upgrade-button')
};

// 상태 관리
let state = {
    isInitialized: false,
    isAuthenticated: false,
    user: null,
    subtitleEnabled: false,
    whisperEnabled: false,
    translationEnabled: false,
    settings: {
        syncValue: 0,
        fontSize: '20px',
        opacity: 0.8,
        textColor: '#FFFFFF',
        bgColor: '#000000',
        sourceLanguage: 'ko',
        targetLanguage: 'en'
    },
    usage: {
        whisper: {
            used: 0,
            limit: 100
        },
        translation: {
            used: 0,
            limit: 100
        }
    },
    plan: 'free'
};

// 초기화 함수
async function initialize() {
    try {
        // 상태 표시 업데이트
        updateStatus('초기화 중...', 'info');
        
        // 인증 상태 확인
        const authResponse = await chrome.runtime.sendMessage({ action: 'checkAuth' });
        state.isAuthenticated = authResponse.isAuthenticated;
        state.user = authResponse.user;
        state.plan = authResponse.plan || 'free';
        
        // UI 업데이트
        updateAuthUI();
        
        // 설정 로드
        await loadSettings();
        
        // 상태 로드
        const statusResponse = await chrome.runtime.sendMessage({ action: 'getStatus' });
        state.subtitleEnabled = statusResponse.enabled;
        updateToggleButton();
        
        // 사용량 정보 로드
        await loadUsageInfo();
        
        state.isInitialized = true;
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
        elements.userInfo.style.display = 'block';
        elements.userName.textContent = state.user.name;
        elements.currentPlan.textContent = state.plan;
    } else {
        elements.authStatus.style.display = 'block';
        elements.userInfo.style.display = 'none';
    }
}

// 설정 로드
async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get([
            'syncValue',
            'fontSize',
            'opacity',
            'textColor',
            'bgColor',
            'sourceLanguage',
            'targetLanguage',
            'whisperEnabled',
            'translationEnabled'
        ]);
        
        // 설정 적용
        state.settings = { ...state.settings, ...settings };
        state.whisperEnabled = settings.whisperEnabled || false;
        state.translationEnabled = settings.translationEnabled || false;
        
        // UI 업데이트
        updateSettingsUI();
    } catch (error) {
        console.error('설정 로드 오류:', error);
        updateStatus('설정을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 설정 UI 업데이트
function updateSettingsUI() {
    // 자막 설정
    elements.syncAdjust.value = state.settings.syncValue;
    elements.syncValue.textContent = `${state.settings.syncValue}초`;
    
    elements.fontSize.value = parseInt(state.settings.fontSize);
    elements.fontSizeValue.textContent = state.settings.fontSize;
    
    elements.opacity.value = state.settings.opacity;
    elements.opacityValue.textContent = state.settings.opacity;
    
    elements.textColor.value = state.settings.textColor;
    elements.bgColor.value = state.settings.bgColor;
    
    // 번역 설정
    elements.sourceLanguage.value = state.settings.sourceLanguage;
    elements.targetLanguage.value = state.settings.targetLanguage;
    elements.translationToggle.checked = state.translationEnabled;
    
    // Whisper 설정
    elements.whisperToggle.checked = state.whisperEnabled;
}

// 사용량 정보 로드
async function loadUsageInfo() {
    try {
        const usage = await chrome.runtime.sendMessage({ action: 'getUsage' });
        
        // Whisper 사용량
        elements.whisperUsage.textContent = `${usage.whisperMinutes}/60`;
        
        // 번역 사용량
        elements.translationUsage.textContent = `${usage.translationChars}/5,000`;
        elements.translationProgress.style.width = `${(usage.translationChars / 5000) * 100}%`;
    } catch (error) {
        console.error('사용량 정보 로드 오류:', error);
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
}

// 설정 저장
async function saveSettings(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
        state.settings[key] = value;
        
        // 컨텐츠 스크립트에 설정 변경 알림
        await chrome.runtime.sendMessage({
            action: 'updateSettings',
            settings: { [key]: value }
        });
    } catch (error) {
        console.error('설정 저장 오류:', error);
        updateStatus('설정을 저장하는 중 오류가 발생했습니다.', 'error');
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 인증 관련
    elements.loginButton?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openLoginPage' });
    });
    
    elements.signupButton?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSignupPage' });
    });
    
    elements.logoutButton?.addEventListener('click', async () => {
        try {
            await chrome.runtime.sendMessage({ action: 'logout' });
            state.isAuthenticated = false;
            state.user = null;
            updateAuthUI();
            updateStatus('로그아웃되었습니다.', 'info');
        } catch (error) {
            updateStatus('로그아웃 중 오류가 발생했습니다.', 'error');
        }
    });

    // 자막 토글
    elements.toggleButton?.addEventListener('click', async () => {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'toggleSubtitles' });
            state.subtitleEnabled = response.state.subtitleEnabled;
            updateToggleButton();
        } catch (error) {
            updateStatus('자막 토글 중 오류가 발생했습니다.', 'error');
        }
    });

    // Whisper 토글
    elements.whisperToggle?.addEventListener('change', async () => {
        try {
            state.whisperEnabled = elements.whisperToggle.checked;
            await saveSettings('whisperEnabled', state.whisperEnabled);
            updateStatus(
                state.whisperEnabled ? 'Whisper AI 자막이 활성화되었습니다.' : 'Whisper AI 자막이 비활성화되었습니다.',
                'info'
            );
        } catch (error) {
            updateStatus('Whisper 설정 변경 중 오류가 발생했습니다.', 'error');
        }
    });

    // 번역 토글
    elements.translationToggle?.addEventListener('change', async () => {
        try {
            state.translationEnabled = elements.translationToggle.checked;
            await saveSettings('translationEnabled', state.translationEnabled);
            updateStatus(
                state.translationEnabled ? '듀얼 자막이 활성화되었습니다.' : '듀얼 자막이 비활성화되었습니다.',
                'info'
            );
        } catch (error) {
            updateStatus('번역 설정 변경 중 오류가 발생했습니다.', 'error');
        }
    });

    // 언어 선택
    elements.sourceLanguage?.addEventListener('change', async () => {
        await saveSettings('sourceLanguage', elements.sourceLanguage.value);
    });

    elements.targetLanguage?.addEventListener('change', async () => {
        await saveSettings('targetLanguage', elements.targetLanguage.value);
    });

    // 자막 설정
    elements.syncAdjust?.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        elements.syncValue.textContent = `${value}초`;
    });

    elements.syncAdjust?.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await saveSettings('syncValue', value);
    });

    elements.fontSize?.addEventListener('input', (e) => {
        const value = `${e.target.value}px`;
        elements.fontSizeValue.textContent = value;
    });

    elements.fontSize?.addEventListener('change', async (e) => {
        const value = `${e.target.value}px`;
        await saveSettings('fontSize', value);
    });

    elements.opacity?.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        elements.opacityValue.textContent = value;
    });

    elements.opacity?.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await saveSettings('opacity', value);
    });

    elements.textColor?.addEventListener('change', async (e) => {
        await saveSettings('textColor', e.target.value);
    });

    elements.bgColor?.addEventListener('change', async (e) => {
        await saveSettings('bgColor', e.target.value);
    });

    // 파일 관리
    elements.uploadButton?.addEventListener('click', () => {
        // 파일 업로드 구현
    });

    elements.downloadButton?.addEventListener('click', () => {
        // 파일 다운로드 구현
    });

    elements.saveButton?.addEventListener('click', () => {
        // 자막 저장 구현
    });

    elements.shareButton?.addEventListener('click', () => {
        // 자막 공유 구현
    });

    // 플랜 업그레이드
    elements.upgradeButton?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openUpgradePage' });
    });
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'updateStatus':
            updateStatus(message.status.message, message.status.type);
            break;
            
        case 'updateAuth':
            state.isAuthenticated = message.isAuthenticated;
            state.user = message.user;
            updateAuthUI();
            break;
            
        case 'updateUsage':
            loadUsageInfo();
            break;
    }
});

// 초기화 시작
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initialize();
}); 