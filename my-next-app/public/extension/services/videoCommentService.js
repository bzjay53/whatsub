/**
 * 비디오 관련 댓글 표시 서비스
 * 
 * 주요 기능:
 * 1. 비디오 플레이어 감지
 * 2. 비디오 시간 추적
 * 3. 시간에 맞는 댓글 표시
 * 4. 댓글 입력 UI 제공
 */

class VideoCommentService {
    constructor() {
        this.initialized = false;
        this.isActive = false;
        this.videoPlayers = [];
        this.currentVideo = null;
        this.lastCheckedTime = 0;
        this.checkInterval = null;
        this.settings = {
            enabled: true,
            checkFrequency: 1000, // ms
            commentDisplayWindow: 5, // seconds
            maxCommentsPerCheck: 5
        };
    }

    /**
     * 서비스 초기화
     */
    async initialize() {
        if (this.initialized) return;

        // 설정 로드
        await this.loadSettings();

        // 비디오 플레이어 감지 시작
        this.detectVideoPlayers();

        // 정기적인 비디오 플레이어 체크 (새로운 비디오가 로드될 수 있음)
        setInterval(() => this.detectVideoPlayers(), 5000);

        // 초기화 완료
        this.initialized = true;
        console.log('[Whatsub] 비디오 댓글 서비스 초기화 완료');
        return true;
    }

