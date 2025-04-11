# WhaSub 파일 의존성 다이어그램

이 문서는 WhaSub 확장 프로그램의 파일 구조와 의존성을 설명합니다.

## 파일 구조 개요

```
my-next-app/public/extension/
├── manifest.json            # 확장 프로그램 선언 및 권한 정의
├── popup.html               # 확장 프로그램 팝업 UI
├── popup.js                 # 팝업 UI 로직
├── content-script.js        # 페이지에 주입되는 스크립트
├── content.js               # 페이지의 DOM 조작 메인 로직
├── background.js            # 백그라운드 서비스 로직
├── components/              # UI 컴포넌트
│   ├── SubtitleDisplay.js   # 자막 표시 UI
│   ├── CommentDisplay.js    # 댓글 표시 UI
│   └── StatusIndicator.js   # 상태 표시기 UI
├── services/                # 기능 서비스
│   ├── audioCapture.js      # 오디오 캡처 서비스
│   ├── authService.js       # 인증 서비스
│   ├── communityService.js  # 커뮤니티 자막 관리
│   ├── debugLogger.js       # 디버깅 로깅
│   └── videoCommentService.js # 비디오 댓글 서비스
├── styles/                  # CSS 스타일시트
│   ├── popup.css            # 팝업 UI 스타일
│   └── content.css          # 주입된 자막 UI 스타일
└── docs/                    # 문서
    ├── message-flow.md      # 메시지 통신 흐름 문서
    └── file-dependencies.md # 파일 의존성 문서 (현재 파일)
```

## 주요 파일 의존성 다이어그램

```
                   ┌─────────────┐
                   │manifest.json│
                   └──────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌───────────┐   ┌────────────┐  ┌────────────┐
    │ popup.html│   │content-script│  │background.js│
    └─────┬─────┘   └──────┬─────┘  └──────┬─────┘
          │                │                │
          ▼                ▼                ▼
    ┌───────────┐   ┌───────────┐    ┌──────────────┐
    │ popup.js  │◄─►│ content.js│◄───┤Firebase SDK   │
    └─────┬─────┘   └─────┬─────┘    └──────────────┘
          │               │
          │               ▼
          │         ┌───────────────┐
          └────────►│  components/  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   services/   │
                    └───────────────┘
```

## 파일별 세부 의존성

### manifest.json

- **역할**: 확장 프로그램의 메타데이터, 권한, 리소스 목록 정의
- **의존 컴포넌트**: 없음
- **의존받는 컴포넌트**: 모든 JS 파일

### popup.html/popup.js

- **역할**: 사용자 인터페이스 제공 및 이벤트 처리
- **의존 컴포넌트**:
  - `background.js` (메시지 통신)
  - `content-script.js` (메시지 통신)
  - `styles/popup.css` (UI 스타일)
- **사용 API**:
  - `chrome.runtime.sendMessage`
  - `chrome.tabs.sendMessage`
  - `chrome.storage.sync`

### content-script.js

- **역할**: 웹 페이지에 주입되어 자막 UI 관리 및 이벤트 처리
- **의존 컴포넌트**:
  - `content.js` (주요 로직)
  - `components/*.js` (UI 컴포넌트)
  - `services/*.js` (기능 서비스)
- **사용 API**:
  - `chrome.runtime.sendMessage`
  - `chrome.runtime.onMessage`

### content.js

- **역할**: 웹 페이지의 DOM 조작 및 자막/댓글 관리 로직
- **의존 컴포넌트**:
  - `components/SubtitleDisplay.js`
  - `components/CommentDisplay.js`
  - `services/audioCapture.js`
- **주요 함수**:
  - `setupSubtitles()`: 자막 UI 설정
  - `showSubtitle()`: 자막 표시
  - `translateSubtitle()`: 자막 번역

### background.js

- **역할**: 백그라운드에서 실행되는 서비스 로직, API 통신, 인증 관리
- **의존 컴포넌트**:
  - Firebase SDK
  - 외부 API (Whisper, 번역 서비스 등)
- **주요 기능**:
  - 인증 상태 관리
  - Whisper API 통신
  - 설정 저장 및 관리

### components/SubtitleDisplay.js

- **역할**: 자막 표시 UI 관리
- **의존 컴포넌트**: 없음
- **주요 메서드**:
  - `initialize()`: 자막 UI 초기화
  - `showSubtitle()`: 자막 텍스트 표시
  - `updateSettings()`: 자막 설정 업데이트

### components/CommentDisplay.js

- **역할**: 실시간 댓글 표시 UI 관리
- **의존 컴포넌트**: 없음
- **주요 메서드**:
  - `initialize()`: 댓글 UI 초기화
  - `displayComments()`: 댓글 표시
  - `updateSettings()`: 댓글 설정 업데이트

### services/communityService.js

- **역할**: 커뮤니티 자막 및 댓글 관리
- **의존 컴포넌트**:
  - `background.js` (인증 및 API 통신)
- **주요 메서드**:
  - `uploadSubtitle()`: 자막 업로드
  - `downloadSubtitle()`: 자막 다운로드
  - `searchSubtitles()`: 자막 검색

### services/videoCommentService.js

- **역할**: 비디오 재생 시간에 따른 댓글 관리
- **의존 컴포넌트**:
  - `components/CommentDisplay.js`
  - `background.js` (데이터 통신)
- **주요 메서드**:
  - `trackVideoTime()`: 비디오 시간 추적
  - `getCommentsAtTime()`: 특정 시간의 댓글 가져오기
  - `addComment()`: 댓글 추가

## 데이터 흐름 예시

### 자막 표시 프로세스

1. 사용자가 자막 토글 활성화 (popup.js)
2. `toggleSubtitles` 메시지 전송 (popup.js → content-script.js)
3. `setupSubtitles()` 함수 호출 (content-script.js)
4. `createSubtitleContainer()` 함수로 UI 생성 (content-script.js)
5. 자막 컨테이너 표시 (SubtitleDisplay.js)

### 실시간 댓글 표시 프로세스

1. `VideoCommentService.initialize()` 호출로 서비스 초기화
2. `trackVideoTime()` 함수가 비디오 재생 시간 추적
3. 특정 시간에 `getCommentsAtTime()` 호출로 해당 시간 댓글 가져오기
4. `CommentDisplay.displayComments()` 함수로 댓글 표시
5. 댓글이 화면을 가로질러 애니메이션 표시

### Whisper 음성 인식 프로세스

1. 사용자가 자동 인식 토글 활성화 (popup.js)
2. `startSpeechRecognition` 메시지 전송 (popup.js → background.js)
3. 오디오 캡처 시작 (background.js → AudioCapture 서비스)
4. 오디오 데이터 Whisper API로 전송 (background.js)
5. 인식된 텍스트와 번역 결과 수신 (background.js)
6. `newSubtitle` 메시지 전송 (background.js → content-script.js)
7. `showSubtitle()` 함수로 자막 표시 (content-script.js)

## 성능 고려사항

1. **메모리 사용량**: CommentDisplay 컴포넌트의 동시 댓글 수가 너무 많을 경우 성능 저하 가능성
2. **API 호출 빈도**: Whisper API 및 번역 API 호출 빈도 제한 고려 필요
3. **이벤트 리스너**: 페이지당 등록된 이벤트 리스너 수 모니터링 필요 