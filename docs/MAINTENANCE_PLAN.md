# Whatsub 장기 유지보수 계획

## 목차
1. [변경 로그 관리](#1-변경-로그-관리)
2. [테스트 자동화 프레임워크](#2-테스트-자동화-프레임워크)
3. [정기적 리팩토링 계획](#3-정기적-리팩토링-계획)
4. [보안 관리 계획](#4-보안-관리-계획)
5. [사용자 피드백 관리](#5-사용자-피드백-관리)

---

## 1. 변경 로그 관리

### 1.1 버전 관리 규칙 (시맨틱 버저닝)

Whatsub은 시맨틱 버저닝(Semantic Versioning) 2.0.0 규칙을 따릅니다:

- **형식**: `X.Y.Z` (메이저.마이너.패치)
  - **메이저(X)**: 호환성이 깨지는 변경
  - **마이너(Y)**: 하위 호환성을 유지하는 기능 추가
  - **패치(Z)**: 버그 수정 (하위 호환성 유지)

- **개발 단계 버전**:
  - 알파: `0.1.0-alpha.1`
  - 베타: `0.1.0-beta.1`
  - 릴리스 후보: `0.1.0-rc.1`

### 1.2 변경 유형 분류

모든 변경 사항은 다음 카테고리로 분류합니다:

- **추가(Added)**: 새로운 기능
- **변경(Changed)**: 기존 기능의 변경
- **개선(Improved)**: 기존 기능의 성능 또는 사용성 개선
- **수정(Fixed)**: 버그 수정
- **제거(Removed)**: 기능 제거
- **보안(Security)**: 보안 관련 수정

### 1.3 CHANGELOG.md 관리 지침

1. **파일 위치**: 프로젝트 루트 디렉토리의 `CHANGELOG.md`
2. **업데이트 시점**: 
   - 새 버전 릴리스 전
   - 주요 변경사항 적용 시
3. **작성 방법**:
   - 최신 버전이 항상 최상단에 위치
   - 날짜 포맷: ISO 형식 (YYYY-MM-DD)
   - 모든 변경 사항은 해당 카테고리 아래 목록으로 정리
   - 각 항목은 명확하고 간결하게 작성
   - 관련 이슈나 PR 번호 포함 (가능한 경우)

### 1.4 샘플 변경 로그 항목

```markdown
# 변경 로그

## [0.3.0] - 2025-05-15

### 추가
- 실시간 자막 번역 기능 (#120)
- 쉐도잉 학습 모드 추가 (#135)
- 사용자 프로필 페이지 추가

### 개선
- 자막 렌더링 성능 30% 향상
- 다국어 지원 확장 (10개 언어 추가)

### 수정
- YouTube 동영상에서 자막이 잘못 정렬되는 문제 수정 (#142)
- 로그인 상태가 새로고침 후 유지되지 않는 버그 수정

### 보안
- OAuth 토큰 저장 방식 개선
```

### 1.5 변경 로그 자동화 도구

장기적으로 다음 도구 도입을 고려:

- **Conventional Commits**: 표준화된 커밋 메시지 구조 적용
- **standard-version**: 변경 로그 자동 생성 도구
- **GitHub Actions**: 릴리스 시 변경 로그 자동 업데이트

---

## 2. 테스트 자동화 프레임워크

### 2.1 단위 테스트 도입 단계

1. **1단계: 기본 구조 설정** (2개월)
   - Jest 테스트 환경 구성
   - 핵심 유틸리티 함수 테스트 작성
   - 테스트 커버리지 리포트 설정

2. **2단계: 주요 모듈 테스트** (3개월)
   - 자막 처리 모듈 테스트
   - 인증 관련 모듈 테스트
   - 메시지 통신 모듈 테스트

3. **3단계: UI 컴포넌트 테스트** (2개월)
   - 팝업 UI 요소 테스트
   - 설정 페이지 테스트
   - 자막 표시 관련 DOM 조작 테스트

4. **4단계: 전체 통합** (3개월)
   - E2E 테스트 도입
   - 자동화된 CI/CD 파이프라인 구축
   - 테스트 문서화 및 가이드라인 제공

### 2.2 Jest 설정 방법

**기본 설정 파일 (jest.config.js)**:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  moduleNameMapper: {
    // CSS 및 이미지 파일 모킹
    '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'public/extension/**/*.js',
    '!public/extension/lib/**/*.js'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
```

**Jest 설정 파일 (jest.setup.js)**:

```javascript
// Chrome API 모킹
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn()
  },
  identity: {
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn()
  }
};

// 콘솔 에러 핸들링
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
};
```

### 2.3 Chrome Extension API 모킹 방법

**1. 기본 모킹**:
Chrome API 전역 객체를 모킹하여 테스트 환경에 제공합니다.

**2. 고급 모킹 예시 (storage API)**:

```javascript
// storage-mock.js
const storageMock = {
  sync: {
    data: {},
    get: jest.fn((keys, callback) => {
      if (typeof keys === 'string') {
        callback({ [keys]: storageMock.sync.data[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          result[key] = storageMock.sync.data[key];
        });
        callback(result);
      } else if (typeof keys === 'object') {
        const result = {};
        Object.keys(keys).forEach(key => {
          result[key] = storageMock.sync.data[key] || keys[key];
        });
        callback(result);
      } else {
        callback(storageMock.sync.data);
      }
    }),
    set: jest.fn((items, callback) => {
      Object.assign(storageMock.sync.data, items);
      if (callback) callback();
    })
  },
  local: {
    data: {},
    get: jest.fn((keys, callback) => {
      // 유사한 구현
    }),
    set: jest.fn((items, callback) => {
      // 유사한 구현
    })
  }
};

export default storageMock;
```

**3. 테스트 내 사용 예시**:

```javascript
import storageMock from '../__mocks__/storage-mock';

describe('설정 관리자 테스트', () => {
  beforeEach(() => {
    // 모킹된 스토리지 초기화
    storageMock.sync.data = {
      subtitle_settings: {
        fontSize: 16,
        position: 'bottom',
        backgroundColor: 'rgba(0,0,0,0.7)'
      }
    };
    global.chrome.storage.sync = storageMock.sync;
  });
  
  test('설정을 올바르게 로드합니다', async () => {
    const settings = await loadSettings();
    expect(settings.fontSize).toBe(16);
    expect(settings.position).toBe('bottom');
  });
});
```

### 2.4 지속적 통합(CI) 구축 방법

**GitHub Actions을 사용한 CI 구성 (.github/workflows/test.yml)**:

```yaml
name: 테스트

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Node.js 설정
      uses: actions/setup-node@v3
      with:
        node-version: 16
        cache: 'npm'
    
    - name: 의존성 설치
      run: npm ci
    
    - name: ESLint 실행
      run: npm run lint
    
    - name: 단위 테스트 실행
      run: npm test
    
    - name: 테스트 커버리지 보고서
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        directory: ./coverage
        fail_ci_if_error: true
    
    - name: 빌드 테스트
      run: npm run build
```

**단계적 CI/CD 도입 계획**:

1. **CI 단계** (첫 6개월):
   - 코드 품질 검사 (ESLint, Prettier)
   - 단위 테스트 실행
   - 커버리지 보고서 생성

2. **CD 단계** (6-12개월):
   - 테스트 패스 시 자동 빌드
   - 개발 환경 자동 배포
   - 수동 승인 후 프로덕션 배포

---

## 3. 정기적 리팩토링 계획

### 3.1 매 릴리스 전 코드 품질 검토 (매월)

**검토 항목**:
- 정적 코드 분석 도구 실행 (ESLint, SonarQube)
- 코드 중복 확인 및 제거
- 복잡도가 높은 함수 식별 및 개선
- 테스트 커버리지 확인

**실행 프로세스**:
1. 자동화된 도구로 코드 품질 보고서 생성
2. 주요 문제 우선순위화
3. 핵심 문제 해결 (릴리스 전 최소 3개 이상)
4. 해결하지 못한 이슈는 기술 부채로 기록

### 3.2 분기별 기술 부채 관리 (3개월)

**관리 방식**:
- 기술 부채 항목 리스트 유지 (JIRA 또는 GitHub Issues)
- 심각도 및 우선순위에 따라 분류
- 분기별로 최소 1주일 기술 부채 해소 스프린트 진행

**주요 활동**:
1. 개발 속도를 저해하는 레거시 코드 리팩토링
2. 구현이 불완전한 기능 완성
3. 시간이 지남에 따라 비효율적이 된 로직 개선
4. 문서화 미비점 보완

### 3.3 반기별 아키텍처 검토 (6개월)

**검토 사항**:
- 전체 시스템 아키텍처 평가
- 모듈 간 의존성 분석
- 확장성 및 유지보수성 평가
- 성능 병목 현상 식별

**실행 계획**:
1. 아키텍처 검토 워크숍 개최
2. 개선 필요 영역 식별 및 문서화
3. 우선순위에 따른 개선 계획 수립
4. 다음 릴리스 계획에 아키텍처 개선 작업 통합

### 3.4 연간 종합 코드 개선 (12개월)

**주요 활동**:
- 주요 컴포넌트 대규모 리팩토링 검토
- 기술 스택 업데이트 평가
- 프로젝트 구조 재구성 여부 결정
- 새로운 디자인 패턴 및 아키텍처 적용 고려

**실행 방식**:
1. 연간 기술 평가 보고서 작성
2. 경영진 및 개발팀 회의를 통한 결정
3. 장기 개선 로드맵 수립
4. 필요시 단계적 마이그레이션 계획 수립

### 3.5 리팩토링 추적 및 성과 측정

**측정 지표**:
- 코드 복잡도 지수 (cyclomatic complexity)
- 코드 중복률
- 테스트 커버리지 비율
- 버그 발생 빈도
- 새 기능 개발 소요 시간

**추적 도구**:
- SonarQube
- GitHub 인사이트
- Jest 커버리지 리포트
- 사용자 오류 보고 통계

---

## 4. 보안 관리 계획

### 4.1 주기적 의존성 업데이트

**업데이트 주기**:
- 보안 패치: 발견 후 24시간 이내
- 일반 업데이트: 매월 첫째 주
- 메이저 버전 업데이트: 분기별 검토

**관리 프로세스**:
1. 의존성 취약점 자동 모니터링 (Dependabot, Snyk)
2. 패치 영향 평가 (호환성 문제)
3. 테스트 환경에서 검증
4. 프로덕션 환경 적용

**구현 도구**:
```json
// package.json에 추가
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "update:minor": "npx npm-check-updates -u -t minor",
    "update:major": "npx npm-check-updates -u"
  }
}
```

### 4.2 보안 취약점 점검

**정기 점검**:
- 정적 코드 분석: 매주
- 동적 보안 테스트: 매월
- 종합 보안 감사: 반기별

**점검 항목**:
1. 코드 주입 취약점 (XSS, 스크립트 주입)
2. 인증 및 권한 검증 메커니즘
3. 민감 정보 저장 및 전송 방식
4. API 보안 (CORS, CSP 설정)

**보안 도구**:
- OWASP ZAP: 동적 스캐닝
- ESLint 보안 플러그인: 정적 분석
- Chrome 확장 프로그램 보안 체크리스트

### 4.3 사용자 데이터 보호 방안

**데이터 보호 전략**:
1. **최소화 원칙**: 필요한 데이터만 수집
2. **저장 제한**: 사용 목적이 완료된 데이터는 삭제
3. **암호화**: 민감한 데이터는 항상 암호화 저장
4. **접근 제한**: 데이터 접근 권한 명확화

**구현 방안**:
- 사용자 인증 토큰: 안전한 저장소 사용 (`chrome.storage.local`)
- 개인 설정: 동기화 저장소 사용 (`chrome.storage.sync`)
- API 통신: HTTPS 강제 및 토큰 유효성 지속 검증

**데이터 처리 기록**:
- 데이터 수집 및 사용 로그 유지
- 정기적 데이터 감사
- 개인정보 처리방침 준수 모니터링

### 4.4 권한 관리 최적화

**권한 최소화 원칙**:
- 필요한 최소한의 권한만 요청
- 선택적 권한 사용 (필요시에만 요청)
- 권한 사용 이유를 사용자에게 명확히 설명

**manifest.json 권한 관리**:
```json
{
  "permissions": [
    "storage",
    "tabs"
  ],
  "optional_permissions": [
    "identity",
    "audioCapture"
  ],
  "host_permissions": [
    "*://*.youtube.com/*",
    "*://*.vimeo.com/*"
  ]
}
```

**권한 요청 프로세스**:
- 사용자 작업 컨텍스트에서 필요한 권한 요청
- 명확한 UI로 권한 필요성 설명
- 권한 거부 시에도 기본 기능은 동작하도록 설계

### 4.5 정기 보안 검토 회의

**회의 주기**: 분기별
**참석자**: 개발팀, 보안 담당자, 제품 매니저
**주요 안건**:
1. 최근 보안 동향 및 위협 요소 검토
2. 식별된 취약점 및 대응 현황
3. 다음 분기 보안 개선 계획
4. 사용자 데이터 보호 현황 점검

---

## 5. 사용자 피드백 관리

### 5.1 피드백 수집 방법

**다양한 채널 구축**:
- **인앱 피드백 폼**: 확장 프로그램 내 직접 제공
- **이메일 지원**: 전용 지원 이메일 주소 운영
- **커뮤니티 포럼**: 사용자 간 정보 공유 및 토론 공간
- **소셜 미디어**: 공식 계정을 통한 피드백 수집
- **Chrome 웹 스토어 리뷰**: 정기적 모니터링

**피드백 시스템 구현**:
```javascript
// 인앱 피드백 제출 기능
function submitFeedback(data) {
  return fetch('https://api.whatsub.app/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: data.type, // 버그, 기능 요청, 제안 등
      category: data.category, // UI, 성능, 자막, 기타 등
      content: data.content,
      userInfo: data.includeInfo ? {
        browser: navigator.userAgent,
        version: chrome.runtime.getManifest().version,
        settings: data.settings
      } : null
    })
  });
}
```

### 5.2 우선순위 결정 기준

**우선순위 매트릭스**:

| 우선순위 | 영향도 | 사용자 수 | 구현 복잡도 | 전략적 중요도 |
|---------|-------|---------|------------|------------|
| P0 (긴급) | 치명적 버그 | 다수 영향 | 무관 | 무관 |
| P1 (높음) | 주요 버그/기능 | 다수 영향 | 중간 이하 | 높음 |
| P2 (중간) | 일반 버그/개선 | 일부 영향 | 중간 | 중간 |
| P3 (낮음) | 사소한 문제 | 소수 영향 | 높음 | 낮음 |

**평가 프로세스**:
1. 접수된 피드백 초기 분류
2. 제품 팀 주간 회의에서 우선순위 평가
3. 제품 로드맵과 정렬
4. 개발 스프린트에 할당

### 5.3 개선 사항 적용 워크플로우

**처리 흐름**:
1. **피드백 접수 및 기록**
   - 중앙 이슈 트래커에 등록 (GitHub Issues)
   - 필요한 추가 정보 수집
   
2. **분석 및 평가**
   - 기술적 타당성 검토
   - 우선순위 결정
   - 필요 자원 추정
   
3. **개발 계획**
   - 제품 로드맵에 통합
   - 스프린트 백로그에 추가
   - 담당자 지정
   
4. **구현 및 검증**
   - 개발 완료
   - QA 테스트
   - 베타 사용자 테스트 (필요시)
   
5. **배포 및 커뮤니케이션**
   - 릴리스에 포함
   - 변경 로그 업데이트
   - 피드백 제공자에게 결과 알림

**이슈 템플릿 예시**:
```markdown
### 피드백 종류
- [ ] 버그 리포트
- [ ] 기능 요청
- [ ] 개선 제안
- [ ] 기타

