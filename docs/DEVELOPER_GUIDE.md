# Whatsub 개발자 가이드

## 목차
1. [새로운 기능 추가 방법](#1-새로운-기능-추가-방법)
2. [디버깅 가이드](#2-디버깅-가이드)
3. [코드 스타일 가이드](#3-코드-스타일-가이드)
4. [확장 프로그램 배포 및 업데이트 프로세스](#4-확장-프로그램-배포-및-업데이트-프로세스)
5. [성능 최적화 가이드](#5-성능-최적화-가이드)

---

## 1. 새로운 기능 추가 방법

### 1.1 기능 기획 체크리스트
- [ ] 기능의 목적과 사용자 가치 정의
- [ ] 기존 기능과의 연계성 검토
- [ ] 기술적 구현 가능성 평가
- [ ] 필요한 권한 및 리소스 식별
- [ ] UI/UX 설계 (필요한 경우)
- [ ] 테스트 계획 수립

### 1.2 코드 구현 단계별 접근법
1. **기능 설계**
   - 클래스/함수 구조 설계
   - API 엔드포인트 정의 (필요한 경우)
   - 데이터 흐름 다이어그램 작성

2. **프로토타입 개발**
   - 핵심 기능 최소 구현
   - 분리된 환경에서 테스트

3. **전체 기능 구현**
   - 모듈별 코드 작성
   - 유닛 테스트 작성
   - 기존 코드와 통합

4. **검증 및 최적화**
   - 코드 리뷰 진행
   - 성능 테스트
   - 코드 최적화

### 1.3 기존 코드와의 통합 방법
1. **의존성 식별**
   - 기존 모듈과의 의존성 확인
   - 필요한 상태 및 데이터 흐름 파악

2. **인터페이스 설계**
   - 기존 코드와 새 기능 사이의 인터페이스 정의
   - 명확한 API 계약 설정

3. **점진적 통합**
   - 작은 단위로 나누어 통합
   - 각 단계마다 회귀 테스트 수행

4. **문서화**
   - 통합 과정 및 결과 문서화
   - API 및 사용법 문서 업데이트

### 1.4 테스트 및 검증 방법
1. **유닛 테스트**
   - 개별 함수 및 모듈 테스트
   - Jest 또는 유사한 테스트 프레임워크 사용

2. **통합 테스트**
   - 여러 모듈 간의 상호작용 테스트
   - 실제 환경과 유사한 조건에서 테스트

3. **브라우저 테스트**
   - 다양한 브라우저에서 호환성 확인
   - 서로 다른 OS 환경에서 테스트

4. **사용자 테스트**
   - 실제 사용자 시나리오에 따른 테스트
   - 피드백 수집 및 개선

---

## 2. 디버깅 가이드

### 2.1 Chrome 확장 프로그램 디버깅 설정 방법
1. **개발자 모드 활성화**
   - `chrome://extensions/` 접속
   - 개발자 모드 토글 활성화
   - "압축해제된 확장프로그램 로드" 클릭하여 개발 중인 확장 로드

2. **확장 프로그램 배경 페이지 디버깅**
   - 확장 프로그램 관리 페이지에서 "백그라운드 페이지 검사" 클릭
   - 개발자 도구가 열리면 콘솔, 소스, 네트워크 탭 사용

3. **로컬 스토리지 확인**
   - 개발자 도구의 Application 탭 사용
   - 확장 프로그램의 스토리지 내용 확인 및 수정

### 2.2 백그라운드 스크립트 디버깅 방법
1. **로깅 활용**
   - 중요 지점에 `console.log()` 추가
   - 모든 로그에 `[Whatsub]` 접두사 사용하여 식별 용이하게 함

2. **디버거 문 사용**
   - 중단점을 설정하려면 코드에 `debugger;` 삽입
   - 소스 패널에서 중단점 관리

3. **오류 처리**
   - 모든 비동기 코드에 try-catch 블록 사용
   - 에러 발생 시 상세 로그 기록

4. **상태 모니터링**
   - 백그라운드 스크립트의 상태 변화 모니터링
   - `chrome.storage`를 통해 저장된 데이터 확인

### 2.3 콘텐츠 스크립트 디버깅 방법
1. **개발자 도구 접근**
   - 웹 페이지에서 F12 또는 오른쪽 클릭 -> "검사" 선택
   - Sources 탭 -> Content Scripts 섹션에서 스크립트 찾기

2. **요소 검사**
   - Elements 탭에서 DOM 요소 검사
   - 자막 컨테이너 및 UI 요소의 스타일, 속성 확인

3. **이벤트 디버깅**
   - 이벤트 리스너 확인
   - 이벤트 발생 시 실행되는 코드 추적

4. **콘솔 필터링**
   - 콘솔에서 `[Whatsub]` 필터 적용하여 관련 로그만 표시

### 2.4 메시지 통신 디버깅 방법
1. **메시지 흐름 추적**
   - 각 메시지 전송/수신 지점에 로그 추가
   - 메시지 객체 구조 및 내용 로깅

2. **동기/비동기 통신 구분**
   - 비동기 응답이 필요한 경우 `return true;` 추가
   - 응답 콜백 함수에서 로깅

3. **오류 처리**
   - `chrome.runtime.lastError` 확인
   - 메시지 핸들러에서 모든 예외 포착

4. **성능 모니터링**
   - 메시지 전송 및 처리 시간 측정
   - 과도한 메시지 교환 패턴 식별

### 2.5 주입된 스크립트 디버깅 방법
1. **스크립트 주입 확인**
   - DOM에 스크립트가 성공적으로 주입되었는지 확인
   - `window.postMessage` 통신 상태 확인

2. **샌드박스 환경 고려**
   - 주입된 스크립트의 제한된 권한 인식
   - 제한된 환경에서의 기능 테스트

3. **통신 채널 디버깅**
   - `window.addEventListener('message')` 로직 검증
   - 메시지 원본 및 구조 확인

4. **DOM 상호작용 디버깅**
   - 주입된 스크립트의 DOM 변경 추적
   - 이벤트 버블링 및 캡처링 동작 검증

---

## 3. 코드 스타일 가이드

### 3.1 명명 규칙
- **변수 및 함수명**: camelCase 사용
  ```javascript
  let videoElement;
  function processSubtitle() { ... }
  ```

- **클래스명**: PascalCase 사용
  ```javascript
  class SubtitleManager { ... }
  ```

- **상수**: 대문자와 밑줄 사용
  ```javascript
  const MAX_RETRY_COUNT = 3;
  ```

- **접두사 규칙**:
  - 비공개(private) 속성/메소드: 밑줄(_) 접두사 사용
  ```javascript
  this._privateVariable = value;
  ```
  - 로깅: `[Whatsub]` 접두사 사용
  ```javascript
  console.log('[Whatsub] 초기화 완료');
  ```

### 3.2 코드 구조 및 포맷팅
- **들여쓰기**: 2칸 공백 사용
- **중괄호 스타일**: 동일 라인에 시작 중괄호 위치
  ```javascript
  if (condition) {
    // 코드
  }
  ```

- **라인 길이**: 최대 80자
- **세미콜론**: 모든 문장 끝에 세미콜론 사용
- **공백 사용**:
  - 연산자 전후에 공백
  - 콤마 후에 공백
  - 함수 매개변수 콤마 뒤에 공백

- **모듈 구조**:
  ```javascript
  // 1. 임포트
  // 2. 상수 정의
  // 3. 내부 함수/클래스 선언
  // 4. 주요 기능 구현
  // 5. 이벤트 리스너
  // 6. 초기화 함수
  // 7. 익스포트
  ```

### 3.3 주석 작성 지침
- **파일 헤더 주석**:
  ```javascript
  /**
   * @file subtitle-manager.js
   * @description 자막 표시 및 관리를 위한 모듈
   * @version 1.0.0
   */
  ```

- **함수 주석**:
  ```javascript
  /**
   * 자막을 화면에 표시합니다.
   * @param {string} text - 표시할 자막 텍스트
   * @param {Object} options - 자막 표시 옵션
   * @param {number} options.duration - 표시 지속 시간(ms)
   * @returns {boolean} 성공 여부
   */
  function showSubtitle(text, options) { ... }
  ```

- **코드 중간 주석**: 복잡한 로직 설명
  ```javascript
  // 여기서 시간 오프셋을 조정하여 자막 싱크를 맞춤
  const adjustedTime = currentTime + timeOffset;
  ```

- **TODO 주석**: 추후 작업 필요 사항
  ```javascript
  // TODO: 성능 최적화 필요
  ```

### 3.4 오류 처리 패턴
- **비동기 작업의 오류 처리**:
  ```javascript
  async function fetchData() {
    try {
      const response = await apiCall();
      return response.data;
    } catch (error) {
      console.error('[Whatsub] 데이터 가져오기 실패:', error.message);
      return null;
    }
  }
  ```

- **Chrome API 오류 처리**:
  ```javascript
  chrome.runtime.sendMessage(message, response => {
    if (chrome.runtime.lastError) {
      console.error('[Whatsub] 메시지 전송 실패:', chrome.runtime.lastError.message);
      return;
    }
    // 성공 처리
  });
  ```

- **사용자 친화적 오류 메시지**:
  ```javascript
  function handleError(error, userMessage) {
    console.error('[Whatsub] 오류:', error);
    showNotification(userMessage || '작업 중 오류가 발생했습니다.');
  }
  ```

### 3.5 비동기 코드 작성 패턴
- **Promises 사용**:
  ```javascript
  function loadSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(['settings'], result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result.settings || defaultSettings);
      });
    });
  }
  ```

- **async/await 사용**:
  ```javascript
  async function initialize() {
    try {
      const settings = await loadSettings();
      const isLoggedIn = await checkAuthStatus();
      
      setupUI(settings, isLoggedIn);
    } catch (error) {
      handleError(error, '초기화 중 오류가 발생했습니다.');
    }
  }
  ```

- **병렬 처리**:
  ```javascript
  async function loadResources() {
    try {
      const [settings, userProfile, preferences] = await Promise.all([
        loadSettings(),
        fetchUserProfile(),
        loadPreferences()
      ]);
      
      return { settings, userProfile, preferences };
    } catch (error) {
      handleError(error);
      return null;
    }
  }
  ```

---

## 4. 확장 프로그램 배포 및 업데이트 프로세스

### 4.1 버전 관리 방법
1. **시맨틱 버전 관리**
   - 버전 형식: `X.Y.Z` (메이저.마이너.패치)
   - 메이저: 호환성이 깨지는 변경
   - 마이너: 기능 추가 (하위 호환성 유지)
   - 패치: 버그 수정

2. **버전 업데이트 절차**
   - `manifest.json`의 버전 필드 업데이트
   - `package.json`의 버전 필드 업데이트 (존재하는 경우)
   - 문서 내 버전 참조 업데이트

3. **개발 단계별 버전 접미사**
   - 알파: `0.1.0-alpha.1`
   - 베타: `0.1.0-beta.1`
   - 릴리스 후보: `0.1.0-rc.1`

### 4.2 변경 로그 관리
1. **변경 로그 구조**
   ```markdown
   # 변경 로그

   ## [0.2.0] - 2025-04-15
   ### 추가
   - 실시간 자막 기능 추가
   - 쉐도잉 학습 모드 추가

   ### 변경
   - 자막 표시 UI 개선
   - 성능 최적화

   ### 수정
   - 일부 웹사이트에서 자막이 표시되지 않는 버그 수정
   ```

2. **변경 사항 분류**
   - 추가(Added): 새로운 기능
   - 변경(Changed): 기존 기능 변경
   - 수정(Fixed): 버그 수정
   - 제거(Removed): 기능 제거

3. **변경 로그 관리 도구**
   - 수동 업데이트
   - 커밋 메시지 기반 자동 생성 고려

### 4.3 패키징 단계
1. **소스 코드 준비**
   - 불필요한 파일 제거 (개발용 스크립트, 문서 등)
   - 디버그 코드 및 로그 제거 또는 최소화
   - 코드 최소화(minify) 및 번들링

2. **매니페스트 파일 확인**
   - 버전 번호 업데이트
   - 권한 목록 검토 (최소 권한 원칙)
   - CSP(Content Security Policy) 설정 확인

3. **패키지 생성**
   - ZIP 파일 생성
   - 패키지 크기 최적화

4. **사전 테스트**
   - 패키지를 로컬에서 로드하여 테스트
   - 모든 주요 기능 동작 확인

### 4.4 Chrome 웹 스토어 배포 과정
1. **개발자 계정 설정**
   - Chrome 웹 스토어 개발자 계정 등록
   - 개발자 수수료 지불

2. **스토어 등록 정보 준비**
   - 확장 프로그램 설명 작성
   - 스크린샷, 프로모션 이미지 준비
   - 개인정보 처리방침 URL 준비

3. **제출 프로세스**
   - 웹 스토어 개발자 대시보드 접속
   - 새 항목 추가 또는 기존 항목 업데이트
   - ZIP 패키지 업로드
   - 스토어 정보 입력
   - 제출 및 검토 대기

4. **검토 대응**
   - Google의 검토 과정 모니터링
   - 거부 시 피드백에 따라 수정 후 재제출
   - 승인 후 사용자 피드백 모니터링

---

## 5. 성능 최적화 가이드

### 5.1 메모리 사용량 모니터링 방법
1. **Chrome 작업 관리자 사용**
   - Shift+Esc를 눌러 Chrome 작업 관리자 열기
   - 확장 프로그램의 메모리 사용량 확인

2. **개발자 도구 활용**
   - Performance 탭에서 메모리 사용량 기록
   - Memory 탭에서 메모리 스냅샷 생성 및 비교

3. **메모리 누수 탐지**
   - 장시간 실행 후 메모리 사용량 증가 확인
   - 개체 보유 추적
   - 이벤트 리스너 정리 확인

4. **최적화 기법**
   - 불필요한 DOM 요소 제거
   - 큰 객체는 사용 후 null 할당
   - 순환 참조 방지

### 5.2 렌더링 성능 최적화 방법
1. **DOM 조작 최소화**
   - 여러 변경사항을 일괄 처리
   - 문서 조각(DocumentFragment) 사용
   - DOM 요소 재사용

2. **스타일 최적화**
   - CSS 애니메이션 사용
   - transform 및 opacity 속성 활용
   - 복잡한 선택자 피하기

3. **레이아웃 스래싱 방지**
   - 스타일 변경 후 레이아웃 정보 읽기 방지
   - 클래스 변경을 통한 스타일 적용

4. **비동기 렌더링**
   - requestAnimationFrame 사용
   - 무거운 연산 웹 워커로 분리

### 5.3 메시지 통신 최적화 방법
1. **메시지 빈도 줄이기**
   - 배치 처리
   - 디바운싱 및 스로틀링 적용

2. **메시지 크기 최적화**
   - 필요한 데이터만 전송
   - 큰 데이터는 참조 또는 스토리지 활용

3. **통신 채널 선택**
   - chrome.runtime.sendMessage: 범용 통신
   - chrome.tabs.sendMessage: 특정 탭으로 통신
   - window.postMessage: 웹페이지와 통신

4. **캐싱 전략**
   - 자주 요청되는 데이터 로컬 캐싱
   - 상태 변경 시에만 메시지 전송

### 5.4 리소스 사용량 감소 방법
1. **이미지 최적화**
   - 적절한 형식 및 크기 사용
   - 지연 로딩 구현

2. **코드 분할**
   - 필요한 기능만 로드
   - 동적 임포트 활용

3. **백그라운드 작업 관리**
   - 불필요한 폴링 제거
   - 이벤트 기반 접근 방식 사용

4. **스토리지 최적화**
   - 필요한 데이터만 저장
   - 오래된 데이터 정리
   - 인덱싱 및 쿼리 최적화

---

## 6. 리소스 및 참조

### 유용한 도구
- [Chrome 확장 프로그램 개발자 문서](https://developer.chrome.com/docs/extensions/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [ESLint](https://eslint.org/) - 코드 품질 및 스타일 검사
- [Jest](https://jestjs.io/) - JavaScript 테스팅 프레임워크

### 관련 문서
- [troubleshooting.md](./troubleshooting.md) - 문제 해결 가이드
- [WHATSUB_PROJECT_DOCUMENTATION.md](./WHATSUB_PROJECT_DOCUMENTATION.md) - 프로젝트 종합 문서
- [oauth-authentication-guide.md](./oauth-authentication-guide.md) - 인증 시스템 가이드
- [PROJECT_CONTINUITY_GUIDE.md](./PROJECT_CONTINUITY_GUIDE.md) - 프로젝트 연속성 가이드

---

마지막 업데이트: 2025-04-15
버전: 1.0.0 