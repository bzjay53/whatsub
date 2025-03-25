/**
 * Whatsub 확장 프로그램 백그라운드 스크립트
 * 
 * 주요 기능:
 * 1. 인증 관리 (로그인/로그아웃)
 * 2. 오디오 캡처 및 처리
 * 3. 자막 처리 및 번역
 * 4. 사용량 추적
 */

// 디버그: 확장 프로그램 ID와 리디렉션 URI 로깅
console.log('[Whatsub] 확장 프로그램 ID:', chrome.runtime.id);
console.log('[Whatsub] OAuth 리디렉션 URI:', chrome.identity.getRedirectURL());
console.log('[Whatsub] OAuth 리디렉션 URI (oauth2 접미사 포함):', chrome.identity.getRedirectURL('oauth2'));
console.log('[Whatsub] OAuth 클라이언트 ID:', chrome.runtime.getManifest().oauth2.client_id);

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