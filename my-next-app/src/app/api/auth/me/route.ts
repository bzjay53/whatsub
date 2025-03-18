import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 임시 사용자 데이터 (실제로는 데이터베이스에서 가져와야 함)
const users = [
  {
    id: 1,
    email: 'test@example.com',
    name: '테스트 사용자',
  },
];

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

      const user = users.find(u => u.id === decoded.userId);

      if (!user) {
        return NextResponse.json(
          { message: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
    return NextResponse.json(
      { message: '사용자 정보를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 