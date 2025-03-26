/**
 * WhatSub - 유튜브 자막 처리 모듈
 * 유튜브 동영상에서 자막을 추출하고 처리하는 모듈입니다.
 */

class YoutubeSubtitleProcessor {
  constructor() {
    this.videoElement = null;
    this.observer = null;
    this.subtitles = [];
    this.currentVideoId = null;
    this.lastFetchTime = 0;
    this.isProcessing = false;
    this.captionsEnabled = false;
    this.availableLanguages = [];
    this.selectedLanguage = 'ko'; // 기본값은 한국어
    this.init();
  }

  /**
   * 초기화 함수
   */
  init() {
    // 페이지 로드 시 YouTube 감지
    this.detectYoutubeAndSetup();
    
    // 페이지 변경 감지
    this.setupNavigationObserver();
    
    // 설정 로드
    this.loadSettings();
    
    // 메시지 리스너 설정
    this.setupMessageListeners();
  }

  /**
   * YouTube 페이지 감지 및 설정
   */
  detectYoutubeAndSetup() {
    // YouTube 페이지인지 확인
    if (window.location.hostname.includes('youtube.com')) {
      console.log('[WhatSub] YouTube 페이지 감지됨');
      
      // 비디오 페이지인지 확인
      if (window.location.pathname.startsWith('/watch')) {
        this.setupYoutubeVideoPage();
      }
    }
  }

  /**
   * YouTube 비디오 페이지 설정
   */
  setupYoutubeVideoPage() {
    console.log('[WhatSub] YouTube 비디오 페이지 설정 중...');
    
    // 비디오 요소 찾기
    this.videoElement = document.querySelector('video.html5-main-video');
    
    if (!this.videoElement) {
      // 비디오 요소가 아직 로드되지 않았을 경우 대기 후 재시도
      setTimeout(() => this.setupYoutubeVideoPage(), 1000);
      return;
    }
    
    // 현재 비디오 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    this.currentVideoId = urlParams.get('v');
    
    if (!this.currentVideoId) {
      console.error('[WhatSub] 비디오 ID를 찾을 수 없습니다.');
      return;
    }
    
    console.log(`[WhatSub] 비디오 ID: ${this.currentVideoId}`);
    
    // 비디오 이벤트 리스너 설정
    this.setupVideoEventListeners();
    
    // 자막 정보 가져오기
    this.fetchSubtitleInfo();
  }

