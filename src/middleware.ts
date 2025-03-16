import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokenData } from '@/lib/auth';

// 보호된 경로 목록
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
];

// 공개 경로 목록 (로그인한 사용자는 접근 불가)
const publicOnlyRoutes = [
  '/login',
  '/register',
];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // API 라우트는 건너뜁니다
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 토큰이 있는 경우 (로그인된 경우)
  if (token) {
    // 토큰 검증
    const userData = getTokenData(token);
    
    if (!userData) {
      // 토큰이 유효하지 않은 경우 쿠키를 삭제하고 로그인 페이지로 리다이렉트
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }

    // 로그인된 사용자가 로그인/회원가입 페이지에 접근하는 경우
    if (publicOnlyRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 로그인된 사용자는 계속 진행
    return NextResponse.next();
  }

  // 토큰이 없는 경우 (로그인되지 않은 경우)
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    // 현재 URL을 리다이렉트 후 돌아올 URL로 저장
    const returnUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, request.url));
  }

  // 그 외의 경우는 계속 진행
  return NextResponse.next();
}

// 미들웨어가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 