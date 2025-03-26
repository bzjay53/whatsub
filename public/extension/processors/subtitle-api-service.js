/**
 * WhatSub - 자막 API 서비스
 * 자막 데이터를 가져오고 처리하는 API 서비스 모듈입니다.
 */

class SubtitleApiService {
  constructor() {
    this.API_BASE_URL = 'https://whatsub-api.netlify.app/api/v1'; // 나중에 실제 API 서버로 변경
    this.YOUTUBE_API_KEY = ''; // 설정에서 로드할 YouTube Data API 키
    this.cache = new Map(); // 자막 캐시
    this.init();
  }

  /**
   * 초기화 함수
   */
  init() {
    // API 키 로드
    this.loadApiKey();
  }

  /**
   * API 키 로드
   */
  loadApiKey() {
    chrome.storage.local.get(['youtube_api_key'], result => {
      if (result.youtube_api_key) {
        this.YOUTUBE_API_KEY = result.youtube_api_key;
      } else {
        console.warn('[WhatSub] YouTube API 키가 설정되지 않았습니다.');
        // 기본 API 키 설정 (개발용, 실제 배포 시 사용자별로 설정하거나 서버에서 관리)
        this.YOUTUBE_API_KEY = 'AIzaSyDJR3JoHCKXFNUXPK8WdHFpZ_nuT3hIcvM';
        chrome.storage.local.set({ youtube_api_key: this.YOUTUBE_API_KEY });
      }
    });
  }

  /**
   * 유튜브 자막 트랙 정보 가져오기
   * @param {string} videoId - 유튜브 비디오 ID
   * @returns {Promise<Object>} - 자막 트랙 정보
   */
  async fetchYoutubeSubtitles(videoId) {
    try {
      const cacheKey = `subtitles_${videoId}`;
      
      // 캐시에서 확인
      if (this.cache.has(cacheKey)) {
        console.log('[WhatSub] 캐시에서 자막 정보 로드');
        return this.cache.get(cacheKey);
      }
      
      console.log(`[WhatSub] YouTube 자막 정보 가져오기: ${videoId}`);
      
      // 먼저 내부 API로 시도 (자체 서버)
      let subtitles = await this.fetchFromInternalApi(videoId);
      
      // 내부 API에서 실패하면 유튜브 API로 시도
      if (!subtitles || !subtitles.length) {
        subtitles = await this.fetchFromYoutubeApi(videoId);
      }
      
      // 캐시에 저장
      const result = { subtitles };
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('[WhatSub] 자막 정보 가져오기 오류:', error);
      throw error;
    }
  }

