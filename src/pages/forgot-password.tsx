import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '비밀번호 재설정 요청에 실패했습니다.');
      }

      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>비밀번호 재설정 - WhatsUb</title>
        <meta name="description" content="WhatsUb 비밀번호 재설정 페이지" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              비밀번호 재설정
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              가입하신 이메일 주소를 입력해주세요.
              <br />
              비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>

          {success ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    비밀번호 재설정 링크가 이메일로 전송되었습니다.
                    <br />
                    이메일을 확인해주세요.
                  </p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="sr-only">이메일</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`appearance-none rounded relative block w-full px-3 py-2 border ${
                    error ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                    isLoading
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                >
                  {isLoading ? '처리 중...' : '비밀번호 재설정 링크 받기'}
                </button>
              </div>

              <div className="text-sm text-center">
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  로그인 페이지로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
} 