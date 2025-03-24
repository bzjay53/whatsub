import { NextResponse } from 'next/server';

// 임시 사용자 데이터 (실제로는 데이터베이스에 저장해야 함)
let users = [
  {
    id: 1,
    email: 'test@example.com',
    password: 'password123',
    name: '테스트 사용자',
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // 이메일 중복 체크
    if (users.find(u => u.email === email)) {
      return NextResponse.json(
        { message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    // 새 사용자 생성
    const newUser = {
      id: users.length + 1,
      email,
      password,
      name,
    };

    users.push(newUser);

    return NextResponse.json(
      {
        message: '회원가입이 완료되었습니다.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('회원가입 처리 중 오류:', error);
    return NextResponse.json(
      { message: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 