/**
 * Whatsub 확장 프로그램 로그인 테스트 스크립트
 * 
 * 이 스크립트는 Google 로그인 기능을 테스트하기 위한 것입니다.
 * 개발자 콘솔(F12)에서 실행할 수 있으며, 자동화된 테스트를 위한 함수들을 제공합니다.
 */

// 테스트 계정 정보 (필요시 변경)
const TEST_ACCOUNTS = [
  {
    name: '테스트 계정 1',
    email: 'whatsub.test1@gmail.com' // 실제 테스트에 사용할 이메일로 변경
  },
  {
    name: '테스트 계정 2',
    email: 'whatsub.test2@gmail.com' // 실제 테스트에 사용할 이메일로 변경
  }
];

/**
 * Google 로그인 테스트 실행
 * 확장 프로그램의 팝업 페이지에서 실행해야 합니다.
 */
async function testGoogleLogin() {
  console.log('[테스트] Google 로그인 테스트 시작...');
  
  try {
    // 현재 로그인 상태 확인
    const isLoggedIn = await checkLoginStatus();
    if (isLoggedIn) {
      console.log('[테스트] 이미 로그인되어 있습니다. 로그아웃 후 다시 시도합니다.');
      await testLogout();
    }
    
    // Google 로그인 버튼 클릭 시뮬레이션
    console.log('[테스트] Google 로그인 버튼 클릭...');
    const googleSigninButton = document.getElementById('google-signin');
    
    if (!googleSigninButton) {
      throw new Error('Google 로그인 버튼을 찾을 수 없습니다.');
    }
    
    // 로그인 이벤트 리스너 등록
    googleSigninButton.click();
    
    // 로그인 완료 대기 (최대 30초)
    console.log('[테스트] 로그인 진행 중...');
    const loginResult = await waitForLogin(30000);
    
    if (loginResult.success) {
      console.log('[테스트] 로그인 성공!', loginResult.user);
      console.log(`[테스트] 사용자: ${loginResult.user.displayName} (${loginResult.user.email})`);
      return true;
    } else {
      console.error('[테스트] 로그인 실패:', loginResult.error);
      return false;
    }
  } catch (error) {
    console.error('[테스트] 로그인 테스트 중 오류 발생:', error);
    return false;
  }
}

/**
 * 로그아웃 테스트 실행
 */
async function testLogout() {
  console.log('[테스트] 로그아웃 테스트 시작...');
  
  try {
    // 로그아웃 버튼 클릭 시뮬레이션
    const logoutButton = document.getElementById('logout-button');
    
    if (!logoutButton) {
      throw new Error('로그아웃 버튼을 찾을 수 없습니다.');
    }
    
    logoutButton.click();
    
    // 로그아웃 완료 대기 (최대 10초)
    const isLoggedOut = await waitForLogout(10000);
    
    if (isLoggedOut) {
      console.log('[테스트] 로그아웃 성공!');
      return true;
    } else {
      console.error('[테스트] 로그아웃 실패');
      return false;
    }
  } catch (error) {
    console.error('[테스트] 로그아웃 테스트 중 오류 발생:', error);
    return false;
  }
}

/**
 * 현재 로그인 상태 확인
 * @returns {Promise<boolean>} 로그인 여부
 */
async function checkLoginStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthState' }, (response) => {
      if (response && response.isAuthenticated) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * 로그인 완료 대기
 * @param {number} timeout 최대 대기 시간 (밀리초)
 * @returns {Promise<Object>} 로그인 결과
 */
async function waitForLogin(timeout = 30000) {
  return new Promise((resolve) => {
    let timer;
    
    // 로그인 완료 이벤트 리스너
    const authStateListener = (message) => {
      if (message.action === 'authStateChanged' && message.data.isAuthenticated) {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(authStateListener);
        resolve({
          success: true,
          user: message.data.user
        });
      }
    };
    
    // 타임아웃 설정
    timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(authStateListener);
      resolve({
        success: false,
        error: '로그인 시간 초과'
      });
    }, timeout);
    
    // 이벤트 리스너 등록
    chrome.runtime.onMessage.addListener(authStateListener);
  });
}

/**
 * 로그아웃 완료 대기
 * @param {number} timeout 최대 대기 시간 (밀리초)
 * @returns {Promise<boolean>} 로그아웃 성공 여부
 */
async function waitForLogout(timeout = 10000) {
  return new Promise((resolve) => {
    let timer;
    
    // 로그아웃 완료 이벤트 리스너
    const authStateListener = (message) => {
      if (message.action === 'authStateChanged' && !message.data.isAuthenticated) {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(authStateListener);
        resolve(true);
      }
    };
    
    // 타임아웃 설정
    timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(authStateListener);
      resolve(false);
    }, timeout);
    
    // 이벤트 리스너 등록
    chrome.runtime.onMessage.addListener(authStateListener);
  });
}

/**
 * 전체 로그인/로그아웃 테스트 실행
 */
async function runFullLoginTest() {
  console.log('[테스트] 전체 로그인/로그아웃 테스트 시작...');
  
  // 로그인 테스트
  const loginResult = await testGoogleLogin();
  
  if (loginResult) {
    // 로그인 성공 시 간단한 딜레이 후 로그아웃 테스트
    console.log('[테스트] 5초 후 로그아웃 테스트를 진행합니다...');
    setTimeout(async () => {
      await testLogout();
      console.log('[테스트] 전체 테스트 완료!');
    }, 5000);
  } else {
    console.error('[테스트] 로그인에 실패하여 전체 테스트를 중단합니다.');
  }
}

// 콘솔에서 사용할 수 있도록 전역 객체에 함수 노출
window.testGoogleLogin = testGoogleLogin;
window.testLogout = testLogout;
window.runFullLoginTest = runFullLoginTest;

console.log('[테스트] 로그인 테스트 스크립트가 로드되었습니다.');
console.log('[테스트] 콘솔에서 다음 함수를 사용하여 테스트할 수 있습니다:');
console.log('- testGoogleLogin(): Google 로그인 테스트');
console.log('- testLogout(): 로그아웃 테스트');
console.log('- runFullLoginTest(): 전체 로그인/로그아웃 테스트'); 