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

// Google 로그인 함수
export async function signInWithGoogle() {
  try {
    console.log('Google 로그인 시작...');
    
    // OAuth 클라이언트 ID를 manifest에서 가져오기
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;
    
    console.log('OAuth 클라이언트 ID:', clientId);
    
    if (!clientId || clientId.trim() === '') {
      console.error('유효한 OAuth 클라이언트 ID가 없습니다');
      throw new Error('OAuth 클라이언트 ID가 설정되지 않았습니다');
    }
    
    // 확장 프로그램 ID 가져오기
    const extensionId = chrome.runtime.id;
    console.log('확장 프로그램 ID:', extensionId);
    
    // 리다이렉트 URL 생성 및 확인
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log('리다이렉트 URL:', redirectUrl);
    
    // OAuth 2.0 인증 플로우 시작
    const authParams = {
      client_id: clientId,
      response_type: 'token',
      redirect_uri: redirectUrl,
      scope: 'email profile',
      // 항상 동의 화면을 표시하도록 설정
      prompt: 'consent'
    };
    
    // URL 파라미터 생성
    const queryParams = Object.keys(authParams)
      .map(key => `${key}=${encodeURIComponent(authParams[key])}`)
      .join('&');
    
    // 인증 URL 생성
    const authUrl = `https://accounts.google.com/o/oauth2/auth?${queryParams}`;
    
    console.log('인증 URL:', authUrl);
    
    // Chrome 인증 API 호출
    const responseUrl = await new Promise((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          { 
            url: authUrl, 
            interactive: true 
          },
          (redirectUrl) => {
            // chrome.runtime.lastError 확인
            if (chrome.runtime.lastError) {
              console.error('인증 플로우 오류:', chrome.runtime.lastError);
              
              // 사용자가 창을 닫았거나 취소한 경우
              if (chrome.runtime.lastError.message.includes("not approve") || 
                  chrome.runtime.lastError.message.includes("user cancelled") || 
                  chrome.runtime.lastError.message.includes("canceled")) {
                reject(new Error('사용자가 로그인을 취소했습니다. 다시 시도해주세요.'));
              } else {
                reject(new Error(`인증 오류: ${chrome.runtime.lastError.message}`));
              }
              return;
            }
            
            if (!redirectUrl) {
              console.error('리다이렉트 URL이 비어있습니다');
              reject(new Error('인증 프로세스가 취소되었습니다. 다시 시도해주세요.'));
              return;
            }
            
            console.log('인증 리다이렉트 URL 수신:', redirectUrl);
            resolve(redirectUrl);
          }
        );
      } catch (error) {
        console.error('launchWebAuthFlow 실행 오류:', error);
        reject(new Error(`인증 프로세스 시작 오류: ${error.message}`));
      }
    });
    
    // 액세스 토큰 추출
    const urlParts = responseUrl.split('#');
    
    if (urlParts.length < 2) {
      console.error('유효하지 않은 리다이렉트 URL:', responseUrl);
      throw new Error('인증 응답에서 토큰을 찾을 수 없습니다. 다시 시도해주세요.');
    }
    
    const params = new URLSearchParams(urlParts[1]);
    const accessToken = params.get('access_token');
    const errorParam = params.get('error');
    
    if (errorParam) {
      console.error('OAuth 인증 오류:', errorParam);
      
      // 접근 거부 오류에 대해 더 친절한 메시지
      if (errorParam === 'access_denied') {
        throw new Error('Google 계정 접근이 거부되었습니다. 로그인을 위해 접근 권한을 허용해주세요.');
      }
      
      throw new Error(`OAuth 오류: ${errorParam}`);
    }
    
    if (!accessToken) {
      console.error('액세스 토큰이 없습니다:', urlParts[1]);
      throw new Error('로그인 실패: 액세스 토큰을 얻지 못했습니다.');
    }
    
    console.log('액세스 토큰 획득 성공');
    
    // 사용자 정보 요청
    const userInfo = await fetchUserInfo(accessToken);
    console.log('사용자 정보 획득 성공:', userInfo.email);
    
    // 크롬 스토리지에 토큰 저장
    await chrome.storage.local.set({ 
      authToken: accessToken,
      user: {
        uid: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture
      }
    });
    
    return {
      user: {
        uid: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture
      }
    };
  } catch (error) {
    console.error('Google 로그인 오류:', error);
    throw error;
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

// 로그아웃 함수
export async function signOut() {
  try {
    await chrome.storage.local.remove('authToken');
    return { success: true };
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
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

// 구독 상태 확인
export async function checkSubscription(email) {
  if (!email) {
    console.warn('이메일이 제공되지 않았습니다. 기본 무료 구독으로 설정합니다.');
    return 'free'; // 이메일이 없으면 기본으로 free 반환
  }

  try {
    // 에어테이블에서 사용자 확인
    const user = await getUserByEmail(email);
    
    if (user && user.fields) {
      // 사용자 정보에서 구독 타입 확인
      return user.fields.subscriptionType || 'free';
    }
    
    console.warn('사용자를 찾을 수 없습니다:', email);
    return 'free'; // 사용자를 찾을 수 없으면 기본으로 free 반환
  } catch (error) {
    console.error('구독 상태 확인 오류:', error);
    return 'free'; // 오류 시 기본 free 반환
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