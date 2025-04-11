// 기본 설정값
const defaultSettings = {
    subtitle: {
        fontSize: 16,
        fontColor: '#ffffff',
        backgroundColor: '#000000',
        backgroundOpacity: 70
    },
    translation: {
        autoTranslate: false,
        targetLanguage: 'ko'
    },
    recognition: {
        mode: 'online',
        language: 'auto'
    }
};

// DOM 요소
const elements = {
    fontsize: document.getElementById('fontsize'),
    fontsizeValue: document.getElementById('fontsize-value'),
    fontColor: document.getElementById('font-color'),
    backgroundColor: document.getElementById('background-color'),
    backgroundOpacity: document.getElementById('background-opacity'),
    opacityValue: document.getElementById('opacity-value'),
    autoTranslate: document.getElementById('auto-translate'),
    targetLanguage: document.getElementById('target-language'),
    recognitionMode: document.getElementById('recognition-mode'),
    recognitionLanguage: document.getElementById('recognition-language'),
    saveButton: document.getElementById('save-settings'),
    resetButton: document.getElementById('reset-settings')
};

// 설정 로드
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        const settings = result.settings || defaultSettings;
        
        // UI 업데이트
        elements.fontsize.value = settings.subtitle.fontSize;
        elements.fontsizeValue.textContent = `${settings.subtitle.fontSize}px`;
        elements.fontColor.value = settings.subtitle.fontColor;
        elements.backgroundColor.value = settings.subtitle.backgroundColor;
        elements.backgroundOpacity.value = settings.subtitle.backgroundOpacity;
        elements.opacityValue.textContent = `${settings.subtitle.backgroundOpacity}%`;
        elements.autoTranslate.checked = settings.translation.autoTranslate;
        elements.targetLanguage.value = settings.translation.targetLanguage;
        elements.recognitionMode.value = settings.recognition.mode;
        elements.recognitionLanguage.value = settings.recognition.language;
    } catch (error) {
        console.error('설정 로드 중 오류 발생:', error);
    }
}

// 설정 저장
async function saveSettings() {
    try {
        const settings = {
            subtitle: {
                fontSize: parseInt(elements.fontsize.value),
                fontColor: elements.fontColor.value,
                backgroundColor: elements.backgroundColor.value,
                backgroundOpacity: parseInt(elements.backgroundOpacity.value)
            },
            translation: {
                autoTranslate: elements.autoTranslate.checked,
                targetLanguage: elements.targetLanguage.value
            },
            recognition: {
                mode: elements.recognitionMode.value,
                language: elements.recognitionLanguage.value
            }
        };

        await chrome.storage.sync.set({ settings });
        showSaveMessage('설정이 저장되었습니다.');
    } catch (error) {
        console.error('설정 저장 중 오류 발생:', error);
        showSaveMessage('설정 저장 중 오류가 발생했습니다.', true);
    }
}

// 설정 초기화
async function resetSettings() {
    try {
        await chrome.storage.sync.set({ settings: defaultSettings });
        loadSettings();
        showSaveMessage('설정이 초기화되었습니다.');
    } catch (error) {
        console.error('설정 초기화 중 오류 발생:', error);
        showSaveMessage('설정 초기화 중 오류가 발생했습니다.', true);
    }
}

// 저장 메시지 표시
function showSaveMessage(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.padding = '10px 20px';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.backgroundColor = isError ? '#FEE2E2' : '#ECFDF5';
    messageDiv.style.color = isError ? '#991B1B' : '#065F46';
    messageDiv.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// 이벤트 리스너
elements.fontsize.addEventListener('input', () => {
    elements.fontsizeValue.textContent = `${elements.fontsize.value}px`;
});

elements.backgroundOpacity.addEventListener('input', () => {
    elements.opacityValue.textContent = `${elements.backgroundOpacity.value}%`;
});

elements.saveButton.addEventListener('click', saveSettings);
elements.resetButton.addEventListener('click', resetSettings);

// 초기 설정 로드
document.addEventListener('DOMContentLoaded', loadSettings); 