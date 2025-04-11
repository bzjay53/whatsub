/**
 * @file SubtitleDisplay.js
 * @description 자막 표시를 담당하는 컴포넌트 클래스
 * 
 * @dependencies 없음
 * 
 * @usage
 * ```js
 * const subtitleDisplay = new SubtitleDisplay();
 * subtitleDisplay.initialize();
 * subtitleDisplay.showSubtitle("원본 텍스트", "번역된 텍스트");
 * ```
 */

/**
 * 자막 표시를 담당하는 클래스
 * 화면에 원본 텍스트와 번역 텍스트를 표시합니다.
 */
class SubtitleDisplay {
    /**
     * SubtitleDisplay 생성자
     * 자막 표시에 필요한 기본 상태를 초기화합니다.
     */
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
        this.dragging = false;
        this.offset = { x: 0, y: 0 };
    }

    /**
     * 자막 UI 초기화
     * 자막을 표시할 컨테이너와 텍스트 요소를 생성합니다.
     * 
     * @returns {boolean} 초기화 성공 여부
     */
    initialize() {
        if (this.container) return;

        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'whatsub-container';
        this.container.style.position = 'fixed';
        this.container.style.zIndex = '9999';
        this.container.style.width = '80%';
        this.container.style.left = '10%';
        this.container.style.maxWidth = '1200px';
        this.container.style.textAlign = 'center';
        this.container.style.display = 'none';
        this.container.style.transition = 'all 0.3s ease-in-out';

        // 원본 자막
        this.originalText = document.createElement('div');
        this.originalText.className = 'subtitle-text original';
        this.originalText.style.transition = 'all 0.2s ease-in-out';
        this.originalText.style.minHeight = '1.5em';
        this.container.appendChild(this.originalText);

        // 번역된 자막
        this.translatedText = document.createElement('div');
        this.translatedText.className = 'subtitle-text translated';
        this.translatedText.style.transition = 'all 0.2s ease-in-out';
        this.translatedText.style.minHeight = '1.5em';
        this.container.appendChild(this.translatedText);

        // 기본 스타일 적용
        this.applyStyles();

        // 드래그 기능 초기화
        this.setupDraggable();

        document.body.appendChild(this.container);

        console.log('[Whatsub] 자막 UI가 초기화되었습니다.');
        return true;
    }

    /**
     * 자막 표시
     * 원본 텍스트와 번역 텍스트를 화면에 표시합니다.
     * 
     * @param {string} original - 원본 자막 텍스트
     * @param {string} translation - 번역된 자막 텍스트
     */
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

    /**
     * 자막 숨기기
     * 자막 컨테이너를 화면에서 숨깁니다.
     */
    setVisibility(visible) {
        if (!this.container) this.initialize();
        this.isVisible = visible;
        
        if (visible) {
            this.container.style.opacity = '0';
            this.container.style.display = 'block';
            
            setTimeout(() => {
                this.container.style.opacity = '1';
            }, 10);
        } else {
            this.container.style.opacity = '0';
            
            setTimeout(() => {
                if (!this.isVisible) {
                    this.container.style.display = 'none';
                }
            }, 300);
        }
    }

    /**
     * 자막 스타일 업데이트
     * 설정에 따라 자막의 위치, 폰트 크기, 배경 색상 등을 업데이트합니다.
     */
    applyStyles() {
        const baseStyles = {
            padding: '10px',
            margin: '5px',
            borderRadius: '5px',
            textShadow: '2px 2px 2px rgba(0, 0, 0, 0.8)',
            fontSize: this.settings.fontSize,
            color: this.settings.fontColor,
            backgroundColor: this.settings.backgroundColor,
            transition: 'all 0.2s ease-in-out',
            minWidth: '300px',
            boxSizing: 'border-box',
            wordWrap: 'break-word'
        };

        Object.assign(this.originalText.style, baseStyles);
        Object.assign(this.translatedText.style, baseStyles);

        // 위치 설정
        switch (this.settings.position) {
            case 'top':
                this.container.style.top = '10%';
                this.container.style.bottom = 'auto';
                this.container.style.transform = 'none';
                break;
            case 'middle':
                this.container.style.top = '50%';
                this.container.style.bottom = 'auto';
                this.container.style.transform = 'translateY(-50%)';
                break;
            case 'bottom':
            default:
                this.container.style.bottom = '10%';
                this.container.style.top = 'auto';
                this.container.style.transform = 'none';
                break;
        }
    }

    /**
     * 설정 업데이트
     * 자막 표시 설정을 업데이트하고 스타일을 적용합니다.
     * 
     * @param {Object} newSettings - 업데이트할 설정 객체
     * @param {string} [newSettings.position] - 자막 위치 ('top' 또는 'bottom')
     * @param {string} [newSettings.fontSize] - 자막 글꼴 크기 ('small', 'medium', 'large')
     * @param {string} [newSettings.backgroundColor] - 자막 배경 색상
     * @param {boolean} [newSettings.showTranslation] - 번역된 자막 표시 여부
     * @returns {boolean} 업데이트 성공 여부
     */
    applySettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applyStyles();
        return true;
    }

    /**
     * 드래그 기능 설정
     * 자막 컨테이너를 드래그하여 위치를 조정할 수 있게 합니다.
     */
    setupDraggable() {
        if (!this.container) return;

        this.container.style.cursor = 'move';

        // 마우스 다운 이벤트
        this.container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.dragging = true;
            this.offset.x = e.clientX - this.container.getBoundingClientRect().left;
            this.offset.y = e.clientY - this.container.getBoundingClientRect().top;
        });

        // 마우스 무브 이벤트
        document.addEventListener('mousemove', (e) => {
            if (!this.dragging) return;
            e.preventDefault();

            const x = e.clientX - this.offset.x;
            const y = e.clientY - this.offset.y;

            this.container.style.left = `${x}px`;
            this.container.style.top = `${y}px`;
            this.container.style.bottom = 'auto';
        });

        // 마우스 업 이벤트
        document.addEventListener('mouseup', () => {
            this.dragging = false;
        });
    }

    /**
     * 위치 초기화
     * 자막 컨테이너의 위치를 초기 설정으로 되돌립니다.
     */
    resetPosition() {
        if (!this.container) return;

        this.container.style.left = '10%';
        this.container.style.right = 'auto';
        
        // 설정된 위치에 따라 초기화
        if (this.settings.position === 'top') {
            this.container.style.top = '10%';
            this.container.style.bottom = 'auto';
        } else {
            this.container.style.top = 'auto';
            this.container.style.bottom = '10%';
        }
    }

    /**
     * 자막 컨테이너 제거
     * 자막 UI를 완전히 제거합니다.
     */
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