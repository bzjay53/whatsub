class SubtitleDisplay {
    constructor() {
        this.container = null;
        this.settings = {
            fontSize: '20px',
            fontColor: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            position: 'bottom'
        };
        this.createContainer();
    }

    createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'whatsub-container';
        this.container.className = 'draggable';
        this.container.style.display = 'none';

        // 원본 자막을 위한 div 생성
        const originalSubtitle = document.createElement('div');
        originalSubtitle.className = 'subtitle-text original-subtitle';
        this.container.appendChild(originalSubtitle);

        // 번역된 자막을 위한 div 생성
        const translatedSubtitle = document.createElement('div');
        translatedSubtitle.className = 'subtitle-text translated-subtitle';
        this.container.appendChild(translatedSubtitle);

        document.body.appendChild(this.container);
        this.setupDraggable();
    }

    setupDraggable() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const dragStart = (e) => {
            if (e.type === "mousedown") {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            } else {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            }
            
            if (e.target === this.container) {
                isDragging = true;
            }
        };

        const dragEnd = () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();

                if (e.type === "mousemove") {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                } else {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                this.setTranslate(currentX, currentY, this.container);
            }
        };

        this.container.addEventListener("mousedown", dragStart, false);
        document.addEventListener("mousemove", drag, false);
        document.addEventListener("mouseup", dragEnd, false);
        this.container.addEventListener("touchstart", dragStart, false);
        document.addEventListener("touchmove", drag, false);
        document.addEventListener("touchend", dragEnd, false);
    }

    setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    setVisibility(visible) {
        if (!this.container) {
            this.createContainer();
        }
        this.container.style.display = visible ? 'block' : 'none';
    }

    updateSubtitle(originalText, translatedText = '') {
        if (!this.container) {
            this.createContainer();
        }

        const originalSubtitle = this.container.querySelector('.original-subtitle');
        const translatedSubtitle = this.container.querySelector('.translated-subtitle');

        if (originalSubtitle) {
            originalSubtitle.textContent = originalText || '';
        }

        if (translatedSubtitle) {
            translatedSubtitle.textContent = translatedText || '';
            translatedSubtitle.style.display = translatedText ? 'block' : 'none';
        }
    }

    applySettings(settings) {
        this.settings = { ...this.settings, ...settings };
        
        if (!this.container) {
            this.createContainer();
        }

        // 스타일 적용
        Object.assign(this.container.style, {
            fontSize: this.settings.fontSize,
            color: this.settings.fontColor,
            backgroundColor: this.settings.backgroundColor
        });

        // 위치 설정
        if (this.settings.position === 'top') {
            this.container.style.top = '10%';
            this.container.style.bottom = 'auto';
        } else {
            this.container.style.bottom = '10%';
            this.container.style.top = 'auto';
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
    }
}

// 전역 객체에 등록
window.subtitleDisplay = new SubtitleDisplay(); 