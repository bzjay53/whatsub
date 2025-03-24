// 보상 시스템 서비스
const rewardService = {
    isInitialized: false,

    // 보상 기준
    REWARD_CRITERIA: {
        LIKE_THRESHOLD: 10, // 좋아요 기준
        UPLOAD_THRESHOLD: 5, // 업로드 기준
        COMMENT_THRESHOLD: 20 // 댓글 기준
    },

    // 이벤트 타입
    EVENT_TYPES: {
        NEW_USER: 'new_user',
        REFERRAL: 'referral',
        ACTIVE_UPLOADER: 'active_uploader',
        POPULAR_SUBTITLE: 'popular_subtitle'
    },

    // 보상 타입
    REWARD_TYPES: {
        FREE_UPGRADE: 'free_upgrade',
        EXTENDED_SUBSCRIPTION: 'extended_subscription',
        PREMIUM_TRIAL: 'premium_trial'
    },

    // 초기화
    async initialize() {
        if (this.isInitialized) return true;

        try {
            // 데이터베이스 연결 등 초기화 작업
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('보상 시스템 초기화 오류:', error);
            return false;
        }
    },

    // 신규 사용자 이벤트 처리
    async handleNewUser(userId) {
        try {
            await this.grantReward(userId, this.EVENT_TYPES.NEW_USER, {
                type: this.REWARD_TYPES.PREMIUM_TRIAL,
                duration: 30, // 30일
                plan: 'standard'
            });
            
            return true;
        } catch (error) {
            console.error('신규 사용자 보상 처리 오류:', error);
            return false;
        }
    },

    // 추천인 이벤트 처리
    async handleReferral(referrerId, newUserId) {
        try {
            // 추천인 보상
            await this.grantReward(referrerId, this.EVENT_TYPES.REFERRAL, {
                type: this.REWARD_TYPES.EXTENDED_SUBSCRIPTION,
                duration: 30
            });

            // 신규 가입자 보상
            await this.grantReward(newUserId, this.EVENT_TYPES.NEW_USER, {
                type: this.REWARD_TYPES.PREMIUM_TRIAL,
                duration: 30,
                plan: 'standard'
            });

            return true;
        } catch (error) {
            console.error('추천 보상 처리 오류:', error);
            return false;
        }
    },

    // 자막 업로더 활동 체크
    async checkUploaderActivity(userId) {
        try {
            const stats = await this.getUserStats(userId);
            
            if (stats.uploadCount >= this.REWARD_CRITERIA.UPLOAD_THRESHOLD &&
                stats.totalLikes >= this.REWARD_CRITERIA.LIKE_THRESHOLD) {
                
                await this.grantReward(userId, this.EVENT_TYPES.ACTIVE_UPLOADER, {
                    type: this.REWARD_TYPES.EXTENDED_SUBSCRIPTION,
                    duration: 30
                });

                // 관리자에게 알림
                await this.notifyAdmin({
                    type: 'ACTIVE_UPLOADER',
                    userId,
                    stats
                });
            }

            return true;
        } catch (error) {
            console.error('업로더 활동 체크 오류:', error);
            return false;
        }
    },

    // 인기 자막 체크
    async checkPopularSubtitle(subtitleId, userId) {
        try {
            const stats = await this.getSubtitleStats(subtitleId);
            
            if (stats.likes >= this.REWARD_CRITERIA.LIKE_THRESHOLD) {
                await this.grantReward(userId, this.EVENT_TYPES.POPULAR_SUBTITLE, {
                    type: this.REWARD_TYPES.FREE_UPGRADE,
                    duration: 30
                });

                // 관리자에게 알림
                await this.notifyAdmin({
                    type: 'POPULAR_SUBTITLE',
                    subtitleId,
                    userId,
                    stats
                });
            }

            return true;
        } catch (error) {
            console.error('인기 자막 체크 오류:', error);
            return false;
        }
    },

    // 보상 지급
    async grantReward(userId, eventType, rewardDetails) {
        try {
            // 보상 지급 로직
            await chrome.runtime.sendMessage({
                action: 'grantReward',
                userId,
                eventType,
                rewardDetails
            });

            // 사용자에게 알림
            await this.notifyUser(userId, {
                type: 'REWARD_GRANTED',
                eventType,
                rewardDetails
            });

            return true;
        } catch (error) {
            console.error('보상 지급 오류:', error);
            return false;
        }
    },

    // 관리자 알림
    async notifyAdmin(notification) {
        try {
            await chrome.runtime.sendMessage({
                action: 'notifyAdmin',
                notification
            });
            return true;
        } catch (error) {
            console.error('관리자 알림 오류:', error);
            return false;
        }
    },

    // 사용자 알림
    async notifyUser(userId, notification) {
        try {
            await chrome.runtime.sendMessage({
                action: 'notifyUser',
                userId,
                notification
            });
            return true;
        } catch (error) {
            console.error('사용자 알림 오류:', error);
            return false;
        }
    },

    // 사용자 통계 조회
    async getUserStats(userId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getUserStats',
                userId
            });
            return response.stats;
        } catch (error) {
            console.error('사용자 통계 조회 오류:', error);
            return null;
        }
    },

    // 자막 통계 조회
    async getSubtitleStats(subtitleId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getSubtitleStats',
                subtitleId
            });
            return response.stats;
        } catch (error) {
            console.error('자막 통계 조회 오류:', error);
            return null;
        }
    }
};

// 서비스 등록
if (typeof window.services === 'undefined') {
    window.services = {};
}
window.services.rewardService = rewardService; 