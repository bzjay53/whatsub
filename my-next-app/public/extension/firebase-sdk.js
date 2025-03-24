/**
 * Google OAuth 로그인 처리 함수
 * 확장 프로그램에서 Google 로그인을 처리합니다.
 * 
 * @return {Promise<Object>} 로그인 결과를 포함하는 객체
 */
async function signInWithGoogle() {
    try {
        console.log('[Firebase] Google 로그인 시작...');
        
        // manifest.json에서 OAuth 클라이언트 ID 가져오기
        const manifestData = await fetch(chrome.runtime.getURL('manifest.json'))
            .then(response => response.json());
        
        const clientId = manifestData.oauth2?.client_id || 'YOUR_OAUTH_CLIENT_ID';
        
        // 클라이언트 ID가 기본값인 경우 오류 처리
        if (clientId === 'YOUR_OAUTH_CLIENT_ID') {
            console.error('OAuth 클라이언트 ID가 설정되지 않았습니다.');
            return { 
                success: false, 
                error: 'invalid_client', 
                message: 'OAuth 클라이언트 ID가 설정되지 않았습니다. manifest.json 파일에서 oauth2.client_id를 설정해주세요.' 
            };
        }
        
        console.log('[Firebase] 사용할 클라이언트 ID:', clientId);
        
        // 리디렉션 URL 가져오기
        const redirectUrl = chrome.identity.getRedirectURL('oauth2');
        console.log('[Firebase] 리디렉션 URL:', redirectUrl);
        
        // 리디렉션 URL이 Google 개발자 콘솔에 설정된 리디렉션 URI와 일치하는지 확인
        console.log('[Firebase] Google 개발자 콘솔에 다음 리디렉션 URI가 등록되어 있는지 확인하세요:', redirectUrl);
        
        // OAuth 인증 URL 생성 (URL API 사용)
        const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
        authUrl.searchParams.append('client_id', clientId);
        authUrl.searchParams.append('response_type', 'token');
        authUrl.searchParams.append('redirect_uri', redirectUrl);
        authUrl.searchParams.append('scope', 'openid email profile');
        
        console.log('[Firebase] 인증 시작 URL:', authUrl.toString());
        
        // Chrome Identity API를 사용하여 로그인
        console.log('[Firebase] OAuth 인증 흐름 시작...');
        const responseUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true
            }, (redirectUrl) => {
                // chrome.runtime.lastError 확인 (Chrome API 특화 에러 처리)
                if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || '인증 흐름 오류';
                    console.error('[Firebase] OAuth 흐름 오류:', errorMessage);
                    
                    // 사용자 취소 감지
                    if (errorMessage.includes('canceled')) {
                        reject(new Error('사용자가 로그인을 취소했습니다.'));
                        return;
                    }
                    
                    reject(new Error(`인증 흐름 오류: ${errorMessage}`));
                    return;
                }
                
                if (!redirectUrl) {
                    console.error('[Firebase] 리디렉션 URL이 비어 있습니다.');
                    reject(new Error('리디렉션 URL이 비어 있습니다. 사용자가 로그인을 취소했을 수 있습니다.'));
                    return;
                }
                
                resolve(redirectUrl);
            });
        });
        
        if (!responseUrl) {
            console.error('[Firebase] 로그인 응답 URL이 없습니다.');
            return {
                success: false,
                error: '사용자가 로그인을 취소했거나 응답이 없습니다.',
                errorType: 'no_response'
            };
        }
        
        console.log('[Firebase] 인증 응답 받음, 토큰 파싱 중...');
        
        // 응답 URL에서 토큰 파싱
        const url = new URL(responseUrl);
        const params = new URLSearchParams(url.hash.substring(1));
        const token = params.get('access_token');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        if (error) {
            console.error('[Firebase] OAuth 오류:', error, errorDescription || '');
            
            // 일반적인 OAuth 오류 처리
            if (error === 'access_denied') {
                return {
                    success: false,
                    error: '사용자가 로그인을 취소했습니다.',
                    errorType: 'access_denied'
                };
            } else if (error === 'invalid_client') {
                return {
                    success: false,
                    error: 'OAuth 클라이언트 ID가 유효하지 않습니다. Google 개발자 콘솔에서 클라이언트 ID를 확인하고 manifest.json 파일을 업데이트하세요.',
                    errorType: 'invalid_client',
                    invalidClientId: true
                };
            } else if (error === 'redirect_uri_mismatch') {
                console.error('[Firebase] 리디렉션 URI 불일치 오류:', redirectUrl);
                return {
                    success: false,
                    error: 'Google 개발자 콘솔의 리디렉션 URI 설정이 일치하지 않습니다. 다음 URI를 Google 개발자 콘솔의 OAuth 리디렉션 URI에 추가하세요: ' + redirectUrl,
                    errorType: 'redirect_uri_mismatch',
                    redirectUri: redirectUrl
                };
            }
            
            // 기타 오류 처리
            return {
                success: false,
                error: errorDescription ? `${error}: ${errorDescription}` : `OAuth 오류: ${error}`,
                errorType: error
            };
        }
        
        if (!token) {
            console.error('[Firebase] 토큰을 가져올 수 없습니다.');
            return {
                success: false,
                error: '인증 토큰을 가져올 수 없습니다. 응답에 액세스 토큰이 포함되어 있지 않습니다.',
                errorType: 'no_token'
            };
        }
        
        console.log('[Firebase] 액세스 토큰 획득 성공, 사용자 정보 요청 중...');
        
        // 토큰으로 사용자 정보 가져오기
        const userInfo = await fetchUserInfo(token);
        
        if (!userInfo || !userInfo.email) {
            console.error('[Firebase] 사용자 정보를 가져올 수 없습니다.');
            return {
                success: false,
                error: '사용자 정보를 가져올 수 없습니다. 토큰이 유효하지 않거나 만료되었을 수 있습니다.',
                errorType: 'user_info_failed'
            };
        }
        
        // 사용자 객체 구성
        const user = {
            uid: userInfo.sub,
            email: userInfo.email,
            displayName: userInfo.name,
            photoURL: userInfo.picture,
            provider: 'google',
            subscription: 'free',
            usageLimit: 100,
            usageCount: 0
        };
        
        console.log('[Firebase] 사용자 로그인 성공:', user.email);
        
        return {
            success: true,
            user: user,
            token: token
        };
    } catch (error) {
        console.error('[Firebase] Google 로그인 오류:', error);
        return {
            success: false,
            error: error.message || '로그인 중 오류가 발생했습니다.',
            errorType: 'unknown_error',
            originalError: error
        };
    }
}

