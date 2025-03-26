// Firebase 데이터 서비스
// 전역 객체를 사용 - 이 파일은 현재 직접 사용되지 않습니다.
// 모든 Firebase 관련 기능은 background.js에 구현되어 있습니다.

// Firebase 서비스 클래스
class FirebaseService {
    constructor() {
        this.auth = null;
        this.db = null;
        this.initialized = false;
        this.currentUser = null;
        
        // 컬렉션 경로 상수
        this.collections = {
            USERS: 'users',
            SETTINGS: 'settings',
            SUBSCRIPTIONS: 'subscriptions',
            HISTORY: 'history',
            USAGE: 'usage'
        };
    }

    /**
     * Firebase 서비스 초기화
     * @returns {Promise<boolean>} 초기화 성공 여부
     */
    async initialize() {
        try {
            if (this.initialized) {
                console.log('[FirebaseService] 이미 초기화되었습니다.');
                return true;
            }

            console.log('[FirebaseService] 초기화 중...');
            
            // Firebase 앱 초기화 확인
            const initialized = window.firebaseSDK.initialize();
            if (!initialized) {
                console.warn('[FirebaseService] firebase-config.js를 통한 초기화 실패, 대체 firebase-sdk 사용');
            }
            
            // Firebase 앱이 이미 초기화되었는지 확인
            if (!window.firebaseSDK || !window.firebaseSDK.apps || !window.firebaseSDK.apps.length) {
                console.warn('[FirebaseService] firebaseSDK가 초기화되지 않음, 모의 서비스 사용');
            }
            
            // Firebase 서비스 참조 가져오기
            this.auth = window.firebaseSDK.auth();
            this.db = window.firebaseSDK.firestore();
            
            // 현재 인증된 사용자 확인
            this.currentUser = this.auth.currentUser;
            
            // 인증 상태 변경 리스너 설정
            this.auth.onAuthStateChanged(user => {
                this.currentUser = user;
                if (user) {
                    console.log('[FirebaseService] 사용자 인증됨:', user.email);
                    this.setupUserData(user.uid, user.email);
                } else {
                    console.log('[FirebaseService] 로그아웃됨');
                }
            });
            
            this.initialized = true;
            console.log('[FirebaseService] 초기화 완료');
            return true;
        } catch (error) {
            console.error('[FirebaseService] 초기화 오류:', error);
            return false;
        }
    }

    /**
     * 사용자 데이터 설정 및 초기화
     * @param {string} uid 사용자 ID
     * @param {string} email 사용자 이메일
     */
    async setupUserData(uid, email) {
        try {
            // 사용자 문서 참조
            const userRef = this.db.collection(this.collections.USERS).doc(uid);
            
            // 사용자 문서 가져오기
            const userDoc = await userRef.get();
            
            // 사용자 데이터가 없으면 초기 데이터 생성
            if (!userDoc.exists) {
                console.log('[FirebaseService] 새 사용자 데이터 생성:', email);
                await userRef.set({
                    email: email,
                    displayName: email.split('@')[0],
                    createdAt: window.firebaseSDK.getFirebaseTimestamp(),
                    lastLogin: window.firebaseSDK.getFirebaseTimestamp(),
                    role: 'free', // 기본 역할은 무료 사용자
                    status: 'active'
                });
                
                // 사용자 기본 설정 생성
                await this.db.collection(this.collections.SETTINGS).doc(uid).set({
                    sourceLanguage: 'auto',
                    targetLanguage: 'ko',
                    subtitlePosition: 'bottom',
                    fontSize: 'medium',
                    background: 'semi',
                    dualSubtitles: true,
                    showControls: true,
                    updatedAt: window.firebaseSDK.getFirebaseTimestamp()
                });
                
                // 사용량 데이터 초기화
                await this.db.collection(this.collections.USAGE).doc(uid).set({
                    totalMinutes: 0,
                    monthlyMinutes: 0,
                    lastReset: window.firebaseSDK.getFirebaseTimestamp(),
                    currentMonth: new Date().getMonth() + 1,
                    updatedAt: window.firebaseSDK.getFirebaseTimestamp()
                });
            } else {
                // 기존 사용자의 경우 로그인 시간 업데이트
                await userRef.update({
                    lastLogin: window.firebaseSDK.getFirebaseTimestamp()
                });
                
                // 월별 사용량 초기화 확인 (새 달이 시작되었을 경우)
                await this.checkAndResetMonthlyUsage(uid);
            }
        } catch (error) {
            console.error('[FirebaseService] 사용자 데이터 설정 오류:', error);
        }
    }

