import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const { returnUrl } = router.query;
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({
    email: '',
    password: ''
  });

  // 이미 로그인된 경우 대시보드 또는 returnUrl로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      const redirectUrl = returnUrl && typeof returnUrl === 'string'
        ? decodeURIComponent(returnUrl)
        : '/dashboard';
      router.push(redirectUrl);
    }
  }, [isAuthenticated, router, returnUrl]);

  // 에러 메시지 초기화
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      email: '',
      password: ''
    };

    // 이메일 검증
    if (!formData.email) {
      newErrors.email = '이메일을 입력해주세요.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
      isValid = false;
    }

    // 비밀번호 검증
    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
      isValid = false;
    }

    setFormErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await login(formData.email, formData.password);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 입력 시 해당 필드의 에러 메시지 초기화
    setFormErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };

  return (
    <>
      <Head>
        <title>로그인 - WhatsUb</title>
        <meta name="description" content="WhatsUb 로그인 페이지" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              WhatsUb 로그인
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">이메일</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    formErrors.email || error ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="이메일"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {formErrors.email && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="sr-only">비밀번호</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    formErrors.password || error ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="비밀번호"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {formErrors.password && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
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
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <div className="text-sm">
                <Link
                  href="/register"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  회원가입하기
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
} 