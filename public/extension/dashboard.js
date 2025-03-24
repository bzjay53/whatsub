// 차트 설정
const chartConfig = {
    type: 'line',
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'second'
                }
            },
            y: {
                beginAtZero: true
            }
        }
    }
};

// 차트 객체 저장
const charts = {
    audio: null,
    recognition: null,
    translation: null,
    system: null
};

// 실시간 데이터 저장
const realtimeData = {
    audio: [],
    recognition: [],
    translation: [],
    system: []
};

// 최대 데이터 포인트 수
const MAX_DATA_POINTS = 60;

// 차트 초기화
function initializeCharts() {
    // 오디오 처리 차트
    charts.audio = new Chart(
        document.getElementById('audioChart').getContext('2d'),
        {
            ...chartConfig,
            data: {
                datasets: [{
                    label: '처리 시간 (ms)',
                    borderColor: '#4F46E5',
                    data: []
                }]
            }
        }
    );

    // 음성 인식 차트
    charts.recognition = new Chart(
        document.getElementById('recognitionChart').getContext('2d'),
        {
            ...chartConfig,
            data: {
                datasets: [{
                    label: '지연 시간 (ms)',
                    borderColor: '#059669',
                    data: []
                }]
            }
        }
    );

    // 번역 차트
    charts.translation = new Chart(
        document.getElementById('translationChart').getContext('2d'),
        {
            ...chartConfig,
            data: {
                datasets: [{
                    label: '지연 시간 (ms)',
                    borderColor: '#D97706',
                    data: []
                }]
            }
        }
    );

    // 시스템 성능 차트
    charts.system = new Chart(
        document.getElementById('systemChart').getContext('2d'),
        {
            ...chartConfig,
            data: {
                datasets: [{
                    label: 'FPS',
                    borderColor: '#DC2626',
                    data: []
                }, {
                    label: '메모리 사용량 (MB)',
                    borderColor: '#2563EB',
                    data: []
                }]
            }
        }
    );
}

// 메트릭 업데이트
function updateMetrics(metrics) {
    // 오디오 처리 메트릭
    document.getElementById('audioSuccessRate').textContent = metrics.audioProcessing.successRate;
    document.getElementById('audioProcessingTime').textContent = metrics.audioProcessing.averageProcessingTime;

    // 음성 인식 메트릭
    document.getElementById('recognitionSuccessRate').textContent = metrics.recognition.successRate;
    document.getElementById('recognitionLatency').textContent = metrics.recognition.averageLatency;

    // 번역 메트릭
    document.getElementById('translationSuccessRate').textContent = metrics.translation.successRate;
    document.getElementById('translationLatency').textContent = metrics.translation.averageLatency;

    // 시스템 성능 메트릭
    document.getElementById('fps').textContent = metrics.performance.fps;
    document.getElementById('memoryUsage').textContent = metrics.performance.memoryUsage;

    // 차트 데이터 업데이트
    const timestamp = new Date();

    // 오디오 처리 데이터
    realtimeData.audio.push({
        x: timestamp,
        y: parseFloat(metrics.audioProcessing.averageProcessingTime)
    });
    if (realtimeData.audio.length > MAX_DATA_POINTS) {
        realtimeData.audio.shift();
    }

    // 음성 인식 데이터
    realtimeData.recognition.push({
        x: timestamp,
        y: parseFloat(metrics.recognition.averageLatency)
    });
    if (realtimeData.recognition.length > MAX_DATA_POINTS) {
        realtimeData.recognition.shift();
    }

    // 번역 데이터
    realtimeData.translation.push({
        x: timestamp,
        y: parseFloat(metrics.translation.averageLatency)
    });
    if (realtimeData.translation.length > MAX_DATA_POINTS) {
        realtimeData.translation.shift();
    }

    // 시스템 성능 데이터
    realtimeData.system.push({
        x: timestamp,
        y: [
            parseFloat(metrics.performance.fps),
            parseFloat(metrics.performance.memoryUsage)
        ]
    });
    if (realtimeData.system.length > MAX_DATA_POINTS) {
        realtimeData.system.shift();
    }

    // 차트 업데이트
    updateCharts();

    // 성능 경고 체크
    checkPerformanceAlerts(metrics);
}

// 차트 업데이트
function updateCharts() {
    charts.audio.data.datasets[0].data = realtimeData.audio;
    charts.audio.update('none');

    charts.recognition.data.datasets[0].data = realtimeData.recognition;
    charts.recognition.update('none');

    charts.translation.data.datasets[0].data = realtimeData.translation;
    charts.translation.update('none');

    charts.system.data.datasets[0].data = realtimeData.system.map(d => ({ x: d.x, y: d.y[0] }));
    charts.system.data.datasets[1].data = realtimeData.system.map(d => ({ x: d.x, y: d.y[1] }));
    charts.system.update('none');
}

