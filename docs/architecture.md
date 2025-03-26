# Whatsub 확장프로그램 아키텍처 문서

버전: 1.0.0
최종 업데이트: 2023-06-25

## 1. 아키텍처 개요

Whatsub 확장프로그램은 Chrome 브라우저 확장 프로그램으로, 다양한 동영상 플랫폼에서 자막 서비스를 제공합니다. 이 문서는 확장프로그램의 아키텍처를 상세히 설명합니다.

### 1.1 주요 컴포넌트

```
Whatsub 확장프로그램
├── Background Service (백그라운드 서비스)
├── Popup UI (팝업 인터페이스)
├── Content Script (콘텐츠 스크립트)
└── External Services (외부 서비스)
    ├── Firebase (인증 및 데이터 저장)
    ├── 결제 시스템 (Stripe 또는 Chrome Web Store)
    └── 번역 API
```

### 1.2 컴포넌트 간 통신

```
                                   ┌───────────────────┐
                                   │                   │
                                   │  External APIs    │
                                   │                   │
                                   └─────────┬─────────┘
                                             │
                                             │
┌───────────────────┐           ┌───────────┴─────────┐           ┌───────────────────┐
│                   │  메시지   │                     │  메시지   │                   │
│   Popup UI        │◄─────────►│  Background Service │◄─────────►│  Content Script   │
│                   │  통신     │                     │  통신     │                   │
└───────────────────┘           └─────────────────────┘           └───────────────────┘
                                             │
                                             │
                                   ┌─────────┴─────────┐
                                   │                   │
                                   │  Storage          │
                                   │                   │
                                   └───────────────────┘
```

## 2. 주요 컴포넌트 상세

### 2.1 Background Service (백그라운드 서비스)

백그라운드 서비스는 확장프로그램의 핵심 로직을 처리하며, 브라우저가 실행되는 동안 지속적으로 실행됩니다.

#### 주요 역할
- 인증 상태 관리
- 메시지 라우팅 및 처리
- 외부 API와의 통신
- 스토리지 관리

#### 구현 파일
- `background.js`: 기본 백그라운드 프로세스
- `lib/firebase-sdk.js`: Firebase 연동 모듈

#### 주요 기능
```javascript
// 인증 상태 관리 예시
chrome.identity.getAuthToken({ interactive: true }, function(token) {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }
  
  // Firebase 인증 처리
  const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
  firebase.auth().signInWithCredential(credential)
    .then((userCredential) => {
      // 사용자 인증 성공
      const user = userCredential.user;
      chrome.storage.local.set({ 'user': user });
    })
    .catch((error) => {
      console.error('Authentication error:', error);
    });
});
```

### 2.2 Popup UI (팝업 인터페이스)

팝업 인터페이스는 사용자가 확장프로그램 아이콘을 클릭했을 때 표시되는 UI로, 로그인/로그아웃 및 설정 기능을 제공합니다.

#### 주요 역할
- 사용자 로그인/로그아웃 UI
- 설정 인터페이스
- 구독 및 결제 관리 (계획됨)
- 상태 표시 및 피드백

#### 구현 파일
- `popup.html`: 팝업 UI 구조
- `popup.js`: 팝업 로직
- `styles/popup.css`: 팝업 스타일

#### 주요 기능
```javascript
// 로그인 버튼 핸들러 예시
document.getElementById('login-button').addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: 'login' }, function(response) {
    if (response.success) {
      updateUI('logged-in');
    } else {
      showError(response.error);
    }
  });
});
```

### 2.3 Content Script (콘텐츠 스크립트)

콘텐츠 스크립트는 웹 페이지에 삽입되어 동영상 요소를 감지하고 자막을 표시하는 역할을 합니다.

#### 주요 역할
- 비디오 요소 감지
- 자막 컨테이너 생성 및 관리
- 자막 데이터 요청 및 표시
- 비디오 타임라인과 자막 동기화

#### 구현 파일
- `content.js`: 기본 콘텐츠 스크립트
- `styles/subtitles.css`: 자막 스타일

#### 주요 기능
```javascript
// 비디오 요소 감지 예시
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.addedNodes) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeName === 'VIDEO') {
          initializeSubtitles(node);
        }
      });
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

function initializeSubtitles(videoElement) {
  // 자막 컨테이너 생성
  const subtitleContainer = document.createElement('div');
  subtitleContainer.className = 'whatsub-container';
  videoElement.parentNode.appendChild(subtitleContainer);
  
  // 자막 데이터 요청 및 표시 로직
  // ...
}
```

