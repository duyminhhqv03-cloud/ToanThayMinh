/* Chặn trang cho người đã đăng nhập Khu học tập (dùng cho Máy tính và Bảng hình học).
 * Dùng chung phiên đăng nhập của Khu học tập (localStorage ttm_token, ttm_me — cùng địa chỉ web).
 * Có phiên lưu sẵn → mở ngay, rồi hỏi lại máy chủ (lệnh 'me'); máy chủ báo hết phiên → khóa lại.
 *
 * Tùy chọn (đặt TRƯỚC khi nạp file này):
 *   window.DANG_NHAP_CHO = {
 *     vaiTro: ['teacher', 'admin'],      // chỉ các vai trò này (bỏ trống = ai đăng nhập cũng được)
 *     an: 'body > *:not(#mt-khoa)',      // phần cần ẩn khi chưa được dùng
 *     ten: 'Bảng hình học',              // tên hiện trong thông báo
 *     quayLai: 'bang-hinh-hoc'           // đăng nhập xong Khu học tập đưa về trang này
 *   };
 * Bản gộp một file cho app Bảng hình học đặt window.MAY_TINH_KHONG_DANG_NHAP = true để bỏ qua bước này.
 * Lưu ý: đây là chặn trên trang web; mã nguồn trên GitHub vẫn công khai. */
(function () {
  if (window.MAY_TINH_KHONG_DANG_NHAP === true) return;

  var cfg = window.DANG_NHAP_CHO || {};
  var ROLES = cfg.vaiTro || null;
  var HIDE = cfg.an || '.page-main, #machine-switcher-bar';
  var TEN = cfg.ten || 'Máy tính';
  var QUAY_LAI = cfg.quayLai || 'may-tinh';

  var root = document.documentElement;
  var LOCK = 'mt-cho-dang-nhap';
  root.className += ' ' + LOCK;

  // Ẩn nội dung cho tới khi xác nhận đăng nhập (chèn CSS ngay để không chớp lên)
  var hideSel = HIDE.split(',');
  for (var i = 0; i < hideSel.length; i++) hideSel[i] = '.' + LOCK + ' ' + hideSel[i].replace(/^\s+|\s+$/g, '');
  var css = document.createElement('style');
  css.appendChild(document.createTextNode(
    hideSel.join(', ') + ' { visibility: hidden; }' +
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

  function roleOk(u) {
    if (!ROLES) return true;
    for (var j = 0; j < ROLES.length; j++) if (u && u.role === ROLES[j]) return true;
    return false;
  }

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

  // nutDangNhap = false: đã đăng nhập nhưng không đủ quyền → chỉ đưa về Khu học tập
  function lock(msg, nutDangNhap) {
    if (root.className.indexOf(LOCK) < 0) root.className += ' ' + LOCK;
    whenReady(function () {
      var box = document.getElementById('mt-khoa');
      if (!box) {
        box = document.createElement('div');
        box.id = 'mt-khoa';
        box.setAttribute('role', 'alert');
        var main = document.querySelector('.page-main');
        if (main && main.parentNode) main.parentNode.insertBefore(box, main);
        else document.body.insertBefore(box, document.body.firstChild);
      }
      var coNut = nutDangNhap !== false;
      box.innerHTML =
        '<h2>🔒 ' + (coNut ? 'Cần đăng nhập' : 'Không có quyền') + '</h2>' +
        '<p>' + msg + '</p>' +
        '<a href="../hoc/" id="mt-dang-nhap">' + (coNut ? 'Đăng nhập Khu học tập' : 'Về Khu học tập') + '</a>';
      if (coNut) {
        document.getElementById('mt-dang-nhap').onclick = function () {
          // Đăng nhập xong, Khu học tập tự đưa về lại trang này
          try { sessionStorage.setItem('ttm_sau_dang_nhap', QUAY_LAI); } catch (e) { /* bỏ qua */ }
        };
      }
      if (root.className.indexOf('mt-khoa-hien') < 0) root.className += ' mt-khoa-hien';
    });
  }

  var AI_DUNG = ROLES ? 'giáo viên của lớp Toán Thầy Minh' : 'học sinh và giáo viên của lớp Toán Thầy Minh';
  var MSG_CHUA = TEN + ' chỉ dành cho ' + AI_DUNG + '. Hãy đăng nhập bằng tài khoản Khu học tập để sử dụng.';
  var MSG_QUYEN = TEN + ' chỉ dành cho giáo viên. Tài khoản đang đăng nhập không có quyền dùng trang này.';

  if (!token) { lock(MSG_CHUA); return; }
  if (me && !roleOk(me)) { lock(MSG_QUYEN, false); }
  else if (me) unlock(); // đã đăng nhập trên máy này: mở ngay, kiểm tra lại ở phía sau

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
      if (roleOk(d.user)) unlock();
      else lock(MSG_QUYEN, false);
    } else if (d && d.code === 401) {
      set('ttm_token', null);
      set('ttm_me', null);
      lock('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để dùng ' + TEN + '.');
    } else if (!me) {
      lock('Không kiểm tra được đăng nhập. Hãy thử tải lại trang.');
    }
  };
  // Mất mạng: ai đã đăng nhập (đủ quyền) trên máy này vẫn dùng được
  xhr.onerror = xhr.ontimeout = function () {
    if (!me) lock('Không kết nối được máy chủ để kiểm tra đăng nhập. Kiểm tra mạng rồi tải lại trang.');
  };
  xhr.send(JSON.stringify({ action: 'me', token: token }));
})();
