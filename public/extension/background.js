// 확장 프로그램이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 초기 설정
        chrome.storage.local.set({
            subtitleEnabled: false,
            syncValue: 0,
            settings: {
                fontSize: '16px',
                fontColor: '#FFFFFF',
                backgroundColor: '#000000',
                opacity: 0.8
            }
        });
    }
});

// 탭이 업데이트될 때 content script 재주입 여부 확인
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.match(/^https?:\/\//)) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(err => console.error('Content script injection failed:', err));
    }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSettings') {
        chrome.storage.local.get('settings', (data) => {
            sendResponse(data.settings);
        });
        return true; // 비동기 응답을 위해 true 반환
    }
}); 