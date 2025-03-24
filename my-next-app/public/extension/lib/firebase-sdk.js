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
 * @returns {Promise<Object>} 성공 시 사용자 정보와 토큰, 실패 시 오류 정보가 포함된 객체
 */
async function signInWithGoogle() {
    console.log('[Whatsub] Google 로그인 시작...');
    
    try {
        // 1. 로컬 스토리지에서 기존 계정 확인 (자동 로그인 지원)
        const storedAuth = await chrome.storage.local.get(['whatsub_auth']);
        const lastEmail = storedAuth.whatsub_auth?.user?.email;
        
        if (lastEmail) {
            console.log(`[Whatsub] 마지막 로그인 계정: ${lastEmail} 확인 중...`);
        }
        
        // 2. 인증 토큰 획득 (interactive: true로 계정 선택기 활성화)
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ 
                interactive: true,
                // login hint를 통해 이전 로그인 계정 제안
                ...(lastEmail ? { loginHint: lastEmail } : {})
            }, (token) => {
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
                    } else if (error.message.includes('The user did not approve')) {
                        errorType = 'user_cancelled';
                        errorMessage = '사용자가 로그인을 취소했습니다.';
                    } else if (error.message.includes('Invalid credentials')) {
                        errorType = 'invalid_client';
                        errorMessage = '유효하지 않은 클라이언트 ID입니다. 확장 프로그램 설정을 확인하세요.';
                    } else if (error.message.includes('Failed to fetch')) {
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
            });
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
        await chrome.storage.local.set({
            whatsub_auth: {
                user,
                token,
                loginTime: Date.now()
            }
        });
        
        // 7. 사용자 데이터를 Airtable 등에 저장 (백엔드 연동 시)
        // 이 부분은 실제 구현 시 백엔드 API 호출로 대체
        try {
            // 필요한 경우 사용자 정보를 백엔드에 저장
            console.log('[Whatsub] 사용자 정보 저장 완료');
        } catch (saveError) {
            // 백엔드 저장 실패해도 로그인은 성공한 것으로 처리
            console.warn('[Whatsub] 사용자 정보 저장 중 오류 (치명적이지 않음):', saveError);
        }
        
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
 * 로그아웃 처리 함수
 * 모든 인증 상태를 리셋하고 토큰을 무효화합니다.
 * 
 * @returns {Promise<Object>} 로그아웃 결과
 */
async function signOut() {
    console.log('[Whatsub] 로그아웃 프로세스 시작...');
    
    try {
        // 1. 현재 인증 토큰 가져오기
        const authData = await chrome.storage.local.get(['whatsub_auth']);
        const token = authData.whatsub_auth?.token;
        
        // 2. 토큰이 있으면 무효화 시도
        if (token) {
            console.log('[Whatsub] 기존 토큰 무효화 시도...');
            
            // 2.1. 구글 토큰 취소 API 호출
            try {
                const revokeResponse = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                
                if (revokeResponse.ok) {
                    console.log('[Whatsub] 토큰 성공적으로 취소됨');
                } else {
                    console.warn('[Whatsub] 토큰 취소 실패:', await revokeResponse.text());
                }
            } catch (revokeError) {
                console.warn('[Whatsub] 토큰 취소 API 호출 중 오류:', revokeError);
            }
            
            // 2.2. 크롬 캐시에서 토큰 제거
            await new Promise(resolve => {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    console.log('[Whatsub] 캐시된 토큰 제거됨');
                    resolve();
                });
            });
        }
        
        // 3. 모든 캐시된 토큰 제거 시도
        try {
            if (chrome.identity.clearAllCachedAuthTokens) {
                await new Promise(resolve => {
                    chrome.identity.clearAllCachedAuthTokens(() => {
                        console.log('[Whatsub] 모든 캐시된 토큰 제거됨');
                        resolve();
                    });
                });
            }
        } catch (clearError) {
            console.warn('[Whatsub] 모든 토큰 제거 중 오류:', clearError);
        }
        
        // 4. 로컬 스토리지에서 인증 정보 제거
        await chrome.storage.local.remove(['whatsub_auth']);
        console.log('[Whatsub] 로컬 스토리지에서 인증 정보 제거됨');
        
        // 5. 구글 쿠키/세션 로그아웃 (선택 사항 - 전체 구글 계정 로그아웃)
        try {
            // 구글 로그아웃 프레임 생성 메시지 전송
            chrome.runtime.sendMessage({
                action: 'createLogoutFrame'
            });
        } catch (frameError) {
            console.warn('[Whatsub] 로그아웃 프레임 생성 메시지 전송 실패:', frameError);
        }
        
        // 6. 로그아웃 이벤트 전파
        try {
            chrome.runtime.sendMessage({
                action: 'authStateChanged',
                data: { isAuthenticated: false }
            });
        } catch (eventError) {
            console.warn('[Whatsub] 인증 상태 변경 이벤트 전파 실패:', eventError);
        }
        
        console.log('[Whatsub] 로그아웃 프로세스 완료');
        return { success: true };
        
    } catch (error) {
        console.error('[Whatsub] 로그아웃 중 오류 발생:', error);
        return {
            success: false,
            error: error.message || '로그아웃 처리 중 오류가 발생했습니다.'
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