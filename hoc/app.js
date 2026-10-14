/* Khu học tập – Toán Thầy Minh
 * Trang tĩnh trên GitHub Pages, nói chuyện với máy chủ Google Apps Script (xem apps-script/Code.gs).
 */
(function () {
  'use strict';

  var API = String(window.API_URL || '').trim();
  var MAX_BYTES = 20 * 1024 * 1024;
  var MAX_FILES = 10;
  var ROLE_LABEL = { admin: 'Admin', teacher: 'Giáo viên', student: 'Học sinh' };
  var CONTACT = 'Thầy Minh – 0376 696 994';
  var NO_TOPIC = 'Chưa phân chủ đề';
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var COURSE_COLORS = ['#0f9d74', '#ff7a59', '#3b82f6', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899'];

  var app = document.getElementById('app');
  var navUser = document.getElementById('nav-user');
  var toastEl = document.getElementById('toast');

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) {
      try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ }
    }
  };

  var token = store.get('ttm_token');
  var me = null;
  var coursesCache = null;
  var leaveGuard = null; // hàm hỏi trước khi rời trang (đang làm bài)

  /* ═════════ Tiện ích DOM ═════════ */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.append(c.nodeType ? c : String(c));
  }
  function fill(el) {
    el.replaceChildren();
    for (var i = 1; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.className = 'toast'; }, 4000);
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { if (!btn.disabled) btn._label = btn.textContent; btn.textContent = label || 'Đang xử lý…'; btn.disabled = true; }
    else { btn.textContent = btn._label || btn.textContent; btn.disabled = false; }
  }

  function loading(text) {
    return h('div', { class: 'loading' }, h('span', { class: 'spinner' }), text || 'Đang tải…');
  }

  function errorBox(msg, retry) {
    return h('div', { class: 'panel empty' },
      h('p', null, msg),
      retry ? h('button', { class: 'btn btn-ghost', onclick: retry }, 'Thử lại') : null);
  }

  function modal(title, body, actions, opts) {
    opts = opts || {};
    var overlay = h('div', { class: 'overlay' });
    var close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' },
        h('h3', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: close }, '×')),
      h('div', { class: 'modal-body' }, body),
      actions ? h('div', { class: 'modal-actions' }, actions(close)) : null);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    overlay.append(box);
    document.body.append(overlay);
    var first = box.querySelector('.modal-body input:not([type=checkbox]):not([type=file]), .modal-body select, .modal-body textarea');
    if (first && !opts.noFocus) first.focus();
    return close;
  }

  function confirmBox(title, text, okLabel, onOk) {
    modal(title, h('p', null, text), function (close) {
      var ok = h('button', { class: 'btn btn-danger' }, okLabel);
      ok.addEventListener('click', function () {
        busy(ok, true);
        Promise.resolve(onOk()).then(close, function (e) { busy(ok, false); toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  function copy(text) {
    var done = function () { toast('Đã sao chép.', 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
    ta.remove();
  }

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
  }

  /* ═════════ Định dạng ═════════ */

  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
      d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  function fmtSize(n) {
    if (!n) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' MB';
  }
  function fmtScore(n) {
    return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function loginUrl() {
    return location.origin + location.pathname;
  }

  /** Nhãn hạn nộp có màu theo độ gấp. done = đã nộp/không cần nhắc. */
  function dueBadge(dueAt, done) {
    if (!dueAt) return h('span', { class: 'due' }, 'Không có hạn');
    var diff = new Date(dueAt).getTime() - Date.now();
    var cls = 'due';
    var prefix = 'Hạn ';
    if (!done) {
      if (diff < 0) { cls += ' over'; prefix = 'Quá hạn · '; }
      else if (diff < 48 * 3600 * 1000) { cls += ' soon'; prefix = diff < 24 * 3600 * 1000 ? 'Sắp hết hạn · ' : 'Hạn '; }
    }
    return h('span', { class: cls }, prefix + fmtDateTime(dueAt));
  }

  function statusPill(my, maxScore) {
    if (!my || my.status === 'todo') return h('span', { class: 'pill p-todo' }, 'Chưa nộp');
    if (my.status === 'returned') return h('span', { class: 'pill p-done' }, 'Điểm ' + fmtScore(my.score) + '/' + fmtScore(maxScore));
    return h('span', { class: 'pill p-wait' }, my.late ? 'Đã nộp muộn' : 'Đã nộp');
  }

  /* ═════════ Gọi máy chủ ═════════ */

  function api(action, params) {
    if (!API) return Promise.reject(new Error('Khu học tập chưa được nối với máy chủ (thiếu API_URL trong hoc/config.js).'));
    var body = Object.assign({ action: action, token: token }, params || {});
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).catch(function () {
      throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Kiểm tra lại cài đặt Apps Script.');
      });
    }).then(function (data) {
      if (!data.ok) {
        if (data.code === 401 && action !== 'login' && token) {
          setSession(null, null);
          setTimeout(route, 0);
        }
        var msg = data.error || 'Có lỗi xảy ra.';
        if (msg === 'Yêu cầu không hợp lệ.') msg = 'Máy chủ chưa được cập nhật bản mới. Admin cần dán lại Code.gs vào Apps Script và triển khai phiên bản mới.';
        var e = new Error(msg);
        e.code = data.code;
        throw e;
      }
      return data;
    });
  }

  function setSession(t, user) {
    token = t;
    me = user;
    coursesCache = null;
    store.set('ttm_token', t);
  }

  function getCourses(force) {
    if (coursesCache && !force) return Promise.resolve(coursesCache);
    return api('courses').then(function (d) { coursesCache = d.courses; return coursesCache; });
  }

  /* ═════════ File: đọc, nén ảnh, xem, tải ═════════ */

  function readBase64(f) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Không đọc được file ' + f.name + '.')); };
      r.readAsDataURL(f);
    });
  }

  /** Ảnh chụp điện thoại thường 3–6 MB: thu nhỏ còn cạnh dài 1800px, JPEG ~ 300–600 KB. */
  function compressImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 400 * 1024) return resolve(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1800;
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function base64ToBlob(d) {
    var bin = atob(d.data);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: d.mimeType || 'application/octet-stream' });
  }

  var blobCache = {};
  /** fetcher: () => Promise<{name,mimeType,data}>; key dùng để nhớ, tránh tải lại. */
  function getBlob(key, fetcher) {
    if (!blobCache[key]) {
      blobCache[key] = fetcher().then(function (d) { return { name: d.name, blob: base64ToBlob(d) }; });
      blobCache[key].catch(function () { delete blobCache[key]; });
    }
    return blobCache[key];
  }

  function saveBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function download(key, fetcher, btn) {
    busy(btn, true, 'Đang tải…');
    getBlob(key, fetcher).then(function (r) { saveBlob(r.name, r.blob); }, function (e) { toast(e.message, 'error'); })
      .then(function () { busy(btn, false); });
  }

  function viewable(mime, name) {
    return /^(application\/pdf|image\/|text\/plain)/.test(mime || '') || /\.pdf$/i.test(name || '');
  }

  var pdfjsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = function () {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = function () { pdfjsPromise = null; reject(new Error('Không tải được trình xem PDF.')); };
        document.head.append(s);
      });
    }
    return pdfjsPromise;
  }

  /** Trình xem toàn màn hình: PDF (từng trang), ảnh, văn bản. */
  function openViewer(title, key, fetcher) {
    var body = h('div', { class: 'viewer-body' }, loading('Đang mở tài liệu…'));
    var zoom = 1;
    var pdfDoc = null;
    var dlBtn = h('button', { class: 'btn btn-sm btn-light' }, 'Tải về');
    var zoomOut = h('button', { class: 'icon-btn', 'aria-label': 'Thu nhỏ', hidden: true }, '−');
    var zoomIn = h('button', { class: 'icon-btn', 'aria-label': 'Phóng to', hidden: true }, '+');
    var pageInfo = h('span', { class: 'viewer-info' });
    var overlay = h('div', { class: 'viewer', role: 'dialog', 'aria-label': title },
      h('div', { class: 'viewer-bar' },
        h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: close }, '←'),
        h('strong', { class: 'viewer-title' }, title),
        pageInfo, zoomOut, zoomIn, dlBtn),
      body);
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    document.body.append(overlay);

    getBlob(key, fetcher).then(function (r) {
      dlBtn.addEventListener('click', function () { saveBlob(r.name, r.blob); });
      var type = r.blob.type;
      if (type === 'application/pdf' || /\.pdf$/i.test(r.name)) return showPdf(r.blob);
      if (/^image\//.test(type)) {
        var url = URL.createObjectURL(r.blob);
        fill(body, h('img', { class: 'viewer-img', src: url, alt: title }));
        return;
      }
      if (/^text\//.test(type)) {
        return r.blob.text().then(function (t) { fill(body, h('pre', { class: 'viewer-text' }, t)); });
      }
      fill(body, h('div', { class: 'viewer-empty' },
        h('p', null, 'Không xem trước được loại file này trên web.'),
        h('button', { class: 'btn', onclick: function () { saveBlob(r.name, r.blob); } }, 'Tải về để mở')));
    }).catch(function (e) {
      fill(body, h('div', { class: 'viewer-empty' }, h('p', null, e.message)));
    });

    function showPdf(blob) {
      return loadPdfJs().then(function (lib) {
        return blob.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
      }).then(function (doc) {
        pdfDoc = doc;
        zoomIn.hidden = zoomOut.hidden = false;
        zoomIn.onclick = function () { zoom = Math.min(3, zoom + 0.25); renderPages(); };
        zoomOut.onclick = function () { zoom = Math.max(0.5, zoom - 0.25); renderPages(); };
        pageInfo.textContent = doc.numPages + ' trang';
        renderPages();
      }).catch(function () {
        // Không có PDF.js (mất mạng tới CDN…) → dùng trình xem có sẵn của trình duyệt.
        var url = URL.createObjectURL(blob);
        fill(body, h('iframe', { class: 'viewer-frame', src: url, title: title }));
      });
    }

    function renderPages() {
      var width = Math.min(body.clientWidth - 24, 1000) * zoom;
      var pages = h('div', { class: 'viewer-pages' });
      fill(body, pages);
      var ratio = window.devicePixelRatio || 1;
      var chain = Promise.resolve();
      for (var i = 1; i <= pdfDoc.numPages; i++) {
        (function (n) {
          var canvas = h('canvas', { class: 'viewer-page' });
          pages.append(canvas);
          chain = chain.then(function () {
            if (!overlay.isConnected) return;
            return pdfDoc.getPage(n).then(function (page) {
              var v1 = page.getViewport({ scale: 1 });
              var vp = page.getViewport({ scale: (width / v1.width) * ratio });
              canvas.width = vp.width;
              canvas.height = vp.height;
              canvas.style.width = (vp.width / ratio) + 'px';
              return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
            });
          });
        })(i);
      }
    }
  }

  function fileKind(mime, name) {
    var m = mime || '';
    var ext = ((name || '').split('.').pop() || '').toLowerCase();
    if (m === 'application/pdf' || ext === 'pdf') return ['PDF', 'k-pdf'];
    if (/word|document/.test(m) || ext === 'doc' || ext === 'docx') return ['WORD', 'k-word'];
    if (/sheet|excel/.test(m) || ext === 'xls' || ext === 'xlsx') return ['EXCEL', 'k-excel'];
    if (/presentation|powerpoint/.test(m) || ext === 'ppt' || ext === 'pptx') return ['SLIDE', 'k-slide'];
    if (/^image\//.test(m)) return ['ẢNH', 'k-image'];
    if (/^audio\//.test(m)) return ['AUDIO', 'k-audio'];
    if (/^video\//.test(m)) return ['VIDEO', 'k-video'];
    return [ext ? ext.toUpperCase().slice(0, 5) : 'FILE', 'k-file'];
  }

  /** Nút "Xem" + "Tải về" cho một file lưu trên máy chủ. */
  function fileButtons(title, f, key, fetcher) {
    var out = [];
    if (viewable(f.mimeType, f.name)) {
      out.push(h('button', { class: 'btn btn-sm', onclick: function () { openViewer(title, key, fetcher); } }, 'Xem'));
    }
    var dl = h('button', { class: 'btn btn-sm btn-ghost' }, 'Tải về');
    dl.addEventListener('click', function () { download(key, fetcher, dl); });
    out.push(dl);
    return out;
  }

  /* ═════════ Điều hướng ═════════ */

  function route() {
    leaveGuard = null;
    renderNav();
    if (!token) return renderLogin();
    if (!me) return boot();
    var parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'khoa': if (parts[1]) return renderCourse(parts[1]); break;
      case 'bai': if (parts[1]) return renderAssignment(parts[1]); break;
      case 'luyen': if (parts[1]) return renderQuiz(parts[1]); break;
      case 'soan-de': return renderQuizEditor(parts[1], parts[2]);
      case 'tai-khoan': if (me.role === 'admin') return renderUsers(); break;
    }
    return renderHome();
  }

  function boot() {
    fill(app, loading());
    api('me').then(function (d) { me = d.user; route(); }, function (e) {
      if (token) fill(app, errorBox(e.message, boot));
    });
  }

  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }

  window.addEventListener('hashchange', function (e) {
    if (leaveGuard && !leaveGuard()) {
      history.replaceState(null, '', e.oldURL);
      return;
    }
    route();
  });

  /* ═════════ Thanh trên cùng ═════════ */

  function renderNav() {
    if (!me) {
      fill(navUser, h('a', { href: '../', class: 'nav-link' }, '← Trang chủ'));
      return;
    }
    var links = [h('a', { href: '#/', class: 'nav-link' }, 'Khóa học')];
    if (me.role === 'admin') links.push(h('a', { href: '#/tai-khoan', class: 'nav-link' }, 'Tài khoản'));
    var closeMenu = function (e) { e.target.closest('details').open = false; };
    fill(navUser,
      h('nav', { class: 'nav-links' }, links),
      h('details', { class: 'user-menu' },
        h('summary', null,
          h('span', { class: 'user-name' }, me.fullName),
          h('span', { class: 'role-badge role-' + me.role }, ROLE_LABEL[me.role] || me.role)),
        h('div', { class: 'user-menu-list' },
          h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/'); } }, 'Khóa học'),
          me.role === 'admin' ? h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/tai-khoan'); } }, 'Quản lý tài khoản') : null,
          h('button', { onclick: function (e) { closeMenu(e); changePassword(); } }, 'Đổi mật khẩu'),
          h('button', { onclick: logout }, 'Đăng xuất'))));
  }

  function logout() {
    var t = token;
    setSession(null, null);
    location.hash = '';
    route();
    if (t) {
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'logout', token: t }) }).catch(function () {});
    }
  }

  function changePassword() {
    var oldI = h('input', { type: 'password', autocomplete: 'current-password' });
    var newI = h('input', { type: 'password', autocomplete: 'new-password' });
    var newI2 = h('input', { type: 'password', autocomplete: 'new-password' });
    modal('Đổi mật khẩu', h('div', { class: 'form' },
      field('Mật khẩu hiện tại', oldI),
      field('Mật khẩu mới (ít nhất 6 ký tự)', newI),
      field('Nhập lại mật khẩu mới', newI2)), function (close) {
      var ok = h('button', { class: 'btn' }, 'Lưu mật khẩu');
      ok.addEventListener('click', function () {
        if (newI.value.length < 6) return toast('Mật khẩu mới cần ít nhất 6 ký tự.', 'error');
        if (newI.value !== newI2.value) return toast('Hai lần nhập mật khẩu mới không khớp.', 'error');
        busy(ok, true);
        api('changePassword', { oldPassword: oldI.value, newPassword: newI.value }).then(function () {
          close();
          toast('Đã đổi mật khẩu.', 'success');
        }, function (e) { busy(ok, false); toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  /* ═════════ Đăng nhập ═════════ */

  function renderLogin() {
    var u = h('input', { name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    var p = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true });
    var btn = h('button', { class: 'btn btn-block', type: 'submit' }, 'Đăng nhập');
    var form = h('form', { class: 'form' }, field('Tên đăng nhập', u), field('Mật khẩu', p), btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      busy(btn, true, 'Đang đăng nhập…');
      api('login', { username: u.value, password: p.value }).then(function (d) {
        setSession(d.token, d.user);
        if (!location.hash || location.hash === '#') location.hash = '#/';
        route();
      }, function (err) {
        busy(btn, false);
        toast(err.message, 'error');
        p.select();
      });
    });
    fill(app, h('section', { class: 'login' },
      h('div', { class: 'login-card' },
        h('p', { class: 'eyebrow' }, 'Khu học tập'),
        h('h1', null, 'Đăng nhập'),
        h('p', { class: 'muted' }, 'Dùng tài khoản do trung tâm cấp để vào lớp học.'),
        !API ? h('p', { class: 'notice' }, 'Khu học tập đang được cài đặt, vui lòng quay lại sau.') : null,
        form,
        h('p', { class: 'small muted' }, 'Chưa có tài khoản hoặc quên mật khẩu? Liên hệ ' + CONTACT + '.'))));
    u.focus();
  }

  /* ═════════ Trang chính ═════════ */

  function renderHome() {
    var greet = {
      admin: 'Quản lý khóa học, bài tập và tài khoản.',
      teacher: 'Chọn khóa học để đăng tài liệu, giao bài và chấm bài.',
      student: 'Xem bài cần làm và vào lớp học của em.'
    }[me.role];
    var todoBox = h('div');
    var grid = h('div', { class: 'grid courses' }, loading());
    fill(app,
      h('div', { class: 'page-head' }, h('h1', null, 'Xin chào, ' + me.fullName), h('p', { class: 'muted' }, greet)),
      todoBox,
      h('h2', { class: 'section-title' }, 'Khóa học của ' + (me.role === 'student' ? 'em' : 'bạn')),
      grid);

    getCourses(true).then(function (list) {
      if (!list.length) {
        fill(grid, h('div', { class: 'panel empty span-all' },
          h('p', null, 'Bạn chưa được ghi danh vào khóa học nào.'),
          h('p', { class: 'muted' }, 'Liên hệ ' + CONTACT + ' để được mở khóa học.')));
        return;
      }
      fill(grid, list.map(courseCard));
      api('todo').then(function (d) { renderTodo(todoBox, d.items); }, function () {});
    }, function (e) { fill(grid, errorBox(e.message, renderHome)); });
  }

  function renderTodo(box, items) {
    if (me.role === 'student') {
      var todo = items.filter(function (i) { return i.my.status === 'todo'; })
        .sort(function (a, b) { return (a.dueAt || '9') < (b.dueAt || '9') ? -1 : 1; });
      var graded = items.filter(function (i) { return i.my.status === 'returned'; }).slice(0, 3);
      if (!todo.length && !graded.length) return;
      fill(box,
        h('h2', { class: 'section-title' }, todo.length ? 'Bài tập cần làm (' + todo.length + ')' : 'Bài tập'),
        todo.length ? h('div', { class: 'task-list' }, todo.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-hw' }, 'BÀI TẬP'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, i.courseName + ' · ' + i.courseGrade)),
            dueBadge(i.dueAt, false));
        })) : h('p', { class: 'panel ok-panel' }, '🎉 Em đã nộp hết bài tập. Giỏi lắm!'),
        graded.length ? h('div', { class: 'task-list compact' }, graded.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-done' }, 'ĐÃ CHẤM'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, i.courseName)),
            statusPill(i.my, i.maxScore));
        })) : null);
    } else if (items.length) {
      fill(box,
        h('h2', { class: 'section-title' }, 'Bài cần chấm'),
        h('div', { class: 'task-list' }, items.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-hw' }, 'CHẤM'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, i.courseName + ' · ' + i.courseGrade)),
            h('span', { class: 'pill p-wait' }, i.stats.ungraded + ' bài chưa chấm'));
        })));
    }
  }

  function courseCard(c, i) {
    var bits = [c.docCount + ' tài liệu', c.quizCount + ' bài luyện', c.assignmentCount + ' bài tập'];
    return h('a', { class: 'card course', href: '#/khoa/' + encodeURIComponent(c.id), style: '--c:' + COURSE_COLORS[i % COURSE_COLORS.length] },
      h('span', { class: 'tag' }, c.grade),
      h('h3', null, c.name),
      h('p', null, c.teachers.length ? c.teachers.join(', ') : 'Chưa phân giáo viên'),
      h('p', { class: 'course-meta' }, bits.join(' · '),
        c.canEdit && me.role !== 'student' ? h('span', { class: 'pill p-blue' }, 'Bạn quản lý') : null));
  }

  function courseColor(id) {
    var idx = (coursesCache || []).findIndex(function (c) { return c.id === id; });
    return COURSE_COLORS[(idx < 0 ? 0 : idx) % COURSE_COLORS.length];
  }

  /* ═════════ Trang khóa học: chủ đề → tài liệu, luyện tập, bài tập ═════════ */

  var courseFilter = 'all';

  function topicSort(a, b) {
    if (a === NO_TOPIC) return 1;
    if (b === NO_TOPIC) return -1;
    return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
  }

  function renderCourse(id) {
    fill(app, loading());
    Promise.all([api('course', { courseId: id }), getCourses()]).then(function (res) {
      drawCourse(res[0]);
    }, function (e) {
      fill(app, h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'), errorBox(e.message, function () { renderCourse(id); }));
    });
  }

  function drawCourse(d) {
    var c = d.course;
    var edit = c.canEdit;
    var reload = function () { coursesCache = null; renderCourse(c.id); };

    var filters = [['all', 'Tất cả'], ['doc', 'Tài liệu (' + d.docs.length + ')'], ['quiz', 'Luyện tập (' + d.quizzes.length + ')'], ['hw', 'Bài tập (' + d.assignments.length + ')']];
    var content = h('div');
    var chipBar = h('div', { class: 'chips filter' });
    function drawFilters() {
      fill(chipBar, filters.map(function (f) {
        return h('button', { class: 'chip-btn' + (courseFilter === f[0] ? ' active' : ''), onclick: function () { courseFilter = f[0]; drawFilters(); drawContent(); } }, f[1]);
      }));
    }

    function drawContent() {
      var items = [];
      if (courseFilter === 'all' || courseFilter === 'doc') d.docs.forEach(function (x) { items.push({ kind: 'doc', x: x }); });
      if (courseFilter === 'all' || courseFilter === 'quiz') d.quizzes.forEach(function (x) { items.push({ kind: 'quiz', x: x }); });
      if (courseFilter === 'all' || courseFilter === 'hw') d.assignments.forEach(function (x) { items.push({ kind: 'hw', x: x }); });
      if (!items.length) {
        fill(content, h('div', { class: 'panel empty' },
          h('p', null, 'Chưa có nội dung nào' + (courseFilter === 'all' ? ' trong khóa này.' : ' ở mục này.')),
          edit ? h('p', { class: 'muted' }, 'Dùng các nút "+ Tài liệu", "+ Luyện tập", "+ Bài tập" ở trên để thêm.') : null));
        return;
      }
      var groups = {};
      items.forEach(function (it) { var t = it.x.topic || NO_TOPIC; (groups[t] = groups[t] || []).push(it); });
      var order = { hw: 0, quiz: 1, doc: 2 };
      fill(content, Object.keys(groups).sort(topicSort).map(function (t) {
        var list = groups[t].sort(function (a, b) { return order[a.kind] - order[b.kind]; });
        return h('details', { class: 'topic', open: true },
          h('summary', null, h('span', { class: 'topic-name' }, t), h('span', { class: 'topic-count' }, list.length + ' mục')),
          h('div', { class: 'topic-items' }, list.map(function (it) {
            if (it.kind === 'doc') return docRow(it.x, edit, d.topics, reload);
            if (it.kind === 'quiz') return quizRow(it.x, edit);
            return hwRow(it.x, edit);
          })));
      }));
    }

    var adds = edit ? h('div', { class: 'add-bar' },
      h('button', { class: 'btn btn-sm', onclick: function () { docForm(c, d.topics, null, reload); } }, '+ Tài liệu'),
      h('button', { class: 'btn btn-sm', onclick: function () { go('#/soan-de/' + encodeURIComponent(c.id)); } }, '+ Luyện tập'),
      h('button', { class: 'btn btn-sm', onclick: function () { assignmentForm(c, d.topics, null, function (a) { go('#/bai/' + a.id); }); } }, '+ Bài tập')) : null;

    fill(app,
      h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(c.id) },
        h('span', { class: 'tag' }, c.grade),
        h('h1', null, c.name)),
      h('div', { class: 'course-tools' }, chipBar, adds),
      content);
    drawFilters();
    drawContent();
  }

  function rowMenu(items) {
    return h('details', { class: 'row-menu' },
      h('summary', { 'aria-label': 'Thêm thao tác', title: 'Thêm thao tác' }, '⋯'),
      h('div', { class: 'row-menu-list' }, items.map(function (it) {
        return h('button', { class: it[2] ? 'danger' : '', onclick: function (e) { e.target.closest('details').open = false; it[1](); } }, it[0]);
      })));
  }

  function docRow(doc, edit, topics, reload) {
    var kind = doc.type === 'link' ? (/youtu\.?be/i.test(doc.url) ? ['VIDEO', 'k-video'] : ['LINK', 'k-link']) : fileKind(doc.mimeType, doc.fileName);
    var fetcher = function () { return api('file', { id: doc.id }); };
    var actions = doc.type === 'link'
      ? [h('a', { class: 'btn btn-sm', href: doc.url, target: '_blank', rel: 'noopener' }, 'Mở link')]
      : fileButtons(doc.title, { mimeType: doc.mimeType, name: doc.fileName }, 'doc:' + doc.id, fetcher);
    if (edit) {
      actions.push(rowMenu([
        ['Sửa tên / chủ đề', function () { docForm({ id: doc.courseId }, topics, doc, reload); }],
        ['Xóa tài liệu', function () {
          confirmBox('Xóa tài liệu?', 'Tài liệu "' + doc.title + '" sẽ bị xóa khỏi khóa học. File gốc được chuyển vào Thùng rác của Google Drive.', 'Xóa', function () {
            return api('deleteDoc', { id: doc.id }).then(function () { toast('Đã xóa tài liệu.', 'success'); reload(); });
          });
        }, true]
      ]));
    }
    var meta = [doc.uploadedBy, fmtDate(doc.uploadedAt), doc.type === 'file' ? fmtSize(doc.size) : null].filter(Boolean).join(' · ');
    return h('article', { class: 'item' },
      h('span', { class: 'kind ' + kind[1] }, kind[0]),
      h('div', { class: 'item-main' },
        h('h3', null, doc.title),
        doc.description ? h('p', { class: 'item-desc' }, doc.description) : null,
        h('p', { class: 'item-meta' }, meta)),
      h('div', { class: 'item-actions' }, actions));
  }

  function quizRow(q, edit) {
    var info = [q.count + ' câu', q.timeLimit ? q.timeLimit + ' phút' : null].filter(Boolean).join(' · ');
    var right;
    if (edit) right = h('span', { class: 'pill p-blue' }, q.stats.students + '/' + q.stats.totalStudents + ' HS đã làm');
    else if (q.my) right = h('span', { class: 'pill ' + (q.my.best === q.my.total ? 'p-done' : 'p-wait') }, 'Cao nhất ' + q.my.best + '/' + q.my.total);
    else right = h('span', { class: 'pill p-todo' }, 'Chưa làm');
    return h('a', { class: 'item link', href: '#/luyen/' + q.id },
      h('span', { class: 'kind k-quiz' }, 'LUYỆN'),
      h('div', { class: 'item-main' },
        h('h3', null, q.title),
        q.description ? h('p', { class: 'item-desc' }, q.description) : null,
        h('p', { class: 'item-meta' }, info)),
      h('div', { class: 'item-actions' }, right, h('span', { class: 'chev' }, '›')));
  }

  function hwRow(a, edit) {
    var right;
    if (edit) {
      right = h('span', { class: 'pill ' + (a.stats.ungraded ? 'p-wait' : 'p-blue') },
        'Đã nộp ' + a.stats.submitted + '/' + a.stats.students + (a.stats.ungraded ? ' · ' + a.stats.ungraded + ' chưa chấm' : ''));
    } else {
      right = statusPill(a.my, a.maxScore);
    }
    var done = edit || (a.my && a.my.status !== 'todo');
    return h('a', { class: 'item link', href: '#/bai/' + a.id },
      h('span', { class: 'kind k-hw' }, 'BÀI TẬP'),
      h('div', { class: 'item-main' },
        h('h3', null, a.title),
        h('p', { class: 'item-meta' }, dueBadge(a.dueAt, done))),
      h('div', { class: 'item-actions' }, right, h('span', { class: 'chev' }, '›')));
  }

  function topicInput(topics, value) {
    var listId = 'topics-' + Math.random().toString(36).slice(2);
    var input = h('input', { list: listId, value: value || '', maxlength: '100', placeholder: 'VD: Chủ đề 1: Phân số' });
    return [input, h('datalist', { id: listId }, (topics || []).slice().sort(topicSort).map(function (t) { return h('option', { value: t }); }))];
  }

  /** Thêm tài liệu (doc = null) hoặc sửa tên/chủ đề/mô tả. */
  function docForm(c, topics, doc, onDone) {
    var mode = 'file';
    var ti = topicInput(topics, doc ? doc.topic : '');
    var title = h('input', { maxlength: '200', value: doc ? doc.title : '', placeholder: 'VD: Bài 3 – Phân số (lý thuyết + bài tập)' });
    var desc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ghi chú cho học sinh (không bắt buộc)' });
    desc.value = doc ? doc.description : '';
    var file = h('input', { type: 'file' });
    var url = h('input', { type: 'url', placeholder: 'https://youtu.be/… hoặc link Google Drive, Quizizz…' });
    var fileField = field('Chọn file (PDF, Word, ảnh… tối đa 20 MB)', file, 'PDF và ảnh: học sinh xem trực tiếp trên web hoặc tải về.');
    var urlField = field('Đường link', url, 'Với video, hãy đăng lên YouTube (chế độ Không công khai) rồi dán link vào đây.');
    urlField.hidden = true;
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (f && !title.value.trim()) title.value = f.name.replace(/\.[^.]+$/, '');
    });
    var tabFile = h('button', { type: 'button', class: 'seg active' }, 'Tải file lên');
    var tabLink = h('button', { type: 'button', class: 'seg' }, 'Dán đường link');
    function setMode(m) {
      mode = m;
      tabFile.classList.toggle('active', m === 'file');
      tabLink.classList.toggle('active', m === 'link');
      fileField.hidden = m !== 'file';
      urlField.hidden = m !== 'link';
    }
    tabFile.addEventListener('click', function () { setMode('file'); });
    tabLink.addEventListener('click', function () { setMode('link'); });

    var body = h('div', { class: 'form' },
      doc ? null : h('div', { class: 'segmented' }, tabFile, tabLink),
      doc ? null : fileField, doc ? null : urlField,
      field('Tiêu đề', title),
      field('Chủ đề', ti, 'Chọn chủ đề có sẵn hoặc gõ tên chủ đề mới.'),
      field('Mô tả', desc));

    modal(doc ? 'Sửa tài liệu' : 'Thêm tài liệu', body, function (close) {
      var ok = h('button', { class: 'btn' }, doc ? 'Lưu' : 'Đăng tài liệu');
      ok.addEventListener('click', function () {
        var params = { courseId: c.id, title: title.value.trim(), description: desc.value.trim(), topic: ti[0].value.trim() };
        var job;
        if (doc) {
          if (!params.title) return toast('Vui lòng nhập tiêu đề.', 'error');
          busy(ok, true);
          job = api('updateDoc', Object.assign(params, { id: doc.id }));
        } else if (mode === 'file') {
          var f = file.files[0];
          if (!f) return toast('Vui lòng chọn file.', 'error');
          if (f.size > MAX_BYTES) return toast('File quá lớn (tối đa 20 MB). Với video, hãy đăng YouTube rồi dán link.', 'error');
          if (!params.title) params.title = f.name.replace(/\.[^.]+$/, '');
          busy(ok, true, 'Đang tải lên…');
          job = readBase64(f).then(function (data) {
            return api('upload', Object.assign(params, { fileName: f.name, mimeType: f.type || 'application/octet-stream', data: data }));
          });
        } else {
          if (!/^https?:\/\/\S+$/i.test(url.value.trim())) return toast('Đường link phải bắt đầu bằng http:// hoặc https://', 'error');
          if (!params.title) return toast('Vui lòng nhập tiêu đề.', 'error');
          busy(ok, true, 'Đang lưu…');
          job = api('upload', Object.assign(params, { url: url.value.trim() }));
        }
        job.then(function () {
          close();
          toast(doc ? 'Đã lưu.' : 'Đã đăng tài liệu.', 'success');
          onDone();
        }, function (err) { busy(ok, false); toast(err.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  /* ═════════ Bài tập về nhà ═════════ */

  function assignmentForm(c, topics, a, onDone) {
    var ti = topicInput(topics, a ? a.topic : '');
    var title = h('input', { maxlength: '200', value: a ? a.title : '', placeholder: 'VD: Bài tập về nhà tuần 3' });
    var instr = h('textarea', { rows: '4', maxlength: '5000', placeholder: 'Đề bài hoặc hướng dẫn, ví dụ: Làm bài 1, 2, 3 trang 15. Chụp ảnh rõ nét từng trang.' });
    instr.value = a ? a.instructions : '';
    var due = h('input', { type: 'datetime-local', value: a ? toLocalInput(a.dueAt) : '' });
    var max = h('input', { type: 'number', min: '1', max: '1000', step: '1', value: a ? String(a.maxScore) : '10' });
    var file = h('input', { type: 'file' });
    var removeFile = h('input', { type: 'checkbox' });
    var body = h('div', { class: 'form' },
      field('Tên bài tập', title),
      field('Chủ đề', ti),
      field('Đề bài / hướng dẫn', instr),
      h('div', { class: 'row two' }, field('Hạn nộp (để trống nếu không có hạn)', due), field('Thang điểm', max)),
      field(a && a.file ? 'Thay file đề bài (đang có: ' + a.file.name + ')' : 'File đề bài (không bắt buộc)', file),
      a && a.file ? h('label', { class: 'check' }, removeFile, 'Bỏ file đề bài hiện tại') : null);
    modal(a ? 'Sửa bài tập' : 'Giao bài tập mới', body, function (close) {
      var ok = h('button', { class: 'btn' }, a ? 'Lưu' : 'Giao bài');
      ok.addEventListener('click', function () {
        if (!title.value.trim()) return toast('Vui lòng nhập tên bài tập.', 'error');
        var params = {
          courseId: c.id, id: a ? a.id : undefined, title: title.value.trim(), topic: ti[0].value.trim(),
          instructions: instr.value.trim(), maxScore: max.value,
          dueAt: due.value ? new Date(due.value).toISOString() : '',
          removeFile: removeFile.checked
        };
        var f = file.files[0];
        if (f && f.size > MAX_BYTES) return toast('File quá lớn (tối đa 20 MB).', 'error');
        busy(ok, true, f ? 'Đang tải lên…' : 'Đang lưu…');
        (f ? readBase64(f).then(function (data) { return Object.assign(params, { data: data, fileName: f.name, mimeType: f.type || 'application/octet-stream' }); }) : Promise.resolve(params))
          .then(function (p) { return api(a ? 'updateAssignment' : 'createAssignment', p); })
          .then(function (r) {
            close();
            coursesCache = null;
            toast(a ? 'Đã lưu bài tập.' : 'Đã giao bài.', 'success');
            onDone(r.assignment);
          }, function (err) { busy(ok, false); toast(err.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  function renderAssignment(id) {
    fill(app, loading());
    Promise.all([api('assignment', { id: id }), getCourses()]).then(function (res) {
      var d = res[0];
      if (d.canEdit) drawAssignmentTeacher(d); else drawAssignmentStudent(d);
    }, function (e) {
      fill(app, h('a', { href: '#/', class: 'back' }, '← Trang chủ'), errorBox(e.message, function () { renderAssignment(id); }));
    });
  }

  function assignmentHeader(d, extra) {
    var a = d.assignment;
    var fetcher = function () { return api('assignmentFile', { id: a.id }); };
    return [
      h('a', { href: '#/khoa/' + encodeURIComponent(d.course.id), class: 'back' }, '← ' + d.course.name + ' · ' + d.course.grade),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(d.course.id) },
        h('span', { class: 'tag' }, a.topic || 'Bài tập về nhà'),
        h('h1', null, a.title),
        h('p', { class: 'head-meta' }, dueBadge(a.dueAt, d.canEdit || (d.submission && d.submission.status !== 'todo')),
          h('span', { class: 'muted small' }, 'Thang điểm ' + fmtScore(a.maxScore) + ' · Giao bởi ' + a.createdBy)),
        extra || null),
      (a.instructions || a.file) ? h('div', { class: 'panel' },
        a.instructions ? h('p', { class: 'prewrap' }, a.instructions) : null,
        a.file ? h('div', { class: 'file-row' },
          h('span', { class: 'kind sm ' + fileKind(a.file.mimeType, a.file.name)[1] }, fileKind(a.file.mimeType, a.file.name)[0]),
          h('span', { class: 'file-name' }, a.file.name),
          fileButtons(a.title, a.file, 'asg:' + a.id, fetcher)) : null) : null
    ];
  }

  /* —— Học sinh: nộp bài —— */

  function drawAssignmentStudent(d) {
    var a = d.assignment;
    var s = d.submission;
    var box = h('div');
    fill(app, assignmentHeader(d), box);

    if (!d.canSubmit) {
      fill(box, h('div', { class: 'panel muted' }, 'Chỉ học sinh của khóa này mới nộp bài được.'));
      return;
    }
    if (!s) return fill(box, submitForm(d, null));

    var files = h('div', { class: 'file-grid' }, s.files.map(function (f) { return submissionFileTile(s, f); }));
    var card = h('div', { class: 'panel status-card ' + (s.status === 'returned' ? 'graded' : 'waiting') },
      s.status === 'returned'
        ? h('div', { class: 'score-big' }, h('span', null, fmtScore(s.score)), h('small', null, '/' + fmtScore(a.maxScore)))
        : h('div', { class: 'status-icon' }, '✓'),
      h('div', { class: 'status-main' },
        h('h3', null, s.status === 'returned' ? 'Đã chấm bài' : 'Đã nộp bài, chờ giáo viên chấm'),
        h('p', { class: 'muted small' }, 'Nộp lúc ' + fmtDateTime(s.submittedAt) + (s.late ? ' · nộp muộn' : '') +
          (s.status === 'returned' ? ' · Chấm bởi ' + s.gradedBy : '')),
        s.feedback ? h('div', { class: 'feedback' }, h('strong', null, 'Nhận xét của giáo viên'), h('p', { class: 'prewrap' }, s.feedback)) : null));
    fill(box,
      card,
      h('h2', { class: 'section-title' }, 'Bài em đã nộp'),
      s.text ? h('div', { class: 'panel prewrap' }, s.text) : null,
      s.files.length ? files : null,
      s.status !== 'returned' ? h('div', { class: 'actions-end' },
        h('button', { class: 'btn btn-ghost', onclick: function () { fill(box, submitForm(d, s)); } }, 'Sửa / nộp lại')) : null);
  }

  function submissionFileTile(s, f) {
    var key = 'sub:' + s.id + ':' + f.id;
    var fetcher = function () { return api('submissionFile', { submissionId: s.id, fileId: f.id }); };
    var isImg = /^image\//.test(f.mimeType);
    var thumb = h('button', { class: 'tile-thumb', 'aria-label': 'Xem ' + f.name, onclick: function () { openViewer(f.name, key, fetcher); } });
    if (isImg) {
      thumb.append(h('span', { class: 'spinner' }));
      getBlob(key, fetcher).then(function (r) {
        fill(thumb, h('img', { src: URL.createObjectURL(r.blob), alt: f.name, loading: 'lazy' }));
      }, function () { fill(thumb, h('span', { class: 'kind k-image' }, 'ẢNH')); });
    } else {
      var k = fileKind(f.mimeType, f.name);
      thumb.append(h('span', { class: 'kind ' + k[1] }, k[0]));
    }
    return h('div', { class: 'tile' }, thumb,
      h('div', { class: 'tile-name', title: f.name }, f.name),
      h('button', { class: 'tile-dl', onclick: function (e) { download(key, fetcher, e.target); } }, 'Tải'));
  }

  /** Khung nộp bài: chụp ảnh / chọn file, xem trước, xóa từng file, lời nhắn. */
  function submitForm(d, s) {
    var a = d.assignment;
    var kept = s ? s.files.slice() : [];
    var picked = []; // { file, url }
    var grid = h('div', { class: 'file-grid' });
    var note = h('textarea', { rows: '3', maxlength: '5000', placeholder: 'Lời nhắn cho giáo viên hoặc câu trả lời ngắn (không bắt buộc)' });
    note.value = s ? s.text : '';

    var pickInput = h('input', { type: 'file', multiple: true, accept: 'image/*,application/pdf,.doc,.docx', hidden: true });
    var camInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    function onPick(e) {
      Array.prototype.forEach.call(e.target.files, function (f) {
        if (kept.length + picked.length >= MAX_FILES) return toast('Tối đa ' + MAX_FILES + ' file mỗi bài.', 'error');
        picked.push({ file: f, url: /^image\//.test(f.type) ? URL.createObjectURL(f) : null });
      });
      e.target.value = '';
      draw();
    }
    pickInput.addEventListener('change', onPick);
    camInput.addEventListener('change', onPick);

    var drop = h('div', { class: 'dropzone' },
      h('div', { class: 'drop-icon' }, '📷'),
      h('p', null, h('strong', null, 'Chụp ảnh bài làm'), ' hoặc chọn ảnh / file PDF'),
      h('div', { class: 'drop-actions' },
        h('button', { type: 'button', class: 'btn', onclick: function () { camInput.click(); } }, 'Chụp ảnh'),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { pickInput.click(); } }, 'Chọn ảnh / file')),
      h('p', { class: 'muted small' }, 'Tối đa ' + MAX_FILES + ' file. Ảnh được tự động thu nhỏ để gửi nhanh.'),
      pickInput, camInput);
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { onPick({ target: { files: e.dataTransfer.files, value: '' } }); });

    function draw() {
      var tiles = [];
      kept.forEach(function (f, i) {
        var t = submissionFileTile(s, f);
        t.append(h('button', { class: 'tile-x', 'aria-label': 'Bỏ file', onclick: function () { kept.splice(i, 1); draw(); } }, '×'));
        tiles.push(t);
      });
      picked.forEach(function (p, i) {
        var k = fileKind(p.file.type, p.file.name);
        tiles.push(h('div', { class: 'tile new' },
          h('div', { class: 'tile-thumb' }, p.url ? h('img', { src: p.url, alt: p.file.name }) : h('span', { class: 'kind ' + k[1] }, k[0])),
          h('div', { class: 'tile-name', title: p.file.name }, p.file.name),
          h('span', { class: 'tile-badge' }, 'Mới'),
          h('button', { class: 'tile-x', 'aria-label': 'Bỏ file', onclick: function () { if (p.url) URL.revokeObjectURL(p.url); picked.splice(i, 1); draw(); } }, '×')));
      });
      fill(grid, tiles);
      grid.hidden = !tiles.length;
    }
    draw();

    var btn = h('button', { class: 'btn btn-lg' }, s ? 'Nộp lại bài' : 'Nộp bài');
    btn.addEventListener('click', function () {
      if (!kept.length && !picked.length && !note.value.trim()) return toast('Hãy chụp ảnh / chọn file bài làm hoặc viết câu trả lời.', 'error');
      busy(btn, true, picked.length ? 'Đang chuẩn bị ảnh…' : 'Đang nộp…');
      Promise.all(picked.map(function (p) { return compressImage(p.file); })).then(function (files) {
        var total = files.reduce(function (n, f) { return n + f.size; }, 0);
        if (total > MAX_BYTES) throw new Error('Tổng dung lượng quá lớn (' + fmtSize(total) + ', tối đa 20 MB). Hãy bớt file.');
        btn.textContent = 'Đang gửi bài…';
        return Promise.all(files.map(function (f) {
          return readBase64(f).then(function (data) { return { name: f.name, mimeType: f.type || 'application/octet-stream', data: data }; });
        }));
      }).then(function (files) {
        return api('submit', { assignmentId: a.id, text: note.value.trim(), keepFileIds: kept.map(function (f) { return f.id; }), files: files });
      }).then(function () {
        leaveGuard = null;
        toast('Đã nộp bài!', 'success');
        renderAssignment(a.id);
      }, function (e) { busy(btn, false); toast(e.message, 'error'); });
    });

    leaveGuard = function () { return !picked.length || confirm('Em chưa nộp bài. Rời trang này?'); };

    return h('div', { class: 'panel submit-panel' },
      h('h2', null, s ? 'Sửa bài nộp' : 'Nộp bài'),
      drop, grid,
      field('Lời nhắn', note),
      h('div', { class: 'actions-end' },
        s ? h('button', { class: 'btn btn-ghost', onclick: function () { leaveGuard = null; renderAssignment(a.id); } }, 'Hủy') : null,
        btn));
  }

  /* —— Giáo viên: danh sách nộp & chấm bài —— */

  var hwFilter = 'ungraded';

  function drawAssignmentTeacher(d) {
    var a = d.assignment;
    var list = d.students;
    var count = function (fn) { return list.filter(fn).length; };
    var isSub = function (x) { return !!x.submission; };
    var isGraded = function (x) { return x.submission && x.submission.status === 'returned'; };
    var isUngraded = function (x) { return x.submission && x.submission.status !== 'returned'; };
    var filters = [
      ['ungraded', 'Chưa chấm', isUngraded],
      ['missing', 'Chưa nộp', function (x) { return !x.submission; }],
      ['graded', 'Đã chấm', isGraded],
      ['all', 'Tất cả', function () { return true; }]
    ];
    var tools = h('div', { class: 'head-tools' },
      h('button', { class: 'btn btn-sm btn-ghost', onclick: function () {
        api('course', { courseId: d.course.id }).then(function (c) { assignmentForm(d.course, c.topics, a, function () { renderAssignment(a.id); }); });
      } }, 'Sửa bài tập'),
      h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () {
        confirmBox('Xóa bài tập?', 'Xóa "' + a.title + '" cùng toàn bộ bài nộp của học sinh. Không thể hoàn tác.', 'Xóa', function () {
          return api('deleteAssignment', { id: a.id }).then(function () { toast('Đã xóa bài tập.', 'success'); go('#/khoa/' + encodeURIComponent(d.course.id)); });
        });
      } }, 'Xóa'));

    var listBox = h('div', { class: 'student-list' });
    var chipBar = h('div', { class: 'chips filter' });
    function drawList() {
      fill(chipBar, filters.map(function (f) {
        return h('button', { class: 'chip-btn' + (hwFilter === f[0] ? ' active' : ''), onclick: function () { hwFilter = f[0]; drawList(); } }, f[1] + ' (' + count(f[2]) + ')');
      }));
      var fn = filters.filter(function (f) { return f[0] === hwFilter; })[0][2];
      var shown = list.filter(fn);
      if (!shown.length) {
        fill(listBox, h('div', { class: 'panel empty' }, h('p', null,
          hwFilter === 'ungraded' ? 'Không còn bài nào chờ chấm 👍' : hwFilter === 'missing' ? 'Tất cả học sinh đã nộp bài.' : 'Chưa có học sinh nào ở mục này.')));
        return;
      }
      fill(listBox, shown.map(function (x) {
        var s = x.submission;
        return h('button', { class: 'student-row', disabled: !s, onclick: function () { gradeView(d, list.indexOf(x)); } },
          h('span', { class: 'avatar sm' }, initials(x.fullName)),
          h('span', { class: 'student-name' }, x.fullName, x.left ? h('small', { class: 'muted' }, ' (đã rời khóa)') : null),
          h('span', { class: 'muted small' }, s ? fmtDateTime(s.submittedAt) + (s.late ? ' · muộn' : '') + (s.files.length ? ' · ' + s.files.length + ' file' : '') : ''),
          s ? (s.status === 'returned' ? h('span', { class: 'pill p-done' }, fmtScore(s.score) + '/' + fmtScore(a.maxScore)) : h('span', { class: 'pill p-wait' }, 'Chấm bài'))
            : h('span', { class: 'pill p-todo' }, 'Chưa nộp'));
      }));
    }

    fill(app,
      assignmentHeader(d, tools),
      h('div', { class: 'stats' },
        stat(count(isSub) + '/' + list.length, 'Đã nộp'),
        stat(count(isUngraded), 'Chờ chấm', count(isUngraded) ? 'warn' : ''),
        stat(count(isGraded), 'Đã chấm'),
        stat(avgScore(list), 'Điểm trung bình')),
      chipBar, listBox);
    drawList();
  }

  function stat(value, label, cls) {
    return h('div', { class: 'stat ' + (cls || '') }, h('strong', null, String(value)), h('span', null, label));
  }
  function avgScore(list) {
    var g = list.filter(function (x) { return x.submission && x.submission.status === 'returned'; });
    if (!g.length) return '–';
    return fmtScore(g.reduce(function (n, x) { return n + x.submission.score; }, 0) / g.length);
  }
  function initials(name) {
    var parts = String(name).trim().split(/\s+/);
    return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
  }

  /** Màn chấm bài: xem ảnh bài làm ngay, nhập điểm + nhận xét, sang bài tiếp. */
  function gradeView(d, index) {
    var a = d.assignment;
    var x = d.students[index];
    var s = x.submission;
    var score = h('input', { type: 'text', inputmode: 'decimal', class: 'score-input', value: s.score != null ? String(s.score).replace('.', ',') : '', placeholder: '0–' + a.maxScore });
    var fb = h('textarea', { rows: '4', maxlength: '3000', placeholder: 'Nhận xét cho học sinh (không bắt buộc)' });
    fb.value = s.feedback || '';
    var nextUngraded = function () {
      for (var i = 1; i <= d.students.length; i++) {
        var j = (index + i) % d.students.length;
        var y = d.students[j];
        if (y.submission && y.submission.status !== 'returned' && j !== index) return j;
      }
      return -1;
    };

    var work = h('div', { class: 'grade-work' },
      s.text ? h('div', { class: 'panel prewrap' }, s.text) : null,
      s.files.map(function (f) {
        var key = 'sub:' + s.id + ':' + f.id;
        var fetcher = function () { return api('submissionFile', { submissionId: s.id, fileId: f.id }); };
        if (/^image\//.test(f.mimeType)) {
          var holder = h('div', { class: 'work-img' }, loading('Đang tải ảnh…'));
          getBlob(key, fetcher).then(function (r) {
            var img = h('img', { src: URL.createObjectURL(r.blob), alt: f.name });
            img.addEventListener('click', function () { openViewer(f.name, key, fetcher); });
            fill(holder, img);
          }, function (e) { fill(holder, h('p', { class: 'err' }, e.message)); });
          return holder;
        }
        var k = fileKind(f.mimeType, f.name);
        return h('div', { class: 'file-row' }, h('span', { class: 'kind sm ' + k[1] }, k[0]), h('span', { class: 'file-name' }, f.name), fileButtons(f.name, f, key, fetcher));
      }),
      !s.text && !s.files.length ? h('p', { class: 'muted' }, 'Bài nộp trống.') : null);

    var side = h('div', { class: 'grade-side' },
      h('label', { class: 'field' }, h('span', null, 'Điểm (thang ' + fmtScore(a.maxScore) + ')'), score),
      h('div', { class: 'quick-scores' }, quickScores(a.maxScore).map(function (v) {
        return h('button', { type: 'button', class: 'chip-btn', onclick: function () { score.value = String(v).replace('.', ','); } }, fmtScore(v));
      })),
      field('Nhận xét', fb),
      s.status === 'returned' ? h('p', { class: 'muted small' }, 'Đã chấm ' + fmtDateTime(s.gradedAt) + ' bởi ' + s.gradedBy) : null);

    var title = x.fullName + ' · nộp ' + fmtDateTime(s.submittedAt) + (s.late ? ' (muộn)' : '');
    modal(title, h('div', { class: 'grade' }, work, side), function (close) {
      function save(next) {
        var btn = next ? nextBtn : saveBtn;
        busy(btn, true, 'Đang lưu…');
        return api('grade', { submissionId: s.id, score: score.value, feedback: fb.value }).then(function (r) {
          x.submission = r.submission;
          close();
          toast('Đã lưu điểm cho ' + x.fullName + '.', 'success');
          var n = nextUngraded();
          if (next && n >= 0) gradeView(d, n); else drawAssignmentTeacher(d);
        }, function (e) { busy(btn, false); toast(e.message, 'error'); });
      }
      var saveBtn = h('button', { class: 'btn btn-ghost' }, 'Lưu điểm');
      var nextBtn = h('button', { class: 'btn' }, 'Lưu & chấm bài tiếp');
      saveBtn.addEventListener('click', function () { save(false); });
      nextBtn.addEventListener('click', function () { save(true); });
      var reopen = s.status === 'returned' ? h('button', { class: 'btn btn-ghost', title: 'Cho học sinh sửa và nộp lại', onclick: function () {
        api('grade', { submissionId: s.id, reopen: true }).then(function (r) {
          x.submission = r.submission;
          close();
          toast('Đã mở lại cho học sinh nộp lại.', 'success');
          drawAssignmentTeacher(d);
        }, function (e) { toast(e.message, 'error'); });
      } }, 'Cho nộp lại') : null;
      return [reopen, h('span', { class: 'spacer' }), saveBtn, nextUngraded() >= 0 ? nextBtn : null];
    }, { wide: true, noFocus: true });
  }

  function quickScores(max) {
    if (max === 10) return [10, 9, 8, 7, 6, 5];
    if (max === 100) return [100, 90, 80, 70, 60, 50];
    return [max, max * 0.8, max * 0.6, max * 0.5].map(function (v) { return Math.round(v * 4) / 4; });
  }

  /* ═════════ Luyện tập ═════════ */

  function renderQuiz(id) {
    fill(app, loading());
    Promise.all([api('quiz', { id: id }), getCourses()]).then(function (res) {
      var d = res[0];
      if (d.canEdit) drawQuizTeacher(d); else drawQuizStart(d);
    }, function (e) {
      fill(app, h('a', { href: '#/', class: 'back' }, '← Trang chủ'), errorBox(e.message, function () { renderQuiz(id); }));
    });
  }

  function quizHeader(d, extra) {
    var q = d.quiz;
    return [
      h('a', { href: '#/khoa/' + encodeURIComponent(d.course.id), class: 'back' }, '← ' + d.course.name + ' · ' + d.course.grade),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(d.course.id) },
        h('span', { class: 'tag' }, q.topic || 'Luyện tập'),
        h('h1', null, q.title),
        h('p', { class: 'head-meta muted' }, q.count + ' câu' + (q.timeLimit ? ' · ' + q.timeLimit + ' phút' : ' · không giới hạn thời gian')),
        extra || null)
    ];
  }

  function drawQuizStart(d) {
    var q = d.quiz;
    var best = d.myAttempts.reduce(function (b, t) { return !b || t.score > b.score ? t : b; }, null);
    fill(app,
      quizHeader(d),
      h('div', { class: 'panel quiz-start' },
        q.description ? h('p', { class: 'prewrap' }, q.description) : null,
        h('div', { class: 'stats' },
          stat(q.count, 'câu hỏi'),
          stat(q.timeLimit ? q.timeLimit + "'" : '∞', 'thời gian'),
          stat(best ? best.score + '/' + best.total : '–', 'điểm cao nhất'),
          stat(d.myAttempts.length, 'lần đã làm')),
        h('button', { class: 'btn btn-lg', onclick: function () { takeQuiz(d); } }, d.myAttempts.length ? 'Làm lại' : 'Bắt đầu làm bài')),
      d.myAttempts.length ? [
        h('h2', { class: 'section-title' }, 'Các lần đã làm'),
        h('div', { class: 'task-list compact' }, d.myAttempts.map(function (t) {
          return h('button', { class: 'task', onclick: function () { showAttempt(d, t.id); } },
            h('span', { class: 'kind ' + (t.score === t.total ? 'k-done' : 'k-quiz') }, t.score + '/' + t.total),
            h('div', { class: 'task-main' }, h('strong', null, 'Lần làm ' + fmtDateTime(t.submittedAt)), h('span', { class: 'muted small' }, Math.round(t.score / t.total * 100) + '% số câu đúng')),
            h('span', { class: 'chev' }, '›'));
        }))] : null);
  }

  function showAttempt(d, attemptId) {
    fill(app, loading());
    api('attempt', { attemptId: attemptId }).then(function (r) { drawResult(d, r); }, function (e) { toast(e.message, 'error'); renderQuiz(d.quiz.id); });
  }

  /** Làm bài: từng câu một, có thanh tiến độ, bảng câu hỏi, đồng hồ (nếu có giới hạn). */
  function takeQuiz(d) {
    var q = d.quiz;
    var qs = d.questions;
    var answers = qs.map(function () { return null; });
    var cur = 0;
    var timer = null;
    var deadline = q.timeLimit ? Date.now() + q.timeLimit * 60000 : 0;
    var submitted = false;

    var progress = h('div', { class: 'progress' }, h('div', { class: 'progress-bar' }));
    var clock = h('span', { class: 'clock' });
    var stage = h('div', { class: 'q-stage' });
    var nav = h('div', { class: 'q-nav' });
    var prev = h('button', { class: 'btn btn-ghost', onclick: function () { show(cur - 1); } }, '← Câu trước');
    var next = h('button', { class: 'btn', onclick: function () { if (cur < qs.length - 1) show(cur + 1); else finish(); } });

    leaveGuard = function () { return submitted || confirm('Em đang làm bài dở. Thoát sẽ mất bài làm này. Thoát?'); };

    function answered() { return answers.filter(function (a) { return a !== null && a !== ''; }).length; }

    function show(i) {
      cur = Math.max(0, Math.min(qs.length - 1, i));
      var x = qs[cur];
      var body;
      if (x.type === 'mc') {
        body = h('div', { class: 'options' }, x.options.map(function (o, k) {
          return h('button', { class: 'option' + (answers[cur] === k ? ' picked' : ''), onclick: function () {
            answers[cur] = k;
            show(cur);
            if (cur < qs.length - 1) setTimeout(function () { if (!submitted) show(cur + 1); }, 250);
          } }, h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o));
        }));
      } else {
        var inp = h('input', { class: 'short-input', value: answers[cur] || '', placeholder: 'Nhập đáp số…', autocomplete: 'off', inputmode: 'text' });
        inp.addEventListener('input', function () { answers[cur] = inp.value; drawNav(); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') next.click(); });
        body = h('div', null, inp);
        setTimeout(function () { inp.focus(); }, 0);
      }
      fill(stage,
        h('p', { class: 'q-num' }, 'Câu ' + (cur + 1) + ' / ' + qs.length),
        h('h2', { class: 'q-text prewrap' }, x.text),
        body);
      prev.disabled = cur === 0;
      next.textContent = cur < qs.length - 1 ? 'Câu tiếp →' : 'Nộp bài';
      next.className = 'btn' + (cur === qs.length - 1 ? ' btn-accent' : '');
      drawNav();
    }

    function drawNav() {
      progress.firstChild.style.width = (answered() / qs.length * 100) + '%';
      fill(nav, qs.map(function (_, i) {
        var done = answers[i] !== null && answers[i] !== '';
        return h('button', { class: 'q-dot' + (done ? ' done' : '') + (i === cur ? ' cur' : ''), 'aria-label': 'Câu ' + (i + 1), onclick: function () { show(i); } }, String(i + 1));
      }));
    }

    function tick() {
      var left = Math.max(0, deadline - Date.now());
      var m = Math.floor(left / 60000);
      var s = Math.floor(left / 1000) % 60;
      clock.textContent = '⏱ ' + m + ':' + String(s).padStart(2, '0');
      clock.classList.toggle('low', left < 60000);
      if (left <= 0) { clearInterval(timer); toast('Hết giờ! Bài được nộp tự động.', 'error'); send(); }
    }

    function finish() {
      var missing = qs.length - answered();
      if (missing > 0) {
        modal('Nộp bài?', h('p', null, 'Em còn ' + missing + ' câu chưa trả lời. Vẫn nộp bài chứ?'), function (close) {
          return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Làm tiếp'),
            h('button', { class: 'btn', onclick: function () { close(); send(); } }, 'Nộp bài')];
        });
      } else send();
    }

    function send() {
      if (submitted) return;
      submitted = true;
      clearInterval(timer);
      fill(app, loading('Đang chấm bài…'));
      api('submitQuiz', { quizId: q.id, answers: answers }).then(function (r) {
        leaveGuard = null;
        drawResult(d, r, true);
      }, function (e) {
        submitted = false;
        toast(e.message + ' Bấm Nộp bài để thử lại.', 'error');
        draw();
      });
    }

    function draw() {
      fill(app,
        h('div', { class: 'quiz-top' },
          h('strong', { class: 'quiz-title' }, q.title),
          deadline ? clock : null,
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { if (leaveGuard()) { leaveGuard = null; clearInterval(timer); renderQuiz(q.id); } } }, 'Thoát')),
        progress,
        h('div', { class: 'panel quiz-card' }, stage, h('div', { class: 'q-buttons' }, prev, next)),
        h('div', { class: 'q-nav-wrap' }, h('p', { class: 'muted small' }, 'Bảng câu hỏi (bấm để chuyển câu)'), nav,
          h('button', { class: 'btn btn-ghost btn-sm', onclick: finish }, 'Nộp bài')));
      show(cur);
    }

    draw();
    if (deadline) { tick(); timer = setInterval(tick, 1000); }
  }

  function drawResult(d, r, fresh) {
    var t = r.attempt;
    var pct = t.total ? Math.round(t.score / t.total * 100) : 0;
    var msg = pct === 100 ? 'Xuất sắc! Đúng hết tất cả các câu 🎉' : pct >= 80 ? 'Rất tốt! Xem lại vài câu sai nhé.' : pct >= 50 ? 'Khá rồi, cố gắng thêm chút nữa!' : 'Hãy xem lời giải rồi làm lại nhé, em sẽ tiến bộ!';
    fill(app,
      quizHeader(d),
      h('div', { class: 'panel result-card' },
        h('div', { class: 'ring', style: '--p:' + pct },
          h('div', null, h('strong', null, t.score + '/' + t.total), h('span', null, pct + '%'))),
        h('div', null,
          h('h2', null, fresh ? 'Kết quả bài làm' : 'Lần làm ' + fmtDateTime(t.submittedAt)),
          h('p', null, msg),
          h('div', { class: 'actions-start' },
            h('button', { class: 'btn', onclick: function () { takeQuiz(d); } }, 'Làm lại'),
            h('button', { class: 'btn btn-ghost', onclick: function () { renderQuiz(d.quiz.id); } }, 'Xong')))),
      h('h2', { class: 'section-title' }, 'Xem lại từng câu'),
      !r.showAnswers ? h('p', { class: 'muted small' }, 'Giáo viên đã ẩn đáp án của bài này. Em chỉ xem được câu nào đúng, câu nào sai.') : null,
      h('div', { class: 'review' }, r.review.map(function (x, i) { return reviewItem(x, i); })));
  }

  /** Một câu khi xem lại. key = true: giáo viên xem đề & đáp án (không có bài làm của học sinh). */
  function reviewItem(x, i, key) {
    var yours;
    var right = null;
    if (key) {
      return h('div', { class: 'panel review-item is-key' },
        h('div', { class: 'review-head' }, h('span', { class: 'q-num' }, 'Câu ' + (i + 1)),
          h('span', { class: 'pill p-blue' }, x.type === 'mc' ? 'Trắc nghiệm' : 'Điền đáp số')),
        h('p', { class: 'q-text prewrap' }, x.text),
        x.type === 'mc'
          ? h('div', { class: 'options review-opts' }, x.options.map(function (o, k) {
            return h('div', { class: 'option static' + (x.correctAnswer === k ? ' correct' : '') },
              h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o));
          }))
          : h('p', null, 'Đáp án chấp nhận: ', h('strong', { class: 'ok' }, x.correctAnswer || '(chưa có)')),
        x.explain ? h('div', { class: 'explain' }, h('strong', null, 'Lời giải: '), h('span', { class: 'prewrap' }, x.explain)) : null);
    }
    if (x.type === 'mc') {
      yours = h('div', { class: 'options review-opts' }, x.options.map(function (o, k) {
        var cls = 'option static';
        if (x.correctAnswer === k) cls += ' correct';
        if (x.answer === k && !x.correct) cls += ' wrong';
        if (x.answer === k && x.correct) cls += ' correct';
        return h('div', { class: cls }, h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o),
          x.answer === k ? h('span', { class: 'opt-you' }, 'Em chọn') : null);
      }));
    } else {
      yours = h('p', null, 'Em trả lời: ', h('strong', { class: x.correct ? 'ok' : 'err' }, x.answer == null || x.answer === '' ? '(bỏ trống)' : x.answer));
      if (!x.correct && x.correctAnswer != null) right = h('p', null, 'Đáp án đúng: ', h('strong', { class: 'ok' }, x.correctAnswer));
    }
    return h('div', { class: 'panel review-item ' + (x.correct ? 'is-ok' : 'is-bad') },
      h('div', { class: 'review-head' },
        h('span', { class: 'q-num' }, 'Câu ' + (i + 1)),
        h('span', { class: 'pill ' + (x.correct ? 'p-done' : 'p-bad') }, x.correct ? 'Đúng' : (x.answer == null || x.answer === '' ? 'Bỏ trống' : 'Sai'))),
      h('p', { class: 'q-text prewrap' }, x.text),
      yours, right,
      x.explain ? h('div', { class: 'explain' }, h('strong', null, 'Lời giải: '), h('span', { class: 'prewrap' }, x.explain)) : null);
  }

  function drawQuizTeacher(d) {
    var q = d.quiz;
    var tab = 'results';
    var box = h('div');
    var chipBar = h('div', { class: 'chips filter' });
    var tools = h('div', { class: 'head-tools' },
      h('button', { class: 'btn btn-sm', onclick: function () { takeQuiz(d); } }, 'Làm thử'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { go('#/soan-de/' + encodeURIComponent(d.course.id) + '/' + q.id); } }, 'Sửa đề'),
      h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () {
        confirmBox('Xóa bài luyện tập?', 'Xóa "' + q.title + '" cùng toàn bộ kết quả làm bài của học sinh.', 'Xóa', function () {
          return api('deleteQuiz', { id: q.id }).then(function () { toast('Đã xóa.', 'success'); go('#/khoa/' + encodeURIComponent(d.course.id)); });
        });
      } }, 'Xóa'));
    function draw() {
      fill(chipBar,
        h('button', { class: 'chip-btn' + (tab === 'results' ? ' active' : ''), onclick: function () { tab = 'results'; draw(); } }, 'Kết quả học sinh'),
        h('button', { class: 'chip-btn' + (tab === 'questions' ? ' active' : ''), onclick: function () { tab = 'questions'; draw(); } }, 'Đề & đáp án'));
      if (tab === 'results') {
        var rows = d.results;
        var did = rows.filter(function (r) { return r.attempts > 0; });
        fill(box,
          h('div', { class: 'stats' },
            stat(did.length + '/' + rows.length, 'HS đã làm'),
            stat(did.reduce(function (n, r) { return n + r.attempts; }, 0), 'lượt làm'),
            stat(did.length ? fmtScore(did.reduce(function (n, r) { return n + r.best / r.total * 10; }, 0) / did.length) : '–', 'điểm TB (thang 10)')),
          h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, 'Học sinh'), h('th', null, 'Điểm cao nhất'), h('th', null, 'Số lần làm'), h('th', null, 'Lần cuối'))),
            h('tbody', null, rows.map(function (r) {
              return h('tr', null,
                h('td', null, r.fullName),
                h('td', null, r.attempts ? h('span', { class: 'pill ' + (r.best === r.total ? 'p-done' : 'p-wait') }, r.best + '/' + r.total) : h('span', { class: 'muted' }, 'Chưa làm')),
                h('td', null, String(r.attempts)),
                h('td', { class: 'muted' }, r.last ? fmtDateTime(r.last) : ''));
            })))));
      } else {
        fill(box, h('div', { class: 'review' }, d.fullQuestions.map(function (x, i) {
          return reviewItem({ type: x.type, text: x.text, options: x.options, correctAnswer: x.type === 'mc' ? x.correct : x.answers.join('  |  '), explain: x.explain }, i, true);
        })));
      }
    }
    fill(app, quizHeader(d, tools), chipBar, box);
    draw();
  }

  /* —— Soạn đề luyện tập —— */

  function renderQuizEditor(courseId, quizId) {
    fill(app, loading());
    Promise.all([api('course', { courseId: courseId }), quizId ? api('quiz', { id: quizId }) : Promise.resolve(null), getCourses()]).then(function (res) {
      drawQuizEditor(res[0], res[1]);
    }, function (e) { fill(app, errorBox(e.message, function () { renderQuizEditor(courseId, quizId); })); });
  }

  function drawQuizEditor(cd, existing) {
    var c = cd.course;
    if (!c.canEdit) return fill(app, errorBox('Bạn không có quyền soạn đề cho khóa này.'));
    var q = existing ? existing.quiz : null;
    var ti = topicInput(cd.topics, q ? q.topic : '');
    var title = h('input', { maxlength: '200', value: q ? q.title : '', placeholder: 'VD: Luyện tập phân số – Đề 1' });
    var desc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Lời dặn cho học sinh (không bắt buộc)' });
    desc.value = existing ? existing.description || '' : '';
    var limit = h('input', { type: 'number', min: '0', max: '300', value: q ? String(q.timeLimit || '') : '', placeholder: '0 = không giới hạn' });
    var show = h('input', { type: 'checkbox', checked: q ? q.showAnswers : true });
    var src = h('textarea', { class: 'quiz-src', rows: '18', spellcheck: 'false', placeholder: window.QuizFormat.SAMPLE });
    src.value = existing ? existing.source || '' : '';
    var preview = h('div', { class: 'quiz-preview' });
    var status = h('div', { class: 'parse-status' });
    var parsed = { questions: [], errors: [] };
    var dirty = false;

    function update() {
      parsed = window.QuizFormat.parse(src.value);
      if (!src.value.trim()) {
        fill(status, h('span', { class: 'muted' }, 'Gõ hoặc dán đề vào ô bên trái. Bấm "Xem mẫu" để biết cách viết.'));
        fill(preview);
        return;
      }
      fill(status, parsed.errors.length
        ? h('div', { class: 'errors' }, h('strong', null, 'Cần sửa ' + parsed.errors.length + ' lỗi:'), h('ul', null, parsed.errors.map(function (e) { return h('li', null, e); })))
        : h('span', { class: 'ok' }, '✓ Đọc được ' + parsed.questions.length + ' câu, không có lỗi.'));
      fill(preview, parsed.questions.map(function (x, i) {
        return reviewItem({ type: x.type, text: x.text || '(thiếu nội dung)', options: x.options,
          correctAnswer: x.type === 'mc' ? x.correct : (x.answers || []).join('  |  '), explain: x.explain }, i, true);
      }));
    }
    var t = null;
    src.addEventListener('input', function () { dirty = true; clearTimeout(t); t = setTimeout(update, 250); });

    leaveGuard = function () { return !dirty || confirm('Đề chưa được lưu. Rời trang?'); };

    var saveBtn = h('button', { class: 'btn btn-lg' }, q ? 'Lưu thay đổi' : 'Lưu bài luyện tập');
    saveBtn.addEventListener('click', function () {
      update();
      if (!title.value.trim()) return toast('Vui lòng nhập tên bài luyện tập.', 'error');
      if (parsed.errors.length) return toast('Đề còn lỗi, xem danh sách lỗi phía trên phần xem trước.', 'error');
      busy(saveBtn, true, 'Đang lưu…');
      api('saveQuiz', {
        id: q ? q.id : undefined, courseId: c.id, title: title.value.trim(), topic: ti[0].value.trim(),
        description: desc.value.trim(), timeLimit: Number(limit.value || 0), showAnswers: show.checked,
        source: src.value, questions: parsed.questions
      }).then(function (r) {
        dirty = false;
        leaveGuard = null;
        coursesCache = null;
        toast('Đã lưu bài luyện tập.', 'success');
        go('#/luyen/' + r.id);
      }, function (e) { busy(saveBtn, false); toast(e.message, 'error'); });
    });

    fill(app,
      h('a', { href: q ? '#/luyen/' + q.id : '#/khoa/' + encodeURIComponent(c.id), class: 'back' }, '← ' + (q ? q.title : c.name + ' · ' + c.grade)),
      h('div', { class: 'page-head' }, h('h1', null, q ? 'Sửa bài luyện tập' : 'Soạn bài luyện tập'), h('p', { class: 'muted' }, c.name + ' · ' + c.grade)),
      h('div', { class: 'panel form' },
        h('div', { class: 'row two' }, field('Tên bài', title), field('Chủ đề', ti)),
        field('Lời dặn', desc),
        h('div', { class: 'row two' },
          field('Thời gian làm bài (phút)', limit),
          h('label', { class: 'check big-check' }, show, 'Cho học sinh xem đáp án và lời giải sau khi nộp'))),
      h('div', { class: 'editor' },
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' },
            h('h2', null, 'Nội dung đề'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: formatHelp }, 'Xem mẫu')),
          src),
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' }, h('h2', null, 'Học sinh sẽ thấy')),
          status, preview)),
      h('div', { class: 'actions-end sticky-save' }, saveBtn));
    update();

    function formatHelp() {
      modal('Cách viết đề', h('div', null,
        h('ul', { class: 'help' },
          h('li', null, 'Mỗi câu bắt đầu bằng ', h('code', null, 'Câu 1:'), ', ', h('code', null, 'Câu 2:'), '…'),
          h('li', null, 'Trắc nghiệm: mỗi lựa chọn một dòng ', h('code', null, 'A.'), ' ', h('code', null, 'B.'), '…; thêm dấu ', h('code', null, '*'), ' trước đáp án đúng (', h('code', null, '*B. 5'), ') hoặc viết dòng ', h('code', null, 'Đáp án: B'), '.'),
          h('li', null, 'Điền đáp số: không có lựa chọn, chỉ viết ', h('code', null, 'Đáp án: 26'), '. Nhiều cách viết đúng thì ngăn bằng ', h('code', null, '|'), ', ví dụ ', h('code', null, 'Đáp án: 0,75 | 3/4'), '. Máy chấm không phân biệt hoa thường, dấu cách, dấu phẩy hay chấm thập phân.'),
          h('li', null, 'Lời giải (không bắt buộc): dòng ', h('code', null, 'Giải thích: …'), ', có thể viết nhiều dòng.')),
        h('pre', { class: 'cred' }, window.QuizFormat.SAMPLE)), function (close) {
        return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Đóng'),
          h('button', { class: 'btn', onclick: function () {
            src.value = (src.value.trim() ? src.value.trim() + '\n\n' : '') + window.QuizFormat.SAMPLE;
            dirty = true;
            update();
            close();
          } }, 'Chèn mẫu vào đề')];
      });
    }
  }

  /* ═════════ Quản lý tài khoản (admin) ═════════ */

  function renderUsers() {
    fill(app, loading());
    Promise.all([api('users'), getCourses()]).then(function (res) {
      drawUsers(res[0].users, res[1]);
    }, function (e) { fill(app, errorBox(e.message, renderUsers)); });
  }

  function courseChecks(courses, selected) {
    return h('div', { class: 'checks' }, courses.map(function (c) {
      return h('label', { class: 'check' },
        h('input', { type: 'checkbox', value: c.id, checked: selected.indexOf(c.id) >= 0 }),
        c.name + ' ' + c.grade.replace('Lớp ', 'L'));
    }));
  }
  function checkedValues(box) {
    return Array.prototype.map.call(box.querySelectorAll('input:checked'), function (i) { return i.value; });
  }
  function roleSelect(value) {
    return h('select', null, ['student', 'teacher', 'admin'].map(function (r) {
      return h('option', { value: r, selected: r === value }, ROLE_LABEL[r]);
    }));
  }

  function showPassword(username, password) {
    var text = 'Khu học tập Toán Thầy Minh\nĐịa chỉ: ' + loginUrl() + '\nTên đăng nhập: ' + username + '\nMật khẩu: ' + password;
    modal('Thông tin đăng nhập', h('div', null,
      h('p', { class: 'muted' }, 'Mật khẩu chỉ hiện một lần. Hãy sao chép và gửi cho người dùng.'),
      h('pre', { class: 'cred' }, text)), function (close) {
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Đóng'),
        h('button', { class: 'btn', onclick: function () { copy(text); } }, 'Sao chép')];
    });
  }

  function drawUsers(users, courses) {
    var nameOf = {};
    courses.forEach(function (c) { nameOf[c.id] = c.name + ' ' + c.grade.replace('Lớp ', 'L'); });

    var nU = h('input', { autocapitalize: 'none', spellcheck: 'false', placeholder: 'vd: hs001, gv.ngan' });
    var nN = h('input', { placeholder: 'Họ và tên' });
    var nR = roleSelect('student');
    var nC = courseChecks(courses, []);
    var nBtn = h('button', { class: 'btn', type: 'submit' }, 'Tạo tài khoản');
    var createForm = h('form', { class: 'form' },
      h('div', { class: 'row' }, field('Tên đăng nhập', nU, 'Chữ không dấu, số, dấu chấm'), field('Họ tên', nN), field('Vai trò', nR)),
      h('div', { class: 'field' }, h('span', null, 'Khóa học (học sinh: khóa được học · giáo viên: khóa được đăng bài, chấm bài)'), nC),
      h('div', null, nBtn));
    createForm.addEventListener('submit', function (e) {
      e.preventDefault();
      busy(nBtn, true);
      api('createUser', { username: nU.value, fullName: nN.value, role: nR.value, courses: checkedValues(nC) }).then(function (d) {
        busy(nBtn, false);
        showPassword(d.user.username, d.password);
        renderUsers();
      }, function (err) { busy(nBtn, false); toast(err.message, 'error'); });
    });

    var bulkText = h('textarea', { rows: '5', spellcheck: 'false', placeholder: 'hs001, Nguyễn Văn An, toan4 tv4\nhs002, Trần Thị Bình, anh5\nhs003, Lê Minh Châu, toankhtn5 tvkhxh5 anh5' });
    var bulkRole = roleSelect('student');
    var bulkBtn = h('button', { class: 'btn', type: 'submit' }, 'Tạo hàng loạt');
    var bulkForm = h('form', { class: 'form' },
      field('Mỗi dòng một người: tên đăng nhập, họ tên, mã khóa (cách nhau bằng dấu cách)', bulkText,
        'Mã khóa: ' + courses.map(function (c) { return c.id + ' = ' + nameOf[c.id]; }).join(' · ')),
      h('div', { class: 'row' }, field('Vai trò cho cả danh sách', bulkRole)),
      h('div', null, bulkBtn));
    bulkForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var list = bulkText.value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
        var parts = line.split(/\s*[,;\t]\s*/);
        return { username: parts[0], fullName: parts[1] || '', courses: parts.slice(2).join(' '), role: bulkRole.value };
      });
      if (!list.length) return toast('Danh sách trống.', 'error');
      busy(bulkBtn, true, 'Đang tạo ' + list.length + ' tài khoản…');
      api('bulkCreate', { users: list }).then(function (d) {
        busy(bulkBtn, false);
        var okRows = d.results.filter(function (r) { return r.password; });
        var text = 'Khu học tập Toán Thầy Minh – ' + loginUrl() + '\n\n' +
          okRows.map(function (r) { return r.fullName + '\tTên đăng nhập: ' + r.username + '\tMật khẩu: ' + r.password; }).join('\n');
        modal('Kết quả tạo tài khoản', h('div', null,
          h('p', { class: 'muted' }, 'Tạo thành công ' + okRows.length + '/' + d.results.length + '. Mật khẩu chỉ hiện một lần, hãy sao chép lại.'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', null, h('tr', null, h('th', null, 'Tên đăng nhập'), h('th', null, 'Họ tên'), h('th', null, 'Mật khẩu / lỗi'))),
            h('tbody', null, d.results.map(function (r) {
              return h('tr', null, h('td', null, r.username), h('td', null, r.fullName),
                r.password ? h('td', { class: 'mono' }, r.password) : h('td', { class: 'err' }, r.error));
            }))))), function (close) {
          return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Đóng'),
            okRows.length ? h('button', { class: 'btn', onclick: function () { copy(text); } }, 'Sao chép danh sách') : null];
        });
        if (okRows.length) { bulkText.value = ''; refreshList(); }
      }, function (err) { busy(bulkBtn, false); toast(err.message, 'error'); });
    });

    var search = h('input', { type: 'search', placeholder: 'Tìm theo tên hoặc tên đăng nhập…' });
    var filter = h('select', null,
      h('option', { value: '' }, 'Tất cả vai trò'),
      ['student', 'teacher', 'admin'].map(function (r) { return h('option', { value: r }, ROLE_LABEL[r]); }));
    var tbody = h('tbody');
    var countEl = h('span', { class: 'muted small' });

    function drawRows() {
      var q = search.value.trim().toLowerCase();
      var list = users.filter(function (u) {
        return (!filter.value || u.role === filter.value) &&
          (!q || u.username.indexOf(q) >= 0 || u.fullName.toLowerCase().indexOf(q) >= 0);
      });
      countEl.textContent = list.length + ' tài khoản';
      fill(tbody, list.map(function (u) {
        return h('tr', { class: u.active ? '' : 'inactive' },
          h('td', { 'data-label': 'Tên đăng nhập', class: 'mono' }, u.username),
          h('td', { 'data-label': 'Họ tên' }, u.fullName),
          h('td', { 'data-label': 'Vai trò' }, h('span', { class: 'role-badge role-' + u.role }, ROLE_LABEL[u.role] || u.role)),
          h('td', { 'data-label': 'Khóa học' }, u.role === 'admin' ? h('span', { class: 'muted' }, 'Tất cả')
            : u.courses.length ? h('div', { class: 'chips' }, u.courses.map(function (id) { return h('span', { class: 'chip' }, nameOf[id] || id); }))
              : h('span', { class: 'muted' }, 'Chưa có')),
          h('td', { 'data-label': 'Trạng thái', class: 'status' }, u.active ? 'Hoạt động' : h('span', { class: 'err' }, 'Đã khóa')),
          h('td', { class: 'actions' },
            h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { editUser(u, courses); } }, 'Sửa'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { resetPw(u); } }, 'Đặt lại MK'),
            u.username !== me.username ? h('button', { class: 'icon-btn danger', title: 'Xóa tài khoản', 'aria-label': 'Xóa tài khoản', onclick: function () { deleteUser(u); } }, '🗑') : null));
      }));
    }
    function refreshList() {
      api('users').then(function (d) { users = d.users; drawRows(); }, function (e) { toast(e.message, 'error'); });
    }
    search.addEventListener('input', drawRows);
    filter.addEventListener('change', drawRows);

    fill(app,
      h('div', { class: 'page-head' },
        h('h1', null, 'Quản lý tài khoản'),
        h('p', { class: 'muted' }, 'Cấp tài khoản cho học sinh và giáo viên, ghi danh theo khóa học.')),
      h('details', { class: 'panel', open: true }, h('summary', null, 'Tạo một tài khoản'), createForm),
      h('details', { class: 'panel' }, h('summary', null, 'Tạo nhiều học sinh một lúc'), bulkForm),
      h('div', { class: 'list-head' }, h('h2', { class: 'section-title' }, 'Danh sách tài khoản'), countEl),
      h('div', { class: 'toolbar' }, search, filter),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table users' },
        h('thead', null, h('tr', null,
          h('th', null, 'Tên đăng nhập'), h('th', null, 'Họ tên'), h('th', null, 'Vai trò'),
          h('th', null, 'Khóa học'), h('th', null, 'Trạng thái'), h('th', null, ''))),
        tbody)));
    drawRows();
  }

  function editUser(u, courses) {
    var name = h('input', { value: u.fullName });
    var role = roleSelect(u.role);
    var checks = courseChecks(courses, u.courses);
    var active = h('input', { type: 'checkbox', checked: u.active });
    modal('Sửa tài khoản ' + u.username, h('div', { class: 'form' },
      field('Họ tên', name),
      field('Vai trò', role),
      h('div', { class: 'field' }, h('span', null, 'Khóa học'), checks),
      h('label', { class: 'check' }, active, 'Cho phép đăng nhập (bỏ chọn để khóa tài khoản)')), function (close) {
      var ok = h('button', { class: 'btn' }, 'Lưu');
      ok.addEventListener('click', function () {
        busy(ok, true);
        api('updateUser', { username: u.username, fullName: name.value, role: role.value, courses: checkedValues(checks), active: active.checked }).then(function () {
          close();
          toast('Đã lưu.', 'success');
          if (u.username === me.username) me.fullName = name.value;
          coursesCache = null;
          renderUsers();
        }, function (e) { busy(ok, false); toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  function resetPw(u) {
    confirmBox('Đặt lại mật khẩu?', 'Tạo mật khẩu mới cho ' + u.fullName + ' (' + u.username + '). Mật khẩu cũ sẽ không dùng được nữa.', 'Đặt lại', function () {
      return api('resetPassword', { username: u.username }).then(function (d) { showPassword(d.username, d.password); });
    });
  }

  function deleteUser(u) {
    confirmBox('Xóa tài khoản?', 'Xóa vĩnh viễn tài khoản ' + u.fullName + ' (' + u.username + '). Nếu chỉ muốn tạm ngưng, hãy dùng "Sửa" và bỏ chọn "Cho phép đăng nhập".', 'Xóa', function () {
      return api('deleteUser', { username: u.username }).then(function () {
        toast('Đã xóa tài khoản.', 'success');
        coursesCache = null;
        renderUsers();
      });
    });
  }

  route();
})();
