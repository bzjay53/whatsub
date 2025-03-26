import { signInWithGoogle, signOut, getCurrentUser } from './lib/firebase-sdk.js';

/**
 * Google 로그인 요청 처리
 * 사용자 인증을 위해 firebase-sdk의 signInWithGoogle 함수를 호출합니다.
 * @param {Object} message 요청 메시지
 * @returns {Promise<Object>} 로그인 처리 결과
 */
async handleSignInWithGoogle(message = {}) {
  try {
    Logger.log('Google 로그인 요청 처리 시작');
    
    // 이전 인증 데이터 클리어
    await this._clearOldAuthData();
    
    // silent 모드 확인 (토큰 갱신용)
    const isSilent = message.silent === true;
    
    // 로컬 스토리지에서 기존 사용자 정보 확인
    if (isSilent) {
      const currentUser = await this.checkAuthState();
      if (currentUser && currentUser.isLoggedIn) {
        Logger.log('현재 로그인된 사용자가 있습니다:', currentUser.user?.email);
        return {
          success: true,
          user: currentUser.user
        };
      }
    }
    
    // firebase-sdk의 signInWithGoogle 함수 호출
    const signInResult = await signInWithGoogle();
    
    Logger.log('로그인 처리 결과:', { 
      success: signInResult.success,
      user: signInResult.success ? signInResult.user?.email : null,
      error: signInResult.error
    });
    
    if (signInResult.success) {
      // 로그인 성공 처리
      await this._saveAuthState(signInResult.user, signInResult.token);
      
      // 인증 상태 변경 이벤트 발생
      this._broadcastAuthStateChange(true, signInResult.user);
      
      return {
        success: true,
        user: signInResult.user
      };
    } else {
      // 로그인 실패 처리
      await this._clearAuthState();
      
      return {
        success: false,
        error: signInResult.error || '로그인에 실패했습니다',
        errorType: signInResult.errorType || 'unknown'
      };
    }
  } catch (error) {
    Logger.error('로그인 처리 중 오류:', error);
    
    // 오류 발생 시 인증 상태 정리
    await this._clearAuthState();
    
    return {
      success: false,
      error: error.message || '로그인 처리 중 오류가 발생했습니다',
      errorType: 'exception'
    };
  }
}

/**
 * 로그아웃 요청 처리
 * 사용자 인증 정보를 제거합니다.
 * @param {Object} message 요청 메시지
 * @returns {Promise<Object>} 로그아웃 처리 결과
 */
async handleSignOut(message = {}) {
  try {
    Logger.log('로그아웃 요청 처리 시작');
    
    // 강제 로그아웃 여부 확인
    const isForced = message.force === true;
    
    // firebase-sdk의 signOut 함수 호출
    const signOutResult = await signOut(isForced);
    
    if (signOutResult.success) {
      // 로그아웃 성공 처리
      await this._clearAuthState();
      
      // 인증 상태 변경 이벤트 발생
      this._broadcastAuthStateChange(false, null);
      
      return {
        success: true,
        message: '로그아웃되었습니다'
      };
    } else {
      // 로그아웃 실패 처리 (그래도 상태는 클리어)
      await this._clearAuthState();
      
      return {
        success: false,
        error: signOutResult.error || '로그아웃 중 오류가 발생했습니다'
      };
    }
  } catch (error) {
    Logger.error('로그아웃 처리 중 오류:', error);
    
    // 오류가 발생해도 인증 상태 정리 시도
    await this._clearAuthState();
    
    return {
      success: false,
      error: error.message || '로그아웃 처리 중 오류가 발생했습니다'
    };
  }
}

/**
 * 인증 상태 확인
 * 현재 사용자의 로그인 상태를 확인합니다.
 * @returns {Promise<Object>} 인증 상태 및 사용자 정보
 */
