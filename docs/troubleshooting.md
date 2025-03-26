# Whatsub 트러블슈팅 가이드

버전: 1.0.0
최종 업데이트: 2023-06-25

## 1. 개요

이 문서는 Whatsub 확장프로그램을 사용하거나 개발하는 과정에서 발생할 수 있는 일반적인 문제와 해결 방법을 제공합니다. 사용자 및 개발자용 문제 해결 가이드로 활용할 수 있습니다.

## 2. 일반적인 사용자 문제

### 2.1 설치 및 업데이트 문제

#### 문제: 확장프로그램이 설치되지 않음
- **증상**: Chrome 웹 스토어에서 설치 버튼을 클릭해도 설치가 완료되지 않음
- **해결 방법**:
  1. Chrome 브라우저를 최신 버전으로 업데이트
  2. 브라우저 캐시 및 쿠키 삭제
  3. 다른 확장프로그램과의 충돌 확인을 위해 시크릿 모드에서 설치 시도
  4. 방화벽이나 보안 소프트웨어가 설치를 차단하는지 확인

#### 문제: 자동 업데이트가 되지 않음
- **증상**: 새 버전이 출시되었지만 자동으로 업데이트되지 않음
- **해결 방법**:
  1. Chrome의 확장프로그램 관리 페이지(`chrome://extensions/`)에서 개발자 모드 활성화
  2. "업데이트" 버튼 클릭
  3. Chrome 브라우저 재시작
  4. 문제가 지속되면 확장프로그램 제거 후 재설치

### 2.2 로그인 관련 문제

#### 문제: 구글 계정으로 로그인 실패
- **증상**: "로그인 중 오류가 발생했습니다" 메시지 표시
- **가능한 원인 및 해결 방법**:
  1. **네트워크 연결 문제**:
     - 인터넷 연결 확인
     - 방화벽이 연결을 차단하는지 확인
  2. **쿠키 설정 문제**:
     - 브라우저 쿠키 설정 확인 (특히 서드파티 쿠키 차단 여부)
     - 관련 도메인의 쿠키 삭제 후 재시도
  3. **Google 계정 문제**:
     - 다른 Google 서비스(Gmail 등)에 로그인 되어 있는지 확인
     - 다른 Google 계정으로 시도
  4. **확장프로그램 권한 문제**:
     - 확장프로그램 설정에서 "Google 계정에 액세스" 권한이 허용되었는지 확인

#### 문제: 로그인 상태가 유지되지 않음
- **증상**: 브라우저를 다시 열 때마다 로그인 필요
- **해결 방법**:
  1. Chrome 설정에서 쿠키 및 사이트 데이터 설정 확인
  2. 브라우저 종료 시 쿠키 삭제 옵션이 활성화되어 있는지 확인
  3. 확장프로그램 권한 재확인
  4. Chrome의 로그인 상태 확인

### 2.3 자막 표시 문제

#### 문제: 자막이 표시되지 않음
- **증상**: 비디오 재생 중에 자막이 나타나지 않음
- **해결 방법**:
  1. 확장프로그램 아이콘 클릭 후 자막 기능이 활성화되어 있는지 확인
  2. 페이지를 새로고침
  3. 다른 비디오에서도 문제가 발생하는지 확인
  4. 지원되는 플랫폼인지 확인 (현재 버전에서는 YouTube만 지원할 수 있음)
  5. 자막 설정에서 언어 선택 확인

#### 문제: 자막이 동영상과 동기화되지 않음
- **증상**: 자막이 오디오/영상과 시간적으로 일치하지 않음
- **해결 방법**:
  1. 페이지 새로고침
  2. 비디오 플레이어에서 다른 위치로 이동 후 다시 원래 위치로 돌아오기
  3. 설정에서 자막 지연 조정 옵션 사용 (이 기능이 구현된 경우)
  4. 브라우저 캐시 삭제 후 재시도

#### 문제: 자막 스타일 설정이 적용되지 않음
- **증상**: 설정에서 변경한 폰트, 크기, 색상 등이 적용되지 않음
- **해결 방법**:
  1. 설정 저장 후 페이지 새로고침
  2. 콘텐츠 스크립트가 차단되지 않았는지 확인
  3. 브라우저 확장 설정에서 "사이트에서 데이터 읽기 및 변경" 권한 확인
  4. 확장프로그램 재설치

### 2.4 성능 및 호환성 문제

