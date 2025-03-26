// 자막 서비스
const subtitleService = {
    isInitialized: true,
    container: null,
    
    // 자막 표시/숨김 설정
    setVisibility(visible) {
        console.log(`[whatsub] 자막 ${visible ? '표시' : '숨김'}`);
    },

    // 자막 업데이트
    updateSubtitle(text, translation = '') {
        console.log('[whatsub] 자막 업데이트:', { text, translation });
    },

    // 자막 스타일 적용
    applySettings(settings) {
        console.log('[whatsub] 자막 스타일 업데이트:', settings);
    }
};

// 전역 객체에 등록
window.subtitleService = subtitleService; 