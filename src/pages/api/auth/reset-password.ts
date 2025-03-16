import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePassword } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
  }

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
    }

    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // 토큰으로 사용자 찾기
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        message: '유효하지 않거나 만료된 비밀번호 재설정 링크입니다.',
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await hashPassword(password);

    // 사용자 정보 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return res.status(200).json({
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('비밀번호 재설정 에러:', error);
    return res.status(500).json({
      message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
} 