  /**
   * 내부 API에서 자막 정보 가져오기
   * @param {string} videoId - 유튜브 비디오 ID
   * @returns {Promise<Array>} - 자막 정보 배열
   */
  async fetchFromInternalApi(videoId) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/subtitles/${videoId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`[WhatSub] 내부 API 요청 실패: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      return data.subtitles || [];
    } catch (error) {
      console.warn('[WhatSub] 내부 API 요청 오류:', error);
      return null;
    }
  }

  /**
   * 유튜브 API에서 자막 정보 가져오기
   * @param {string} videoId - 유튜브 비디오 ID
   * @returns {Promise<Array>} - 자막 정보 배열
   */
  async fetchFromYoutubeApi(videoId) {
    try {
      if (!this.YOUTUBE_API_KEY) {
        console.error('[WhatSub] YouTube API 키가 없습니다.');
        return [];
      }
      
      // 유튜브 캡션 목록 가져오기
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${this.YOUTUBE_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        console.error(`[WhatSub] YouTube API 요청 실패: ${response.status}`);
        
        // 대체 방법: YouTube 페이지에서 직접 자막 정보 추출 (스크래핑)
        return this.scrapeSubtitlesFromYoutube(videoId);
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      return items.map(item => ({
        languageCode: item.snippet.language,
        languageName: this.getLanguageName(item.snippet.language),
        url: `https://www.youtube.com/api/timedtext?lang=${item.snippet.language}&v=${videoId}`
      }));
    } catch (error) {
      console.error('[WhatSub] YouTube API 요청 오류:', error);
      
      // 대체 방법: YouTube 페이지에서 직접 자막 정보 추출 (스크래핑)
      return this.scrapeSubtitlesFromYoutube(videoId);
    }
  }

  /**
   * 유튜브 페이지에서 자막 정보 추출 (대체 방법)
   * @param {string} videoId - 유튜브 비디오 ID
   * @returns {Promise<Array>} - 자막 정보 배열
   */
  async scrapeSubtitlesFromYoutube(videoId) {
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
  }

  /**
   * 언어 코드로부터 언어 이름 가져오기
   * @param {string} langCode - 언어 코드
   * @returns {string} - 언어 이름
   */
  getLanguageName(langCode) {
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
    
    return languages[langCode.toLowerCase()] || langCode;
  }

  /**
   * 자막 콘텐츠 가져오기
   * @param {string} url - 자막 URL
   * @returns {Promise<string>} - 자막 콘텐츠
   */
  async fetchSubtitleContent(url) {
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

  /**
   * 음성 인식을 통한 자막 생성 (Whisper API 연동)
   * @param {string} videoId - 유튜브 비디오 ID
   * @param {string} language - 언어 코드 (기본값: 'auto')
   * @returns {Promise<Object>} - 생성된 자막 정보
   */
  async generateSubtitlesFromSpeech(videoId, language = 'auto') {
    try {
      console.log(`[WhatSub] 음성 인식 자막 생성 시작: ${videoId}, 언어: ${language}`);
      
      // 서버에 음성 인식 요청
      const response = await fetch(`${this.API_BASE_URL}/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoId,
          language
        })
      });
      
      if (!response.ok) {
        console.error(`[WhatSub] 음성 인식 요청 실패: ${response.status}`);
        return { success: false, error: '음성 인식 요청에 실패했습니다.' };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        subtitles: data.subtitles
      };
    } catch (error) {
      console.error('[WhatSub] 음성 인식 자막 생성 오류:', error);
      return { success: false, error: '음성 인식 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 자막 데이터 번역
   * @param {Array} subtitles - 자막 데이터 배열
   * @param {string} targetLanguage - 대상 언어 코드
   * @returns {Promise<Array>} - 번역된 자막 데이터 배열
   */
  async translateSubtitles(subtitles, targetLanguage) {
    try {
      if (!subtitles || subtitles.length === 0) {
        return [];
      }
      
      console.log(`[WhatSub] 자막 번역 시작: ${subtitles.length}개, 대상 언어: ${targetLanguage}`);
      
      // 번역 요청할 텍스트 추출
      const textsToTranslate = subtitles.map(sub => sub.text);
      
      // 서버에 번역 요청
      const response = await fetch(`${this.API_BASE_URL}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: textsToTranslate,
          targetLanguage
        })
      });
      
      if (!response.ok) {
        console.error(`[WhatSub] 번역 요청 실패: ${response.status}`);
        return subtitles; // 원본 반환
      }
      
      const data = await response.json();
      const translatedTexts = data.translatedTexts || [];
      
      // 번역된 텍스트로 자막 데이터 업데이트
      return subtitles.map((sub, index) => ({
        ...sub,
        originalText: sub.text,
        text: translatedTexts[index] || sub.text
      }));
    } catch (error) {
      console.error('[WhatSub] 자막 번역 오류:', error);
      return subtitles; // 오류 시 원본 반환
    }
  }

  /**
   * 자막 데이터 저장 (클라우드 및 로컬 스토리지)
   * @param {string} videoId - 비디오 ID
   * @param {Array} subtitles - 자막 데이터
   * @param {Object} metadata - 메타데이터 (제목, 작성자 등)
   * @returns {Promise<Object>} - 저장 결과
   */
  async saveSubtitles(videoId, subtitles, metadata = {}) {
    try {
      // 로컬 스토리지에 저장
      const savedSubtitles = {
        videoId,
        subtitles,
        metadata,
        timestamp: Date.now()
      };
      
      // 로컬 스토리지에 저장
      await new Promise(resolve => {
        chrome.storage.local.get(['savedSubtitles'], result => {
          const allSavedSubtitles = result.savedSubtitles || {};
          allSavedSubtitles[videoId] = savedSubtitles;
          
          chrome.storage.local.set({ savedSubtitles: allSavedSubtitles }, resolve);
        });
      });
      
      // 로그인한 경우에만 클라우드에 저장
      const isLoggedIn = await this.checkLoginStatus();
      
      if (isLoggedIn) {
        // 클라우드에 저장 요청
        const response = await fetch(`${this.API_BASE_URL}/subtitles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAuthToken()}`
          },
          body: JSON.stringify({
            videoId,
            subtitles,
            metadata
          })
        });
        
        if (!response.ok) {
          console.warn(`[WhatSub] 클라우드 저장 실패: ${response.status}`);
          return { success: true, localOnly: true };
        }
        
        return { success: true, localOnly: false };
      } else {
        return { success: true, localOnly: true };
      }
    } catch (error) {
      console.error('[WhatSub] 자막 저장 오류:', error);
      return { success: false, error: '자막 저장 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 로그인 상태 확인
   * @returns {Promise<boolean>} - 로그인 상태
   */
  async checkLoginStatus() {
    return new Promise(resolve => {
      chrome.storage.local.get(['authState'], result => {
        resolve(result.authState && result.authState.isLoggedIn === true);
      });
    });
  }

  /**
   * 인증 토큰 가져오기
   * @returns {Promise<string>} - 인증 토큰
   */
  async getAuthToken() {
    return new Promise(resolve => {
      chrome.storage.local.get(['authState'], result => {
        if (result.authState && result.authState.token) {
          resolve(result.authState.token);
        } else {
          resolve('');
        }
      });
    });
  }
}

// 모듈 초기화
const subtitleApiService = new SubtitleApiService();

// 모듈 내보내기
export default subtitleApiService; 