    /**
     * 설정 로드
     */
    async loadSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.get(['video_comment_settings'], (result) => {
                if (result && result.video_comment_settings) {
                    this.settings = {...this.settings, ...result.video_comment_settings};
                }
                resolve();
            });
        });
    }

    /**
     * 설정 저장
     */
    async saveSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.set({
                'video_comment_settings': this.settings
            }, resolve);
        });
    }

    /**
     * 비디오 플레이어 감지
     */
    detectVideoPlayers() {
        // 기존 플레이어 객체 유지 (이미 추적 중인 플레이어)
        const existingPlayers = this.videoPlayers.filter(p => document.body.contains(p.element));
        
        // 페이지 내 모든 비디오 요소 찾기
        const videoElements = document.querySelectorAll('video');
        const newPlayers = [];

        videoElements.forEach(videoElement => {
            // 이미 추적 중인 플레이어 제외
            const existingPlayer = existingPlayers.find(p => p.element === videoElement);
            if (existingPlayer) {
                newPlayers.push(existingPlayer);
                return;
            }

            // 새 플레이어 추가
            const playerInfo = {
                element: videoElement,
                url: window.location.href,
                title: document.title,
                width: videoElement.offsetWidth,
                height: videoElement.offsetHeight,
                duration: videoElement.duration || 0
            };

            // 이벤트 리스너 추가
            this.attachVideoEventListeners(playerInfo);
            newPlayers.push(playerInfo);
            
            console.log('[Whatsub] 새 비디오 플레이어 감지:', playerInfo);
        });

        this.videoPlayers = newPlayers;

        // 활성 비디오 선택 (가장 큰 플레이어 또는 재생 중인 플레이어)
        this.selectActiveVideo();

        // 비디오 정보 서비스에 전달
        if (this.currentVideo && window.communityService) {
            window.communityService.setCurrentVideo({
                url: this.currentVideo.url,
                title: this.currentVideo.title,
                duration: this.currentVideo.duration
            });
        }
    }

    /**
     * 비디오 요소에 이벤트 리스너 추가
     * @param {Object} playerInfo - 비디오 플레이어 정보
     */
    attachVideoEventListeners(playerInfo) {
        const video = playerInfo.element;

        // 재생 상태 변경 이벤트
        video.addEventListener('play', () => {
            console.log('[Whatsub] 비디오 재생 시작:', playerInfo.url);
            this.startTimeChecking(); // 시간 체크 시작
            this.selectActiveVideo(); // 현재 재생 중인 비디오로 설정
        });

        video.addEventListener('pause', () => {
            console.log('[Whatsub] 비디오 일시정지:', playerInfo.url);
        });

        // 비디오 메타데이터 로드 완료 이벤트
        video.addEventListener('loadedmetadata', () => {
            playerInfo.duration = video.duration || 0;
            console.log('[Whatsub] 비디오 메타데이터 로드됨:', playerInfo.duration);
        });

        // 비디오 종료 이벤트
        video.addEventListener('ended', () => {
            console.log('[Whatsub] 비디오 재생 종료');
            if (this.currentVideo === playerInfo) {
                this.stopTimeChecking(); // 시간 체크 중지
            }
        });
    }

    /**
     * 활성 비디오 선택
     */
    selectActiveVideo() {
        if (this.videoPlayers.length === 0) {
            this.currentVideo = null;
            return;
        }

        // 재생 중인 비디오 찾기
        const playingVideos = this.videoPlayers.filter(p => !p.element.paused);
        
        if (playingVideos.length > 0) {
            // 가장 큰 재생 중인 비디오 선택
            this.currentVideo = playingVideos.reduce((largest, current) => {
                const largestArea = largest.width * largest.height;
                const currentArea = current.width * current.height;
                return currentArea > largestArea ? current : largest;
            }, playingVideos[0]);
        } else if (!this.currentVideo || !this.videoPlayers.includes(this.currentVideo)) {
            // 재생 중인 비디오가 없으면 가장 큰 비디오 선택
            this.currentVideo = this.videoPlayers.reduce((largest, current) => {
                const largestArea = largest.width * largest.height;
                const currentArea = current.width * current.height;
                return currentArea > largestArea ? current : largest;
            }, this.videoPlayers[0]);
        }
    }

    /**
     * 시간 체크 시작
     */
    startTimeChecking() {
        if (this.checkInterval) return;

        this.checkInterval = setInterval(() => {
            this.checkCurrentTime();
        }, this.settings.checkFrequency);
    }

    /**
     * 시간 체크 중지
     */
    stopTimeChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * 현재 시간 체크 및 댓글 표시
     */
    checkCurrentTime() {
        if (!this.currentVideo || !this.settings.enabled || !window.communityService) return;

        const currentTime = this.currentVideo.element.currentTime;
        
        // 시간 변경 확인 (같은 시간에 중복 체크 방지)
        if (Math.abs(currentTime - this.lastCheckedTime) < 1) return;
        
        this.lastCheckedTime = currentTime;

        // 현재 구간의 댓글 가져오기
        const startTime = Math.max(0, currentTime - this.settings.commentDisplayWindow);
        const endTime = currentTime;
        const comments = window.communityService.getCommentsInRange(startTime, endTime);

        // 댓글 표시 (최대 개수 제한)
        const commentsToShow = comments.slice(0, this.settings.maxCommentsPerCheck);
        this.displayComments(commentsToShow);
    }

    /**
     * 댓글 표시
     * @param {Array} comments - 표시할 댓글 목록
     */
    displayComments(comments) {
        if (!window.commentDisplay || comments.length === 0) return;
        
        // 커멘트 디스플레이가 활성화되어 있는지 확인
        if (!window.commentDisplay.isActive) {
            window.commentDisplay.setActive(true);
        }

        // 각 댓글 표시
        comments.forEach(comment => {
            window.commentDisplay.addComment({
                text: comment.text,
                username: comment.username,
                timestamp: comment.timestamp
            });
        });
    }

    /**
     * 댓글 작성 UI 표시
     */
    showCommentInput() {
        if (!this.currentVideo) return;
        
        // 이미 UI가 있는지 확인
        if (document.getElementById('whatsub-comment-input')) return;
        
        // 현재 비디오 시간
        const currentTime = this.currentVideo.element.currentTime;
        
        // 댓글 입력 컨테이너 생성
        const container = document.createElement('div');
        container.id = 'whatsub-comment-input';
        container.style.position = 'fixed';
        container.style.bottom = '50px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.width = '60%';
        container.style.maxWidth = '800px';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        container.style.borderRadius = '8px';
        container.style.padding = '10px';
        container.style.zIndex = '10000';
        container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        
        // 타이틀 바
        const titleBar = document.createElement('div');
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.marginBottom = '10px';
        
        const title = document.createElement('span');
        title.textContent = `현재 시간 댓글 작성 (${this.formatTime(currentTime)})`;
        title.style.color = 'white';
        title.style.fontWeight = 'bold';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => container.remove();
        
        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);
        
        // 댓글 입력 영역
        const inputArea = document.createElement('div');
        inputArea.style.display = 'flex';
        inputArea.style.gap = '10px';
        
        const textarea = document.createElement('textarea');
        textarea.placeholder = '댓글을 입력하세요...';
        textarea.style.width = '100%';
        textarea.style.padding = '8px';
        textarea.style.borderRadius = '4px';
        textarea.style.border = 'none';
        textarea.style.resize = 'none';
        textarea.rows = 2;
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = '작성';
        submitBtn.style.padding = '8px 15px';
        submitBtn.style.borderRadius = '4px';
        submitBtn.style.backgroundColor = '#4285f4';
        submitBtn.style.color = 'white';
        submitBtn.style.border = 'none';
        submitBtn.style.cursor = 'pointer';
        submitBtn.onclick = () => {
            const commentText = textarea.value.trim();
            if (commentText) {
                this.submitComment(commentText, currentTime);
                container.remove();
            }
        };
        
        inputArea.appendChild(textarea);
        inputArea.appendChild(submitBtn);
        
        // 조립
        container.appendChild(titleBar);
        container.appendChild(inputArea);
        document.body.appendChild(container);
        
        // 포커스
        textarea.focus();
    }

    /**
     * 댓글 제출
     * @param {string} text - 댓글 내용
     * @param {number} timestamp - 비디오 시간 (초)
     */
    async submitComment(text, timestamp) {
        if (!window.communityService) return;
        
        const result = await window.communityService.addComment({
            text,
            timestamp
        });
        
        if (result.success) {
            console.log('[Whatsub] 댓글 작성 성공:', result.comment);
            
            // 새 댓글 즉시 표시
            if (window.commentDisplay) {
                window.commentDisplay.addComment({
                    text: result.comment.text,
                    username: result.comment.username,
                    timestamp: result.comment.timestamp
                });
            }
        } else {
            console.error('[Whatsub] 댓글 작성 실패:', result.message);
            // 사용자에게 오류 알림 표시
            this.showNotification('댓글 작성 실패: ' + result.message, 'error');
        }
    }

    /**
     * 알림 표시
     * @param {string} message - 메시지
     * @param {string} type - 알림 유형 (info, error, success)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `whatsub-notification ${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.zIndex = '10001';
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease-in-out';
        
        // 알림 유형에 따른 스타일
        switch (type) {
            case 'error':
                notification.style.backgroundColor = '#d93025'; // 빨간색
                break;
            case 'success':
                notification.style.backgroundColor = '#0f9d58'; // 초록색
                break;
            default:
                notification.style.backgroundColor = '#4285f4'; // 파란색
        }
        
        document.body.appendChild(notification);
        
        // 애니메이션
        setTimeout(() => { notification.style.opacity = '1'; }, 10);
        
        // 3초 후 제거
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 비디오 시간 형식화 (초 -> MM:SS)
     * @param {number} seconds - 초 단위 시간
     * @returns {string} 형식화된 시간
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 서비스 활성화/비활성화 설정
     * @param {boolean} active - 활성화 여부
     */
    setActive(active) {
        this.isActive = active;
        this.settings.enabled = active;
        
        if (active) {
            this.detectVideoPlayers();
            this.startTimeChecking();
        } else {
            this.stopTimeChecking();
        }
        
        // 댓글 디스플레이 컴포넌트 활성화/비활성화
        if (window.commentDisplay) {
            window.commentDisplay.setActive(active);
        }
        
        this.saveSettings();
    }
}

// 전역 인스턴스 생성
window.videoCommentService = new VideoCommentService();

// 페이지 로드 완료 시 자동 초기화
if (document.readyState === 'complete') {
    window.videoCommentService.initialize();
} else {
    window.addEventListener('load', () => {
        window.videoCommentService.initialize();
    });
} 