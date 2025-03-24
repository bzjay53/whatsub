// IIFE를 사용하여 전역 네임스페이스 오염 방지
(async function() {
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
                    playerSelector: '.html5-video-player video'
                },
                'netflix': {
                    domain: 'netflix.com',
                    playerSelector: '.VideoContainer video'
                },
                'vimeo': {
                    domain: 'vimeo.com',
                    playerSelector: '.vp-video video'
                },
                'generic': {
                    domain: '*',
                    playerSelector: 'video'
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
            
            if (hostname.includes('youtube.com')) {
                state.websiteType = 'youtube';
            } else if (hostname.includes('netflix.com')) {
                state.websiteType = 'netflix';
            } else if (hostname.includes('vimeo.com')) {
                state.websiteType = 'vimeo';
            } else {
                state.websiteType = 'generic';
            }
            
            console.log(`웹사이트 유형 감지: ${state.websiteType}`);
            return state.websiteType;
        }

        detectVideos() {
            const siteType = state.websiteType;
            const config = this.knownVideoServices[siteType] || this.knownVideoServices.generic;
            
            // 사이트 특화 선택자로 먼저 시도
            let videos = Array.from(document.querySelectorAll(config.playerSelector));
            
            // 특화 선택자로 찾지 못했다면 일반 video 태그 탐색
            if (videos.length === 0) {
                videos = Array.from(document.querySelectorAll('video'));
            }
            
            // iframe 내부의 비디오 처리 (가능한 경우)
            if (videos.length === 0) {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        // 동일 출처 정책으로 인해 접근이 제한될 수 있음
                        const iframeVideos = iframe.contentDocument?.querySelectorAll('video');
                        if (iframeVideos && iframeVideos.length > 0) {
                            videos = [...videos, ...Array.from(iframeVideos)];
                        }
                    } catch (e) {
                        // 크로스 도메인 iframe 접근 오류는 무시
                    }
                });
            }
            
            console.log(`발견된 비디오 요소: ${videos.length}개`);
            state.videoElements = videos;
            
            // 첫 번째 비디오를 현재 비디오로 설정
            if (videos.length > 0 && !state.currentVideoElement) {
                state.currentVideoElement = videos[0];
                console.log('현재 비디오 요소 설정:', state.currentVideoElement);
                
                // 비디오가 재생 중일 때 이벤트 리스너 추가
                state.currentVideoElement.addEventListener('play', () => {
                    if (state.subtitleEnabled && !state.isRecognizing) {
                        startSubtitleService();
                    }
                });
                
                // 비디오가 정지할 때 이벤트 리스너 추가
                state.currentVideoElement.addEventListener('pause', () => {
                    if (state.isRecognizing) {
                        stopSubtitleService();
                    }
                });
            }
            
            return videos;
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
                    state.currentVideoElement.removeEventListener('play', () => {});
                    state.currentVideoElement.removeEventListener('pause', () => {});
                }
                
                state.currentVideoElement = state.videoElements[index];
                
                // 새 이벤트 리스너 추가
                state.currentVideoElement.addEventListener('play', () => {
                    if (state.subtitleEnabled && !state.isRecognizing) {
                        startSubtitleService();
                    }
                });
                
                state.currentVideoElement.addEventListener('pause', () => {
                    if (state.isRecognizing) {
                        stopSubtitleService();
                    }
                });
                
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
            if (services.videoDetector && services.videoDetector.currentVideoElement) {
                this.setupVideoObserver(services.videoDetector.currentVideoElement);
                this.positionRelativeToVideo();
                
                // 비디오 크기 변경 감지
                if (this.resizeObserver) this.resizeObserver.disconnect();
                this.resizeObserver = new ResizeObserver(() => {
                    if (this.settings.position !== 'custom') {
                        this.positionRelativeToVideo();
                    }
                });
                this.resizeObserver.observe(services.videoDetector.currentVideoElement);
            }
            
            // 창 크기 변경 감지
            window.addEventListener('resize', () => {
                if (this.settings.position !== 'custom') {
                    this.positionRelativeToVideo();
                }
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
            if (!this.container || !services.videoDetector.currentVideoElement) return;
            
            const video = services.videoDetector.currentVideoElement;
            const videoRect = video.getBoundingClientRect();
            
            // 비디오가 화면에 보이지 않으면 처리하지 않음
            if (videoRect.width === 0 || videoRect.height === 0) return;
            
            // 비디오의 절대 위치 계산 (스크롤 포함)
            const absoluteVideoLeft = videoRect.left + window.scrollX;
            const absoluteVideoTop = videoRect.top + window.scrollY;
            
            // 위치 계산 (사용자 위치 설정이 없는 경우에만)
            if (!this.container.dataset.userPositioned) {
                // 컨테이너 크기 초기화 (정확한 크기 계산을 위해)
                this.container.style.maxWidth = '50%';
                
                // 자막 컨테이너 크기 가져오기
                const containerWidth = Math.min(videoRect.width * 0.8, 500);
                
                // 비디오 중앙에 자막 위치시키기
                const centerX = absoluteVideoLeft + (videoRect.width / 2);
                
                // 위치 설정에 따라 자막 Y 위치 결정
                let topPosition;
                switch (this.settings.position) {
                    case 'top':
                        topPosition = absoluteVideoTop + 20; // 비디오 상단에서 20px 아래
                        break;
                    case 'middle':
                        topPosition = absoluteVideoTop + (videoRect.height / 2) - 50;
                        break;
                    case 'bottom':
                    default:
                        topPosition = absoluteVideoTop + videoRect.height - 80;
                        break;
                }
                
                // 자막이 화면 밖으로 나가지 않도록 조정
                if (topPosition < 0) topPosition = 0;
                
                // 스타일 적용
                this.container.style.left = '50%';
                this.container.style.top = `${topPosition}px`;
                this.container.style.width = `${containerWidth}px`;
                this.container.style.transform = 'translateX(-50%)';
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
            if (!this.originalSubtitleElement || !this.translatedSubtitleElement) return;
            
            if (original !== this.originalSubtitleElement.textContent) {
                this.originalSubtitleElement.textContent = original || '';
            }
            
            if (translated !== this.translatedSubtitleElement.textContent) {
                this.translatedSubtitleElement.textContent = translated || '';
            }
            
            // 자막이 업데이트되면 보이게 설정
            if ((original || translated) && !this.container.style.display) {
                this.setVisibility(true);
            } else if (!original && !translated && this.container.style.display) {
                this.setVisibility(false);
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
                if (this.resizeObserver && services.videoDetector.currentVideoElement) {
                    this.resizeObserver.unobserve(services.videoDetector.currentVideoElement);
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
            // 오디오 캡처 서비스 속성 초기화
            this.isRecording = false;
            this.audioContext = null;
            this.mediaStreamSource = null;
            this.noiseReductionNode = null;
            this.analyserNode = null;
            this.scriptProcessorNode = null;
            this.audioProcessingActive = false;
            this.audioChunks = [];
            this.maxAudioChunks = 100;
            this.chunksPerProcess = 15;
            this.lastErrorMessage = null;
            
            // 설정 초기화
            this.settings = {
                noiseReduction: true,
                useWorklet: true  // AudioWorklet 사용 여부
            };
            
            // 로깅을 위한 로거 참조
            this.logger = services.debugLogger || console;
        }
        
        // 초기화 메서드
        async initialize() {
            try {
                // 설정 로드
                const data = await chrome.storage.local.get(['noiseReduction', 'useWorklet']);
                if (data.noiseReduction !== undefined) {
                    this.settings.noiseReduction = data.noiseReduction;
                }
                if (data.useWorklet !== undefined) {
                    this.settings.useWorklet = data.useWorklet;
                }
                
                this.logger.info('오디오 캡처 설정 로드: ' + JSON.stringify(this.settings));
                
                return true;
            } catch (error) {
                this.logger.error('오디오 캡처 초기화 오류:', error);
                this.lastErrorMessage = error.message;
                return false;
            }
        }
        
        // 오디오 캡처 시작
        async startCapture() {
            try {
                // 이미 녹음 중인 경우
                if (this.isRecording) {
                    this.logger.warn('이미 오디오 캡처가 진행 중입니다.');
                    return true;
                }
                
                // 사용자 미디어 액세스 요청
                const stream = await this.getCaptureStream();
                
                if (!stream) {
                    throw new Error('오디오 스트림을 가져올 수 없습니다.');
                }
                
                // 오디오 컨텍스트 생성
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'interactive',
                    sampleRate: 44100
                });
                
                // 미디어 스트림 소스 생성
                this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
                
                // 오디오 처리 설정
                const captureStarted = await this.setupAudioProcessing();
                
                if (!captureStarted) {
                    throw new Error('오디오 처리 설정 실패');
                }
                
                // 녹음 상태 업데이트
                this.isRecording = true;
                this.audioChunks = [];
                
                this.logger.info('오디오 캡처 시작됨');
                return true;
            } catch (error) {
                this.logger.error('오디오 캡처 시작 오류:', error);
                this.lastErrorMessage = error.message;
                
                // 에러 발생 시 자원 정리
                if (this.audioContext) {
                    await this.audioContext.close().catch(() => {});
                    this.audioContext = null;
                }
                this.mediaStreamSource = null;
                
                return false;
            }
        }
        
        // 최적의 캡처 방법 결정 및 스트림 획득
        async getCaptureStream() {
            try {
                // 방법 1: 탭 캡처 시도 (크롬 확장 프로그램 전용)
                if (chrome.tabCapture) {
                    try {
                        const tabStream = await new Promise((resolve) => {
                            chrome.runtime.sendMessage({ action: 'startTabCapture' }, (response) => {
                                if (response && response.success && response.stream) {
                                    resolve(response.stream);
                                } else {
                                    this.logger.warn('탭 캡처 실패:', response?.error);
                                    resolve(null);
                                }
                            });
                        });
                        
                        if (tabStream) {
                            this.logger.info('탭 캡처 방식으로 오디오 스트림 획득');
                            return tabStream;
                        }
                    } catch (tabError) {
                        this.logger.warn('탭 캡처 오류:', tabError);
                    }
                }
                
                // 방법 2: 미디어 요소에서 직접 캡처 시도
                if (state.currentVideoElement) {
                    try {
                        const mediaElement = state.currentVideoElement;
                        
                        if (mediaElement.captureStream) {
                            const mediaStream = mediaElement.captureStream();
                            if (mediaStream.getAudioTracks().length > 0) {
                                this.logger.info('미디어 요소 캡처 방식으로 오디오 스트림 획득');
                                return mediaStream;
                            }
                        }
                    } catch (mediaError) {
                        this.logger.warn('미디어 요소 캡처 오류:', mediaError);
                    }
                }
                
                // 방법 3: 마이크를 통한 캡처 (최후의 수단)
                try {
                    const userMedia = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: false
                    });
                    
                    this.logger.info('마이크 캡처 방식으로 오디오 스트림 획득');
                    return userMedia;
                } catch (micError) {
                    this.logger.error('마이크 접근 오류:', micError);
                }
                
                throw new Error('사용 가능한 오디오 캡처 방법이 없습니다.');
            } catch (error) {
                this.logger.error('오디오 스트림 획득 오류:', error);
                return null;
            }
        }
        
        /**
         * 오디오 처리 설정
         * - 오디오 캡처를 위한 처리 파이프라인 설정
         * - AudioWorklet 사용 (современный метод)
         */
        async setupAudioProcessing() {
            if (!this.mediaStreamSource || !this.audioContext) {
                console.error('AudioCaptureService: 오디오 처리를 설정할 수 없습니다 - 소스 또는 컨텍스트가 없습니다.');
                return false;
            }

            try {
                // 기존 처리 노드 정리
                if (this.processorNode) {
                    this.processorNode.disconnect();
                    this.processorNode = null;
                }

                // 노이즈 감소 설정
                const useNoiseReduction = state.settings.noiseReduction !== false;
                console.log('AudioCaptureService: 노이즈 감소 사용:', useNoiseReduction);

                // AudioWorklet을 사용한 처리 설정
                if (window.AudioWorklet && useNoiseReduction) {
                    console.log('AudioCaptureService: AudioWorklet API 사용 시도');
                    
                    // AudioWorklet이 지원되는 경우
                    const workletPath = chrome.runtime.getURL('audio-worklet/noise-reducer-processor.js');
                    
                    return this.audioContext.audioWorklet.addModule(workletPath)
                        .then(() => {
                            console.log('AudioCaptureService: 노이즈 감소 AudioWorklet 모듈 로드됨');
                            
                            // AudioWorkletNode 생성
                            this.processorNode = new AudioWorkletNode(this.audioContext, 'noise-reducer-processor', {
                                numberOfInputs: 1,
                                numberOfOutputs: 1,
                                processorOptions: {
                                    bufferSize: 4096,
                                    noiseReductionLevel: 0.2
                                }
                            });
                            
                            // 오디오 데이터 이벤트 핸들러 설정
                            this.processorNode.port.onmessage = (event) => {
                                if (event.data.audioBuffer) {
                                    this.handleAudioData(event.data.audioBuffer);
                                }
                            };
                            
                            // 오디오 노드 연결
                            this.mediaStreamSource.connect(this.processorNode);
                            this.processorNode.connect(this.audioContext.destination);
                            
                            console.log('AudioCaptureService: AudioWorklet 노드 설정 완료');
                            return true;
                        })
                        .catch(error => {
                            console.error('AudioCaptureService: AudioWorklet 로드 중 오류:', error);
                            // AudioWorklet 실패 시 AnalyserNode로 폴백
                            return this.setupWithAnalyserNode();
                        });
                } else {
                    // AudioWorklet이 지원되지 않거나 노이즈 감소가 비활성화된 경우
                    console.log('AudioCaptureService: AudioWorklet을 사용할 수 없거나 노이즈 감소가 비활성화됨');
                    return this.setupWithAnalyserNode();
                }
            } catch (error) {
                console.error('AudioCaptureService: 오디오 처리 설정 중 오류:', error);
                return false;
            }
        },

        // AnalyserNode를 사용한 대체 처리 방법 정의
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
        },

        // 레거시 ScriptProcessorNode 사용 (폴백 메서드) 정의
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
        },

        /**
         * 오디오 데이터 처리
         * - 오디오 버퍼를 처리하고 저장
         */
        handleAudioData(audioBuffer) {
            if (!this.isRecording) return;
            
            try {
                // 새로운 오디오 청크 저장
                if (!this.audioChunks) {
                    this.audioChunks = [];
                }
                
                // 데이터 복사본 저장 (원본 데이터 변경 방지)
                const bufferCopy = new Float32Array(audioBuffer.length);
                bufferCopy.set(audioBuffer);
                this.audioChunks.push(bufferCopy);
                
                // 3초마다 오디오 처리 (약 45 청크, 2048 샘플 크기 기준)
                if (this.audioChunks.length >= this.chunksPerProcess) {
                    this.processAudioChunk();
                }
            } catch (error) {
                this.logger.error('오디오 데이터 처리 오류:', error);
            }
        }

        /**
         * 오디오 청크 처리
         * - 여러 오디오 청크를 하나로 병합하고 처리
         */
        processAudioChunk() {
            try {
                if (!this.audioChunks || this.audioChunks.length === 0) {
                    this.logger.warn('처리할 오디오 청크가 없습니다');
                    return;
                }
                
                this.logger.info(`오디오 청크 처리 중 (${this.audioChunks.length} 청크)...`);
                
                // 모든 청크 병합
                const mergedBuffer = this.mergeAudioBuffers(this.audioChunks);
                
                // WAV 형식으로 인코딩
                const wavData = this.encodeWAV(mergedBuffer);
                
                // Blob으로 변환
                const audioBlob = new Blob([wavData], { type: 'audio/wav' });
                
                // 자막 처리를 위해 전송
                this.sendAudioForTranscription(audioBlob);
                
                // 청크 초기화 (모든 청크를 사용했으므로)
                this.audioChunks = [];
            } catch (error) {
                this.logger.error('오디오 청크 처리 중 오류 발생:', error);
            }
        }

        /**
         * 오디오 버퍼 병합
         * - 여러 Float32Array 버퍼를 하나의 연속된 버퍼로 병합
         */
        mergeAudioBuffers(buffers) {
            if (!buffers || buffers.length === 0) {
                return new Float32Array(0);
            }
            
            // 총 샘플 수 계산
            let totalLength = 0;
            buffers.forEach(buffer => {
                totalLength += buffer.length;
            });
            
            // 병합된 버퍼 생성
            const result = new Float32Array(totalLength);
            let offset = 0;
            
            // 모든 버퍼의 데이터를 새 버퍼로 복사
            buffers.forEach(buffer => {
                result.set(buffer, offset);
                offset += buffer.length;
            });
            
            return result;
        }

        /**
         * Float32 오디오 데이터를 WAV로 인코딩
         * - PCM 16비트 WAV 파일 형식으로 변환
         */
        encodeWAV(samples) {
            const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
            const numChannels = 1; // 모노 채널
            const bitsPerSample = 16; // 16비트 PCM
            
            // WAV 파일 헤더 크기 계산
            const headerSize = 44;
            const dataSize = samples.length * (bitsPerSample / 8);
            const buffer = new ArrayBuffer(headerSize + dataSize);
            const view = new DataView(buffer);
            
            // WAV 헤더 작성 (RIFF 형식)
            writeString(view, 0, 'RIFF'); // ChunkID
            view.setUint32(4, 36 + dataSize, true); // ChunkSize
            writeString(view, 8, 'WAVE'); // Format
            
            // fmt 서브청크
            writeString(view, 12, 'fmt '); // SubchunkID
            view.setUint32(16, 16, true); // SubchunkSize (16 for PCM)
            view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
            view.setUint16(22, numChannels, true); // NumChannels
            view.setUint32(24, sampleRate, true); // SampleRate
            view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
            view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
            view.setUint16(34, bitsPerSample, true); // BitsPerSample
            
            // 데이터 서브청크
            writeString(view, 36, 'data'); // SubchunkID
            view.setUint32(40, dataSize, true); // SubchunkSize
            
            // 오디오 데이터 쓰기 (Float32를 Int16으로 변환)
            floatTo16BitPCM(view, headerSize, samples);
            
            return buffer;
            
            // 헬퍼 함수: 문자열을 DataView에 쓰기
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
            
            // 헬퍼 함수: Float32 샘플을 16비트 PCM으로 변환
            function floatTo16BitPCM(output, offset, input) {
                for (let i = 0; i < input.length; i++, offset += 2) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }
        }

        /**
         * 자막 생성을 위해 오디오 전송
         * - 오디오 데이터를 백그라운드 스크립트로 전송하여 처리
         */
        sendAudioForTranscription(audioBlob) {
            try {
                this.logger.info(`오디오 전송 시작 (${audioBlob.size} 바이트)...`);
                
                // 현재 설정 정보 준비
                const settings = {
                    sourceLanguage: state.settings?.sourceLanguage || 'auto',
                    targetLanguage: state.settings?.targetLanguage || 'ko',
                    syncValue: state.settings?.syncValue || 0
                };
                
                // 백그라운드 스크립트로 오디오 전송
                chrome.runtime.sendMessage({
                    action: 'processAudio',
                    audio: audioBlob,
                    settings: settings
                }, (response) => {
                    // 런타임 오류 처리
                    if (chrome.runtime.lastError) {
                        this.logger.error('오디오 전송 오류:', chrome.runtime.lastError);
                        return;
                    }
                    
                    // 처리 성공 시
                    if (response && response.success) {
                        const transcription = response.transcription;
                        this.logger.info('자막 수신 성공:', transcription);
                        
                        // 자막 표시 업데이트
                        if (services.subtitleDisplay) {
                            services.subtitleDisplay.updateText(
                                transcription.original || '',
                                transcription.translated || ''
                            );
                            
                            // 자막이 안 보이는 경우 표시
                            services.subtitleDisplay.setVisibility(true);
                        }
                    } 
                    // 사용량 제한 초과 시
                    else if (response && response.limitExceeded) {
                        this.logger.warn('사용량 제한 초과:', response.error);
                        
                        // 상태 표시
                        if (services.statusIndicator) {
                            services.statusIndicator.updateStatus(
                                response.error || '무료 계정 사용량을 초과했습니다. 업그레이드가 필요합니다.',
                                'warning',
                                5000
                            );
                        }
                    } 
                    // 기타 오류
                    else {
                        this.logger.error('자막 처리 오류:', response?.error || '알 수 없는 오류');
                    }
                });
            } catch (error) {
                this.logger.error('자막 전송 처리 중 예외 발생:', error);
            }
        }

        /**
         * 오디오 캡처 중지
         * 모든 오디오 관련 리소스를 정리하고 초기화
         */
        async stopCapture() {
            try {
                this.logger.info('오디오 캡처 중지 중...');
                
                // 녹음 상태 초기화
                this.isRecording = false;
                this.audioBuffers = [];
                
                // 타이머 정리
                if (this.processingInterval) {
                    clearInterval(this.processingInterval);
                    this.processingInterval = null;
                }
                
                // AudioWorklet 노드 정리
                if (this.processorNode) {
                    this.processorNode.disconnect();
                    this.processorNode = null;
                }
                
                // AnalyserNode 정리
                if (this.analyserNode) {
                    this.analyserNode.disconnect();
                    this.analyserNode = null;
                }
                
                // 미디어 소스 정리
                if (this.mediaStreamSource) {
                    this.mediaStreamSource.disconnect();
                    this.mediaStreamSource = null;
                }
                
                // 오디오 컨텍스트 정리
                if (this.audioContext && this.audioContext.state !== 'closed') {
                    await this.audioContext.close();
                    this.audioContext = null;
                }
                
                // 미디어 스트림 트랙 정리
                if (this.stream) {
                    const tracks = this.stream.getTracks();
                    tracks.forEach(track => track.stop());
                    this.stream = null;
                }
                
                this.logger.info('오디오 캡처가 중지되었습니다');
                return true;
            } catch (error) {
                this.logger.error('오디오 캡처 중지 중 오류 발생:', error);
                return false;
            }
        }

        /**
         * 설정 저장
         * 현재 오디오 캡처 설정을 로컬 스토리지에 저장
         */
        saveSettings() {
            try {
                chrome.storage.local.set({
                    audioSettings: this.settings
                });
                this.logger.debug('오디오 설정 저장됨', this.settings);
                return true;
            } catch (error) {
                this.logger.error('오디오 설정 저장 오류:', error);
                return false;
            }
        }

        /**
         * 노이즈 감소 기능 켜기/끄기
         * 오디오 워크렛의 파라미터를 변경하여 노이즈 감소 설정을 변경합니다
         */
        toggleNoiseReduction() {
            try {
                // 설정 토글
                this.settings.noiseReduction = !this.settings.noiseReduction;
                
                // 설정 저장
                this.saveSettings();
                
                // 녹음 중이면 오디오 프로세싱 노드에 설정 변경 메시지 전송
                if (this.isRecording && this.processorNode) {
                    this.processorNode.port.postMessage({
                        command: 'setOptions',
                        options: {
                            enabled: this.settings.noiseReduction
                        }
                    });
                    
                    this.logger.info(`노이즈 감소 ${this.settings.noiseReduction ? '활성화' : '비활성화'}`);
                    return true;
                }
                
                // 녹음 중이 아니거나 워크렛 노드가 없을 경우 오디오 캡처 재시작
                if (this.isRecording) {
                    // 현재 캡처 중단
                    this.stopCapture();
                    
                    // 새 설정으로 다시 시작
                    setTimeout(() => {
                        this.startCapture();
                    }, 500);
                }
                
                this.logger.info(`노이즈 감소 설정 변경됨: ${this.settings.noiseReduction ? '활성화' : '비활성화'}`);
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