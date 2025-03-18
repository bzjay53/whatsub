import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePassword } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
    }

    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ message: '모든 필수 정보를 입력해주세요.' });
        }

        // 비밀번호 유효성 검사
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // 이메일 중복 확인
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: '이미 사용 중인 이메일입니다.' });
        }

        // 비밀번호 해시화
        const hashedPassword = await hashPassword(password);

        // 사용자 생성
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'USER',
            },
        });

        res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('회원가입 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
} 