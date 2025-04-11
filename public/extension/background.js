/**
 * Whatsub 확장 프로그램 백그라운드 스크립트
 * 
 * 주요 기능:
 * 1. 인증 관리 (로그인/로그아웃)
 * 2. 오디오 캡처 및 처리
 * 3. 자막 처리 및 번역
 * 4. 사용량 추적
 * 5. 단축키 명령 처리
 */

// 디버그: 확장 프로그램 ID와 리디렉션 URI 로깅
console.log('[Whatsub] 확장 프로그램 ID:', chrome.runtime.id);
console.log('[Whatsub] OAuth 리디렉션 URI:', chrome.identity.getRedirectURL());
console.log('[Whatsub] OAuth 리디렉션 URI (oauth2 접미사 포함):', chrome.identity.getRedirectURL('oauth2'));
console.log('[Whatsub] OAuth 클라이언트 ID:', chrome.runtime.getManifest().oauth2.client_id);

// 확장 프로그램이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 초기 설정
        chrome.storage.local.set({
            subtitleEnabled: true,
            syncValue: 0,
            settings: {
                fontSize: '16px',
                fontColor: '#FFFFFF',
                backgroundColor: '#000000',
                opacity: 0.8
            },
            subtitleSettings: {
                enabled: true,
                language: 'ko',
                translationEnabled: false,
                translationLanguage: 'ko',
                fontSize: 'medium',
                backgroundColor: 'rgba(0,0,0,0.7)',
                textColor: 'white',
                outlineEnabled: false,
                position: 'bottom',
                commentEnabled: true
            }
        });
    }
});

// 단축키 명령 리스너 추가
// 의존성: manifest.json의 "commands" 섹션에 정의된 명령과 연결됨
// 관련 파일: content-script.js (toggleSubtitles, resetPosition, toggleSpeechRecognition 액션 처리)
chrome.commands.onCommand.addListener((command) => {
    console.log('[Whatsub] 단축키 명령 수신:', command);
    
    // 활성화된 탭 찾기
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.warn('[Whatsub] 활성화된 탭이 없습니다.');
            return;
        }
        
        const activeTab = tabs[0];
        
        switch (command) {
            case 'toggle-subtitles':
                // 자막 표시/숨김 토글
                // 콜백 기반 방식으로 변경 (Promise 기반 .catch() 방식 제거)
                chrome.tabs.sendMessage(
                    activeTab.id, 
                    { 
                        action: 'toggleSubtitles'
                    }, 
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('[Whatsub] 자막 토글 명령 전송 오류:', chrome.runtime.lastError);
                        }
                    }
                );
                break;
                
            case 'reset-position':
                // 자막 위치 초기화
                // 콜백 기반 방식으로 변경 (Promise 기반 .catch() 방식 제거)
                chrome.tabs.sendMessage(
                    activeTab.id, 
                    { 
                        action: 'resetPosition'
                    }, 
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('[Whatsub] 자막 위치 초기화 명령 전송 오류:', chrome.runtime.lastError);
                        }
                    }
                );
                break;
                
            case 'toggle-speech-recognition':
                // 음성 인식 시작/중지
                // 콜백 기반 방식으로 변경 (Promise 기반 .catch() 방식 제거)
                chrome.tabs.sendMessage(
                    activeTab.id, 
                    { 
                        action: 'toggleSpeechRecognition'
                    }, 
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('[Whatsub] 음성 인식 토글 명령 전송 오류:', chrome.runtime.lastError);
                        }
                    }
                );
                break;
                
            default:
                console.warn('[Whatsub] 알 수 없는 명령:', command);
        }
    });
});

// 새 탭이 열릴 때마다 자막 활성화 상태 확인
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.match(/^https?:\/\//)) {
        // 다른 확장프로그램과의 충돌 방지 위해 일부 사이트 제외
        if (tab.url.includes('chrome://') || tab.url.includes('chrome-extension://')) {
            return;
        }
        
        console.log(`[Whatsub] 탭 업데이트 감지 - URL: ${tab.url.substring(0, 50)}...`);
        
        try {
            // 인젝션 스크립트 실행 (강제 자막 표시) - 가장 먼저 실행
            injectScriptsToTab(tabId);
            
            // 자막 활성화 상태 확인 및 설정
            chrome.storage.sync.get(['subtitleEnabled'], (result) => {
                const enabled = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
                
                // 탭에 자막 활성화 상태 전송 (스크립트 주입 후 지연 실행)
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'toggleSubtitles',
                        enabled: enabled
                    }).catch(err => {
                        console.error('[Whatsub] 자막 활성화 메시지 전송 오류:', err);
                        // 오류 발생 시 다시 시도
                        setTimeout(() => injectScriptsToTab(tabId), 1000);
                    });
                    
                    // 기본 자막 텍스트 설정
                    chrome.tabs.sendMessage(tabId, {
                        action: 'updateSubtitle',
                        text: 'Whatsub 자막 서비스가 활성화되었습니다.'
                    }).catch(err => console.error('[Whatsub] 자막 텍스트 업데이트 오류:', err));
                }, 2000); // 지연 시간 늘림
            });
        } catch (error) {
            console.error('[Whatsub] Script/CSS injection error:', error);
        }
    }
});

