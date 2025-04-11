/**
 * 커뮤니티 자막 및 댓글 관리 서비스
 * 
 * 주요 기능:
 * 1. 자막 업로드/다운로드
 * 2. 자막 검색 및 목록 조회
 * 3. 자막 좋아요/싫어요/추천
 * 4. 비디오 구간별 댓글 작성/조회
 * 5. 인기 자막 및 기여자 관리
 */

class CommunityService {
    constructor() {
        this.initialized = false;
        this.apiBaseUrl = 'https://api.whatsub.example.com'; // 실제 API 서버 URL로 변경 필요
        this.currentVideoInfo = null;
        this.currentSubtitles = [];
        this.currentComments = [];
    }

    /**
     * 서비스 초기화
     */
    async initialize() {
        if (this.initialized) return;

        // 로컬 저장소에서 이전 상태 복원
        await this.loadState();

        this.initialized = true;
        console.log('[Whatsub] 커뮤니티 서비스 초기화 완료');
        return true;
    }

    /**
     * 상태 저장소에서 로드
     */
    async loadState() {
        return new Promise(resolve => {
            chrome.storage.local.get(['community_state'], (result) => {
                if (result && result.community_state) {
                    try {
                        const state = result.community_state;
                        this.currentVideoInfo = state.videoInfo || null;
                        this.currentSubtitles = state.subtitles || [];
                        this.currentComments = state.comments || [];
                    } catch (error) {
                        console.debug('[Whatsub] 커뮤니티 상태 복원 중 오류:', error);
                    }
                }
                resolve();
            });
        });
    }

    /**
     * 상태 저장
     */
    async saveState() {
        return new Promise(resolve => {
            chrome.storage.local.set({
                'community_state': {
                    videoInfo: this.currentVideoInfo,
                    subtitles: this.currentSubtitles,
                    comments: this.currentComments,
                    lastUpdated: new Date().toISOString()
                }
            }, resolve);
        });
    }

    /**
     * 현재 비디오 정보 설정
     * @param {Object} videoInfo - 비디오 정보
     */
    async setCurrentVideo(videoInfo) {
        this.currentVideoInfo = videoInfo;
        this.currentSubtitles = [];
        this.currentComments = [];

        // 비디오 관련 자막과 댓글 로드
        if (videoInfo && videoInfo.url) {
            await Promise.all([
                this.loadSubtitlesForVideo(videoInfo.url),
                this.loadCommentsForVideo(videoInfo.url)
            ]);
        }

        await this.saveState();
        return true;
    }

