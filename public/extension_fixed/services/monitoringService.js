// 모니터링 서비스
const monitoringService = {
    isInitialized: true,
    metrics: {
        audioProcessingTime: [],
        transcriptionTime: [],
        translationTime: [],
        errors: []
    },

    // 메트릭 기록
    logMetric(type, value) {
        if (this.metrics[type]) {
            this.metrics[type].push({
                value,
                timestamp: Date.now()
            });
        }
    },

    // 에러 기록
    logError(error) {
        this.metrics.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    },

    // 성능 보고서 생성
    generateReport() {
        const report = {
            audioProcessing: this.calculateStats(this.metrics.audioProcessingTime),
            transcription: this.calculateStats(this.metrics.transcriptionTime),
            translation: this.calculateStats(this.metrics.translationTime),
            errorCount: this.metrics.errors.length
        };

        console.log('[whatsub] 성능 보고서:', report);
        return report;
    },

    // 통계 계산
    calculateStats(data) {
        if (!data.length) return null;
        
        const values = data.map(item => item.value);
        return {
            avg: values.reduce((a, b) => a + b) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length
        };
    },

    // 메트릭 초기화
    clearMetrics() {
        Object.keys(this.metrics).forEach(key => {
            this.metrics[key] = [];
        });
    }
};

// 전역 객체에 등록
window.monitoringService = monitoringService; 