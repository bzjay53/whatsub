/**
 * 테스트 로그인 스크립트 (개발 중에만 사용)
 * 실제 환경에서는 이 파일을 제거하세요.
 * 
 * 현재 이 파일은 비활성화되어 있습니다.
 */

// 모든 테스트 기능을 비활성화합니다.
const TEST_ENABLED = false;

// 테스트 사용자 정보 (실제 사용자 정보가 아님)
const TEST_USER = {
  displayName: '테스트 사용자',
  email: 'test@example.com',
  photoURL: null
};

// 테스트 로그인 설정 (개발 테스트용, 실제 사용자 인증에 영향을 주지 않음)
function setupTestLogin() {
  // 테스트 모드가 활성화되지 않은 경우 리턴
  if (!TEST_ENABLED) return;
  
  console.warn('===== 주의: 테스트 모드 활성화됨 (프로덕션에서는 제거 필요) =====');
  
  // 테스트 버튼 추가
  const testButtonContainer = document.createElement('div');
  testButtonContainer.id = 'test-buttons';
  testButtonContainer.style.cssText = 'position:fixed; left:5px; bottom:5px; z-index:9999; font-size:10px;';
  testButtonContainer.innerHTML = `
    <button id="test-login" style="font-size:10px; padding:2px;">테스트 로그인</button>
    <button id="test-logout" style="font-size:10px; padding:2px;">테스트 로그아웃</button>
  `;
  
  // 문서가 로드된 후 요소에 접근
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(testButtonContainer);
    
    // 테스트 로그인 버튼 이벤트 리스너
    document.getElementById('test-login')?.addEventListener('click', () => {
      simulateLogin();
    });
    
    // 테스트 로그아웃 버튼 이벤트 리스너
    document.getElementById('test-logout')?.addEventListener('click', () => {
      simulateLogout();
    });
  });
}

// 테스트 로그인 시뮬레이션
async function simulateLogin() {
  if (!TEST_ENABLED) return;
  
  try {
    console.log('[테스트] 로그인 시뮬레이션 시작');
    
    // 테스트 데이터 생성
    const loginTime = Date.now();
    const testToken = 'test_token_' + Math.random().toString(36).substring(2);
    
    // 로컬 스토리지에 저장
    await chrome.storage.local.set({
      'whatsub_auth': {
        user: TEST_USER,
        token: testToken,
        loginTime: loginTime
      },
      'authToken': testToken,
      'auth': {
        isAuthenticated: true,
        user: TEST_USER
      }
    });
    
    console.log('[테스트] 로그인 시뮬레이션 완료');
    location.reload();
  } catch (error) {
    console.error('[테스트] 로그인 시뮬레이션 오류:', error);
  }
}

// 테스트 로그아웃 시뮬레이션
async function simulateLogout() {
  if (!TEST_ENABLED) return;
  
  try {
    console.log('[테스트] 로그아웃 시뮬레이션 시작');
    
    // 로컬 스토리지에서 제거
    await chrome.storage.local.remove([
      'whatsub_auth',
      'authToken',
      'auth',
      'user',
      'lastAuthState',
      'loginState'
    ]);
    
    console.log('[테스트] 로그아웃 시뮬레이션 완료');
    location.reload();
  } catch (error) {
    console.error('[테스트] 로그아웃 시뮬레이션 오류:', error);
  }
}

// 초기화 (현재 비활성화됨)
// setupTestLogin(); 