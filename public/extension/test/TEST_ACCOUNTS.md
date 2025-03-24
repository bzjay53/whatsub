# Whatsub 테스트 계정 설정 가이드

## 테스트 계정 생성 방법

### 1. Google Cloud Console에서 테스트 사용자 추가

1. [Google Cloud Console](https://console.cloud.google.com)에 접속
2. Whatsub 프로젝트 선택
3. 왼쪽 메뉴에서 "API 및 서비스" > "OAuth 동의 화면" 선택
4. "테스트 사용자" 섹션으로 이동
5. "테스트 사용자 추가" 버튼 클릭
6. 테스트에 사용할 Google 계정 이메일 주소 입력
   - 예: whatsub.test1@gmail.com
   - 예: whatsub.test2@gmail.com

### 2. 테스트 계정 생성 (새 계정이 필요한 경우)

1. [Google 계정 생성 페이지](https://accounts.google.com/signup)로 이동
2. "내 비즈니스용 계정 만들기" 선택
3. 다음 형식으로 계정 생성:
   - 이메일: whatsub.test[번호]@gmail.com
   - 이름: Whatsub Test [번호]
   - 비밀번호: 안전한 비밀번호 사용

## 테스트 계정 관리

### 보안 설정

1. 2단계 인증 비활성화 (테스트 용이성을 위해)
2. 앱 비밀번호 설정 (필요한 경우)
3. 로그인 활동 모니터링 활성화

### 권한 설정

1. Google Cloud Console에서 테스트 사용자로 등록
2. 필요한 OAuth 스코프 승인:
   - userinfo.email
   - userinfo.profile
   - openid

## 테스트 계정 목록

| 계정 번호 | 이메일 주소 | 용도 | 상태 |
|----------|------------|------|------|
| 1 | whatsub.test1@gmail.com | 일반 사용자 테스트 | 활성화 |
| 2 | whatsub.test2@gmail.com | 프리미엄 사용자 테스트 | 활성화 |

## 테스트 시나리오

### 1. 기본 인증 테스트
```javascript
// 테스트 계정으로 로그인
await testGoogleLogin('whatsub.test1@gmail.com');

// 로그아웃
await testLogout();
```

### 2. 권한 테스트
```javascript
// 프리미엄 기능 테스트
await testGoogleLogin('whatsub.test2@gmail.com');
await testPremiumFeatures();
await testLogout();
```

## 주의사항

1. 테스트 계정 비밀번호는 안전하게 보관
2. 테스트 완료 후 반드시 로그아웃
3. 실제 사용자 데이터로 테스트하지 않기
4. 정기적으로 테스트 계정 비밀번호 변경

## 문제 해결

### 로그인 실패 시
1. Google Cloud Console에서 테스트 사용자 등록 확인
2. OAuth 동의 화면에서 필요한 스코프 확인
3. 계정 상태 및 보안 설정 확인

### 권한 오류 시
1. OAuth 동의 화면에서 스코프 확인
2. 테스트 사용자 권한 재설정
3. 캐시 삭제 후 재시도 