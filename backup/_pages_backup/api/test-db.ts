import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log('API 호출 시작: /api/test-db');
    
    try {
        console.log('데이터베이스 연결 시도...');
        await prisma.$connect();
        console.log('데이터베이스 연결 성공');
        
        // 간단한 쿼리 실행
        console.log('테스트 쿼리 실행...');
        const result = await prisma.$queryRaw`SELECT 1 as connected`;
        console.log('쿼리 결과:', result);
        
        res.status(200).json({ 
            status: 'success',
            message: '데이터베이스 연결 성공',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Database error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            code: error.code,
            meta: error.meta,
            message: error.message
        });

        res.status(500).json({ 
            status: 'error',
            message: '데이터베이스 연결 실패',
            error: error.message,
            code: error.code,
            timestamp: new Date().toISOString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        try {
            console.log('데이터베이스 연결 해제 시도...');
            await prisma.$disconnect();
            console.log('데이터베이스 연결 해제 성공');
        } catch (disconnectError) {
            console.error('Disconnect error:', disconnectError);
        }
    }
} 