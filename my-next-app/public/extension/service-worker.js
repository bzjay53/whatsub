// Service Worker 버전
const CACHE_VERSION = 'v1';
const CACHE_NAME = `whatsub-${CACHE_VERSION}`;

// 캐시할 파일 목록
const CACHE_FILES = [
    '/extension/popup/popup.html',
    '/extension/popup/popup.css',
    '/extension/popup/popup.js',
    '/extension/content.js',
    '/extension/background.js'
];

// Service Worker 설치
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('캐시 생성 완료');
                return cache.addAll(CACHE_FILES);
            })
            .catch(error => {
                console.error('캐시 생성 실패:', error);
            })
    );
});

// Service Worker 활성화
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 캐시에 있으면 캐시된 응답 반환
                if (response) {
                    return response;
                }
                
                // 캐시에 없으면 네트워크 요청
                return fetch(event.request).then(response => {
                    // 유효한 응답인 경우에만 캐시에 저장
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// 메시지 처리
self.addEventListener('message', event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 