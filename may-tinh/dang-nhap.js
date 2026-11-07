/* Chỉ học sinh / giáo viên đã đăng nhập Khu học tập mới dùng được Máy tính.
 * Dùng chung phiên đăng nhập của Khu học tập (localStorage ttm_token, ttm_me — cùng địa chỉ web).
 * Có phiên lưu sẵn → mở máy ngay, rồi hỏi lại máy chủ (lệnh 'me'); máy chủ báo hết phiên → khóa lại.
 * Bản gộp một file cho app Bảng hình học đặt window.MAY_TINH_KHONG_DANG_NHAP = true để bỏ qua bước này.
 * Lưu ý: đây là chặn trên trang web; mã nguồn trên GitHub vẫn công khai. */
(function () {
  if (window.MAY_TINH_KHONG_DANG_NHAP === true) return;

  var root = document.documentElement;
  var LOCK = 'mt-cho-dang-nhap';
  root.className += ' ' + LOCK;

  // Ẩn máy tính cho tới khi xác nhận đăng nhập (chèn CSS ngay để không chớp máy tính lên)
  var css = document.createElement('style');
  css.appendChild(document.createTextNode(
    '.' + LOCK + ' .page-main, .' + LOCK + ' #machine-switcher-bar { visibility: hidden; }' +
    '#mt-khoa { display: none; max-width: 360px; margin: 24px auto; padding: 22px 20px; border-radius: 16px;' +
    ' background: #fff; color: #1e293b; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18); text-align: center;' +
    ' font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; position: relative; z-index: 5; }' +
    '.mt-khoa-hien #mt-khoa { display: block; }' +
    '#mt-khoa h2 { margin: 0 0 8px; font-size: 20px; }' +
    '#mt-khoa p { margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #475569; }' +
    '#mt-khoa a { display: inline-block; padding: 11px 22px; border-radius: 10px; background: #2563eb;' +
    ' color: #fff; font-weight: 700; text-decoration: none; font-size: 16px; }'
  ));
  (document.head || root).appendChild(css);

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }

  var token = get('ttm_token');
  var me = null;
  try { me = JSON.parse(get('ttm_me') || 'null'); } catch (e) { me = null; }

  function unlock() {
    root.className = root.className.replace(new RegExp('\\s*' + LOCK, 'g'), '').replace(/\s*mt-khoa-hien/g, '');
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* máy cũ: bỏ qua */ }
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, false);
    else fn();
  }

  function lock(msg) {
    if (root.className.indexOf(LOCK) < 0) root.className += ' ' + LOCK;
    whenReady(function () {
      var box = document.getElementById('mt-khoa');
      if (!box) {
        box = document.createElement('div');
        box.id = 'mt-khoa';
        box.setAttribute('role', 'alert');
        var main = document.querySelector('.page-main');
        if (main && main.parentNode) main.parentNode.insertBefore(box, main);
        else document.body.appendChild(box);
      }
      box.innerHTML =
        '<h2>🔒 Cần đăng nhập</h2>' +
        '<p>' + msg + '</p>' +
        '<a href="../hoc/" id="mt-dang-nhap">Đăng nhập Khu học tập</a>';
      document.getElementById('mt-dang-nhap').onclick = function () {
        // Đăng nhập xong, Khu học tập tự đưa về lại Máy tính
        try { sessionStorage.setItem('ttm_sau_dang_nhap', 'may-tinh'); } catch (e) { /* bỏ qua */ }
      };
      if (root.className.indexOf('mt-khoa-hien') < 0) root.className += ' mt-khoa-hien';
    });
  }

  var MSG_CHUA = 'Máy tính chỉ dành cho học sinh và giáo viên của lớp Toán Thầy Minh. Hãy đăng nhập bằng tài khoản Khu học tập để sử dụng.';

  if (!token) { lock(MSG_CHUA); return; }
  if (me) unlock(); // đã đăng nhập trên máy này: mở ngay, kiểm tra lại ở phía sau

  var api = window.API_URL;
  if (!api) { if (!me) lock('Không kiểm tra được đăng nhập (thiếu địa chỉ máy chủ).'); return; }

  var xhr = new XMLHttpRequest();
  xhr.open('POST', api, true);
  xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
  xhr.timeout = 20000;
  xhr.onload = function () {
    var d = null;
    try { d = JSON.parse(xhr.responseText); } catch (e) { d = null; }
    if (d && d.ok && d.user) {
      set('ttm_me', JSON.stringify(d.user));
      unlock();
    } else if (d && d.code === 401) {
      set('ttm_token', null);
      set('ttm_me', null);
      lock('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để dùng Máy tính.');
    } else if (!me) {
      lock('Không kiểm tra được đăng nhập. Hãy thử tải lại trang.');
    }
  };
  // Mất mạng: ai đã đăng nhập trên máy này vẫn dùng được
  xhr.onerror = xhr.ontimeout = function () {
    if (!me) lock('Không kết nối được máy chủ để kiểm tra đăng nhập. Kiểm tra mạng rồi tải lại trang.');
  };
  xhr.send(JSON.stringify({ action: 'me', token: token }));
})();
