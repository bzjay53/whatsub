/**
 * Airtable API 연동 모듈
 * Whatsub 확장 프로그램에서 사용하는 Airtable API 호출 함수들
 */

import { 
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_USERS_TABLE_ID,
  AIRTABLE_API_URL
} from './airtable-config.js';

// API 헤더 설정
export function getAirtableHeaders() {
  return {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

// API URL 생성
export function getAirtableUrl(tableId) {
  return `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${tableId}`;
}

/**
 * 모든 사용자 가져오기
 * @returns {Promise<Array>} 사용자 목록
 */
export async function getAllUsers() {
  try {
    console.log('[Airtable] 모든 사용자 조회 시작');
    
    const response = await fetch(getAirtableUrl(AIRTABLE_USERS_TABLE_ID), {
      method: 'GET',
      headers: getAirtableHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Airtable API 오류: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[Airtable] ${data.records.length}명의 사용자 조회 완료`);
    
    return data.records;
  } catch (error) {
    console.error('[Airtable] 사용자 조회 오류:', error);
    return [];
  }
}

/**
 * 이메일로 사용자 찾기
 * @param {string} email 사용자 이메일
 * @returns {Promise<Object|null>} 사용자 객체 또는 null
 */
export async function getUserByEmail(email) {
  if (!email) {
    console.error('[Airtable] 이메일이 제공되지 않았습니다');
    return null;
  }
  
  try {
    console.log(`[Airtable] 이메일로 사용자 조회: ${email}`);
    
    // 현재는 실제 API 호출 대신 모의 사용자 반환
    // 실제 환경에서는 Airtable filterByFormula 사용
    console.log('[Airtable] 모의 사용자 데이터 반환 (테스트용)');
    
    // 이메일에 따라 다른 사용자 유형 반환 (테스트용)
    if (email.includes('test') || email.includes('premium')) {
      return {
        id: 'rec123456premium',
        fields: {
          Email: email,
          Name: 'Premium User',
          'Subscription Type': 'premium',
          'Whisper Minutes Used': 50,
          'Translation Characters Used': 3000,
          'Last Login': new Date().toISOString()
        }
      };
    } else if (email.includes('enterprise') || email.includes('business')) {
      return {
        id: 'rec123456enterprise',
        fields: {
          Email: email,
          Name: 'Enterprise User',
          'Subscription Type': 'enterprise',
          'Whisper Minutes Used': 200,
          'Translation Characters Used': 50000,
          'Last Login': new Date().toISOString()
        }
      };
    }
    
    // 기본 무료 사용자
    return {
      id: 'rec123456free',
      fields: {
        Email: email,
        Name: 'Free User',
        'Subscription Type': 'free',
        'Whisper Minutes Used': 20,
        'Translation Characters Used': 1000,
        'Last Login': new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Airtable] 사용자 조회 오류:', error);
    return null;
  }
}

/**
 * 새 사용자 생성
 * @param {Object} userData 사용자 데이터
 * @returns {Promise<Object|null>} 생성된 사용자 또는 null
 */
export async function createUser(userData) {
  try {
    console.log('[Airtable] 새 사용자 생성:', userData.Email);
    
    // 현재는 실제 API 호출 대신 모의 응답 반환
    console.log('[Airtable] 모의 사용자 생성 완료 (테스트용)');
    
    return {
      id: 'recNew' + Math.random().toString(36).substring(2, 8),
      fields: {
        ...userData,
        'Created At': new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Airtable] 사용자 생성 오류:', error);
    return null;
  }
}

/**
 * 사용자 정보 업데이트
 * @param {string} id 사용자 ID
 * @param {Object} updateData 업데이트할 데이터
 * @returns {Promise<Object|null>} 업데이트된 사용자 또는 null
 */
export async function updateUser(id, updateData) {
  try {
    console.log(`[Airtable] 사용자 업데이트: ${id}`, updateData);
    
    // 현재는 실제 API 호출 대신 모의 응답 반환
    console.log('[Airtable] 모의 사용자 업데이트 완료 (테스트용)');
    
    return {
      id,
      fields: {
        ...updateData,
        'Updated At': new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Airtable] 사용자 업데이트 오류:', error);
    return null;
  }
}

/**
 * 마지막 로그인 시간 업데이트
 * @param {string} id 사용자 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export async function updateLastLogin(id) {
  try {
    console.log(`[Airtable] 마지막 로그인 업데이트: ${id}`);
    
    const updateData = {
      'Last Login': new Date().toISOString()
    };
    
    const result = await updateUser(id, updateData);
    return !!result;
  } catch (error) {
    console.error('[Airtable] 로그인 시간 업데이트 오류:', error);
    return false;
  }
}

/**
 * 사용자 정보 생성 또는 업데이트 (Upsert)
 * @param {Object} userData 사용자 데이터
 * @returns {Promise<Object|null>} 생성/업데이트된 사용자 또는 null
 */
export async function upsertUser(userData) {
  try {
    if (!userData.Email) {
      throw new Error('사용자 이메일은 필수입니다');
    }
    
    // 기존 사용자 확인
    const existingUser = await getUserByEmail(userData.Email);
    
    if (existingUser) {
      // 기존 사용자 업데이트
      console.log(`[Airtable] 기존 사용자 업데이트: ${userData.Email}`);
      return await updateUser(existingUser.id, userData);
    } else {
      // 새 사용자 생성
      console.log(`[Airtable] 새 사용자 생성: ${userData.Email}`);
      return await createUser(userData);
    }
  } catch (error) {
    console.error('[Airtable] 사용자 생성/업데이트 오류:', error);
    return null;
  }
}

/**
 * 로그인 처리
 * @param {string} email 사용자 이메일
 * @returns {Promise<Object>} 로그인 결과
 */
export async function signIn(email) {
  try {
    if (!email) {
      throw new Error('이메일은 필수입니다');
    }
    
    console.log(`[Airtable] 로그인 시도: ${email}`);
    
    // 사용자 확인
    const user = await getUserByEmail(email);
    
    if (user) {
      // 로그인 시간 업데이트
      await updateLastLogin(user.id);
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.fields.Email,
          name: user.fields.Name || email.split('@')[0],
          subscription: user.fields['Subscription Type'] || 'free'
        }
      };
    } else {
      // 새 사용자 자동 생성
      console.log(`[Airtable] 새 사용자 자동 생성: ${email}`);
      
      const newUser = await createUser({
        Email: email,
        Name: email.split('@')[0],
        'Subscription Type': 'free',
        'Last Login': new Date().toISOString()
      });
      
      if (newUser) {
        return {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.fields.Email,
            name: newUser.fields.Name,
            subscription: 'free'
          },
          isNewUser: true
        };
      } else {
        throw new Error('사용자 생성 실패');
      }
    }
  } catch (error) {
    console.error('[Airtable] 로그인 오류:', error);
    
    return {
      success: false,
      error: error.message || '로그인 처리 중 오류가 발생했습니다'
    };
  }
}

// 전역 객체로 설정
window.AirtableService = AirtableService; 