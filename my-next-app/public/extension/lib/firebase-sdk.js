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
 * Google OAuth2를 사용한 로그인 처리 - chrome.identity.getAuthToken 사용
 * @returns {Promise<{success: boolean, user: object, idToken: string, error: string}>}
 */
export async function signInWithGoogle() {
  try {
    console.log('[Firebase] Google 로그인 시작 (chrome.identity.getAuthToken 사용)');
    
    // Chrome identity API를 사용하여 인증 토큰 획득
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        // 오류 처리
        if (chrome.runtime.lastError) {
          console.error('[Firebase] OAuth 흐름 오류:', chrome.runtime.lastError.message);
          
          let errorMessage = chrome.runtime.lastError.message;
          let errorType = 'unknown_error';
          
          if (errorMessage.includes('The user did not approve access')) {
            errorMessage = '사용자가 로그인을 취소했거나 접근을 승인하지 않았습니다.';
            errorType = 'user_canceled';
          } else if (errorMessage.includes('OAuth2 not granted')) {
            errorMessage = 'OAuth 권한이 부여되지 않았습니다.';
            errorType = 'not_granted';
          } else if (errorMessage.includes('Authorization page could not be loaded')) {
            errorMessage = '인증 페이지를 로드할 수 없습니다. 네트워크 연결을 확인하세요.';
            errorType = 'network_error';
          }
          
          resolve({
            success: false,
            error: errorMessage,
            errorType: errorType
          });
          return;
        }
        
        if (!token) {
          console.error('[Firebase] 인증 토큰이 없습니다.');
          resolve({
            success: false,
            error: '인증 토큰을 가져올 수 없습니다.',
            errorType: 'no_token'
          });
          return;
        }
        
        console.log('[Firebase] 인증 토큰 획득 성공');
        
        try {
          // 토큰으로 사용자 정보 가져오기
          const userInfoResponse = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo', 
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (!userInfoResponse.ok) {
            console.error('[Firebase] 사용자 정보 요청 실패:', userInfoResponse.statusText);
            resolve({
              success: false,
              error: '사용자 정보를 가져오지 못했습니다.',
              errorType: 'userinfo_failed'
            });
            return;
          }
          
          const userInfo = await userInfoResponse.json();
          
          // 사용자 정보 구성
          const user = {
            uid: userInfo.id,
            email: userInfo.email,
            emailVerified: userInfo.verified_email,
            displayName: userInfo.name,
            photoURL: userInfo.picture,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            subscription: 'free'  // 기본 구독 플랜
          };
          
          // 로컬 스토리지에 토큰과 사용자 정보 저장
          await chrome.storage.local.set({ authToken: token, user: user });
          
          console.log('[Firebase] 로그인 성공:', user.email);
          
          // Airtable에 사용자 정보 저장 (필요한 경우)
          try {
            await checkAndCreateUserInAirtable(user);
          } catch (airtableError) {
            console.warn('[Firebase] Airtable 사용자 저장 오류 (무시됨):', airtableError);
          }
          
          resolve({
            success: true,
            user,
            token,
            idToken: token,
            accessToken: token
          });
          
        } catch (error) {
          console.error('[Firebase] 사용자 정보 처리 오류:', error);
          resolve({
            success: false,
            error: '사용자 정보 처리 중 오류가 발생했습니다.',
            errorType: 'process_error'
          });
        }
      });
    });
    
  } catch (error) {
    console.error('[Firebase] Google 로그인 오류:', error);
    return {
      success: false,
      error: error.message,
      errorType: 'exception'
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
 * @returns {Promise<{success: boolean, error: string}>}
 */
export async function signOut() {
  try {
    console.log('[Firebase] 로그아웃 시작...');
    
    // 1. 로컬 스토리지에서 인증 데이터 제거
    try {
      await chrome.storage.local.remove(['authToken', 'user']);
      console.log('[Firebase] 로컬 스토리지에서 인증 정보 제거됨');
    } catch (storageError) {
      console.warn('[Firebase] 로컬 스토리지에서 인증 정보 제거 중 오류:', storageError);
    }
    
    // 2. 인증 토큰 제거
    if (chrome.identity && chrome.identity.getAuthToken) {
      try {
        await new Promise((resolve) => {
          chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) {
              chrome.identity.removeCachedAuthToken({ token }, () => {
                console.log('[Firebase] 캐시된 인증 토큰 제거됨');
                resolve();
              });
            } else {
              console.log('[Firebase] 제거할 캐시된 토큰 없음');
              resolve();
            }
          });
        });
      } catch (tokenError) {
        console.warn('[Firebase] 토큰 제거 중 오류:', tokenError);
      }
    }
    
    // 3. Google에서 로그아웃 (선택적)
    try {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://accounts.google.com/logout';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // 3초 후 iframe 제거
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    } catch (logoutError) {
      console.warn('[Firebase] Google 로그아웃 iframe 생성 중 오류:', logoutError);
    }
    
    console.log('[Firebase] 로그아웃 완료');
    return {
      success: true
    };
  } catch (error) {
    console.error('[Firebase] 로그아웃 중 오류 발생:', error);
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