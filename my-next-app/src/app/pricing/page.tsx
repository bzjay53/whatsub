'use client';

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

export default function PricingPage() {
  const router = useRouter();

  const handleUpgrade = async (planName: string) => {
    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: planName }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        console.error('플랜 업그레이드 실패');
      }
    } catch (error) {
      console.error('플랜 업그레이드 중 오류 발생:', error);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-5xl font-extrabold text-gray-900 sm:text-center">
            구독 플랜
          </h1>
          <p className="mt-5 text-xl text-gray-500 sm:text-center">
            자막 생성과 번역을 위한 최적의 플랜을 선택하세요
          </p>
        </div>
        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 bg-white"
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {plan.name}
                </h2>
                <p className="mt-4">
                  <span className="text-4xl font-extrabold text-gray-900">
                    ￦{plan.price}
                  </span>
                  <span className="text-base font-medium text-gray-500">
                    /월
                  </span>
                </p>
                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex">
                      <svg
                        className="flex-shrink-0 w-6 h-6 text-green-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="ml-3 text-base text-gray-500">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.name)}
                  className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium ${
                    plan.current
                      ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 