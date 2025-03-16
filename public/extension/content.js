// 자막 컨테이너 생성
let subtitleContainer = null;
let subtitleEnabled = false;
let syncValue = 0;

function createSubtitleContainer() {
    if (subtitleContainer) return;

    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'whatsub-container';
    subtitleContainer.style.position = 'fixed';
    subtitleContainer.style.bottom = '10%';
    subtitleContainer.style.left = '50%';
    subtitleContainer.style.transform = 'translateX(-50%)';
    subtitleContainer.style.zIndex = '9999999';
    subtitleContainer.style.textAlign = 'center';
    subtitleContainer.style.display = 'none';

    document.body.appendChild(subtitleContainer);
}

// 자막 표시/숨김 토글
function toggleSubtitle(show = null) {
    if (!subtitleContainer) createSubtitleContainer();
    
    if (show === null) {
        subtitleEnabled = !subtitleEnabled;
    } else {
        subtitleEnabled = show;
    }

    subtitleContainer.style.display = subtitleEnabled ? 'block' : 'none';
    chrome.storage.local.set({ subtitleEnabled });
}

// 자막 싱크 조절
function adjustSync(value) {
    syncValue = value;
    chrome.storage.local.set({ syncValue });
}

// 자막 스타일 업데이트
function updateSubtitleStyle(settings) {
    if (!subtitleContainer) createSubtitleContainer();

    subtitleContainer.style.fontSize = settings.fontSize;
    subtitleContainer.style.color = settings.fontColor;
    subtitleContainer.style.backgroundColor = `${settings.backgroundColor}${Math.round(settings.opacity * 255).toString(16).padStart(2, '0')}`;
    subtitleContainer.style.padding = '8px 16px';
    subtitleContainer.style.borderRadius = '4px';
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'toggleSubtitle':
            toggleSubtitle();
            break;
        case 'adjustSync':
            adjustSync(request.value);
            break;
        case 'updateStyle':
            updateSubtitleStyle(request.settings);
            break;
    }
});

// 초기화
createSubtitleContainer();
chrome.storage.local.get(['subtitleEnabled', 'syncValue', 'settings'], (result) => {
    if (result.subtitleEnabled) {
        toggleSubtitle(true);
    }
    if (result.syncValue !== undefined) {
        syncValue = result.syncValue;
    }
    if (result.settings) {
        updateSubtitleStyle(result.settings);
    }
}); 