async checkAuthState() {
  try {
    Logger.log('인증 상태 확인 요청 처리');
    
    // 로컬 스토리지에서 인증 정보 가져오기
    const data = await new Promise(resolve => {
      chrome.storage.local.get([
        'whatsub_auth', 
        'auth', 
        'user', 
        'authToken',
        'authState'
      ], resolve);
    });
    
    // 다양한 소스에서 인증 상태 확인
    const isAuthenticated = !!(
      (data.whatsub_auth && data.whatsub_auth.token && data.whatsub_auth.user) ||
      (data.auth && data.auth.isAuthenticated && data.auth.user) ||
      (data.user && data.authToken) ||
      (data.authState === 'authenticated')
    );
    
    // 다양한 소스에서 사용자 정보 가져오기
    const user = data.user || 
                (data.whatsub_auth && data.whatsub_auth.user) || 
                (data.auth && data.auth.user);
    
    Logger.log('인증 상태 확인 결과:', { 
      isLoggedIn: isAuthenticated, 
      user: user?.email || '없음',
      tokenExists: !!data.authToken || !!(data.whatsub_auth && data.whatsub_auth.token)
    });
    
    // 인증 상태가 불완전하면 정리
    if (isAuthenticated && (!user || (!data.authToken && !(data.whatsub_auth && data.whatsub_auth.token)))) {
      Logger.warn('불완전한 인증 상태 감지, 정리 수행');
      await this._clearAuthState();
      
      return {
        isLoggedIn: false,
        user: null,
        success: true,
        wasInconsistent: true
      };
    }
    
    return {
      isLoggedIn: isAuthenticated,
      user: user,
      success: true
    };
  } catch (error) {
    Logger.error('인증 상태 확인 중 오류:', error);
    
    return {
      isLoggedIn: false,
      user: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * 인증 상태 변경 브로드캐스트
 * 모든 확장 프로그램 컴포넌트에 인증 상태 변경을 알립니다.
 * @param {boolean} isAuthenticated 인증 상태
 * @param {Object} user 사용자 정보
 * @private
 */
_broadcastAuthStateChange(isAuthenticated, user) {
  try {
    Logger.log('인증 상태 변경 브로드캐스트:', { isAuthenticated, user: user?.email });
    
    chrome.runtime.sendMessage({
      action: 'authStateChanged',
      data: {
        isAuthenticated: isAuthenticated,
        user: user
      }
    }).catch(e => Logger.warn('일부 컴포넌트에 메시지 전송 실패 (무시):', e));
  } catch (error) {
    Logger.warn('인증 상태 변경 브로드캐스트 중 오류 (무시):', error);
  }
}

/**
 * 인증 상태 저장
 * 로그인 성공 후 사용자 정보와 토큰을 저장합니다.
 * @param {Object} user 사용자 정보
 * @param {string} token 인증 토큰
 * @private
 */
async _saveAuthState(user, token) {
  try {
    if (!user || !token) {
      Logger.warn('사용자 정보 또는 토큰이 없어 저장하지 않음');
      return false;
    }
    
    Logger.log('인증 상태 저장 중:', user.email);
    
    // 다양한 형식으로 저장 (호환성)
    await new Promise(resolve => {
      chrome.storage.local.set({
        // 새로운 형식
        'whatsub_auth': {
          user: user,
          token: token,
          loginTime: Date.now()
        },
        // 기존 형식 (호환성)
        'auth': {
          isAuthenticated: true,
          user: user
        },
        // 개별 키 (다른 부분과의 호환성)
        'user': user,
        'authToken': token,
        'authState': 'authenticated',
        'lastAuthState': {
          isAuthenticated: true,
          user: user,
          timestamp: Date.now()
        }
      }, resolve);
    });
    
    Logger.log('인증 상태 저장 완료');
    return true;
  } catch (error) {
    Logger.error('인증 상태 저장 중 오류:', error);
    return false;
  }
}

/**
 * 인증 상태 정리
 * 로그아웃 시 사용자 정보와 토큰을 제거합니다.
 * @private
 */
async _clearAuthState() {
  try {
    Logger.log('인증 상태 정리 중');
    
    // 모든 인증 관련 데이터 제거
    await new Promise(resolve => {
      chrome.storage.local.remove([
        'whatsub_auth', 
        'auth', 
        'user', 
        'authToken',
        'authState',
        'lastAuthState',
        'loginState'
      ], resolve);
    });
    
    Logger.log('인증 상태 정리 완료');
    return true;
  } catch (error) {
    Logger.error('인증 상태 정리 중 오류:', error);
    return false;
  }
}

/**
 * 이전 인증 데이터 정리
 * 로그인 전 기존 인증 데이터를 정리합니다.
 * @private
 */
async _clearOldAuthData() {
  try {
    // 현재 사용자 정보 확인
    const currentAuth = await this.checkAuthState();
    
    // 이미 로그인되어 있으면 로그아웃 처리
    if (currentAuth.isLoggedIn) {
      Logger.log('새 로그인 전 기존 인증 데이터 정리');
      await this._clearAuthState();
    }
    
    return true;
  } catch (error) {
    Logger.warn('이전 인증 데이터 정리 중 오류:', error);
    return false;
  }
} 