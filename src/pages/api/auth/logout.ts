import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
  }

  try {
    // JWT 토큰이 담긴 쿠키를 제거합니다
    res.setHeader('Set-Cookie', [
      'token=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ]);

    return res.status(200).json({ message: '로그아웃되었습니다.' });
  } catch (error) {
    console.error('로그아웃 에러:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
} 