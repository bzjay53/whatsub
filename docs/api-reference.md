# Whatsub API 레퍼런스

버전: 1.0.0
최종 업데이트: 2023-06-25

## 1. 개요

이 문서는 Whatsub 확장프로그램에서 사용하는 내부 및 외부 API에 대한 세부 정보를 제공합니다. 확장프로그램의 다양한 구성 요소 간 상호 작용을 위한 인터페이스와 외부 서비스 연동을 위한 API를 포함합니다.

## 2. 내부 API

### 2.1 메시지 통신 API

Chrome 확장프로그램 구성 요소 간 통신을 위한 메시지 인터페이스입니다.

#### 2.1.1 Background <-> Popup 메시지

| 메시지 타입 | 방향 | 파라미터 | 반환값 | 설명 |
|------------|------|----------|--------|------|
| `login` | Popup → Background | 없음 | `{ success: boolean, error?: string, user?: Object }` | 사용자 로그인 요청 |
| `logout` | Popup → Background | 없음 | `{ success: boolean, error?: string }` | 사용자 로그아웃 요청 |
| `getUserInfo` | Popup → Background | 없음 | `{ loggedIn: boolean, user?: Object }` | 현재 사용자 정보 요청 |
| `saveSettings` | Popup → Background | `{ settings: Object }` | `{ success: boolean, error?: string }` | 사용자 설정 저장 요청 |
| `getSettings` | Popup → Background | 없음 | `{ settings: Object }` | 사용자 설정 요청 |
| `checkSubscription` | Popup → Background | 없음 | `{ isActive: boolean, plan?: string, expiresAt?: Date }` | 구독 상태 확인 |

```javascript
// 사용 예시: Popup에서 로그인 요청
chrome.runtime.sendMessage({ action: 'login' }, function(response) {
  if (response.success) {
    // 로그인 성공 처리
    console.log('Logged in user:', response.user);
  } else {
    // 로그인 실패 처리
    console.error('Login failed:', response.error);
  }
});
```

#### 2.1.2 Background <-> Content Script 메시지

| 메시지 타입 | 방향 | 파라미터 | 반환값 | 설명 |
|------------|------|----------|--------|------|
| `getSubtitles` | Content → Background | `{ videoId: string, platform: string, language: string }` | `{ success: boolean, subtitles?: Array, error?: string }` | 자막 데이터 요청 |
| `updateSettings` | Background → Content | `{ settings: Object }` | 없음 | 설정 변경 알림 |
| `authStateChanged` | Background → Content | `{ loggedIn: boolean }` | 없음 | 인증 상태 변경 알림 |
| `videoInfo` | Content → Background | `{ videoId: string, title: string, platform: string, duration: number }` | `{ success: boolean }` | 현재 비디오 정보 전송 |

```javascript
// 사용 예시: Content Script에서 자막 요청
chrome.runtime.sendMessage({
  action: 'getSubtitles',
  videoId: 'abcd1234',
  platform: 'youtube',
  language: 'ko'
}, function(response) {
  if (response.success) {
    // 자막 데이터 처리
    displaySubtitles(response.subtitles);
  } else {
    // 오류 처리
    console.error('Failed to get subtitles:', response.error);
  }
});
```

### 2.2 스토리지 API

Chrome 스토리지를 통한 데이터 저장 및 관리 인터페이스입니다.

#### 2.2.1 로컬 스토리지

| 키 | 타입 | 설명 |
|----|------|------|
| `user` | Object | 현재 로그인한 사용자 정보 |
| `settings` | Object | 사용자 설정 정보 |
| `auth` | Object | 인증 관련 정보 (토큰 등) |
| `subtitleCache` | Object | 최근 사용한 자막 캐시 |

```javascript
// 사용 예시: 설정 저장
function saveSettings(settings) {
  chrome.storage.local.set({ 'settings': settings }, function() {
    console.log('Settings saved');
  });
}

// 사용 예시: 설정 불러오기
function loadSettings(callback) {
  chrome.storage.local.get('settings', function(result) {
    callback(result.settings || defaultSettings);
  });
}
```

#### 2.2.2 동기화 스토리지