// 성능 경고 체크
function checkPerformanceAlerts(metrics) {
    const alerts = [];

    // 오디오 처리 성능 체크
    if (parseFloat(metrics.audioProcessing.successRate) < 90) {
        alerts.push({
            type: 'error',
            message: '오디오 처리 성공률이 90% 미만입니다.'
        });
    }

    // 음성 인식 성능 체크
    if (parseFloat(metrics.recognition.averageLatency) > 1000) {
        alerts.push({
            type: 'warning',
            message: '음성 인식 지연 시간이 1초를 초과합니다.'
        });
    }

    // 번역 성능 체크
    if (parseFloat(metrics.translation.successRate) < 95) {
        alerts.push({
            type: 'warning',
            message: '번역 성공률이 95% 미만입니다.'
        });
    }

    // 시스템 성능 체크
    if (parseFloat(metrics.performance.fps) < 30) {
        alerts.push({
            type: 'warning',
            message: 'FPS가 30 미만입니다.'
        });
    }

    // 경고 표시
    displayAlerts(alerts);
}

// 경고 표시
function displayAlerts(alerts) {
    const alertsContainer = document.getElementById('performanceAlerts');
    alertsContainer.innerHTML = '';

    alerts.forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.className = `performance-alert ${alert.type}`;
        alertElement.innerHTML = `
            <div class="flex items-center">
                <span class="status-indicator status-${alert.type}"></span>
                <span>${alert.message}</span>
            </div>
        `;
        alertsContainer.appendChild(alertElement);
    });
}

// 탭 전환
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    document.getElementById(`${tabId}-tab`).classList.remove('hidden');

    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// 기록 로드
async function loadHistory() {
    try {
        const result = await chrome.storage.local.get(null);
        const metrics = Object.entries(result)
            .filter(([key]) => key.startsWith('metrics_'))
            .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
            .slice(0, 100);

        const tableBody = document.getElementById('historyTableBody');
        tableBody.innerHTML = '';

        metrics.forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2">${new Date(value.timestamp).toLocaleString()}</td>
                <td class="px-4 py-2">${value.metrics.audioProcessing.successRate}</td>
                <td class="px-4 py-2">${value.metrics.recognition.successRate}</td>
                <td class="px-4 py-2">${value.metrics.translation.successRate}</td>
                <td class="px-4 py-2">${value.metrics.recognition.averageLatency}ms</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('기록 로드 중 오류 발생:', error);
    }
}

// 성능 분석
async function analyzePerformance() {
    try {
        const result = await chrome.storage.local.get(null);
        const metrics = Object.entries(result)
            .filter(([key]) => key.startsWith('metrics_'))
            .map(([_, value]) => value.metrics);

        const analysis = {
            audioProcessing: {
                averageSuccessRate: calculateAverage(metrics.map(m => parseFloat(m.audioProcessing.successRate))),
                averageProcessingTime: calculateAverage(metrics.map(m => parseFloat(m.audioProcessing.averageProcessingTime)))
            },
            recognition: {
                averageSuccessRate: calculateAverage(metrics.map(m => parseFloat(m.recognition.successRate))),
                averageLatency: calculateAverage(metrics.map(m => parseFloat(m.recognition.averageLatency)))
            },
            translation: {
                averageSuccessRate: calculateAverage(metrics.map(m => parseFloat(m.translation.successRate))),
                averageLatency: calculateAverage(metrics.map(m => parseFloat(m.translation.averageLatency)))
            }
        };

        displayAnalysis(analysis);
    } catch (error) {
        console.error('성능 분석 중 오류 발생:', error);
    }
}

// 평균 계산
function calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// 분석 결과 표시
function displayAnalysis(analysis) {
    const analysisContent = document.getElementById('analysisContent');
    analysisContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-semibold mb-2">오디오 처리</h4>
                <p>평균 성공률: ${analysis.audioProcessing.averageSuccessRate.toFixed(2)}%</p>
                <p>평균 처리 시간: ${analysis.audioProcessing.averageProcessingTime.toFixed(2)}ms</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-semibold mb-2">음성 인식</h4>
                <p>평균 성공률: ${analysis.recognition.averageSuccessRate.toFixed(2)}%</p>
                <p>평균 지연 시간: ${analysis.recognition.averageLatency.toFixed(2)}ms</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-semibold mb-2">번역</h4>
                <p>평균 성공률: ${analysis.translation.averageSuccessRate.toFixed(2)}%</p>
                <p>평균 지연 시간: ${analysis.translation.averageLatency.toFixed(2)}ms</p>
            </div>
        </div>
    `;
}

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 차트 초기화
    initializeCharts();

    // 탭 전환 이벤트
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            switchTab(tabId);

            if (tabId === 'history') {
                loadHistory();
            } else if (tabId === 'analysis') {
                analyzePerformance();
            }
        });
    });

    // 새로고침 버튼
    document.getElementById('refreshButton').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'getMetrics' }, (response) => {
            if (response && response.metrics) {
                updateMetrics(response.metrics);
            }
        });
    });

    // 초기 데이터 로드
    chrome.runtime.sendMessage({ action: 'getMetrics' }, (response) => {
        if (response && response.metrics) {
            updateMetrics(response.metrics);
        }
    });

    // 실시간 업데이트
    setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getMetrics' }, (response) => {
            if (response && response.metrics) {
                updateMetrics(response.metrics);
            }
        });
    }, 1000);
}); 