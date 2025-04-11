/**
 * 비디오 시청 중 댓글 표시 컴포넌트
 * 빌리빌리 스타일로 댓글이 화면 우측에서 좌측으로 흐르도록 표시
 */
class CommentDisplay {
    constructor() {
        this.container = null;
        this.comments = [];
        this.isActive = false;
        this.settings = {
            fontSize: '18px',
            fontColor: '#ffffff',
            speed: 'normal', // slow, normal, fast
            opacity: 0.8,
            enabled: true
        };
        this.lanes = []; // 댓글 표시 라인 (중첩 방지)
        this.laneCount = 8; // 최대 동시 표시 라인 수
    }

    /**
     * 컴포넌트 초기화
     */
    initialize() {
        if (this.container) return;

        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.id = 'whatsub-comment-container';
        this.container.style.position = 'fixed';
        this.container.style.zIndex = '9998'; // 자막보다 약간 낮은 z-index
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // 클릭 이벤트 통과
        this.container.style.overflow = 'hidden';
        this.container.style.display = 'none';

        document.body.appendChild(this.container);

        // 라인 초기화
        for (let i = 0; i < this.laneCount; i++) {
            this.lanes.push({
                index: i,
                available: true,
                lastUsed: 0
            });
        }
    }

    /**
     * 댓글 추가 및 표시
     * @param {Object} comment - 표시할 댓글 정보
     * @param {string} comment.text - 댓글 내용
     * @param {string} comment.username - 작성자 이름
     * @param {string} comment.timestamp - 비디오 타임스탬프
     * @param {string} comment.color - 댓글 색상 (옵션)
     */
    addComment(comment) {
        if (!this.isActive || !this.settings.enabled) return;
        if (!this.container) this.initialize();

        // 가용 라인 찾기
        const lane = this.findAvailableLane();
        if (!lane) return; // 모든 라인이 사용 중인 경우

        // 댓글 요소 생성
        const commentElem = document.createElement('div');
        commentElem.className = 'whatsub-comment';
        commentElem.style.position = 'absolute';
        commentElem.style.whiteSpace = 'nowrap';
        commentElem.style.top = `${(lane.index / this.laneCount) * 80 + 10}%`;
        commentElem.style.right = '-300px'; // 화면 바깥에서 시작
        commentElem.style.color = comment.color || this.settings.fontColor;
        commentElem.style.fontSize = this.settings.fontSize;
        commentElem.style.fontWeight = 'bold';
        commentElem.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        commentElem.style.opacity = this.settings.opacity;
        commentElem.style.transition = 'right linear';
        commentElem.style.pointerEvents = 'none';

        // 시간 정보가 있으면 표시
        if (comment.timestamp) {
            const formattedTime = this.formatTimestamp(comment.timestamp);
            commentElem.innerHTML = `<span class="comment-time">[${formattedTime}]</span> <span class="comment-user">${comment.username}:</span> ${comment.text}`;
        } else {
            commentElem.innerHTML = `<span class="comment-user">${comment.username}:</span> ${comment.text}`;
        }

        this.container.appendChild(commentElem);

        // 애니메이션 시작
        setTimeout(() => {
            // 가로 이동 속도 계산
            const speed = this.getAnimationSpeed();
            commentElem.style.transition = `right ${speed}s linear`;
            commentElem.style.right = '100%'; // 화면 왼쪽 끝으로 이동
        }, 10);

        // 애니메이션 종료 후 제거
        const animationDuration = this.getAnimationSpeed() * 1000;
        setTimeout(() => {
            if (commentElem.parentNode) {
                commentElem.parentNode.removeChild(commentElem);
            }
            // 라인 해제
            lane.available = true;
        }, animationDuration + 500);

        // 라인 사용 중 표시
        lane.available = false;
        lane.lastUsed = Date.now();
    }

    /**
     * 사용 가능한 라인 찾기
     * @returns {Object|null} 사용 가능한 라인 또는 null
     */
    findAvailableLane() {
        // 사용 가능한 라인 찾기
        const availableLanes = this.lanes.filter(lane => lane.available);
        
        if (availableLanes.length > 0) {
            return availableLanes[Math.floor(Math.random() * availableLanes.length)];
        }
        
        // 모든 라인이 사용 중이면 가장 오래 전에 사용된 라인 선택
        const oldestLane = this.lanes.reduce((oldest, current) => 
            current.lastUsed < oldest.lastUsed ? current : oldest, this.lanes[0]);
            
        return oldestLane;
    }

    /**
     * 애니메이션 속도 계산 (초 단위)
     * @returns {number} 애니메이션 지속 시간 (초)
     */
    getAnimationSpeed() {
        switch (this.settings.speed) {
            case 'slow': return 15;
            case 'fast': return 5;
            case 'normal':
            default: return 10;
        }
    }

    /**
     * 타임스탬프 형식 변환 (초 -> MM:SS)
     * @param {number|string} timestamp - 비디오 시간 (초)
     * @returns {string} 형식화된 시간 (MM:SS)
     */
    formatTimestamp(timestamp) {
        const totalSeconds = parseInt(timestamp, 10);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * 활성화 상태 설정
     * @param {boolean} active - 활성화 여부
     */
    setActive(active) {
        this.isActive = active;
        if (!this.container) this.initialize();
        this.container.style.display = active ? 'block' : 'none';
    }

    /**
     * 설정 적용
     * @param {Object} settings - 새 설정값
     */
    applySettings(settings) {
        this.settings = { ...this.settings, ...settings };
        // 변경된 설정에 따라 표시 상태 업데이트
        if (this.isActive) {
            this.setActive(this.settings.enabled);
        }
    }

    /**
     * 컴포넌트 제거
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.comments = [];
        this.lanes = [];
    }
}

// 전역 객체에 등록
window.commentDisplay = new CommentDisplay(); 