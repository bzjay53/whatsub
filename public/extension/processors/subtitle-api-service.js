class SubtitleApiService {
  constructor() {
    this.initialized = false;
    this.API_BASE_URL = 'https://whatsub-api.netlify.app/api/v1';
    this.LOCAL_API_URL = 'http://localhost:3000/api/v1';
    this.useLocalApi = false;
  }

  /**
   * 서비스 초기화
   */
  initialize() {
    if (this.initialized) return;
    
    try {
      // 로컬 테스트 모드인지 확인
      chrome.storage.local.get(['useLocalApi'], (data) => {
        this.useLocalApi = !!data.useLocalApi;
        console.log(`[SubtitleApiService] API 서버: ${this.useLocalApi ? 'LOCAL' : 'PRODUCTION'}`);
      });
      
      this.initialized = true;
      console.log('[SubtitleApiService] 초기화 완료');
    } catch (error) {
      console.error('[SubtitleApiService] 초기화 실패:', error);
    }
  }

  /**
   * API 기본 URL 가져오기
   */
  getBaseUrl() {
    return this.useLocalApi ? this.LOCAL_API_URL : this.API_BASE_URL;
  }

  /**
   * API 요청 기본 헤더 생성
   */
  async getHeaders() {
    try {
      const authData = await new Promise(resolve => {
        chrome.storage.local.get(['authToken'], resolve);
      });
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Client-Version': chrome.runtime.getManifest().version,
      };
      
      if (authData.authToken) {
        headers['Authorization'] = `Bearer ${authData.authToken}`;
      }
      
      return headers;
    } catch (error) {
      console.error('[SubtitleApiService] 헤더 생성 오류:', error);
      return { 'Content-Type': 'application/json' };
    }
  }

  /**
   * 자막 제출
   * @param {Object} data - 자막 데이터
   */
  async submitSubtitle(data) {
    try {
      if (!this.initialized) this.initialize();
      
      const url = `${this.getBaseUrl()}/subtitles`;
      const headers = await this.getHeaders();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubtitleApiService] 자막 제출 오류:', error);
      throw error;
    }
  }

  /**
   * 자막 평가
   * @param {string} subtitleId - 자막 ID
   * @param {string} rating - 평가 (up/down)
   */
  async rateSubtitle(subtitleId, rating) {
    try {
      if (!this.initialized) this.initialize();
      
      const url = `${this.getBaseUrl()}/subtitles/${subtitleId}/rate`;
      const headers = await this.getHeaders();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ rating })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubtitleApiService] 자막 평가 오류:', error);
      throw error;
    }
  }

  /**
   * 자막 목록 가져오기
   * @param {Object} params - 검색 매개변수
   */
  async getSubtitles(params = {}) {
    try {
      if (!this.initialized) this.initialize();
      
      const url = new URL(`${this.getBaseUrl()}/subtitles`);
      
      // URL에 쿼리 매개변수 추가
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });
      
      const headers = await this.getHeaders();
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubtitleApiService] 자막 목록 가져오기 오류:', error);
      throw error;
    }
  }

  /**
   * 영상에 맞는 자막 가져오기
   * @param {string} videoId - 영상 ID (YouTube, 넷플릭스 등)
   * @param {string} platform - 플랫폼 (youtube, netflix 등)
   */
  async getSubtitlesForVideo(videoId, platform) {
    return this.getSubtitles({
      videoId: videoId,
      platform: platform
    });
  }

  /**
   * API 서버 상태 확인
   */
  async checkServerStatus() {
    try {
      if (!this.initialized) this.initialize();
      
      const url = `${this.getBaseUrl()}/status`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        return {
          online: false,
          status: response.status,
          message: await response.text()
        };
      }
      
      const data = await response.json();
      return {
        online: true,
        ...data
      };
    } catch (error) {
      console.error('[SubtitleApiService] 서버 상태 확인 오류:', error);
      return {
        online: false,
        error: error.message
      };
    }
  }
}

// 서비스 인스턴스 생성 및 내보내기
const subtitleApiService = new SubtitleApiService();
export default subtitleApiService;

// 전역 객체에도 등록 (콘텐츠 스크립트 등에서 사용)
window.subtitleApiService = subtitleApiService; 