  /**
   * 내비게이션 옵저버 설정 (YouTube SPA 페이지 변경 감지)
   */
  setupNavigationObserver() {
    // YouTube는 SPA이므로 URL 변경을 감지해야 함
    let lastUrl = location.href;
    
    // MutationObserver를 사용하여 DOM 변경 감지
    this.observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('[WhatSub] URL 변경 감지:', lastUrl);
        
        // YouTube 비디오 페이지 확인 및 설정
        if (window.location.hostname.includes('youtube.com') && 
            window.location.pathname.startsWith('/watch')) {
          this.setupYoutubeVideoPage();
        }
      }
    });
    
    // 옵저버 시작
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 비디오 이벤트 리스너 설정
   */
  setupVideoEventListeners() {
    if (!this.videoElement) return;
    
    // 재생 상태 변경 시 이벤트
    this.videoElement.addEventListener('play', () => {
      console.log('[WhatSub] 비디오 재생 시작');
      this.startSubtitleProcessing();
    });
    
    this.videoElement.addEventListener('pause', () => {
      console.log('[WhatSub] 비디오 일시 정지');
      // 필요한 경우 자막 처리 일시 중지
    });
    
    // 시간 업데이트 시 자막 업데이트
    this.videoElement.addEventListener('timeupdate', () => {
      this.updateCurrentSubtitle();
    });
  }

  /**
   * 자막 정보 가져오기
   */
  async fetchSubtitleInfo() {
    if (!this.currentVideoId || this.isProcessing) return;
    
    console.log('[WhatSub] 자막 정보 가져오는 중...');
    this.isProcessing = true;
    
    try {
      // 최소 30초 간격으로 API 요청 (API 제한 방지)
      const now = Date.now();
      if (now - this.lastFetchTime < 30000) {
        console.log('[WhatSub] API 호출 제한 (30초 간격)');
        this.isProcessing = false;
        return;
      }
      
      this.lastFetchTime = now;
      
      // 백그라운드 스크립트에 자막 정보 요청
      chrome.runtime.sendMessage({
        action: 'fetchSubtitles',
        videoId: this.currentVideoId
      }, response => {
        if (response && response.success) {
          this.handleSubtitleResponse(response.data);
        } else {
          console.error('[WhatSub] 자막 정보 가져오기 실패:', response ? response.error : '응답 없음');
          // 자막이 없는 경우 음성 인식을 통한 자막 생성 옵션 제공
          this.offerSpeechRecognition();
        }
        this.isProcessing = false;
      });
    } catch (error) {
      console.error('[WhatSub] 자막 정보 요청 오류:', error);
      this.isProcessing = false;
    }
  }

  /**
   * 자막 응답 처리
   */
  handleSubtitleResponse(data) {
    if (!data || !data.subtitles || data.subtitles.length === 0) {
      console.log('[WhatSub] 사용 가능한 자막이 없습니다.');
      this.offerSpeechRecognition();
      return;
    }
    
    // 사용 가능한 자막 언어 목록 저장
    this.availableLanguages = data.subtitles.map(sub => ({
      code: sub.languageCode,
      name: sub.languageName
    }));
    
    console.log('[WhatSub] 사용 가능한 자막 언어:', this.availableLanguages);
    
    // 기본 언어 또는 사용자 선택 언어의 자막 선택
    const selectedSubtitle = data.subtitles.find(sub => sub.languageCode === this.selectedLanguage) || 
                            data.subtitles[0];
    
    if (selectedSubtitle && selectedSubtitle.url) {
      this.fetchSubtitleContent(selectedSubtitle.url);
    }
  }

  /**
   * 자막 콘텐츠 가져오기
   */
  async fetchSubtitleContent(url) {
    try {
      console.log('[WhatSub] 자막 콘텐츠 가져오는 중:', url);
      
      // 백그라운드 스크립트에 자막 콘텐츠 요청
      chrome.runtime.sendMessage({
        action: 'fetchSubtitleContent',
        url: url
      }, response => {
        if (response && response.success) {
          this.parseSubtitles(response.data);
        } else {
          console.error('[WhatSub] 자막 콘텐츠 가져오기 실패:', response ? response.error : '응답 없음');
        }
      });
    } catch (error) {
      console.error('[WhatSub] 자막 콘텐츠 요청 오류:', error);
    }
  }

  /**
   * 자막 데이터 파싱
   */
  parseSubtitles(data) {
    if (!data) return;
    
    try {
      console.log('[WhatSub] 자막 파싱 중...');
      
      // 자막 포맷에 따라 파싱 로직 분기
      // 기본적으로 YouTube는 XML 형식의 자막을 제공함
      let parsedSubtitles = [];
      
      if (data.includes('<transcript>')) {
        // XML 형식 파싱
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        const textElements = xmlDoc.getElementsByTagName('text');
        
        for (let i = 0; i < textElements.length; i++) {
          const element = textElements[i];
          const startTime = parseFloat(element.getAttribute('start'));
          const duration = parseFloat(element.getAttribute('dur') || '0');
          const endTime = startTime + duration;
          const text = element.textContent;
          
          parsedSubtitles.push({
            startTime,
            endTime,
            text
          });
        }
      } else if (data.includes('WEBVTT')) {
        // VTT 형식 파싱
        const lines = data.split('\n');
        let subtitle = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.includes('-->')) {
            // 타임스탬프 라인
            const times = line.split('-->').map(t => t.trim());
            const startTime = this.vttTimeToSeconds(times[0]);
            const endTime = this.vttTimeToSeconds(times[1]);
            
            subtitle = {
              startTime,
              endTime,
              text: ''
            };
          } else if (subtitle && line !== '' && !line.includes('WEBVTT')) {
            // 자막 텍스트 라인
            subtitle.text += (subtitle.text ? ' ' : '') + line;
            
            // 다음 라인이 비어있거나 끝에 도달하면 자막 추가
            if (i + 1 >= lines.length || lines[i + 1].trim() === '') {
              parsedSubtitles.push(subtitle);
              subtitle = null;
            }
          }
        }
      } else {
        // SRT 또는 다른 형식의 자막 파싱 (필요한 경우 추가)
        console.log('[WhatSub] 지원되지 않는 자막 형식');
      }
      
      if (parsedSubtitles.length > 0) {
        console.log(`[WhatSub] ${parsedSubtitles.length}개의 자막 파싱 완료`);
        this.subtitles = parsedSubtitles;
        this.captionsEnabled = true;
        
        // UI 업데이트
        this.updateCaptionUI(true);
        
        // 현재 시간에 맞는 자막 업데이트
        this.updateCurrentSubtitle();
      } else {
        console.warn('[WhatSub] 파싱된 자막이 없습니다.');
      }
    } catch (error) {
      console.error('[WhatSub] 자막 파싱 오류:', error);
    }
  }

  /**
   * VTT 형식의 시간을 초 단위로 변환
   */
  vttTimeToSeconds(vttTime) {
    const parts = vttTime.split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
      // HH:MM:SS.mmm
      seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS.mmm
      seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    
    return seconds;
  }

  /**
   * 현재 재생 시간에 맞는 자막 업데이트
   */
  updateCurrentSubtitle() {
    if (!this.videoElement || !this.captionsEnabled || this.subtitles.length === 0) return;
    
    const currentTime = this.videoElement.currentTime;
    let subtitleText = '';
    
    // 현재 시간에 맞는 자막 찾기
    for (const subtitle of this.subtitles) {
      if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
        subtitleText = subtitle.text;
        break;
      }
    }
    
    // 자막 표시 업데이트
    this.updateSubtitleDisplay(subtitleText);
  }

  /**
   * 자막 표시 업데이트
   */
  updateSubtitleDisplay(text) {
    // content.js의 자막 표시 함수 호출
    chrome.runtime.sendMessage({
      action: 'updateSubtitle',
      text: text
    });
  }

  /**
   * 음성 인식 자막 생성 제안
   */
  offerSpeechRecognition() {
    console.log('[WhatSub] 음성 인식을 통한 자막 생성 제안');
    
    // 사용자에게 음성 인식 자막 생성 옵션 제공
    chrome.runtime.sendMessage({
      action: 'offerSpeechRecognition',
      videoId: this.currentVideoId
    });
  }

  /**
   * 자막 처리 시작
   */
  startSubtitleProcessing() {
    if (this.captionsEnabled && this.subtitles.length > 0) {
      console.log('[WhatSub] 자막 처리 시작');
      this.updateCurrentSubtitle();
    } else if (!this.isProcessing) {
      // 자막 정보가 없으면 다시 가져오기
      this.fetchSubtitleInfo();
    }
  }

  /**
   * 자막 UI 업데이트
   */
  updateCaptionUI(enabled) {
    chrome.runtime.sendMessage({
      action: 'updateCaptionUI',
      enabled: enabled
    });
  }

  /**
   * 설정 로드
   */
  loadSettings() {
    chrome.storage.local.get(['captionsEnabled', 'selectedLanguage'], (result) => {
      if (result.captionsEnabled !== undefined) {
        this.captionsEnabled = result.captionsEnabled;
      }
      
      if (result.selectedLanguage) {
        this.selectedLanguage = result.selectedLanguage;
      }
    });
  }

  /**
   * 메시지 리스너 설정
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'toggleCaptions':
          this.captionsEnabled = request.enabled !== undefined ? request.enabled : !this.captionsEnabled;
          chrome.storage.local.set({ captionsEnabled: this.captionsEnabled });
          this.updateCaptionUI(this.captionsEnabled);
          sendResponse({ success: true });
          break;
          
        case 'setLanguage':
          if (request.languageCode) {
            this.selectedLanguage = request.languageCode;
            chrome.storage.local.set({ selectedLanguage: this.selectedLanguage });
            
            // 언어가 변경되면 자막 다시 가져오기
            this.fetchSubtitleInfo();
            
            sendResponse({ success: true });
          }
          break;
          
        case 'getAvailableLanguages':
          sendResponse({ 
            success: true, 
            languages: this.availableLanguages,
            selectedLanguage: this.selectedLanguage
          });
          break;
      }
      
      // 비동기 응답 지원
      return true;
    });
  }
}

// 모듈 초기화
const youtubeSubtitleProcessor = new YoutubeSubtitleProcessor();

// 모듈 내보내기
export default youtubeSubtitleProcessor; 