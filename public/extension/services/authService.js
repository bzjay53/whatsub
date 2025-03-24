// 사용자 인증 및 구독 관리 서비스
const authService = {
    isInitialized: false,
    baseUrl: 'http://localhost:3000/api/auth',
    token: null,
    user: null,
    isAuthenticated: false,
    currentUser: null,
    permissions: {
        whisperAI: false,
        translation: false
    },
    usage: {
        whisperMinutes: 0,
        translationCharacters: 0
    },

    async initialize() {
        try {
            if (this.isInitialized) {
                window.debugLogger?.log('AuthService', 'initialize', '이미 초기화되어 있습니다.');
                return true;
            }

            // 저장된 토큰 확인
            const token = await this.getStoredToken();
            if (token) {
                const isValid = await this.validateToken(token);
                if (isValid) {
                    this.token = token;
                    this.isAuthenticated = true;
                    await this.fetchUserInfo();
                    window.debugLogger?.log('AuthService', 'initialize', '인증 초기화 완료');
                    this.isInitialized = true;
                    return true;
                }
            }

            this.isInitialized = true;
            window.debugLogger?.log('AuthService', 'initialize', '인증 없이 초기화됨');
            return true;
        } catch (error) {
            window.debugLogger?.error('AuthService', 'initialize', error);
            window.statusIndicator?.updateStatus('인증 서비스 초기화 실패', 'error');
            return false;
        }
    },

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('로그인 실패');
            }

            const data = await response.json();
            await this.storeToken(data.token);
            this.token = data.token;
            this.isAuthenticated = true;
            await this.fetchUserInfo();

            return { success: true };
        } catch (error) {
            console.error('로그인 오류:', error);
            return { success: false, error: error.message };
        }
    },

    async logout() {
        try {
            await chrome.storage.local.remove(['token', 'user']);
            this.token = null;
            this.user = null;
            this.isAuthenticated = false;
            return { success: true };
        } catch (error) {
            console.error('로그아웃 오류:', error);
            return { success: false, error: error.message };
        }
    },

    async validateToken(token) {
        try {
            const response = await fetch(`${this.baseUrl}/validate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('토큰 검증 오류:', error);
            return false;
        }
    },

    async fetchUserInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('사용자 정보를 가져올 수 없습니다.');
            }

            const user = await response.json();
            this.user = user;
            this.permissions = user.permissions;
            this.usage = user.usage;

            await chrome.storage.local.set({ user });
            return { success: true, user };
        } catch (error) {
            console.error('사용자 정보 조회 오류:', error);
            return { success: false, error: error.message };
        }
    },

    async getStoredToken() {
        try {
            const data = await chrome.storage.local.get(['token']);
            return data.token;
        } catch (error) {
            console.error('토큰 조회 오류:', error);
            return null;
        }
    },

    async storeToken(token) {
        try {
            await chrome.storage.local.set({ token });
            return true;
        } catch (error) {
            console.error('토큰 저장 오류:', error);
            return false;
        }
    },

    async canUseWhisperAI() {
        if (!this.isAuthenticated) {
            return false;
        }
        return this.permissions.whisperAI;
    },

    async getRemainingUsage() {
        if (!this.isAuthenticated) {
            return { whisperMinutes: 0, translationCharacters: 0 };
        }
        return this.usage;
    },

    async getApiKey() {
        try {
            const response = await fetch(`${this.baseUrl}/api-key`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('API 키를 가져올 수 없습니다.');
            }

            const data = await response.json();
            return data.apiKey;
        } catch (error) {
            console.error('API 키 조회 오류:', error);
            return null;
        }
    }
};

// 전역 객체에 등록
window.authService = authService;

// 초기화
authService.initialize(); 