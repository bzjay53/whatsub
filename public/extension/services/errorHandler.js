// 에러 핸들러 서비스
const errorHandler = {
    isInitialized: true,

    createError(message, code = 'UNKNOWN_ERROR') {
        const error = new Error(message);
        error.code = code;
        return error;
    },

    handleError(error) {
        console.error('[whatsub] 오류 발생:', error);
        
        if (window.statusIndicator) {
            window.statusIndicator.updateStatus(
                error.message || '알 수 없는 오류가 발생했습니다.',
                'error'
            );
        }

        return {
            success: false,
            error: {
                message: error.message,
                code: error.code || 'UNKNOWN_ERROR'
            }
        };
    }
};

// 전역 객체에 등록
window.errorHandler = errorHandler; 