// 스크립트 및 CSS 주입 함수 (코드 중복 제거)
function injectScriptsToTab(tabId) {
    console.log(`[Whatsub] 탭 ${tabId}에 스크립트 주입 시작`);
    
    // 1. CSS 먼저 주입
    chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['styles/content.css']
    }).then(() => {
        console.log('[Whatsub] CSS 주입 성공');
    }).catch(err => {
        console.error('[Whatsub] CSS 주입 실패:', err);
    });
    
    // 2. 콘텐츠 스크립트 주입
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content-script.js']
    }).then(() => {
        console.log('[Whatsub] 콘텐츠 스크립트 주입 성공');
        
        // 3. 인젝션 스크립트 주입 (콘텐츠 스크립트 이후)
        return chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['inject-subtitle.js']
        });
    }).then(() => {
        console.log('[Whatsub] 인젝션 스크립트 주입 성공');
    }).catch(err => {
        console.error('[Whatsub] 스크립트 주입 실패:', err);
    });
}

// 자막 API 서비스 로드 (모듈 형태로 개발할 경우 별도로 가져오기)
let subtitleApiService = null;

// 자막 API 서비스 초기화
function initializeSubtitleService() {
    // 백그라운드 스크립트에서는 모듈을 직접 가져올 수 없으므로 
    // 객체 정의를 직접 하거나, 필요한 함수들을 여기서 구현
    subtitleApiService = {
        API_BASE_URL: 'https://whatsub-api.netlify.app/api/v1',
        YOUTUBE_API_KEY: '',
        cache: new Map(),
        
        init: function() {
            // API 키 로드
            chrome.storage.local.get(['youtube_api_key'], result => {
                if (result.youtube_api_key) {
                    this.YOUTUBE_API_KEY = result.youtube_api_key;
                } else {
                    console.warn('[WhatSub] YouTube API 키가 설정되지 않았습니다.');
                    // 기본 API 키 설정 (개발용)
                    this.YOUTUBE_API_KEY = 'AIzaSyDJR3JoHCKXFNUXPK8WdHFpZ_nuT3hIcvM';
                    chrome.storage.local.set({ youtube_api_key: this.YOUTUBE_API_KEY });
                }
            });
        },
        
        // 유튜브 자막 정보 가져오기
        fetchYoutubeSubtitles: async function(videoId) {
            try {
                const cacheKey = `subtitles_${videoId}`;
                
                // 캐시에서 확인
                if (this.cache.has(cacheKey)) {
                    console.log('[WhatSub] 캐시에서 자막 정보 로드');
                    return this.cache.get(cacheKey);
                }
                
                console.log(`[WhatSub] YouTube 자막 정보 가져오기: ${videoId}`);
                
                // 유튜브 페이지에서 직접 자막 정보 가져오기 (스크래핑)
                const subtitles = await this.scrapeSubtitlesFromYoutube(videoId);
                
                // 캐시에 저장
                const result = { subtitles };
                this.cache.set(cacheKey, result);
                
                return result;
            } catch (error) {
                console.error('[WhatSub] 자막 정보 가져오기 오류:', error);
                return { subtitles: [] };
            }
        },
        
        // 유튜브 페이지에서 자막 정보 추출 (대체 방법)
        scrapeSubtitlesFromYoutube: async function(videoId) {
            try {
                console.log('[WhatSub] YouTube 페이지에서 자막 정보 스크래핑 시도');
                
                // 동영상 정보 페이지 요청
                const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
                if (!response.ok) {
                    console.error(`[WhatSub] YouTube 페이지 요청 실패: ${response.status}`);
                    return [];
                }
                
                const html = await response.text();
                
                // 자막 정보 추출 (정규식 패턴)
                const pattern = /"captionTracks":\[(.*?)\]/;
                const match = html.match(pattern);
                
                if (!match || !match[1]) {
                    console.warn('[WhatSub] 자막 정보를 찾을 수 없습니다.');
                    return [];
                }
                
                // JSON 형식으로 파싱
                const captionTracksJson = `[${match[1]}]`;
                const captionTracks = JSON.parse(captionTracksJson);
                
                return captionTracks.map(track => ({
                    languageCode: track.languageCode,
                    languageName: this.getLanguageName(track.languageCode),
                    url: track.baseUrl
                }));
            } catch (error) {
                console.error('[WhatSub] 자막 스크래핑 오류:', error);
                return [];
            }
        },
        
        // 언어 코드로부터 언어 이름 가져오기
        getLanguageName: function(langCode) {
            const languages = {
                'ko': '한국어',
                'en': '영어',
                'ja': '일본어',
                'zh': '중국어',
                'zh-cn': '중국어 (간체)',
                'zh-tw': '중국어 (번체)',
                'es': '스페인어',
                'fr': '프랑스어',
                'de': '독일어',
                'ru': '러시아어',
                'it': '이탈리아어',
                'pt': '포르투갈어',
                'ar': '아랍어',
                'hi': '힌디어',
                'th': '태국어',
                'vi': '베트남어'
            };
            
            return languages[langCode?.toLowerCase()] || langCode;
        },
        
        // 자막 콘텐츠 가져오기
        fetchSubtitleContent: async function(url) {
            try {
                const cacheKey = `content_${url}`;
                
                // 캐시에서 확인
                if (this.cache.has(cacheKey)) {
                    console.log('[WhatSub] 캐시에서 자막 콘텐츠 로드');
                    return this.cache.get(cacheKey);
                }
                
                console.log(`[WhatSub] 자막 콘텐츠 가져오기: ${url}`);
                
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`[WhatSub] 자막 콘텐츠 요청 실패: ${response.status}`);
                    return null;
                }
                
                const content = await response.text();
                
                // 캐시에 저장
                this.cache.set(cacheKey, content);
                
                return content;
            } catch (error) {
                console.error('[WhatSub] 자막 콘텐츠 요청 오류:', error);
                return null;
            }
        }
    };
    
    // 초기화
    subtitleApiService.init();
}