| 키 | 타입 | 설명 |
|----|------|------|
| `settings` | Object | 기기 간 동기화되는 사용자 설정 |
| `history` | Array | 최근 시청 기록 (제한된 개수) |

```javascript
// 사용 예시: 동기화 설정 저장
function saveSyncSettings(settings) {
  chrome.storage.sync.set({ 'settings': settings }, function() {
    console.log('Sync settings saved');
  });
}
```

## 3. 외부 API

### 3.1 Firebase API

Firebase 서비스와의 통신을 위한 인터페이스입니다.

#### 3.1.1 Firebase Authentication API

| 메소드 | 파라미터 | 반환값 | 설명 |
|-------|----------|--------|------|
| `signInWithCredential` | `credential: AuthCredential` | `Promise<UserCredential>` | 제공된 자격 증명으로 Firebase에 로그인 |
| `signOut` | 없음 | `Promise<void>` | 현재 사용자 로그아웃 |
| `onAuthStateChanged` | `callback: Function` | `Unsubscribe: Function` | 인증 상태 변경 리스너 설정 |

```javascript
// 사용 예시: Google 자격 증명으로 로그인
function signInWithGoogleToken(token) {
  const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
  return firebase.auth().signInWithCredential(credential);
}
```

#### 3.1.2 Firestore API

| 컬렉션 | 문서 | 필드 | 설명 |
|--------|------|------|------|
| `users` | `{uid}` | `profile: Object` | 사용자 프로필 정보 |
| `users` | `{uid}` | `settings: Object` | 사용자 설정 정보 |
| `users` | `{uid}` | `subscription: Object` | 구독 정보 |
| `users/{uid}/history` | `{videoId}` | 다양한 필드 | 비디오 시청 기록 |

```javascript
// 사용 예시: 사용자 설정 저장
function saveUserSettings(uid, settings) {
  return firebase.firestore()
    .collection('users')
    .doc(uid)
    .set({
      settings: settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// 사용 예시: 사용자 설정 가져오기
async function getUserSettings(uid) {
  const doc = await firebase.firestore()
    .collection('users')
    .doc(uid)
    .get();
    
  if (doc.exists) {
    return doc.data().settings || {};
  }
  return {};
}
```

### 3.2 Chrome API

Chrome 브라우저 기능과 상호작용하기 위한 인터페이스입니다.

#### 3.2.1 Chrome Identity API

| 메소드 | 파라미터 | 콜백 | 설명 |
|-------|----------|------|------|
| `getAuthToken` | `{ interactive: boolean }` | `callback(token)` | Google OAuth 토큰 획득 |
| `removeCachedAuthToken` | `{ token: string }` | `callback()` | 캐시된 토큰 제거 |
| `launchWebAuthFlow` | `{ url: string, interactive: boolean }` | `callback(responseUrl)` | OAuth 인증 흐름 시작 |

```javascript
// 사용 예시: 인증 토큰 획득
function getGoogleAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// 사용 예시: 토큰 제거 (로그아웃)
function removeAuthToken(token) {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token: token }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
```

#### 3.2.2 Chrome Storage API

| 메소드 | 파라미터 | 콜백 | 설명 |
|-------|----------|------|------|
| `local.get` | `keys: string|Array|Object` | `callback(items)` | 로컬 스토리지에서 데이터 가져오기 |
| `local.set` | `items: Object` | `callback()` | 로컬 스토리지에 데이터 저장 |
| `sync.get` | `keys: string|Array|Object` | `callback(items)` | 동기화 스토리지에서 데이터 가져오기 |
| `sync.set` | `items: Object` | `callback()` | 동기화 스토리지에 데이터 저장 |

```javascript
// 사용 예시: 복합 데이터 저장 및 가져오기
function saveComplex() {
  const data = {
    user: { name: 'John', email: 'john@example.com' },
    settings: { fontSize: 16, color: '#fff' },
    timestamp: Date.now()
  };
  
  chrome.storage.local.set({ 'complexData': data }, function() {
    console.log('Complex data saved');
  });
}

function loadComplex(callback) {
  chrome.storage.local.get('complexData', function(result) {
    callback(result.complexData);
  });
}
```

### 3.3 결제 API (계획됨)

결제 처리 및 구독 관리를 위한 인터페이스입니다.

