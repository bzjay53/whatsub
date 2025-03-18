// 번역 서비스
const translationService = {
    isInitialized: true,
    
    async translate(text, sourceLang = 'ko', targetLang = 'en') {
        try {
            const apiKey = await window.authService.getStoredApiKey();
            if (!apiKey) {
                throw new Error('API 키가 필요합니다.');
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'system',
                        content: `You are a translator. Translate from ${sourceLang} to ${targetLang}. Only provide the translation, no explanations.`
                    }, {
                        role: 'user',
                        content: text
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('번역 요청 실패');
            }

            const result = await response.json();
            return {
                success: true,
                text: result.choices[0].message.content.trim()
            };
        } catch (error) {
            console.error('[whatsub] 번역 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// 전역 객체에 등록
window.translationService = translationService; 