// 초기화 실행
initializeSubtitleService();

// 자막 관련 메시지 처리
async function handleSubtitleMessages(request, sender, sendResponse) {
    switch (request.action) {
        case 'fetchSubtitles':
            if (!request.videoId) {
                sendResponse({ success: false, error: '비디오 ID가 없습니다.' });
                return;
            }
            
            try {
                const result = await subtitleApiService.fetchYoutubeSubtitles(request.videoId);
                sendResponse({ success: true, data: result });
            } catch (error) {
                console.error('[WhatSub] 자막 가져오기 오류:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
            
        case 'fetchSubtitleContent':
            if (!request.url) {
                sendResponse({ success: false, error: '자막 URL이 없습니다.' });
                return;
            }
            
            try {
                const content = await subtitleApiService.fetchSubtitleContent(request.url);
                sendResponse({ success: true, data: content });
            } catch (error) {
                console.error('[WhatSub] 자막 콘텐츠 가져오기 오류:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
            
        case 'updateSubtitle':
            // 활성 탭에만 자막 업데이트 메시지 전송
            // 의존성: content-script.js의 updateSubtitle 액션 핸들러에 의존
            // 관련 기능: 자막 텍스트 업데이트, 자막 컨테이너 표시
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(
                        tabs[0].id, 
                        {
                            action: 'updateSubtitle',
                            text: request.text
                        },
                        function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('[WhatSub] 자막 업데이트 메시지 전송 오류:', chrome.runtime.lastError);
                            }
                        }
                    );
                }
            });
            sendResponse({ success: true });
            break;
            
        case 'getAvailableLanguages':
            // 현재 비디오의 사용 가능한 언어 목록 반환
            // 실제로는 현재 활성 탭의 content script에서 관리하므로 여기서는 더미 데이터 반환
            sendResponse({
                success: true,
                languages: [
                    { code: 'ko', name: '한국어' },
                    { code: 'en', name: '영어' },
                    { code: 'ja', name: '일본어' },
                    { code: 'zh-CN', name: '중국어 (간체)' }
                ],
                selectedLanguage: 'ko'
            });
            break;
            
        case 'setLanguage':
            // 선택한 언어 정보 저장
            chrome.storage.local.get(['subtitleSettings'], (result) => {
                const settings = result.subtitleSettings || {};
                settings.language = request.languageCode;
                settings.translationEnabled = false;
                
                chrome.storage.local.set({ subtitleSettings: settings }, () => {
                    sendResponse({ success: true });
                });
            });
            return true; // 비동기 응답을 위해 true 반환
            
        case 'setTranslation':
            // 번역 설정 저장
            chrome.storage.local.get(['subtitleSettings'], (result) => {
                const settings = result.subtitleSettings || {};
                settings.translationEnabled = request.enabled;
                settings.translationLanguage = request.languageCode;
                
                chrome.storage.local.set({ subtitleSettings: settings }, () => {
                    sendResponse({ success: true });
                });
            });
            return true; // 비동기 응답을 위해 true 반환
            
        case 'toggleCaptions':
            // 자막 표시 상태 토글
            chrome.storage.local.get(['subtitleSettings'], (result) => {
                const settings = result.subtitleSettings || {};
                settings.enabled = request.enabled;
                
                chrome.storage.local.set({ subtitleSettings: settings }, () => {
                    sendResponse({ success: true });
                });
            });
            return true; // 비동기 응답을 위해 true 반환
            
        case 'updateCaptionUI':
            // 활성 탭에 자막 UI 업데이트 알림
            // 의존성: content-script.js의 updateSettings 액션 핸들러에 의존
            // 관련 기능: 자막 표시/숨김 상태 변경, 자막 컨테이너 스타일 업데이트
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(
                        tabs[0].id, 
                        {
                            action: 'updateSettings',
                            settings: { enabled: request.enabled }
                        },
                        function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('[WhatSub] 자막 UI 업데이트 메시지 전송 오류:', chrome.runtime.lastError);
                            }
                        }
                    );
                }
            });
            sendResponse({ success: true });
            break;
            
        case 'offerSpeechRecognition':
            // 음성 인식 자막 제안
            // 팝업에 알림 표시
            // 의존성: popup.js의 showSpeechRecognitionOffer 액션 핸들러에 의존
            // 관련 기능: 사용자에게 음성 인식 자막 기능 제안 UI 표시
            chrome.runtime.sendMessage(
                {
                    action: 'showSpeechRecognitionOffer',
                    videoId: request.videoId
                },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('[WhatSub] 음성 인식 알림 메시지 전송 오류:', chrome.runtime.lastError);
                    }
                }
            );
            
            sendResponse({ success: true });
            break;
            
        case 'shareSubtitle':
            // 자막 공유 처리
            handleSubtitleSharing(request, sendResponse);
            return true; // 비동기 응답을 위해 true 반환
    }
}

