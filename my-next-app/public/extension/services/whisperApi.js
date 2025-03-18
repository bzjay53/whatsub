// Whisper API 서비스
const whisperApi = {
    isInitialized: true,
    baseUrl: 'https://api.openai.com/v1/audio/transcriptions',
    
    async transcribe(audioData, apiKey, options = {}) {
        try {
            const formData = new FormData();
            formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav');
            formData.append('model', 'whisper-1');
            formData.append('language', options.language || 'ko');
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('API 요청 실패');
            }

            const result = await response.json();
            return {
                success: true,
                text: result.text,
                language: result.language
            };
        } catch (error) {
            console.error('[whatsub] 음성 인식 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// 전역 객체에 등록
window.whisperApi = whisperApi; 