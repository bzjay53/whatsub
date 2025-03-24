import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 임시 구독 데이터 (실제로는 데이터베이스에서 가져와야 함)
const subscriptions = new Map([
  [1, {
    plan: '무료 플랜',
    startDate: new Date().toISOString(),
    status: 'active',
  }],
]);

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json(
        { message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    try {
      const decoded = jwt.verify(token.value, JWT_SECRET) as {
        userId: number;
      };

      const subscription = subscriptions.get(decoded.userId) || {
        plan: '무료 플랜',
        startDate: new Date().toISOString(),
        status: 'active',
      };

      return NextResponse.json({ subscription });
    } catch (error) {
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('구독 정보 조회 중 오류:', error);
    return NextResponse.json(
      { message: '구독 정보를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 