// 자막 공유 처리
// 의존성: storage API, content-script.js의 addComment 액션 핸들러, popup.js의 showLoginPrompt 액션 핸들러
// 관련 파일: popup.js, content-script.js, storage 스키마
function handleSubtitleSharing(request, sendResponse) {
    // 로그인 상태 확인
    chrome.storage.local.get(['authState'], (result) => {
        const isLoggedIn = result.authState && result.authState.isLoggedIn === true;
        
        if (!isLoggedIn) {
            // 로그인되지 않은 경우 팝업 표시 요청
            // 의존성: popup.js의 showLoginPrompt 액션 핸들러에 의존
            chrome.runtime.sendMessage(
                { action: 'showLoginPrompt' },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('[WhatSub] 로그인 알림 메시지 전송 오류:', chrome.runtime.lastError);
                    }
                }
            );
            
            sendResponse({ success: false, error: '로그인이 필요합니다.' });
            return;
        }
        
        // 공유 정보 저장
        // 데이터 구조: { videoId, timestamp, comment, userId, username, sharedAt }
        const shareData = {
            videoId: request.videoId,
            timestamp: request.timestamp,
            comment: request.comment,
            userId: result.authState.userId,
            username: result.authState.username,
            sharedAt: Date.now()
        };
        
        // 일단 로컬에 저장
        // 의존성: chrome.storage.local의 'sharedSubtitles' 키 사용
        chrome.storage.local.get(['sharedSubtitles'], (data) => {
            const sharedSubtitles = data.sharedSubtitles || [];
            sharedSubtitles.push(shareData);
            
            chrome.storage.local.set({ sharedSubtitles }, () => {
                // 서버에 공유 데이터 저장 요청 (서버 구현 필요)
                // fetch(`${subtitleApiService.API_BASE_URL}/share`, {...})
                
                // 임시로 성공 응답
                sendResponse({ success: true });
                
                // 활성 탭에 댓글 추가 알림
                if (request.comment) {
                    // 의존성: content-script.js의 addComment 액션 핸들러에 의존
                    // 관련 기능: 자막 옆 댓글 표시, 댓글 목록 업데이트
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length > 0) {
                            chrome.tabs.sendMessage(
                                tabs[0].id, 
                                {
                                    action: 'addComment',
                                    text: request.comment,
                                    timestamp: request.timestamp,
                                    userId: result.authState.userId
                                },
                                function(response) {
                                    if (chrome.runtime.lastError) {
                                        console.error('[WhatSub] 댓글 추가 메시지 전송 오류:', chrome.runtime.lastError);
                                    }
                                }
                            );
                        }
                    });
                }
            });
        });
    });
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 비디오 감지 메시지 처리
    if (request.action === 'videoDetected' || 
        request.action === 'videoPlayStateChanged' || 
        request.action === 'videoTimeUpdate') {
        handleVideoMessages(request, sender, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 자막 관련 메시지 처리
    if (request.action.startsWith('fetch') || 
        request.action === 'updateSubtitle' || 
        request.action === 'getAvailableLanguages' || 
        request.action === 'setLanguage' || 
        request.action === 'setTranslation' ||
        request.action === 'toggleCaptions' ||
        request.action === 'updateCaptionUI' ||
        request.action === 'offerSpeechRecognition' ||
        request.action === 'shareSubtitle') {
        handleSubtitleMessages(request, sender, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 음성 인식 관련 메시지 처리
    if (request.action === 'startSpeechRecognition' ||
        request.action === 'stopSpeechRecognition') {
        handleSpeechRecognitionMessages(request, sender, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 자막 평가 관련 메시지 처리
    if (request.action === 'rateSubtitle') {
        handleSubtitleRating(request, sender, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 기존 기능 코드
    if (request.action === 'getSettings') {
        chrome.storage.local.get('settings', (data) => {
            sendResponse(data.settings);
        });
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 인젝션 모드 관련 메시지 처리
    if (request.action === 'injectSubtitleUI') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ success: false, error: 'TabID not found' });
            return;
        }
        
        // 인젝션 스크립트 실행
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['inject-subtitle.js']
        }).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            console.error('[Whatsub] 인젝션 스크립트 주입 실패:', err);
            sendResponse({ success: false, error: err.message });
        });
        
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 자막 직접 주입 메시지 처리
    if (request.action === 'directSubtitleUpdate') {
        const tabId = sender.tab?.id || request.tabId;
        if (!tabId) {
            sendResponse({ success: false, error: 'TabID not found' });
            return;
        }
        
        // 자막 텍스트 직접 주입
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text) => {
                if (window.whatsubInjection) {
                    window.whatsubInjection.updateSubtitleText(text);
                    return true;
                }
                return false;
            },
            args: [request.text]
        }).then((results) => {
            const success = results[0]?.result === true;
            sendResponse({ success: success });
            
            // 자막 UI가 없으면 인젝션 스크립트 실행
            if (!success) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['inject-subtitle.js']
                }).then(() => {
                    // 스크립트 로드 후 다시 텍스트 설정 시도
                    setTimeout(() => {
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: (text) => {
                                if (window.whatsubInjection) {
                                    window.whatsubInjection.updateSubtitleText(text);
                                }
                            },
                            args: [request.text]
                        });
                    }, 500);
                });
            }
        }).catch(err => {
            console.error('[Whatsub] 자막 직접 주입 오류:', err);
            sendResponse({ success: false, error: err.message });
        });
        
        return true; // 비동기 응답을 위해 true 반환
    }

    // 콘텐츠 스크립트로부터 메시지 수신 처리
    if (request.from === 'whatsub_content') {
        handleContentScriptMessage(request, sender, sendResponse);
        return true; // 비동기 응답 지원
    }
    
    // 팝업 스크립트로부터의 메시지 처리
    switch (request.action) {
        case 'testSubtitle':
            // 테스트 자막 표시 요청
            if (sender.tab && sender.tab.id) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'showSubtitle',
                    text: request.text || 'WhatsUb 자막 테스트입니다',
                    duration: request.duration || 5000,
                    from: 'whatsub_background'
                }).catch(error => {
                    console.error('[Whatsub] 자막 테스트 메시지 전송 실패:', error);
                });
            }
            break;
            
        default:
            console.log('[Whatsub] 처리되지 않은 메시지:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return false;
});

