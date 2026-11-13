/* App Toán Thầy Minh (cài từ trình duyệt).
 * Luôn lấy bản mới trên mạng trước, nên sửa web là app có ngay bản mới;
 * chỉ khi mất mạng mới dùng bản đã lưu trên máy.
 * Không đụng tới máy chủ đăng nhập/dữ liệu (khác tên miền) và các yêu cầu gửi đi. */
var CACHE = 'ttm-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // Cùng tên miền với Sổ tay (bộ nhớ đệm dùng chung) → chỉ xóa bản cũ của Toán Thầy Minh
    return Promise.all(keys.filter(function (k) { return k.indexOf('ttm-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
      return hit || new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px;text-align:center"><h2>Chưa có mạng</h2><p>Thầy/em kết nối mạng rồi mở lại nhé.</p></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    });
  }));
});
