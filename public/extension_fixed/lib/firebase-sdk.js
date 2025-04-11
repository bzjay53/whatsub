/**
 * Firebase SDK 통합 모듈
 * Google 로그인 및 사용량 추적을 위한 함수 제공
 */

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBH5WTiT7OyR9RPiWvmKjyLXolY3UGvnfo",
  authDomain: "whatsub-extension.firebaseapp.com",
  projectId: "whatsub-extension",
  storageBucket: "whatsub-extension.appspot.com",
  messagingSenderId: "1063753446688",
  appId: "1:1063753446688:web:8d2b3f5b3c3f9a3d8c4e4a",
  measurementId: "G-LJWLC0ER6E"
};

// Airtable API 사용
import { getAllUsers, getUserByEmail, createUser, updateUser, updateLastLogin, upsertUser, signIn, getAirtableHeaders, getAirtableUrl } from './airtable-api.js';
import { SUBSCRIPTION_PLANS, AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE_ID } from './airtable-config.js';

// 전역 변수
let currentUser = null;

// Firebase SDK 모의 객체 (실제 Firebase 라이브러리 대신 사용)
export const firebaseSDK = {
  apps: [],
  auth: () => ({
    currentUser: currentUser,
    onAuthStateChanged: (callback) => {
      // 인증 상태 변경 감지 시뮬레이션
      setTimeout(() => callback(currentUser), 0);
      // 리스너 정리 함수 반환
      return () => {};
    },
    signOut: () => {
      currentUser = null;
      return Promise.resolve();
    }
  }),
  firestore: () => {
    const firestoreInstance = {
      collection: (path) => ({
        doc: (id) => ({
          get: () => Promise.resolve({ exists: false, data: () => ({}) }),
          set: (data) => Promise.resolve(data),
          update: (data) => Promise.resolve(data),
          collection: (subPath) => ({
            add: (data) => Promise.resolve({ id: 'mock-id' }),
            get: () => Promise.resolve({ docs: [] })
          })
        }),
        add: (data) => Promise.resolve({ id: 'mock-id' }),
        where: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] })
        })
      })
    };
    
    firestoreInstance.FieldValue = {
      serverTimestamp: () => new Date().toISOString()
    };
    
    return firestoreInstance;
  }
};

// 초기화 함수
async function initialize() {
  try {
    // 스토리지에서 사용자 정보 로드
    await loadUserFromStorage();
    console.log('Airtable SDK 초기화 완료');
    return true;
  } catch (error) {
    console.error('초기화 오류:', error);
    return false;
  }
}

// 현재 로그인된 사용자 가져오기
export async function getCurrentUser() {
  try {
    const data = await chrome.storage.local.get('authToken');
    if (!data.authToken) {
      return null;
    }
    
    // 저장된 토큰으로 사용자 정보 요청
    const userInfo = await fetchUserInfo(data.authToken);
    
    return {
      uid: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture
    };
  } catch (error) {
    console.error('현재 사용자 정보 오류:', error);
    return null;
  }
}

// 초기화 시 스토리지에서 사용자 정보 로드
async function loadUserFromStorage() {
  try {
    const data = await chrome.storage.local.get(['user', 'authToken']);
    if (data.user) {
      currentUser = data.user;
    }
    return currentUser;
  } catch (error) {
    console.error('스토리지에서 사용자 정보 로드 오류:', error);
    return null;
  }
}

/**
 * Google 계정으로 로그인합니다.
 * chrome.identity API를 사용하여 인증 토큰을 얻고 사용자 정보를 반환합니다.
 * 기본적으로 interactive 옵션이 활성화되어 사용자가 계정 선택기를 통해 계정을 선택할 수 있습니다.
 * 
 * @param {boolean} silent 무음 모드로 로그인 시도 (사용자 상호작용 없음)
 * @returns {Promise<Object>} 성공 시 사용자 정보와 토큰, 실패 시 오류 정보가 포함된 객체
 */