#### 문제: 확장프로그램 사용 시 브라우저 성능 저하
- **증상**: 확장프로그램 활성화 시 브라우저가 느려지거나 동영상 재생이 버벅거림
- **해결 방법**:
  1. 다른 확장프로그램 비활성화 후 테스트
  2. 브라우저 캐시 및 임시 파일 삭제
  3. 하드웨어 가속 활성화 확인
  4. 메모리 사용량이 적은 모드 사용 (가능한 경우)

#### 문제: 특정 웹사이트에서 작동하지 않음
- **증상**: 일부 비디오 플랫폼에서 자막 기능이 작동하지 않음
- **해결 방법**:
  1. 지원되는 플랫폼 목록 확인
  2. 해당 사이트에서 콘텐츠 스크립트 실행이 허용되었는지 확인
  3. 사이트의 보안 정책(CSP)이 확장프로그램 실행을 차단하는지 확인
  4. 개발팀에 미지원 플랫폼 보고

## 3. 개발자용 문제 해결

### 3.1 개발 환경 설정 문제

#### 문제: 개발 모드에서 확장프로그램 로드 실패
- **증상**: "압축해제된 확장프로그램 로드" 시 오류 발생
- **해결 방법**:
  1. `manifest.json` 파일 형식 및 오류 확인
  2. 필수 파일이 모두 존재하는지 확인
  3. Chrome 버전이 manifest 버전과 호환되는지 확인
  4. 개발자 콘솔 로그에서 구체적인 오류 메시지 확인

#### 문제: 변경 사항이 적용되지 않음
- **증상**: 코드를 수정해도 확장프로그램에 반영되지 않음
- **해결 방법**:
  1. 확장프로그램 관리 페이지에서 "새로고침" 아이콘 클릭
  2. 브라우저를 완전히 재시작
  3. 개발 모드에서 확장프로그램 제거 후 다시 로드
  4. 캐시된 서비스 워커가 있는 경우 "서비스 워커 업데이트" 버튼 클릭

### 3.2 인증 및 API 통합 문제

#### 문제: Chrome Identity API 오류
- **증상**: `chrome.identity.getAuthToken` 호출 시 오류 발생
- **해결 방법**:
  1. `manifest.json`에 올바른 OAuth client ID가 설정되어 있는지 확인
  2. 필요한 권한이 manifest에 선언되어 있는지 확인 (`identity` 및 관련 스코프)
  3. Google Developer Console에서 OAuth 클라이언트 설정 확인
  4. 리디렉션 URI가 올바르게 등록되어 있는지 확인

#### 문제: Firebase 연동 오류
- **증상**: Firebase 인증 또는 Firestore 작업 실패
- **해결 방법**:
  1. Firebase 구성 객체의 API 키와 프로젝트 ID 확인
  2. Firebase 콘솔에서 해당 프로젝트 설정 확인
  3. Firebase 보안 규칙이 적절히 설정되어 있는지 확인
  4. CORS 설정 확인 (API 호출 관련)

### 3.3 콘텐츠 스크립트 문제

#### 문제: 콘텐츠 스크립트가 실행되지 않음
- **증상**: 비디오 페이지에서 자막 기능이 작동하지 않음
- **해결 방법**:
  1. `manifest.json`의 content_scripts 섹션 확인
  2. 콘텐츠 스크립트의 matches 패턴이 해당 페이지와 일치하는지 확인
  3. 콘솔 로그에서 오류 확인
  4. 페이지의 CSP(Content Security Policy)가 스크립트 실행을 차단하는지 확인

#### 문제: DOM 요소 접근 오류
- **증상**: 비디오 요소를 찾을 수 없거나 접근할 수 없음
- **해결 방법**:
  1. 페이지 로드 타이밍 확인 (DOM이 완전히 로드된 후 스크립트 실행)
  2. MutationObserver를 사용하여 동적 요소 감지
  3. 선택자가 최신 플랫폼 구조와 일치하는지 확인
  4. `run_at` 옵션이 적절히 설정되어 있는지 확인 (`document_idle` 권장)

### 3.4 백그라운드 스크립트 문제

#### 문제: 백그라운드 스크립트가 종료됨
- **증상**: 일정 시간 후 백그라운드 기능이 작동하지 않음
- **해결 방법**:
  1. Manifest V3를 사용하는 경우 서비스 워커 수명 주기 확인
  2. 필요한 경우 주기적인 이벤트나 메시지로 서비스 워커 활성 유지
  3. 장기 실행 작업을 비동기적으로 처리하도록 리팩토링
  4. 상태 정보를 스토리지에 보관하여 재시작 시 복구 가능하도록 구현

