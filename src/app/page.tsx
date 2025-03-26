'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-5xl items-center justify-between text-center">
        <h1 className="text-4xl font-bold mb-4">WhatSub</h1>
        <p className="text-xl mb-8">유튜브 자막 번역 도우미</p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Link 
            href="https://chrome.google.com/webstore/detail/whatsub" 
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            크롬 확장 프로그램 설치하기
          </Link>
          <Link 
            href="/login" 
            className="px-6 py-3 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
} 