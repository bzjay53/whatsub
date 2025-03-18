// 디버그 로거 초기화
const debugLogger = {
    isInitialized: true,
    
    log(message) {
        console.log(`[whatsub] ${message}`);
    },

    error(message) {
        console.error(`[whatsub] ${message}`);
    },

    warn(message) {
        console.warn(`[whatsub] ${message}`);
    }
};

// 전역 객체에 등록
window.debugLogger = debugLogger;

// 디버그 유틸리티
window.debugUtil = {
    log: (...args) => console.log('[WhatsUb]', ...args),
    error: (...args) => console.error('[WhatsUb]', ...args),
    warn: (...args) => console.warn('[WhatsUb]', ...args)
}; 