    /**
     * 자막 파일 업로드
     * @param {Object} subtitleData - 자막 데이터
     * @param {File|String} subtitleData.content - 자막 파일 또는 텍스트 내용
     * @param {String} subtitleData.format - 자막 형식 (srt, vtt 등)
     * @param {String} subtitleData.language - 자막 언어
     * @param {Object} subtitleData.metadata - 추가 메타데이터
     */
    async uploadSubtitle(subtitleData) {
        try {
            if (!this.currentVideoInfo) {
                return { success: false, error: 'video_not_set', message: '비디오 정보가 설정되지 않았습니다.' };
            }

            if (!subtitleData.content) {
                return { success: false, error: 'content_missing', message: '자막 내용이 필요합니다.' };
            }

            // 사용자 정보 가져오기
            const userInfo = await this.getUserInfo();
            if (!userInfo) {
                return { success: false, error: 'auth_required', message: '로그인이 필요합니다.' };
            }

            // 자막 메타데이터 구성
            const subtitleMeta = {
                videoUrl: this.currentVideoInfo.url,
                videoTitle: this.currentVideoInfo.title || '알 수 없는 제목',
                format: subtitleData.format || 'srt',
                language: subtitleData.language || 'ko',
                uploadedBy: userInfo.uid,
                uploadedByName: userInfo.displayName || userInfo.email,
                timestamp: new Date().toISOString(),
                ...subtitleData.metadata
            };

            // 자막 업로드 API 호출 시뮬레이션
            // 실제 구현에서는 API 서버로 업로드
            console.log('[Whatsub] 자막 업로드 요청:', subtitleMeta);

            // 임시 성공 응답 (개발 목적)
            const newSubtitle = {
                id: 'subtitle_' + Date.now(),
                ...subtitleMeta,
                status: 'active',
                likes: 0,
                dislikes: 0,
                recommendations: 0,
                views: 0
            };

            // 로컬에 저장 (API 연동 전 임시)
            this.currentSubtitles.push(newSubtitle);
            await this.saveState();

            return {
                success: true,
                message: '자막이 성공적으로 업로드되었습니다.',
                subtitle: newSubtitle
            };
        } catch (error) {
            console.error('[Whatsub] 자막 업로드 중 오류:', error);
            return {
                success: false,
                error: 'upload_failed',
                message: '자막 업로드 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    /**
     * 비디오에 대한 자막 목록 로드
     * @param {string} videoUrl - 비디오 URL
     */
    async loadSubtitlesForVideo(videoUrl) {
        try {
            // API 호출 시뮬레이션
            // 실제 구현에서는 API 서버에서 자막 목록 조회
            console.log('[Whatsub] 비디오 자막 목록 조회:', videoUrl);

            // 임시 데이터 (개발 목적)
            this.currentSubtitles = [
                {
                    id: 'subtitle_1',
                    videoUrl: videoUrl,
                    videoTitle: '샘플 비디오',
                    format: 'srt',
                    language: 'ko',
                    uploadedBy: 'user123',
                    uploadedByName: '사용자1',
                    timestamp: new Date().toISOString(),
                    status: 'active',
                    likes: 10,
                    dislikes: 1,
                    recommendations: 5,
                    views: 100
                },
                {
                    id: 'subtitle_2',
                    videoUrl: videoUrl,
                    videoTitle: '샘플 비디오',
                    format: 'vtt',
                    language: 'en',
                    uploadedBy: 'user456',
                    uploadedByName: '사용자2',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    status: 'active',
                    likes: 5,
                    dislikes: 0,
                    recommendations: 2,
                    views: 50
                }
            ];

            return this.currentSubtitles;
        } catch (error) {
            console.error('[Whatsub] 자막 목록 로드 중 오류:', error);
            return [];
        }
    }

    /**
     * 특정 자막 다운로드
     * @param {string} subtitleId - 자막 ID
     */
    async downloadSubtitle(subtitleId) {
        try {
            // 로컬에서 자막 찾기
            const subtitle = this.currentSubtitles.find(s => s.id === subtitleId);
            if (!subtitle) {
                return { success: false, error: 'not_found', message: '자막을 찾을 수 없습니다.' };
            }

            // API 호출 시뮬레이션
            console.log('[Whatsub] 자막 다운로드 요청:', subtitleId);

            // 조회수 증가
            subtitle.views = (subtitle.views || 0) + 1;
            await this.saveState();

            return {
                success: true,
                message: '자막이 성공적으로 다운로드되었습니다.',
                subtitle: subtitle,
                content: '1\n00:00:01,000 --> 00:00:05,000\n안녕하세요, 샘플 자막입니다.\n\n2\n00:00:06,000 --> 00:00:10,000\n이것은 테스트 자막입니다.'
            };
        } catch (error) {
            console.error('[Whatsub] 자막 다운로드 중 오류:', error);
            return {
                success: false,
                error: 'download_failed',
                message: '자막 다운로드 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    /**
     * 자막에 평가 추가 (좋아요/싫어요/추천)
     * @param {string} subtitleId - 자막 ID
     * @param {string} type - 평가 유형 (like, dislike, recommend)
     */
    async rateSubtitle(subtitleId, type) {
        try {
            // 사용자 정보 확인
            const userInfo = await this.getUserInfo();
            if (!userInfo) {
                return { success: false, error: 'auth_required', message: '로그인이 필요합니다.' };
            }

            // 자막 찾기
            const subtitle = this.currentSubtitles.find(s => s.id === subtitleId);
            if (!subtitle) {
                return { success: false, error: 'not_found', message: '자막을 찾을 수 없습니다.' };
            }

            // API 호출 시뮬레이션
            console.log(`[Whatsub] 자막 평가 추가: ${subtitleId}, 유형: ${type}`);

            // 로컬 상태 업데이트
            switch (type) {
                case 'like':
                    subtitle.likes = (subtitle.likes || 0) + 1;
                    break;
                case 'dislike':
                    subtitle.dislikes = (subtitle.dislikes || 0) + 1;
                    break;
                case 'recommend':
                    subtitle.recommendations = (subtitle.recommendations || 0) + 1;
                    break;
                default:
                    return { success: false, error: 'invalid_type', message: '유효하지 않은 평가 유형입니다.' };
            }

            await this.saveState();

            return {
                success: true,
                message: '평가가 성공적으로 추가되었습니다.',
                subtitle: subtitle
            };
        } catch (error) {
            console.error('[Whatsub] 자막 평가 중 오류:', error);
            return {
                success: false,
                error: 'rating_failed',
                message: '자막 평가 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    /**
     * 비디오에 댓글 추가
     * @param {Object} commentData - 댓글 데이터
     * @param {string} commentData.text - 댓글 내용
     * @param {number} commentData.timestamp - 비디오 시간 (초)
     */
    async addComment(commentData) {
        try {
            if (!this.currentVideoInfo) {
                return { success: false, error: 'video_not_set', message: '비디오 정보가 설정되지 않았습니다.' };
            }

            // 사용자 정보 확인
            const userInfo = await this.getUserInfo();
            if (!userInfo) {
                return { success: false, error: 'auth_required', message: '로그인이 필요합니다.' };
            }

            // 댓글 데이터 검증
            if (!commentData.text || commentData.text.trim() === '') {
                return { success: false, error: 'empty_comment', message: '댓글 내용이 비어있습니다.' };
            }

            // API 호출 시뮬레이션
            console.log('[Whatsub] 댓글 추가 요청:', commentData);

            // 새 댓글 생성
            const newComment = {
                id: 'comment_' + Date.now(),
                videoUrl: this.currentVideoInfo.url,
                text: commentData.text,
                timestamp: commentData.timestamp || 0,
                createdAt: new Date().toISOString(),
                userId: userInfo.uid,
                username: userInfo.displayName || userInfo.email.split('@')[0],
                likes: 0,
                dislikes: 0
            };

            // 로컬 상태 업데이트
            this.currentComments.push(newComment);
            await this.saveState();

            return {
                success: true,
                message: '댓글이 성공적으로 추가되었습니다.',
                comment: newComment
            };
        } catch (error) {
            console.error('[Whatsub] 댓글 추가 중 오류:', error);
            return {
                success: false,
                error: 'comment_failed',
                message: '댓글 추가 중 오류가 발생했습니다: ' + error.message
            };
        }
    }

    /**
     * 비디오에 대한 댓글 로드
     * @param {string} videoUrl - 비디오 URL
     */
    async loadCommentsForVideo(videoUrl) {
        try {
            // API 호출 시뮬레이션
            console.log('[Whatsub] 비디오 댓글 목록 조회:', videoUrl);

            // 임시 데이터 (개발 목적)
            this.currentComments = [
                {
                    id: 'comment_1',
                    videoUrl: videoUrl,
                    text: '이 부분이 정말 웃겨요 ㅋㅋㅋ',
                    timestamp: 65, // 1:05
                    createdAt: new Date().toISOString(),
                    userId: 'user123',
                    username: '시청자1',
                    likes: 5,
                    dislikes: 0
                },
                {
                    id: 'comment_2',
                    videoUrl: videoUrl,
                    text: '설명이 너무 어렵네요',
                    timestamp: 125, // 2:05
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    userId: 'user456',
                    username: '시청자2',
                    likes: 2,
                    dislikes: 1
                },
                {
                    id: 'comment_3',
                    videoUrl: videoUrl,
                    text: '자막이 너무 빨라요!',
                    timestamp: 180, // 3:00
                    createdAt: new Date(Date.now() - 7200000).toISOString(),
                    userId: 'user789',
                    username: '시청자3',
                    likes: 8,
                    dislikes: 0
                }
            ];

            return this.currentComments;
        } catch (error) {
            console.error('[Whatsub] 댓글 목록 로드 중 오류:', error);
            return [];
        }
    }

    /**
     * 특정 구간의 댓글 가져오기
     * @param {number} startTime - 시작 시간 (초)
     * @param {number} endTime - 종료 시간 (초)
     */
    getCommentsInRange(startTime, endTime) {
        return this.currentComments.filter(comment => 
            comment.timestamp >= startTime && comment.timestamp <= endTime
        );
    }

    /**
     * 현재 로그인된 사용자 정보 가져오기
     */
    async getUserInfo() {
        return new Promise(resolve => {
            chrome.storage.local.get(['user', 'auth'], (result) => {
                if (result.user) {
                    resolve(result.user);
                } else if (result.auth && result.auth.user) {
                    resolve(result.auth.user);
                } else {
                    resolve(null);
                }
            });
        });
    }
}

// 전역 인스턴스 생성
window.communityService = new CommunityService(); 