### 2.4 External Services (외부 서비스)

확장프로그램은 다양한 외부 서비스와 연동하여 기능을 확장합니다.

#### Firebase
- **인증**: Google OAuth를 통한 사용자 인증
- **Firestore**: 사용자 설정 및 구독 정보 저장
- **Functions**: 서버리스 백엔드 기능 (결제 처리 등)

#### 결제 시스템 (계획됨)
- Stripe API 연동
- 구독 관리 및 결제 처리
- 프리미엄 기능 접근 제어

#### 번역 API (계획됨)
- Google Cloud Translation API
- 자막 실시간 번역
- 다국어 지원

## 3. 데이터 흐름 상세

### 3.1 인증 데이터 흐름

```
1. 사용자가 로그인 버튼 클릭 (Popup UI)
2. 로그인 요청 메시지 전송 (Popup → Background)
3. Chrome Identity API를 통한 토큰 요청 (Background)
4. Google OAuth 인증 처리 (External: Google)
5. Firebase 인증 처리 (External: Firebase)
6. 사용자 정보 저장 (Background → Storage)
7. 인증 성공 메시지 전송 (Background → Popup)
8. UI 상태 업데이트 (Popup UI)
9. 인증 상태 전파 (Background → Content Script)
```

### 3.2 자막 표시 데이터 흐름

```
1. 웹 페이지 로드 및 콘텐츠 스크립트 실행
2. 비디오 요소 감지 (Content Script)
3. 자막 컨테이너 생성 (Content Script)
4. 현재 비디오 정보 요청 (Content Script → Background)
5. 자막 데이터 요청 (Background → External API)
6. 자막 데이터 반환 (External API → Background → Content Script)
7. 비디오 타임라인과 자막 동기화 (Content Script)
8. 자막 렌더링 (Content Script)
```

### 3.3 설정 관리 데이터 흐름

```
1. 사용자가 설정 변경 (Popup UI)
2. 설정 저장 요청 (Popup → Background)
3. Firebase 설정 저장 (Background → External: Firebase)
4. 로컬 설정 캐시 업데이트 (Background → Storage)
5. 설정 변경 알림 (Background → Content Script)
6. 자막 표시 스타일 업데이트 (Content Script)
```

## 4. 기술 스택 상세

### 4.1 프론트엔드
- HTML5, CSS3, JavaScript (ES6+)
- 웹 컴포넌트 또는 경량 프레임워크 고려 (계획)

### 4.2 백엔드 (서버리스)
- Firebase Authentication
- Firebase Firestore
- Firebase Functions (계획됨)

### 4.3 API 및 서비스
- Chrome Extension API
- Chrome Identity API
- Firebase SDK
- Stripe API (계획됨)
- Google Cloud Translation API (계획됨)

### 4.4 인프라
- Firebase 호스팅 및 서비스
- Chrome Web Store 배포

## 5. 보안 아키텍처

### 5.1 인증 및 권한 관리
- OAuth 2.0 프로토콜 사용
- JWT 기반 인증 토큰 관리
- 최소 권한 원칙 적용

### 5.2 데이터 보안
- HTTPS 통신 강제
- 민감 데이터 암호화 저장
- 토큰 안전한 관리

### 5.3 코드 보안
- 코드 난독화 및 최소화
- CSP (Content Security Policy) 적용
- 입력 검증 및 출력 이스케이프

## 6. 성능 최적화 전략

### 6.1 로딩 최적화
- 코드 분할 및 지연 로딩
- 리소스 캐싱
- 필요한 권한만 요청

### 6.2 렌더링 최적화
- 자막 렌더링 성능 최적화
- 애니메이션 최적화
- DOM 조작 최소화

### 6.3 메모리 관리
- 이벤트 리스너 정리
- 객체 및 참조 관리
- 메모리 누수 방지

## 7. 확장성 설계

### 7.1 플랫폼 확장성
- 플랫폼별 어댑터 패턴 적용
- 공통 인터페이스를 통한 통합
- 플러그인 아키텍처 고려 (계획)

### 7.2 기능 확장성
- 모듈식 설계로 새 기능 쉽게 추가
- 기능 플래그를 통한 점진적 출시
- 확장 가능한 설정 시스템

### 7.3 스케일링 전략
- 데이터 샤딩 및 파티셔닝
- 캐싱 전략
- 백오프 및 재시도 메커니즘

## 변경 이력
- 2023-06-25: 최초 문서 작성 