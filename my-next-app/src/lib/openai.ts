import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default openai; 