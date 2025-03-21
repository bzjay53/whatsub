/**
 * Airtable API Wrapper for Whatsub Extension
 * 
 * This module provides functions to interact with Airtable database
 */

// Configuration
// 2024년 2월 1일부터 API 키가 중단되고 개인 액세스 토큰(PAT)이 필요합니다.
const AIRTABLE_API_KEY = 'pat1pYE65vbuLujCF.13d6b3d1aefae2aebee95f1e9a78cb8ce2fb0e6d9d0bae3e6c93a7e8ea0b8cb7';
const AIRTABLE_BASE_ID = 'appWxjlnNEJyNkCaI';
const AIRTABLE_TABLE_NAME = 'tblUsers';

/**
 * 요청 헤더를 설정합니다
 * @returns {Object} HTTP 헤더 객체
 */
function getHeaders() {
  return {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Airtable API URL을 생성합니다
 * @param {string} tableId - 테이블 ID (기본값: AIRTABLE_TABLE_NAME)
 * @returns {string} API URL
 */
function getApiUrl(tableId = AIRTABLE_TABLE_NAME) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;
}

/**
 * API 요청 실패 처리 함수
 * @param {Response} response - Fetch API 응답 객체
 * @param {string} operation - 수행 중인 작업 설명
 * @throws {Error} API 요청 실패 시 오류 발생
 */
async function handleRequestFailure(response, operation) {
  let errorMessage = `Airtable API 응답 오류 (${operation}): ${response.status} ${response.statusText}`;
  
  try {
    // 응답 본문에서 추가 오류 정보 추출 시도
    const errorData = await response.json();
    if (errorData && errorData.error) {
      errorMessage += ` - ${errorData.error.message || errorData.error.type || JSON.stringify(errorData.error)}`;
    }
  } catch (e) {
    // 응답 본문 파싱 실패 시 무시
  }
  
  console.error(errorMessage);
  throw new Error(errorMessage);
}

/**
 * Get all records from the Airtable table
 * @returns {Promise<Array>} Array of records
 */
async function getAllUsers() {
  try {
    const response = await fetch(getApiUrl(), {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      await handleRequestFailure(response, 'getAllUsers');
      return [];
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Airtable 사용자 목록 조회 오류:', error);
    return [];
  }
}

/**
 * Get a user by email
 * @param {string} email - User email to search for
 * @returns {Promise<Object|null>} User record or null if not found
 */
async function getUserByEmail(email) {
  if (!email) {
    console.error('이메일이 제공되지 않았습니다.');
    return null;
  }

  try {
    // 필터링을 위해 이스케이프된 이메일 사용
    const safeEmail = email.replace(/'/g, "\\'");
    // LOWER 함수를 제거하고 직접 비교하는 방식으로 변경
    const formula = encodeURIComponent(`{Email} = '${safeEmail}'`);
    
    console.log(`Airtable 검색 URL: ${getApiUrl()}?filterByFormula=${formula}`);
    
    // API 키 확인
    if (!AIRTABLE_API_KEY) {
      console.warn('Airtable API 키가 설정되지 않았습니다. Airtable 기능을 사용하지 않습니다.');
      return null;
    }
    
    if (!AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
      console.warn('Airtable Base ID 또는 테이블 ID가 설정되지 않았습니다. Airtable 기능을 사용하지 않습니다.');
      return null;
    }
    
    const response = await fetch(
      `${getApiUrl()}?filterByFormula=${formula}`,
      {
        method: 'GET',
        headers: getHeaders()
      }
    );

    if (!response.ok) {
      // 401 인증 오류 특별 처리 (API 키 문제)
      if (response.status === 401) {
        console.warn('Airtable API 인증 오류: API 키가 유효하지 않거나 만료되었습니다. Airtable 기능을 사용하지 않습니다.');
        return null;
      }
      
      console.warn(`Airtable API 응답 오류 (getUserByEmail): ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log('Airtable 응답:', JSON.stringify(data));
    
    // 사용자 정보 반환 시 필드 이름 표준화
    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      return {
        id: record.id,
        fields: {
          ...record.fields,
          // 필드 이름 맞추기
          email: record.fields.Email || '',
          name: record.fields.Name || '',
          profilePicture: record.fields['Profile Picture'] || '',
          subscriptionType: record.fields['Subscription Type'] || 'free',
          whisperMinutesUsed: record.fields['Whisper Minutes Used'] || 0,
          translationCharactersUsed: record.fields['Translation Characters Used'] || 0,
          lastLogin: record.fields['Last Login'] || ''
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Airtable 사용자 조회 오류:', error);
    return null;
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data to create
 * @returns {Promise<Object|null>} Created user record or null if failed
 */
async function createUser(userData) {
  if (!userData || !userData.Email) {
    console.error('유효하지 않은 사용자 데이터입니다. Email 필드가 필요합니다.');
    return null;
  }

  try {
    // API 키 확인
    if (!AIRTABLE_API_KEY) {
      console.warn('Airtable API 키가 설정되지 않았습니다. Airtable 기능을 사용하지 않습니다.');
      return null;
    }
    
    // 필드 이름 맞추기
    const fieldsToSubmit = {
      'Email': userData.Email,
      'Name': userData.Name || userData.name || userData.displayName || '',
      'Profile Picture': userData['Profile Picture'] || userData.profilePicture || userData.photoURL || '',
      'Subscription Type': userData['Subscription Type'] || userData.subscriptionType || 'free',
      'Whisper Minutes Used': userData['Whisper Minutes Used'] || userData.whisperMinutesUsed || 0,
      'Translation Characters Used': userData['Translation Characters Used'] || userData.translationCharactersUsed || 0,
      'Last Login': userData['Last Login'] || new Date().toISOString().split('T')[0]
    };

    console.log('사용자 생성 시도:', fieldsToSubmit);

    const requestBody = JSON.stringify({
      records: [
        {
          fields: fieldsToSubmit
        }
      ]
    });

    console.log('Airtable 요청 본문:', requestBody);

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: requestBody
    });

    console.log('Airtable 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      // 401 인증 오류 특별 처리 (API 키 문제)
      if (response.status === 401) {
        console.warn('Airtable API 인증 오류: API 키가 유효하지 않거나 만료되었습니다. Airtable 기능을 사용하지 않습니다.');
        return null;
      }
      
      // 응답 본문 로깅 추가
      try {
        const errorData = await response.json();
        console.warn('Airtable 오류 응답:', JSON.stringify(errorData));
      } catch (e) {
        console.warn('Airtable 오류 응답 파싱 실패');
      }
      
      console.warn(`Airtable API 응답 오류 (createUser): ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log('Airtable 사용자 생성 응답:', JSON.stringify(data));
    
    if (!data.records || data.records.length === 0) {
      console.error('사용자 생성 응답에 레코드가 없습니다.');
      return null;
    }
    
    console.log('사용자 생성 성공:', userData.Email);
    return data.records[0];
  } catch (error) {
    console.error('Airtable 사용자 생성 오류:', error);
    return null;
  }
}

/**
 * Update a user by ID
 * @param {string} recordId - Airtable record ID
 * @param {Object} userData - User data to update
 * @returns {Promise<Object|null>} Updated user record or null if failed
 */
async function updateUser(recordId, userData) {
  if (!recordId) {
    console.error('레코드 ID가 제공되지 않았습니다.');
    return null;
  }

  try {
    // 필드 이름 맞추기
    const fieldsToUpdate = {};
    
    // 기존 userData의 필드를 Airtable 필드에 맞게 변환
    if (userData.Email || userData.email) fieldsToUpdate['Email'] = userData.Email || userData.email;
    if (userData.Name || userData.name || userData.displayName) fieldsToUpdate['Name'] = userData.Name || userData.name || userData.displayName;
    if (userData.profilePicture || userData.photoURL) fieldsToUpdate['Profile Picture'] = userData.profilePicture || userData.photoURL;
    if (userData.subscriptionType) fieldsToUpdate['Subscription Type'] = userData.subscriptionType;
    if (userData.whisperMinutesUsed !== undefined) fieldsToUpdate['Whisper Minutes Used'] = userData.whisperMinutesUsed;
    if (userData.translationCharactersUsed !== undefined) fieldsToUpdate['Translation Characters Used'] = userData.translationCharactersUsed;
    if (userData['Last Login']) fieldsToUpdate['Last Login'] = userData['Last Login'];
    
    // userData에 직접 필드가 있는 경우
    Object.keys(userData).forEach(key => {
      if (['Email', 'Name', 'Profile Picture', 'Subscription Type', 'Whisper Minutes Used', 'Translation Characters Used', 'Last Login'].includes(key)) {
        fieldsToUpdate[key] = userData[key];
      }
    });
    
    const response = await fetch(getApiUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [
          {
            id: recordId,
            fields: fieldsToUpdate
          }
        ]
      })
    });

    if (!response.ok) {
      await handleRequestFailure(response, 'updateUser');
      return null;
    }

    const data = await response.json();
    return data.records && data.records.length > 0 ? data.records[0] : null;
  } catch (error) {
    console.error('Airtable 사용자 업데이트 오류:', error);
    return null;
  }
}

/**
 * Update user's last login time
 * @param {string} recordId - Airtable record ID
 * @returns {Promise<Object|null>} Updated user record or null if failed
 */
async function updateLastLogin(recordId) {
  if (!recordId) {
    console.error('레코드 ID가 제공되지 않았습니다.');
    return null;
  }

  const now = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  return updateUser(recordId, {
    "Last Login": now
  });
}

/**
 * Create or update a user (upsert)
 * @param {Object} userData - User data
 * @returns {Promise<Object|null>} Created or updated user record
 */
async function upsertUser(userData) {
  if (!userData || (!userData.email && !userData.Email)) {
    console.error('유효하지 않은 사용자 데이터입니다. 이메일이 필요합니다.');
    return null;
  }

  try {
    // 이메일 필드 확인
    const email = userData.Email || userData.email;
    
    // Check if user exists
    const existingUser = await getUserByEmail(email);
    
    if (existingUser) {
      // Update existing user
      return updateUser(existingUser.id, userData);
    } else {
      // Create new user
      return createUser(userData);
    }
  } catch (error) {
    console.error('Airtable 사용자 upsert 오류:', error);
    return null;
  }
}

// 편의를 위한 추가 함수
/**
 * Sign in a user and update login time
 * @param {Object} userData - User data with email
 * @returns {Promise<Object|null>} User record or null if failed
 */
async function signIn(userData) {
  if (!userData || (!userData.email && !userData.Email)) {
    console.error('유효하지 않은 사용자 데이터입니다. 이메일이 필요합니다.');
    return null;
  }

  try {
    // 이메일 필드 확인
    const email = userData.Email || userData.email;
    
    // 사용자 조회
    const user = await getUserByEmail(email);
    if (!user) {
      console.log('새 사용자 자동 가입:', email);
      // 새 사용자 생성 (자동 가입)
      return createUser({
        Email: email,
        Name: userData.Name || userData.name || userData.displayName || '',
        'Profile Picture': userData['Profile Picture'] || userData.profilePicture || userData.photoURL || '',
        'Subscription Type': 'free',
        'Whisper Minutes Used': 0,
        'Translation Characters Used': 0,
        'Last Login': new Date().toISOString().split('T')[0]
      });
    }
    
    // 로그인 시간 업데이트
    await updateLastLogin(user.id);
    
    // 최신 사용자 정보 반환
    return getUserByEmail(email);
  } catch (error) {
    console.error('Airtable 로그인 오류:', error);
    return null;
  }
}

// 오류 처리를 추가한 API 래퍼
/**
 * 안전한 API 호출 래퍼
 * @param {Function} apiCall - 호출할 API 함수
 * @param {Array} args - API 함수에 전달할 인자 배열
 * @param {*} defaultValue - 오류 발생 시 반환할 기본값
 * @returns {Promise<*>} API 호출 결과 또는 기본값
 */
async function safeApiCall(apiCall, args = [], defaultValue = null) {
  try {
    return await apiCall(...args) || defaultValue;
  } catch (error) {
    console.error(`API 호출 오류 (${apiCall.name}):`, error);
    return defaultValue;
  }
}

// Export the functions
export {
  getAllUsers,
  getUserByEmail,
  createUser,
  updateUser,
  updateLastLogin,
  upsertUser,
  signIn,
  safeApiCall,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME,
  getHeaders as getAirtableHeaders,
  getApiUrl as getAirtableUrl
}; 