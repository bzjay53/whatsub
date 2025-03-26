/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  distDir: 'out',
  typescript: {
    // 타입 오류를 무시하고 빌드 계속 진행
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint 오류를 무시하고 빌드 계속 진행
    ignoreDuringBuilds: true,
  },
  // 특정 파일/폴더를 빌드에서 제외
  webpack: (config, { dev, isServer }) => {
    // backup 디렉토리 제외
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/.git/**', '**/node_modules/**', '**/backup/**', '**/_*_pages/**']
    };
    return config;
  },
  images: {
    unoptimized: true
  },
  // API 라우트를 건너뛰도록 설정
  experimental: {
    appRoutesStrictMatchExtensions: true,
  },
  // SSR이 불가능한 API 라우트 비활성화
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig; 