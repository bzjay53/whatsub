document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleSubtitle');
    const syncAdjust = document.getElementById('syncAdjust');
    const settingsButton = document.getElementById('openSettings');
    const signupButton = document.getElementById('signupButton');
    const loginButton = document.getElementById('loginButton');
    const helpButton = document.getElementById('helpButton');
    const termsButton = document.getElementById('termsButton');
    const pricingButton = document.getElementById('pricingButton');

    // 자막 켜기/끄기 버튼 이벤트
    toggleButton.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'toggleSubtitle' });
    });

    // 자막 싱크 조절 이벤트
    syncAdjust.addEventListener('input', async (e) => {
        const syncValue = parseInt(e.target.value);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { 
            action: 'adjustSync',
            value: syncValue
        });
    });

    // 설정 버튼 이벤트
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 외부 페이지 열기 함수
    function openExternalPage(url) {
        chrome.tabs.create({ url: url });
    }

    // 회원가입 버튼 이벤트
    if (signupButton) {
        signupButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/signup/');
        });
    }

    // 로그인 버튼 이벤트
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/login/');
        });
    }

    // 도움말 버튼 이벤트
    if (helpButton) {
        helpButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/help/');
        });
    }

    // 이용약관 버튼 이벤트
    if (termsButton) {
        termsButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/terms/');
        });
    }

    // 요금제 버튼 이벤트
    if (pricingButton) {
        pricingButton.addEventListener('click', () => {
            openExternalPage('https://whatsub.netlify.app/pricing/');
        });
    }

    // 현재 상태 로드
    chrome.storage.local.get(['subtitleEnabled', 'syncValue'], (result) => {
        if (result.subtitleEnabled) {
            toggleButton.textContent = '자막 끄기';
        }
        if (result.syncValue !== undefined) {
            syncAdjust.value = result.syncValue;
        }
    });
}); 