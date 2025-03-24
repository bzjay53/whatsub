import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

// 실제 운영 환경에서는 이 값을 환경 변수로 관리해야 합니다
const ADMIN_SECRET = 'your-secret-key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, name, adminSecret } = req.body;

        // 관리자 생성 시크릿 키 검증
        if (adminSecret !== ADMIN_SECRET) {
            return res.status(403).json({ error: '관리자 생성 권한이 없습니다.' });
        }

        if (!email) {
            return res.status(400).json({ error: '이메일은 필수입니다.' });
        }

        // 데이터베이스 연결 테스트
        try {
            await prisma.$connect();
            console.log('Database connected successfully');
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            return res.status(500).json({ error: '데이터베이스 연결 오류' });
        }

        // 관리자 계정 생성
        const admin = await prisma.user.create({
            data: {
                email,
                name,
                role: 'admin',
                subscription: {
                    create: {
                        plan: 'unlimited',
                        status: 'active',
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: new Date('2099-12-31'), // 매우 긴 기간
                        cancelAtPeriodEnd: false,
                    }
                },
                usage: {
                    create: {
                        whisperMinutes: 0,
                        gpt4Tokens: 0,
                        gpt35Tokens: 0,
                        dailyUsage: {},
                        monthlyUsage: {}
                    }
                }
            },
            include: {
                subscription: true,
                usage: true
            }
        });

        console.log('Admin created:', admin);

        res.status(201).json(admin);
    } catch (error: any) {
        console.error('Admin creation error:', error);

        if (error.code === 'P2002') {
            return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
        }

        res.status(500).json({ 
            error: '관리자 계정 생성 중 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await prisma.$disconnect();
    }
} 