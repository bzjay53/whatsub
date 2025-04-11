# WhaSub 메시지 통신 플로우

이 문서는 WhaSub 확장 프로그램 내 다양한 컴포넌트 간의 메시지 통신 흐름을 설명합니다.

## 주요 컴포넌트

- **popup.js**: 확장 프로그램의 팝업 UI와 사용자 상호작용 처리
- **content-script.js**: 웹 페이지에 주입되어 자막 UI 관리
- **background.js**: 백그라운드에서 실행되며 API 통신 및 전역 상태 관리
- **components/SubtitleDisplay.js**: 자막 표시 UI 컴포넌트
- **components/CommentDisplay.js**: 댓글 표시 UI 컴포넌트
- **services/*.js**: 각종 백엔드 통신 및 기능 모듈

## 메시지 흐름도

```
┌───────────┐       ┌───────────────┐       ┌─────────────┐
│  popup.js │◄─────►│ background.js │◄─────►│ Firebase DB │
└─────┬─────┘       └───────┬───────┘       └─────────────┘
      │                     │
      │                     │
      ▼                     ▼
┌─────────────────────────────────────────┐
│            content-script.js            │
└─────┬─────────────────────────────┬─────┘
      │                             │
      ▼                             ▼
┌───────────────┐           ┌─────────────────┐
│ SubtitleDisplay│           │ CommentDisplay  │
└───────────────┘           └─────────────────┘
```

## 주요 메시지 액션 목록

### 1. popup.js → content-script.js

| 액션 이름 | 설명 | 파라미터 | 응답 |
|----------|------|---------|------|
| `toggleSubtitles` | 자막 표시 토글 | `{ enabled: boolean, universalMode: boolean }` | `{ success: boolean }` |
| `updateSettings` | 자막 설정 업데이트 | `{ settings: Object }` | `{ success: boolean }` |
| `showTestSubtitle` | 테스트 자막 표시 | `{ original: string, translated: string }` | `{ success: boolean }` |
| `changeLanguage` | 자막 언어 변경 | `{ language: string }` | `{ success: boolean }` |
| `updateDualSubtitleToggle` | 이중 자막 토글 업데이트 | `{ enabled: boolean }` | `{ success: boolean }` |
| `checkStatus` | 자막 상태 확인 | `{}` | `{ isSubtitleEnabled: boolean }` |

### 2. content-script.js → popup.js

| 액션 이름 | 설명 | 파라미터 | 응답 |
|----------|------|---------|------|
| `updateFilterToggle` | 필터 토글 상태 업데이트 | `{ enabled: boolean }` | `{ success: boolean }` |
| `updateFilterLanguage` | 필터 언어 상태 업데이트 | `{ language: string }` | `{ success: boolean }` |
| `updateDualSubtitleToggle` | 이중 자막 토글 상태 업데이트 | `{ enabled: boolean }` | `{ success: boolean }` |

### 3. popup.js/content-script.js → background.js

| 액션 이름 | 설명 | 파라미터 | 응답 |
|----------|------|---------|------|
| `checkAuth` | 인증 상태 확인 | `{}` | `{ isAuthenticated: boolean }` |
| `saveSettings` | 설정 저장 | `{ settings: Object }` | `{ success: boolean }` |
| `getSettings` | 설정 가져오기 | `{}` | `{ settings: Object, success: boolean }` |
| `startSpeechRecognition` | 음성 인식 시작 | `{ tabId: string }` | `{ success: boolean }` |
| `stopSpeechRecognition` | 음성 인식 중지 | `{ tabId: string }` | `{ success: boolean }` |
| `translateText` | 텍스트 번역 | `{ text: string, source: string, target: string }` | `{ translatedText: string, success: boolean }` |
| `sendFeedback` | 자막 피드백 전송 | `{ type: string, subtitleText: string }` | `{ success: boolean }` |
| `uploadSubtitle` | 자막 파일 업로드 | `{ fileName: string, fileData: string, metadata: Object }` | `{ success: boolean }` |
| `searchSubtitles` | 자막 검색 | `{ url: string }` | `{ subtitles: Array, success: boolean }` |

### 4. background.js → content-script.js

| 액션 이름 | 설명 | 파라미터 | 응답 |
|----------|------|---------|------|
| `whisperStarted` | Whisper 음성 인식 시작 | `{ settings: Object }` | `{ success: boolean }` |
| `whisperStopped` | Whisper 음성 인식 중지 | `{}` | `{ success: boolean }` |
| `whisperSettingsUpdated` | Whisper 설정 업데이트 | `{ settings: Object }` | `{ success: boolean }` |
| `newSubtitle` | 새 자막 데이터 전송 | `{ data: { text: string, translation: string } }` | `{ success: boolean }` |

## 상태 동기화 메커니즘

WhaSub 확장 프로그램은 크게 세 가지 방식으로 상태를 동기화합니다:

1. **즉시 메시지 전송**: 사용자 액션이 발생할 때 즉시 관련 컴포넌트에 메시지 전송
2. **스토리지 동기화**: `chrome.storage.sync`를 사용한 설정 저장 및 동기화
3. **주기적 폴링**: 중요한 상태에 대해 주기적인 상태 확인 메시지 전송

예를 들어, 자막 필터 토글 상태는 다음과 같이 동기화됩니다:

```
팝업에서 토글 변경
    ↓
toggleSubtitles 메시지 전송 (popup.js → content-script.js)
    ↓
자막 표시/숨김 처리 (content-script.js)
    ↓
상태 저장 (chrome.storage.sync)
    ↓
updateFilterToggle 메시지 전송 (content-script.js → popup.js)
    ↓
팝업 UI 업데이트 (popup.js)
```

## 오류 처리 및 재시도 메커니즘

모든 메시지 통신은 `chrome.runtime.lastError`를 확인하여 실패를 감지하고 적절한 오류 처리와 재시도 로직을 포함합니다. 일반적인 오류 처리 패턴:

```javascript
chrome.runtime.sendMessage({ action: 'someAction', data: someData }, function(response) {
  if (chrome.runtime.lastError) {
    console.debug('[Whatsub] 메시지 전송 오류:', chrome.runtime.lastError.message);
    // 오류 처리 로직 (재시도, 폴백 등)
    return;
  }
  
  // 정상 응답 처리
});
``` 