### 설명
(자세한 설명)

### 기대 결과
(원하는 동작이나 결과)

### 환경 정보
- 브라우저: 
- 확장 프로그램 버전: 
- OS: 

### 우선순위 평가 (내부용)
- 영향도: 
- 사용자 수: 
- 구현 복잡도: 
- 전략적 중요도: 
- 최종 우선순위: 
```

### 5.4 사용자 커뮤니케이션 방법

**소통 채널**:
- **공식 블로그**: 주요 업데이트 및 기능 소개
- **소셜 미디어**: 일상적 소통 및 팁 공유
- **이메일 뉴스레터**: 월간 업데이트 요약
- **인앱 알림**: 중요 변경사항 알림

**커뮤니케이션 원칙**:
1. **투명성**: 개발 진행 상황 공유
2. **응답성**: 주요 이슈에 신속한 응답
3. **명확성**: 기술 용어 최소화, 이해하기 쉬운 설명
4. **감사 표현**: 피드백 제공자에게 감사 표현

**피드백 루프 완성**:
- 개선사항 적용 후 해당 피드백 제공자에게 알림
- 릴리스 노트에 기여자 언급 (허락 시)
- 정기적인 사용자 만족도 조사 실시

---

## 6. 실행 로드맵

### 6.1 단기 목표 (0-6개월)
- CHANGELOG.md 파일 설정 및 관리 시작
- 기본 테스트 환경 구축
- 첫 정기 코드 품질 검토 실시
- 사용자 피드백 수집 채널 구축

### 6.2 중기 목표 (7-12개월)
- 테스트 자동화 70% 달성 
- CI/CD 파이프라인 구축 완료
- 첫 반기 아키텍처 검토 완료
- 보안 감사 프로세스 정착

### 6.3 장기 목표 (1-2년)
- 테스트 커버리지 90% 달성
- 자동화된 릴리스 및 배포 시스템 구축
- 사용자 피드백 기반 연간 개선 계획 수립
- 기술 부채 30% 이상 감소

---

마지막 업데이트: 2025-04-15  
버전: 1.0.0 