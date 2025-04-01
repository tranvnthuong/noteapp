const CACHE_NAME = 'my-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/assets/icon/android-icon-192x192.png',
  '/assets/icon/apple-icon.png',
];

// **Cài đặt Service Worker và cache tài nguyên**
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// **Khi có yêu cầu fetch, kiểm tra trong cache trước**
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Không cache API động hoặc các tài nguyên bên ngoài
  if (!url.origin.includes(location.origin)) {
    return;
  }

  if (
    url.origin.includes('cdn.jsdelivr.net') ||
    url.origin.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.open('cdn-cache').then((cache) => {
        return fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone()); // Cache lại file từ CDN
            return response;
          })
          .catch(() => caches.match(event.request)); // Nếu offline, lấy từ cache
      })
    );
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});

// **Xóa cache cũ khi có phiên bản mới**
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});
