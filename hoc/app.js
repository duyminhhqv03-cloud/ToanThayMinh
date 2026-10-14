/* Khu học tập – Toán Thầy Minh
 * Trang tĩnh trên GitHub Pages, nói chuyện với máy chủ Google Apps Script (xem apps-script/Code.gs).
 */
(function () {
  'use strict';

  var API = String(window.API_URL || '').trim();
  var MAX_BYTES = 20 * 1024 * 1024;
  var ROLE_LABEL = { admin: 'Admin', teacher: 'Giáo viên', student: 'Học sinh' };
  var CONTACT = 'Thầy Minh – 0376 696 994';

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

  /* ───────── Tiện ích DOM ───────── */

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

  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.className = 'toast'; }, 4000);
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn._label = btn.textContent; btn.textContent = label || 'Đang xử lý…'; btn.disabled = true; }
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

  function modal(title, body, actions) {
    var overlay = h('div', { class: 'overlay' });
    var close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' },
        h('h3', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Đóng', onclick: close }, '×')),
      h('div', { class: 'modal-body' }, body),
      actions ? h('div', { class: 'modal-actions' }, actions(close)) : null);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    overlay.append(box);
    document.body.append(overlay);
    var first = box.querySelector('input, select, textarea');
    if (first) first.focus();
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

  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtSize(n) {
    if (!n) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' MB';
  }
  function loginUrl() {
    return location.origin + location.pathname;
  }

  /* ───────── Gọi máy chủ ───────── */

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
        throw new Error(data.error || 'Có lỗi xảy ra.');
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

  /* ───────── Điều hướng ───────── */

  function route() {
    renderNav();
    if (!token) return renderLogin();
    if (!me) return boot();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'khoa' && parts[1]) return renderCourse(decodeURIComponent(parts[1]));
    if (parts[0] === 'tai-khoan' && me.role === 'admin') return renderUsers();
    return renderHome();
  }

  function boot() {
    app.replaceChildren(loading());
    api('me').then(function (d) { me = d.user; route(); }, function (e) {
      if (token) app.replaceChildren(errorBox(e.message, boot));
    });
  }

  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }

  window.addEventListener('hashchange', route);

  /* ───────── Thanh trên cùng ───────── */

  function renderNav() {
    if (!me) {
      navUser.replaceChildren(h('a', { href: '../', class: 'nav-link' }, '← Trang chủ'));
      return;
    }
    var links = [h('a', { href: '#/', class: 'nav-link' }, 'Khóa học')];
    if (me.role === 'admin') links.push(h('a', { href: '#/tai-khoan', class: 'nav-link' }, 'Tài khoản'));
    navUser.replaceChildren(
      h('nav', { class: 'nav-links' }, links),
      h('details', { class: 'user-menu' },
        h('summary', null,
          h('span', { class: 'user-name' }, me.fullName),
          h('span', { class: 'role-badge role-' + me.role }, ROLE_LABEL[me.role] || me.role)),
        h('div', { class: 'user-menu-list' },
          h('button', { class: 'menu-mobile', onclick: function (e) { e.target.closest('details').open = false; go('#/'); } }, 'Khóa học'),
          me.role === 'admin' ? h('button', { class: 'menu-mobile', onclick: function (e) { e.target.closest('details').open = false; go('#/tai-khoan'); } }, 'Quản lý tài khoản') : null,
          h('button', { onclick: function (e) { e.target.closest('details').open = false; changePassword(); } }, 'Đổi mật khẩu'),
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
    var oldI = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    var newI = h('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: true });
    var newI2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: true });
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

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
  }

  /* ───────── Đăng nhập ───────── */

  function renderLogin() {
    var u = h('input', { name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    var p = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true });
    var btn = h('button', { class: 'btn btn-block', type: 'submit' }, 'Đăng nhập');
    var form = h('form', { class: 'form' },
      field('Tên đăng nhập', u),
      field('Mật khẩu', p),
      btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      busy(btn, true, 'Đang đăng nhập…');
      api('login', { username: u.value, password: p.value }).then(function (d) {
        setSession(d.token, d.user);
        location.hash = '#/';
        route();
      }, function (err) {
        busy(btn, false);
        toast(err.message, 'error');
        p.select();
      });
    });
    app.replaceChildren(h('section', { class: 'login' },
      h('div', { class: 'login-card' },
        h('p', { class: 'eyebrow' }, 'Khu học tập'),
        h('h1', null, 'Đăng nhập'),
        h('p', { class: 'muted' }, 'Dùng tài khoản do trung tâm cấp để vào lớp học.'),
        !API ? h('p', { class: 'notice' }, 'Khu học tập đang được cài đặt, vui lòng quay lại sau.') : null,
        form,
        h('p', { class: 'small muted' }, 'Chưa có tài khoản hoặc quên mật khẩu? Liên hệ ' + CONTACT + '.'))));
    u.focus();
  }

  /* ───────── Trang chính: danh sách khóa ───────── */

  function renderHome() {
    var greet = {
      admin: 'Quản lý khóa học, tài liệu và tài khoản.',
      teacher: 'Chọn khóa học để đăng hoặc quản lý tài liệu.',
      student: 'Chọn khóa học để xem bài giảng và tài liệu.'
    }[me.role];
    var grid = h('div', { class: 'grid courses' }, loading());
    app.replaceChildren(
      h('div', { class: 'page-head' },
        h('h1', null, 'Xin chào, ' + me.fullName),
        h('p', { class: 'muted' }, greet)),
      grid);
    getCourses(true).then(function (list) {
      if (!list.length) {
        grid.replaceChildren(h('div', { class: 'panel empty span-all' },
          h('p', null, 'Bạn chưa được ghi danh vào khóa học nào.'),
          h('p', { class: 'muted' }, 'Liên hệ ' + CONTACT + ' để được mở khóa học.')));
        return;
      }
      grid.replaceChildren.apply(grid, list.map(courseCard));
    }, function (e) { grid.replaceChildren(errorBox(e.message, renderHome)); });
  }

  var COURSE_COLORS = ['#0f9d74', '#ff7a59', '#3b82f6', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899'];

  function courseCard(c, i) {
    return h('a', { class: 'card course', href: '#/khoa/' + encodeURIComponent(c.id), style: '--c:' + COURSE_COLORS[i % COURSE_COLORS.length] },
      h('span', { class: 'tag' }, c.grade),
      h('h3', null, c.name),
      h('p', null, c.teachers.length ? c.teachers.join(', ') : 'Chưa phân giáo viên'),
      h('p', { class: 'course-meta' },
        c.docCount + ' tài liệu',
        c.canEdit && me.role !== 'student' ? h('span', { class: 'pill' }, 'Bạn được đăng bài') : null));
  }

  /* ───────── Trang khóa học ───────── */

  function renderCourse(id) {
    app.replaceChildren(loading());
    getCourses().then(function (list) {
      var idx = -1;
      var c = list.filter(function (x, i) { if (x.id === id) { idx = i; return true; } return false; })[0];
      if (!c) {
        app.replaceChildren(h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'),
          errorBox('Không tìm thấy khóa học, hoặc bạn chưa được ghi danh vào khóa này.'));
        return;
      }
      var listEl = h('div', { class: 'doc-list' }, loading('Đang tải tài liệu…'));
      app.replaceChildren(
        h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'),
        h('div', { class: 'page-head course-head', style: '--c:' + COURSE_COLORS[idx % COURSE_COLORS.length] },
          h('span', { class: 'tag' }, c.grade),
          h('h1', null, c.name),
          h('p', { class: 'muted' }, c.teachers.length ? 'Giáo viên: ' + c.teachers.join(', ') : '')),
        c.canEdit ? uploadPanel(c, function () { loadDocs(c, listEl); }) : null,
        h('h2', { class: 'section-title' }, 'Tài liệu'),
        listEl);
      loadDocs(c, listEl);
    }, function (e) { app.replaceChildren(errorBox(e.message, function () { renderCourse(id); })); });
  }

  function loadDocs(c, listEl) {
    api('docs', { courseId: c.id }).then(function (d) {
      if (!d.docs.length) {
        listEl.replaceChildren(h('div', { class: 'panel empty' },
          h('p', null, 'Chưa có tài liệu nào trong khóa này.'),
          c.canEdit ? h('p', { class: 'muted' }, 'Dùng ô "Đăng tài liệu mới" ở trên để thêm tài liệu đầu tiên.') : null));
        return;
      }
      listEl.replaceChildren.apply(listEl, d.docs.map(function (doc) { return docItem(doc, c, listEl); }));
    }, function (e) { listEl.replaceChildren(errorBox(e.message, function () { loadDocs(c, listEl); })); });
  }

  function docKind(doc) {
    if (doc.type === 'link') {
      return /youtu\.?be/i.test(doc.url) ? ['VIDEO', 'k-video'] : ['LINK', 'k-link'];
    }
    var m = doc.mimeType || '';
    var ext = (doc.fileName.split('.').pop() || '').toLowerCase();
    if (m === 'application/pdf' || ext === 'pdf') return ['PDF', 'k-pdf'];
    if (/word|document/.test(m) || ext === 'doc' || ext === 'docx') return ['WORD', 'k-word'];
    if (/sheet|excel/.test(m) || ext === 'xls' || ext === 'xlsx') return ['EXCEL', 'k-excel'];
    if (/presentation|powerpoint/.test(m) || ext === 'ppt' || ext === 'pptx') return ['SLIDE', 'k-slide'];
    if (/^image\//.test(m)) return ['ẢNH', 'k-image'];
    if (/^audio\//.test(m)) return ['AUDIO', 'k-audio'];
    if (/^video\//.test(m)) return ['VIDEO', 'k-video'];
    return [ext ? ext.toUpperCase().slice(0, 5) : 'FILE', 'k-file'];
  }

  function viewable(doc) {
    return /^(application\/pdf|image\/|text\/plain|audio\/|video\/)/.test(doc.mimeType || '');
  }

  function docItem(doc, c, listEl) {
    var kind = docKind(doc);
    var actions = [];
    if (doc.type === 'link') {
      actions.push(h('a', { class: 'btn btn-sm', href: doc.url, target: '_blank', rel: 'noopener' }, 'Mở link'));
    } else {
      if (viewable(doc)) {
        var view = h('button', { class: 'btn btn-sm' }, 'Xem');
        view.addEventListener('click', function () { openFile(doc, false, view); });
        actions.push(view);
      }
      var dl = h('button', { class: 'btn btn-sm ' + (viewable(doc) ? 'btn-ghost' : '') }, 'Tải về');
      dl.addEventListener('click', function () { openFile(doc, true, dl); });
      actions.push(dl);
    }
    if (c.canEdit) {
      actions.push(h('button', {
        class: 'icon-btn danger', title: 'Xóa tài liệu', 'aria-label': 'Xóa tài liệu',
        onclick: function () {
          confirmBox('Xóa tài liệu?', 'Tài liệu "' + doc.title + '" sẽ bị xóa khỏi khóa học. File gốc được chuyển vào Thùng rác của Google Drive.', 'Xóa', function () {
            return api('deleteDoc', { docId: doc.id }).then(function () {
              toast('Đã xóa tài liệu.', 'success');
              coursesCache = null;
              loadDocs(c, listEl);
            });
          });
        }
      }, '🗑'));
    }
    var meta = [doc.uploadedBy, fmtDate(doc.uploadedAt), doc.type === 'file' ? fmtSize(doc.size) : null].filter(Boolean).join(' · ');
    return h('article', { class: 'doc' },
      h('span', { class: 'kind ' + kind[1] }, kind[0]),
      h('div', { class: 'doc-main' },
        h('h3', null, doc.title),
        doc.description ? h('p', { class: 'doc-desc' }, doc.description) : null,
        h('p', { class: 'doc-meta' }, meta)),
      h('div', { class: 'doc-actions' }, actions));
  }

  function openFile(doc, download, btn) {
    var win = null;
    if (!download) {
      win = window.open('', '_blank');
      if (win) {
        try { win.document.title = doc.title; win.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px;color:#555">Đang mở tài liệu…</p>'; } catch (e) { /* bỏ qua */ }
      }
    }
    busy(btn, true, 'Đang tải…');
    api('file', { docId: doc.id }).then(function (d) {
      var bin = atob(d.data);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: d.mimeType || 'application/octet-stream' }));
      if (win) {
        win.location.href = url;
      } else {
        var a = h('a', { href: url, download: d.name });
        document.body.append(a);
        a.click();
        a.remove();
      }
      setTimeout(function () { URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    }, function (e) {
      if (win) win.close();
      toast(e.message, 'error');
    }).then(function () { busy(btn, false); });
  }

  function uploadPanel(c, onDone) {
    var mode = 'file';
    var title = h('input', { maxlength: '200', placeholder: 'VD: Bài 3 – Phân số (lý thuyết + bài tập)' });
    var desc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ghi chú cho học sinh (không bắt buộc)' });
    var file = h('input', { type: 'file' });
    var url = h('input', { type: 'url', placeholder: 'https://youtu.be/... hoặc link Google Drive, Quizizz…' });
    var fileField = field('Chọn file (PDF, Word, ảnh… tối đa 20 MB)', file);
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

    var btn = h('button', { class: 'btn', type: 'submit' }, 'Đăng tài liệu');
    var form = h('form', { class: 'form' },
      h('div', { class: 'segmented' }, tabFile, tabLink),
      fileField, urlField,
      field('Tiêu đề', title),
      field('Mô tả', desc),
      h('div', null, btn));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var params = { courseId: c.id, title: title.value.trim(), description: desc.value.trim() };
      var f = file.files[0];
      var job;
      if (mode === 'file') {
        if (!f) return toast('Vui lòng chọn file.', 'error');
        if (f.size > MAX_BYTES) return toast('File quá lớn (tối đa 20 MB). Với video, hãy đăng YouTube rồi dán link.', 'error');
        if (!params.title) params.title = f.name.replace(/\.[^.]+$/, '');
        busy(btn, true, 'Đang tải lên…');
        job = readBase64(f).then(function (data) {
          return api('upload', Object.assign(params, { fileName: f.name, mimeType: f.type || 'application/octet-stream', data: data }));
        });
      } else {
        if (!/^https?:\/\/\S+$/i.test(url.value.trim())) return toast('Đường link phải bắt đầu bằng http:// hoặc https://', 'error');
        if (!params.title) return toast('Vui lòng nhập tiêu đề.', 'error');
        busy(btn, true, 'Đang lưu…');
        job = api('upload', Object.assign(params, { url: url.value.trim() }));
      }
      job.then(function () {
        form.reset();
        setMode(mode);
        coursesCache = null;
        toast('Đã đăng tài liệu.', 'success');
        onDone();
      }, function (err) { toast(err.message, 'error'); }).then(function () { busy(btn, false); });
    });

    return h('details', { class: 'panel upload', open: true },
      h('summary', null, 'Đăng tài liệu mới'),
      form);
  }

  function readBase64(f) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Không đọc được file.')); };
      r.readAsDataURL(f);
    });
  }

  /* ───────── Quản lý tài khoản (admin) ───────── */

  function renderUsers() {
    app.replaceChildren(loading());
    Promise.all([api('users'), getCourses()]).then(function (res) {
      drawUsers(res[0].users, res[1]);
    }, function (e) { app.replaceChildren(errorBox(e.message, renderUsers)); });
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

    // Tạo một tài khoản
    var nU = h('input', { autocapitalize: 'none', spellcheck: 'false', placeholder: 'vd: hs001, gv.ngan' });
    var nN = h('input', { placeholder: 'Họ và tên' });
    var nR = roleSelect('student');
    var nC = courseChecks(courses, []);
    var nBtn = h('button', { class: 'btn', type: 'submit' }, 'Tạo tài khoản');
    var createForm = h('form', { class: 'form' },
      h('div', { class: 'row' }, field('Tên đăng nhập', nU, 'Chữ không dấu, số, dấu chấm'), field('Họ tên', nN), field('Vai trò', nR)),
      h('div', { class: 'field' }, h('span', null, 'Khóa học (học sinh: khóa được học · giáo viên: khóa được đăng bài)'), nC),
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

    // Tạo nhiều tài khoản
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
        if (okRows.length) { bulkText.value = ''; renderUsersList(); }
      }, function (err) { busy(bulkBtn, false); toast(err.message, 'error'); });
    });

    // Danh sách
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
      tbody.replaceChildren.apply(tbody, list.map(function (u) {
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
    function renderUsersList() {
      api('users').then(function (d) { users = d.users; drawRows(); }, function (e) { toast(e.message, 'error'); });
    }
    search.addEventListener('input', drawRows);
    filter.addEventListener('change', drawRows);

    app.replaceChildren(
      h('div', { class: 'page-head' },
        h('h1', null, 'Quản lý tài khoản'),
        h('p', { class: 'muted' }, 'Cấp tài khoản cho học sinh và giáo viên, ghi danh theo khóa học.')),
      h('details', { class: 'panel', open: true }, h('summary', null, 'Tạo một tài khoản'), createForm),
      h('details', { class: 'panel' }, h('summary', null, 'Tạo nhiều học sinh một lúc'), bulkForm),
      h('div', { class: 'list-head' },
        h('h2', { class: 'section-title' }, 'Danh sách tài khoản'), countEl),
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
