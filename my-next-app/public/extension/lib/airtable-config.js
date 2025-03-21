// Airtable API 설정
// 2024년 2월 1일부터 API 키가 중단되고 개인 액세스 토큰(PAT)이 필요합니다.
// 아래 토큰은 데모용이며, 실제 사용할 때는 유효한 개인 액세스 토큰으로 교체해야 합니다.
export const AIRTABLE_API_KEY = 'patJmdg2U4d4DLnOZ.17e92f95f2e4ffd40bb9831ffe2d01ccd65fc9845ec9e9e4eb41458e6efdd03c';
export const AIRTABLE_BASE_ID = 'appWxjlnNEJyNkCaI';
export const AIRTABLE_USERS_TABLE_ID = 'tblUsers';

// 요청 헤더 설정
export const getAirtableHeaders = () => ({
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
});

// API URL 생성
export const getAirtableUrl = (tableId = AIRTABLE_USERS_TABLE_ID) => 
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;

// 구독 플랜 정보
export const SUBSCRIPTION_PLANS = {
    free: {
        name: '무료',
        whisperLimit: 60, // 분
        translationLimit: 5000, // 자
        features: [
            '기본 자막 표시',
            '유튜브 자막 표시',
            '제한된 Whisper AI 기능',
            '제한된 번역 기능'
        ]
    },
    premium: {
        name: '프리미엄',
        whisperLimit: 600, // 분 (10시간)
        translationLimit: 500000, // 자 (50만자)
        features: [
            '모든 무료 기능',
            '무제한 자막 표시',
            '고급 Whisper AI 기능',
            '모든 언어 번역 지원',
            '자막 파일 다운로드',
            '자막 스타일 커스터마이징',
            '미디어 싱크 조절'
        ]
    }
};

// 언어 옵션
export const LANGUAGE_OPTIONS = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: '영어' },
    { code: 'ja', name: '일본어' },
    { code: 'zh', name: '중국어 (간체)' },
    { code: 'zh-tw', name: '중국어 (번체)' },
    { code: 'es', name: '스페인어' },
    { code: 'fr', name: '프랑스어' },
    { code: 'de', name: '독일어' },
    { code: 'ru', name: '러시아어' },
    { code: 'it', name: '이탈리아어' },
    { code: 'pt', name: '포르투갈어' },
    { code: 'vi', name: '베트남어' },
    { code: 'th', name: '태국어' },
    { code: 'id', name: '인도네시아어' }
];

// 에어테이블 기본 설정
const AIRTABLE_CONFIG = {
    API_KEY: AIRTABLE_API_KEY,
    BASE_ID: AIRTABLE_BASE_ID,
    TABLE_NAME: AIRTABLE_USERS_TABLE_ID
};

// API 엔드포인트 설정
const AIRTABLE_API = {
    BASE_URL: `https://api.airtable.com/v0/${AIRTABLE_CONFIG.BASE_ID}`,
    HEADERS: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
    }
};

export default AIRTABLE_API;