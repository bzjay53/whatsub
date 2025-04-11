const CACHE_NAME = 'whatsub-offline-v1';
const OFFLINE_ASSETS = [
    'popup.html',
    'popup.js',
    'popup.css',
    'styles/content.css',
    'content.js',
    'background.js',
    'assets/icon16.png',
    'assets/icon48.png',
    'assets/icon128.png',
    'lib/airtable-api.js',
    'lib/firebase-sdk.js',
    'components/SubtitleDisplay.js',
    'components/StatusIndicator.js'
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('오프라인 에셋 캐싱 중...');
                return cache.addAll(OFFLINE_ASSETS);
            })
            .then(() => {
                console.log('오프라인 에셋 캐싱 완료');
                return self.skipWaiting();
            })
    );
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('이전 캐시 삭제:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('새로운 서비스 워커 활성화됨');
                return self.clients.claim();
            })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 캐시에 있는 경우 캐시된 응답 반환
                if (response) {
                    return response;
                }

                // 캐시에 없는 경우 네트워크 요청
                return fetch(event.request)
                    .then((response) => {
                        // 유효한 응답이 아닌 경우 그대로 반환
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 응답을 캐시에 저장
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('네트워크 요청 실패:', error);
                        // 오프라인 페이지나 에러 페이지 반환
                        return caches.match('offline.html');
                    });
            })
    );
});

// 오프라인 상태 변경 감지
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'OFFLINE_STATUS') {
        // 오프라인 상태 변경을 모든 클라이언트에 브로드캐스트
        self.clients.matchAll()
            .then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'OFFLINE_STATUS_CHANGED',
                        isOffline: event.data.isOffline
                    });
                });
            });
    }
}); 