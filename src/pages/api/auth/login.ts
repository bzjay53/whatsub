import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    // 세션 쿠키 설정
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict`);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
} 