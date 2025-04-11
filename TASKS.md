# WhatSub 개발 작업 관리

## 완료된 작업
- [x] background.js에 getUsage, getSettings, getAuth 함수 구현
- [x] background.js에 searchSubtitles, getSubtitleList, uploadSubtitle, applySubtitle 등 커뮤니티 자막 관련 함수 구현 (시뮬레이션)
- [x] 메인 페이지에서 불필요한 이미지 참조 제거 (public/index.html, my-next-app/src/app/page.tsx)
- [x] popup.js의 checkAuthState 함수 개선 (로컬 스토리지 우선 사용 및 폴백 메커니즘 강화)
- [x] setupTabButtons 함수 구현 (팝업 탭 버튼 기능 오류 수정)
- [x] popup.js에서 helpTabBtn 정의되지 않은 오류 수정 (도움말 탭 자동 로그 로드 기능 수정)
- [x] popup.js에서 커뮤니티 자막 목록 로드(`loadSubtitleList`) 및 적용(`applySubtitle`) 기능 기본 구현
- [x] popup.js에서 'Receiving end does not exist' 오류 처리 개선 (applySubtitle, saveSubtitleSettings, showTestSubtitle)
- [x] content-script.js에서 `applySubtitleContent` 액션 핸들러 추가
- [x] content-script.js의 자막 설정 버튼 이벤트 핸들러 기본 구조 수정
- [x] content-script.js의 피드백 버튼 이벤트 핸들러 (로그인 확인 및 background 전송 기본 구조)
- [x] background.js에 `getAuthStatus`, `sendSubtitleFeedback` 액션 핸들러 추가
- [x] background.js에 `updateSubtitleSettings` 액션 핸들러 추가 (ReferenceError 해결)

## 현재 상태
- 현재 확장 프로그램은 **테스트 모드**로 동작하며, 실제 음성 인식 대신 **시뮬레이션된 API 응답** 또는 **테스트용 샘플 자막**만 표시됩니다.
- 메인 페이지의 "스크린샷" 문구 관련 코드는 제거되었으나, 사용자 환경에 따라 캐시 문제로 계속 보일 수 있습니다. (우선순위 낮음)
- **자막 UI 및 기능 문제 확인 중**: 
    - 자막 창 내 설정(<i class="fas fa-cog"></i>) 버튼의 패널 토글 기능 및 자막 스타일 설정(위치, 크기, 투명도) 옵션 변경 시 화면 반영이 안 되는 문제 발생.
    - 관련 함수(`setupControlPanelEvents`, `saveSubtitleSettings`, `updateSubtitleStyle` in content-script.js)에 디버깅 로그 추가 완료.
    - 자막 창 내 피드백(좋아요/싫어요/추천) 버튼은 로그인 확인 로직만 추가되었고, 실제 기능은 미구현 상태입니다.
- **신규 기능 미구현**: 실시간 댓글 기능은 아직 구현되지 않았습니다.

## 다음 개발 단계 (우선순위 순)

1.  **[1순위] 자막 UI/기능 문제 해결 (디버깅)**:
    *   [ ] **자막 스타일 설정 및 설정 버튼 동작**: 추가된 콘솔 로그를 통해 `content-script.js`의 설정 관련 기능이 작동하지 않는 원인을 파악하고 수정합니다. (`setupControlPanelEvents`, `saveSubtitleSettings`, `updateSubtitleStyle`)

2.  **[2순위] 실제 자막 데이터 연동 구현**:
    *   [ ] 실제 영상에서 음성 인식을 통한 자막 생성 기능 구현 (예: Whisper API 연동).
    *   [ ] API 응답을 받아 실제 자막을 화면에 표시 (테스트 자막 대체).
    *   [ ] 자막 타이밍 동기화 로직 구현.

3.  **[3순위] 커뮤니티 피드백 기능 완성**:
    *   [ ] 자막 창 내 피드백 버튼(좋아요/싫어요/추천) 기능 완성 (회원 전용, 커뮤니티 자막 대상, 서버 연동).

4.  **[4순위] 실시간 댓글 기능 구현 (신규)**:
    *   [ ] 실시간 댓글 UI 생성 및 표시 로직 구현.
    *   [ ] 실시간 통신(WebSocket 등) 설정 및 서버 연동.
    *   [ ] 댓글 익명성 보장 및 입력 기능 구현.

5.  **[5순위] 시스템 및 인프라 개선**:
    *   [ ] 사용자 인증 및 권한 관리 로직 강화.
    *   [ ] 로그 시스템 개선 및 최적화.
    *   [ ] 전반적인 성능 개선 및 디버깅.

## 개발 계획 (2024년 2분기) - 잠정
- [ ] 자막 UI/기능 안정화 (현재 진행 중)
- [ ] 실제 음성 인식 API 연동 (2024년 4월 예정)
- [ ] 다국어 자막 지원 확대 (2024년 5월 예정)
- [ ] 커뮤니티 자막/피드백 기능 완성 (2024년 6월 예정)
- [ ] 베타 테스트 진행 (2024년 6월 예정)
- [ ] 정식 버전 출시 (2024년 7월 예정)

## 참고 사항
- 현재 버전은 개발자 테스트 목적으로 제작되었으며, 실제 기능은 향후 개발 계획에 따라 순차적으로 구현될 예정입니다. 