/**
 * 사용자 정보 가져오기
 * Google 사용자 정보 API에서 사용자 프로필을 가져옵니다.
 * 
 * @param {string} token - 액세스 토큰
 * @return {Promise<Object|null>} 사용자 정보 객체
 */
async function fetchUserInfo(token) {
    try {
        if (!token) {
            console.error('[Firebase] 사용자 정보 조회: 토큰이 제공되지 않았습니다.');
            return null;
        }
        
        // 토큰 유효성 확인 (기본 검증)
        if (typeof token !== 'string' || token.length < 10) {
            console.error('[Firebase] 사용자 정보 조회: 유효하지 않은 토큰 형식입니다.');
            return null;
        }
        
        // Google userinfo 엔드포인트에 요청
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Firebase] 사용자 정보 요청 실패:', response.status, errorText);
            return null;
        }
        
        // 응답 파싱
        const userInfo = await response.json();
        
        if (!userInfo || !userInfo.email) {
            console.error('[Firebase] 사용자 정보가 불완전합니다.');
            return null;
        }
        
        console.log('[Firebase] 사용자 정보 가져오기 성공:', userInfo.email);
        return userInfo;
    } catch (error) {
        console.error('[Firebase] 사용자 정보 가져오기 오류:', error);
        return null;
    }
}

/**
 * 로그아웃 처리 함수
 * @returns {Object} 로그아웃 결과
 */
function signOut() {
    try {
        // 로컬 스토리지에서 사용자 정보 제거
        chrome.storage.local.remove(['user', 'authState'], () => {
            console.log('로그아웃: 사용자 정보가 삭제되었습니다.');
        });
        
        return {
            success: true,
            message: '로그아웃되었습니다.'
        };
    } catch (error) {
        console.error('로그아웃 처리 중 오류 발생:', error);
        return {
            success: false,
            error: 'signout_failed',
            message: error.message || '로그아웃 처리 중 오류가 발생했습니다.'
        };
    }
}

/**
 * 사용자 인증 상태 확인
 * @returns {Promise<Object>} 인증 상태 및 사용자 정보
 */
async function checkAuth() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['user', 'authState'], (result) => {
            if (result.user && result.authState === 'authenticated') {
                resolve({
                    isLoggedIn: true,
                    user: result.user
                });
            } else {
                resolve({
                    isLoggedIn: false,
                    user: null
                });
            }
        });
    });
}

/**
 * 액세스 토큰 유효성 검사 (필요시 구현)
 * @param {string} accessToken 검증할 액세스 토큰
 * @returns {Promise<boolean>} 토큰 유효성 결과
 */
async function validateToken(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_token: accessToken })
        });
        
        const data = await response.json();
        return !data.error;
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        return false;
    }
}

/**
 * 사용자 사용량 정보 가져오기
 * @returns {Promise<Object>} 사용량 정보
 */
async function getUserUsage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['usage'], (result) => {
            const defaultUsage = {
                minutes: 0,
                totalMinutes: 60,
                percentage: 0,
                lastUpdated: new Date().toISOString()
            };
            
            if (result.usage) {
                // 날짜 확인 - 오늘 날짜와 다르면 초기화
                const lastUpdated = new Date(result.usage.lastUpdated);
                const today = new Date();
                
                if (lastUpdated.toDateString() !== today.toDateString()) {
                    chrome.storage.local.set({ usage: defaultUsage });
                    resolve({
                        success: true,
                        usage: defaultUsage
                    });
                } else {
                    resolve({
                        success: true,
                        usage: result.usage
                    });
                }
            } else {
                chrome.storage.local.set({ usage: defaultUsage });
                resolve({
                    success: true,
                    usage: defaultUsage
                });
            }
        });
    });
}

/**
 * 사용량 업데이트
 * @param {number} minutes 추가할 분 수
 * @returns {Promise<Object>} 업데이트된 사용량 정보
 */
async function updateUsage(minutes) {
    const { usage } = await getUserUsage();
    
    // 사용량 업데이트
    const updatedUsage = {
        ...usage,
        minutes: usage.minutes + minutes,
        percentage: Math.min(100, ((usage.minutes + minutes) / usage.totalMinutes) * 100),
        lastUpdated: new Date().toISOString()
    };
    
    return new Promise((resolve) => {
        chrome.storage.local.set({ usage: updatedUsage }, () => {
            resolve({
                success: true,
                usage: updatedUsage
            });
        });
    });
}

// 모듈 내보내기
export {
    signInWithGoogle,
    signOut,
    checkAuth,
    validateToken,
    getUserUsage,
    updateUsage
}; 