    /**
     * 월간 사용량 초기화 여부 확인 및 필요 시 초기화
     * @param {string} uid 사용자 ID
     */
    async checkAndResetMonthlyUsage(uid) {
        try {
            const usageRef = this.db.collection(this.collections.USAGE).doc(uid);
            const usageDoc = await usageRef.get();
            
            if (usageDoc.exists) {
                const currentMonth = new Date().getMonth() + 1; // 0-indexed에서 1-indexed로 변환
                const data = usageDoc.data();
                
                // 저장된 월과 현재 월이 다른 경우 초기화
                if (data.currentMonth !== currentMonth) {
                    console.log('[FirebaseService] 월간 사용량 초기화');
                    await usageRef.update({
                        monthlyMinutes: 0,
                        lastReset: window.firebaseSDK.getFirebaseTimestamp(),
                        currentMonth: currentMonth
                    });
                }
            }
        } catch (error) {
            console.error('[FirebaseService] 월간 사용량 초기화 확인 오류:', error);
        }
    }

    /**
     * 사용자 설정 가져오기
     * @returns {Promise<Object>} 사용자 설정
     */
    async getUserSettings() {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const settingsRef = this.db.collection(this.collections.SETTINGS).doc(this.currentUser.uid);
            const doc = await settingsRef.get();
            
            if (doc.exists) {
                return doc.data();
            } else {
                throw new Error('설정을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('[FirebaseService] 설정 가져오기 오류:', error);
            throw error;
        }
    }

    /**
     * 사용자 설정 저장
     * @param {Object} settings 저장할 설정
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveUserSettings(settings) {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const settingsRef = this.db.collection(this.collections.SETTINGS).doc(this.currentUser.uid);
            
            await settingsRef.update({
                ...settings,
                updatedAt: window.firebaseSDK.getFirebaseTimestamp()
            });
            
            return true;
        } catch (error) {
            console.error('[FirebaseService] 설정 저장 오류:', error);
            return false;
        }
    }

    /**
     * 시청 기록 저장
     * @param {Object} historyData 시청 기록 데이터
     * @returns {Promise<string>} 생성된 기록 ID
     */
    async saveViewingHistory(historyData) {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const userHistoryRef = this.db.collection(this.collections.USERS)
                .doc(this.currentUser.uid)
                .collection(this.collections.HISTORY);
            
            // 새 기록 추가
            const newHistoryRef = await userHistoryRef.add({
                title: historyData.title || '제목 없음',
                url: historyData.url || '',
                timestamp: window.firebaseSDK.getFirebaseTimestamp(),
                durationSeconds: historyData.durationSeconds || 0,
                platform: historyData.platform || 'unknown',
                transcripts: historyData.transcripts || []
            });
            
            return newHistoryRef.id;
        } catch (error) {
            console.error('[FirebaseService] 시청 기록 저장 오류:', error);
            throw error;
        }
    }

