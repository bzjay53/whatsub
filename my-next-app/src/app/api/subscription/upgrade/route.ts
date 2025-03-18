import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 임시 구독 데이터 (실제로는 데이터베이스에 저장해야 함)
const subscriptions = new Map();

export async function POST(request: Request) {
  try {
    // 토큰 확인
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json(
        { message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    try {
      const decoded = jwt.verify(token.value, JWT_SECRET) as {
        userId: number;
      };

      const body = await request.json();
      const { plan } = body;

      // 구독 정보 업데이트
      subscriptions.set(decoded.userId, {
        plan,
        startDate: new Date(),
        status: 'active',
      });

      return NextResponse.json(
        {
          message: '구독 플랜이 업그레이드되었습니다.',
          subscription: {
            plan,
            startDate: new Date(),
            status: 'active',
          },
        },
        { status: 200 }
      );
    } catch (error) {
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('구독 업그레이드 처리 중 오류:', error);
    return NextResponse.json(
      { message: '구독 업그레이드 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 