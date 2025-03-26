import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 접속 시 대시보드 또는 로그인 페이지로 리다이렉트
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Head>
        <title>WhatSub - 유튜브 자막 번역 도우미</title>
        <meta name="description" content="유튜브 자막을 쉽게 번역하고 공유하세요." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="text-center p-5">
        <h1 className="text-4xl font-bold mb-4">WhatSub</h1>
        <p className="text-xl mb-8">페이지를 불러오는 중입니다...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      </main>
    </div>
  );
} 