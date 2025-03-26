// 상태 표시 서비스
const statusIndicator = {
    isInitialized: true,
    container: null,
    messageElement: null,

    initialize() {
        if (this.container) return true;

        try {
            // 상태 표시 컨테이너 생성
            this.container = document.createElement('div');
            this.container.id = 'whatsub-status';
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 20px;
                border-radius: 5px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                font-size: 14px;
                z-index: 999999;
                display: none;
                transition: opacity 0.3s ease;
            `;

            // 메시지 요소 생성
            this.messageElement = document.createElement('span');
            this.container.appendChild(this.messageElement);

            // 문서에 추가
            document.body.appendChild(this.container);
            
            return true;
        } catch (error) {
            console.error('[whatsub] 상태 표시 초기화 실패:', error);
            return false;
        }
    },

    // 상태 메시지 표시
    updateStatus(message, type = 'info') {
        if (!this.container && !this.initialize()) {
            console.error('[whatsub] 상태 표시 컨테이너를 초기화할 수 없습니다.');
            return;
        }

        // 상태 타입에 따른 스타일 설정
        let backgroundColor;
        switch (type) {
            case 'error':
                backgroundColor = 'rgba(244, 67, 54, 0.8)';
                break;
            case 'success':
                backgroundColor = 'rgba(76, 175, 80, 0.8)';
                break;
            case 'warning':
                backgroundColor = 'rgba(255, 152, 0, 0.8)';
                break;
            default:
                backgroundColor = 'rgba(0, 0, 0, 0.8)';
        }

        this.container.style.background = backgroundColor;
        this.messageElement.textContent = message;
        this.container.style.display = 'block';

        // 3초 후 메시지 숨김
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 3000);
    },

    // 상태 표시 숨김
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
};

// 전역 객체에 등록
window.statusIndicator = statusIndicator;

// 초기화
statusIndicator.initialize(); 