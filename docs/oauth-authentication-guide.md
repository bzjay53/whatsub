# Chrome 확장 프로그램 OAuth 인증 문제 해결 가이드

Chrome 확장 프로그램에서 Google OAuth 인증을 구현할 때 발생할 수 있는 다양한 문제와 해결 방법을 정리한 문서입니다.

## 주요 오류 유형 및 해결 방법

### 1. 401 invalid_client 오류

이 오류는 OAuth 클라이언트 ID가 유효하지 않거나 올바르게 설정되지 않은 경우 발생합니다.

**원인:**
- Google Cloud Console에 등록된 OAuth 클라이언트 ID와 manifest.json에 설정된 ID가 일치하지 않음
- 클라이언트 ID에 대한 웹 애플리케이션 형식으로 생성되었을 경우 (Chrome 앱용이 아님)
- OAuth 동의 화면이 올바르게 구성되지 않음

**해결 방법:**
1. Google Cloud Console에서 Chrome 앱용 OAuth 클라이언트 ID를 생성하세요.
   ```
   Google Cloud Console > APIs & Services > Credentials > Create Credentials > OAuth client ID > Chrome App
   ```

2. manifest.json 파일에 OAuth 설정을 올바르게 구성하세요.
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["profile", "email"]
   }
   ```

3. manifest.json 파일에 key 필드를 추가하여 확장 프로그램 ID를 고정하세요.
   ```json
   "key": "YOUR_EXTENSION_KEY"
   ```

4. Google Cloud Console에서 OAuth 동의 화면을 구성하고 필요한 범위를 추가하세요.

### 2. 사용자가 인증을 취소하는 경우

사용자가 로그인 과정에서 Google 계정 접근을 허용하지 않거나 창을 닫는 경우 처리 방법입니다.

**구현 방법:**
```javascript
try {
  const token = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });
  // 인증 성공 처리
} catch (error) {
  if (error.message.includes('not approve') || 
      error.message.includes('canceled')) {
    // 사용자가 취소한 경우 처리
    showError('Google 계정 액세스를 허용해주세요.');
  } else {
    // 기타 오류 처리
    showError(`인증 오류: ${error.message}`);
  }
}
```

### 3. 인증은 성공했지만 데이터 저장에 실패하는 경우

Google 인증은 성공했지만 Airtable과 같은 외부 서비스 연결에 실패한 경우의 처리 방법입니다.

**구현 방법:**
```javascript
// 로그인 성공 처리
let airtableSuccess = true;

try {
  // Airtable에 사용자 정보 저장
  await saveUserToAirtable(userInfo);
} catch (error) {
  console.warn('Airtable 저장 실패:', error);
  airtableSuccess = false;
  // 에러가 발생해도 로그인 프로세스는 계속 진행
}

// 로그인 상태 저장
await chrome.storage.local.set({
  isLoggedIn: true,
  userData: userInfo,
  airtableSuccess: airtableSuccess
});

// UI에 Airtable 연결 상태 표시
if (!airtableSuccess) {
  showWarning('서버 연결에 문제가 있습니다. 기본 기능은 정상적으로 작동합니다.');
}
```

## OAuth 보안 모범 사례

### 1. 최소 권한 원칙 적용

사용자 인증에 필요한 최소한의 범위(scopes)만 요청하세요.

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID",
  "scopes": ["profile", "email"] // 필요한 범위만 지정
}
```

### 2. 토큰 안전하게 저장

OAuth 토큰은 항상 안전하게 저장하고 관리하세요.

```javascript
// 토큰을 로컬 스토리지에 저장
await chrome.storage.local.set({
  'auth_token': token,
  'token_expiry': Date.now() + 3600000 // 1시간 후 만료
});
```

### 3. 인증 상태 정기적으로 확인

인증 토큰이 만료되었는지 정기적으로 확인하세요.

```javascript
async function checkAuthStatus() {
  const { auth_token, token_expiry } = await chrome.storage.local.get(['auth_token', 'token_expiry']);
  
  if (!auth_token || Date.now() > token_expiry) {
    // 토큰이 없거나 만료됨
    return false;
  }
  
  return true;
}
```

## Google Cloud Console 설정 가이드

### 1. 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성
3. APIs & Services > OAuth consent screen에서 동의 화면 설정
   - 앱 이름, 로고, 연락처 정보 입력
   - 필요한 범위 추가 (profile, email)

### 2. OAuth 클라이언트 ID 생성

1. APIs & Services > Credentials > Create Credentials > OAuth client ID 선택
2. 애플리케이션 유형: Chrome App 선택
3. 애플리케이션 ID 입력 (확장 프로그램 ID)
4. 생성된 클라이언트 ID를 manifest.json에 복사

### 3. API 활성화

필요한 Google API를 활성화하세요:
- Google People API
- Google Identity Services

## 문제 해결 체크리스트

확장 프로그램의 OAuth 인증 문제를 해결하기 위한 체크리스트입니다:

1. **클라이언트 ID 확인**
   - [ ] Google Cloud Console에서 생성한 OAuth 클라이언트 ID가 올바른지 확인
   - [ ] manifest.json의 client_id와 일치하는지 확인

2. **확장 프로그램 ID 확인**
   - [ ] manifest.json에 key 필드가 있는지 확인
   - [ ] Google Cloud Console에 등록된 확장 프로그램 ID와 일치하는지 확인

3. **권한 확인**
   - [ ] manifest.json에 필요한 권한이 모두 포함되어 있는지 확인
   ```json
   "permissions": ["identity", "storage", "tabs"]
   ```

4. **에러 처리 확인**
   - [ ] 인증 오류에 대한 예외 처리가 구현되어 있는지 확인
   - [ ] 사용자 친화적인 오류 메시지가 표시되는지 확인

5. **네트워크 요청 확인**
   - [ ] 개발자 도구의 네트워크 탭에서 OAuth 요청과 응답 확인
   - [ ] 오류 응답의 자세한 내용 분석

## 참고 자료

- [Chrome Identity API 문서](https://developer.chrome.com/docs/extensions/reference/identity/)
- [OAuth 2.0 for Chrome Apps](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [OAuth 동의 화면 설정 가이드](https://support.google.com/cloud/answer/10311615) 