// 자막 표시 컴포넌트
class SubtitleDisplay {
    constructor() {
        this.container = null;
        this.originalText = null;
        this.translatedText = null;
        this.isVisible = false;
        this.settings = {
            fontSize: '24px',
            fontColor: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            position: 'bottom',
            showTranslation: true
        };
    }

    initialize() {
        if (this.container) return;

        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'whatsub-container';
        this.container.style.position = 'fixed';
        this.container.style.zIndex = '9999';
        this.container.style.width = '100%';
        this.container.style.textAlign = 'center';
        this.container.style.display = 'none';

        // 원본 자막
        this.originalText = document.createElement('div');
        this.originalText.className = 'subtitle-text original';
        this.container.appendChild(this.originalText);

        // 번역된 자막
        this.translatedText = document.createElement('div');
        this.translatedText.className = 'subtitle-text translated';
        this.container.appendChild(this.translatedText);

        // 기본 스타일 적용
        this.applyStyles();

        document.body.appendChild(this.container);
    }

    applyStyles() {
        const baseStyles = {
            padding: '10px',
            margin: '5px',
            borderRadius: '5px',
            textShadow: '2px 2px 2px rgba(0, 0, 0, 0.8)',
            fontSize: this.settings.fontSize,
            color: this.settings.fontColor,
            backgroundColor: this.settings.backgroundColor
        };

        Object.assign(this.originalText.style, baseStyles);
        Object.assign(this.translatedText.style, baseStyles);

        // 위치 설정
        switch (this.settings.position) {
            case 'top':
                this.container.style.top = '10%';
                break;
            case 'middle':
                this.container.style.top = '50%';
                this.container.style.transform = 'translateY(-50%)';
                break;
            case 'bottom':
            default:
                this.container.style.bottom = '10%';
                break;
        }
    }

    updateSubtitle(original, translation = '') {
        if (!this.container) this.initialize();

        if (original) {
            this.originalText.textContent = original;
            this.originalText.style.display = 'block';
        } else {
            this.originalText.style.display = 'none';
        }

        if (translation && this.settings.showTranslation) {
            this.translatedText.textContent = translation;
            this.translatedText.style.display = 'block';
        } else {
            this.translatedText.style.display = 'none';
        }
    }

    setVisibility(visible) {
        if (!this.container) this.initialize();
        this.isVisible = visible;
        this.container.style.display = visible ? 'block' : 'none';
    }

    applySettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applyStyles();
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.originalText = null;
        this.translatedText = null;
    }
}

// 전역 객체에 등록
window.subtitleDisplay = new SubtitleDisplay(); 