// IIFE를 사용하여 전역 네임스페이스 오염 방지
(async function() {
    // CSS 스타일 로드
    function loadStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('styles/subtitles.css');
        link.id = 'whatsub-styles';
        document.head.appendChild(link);
        console.log('Whatsub 스타일 로드됨');
    }
    
    // 페이지 로드 시 스타일 적용
    loadStyles();
    
    // 전역 상태 관리
    const state = {
        subtitleContainer: null,
        subtitleEnabled: false,
        syncValue: 0,
        recognition: null,
        isRecognizing: false,
        audioContext: null,
        audioSource: null,
        audioProcessor: null,
        audioData: [],
        SAMPLE_RATE: 16000,
        isInitialized: false,
        services: {},
        settings: {},
        videoElements: [],
        currentVideoElement: null,
        websiteType: 'unknown', // 'youtube', 'netflix', 'vimeo', 'generic'
        observer: null,
        debugLogs: [] // 디버그 로그 저장을 위한 배열 추가
    };

    // 전역 서비스 객체들
    const services = {
        statusIndicator: null,
        audioCapture: null,
        subtitleDisplay: null,
        authService: null,
        debugLogger: null,
        videoDetector: null
    };

    // 디버그 로거 서비스
    class DebugLogger {
        constructor() {
            this.logs = [];
            this.maxLogs = 1000; // 최대 로그 저장 수
            this.logFile = null;
            this.logLevel = 'info'; // debug, info, warn, error
            this.logLevels = {
                debug: 0,
                info: 1,
                warn: 2,
                error: 3
            };
            this.container = null;
            this.autoScroll = true;
            this.isInitialized = false;
            this.originalConsoleMethods = {};
            this.setupConsoleOverrides();
        }

        async initialize() {
            try {
                // 로컬 스토리지에서 기존 로그 로드
                await this.loadLogs();
                
                // UI 컨테이너 생성
                this.createLogContainer();
                
                this.isInitialized = true;
                this.log('info', '디버그 로거가 초기화되었습니다.');
                return true;
            } catch (error) {
                console.error('디버그 로거 초기화 실패:', error);
                return false;
            }
        }

        // 콘솔 메서드 오버라이드
        setupConsoleOverrides() {
            // 원본 콘솔 메서드 저장
            this.originalConsoleMethods = {
                log: console.log,
                info: console.info,
                warn: console.warn,
                error: console.error,
                debug: console.debug
            };
            
            // 콘솔 메서드 오버라이드
            console.log = (...args) => {
                this.originalConsoleMethods.log(...args);
                this.log('info', ...args);
            };
            
            console.info = (...args) => {
                this.originalConsoleMethods.info(...args);
                this.log('info', ...args);
            };
            
            console.warn = (...args) => {
                this.originalConsoleMethods.warn(...args);
                this.log('warn', ...args);
            };
            
            console.error = (...args) => {
                this.originalConsoleMethods.error(...args);
                this.log('error', ...args);
            };
            
            console.debug = (...args) => {
                this.originalConsoleMethods.debug(...args);
                this.log('debug', ...args);
            };
            
            // 전역 오류 핸들러
            window.addEventListener('error', (event) => {
                this.log('error', `전역 오류: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
                // 기본 오류 처리 유지
                return false;
            });
            
            // Promise 오류 핸들러
            window.addEventListener('unhandledrejection', (event) => {
                this.log('error', `처리되지 않은 Promise 거부: ${event.reason}`);
            });
        }

        // 로그 저장
        log(level, ...messages) {
            // 로그 레벨 확인
            if (this.logLevels[level] < this.logLevels[this.logLevel]) {
                return;
            }
            
            // 메시지 문자열화
            const message = messages.map(msg => {
                if (msg instanceof Error) {
                    return `${msg.message}\n${msg.stack}`;
                } else if (typeof msg === 'object') {
                    try {
                        return JSON.stringify(msg);
                    } catch (e) {
                        return String(msg);
                    }
                } else {
                    return String(msg);
                }
            }).join(' ');
            
            // 타임스탬프 생성
            const timestamp = new Date().toISOString();
            
            // 로그 객체 생성
            const logEntry = {
                timestamp,
                level,
                message,
                location: this.getCallerInfo()
            };
            
            // 로그 배열에 추가
            this.logs.push(logEntry);
            state.debugLogs.push(logEntry);
            
            // 최대 로그 수 초과 시 오래된 로그 제거
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }
            
            if (state.debugLogs.length > this.maxLogs) {
                state.debugLogs.shift();
            }
            
            // 로그 UI 업데이트
            this.updateLogUI(logEntry);
            
            // 로컬 스토리지에 로그 저장 (스로틀링 적용)
            this.scheduleSaveLogs();
        }

        // 호출자 정보 가져오기
        getCallerInfo() {
            try {
                const error = new Error();
                const stack = error.stack.split('\n');
                
                // 스택에서 실제 호출자 찾기 (첫 번째는 현재 함수, 두 번째는 log 함수)
                let callerLine = stack[3] || '';
                
                // 크롬 형식: "at functionName (file:line:column)"
                const chromeMatch = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
                if (chromeMatch) {
                    const [, funcName, fileName, line, column] = chromeMatch;
                    return `${fileName.split('/').pop()}:${line}`;
                }
                
                // 파이어폭스 형식: "functionName@file:line:column"
                const firefoxMatch = callerLine.match(/(.*?)@(.*):(\d+):(\d+)/);
                if (firefoxMatch) {
                    const [, funcName, fileName, line, column] = firefoxMatch;
                    return `${fileName.split('/').pop()}:${line}`;
                }
                
                return '알 수 없는 위치';
            } catch (e) {
                return '알 수 없는 위치';
            }
        }

        // 로그 UI 컨테이너 생성
        createLogContainer() {
            // 이미 존재하는 경우 제거
            if (this.container) {
                document.body.removeChild(this.container);
            }
            
            // 로그 컨테이너 생성
            const container = document.createElement('div');
            container.id = 'whatsub-debug-container';
            container.style.display = 'none';
            container.style.position = 'fixed';
            container.style.bottom = '10px';
            container.style.right = '10px';
            container.style.width = '90%';
            container.style.maxWidth = '800px';
            container.style.height = '300px';
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            container.style.color = '#fff';
            container.style.padding = '10px';
            container.style.borderRadius = '5px';
            container.style.zIndex = '999999';
            container.style.overflow = 'hidden';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            
            // 헤더 영역
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.marginBottom = '10px';
            
            const title = document.createElement('div');
            title.textContent = 'Whatsub 디버그 로그';
            title.style.fontWeight = 'bold';
            
            const controls = document.createElement('div');
            
            // 필터 드롭다운
            const filterSelect = document.createElement('select');
            filterSelect.style.backgroundColor = '#333';
            filterSelect.style.color = '#fff';
            filterSelect.style.border = '1px solid #666';
            filterSelect.style.marginRight = '5px';
            filterSelect.style.padding = '2px 5px';
            
            const filterOptions = ['all', 'debug', 'info', 'warn', 'error'];
            filterOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                if (option === 'all') {
                    optionElement.selected = true;
                }
                filterSelect.appendChild(optionElement);
            });
            
            filterSelect.addEventListener('change', () => {
                this.filterLogs(filterSelect.value);
            });
            
            // 닫기 버튼
            const closeButton = document.createElement('button');
            closeButton.textContent = '닫기';
            closeButton.style.backgroundColor = '#555';
            closeButton.style.color = '#fff';
            closeButton.style.border = 'none';
            closeButton.style.padding = '3px 8px';
            closeButton.style.marginLeft = '5px';
            closeButton.style.cursor = 'pointer';
            
            closeButton.addEventListener('click', () => {
                this.toggleDisplay();
            });
            
            // 내보내기 버튼
            const exportButton = document.createElement('button');
            exportButton.textContent = '내보내기';
            exportButton.style.backgroundColor = '#555';
            exportButton.style.color = '#fff';
            exportButton.style.border = 'none';
            exportButton.style.padding = '3px 8px';
            exportButton.style.marginLeft = '5px';
            exportButton.style.cursor = 'pointer';
            
            exportButton.addEventListener('click', () => {
                this.exportLogs();
            });
            
            // 지우기 버튼
            const clearButton = document.createElement('button');
            clearButton.textContent = '지우기';
            clearButton.style.backgroundColor = '#555';
            clearButton.style.color = '#fff';
            clearButton.style.border = 'none';
            clearButton.style.padding = '3px 8px';
            clearButton.style.marginLeft = '5px';
            clearButton.style.cursor = 'pointer';
            
            clearButton.addEventListener('click', () => {
                this.clearLogs();
            });
            
            controls.appendChild(filterSelect);
            controls.appendChild(exportButton);
            controls.appendChild(clearButton);
            controls.appendChild(closeButton);
            
            header.appendChild(title);
            header.appendChild(controls);
            container.appendChild(header);
            
            // 로그 내용 영역
            const logContent = document.createElement('div');
            logContent.id = 'whatsub-log-content';
            logContent.style.flex = '1';
            logContent.style.overflowY = 'auto';
            logContent.style.fontFamily = 'monospace';
            logContent.style.fontSize = '12px';
            logContent.style.backgroundColor = '#111';
            logContent.style.padding = '5px';
            logContent.style.borderRadius = '3px';
            
            container.appendChild(logContent);
            
            // 바닥글 영역 (상태)
            const footer = document.createElement('div');
            footer.style.marginTop = '5px';
            footer.style.fontSize = '11px';
            footer.style.color = '#aaa';
            footer.textContent = `총 로그: ${this.logs.length}`;
            
            container.appendChild(footer);
            
            // 문서에 추가
            document.body.appendChild(container);
            
            // 단축키 이벤트 리스너 추가 (Alt+D)
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.code === 'KeyD') {
                    e.preventDefault();
                    this.toggleDisplay();
                }
            });
            
            this.container = container;
            this.logContent = logContent;
            this.footerElement = footer;
            
            // 기존 로그 표시
            this.refreshLogUI();
        }

        // 로그 UI 업데이트
        updateLogUI(logEntry) {
            if (!this.logContent) return;
            
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${logEntry.level}`;
            logElement.dataset.level = logEntry.level;
            
            // 로그 레벨별 색상
            const colors = {
                debug: '#aaa',
                info: '#fff',
                warn: '#ff9',
                error: '#f66'
            };
            
            logElement.style.color = colors[logEntry.level] || '#fff';
            logElement.style.marginBottom = '3px';
            logElement.style.borderLeft = `3px solid ${colors[logEntry.level] || '#fff'}`;
            logElement.style.paddingLeft = '5px';
            
            // 타임스탬프 부분
            const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
            
            // 로그 메시지 구성
            logElement.innerHTML = `
                <span style="color:#888;">[${timestamp}]</span>
                <span style="color:#8af;">[${logEntry.level.toUpperCase()}]</span>
                <span style="color:#f9c;">${logEntry.location}</span>
                <span>${logEntry.message}</span>
            `;
            
            this.logContent.appendChild(logElement);
            
            // 자동 스크롤
            if (this.autoScroll) {
                this.logContent.scrollTop = this.logContent.scrollHeight;
            }
            
            // 푸터 업데이트
            if (this.footerElement) {
                this.footerElement.textContent = `총 로그: ${this.logs.length}`;
            }
        }

        // 로그 필터링
        filterLogs(level) {
            if (!this.logContent) return;
            
            const allEntries = this.logContent.querySelectorAll('.log-entry');
            
            if (level === 'all') {
                allEntries.forEach(entry => {
                    entry.style.display = 'block';
                });
            } else {
                allEntries.forEach(entry => {
                    if (entry.dataset.level === level) {
                        entry.style.display = 'block';
                    } else {
                        entry.style.display = 'none';
                    }
                });
            }
        }

        // 로그 UI 전체 다시 표시
        refreshLogUI() {
            if (!this.logContent) return;
            
            // 기존 로그 지우기
            this.logContent.innerHTML = '';
            
            // 최신 500개만 표시
            const logsToShow = this.logs.slice(-500);
            
            // 모든 로그 다시 추가
            logsToShow.forEach(log => {
                this.updateLogUI(log);
            });
        }

        // 로그 UI 표시/숨김 전환
        toggleDisplay() {
            if (!this.container) return;
            
            const isVisible = this.container.style.display !== 'none';
            this.container.style.display = isVisible ? 'none' : 'flex';
            
            if (!isVisible) {
                // 표시 시 로그 업데이트
                this.refreshLogUI();
            }
        }

        // 로그 내보내기
        exportLogs() {
            try {
                // JSON 형식으로 변환
                const logsJson = JSON.stringify(this.logs, null, 2);
                
                // Blob 생성
                const blob = new Blob([logsJson], { type: 'application/json' });
                
                // 다운로드 링크 생성
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // 파일명 생성
                const date = new Date().toISOString().replace(/[:.]/g, '-');
                link.download = `whatsub-logs-${date}.json`;
                
                // 클릭 이벤트 발생
                document.body.appendChild(link);
                link.click();
                
                // 정리
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
                
                this.log('info', '로그 내보내기 완료');
            } catch (error) {
                this.originalConsoleMethods.error('로그 내보내기 실패:', error);
            }
        }

        // 로그 지우기
        clearLogs() {
            this.logs = [];
            state.debugLogs = [];
            
            if (this.logContent) {
                this.logContent.innerHTML = '';
            }
            
            // 로컬 스토리지에서도 제거
            chrome.storage.local.remove('debugLogs');
            
            if (this.footerElement) {
                this.footerElement.textContent = '총 로그: 0';
            }
            
            this.log('info', '로그가 모두 지워졌습니다.');
        }

        // 로그 저장 (스로틀링 적용)
        scheduleSaveLogs() {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            
            this.saveTimeout = setTimeout(() => {
                this.saveLogs();
            }, 5000); // 5초마다 저장
        }

        // 로그를 로컬 스토리지에 저장
        saveLogs() {
            try {
                // 최신 500개만 저장
                const logsToSave = this.logs.slice(-500);
                
                chrome.storage.local.set({
                    debugLogs: logsToSave
                }, () => {
                    if (chrome.runtime.lastError) {
                        this.originalConsoleMethods.error('로그 저장 실패:', chrome.runtime.lastError);
                    }
                });
            } catch (error) {
                this.originalConsoleMethods.error('로그 저장 오류:', error);
            }
        }

        // 로컬 스토리지에서 로그 로드
        async loadLogs() {
            return new Promise((resolve) => {
                chrome.storage.local.get('debugLogs', (data) => {
                    if (data.debugLogs && Array.isArray(data.debugLogs)) {
                        this.logs = data.debugLogs;
                        state.debugLogs = [...data.debugLogs];
                    }
                    resolve();
                });
            });
        }
    }

    // 서비스 초기화 상태 관리
    let servicesInitialized = false;
    const serviceNames = ['debugLogger', 'statusIndicator', 'videoDetector', 'audioCapture', 'subtitleDisplay'];
    const serviceStates = new Map();

    // 비디오 감지 서비스
    class VideoDetector {
        constructor() {
            this.knownVideoServices = {
                'youtube': {
                    domain: 'youtube.com',
                    playerSelector: ['.html5-video-player video', '#movie_player video'],
                    containerSelector: ['.html5-video-container', '#player-container']
                },
                'netflix': {
                    domain: 'netflix.com',
                    playerSelector: ['.VideoContainer video', '.watch-video video'],
                    containerSelector: ['.VideoContainer', '.watch-video--player-view']
                },
                'vimeo': {
                    domain: 'vimeo.com',
                    playerSelector: ['.vp-video video', '.player video'],
                    containerSelector: ['.vp-player-ui-container', '.player']
                },
                'twitch': {
                    domain: 'twitch.tv',
                    playerSelector: ['.video-player__container video', '[data-a-target="video-player"] video'],
                    containerSelector: ['.video-player__container', '[data-a-target="video-player"]']
                },
                'disney': {
                    domain: 'disneyplus.com',
                    playerSelector: ['.btm-media-player video', '.player__container video'],
                    containerSelector: ['.btm-media-player', '.player__container']
                },
                'amazon': {
                    domain: 'amazon.com',
                    playerSelector: ['.webPlayerContainer video', '.webPlayer video'],
                    containerSelector: ['.webPlayerContainer', '.webPlayer']
                },
                'generic': {
                    domain: '*',
                    playerSelector: ['video'],
                    containerSelector: ['body']
                }
            };
            this.observer = null;
            this.detectSiteType();
        }

        async initialize() {
            try {
                this.detectVideos();
                this.setupVideoObserver();
                return true;
            } catch (error) {
                console.error('비디오 감지 초기화 실패:', error);
                return false;
            }
        }

        detectSiteType() {
            const hostname = window.location.hostname;
            
            // 각 알려진 서비스별로 도메인 확인
            for (const [type, config] of Object.entries(this.knownVideoServices)) {
                if (type !== 'generic' && hostname.includes(config.domain)) {
                    state.websiteType = type;
                    console.log(`웹사이트 유형 감지: ${state.websiteType}`);
                    return state.websiteType;
                }
            }
            
            // 일치하는 서비스가 없으면 generic으로 설정
            state.websiteType = 'generic';
            console.log(`웹사이트 유형 감지: ${state.websiteType} (알 수 없는 사이트)`);
            return state.websiteType;
        }

        detectVideos() {
            const siteType = state.websiteType;
            const config = this.knownVideoServices[siteType] || this.knownVideoServices.generic;
            let videos = [];
            
            // 사이트별 특화 선택자 시도 (여러 선택자 지원)
            for (const selector of config.playerSelector) {
                const foundVideos = Array.from(document.querySelectorAll(selector));
                if (foundVideos.length > 0) {
                    videos = foundVideos;
                    console.log(`선택자 '${selector}'로 비디오 요소 ${videos.length}개 발견`);
                    break;
                }
            }
            
            // 특화 선택자로 찾지 못했다면 일반 video 태그 탐색
            if (videos.length === 0) {
                videos = Array.from(document.querySelectorAll('video'));
                console.log(`일반 video 태그로 비디오 요소 ${videos.length}개 발견`);
            }
            
            // 가시성 필터링 - 화면에 표시되고 크기가 있는 비디오만 포함
            videos = videos.filter(video => {
                const rect = video.getBoundingClientRect();
                const isVisible = rect.width > 100 && rect.height > 100 && 
                                 rect.top < window.innerHeight && 
                                 rect.left < window.innerWidth;
                                 
                // 숨겨진 비디오는 제외
                const isHidden = window.getComputedStyle(video).display === 'none' || 
                                window.getComputedStyle(video).visibility === 'hidden' ||
                                video.offsetParent === null;
                                
                return isVisible && !isHidden;
            });
            
            // iframe 내부의 비디오 처리
            if (videos.length === 0) {
                try {
                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        try {
                            // 동일 출처 정책으로 인해 접근이 제한될 수 있음
                            if (iframe.contentDocument) {
                                const iframeVideos = iframe.contentDocument.querySelectorAll('video');
                                if (iframeVideos.length > 0) {
                                    videos = [...videos, ...Array.from(iframeVideos)];
                                    console.log(`iframe 내부에서 비디오 요소 ${iframeVideos.length}개 발견`);
                                }
                            }
                        } catch (e) {
                            // 크로스 도메인 iframe 접근 오류는 무시
                        }
                    }
                } catch (e) {
                    console.warn('iframe 접근 중 오류 발생:', e);
                }
            }
            
            // 재생 중이거나 볼륨이 있는 비디오 우선 정렬
            videos.sort((a, b) => {
                const aActive = !a.paused || a.volume > 0;
                const bActive = !b.paused || b.volume > 0;
                
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                
                // 크기가 큰 비디오 우선
                const aSize = a.videoWidth * a.videoHeight;
                const bSize = b.videoWidth * b.videoHeight;
                return bSize - aSize;
            });
            
            console.log(`발견된 비디오 요소: ${videos.length}개 (필터링 및 정렬 후)`);
            state.videoElements = videos;
            
            // 첫 번째 비디오를 현재 비디오로 설정
            if (videos.length > 0) {
                // 이전과 다른 비디오라면 설정 변경
                if (state.currentVideoElement !== videos[0]) {
                    if (state.currentVideoElement) {
                        // 이전 비디오에서 이벤트 리스너 제거
                        this.removeVideoEventListeners(state.currentVideoElement);
                    }
                    
                    state.currentVideoElement = videos[0];
                    console.log('현재 비디오 요소 설정:', state.currentVideoElement);
                    
                    // 새 비디오에 이벤트 리스너 추가
                    this.addVideoEventListeners(state.currentVideoElement);
                }
            } else if (state.currentVideoElement) {
                // 비디오가 더 이상 없는 경우 현재 비디오 제거
                this.removeVideoEventListeners(state.currentVideoElement);
                state.currentVideoElement = null;
                console.log('비디오 요소가 더 이상 없음');
            }
            
            return videos;
        }
        
        // 비디오 이벤트 리스너 추가
        addVideoEventListeners(videoElement) {
            if (!videoElement) return;
            
            // 이미 이벤트 리스너가 있는지 확인
            if (videoElement._whatsubEvents) return;
            
            // 이벤트 핸들러 저장
            videoElement._whatsubEvents = {
                play: () => {
                    if (state.subtitleEnabled && !state.isRecognizing) {
                        startSubtitleService();
                    }
                },
                pause: () => {
                    if (state.isRecognizing) {
                        stopSubtitleService();
                    }
                },
                timeupdate: () => {
                    // 자막 동기화에 사용할 수 있음
                },
                volumechange: () => {
                    // 볼륨 변경 시 자막 서비스 토글 가능
                    if (videoElement.muted && state.isRecognizing) {
                        stopSubtitleService();
                    } else if (!videoElement.muted && state.subtitleEnabled && !state.isRecognizing && !videoElement.paused) {
                        startSubtitleService();
                    }
                }
            };
            
            // 이벤트 리스너 등록
            for (const [event, handler] of Object.entries(videoElement._whatsubEvents)) {
                videoElement.addEventListener(event, handler);
            }
            
            console.log('비디오 요소에 이벤트 리스너 추가됨');
        }
        
        // 비디오 이벤트 리스너 제거
        removeVideoEventListeners(videoElement) {
            if (!videoElement || !videoElement._whatsubEvents) return;
            
            // 저장된 이벤트 핸들러 제거
            for (const [event, handler] of Object.entries(videoElement._whatsubEvents)) {
                videoElement.removeEventListener(event, handler);
            }
            
            // 참조 제거
            delete videoElement._whatsubEvents;
            console.log('비디오 요소에서 이벤트 리스너 제거됨');
        }

        setupVideoObserver() {
            // DOM 변경 감지를 위한 MutationObserver 설정
            if (this.observer) {
                this.observer.disconnect();
            }
            
            this.observer = new MutationObserver((mutations) => {
                let shouldRedetect = false;
                
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        // 새로운 비디오 요소가 추가되었는지 확인
                        const addedVideos = Array.from(mutation.addedNodes)
                            .filter(node => node.nodeName === 'VIDEO' || 
                                           (node.nodeType === Node.ELEMENT_NODE && node.querySelector('video')));
                        
                        if (addedVideos.length > 0) {
                            shouldRedetect = true;
                            break;
                        }
                    }
                }
                
                if (shouldRedetect) {
                    console.log('DOM 변경 감지: 비디오 요소 재탐색');
                    this.detectVideos();
                }
            });
            
            // 전체 문서 변경 감시
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // 현재 활성 비디오 요소 변경
        switchVideoElement(index) {
            if (index >= 0 && index < state.videoElements.length) {
                // 기존 이벤트 리스너 제거
                if (state.currentVideoElement) {
                    this.removeVideoEventListeners(state.currentVideoElement);
                }
                
                // 새 비디오 요소 설정
                state.currentVideoElement = state.videoElements[index];
                
                // 새 비디오에 이벤트 리스너 추가
                this.addVideoEventListeners(state.currentVideoElement);
                
                console.log(`비디오 요소 전환: 인덱스 ${index}`);
                return true;
            }
            return false;
        }
    }

    // 자막 표시 서비스
    class SubtitleDisplay {
        constructor() {
            this.container = null;
            this.originalSubtitleElement = null;
            this.translatedSubtitleElement = null;
            this.controlsElement = null;
            this.settingsPanel = null;
            this.interactionElement = null;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.observer = null;
            this.resizeObserver = null;
            this.settings = {
                position: 'bottom', // 'top', 'middle', 'bottom' or 'custom'
                fontSize: 'small',   // 'small', 'medium', 'large'
                background: 'semi',  // 'transparent', 'semi', 'solid'
                showControls: true,
                dualSubtitles: true, // 원본 및 번역 자막 모두 표시
                customPosition: null // 사용자가 직접 위치 지정 시 {x, y} 값 저장
            };
        }

        // 이미 존재하는 자막 컨테이너 제거
        removeExistingContainers() {
            const existingContainers = document.querySelectorAll('#whatsub-container');
            if (existingContainers.length > 0) {
                console.log(`${existingContainers.length}개의 기존 자막 컨테이너 제거`);
                existingContainers.forEach(container => container.remove());
            }
        }

        async initialize() {
            try {
                // 이미 존재하는 자막 컨테이너 제거
                this.removeExistingContainers();
                
                // 저장된 설정 로드
                await this.loadSettings();
                
                // 컨테이너 생성
                this.createContainer();
                console.log('자막 디스플레이 초기화 완료');
                return true;
            } catch (error) {
                console.error('자막 디스플레이 초기화 실패:', error);
                return false;
            }
        }

        createContainer() {
            // 기존 컨테이너 제거
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            // 새 컨테이너 생성
            const container = document.createElement('div');
            container.id = 'whatsub-container';
            container.classList.add('subtitle-animated', 'draggable');
            container.style.display = 'none'; // 초기에는 숨김
            
            // 자막 디스플레이 요소 생성
            const originalSubtitle = document.createElement('div');
            originalSubtitle.className = 'original-subtitle';
            originalSubtitle.textContent = '';
            
            const translatedSubtitle = document.createElement('div');
            translatedSubtitle.className = 'translated-subtitle';
            translatedSubtitle.textContent = '';
            
            // 컨트롤 패널 생성
            this.setupControls(container);
            
            // 요소 추가
            container.appendChild(originalSubtitle);
            container.appendChild(translatedSubtitle);
            
            // 문서에 추가
            document.body.appendChild(container);
            
            // 드래그 가능하도록 설정
            this.setupDraggable(container);
            
            // 속성 저장
            this.container = container;
            this.originalSubtitleElement = originalSubtitle;
            this.translatedSubtitleElement = translatedSubtitle;
            
            // 설정 적용
            this.applySettings();
            
            // 비디오 요소 관찰 시작 및 위치 설정
            if (state.currentVideoElement) {
                this.setupVideoObserver(state.currentVideoElement);
                this.positionRelativeToVideo();
                
                // 비디오 크기 변경 감지
                if (this.resizeObserver) this.resizeObserver.disconnect();
                this.resizeObserver = new ResizeObserver(() => {
                    if (this.settings.position !== 'custom') {
                        this.positionRelativeToVideo();
                    }
                });
                this.resizeObserver.observe(state.currentVideoElement);
                
                // 스크롤 이벤트에서도 위치 업데이트
                document.addEventListener('scroll', () => {
                    if (this.settings.position !== 'custom' && this.container.style.display !== 'none') {
                        this.positionRelativeToVideo();
                    }
                }, { passive: true });
            }
            
            // 창 크기 변경 감지
            window.addEventListener('resize', () => {
                if (this.settings.position !== 'custom') {
                    this.positionRelativeToVideo();
                }
            });
            
            // 전체화면 변경 감지
            document.addEventListener('fullscreenchange', () => {
                setTimeout(() => this.positionRelativeToVideo(), 100); // 약간의 지연 추가
            });
            
            return container;
        }

        // 드래그 기능 설정
        setupDraggable(container) {
            // 드래그 시작 이벤트
            container.addEventListener('mousedown', (e) => {
                // 자식 요소 클릭 시 드래그 방지
                if (e.target !== container) return;
                
                this.isDragging = true;
                
                // 클릭 지점의 오프셋 계산
                const containerRect = container.getBoundingClientRect();
                this.dragOffset = {
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top
                };
                
                // 사용자가 직접 위치 설정한 것으로 표시
                container.dataset.userPositioned = 'true';
                
                // 이동 중에 transform 리셋
                container.style.transform = 'none';
                
                // 드래그 스타일 적용
                container.classList.add('dragging');
                
                // 기본 드래그 동작 방지
                e.preventDefault();
            });
            
            // 드래그 이동 이벤트
            document.addEventListener('mousemove', (e) => {
                if (!this.isDragging) return;
                
                // 새 위치 계산 (페이지 스크롤 고려)
                const newLeft = e.clientX - this.dragOffset.x + window.scrollX;
                const newTop = e.clientY - this.dragOffset.y + window.scrollY;
                
                // 화면 경계 확인
                const containerWidth = container.offsetWidth;
                const containerHeight = container.offsetHeight;
                const maxLeft = window.innerWidth - containerWidth + window.scrollX;
                const maxTop = window.innerHeight - containerHeight + window.scrollY;
                
                // 새 위치 적용
                container.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
                container.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
                
                // 사용자 정의 위치 설정
                this.settings.position = 'custom';
                this.settings.customPosition = {
                    left: container.style.left,
                    top: container.style.top
                };
            });
            
            // 드래그 종료 이벤트
            document.addEventListener('mouseup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    container.classList.remove('dragging');
                    
                    // 설정 저장
                    this.saveSettings();
                }
            });
            
            // 윈도우 밖으로 나갔을 때 드래그 종료
            document.addEventListener('mouseleave', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    container.classList.remove('dragging');
                    
                    // 설정 저장
                    this.saveSettings();
                }
            });
        }
        
        // 비디오 요소 변경 감지
        setupVideoObserver(videoElement) {
            // 이미 옵저버가 있다면 연결 해제
            if (this.observer) {
                this.observer.disconnect();
            }
            
            // 새 옵저버 생성
            this.observer = new MutationObserver((mutations) => {
                // 비디오 크기나 위치가 변경되었을 때 자막 위치 조정
                this.positionRelativeToVideo();
            });
            
            // 비디오 요소의 속성 변경 감시
            this.observer.observe(videoElement, {
                attributes: true,
                attributeFilter: ['style', 'class', 'width', 'height']
            });
            
            // 비디오 부모 요소의 변경도 감시
            if (videoElement.parentElement) {
                this.observer.observe(videoElement.parentElement, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }
        }

        // 컨트롤 패널 설정
        setupControls(container) {
            // 컨트롤 패널 컨테이너 생성
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'whatsub-controls';
            container.appendChild(controlsContainer);
            this.controlsElement = controlsContainer;
            
            // 설정 버튼
            const settingsButton = this.createControlButton('⚙️', '설정');
            controlsContainer.appendChild(settingsButton);
            
            // 설정 패널
            const settingsPanel = document.createElement('div');
            settingsPanel.className = 'whatsub-settings-panel';
            container.appendChild(settingsPanel);
            this.settingsPanel = settingsPanel;
            
            // 설정 버튼 클릭 시 패널 표시/숨김
            settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsPanel.classList.toggle('visible');
            });
            
            // 듀얼 자막 토글 버튼
            const dualButton = this.createControlButton('🔤', '듀얼 자막');
            if (this.settings.dualSubtitles) {
                dualButton.classList.add('active');
                container.classList.add('dual-subtitle');
            }
            dualButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.settings.dualSubtitles = !this.settings.dualSubtitles;
                dualButton.classList.toggle('active');
                container.classList.toggle('dual-subtitle');
                
                // 번역 자막 표시/숨김
                this.translatedSubtitleElement.style.display = this.settings.dualSubtitles ? 'block' : 'none';
                
                // 설정 저장
                this.saveSettings();
            });
            controlsContainer.appendChild(dualButton);
            
            // 위치 재설정 버튼
            const resetPositionButton = this.createControlButton('📍', '위치 재설정');
            resetPositionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetPosition();
            });
            controlsContainer.appendChild(resetPositionButton);
            
            // 자막 끄기 버튼
            const closeButton = this.createControlButton('✖️', '자막 끄기');
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                stopSubtitleService();
            });
            controlsContainer.appendChild(closeButton);
            
            // 상호작용 버튼 컨테이너
            const interactionContainer = document.createElement('div');
            interactionContainer.className = 'whatsub-interaction';
            this.interactionElement = interactionContainer;
            
            // 좋아요 버튼
            const likeButton = document.createElement('button');
            likeButton.className = 'whatsub-interaction-button';
            likeButton.innerHTML = '👍';
            likeButton.title = '자막이 정확해요';
            likeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // 활성/비활성 토글
                if (likeButton.classList.contains('active')) {
                    likeButton.classList.remove('active');
                    // 피드백 취소
                    this.sendFeedback('like_cancel');
                } else {
                    likeButton.classList.add('active');
                    dislikeButton.classList.remove('active');
                    // 긍정 피드백 전송
                    this.sendFeedback('like');
                }
            });
            interactionContainer.appendChild(likeButton);
            
            // 싫어요 버튼
            const dislikeButton = document.createElement('button');
            dislikeButton.className = 'whatsub-interaction-button';
            dislikeButton.innerHTML = '👎';
            dislikeButton.title = '자막이 부정확해요';
            dislikeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // 활성/비활성 토글
                if (dislikeButton.classList.contains('active')) {
                    dislikeButton.classList.remove('active');
                    // 피드백 취소
                    this.sendFeedback('dislike_cancel');
                } else {
                    dislikeButton.classList.add('active');
                    likeButton.classList.remove('active');
                    // 부정 피드백 전송
                    this.sendFeedback('dislike');
                }
            });
            interactionContainer.appendChild(dislikeButton);
            
            // 댓글 버튼
            const commentButton = document.createElement('button');
            commentButton.className = 'whatsub-interaction-button';
            commentButton.innerHTML = '💬';
            commentButton.title = '의견을 남겨주세요';
            commentButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showComments();
            });
            interactionContainer.appendChild(commentButton);
            
            // 컨트롤에 상호작용 버튼 추가
            controlsContainer.appendChild(interactionContainer);
            
            // 설정 패널 내용 구성
            this.setupSettingsPanel(settingsPanel);
            
            // 문서 클릭 시 설정 패널 닫기
            document.addEventListener('click', (e) => {
                if (!this.settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) {
                    this.settingsPanel.classList.remove('visible');
                }
            });
        }
        
        // 컨트롤 버튼 생성 헬퍼 함수
        createControlButton(icon, tooltip) {
            const button = document.createElement('button');
            button.className = 'whatsub-control';
            button.innerHTML = icon;
            
            const tooltipEl = document.createElement('span');
            tooltipEl.className = 'whatsub-tooltip';
            tooltipEl.textContent = tooltip;
            button.appendChild(tooltipEl);
            
            return button;
        }
        
        // 설정 패널 구성
        setupSettingsPanel(panel) {
            // 위치 설정
            const positionContainer = document.createElement('div');
            positionContainer.className = 'whatsub-settings-item';
            
            const positionLabel = document.createElement('label');
            positionLabel.textContent = '자막 위치';
            positionContainer.appendChild(positionLabel);
            
            const positionSelect = document.createElement('select');
            const positions = [
                { value: 'top', label: '상단' },
                { value: 'middle', label: '중앙' },
                { value: 'bottom', label: '하단' },
                { value: 'custom', label: '사용자 지정' }
            ];
            
            positions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos.value;
                option.textContent = pos.label;
                if (pos.value === this.settings.position) {
                    option.selected = true;
                }
                positionSelect.appendChild(option);
            });
            
            positionSelect.addEventListener('change', () => {
                this.settings.position = positionSelect.value;
                this.saveSettings();
                this.positionRelativeToVideo();
            });
            
            positionContainer.appendChild(positionSelect);
            panel.appendChild(positionContainer);
            
            // 크기 설정
            const sizeContainer = document.createElement('div');
            sizeContainer.className = 'whatsub-settings-item';
            
            const sizeLabel = document.createElement('label');
            sizeLabel.textContent = '글자 크기';
            sizeContainer.appendChild(sizeLabel);
            
            const sizeSelect = document.createElement('select');
            const sizes = [
                { value: 'small', label: '작게' },
                { value: 'medium', label: '보통' },
                { value: 'large', label: '크게' }
            ];
            
            sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size.value;
                option.textContent = size.label;
                if (size.value === this.settings.fontSize) {
                    option.selected = true;
                }
                sizeSelect.appendChild(option);
            });
            
            sizeSelect.addEventListener('change', () => {
                this.settings.fontSize = sizeSelect.value;
                this.originalSubtitleElement.style.fontSize = this.settings.fontSize;
                this.translatedSubtitleElement.style.fontSize = 
                    (this.settings.fontSize === 'small' ? '14px' : this.settings.fontSize === 'medium' ? '16px' : '18px');
                this.saveSettings();
            });
            
            sizeContainer.appendChild(sizeSelect);
            panel.appendChild(sizeContainer);
            
            // 투명도 설정
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'whatsub-settings-item';
            
            const opacityLabel = document.createElement('label');
            opacityLabel.textContent = '배경 투명도';
            opacityContainer.appendChild(opacityLabel);
            
            const opacityRange = document.createElement('input');
            opacityRange.type = 'range';
            opacityRange.min = '0';
            opacityRange.max = '1';
            opacityRange.step = '0.1';
            opacityRange.value = this.settings.background === 'transparent' ? 0 : this.settings.background === 'semi' ? 0.5 : 1;
            
            opacityRange.addEventListener('input', () => {
                const opacity = opacityRange.value;
                this.settings.background = opacity === 0 ? 'transparent' : opacity === 0.5 ? 'semi' : 'solid';
                this.saveSettings();
                this.applySettings();
            });
            
            opacityContainer.appendChild(opacityRange);
            panel.appendChild(opacityContainer);
        }
        
        // 사용자 피드백 전송
        sendFeedback(type) {
            // 백그라운드 스크립트로 피드백 전송
            chrome.runtime.sendMessage({
                action: 'sendFeedback',
                type: type,
                subtitle: {
                    original: this.originalSubtitleElement.textContent,
                    translated: this.translatedSubtitleElement.textContent
                }
            });
        }
        
        // 댓글 기능 표시
        showComments() {
            // 댓글 UI 구현
            alert('댓글 기능은 현재 개발 중입니다.');
        }
        
        // 설정 저장
        saveSettings() {
            chrome.storage.local.set({
                subtitleSettings: this.settings
            }, () => {
                console.log('자막 설정 저장됨:', this.settings);
            });
        }
        
        // 설정 로드
        loadSettings() {
            chrome.storage.local.get('subtitleSettings', (data) => {
                if (data.subtitleSettings) {
                    this.settings = { ...this.settings, ...data.subtitleSettings };
                    
                    // 설정 적용
                    this.applySettings();
                }
            });
        }
        
        // 설정 적용
        applySettings() {
            // 듀얼 자막 적용
            if (this.settings.dualSubtitles) {
                this.container.classList.add('dual-subtitle');
                this.translatedSubtitleElement.style.display = 'block';
            } else {
                this.container.classList.remove('dual-subtitle');
                this.translatedSubtitleElement.style.display = 'none';
            }
            
            // 글자 크기 적용
            this.originalSubtitleElement.style.fontSize = this.settings.fontSize;
            this.translatedSubtitleElement.style.fontSize = 
                (this.settings.fontSize === 'small' ? '14px' : this.settings.fontSize === 'medium' ? '16px' : '18px');
            
            // 배경 투명도 적용
            this.container.style.backgroundColor = 
                this.settings.background === 'transparent' ? 'transparent' :
                this.settings.background === 'semi' ? 'rgba(0, 0, 0, 0.5)' : 'black';
            
            // 위치 재조정
            this.positionRelativeToVideo();
        }

        // 비디오 요소 기준으로 자막 위치 조정
        positionRelativeToVideo() {
            if (!this.container || !state.currentVideoElement) return;
            
            const videoElement = state.currentVideoElement;
            const videoRect = videoElement.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();
            
            // 비디오가 화면에 보이지 않으면 자막도 숨김
            if (videoRect.bottom < 0 || 
                videoRect.right < 0 || 
                videoRect.top > window.innerHeight || 
                videoRect.left > window.innerWidth) {
                this.container.style.display = 'none';
                return;
            }
            
            // 사용자가 직접 위치를 지정한 경우
            if (this.settings.position === 'custom' && this.settings.customPosition) {
                this.container.style.left = `${this.settings.customPosition.x}px`;
                this.container.style.top = `${this.settings.customPosition.y}px`;
                this.container.style.transform = 'none';
                return;
            }
            
            // 컨테이너 스타일 초기화
            this.container.style.position = 'fixed';
            this.container.style.transform = 'translate(-50%, 0)';
            this.container.style.maxWidth = `${videoRect.width * 0.9}px`; // 비디오 너비의 90%로 제한
            
            // 비디오의 중앙 하단 위치 계산
            const centerX = videoRect.left + (videoRect.width / 2);
            
            // 위치에 따라 top 값 설정
            switch (this.settings.position) {
                case 'top':
                    this.container.style.top = `${videoRect.top + 20}px`;
                    break;
                case 'middle':
                    this.container.style.top = `${videoRect.top + (videoRect.height / 2) - (containerRect.height / 2)}px`;
                    break;
                case 'bottom':
                default:
                    // 비디오의 하단 근처로 위치
                    const bottomMargin = Math.min(videoRect.height * 0.1, 50); // 비디오 높이의 10% 또는 최대 50px
                    this.container.style.top = `${videoRect.bottom - containerRect.height - bottomMargin}px`;
                    break;
            }
            
            // 일관되게 중앙 정렬
            this.container.style.left = `${centerX}px`;
            
            // 전체화면 또는 큰 비디오의 경우 폰트 크기 및 패딩 조정
            const isLargeVideo = videoRect.width > window.innerWidth * 0.7 || 
                                document.fullscreenElement === videoElement.closest('div');
            
            if (isLargeVideo) {
                this.container.classList.add('large-video-mode');
            } else {
                this.container.classList.remove('large-video-mode');
            }
            
            // YouTube 특화 처리
            if (state.websiteType === 'youtube') {
                // YouTube 컨트롤 바와 겹치지 않도록 추가 마진
                if (this.settings.position === 'bottom') {
                    const ytpControlsHeight = document.querySelector('.ytp-chrome-bottom')?.offsetHeight || 40;
                    this.container.style.top = `${videoRect.bottom - containerRect.height - ytpControlsHeight - 10}px`;
                }
            }
        }

        // 자막 위치 재설정
        resetPosition() {
            // 사용자 설정 위치 플래그 제거
            delete this.container.dataset.userPositioned;
            
            // transform 초기화
            this.container.style.transform = 'translateX(-50%)';
            
            // 위치 다시 계산
            this.positionRelativeToVideo();
        }

        setVisibility(visible) {
            if (this.container.style.display === (visible ? 'block' : 'none')) return;
            
            this.container.style.display = visible ? 'block' : 'none';
            
            // 표시될 때 위치 재조정 (사용자가 직접 위치 지정한 경우 제외)
            if (visible && !this.container.dataset.userPositioned) {
                this.positionRelativeToVideo();
            }
        }

        updateText(original, translated = '') {
            if (!this.container) return;
            
            // 원본 자막이 없는 경우 빈 문자열로 설정
            original = original || '';
            translated = translated || '';
            
            // 자막이 없으면 빈 칸으로 표시
            if (!original && !translated) {
                this.originalSubtitleElement.textContent = '';
                this.translatedSubtitleElement.textContent = '';
                
                // 자막이 없을 때 애니메이션 적용
                this.originalSubtitleElement.classList.remove('subtitle-fade-in');
                this.translatedSubtitleElement.classList.remove('subtitle-fade-in');
                return;
            }
            
            // 너무 긴 자막 처리 (한 번에 표시할 수 있는 최대 길이 제한)
            const maxLength = 100; // 최대 문자 수
            if (original.length > maxLength) {
                original = original.substring(0, maxLength) + '...';
            }
            
            if (translated.length > maxLength) {
                translated = translated.substring(0, maxLength) + '...';
            }
            
            // 자막 업데이트
            if (this.originalSubtitleElement.textContent !== original) {
                this.originalSubtitleElement.textContent = original;
                this.originalSubtitleElement.classList.remove('subtitle-fade-in');
                void this.originalSubtitleElement.offsetWidth; // 리플로우 강제
                this.originalSubtitleElement.classList.add('subtitle-fade-in');
            }
            
            // 번역 자막이 있을 경우에만 표시
            if (this.settings.dualSubtitles && translated) {
                this.translatedSubtitleElement.style.display = 'block';
                
                if (this.translatedSubtitleElement.textContent !== translated) {
                    this.translatedSubtitleElement.textContent = translated;
                    this.translatedSubtitleElement.classList.remove('subtitle-fade-in');
                    void this.translatedSubtitleElement.offsetWidth; // 리플로우 강제
                    this.translatedSubtitleElement.classList.add('subtitle-fade-in');
                }
            } else {
                this.translatedSubtitleElement.style.display = 'none';
            }
            
            // 자막이 업데이트되면 위치도 다시 계산
            if (this.settings.position !== 'custom') {
                this.positionRelativeToVideo();
            }
        }

        // 설정 업데이트
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this.applySettings();
            this.saveSettings();
        }

        // 정리
        cleanup() {
            if (this.container) {
                // 이벤트 리스너 제거
                window.removeEventListener('resize', () => {
                    if (this.settings.position !== 'custom') {
                        this.positionRelativeToVideo();
                    }
                });
                
                // ResizeObserver 정리
                if (this.resizeObserver && state.currentVideoElement) {
                    this.resizeObserver.unobserve(state.currentVideoElement);
                    this.resizeObserver.disconnect();
                }
                
                // DOM에서 제거
                document.body.removeChild(this.container);
                this.container = null;
                this.originalSubtitleElement = null;
                this.translatedSubtitleElement = null;
            }
        }
    }

    // 자막 표시/숨김 토글
    async function toggleSubtitleService() {
        if (state.isRecognizing) {
            await stopSubtitleService();
        } else {
            await startSubtitleService();
        }
    }

    // 상태 표시 서비스
    class StatusIndicator {
        constructor() {
            this.container = null;
            this.messageElement = null;
            this.timerHandle = null;
            this.visible = false;
        }

        async initialize() {
            try {
                this.createContainer();
            return true;
        } catch (error) {
                console.error('상태 표시기 초기화 실패:', error);
            return false;
        }
    }

        createContainer() {
            // 기존 컨테이너 제거
            if (this.container) {
                document.body.removeChild(this.container);
            }
            
            // 상태 표시 컨테이너 생성
            const container = document.createElement('div');
            container.id = 'whatsub-status';
            container.style.display = 'none';
            
            // 메시지 요소
            const messageElement = document.createElement('div');
            messageElement.className = 'whatsub-status-message';
            container.appendChild(messageElement);
            
            // body에 추가
            document.body.appendChild(container);
            
            this.container = container;
            this.messageElement = messageElement;
        }

        updateStatus(message, type = 'info', duration = 3000) {
            if (!this.container || !this.messageElement) {
                this.createContainer();
            }
            
            // 기존 타이머 제거
            if (this.timerHandle) {
                clearTimeout(this.timerHandle);
                this.timerHandle = null;
            }
            
            // 메시지 및 타입 설정
            this.messageElement.textContent = message;
            this.container.className = `whatsub-status ${type}`;
            
            // 요소 표시
            this.container.style.display = 'block';
            this.visible = true;
            
            // 자동 숨김 타이머 설정
            this.timerHandle = setTimeout(() => {
                this.hideStatus();
            }, duration);
        }

        hideStatus() {
            if (!this.container) return;
            
            this.container.style.display = 'none';
            this.visible = false;
            
            if (this.timerHandle) {
                clearTimeout(this.timerHandle);
                this.timerHandle = null;
            }
        }
    }

    // 오디오 캡처 서비스
    class AudioCaptureService {
        constructor() {
            this.audioContext = null;
            this.audioStream = null;
            this.mediaStreamSource = null;
            this.processorNode = null;
            this.analyserNode = null;
            this.isRecording = false;
            this.audioData = [];
            this.noiseReduction = true;
            this.lastError = null;
            this.lastErrorMessage = '';
            this.audioProcessInterval = null;
            this.processingTimestamp = 0;
            this.logger = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
            };
            
            // 오디오 타임스탬프 저장 옵션 (디버깅에 유용)
            this.saveTimestamps = false;
            this.timestamps = [];
            
            // 향후 회의록 기능을 위한 전체 오디오 버퍼
            this.fullAudioBuffer = [];
            
            // 레코딩 품질 설정
            this.recordingConfig = {
                sampleRate: 16000,
                channelCount: 1,
                frameSize: 4096,
                processingInterval: 1000 // ms
            };
        }

        async initialize() {
            try {
                console.log('AudioCaptureService 초기화 중...');
                return true;
            } catch (error) {
                console.error('AudioCaptureService 초기화 실패:', error);
                this.lastErrorMessage = error.message;
                return false;
            }
        }

        async startCapture() {
            try {
                if (this.isRecording) {
                    console.log('이미 오디오 캡처 중입니다.');
                    return true;
                }
                
                // 오디오 스트림 가져오기
                this.audioStream = await this.getCaptureStream();
                
                if (!this.audioStream) {
                    console.error('오디오 스트림을 가져올 수 없습니다.');
                    this.lastErrorMessage = '오디오 스트림 캡처 실패';
                    return false;
                }
                
                // 오디오 컨텍스트 생성
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                // 미디어 스트림 소스 생성
                this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.audioStream);
                
                // 오디오 처리 설정
                await this.setupAudioProcessing();
                
                // 캡처 상태 업데이트
                this.isRecording = true;
                this.audioData = [];
                this.timestamps = [];
                this.processingTimestamp = Date.now();
                
                console.log('오디오 캡처 시작됨');
                return true;
            } catch (error) {
                console.error('오디오 캡처 시작 중 오류:', error);
                this.lastErrorMessage = error.message;
                return false;
            }
        }

        async getCaptureStream() {
            try {
                // tabCapture API를 사용하여 탭 오디오 캡처 시도
                if (chrome.tabCapture && navigator.userAgent.toLowerCase().includes('chrome')) {
                    return new Promise((resolve, reject) => {
                        chrome.tabCapture.capture(
                            { audio: true, video: false },
                            stream => {
                                if (chrome.runtime.lastError) {
                                    console.warn('tabCapture API 오류:', chrome.runtime.lastError);
                                    // 일반 getUserMedia로 폴백
                                    this.getUserMediaStream().then(resolve).catch(reject);
                                } else if (stream) {
                                    resolve(stream);
                                } else {
                                    console.warn('tabCapture API가 스트림을 반환하지 않음');
                                    // 일반 getUserMedia로 폴백
                                    this.getUserMediaStream().then(resolve).catch(reject);
                                }
                            }
                        );
                    });
                } else {
                    // 표준 getUserMedia API 사용
                    return await this.getUserMediaStream();
                }
            } catch (error) {
                console.error('오디오 캡처 스트림 획득 중 오류:', error);
                throw error;
            }
        }

        async getUserMediaStream() {
            try {
                // 시스템 오디오 캡처 제약 조건
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1,
                        sampleRate: this.recordingConfig.sampleRate
                    },
                    video: false
                };
                
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                console.error('getUserMedia 오류:', error);
                this.lastErrorMessage = '마이크 접근 권한을 확인하세요';
                throw error;
            }
        }

        async setupAudioProcessing() {
            try {
                // 브라우저가 AudioWorklet을 지원하고 노이즈 감소가 활성화된 경우
                if (this.audioContext.audioWorklet && this.noiseReduction) {
                    console.log('AudioCaptureService: AudioWorklet 지원됨, 노이즈 감소 설정 시도');
                    
                    try {
                        // AudioWorklet 프로세서 로드
                        const processorPath = chrome.runtime.getURL('audio-worklet/noise-suppressor-processor.js');
                        await this.audioContext.audioWorklet.addModule(processorPath);
                        
                        // 노이즈 감소 워크렛 생성
                        this.processorNode = new AudioWorkletNode(this.audioContext, 'noise-suppressor-processor');
                        
                        // 메시지 핸들러 설정
                        this.processorNode.port.onmessage = (event) => {
                            if (event.data.type === 'audio') {
                                // 노이즈가 감소된 오디오 데이터 처리
                                this.handleAudioData(event.data.audioData);
                            } else if (event.data.type === 'error') {
                                console.error('AudioWorklet 오류:', event.data.message);
                            }
                        };
                        
                        // 오디오 노드 연결
                        this.mediaStreamSource.connect(this.processorNode);
                        this.processorNode.connect(this.audioContext.destination);
                        
                        console.log('AudioCaptureService: AudioWorklet 설정 완료');
                        return true;
                    } catch (workletError) {
                        console.warn('AudioWorklet 설정 실패:', workletError);
                        console.log('AudioCaptureService: AnalyserNode로 폴백');
                        return this.setupWithAnalyserNode();
                    }
                } else {
                    // AudioWorklet이 지원되지 않거나 노이즈 감소가 비활성화된 경우
                    console.log('AudioCaptureService: AudioWorklet을 사용할 수 없거나 노이즈 감소가 비활성화됨');
                    return this.setupWithAnalyserNode();
                }
            } catch (error) {
                console.error('AudioCaptureService: 오디오 처리 설정 중 오류:', error);
                return false;
            }
        }

        // AnalyserNode를 사용한 대체 처리 방법
        setupWithAnalyserNode() {
            console.log('AudioCaptureService: AnalyserNode로 설정');
            
            try {
                // AnalyserNode 생성
                this.analyserNode = this.audioContext.createAnalyser();
                this.analyserNode.fftSize = 2048;
                
                // 데이터 버퍼 생성
                const bufferLength = this.analyserNode.frequencyBinCount;
                this.audioDataArray = new Float32Array(bufferLength);
                
                // 미디어 소스를 분석기에 연결
                this.mediaStreamSource.connect(this.analyserNode);
                
                // 주기적으로 오디오 데이터 처리
                this.audioProcessInterval = setInterval(() => {
                    if (this.isRecording) {
                        this.analyserNode.getFloatTimeDomainData(this.audioDataArray);
                        // 오디오 데이터 처리 (데이터를 Float32Array에서 복사)
                        const audioData = new Float32Array(this.audioDataArray);
                        this.handleAudioData(audioData);
                    }
                }, 100); // 100ms마다 처리
                
                console.log('AudioCaptureService: AnalyserNode 설정 완료');
                return true;
            } catch (error) {
                console.error('AudioCaptureService: AnalyserNode 설정 중 오류:', error);
                return this.setupWithScriptProcessor(); // 레거시 방식으로 폴백
            }
        }

        // 레거시 ScriptProcessorNode 사용 (폴백 메서드)
        setupWithScriptProcessor() {
            console.warn('AudioCaptureService: ScriptProcessorNode 사용 (deprecated) - 가능하면 브라우저를 업데이트하세요');
            
            try {
                // ScriptProcessorNode 생성 (레거시 방식)
                this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
                
                // 오디오 프로세싱 이벤트 설정
                this.processorNode.onaudioprocess = (event) => {
                    if (this.isRecording) {
                        const input = event.inputBuffer.getChannelData(0);
                        const audioData = new Float32Array(input.length);
                        audioData.set(input);
                        this.handleAudioData(audioData);
                    }
                };
                
                // 오디오 노드 연결
                this.mediaStreamSource.connect(this.processorNode);
                this.processorNode.connect(this.audioContext.destination);
                
                console.log('AudioCaptureService: ScriptProcessorNode 설정 완료');
                return true;
            } catch (error) {
                console.error('AudioCaptureService: ScriptProcessorNode 설정 중 오류:', error);
                return false;
            }
        }

        /**
         * 오디오 데이터 처리
         * - 오디오 버퍼를 처리하고 저장
         */
        handleAudioData(audioBuffer) {
            if (!this.isRecording) return;
            
            try {
                // 타임스탬프 저장 (필요한 경우)
                if (this.saveTimestamps) {
                    this.timestamps.push(Date.now());
                }
                
                // 오디오 데이터 저장
                this.audioData.push(audioBuffer);
                this.fullAudioBuffer.push(audioBuffer);
                
                // 일정 간격으로 처리
                const now = Date.now();
                const elapsed = now - this.processingTimestamp;
                
                if (elapsed >= this.recordingConfig.processingInterval) {
                    this.processingTimestamp = now;
                    this.processAudioChunk();
                }
            } catch (error) {
                this.logger.error('오디오 데이터 처리 오류:', error);
            }
        }

        /**
         * 오디오 청크 처리
         * - 일정 양의 오디오 데이터를 모아서 처리
         */
        processAudioChunk() {
            try {
                if (!this.audioData.length) return;
                
                // 누적된 오디오 데이터의 전체 길이 계산
                let totalLength = 0;
                for (const buffer of this.audioData) {
                    totalLength += buffer.length;
                }
                
                // 모든 오디오 데이터 병합
                const mergedBuffer = this.mergeBuffers(this.audioData, totalLength);
                
                // WAV로 인코딩
                const wavBuffer = this.encodeWav(mergedBuffer);
                
                // 자막 처리를 위해 오디오 전송
                this.sendAudioForSubtitles(wavBuffer);
                
                // 처리 완료 후 버퍼 비우기
                this.audioData = [];
            } catch (error) {
                this.logger.error('오디오 청크 처리 중 오류 발생:', error);
            }
        }

        /**
         * 오디오 버퍼 병합
         * - 여러 Float32Array 버퍼를 하나로 병합
         */
        mergeBuffers(bufferArray, totalLength) {
            const result = new Float32Array(totalLength);
            let offset = 0;
            
            for (const buffer of bufferArray) {
                result.set(buffer, offset);
                offset += buffer.length;
            }
            
            return result;
        }

        /**
         * Float32 오디오 데이터를 WAV로 인코딩
         * - 16비트 PCM WAV 형식으로 변환
         */
        encodeWav(samples) {
            const sampleRate = this.recordingConfig.sampleRate;
            const buffer = new ArrayBuffer(44 + samples.length * 2);
            const view = new DataView(buffer);
            
            // WAV 헤더 작성
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + samples.length * 2, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(view, 36, 'data');
            view.setUint32(40, samples.length * 2, true);
            
            // 샘플 데이터를 16비트 PCM으로 변환
            floatTo16BitPCM(view, 44, samples);
            
            return buffer;
            
            // 헬퍼 함수들
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
            
            function floatTo16BitPCM(output, offset, input) {
                for (let i = 0; i < input.length; i++, offset += 2) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }
        }

        /**
         * 자막 생성을 위해 오디오 전송
         * - 백그라운드 스크립트로 오디오 데이터 전송
         */
        sendAudioForSubtitles(audioBuffer) {
            try {
                // Blob으로 변환
                const blob = new Blob([audioBuffer], { type: 'audio/wav' });
                
                // 파일로 변환
                const audioFile = new File([blob], 'audio.wav', { type: 'audio/wav' });
                
                // 음성 인식을 위해 백그라운드로 전송
                // (FormData 대신 ArrayBuffer로 직접 전송)
                const reader = new FileReader();
                reader.onload = () => {
                    const arrayBuffer = reader.result;
                    
                    // 백그라운드 스크립트로 전송
                    chrome.runtime.sendMessage({
                        action: 'processAudio',
                        audioData: arrayBuffer,
                        format: 'wav',
                        timestamp: Date.now()
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('오디오 전송 중 오류:', chrome.runtime.lastError);
                        } else if (response && response.error) {
                            console.error('오디오 처리 오류:', response.error);
                        }
                    });
                };
                reader.readAsArrayBuffer(audioFile);
            } catch (error) {
                this.logger.error('자막 전송 처리 중 예외 발생:', error);
            }
        }

        /**
         * 오디오 캡처 중지
         * - 모든 오디오 처리 중지 및 리소스 정리
         */
        stopCapture() {
            try {
                // 캡처 상태 업데이트
                this.isRecording = false;
                
                // 마지막 오디오 청크 처리
                if (this.audioData.length > 0) {
                    this.processAudioChunk();
                }
                
                // 타이머 정리
                if (this.audioProcessInterval) {
                    clearInterval(this.audioProcessInterval);
                    this.audioProcessInterval = null;
                }
                
                // 오디오 처리 노드 정리
                if (this.processorNode) {
                    this.processorNode.disconnect();
                    this.processorNode = null;
                }
                
                if (this.analyserNode) {
                    this.analyserNode.disconnect();
                    this.analyserNode = null;
                }
                
                // 미디어 스트림 소스 정리
                if (this.mediaStreamSource) {
                    this.mediaStreamSource.disconnect();
                    this.mediaStreamSource = null;
                }
                
                // 오디오 스트림 정리
                if (this.audioStream) {
                    this.audioStream.getTracks().forEach(track => track.stop());
                    this.audioStream = null;
                }
                
                console.log('오디오 캡처 중지됨');
                return true;
            } catch (error) {
                console.error('오디오 캡처 중지 중 오류:', error);
                return false;
            }
        }

        /**
         * 설정 저장
         * - 오디오 캡처 관련 설정 저장
         */
        saveSettings() {
            try {
                // 설정 저장
                chrome.storage.local.set({
                    'audioCaptureSettings': {
                        noiseReduction: this.noiseReduction,
                        sampleRate: this.recordingConfig.sampleRate
                    }
                });
                return true;
            } catch (error) {
                this.logger.error('노이즈 감소 설정 변경 오류:', error);
                return false;
            }
        }
    }

    // 자막 서비스 중지
    async function stopSubtitleService() {
        try {
            // 실행 중이 아니면 무시
            if (!state.isRecognizing) {
                console.log('자막 서비스가 이미 중지되었습니다.');
                return;
            }
            
            // 오디오 캡처 중지
            await services.audioCapture.stopCapture();
            
            // 자막 숨김
            services.subtitleDisplay.setVisibility(false);
            
            // 상태 업데이트
            state.subtitleEnabled = false;
            state.isRecognizing = false;
            
            // 상태 저장
            chrome.storage.local.set({ subtitleEnabled: false });
            
            services.statusIndicator.updateStatus('자막 서비스가 중지되었습니다.', 'info');
            console.log('자막 서비스 중지됨');
            
        } catch (error) {
            console.error('자막 서비스 중지 오류:', error);
            services.statusIndicator.updateStatus('자막 서비스 중지 실패: ' + error.message, 'error');
        }
    }

    // 자막 서비스 토글
    async function toggleSubtitleService() {
        if (state.isRecognizing) {
            await stopSubtitleService();
        } else {
            await startSubtitleService();
        }
    }

    // 서비스 초기화 함수
    async function initializeServices() {
        try {
            console.log('[Whatsub] 서비스 초기화 중...');
            
            // 이미 초기화된 경우 재사용
            if (state.servicesInitialized) {
                console.log('[Whatsub] 서비스가 이미 초기화되어 있습니다.');
                return true;
            }
            
            // 디버그 로거 초기화
            services.debugLogger = new DebugLogger();
            
            // 상태 표시기 초기화
            services.statusIndicator = new StatusIndicator();
            
            // 비디오 감지기 초기화
            services.videoDetector = new VideoDetector();
            await services.videoDetector.initialize();
            
            // 자막 디스플레이 초기화
            services.subtitleDisplay = new SubtitleDisplay();
            await services.subtitleDisplay.initialize();
            
            // 오디오 캡처 초기화
            services.audioCapture = new AudioCaptureService();
            
            // 초기화 완료 표시
            state.servicesInitialized = true;
            console.log('[Whatsub] 모든 서비스 초기화 완료');
            
            return true;
        } catch (error) {
            console.error('[Whatsub] 서비스 초기화 실패:', error);
            return false;
        }
    }

    // 설정 로드
    async function loadSettings() {
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get(['subtitleEnabled', 'sourceLanguage', 'targetLanguage', 'syncValue'], (data) => {
                    // 자막 활성화 설정
                    if (data.subtitleEnabled !== undefined) {
                        state.subtitleEnabled = data.subtitleEnabled;
                    }
                    
                    // 언어 및 동기화 설정
                    state.settings = {
                        sourceLanguage: data.sourceLanguage || 'auto',
                        targetLanguage: data.targetLanguage || 'ko',
                        syncValue: data.syncValue || 0,
                        ...state.settings
                    };
                    
                    console.log('[Whatsub] 설정 로드 완료:', state.settings);
                    resolve(true);
                });
            });
        } catch (error) {
            console.error('[Whatsub] 설정 로드 오류:', error);
            return false;
        }
    }

    // 자막 서비스 시작
    async function startSubtitleService() {
        try {
            // 이미 실행 중이면 무시
            if (state.isRecognizing) {
                console.log('자막 서비스가 이미 실행 중입니다.');
                return;
            }
            
            // 서비스 초기화 여부 확인
            if (!state.servicesInitialized) {
                await initializeServices();
            }
            
            // 비디오 요소 확인
            if (!state.currentVideoElement) {
                services.statusIndicator.updateStatus('비디오를 찾을 수 없습니다.', 'error');
                return;
            }
            
            // 오디오 캡처 시작
            const captureStarted = await services.audioCapture.startCapture();
            
            if (!captureStarted) {
                services.statusIndicator.updateStatus(
                    '오디오 캡처 시작 실패: ' + (services.audioCapture.lastErrorMessage || '알 수 없는 오류'),
                    'error'
                );
                return;
            }
            
            // 상태 업데이트
            state.subtitleEnabled = true;
            state.isRecognizing = true;
            
            // 상태 저장
            chrome.storage.local.set({ subtitleEnabled: true });
            
            // 자막 표시
            services.subtitleDisplay.setVisibility(true);
            
            services.statusIndicator.updateStatus('자막 서비스가 시작되었습니다.', 'success');
            console.log('자막 서비스 시작됨');
            
        } catch (error) {
            console.error('자막 서비스 시작 오류:', error);
            services.statusIndicator.updateStatus('자막 서비스 시작 실패: ' + error.message, 'error');
        }
    }

    // 페이지 로드 완료 시 초기화
    function initialize() {
        try {
            console.log('[Whatsub] DOM 준비 완료, 서비스 초기화 시작');
            
            // DOM이 로드되면 서비스 초기화
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                // 서비스 초기화
                initializeServices().then(() => {
                    // 설정 로드
                    loadSettings().then(() => {
                        // 키보드 단축키 이벤트 리스너 설정
                        document.addEventListener('keydown', (event) => {
                            // Alt+S: 자막 토글
                            if (event.altKey && event.code === 'KeyS') {
                                event.preventDefault();
                                toggleSubtitleService();
                            }
                            
                            // Alt+R: 자막 위치 초기화
                            if (event.altKey && event.code === 'KeyR') {
                                event.preventDefault();
                                if (services.subtitleDisplay) {
                                    services.subtitleDisplay.resetPosition();
                                }
                            }
                        });
                    });
                });
            } else {
                // DOM이 아직 로드되지 않은 경우 이벤트 리스너 등록
                document.addEventListener('DOMContentLoaded', () => {
                    initialize();
                });
            }
        } catch (error) {
            console.error('DOM 준비 핸들러 오류:', error);
        }
    }

    // 초기화 실행
    initialize();

    // 로그 수집 기능 추가
    function sendLogToBackground(level, message, details = null) {
        try {
            chrome.runtime.sendMessage({
                action: 'logEvent',
                level,
                message,
                details: details ? JSON.stringify(details) : null,
                source: 'content',
                url: window.location.href
            }).catch(error => {
                console.error('[Whatsub] 로그 전송 실패:', error);
            });
        } catch (error) {
            console.error('[Whatsub] 로그 전송 중 오류:', error);
        }
    }

    // 로그 레벨별 함수
    function logError(message, details = null) {
        console.error(`[Whatsub] ${message}`, details || '');
        sendLogToBackground('error', message, details);
    }

    function logWarning(message, details = null) {
        console.warn(`[Whatsub] ${message}`, details || '');
        sendLogToBackground('warn', message, details);
    }

    function logInfo(message, details = null) {
        console.info(`[Whatsub] ${message}`, details || '');
        sendLogToBackground('info', message, details);
    }

    function logDebug(message, details = null) {
        console.log(`[Whatsub] ${message}`, details || '');
        sendLogToBackground('debug', message, details);
    }
})();

// 기본 content script
console.log('Content script loaded');