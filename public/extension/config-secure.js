// 보안 강화된 Firebase 구성 파일
// 중요: 이 파일에는 실제 API 키를 포함하지 마세요!

const firebaseConfig = {
  apiKey: "REPLACE_WITH_ENV_VAR", // 환경 변수에서 로드
  authDomain: "REPLACE_WITH_ENV_VAR",
  projectId: "REPLACE_WITH_ENV_VAR", 
  storageBucket: "REPLACE_WITH_ENV_VAR",
  messagingSenderId: "REPLACE_WITH_ENV_VAR",
  appId: "REPLACE_WITH_ENV_VAR",
  measurementId: "REPLACE_WITH_ENV_VAR"
};

// 로컬 개발 환경에서는 아래 함수를 사용하여 환경 변수를 로드합니다
function loadConfigFromEnvironment() {
  // 실제 배포시 환경 변수에서 값을 가져옵니다
  // 브라우저 확장 프로그램에서는 별도의 안전한 방법으로 관리해야 합니다
  return {
    apiKey: process.env.FIREBASE_API_KEY || "REPLACE_WITH_ENV_VAR",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "REPLACE_WITH_ENV_VAR",
    projectId: process.env.FIREBASE_PROJECT_ID || "REPLACE_WITH_ENV_VAR",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "REPLACE_WITH_ENV_VAR",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "REPLACE_WITH_ENV_VAR",
    appId: process.env.FIREBASE_APP_ID || "REPLACE_WITH_ENV_VAR",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "REPLACE_WITH_ENV_VAR"
  };
}

// 보안 관련 안내사항
const securityNotes = {
  doNotIncludeApiKeys: "절대 API 키를 소스 코드에 하드코딩하지 마세요.",
  useEnvironmentVariables: "환경 변수 또는 안전한 저장소를 사용하세요.",
  checkGitIgnore: ".gitignore 파일에 모든 환경 변수 파일이 포함되어 있는지 확인하세요.",
  rotateCompromisedKeys: "노출된 키는 즉시 교체하세요."
};

export default firebaseConfig;
export { loadConfigFromEnvironment, securityNotes }; 