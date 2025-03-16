import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: '이메일을 입력해주세요.' });
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 보안을 위해 사용자가 없어도 성공 응답을 보냅니다
      return res.status(200).json({
        message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.',
      });
    }

    // 재설정 토큰 생성
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1시간 후 만료

    // 사용자 정보 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // 이메일 전송
    const emailContent = generatePasswordResetEmail(email, resetToken);
    const emailSent = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (!emailSent) {
      throw new Error('이메일 전송에 실패했습니다.');
    }

    return res.status(200).json({
      message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.',
    });
  } catch (error) {
    console.error('비밀번호 재설정 요청 에러:', error);
    return res.status(500).json({
      message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
} 