#### 3.3.1 Stripe API

| 엔드포인트 | 메소드 | 파라미터 | 응답 | 설명 |
|-----------|-------|----------|------|------|
| `/create-checkout-session` | POST | `{ priceId: string, userId: string, success_url: string, cancel_url: string }` | `{ sessionId: string }` | 체크아웃 세션 생성 |
| `/webhook` | POST | Stripe 웹훅 이벤트 | 상태 코드 | 결제 이벤트 처리 |
| `/customer-portal` | POST | `{ userId: string, return_url: string }` | `{ url: string }` | 구독 관리 포털 생성 |

```javascript
// 사용 예시: 체크아웃 세션 생성 및 리디렉션
async function createCheckoutSession(priceId, userId) {
  const response = await fetch('https://your-server.com/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      priceId,
      userId,
      success_url: chrome.runtime.getURL('payment_success.html'),
      cancel_url: chrome.runtime.getURL('popup.html'),
    }),
  });
  
  const { sessionId } = await response.json();
  const stripe = await loadStripe('pk_test_YOUR_KEY');
  
  stripe.redirectToCheckout({ sessionId });
}
```

### 3.4 번역 API (계획됨)

자막 번역을 위한 인터페이스입니다.

#### 3.4.1 Google Cloud Translation API

| 엔드포인트 | 메소드 | 파라미터 | 응답 | 설명 |
|-----------|-------|----------|------|------|
| `/translate` | POST | `{ q: string, target: string, source?: string }` | `{ translatedText: string, detectedSourceLanguage?: string }` | 텍스트 번역 |
| `/detectLanguage` | POST | `{ q: string }` | `{ languageCode: string, confidence: number }` | 언어 감지 |

```javascript
// 사용 예시: 자막 번역
async function translateSubtitles(subtitles, targetLanguage) {
  const translatedSubtitles = [];
  
  for (const subtitle of subtitles) {
    const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        q: subtitle.text,
        target: targetLanguage
      })
    });
    
    const data = await response.json();
    
    translatedSubtitles.push({
      ...subtitle,
      text: data.data.translations[0].translatedText
    });
  }
  
  return translatedSubtitles;
}
```

## 4. 에러 처리

### 4.1 공통 에러 코드

| 코드 | 메시지 | 설명 |
|------|--------|------|
| `ERR_AUTH_REQUIRED` | "Authentication required" | 인증이 필요한 작업 |
| `ERR_PERMISSION_DENIED` | "Permission denied" | 권한이 없는 작업 |
| `ERR_NETWORK_FAILURE` | "Network failure" | 네트워크 연결 문제 |
| `ERR_INVALID_INPUT` | "Invalid input" | 잘못된 입력 파라미터 |
| `ERR_NOT_FOUND` | "Resource not found" | 요청한 리소스가 없음 |
| `ERR_SUBSCRIPTION_REQUIRED` | "Subscription required" | 구독이 필요한 기능 |

### 4.2 에러 응답 형식

```javascript
{
  success: false,
  error: {
    code: "ERR_AUTH_REQUIRED",
    message: "Authentication required to access this resource",
    details: { ... } // 추가 정보 (선택 사항)
  }
}
```

### 4.3 에러 처리 패턴

```javascript
// 에러 처리 예시
async function fetchWithErrorHandling(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw {
        code: errorData.error.code || 'ERR_UNKNOWN',
        message: errorData.error.message || 'Unknown error',
        details: errorData.error.details,
        statusCode: response.status
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    // 오류 처리 로직
    throw error; // 또는 기본값 반환
  }
}
```

## 5. 보안 고려사항

### 5.1 인증 및 권한

- API 키 및 토큰은 안전하게 관리
- 최소 권한 원칙 적용
- 민감한 작업에 대한 추가 확인

### 5.2 데이터 전송

- 모든 API 통신은 HTTPS 사용
- 민감한 데이터는 암호화
- CORS 설정 엄격하게 관리

### 5.3 입력 검증

- 모든 API 입력 파라미터 검증
- SQL 인젝션 및 XSS 방어
- 파라미터 길이 및 형식 제한

## 변경 이력
- 2023-06-25: 최초 문서 작성 