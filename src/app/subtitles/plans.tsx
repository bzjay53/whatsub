import { useRouter } from 'next/navigation';

const plans = [
  {
    name: '무료 플랜',
    price: '0',
    features: [
      '기본 자막 생성',
      '자막 동기화',
      '기본 스타일 설정',
      '5,000자 번역 제한',
    ],
    buttonText: '현재 플랜',
    current: true,
  },
  {
    name: '스탠다드 플랜',
    price: '9,900',
    features: [
      '듀얼 자막 지원',
      '자막 저장/공유',
      '고급 스타일 설정',
      '50,000자 번역 제한',
    ],
    buttonText: '업그레이드',
    current: false,
  },
  {
    name: '프로 플랜',
    price: '19,900',
    features: [
      'Whisper AI 자막 생성',
      '실시간 번역',
      '무제한 스타일 설정',
      '100,000자 번역 제한',
    ],
    buttonText: '업그레이드',
    current: false,
  },
];

export default plans; 