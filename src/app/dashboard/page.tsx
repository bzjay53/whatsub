'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Subscription {
  plan: string;
  status: string;
  startDate: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('인증되지 않은 사용자');
        }

        const data = await response.json();
        setUser(data.user);

        // 구독 정보 가져오기
        const subResponse = await fetch('/api/subscription/status');
        if (subResponse.ok) {
          const subData = await subResponse.json();
          setSubscription(subData.subscription);
        }
      } catch (error) {
        console.error('인증 확인 오류:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              {user?.name}님의 대시보드
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 사용자 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">사용자 정보</h2>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">이름:</span> {user?.name}
                  </p>
                  <p>
                    <span className="font-medium">이메일:</span> {user?.email}
                  </p>
                </div>
              </div>

              {/* 구독 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">구독 정보</h2>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">현재 플랜:</span>{' '}
                    {subscription?.plan || '무료 플랜'}
                  </p>
                  <p>
                    <span className="font-medium">상태:</span>{' '}
                    {subscription?.status === 'active' ? '활성' : '비활성'}
                  </p>
                  {subscription?.startDate && (
                    <p>
                      <span className="font-medium">시작일:</span>{' '}
                      {new Date(subscription.startDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 작업 버튼 */}
            <div className="mt-6 flex space-x-4">
              <button
                onClick={() => router.push('/pricing')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                플랜 업그레이드
              </button>
              <button
                onClick={() => router.push('/')}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                확장 프로그램으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 