// 음성 인식 관련 상태 및 변수
let speechRecognition = null;
let isRecognizing = false;
let recognition = null;
let lastTranscriptTime = 0;
let recognitionLanguage = 'ko-KR';
let speechTranscripts = [];
let activeTabId = null;

// 음성 인식 메시지 처리
function handleSpeechRecognitionMessages(request, sender, sendResponse) {
    switch (request.action) {
        case 'startSpeechRecognition':
            startSpeechRecognition(sender.tab ? sender.tab.id : null)
                .then(result => {
                    sendResponse({ success: result });
                })
                .catch(error => {
                    console.error('[WhatSub] 음성 인식 시작 오류:', error);
                    sendResponse({ success: false, error: error.message });
                });
            break;
        
        case 'stopSpeechRecognition':
            stopSpeechRecognition();
            sendResponse({ success: true });
            break;
    }
}

// 음성 인식 시작
async function startSpeechRecognition(tabId) {
    if (isRecognizing) {
        console.log('[WhatSub] 음성 인식이 이미 실행 중입니다.');
        return true;
    }
    
    try {
        console.log('[WhatSub] 음성 인식 시작 시도...');
        
        // 활성 탭 ID 저장
        activeTabId = tabId;
        
        // 언어 설정 가져오기
        const settings = await new Promise(resolve => {
            chrome.storage.local.get(['subtitleSettings'], result => {
                resolve(result.subtitleSettings || {});
            });
        });
        
        // 인식 언어 설정
        recognitionLanguage = settings.language === 'en' ? 'en-US' : 
                              settings.language === 'ja' ? 'ja-JP' : 
                              settings.language === 'zh-CN' ? 'zh-CN' : 'ko-KR';
        
        console.log(`[WhatSub] 음성 인식 언어: ${recognitionLanguage}`);
        
        // 탭 오디오 캡처 시작
        startTabCapture(tabId);
        
        // 상태 업데이트
        isRecognizing = true;
        
        // 탭에 음성 인식 상태 알림
        notifyTabAboutTranscriptionStatus(true);
        
        return true;
    } catch (error) {
        console.error('[WhatSub] 음성 인식 시작 오류:', error);
        return false;
    }
}