export async function signInWithGoogle(silent = false) {
    console.log('[Whatsub] Google 로그인 시작...', silent ? '(무음 모드)' : '(상호작용 모드)');
    
    try {
        // 먼저 기존 인증 데이터를 모두 정리 (재로그인 시 문제 방지)
        try {
            console.log('[Whatsub] 기존 인증 데이터 정리 중...');
            await chrome.storage.local.remove([
                'whatsub_auth', 'auth', 'user', 'authToken', 
                'lastAuthState', 'loginState'
            ]);
            
            // 모든 캐시된 토큰 정리 (선택적)
            if (chrome.identity.clearAllCachedAuthTokens) {
                await new Promise(resolve => {
                    chrome.identity.clearAllCachedAuthTokens(() => {
                        console.log('[Whatsub] 모든 캐시된 토큰 정리 완료');
                        resolve();
                    });
                }).catch(err => {
                    console.warn('[Whatsub] 토큰 캐시 정리 오류 (무시):', err);
                });
            }
        } catch (clearError) {
            console.warn('[Whatsub] 기존 데이터 정리 오류 (계속 진행):', clearError);
        }
        
        // 1. 로컬 스토리지에서 기존 계정 확인 (자동 로그인 지원)
        const storedAuth = await chrome.storage.local.get(['whatsub_auth']);
        const lastEmail = storedAuth.whatsub_auth?.user?.email;
        
        if (lastEmail) {
            console.log(`[Whatsub] 마지막 로그인 계정: ${lastEmail} 확인 중...`);
        }
        
        // 2. 인증 토큰 획득
        const token = await new Promise((resolve, reject) => {
            // 오류 처리를 위한 래퍼 함수
            function handleAuthToken(token) {
                if (chrome.runtime.lastError) {
                    // 오류 처리 및 사용자 친화적인 메시지 생성
                    const error = chrome.runtime.lastError;
                    console.error('[Whatsub] 인증 토큰 획득 오류:', error.message);
                    
                    // 오류 메시지에 따라 적절한 오류 타입 할당
                    let errorType = 'unknown_error';
                    let errorMessage = error.message;
                    
                    if (error.message.includes('OAuth2 not granted')) {
                        errorType = 'permission_denied';
                        errorMessage = '사용자가 권한을 승인하지 않았습니다.';
                    } else if (error.message.includes('The user did not approve') || 
                              error.message.includes('canceled')) {
                        errorType = 'user_cancelled';
                        errorMessage = '사용자가 로그인을 취소했습니다.';
                    } else if (error.message.includes('Invalid credentials') || 
                              error.message.includes('OAuth client')) {
                        errorType = 'invalid_client';
                        errorMessage = '유효하지 않은 클라이언트 ID입니다. 확장 프로그램 설정을 확인하세요.';
                    } else if (error.message.includes('Failed to fetch') || 
                              error.message.includes('network')) {
                        errorType = 'network_error';
                        errorMessage = '네트워크 연결을 확인하세요.';
                    }
                    
                    reject({ errorType, error: errorMessage });
                    return;
                }
                
                if (!token) {
                    reject({ 
                        errorType: 'no_token', 
                        error: '인증 토큰을 획득하지 못했습니다.' 
                    });
                    return;
                }
                
                console.log('[Whatsub] 인증 토큰 획득 성공');
                resolve(token);
            }
            
            // 토큰 요청 전 캐시된 토큰 모두 제거 (선택적)
            if (chrome.identity.clearAllCachedAuthTokens) {
                console.log('[Whatsub] 캐시된 토큰 정리 시도...');
                chrome.identity.clearAllCachedAuthTokens(() => {
                    requestToken();
                });
            } else {
                requestToken();
            }
            
            // 토큰 요청 함수
            function requestToken() {
                chrome.identity.getAuthToken({ 
                    interactive: !silent, // 무음 모드에 따라 상호작용 옵션 설정
                    // login hint를 통해 이전 로그인 계정 제안
                    ...(lastEmail ? { loginHint: lastEmail } : {})
                }, handleAuthToken);
            }
        });
        
        // 3. 구글 사용자 정보 가져오기
        console.log('[Whatsub] 사용자 정보 요청 중...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            console.error('[Whatsub] 사용자 정보 요청 실패:', errorText);
            
            // 토큰이 유효하지 않으면 제거하고 다시 시도하도록 유도
            if (userInfoResponse.status === 401) {
                await new Promise(resolve => {
                    chrome.identity.removeCachedAuthToken({ token }, resolve);
                });
                throw { 
                    errorType: 'invalid_token', 
                    error: '인증 토큰이 만료되었습니다. 다시 로그인해주세요.' 
                };
            }
            
            throw { 
                errorType: 'user_info_failed', 
                error: `사용자 정보를 가져오지 못했습니다: ${userInfoResponse.status} ${errorText}` 
            };
        }
        
        // 4. 응답 파싱 및 사용자 정보 구성
        const userInfo = await userInfoResponse.json();
        console.log('[Whatsub] 사용자 정보 획득 성공:', userInfo.email);
        
        // 5. 표준 형식으로 사용자 정보 구성
        const user = {
            uid: userInfo.id,
            email: userInfo.email,
            emailVerified: userInfo.verified_email,
            displayName: userInfo.name,
            photoURL: userInfo.picture,
            lastLoginAt: new Date().toISOString()
        };
        
        // 6. 로컬 스토리지에 사용자 정보 및 토큰 저장 (자동 로그인용)
        const authData = {
            whatsub_auth: {
                user,
                token,
                loginTime: Date.now()
            },
            auth: {
                isAuthenticated: true,
                user,
                token
            },
            user: user,
            authToken: token
        };
        
        // 중요: 모든 관련 키에 일관되게 저장하여 불일치 방지
        await chrome.storage.local.set(authData);
        console.log('[Whatsub] 인증 정보 저장 완료');
        
        // 전역 상태 업데이트
        currentUser = user;
        
        // 8. 성공 응답 반환
        return {
            success: true,
            user,
            token,
            idToken: token,
            accessToken: token
        };
        
    } catch (error) {
        // 전체 로그인 프로세스의 예외 처리
        console.error('[Whatsub] 로그인 실패:', error);
        
        // 오류 시 로컬 인증 정보 정리 (불완전한 상태 방지)
        try {
            await chrome.storage.local.remove([
                'whatsub_auth', 'auth', 'user', 'authToken', 
                'lastAuthState', 'loginState'
            ]);
            currentUser = null;
        } catch (e) {
            console.warn('[Whatsub] 오류 정리 중 추가 문제:', e);
        }
        
        return {
            success: false,
            errorType: error.errorType || 'unknown_error',
            error: error.error || error.message || '알 수 없는 오류가 발생했습니다.'
        };
    }
}

