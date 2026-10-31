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
  try { if (token) me = JSON.parse(store.get('ttm_me') || 'null'); } catch (e) { me = null; }
  var meChecked = false; // đã hỏi lại máy chủ thông tin tài khoản trong lần mở trang này chưa
  var coursesCache = null;
  var viewCache = {};    // dữ liệu lần trước của từng trang → vẽ ngay khi quay lại, rồi cập nhật ngầm
  var routeSeq = 0;      // tăng mỗi lần chuyển trang: kết quả về muộn của trang cũ không vẽ đè trang mới
  var leaveGuard = null; // hàm hỏi trước khi rời trang (đang làm bài)

  /**
   * Đặt cảnh báo rời trang. isDirty() chỉ trả lời "có đang dở việc không" (không hỏi gì),
   * để dùng được cả khi chuyển trang trong web lẫn khi tải lại / đóng tab (beforeunload).
   */
  function setLeaveGuard(isDirty, message, onLeave) {
    var g = function () {
      var ok = !isDirty() || confirm(message);
      if (ok && onLeave) onLeave();
      return ok;
    };
    g.isDirty = isDirty;
    g.onLeave = onLeave;
    leaveGuard = g;
  }

  window.addEventListener('beforeunload', function (e) {
    if (feeSync.dirty()) feeSync.flush();
    if ((leaveGuard && leaveGuard.isDirty && leaveGuard.isDirty()) || feeSync.dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /** Nháp bài làm trong máy (theo từng tài khoản), giữ tối đa 3 ngày. */
  var DRAFT_TTL = 3 * 24 * 3600 * 1000;
  var draft = {
    key: function (k) { return 'ttm_draft:' + (me ? me.username : '') + ':' + k; },
    load: function (k) {
      try {
        var d = JSON.parse(store.get(draft.key(k)) || 'null');
        if (!d || Date.now() - d.at > DRAFT_TTL) { store.set(draft.key(k), null); return null; }
        return d;
      } catch (e) { return null; }
    },
    save: function (k, data) { data.at = Date.now(); store.set(draft.key(k), JSON.stringify(data)); },
    clear: function (k) { store.set(draft.key(k), null); }
  };
  /** Chép câu trả lời từ nháp nếu nháp khớp số câu. */
  function restoreAnswers(answers, saved) {
    if (!saved || !Array.isArray(saved.answers) || saved.answers.length !== answers.length) return false;
    saved.answers.forEach(function (v, i) { answers[i] = v; });
    return true;
  }

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
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function fill(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
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
    overlay.appendChild(box);
    document.body.appendChild(overlay);
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
    document.body.appendChild(ta);
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

  var WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  function pad2(x) { return String(x).padStart(2, '0'); }

  /** "1 ngày 02:15:30" / "02:15:30" — thời gian còn lại dạng đồng hồ số. */
  function fmtLeft(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400);
    s -= d * 86400;
    return (d ? d + ' ngày ' : '') + pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60);
  }

  /** "2 ngày 3 giờ 5 phút" */
  function leftWords(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    var d = Math.floor(m / 1440), H = Math.floor(m % 1440 / 60), M = m % 60;
    return [d ? d + ' ngày' : '', H ? H + ' giờ' : '', !d && (M || !H) ? M + ' phút' : ''].filter(Boolean).join(' ');
  }

  /** Đồng hồ đếm ngược tới hạn nộp (tự dừng khi không còn trên trang). */
  function countdownEl(dueAt) {
    var end = new Date(dueAt).getTime();
    if (!dueAt || isNaN(end) || end <= Date.now()) return null;
    var digits = h('span', { class: 'cd-digits' });
    var el = h('span', { class: 'countdown', title: 'Thời gian còn lại đến hạn nộp' }, h('span', { class: 'cd-label' }, 'Còn'), digits);
    var timer;
    function tick() {
      var left = end - Date.now();
      if (left <= 0) {
        clearInterval(timer);
        el.className = 'countdown over';
        fill(el, 'Đã hết hạn nộp');
        return;
      }
      if (timer && !el.isConnected) { clearInterval(timer); return; }
      el.classList.toggle('soon', left < 24 * 3600 * 1000);
      digits.textContent = fmtLeft(left);
    }
    tick();
    timer = setInterval(tick, 1000);
    return el;
  }

  /**
   * Chọn hạn nộp kiểu đồng hồ số: giờ : phút to, bấm ▲▼ hoặc gõ thẳng; ngày chọn bằng ◀ ▶,
   * nút nhanh hoặc lịch. Không dùng ô datetime-local (trên điện thoại hiện bánh xe cuộn khó chỉnh).
   * Trả về { el, value() → ISO hoặc '' khi không có hạn, onChange }.
   */
  function deadlinePicker(iso, onChange) {
    var init = iso ? new Date(iso) : null;
    if (init && isNaN(init)) init = null;
    var day = init ? new Date(init) : null; // ngày đang chọn (giờ trong đối tượng này bỏ qua)
    var hh = init ? init.getHours() : 21;
    var mm = init ? init.getMinutes() : 0;
    var on = h('input', { type: 'checkbox', checked: !!init });
    var body = h('div', { class: 'dl-body', hidden: !init });
    var dayLabel = h('strong', { class: 'dl-day' });
    var calInput = h('input', { type: 'date', class: 'dl-cal-input', tabindex: '-1', 'aria-hidden': 'true' });
    var hIn = h('input', { class: 'dl-num', inputmode: 'numeric', maxlength: '2', 'aria-label': 'Giờ' });
    var mIn = h('input', { class: 'dl-num', inputmode: 'numeric', maxlength: '2', 'aria-label': 'Phút' });
    var note = h('p', { class: 'dl-note' });
    var dayChips = h('span', { class: 'dl-chips-in' });
    var timeChips = h('div', { class: 'dl-chips' });
    var noteTimer;

    function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
    function current() {
      if (!on.checked || !day) return null;
      var d = new Date(day);
      d.setHours(hh, mm, 0, 0);
      return d;
    }
    function changed() { draw(); if (onChange) onChange(); }
    function setDay(d) { day = d; changed(); }
    function setTime(H, M) { hh = (H + 24) % 24; mm = (M + 60) % 60; changed(); }

    function drawNote() {
      var d = current();
      if (!d) return;
      var left = d.getTime() - Date.now();
      note.className = 'dl-note' + (left <= 0 ? ' over' : left < 24 * 3600 * 1000 ? ' soon' : '');
      note.textContent = left <= 0 ? 'Thời điểm này đã qua — học sinh nộp sẽ bị tính là nộp muộn.'
        : 'Hạn nộp: ' + pad2(hh) + ':' + pad2(mm) + ' ' + WEEKDAYS[d.getDay()].toLowerCase() + ', ' + fmtDate(d) + ' · còn ' + leftWords(left);
    }
    function draw() {
      body.hidden = !on.checked;
      if (!on.checked) return;
      dayLabel.textContent = WEEKDAYS[day.getDay()] + ', ' + fmtDate(day);
      calInput.value = day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate());
      if (document.activeElement !== hIn) hIn.value = pad2(hh);
      if (document.activeElement !== mIn) mIn.value = pad2(mm);
      var t = today();
      var sat = addDays(t, (6 - t.getDay() + 7) % 7 || 7);
      fill(dayChips, [['Hôm nay', t], ['Ngày mai', addDays(t, 1)], ['Thứ Bảy này', sat], ['1 tuần nữa', addDays(t, 7)]].map(function (c) {
        return h('button', { type: 'button', class: 'chip-btn' + (sameDay(day, c[1]) ? ' active' : ''), onclick: function () { setDay(c[1]); } }, c[0]);
      }));
      fill(timeChips, [[7, 0], [17, 0], [20, 0], [21, 0], [22, 0], [23, 59]].map(function (c) {
        return h('button', { type: 'button', class: 'chip-btn' + (hh === c[0] && mm === c[1] ? ' active' : ''), onclick: function () { setTime(c[0], c[1]); } }, pad2(c[0]) + ':' + pad2(c[1]));
      }));
      drawNote();
    }

    // Nút ▲▼: bấm một lần đổi 1 giờ / 5 phút; giữ nút thì chạy liên tục.
    function stepBtn(label, fn) {
      var b = h('button', { type: 'button', class: 'dl-step', 'aria-label': label }, label.indexOf('Tăng') === 0 ? '▲' : '▼');
      var t1, t2;
      var stop = function () { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        fn();
        t1 = setTimeout(function () { t2 = setInterval(fn, 110); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
      return b;
    }
    function minuteStep(dir) {
      var m = dir > 0 ? Math.floor(mm / 5) * 5 + 5 : Math.ceil(mm / 5) * 5 - 5;
      if (m >= 60) setTime(hh + 1, m - 60); else if (m < 0) setTime(hh - 1, m + 60); else setTime(hh, m);
    }
    function typed(inp, max, set) {
      inp.addEventListener('focus', function () { inp.select(); });
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 2);
        var n = Number(inp.value);
        if (inp.value !== '' && n <= max) { set(n); }
        if (inp.value.length === 2 && inp === hIn) { mIn.focus(); }
      });
      inp.addEventListener('blur', function () { draw(); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          var dir = e.key === 'ArrowUp' ? 1 : -1;
          if (inp === hIn) setTime(hh + dir, mm); else minuteStep(dir);
          inp.value = pad2(inp === hIn ? hh : mm);
          inp.select();
        }
      });
    }
    typed(hIn, 23, function (n) { hh = n; changed(); });
    typed(mIn, 59, function (n) { mm = n; changed(); });

    calInput.addEventListener('change', function () {
      var p = calInput.value.split('-').map(Number);
      if (p.length === 3 && p[0]) setDay(new Date(p[0], p[1] - 1, p[2]));
    });
    var calBtn = h('button', { type: 'button', class: 'chip-btn', title: 'Chọn ngày trên lịch', onclick: function () {
      try { if (calInput.showPicker) { calInput.showPicker(); return; } } catch (e) { /* trình duyệt cũ */ }
      calInput.focus(); calInput.click();
    } }, '📅 Ngày khác');

    on.addEventListener('change', function () {
      if (on.checked && !day) day = addDays(today(), 1);
      changed();
    });

    fill(body,
      h('div', { class: 'dl-date' },
        h('button', { type: 'button', class: 'dl-icon', 'aria-label': 'Ngày trước', onclick: function () { setDay(addDays(day, -1)); } }, '◀'),
        dayLabel,
        h('button', { type: 'button', class: 'dl-icon', 'aria-label': 'Ngày sau', onclick: function () { setDay(addDays(day, 1)); } }, '▶')),
      h('div', { class: 'dl-chips' }, dayChips, h('span', { class: 'dl-cal' }, calBtn, calInput)),
      h('div', { class: 'dl-clock' },
        h('div', { class: 'dl-unit' }, stepBtn('Tăng giờ', function () { setTime(hh + 1, mm); }), hIn, stepBtn('Giảm giờ', function () { setTime(hh - 1, mm); })),
        h('span', { class: 'dl-colon' }, ':'),
        h('div', { class: 'dl-unit' }, stepBtn('Tăng phút', function () { minuteStep(1); }), mIn, stepBtn('Giảm phút', function () { minuteStep(-1); }))),
      timeChips,
      note);
    draw();
    // Cập nhật "còn … nữa" mỗi phút khi còn trên trang.
    noteTimer = setInterval(function () { if (!el.isConnected) { clearInterval(noteTimer); return; } drawNote(); }, 30000);

    var el = h('div', { class: 'deadline' },
      h('label', { class: 'check' }, on, 'Có hạn nộp'),
      body);
    return {
      el: el,
      value: function () { var d = current(); return d ? d.toISOString() : ''; }
    };
  }

  function statusPill(my, maxScore) {
    if (!my || my.status === 'todo') return h('span', { class: 'pill p-todo' }, 'Chưa nộp');
    if (my.status === 'returned') return h('span', { class: 'pill p-done' }, 'Điểm ' + fmtScore(my.score) + '/' + fmtScore(maxScore));
    if (my.status === 'reopened') return h('span', { class: 'pill p-todo' }, 'Được nộp lại');
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
        var oldServer = msg === 'Yêu cầu không hợp lệ.';
        if (oldServer) msg = 'Máy chủ chưa được cập nhật bản mới. Admin cần dán lại Code.gs vào Apps Script và triển khai phiên bản mới.';
        var e = new Error(msg);
        e.code = data.code;
        e.oldServer = oldServer;
        throw e;
      }
      return data;
    });
  }

  function setSession(t, user) {
    var sameUser = !!(t && me && user && me.username === user.username);
    token = t;
    me = user;
    coursesCache = null;
    viewCache = {};
    store.set('ttm_token', t);
    saveMe();
    if (!sameUser) fileCache.clear();
  }

  var refreshEl = null;
  function refreshing(on) {
    if (!refreshEl) {
      refreshEl = h('div', { class: 'refreshing', role: 'status' }, h('span', { class: 'spinner' }), 'Đang cập nhật…');
      document.body.appendChild(refreshEl);
    }
    refreshEl.classList.toggle('show', !!on);
  }

  function saveMe() {
    store.set('ttm_me', me ? JSON.stringify(me) : null);
  }

  /**
   * Vẽ trang từ dữ liệu lần trước (nếu có) NGAY LẬP TỨC, đồng thời hỏi máy chủ dữ liệu mới;
   * dữ liệu mới khác thì vẽ lại. draw(d, fromCache). onError chỉ gọi khi chưa có gì để vẽ.
   * skip(): trả true để bỏ qua lần vẽ lại (vd. đang có thay đổi chưa lưu xong).
   */
  function showCached(key, fetcher, draw, onError, skip) {
    var seq = routeSeq;
    var had = viewCache[key];
    var before = had ? JSON.stringify(had) : null;
    if (had) { draw(had, true); refreshing(true); }
    return fetcher().then(function (d) {
      viewCache[key] = d;
      if (seq !== routeSeq) return;
      refreshing(false);
      if (before === JSON.stringify(d)) { viewCache[key] = had; return; }
      if (had && skip && skip()) return;
      draw(d, false);
    }, function (e) {
      if (seq !== routeSeq) return;
      refreshing(false);
      if (!had) onError(e);
      else if (e.code !== 401) toast('Chưa cập nhật được dữ liệu mới: ' + e.message, 'error');
    });
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

  function readArrayBuffer(blob) {
    if (blob && typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Không đọc được dữ liệu file.')); };
      r.readAsArrayBuffer(blob);
    });
  }

  function readText(blob) {
    if (blob && typeof blob.text === 'function') return blob.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('Không đọc được nội dung văn bản.')); };
      r.readAsText(blob);
    });
  }

  /** Ảnh chụp điện thoại thường 3–6 MB: thu nhỏ còn cạnh dài 1800px, JPEG ~ 300–600 KB. */
  function isHeic(file) { return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || ''); }
  /**
   * Thu nhỏ ảnh trước khi gửi. Ảnh HEIC (iPhone) luôn được đổi sang JPG để giáo viên mở được trên mọi máy;
   * trình duyệt không đọc được HEIC (Chrome trên máy tính, Android) thì báo lỗi thay vì gửi file không xem được.
   */
  function heicError(file) {
    return new Error('Máy này không đọc được ảnh "' + file.name + '" (định dạng HEIC của iPhone). Em hãy bấm 📷 Chụp ảnh, hoặc gửi ảnh JPG / PNG.');
  }
  function compressImage(file) {
    var heic = isHeic(file);
    return new Promise(function (resolve, reject) {
      if (!heic && (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < 400 * 1024)) return resolve(file);
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
          if (!b) return heic ? reject(heicError(file)) : resolve(file);
          if (!heic && b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); if (heic) reject(heicError(file)); else resolve(file); };
      img.src = url;
    });
  }

  function base64ToBlob(d) {
    var bin = atob(d.data);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: d.mimeType || 'application/octet-stream' });
  }

  /**
   * File đã tải (PDF, ảnh bài nộp…) được nhớ trong trình duyệt (Cache Storage) theo tài khoản,
   * để lần sau mở lại không phải tải qua Apps Script (rất chậm với file lớn).
   * Xóa sạch khi đăng xuất / đổi tài khoản; tự bỏ file quá 30 ngày.
   */
  var fileCache = {
    NAME: 'ttm-files-v1',
    MAX_BYTES: 30 * 1024 * 1024,
    MAX_AGE: 30 * 24 * 3600 * 1000,
    ok: function () { return !!(window.caches && window.isSecureContext); },
    url: function (key) { return location.origin + '/__ttm_file__/' + encodeURIComponent((me ? me.username : '') + '|' + key); },
    get: function (key) {
      if (!fileCache.ok()) return Promise.resolve(null);
      return caches.open(fileCache.NAME).then(function (c) { return c.match(fileCache.url(key)); }).then(function (res) {
        if (!res) return null;
        return res.blob().then(function (b) { return { name: decodeURIComponent(res.headers.get('x-name') || ''), blob: b }; });
      }).catch(function () { return null; });
    },
    put: function (key, r) {
      if (!fileCache.ok() || !r.blob || r.blob.size > fileCache.MAX_BYTES) return;
      var res = new Response(r.blob, { headers: { 'content-type': r.blob.type || 'application/octet-stream', 'x-name': encodeURIComponent(r.name || ''), 'x-time': String(Date.now()) } });
      caches.open(fileCache.NAME).then(function (c) { return c.put(fileCache.url(key), res); }).catch(function () { /* hết chỗ… bỏ qua */ });
    },
    clear: function () {
      if (fileCache.ok()) caches.delete(fileCache.NAME).catch(function () {});
    },
    prune: function () {
      if (!fileCache.ok()) return;
      caches.open(fileCache.NAME).then(function (c) {
        return c.keys().then(function (reqs) {
          return Promise.all(reqs.map(function (req) {
            return c.match(req).then(function (res) {
              var t = Number(res && res.headers.get('x-time'));
              if (!t || Date.now() - t > fileCache.MAX_AGE) return c.delete(req);
            });
          }));
        });
      }).catch(function () {});
    }
  };
  // Chỉ nhớ lâu những file không đổi theo khóa (tài liệu, file đề có tên + dung lượng, ảnh bài nộp, hình câu hỏi).
  var PERSIST_KEY = /^(doc|asg|sub|qimg):/;

  var blobCache = {};
  // Giới hạn tải file/hình qua Apps Script tối đa 3 lượt cùng lúc để không bắn ồ ạt.
  var blobActive = 0;
  var blobQueue = [];
  var MAX_BLOB_CONCURRENT = 3;
  function pumpBlobQueue() {
    while (blobActive < MAX_BLOB_CONCURRENT && blobQueue.length) {
      blobQueue.shift()();
    }
  }
  function runBlobFetch(fetcher) {
    return new Promise(function (resolve, reject) {
      blobQueue.push(function () {
        blobActive++;
        Promise.resolve().then(fetcher).then(function (v) {
          blobActive--;
          pumpBlobQueue();
          resolve(v);
        }, function (e) {
          blobActive--;
          pumpBlobQueue();
          reject(e);
        });
      });
      pumpBlobQueue();
    });
  }
  /** fetcher: () => Promise<{name,mimeType,data}>; key dùng để nhớ, tránh tải lại. */
  function getBlob(key, fetcher) {
    if (!blobCache[key]) {
      var persist = PERSIST_KEY.test(key);
      blobCache[key] = (persist ? fileCache.get(key) : Promise.resolve(null)).then(function (hit) {
        if (hit) return hit;
        return runBlobFetch(fetcher).then(function (d) {
          var r = { name: d.name, blob: base64ToBlob(d) };
          if (persist) fileCache.put(key, r);
          return r;
        });
      });
      blobCache[key].catch(function () { delete blobCache[key]; });
    }
    return blobCache[key];
  }
  /** Địa chỉ xem ảnh của một file đã tải: mỗi file chỉ tạo một lần, dùng lại khi vẽ lại giao diện. */
  function blobUrl(r) { return r.url || (r.url = URL.createObjectURL(r.blob)); }

  function saveBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a);
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
        document.head.appendChild(s);
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
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      if (observer) observer.disconnect();
      if (pdfDoc) pdfDoc.destroy();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    document.body.appendChild(overlay);

    getBlob(key, fetcher).then(function (r) {
      dlBtn.addEventListener('click', function () { saveBlob(r.name, r.blob); });
      var type = r.blob.type;
      if (type === 'application/pdf' || /\.pdf$/i.test(r.name)) return showPdf(r.blob);
      if (/^image\//.test(type)) {
        fill(body, h('img', { class: 'viewer-img', src: blobUrl(r), alt: title }));
        return;
      }
      if (/^text\//.test(type)) {
        return readText(r.blob).then(function (t) { fill(body, h('pre', { class: 'viewer-text' }, t)); });
      }
      fill(body, h('div', { class: 'viewer-empty' },
        h('p', null, 'Không xem trước được loại file này trên web.'),
        h('button', { class: 'btn', onclick: function () { saveBlob(r.name, r.blob); } }, 'Tải về để mở')));
    }).catch(function (e) {
      fill(body, h('div', { class: 'viewer-empty' }, h('p', null, e.message)));
    });

    function showPdf(blob) {
      return loadPdfJs().then(function (lib) {
        return readArrayBuffer(blob).then(function (buf) { return lib.getDocument({ data: buf }).promise; });
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

    // Chỉ vẽ các trang đang ở gần chỗ đang xem; trang cuộn đi xa thì xóa hình để trả bộ nhớ
    // (tài liệu 20–30 trang trên iPad / điện thoại cũ không bị văng).
    var observer = null;
    var renderGen = 0;
    function renderPages() {
      if (observer) observer.disconnect();
      var gen = ++renderGen;
      var width = Math.min(body.clientWidth - 24, 1000) * zoom;
      var pages = h('div', { class: 'viewer-pages' });
      fill(body, pages);
      var ratio = window.devicePixelRatio || 1;
      function draw(canvas) {
        if (canvas._tok) return;
        var tok = canvas._tok = {};
        return pdfDoc.getPage(canvas._n).then(function (page) {
          if (canvas._tok !== tok || gen !== renderGen || !overlay.isConnected) return;
          var v1 = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: (width / v1.width) * ratio });
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = (vp.width / ratio) + 'px';
          canvas.style.height = (vp.height / ratio) + 'px';
          canvas._task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
          return canvas._task.promise.then(function () { canvas._task = null; }, function () { /* đã hủy */ });
        });
      }
      function release(canvas) {
        if (!canvas._tok) return;
        canvas._tok = null;
        if (canvas._task) { canvas._task.cancel(); canvas._task = null; }
        canvas.width = canvas.height = 0;
      }
      pdfDoc.getPage(1).then(function (p1) {
        if (gen !== renderGen) return;
        var v1 = p1.getViewport({ scale: 1 });
        var slots = [];
        for (var n = 1; n <= pdfDoc.numPages; n++) {
          var canvas = h('canvas', { class: 'viewer-page' });
          canvas._n = n;
          canvas.width = canvas.height = 0;
          canvas.style.width = width + 'px';
          canvas.style.height = (width * v1.height / v1.width) + 'px';
          pages.appendChild(canvas);
          slots.push(canvas);
        }
        if (!('IntersectionObserver' in window)) {
          slots.reduce(function (chain, c) { return chain.then(function () { return draw(c); }); }, Promise.resolve());
          return;
        }
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) draw(en.target); else release(en.target); });
        }, { root: body, rootMargin: '1500px 0px' });
        slots.forEach(function (c) { observer.observe(c); });
      });
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
    // Trang cũ có thể còn việc chạy ngầm (đồng hồ làm bài…) → dọn trước khi vẽ trang mới.
    if (leaveGuard && leaveGuard.onLeave) leaveGuard.onLeave();
    leaveGuard = null;
    routeSeq++;
    refreshing(false);
    feeSync.detach();
    renderNav();
    var parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 'tro-choi' && window.TTMPlay) {
      window.scrollTo(0, 0);
      return window.TTMPlay.render(parts.slice(1));
    }
    if (parts[0] === 'muc-luc') {
      window.scrollTo(0, 0);
      return renderCatalog(parts[1]);
    }
    if (parts[0] === 'tai-lieu-mien-phi') {
      window.scrollTo(0, 0);
      return renderFreeDocs(parts[1]);
    }
    if (!token) return renderLogin();
    if (!me) return boot();
    if (parts[0] && ['khoa', 'bai', 'luyen', 'soan-de', 'giao-bai', 'tai-khoan', 'hoc-phi', 'dau', 'dau-host'].indexOf(parts[0]) >= 0) refreshMe();
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'khoa': if (parts[1]) return renderCourse(parts[1]); break;
      case 'bai': if (parts[1]) return renderAssignment(parts[1]); break;
      case 'luyen': if (parts[1]) return renderQuiz(parts[1]); break;
      case 'soan-de': return renderQuizEditor(parts[1], parts[2]);
      case 'giao-bai': return renderAssignmentEditor(parts[1], parts[2]);
      case 'dau-host':
        if (!window.TTMGame) return;
        if (parts[1]) return window.TTMGame.renderHost(parts[1]);
        break;
      case 'dau':
        if (!window.TTMGame) return;
        if (parts[1]) return window.TTMGame.renderPlay(parts[1]);
        return window.TTMGame.renderJoin();
      case 'tai-khoan': if (me.role === 'admin') return renderUsers(); break;
      case 'hoc-phi': if (me.role === 'admin') return renderFees(parts[1]); break;
    }
    return renderHome();
  }

  function boot() {
    fill(app, loading());
    meChecked = true;
    api('me').then(function (d) { me = d.user; saveMe(); route(); }, function (e) {
      if (token) fill(app, errorBox(e.message, boot));
    });
  }

  /**
   * Đã có thông tin tài khoản lưu trong máy → vẽ trang ngay, hỏi lại máy chủ ở phía sau
   * (trang chủ không cần: lần gọi 'home' đã trả kèm thông tin tài khoản).
   */
  function refreshMe() {
    if (meChecked || !token) return;
    meChecked = true;
    var t = token;
    api('me').then(function (d) { if (t === token) updateMe(d.user); }, function () { /* 401 → api() tự đưa về đăng nhập */ });
  }
  function updateMe(user) {
    meChecked = true;
    if (!user || !token) return;
    var changed = JSON.stringify(user) !== JSON.stringify(me);
    var roleChanged = !me || me.role !== user.role || String(me.courses) !== String(user.courses);
    me = user;
    saveMe();
    if (changed) renderNav();
    if (roleChanged) { viewCache = {}; route(); }
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
      var guestClose = function (e) { var d = e.target.closest('details'); if (d) d.open = false; };
      fill(navUser,
        h('nav', { class: 'nav-links' },
          h('a', { href: '../', class: 'nav-link nav-home-link' }, '← Trang chủ'),
          h('a', { href: '#/muc-luc', class: 'nav-link' }, '📚 Các lớp'),
          h('a', { href: '#/tai-lieu-mien-phi', class: 'nav-link' }, '🎁 Tài liệu miễn phí'),
          h('a', { href: '#/tro-choi', class: 'nav-link' }, '🎨 Trò chơi')
        ),
        h('details', { class: 'user-menu guest-menu' },
          h('summary', { 'aria-label': 'Menu' }, '☰', h('span', { class: 'guest-menu-word' }, ' Menu')),
          h('div', { class: 'user-menu-list' },
            h('a', { href: '../', class: 'nav-home-link', onclick: guestClose }, '← Trang chủ'),
            h('a', { href: '#/muc-luc', onclick: guestClose }, '📚 Các lớp'),
            h('a', { href: '#/tai-lieu-mien-phi', onclick: guestClose }, '🎁 Tài liệu miễn phí'),
            h('a', { href: '#/tro-choi', onclick: guestClose }, '🎨 Trò chơi')
          )
        ),
        h('a', { href: '#/', class: 'btn btn-sm' }, 'Đăng nhập')
      );
      return;
    }
    var links = [
      h('a', { href: '#/', class: 'nav-link' }, 'Khóa học'),
      h('a', { href: '#/dau', class: 'nav-link' }, '🎮 Đấu cả lớp'),
      h('a', { href: '#/tro-choi', class: 'nav-link' }, '🎨 Trò chơi'),
      h('a', { href: '#/tai-lieu-mien-phi', class: 'nav-link' }, '🎁 Tài liệu miễn phí')
    ];
    if (me.role === 'admin') {
      links.push(h('a', { href: '#/hoc-phi', class: 'nav-link' }, 'Học phí'));
      links.push(h('a', { href: '#/tai-khoan', class: 'nav-link' }, 'Tài khoản'));
    }
    var closeMenu = function (e) { e.target.closest('details').open = false; };
    fill(navUser,
      h('nav', { class: 'nav-links' }, links),
      h('details', { class: 'user-menu' },
        h('summary', null,
          h('span', { class: 'user-name' }, me.fullName),
          h('span', { class: 'role-badge role-' + me.role }, ROLE_LABEL[me.role] || me.role)),
        h('div', { class: 'user-menu-list' },
          h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/'); } }, 'Khóa học'),
          h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/dau'); } }, '🎮 Đấu cả lớp'),
          h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/tro-choi'); } }, '🎨 Trò chơi'),
          h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/tai-lieu-mien-phi'); } }, '🎁 Tài liệu miễn phí'),
          me.role === 'admin' ? h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/hoc-phi'); } }, 'Thống kê & học phí') : null,
          me.role === 'admin' ? h('button', { class: 'menu-mobile', onclick: function (e) { closeMenu(e); go('#/tai-khoan'); } }, 'Quản lý tài khoản') : null,
          h('button', { onclick: function (e) { closeMenu(e); changePassword(); } }, 'Đổi mật khẩu'),
          h('button', { onclick: logout }, 'Đăng xuất'))));
  }

  function logout() {
    if (leaveGuard && !leaveGuard()) return;
    leaveGuard = null;
    feeSync.flush();
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
        meChecked = true;
        // Đổi hash đã tự gọi route() (hashchange) → không gọi thêm lần nữa (tránh tải trang chủ 2 lần).
        if (!location.hash || location.hash === '#') location.hash = '#/';
        else route();
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
        h('p', { class: 'small muted' }, 'Chưa có tài khoản hoặc quên mật khẩu? Liên hệ ' + CONTACT + '.'),
        h('div', { class: 'login-free-game' },
          h('p', null, '🎨 Chưa có tài khoản? Chơi thử trò chơi miễn phí'),
          h('a', { href: '#/tro-choi', class: 'btn btn-sm btn-ghost' }, 'Chơi trò chơi →'),
          h('div', { class: 'login-free-links' },
            h('a', { href: '#/muc-luc', class: 'small muted' }, '📚 Xem các lớp và chủ đề bài học'),
            h('span', { class: 'muted small' }, ' · '),
            h('a', { href: '#/tai-lieu-mien-phi', class: 'small muted' }, '🎁 Kho tài liệu miễn phí')
          )
        ))));
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
    var feeBox = h('div', { class: 'fee-box' });
    var grid = h('div', { class: 'grid courses' }, loading());
    fill(app,
      h('div', { class: 'page-head' }, h('h1', null, 'Xin chào, ' + me.fullName), h('p', { class: 'muted' }, greet)),
      feeBox,
      todoBox,
      h('h2', { class: 'section-title' }, 'Khóa học của ' + (me.role === 'student' ? 'em' : 'bạn')),
      grid);

    showCached('home', fetchHome, function (d) {
      if (d.user) updateMe(d.user);
      coursesCache = d.courses;
      fill(feeBox);
      fill(todoBox);
      if (!d.courses.length) {
        fill(grid, h('div', { class: 'panel empty span-all' },
          h('p', null, 'Bạn chưa được ghi danh vào khóa học nào.'),
          h('p', { class: 'muted' }, 'Liên hệ ' + CONTACT + ' để được mở khóa học.')));
        return;
      }
      fill(grid, d.courses.map(courseCard));
      renderFeeBox(feeBox, d);
      renderTodo(todoBox, d.items || []);
    }, function (e) { fill(grid, errorBox(e.message, renderHome)); });
  }

  /** Trang chủ: một lần gọi 'home'. Máy chủ chưa cập nhật → gọi 'courses' và 'todo' song song. */
  var homeAction = true;
  function fetchHome() {
    var fallback = function () {
      return Promise.all([api('courses'), api('todo').catch(function () { return { items: [] }; })]).then(function (r) {
        return Object.assign({}, r[1], { courses: r[0].courses });
      });
    };
    if (!homeAction) return fallback();
    return api('home').then(function (d) { delete d.ok; return d; }, function (e) {
      if (!e.oldServer) throw e;
      homeAction = false;
      return fallback();
    });
  }

  function renderTodo(box, items) {
    var courseLabel = function (i) { return (i.branch ? i.branch + ' · ' : '') + i.courseName + ' · ' + i.courseGrade; };
    if (me.role === 'student') {
      var todo = items.filter(function (i) { return i.my.status === 'todo' || i.my.status === 'reopened'; })
        .sort(function (a, b) { return (a.dueAt || '9') < (b.dueAt || '9') ? -1 : 1; });
      var graded = items.filter(function (i) { return i.my.status === 'returned'; }).slice(0, 3);
      if (!todo.length && !graded.length) return;
      fill(box,
        h('h2', { class: 'section-title' }, todo.length ? 'Bài tập cần làm (' + todo.length + ')' : 'Bài tập'),
        todo.length ? h('div', { class: 'task-list' }, todo.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-hw' }, 'BÀI TẬP'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, courseLabel(i))),
            dueBadge(i.dueAt, false));
        })) : h('p', { class: 'panel ok-panel' }, '🎉 Em đã nộp hết bài tập. Giỏi lắm!'),
        graded.length ? h('div', { class: 'task-list compact' }, graded.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-done' }, 'ĐÃ CHẤM'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, (i.branch ? i.branch + ' · ' : '') + i.courseName)),
            statusPill(i.my, i.maxScore));
        })) : null);
    } else if (items.length) {
      fill(box,
        h('h2', { class: 'section-title' }, 'Bài cần chấm'),
        h('div', { class: 'task-list' }, items.map(function (i) {
          return h('a', { class: 'task', href: '#/bai/' + i.id },
            h('span', { class: 'kind k-hw' }, 'CHẤM'),
            h('div', { class: 'task-main' }, h('strong', null, i.title), h('span', { class: 'muted small' }, courseLabel(i))),
            h('span', { class: 'pill p-wait' }, i.stats.ungraded + ' bài chưa chấm'));
        })));
    }
  }

  function courseCard(c, i) {
    var bits = [c.docCount + ' tài liệu', c.quizCount + ' bài luyện', c.assignmentCount + ' bài tập'];
    return h('a', { class: 'card course', href: '#/khoa/' + encodeURIComponent(c.id), style: '--c:' + COURSE_COLORS[i % COURSE_COLORS.length] },
      h('span', { class: 'tag' }, c.grade),
      h('h3', null, c.name),
      c.branches && c.branches.length ? h('p', { class: 'course-branches' }, c.branches.join(' · ')) : null,
      h('p', null, c.teachers.length ? c.teachers.join(', ') : 'Chưa phân giáo viên'),
      h('p', { class: 'course-meta' }, bits.join(' · '),
        c.canEdit && me.role !== 'student' ? h('span', { class: 'pill p-blue' }, 'Bạn quản lý') : null));
  }

  var catalogOrder = []; // thứ tự các lớp trong mục lục công khai: tô màu lớp khi chưa đăng nhập
  function courseColor(id) {
    var idx = (coursesCache || []).findIndex(function (c) { return c.id === id; });
    if (idx < 0) idx = catalogOrder.indexOf(id);
    return COURSE_COLORS[(idx < 0 ? 0 : idx) % COURSE_COLORS.length];
  }

  /* ═════════ Trang khóa học: chủ đề → tài liệu, luyện tập, bài tập ═════════ */

  var courseFilter = 'all';
  var courseBranch = {};

  /** Nhánh đang chọn của khóa c (nhớ trong bộ nhớ và localStorage, mặc định nhánh đầu). */
  function activeBranch(c) {
    var list = (c && c.branches) || [];
    if (!list.length) return '';
    var b = courseBranch[c.id] || store.get('ttm_branch:' + c.id) || '';
    if (list.indexOf(b) < 0) b = list[0];
    courseBranch[c.id] = b;
    return b;
  }

  function setActiveBranch(courseId, b) {
    courseBranch[courseId] = b;
    store.set('ttm_branch:' + courseId, b);
  }

  /** Ô chọn nhánh cho khóa có chia nhánh (trả null nếu khóa không chia nhánh). */
  function branchSelect(c, val) {
    var list = (c && c.branches) || [];
    if (!list.length) return null;
    var cur = val && list.indexOf(val) >= 0 ? val : activeBranch(c);
    return h('select', null, list.map(function (b) {
      return h('option', { value: b, selected: b === cur }, b);
    }));
  }

  /** Khóa so khớp chủ đề: bỏ hoa/thường, dấu cách, gạch nối, chấm phẩy → "Topic 5 - Logic" = "Topic 5 Logic". */
  function topicKey(t) {
    return String(t || '').normalize('NFC').toLowerCase().replace(/[\s\-–—_.,:;()\/|]+/g, '');
  }

  /** Số đầu tiên trong tên chủ đề (Topic 4 → 4, Chủ đề 8-9 → 8). */
  function topicNum(t) {
    var m = /\d+/.exec(t);
    return m ? Number(m[0]) : Infinity;
  }

  function topicSort(a, b) {
    if (a === NO_TOPIC) return 1;
    if (b === NO_TOPIC) return -1;
    // Chủ đề mới nhất (số lớn nhất) lên đầu: 10, 9, 8…; chủ đề không có số xếp sau cùng.
    var na = topicNum(a), nb = topicNum(b);
    if (na !== nb) {
      if (na === Infinity) return 1;
      if (nb === Infinity) return -1;
      return nb - na;
    }
    return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
  }

  /**
   * Gom các tên chủ đề viết hơi khác nhau về một tên hiển thị: tên được dùng nhiều nhất,
   * hòa thì lấy tên dài hơn. Trả về { key: tên hiển thị }.
   */
  function topicLabels(names) {
    var count = {};
    names.forEach(function (t) { if (t) count[t] = (count[t] || 0) + 1; });
    var best = {};
    Object.keys(count).forEach(function (t) {
      var k = topicKey(t);
      var cur = best[k];
      if (!cur || count[t] > count[cur] || (count[t] === count[cur] && t.length > cur.length)) best[k] = t;
    });
    return best;
  }

  function renderCourse(id) {
    if (!viewCache['course:' + id]) fill(app, loading());
    showCached('course:' + id, function () {
      return Promise.all([api('course', { courseId: id }), getCourses()]).then(function (res) { delete res[0].ok; return res[0]; });
    }, drawCourse, function (e) {
      fill(app, h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'), errorBox(e.message, function () { renderCourse(id); }));
    });
  }

  function drawCourse(d) {
    var c = d.course;
    var edit = c.canEdit;
    var branches = c.branches || [];
    var curBranch = activeBranch(c);
    // Sau khi sửa: vẽ lại ngay (kèm thay đổi đã biết, vd. tài liệu vừa xóa) rồi lấy dữ liệu mới ở phía sau.
    var reload = function (change) {
      if (change) change(d);
      coursesCache = null;
      renderCourse(c.id);
    };

    function inBranch(x) {
      if (!branches.length) return true;
      var b = branches.indexOf(x.branch) >= 0 ? x.branch : branches[0];
      return b === curBranch;
    }

    var branchBar = branches.length ? h('div', { class: 'branch-tabs', role: 'tablist', style: '--c:' + courseColor(c.id) }) : null;
    var content = h('div');
    var chipBar = h('div', { class: 'chips filter' });

    function drawBranches() {
      if (!branchBar) return;
      fill(branchBar, branches.map(function (b) {
        var on = b === curBranch;
        return h('button', {
          type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false',
          class: 'branch-tab' + (on ? ' active' : ''),
          onclick: function () { curBranch = b; setActiveBranch(c.id, b); drawBranches(); drawFilters(); drawContent(); }
        }, b);
      }));
    }

    function drawFilters() {
      var nDoc = d.docs.filter(inBranch).length;
      var nQuiz = d.quizzes.filter(inBranch).length;
      var nHw = d.assignments.filter(inBranch).length;
      var filters = [['all', 'Tất cả'], ['doc', 'Tài liệu (' + nDoc + ')'], ['quiz', 'Luyện tập (' + nQuiz + ')'], ['hw', 'Bài tập (' + nHw + ')']];
      fill(chipBar, filters.map(function (f) {
        return h('button', { class: 'chip-btn' + (courseFilter === f[0] ? ' active' : ''), onclick: function () { courseFilter = f[0]; drawFilters(); drawContent(); } }, f[1]);
      }));
    }

    function drawContent() {
      var showHw = courseFilter === 'all' || courseFilter === 'hw';
      var showTopics = courseFilter !== 'hw';
      var hws = showHw ? d.assignments.filter(inBranch) : [];
      var items = [];
      if (courseFilter === 'all' || courseFilter === 'doc') d.docs.filter(inBranch).forEach(function (x) { items.push({ kind: 'doc', x: x }); });
      if (courseFilter === 'all' || courseFilter === 'quiz') d.quizzes.filter(inBranch).forEach(function (x) { items.push({ kind: 'quiz', x: x }); });
      if (!items.length && !hws.length) {
        fill(content, h('div', { class: 'panel empty' },
          h('p', null, 'Chưa có nội dung nào' + (courseFilter === 'all' ? (branches.length ? ' trong nhánh ' + curBranch + '.' : ' trong khóa này.') : ' ở mục này.')),
          edit ? h('p', { class: 'muted' }, 'Dùng các nút "+ Tài liệu", "+ Luyện tập", "+ Bài tập" ở trên để thêm.') : null));
        return;
      }
      // Bài tập về nhà gom theo tuần (Thứ 2 – Chủ nhật); chủ đề chỉ gồm tài liệu và luyện tập.
      var parts = [];
      if (hws.length) parts.push(sectionHead('📅 Bài tập về nhà'), weekGroups(hws, edit));
      if (showTopics && items.length) {
        var groups = {};
        var labels = topicLabels(items.map(function (it) { return it.x.topic; }));
        items.forEach(function (it) {
          var t = it.x.topic ? labels[topicKey(it.x.topic)] : NO_TOPIC;
          (groups[t] = groups[t] || []).push(it);
        });
        var order = { quiz: 0, doc: 1 };
        if (hws.length) parts.push(sectionHead('📚 Chủ đề'));
        parts.push(Object.keys(groups).sort(topicSort).map(function (t) {
          var list = groups[t].sort(function (a, b) { return order[a.kind] - order[b.kind]; });
          return h('details', { class: 'topic', open: true },
            h('summary', null, h('span', { class: 'topic-name' }, t), h('span', { class: 'topic-count' }, list.length + ' mục')),
            h('div', { class: 'topic-items' }, list.map(function (it) {
              if (it.kind === 'doc') return docRow(it.x, c, d.topics, reload);
              return quizRow(it.x, edit);
            })));
        }));
      }
      fill(content, parts);
    }

    var adds = edit ? h('div', { class: 'add-bar' },
      h('button', { class: 'btn btn-sm', onclick: function () { docForm(c, d.topics, null, reload); } }, '+ Tài liệu'),
      h('button', { class: 'btn btn-sm', onclick: function () { go('#/soan-de/' + encodeURIComponent(c.id)); } }, '+ Luyện tập'),
      h('button', { class: 'btn btn-sm', onclick: function () { go('#/giao-bai/' + encodeURIComponent(c.id)); } }, '+ Bài tập')) : null;

    fill(app,
      h('a', { href: '#/', class: 'back' }, '← Tất cả khóa học'),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(c.id) },
        h('span', { class: 'tag' }, c.grade),
        h('h1', null, c.name)),
      branchBar,
      h('div', { class: 'course-tools' }, chipBar, adds),
      content);
    drawBranches();
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

  function docRow(doc, c, topics, reload) {
    var edit = c.canEdit;
    var kind = doc.type === 'link' ? (/youtu\.?be/i.test(doc.url) ? ['VIDEO', 'k-video'] : ['LINK', 'k-link']) : fileKind(doc.mimeType, doc.fileName);
    var fetcher = function () { return api('file', { id: doc.id }); };
    var actions = doc.type === 'link'
      ? [h('a', { class: 'btn btn-sm', href: doc.url, target: '_blank', rel: 'noopener' }, 'Mở link')]
      : fileButtons(doc.title, { mimeType: doc.mimeType, name: doc.fileName }, 'doc:' + doc.id, fetcher);
    if (edit) {
      actions.push(rowMenu([
        ['Sửa tên / chủ đề', function () { docForm(c, topics, doc, reload); }],
        ['Xóa tài liệu', function () {
          confirmBox('Xóa tài liệu?', 'Tài liệu "' + doc.title + '" sẽ bị xóa khỏi khóa học. File gốc được chuyển vào Thùng rác của Google Drive.', 'Xóa', function () {
            return api('deleteDoc', { id: doc.id }).then(function () {
              toast('Đã xóa tài liệu.', 'success');
              reload(function (d) { d.docs = d.docs.filter(function (x) { return x.id !== doc.id; }); });
            });
          });
        }, true]
      ]));
    }
    var meta = [doc.uploadedBy, fmtDate(doc.uploadedAt), doc.type === 'file' ? fmtSize(doc.size) : null].filter(Boolean).join(' · ');
    return h('article', { class: 'item' },
      h('span', { class: 'kind ' + kind[1] }, kind[0]),
      h('div', { class: 'item-main' },
        h('h3', null, doc.title, doc.free ? ' ' : null, doc.free ? h('span', { class: 'pill p-done' }, 'Miễn phí') : null),
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
      h('div', { class: 'item-actions' }, q.gameOnly ? h('span', { class: 'pill p-wait' }, '🎮 Chỉ để đấu') : null, right, h('span', { class: 'chev' }, '›')));
  }

  function sectionHead(text) {
    return h('h2', { class: 'section-head' }, text);
  }

  /** Thứ 2 đầu tuần (0 giờ, giờ máy) của một thời điểm. */
  function weekStart(t) {
    var d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }

  /**
   * Bài tập về nhà gom theo tuần của hạn nộp (không có hạn → theo ngày giao).
   * Tuần mới nhất ở trên; tuần này và các tuần sau mở sẵn, tuần đã qua thu gọn.
   */
  function weekGroups(list, edit) {
    var dm = function (x) { return x.getDate() + '/' + (x.getMonth() + 1); };
    var thisWeek = weekStart(Date.now()).getTime();
    var groups = {};
    list.forEach(function (a) {
      var ws = weekStart(a.dueAt || a.createdAt || Date.now()).getTime();
      (groups[ws] = groups[ws] || []).push(a);
    });
    return Object.keys(groups).map(Number).sort(function (x, y) { return y - x; }).map(function (ws) {
      var from = new Date(ws);
      var to = new Date(ws);
      to.setDate(to.getDate() + 6);
      var range = dm(from) + ' – ' + dm(to);
      var weeks = Math.round((ws - thisWeek) / (7 * 24 * 3600 * 1000));
      var name = weeks === 0 ? 'Tuần này (' + range + ')' : weeks === 1 ? 'Tuần sau (' + range + ')' : weeks === -1 ? 'Tuần trước (' + range + ')' : 'Tuần ' + range;
      var key = function (a) { return a.dueAt || a.createdAt || ''; };
      var items = groups[ws].sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
      return h('details', { class: 'topic week' + (weeks === 0 ? ' week-now' : ''), open: weeks >= 0 },
        h('summary', null, h('span', { class: 'topic-name' }, name), h('span', { class: 'topic-count' }, items.length + ' bài')),
        h('div', { class: 'topic-items' }, items.map(function (a) { return hwRow(a, edit); })));
    });
  }

  function hwRow(a, edit) {
    var right;
    if (edit) {
      right = h('span', { class: 'pill ' + (a.stats.ungraded ? 'p-wait' : 'p-blue') },
        'Đã nộp ' + a.stats.submitted + '/' + a.stats.students + (a.stats.ungraded ? ' · ' + a.stats.ungraded + ' chưa chấm' : ''));
    } else {
      right = statusPill(a.my, a.maxScore);
    }
    var done = edit || (a.my && a.my.status !== 'todo' && a.my.status !== 'reopened');
    return h('a', { class: 'item link', href: '#/bai/' + a.id },
      h('span', { class: 'kind k-hw' }, 'BÀI TẬP'),
      h('div', { class: 'item-main' },
        h('h3', null, a.title),
        h('p', { class: 'item-meta' }, dueBadge(a.dueAt, done),
          a.questionCount ? h('span', { class: 'muted small' }, ' ' + a.questionCount + ' câu' + (a.essayCount ? ' · ' + a.essayCount + ' tự luận' : ' · chấm tự động')) : null,
          a.topic ? h('span', { class: 'muted small' }, ' · ' + a.topic) : null)),
      h('div', { class: 'item-actions' }, right, h('span', { class: 'chev' }, '›')));
  }

  function topicOptions(topics) {
    var m = topicLabels(topics || []);
    return Object.keys(m).map(function (k) { return m[k]; }).sort(topicSort).map(function (t) { return h('option', { value: t }); });
  }

  function topicInput(topics, value) {
    var listId = 'topics-' + Math.random().toString(36).slice(2);
    var input = h('input', { list: listId, value: value || '', maxlength: '100', placeholder: 'VD: Chủ đề 1: Phân số' });
    return [input, h('datalist', { id: listId }, topicOptions(topics))];
  }

  /**
   * Thêm tài liệu (doc = null) hoặc sửa tên/nhánh/chủ đề/mô tả.
   * opts.courses: cho chọn lớp ngay trong form (Kho tài liệu miễn phí); opts.free: tích sẵn Miễn phí.
   */
  function docForm(c, topics, doc, onDone, opts) {
    opts = opts || {};
    var mode = 'file';
    var br = null;
    var brWrap = h('div');
    var ti = topicInput(topics, doc ? doc.topic : '');
    function drawBranch() {
      br = branchSelect(c, doc ? doc.branch : '');
      fill(brWrap, br ? field('Nhánh', br) : null);
      brWrap.hidden = !br;
    }
    drawBranch();
    var courseSel = null;
    if (opts.courses && !doc) {
      courseSel = h('select', null, opts.courses.map(function (x) {
        return h('option', { value: x.id, selected: x.id === c.id }, x.name + (x.grade ? ' · ' + x.grade : ''));
      }));
      var loadTopics = function () {
        // Chủ đề gợi ý lấy từ toàn bộ lớp (cả tài liệu không miễn phí), tải thêm trong lúc điền form.
        var id = c.id;
        api('course', { courseId: id }).then(function (d) {
          if (c.id === id) fill(ti[1], topicOptions(d.topics || []));
        }, function () {});
      };
      courseSel.addEventListener('change', function () {
        for (var i = 0; i < opts.courses.length; i++) if (opts.courses[i].id === courseSel.value) c = opts.courses[i];
        drawBranch();
        fill(ti[1]);
        loadTopics();
      });
      loadTopics();
    }
    var title = h('input', { maxlength: '200', value: doc ? doc.title : '', placeholder: 'VD: Bài 3 – Phân số (lý thuyết + bài tập)' });
    var desc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ghi chú cho học sinh (không bắt buộc)' });
    desc.value = doc ? doc.description : '';
    var free = h('input', { type: 'checkbox', checked: doc ? !!doc.free : !!opts.free });
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
      courseSel ? field('Lớp', courseSel) : null,
      doc ? null : fileField, doc ? null : urlField,
      brWrap,
      field('Tiêu đề', title),
      field('Chủ đề', ti, 'Chọn chủ đề có sẵn hoặc gõ tên chủ đề mới.'),
      field('Mô tả', desc),
      h('div', { class: 'field' },
        h('label', { class: 'check' }, free, '🎁 Miễn phí – ai cũng xem được (hiện trong Kho tài liệu miễn phí)')));

    modal(doc ? 'Sửa tài liệu' : 'Thêm tài liệu', body, function (close) {
      var ok = h('button', { class: 'btn' }, doc ? 'Lưu' : 'Đăng tài liệu');
      ok.addEventListener('click', function () {
        var params = { courseId: c.id, title: title.value.trim(), description: desc.value.trim(), topic: ti[0].value.trim(), branch: br ? br.value : '', free: free.checked };
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
          if (doc) { doc.title = params.title; doc.description = params.description; doc.topic = params.topic; if (br) doc.branch = br.value; doc.free = params.free; }
          else if (br) setActiveBranch(c.id, br.value);
          onDone();
        }, function (err) { busy(ok, false); toast(err.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  /* ═════════ Mục lục lớp học công khai ═════════ */

  var catalogBranch = {};

  function renderCatalog(courseId) {
    if (!viewCache['catalog']) fill(app, loading());
    showCached('catalog', function () {
      return api('catalog');
    }, function (d) {
      drawCatalog(d.courses || [], courseId);
    }, function (e) {
      fill(app, errorBox(e.message, function () { renderCatalog(courseId); }));
    });
  }

  function drawCatalog(courses, courseId) {
    catalogOrder = courses.map(function (c) { return c.id; });
    var cur = courses.filter(function (c) { return c.id === courseId; })[0] || courses[0];
    if (!cur) {
      fill(app, h('div', { class: 'panel empty' }, h('p', { class: 'muted' }, 'Chưa có thông tin lớp học.')));
      return;
    }

    var branches = cur.branches || [];
    var curBranch = catalogBranch[cur.id] || (branches.length ? branches[0] : '');
    if (branches.indexOf(curBranch) < 0 && branches.length) curBranch = branches[0];

    var branchBar = branches.length > 1 ? h('div', { class: 'branch-tabs', role: 'tablist', style: '--c:' + courseColor(cur.id) }) : null;
    var content = h('div');

    function drawBranchTabs() {
      if (!branchBar) return;
      fill(branchBar, branches.map(function (b) {
        var on = b === curBranch;
        return h('button', {
          type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false',
          class: 'branch-tab' + (on ? ' active' : ''),
          onclick: function () {
            curBranch = b;
            catalogBranch[cur.id] = b;
            drawBranchTabs();
            drawBranchItems();
          }
        }, b);
      }));
    }

    function drawBranchItems() {
      var items = (cur.items || []).filter(function (it) {
        if (!branches.length || branches.length <= 1) return true;
        return it.branch === curBranch;
      });

      if (!items.length) {
        fill(content, h('div', { class: 'panel empty' },
          h('p', { class: 'muted' }, 'Lớp này đang cập nhật bài học.')));
        return;
      }

      var labels = topicLabels(items.map(function (it) { return it.topic; }));
      var groups = {};
      items.forEach(function (it) {
        var t = it.topic ? labels[topicKey(it.topic)] : NO_TOPIC;
        (groups[t] = groups[t] || []).push(it);
      });

      var topicBlocks = Object.keys(groups).sort(topicSort).map(function (t) {
        var list = groups[t];
        var nDocs = 0, nQuizzes = 0;
        list.forEach(function (it) {
          if (it.kind === 'doc') nDocs++;
          else if (it.kind === 'quiz') nQuizzes++;
        });
        var counts = [];
        if (nDocs) counts.push(nDocs + ' tài liệu');
        if (nQuizzes) counts.push(nQuizzes + ' bài luyện tập');

        var itemEls = list.map(function (it) {
          var isYt = it.type === 'link' && /youtu\.?be/i.test(it.url || '');
          var icon = it.kind === 'quiz' ? '✏️' : (isYt ? '🎬' : '📄');
          var right;
          if (it.free) {
            var btns = it.type === 'link'
              ? [h('a', { class: 'btn btn-sm', href: it.url, target: '_blank', rel: 'noopener' }, 'Mở link')]
              : fileButtons(it.title, { mimeType: it.mimeType, name: it.fileName }, 'free:' + it.id, function () { return api('freeFile', { id: it.id }); });
            right = [h('span', { class: 'pill p-done' }, 'Miễn phí')].concat(btns);
          } else {
            right = h('span', { class: 'ml-lock' }, me ? '🔒 Dành cho học sinh của lớp' : '🔒 Đăng nhập để xem');
          }
          return h('article', { class: 'item ml-item' },
            h('span', { class: 'ml-icon' }, icon),
            h('div', { class: 'item-main' },
              h('h4', { class: 'ml-item-title' }, it.title)
            ),
            h('div', { class: 'item-actions ml-item-actions' }, right)
          );
        });

        return h('div', { class: 'panel ml-topic' },
          h('div', { class: 'ml-topic-head' },
            h('h3', { class: 'ml-topic-title' }, t),
            counts.length ? h('span', { class: 'ml-topic-count muted small' }, counts.join(' · ')) : null
          ),
          h('div', { class: 'ml-topic-items' }, itemEls)
        );
      });

      fill(content, topicBlocks);
    }

    var chips = h('div', { class: 'ml-chips' }, courses.map(function (c) {
      var on = c.id === cur.id;
      var col = courseColor(c.id);
      return h('a', {
        href: '#/muc-luc/' + encodeURIComponent(c.id),
        class: 'ml-chip' + (on ? ' active' : ''),
        style: on ? ('--c:' + col) : ''
      }, c.name + ' · ' + c.grade);
    }));

    var cta = !me ? h('div', { class: 'ml-cta' },
      h('span', null, 'Muốn cho con học? Liên hệ ' + CONTACT),
      h('a', { href: '#/', class: 'btn btn-sm' }, 'Đăng nhập')
    ) : null;

    fill(app,
      h('div', { class: 'page-head' },
        h('h1', null, 'Các lớp học'),
        h('p', { class: 'muted' }, 'Xem các chủ đề và bài học của từng lớp. Học sinh đăng nhập để học; tài liệu có nhãn Miễn phí thì ai cũng xem được.')
      ),
      cta,
      chips,
      branchBar,
      content
    );

    drawBranchTabs();
    drawBranchItems();
  }

  /* ═════════ Kho tài liệu miễn phí ═════════ */

  /** Giáo viên/quản trị: các lớp được thêm/sửa tài liệu ngay trong Kho. */
  function freeEditCourses() {
    if (!me || me.role === 'student') return [];
    return (coursesCache || []).filter(function (c) { return c.canEdit; });
  }

  function renderFreeDocs(courseId) {
    if (!viewCache['freeDocs']) fill(app, loading());
    showCached('freeDocs', function () {
      var job = api('freeDocs');
      if (!me || me.role === 'student') return job;
      return Promise.all([job, getCourses().catch(function () { return []; })]).then(function (r) { return r[0]; });
    }, function (d) {
      drawFreeDocs(d.docs || [], courseId);
    }, function (e) {
      fill(app, errorBox(e.message, function () { renderFreeDocs(courseId); }));
    });
  }

  function drawFreeDocs(docs, courseId) {
    var editable = freeEditCourses();
    var editMap = {};
    editable.forEach(function (c) { editMap[c.id] = c; });
    var reload = function () {
      delete viewCache['freeDocs'];
      renderFreeDocs(courseId);
    };
    var topicsOf = function (cId) {
      return docs.filter(function (d) { return d.courseId === cId; }).map(function (d) { return d.topic; }).filter(Boolean);
    };
    var addBtn = null;
    if (editable.length) {
      addBtn = h('button', {
        class: 'btn', onclick: function () {
          var c = editMap[courseId] || editable[0];
          docForm(c, topicsOf(c.id), null, function () {
            delete viewCache['course:' + c.id];
            reload();
          }, { courses: editable, free: true });
        }
      }, '＋ Thêm tài liệu miễn phí');
    }
    var courseSeen = {};
    var coursesList = [];
    docs.forEach(function (d) {
      if (!courseSeen[d.courseId]) {
        courseSeen[d.courseId] = true;
        coursesList.push({ id: d.courseId, name: d.courseName || d.courseId, grade: d.courseGrade || '' });
      }
    });

    var chips = null;
    if (coursesList.length > 0) {
      var allChip = h('a', {
        href: '#/tai-lieu-mien-phi',
        class: 'ml-chip' + (!courseId ? ' active' : '')
      }, 'Tất cả');
      var courseChips = coursesList.map(function (c) {
        var on = courseId === c.id;
        var col = courseColor(c.id);
        return h('a', {
          href: '#/tai-lieu-mien-phi/' + encodeURIComponent(c.id),
          class: 'ml-chip' + (on ? ' active' : ''),
          style: on ? ('--c:' + col) : ''
        }, c.name + (c.grade ? ' · ' + c.grade : ''));
      });
      chips = h('div', { class: 'ml-chips' }, [allChip].concat(courseChips));
    }

    var content = h('div');
    if (!docs.length) {
      fill(content, h('div', { class: 'panel empty' },
        h('p', { class: 'muted' }, 'Thầy cô chưa chia sẻ tài liệu miễn phí nào. Quay lại sau nhé!')));
    } else {
      var filtered = courseId ? docs.filter(function (d) { return d.courseId === courseId; }) : docs;
      if (!filtered.length) {
        fill(content, h('div', { class: 'panel empty' },
          h('p', { class: 'muted' }, 'Chưa có tài liệu miễn phí nào cho lớp này.')));
      } else {
        var byCourse = {};
        var courseOrder = [];
        filtered.forEach(function (d) {
          if (!byCourse[d.courseId]) {
            byCourse[d.courseId] = [];
            courseOrder.push(d.courseId);
          }
          byCourse[d.courseId].push(d);
        });

        var sections = [];
        courseOrder.forEach(function (cId) {
          var cDocs = byCourse[cId];
          var cName = (cDocs[0] && cDocs[0].courseName) || cId;
          var cGrade = (cDocs[0] && cDocs[0].courseGrade) || '';
          sections.push(h('h2', { class: 'section-title' }, cName + (cGrade ? ' · ' + cGrade : '')));

          var labels = topicLabels(cDocs.map(function (d) { return d.topic; }));
          var byTopic = {};
          cDocs.forEach(function (d) {
            var t = d.topic ? labels[topicKey(d.topic)] : NO_TOPIC;
            (byTopic[t] = byTopic[t] || []).push(d);
          });

          var topicEls = Object.keys(byTopic).sort(topicSort).map(function (t) {
            var topicDocs = byTopic[t];
            var items = topicDocs.map(function (d) {
              var kind = d.type === 'link' ? (/youtu\.?be/i.test(d.url) ? ['VIDEO', 'k-video'] : ['LINK', 'k-link']) : fileKind(d.mimeType, d.fileName);
              var fetcher = function () { return api('freeFile', { id: d.id }); };
              var actions = d.type === 'link'
                ? [h('a', { class: 'btn btn-sm', href: d.url, target: '_blank', rel: 'noopener' }, 'Mở link')]
                : fileButtons(d.title, { mimeType: d.mimeType, name: d.fileName }, 'free:' + d.id, fetcher);
              var ec = editMap[d.courseId];
              if (ec) {
                actions.push(rowMenu([
                  ['Sửa tên / chủ đề / Miễn phí', function () {
                    docForm(ec, topicsOf(ec.id), d, function () {
                      delete viewCache['course:' + ec.id];
                      reload();
                    });
                  }],
                  ['Xóa tài liệu', function () {
                    confirmBox('Xóa tài liệu?', 'Tài liệu "' + d.title + '" sẽ bị xóa khỏi lớp ' + (d.courseName || '') + ' và khỏi Kho. File gốc được chuyển vào Thùng rác của Google Drive.', 'Xóa', function () {
                      return api('deleteDoc', { id: d.id }).then(function () {
                        toast('Đã xóa tài liệu.', 'success');
                        delete viewCache['course:' + ec.id];
                        reload();
                      });
                    });
                  }, true]
                ]));
              }
              var meta = [fmtDate(d.uploadedAt), d.type === 'file' ? fmtSize(d.size) : null].filter(Boolean).join(' · ');
              return h('article', { class: 'item' },
                h('span', { class: 'kind ' + kind[1] }, kind[0]),
                h('div', { class: 'item-main' },
                  h('h3', null, d.title),
                  d.description ? h('p', { class: 'item-desc' }, d.description) : null,
                  h('p', { class: 'item-meta' }, meta)
                ),
                h('div', { class: 'item-actions' }, actions)
              );
            });
            return h('details', { class: 'topic', open: true },
              h('summary', null,
                h('span', { class: 'topic-name' }, t),
                h('span', { class: 'topic-count' }, topicDocs.length + ' tài liệu')
              ),
              h('div', { class: 'topic-items' }, items)
            );
          });
          sections.push(topicEls);
        });
        fill(content, sections);
      }
    }

    fill(app,
      h('div', { class: 'page-head' },
        h('h1', null, '🎁 Kho tài liệu miễn phí'),
        h('p', { class: 'muted' }, 'Tài liệu thầy chọn chia sẻ miễn phí. Xem trực tiếp hoặc tải về, không cần tài khoản.'),
        addBtn ? h('p', { class: 'free-tools' }, addBtn, h('span', { class: 'muted small' }, ' Chỉ giáo viên thấy nút này. Tài liệu thêm ở đây cũng hiện trong trang lớp.')) : null
      ),
      chips,
      content
    );
  }

  /* ═════════ Bài tập về nhà ═════════ */

  var TYPE_LABEL = { mc: 'Trắc nghiệm', short: 'Trả lời ngắn', essay: 'Tự luận' };

  /** Đọc PDF bằng PDF.js: dòng chữ (kèm toạ độ) và vị trí hình / bảng trên từng trang. */
  function pdfAnalyze(file) {
    return loadPdfJs().then(function (lib) {
      return readArrayBuffer(file).then(function (buf) { return lib.getDocument({ data: buf }).promise; }).then(function (doc) {
        var pages = [];
        var chain = Promise.resolve();
        for (var i = 1; i <= doc.numPages; i++) {
          (function (n) {
            chain = chain.then(function () { return doc.getPage(n); }).then(function (page) {
              return Promise.all([page.getTextContent(), page.getOperatorList()]).then(function (res) {
                pages.push({ page: page, rows: textRows(res[0].items), figs: figureBoxes(lib, res[1], page.view) });
              });
            });
          })(i);
        }
        return chain.then(function () {
          // 1) Dải nền màu / khung tiêu đề không phải hình: chạm mép trang, hoặc chỉ cao một dòng chữ.
          pages.forEach(function (pg) {
            var v = pg.page.view;
            pg.figs = pg.figs.filter(function (b) {
              if (b.img) return true;
              if (b[0] <= v[0] + 4 || b[2] >= v[2] - 4 || b[3] >= v[3] - 4) return false;
              var rowsIn = pg.rows.filter(function (r) { return r.y > b[1] && r.y < b[3]; }).length;
              return !(b[3] - b[1] < 34 && rowsIn <= 1);
            });
          });
          // 2) Đầu trang / chân trang: chỉ xét dòng ở sát mép trên / mép dưới (12% chiều cao trang)
          //    và lặp lại ở trang khác cũng sát mép (bỏ số trang khi so sánh). Dòng giữa trang như
          //    "Bài giải:", "Đáp số:" có lặp lại cũng không bị bỏ.
          var atEdge = function (pg, r) {
            var v = pg.page.view;
            var band = 0.12 * (v[3] - v[1]);
            return r.y > v[3] - band || r.y < v[1] + band;
          };
          var hfKey = function (r) { return r.str.replace(/\d+/g, '#'); };
          var seen = {};
          pages.forEach(function (pg, pi) {
            pg.rows.forEach(function (r) { if (atEdge(pg, r)) (seen[hfKey(r)] = seen[hfKey(r)] || {})[pi] = 1; });
          });
          var lines = [];
          pages.forEach(function (pg, pi) {
            if (pi) lines.push({ p: pi, y: pg.page.view[3], str: window.QuizFormat.PAGE_MARK, mark: true });
            pg.rows.forEach(function (r) {
              if (pages.length > 1 && atEdge(pg, r) && Object.keys(seen[hfKey(r)]).length > 1) return;
              // 3) Chữ nằm trong hình (nhãn của sơ đồ, chữ trong bảng vẽ) thuộc về hình, không phải câu hỏi.
              //    Nhãn ngắn ngay sát ngoài hình (tên đỉnh A, B, C; "5 cm"; "60°") cũng thuộc về hình —
              //    cùng vùng mà bước cắt hình nới ra để lấy nhãn.
              var label = isFigureLabel(r.str);
              var inFig = pg.figs.some(function (b) {
                if (label) return r.y > b[1] - 22 && r.y < b[3] + 16 && r.x1 > b[0] - 60 && r.x0 < b[2] + 60;
                if (r.y < b[1] - 1 || r.y > b[3] + 1) return false;
                var ov = Math.min(r.x1, b[2]) - Math.max(r.x0, b[0]);
                return ov > 0.6 * Math.max(1, r.x1 - r.x0);
              });
              if (inFig) return;
              lines.push({ p: pi, y: r.y, str: window.QuizFormat.plainMath(r.str).normalize('NFC') });
            });
          });
          var textLines = lines.filter(function (l) { return !l.mark; });
          return { pages: pages, lines: textLines, text: lines.map(function (l) { return l.str; }).join('\n') };
        });
      });
    });
  }
  function pdfText(file) {
    return pdfAnalyze(file).then(function (r) { return r.text; });
  }
  function textRows(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str || !it.transform) return;
      var x = it.transform[4];
      var y = it.transform[5];
      var r = null;
      for (var k = 0; k < rows.length; k++) if (Math.abs(rows[k].y - y) < 3) { r = rows[k]; break; }
      if (!r) { r = { y: y, items: [] }; rows.push(r); }
      r.items.push({ x: x, str: it.str, w: it.width || 0 });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (r) {
      r.items.sort(function (a, b) { return a.x - b.x; });
      var out = '';
      var end = null;
      r.items.forEach(function (t) {
        if (end !== null && t.x - end > 1.5 && !/\s$/.test(out) && !/^\s/.test(t.str)) out += ' ';
        out += t.str;
        end = t.x + t.w;
      });
      var last = r.items[r.items.length - 1];
      return { y: r.y, x0: r.items[0].x, x1: last.x + last.w, str: out.replace(/\s+/g, ' ').trim() };
    }).filter(function (r) { return r.str; });
  }

  /** Tìm khung của ảnh chèn và hình vẽ / bảng (nét kẻ thật, không tính vùng cắt vô hình) trên trang, theo toạ độ PDF. */
  /** Dòng chỉ gồm nhãn hình: tên điểm (A, B', M1), số đo (5 cm, 60°, 3,5), trục x/y, "Hình 1". */
  var LABEL_TOKEN = /^(?:[A-Za-zĐđ][0-9'’]?|[\d.,]+\s*(?:°|cm²?|dm²?|mm²?|km²?|m²?|kg|g|ml|l)?|°|cm²?|dm²?|mm²?|km²?|m²?|kg|ml|hình|h\.\d*)$/i;
  function isFigureLabel(str) {
    var t = str.trim();
    if (!t || t.length > 14) return false;
    if (/^\(?[A-Ha-h]\s*[.)]/.test(t) || /^\d{1,3}\s*[.)](\s|$)/.test(t) || /^(câu|bài)/i.test(t)) return false;
    return t.split(/\s+/).every(function (w) { return LABEL_TOKEN.test(w); });
  }

  /**
   * Gộp các khung chạm nhau (cách ≤ 3 điểm) thành một. Chia trang thành ô lưới để chỉ so các nét ở gần nhau,
   * nên hình lưới ô vuông / hình GeoGebra hàng nghìn nét vẫn nhanh.
   */
  function mergeBoxes(list) {
    var touch = function (A, B) { return A[0] - 3 <= B[2] && B[0] - 3 <= A[2] && A[1] - 3 <= B[3] && B[1] - 3 <= A[3]; };
    var CELL = 40;
    // Một lượt: nối các khung chạm nhau (qua ô lưới) rồi thay mỗi nhóm bằng khung bao của nhóm.
    var pass = function (boxes) {
      var parent = boxes.map(function (_, i) { return i; });
      var find = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      var grid = {};
      boxes.forEach(function (b, i) {
        var x0 = Math.floor((b[0] - 3) / CELL), x1 = Math.floor((b[2] + 3) / CELL);
        var y0 = Math.floor((b[1] - 3) / CELL), y1 = Math.floor((b[3] + 3) / CELL);
        for (var cx = x0; cx <= x1; cx++) {
          for (var cy = y0; cy <= y1; cy++) {
            var cell = grid[cx + ',' + cy] || (grid[cx + ',' + cy] = []);
            for (var k = 0; k < cell.length; k++) {
              var ri = find(i), rj = find(cell[k]);
              if (ri !== rj && touch(b, boxes[cell[k]])) parent[rj] = ri;
            }
            cell.push(i);
          }
        }
      });
      var groups = {};
      boxes.forEach(function (b, i) {
        var r = find(i);
        var g = groups[r];
        groups[r] = g ? [Math.min(g[0], b[0]), Math.min(g[1], b[1]), Math.max(g[2], b[2]), Math.max(g[3], b[3])] : b.slice();
      });
      return Object.keys(groups).map(function (k) { return groups[k]; });
    };
    // Khung đã gộp lớn ra có thể chạm thêm khung khác → lặp tới khi không gộp được nữa.
    var out = list;
    for (var n = -1; out.length !== n;) { n = out.length; out = pass(out); }
    return out;
  }

  function figureBoxes(lib, ol, view) {
    var OPS = lib.OPS;
    var U = lib.Util;
    var ctm = [1, 0, 0, 1, 0, 0];
    var stack = [];
    var imgs = [];
    var paths = [];
    var pw = view[2] - view[0];
    var ph = view[3] - view[1];
    function bbox(pts) {
      var xs = pts.map(function (q) { return q[0]; });
      var ys = pts.map(function (q) { return q[1]; });
      return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    }
    function ok(b) { var w = b[2] - b[0]; var hh = b[3] - b[1]; return isFinite(w) && isFinite(hh) && w * hh < 0.8 * pw * ph; }
    var IMG = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObjectGroup, OPS.paintImageMaskXObjectRepeat];
    var PAINT = [OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke];
    for (var i = 0; i < ol.fnArray.length; i++) {
      var fn = ol.fnArray[i];
      var a = ol.argsArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (fn === OPS.transform) ctm = U.transform(ctm, a);
      else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (a && a[0]) ctm = U.transform(ctm, a[0]); }
      else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
      else if (IMG.indexOf(fn) >= 0) {
        var ib = bbox([[0, 0], [1, 0], [0, 1], [1, 1]].map(function (q) { return U.applyTransform(q, ctm); }));
        if (ok(ib) && ib[2] - ib[0] >= 10 && ib[3] - ib[1] >= 10) { ib.img = true; imgs.push(ib); }
      } else if (fn === OPS.constructPath && a && a[2] && a[2].length === 4 && PAINT.indexOf(ol.fnArray[i + 1]) >= 0) {
        var mm = a[2]; // [minX, maxX, minY, maxY]
        var pb = bbox([[mm[0], mm[2]], [mm[1], mm[2]], [mm[0], mm[3]], [mm[1], mm[3]]].map(function (q) { return U.applyTransform(q, ctm); }));
        // Bỏ dải nền chạm mép trang (băng tiêu đề, khung trang) trước khi gộp, để không dính vào hình thật.
        var edge = pb[0] <= view[0] + 4 || pb[2] >= view[2] - 4 || pb[3] >= view[3] - 4 || pb[1] <= view[1] + 4;
        if (ok(pb) && !edge && (pb[2] - pb[0] >= 3 || pb[3] - pb[1] >= 3)) paths.push(pb);
      }
    }
    // Gộp các nét kẻ chạm nhau thành một hình (ví dụ: bảng = nhiều đường kẻ).
    paths = mergeBoxes(paths);
    return imgs.concat(paths.filter(function (b) { return b[2] - b[0] >= 30 && b[3] - b[1] >= 15; }));
  }

  /**
   * Gán hình cho câu rồi cắt thành ảnh:
   *  - hình nằm dưới dòng "Câu k" trên cùng trang → thuộc câu k;
   *  - hình ở đầu trang, trước câu đầu tiên của trang → thuộc các câu phía sau (thường là hình dùng chung),
   *    trừ khi câu cuối trang trước nhắc tới hình và giữa chúng không có lời dẫn;
   *  - lời dẫn kiểu "trả lời câu 11–15" → gắn cùng hình cho cả nhóm câu.
   * Trả về mảng (theo thứ tự câu) các tên hình, và bảng tên hình → ảnh.
   */
  function cropFigures(an) {
    var strs = an.lines.map(function (l) { return l.str; });
    var starts = window.QuizFormat.questionStarts(strs);
    var heads = starts.map(function (si) {
      var l = an.lines[si];
      var m = /^\s*(?:câu|bài)?\s*(\d{1,3})/i.exec(l.str);
      return { p: l.p, y: l.y, n: m ? Number(m[1]) : null, si: si };
    });
    var keyAt = { p: Infinity, y: -Infinity };
    if (starts.length) {
      for (var i = starts[starts.length - 1] + 1; i < strs.length; i++) {
        if (/^\s*(?:bảng\s+)?(?:đáp\s*án|hướng\s*dẫn\s*(?:giải|chấm)|lời\s*giải|answer\s*key)\b/i.test(strs[i]) && strs[i].length < 60) { keyAt = an.lines[i]; break; }
      }
    }
    function before(a, b) { return a.p < b.p || (a.p === b.p && a.y > b.y); } // a đứng trước b trong tài liệu
    var assign = heads.map(function () { return []; });
    if (!heads.length) return Promise.resolve({ figures: [], images: {} });

    an.pages.forEach(function (pg, pi) {
      pg.figs.forEach(function (b) {
        var pos = { p: pi, y: (b[1] + b[3]) / 2 };
        if (!before(pos, keyAt)) return;                     // nằm trong phần đáp án
        if (before(pos, heads[0])) return;                    // trước câu 1 (tiêu đề, khung họ tên)
        var prevIdx = -1;
        heads.forEach(function (h0, k) { if (before(h0, pos)) prevIdx = k; });
        var target = prevIdx;
        var prev = heads[prevIdx];
        if (prev.p !== pi && prevIdx + 1 < heads.length) {
          // Hình ở đầu trang, trước câu đầu tiên của trang.
          var preText = an.lines.filter(function (l) { return l.p === pi && l.y > b[3]; }).length;
          var prevText = strs.slice(prev.si, prevIdx + 1 < heads.length ? heads[prevIdx + 1].si : strs.length).join(' ');
          var mentions = /hình|ảnh|sơ\s*đồ|biểu\s*đồ|bảng|dưới\s*đây|bên\s*dưới|figure|diagram|picture|below|chart|table/i.test(prevText);
          if (preText || !mentions) target = prevIdx + 1;
        }
        assign[target].push({ p: pi, box: b });
      });
    });

    // Lời dẫn "câu a–b" ngay trước câu đầu nhóm → hình dùng chung cho cả nhóm.
    var share = heads.map(function (h0, k) { return [k]; });
    heads.forEach(function (h0, k) {
      if (!assign[k].length) return;
      var from = k ? heads[k - 1].si + 1 : 0;
      var near = strs.slice(Math.max(from, h0.si - 8), h0.si + 1).join(' ');
      var rg = window.QuizFormat.RANGE.exec(near);
      if (rg && h0.n !== null && Number(rg[1]) === h0.n) {
        var lastN = Number(rg[2]);
        share[k] = heads.map(function (x, j) { return j; }).filter(function (j) { return heads[j].n !== null && heads[j].n >= h0.n && heads[j].n <= lastN; });
      }
    });

    var canvases = {};
    function pageCanvas(pi) {
      if (!canvases[pi]) {
        var pg = an.pages[pi].page;
        var vp = pg.getViewport({ scale: 2 });
        var c = document.createElement('canvas');
        c.width = Math.round(vp.width);
        c.height = Math.round(vp.height);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        canvases[pi] = pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function () { return { c: c, vp: vp }; });
      }
      return canvases[pi];
    }

    function cropOne(k) {
      var byPage = {};
      assign[k].forEach(function (f) { (byPage[f.p] = byPage[f.p] || []).push(f.box); });
      var parts = Object.keys(byPage).map(Number).sort(function (x, y) { return x - y; }).map(function (pi) {
        var figs = byPage[pi];
        var view = an.pages[pi].page.view;
        var bx = [Math.min.apply(null, figs.map(function (b) { return b[0]; })), Math.min.apply(null, figs.map(function (b) { return b[1]; })),
          Math.max.apply(null, figs.map(function (b) { return b[2]; })), Math.max.apply(null, figs.map(function (b) { return b[3]; }))];
        // Nới rộng để lấy nhãn ghi sát hình, nhưng không lấn vào dòng câu hỏi phía trên / câu kế tiếp phía dưới.
        var ceil = view[3];
        var floor = view[1];
        heads.forEach(function (h0) {
          if (h0.p !== pi) return;
          if (h0.y > bx[3] - 2) ceil = Math.min(ceil, h0.y - 4);
          if (h0.y < bx[1] + 2) floor = Math.max(floor, h0.y + 13);
        });
        an.lines.forEach(function (l) {
          if (l.p === pi && l.y > bx[3] - 2 && l.y < ceil + 4 && l.str.length > 15) ceil = Math.min(ceil, l.y - 4);
        });
        // Chỉ nới về phía có nhãn chữ thật (ví dụ "5 cm" bên phải, "8 cm" bên dưới); không có thì cắt sát hình.
        var rows = an.pages[pi].rows;
        var near = function (fn) { return rows.some(fn); };
        var padT = near(function (r) { return r.y > bx[3] && r.y < bx[3] + 16 && r.x1 > bx[0] && r.x0 < bx[2]; }) ? 14 : 1;
        var padB = near(function (r) { return r.y < bx[1] && r.y > bx[1] - 22 && r.x1 > bx[0] && r.x0 < bx[2]; }) ? 20 : 2;
        var padL = near(function (r) { return r.y > bx[1] - 20 && r.y < bx[3] + 14 && r.x1 <= bx[0] + 2 && r.x1 > bx[0] - 60; }) ? 54 : 2;
        var padR = near(function (r) { return r.y > bx[1] - 20 && r.y < bx[3] + 14 && r.x0 >= bx[2] - 2 && r.x0 < bx[2] + 60; }) ? 54 : 2;
        return { pi: pi, box: [Math.max(view[0], bx[0] - padL), Math.max(floor, bx[1] - padB), Math.min(view[2], bx[2] + padR), Math.min(ceil, bx[3] + padT)] };
      });
      return Promise.all(parts.map(function (pt) {
        return pageCanvas(pt.pi).then(function (pc) {
          var r = pc.vp.convertToViewportRectangle(pt.box);
          var x0 = Math.max(0, Math.floor(Math.min(r[0], r[2])));
          var y0 = Math.max(0, Math.floor(Math.min(r[1], r[3])));
          var x1 = Math.min(pc.c.width, Math.ceil(Math.max(r[0], r[2])));
          var y1 = Math.min(pc.c.height, Math.ceil(Math.max(r[1], r[3])));
          return { c: pc.c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        });
      })).then(function (cuts) {
        var W = Math.max.apply(null, cuts.map(function (c) { return c.w; }));
        var H = cuts.reduce(function (n, c) { return n + c.h + 10; }, -10);
        var scale = Math.min(1, 1400 / W);
        var out = document.createElement('canvas');
        out.width = Math.round(W * scale);
        out.height = Math.round(H * scale);
        var ctx = out.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.width, out.height);
        var yy = 0;
        cuts.forEach(function (c) {
          ctx.drawImage(c.c, c.x, c.y, c.w, c.h, 0, yy, c.w * scale, c.h * scale);
          yy += (c.h + 10) * scale;
        });
        return out.toDataURL('image/jpeg', 0.85);
      });
    }

    var figures = [];
    var images = {};
    return Promise.all(heads.map(function (h0, k) {
      if (!assign[k].length) return null;
      return cropOne(k).then(function (url) {
        var key = newImageKey(k);
        images[key] = url;
        share[k].forEach(function (j) { if (!figures[j]) figures[j] = key; });
      });
    })).then(function () { return { figures: figures, images: images }; });
  }

  /* —— Hình trong câu hỏi —— */

  function dataUrlFetcher(url) {
    return function () { return Promise.resolve({ name: 'hinh.jpg', mimeType: url.slice(5, url.indexOf(';')) || 'image/jpeg', data: url.split(',')[1] }); };
  }

  /** Ảnh minh họa dưới câu hỏi; bấm để phóng to. src: {url} (mới, chưa lưu) hoặc {kind, id, key} (đã lưu). */
  function qImageEl(src) {
    if (!src) return null;
    var key = src.url ? 'qimgl:' + src.url.length + ':' + src.url.slice(-40) : 'qimg:' + src.kind + ':' + src.id + ':' + src.key;
    var fetcher = src.url ? dataUrlFetcher(src.url) : function () { return api('qimage', { kind: src.kind, id: src.id, key: src.key }); };
    var wrap = h('button', { type: 'button', class: 'q-img', 'aria-label': 'Phóng to hình', onclick: function () { openViewer('Hình minh họa', key, fetcher); } }, loading('Đang tải hình…'));
    getBlob(key, fetcher).then(function (r) {
      fill(wrap, h('img', { src: blobUrl(r), alt: 'Hình minh họa' }), h('span', { class: 'q-img-zoom' }, '🔍 Phóng to'));
    }, function () { fill(wrap, h('p', { class: 'err small' }, 'Không tải được hình.')); });
    return wrap;
  }

  /** Kho hình của trình soạn đề: hình mới (dataURL) + hình đã lưu trên máy chủ. */
  function imageStore(kind, id, savedKeys) {
    var local = {};
    var saved = {};
    (savedKeys || []).forEach(function (k) { saved[k] = 1; });
    return {
      el: function (k) {
        if (!k) return null;
        if (local[k]) return qImageEl({ url: local[k] });
        if (saved[k] && id) return qImageEl({ kind: kind, id: id, key: k });
        return h('p', { class: 'err small' }, 'Thiếu hình "' + k + '" — bấm "Thêm hình" để chọn lại.');
      },
      put: function (k, url) { local[k] = url; },
      newImages: function (questions) {
        var out = [];
        var done = {};
        questions.forEach(function (q) {
          if (q.image && local[q.image] && !done[q.image]) {
            done[q.image] = 1;
            out.push({ key: q.image, mimeType: 'image/jpeg', data: local[q.image].split(',')[1] });
          }
        });
        return out;
      }
    };
  }

  function newImageKey(i) {
    return 'c' + (i + 1) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  /** Gắn / thay / bỏ dòng [Hình: …] của câu thứ i trong ô soạn đề. */
  function setQuestionImage(src, parsed, i, key) {
    var lines = src.value.split('\n');
    var heads = [];
    lines.forEach(function (l, k) { if (/^\s*câu\s*\d+/i.test(l)) heads.push(k); });
    if (heads.length === parsed.questions.length) {
      var from = heads[i];
      var to = i + 1 < heads.length ? heads[i + 1] : lines.length;
      var body = lines.slice(from + 1, to).filter(function (l) { return !/^\s*\[\s*(?:hình|ảnh|hinh|anh)\b/i.test(l); });
      if (key) body.unshift('[Hình: ' + key + ']');
      src.value = lines.slice(0, from + 1).concat(body, lines.slice(to)).join('\n');
    } else {
      var qs = parsed.questions.map(function (q, k) { var c = Object.assign({}, q); if (k === i) { if (key) c.image = key; else delete c.image; } return c; });
      src.value = window.QuizFormat.toSource(qs);
    }
  }

  /** Chọn ảnh từ máy cho câu i (nén còn ≤1600px). */
  function pickQuestionImage(onPicked) {
    var input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', function () {
      var f = input.files[0];
      if (!f) return;
      compressImage(f).then(function (c) {
        var r = new FileReader();
        r.onload = function () { onPicked(String(r.result)); };
        r.readAsDataURL(c);
      }, function (err) { toast(err.message, 'error'); });
    });
    input.click();
  }

  /** Đổi câu thứ i giữa tự luận và trả lời ngắn: thêm / bỏ chữ "tự luận" ở dòng "Câu n (…):". */
  function setQuestionEssay(src, parsed, i, essay) {
    var lines = src.value.split('\n');
    var heads = [];
    lines.forEach(function (l, k) { if (/^\s*câu\s*\d+/i.test(l)) heads.push(k); });
    if (heads.length === parsed.questions.length) {
      var from = heads[i];
      var to = i + 1 < heads.length ? heads[i + 1] : lines.length;
      var m = /^(\s*câu\s*\d+)\s*(?:\(([^)]*)\)|\[([^\]]*)\])?\s*([:.)\-–]?)\s*(.*)$/i.exec(lines[from]);
      var meta = (m[2] || m[3] || '').replace(/(?:tự\s*luận|essay)\s*[,;]?\s*/ig, '').replace(/^[\s,;]+|[\s,;]+$/g, '');
      if (essay) meta = meta ? 'tự luận, ' + meta : 'tự luận';
      lines[from] = m[1] + (meta ? ' (' + meta + ')' : '') + (m[4] || ':') + ' ' + m[5];
      // Câu tự luận không có dòng "Đáp án:" → thêm dòng trống để giáo viên điền đáp án.
      var body = lines.slice(from + 1, to);
      if (!essay && !body.some(function (l) { return /^\s*đáp\s*án(?:\s*mẫu)?\s*[:：]/i.test(l); })) {
        var at = 0;
        body.forEach(function (l, k) { if (l.trim() && !/^\s*(?:giải\s*thích|lời\s*giải|hướng\s*dẫn|gợi\s*ý\s*chấm)/i.test(l) && at === k) at = k + 1; });
        body.splice(at, 0, 'Đáp án: ');
      }
      src.value = lines.slice(0, from + 1).concat(body, lines.slice(to)).join('\n');
    } else {
      var qs = parsed.questions.map(function (q, k) {
        var c = Object.assign({}, q);
        if (k !== i) return c;
        if (essay) {
          c.explain = [(c.answers || []).join(' | '), c.explain].filter(Boolean).join('\n');
          c.type = 'essay';
        } else {
          c.type = 'short';
          c.answers = [];
        }
        return c;
      });
      src.value = window.QuizFormat.toSource(qs);
    }
  }

  /** Nút thêm / đổi / bỏ hình (và đổi loại câu, nếu typeSwitch) dưới mỗi câu trong phần xem trước của trình soạn đề. */
  function imageTools(src, parsed, store, i, onChange, typeSwitch) {
    var q = parsed.questions[i];
    var add = h('button', { type: 'button', class: 'link-btn', onclick: function () {
      pickQuestionImage(function (url) {
        var k = newImageKey(i);
        store.put(k, url);
        setQuestionImage(src, parsed, i, k);
        onChange();
      });
    } }, q.image ? '🖼 Đổi hình' : '🖼 Thêm hình');
    var del = q.image ? h('button', { type: 'button', class: 'link-btn danger-text', onclick: function () { setQuestionImage(src, parsed, i, null); onChange(); } }, 'Bỏ hình') : null;
    var sw = typeSwitch && q.type !== 'mc' ? h('button', { type: 'button', class: 'link-btn', onclick: function () {
      setQuestionEssay(src, parsed, i, q.type !== 'essay');
      onChange();
    } }, q.type === 'essay' ? '🔢 Đổi thành trả lời ngắn' : '✍️ Đổi thành tự luận') : null;
    return h('div', { class: 'img-tools' }, add, del, sw);
  }

  /** Hộp "Lấy đề từ PDF": đọc đề (+ đáp án), tự tách câu & phân loại, trả về bản soạn để xem lại. */
  function importPdfDialog(allowEssay, onDone) {
    var de = h('input', { type: 'file', accept: 'application/pdf,.pdf' });
    var key = h('input', { type: 'file', accept: 'application/pdf,.pdf' });
    var keyText = h('textarea', { rows: '3', placeholder: 'Ví dụ: 1.B 2.C 3.A\nCâu 4: 4/5\nCâu 5: 24 cm' });
    modal('Lấy đề từ file PDF', h('div', { class: 'form' },
      h('p', { class: 'muted small' }, 'Hệ thống đọc chữ trong PDF, tự tách từng câu và phân loại: có A, B, C, D → trắc nghiệm; đáp án ngắn → trả lời ngắn' +
        (allowEssay ? '; lời giải dài hoặc nằm trong phần "Tự luận" → tự luận (giáo viên chấm)' : '') + '. Bạn xem lại và sửa trước khi lưu.'),
      field('File đề (PDF)', de),
      field('File đáp án (PDF, không bắt buộc)', key, 'Bỏ trống nếu đáp án nằm cuối file đề, sau chữ "ĐÁP ÁN".'),
      field('Hoặc dán đáp án', keyText),
      h('p', { class: 'notice' }, 'Hình vẽ, bảng trong đề được tự cắt và gắn vào đúng câu. PDF xuất từ Word đọc tốt nhất. PDF là ảnh scan, dùng phông chữ cũ (.VnTime…) hoặc có phân số dạng công thức chồng thì máy không đọc được chữ — khi đó hãy dán đề dạng chữ.')),
    function (close) {
      var ok = h('button', { class: 'btn' }, 'Đọc đề');
      ok.addEventListener('click', function () {
        var f = de.files[0];
        if (!f) return toast('Hãy chọn file đề PDF.', 'error');
        busy(ok, true, 'Đang đọc PDF…');
        Promise.all([pdfAnalyze(f), key.files[0] ? pdfText(key.files[0]) : Promise.resolve('')]).then(function (t) {
          var an = t[0];
          if (an.text.replace(/\s/g, '').length < 20) throw new Error('Không đọc được chữ trong file đề (có thể là ảnh scan). Hãy dán đề dạng chữ vào ô soạn đề.');
          ok.textContent = 'Đang cắt hình…';
          return cropFigures(an).catch(function () { return { figures: [], images: {} }; }).then(function (cf) {
            var figures = cf.figures;
            var images = cf.images;
            var k = (t[1] + '\n' + keyText.value).trim();
            var r = window.QuizFormat.fromText(an.text, k || null, { figures: figures });
            if (!r.count) throw new Error('Không tìm thấy câu hỏi nào. Đề cần đánh số "Câu 1", "Câu 2"… (hoặc "1.", "2.").');
            r.images = images;
            r.figureCount = Object.keys(images).length;
            close();
            onDone(r, f);
          });
        }).catch(function (e) { busy(ok, false); toast(e.message || 'Không đọc được file PDF.', 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  /* —— Giáo viên: soạn / sửa bài tập —— */

  function renderAssignmentEditor(courseId, id) {
    fill(app, loading());
    Promise.all([api('course', { courseId: courseId }), id ? api('assignment', { id: id }) : Promise.resolve(null), getCourses()]).then(function (res) {
      drawAssignmentEditor(res[0], res[1]);
    }, function (e) { fill(app, errorBox(e.message, function () { renderAssignmentEditor(courseId, id); })); });
  }

  function drawAssignmentEditor(cd, ex) {
    var c = cd.course;
    if (!c.canEdit) return fill(app, errorBox('Bạn không có quyền giao bài cho khóa này.'));
    var a = ex ? ex.assignment : null;
    var br = branchSelect(c, a ? (a.branch || ex.branch) : '');
    var ti = topicInput(cd.topics, a ? a.topic : '');
    var title = h('input', { maxlength: '200', value: a ? a.title : '', placeholder: 'VD: Bài tập về nhà – Chủ đề 4' });
    var instr = h('textarea', { rows: '2', maxlength: '5000', placeholder: 'Lời dặn, ví dụ: Làm hết các câu. Phần tự luận chụp ảnh rõ nét từng câu.' });
    instr.value = a ? a.instructions : '';
    var due = deadlinePicker(a ? a.dueAt : '', function () { dirty = true; });
    var max = h('input', { type: 'number', min: '1', max: '1000', step: '1', value: a ? String(a.maxScore) : '10' });
    var maxField = field('Thang điểm (khi không có câu hỏi)', max);
    var file = h('input', { type: 'file' });
    var removeFile = h('input', { type: 'checkbox' });
    var pickedFile = null;
    var fileNote = h('p', { class: 'muted small' });
    var src = h('textarea', { class: 'quiz-src', rows: '16', spellcheck: 'false', placeholder: 'Để trống nếu chỉ cần học sinh chụp ảnh/nộp file cả bài.\n\nHoặc bấm "Lấy đề từ PDF" để hệ thống tự tách câu hỏi, hoặc gõ theo mẫu:\n\n' + window.QuizFormat.SAMPLE_HW });
    src.value = ex ? ex.source || '' : '';
    var status = h('div', { class: 'parse-status' });
    var preview = h('div', { class: 'quiz-preview' });
    var parsed = { questions: [], errors: [] };
    var dirty = false;
    var store = imageStore('assignment', a ? a.id : null, ex && ex.fullQuestions ? ex.fullQuestions.map(function (q) { return q.image; }).filter(Boolean) : []);
    if (br) br.addEventListener('change', function () { dirty = true; });

    function update() {
      var empty = !src.value.trim();
      parsed = empty ? { questions: [], errors: [] } : window.QuizFormat.parse(src.value, { allowEssay: true });
      maxField.hidden = !empty;
      if (empty) {
        fill(status, h('div', { class: 'mode-note' }, h('strong', null, 'Không có câu hỏi: '), 'học sinh chụp ảnh / nộp file cả bài, giáo viên chấm cả bài.'));
        fill(preview);
        return;
      }
      var sm = window.QuizFormat.summary(parsed.questions);
      var parts = [];
      if (sm.mc) parts.push(sm.mc + ' trắc nghiệm');
      if (sm.short) parts.push(sm.short + ' trả lời ngắn');
      if (sm.essay) parts.push(sm.essay + ' tự luận');
      fill(status,
        h('div', { class: 'mode-note' },
          h('strong', null, parsed.questions.length + ' câu: ' + parts.join(' · ')), h('br'),
          'Máy chấm ', h('strong', null, fmtScore(sm.autoPoints) + ' điểm'),
          sm.essay ? [' · giáo viên chấm ', h('strong', null, fmtScore(sm.essayPoints) + ' điểm')] : ' · không cần giáo viên chấm',
          ' · tổng ', h('strong', null, fmtScore(sm.total) + ' điểm'),
          sm.total !== 10 && !parsed.errors.length ? h('button', { class: 'link-btn', onclick: spread }, 'Chia lại cho tổng = 10') : null),
        parsed.errors.length ? h('div', { class: 'errors' }, h('strong', null, 'Cần sửa ' + parsed.errors.length + ' chỗ:'), h('ul', null, parsed.errors.map(function (e) { return h('li', null, e); }))) : null);
      fill(preview, parsed.questions.map(function (x, i) {
        return reviewItem({ type: x.type, text: x.text || '(thiếu nội dung)', options: x.options, points: x.points,
          correctAnswer: x.type === 'mc' ? x.correct : (x.answers || []).join('  |  '), explain: x.explain,
          imgEl: store.el(x.image), tools: imageTools(src, parsed, store, i, function () { dirty = true; update(); }, true) }, i, true);
      }));
    }
    function spread() {
      src.value = window.QuizFormat.toSource(window.QuizFormat.spreadPoints(parsed.questions, 10));
      dirty = true;
      update();
    }
    var t = null;
    src.addEventListener('input', function () { dirty = true; clearTimeout(t); t = setTimeout(update, 250); });
    file.addEventListener('change', function () { pickedFile = null; fileNote.textContent = ''; });
    setLeaveGuard(function () { return dirty; }, 'Bài tập chưa được lưu. Rời trang?');

    function importPdf() {
      importPdfDialog(true, function (r, f) {
        if (src.value.trim() && !confirm('Thay nội dung câu hỏi hiện tại bằng đề vừa đọc từ PDF?')) return;
        src.value = r.source;
        Object.keys(r.images || {}).forEach(function (k) { store.put(k, r.images[k]); });
        dirty = true;
        if (!file.files[0]) {
          pickedFile = f;
          fileNote.textContent = 'File đề "' + f.name + '" sẽ được đính kèm để học sinh xem / tải về.';
        }
        if (!title.value.trim()) title.value = f.name.replace(/\.pdf$/i, '');
        update();
        toast('Đã đọc ' + r.count + ' câu' + (r.figureCount ? ', ' + r.figureCount + ' hình' : '') + (r.hasKey ? ', ' + r.keyed + ' câu có đáp án' : ', chưa thấy đáp án') + '. Hãy kiểm tra lại phần xem trước.', r.keyed === r.count ? 'success' : '');
      });
    }

    var saveBtn = h('button', { class: 'btn btn-lg' }, a ? 'Lưu thay đổi' : 'Giao bài');
    saveBtn.addEventListener('click', function () {
      update();
      if (!title.value.trim()) return toast('Vui lòng nhập tên bài tập.', 'error');
      if (parsed.errors.length) return toast('Phần câu hỏi còn lỗi, xem danh sách phía trên phần xem trước.', 'error');
      var f = file.files[0] || pickedFile;
      if (f && f.size > MAX_BYTES) return toast('File đề quá lớn (tối đa 20 MB).', 'error');
      var params = {
        courseId: c.id, id: a ? a.id : undefined, title: title.value.trim(), topic: ti[0].value.trim(),
        branch: br ? br.value : '',
        instructions: instr.value.trim(), maxScore: max.value,
        dueAt: due.value(),
        removeFile: removeFile.checked,
        questions: parsed.questions, source: parsed.questions.length ? src.value : '',
        newImages: store.newImages(parsed.questions)
      };
      busy(saveBtn, true, f ? 'Đang tải file đề…' : 'Đang lưu…');
      (f ? readBase64(f).then(function (data) { return Object.assign(params, { data: data, fileName: f.name, mimeType: f.type || 'application/pdf' }); }) : Promise.resolve(params))
        .then(function (p) { return api(a ? 'updateAssignment' : 'createAssignment', p); })
        .then(function (r) {
          dirty = false;
          leaveGuard = null;
          coursesCache = null;
          delete viewCache['course:' + c.id];
          if (br) setActiveBranch(c.id, br.value);
          var msg = a ? 'Đã lưu bài tập.' : 'Đã giao bài.';
          if (r.regraded || r.skippedReturned) {
            var parts = [];
            if (r.regraded) parts.push('Đã chấm lại ' + r.regraded + ' bài theo đáp án mới.');
            if (r.skippedReturned) parts.push(r.skippedReturned + ' bài đã chốt điểm không thay đổi.');
            msg = parts.join(' ');
          }
          toast(msg, 'success');
          go('#/bai/' + r.assignment.id);
        }, function (err) { busy(saveBtn, false); toast(err.message, 'error'); });
    });

    fill(app,
      h('a', { href: a ? '#/bai/' + a.id : '#/khoa/' + encodeURIComponent(c.id), class: 'back' }, '← ' + (a ? a.title : c.name + ' · ' + c.grade)),
      h('div', { class: 'page-head' }, h('h1', null, a ? 'Sửa bài tập' : 'Giao bài tập mới'), h('p', { class: 'muted' }, c.name + ' · ' + c.grade)),
      h('div', { class: 'panel form' },
        h('div', { class: 'row' + (br ? '' : ' two') }, field('Tên bài tập', title), br ? field('Nhánh', br) : null, field('Chủ đề (không bắt buộc)', ti)),
        field('Lời dặn', instr),
        h('div', { class: 'field' }, h('span', null, 'Hạn nộp'), due.el),
        maxField,
        field(a && a.file ? 'File đề (đang có: ' + a.file.name + ') — chọn file khác để thay' : 'File đề (PDF/Word/ảnh) cho học sinh xem và tải về', file),
        fileNote,
        a && a.file ? h('label', { class: 'check' }, removeFile, 'Bỏ file đề hiện tại') : null),
      h('div', { class: 'editor' },
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' },
            h('h2', null, 'Câu hỏi'),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-sm', onclick: importPdf }, '📄 Lấy đề từ PDF'),
              h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { formatHelp(true, src, function () { dirty = true; update(); }); } }, 'Xem mẫu'))),
          src),
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' }, h('h2', null, 'Học sinh sẽ thấy')),
          status, preview)),
      h('div', { class: 'actions-end sticky-save' }, saveBtn));
    update();
  }

  /** Hướng dẫn mẫu soạn đề (dùng chung cho bài tập và luyện tập). */
  function formatHelp(allowEssay, src, onInsert) {
    var sample = allowEssay ? window.QuizFormat.SAMPLE_HW : window.QuizFormat.SAMPLE;
    modal('Cách viết đề', h('div', null,
      h('ul', { class: 'help' },
        h('li', null, 'Mỗi câu bắt đầu bằng ', h('code', null, 'Câu 1:'), ', ', h('code', null, 'Câu 2:'), '… Điểm của câu ghi trong ngoặc: ', h('code', null, 'Câu 1 (2 điểm):'), ' (không ghi = 1 điểm).'),
        h('li', null, h('strong', null, 'Trắc nghiệm'), ' (máy chấm): mỗi lựa chọn ', h('code', null, 'A.'), ' ', h('code', null, 'B.'), '… có thể cùng một dòng; thêm ', h('code', null, '*'), ' trước đáp án đúng (', h('code', null, '*B. 5'), ') hoặc viết ', h('code', null, 'Đáp án: B'), '.'),
        h('li', null, h('strong', null, 'Trả lời ngắn'), ' (máy chấm): không có A, B, C; viết ', h('code', null, 'Đáp án: 26'), '. Nhiều cách viết đúng ngăn bằng ', h('code', null, '|'), '. Máy bỏ qua chữ hoa/thường, dấu cách, coi 0,75 = 0.75.'),
        allowEssay ? h('li', null, h('strong', null, 'Tự luận'), ' (giáo viên chấm): ', h('code', null, 'Câu 3 (tự luận, 4 điểm):'), '; có thể thêm ', h('code', null, 'Hướng dẫn chấm: …'), '. Học sinh gõ bài và/hoặc chụp ảnh lời giải riêng cho câu này.') : null,
        h('li', null, 'Lời giải (không bắt buộc): dòng ', h('code', null, 'Giải thích: …'), ' — học sinh xem sau khi bài được chấm và đã hết hạn nộp.')),
      h('pre', { class: 'cred' }, sample)), function (close) {
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Đóng'),
        h('button', { class: 'btn', onclick: function () {
          src.value = (src.value.trim() ? src.value.trim() + '\n\n' : '') + sample;
          close();
          onInsert();
        } }, 'Chèn mẫu vào đề')];
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
    var br = a.branch || d.branch || '';
    var fetcher = function () { return api('assignmentFile', { id: a.id }); };
    var info = ['Thang điểm ' + fmtScore(a.maxScore)];
    if (d.questions && d.questions.length) {
      var ess = d.questions.filter(function (x) { return x.type === 'essay'; }).length;
      info.push(d.questions.length + ' câu' + (ess ? ' (' + ess + ' tự luận)' : ' · máy chấm, thầy cô chốt điểm'));
    }
    info.push('Giao bởi ' + a.createdBy);
    return [
      h('a', { href: '#/khoa/' + encodeURIComponent(d.course.id), class: 'back', onclick: br ? function () { setActiveBranch(d.course.id, br); } : null },
        '← ' + (br ? br + ' · ' : '') + d.course.name + ' · ' + d.course.grade),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(d.course.id) },
        h('span', { class: 'tag' }, [br, a.topic].filter(Boolean).join(' · ') || 'Bài tập về nhà'),
        h('h1', null, a.title),
        h('p', { class: 'head-meta' }, dueBadge(a.dueAt, d.canEdit || (d.submission && d.submission.status !== 'todo')),
          !d.canEdit && !(d.submission && d.submission.status === 'returned') ? countdownEl(a.dueAt) : null,
          h('span', { class: 'muted small' }, info.join(' · '))),
        extra || null),
      (a.instructions || a.file) ? h('div', { class: 'panel' },
        a.instructions ? h('p', { class: 'prewrap' }, a.instructions) : null,
        a.file ? h('div', { class: 'file-row' },
          h('span', { class: 'kind sm ' + fileKind(a.file.mimeType, a.file.name)[1] }, fileKind(a.file.mimeType, a.file.name)[0]),
          h('span', { class: 'file-name' }, a.file.name),
          fileButtons(a.title, a.file, 'asg:' + a.id + ':' + a.file.size + ':' + a.file.name, fetcher)) : null) : null
    ];
  }

  /* —— Học sinh: nộp bài —— */

  function drawAssignmentStudent(d) {
    var a = d.assignment;
    var s = d.submission;
    var hasQ = d.questions && d.questions.length;
    var box = h('div');
    fill(app, assignmentHeader(d), box);

    if (!d.canSubmit) {
      fill(box, h('div', { class: 'panel muted' }, 'Chỉ học sinh của khóa này mới nộp bài được.'));
      return;
    }
    if (!s) return fill(box, hasQ ? questionForm(d, null) : submitForm(d, null));

    var graded = s.status === 'returned';
    var reopened = s.status === 'reopened';
    var dueMs = a.dueAt ? new Date(a.dueAt).getTime() : 0;
    // Chưa chốt điểm thì sửa / nộp bổ sung được, kể cả sau hạn (máy chủ ghi là nộp muộn).
    var canRedo = !graded;
    var pastDue = !!dueMs && Date.now() > dueMs && !reopened;
    var card = h('div', { class: 'panel status-card ' + (graded ? 'graded' : 'waiting') },
      graded
        ? h('div', { class: 'score-big' }, h('span', null, fmtScore(s.score)), h('small', null, '/' + fmtScore(a.maxScore)))
        : h('div', { class: 'status-icon' }, '✓'),
      h('div', { class: 'status-main' },
        h('h3', null, graded ? (s.gradedBy === 'Máy chấm tự động' ? 'Đã chấm tự động' : 'Đã chấm bài')
          : reopened ? 'Thầy cô đã cho em sửa và nộp lại bài' : 'Đã nộp bài, chờ thầy cô chốt điểm'),
        h('p', { class: 'muted small' }, 'Nộp lúc ' + fmtDateTime(s.submittedAt) + (s.late ? ' · nộp muộn' : '') +
          (graded ? ' · ' + s.gradedBy : '')),
        hasQ && graded && !d.reveal ? h('p', { class: 'muted small' }, a.dueAt ? 'Đáp án và lời giải sẽ hiện sau hạn nộp.' : 'Đáp án và lời giải sẽ hiện sau khi cả lớp được chấm bài.') : null,
        !graded ? h('p', { class: 'muted small' }, (hasQ ? 'Điểm và kết quả từng câu' : 'Điểm') + ' sẽ hiện khi thầy cô chốt điểm.') : null,
        canRedo && !reopened && dueMs && !pastDue ? h('p', { class: 'muted small' }, 'Em vẫn được sửa và nộp lại đến ' + fmtDateTime(a.dueAt) + '. Thầy cô chấm bài em nộp sau cùng.') : null,
        canRedo && !dueMs ? h('p', { class: 'muted small' }, 'Em vẫn được sửa và nộp lại cho đến khi thầy cô chốt điểm.') : null,
        pastDue ? h('p', { class: 'muted small' }, 'Đã hết hạn nộp, nhưng thầy cô chưa chốt điểm nên em vẫn nộp bổ sung được (bài sẽ ghi là nộp muộn).') : null,
        s.feedback ? h('div', { class: 'feedback' }, h('strong', null, 'Nhận xét của giáo viên'), h('p', { class: 'prewrap' }, s.feedback)) : null));

    var general = s.files.filter(function (f) { return f.q === null || f.q === undefined; });
    fill(box,
      card,
      h('h2', { class: 'section-title' }, 'Bài em đã nộp'),
      hasQ ? h('div', { class: 'review' }, d.review.map(function (r, i) { return hwReviewItem(r, i, s, graded, a.id); })) : null,
      s.text ? h('div', { class: 'panel prewrap' }, hasQ ? h('strong', null, 'Lời nhắn: ') : null, s.text) : null,
      general.length ? h('div', { class: 'file-grid' }, general.map(function (f) { return submissionFileTile(s, f); })) : null,
      canRedo ? h('div', { class: 'actions-end' },
        h('button', { class: reopened ? 'btn' : 'btn btn-ghost', onclick: function () { fill(box, hasQ ? questionForm(d, s) : submitForm(d, s)); } }, pastDue ? 'Nộp bổ sung' : 'Sửa / nộp lại')) : null);
  }

  /** Xem lại một câu của bài tập đã nộp (phía học sinh). */
  function hwReviewItem(r, i, s, graded, aid) {
    var head = h('div', { class: 'review-head' },
      h('span', { class: 'q-num' }, 'Câu ' + (i + 1) + ' · ' + TYPE_LABEL[r.type] + ' · ' + fmtScore(r.points) + ' điểm'),
      !graded ? h('span', { class: 'pill p-wait' }, 'Đã nộp')
        : r.earned === null ? h('span', { class: 'pill p-wait' }, 'Chờ chấm')
          : h('span', { class: 'pill ' + (r.earned >= r.points ? 'p-done' : r.earned > 0 ? 'p-wait' : 'p-bad') }, fmtScore(r.earned) + '/' + fmtScore(r.points) + ' điểm'));
    var body;
    if (r.type === 'mc') {
      body = h('div', { class: 'options review-opts' }, r.options.map(function (o, k) {
        var cls = 'option static';
        if (graded && r.correctAnswer === k) cls += ' correct';
        if (r.answer === k) cls += graded ? (r.correct ? ' correct' : ' wrong') : ' picked';
        return h('div', { class: cls }, h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o),
          r.answer === k ? h('span', { class: 'opt-you' }, 'Em chọn') : null);
      }));
    } else if (r.type === 'short') {
      body = [h('p', null, 'Em trả lời: ', h('strong', { class: graded ? (r.correct ? 'ok' : 'err') : '' }, r.answer == null || r.answer === '' ? '(bỏ trống)' : r.answer)),
        graded && !r.correct && r.correctAnswer != null ? h('p', null, 'Đáp án đúng: ', h('strong', { class: 'ok' }, r.correctAnswer)) : null];
    } else {
      var photos = s.files.filter(function (f) { return f.q === i; });
      body = [r.answer ? h('div', { class: 'essay-answer prewrap' }, r.answer) : null,
        photos.length ? h('div', { class: 'file-grid' }, photos.map(function (f) { return submissionFileTile(s, f); })) : null,
        !r.answer && !photos.length ? h('p', { class: 'muted' }, '(bỏ trống)') : null];
    }
    var cls = 'panel review-item' + (graded && r.type !== 'essay' ? (r.correct ? ' is-ok' : ' is-bad') : '');
    return h('div', { class: cls }, head, h('p', { class: 'q-text prewrap' }, r.text),
      r.image ? qImageEl({ kind: 'assignment', id: aid, key: r.image }) : null, body,
      r.explain ? h('div', { class: 'explain' }, h('strong', null, (r.type === 'essay' ? 'Lời giải / hướng dẫn: ' : 'Lời giải: ')), h('span', { class: 'prewrap' }, r.explain)) : null);
  }

  /** Ô chụp / chọn ảnh dùng cho một câu tự luận (q) hoặc cả bài (q = null). */
  /** Hàng nút gõ nhanh ký hiệu (², ³, ×, π) cho ô trả lời: iPad/điện thoại không gõ được số mũ. */
  function symbolKeys(input) {
    return h('div', { class: 'sym-keys' }, ['²', '³', '×', 'π'].map(function (ch) {
      var b = h('button', { type: 'button', class: 'chip-btn', 'aria-label': 'Gõ ' + ch }, ch);
      // Giữ con trỏ trong ô trả lời (bấm nút không làm ô mất chọn)
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var v = input.value;
        var a = typeof input.selectionStart === 'number' ? input.selectionStart : v.length;
        var z = typeof input.selectionEnd === 'number' ? input.selectionEnd : a;
        input.value = v.slice(0, a) + ch + v.slice(z);
        input.focus();
        try { input.setSelectionRange(a + ch.length, a + ch.length); } catch (e) { /* bỏ qua */ }
        var ev;
        try { ev = new Event('input'); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, true); }
        input.dispatchEvent(ev);
      });
      return b;
    }));
  }

  function photoPicker(s, q, state, onChange) {
    var grid = h('div', { class: 'file-grid' });
    var pick = h('input', { type: 'file', multiple: true, accept: 'image/*,application/pdf', hidden: true });
    var cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    function total() { return state.kept.length + state.picked.length; }
    function onPick(e) {
      var add = function (f) {
        if (total() >= MAX_FILES) return toast('Tối đa ' + MAX_FILES + ' ảnh/file cho cả bài.', 'error');
        state.picked.push({ file: f, q: q, url: /^image\//.test(f.type) ? URL.createObjectURL(f) : null });
        draw();
      };
      Array.prototype.forEach.call(e.target.files, function (f) {
        // Ảnh HEIC đổi sang JPG ngay khi chọn: xem trước được, và biết ngay nếu máy không đọc được.
        if (isHeic(f)) compressImage(f).then(add, function (err) { toast(err.message, 'error'); });
        else add(f);
      });
      e.target.value = '';
      draw();
    }
    pick.addEventListener('change', onPick);
    cam.addEventListener('change', onPick);
    function draw() {
      var tiles = [];
      state.kept.forEach(function (f) {
        if ((f.q === undefined ? null : f.q) !== q) return;
        var t = submissionFileTile(s, f);
        t.appendChild(h('button', { class: 'tile-x', 'aria-label': 'Bỏ ảnh', onclick: function () { state.kept.splice(state.kept.indexOf(f), 1); draw(); } }, '×'));
        tiles.push(t);
      });
      state.picked.forEach(function (p) {
        if (p.q !== q) return;
        var k = fileKind(p.file.type, p.file.name);
        tiles.push(h('div', { class: 'tile new' },
          h('div', { class: 'tile-thumb' }, p.url ? h('img', { src: p.url, alt: p.file.name }) : h('span', { class: 'kind ' + k[1] }, k[0])),
          h('div', { class: 'tile-name', title: p.file.name }, p.file.name),
          h('span', { class: 'tile-badge' }, 'Mới'),
          h('button', { class: 'tile-x', 'aria-label': 'Bỏ ảnh', onclick: function () { if (p.url) URL.revokeObjectURL(p.url); state.picked.splice(state.picked.indexOf(p), 1); draw(); } }, '×')));
      });
      fill(grid, tiles);
      grid.hidden = !tiles.length;
      if (onChange) onChange();
    }
    draw();
    return h('div', { class: 'photo-picker' },
      h('div', { class: 'drop-actions start' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { cam.click(); } }, '📷 Chụp ảnh'),
        h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: function () { pick.click(); } }, 'Chọn ảnh / file')),
      grid, pick, cam);
  }

  /** Gửi bài: nén ảnh, đọc base64, gửi kèm số câu. */
  function sendSubmission(a, state, extra, btn) {
    busy(btn, true, state.picked.length ? 'Đang chuẩn bị ảnh…' : 'Đang nộp…');
    return Promise.all(state.picked.map(function (p) { return compressImage(p.file); })).then(function (files) {
      var size = files.reduce(function (n, f) { return n + f.size; }, 0);
      if (size > MAX_BYTES) throw new Error('Tổng dung lượng quá lớn (' + fmtSize(size) + ', tối đa 20 MB). Hãy bớt ảnh.');
      btn.textContent = 'Đang gửi bài…';
      return Promise.all(files.map(function (f, i) {
        return readBase64(f).then(function (data) { return { name: f.name, mimeType: f.type || 'application/octet-stream', data: data, q: state.picked[i].q }; });
      }));
    }).then(function (files) {
      return api('submit', Object.assign({ assignmentId: a.id, keepFileIds: state.kept.map(function (f) { return f.id; }), files: files }, extra));
    }).then(function () {
      leaveGuard = null;
      draft.clear('a:' + a.id);
      state.picked.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
      toast('Đã nộp bài!', 'success');
      renderAssignment(a.id);
    }, function (e) { busy(btn, false); toast(e.message, 'error'); });
  }

  /** Bài tập có câu hỏi: làm trắc nghiệm / trả lời ngắn trên máy, tự luận gõ hoặc chụp ảnh từng câu. */
  function questionForm(d, s) {
    var a = d.assignment;
    var qs = d.questions;
    var hasEssay = qs.some(function (x) { return x.type === 'essay'; });
    var answers = qs.map(function (x, i) { return s && s.answers && s.answers[i] !== undefined ? s.answers[i] : null; });
    var state = { kept: s ? s.files.slice() : [], picked: [] };
    // Nháp trong máy: tải lại trang / lỡ đóng tab vẫn giữ được phần đã gõ (ảnh thì phải chọn lại).
    var dkey = 'a:' + a.id;
    var saved = draft.load(dkey);
    var touched = restoreAnswers(answers, saved);
    var note;
    function saveDraft() {
      touched = true;
      draft.save(dkey, { answers: answers, note: note ? note.value : '' });
    }
    var progress = h('span', { class: 'muted small' });
    function done() { return answers.filter(function (v, i) { return qs[i].type !== 'essay' ? v !== null && v !== '' : true; }).length; }
    function drawProgress() {
      var auto = qs.filter(function (x) { return x.type !== 'essay'; }).length;
      var ans = answers.filter(function (v, i) { return qs[i].type !== 'essay' && v !== null && v !== ''; }).length;
      progress.textContent = auto ? 'Đã trả lời ' + ans + '/' + auto + ' câu trắc nghiệm, trả lời ngắn' : '';
    }

    var cards = qs.map(function (x, i) {
      var body;
      if (x.type === 'mc') {
        body = h('div', { class: 'options' });
        var drawOpts = function () {
          fill(body, x.options.map(function (o, k) {
            return h('button', { type: 'button', class: 'option' + (answers[i] === k ? ' picked' : ''), onclick: function () { answers[i] = k; drawOpts(); drawProgress(); saveDraft(); } },
              h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o));
          }));
        };
        drawOpts();
      } else if (x.type === 'short') {
        var inp = h('input', { class: 'short-input', value: answers[i] || '', placeholder: 'Nhập đáp án…', autocomplete: 'off' });
        inp.addEventListener('input', function () { answers[i] = inp.value; drawProgress(); saveDraft(); });
        body = [inp, symbolKeys(inp)];
      } else {
        var ta = h('textarea', { rows: '4', maxlength: '5000', placeholder: 'Gõ lời giải (không bắt buộc nếu em chụp ảnh bài làm bên dưới)' });
        ta.value = answers[i] || '';
        ta.addEventListener('input', function () { answers[i] = ta.value; saveDraft(); });
        body = [ta, symbolKeys(ta), h('p', { class: 'muted small photo-hint' }, 'Ảnh lời giải câu ' + (i + 1) + ':'), photoPicker(s, i, state)];
      }
      return h('div', { class: 'panel q-card' },
        h('div', { class: 'review-head' },
          h('span', { class: 'q-num' }, 'Câu ' + (i + 1)),
          h('span', { class: 'pill ' + (x.type === 'essay' ? 'p-todo' : 'p-blue') }, TYPE_LABEL[x.type] + ' · ' + fmtScore(x.points) + ' điểm')),
        h('p', { class: 'q-text prewrap' }, x.text),
        x.image ? qImageEl({ kind: 'assignment', id: a.id, key: x.image }) : null,
        body);
    });

    note = h('textarea', { rows: '2', maxlength: '5000', placeholder: 'Lời nhắn cho giáo viên (không bắt buộc)' });
    note.value = touched && typeof saved.note === 'string' ? saved.note : s ? s.text : '';
    note.addEventListener('input', saveDraft);
    if (touched) setTimeout(function () { toast('Đã khôi phục bài em đang làm dở trên máy này.' + (hasEssay ? ' Ảnh chụp chưa nộp cần chọn lại.' : ''), 'success'); }, 0);
    var btn = h('button', { class: 'btn btn-lg' }, s ? 'Nộp lại bài' : 'Nộp bài');
    btn.addEventListener('click', function () {
      var missing = qs.filter(function (x, i) { return x.type !== 'essay' && (answers[i] === null || answers[i] === ''); }).length;
      var go2 = function () { sendSubmission(a, state, { answers: answers, text: note.value.trim() }, btn); };
      if (missing) {
        modal('Nộp bài?', h('p', null, 'Em còn ' + missing + ' câu trắc nghiệm / trả lời ngắn chưa trả lời. Vẫn nộp bài chứ?'), function (close) {
          return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Làm tiếp'), h('button', { class: 'btn', onclick: function () { close(); go2(); } }, 'Nộp bài')];
        });
      } else go2();
    });
    setLeaveGuard(function () { return touched || state.picked.length > 0; }, 'Em chưa nộp bài. Phần đã làm vẫn được lưu nháp trên máy này. Rời trang?');
    drawProgress();
    void done;

    return h('div', { class: 'q-form' },
      h('div', { class: 'panel mode-note' },
        h('strong', null, s ? 'Sửa bài nộp' : 'Làm bài'), ' · ',
        'Trắc nghiệm và trả lời ngắn làm ngay trên máy' + (hasEssay ? '; câu tự luận gõ lời giải hoặc chụp ảnh riêng cho từng câu.' : '.') +
          ' Điểm hiện sau khi thầy cô chốt; trước khi chốt em được sửa và nộp lại' + (a.dueAt ? ' (sau hạn nộp thì ghi là nộp muộn).' : '.'),
        a.file ? [h('br'), 'Có thể bấm ', h('strong', null, 'Xem'), ' ở file đề phía trên để xem đề gốc (hình vẽ, bảng…).'] : null),
      cards,
      h('div', { class: 'panel' },
        field('Lời nhắn', note),
        h('div', { class: 'actions-end' }, progress, h('span', { class: 'spacer' }),
          s ? h('button', { class: 'btn btn-ghost', onclick: function () { leaveGuard = null; draft.clear(dkey); renderAssignment(a.id); } }, 'Hủy') : null,
          btn)));
  }

  function submissionFileTile(s, f) {
    var key = 'sub:' + s.id + ':' + f.id;
    var fetcher = function () { return api('submissionFile', { submissionId: s.id, fileId: f.id }); };
    var isImg = /^image\//.test(f.mimeType);
    var thumb = h('button', { class: 'tile-thumb', 'aria-label': 'Xem ' + f.name, onclick: function () { openViewer(f.name, key, fetcher); } });
    if (isImg) {
      thumb.appendChild(h('span', { class: 'spinner' }));
      getBlob(key, fetcher).then(function (r) {
        fill(thumb, h('img', { src: blobUrl(r), alt: f.name, loading: 'lazy' }));
      }, function () { fill(thumb, h('span', { class: 'kind k-image' }, 'ẢNH')); });
    } else {
      var k = fileKind(f.mimeType, f.name);
      thumb.appendChild(h('span', { class: 'kind ' + k[1] }, k[0]));
    }
    return h('div', { class: 'tile' }, thumb,
      h('div', { class: 'tile-name', title: f.name }, f.name),
      h('button', { class: 'tile-dl', onclick: function (e) { download(key, fetcher, e.target); } }, 'Tải'));
  }

  /** Bài tập không có câu hỏi: chụp ảnh / chọn file cả bài + lời nhắn. */
  function submitForm(d, s) {
    var a = d.assignment;
    var state = { kept: s ? s.files.slice() : [], picked: [] };
    var note = h('textarea', { rows: '3', maxlength: '5000', placeholder: 'Lời nhắn cho giáo viên hoặc câu trả lời ngắn (không bắt buộc)' });
    note.value = s ? s.text : '';
    var picker = photoPicker(s, null, state);
    var drop = h('div', { class: 'dropzone' },
      h('div', { class: 'drop-icon' }, '📷'),
      h('p', null, h('strong', null, 'Chụp ảnh bài làm'), ' hoặc chọn ảnh / file PDF'),
      picker,
      h('p', { class: 'muted small' }, 'Tối đa ' + MAX_FILES + ' file. Ảnh được tự động thu nhỏ để gửi nhanh.'));
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) {
      var input = picker.querySelector('input[multiple]');
      try { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); } catch (err) { /* bỏ qua */ }
    });

    var btn = h('button', { class: 'btn btn-lg' }, s ? 'Nộp lại bài' : 'Nộp bài');
    btn.addEventListener('click', function () {
      if (!state.kept.length && !state.picked.length && !note.value.trim()) return toast('Hãy chụp ảnh / chọn file bài làm hoặc viết câu trả lời.', 'error');
      sendSubmission(a, state, { text: note.value.trim() }, btn);
    });
    var note0 = note.value;
    setLeaveGuard(function () { return state.picked.length > 0 || note.value !== note0; }, 'Em chưa nộp bài. Rời trang này?');

    return h('div', { class: 'panel submit-panel' },
      h('h2', null, s ? 'Sửa bài nộp' : 'Nộp bài'),
      drop,
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
    var hasQ = d.fullQuestions && d.fullQuestions.length;
    var count = function (fn) { return list.filter(fn).length; };
    var isSub = function (x) { return !!x.submission; };
    var isGraded = function (x) { return x.submission && x.submission.status === 'returned'; };
    var isUngraded = function (x) { return x.submission && x.submission.status === 'submitted'; };
    var autoOnly = hasQ && !d.fullQuestions.some(function (q) { return q.type === 'essay'; });
    var filters = [
      ['ungraded', 'Chưa chấm', isUngraded],
      ['missing', 'Chưa nộp', function (x) { return !x.submission; }],
      ['graded', 'Đã chấm', isGraded],
      ['all', 'Tất cả', function () { return true; }]
    ];
    var tools = h('div', { class: 'head-tools' },
      h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { go('#/giao-bai/' + encodeURIComponent(d.course.id) + '/' + a.id); } }, 'Sửa bài tập'),
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
          !list.length ? 'Khóa này chưa có học sinh nào. Vào Tài khoản để ghi danh học sinh.'
            : hwFilter === 'ungraded' ? 'Không còn bài nào chờ chấm 👍' : hwFilter === 'missing' ? 'Tất cả học sinh đã nộp bài.' : 'Chưa có học sinh nào ở mục này.')));
        return;
      }
      fill(listBox, shown.map(function (x) {
        var s = x.submission;
        var meta = s ? fmtDateTime(s.submittedAt) + (s.late ? ' · muộn' : '') + (s.files.length ? ' · ' + s.files.length + ' ảnh/file' : '') +
          (hasQ && s.autoScore != null && s.status !== 'returned' ? ' · máy chấm ' + fmtScore(s.autoScore) + 'đ' : '') : '';
        return h('button', { class: 'student-row', disabled: !s, onclick: function () { gradeView(d, list.indexOf(x)); } },
          h('span', { class: 'avatar sm' }, initials(x.fullName)),
          h('span', { class: 'student-name' }, x.fullName, x.left ? h('small', { class: 'muted' }, ' (đã rời khóa)') : null),
          h('span', { class: 'muted small' }, meta),
          s ? (s.status === 'returned' ? h('span', { class: 'pill p-done' }, fmtScore(s.score) + '/' + fmtScore(a.maxScore))
            : s.status === 'reopened' ? h('span', { class: 'pill p-todo' }, 'Chờ nộp lại')
              : h('span', { class: 'pill p-wait' }, autoOnly ? 'Chờ chốt' : 'Chấm bài'))
            : h('span', { class: 'pill p-todo' }, 'Chưa nộp'));
      }));
    }

    fill(app,
      assignmentHeader(d, tools),
      hasQ ? h('details', { class: 'panel key-panel' },
        h('summary', null, 'Đề & đáp án (' + d.fullQuestions.length + ' câu)'),
        h('div', { class: 'review' }, d.fullQuestions.map(function (x, i) {
          return reviewItem({ type: x.type, text: x.text, options: x.options, points: x.points,
            correctAnswer: x.type === 'mc' ? x.correct : (x.answers || []).join('  |  '), explain: x.explain,
            imgEl: x.image ? qImageEl({ kind: 'assignment', id: a.id, key: x.image }) : null }, i, true);
        }))) : null,
      h('div', { class: 'stats' },
        stat(count(isSub) + '/' + list.length, 'Đã nộp'),
        stat(count(isUngraded), autoOnly ? 'Chờ chốt' : 'Chờ chấm', count(isUngraded) ? 'warn' : ''),
        stat(count(isGraded), 'Đã chốt điểm'),
        stat(avgScore(list), 'Điểm trung bình')),
      autoOnly && count(isUngraded) ? finalizeBar() : null,
      chipBar, listBox);
    drawList();

    /** Bài toàn trắc nghiệm / trả lời ngắn: chốt điểm máy chấm cho cả lớp một lần. */
    function finalizeBar() {
      var n = count(isUngraded);
      var open = a.dueAt && Date.now() < new Date(a.dueAt).getTime();
      var btn = h('button', { class: 'btn' }, '✓ Chốt điểm ' + n + ' bài');
      btn.addEventListener('click', function () {
        modal('Chốt điểm ' + n + ' bài?', h('div', null,
          h('p', null, 'Điểm máy chấm (kể cả câu thầy đã sửa) của ' + n + ' bài đang chờ sẽ được công bố cho học sinh.'),
          h('p', { class: 'err' }, (open ? 'Bài còn hạn nộp đến ' + fmtDateTime(a.dueAt) + '. ' : '') + 'Sau khi chốt, các em này không sửa / nộp bổ sung được nữa.'),
          h('p', { class: 'muted small' }, 'Nên mở từng bài xem các câu trả lời ngắn máy chấm Sai trước khi chốt — có thể em viết đúng mà đáp án chưa có cách viết đó.')), function (close) {
          var ok = h('button', { class: 'btn' }, 'Chốt điểm');
          ok.addEventListener('click', function () {
            busy(ok, true, 'Đang chốt…');
            var ids = list.filter(isUngraded).map(function (x) { return x.submission.id; });
            api('finalizeAll', { assignmentId: a.id, ids: ids }).then(function (r) {
              close();
              toast('Đã chốt điểm ' + r.finalized.length + ' bài.' + (r.skipped ? ' Bỏ qua ' + r.skipped + ' bài chưa đủ điểm.' : ''), 'success');
              renderAssignment(a.id);
            }, function (e) { busy(ok, false); toast(e.message, 'error'); });
          });
          return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
        });
      });
      return h('div', { class: 'panel finalize-bar' },
        h('div', null, h('strong', null, n + ' bài máy đã chấm, chờ thầy chốt điểm'),
          h('p', { class: 'muted small' }, 'Học sinh chưa thấy điểm cho đến khi chốt. Bấm vào tên từng em để xem và sửa điểm nếu máy chấm sai.')),
        btn);
    }
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

  function workImage(s, f) {
    var key = 'sub:' + s.id + ':' + f.id;
    var fetcher = function () { return api('submissionFile', { submissionId: s.id, fileId: f.id }); };
    if (/^image\//.test(f.mimeType)) {
      var holder = h('div', { class: 'work-img' }, loading('Đang tải ảnh…'));
      getBlob(key, fetcher).then(function (r) {
        var img = h('img', { src: blobUrl(r), alt: f.name });
        img.addEventListener('click', function () { openViewer(f.name, key, fetcher); });
        fill(holder, img);
      }, function (e) { fill(holder, h('p', { class: 'err' }, e.message)); });
      return holder;
    }
    var k = fileKind(f.mimeType, f.name);
    return h('div', { class: 'file-row' }, h('span', { class: 'kind sm ' + k[1] }, k[0]), h('span', { class: 'file-name' }, f.name), fileButtons(f.name, f, key, fetcher));
  }

  /** Màn chấm bài. Có câu hỏi: máy đã chấm trắc nghiệm/trả lời ngắn, giáo viên nhập điểm từng câu tự luận. */
  function gradeView(d, index) {
    var a = d.assignment;
    var x = d.students[index];
    var s = x.submission;
    var qs = d.fullQuestions || [];
    var hasQ = qs.length && s.itemScores;
    var fb = h('textarea', { rows: '4', maxlength: '3000', placeholder: 'Nhận xét cho học sinh (không bắt buộc)' });
    fb.value = s.feedback || '';
    var nextUngraded = function () {
      for (var i = 1; i <= d.students.length; i++) {
        var j = (index + i) % d.students.length;
        var y = d.students[j];
        if (y.submission && y.submission.status === 'submitted' && j !== index) return j;
      }
      return -1;
    };

    var score = null;
    var essayInputs = {};
    var aiBoxes = {}; // ô hiện gợi ý của Gemini: theo chỉ số câu, hoặc 'all' khi chấm cả bài
    var totalEl = h('strong', { class: 'total-score' });
    var work;
    var side;

    var autoInputs = {}; // ô điểm câu trắc nghiệm / trả lời ngắn (máy chấm sẵn, thầy sửa được)
    function sumInputs(map) {
      var t = 0;
      Object.keys(map).forEach(function (i) { var v = Number(String(map[i].value).replace(',', '.')); if (!isNaN(v)) t += v; });
      return t;
    }
    function drawTotal() {
      totalEl.textContent = fmtScore(sumInputs(autoInputs) + sumInputs(essayInputs)) + ' / ' + fmtScore(a.maxScore);
    }

    if (hasQ) {
      var answers = s.answers || [];
      var general = s.files.filter(function (f) { return f.q === null || f.q === undefined; });
      work = h('div', { class: 'grade-work' },
        s.text ? h('div', { class: 'panel prewrap' }, h('strong', null, 'Lời nhắn: '), s.text) : null,
        general.map(function (f) { return workImage(s, f); }),
        qs.map(function (q, i) {
          var ans = answers[i];
          var head = h('div', { class: 'review-head' }, h('span', { class: 'q-num' }, 'Câu ' + (i + 1) + ' · ' + TYPE_LABEL[q.type] + ' · ' + fmtScore(q.points) + 'đ'));
          if (q.type !== 'essay') {
            var machine = s.auto && s.auto[i] != null ? s.auto[i] : s.itemScores[i] || 0; // điểm máy chấm
            var ok = machine > 0;
            var said = q.type === 'mc' ? (ans === null || ans === undefined ? '(bỏ trống)' : String.fromCharCode(65 + ans) + '. ' + (q.options[ans] || ''))
              : (ans === null || ans === '' ? '(bỏ trống)' : ans);
            var right = q.type === 'mc' ? String.fromCharCode(65 + q.correct) + '. ' + q.options[q.correct] : q.answers.join(' | ');
            head.appendChild(h('span', { class: 'pill ' + (ok ? 'p-done' : 'p-bad') }, 'Máy: ' + (ok ? 'Đúng' : 'Sai')));
            var cur = s.itemScores[i] != null ? s.itemScores[i] : machine;
            var ainp = h('input', { type: 'text', inputmode: 'decimal', class: 'essay-score sm', 'aria-label': 'Điểm câu ' + (i + 1), value: String(cur).replace('.', ',') });
            var row = h('div', { class: 'panel review-item compact ' + (ok ? 'is-ok' : 'is-bad') });
            var mark = function () {
              var v = Number(String(ainp.value).replace(',', '.'));
              row.classList.toggle('overridden', String(ainp.value).trim() !== '' && v !== machine);
              drawTotal();
            };
            ainp.addEventListener('input', mark);
            autoInputs[i] = ainp;
            fill(row, head,
              h('p', { class: 'q-text sm prewrap' }, q.text),
              q.image ? qImageEl({ kind: 'assignment', id: a.id, key: q.image }) : null,
              h('p', { class: 'small' }, 'Học sinh: ', h('strong', { class: ok ? 'ok' : 'err' }, said), ok ? null : [' · Đáp án: ', h('strong', { class: 'ok' }, right)]),
              h('div', { class: 'essay-score-row auto-row' },
                h('span', null, 'Điểm:'), ainp, h('span', { class: 'muted' }, '/ ' + fmtScore(q.points)),
                h('button', { type: 'button', class: 'chip-btn', onclick: function () { ainp.value = String(q.points).replace('.', ','); mark(); } }, 'Cho đúng'),
                h('button', { type: 'button', class: 'chip-btn', onclick: function () { ainp.value = '0'; mark(); } }, 'Cho sai'),
                h('span', { class: 'override-tag' }, 'Thầy đã sửa điểm máy chấm')));
            mark();
            return row;
          }
          var inp = h('input', { type: 'text', inputmode: 'decimal', class: 'essay-score', placeholder: '0–' + fmtScore(q.points),
            value: s.itemScores[i] != null ? String(s.itemScores[i]).replace('.', ',') : '' });
          inp.addEventListener('input', drawTotal);
          essayInputs[i] = inp;
          var photos = s.files.filter(function (f) { return f.q === i; });
          aiBoxes[i] = h('div', { class: 'ai-note', hidden: true });
          return h('div', { class: 'panel review-item essay-grade' }, head,
            h('p', { class: 'q-text sm prewrap' }, q.text),
            q.image ? qImageEl({ kind: 'assignment', id: a.id, key: q.image }) : null,
            q.explain ? h('div', { class: 'explain' }, h('strong', null, 'Hướng dẫn chấm: '), h('span', { class: 'prewrap' }, q.explain)) : null,
            ans ? h('div', { class: 'essay-answer prewrap' }, ans) : null,
            photos.map(function (f) { return workImage(s, f); }),
            !ans && !photos.length ? h('p', { class: 'muted' }, 'Học sinh bỏ trống câu này.') : null,
            aiBoxes[i],
            h('div', { class: 'essay-score-row' },
              h('span', null, 'Điểm câu ' + (i + 1) + ':'), inp, h('span', { class: 'muted' }, '/ ' + fmtScore(q.points)),
              [q.points, q.points / 2, 0].map(function (v) {
                return h('button', { type: 'button', class: 'chip-btn', onclick: function () { inp.value = String(v).replace('.', ','); drawTotal(); } }, fmtScore(v));
              })));
        }));
      side = h('div', { class: 'grade-side' },
        h('div', { class: 'total-box' }, h('span', { class: 'muted small' }, 'Tổng điểm'), totalEl,
          h('span', { class: 'muted small' }, Object.keys(essayInputs).length ? 'Trắc nghiệm, trả lời ngắn + tự luận' : 'Máy đã chấm sẵn, thầy sửa từng câu nếu cần'),
          s.status !== 'returned' ? h('span', { class: 'pill p-wait' }, 'Học sinh chưa thấy điểm') : null),
        Object.keys(essayInputs).length ? aiPanel() : null,
        field('Nhận xét', fb),
        s.status === 'returned' ? h('p', { class: 'muted small' }, 'Đã chấm ' + fmtDateTime(s.gradedAt) + ' · ' + s.gradedBy) : null);
      drawTotal();
    } else {
      score = h('input', { type: 'text', inputmode: 'decimal', class: 'score-input', value: s.score != null ? String(s.score).replace('.', ',') : '', placeholder: '0–' + a.maxScore });
      work = h('div', { class: 'grade-work' },
        s.text ? h('div', { class: 'panel prewrap' }, s.text) : null,
        s.files.map(function (f) { return workImage(s, f); }),
        !s.text && !s.files.length ? h('p', { class: 'muted' }, 'Bài nộp trống.') : null);
      side = h('div', { class: 'grade-side' },
        h('label', { class: 'field' }, h('span', null, 'Điểm (thang ' + fmtScore(a.maxScore) + ')'), score),
        h('div', { class: 'quick-scores' }, quickScores(a.maxScore).map(function (v) {
          return h('button', { type: 'button', class: 'chip-btn', onclick: function () { score.value = String(v).replace('.', ','); } }, fmtScore(v));
        })),
        (aiBoxes.all = h('div', { class: 'ai-note', hidden: true })),
        aiPanel(),
        field('Nhận xét', fb),
        s.status === 'returned' ? h('p', { class: 'muted small' }, 'Đã chấm ' + fmtDateTime(s.gradedAt) + ' bởi ' + s.gradedBy) : null);
    }

    /* ── Gemini gợi ý điểm: chỉ điền sẵn, giáo viên xem lại rồi bấm Lưu điểm ── */
    var aiFeedback = '';
    var aiFbBox;
    function aiPanel() {
      var btn = h('button', { type: 'button', class: 'btn btn-ai' }, s.ai ? '✨ Gemini chấm lại' : '✨ Gemini gợi ý điểm');
      aiFbBox = h('div', { class: 'ai-fb', hidden: true });
      btn.addEventListener('click', function () {
        busy(btn, true, 'Gemini đang đọc bài…');
        var t0 = Date.now();
        var timer = setInterval(function () { btn.textContent = 'Gemini đang đọc bài… ' + Math.round((Date.now() - t0) / 1000) + ' giây'; }, 1000);
        var stop = function () { clearInterval(timer); busy(btn, false); };
        api('aiGrade', { submissionId: s.id }).then(function (r) {
          s.ai = r.ai;
          stop();
          btn.textContent = '✨ Gemini chấm lại';
          applyAi(r.ai, true);
          toast('Đã điền điểm Gemini gợi ý. Thầy xem lại từng câu rồi bấm Chốt điểm.', 'success');
        }, function (e) { stop(); toast(e.message, 'error'); });
      });
      return h('div', { class: 'ai-panel' }, btn,
        h('p', { class: 'muted small' }, 'Gemini đọc ảnh bài làm và hướng dẫn chấm rồi điền sẵn điểm (thường 20–60 giây, đừng đóng cửa sổ). Thầy xem lại trước khi lưu.'),
        aiFbBox);
    }
    function scoreInput(q) { return q === null || q === undefined ? score : essayInputs[q]; }
    function applyAi(ai, force) {
      var lines = [];
      (ai.items || []).forEach(function (it) {
        var key = it.q === null || it.q === undefined ? 'all' : it.q;
        var box = aiBoxes[key];
        var inp = scoreInput(it.q);
        if (!box || !inp) return;
        if (!inp._aiWatch) { inp._aiWatch = true; inp.addEventListener('input', function () { inp.classList.remove('ai-filled'); }); }
        if (it.score !== null && (force || (!inp.value && s.status !== 'returned'))) {
          inp.value = String(it.score).replace('.', ',');
          inp.classList.add('ai-filled');
        }
        var useBtn = it.score === null ? null : h('button', { type: 'button', class: 'chip-btn', onclick: function () {
          inp.value = String(it.score).replace('.', ','); inp.classList.add('ai-filled'); if (hasQ) drawTotal();
        } }, 'Dùng ' + fmtScore(it.score) + 'đ');
        fill(box,
          h('div', { class: 'ai-head' }, h('strong', null, '✨ Gemini: ' + (it.score === null ? 'chưa chấm được' : fmtScore(it.score) + 'đ')),
            it.unsure ? h('span', { class: 'pill p-wait' }, 'Cần xem kỹ') : null, useBtn),
          it.reason ? h('p', { class: 'small' }, it.reason) : null,
          it.comment ? h('p', { class: 'small muted' }, 'Nhận xét: ' + it.comment) : null);
        box.hidden = false;
        if (it.comment) lines.push((hasQ && (ai.items || []).length > 1 ? 'Câu ' + (it.q + 1) + ': ' : '') + it.comment);
      });
      aiFeedback = [ai.feedback].concat(lines).filter(Boolean).join('\n');
      if (aiFeedback && (force || !fb.value.trim()) && !(s.status === 'returned' && !force)) fb.value = aiFeedback;
      if (aiFbBox) {
        fill(aiFbBox,
          ai.skipped ? h('p', { class: 'small err' }, ai.skipped + ' file không gửi được cho Gemini (quá lớn hoặc không phải ảnh/PDF) – thầy tự xem phần đó.') : null,
          aiFeedback ? h('button', { type: 'button', class: 'chip-btn', onclick: function () { fb.value = aiFeedback; } }, 'Dùng nhận xét của Gemini') : null,
          h('span', { class: 'muted small' }, 'Gợi ý lúc ' + fmtDateTime(ai.at) + (ai.secs ? ' · ' + ai.secs + ' giây' : '')));
        aiFbBox.hidden = false;
      }
      if (hasQ) drawTotal();
    }
    if (s.ai) applyAi(s.ai, false);

    var title = x.fullName + ' · nộp ' + fmtDateTime(s.submittedAt) + (s.late ? ' (muộn)' : '');
    modal(title, h('div', { class: 'grade' }, work, side), function (close) {
      function save(next) {
        var btn = next ? nextBtn : saveBtn;
        var params = { submissionId: s.id, feedback: fb.value };
        if (hasQ) {
          params.scores = {};
          Object.keys(autoInputs).forEach(function (i) { params.scores[i] = autoInputs[i].value; });
          Object.keys(essayInputs).forEach(function (i) { params.scores[i] = essayInputs[i].value; });
          params.essayScores = {}; // máy chủ cũ chỉ hiểu essayScores
          Object.keys(essayInputs).forEach(function (i) { params.essayScores[i] = essayInputs[i].value; });
        } else params.score = score.value;
        busy(btn, true, 'Đang chốt…');
        return api('grade', params).then(function (r) {
          if (r.submission.ai === undefined) r.submission.ai = s.ai || null;
          x.submission = r.submission;
          close();
          toast('Đã chốt điểm cho ' + x.fullName + '. Học sinh đã xem được điểm.', 'success');
          var n = nextUngraded();
          if (next && n >= 0) gradeView(d, n); else drawAssignmentTeacher(d);
        }, function (e) { busy(btn, false); toast(e.message, 'error'); });
      }
      var again = s.status === 'returned';
      var saveBtn = h('button', { class: 'btn btn-ghost' }, again ? 'Lưu điểm' : 'Chốt điểm');
      var nextBtn = h('button', { class: 'btn' }, 'Chốt & chấm bài tiếp');
      saveBtn.addEventListener('click', function () { save(false); });
      nextBtn.addEventListener('click', function () { save(true); });
      var reopen = s.status !== 'reopened' ? h('button', { class: 'btn btn-ghost', title: 'Cho học sinh sửa và nộp lại (kể cả khi đã quá hạn)', onclick: function () {
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
    var br = q.branch || d.branch || '';
    return [
      h('a', { href: '#/khoa/' + encodeURIComponent(d.course.id), class: 'back', onclick: br ? function () { setActiveBranch(d.course.id, br); } : null },
        '← ' + (br ? br + ' · ' : '') + d.course.name + ' · ' + d.course.grade),
      h('div', { class: 'page-head course-head', style: '--c:' + courseColor(d.course.id) },
        h('span', { class: 'tag' }, [br, q.topic].filter(Boolean).join(' · ') || 'Luyện tập'),
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
    // Nháp: tải lại trang vẫn giữ câu đã chọn. Bài tính giờ giữ nguyên hạn cũ (không được cộng thêm giờ).
    var dkey = 'q:' + q.id;
    var saved = draft.load(dkey);
    if (restoreAnswers(answers, saved)) {
      if (deadline && saved.deadline) deadline = saved.deadline;
      if (typeof saved.cur === 'number') cur = Math.min(qs.length - 1, Math.max(0, saved.cur));
      setTimeout(function () { toast('Đã khôi phục bài em đang làm dở.', 'success'); }, 0);
    }
    function saveDraft() { draft.save(dkey, { answers: answers, cur: cur, deadline: deadline || 0 }); }
    function stop() { clearInterval(timer); timer = null; }

    var progress = h('div', { class: 'progress' }, h('div', { class: 'progress-bar' }));
    var clock = h('span', { class: 'clock' });
    var stage = h('div', { class: 'q-stage' });
    var nav = h('div', { class: 'q-nav' });
    var prev = h('button', { class: 'btn btn-ghost', onclick: function () { show(cur - 1); } }, '← Câu trước');
    var next = h('button', { class: 'btn', onclick: function () { if (cur < qs.length - 1) show(cur + 1); else finish(); } });

    function startGuard() {
      setLeaveGuard(function () { return !submitted; },
        deadline ? 'Em đang làm bài dở và đồng hồ vẫn tính giờ. Thoát?' : 'Em đang làm bài dở. Phần đã làm vẫn được lưu trên máy này. Thoát?',
        stop);
    }
    startGuard();

    function answered() { return answers.filter(function (a) { return a !== null && a !== ''; }).length; }

    function show(i) {
      cur = Math.max(0, Math.min(qs.length - 1, i));
      var x = qs[cur];
      var body;
      if (x.type === 'mc') {
        body = h('div', { class: 'options' }, x.options.map(function (o, k) {
          return h('button', { class: 'option' + (answers[cur] === k ? ' picked' : ''), onclick: function () {
            // Chỉ tự sang câu sau khi chọn lần đầu: đổi đáp án thì ở lại, chạm hai lần cũng không chọn nhầm câu sau.
            var firstPick = answers[cur] === null;
            var at = cur;
            answers[cur] = k;
            saveDraft();
            show(cur);
            if (firstPick && at < qs.length - 1) setTimeout(function () { if (!submitted && cur === at && stage.isConnected) show(at + 1); }, 500);
          } }, h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o));
        }));
      } else {
        var inp = h('input', { class: 'short-input', value: answers[cur] || '', placeholder: 'Nhập đáp số…', autocomplete: 'off', inputmode: 'text' });
        inp.addEventListener('input', function () { answers[cur] = inp.value; drawNav(); saveDraft(); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') next.click(); });
        body = h('div', null, inp, symbolKeys(inp));
        setTimeout(function () { inp.focus(); }, 0);
      }
      fill(stage,
        h('p', { class: 'q-num' }, 'Câu ' + (cur + 1) + ' / ' + qs.length),
        h('h2', { class: 'q-text prewrap' }, x.text),
        x.image ? qImageEl({ kind: 'quiz', id: q.id, key: x.image }) : null,
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
      // Đã rời trang làm bài (bằng bất kỳ đường nào) → dừng hẳn, không tự nộp.
      if (!clock.isConnected && !submitted) { stop(); return; }
      var left = Math.max(0, deadline - Date.now());
      var m = Math.floor(left / 60000);
      var s = Math.floor(left / 1000) % 60;
      clock.textContent = '⏱ ' + m + ':' + String(s).padStart(2, '0');
      clock.classList.toggle('low', left < 60000);
      if (left <= 0) { stop(); toast('Hết giờ! Bài được nộp tự động.', 'error'); send(); }
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
      stop();
      var wait = loading('Đang chấm bài…');
      fill(app, wait);
      api('submitQuiz', { quizId: q.id, answers: answers }).then(function (r) {
        draft.clear(dkey);
        if (!wait.isConnected) return toast('Bài luyện tập đã được nộp và chấm.', 'success');
        leaveGuard = null;
        drawResult(d, r, true);
      }, function (e) {
        if (!wait.isConnected) return toast(e.message + ' Bài chưa nộp được, phần đã làm vẫn lưu trên máy.', 'error');
        submitted = false;
        toast(e.message + ' Bấm Nộp bài để thử lại.', 'error');
        draw();
        startGuard();
        // Hết giờ mà nộp lỗi thì chờ em bấm Nộp bài, không tự nộp lại liên tục.
        if (deadline && !timer && deadline > Date.now()) { timer = setInterval(tick, 1000); tick(); }
      });
    }

    function draw() {
      fill(app,
        h('div', { class: 'quiz-top' },
          h('strong', { class: 'quiz-title' }, q.title),
          deadline ? clock : null,
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { if (leaveGuard && leaveGuard()) { leaveGuard = null; renderQuiz(q.id); } } }, 'Thoát')),
        progress,
        h('div', { class: 'panel quiz-card' }, stage, h('div', { class: 'q-buttons' }, prev, next)),
        h('div', { class: 'q-nav-wrap' }, h('p', { class: 'muted small' }, 'Bảng câu hỏi (bấm để chuyển câu)'), nav,
          h('button', { class: 'btn btn-ghost btn-sm', onclick: finish }, 'Nộp bài')));
      show(cur);
    }

    draw();
    if (deadline) { timer = setInterval(tick, 1000); tick(); }
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
      h('div', { class: 'review' }, r.review.map(function (x, i) {
        if (x.image) x.imgEl = qImageEl({ kind: 'quiz', id: d.quiz.id, key: x.image });
        return reviewItem(x, i);
      })));
  }

  /** Một câu khi xem lại. key = true: giáo viên xem đề & đáp án (không có bài làm của học sinh). */
  function reviewItem(x, i, key) {
    var yours;
    var right = null;
    if (key) {
      return h('div', { class: 'panel review-item is-key' },
        h('div', { class: 'review-head' }, h('span', { class: 'q-num' }, 'Câu ' + (i + 1)),
          h('span', { class: 'pill ' + (x.type === 'essay' ? 'p-todo' : 'p-blue') }, TYPE_LABEL[x.type] + (x.points != null ? ' · ' + fmtScore(x.points) + ' điểm' : ''))),
        h('p', { class: 'q-text prewrap' }, x.text),
        x.imgEl || null,
        x.tools || null,
        x.type === 'mc'
          ? h('div', { class: 'options review-opts' }, x.options.map(function (o, k) {
            return h('div', { class: 'option static' + (x.correctAnswer === k ? ' correct' : '') },
              h('span', { class: 'opt-letter' }, String.fromCharCode(65 + k)), h('span', { class: 'opt-text' }, o));
          }))
          : x.type === 'essay' ? h('p', { class: 'muted small' }, 'Học sinh gõ hoặc chụp ảnh lời giải · giáo viên chấm')
            : h('p', null, 'Đáp án chấp nhận: ', h('strong', { class: x.correctAnswer ? 'ok' : 'err' }, x.correctAnswer || '(chưa có — thêm dòng "Đáp án: …")')),
        x.explain ? h('div', { class: 'explain' }, h('strong', null, x.type === 'essay' ? 'Hướng dẫn chấm: ' : 'Lời giải: '), h('span', { class: 'prewrap' }, x.explain)) : null);
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
      x.imgEl || null,
      yours, right,
      x.explain ? h('div', { class: 'explain' }, h('strong', null, 'Lời giải: '), h('span', { class: 'prewrap' }, x.explain)) : null);
  }

  function drawQuizTeacher(d) {
    var q = d.quiz;
    var tab = 'results';
    var box = h('div');
    var chipBar = h('div', { class: 'chips filter' });
    var tools = h('div', { class: 'head-tools' },
      h('button', { class: 'btn btn-sm', onclick: function () { go('#/dau-host/' + encodeURIComponent(q.id)); } }, '🎮 Đấu cả lớp'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { takeQuiz(d); } }, 'Làm thử'),
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
          return reviewItem({ type: x.type, text: x.text, options: x.options, correctAnswer: x.type === 'mc' ? x.correct : x.answers.join('  |  '), explain: x.explain,
            imgEl: x.image ? qImageEl({ kind: 'quiz', id: q.id, key: x.image }) : null }, i, true);
        })));
      }
    }
    fill(app, quizHeader(d, [
      q.gameOnly ? h('p', { class: 'head-meta muted small' }, '🎮 Bài này đang ẩn với học sinh – chỉ dùng để đấu cả lớp.') : null,
      tools
    ]), chipBar, box);
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
    var br = branchSelect(c, q ? (q.branch || existing.branch) : '');
    var ti = topicInput(cd.topics, q ? q.topic : '');
    var title = h('input', { maxlength: '200', value: q ? q.title : '', placeholder: 'VD: Luyện tập phân số – Đề 1' });
    var desc = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Lời dặn cho học sinh (không bắt buộc)' });
    desc.value = existing ? existing.description || '' : '';
    var limit = h('input', { type: 'number', min: '0', max: '300', value: q ? String(q.timeLimit || '') : '', placeholder: '0 = không giới hạn' });
    var show = h('input', { type: 'checkbox', checked: q ? q.showAnswers : true });
    var gameOnly = h('input', { type: 'checkbox', checked: q ? !!q.gameOnly : false });
    var src = h('textarea', { class: 'quiz-src', rows: '18', spellcheck: 'false', placeholder: window.QuizFormat.SAMPLE });
    src.value = existing ? existing.source || '' : '';
    var preview = h('div', { class: 'quiz-preview' });
    var status = h('div', { class: 'parse-status' });
    var parsed = { questions: [], errors: [] };
    var dirty = false;
    var store = imageStore('quiz', q ? q.id : null, existing && existing.fullQuestions ? existing.fullQuestions.map(function (x) { return x.image; }).filter(Boolean) : []);
    if (br) br.addEventListener('change', function () { dirty = true; });

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
          correctAnswer: x.type === 'mc' ? x.correct : (x.answers || []).join('  |  '), explain: x.explain,
          imgEl: store.el(x.image), tools: imageTools(src, parsed, store, i, function () { dirty = true; update(); }) }, i, true);
      }));
    }
    var t = null;
    src.addEventListener('input', function () { dirty = true; clearTimeout(t); t = setTimeout(update, 250); });

    setLeaveGuard(function () { return dirty; }, 'Đề chưa được lưu. Rời trang?');

    var saveBtn = h('button', { class: 'btn btn-lg' }, q ? 'Lưu thay đổi' : 'Lưu bài luyện tập');
    saveBtn.addEventListener('click', function () {
      update();
      if (!title.value.trim()) return toast('Vui lòng nhập tên bài luyện tập.', 'error');
      if (parsed.errors.length) return toast('Đề còn lỗi, xem danh sách lỗi phía trên phần xem trước.', 'error');
      busy(saveBtn, true, 'Đang lưu…');
      api('saveQuiz', {
        id: q ? q.id : undefined, courseId: c.id, title: title.value.trim(), topic: ti[0].value.trim(),
        branch: br ? br.value : '',
        description: desc.value.trim(), timeLimit: Number(limit.value || 0), showAnswers: show.checked, gameOnly: gameOnly.checked,
        source: src.value, questions: parsed.questions, newImages: store.newImages(parsed.questions)
      }).then(function (r) {
        dirty = false;
        leaveGuard = null;
        coursesCache = null;
        delete viewCache['course:' + c.id];
        if (br) setActiveBranch(c.id, br.value);
        toast('Đã lưu bài luyện tập.', 'success');
        go('#/luyen/' + r.id);
      }, function (e) { busy(saveBtn, false); toast(e.message, 'error'); });
    });

    fill(app,
      h('a', { href: q ? '#/luyen/' + q.id : '#/khoa/' + encodeURIComponent(c.id), class: 'back' }, '← ' + (q ? q.title : c.name + ' · ' + c.grade)),
      h('div', { class: 'page-head' }, h('h1', null, q ? 'Sửa bài luyện tập' : 'Soạn bài luyện tập'), h('p', { class: 'muted' }, c.name + ' · ' + c.grade)),
      h('div', { class: 'panel form' },
        h('div', { class: 'row' + (br ? '' : ' two') }, field('Tên bài', title), br ? field('Nhánh', br) : null, field('Chủ đề', ti)),
        field('Lời dặn', desc),
        h('div', { class: 'row two' },
          field('Thời gian làm bài (phút)', limit),
          h('div', { class: 'field' },
            h('label', { class: 'check' }, show, 'Cho học sinh xem đáp án và lời giải sau khi nộp'),
            h('label', { class: 'check' }, gameOnly, '🎮 Chỉ dùng để đấu cả lớp (ẩn với học sinh)'),
            h('small', { class: 'muted small' }, 'Học sinh không thấy và không làm được bài này. Bỏ chọn sau trận đấu để mở cho học sinh luyện tập.')))),
      h('div', { class: 'editor' },
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' },
            h('h2', null, 'Nội dung đề'),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-sm', onclick: function () {
                importPdfDialog(false, function (r) {
                  if (src.value.trim() && !confirm('Thay nội dung đề hiện tại bằng đề vừa đọc từ PDF?')) return;
                  src.value = r.source;
                  Object.keys(r.images || {}).forEach(function (k) { store.put(k, r.images[k]); });
                  dirty = true;
                  update();
                  toast('Đã đọc ' + r.count + ' câu' + (r.figureCount ? ', ' + r.figureCount + ' hình' : '') + (r.hasKey ? ', ' + r.keyed + ' câu có đáp án' : ', chưa thấy đáp án') + '. Hãy kiểm tra lại.', r.keyed === r.count ? 'success' : '');
                });
              } }, '📄 Lấy đề từ PDF'),
              h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { formatHelp(false, src, function () { dirty = true; update(); }); } }, 'Xem mẫu'))),
          src),
        h('div', { class: 'editor-col' },
          h('div', { class: 'editor-head' }, h('h2', null, 'Học sinh sẽ thấy')),
          status, preview)),
      h('div', { class: 'actions-end sticky-save' }, saveBtn));
    update();

  }

  /* ═════════ Quản lý tài khoản (admin) ═════════ */

  /* ═════════ Admin: thống kê sĩ số & học phí theo tháng ═════════ */

  function monthLabel(m) {
    var p = String(m || '').split('-');
    return p.length === 2 ? 'Tháng ' + Number(p[1]) + '/' + p[0] : m;
  }
  function shiftMonth(m, d) {
    var p = m.split('-').map(Number);
    var t = new Date(p[0], p[1] - 1 + d, 1);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
  }
  function shortDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  var feeView = { course: '', status: 'all' };

  /**
   * Lưu học phí ở phía sau: bấm là đổi ngay trên màn hình, các lần bấm gần nhau được gộp
   * thành MỘT lần gọi máy chủ (setFees). Lỗi → trả ô đó về trạng thái cũ và báo.
   * Máy chủ chưa cập nhật (không có setFees) → gửi lần lượt từng setFee như trước.
   */
  var feeSync = {
    queue: [],        // {month, change, s, c, v}
    sending: false,
    timer: null,
    batch: true,
    view: null,       // {redraw} của trang học phí đang mở
    DELAY: 700,
    dirty: function () { return feeSync.queue.length > 0 || feeSync.sending; },
    detach: function () { feeSync.view = null; if (feeSync.queue.length) feeSync.flush(); },
    add: function (month, c, s, change) {
      if (s._server === undefined) s._server = { paid: s.paid, paidAt: s.paidAt, note: s.note };
      s._v = (s._v || 0) + 1;
      s.saving = true;
      s.paid = !!change.paid;
      if (s.paid && !s.paidAt) s.paidAt = new Date().toISOString();
      if (!s.paid) { s.paidAt = ''; s.note = ''; }
      if (change.note !== undefined) s.note = change.note;
      feeSync.queue.push({ month: month, c: c, s: s, v: s._v, change: Object.assign({ username: s.username, courseId: c.id }, change) });
      clearTimeout(feeSync.timer);
      feeSync.timer = setTimeout(feeSync.flush, feeSync.queue.length >= 30 ? 0 : feeSync.DELAY);
    },
    flush: function () {
      clearTimeout(feeSync.timer);
      if (feeSync.sending || !feeSync.queue.length) return;
      var items = feeSync.queue;
      feeSync.queue = [];
      feeSync.sending = true;
      var months = {};
      items.forEach(function (it) { (months[it.month] = months[it.month] || []).push(it); });
      var jobs = Object.keys(months).map(function (m) { return feeSync.send(m, months[m]); });
      Promise.all(jobs).then(function () {
        feeSync.sending = false;
        if (feeSync.view) feeSync.view.redraw();
        if (feeSync.queue.length) feeSync.timer = setTimeout(feeSync.flush, 0);
      });
    },
    send: function (month, items) {
      var done = function (it, fee, err) {
        var s = it.s;
        if (s._v !== it.v) return; // đã bấm tiếp sau đó → kết quả của lần bấm sau mới có hiệu lực
        s.saving = false;
        if (err) {
          s.paid = s._server.paid; s.paidAt = s._server.paidAt; s.note = s._server.note;
          return;
        }
        s.paid = fee.paid; s.paidAt = fee.paidAt; s.note = fee.note;
        s._server = { paid: s.paid, paidAt: s.paidAt, note: s.note };
        if (!s.paid && s.left) {
          var i = it.c.students.indexOf(s);
          if (i >= 0) it.c.students.splice(i, 1);
        }
      };
      var one = function (it) {
        return api('setFee', Object.assign({ month: month }, it.change)).then(function (r) { done(it, r.fee); }, function (e) { done(it, null, e); throw e; });
      };
      var sequential = function (list) {
        var errors = 0;
        return list.reduce(function (p, it) {
          return p.then(function () { return one(it).catch(function () { errors++; }); });
        }, Promise.resolve()).then(function () {
          if (errors) toast('Có ' + errors + ' thay đổi học phí chưa lưu được, đã trả lại như cũ.', 'error');
        });
      };
      if (!feeSync.batch) return sequential(items);
      return api('setFees', { month: month, changes: items.map(function (it) { return it.change; }) }).then(function (r) {
        var bad = [];
        items.forEach(function (it, i) {
          var x = r.results[i] || { error: 'Không có kết quả.' };
          if (x.error) bad.push(it.s.fullName + ': ' + x.error);
          done(it, x.fee, x.error);
        });
        if (bad.length) toast(bad.join(' · '), 'error');
      }, function (e) {
        if (e.oldServer) { feeSync.batch = false; return sequential(items); }
        items.forEach(function (it) { done(it, null, e); });
        toast('Chưa lưu được học phí: ' + e.message, 'error');
      });
    }
  };

  function renderFees(month) {
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) month = '';
    var key = 'fees:' + (month || 'now');
    if (!viewCache[key]) fill(app, loading());
    showCached(key, function () {
      return api('feeBoard', month ? { month: month } : {}).then(function (b) { delete b.ok; return b; });
    }, drawFees, function (e) { fill(app, errorBox(e.message, function () { renderFees(month); })); },
    function () { return feeSync.dirty(); });
  }

  function drawFees(b) {
    var month = b.month;
    var courses = b.courses;
    if (feeView.course && !courses.some(function (c) { return c.id === feeView.course; })) feeView.course = '';
    var cname = function (c) { return c.name + ' · ' + c.grade; };
    var enrolled = function (c) { return c.students.filter(function (s) { return !s.left; }); };
    var paidOf = function (c) { return enrolled(c).filter(function (s) { return s.paid; }).length; };

    var statsBox = h('div', { class: 'stats' });
    var classBody = h('tbody');
    var listBox = h('div');
    var courseChips = h('div', { class: 'chips filter' });
    var statusChips = h('div', { class: 'chips filter' });
    var search = h('input', { type: 'search', placeholder: 'Tìm học sinh…' });
    search.addEventListener('input', drawList);

    function drawStats() {
      var total = 0;
      var paid = 0;
      courses.forEach(function (c) { total += enrolled(c).length; paid += paidOf(c); });
      fill(statsBox,
        h('div', { class: 'stat' }, h('strong', null, String(b.activeStudents)), h('span', null, 'Học sinh đang học')),
        h('div', { class: 'stat' }, h('strong', null, String(total)), h('span', null, 'Lượt ghi danh (1 em học 2 lớp = 2)')),
        h('div', { class: 'stat' }, h('strong', null, paid + '/' + total), h('span', null, 'Lượt đã đóng ' + monthLabel(month).toLowerCase())),
        h('div', { class: 'stat' + (total - paid ? ' warn' : '') }, h('strong', null, String(total - paid)), h('span', null, 'Lượt chưa đóng')));
      fill(classBody, courses.map(function (c) {
        var n = enrolled(c).length;
        var p = paidOf(c);
        return h('tr', { class: 'click-row' + (feeView.course === c.id ? ' sel' : ''), onclick: function () { feeView.course = feeView.course === c.id ? '' : c.id; drawStats(); drawChips(); drawList(); } },
          h('td', { 'data-label': 'Lớp' }, h('strong', null, cname(c))),
          h('td', { class: 'col-teacher' }, c.teachers.length ? c.teachers.join(', ') : h('span', { class: 'muted' }, '—')),
          h('td', { 'data-label': 'Học sinh', class: 'num' }, String(n), c.inactive ? h('span', { class: 'muted small' }, ' (+' + c.inactive + ' khóa)') : null),
          h('td', { 'data-label': 'Đã đóng', class: 'num' }, h('span', { class: 'ok' }, String(p))),
          h('td', { 'data-label': 'Chưa đóng', class: 'num' }, n - p ? h('span', { class: 'pill p-todo' }, String(n - p)) : h('span', { class: 'muted' }, '0')));
      }));
    }

    function drawChips() {
      fill(courseChips, [['', 'Tất cả lớp']].concat(courses.map(function (c) { return [c.id, cname(c)]; })).map(function (f) {
        return h('button', { class: 'chip-btn' + (feeView.course === f[0] ? ' active' : ''), onclick: function () { feeView.course = f[0]; drawStats(); drawChips(); drawList(); } }, f[1]);
      }));
      fill(statusChips, [['all', 'Tất cả'], ['unpaid', 'Chưa đóng'], ['paid', 'Đã đóng']].map(function (f) {
        return h('button', { class: 'chip-btn' + (feeView.status === f[0] ? ' active' : ''), onclick: function () { feeView.status = f[0]; drawChips(); drawList(); } }, f[1]);
      }));
    }

    function shown(c) {
      var q = search.value.trim().toLowerCase();
      return c.students.filter(function (s) {
        if (feeView.status === 'paid' && !s.paid) return false;
        if (feeView.status === 'unpaid' && s.paid) return false;
        return !q || s.fullName.toLowerCase().indexOf(q) >= 0 || s.username.indexOf(q) >= 0;
      });
    }

    function drawList() {
      var groups = courses.filter(function (c) { return !feeView.course || c.id === feeView.course; });
      var any = false;
      fill(listBox, groups.map(function (c) {
        var list = shown(c);
        if (!list.length && (search.value.trim() || feeView.status !== 'all' || !feeView.course)) return null;
        any = true;
        var n = enrolled(c).length;
        return h('div', { class: 'panel fee-group' },
          h('div', { class: 'fee-group-head' },
            h('h3', null, cname(c)),
            h('span', { class: 'muted small' }, n + ' học sinh · ' + paidOf(c) + ' đã đóng')),
          list.length ? h('div', { class: 'fee-list' }, list.map(function (s) { return feeRow(c, s); }))
            : h('p', { class: 'muted' }, n ? 'Không có học sinh phù hợp.' : 'Lớp chưa có học sinh.'));
      }), any ? null : h('div', { class: 'panel empty' }, h('p', { class: 'muted' }, feeView.status === 'unpaid' ? '🎉 Tất cả đã đóng học phí ' + monthLabel(month).toLowerCase() + '.' : 'Không có học sinh phù hợp.')));
    }

    function feeRow(c, s) {
      var btn = h('button', { type: 'button', class: 'fee-btn' + (s.paid ? ' paid' : '') + (s.saving ? ' saving' : ''), title: s.saving ? 'Đang lưu…' : '' },
        s.paid ? '✓ Đã đóng' + (s.paidAt ? ' · ' + shortDate(s.paidAt) : '') : 'Chưa đóng');
      btn.addEventListener('click', function () {
        if (s.paid) return editPaid(c, s);
        save(c, s, { paid: true });
      });
      return h('div', { class: 'fee-row' + (s.left ? ' left' : '') },
        h('div', { class: 'fee-name' },
          h('strong', null, s.fullName),
          h('span', { class: 'muted small' }, s.username,
            s.left ? h('span', { class: 'pill p-wait' }, 'đã nghỉ / khóa') : null,
            s.note ? h('span', { class: 'fee-note' }, '· ' + s.note) : null)),
        btn);
    }

    /** Đổi ngay trên màn hình; lưu lên máy chủ ở phía sau (gộp nhiều lần bấm). */
    function save(c, s, change) {
      feeSync.add(month, c, s, change);
      drawStats();
      drawList();
    }

    function editPaid(c, s) {
      var note = h('input', { value: s.note || '', maxlength: '200', placeholder: 'vd: chuyển khoản, tiền mặt, giảm 50%…' });
      modal(s.fullName + ' · ' + cname(c), h('div', { class: 'form' },
        h('p', null, 'Đã đóng học phí ' + monthLabel(month).toLowerCase() + (s.paidAt ? ' (ghi nhận ' + fmtDate(s.paidAt) + ')' : '') + '.'),
        field('Ghi chú', note)), function (close) {
        var undo = h('button', { class: 'btn btn-ghost danger-text' }, 'Bỏ đánh dấu (chưa đóng)');
        var ok = h('button', { class: 'btn' }, 'Lưu ghi chú');
        undo.addEventListener('click', function () { close(); save(c, s, { paid: false }); });
        ok.addEventListener('click', function () { close(); save(c, s, { paid: true, note: note.value }); });
        return [undo, ok];
      });
    }

    function unpaidText() {
      var lines = ['Danh sách chưa đóng học phí ' + monthLabel(month).toLowerCase()];
      courses.forEach(function (c) {
        if (feeView.course && c.id !== feeView.course) return;
        var list = enrolled(c).filter(function (s) { return !s.paid; });
        if (!list.length) return;
        lines.push('', cname(c) + ' (' + list.length + ' em):');
        list.forEach(function (s, i) { lines.push((i + 1) + '. ' + s.fullName); });
      });
      return lines.length > 1 ? lines.join('\n') : '';
    }

    function csv() {
      var esc = function (v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var rows = [['Lớp', 'Khối', 'Họ tên', 'Tên đăng nhập', 'Tháng', 'Trạng thái', 'Ngày ghi nhận', 'Ghi chú']];
      courses.forEach(function (c) {
        if (feeView.course && c.id !== feeView.course) return;
        c.students.forEach(function (s) {
          rows.push([c.name, c.grade, s.fullName, s.username, monthLabel(month), s.paid ? 'Đã đóng' : 'Chưa đóng', s.paidAt ? fmtDate(s.paidAt) : '', (s.left ? '(đã nghỉ) ' : '') + (s.note || '')]);
        });
      });
      var text = '﻿' + rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n');
      saveBlob('hoc-phi-' + month + '.csv', new Blob([text], { type: 'text/csv;charset=utf-8' }));
    }

    var monthBar = h('div', { class: 'month-bar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Tháng trước', onclick: function () { go('#/hoc-phi/' + shiftMonth(month, -1)); } }, '‹'),
      h('strong', { class: 'month-name' }, monthLabel(month)),
      h('button', { class: 'icon-btn', 'aria-label': 'Tháng sau', onclick: function () { go('#/hoc-phi/' + shiftMonth(month, 1)); } }, '›'),
      month !== b.today ? h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { go('#/hoc-phi/' + b.today); } }, 'Về tháng này') : null);

    feeSync.view = { redraw: function () { drawStats(); drawList(); } };
    fill(app,
      h('div', { class: 'page-head' }, h('h1', null, 'Thống kê & học phí'),
        h('p', { class: 'muted' }, 'Sĩ số từng lớp và danh sách đóng học phí theo tháng. Bấm "Chưa đóng" để đánh dấu đã đóng.')),
      monthBar,
      statsBox,
      h('h2', { class: 'section-title' }, 'Sĩ số từng lớp'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table class-table' },
        h('thead', null, h('tr', null, h('th', null, 'Lớp'), h('th', { class: 'col-teacher' }, 'Giáo viên'), h('th', { class: 'num' }, 'Học sinh'), h('th', { class: 'num' }, 'Đã đóng'), h('th', { class: 'num' }, 'Chưa đóng'))),
        classBody)),
      h('p', { class: 'muted small' }, 'Chỉ đếm tài khoản học sinh đang mở; tài khoản bị khóa ghi riêng trong ngoặc. Bấm vào một lớp để xem danh sách lớp đó.'),
      h('div', { class: 'section-row' },
        h('h2', { class: 'section-title' }, 'Danh sách đóng học phí'),
        h('div', { class: 'add-bar' },
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { var t = unpaidText(); if (t) copy(t); else toast('Không có ai chưa đóng.', 'success'); } }, 'Sao chép DS chưa đóng'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: csv }, 'Tải bảng (Excel)'))),
      h('div', { class: 'toolbar' }, search),
      courseChips,
      statusChips,
      listBox);
    drawStats();
    drawChips();
    drawList();
  }

  /** Trang chủ học sinh: học phí tháng này của em. Trang chủ admin: tóm tắt cả trung tâm. */
  function renderFeeBox(box, d) {
    if (d.fees && d.fees.length) {
      var month = d.fees[0].month;
      var unpaid = d.fees.filter(function (f) { return !f.paid; }).length;
      fill(box, h('div', { class: 'panel fee-mine' + (unpaid ? ' fee-due' : '') },
        h('div', { class: 'fee-group-head' },
          h('h3', null, 'Học phí ' + monthLabel(month).toLowerCase()),
          h('span', { class: 'muted small' }, unpaid ? 'Em nhắc bố mẹ giúp thầy nhé.' : 'Cảm ơn em và gia đình!')),
        h('div', { class: 'fee-list' }, d.fees.map(function (f) {
          return h('div', { class: 'fee-row' },
            h('div', { class: 'fee-name' }, h('strong', null, f.courseName), h('span', { class: 'muted small' }, f.courseGrade)),
            f.paid ? h('span', { class: 'pill p-done' }, '✓ Đã đóng') : h('span', { class: 'pill p-todo' }, 'Chưa đóng'));
        }))));
    } else if (d.feeSummary) {
      var s = d.feeSummary;
      fill(box, h('a', { class: 'task fee-summary', href: '#/hoc-phi' },
        h('span', { class: 'kind k-fee' }, 'HỌC PHÍ'),
        h('div', { class: 'task-main' }, h('strong', null, monthLabel(s.month) + ': ' + s.paid + '/' + s.total + ' lượt đã đóng'),
          h('span', { class: 'muted small' }, s.activeStudents + ' học sinh đang học · bấm để xem sĩ số và danh sách')),
        s.total - s.paid ? h('span', { class: 'pill p-todo' }, (s.total - s.paid) + ' chưa đóng') : h('span', { class: 'pill p-done' }, 'Đủ')));
    }
  }

  function renderUsers() {
    fill(app, loading());
    Promise.all([api('users'), getCourses()]).then(function (res) {
      drawUsers(res[0].users, res[1]);
    }, function (e) { fill(app, errorBox(e.message, renderUsers)); });
  }

  function courseChecks(courses, selected) {
    return h('div', { class: 'checks' }, courses.map(function (c) {
      var on = selected.indexOf(c.id) >= 0;
      var inp = h('input', { type: 'checkbox', value: c.id, checked: on });
      var lbl = h('label', { class: 'check' + (on ? ' checked' : '') },
        inp,
        c.name + ' ' + c.grade.replace('Lớp ', 'L'));
      inp.addEventListener('change', function () { lbl.classList.toggle('checked', inp.checked); });
      return lbl;
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

  window.TTM = {
    app: app,
    h: h,
    fill: fill,
    append: append,
    toast: toast,
    busy: busy,
    loading: loading,
    errorBox: errorBox,
    modal: modal,
    confirmBox: confirmBox,
    api: api,
    go: go,
    route: route,
    setLeaveGuard: setLeaveGuard,
    qImageEl: qImageEl,
    copy: copy,
    fmtScore: fmtScore,
    store: store,
    getMe: function () { return me; },
    getSeq: function () { return routeSeq; },
    isCurrent: function (seq) { return seq === routeSeq; }
  };

  route();
  setTimeout(fileCache.prune, 8000);
})();