#### 문제: 메시지 통신 오류
- **증상**: 백그라운드 스크립트와 다른 컴포넌트 간 메시지가 전달되지 않음
- **해결 방법**:
  1. 메시지 리스너가 올바르게 등록되었는지 확인
  2. 메시지 형식 및 필드 확인
  3. 비동기 응답을 사용하는 경우 `return true;` 추가
  4. 개발자 도구의 백그라운드 페이지 콘솔에서 로그 확인

## 4. 공통 오류 코드 및 메시지

### 4.1 인증 관련 오류

| 오류 코드 | 메시지 | 가능한 원인 | 해결 방법 |
|---------|-------|-----------|---------|
| `ERR_AUTH_REQUIRED` | "Authentication required" | 사용자가 로그인하지 않음 | 로그인 프로세스 진행 |
| `ERR_AUTH_FAILED` | "Authentication failed" | 잘못된 자격 증명 또는 API 오류 | 자격 증명 확인 및 재시도 |
| `ERR_TOKEN_EXPIRED` | "Token expired" | OAuth 토큰 만료 | 토큰 갱신 프로세스 진행 |
| `ERR_PERMISSION_DENIED` | "Permission denied" | 필요한 권한 없음 | 권한 설정 확인 및 요청 |

### 4.2 API 및 네트워크 오류

| 오류 코드 | 메시지 | 가능한 원인 | 해결 방법 |
|---------|-------|-----------|---------|
| `ERR_NETWORK_FAILURE` | "Network failure" | 인터넷 연결 문제 | 네트워크 연결 확인 |
| `ERR_API_UNAVAILABLE` | "API unavailable" | 외부 API 서비스 중단 | 서비스 상태 확인 및 나중에 재시도 |
| `ERR_RATE_LIMIT` | "Rate limit exceeded" | API 호출 한도 초과 | 요청 빈도 감소 및 나중에 재시도 |
| `ERR_TIMEOUT` | "Request timeout" | 응답 대기 시간 초과 | 네트워크 상태 확인 및 재시도 |

### 4.3 자막 관련 오류

| 오류 코드 | 메시지 | 가능한 원인 | 해결 방법 |
|---------|-------|-----------|---------|
| `ERR_SUBTITLES_NOT_FOUND` | "Subtitles not found" | 요청한 언어의 자막 없음 | 다른 언어 선택 또는 자동 번역 사용 |
| `ERR_VIDEO_NOT_SUPPORTED` | "Video not supported" | 지원되지 않는 비디오 플랫폼 | 지원되는 플랫폼 확인 |
| `ERR_VIDEO_ELEMENT_NOT_FOUND` | "Video element not found" | 비디오 DOM 요소를 찾을 수 없음 | 페이지 새로고침 또는 선택자 업데이트 |
| `ERR_SUBTITLE_PARSING` | "Failed to parse subtitles" | 자막 데이터 형식 오류 | 자막 소스 및 파싱 로직 확인 |

## 5. 디버깅 가이드

### 5.1 기본 디버깅 도구

#### Chrome 개발자 도구 사용
1. 확장프로그램 아이콘에서 마우스 오른쪽 버튼 클릭 → "검사"
2. 백그라운드 페이지 디버깅: 확장프로그램 관리 페이지에서 "백그라운드 페이지 검사" 링크 클릭
3. 콘텐츠 스크립트 디버깅: 웹 페이지에서 개발자 도구 열기 → Sources 탭 → Content Scripts 섹션

#### 로깅 및 디버깅 전략
- 의미 있는 로그 메시지 사용
```javascript
function authenticateUser() {
  console.log('[Whatsub] Starting authentication process');
  
  // 인증 로직
  
  console.log('[Whatsub] Authentication result:', result);
  return result;
}
```

- 에러 상황에서 상세한 정보 로깅
```javascript
try {
  // 위험할 수 있는 작업
} catch (error) {
  console.error('[Whatsub] Error during subtitle processing:', {
    error: error.message,
    stack: error.stack,
    videoId: currentVideoId,
    timestamp: Date.now()
  });
}
```

### 5.2 고급 디버깅 기법

#### 확장프로그램 내부 상태 검사
- Storage API를 통해 현재 상태 확인
```javascript
// 개발자 콘솔에서 실행
chrome.storage.local.get(null, function(items) {
  console.log('Current storage state:', items);
});
```

- 비동기 작업 추적
```javascript
async function trackAsyncOperation(operationName, asyncFn, ...args) {
  console.log(`[Whatsub] Starting ${operationName}`);
  const startTime = performance.now();
  
  try {
    const result = await asyncFn(...args);
    const duration = performance.now() - startTime;
    console.log(`[Whatsub] ${operationName} completed in ${duration.toFixed(2)}ms`, result);
    return result;
  } catch (error) {
    console.error(`[Whatsub] ${operationName} failed after ${(performance.now() - startTime).toFixed(2)}ms`, error);
    throw error;
  }
}

// 사용 예시
trackAsyncOperation('fetchSubtitles', fetchSubtitlesFromAPI, videoId, language);
```

