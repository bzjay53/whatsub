# WhaSub - 영상에 실시간 자막과 댓글을 입히는 크롬 확장 프로그램

WhaSub는 YouTube 및 일반 웹 비디오에 실시간으로 자막을 생성하고 커뮤니티 자막 및 댓글을 표시하는 크롬 확장 프로그램입니다.

## 주요 기능

- **실시간 자막 생성**: Whisper AI를 활용한, 비디오의 음성 내용을 실시간으로 자막으로 변환합니다.
- **커뮤니티 자막**: 사용자들이 자막 파일을 업로드하고 공유할 수 있습니다.
- **자막 번역**: 자동으로 자막을 사용자가 선택한 언어로 번역합니다.
- **실시간 댓글 표시**: 빌리빌리/틱톡 스타일의 비디오 타임스탬프 기반 댓글 시스템.
- **맞춤형 UI**: 자막 위치, 크기, 배경 투명도 등을 사용자가 조절할 수 있습니다.

## 설치 방법

1. Chrome 웹 스토어에서 "WhaSub" 확장 프로그램을 검색하여 설치합니다.
2. 또는 개발 모드에서 직접 설치:
   - Chrome 브라우저에서 `chrome://extensions/` 페이지 열기
   - 개발자 모드 활성화
   - "압축해제된 확장 프로그램 로드" 버튼 클릭
   - 이 저장소의 `/public/extension` 폴더 선택

## 사용 방법

1. 확장 프로그램 아이콘 클릭하여 팝업 메뉴 열기
2. Google 계정으로 로그인
3. "자막 필터 활성화" 토글을 켜고 영상 시청 시작
4. (선택 사항) "자동 인식" 토글을 켜서 실시간 자막 생성 활성화
5. 설정에서 원하는 언어 및 UI 옵션 선택

## 개발 가이드

### 프로젝트 구조

```
my-next-app/public/extension/
├── manifest.json            # 확장 프로그램 선언 및 권한 정의
├── popup.html               # 확장 프로그램 팝업 UI
├── popup.js                 # 팝업 UI 로직
├── content-script.js        # 페이지에 주입되는 스크립트
├── content.js               # 페이지의 DOM 조작 메인 로직
├── background.js            # 백그라운드 서비스 로직
├── components/              # UI 컴포넌트
├── services/                # 기능 서비스
├── styles/                  # CSS 스타일시트
└── docs/                    # 개발 문서
```

### 개발 환경 설정

1. 저장소 클론:
   ```
   git clone https://github.com/username/whatsub.git
   cd whatsub
   ```

2. 의존성 설치:
   ```
   npm install
   ```

3. 개발 서버 실행:
   ```
   npm run dev
   ```

4. 빌드:
   ```
   npm run build
   ```

### 문서 참고

추가 개발 정보는 다음 문서를 참조하세요:

- [메시지 통신 플로우](./docs/message-flow.md)
- [파일 의존성 다이어그램](./docs/file-dependencies.md)

## 주요 컴포넌트

### 1. SubtitleDisplay.js

자막 UI를 관리하는 컴포넌트입니다. 자막의 표시, 위치, 스타일 등을 담당합니다.

```javascript
const subtitleDisplay = new SubtitleDisplay();
subtitleDisplay.initialize();
subtitleDisplay.showSubtitle("Original text", "Translated text");
```

### 2. CommentDisplay.js

실시간 댓글 표시를 관리하는 컴포넌트입니다. 화면을 가로지르는 댓글 애니메이션을 담당합니다.

```javascript
const commentDisplay = new CommentDisplay();
commentDisplay.initialize();
commentDisplay.displayComments([{ text: "Sample comment", color: "#fff" }]);
```

### 3. videoCommentService.js

비디오 시간에 따른 댓글 관리 서비스입니다. 특정 시간에 어떤 댓글이 표시될지 관리합니다.

```javascript
const videoCommentService = new VideoCommentService();
videoCommentService.initialize();
videoCommentService.trackVideoTime();
```

### 4. communityService.js

커뮤니티 자막 및 댓글 관리 서비스입니다. 자막 파일 업로드, 다운로드, 검색 등을 담당합니다.

```javascript
const communityService = new CommunityService();
communityService.initialize();
communityService.searchSubtitles(videoUrl);
```

## 메시지 통신

컴포넌트 간 통신은 Chrome의 메시지 시스템을 통해 이루어집니다:

```javascript
// 메시지 보내기
chrome.runtime.sendMessage({ action: 'someAction', data: someData }, function(response) {
  // 응답 처리
});

// 메시지 받기
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'someAction') {
    // 처리 로직
    sendResponse({ success: true });
  }
});
```

## 문제 해결

일반적인 문제 및 해결 방법:

1. **자막이 표시되지 않는 경우**:
   - 자막 필터가 활성화되어 있는지 확인
   - 페이지를 새로고침한 후 다시 시도
   - 콘솔 오류 확인 (F12 > Console)

2. **인증 오류**:
   - 로그아웃 후 다시 로그인 시도
   - 쿠키 및 캐시 삭제 후 재시도

3. **자동 인식이 작동하지 않는 경우**:
   - 브라우저의 마이크 권한 확인
   - 인터넷 연결 상태 확인
   - 계정의 API 사용량 한도 확인

## 기여 방법

1. 이슈 확인 또는 새 이슈 생성
2. 저장소 포크 및 변경사항 개발
3. 철저한 테스트 및 코드 스타일 준수
4. Pull Request 제출

## 라이선스

이 프로젝트는 MIT 라이선스로 배포됩니다. 자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.