// Google API에서 사용자 정보 가져오기
async function fetchUserInfo(accessToken) {
  try {
    console.log('사용자 정보 요청 시작...');
    
    if (!accessToken) {
      throw new Error('액세스 토큰이 없습니다');
    }
    
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API 응답 오류:', response.status, errorText);
      throw new Error(`사용자 정보 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    const userData = await response.json();
    
    if (!userData || !userData.email) {
      console.error('Google API 응답에 필수 사용자 정보가 없습니다:', userData);
      throw new Error('Google에서 반환된 사용자 정보가 유효하지 않습니다');
    }
    
    console.log('사용자 정보 요청 완료');
    return userData;
  } catch (error) {
    console.error('사용자 정보 요청 오류:', error);
    throw error;
  }
}

/**
 * 로그아웃 처리
 * 인증 토큰을 취소하고 사용자 데이터를 로컬 스토리지에서 제거합니다.
 * 
 * @param {boolean} force 강제 로그아웃 여부 (에러가 발생해도 로컬 데이터 정리)
 * @returns {Promise<Object>} 로그아웃 결과
 */
export async function signOut(force = false) {
    console.log('[Whatsub] 로그아웃 처리 시작...', force ? '(강제 모드)' : '');
    
    try {
        // 1. 인증 정보 확인 및 토큰 취소
        const authData = await chrome.storage.local.get(['whatsub_auth', 'authToken']);
        const token = authData.authToken || (authData.whatsub_auth && authData.whatsub_auth.token);
        
        // 1.1 토큰이 있으면 Google에 토큰 취소 요청
        if (token) {
            console.log('[Whatsub] 토큰 취소 시도...');
            try {
                // Google 토큰 취소 API 호출
                const revokeResponse = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                    method: 'GET'
                });
                
                if (revokeResponse.ok) {
                    console.log('[Whatsub] 토큰 취소 성공');
                } else {
                    console.warn('[Whatsub] 토큰 취소 실패:', await revokeResponse.text());
                }
            } catch (revokeError) {
                console.warn('[Whatsub] 토큰 취소 요청 오류 (계속 진행):', revokeError);
            }
        } else {
            console.log('[Whatsub] 취소할 토큰을 찾을 수 없음');
        }
        
        // 2. 모든 캐시된 토큰 정리
        if (chrome.identity.clearAllCachedAuthTokens) {
            try {
                await new Promise((resolve) => {
                    chrome.identity.clearAllCachedAuthTokens(() => {
                        console.log('[Whatsub] 모든 캐시된 토큰 정리 완료');
                        resolve();
                    });
                });
            } catch (clearError) {
                console.warn('[Whatsub] 캐시 토큰 정리 오류 (계속 진행):', clearError);
            }
        }
        
        // 3. 모든 스토리지 데이터 강제 정리
        const keysToRemove = [
            'whatsub_auth', 'auth', 'user', 'authToken', 
            'lastAuthState', 'loginState', 'whatsub_user',
            'whatsub_settings', 'lastLoginEmail'
        ];
        
        // 단일 호출로 모든 키 제거 시도
        await chrome.storage.local.remove(keysToRemove);
        console.log('[Whatsub] 로컬 스토리지 인증 데이터 정리 완료');
        
        // 4. 현재 사용자 null로 설정
        currentUser = null;
        
        // 5. 인증 상태 변경 이벤트 브로드캐스트
        try {
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'authStateChanged',
                    data: { 
                        isAuthenticated: false,
                        user: null
                    }
                }, () => {
                    // 리스너가 없을 수 있으므로 응답이 없어도 계속 진행
                    resolve();
                });
                
                // 최대 500ms 대기 후 진행
                setTimeout(resolve, 500);
            });
        } catch (eventError) {
            console.warn('[Whatsub] 이벤트 전파 오류 (계속 진행):', eventError);
        }
        
        // 6. 이중 확인: 스토리지가 정리되었는지 확인
        const checkData = await chrome.storage.local.get(['whatsub_auth', 'auth', 'user', 'authToken']);
        if (checkData.whatsub_auth || checkData.auth || checkData.user || checkData.authToken) {
            console.warn('[Whatsub] 스토리지 정리가 불완전함, 재시도...');
            await chrome.storage.local.remove(['whatsub_auth', 'auth', 'user', 'authToken']);
        }
        
        console.log('[Whatsub] 로그아웃 처리 성공적으로 완료');
        return { success: true };
        
    } catch (error) {
        console.error('[Whatsub] 로그아웃 중 오류 발생:', error);
        
        // 강제 로그아웃인 경우 로컬 스토리지 데이터 강제 정리
        if (force) {
            try {
                await chrome.storage.local.remove([
                    'whatsub_auth', 'auth', 'user', 'authToken', 
                    'lastAuthState', 'loginState', 'whatsub_user',
                    'whatsub_settings'
                ]);
                currentUser = null;
                console.log('[Whatsub] 강제 로그아웃: 로컬 스토리지 정리 완료');
            } catch (e) {
                console.error('[Whatsub] 강제 로그아웃 중 오류:', e);
            }
        }
        
        return {
            success: false,
            error: error.message || '로그아웃 중 오류가 발생했습니다.'
        };
    }
}

// Airtable에서 사용자 확인 및 생성
async function checkAndCreateUserInAirtable(user) {
  if (!user || !user.email) {
    console.error('유효하지 않은 사용자 데이터입니다. 이메일이 필요합니다.');
    return false;
  }

  try {
    // 사용자 이메일로 Airtable에서 검색
    const airtableUser = await getUserByEmail(user.email);
    
    if (airtableUser) {
      console.log('기존 Airtable 사용자 확인:', user.email);
      
      // 기존 사용자인 경우 로그인 시간 업데이트
      await updateLastLogin(airtableUser.id);
      
      // 사용자 정보에 Airtable ID 추가
      user.airtableId = airtableUser.id;
      return true;
    } else {
      console.log('새 Airtable 사용자 생성:', user.email);
      
      // 새 사용자인 경우 Airtable에 추가
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Airtable 필드 이름 형식에 맞게 데이터 구성
        const userData = {
          Email: user.email,
          Name: user.name || '',
          'Profile Picture': user.photoURL || '',
          'Last Login': today,
          'Subscription Type': 'free',
          'Whisper Minutes Used': 0,
          'Translation Characters Used': 0
        };
        
        const newUser = await createUser(userData);
        
        if (newUser) {
          user.airtableId = newUser.id;
          return true;
        } else {
          console.warn('사용자 생성 실패:', user.email);
          return false;
        }
      } catch (createError) {
        console.error('사용자 생성 중 오류:', createError);
        return false;
      }
    }
  } catch (error) {
    console.error('Airtable 사용자 확인 오류:', error);
    return false;
  }
}

/**
 * 사용자의 구독 상태 확인
 * @param {string} email - 사용자 이메일
 * @returns {Promise<string>} - 구독 유형 (free, pro, enterprise)
 */
export async function checkSubscription(email) {
  try {
    // TODO: 이후 실제 구독 데이터베이스 연동
    console.log('[Firebase] 구독 정보 확인:', email);
    
    // 현재는 이메일 도메인 기준으로 기본 구독 타입 설정 (테스트용)
    if (email.endsWith('.edu') || email.endsWith('.ac.kr')) {
      return 'academic';
    } else if (email.includes('enterprise') || email.includes('business')) {
      return 'enterprise';
    } else if (email.includes('test') || email.includes('premium')) {
      return 'premium';
    }
    
    return 'free';
  } catch (error) {
    console.error('[Firebase] 구독 확인 오류:', error);
    return 'free'; // 기본값
  }
}

// 사용량 업데이트 함수
export async function updateUsage(email, type, amount) {
  try {
    if (!email || !type || amount === undefined) {
      console.error('유효하지 않은 매개변수입니다:', {email, type, amount});
      throw new Error('유효하지 않은 매개변수입니다.');
    }
    
    // 지원되는 유형 검사
    if (type !== 'whisper' && type !== 'translation') {
      console.error('지원되지 않는 사용량 유형입니다:', type);
      throw new Error('지원되지 않는 사용량 유형입니다.');
    }
    
    console.log(`사용량 업데이트 시도: ${email}, ${type}, ${amount}`);
    
    // 에어테이블에서 사용자 찾기
    const user = await getUserByEmail(email);
    console.log('사용량 업데이트를 위한 사용자 조회 결과:', user ? 'User found' : 'User not found');
    
    if (user && user.id) {
      console.log('기존 사용자 사용량 업데이트:', user.id);
      
      // 현재 사용량 가져오기
      let whisperUsed = user.fields.whisperMinutesUsed || 0;
      let translationUsed = user.fields.translationCharactersUsed || 0;
      
      // 새 사용량 계산
      const updateFields = {};
      if (type === 'whisper') {
        const newWhisperUsed = Number(whisperUsed) + Number(amount);
        updateFields['Whisper Minutes Used'] = newWhisperUsed;
        console.log(`Whisper 사용량 업데이트: ${whisperUsed} + ${amount} = ${newWhisperUsed}`);
      } else if (type === 'translation') {
        const newTranslationUsed = Number(translationUsed) + Number(amount);
        updateFields['Translation Characters Used'] = newTranslationUsed;
        console.log(`번역 사용량 업데이트: ${translationUsed} + ${amount} = ${newTranslationUsed}`);
      }
      
      // 로컬 스토리지 업데이트
      try {
        const data = await chrome.storage.local.get('usage');
        const usage = data.usage || {
          whisper: { used: 0, limit: 60 },
          translation: { used: 0, limit: 5000 }
        };
        
        if (type === 'whisper') {
          usage.whisper.used = Number(usage.whisper.used) + Number(amount);
        } else if (type === 'translation') {
          usage.translation.used = Number(usage.translation.used) + Number(amount);
        }
        
        await chrome.storage.local.set({ usage });
        console.log('로컬 스토리지 사용량 업데이트 완료');
      } catch (storageError) {
        console.error('로컬 스토리지 업데이트 오류:', storageError);
      }
      
      // 사용자 정보 업데이트
      const updated = await updateUser(user.id, updateFields);
      console.log('사용량 업데이트 결과:', updated ? '성공' : '실패');
      return { success: !!updated, type, amount };
    } else {
      // 사용자가 없는 경우 새로 생성
      console.log('사용자를 찾을 수 없어 새로 생성합니다:', email);
      
      const userData = {
        Email: email,
        'Subscription Type': 'free'
      };
      
      if (type === 'whisper') {
        userData['Whisper Minutes Used'] = Number(amount);
      } else if (type === 'translation') {
        userData['Translation Characters Used'] = Number(amount);
      }
      
      // 로컬 스토리지 업데이트
      try {
        const data = await chrome.storage.local.get('usage');
        const usage = data.usage || {
          whisper: { used: 0, limit: 60 },
          translation: { used: 0, limit: 5000 }
        };
        
        if (type === 'whisper') {
          usage.whisper.used = Number(amount);
        } else if (type === 'translation') {
          usage.translation.used = Number(amount);
        }
        
        await chrome.storage.local.set({ usage });
        console.log('새 사용자 로컬 스토리지 사용량 설정 완료');
      } catch (storageError) {
        console.error('로컬 스토리지 업데이트 오류:', storageError);
      }
      
      // 새 사용자 생성
      const newUser = await createUser(userData);
      console.log('새 사용자 생성 결과:', newUser ? '성공' : '실패');
      return { success: !!newUser, type, amount };
    }
  } catch (error) {
    console.error('사용량 업데이트 오류:', error);
    throw error;
  }
}

// 현재 사용자가 기능을 사용할 수 있는지 확인
export async function canUseFeature(feature) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return {
        canUse: false,
        message: '로그인이 필요합니다'
      };
    }
    
    // 구독 상태 확인
    const subscription = await checkSubscription(user.email);
    
    // 사용량 확인을 위한 로컬 데이터 로드
    const data = await chrome.storage.local.get('usage');
    const usage = data.usage || {
      whisper: { used: 0, limit: 60 },
      translation: { used: 0, limit: 5000 }
    };
    
    // 구독 유형에 따른 제한 설정
    if (subscription === 'premium') {
      usage.whisper.limit = SUBSCRIPTION_PLANS.premium.whisperLimit;
      usage.translation.limit = SUBSCRIPTION_PLANS.premium.translationLimit;
    } else {
      usage.whisper.limit = SUBSCRIPTION_PLANS.free.whisperLimit;
      usage.translation.limit = SUBSCRIPTION_PLANS.free.translationLimit;
    }
    
    // 무료 사용자의 경우 각 기능별 제한 확인
    switch (feature) {
      case 'whisper':
        if (subscription !== 'premium' && usage.whisper.used >= usage.whisper.limit) {
          return {
            canUse: false,
            message: '무료 Whisper AI 사용량을 모두 소진했습니다',
            subscription,
            usage
          };
        }
        break;
      case 'translation':
        if (subscription !== 'premium' && usage.translation.used >= usage.translation.limit) {
          return {
            canUse: false,
            message: '무료 번역 사용량을 모두 소진했습니다',
            subscription,
            usage
          };
        }
        break;
    }
    
    return {
      canUse: true,
      subscription,
      usage
    };
  } catch (error) {
    console.error('기능 사용 가능 여부 확인 오류:', error);
    return {
      canUse: false,
      message: '오류가 발생했습니다'
    };
  }
}

// 초기화
initialize(); 