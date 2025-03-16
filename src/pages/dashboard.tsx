import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/auth';

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>대시보드 - WhatsUb</title>
        <meta name="description" content="WhatsUb 대시보드" />
      </Head>

      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">WhatsUb</h1>
              </div>
              <div className="flex items-center">
                <span className="text-gray-700 mr-4">
                  {user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <p className="text-gray-500 text-xl">
                환영합니다! 이곳에서 자막 생성을 시작할 수 있습니다.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
} 