// 음성 인식 중지
function stopSpeechRecognition() {
    if (!isRecognizing) return;
    
    console.log('[WhatSub] 음성 인식 중지...');
    
    // 탭 오디오 캡처 중지
    stopTabCapture();
    
    // 상태 초기화
    isRecognizing = false;
    speechTranscripts = [];
    
    // 탭에 음성 인식 상태 알림
    notifyTabAboutTranscriptionStatus(false);
}

// 탭 오디오 캡처 시작
function startTabCapture(tabId) {
    // 시험 데이터로 음성 인식 시뮬레이션 (실제 구현에서는 chrome.tabCapture API 사용)
    console.log('[WhatSub] 탭 오디오 캡처 시작 (시뮬레이션)');
    
    // 테스트를 위한 더미 자막 데이터 (다양한 상황별 자막)
    const dummyTranscripts = [
        // 일반 자막
        "안녕하세요, 이것은 자동 인식 자막입니다.",
        "WhatSub은 모든 웹페이지에서 자막을 제공합니다.",
        "이 기능은 쇼핑, 블로그, 뉴스 등 다양한 웹사이트에서 작동합니다.",
        "자막의 크기, 색상, 위치를 자유롭게 조정할 수 있습니다.",
        
        // 기술 관련 자막
        "이 프로그램은 JavaScript와 Chrome API를 사용하여 구현되었습니다.",
        "자막 인식 시스템은 머신러닝 알고리즘을 활용하여 정확도를 높였습니다.",
        "React, Vue, Angular 등 다양한 프레임워크에서도 호환됩니다.",
        "API 통합을 통해 다양한 서비스와 연동할 수 있습니다.",
        
        // 소셜 미디어 페이지 자막
        "소셜 미디어에서 동영상을 시청할 때 자막을 표시할 수 있습니다.",
        "친구들의 스토리와 라이브 방송에도 자막이 제공됩니다.",
        "댓글을 달고 좋아요를 누르면서 자막을 확인하세요.",
        "인플루언서와 크리에이터의 콘텐츠를 더 쉽게 이해할 수 있습니다.",
        
        // 학습 플랫폼 자막
        "온라인 강의와 교육 콘텐츠에 실시간 자막을 제공합니다.",
        "어려운 개념을 이해하는 데 도움이 됩니다.",
        "복잡한 과학 용어와 전문 용어를 정확하게 표시합니다.",
        "집중력을 유지하면서 중요한 내용을 놓치지 마세요.",
        
        // 쇼핑몰 페이지 자막
        "제품 설명 동영상에도 자막이 제공됩니다.",
        "상품 리뷰와 사용법 영상을 더 잘 이해할 수 있습니다.",
        "다양한 색상과 사이즈 옵션을 확인하세요.",
        "할인 정보와 이벤트 소식을 놓치지 마세요.",
        
        // 뉴스 사이트 자막
        "최신 뉴스와 시사 정보에 자막을 제공합니다.",
        "중요한 정치, 경제, 사회 소식을 더 정확하게 이해하세요.",
        "생방송 뉴스에도 실시간 자막이 표시됩니다.",
        "글로벌 이슈와 지역 소식을 동시에 확인하세요.",
        
        // 스트리밍 서비스 자막
        "영화와 드라마를 시청할 때 자막이 표시됩니다.",
        "자막 크기와 위치를 조절하여 최적의 시청 환경을 만드세요.",
        "다중 언어 지원으로 외국 콘텐츠도 쉽게 이해할 수 있습니다.",
        "좋아하는 장면을 더 생생하게 감상하세요.",
        
        // 일상 대화 자막
        "이 자막은 어떤 웹페이지에서도 작동합니다.",
        "화면에 나오는 얼굴과 표정도 인식하여 더 정확한 자막을 제공합니다.",
        "주변 소음이 있어도 정확한 음성 인식이 가능합니다.",
        "여러 명이 동시에 말해도 구분하여 자막을 표시합니다."
    ];
    
    let index = 0;
    
    // 1.5초마다 새로운 자막 전송 (더 빠르게 업데이트)
    speechRecognition = setInterval(() => {
        if (!isRecognizing) {
            clearInterval(speechRecognition);
            return;
        }
        
        const transcript = dummyTranscripts[index % dummyTranscripts.length];
        index++;
        
        // 자막 업데이트
        updateTranscription(transcript);
    }, 2500);  // 2.5초마다 업데이트 (기존 4초에서 더 빠르게)
}

