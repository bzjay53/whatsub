/**
 * Airtable 설정 파일
 * Whatsub 확장 프로그램에서 사용하는 Airtable 연결 정보
 */

// Airtable API 키 (실제 환경에서는 안전하게 관리해야 함)
export const AIRTABLE_API_KEY = 'key0123456789abcdef';

// Airtable 베이스 ID
export const AIRTABLE_BASE_ID = 'appWhatsub123456789';

// Airtable 테이블 ID
export const AIRTABLE_USERS_TABLE_ID = 'tblUsers123456789';
export const AIRTABLE_USAGE_TABLE_ID = 'tblUsage123456789';
export const AIRTABLE_SUBSCRIPTIONS_TABLE_ID = 'tblSubscriptions123456789';

// 구독 플랜 설정
export const SUBSCRIPTION_PLANS = {
  free: {
    name: '무료',
    whisperLimit: 60, // 분 단위
    translationLimit: 5000, // 글자 수
    features: ['기본 자막', '기본 번역']
  },
  premium: {
    name: '프리미엄',
    whisperLimit: 300, // 분 단위
    translationLimit: 100000, // 글자 수
    features: ['고급 자막', '무제한 번역', '데이터 내보내기', '우선 지원']
  },
  enterprise: {
    name: '기업용',
    whisperLimit: 1000, // 분 단위
    translationLimit: 1000000, // 글자 수
    features: ['모든 프리미엄 기능', '커스텀 서비스', '전담 지원']
  }
};

// Airtable API 기본 URL
export const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

// 요청 헤더 설정
export const getAirtableHeaders = () => ({
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
});

// API URL 생성
export const getAirtableUrl = (tableId = AIRTABLE_USERS_TABLE_ID) => 
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;

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