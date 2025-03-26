# Whatsub - 유튜브 자막 AI 번역 확장 프로그램

YouTube 동영상의 자막을 추출하고 AI를 활용하여 번역해주는 Chrome 확장 프로그램입니다.

## 기능

- YouTube 동영상 자막 실시간 추출
- OpenAI Whisper를 활용한 음성 인식
- 다국어 자막 번역 기능
- 사용자 계정 관리 (무료/프리미엄)
- 오프라인 모드 지원

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript
- **인증**: Firebase Authentication (Google OAuth)
- **데이터 저장**: Airtable
- **API**: Google Chrome Extension API, OpenAI Whisper API
- **빌드 도구**: Webpack

## 파일 구조

```
my-next-app/public/extension/
├── assets/              # 이미지, 아이콘 등 리소스
├── components/          # 재사용 가능한 UI 컴포넌트
├── icons/               # 확장 프로그램 아이콘
├── lib/                 # 서드파티 라이브러리 (Firebase, Airtable)
├── popup/               # 팝업 UI 관련 파일
├── services/            # 비즈니스 로직 서비스
├── styles/              # CSS 스타일시트
├── background.js        # 백그라운드 스크립트
├── content.js           # 콘텐츠 스크립트 (YouTube 페이지에 삽입됨)
├── manifest.json        # 확장 프로그램 설정
├── popup.html           # 메인 팝업 HTML
├── popup.js             # 팝업 기능 구현
└── service-worker.js    # 서비스 워커
```

## 인증 아키텍처

### Firebase Authentication
- Google OAuth를 통한 사용자 인증
- 토큰 관리 및 로그인 상태 유지
- 확장 프로그램 내 보안 인증 처리

### Airtable 데이터 관리
- 사용자 정보 저장 (이메일, 이름, 프로필 등)
- 구독 정보 및 사용량 데이터 관리
- 사용자 설정 저장

## 인증 흐름

1. 사용자가 Google 로그인 버튼 클릭
2. Firebase SDK를 통해 Google OAuth 인증 실행
3. 인증 성공 시 사용자 정보를 Airtable에 저장/조회
4. 로그인 상태 및 구독 정보를 로컬 스토리지에 저장
5. UI 업데이트 및 권한에 따른 기능 제공

## 오류 처리 전략

- **인증 오류**: 사용자 친화적인 메시지로 재시도 유도
- **Airtable 연결 오류**: 경고 표시 후 기본 기능 유지
- **네트워크 오류**: 오프라인 모드 자동 전환
- **API 제한 초과**: 사용량 알림 및 업그레이드 안내

## 설치 방법

1. 저장소 클론
   ```
   git clone https://github.com/your-username/whatsub.git
   ```

2. 의존성 설치
   ```
   cd whatsub
   npm install
   ```

3. 개발 모드 실행
   ```
   npm run dev
   ```

4. Chrome 확장 프로그램으로 로드
   - Chrome 브라우저에서 `chrome://extensions/` 접속
   - 개발자 모드 활성화
   - "압축해제된 확장 프로그램 로드" 클릭
   - `build` 폴더 선택

## 배포 방법

1. 프로덕션 빌드
   ```
   npm run build
   ```

2. `build` 폴더의 내용을 Chrome 웹 스토어에 업로드

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 연락처

문의사항이 있으시면 [example@whatsub.com](mailto:example@whatsub.com)로 연락주세요.

## Firebase 구성 설정

이 프로젝트를 실행하려면 Firebase 구성이 필요합니다:

1. `public/extension/firebase-config-private.js` 파일을 생성합니다.
2. 다음 형식으로 Firebase 구성을 추가합니다:

```javascript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

3. 이 파일은 `.gitignore`에 자동으로 포함되어 있으므로 공개 저장소에 업로드되지 않습니다. 