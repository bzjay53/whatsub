// 상태 표시기 컴포넌트
class StatusIndicator {
    constructor() {
        this.container = null;
        this.createContainer();
    }

    createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'whatsub-status-indicator';
        this.container.style.display = 'none';

        const dot = document.createElement('div');
        dot.className = 'whatsub-status-dot';
        this.container.appendChild(dot);

        const text = document.createElement('span');
        text.className = 'whatsub-status-text';
        this.container.appendChild(text);

        document.body.appendChild(this.container);
    }

    updateStatus(message, status = 'info') {
        if (!this.container) {
            this.createContainer();
        }

        const dot = this.container.querySelector('.whatsub-status-dot');
        const text = this.container.querySelector('.whatsub-status-text');

        // 상태에 따른 클래스 설정
        const statusClass = status === 'error' ? 'error' : 
                          status === 'success' ? 'success' : 
                          status === 'info' ? 'info' : 'default';

        this.container.className = `whatsub-status-indicator ${statusClass}`;
        dot.className = `whatsub-status-dot ${statusClass}`;
        text.textContent = message;

        this.container.style.display = 'flex';

        // 성공/에러 메시지는 3초 후 자동으로 숨김
        if (status === 'success' || status === 'error') {
            setTimeout(() => {
                this.hide();
            }, 3000);
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
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
window.statusIndicator = new StatusIndicator(); 