// 탭 오디오 캡처 중지
function stopTabCapture() {
    if (speechRecognition) {
        clearInterval(speechRecognition);
        speechRecognition = null;
    }
}

// 자막 업데이트
function updateTranscription(text, isFinal = false) {
    if (!activeTabId) {
        console.error('[Whatsub] 활성 탭 ID가 없습니다.');
        return;
    }

    // 음성 인식 결과 전송
    chrome.tabs.sendMessage(
        activeTabId, 
        {
            action: 'updateTranscription',
            text: text,
            isFinal: isFinal,
            language: recognitionLanguage
        },
        function(response) {
            if (chrome.runtime.lastError) {
                console.error('[Whatsub] 자막 전송 중 오류 발생:', chrome.runtime.lastError);
            }
        }
    );

    // 저장
    if (isFinal && text.trim().length > 0) {
        saveTranscription(text, recognitionLanguage);
    }
}

// 음성 인식 상태 알림
function notifyTabAboutTranscriptionStatus(status, errorMessage = '') {
    if (!activeTabId) {
        console.error('[Whatsub] 활성 탭 ID가 없습니다.');
        return;
    }

    chrome.tabs.sendMessage(
        activeTabId, 
        {
            action: 'transcriptionStatusChanged',
            status: status,
            errorMessage: errorMessage
        },
        function(response) {
            if (chrome.runtime.lastError) {
                console.error('[Whatsub] 상태 업데이트 중 오류 발생:', chrome.runtime.lastError);
            }
        }
    );
}

// 자막 평가 처리
function handleSubtitleRating(request, sender, sendResponse) {
    const { type, videoId, timestamp } = request;
    
    console.log(`[WhatSub] 자막 평가: ${type}, 비디오 ID: ${videoId}, 시간: ${timestamp}`);
    
    // 로그인 상태 확인
    chrome.storage.local.get(['authState'], (result) => {
        const isLoggedIn = result.authState && result.authState.isLoggedIn === true;
        
        if (!isLoggedIn) {
            // 로그인되지 않은 경우
            sendResponse({ success: false, error: '로그인이 필요합니다.' });
            return;
        }
        
        // 평가 정보 저장
        const ratingData = {
            type,
            videoId,
            timestamp,
            userId: result.authState.userId,
            ratedAt: Date.now()
        };
        
        // 로컬에 저장
        chrome.storage.local.get(['subtitleRatings'], (data) => {
            const subtitleRatings = data.subtitleRatings || [];
            subtitleRatings.push(ratingData);
            
            chrome.storage.local.set({ subtitleRatings }, () => {
                // 서버에 평가 데이터 저장 요청 (서버 구현 필요)
                // fetch(`${subtitleApiService.API_BASE_URL}/rate`, {...})
                
                // 임시로 성공 응답
                sendResponse({ success: true });
            });
        });
    });
}

