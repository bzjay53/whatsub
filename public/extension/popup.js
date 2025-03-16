document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleSubtitle');
    const syncAdjust = document.getElementById('syncAdjust');
    const settingsButton = document.getElementById('openSettings');

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