#### 네트워크 요청 모니터링
- 개발자 도구의 Network 탭 사용
- 필터: 확장프로그램 ID나 관련 도메인으로 필터링

#### 성능 프로파일링
- 개발자 도구의 Performance 탭 사용
- 주요 지점에 성능 마커 추가
```javascript
// 성능 측정 시작
performance.mark('subtitles-processing-start');

// 작업 수행
processSubtitles(data);

// 성능 측정 종료 및 결과 로깅
performance.mark('subtitles-processing-end');
performance.measure('subtitles-processing', 'subtitles-processing-start', 'subtitles-processing-end');
console.log(performance.getEntriesByName('subtitles-processing')[0]);
```

## 6. 일반적인 해결 전략

### 6.1 문제 격리

1. **컴포넌트 격리**:
   - 문제가 발생하는 컴포넌트(백그라운드, 팝업, 콘텐츠 스크립트) 식별
   - 독립적으로 테스트하여 상호작용 문제 확인

2. **기능 격리**:
   - 최소한의 기능만 포함한 테스트 버전 만들기
   - 기능을 점진적으로 추가하면서 문제 식별

3. **환경 격리**:
   - 다른 브라우저 프로필에서 테스트
   - 다른 확장프로그램 비활성화
   - 시크릿 모드에서 테스트

### 6.2 일반적인 해결책

1. **설정 초기화**:
   - 스토리지 데이터 삭제
   ```javascript
   chrome.storage.local.clear(function() {
     console.log('Local storage cleared');
   });
   ```
   - 기본 설정으로 재설정

2. **재설치 및 새로고침**:
   - 확장프로그램 제거 후 재설치
   - 브라우저 캐시 삭제
   - 브라우저 재시작

3. **버전 관리**:
   - 이전 버전으로 롤백
   - 점진적 업데이트로 문제 버전 식별

### 6.3 메모리 누수 및 성능 문제 해결

1. **이벤트 리스너 관리**:
   - 이벤트 리스너 등록 및 제거 추적
   ```javascript
   // 이벤트 리스너 추적 함수
   const trackedListeners = new Map();
   
   function addTrackedListener(element, eventType, handler) {
     element.addEventListener(eventType, handler);
     
     if (!trackedListeners.has(element)) {
       trackedListeners.set(element, new Map());
     }
     
     const elementListeners = trackedListeners.get(element);
     if (!elementListeners.has(eventType)) {
       elementListeners.set(eventType, new Set());
     }
     
     elementListeners.get(eventType).add(handler);
   }
   
   function removeTrackedListener(element, eventType, handler) {
     element.removeEventListener(eventType, handler);
     
     if (trackedListeners.has(element)) {
       const elementListeners = trackedListeners.get(element);
       if (elementListeners.has(eventType)) {
         elementListeners.get(eventType).delete(handler);
       }
     }
   }
   
   function removeAllTrackedListeners() {
     for (const [element, elementListeners] of trackedListeners.entries()) {
       for (const [eventType, handlers] of elementListeners.entries()) {
         for (const handler of handlers) {
           element.removeEventListener(eventType, handler);
         }
       }
     }
     
     trackedListeners.clear();
   }
   ```

2. **주기적인 자원 정리**:
   - 캐시 데이터 정리
   - 사용하지 않는 객체 참조 제거

3. **성능 모니터링**:
   - 주기적인 메모리 사용량 체크
   ```javascript
   // 메모리 사용량 로깅 함수
   function logMemoryUsage() {
     if (performance && performance.memory) {
       console.log('Memory usage:', {
         totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)) + 'MB',
         usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) + 'MB',
         jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)) + 'MB'
       });
     }
   }
   
   // 주기적으로 메모리 사용량 로깅
   setInterval(logMemoryUsage, 60000); // 1분마다
   ```

## 7. 지원 및 피드백 채널

### 7.1 문제 보고 방법
- GitHub 이슈 생성 (이슈 템플릿 사용)
- 사용자 피드백 폼 제공
- 개발자 이메일 연락

### 7.2 필요한 정보
- 발생한 문제의 명확한 설명
- 재현 단계
- 확장프로그램 버전
- 브라우저 버전 및 OS
- 오류 메시지 또는 스크린샷
- 관련 로그 정보

## 변경 이력
- 2023-06-25: 최초 문서 작성 