// 비디오 관련 메시지 처리
// 의존성: content-script.js의 비디오 관련 이벤트 핸들러
// 관련 파일: content-script.js, storage API
function handleVideoMessages(request, sender, sendResponse) {
    const { action, url } = request;
    const tabId = sender.tab?.id;
    
    if (!tabId) {
        console.warn('[Whatsub] 탭 ID가 없는 메시지:', action);
        return;
    }
    
    switch (action) {
        case 'videoDetected':
            console.log(`[Whatsub] 비디오 감지됨: ${request.title}`);
            // 의존성: chrome.storage.sync의, subtitleEnabled, subtitleStyle 키
            // 관련 기능: 비디오 요소 감지, 자막 컨테이너 초기화
            chrome.storage.sync.get(['subtitleEnabled', 'subtitleStyle'], function(result) {
                const enabled = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
                const style = result.subtitleStyle || {};
                
                // 자막 기능 초기화 메시지 보내기
                // 의존성: content-script.js의 initializeSubtitles 액션 핸들러
                chrome.tabs.sendMessage(
                    tabId, 
                    {
                        action: 'initializeSubtitles',
                        enabled: enabled,
                        style: style
                    },
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('[Whatsub] 자막 초기화 메시지 전송 오류:', chrome.runtime.lastError);
                        }
                    }
                );
            });
            
            sendResponse({ success: true });
            break;
            
        case 'videoPlayStateChanged':
            console.log(`[Whatsub] 비디오 재생 상태 변경: ${request.playing ? '재생' : '일시정지'}`);
            // 필요한 경우 여기서 재생 상태에 따른 처리
            sendResponse({ success: true });
            break;
            
        case 'videoTimeUpdate':
            // 타임코드에 따른 자막 업데이트 처리
            // 빈번하게 호출되므로 로그는 최소화
            
            // 임시: 재생 시간에 따른 테스트 자막 표시
            // 의존성: content-script.js의 updateSubtitle 액션 핸들러
            if (Math.floor(request.currentTime) % 10 === 0) {
                chrome.tabs.sendMessage(
                    tabId, 
                    {
                        action: 'updateSubtitle',
                        text: `테스트 자막 - ${Math.floor(request.currentTime)}초`
                    },
                    function(response) {
                        // 오류는 첫 번째만 로깅하도록 설정
                        if (chrome.runtime.lastError && !window.subtitleUpdateErrorLogged) {
                            console.error('[Whatsub] 자막 업데이트 메시지 전송 오류:', chrome.runtime.lastError);
                            window.subtitleUpdateErrorLogged = true;
                            
                            // 30초 후 오류 로그 재설정
                            setTimeout(() => {
                                window.subtitleUpdateErrorLogged = false;
                            }, 30000);
                        }
                    }
                );
            }
            
            // 응답 필요 없음
            break;
    }
}

// 콘텐츠 스크립트 메시지 처리
function handleContentScriptMessage(message, sender, sendResponse) {
    const { action, tabId } = message;
    const currentTabId = sender.tab ? sender.tab.id : null;
    
    switch (action) {
        case 'contentScriptInitialized':
            console.log('[Whatsub] 콘텐츠 스크립트 초기화 완료:', sender.tab?.url);
            // 필요한 초기 설정이 있으면 여기서 진행
            sendResponse({ success: true });
            break;
            
        case 'videoEvent':
            // 비디오 이벤트 처리 (재생/일시정지)
            console.log('[Whatsub] 비디오 이벤트 수신:', message.eventType);
            
            // 비디오 이벤트에 따른 자막 처리 로직
            if (message.eventType === 'play') {
                // 비디오 재생 시작 - 자막 서비스 활성화
                if (currentTabId) {
                    // 자막 활성화 상태 확인
                    chrome.storage.sync.get(['subtitleEnabled'], (result) => {
                        const enabled = result.subtitleEnabled !== undefined ? result.subtitleEnabled : true;
                        
                        if (enabled) {
                            // 웰컴 메시지 표시
                            setTimeout(() => {
                                chrome.tabs.sendMessage(
                                    currentTabId, 
                                    {
                                        action: 'showSubtitle',
                                        text: 'WhatsUb 자막 서비스가 활성화되었습니다',
                                        duration: 3000,
                                        from: 'whatsub_background'
                                    },
                                    function(response) {
                                        if (chrome.runtime.lastError) {
                                            console.error('[Whatsub] 웰컴 메시지 전송 실패:', chrome.runtime.lastError);
                                        }
                                    }
                                );
                            }, 1000);
                        }
                    });
                }
            }
            
            sendResponse({ success: true });
            break;
            
        case 'showSubtitle':
            // 자막 표시 요청 처리
            if (currentTabId) {
                chrome.tabs.sendMessage(
                    currentTabId, 
                    {
                        action: 'showSubtitle',
                        text: message.text,
                        duration: message.duration || 5000,
                        from: 'whatsub_background'
                    },
                    function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('[Whatsub] 자막 표시 메시지 전송 실패:', chrome.runtime.lastError);
                        }
                    }
                );
            }
            
            sendResponse({ success: true });
            break;
            
        default:
            console.log('[Whatsub] 처리되지 않은 콘텐츠 스크립트 메시지:', action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
}

// 테스트 메시지
console.log('%c[WhatsUb 테스트] 확장 프로그램 버전 0.2.2가 성공적으로 로드되었습니다!', 'background: #FF5722; color: white; padding: 10px; font-size: 14px; font-weight: bold; border-radius: 5px;');

console.log('[WhatSub] 백그라운드 스크립트 초기화 완료'); 