import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { validatePassword } from '@/lib/auth';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  });

  const [formErrors, setFormErrors] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      email: '',
      name: '',
      password: '',
      confirmPassword: ''
    };

    // 이메일 검증
    if (!formData.email) {
      newErrors.email = '이메일을 입력해주세요.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
      isValid = false;
    }

    // 이름 검증
    if (!formData.name) {
      newErrors.name = '이름을 입력해주세요.';
      isValid = false;
    } else if (formData.name.length < 2) {
      newErrors.name = '이름은 2자 이상이어야 합니다.';
      isValid = false;
    }

    // 비밀번호 검증
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message || '올바른 비밀번호를 입력해주세요.';
      isValid = false;
    }

    // 비밀번호 확인 검증
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
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

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '회원가입에 실패했습니다.');
      }

      // 회원가입 성공 시 로그인 페이지로 이동
      router.push('/login');
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
    // 입력 시 해당 필드의 에러 메시지 초기화
    setFormErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };

  return (
    <>
      <Head>
        <title>회원가입 - WhatsUb</title>
        <meta name="description" content="WhatsUb 회원가입 페이지" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              WhatsUb 회원가입
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
                    formErrors.email ? 'border-red-300' : 'border-gray-300'
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
                <label htmlFor="name" className="sr-only">이름</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="이름"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="sr-only">비밀번호</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    formErrors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="비밀번호"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {formErrors.password && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="sr-only">비밀번호 확인</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    formErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder="비밀번호 확인"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {formErrors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.confirmPassword}</p>
                )}
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
                {isLoading ? '처리 중...' : '회원가입'}
              </button>
            </div>
          </form>

          <div className="text-sm text-center">
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              이미 계정이 있으신가요? 로그인하기
            </Link>
          </div>
        </div>
      </div>
    </>
  );
} 