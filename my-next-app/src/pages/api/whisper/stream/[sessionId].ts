import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import openai from '@/lib/openai';
import { checkUsageLimit, trackUsage } from '@/lib/usage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '25mb'
        }
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 세션 확인
        const session = await getSession({ req });
        if (!session?.user?.id) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }

        const { sessionId } = req.query;
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({ error: '오디오 데이터가 없습니다.' });
        }

        // 오디오 길이 계산 (base64 문자열 길이로 대략적인 계산)
        const audioLengthMinutes = (audio.length * 0.75) / (16000 * 2 * 60); // 16kHz, 16bit

        // 사용량 제한 확인
        await checkUsageLimit(session.user.id, 'whisperMinutes', audioLengthMinutes);

        // 임시 파일 생성
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whisper-'));
        const tempFilePath = path.join(tempDir, `${sessionId}.wav`);
        
        // base64 디코딩 및 파일 저장
        const audioBuffer = Buffer.from(audio, 'base64');
        await fs.writeFile(tempFilePath, audioBuffer);

        // Whisper API 호출
        const transcription = await openai.audio.transcriptions.create({
            file: await fs.readFile(tempFilePath),
            model: "whisper-1",
            language: "ko",
            response_format: "json"
        });

        // 임시 파일 및 디렉토리 정리
        await fs.unlink(tempFilePath);
        await fs.rmdir(tempDir);

        // 사용량 기록
        await trackUsage(session.user.id, 'whisperMinutes', audioLengthMinutes);

        res.status(200).json({
            text: transcription.text,
            language: transcription.language
        });
    } catch (error: any) {
        console.error('Whisper API 오류:', error);
        res.status(500).json({ 
            error: error.message || '음성 인식 처리 중 오류가 발생했습니다.' 
        });
    }
} 