    /**
     * 최근 시청 기록 가져오기
     * @param {number} limit 가져올 기록 수
     * @returns {Promise<Array>} 시청 기록 배열
     */
    async getRecentHistory(limit = 10) {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const userHistoryRef = this.db.collection(this.collections.USERS)
                .doc(this.currentUser.uid)
                .collection(this.collections.HISTORY);
            
            const snapshot = await userHistoryRef
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });
        } catch (error) {
            console.error('[FirebaseService] 시청 기록 가져오기 오류:', error);
            return [];
        }
    }

    /**
     * 구독 정보 가져오기
     * @returns {Promise<Object>} 구독 정보
     */
    async getSubscriptionInfo() {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const userRef = this.db.collection(this.collections.USERS).doc(this.currentUser.uid);
            const subscriptionRef = this.db.collection(this.collections.SUBSCRIPTIONS).doc(this.currentUser.uid);
            
            // 병렬로 데이터 가져오기
            const [userDoc, subscriptionDoc] = await Promise.all([
                userRef.get(),
                subscriptionRef.get()
            ]);
            
            // 기본 역할 정보
            const userData = userDoc.exists ? userDoc.data() : { role: 'free' };
            
            // 구독 정보가 없으면 기본값 반환
            if (!subscriptionDoc.exists) {
                return {
                    role: userData.role,
                    isActive: userData.role !== 'free',
                    plan: userData.role,
                    expiresAt: null,
                    minutesLimit: userData.role === 'free' ? 30 : 1000,
                    features: this.getFeaturesByRole(userData.role)
                };
            }
            
            // 구독 정보가 있는 경우
            const subscriptionData = subscriptionDoc.data();
            
            // 구독 만료 여부 확인
            const isActive = subscriptionData.expiresAt && 
                             subscriptionData.expiresAt.toDate() > new Date();
            
            return {
                role: isActive ? subscriptionData.plan : 'free',
                isActive: isActive,
                plan: subscriptionData.plan,
                expiresAt: subscriptionData.expiresAt,
                minutesLimit: this.getMinutesLimit(isActive ? subscriptionData.plan : 'free'),
                features: this.getFeaturesByRole(isActive ? subscriptionData.plan : 'free')
            };
        } catch (error) {
            console.error('[FirebaseService] 구독 정보 가져오기 오류:', error);
            
            // 오류 시 기본값 반환
            return {
                role: 'free',
                isActive: false,
                plan: 'free',
                expiresAt: null,
                minutesLimit: 30,
                features: this.getFeaturesByRole('free')
            };
        }
    }

    /**
     * 역할에 따른 사용 시간 한도 가져오기
     * @param {string} role 사용자 역할
     * @returns {number} 분 단위 사용 한도
     */
    getMinutesLimit(role) {
        switch (role) {
            case 'premium':
                return 1000;
            case 'basic':
                return 300;
            case 'free':
            default:
                return 30;
        }
    }

    /**
     * 역할에 따른 사용 가능 기능 가져오기
     * @param {string} role 사용자 역할
     * @returns {Object} 사용 가능 기능 목록
     */
    getFeaturesByRole(role) {
        const features = {
            multiLanguage: false,
            highQualitySubtitles: false,
            offlineMode: false,
            multipleDevices: false,
            noAds: false,
            customStyles: false
        };
        
        switch (role) {
            case 'premium':
                features.multiLanguage = true;
                features.highQualitySubtitles = true;
                features.offlineMode = true;
                features.multipleDevices = true;
                features.noAds = true;
                features.customStyles = true;
                break;
            case 'basic':
                features.multiLanguage = true;
                features.highQualitySubtitles = true;
                features.noAds = true;
                break;
            case 'free':
            default:
                // 기본값 유지
                break;
        }
        
        return features;
    }

    /**
     * 사용량 업데이트
     * @param {number} minutes 사용 시간 (분)
     * @returns {Promise<Object>} 갱신된 사용량 정보
     */
    async updateUsage(minutes) {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const usageRef = this.db.collection(this.collections.USAGE).doc(this.currentUser.uid);
            
            // 트랜잭션으로 안전하게 업데이트
            return await this.db.runTransaction(async (transaction) => {
                const usageDoc = await transaction.get(usageRef);
                
                if (!usageDoc.exists) {
                    // 사용량 데이터가 없으면 생성
                    const newData = {
                        totalMinutes: minutes,
                        monthlyMinutes: minutes,
                        lastReset: window.firebaseSDK.getFirebaseTimestamp(),
                        currentMonth: new Date().getMonth() + 1,
                        updatedAt: window.firebaseSDK.getFirebaseTimestamp()
                    };
                    
                    transaction.set(usageRef, newData);
                    return newData;
                } else {
                    // 기존 데이터 업데이트
                    const data = usageDoc.data();
                    const updatedData = {
                        totalMinutes: data.totalMinutes + minutes,
                        monthlyMinutes: data.monthlyMinutes + minutes,
                        updatedAt: window.firebaseSDK.getFirebaseTimestamp()
                    };
                    
                    transaction.update(usageRef, updatedData);
                    
                    return {
                        ...data,
                        ...updatedData
                    };
                }
            });
        } catch (error) {
            console.error('[FirebaseService] 사용량 업데이트 오류:', error);
            throw error;
        }
    }

    /**
     * 현재 사용량 가져오기
     * @returns {Promise<Object>} 사용량 정보
     */
    async getCurrentUsage() {
        try {
            if (!this.currentUser) {
                throw new Error('로그인이 필요합니다.');
            }
            
            const usageRef = this.db.collection(this.collections.USAGE).doc(this.currentUser.uid);
            const usageDoc = await usageRef.get();
            
            if (!usageDoc.exists) {
                // 기본값 반환
                return {
                    totalMinutes: 0,
                    monthlyMinutes: 0,
                    currentMonth: new Date().getMonth() + 1,
                    isLimitReached: false,
                    availableMinutes: 30 // 기본 무료 제한
                };
            }
            
            const usageData = usageDoc.data();
            const subscriptionInfo = await this.getSubscriptionInfo();
            
            // 한도 초과 여부 확인
            const isLimitReached = usageData.monthlyMinutes >= subscriptionInfo.minutesLimit;
            
            return {
                totalMinutes: usageData.totalMinutes || 0,
                monthlyMinutes: usageData.monthlyMinutes || 0,
                currentMonth: usageData.currentMonth || new Date().getMonth() + 1,
                isLimitReached: isLimitReached,
                availableMinutes: Math.max(0, subscriptionInfo.minutesLimit - usageData.monthlyMinutes)
            };
        } catch (error) {
            console.error('[FirebaseService] 사용량 가져오기 오류:', error);
            
            // 기본값 반환
            return {
                totalMinutes: 0,
                monthlyMinutes: 0,
                currentMonth: new Date().getMonth() + 1,
                isLimitReached: false,
                availableMinutes: 30
            };
        }
    }
}

// 글로벌 객체로 노출
window.FirebaseService = FirebaseService; 