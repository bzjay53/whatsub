import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { validatePassword } from '@/lib/auth';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 토큰이 없는 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!token && router.isReady) {
      router.push('/login');
    }
  }, [token, router]);

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '비밀번호 재설정에 실패했습니다.');
      }

      setSuccess(true);
      // 3초 후 로그인 페이지로 리다이렉트
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  if (!token) {
    return null; // 토큰이 없는 경우 아무것도 렌더링하지 않음
  }

  return (
    <>
      <Head>
        <title>새 비밀번호 설정 - WhatsUb</title>
        <meta name="description" content="WhatsUb 새 비밀번호 설정 페이지" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              새 비밀번호 설정
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              새로운 비밀번호를 입력해주세요.
            </p>
          </div>

          {success ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    비밀번호가 성공적으로 변경되었습니다.
                    <br />
                    잠시 후 로그인 페이지로 이동합니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="password" className="sr-only">새 비밀번호</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      error ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="새 비밀번호"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="sr-only">새 비밀번호 확인</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      error ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="새 비밀번호 확인"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
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
                  {isLoading ? '처리 중...' : '비밀번호 변경'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
} 