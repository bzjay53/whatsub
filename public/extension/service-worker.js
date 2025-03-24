// Whatsub Extension Service Worker

// 캐시 이름과 버전
const CACHE_NAME = 'whatsub-cache-v1';

// 캐시할 파일 목록
const CACHE_FILES = [
  '/',
  '/popup/popup.html',
  '/popup/popup.js',
  '/popup/popup.css',
  '/icons/icon-16.png',
  '/icons/icon-48.png',
  '/icons/icon-128.png'
];

// 서비스 워커 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 중...');
  
  // 캐시 준비
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('캐시 생성 완료');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        // 대기 중인 서비스 워커가 즉시 활성화되도록 함
        return self.skipWaiting();
      })
  );
});

// 서비스 워커 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화 중...');
  
  // 이전 캐시 정리
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 활성화된 서비스 워커가 모든 클라이언트를 제어하도록 함
      return self.clients.claim();
    })
  );
});

// fetch 이벤트 (네트워크 요청)
self.addEventListener('fetch', (event) => {
  // 캐시 우선, 네트워크 폴백 전략 사용
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 찾은 경우 캐시된 응답 반환
        if (response) {
          return response;
        }
        
        // 캐시에 없는 경우 네트워크에 요청
        return fetch(event.request)
          .then((networkResponse) => {
            // 응답이 유효한지 확인
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 응답 복제 (응답 스트림은 한 번만 사용 가능)
            const responseToCache = networkResponse.clone();
            
            // 새 응답을 캐시에 저장
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          });
      })
  );
});

// 백그라운드 메시지 처리
self.addEventListener('message', (event) => {
  console.log('Service Worker 메시지 수신:', event.data);
  
  // 메시지 처리 로직
  if (event.data && event.data.action === 'UPDATE_CACHE') {
    // 캐시 업데이트
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(CACHE_FILES);
    });
  }
});

console.log('Whatsub Service Worker 등록 완료'); 