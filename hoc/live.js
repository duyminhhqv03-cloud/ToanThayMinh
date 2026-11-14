/* Lớp học trực tiếp – Toán Thầy Minh
 * Học qua Google Meet (tiếng, camera, chia sẻ màn hình); web lo điểm danh, hỏi nhanh (cả câu trên bảng), xung phong, hỏi bài.
 * Điểm danh do máy chủ (Code.gs) ghi; phần thời gian thực chạy trên Firebase live/<mã bí mật 16 ký tự>.
 * Đáp án câu hỏi nhanh chỉ nằm trên máy thầy cho tới khi thầy bấm "Hiện đáp án".
 */
(function () {
  'use strict';

  var LETTERS = 'ABCDEFGH';
  var DURATIONS = [15, 30, 60, 90, 120, 180, 300];
  function durLabel(s) { return s % 60 ? s + ' giây' : (s / 60) + ' phút'; }
  // "Câu trên bảng": đề nằm trên màn hình thầy chia sẻ, chỉ gửi khung trả lời.
  var BOARD_TEXT = 'Câu thầy đang hỏi trên bảng';
  var BOARD_KINDS = [
    { k: 'abcd', label: 'A B C D', type: 'mc', options: ['', '', '', ''] },
    { k: 'abc', label: 'A B C', type: 'mc', options: ['', '', ''] },
    { k: 'ds', label: 'Đúng / Sai', type: 'mc', options: ['Đúng', 'Sai'] },
    { k: 'num', label: 'Đáp số', type: 'short' }
  ];
  var MOOD_WINDOW = 2 * 60 * 1000; // "Chưa hiểu / Hiểu rồi" tính trong 2 phút gần nhất

  function T() { return window.TTM; }
  function serverNow() { return window.TTMGame && window.TTMGame.serverNow ? window.TTMGame.serverNow() : Date.now(); }
  function TS() { return window.firebase.database.ServerValue.TIMESTAMP; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(t) {
    var d = new Date(typeof t === 'number' ? t : String(t || ''));
    return isNaN(d.getTime()) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dmy(t) {
    var d = new Date(t);
    return isNaN(d.getTime()) ? '' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function keys(o) { return o ? Object.keys(o) : []; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }

  function ensureFirebase() {
    if (!window.TTMGame || !window.TTMGame.ensureFirebase) return Promise.reject(new Error('Chưa tải được phần thời gian thực. Tải lại trang (Cmd+Shift+R).'));
    return window.TTMGame.ensureFirebase();
  }

  /** Listener Firebase + đồng hồ, tự dọn khi rời trang. */
  function createTracker(seq) {
    var subs = [];
    var timers = [];
    var cleaned = false;
    var alive = function () { return !cleaned && window.TTM.isCurrent(seq); };
    return {
      alive: alive,
      on: function (ref, fn) {
        var w = function (snap) { if (alive()) fn(snap); };
        ref.on('value', w);
        subs.push({ ref: ref, fn: w });
        return function () { try { ref.off('value', w); } catch (e) { /* bỏ qua */ } };
      },
      every: function (fn, ms) {
        var id = setInterval(function () { if (!alive()) { clearInterval(id); return; } fn(); }, ms);
        timers.push(id);
        return id;
      },
      cleanup: function () {
        if (cleaned) return;
        cleaned = true;
        subs.forEach(function (s) { try { s.ref.off('value', s.fn); } catch (e) { /* bỏ qua */ } });
        timers.forEach(function (id) { clearInterval(id); });
        subs = [];
        timers = [];
      }
    };
  }

  /** Câu hỏi hiển thị (phân số, xuống dòng a) b)…). */
  function qText(text) {
    var t = T();
    return t.qNodes ? t.qNodes(text || '') : String(text || '');
  }
  function optLabel(item, i) {
    var o = (item.options || [])[i] || '';
    return LETTERS.charAt(i) + (o ? '. ' + o : '');
  }
  /** Thầy đã đặt đáp án đúng chưa (câu trên bảng có thể chọn đáp án sau khi xem kết quả). */
  function hasKey(item) {
    if (item.type === 'mc') return typeof item.correct === 'number' && item.correct >= 0;
    return !!(item.answers && item.answers.length);
  }
  function rightText(item) {
    if (!hasKey(item)) return '';
    if (item.type === 'mc') return optLabel(item, item.correct);
    return (item.answers || []).join(' | ');
  }

  /* ─────────────── Tiếng "bíp" + tiêu đề nhấp nháy khi học sinh đang ở cửa sổ Meet ─────────────── */
  var blink = { id: null, orig: '' };
  function stopBlink() {
    if (blink.id) { clearInterval(blink.id); blink.id = null; document.title = blink.orig; }
  }
  function notifyHidden(msg) {
    if (!document.hidden) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ctx = new AC();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(function () { try { o.stop(); ctx.close(); } catch (e) { /* bỏ qua */ } }, 250);
      }
    } catch (e) { /* trình duyệt chặn âm thanh: bỏ qua */ }
    if (blink.id) return;
    blink.orig = document.title;
    var on = false;
    blink.id = setInterval(function () {
      if (!document.hidden) { stopBlink(); return; }
      on = !on;
      document.title = on ? '❗ ' + msg : blink.orig;
    }, 1000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) stopBlink(); });

  /** Lỗi Firebase "permission_denied" thường là do luật mới chưa được dán lên Firebase Console. */
  function friendly(e, dflt) {
    var m = (e && e.message) || '';
    if (/permission[_ ]denied/i.test(m)) return 'Lớp học trực tiếp chưa được bật trên Firebase (luật bảo mật chưa cập nhật). Thầy dán luật mới ở Firebase Console rồi thử lại.';
    if (/Yêu cầu không hợp lệ/.test(m)) return 'Máy chủ chưa được cập nhật bản mới (Code.gs). Thầy dán Code.gs mới và triển khai rồi thử lại.';
    return m || dflt;
  }

  function missingConfig(backHref) {
    var t = T();
    t.fill(t.app,
      t.h('a', { href: backHref, class: 'back' }, '← Quay lại'),
      t.errorBox('Chức năng thời gian thực chưa được cài đặt (thiếu FIREBASE_CONFIG trong hoc/config.js).'));
  }
  function hasConfig() {
    var c = window.FIREBASE_CONFIG;
    return !!(c && typeof c === 'object' && c.apiKey && c.databaseURL);
  }

  /* ═══════════════════════════════ Màn hình thầy ═══════════════════════════════ */

  function renderHost(courseId) {
    var t = T();
    var h = t.h;
    var backHref = '#/khoa/' + encodeURIComponent(courseId);
    if (!hasConfig()) return missingConfig(backHref);
    var seq = t.getSeq();
    var tr = createTracker(seq);
    t.setLeaveGuard(function () { return false; }, '', tr.cleanup);
    t.fill(t.app, t.loading('Đang mở lớp học trực tiếp…'));

    var course = null;
    var quizzes = [];
    var session = null;
    var ref = null;
    var st = { members: {}, presence: {}, reactions: {}, question: null, answers: {}, att: [], students: [] };
    var item = null;        // câu đang hỏi (có đáp án, chỉ ở máy thầy)
    var revealed = false;
    var stopAnswers = null;
    var ended = false;

    Promise.all([t.api('liveStart', { courseId: courseId }), t.api('course', { courseId: courseId }), ensureFirebase()]).then(function (res) {
      if (!tr.alive()) return;
      session = res[0].session;
      course = res[1].course || { id: courseId, name: '' };
      quizzes = (res[1].quizzes || []).slice();
      var fb = res[2];
      ref = fb.db.ref('live/' + session.code);
      return ref.child('host').once('value').then(function (snap) {
        var host = snap.val();
        if (host && host !== fb.uid) {
          throw new Error('Buổi học này đang được mở trên một máy hoặc trình duyệt khác. Mở lại trên máy đó, hoặc bấm "Kết thúc buổi" ở đó rồi bắt đầu lại.');
        }
        if (!host) return ref.set({ host: fb.uid, courseId: courseId, startedAt: TS() });
      }).then(function () {
        if (!tr.alive()) return;
        item = lsGet('ttm_live_item_' + session.code);
        build();
      });
    }).catch(function (e) {
      if (!tr.alive()) return;
      t.fill(t.app, h('a', { href: backHref, class: 'back' }, '← Quay lại lớp'), t.errorBox(friendly(e, 'Không mở được lớp học trực tiếp.')));
    });

    function build() {
      var statBox = h('div', { class: 'live-stats' });
      var handBox = h('div', { class: 'live-hands' });
      var moodBox = h('div', { class: 'live-moods' });
      var askBox = h('div', { class: 'live-ask' });
      var endBtn = h('button', { class: 'btn btn-danger btn-sm' }, 'Kết thúc buổi học');
      endBtn.addEventListener('click', function () {
        t.confirmBox('Kết thúc buổi học?', 'Học sinh sẽ thấy buổi học đã kết thúc. Danh sách điểm danh vẫn được lưu.', 'Kết thúc', endSession);
      });

      t.fill(t.app,
        h('a', { href: backHref, class: 'back' }, '← ' + (course.name || 'Lớp') + (course.grade ? ' · ' + course.grade : '')),
        h('div', { class: 'live-head' },
          h('div', null,
            h('h1', null, '🎥 Lớp học trực tiếp'),
            h('p', { class: 'muted small' }, 'Bắt đầu lúc ' + hhmm(session.startedAt) + ' · Thầy vẫn dạy, chia sẻ màn hình trên Google Meet như thường')),
          endBtn),
        statBox,
        h('div', { class: 'live-grid' },
          h('section', { class: 'panel live-panel' }, h('h2', { class: 'live-h2' }, '❓ Hỏi nhanh'), askBox),
          h('section', { class: 'panel live-panel' },
            h('h2', { class: 'live-h2' }, '🙋 Học sinh muốn nói'), handBox, moodBox)));

      function nameOf(uid) { var m = st.members[uid]; return m ? m.name : 'Học sinh'; }
      function online(uid) { return !!st.presence[uid]; }
      function studentUids() { return keys(st.members); }

      function drawStats() {
        var nOnline = keys(st.presence).length;
        var joined = st.att.length;
        var total = st.students.length;
        var listBtn = h('button', { class: 'btn btn-ghost btn-sm' }, 'Xem danh sách');
        listBtn.addEventListener('click', showList);
        t.fill(statBox,
          h('span', { class: 'live-stat' }, h('b', null, String(nOnline)), ' em đang trong lớp'),
          h('span', { class: 'live-stat' }, h('b', null, joined + (total ? '/' + total : '')), ' em đã điểm danh'),
          listBtn);
      }

      function showList() {
        var byUser = {};
        st.att.forEach(function (a) { byUser[a.username] = a; });
        var onlineUsers = {};
        keys(st.presence).forEach(function (uid) { var m = st.members[uid]; if (m) onlineUsers[m.username] = true; });
        var present = st.att.slice().sort(function (a, b) { return String(a.joinedAt).localeCompare(String(b.joinedAt)); });
        var absent = st.students.filter(function (s) { return !byUser[s.username]; });
        t.modal('Điểm danh', h('div', { class: 'live-list' },
          h('h4', null, 'Đã vào (' + present.length + ')'),
          present.length ? h('ul', null, present.map(function (a) {
            return h('li', null, h('span', { class: 'live-dot' + (onlineUsers[a.username] ? ' on' : '') }), a.fullName || a.username,
              h('span', { class: 'muted small' }, ' · vào lúc ' + hhmm(a.joinedAt) + (onlineUsers[a.username] ? '' : ' · đã thoát')));
          })) : h('p', { class: 'muted small' }, 'Chưa em nào vào lớp.'),
          h('h4', null, 'Chưa vào (' + absent.length + ')'),
          absent.length ? h('ul', null, absent.map(function (s) { return h('li', null, s.fullName || s.username); })) : h('p', { class: 'muted small' }, 'Cả lớp đã vào.')),
          function (close) {
            return [h('button', { class: 'btn btn-ghost', onclick: function () { t.copy(attendanceText(present, absent), 'Đã sao chép danh sách điểm danh.'); } }, 'Sao chép danh sách'),
              h('button', { class: 'btn', onclick: close }, 'Đóng')];
          });
      }

      function attendanceText(present, absent) {
        var lines = ['Điểm danh ' + (course.name || '') + (course.grade ? ' ' + course.grade : '') + ' – ' + dmy(session.startedAt) + ' ' + hhmm(session.startedAt)];
        lines.push('Có mặt (' + present.length + '):');
        present.forEach(function (a, i) { lines.push((i + 1) + '. ' + (a.fullName || a.username) + ' (' + hhmm(a.joinedAt) + ')'); });
        lines.push('Vắng (' + absent.length + '):');
        absent.forEach(function (s, i) { lines.push((i + 1) + '. ' + (s.fullName || s.username)); });
        return lines.join('\n');
      }

      function drawReactions() {
        function rx(uid) { return st.reactions[uid] || {}; }
        var hands = keys(st.reactions).filter(function (uid) { return rx(uid).hand; })
          .sort(function (a, b) { return (rx(a).handAt || rx(a).t || 0) - (rx(b).handAt || rx(b).t || 0); });
        var asks = keys(st.reactions).filter(function (uid) { return typeof rx(uid).ask === 'string'; })
          .sort(function (a, b) { return (rx(a).askAt || rx(a).t || 0) - (rx(b).askAt || rx(b).t || 0); });
        var lowerAll = hands.length > 1 ? h('button', { class: 'btn btn-ghost btn-sm' }, 'Hạ tất cả') : null;
        if (lowerAll) lowerAll.addEventListener('click', function () {
          var u = {};
          hands.forEach(function (uid) { u[uid + '/hand'] = null; u[uid + '/handAt'] = null; });
          ref.child('reactions').update(u);
        });
        var clearAsks = asks.length > 1 ? h('button', { class: 'btn btn-ghost btn-sm' }, 'Xóa tất cả câu hỏi') : null;
        if (clearAsks) clearAsks.addEventListener('click', function () {
          var u = {};
          asks.forEach(function (uid) { u[uid + '/ask'] = null; u[uid + '/askAt'] = null; });
          ref.child('reactions').update(u);
        });
        t.fill(handBox,
          h('h4', { class: 'live-h4' }, '🙋 Xung phong trả lời (' + hands.length + ')'),
          hands.length ? h('ol', { class: 'live-hand-list' }, hands.map(function (uid) {
            var lower = h('button', { class: 'chip-btn' }, 'Đã gọi');
            lower.addEventListener('click', function () { ref.child('reactions/' + uid).update({ hand: null, handAt: null }); });
            return h('li', null, h('b', null, nameOf(uid)), h('span', { class: 'muted small' }, ' · ' + hhmm(rx(uid).handAt || rx(uid).t)), lower);
          })) : h('p', { class: 'muted small' }, 'Chưa em nào xung phong.'),
          lowerAll,
          h('h4', { class: 'live-h4' }, '❓ Muốn hỏi bài (' + asks.length + ')'),
          asks.length ? h('ol', { class: 'live-hand-list' }, asks.map(function (uid) {
            var done = h('button', { class: 'chip-btn' }, 'Đã trả lời');
            done.addEventListener('click', function () { ref.child('reactions/' + uid).update({ ask: null, askAt: null }); });
            var txt = rx(uid).ask;
            return h('li', null, h('b', null, nameOf(uid)), h('span', { class: 'muted small' }, ' · ' + hhmm(rx(uid).askAt || rx(uid).t)), done,
              txt ? h('div', { class: 'live-ask-text prewrap' }, txt) : h('div', { class: 'muted small' }, '(muốn hỏi trực tiếp)'));
          })) : h('p', { class: 'muted small' }, 'Chưa em nào hỏi.'),
          clearAsks);

        var cut = serverNow() - MOOD_WINDOW;
        var conf = [];
        var ok = [];
        keys(st.reactions).forEach(function (uid) {
          var r = st.reactions[uid];
          if (!r || !r.mood || !(r.moodAt > cut)) return;
          (r.mood === 'confused' ? conf : ok).push(nameOf(uid));
        });
        var clear = (conf.length || ok.length) ? h('button', { class: 'btn btn-ghost btn-sm' }, 'Xóa phản hồi') : null;
        if (clear) clear.addEventListener('click', function () {
          var u = {};
          keys(st.reactions).forEach(function (uid) { if (st.reactions[uid] && st.reactions[uid].mood) { u[uid + '/mood'] = null; u[uid + '/moodAt'] = null; } });
          ref.child('reactions').update(u);
        });
        t.fill(moodBox,
          h('p', { class: 'live-mood' + (conf.length ? ' warn' : '') }, '🤔 Chưa hiểu: ', h('b', null, String(conf.length)), conf.length ? ' – ' + conf.join(', ') : ''),
          h('p', { class: 'live-mood' }, '👍 Hiểu rồi: ', h('b', null, String(ok.length)), ok.length ? ' – ' + ok.join(', ') : ''),
          h('p', { class: 'muted small' }, 'Tính trong 2 phút gần nhất.'),
          clear);
      }

      /* ── Hỏi nhanh ── */
      var mode = 'board';
      var durSel = h('select', { class: 'live-dur' }, DURATIONS.map(function (s) { return h('option', { value: String(s), selected: s === 30 }, durLabel(s)); }));
      var timerId = null;

      function questionOpen() {
        var q = st.question;
        return !!(q && item && q.qid === item.qid && serverNow() < Number(q.startedAt || 0) + Number(q.duration || 0) * 1000);
      }

      function drawAsk() {
        if (timerId) { clearInterval(timerId); timerId = null; }
        if (item && st.question && st.question.qid === item.qid) return drawActive();
        drawComposer();
      }

      function drawComposer() {
        var tabBoard = h('button', { class: 'chip-btn' + (mode === 'board' ? ' active' : '') }, 'Câu trên bảng');
        var tabType = h('button', { class: 'chip-btn' + (mode === 'type' ? ' active' : '') }, 'Gõ câu hỏi');
        var tabQuiz = h('button', { class: 'chip-btn' + (mode === 'quiz' ? ' active' : '') }, 'Lấy từ bài luyện tập');
        tabBoard.addEventListener('click', function () { mode = 'board'; drawComposer(); });
        tabType.addEventListener('click', function () { mode = 'type'; drawComposer(); });
        tabQuiz.addEventListener('click', function () { mode = 'quiz'; drawComposer(); });
        t.fill(askBox, h('div', { class: 'chips' }, tabBoard, tabType, tabQuiz),
          mode === 'board' ? boardForm() : mode === 'type' ? typeForm() : quizPicker());
      }

      /* Câu trên bảng: đề đang chiếu trên Meet, chỉ gửi khung trả lời (A B C D / Đúng Sai / Đáp số).
       * Đáp án đúng không bắt buộc – thầy có thể chọn sau khi xem kết quả. */
      var boardKind = 'abcd';
      function boardForm() {
        var note = h('input', { type: 'text', maxlength: '200', placeholder: 'Ghi chú (không bắt buộc), ví dụ: Bài 42' });
        var ans = h('input', { type: 'text', placeholder: 'Đáp số đúng (không bắt buộc), ví dụ: 50000000' });
        var right = -1;
        var kindRow = h('div', { class: 'chips live-kinds' });
        var rightBox = h('div', { class: 'live-row live-right' });
        function kindOf() { return BOARD_KINDS.filter(function (x) { return x.k === boardKind; })[0] || BOARD_KINDS[0]; }
        function drawKinds() {
          t.fill(kindRow, BOARD_KINDS.map(function (x) {
            var b = h('button', { class: 'chip-btn live-kind' + (x.k === boardKind ? ' active' : '') }, x.label);
            b.addEventListener('click', function () { boardKind = x.k; right = -1; drawKinds(); drawRight(); });
            return b;
          }));
        }
        function drawRight() {
          var kd = kindOf();
          if (kd.type === 'short') { t.fill(rightBox, ans); return; }
          var chips = [-1].concat(kd.options.map(function (o, i) { return i; })).map(function (i) {
            var b = h('button', { class: 'chip-btn' + (i === right ? ' active' : '') }, i < 0 ? 'Chưa chọn' : optLabel(kd, i));
            b.addEventListener('click', function () { right = i; drawRight(); });
            return b;
          });
          t.fill(rightBox, h('span', { class: 'small muted' }, 'Đáp án đúng:'), chips);
        }
        drawKinds();
        drawRight();
        var send = h('button', { class: 'btn' }, 'Gửi cho cả lớp');
        send.addEventListener('click', function () {
          var kd = kindOf();
          var n = note.value.trim();
          var txt = BOARD_TEXT + (n ? ' – ' + n : '');
          if (kd.type === 'mc') {
            sendItem({ type: 'mc', text: txt, options: kd.options.slice(), correct: right, board: true }, send);
          } else {
            var list = ans.value.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
            sendItem({ type: 'short', text: txt, answers: list, board: true }, send);
          }
        });
        return h('div', { class: 'form live-form' },
          h('p', { class: 'muted small' }, 'Học sinh nhìn đề trên màn hình thầy chia sẻ, chỉ bấm chọn hoặc gõ đáp số. Đáp án đúng có thể chọn sau khi xem kết quả.'),
          kindRow, rightBox, h('div', { class: 'live-row' }, note, durSel), h('div', { class: 'live-row' }, send));
      }

      function typeForm() {
        var text = h('textarea', { rows: '3', placeholder: 'Ví dụ: 15% của 200 là bao nhiêu?' });
        var kind = h('select', null, h('option', { value: 'mc' }, 'Trắc nghiệm'), h('option', { value: 'short' }, 'Trả lời ngắn'));
        var optInputs = [0, 1, 2, 3].map(function (i) { return h('input', { type: 'text', placeholder: 'Lựa chọn ' + LETTERS.charAt(i) }); });
        var rightSel = h('select', null, [0, 1, 2, 3].map(function (i) { return h('option', { value: String(i) }, 'Đáp án đúng: ' + LETTERS.charAt(i)); }));
        var ans = h('input', { type: 'text', placeholder: 'Đáp án đúng, ví dụ: 30 (nhiều đáp án cách nhau bằng |)' });
        var mcBox = h('div', { class: 'live-opts' }, optInputs.map(function (inp, i) { return h('label', { class: 'live-opt' }, h('b', null, LETTERS.charAt(i)), inp); }), rightSel);
        var shortBox = h('div', { hidden: true }, ans);
        kind.addEventListener('change', function () { mcBox.hidden = kind.value !== 'mc'; shortBox.hidden = kind.value === 'mc'; });
        var send = h('button', { class: 'btn' }, 'Gửi câu hỏi');
        send.addEventListener('click', function () {
          var txt = text.value.trim();
          if (!txt) return t.toast('Thầy nhập câu hỏi trước.', 'error');
          if (kind.value === 'mc') {
            var opts = [];
            var correct = -1;
            optInputs.forEach(function (inp, i) {
              var v = inp.value.trim();
              if (!v) return;
              if (i === Number(rightSel.value)) correct = opts.length;
              opts.push(v);
            });
            if (opts.length < 2) return t.toast('Cần ít nhất 2 lựa chọn.', 'error');
            if (correct < 0) return t.toast('Lựa chọn được đánh dấu đúng đang để trống.', 'error');
            sendItem({ type: 'mc', text: txt, options: opts, correct: correct }, send);
          } else {
            var list = ans.value.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
            if (!list.length) return t.toast('Thầy nhập đáp án đúng.', 'error');
            sendItem({ type: 'short', text: txt, answers: list }, send);
          }
        });
        return h('div', { class: 'form live-form' }, text, h('div', { class: 'live-row' }, kind, durSel), mcBox, shortBox, h('div', { class: 'live-row' }, send));
      }

      var quizState = { id: '', qs: null };
      function quizPicker() {
        var list = h('div', { class: 'live-qlist' });
        var sel = h('select', null, h('option', { value: '' }, quizzes.length ? '– Chọn bài luyện tập –' : 'Lớp chưa có bài luyện tập'),
          quizzes.map(function (q) { return h('option', { value: q.id, selected: q.id === quizState.id }, q.title + (q.gameOnly ? ' (chỉ để đấu)' : '')); }));
        var game = h('button', { class: 'btn btn-ghost btn-sm', hidden: !quizState.id }, '🎮 Đấu cả lớp với bài này');
        game.addEventListener('click', function () { if (quizState.id) t.go('#/dau-host/' + encodeURIComponent(quizState.id)); });
        function drawList() {
          if (!quizState.id) { t.fill(list); return; }
          if (!quizState.qs) { t.fill(list, t.loading('Đang tải câu hỏi…')); return; }
          t.fill(list, quizState.qs.length ? quizState.qs.map(function (q, i) {
            var usable = q.type === 'mc' || q.type === 'short';
            var b = h('button', { class: 'btn btn-sm' + (usable ? '' : ' btn-ghost'), disabled: !usable }, usable ? 'Gửi' : 'Không dùng được');
            if (usable) b.addEventListener('click', function () {
              sendItem({ type: q.type, text: q.text || '', options: q.options, correct: q.correct, answers: q.answers, hasImage: !!q.image }, b);
            });
            return h('div', { class: 'live-qitem' + (usable ? '' : ' off') },
              h('div', { class: 'live-qitem-text' }, h('b', null, 'Câu ' + (i + 1) + ' '), h('span', { class: 'prewrap' }, qText(q.text || ''))),
              b);
          }) : h('p', { class: 'muted small' }, 'Bài này chưa có câu hỏi.'));
        }
        sel.addEventListener('change', function () {
          quizState = { id: sel.value, qs: null };
          game.hidden = !sel.value;
          drawList();
          if (!sel.value) return;
          var want = sel.value;
          t.api('quiz', { id: want }).then(function (d) {
            if (quizState.id !== want) return;
            quizState.qs = d.fullQuestions || d.questions || [];
            drawList();
          }, function (e) { t.toast(e.message, 'error'); });
        });
        drawList();
        return h('div', { class: 'form live-form' }, h('div', { class: 'live-row' }, sel, durSel), game, list);
      }

      function sendItem(it, btn) {
        if (questionOpen()) return t.toast('Câu hỏi trước vẫn đang chạy. Bấm "Dừng sớm" trước.', 'error');
        var qid = 'q' + Date.now().toString(36);
        var dur = Number(durSel.value) || 30;
        var data = { qid: qid, type: it.type, text: String(it.text).slice(0, 5000), startedAt: TS(), duration: dur };
        if (it.type === 'mc') data.options = (it.options || []).map(function (o) { return String(o).slice(0, 1000); });
        if (it.hasImage) data.hasImage = true;
        var local = { qid: qid, type: it.type, text: data.text, options: data.options || null, correct: it.correct, answers: it.answers || [], hasImage: !!it.hasImage, board: !!it.board };
        if (btn) t.busy(btn, true);
        ref.child('reveal').remove().then(function () { return ref.child('question').set(data); }).then(function () {
          item = local;
          revealed = false;
          lsSet('ttm_live_item_' + session.code, item);
          watchAnswers();
          drawAsk();
        }, function (e) {
          if (btn) t.busy(btn, false);
          t.toast('Không gửi được câu hỏi: ' + e.message, 'error');
        });
      }

      function watchAnswers() {
        if (stopAnswers) stopAnswers();
        st.answers = {};
        if (!item) return;
        stopAnswers = tr.on(ref.child('answers/' + item.qid), function (snap) {
          st.answers = snap.val() || {};
          if (st.question && item && st.question.qid === item.qid) drawActiveBody();
        });
      }

      var activeBody = null;
      function drawActive() {
        activeBody = h('div', { class: 'live-active' });
        t.fill(askBox, activeBody);
        drawActiveBody();
        timerId = setInterval(function () {
          if (!tr.alive()) { clearInterval(timerId); return; }
          drawActiveBody();
        }, 1000);
      }

      function drawActiveBody() {
        if (!activeBody || !item || !st.question) return;
        var q = st.question;
        var left = Math.max(0, Math.ceil((Number(q.startedAt || 0) + Number(q.duration || 0) * 1000 - serverNow()) / 1000));
        var uids = studentUids();
        var answered = keys(st.answers).length;
        var head = h('div', { class: 'live-q' },
          h('div', { class: 'live-q-text prewrap' }, qText(item.text)),
          item.hasImage ? h('p', { class: 'muted small' }, '(Câu có hình – thầy chiếu hình trên Meet)') : null,
          item.type === 'mc' && !item.board ? h('ol', { class: 'live-q-opts' }, (item.options || []).map(function (o, i) {
            return h('li', { class: i === item.correct ? 'right' : '' }, h('b', null, LETTERS.charAt(i) + '. '), qText(o));
          })) : h('p', { class: 'small' }, 'Đáp án: ', hasKey(item) ? h('b', null, rightText(item)) : h('span', { class: 'muted' }, 'chưa chọn – thầy chọn sau khi xem kết quả')));
        if (left > 0) {
          var stop = h('button', { class: 'btn btn-ghost btn-sm' }, 'Dừng sớm');
          stop.addEventListener('click', function () {
            var el = Math.max(0, Math.floor((serverNow() - Number(q.startedAt || 0)) / 1000));
            ref.child('question/duration').set(el);
          });
          t.fill(activeBody, head,
            h('div', { class: 'live-timer' }, h('span', { class: 'live-clock' }, left + 's'),
              h('span', null, answered + '/' + uids.length + ' em đã trả lời'), stop));
          return;
        }
        if (timerId) { clearInterval(timerId); timerId = null; }
        t.fill(activeBody, head, results(uids));
      }

      function results(uids) {
        var right = 0;
        var rows = [];
        var notYet = uids.filter(function (uid) { return !st.answers[uid]; }).map(nameOf);
        var known = hasKey(item);
        // Câu chưa có đáp án: thầy bấm vào một dòng kết quả để chọn làm đáp án đúng.
        function markBtn(onPick) {
          if (known || revealed) return null;
          var b = h('button', { class: 'chip-btn live-mark', title: 'Chọn làm đáp án đúng' }, '✓ Đúng');
          b.addEventListener('click', function () {
            onPick();
            lsSet('ttm_live_item_' + session.code, item);
            drawActiveBody();
          });
          return b;
        }
        if (item.type === 'mc') {
          var by = {};
          keys(st.answers).forEach(function (uid) {
            var a = Number(st.answers[uid].a);
            (by[a] = by[a] || []).push(nameOf(uid));
            if (known && a === item.correct) right++;
          });
          var n = keys(st.answers).length || 1;
          rows = (item.options || []).map(function (o, i) {
            var names = by[i] || [];
            var pc = Math.round(names.length / n * 100);
            var isRight = known && i === item.correct;
            return h('div', { class: 'live-res' + (isRight ? ' right' : '') + (known || revealed ? '' : ' pick') },
              h('span', { class: 'live-res-k' }, LETTERS.charAt(i)),
              h('span', { class: 'live-bar' }, h('i', { style: 'width:' + pc + '%' })),
              h('span', { class: 'live-res-n' }, names.length + ' em'),
              markBtn(function () { item.correct = i; }),
              names.length && !isRight ? h('div', { class: 'live-res-names small' }, (o ? o + ': ' : '') + names.join(', ')) : null);
          });
        } else {
          var groups = {};
          var order = [];
          keys(st.answers).forEach(function (uid) {
            var raw = String(st.answers[uid].a || '');
            var k = raw.toLowerCase().replace(/\s+/g, ' ').trim();
            if (!groups[k]) { groups[k] = { raw: raw, names: [], ok: known && window.QuizFormat.isCorrect({ type: 'short', answers: item.answers }, raw) }; order.push(k); }
            groups[k].names.push(nameOf(uid));
            if (groups[k].ok) right++;
          });
          order.sort(function (a, b) { return groups[b].names.length - groups[a].names.length; });
          rows = order.map(function (k) {
            var g = groups[k];
            return h('div', { class: 'live-res' + (g.ok ? ' right' : '') + (known || revealed ? '' : ' pick') },
              h('span', { class: 'live-res-k' }, known ? (g.ok ? '✓' : '✗') : '•'),
              h('span', { class: 'live-res-ans' }, g.raw),
              h('span', { class: 'live-res-n' }, g.names.length + ' em'),
              markBtn(function () { item.answers = [g.raw]; }),
              g.ok ? null : h('div', { class: 'live-res-names small' }, g.names.join(', ')));
          });
        }
        var answered = keys(st.answers).length;
        if (!known) {
          return h('div', { class: 'live-results' },
            h('p', { class: 'live-sum' }, h('b', null, answered + '/' + uids.length), ' em đã trả lời. ',
              h('span', { class: 'muted small' }, answered ? 'Thầy bấm "✓ Đúng" ở dòng đúng để chấm.' : '')),
            rows.length ? rows : h('p', { class: 'muted small' }, 'Không em nào trả lời.'),
            notYet.length ? h('p', { class: 'small muted' }, 'Chưa trả lời (' + notYet.length + '): ' + notYet.join(', ')) : null,
            h('div', { class: 'live-row' }, nextBtn()));
        }
        var revealBtn = h('button', { class: 'btn btn-sm' + (revealed ? ' btn-ghost' : '') }, revealed ? '✓ Đã hiện đáp án' : 'Hiện đáp án cho lớp');
        revealBtn.addEventListener('click', function () {
          if (revealed) return;
          ref.child('reveal').set({ qid: item.qid, correct: item.type === 'mc' ? item.correct : String(rightText(item)).slice(0, 300) }).then(function () {
            revealed = true;
            drawActiveBody();
          }, function (e) { t.toast(e.message, 'error'); });
        });
        return h('div', { class: 'live-results' },
          h('p', { class: 'live-sum' }, h('b', null, right + '/' + answered), ' em trả lời đúng' + (answered ? ' (' + Math.round(right / answered * 100) + '%)' : '')),
          rows.length ? rows : h('p', { class: 'muted small' }, 'Không em nào trả lời.'),
          notYet.length ? h('p', { class: 'small muted' }, 'Chưa trả lời (' + notYet.length + '): ' + notYet.join(', ')) : null,
          h('div', { class: 'live-row' }, revealBtn, nextBtn()));
      }

      function nextBtn() {
        var next = h('button', { class: 'btn btn-ghost btn-sm' }, 'Câu hỏi mới');
        next.addEventListener('click', function () {
          item = null;
          lsSet('ttm_live_item_' + session.code, null);
          if (stopAnswers) { stopAnswers(); stopAnswers = null; }
          drawComposer();
        });
        return next;
      }

      /* ── Kết thúc buổi ── */
      function endSession() {
        return t.api('liveEnd', { sessionId: session.id }).then(function () {
          ended = true;
          lsSet('ttm_live_item_' + session.code, null);
          tr.cleanup();
          return ref.remove().catch(function () { /* phòng đã xóa */ });
        }).then(function () {
          return t.api('liveAttendance', { sessionId: session.id });
        }).then(function (d) {
          var byUser = {};
          (d.attendance || []).forEach(function (a) { byUser[a.username] = a; });
          var present = (d.attendance || []).slice().sort(function (a, b) { return String(a.joinedAt).localeCompare(String(b.joinedAt)); });
          var absent = (d.students || []).filter(function (s) { return !byUser[s.username]; });
          var copyBtn = h('button', { class: 'btn' }, 'Sao chép danh sách điểm danh');
          copyBtn.addEventListener('click', function () { t.copy(attendanceText(present, absent), 'Đã sao chép.'); });
          t.fill(t.app,
            h('a', { href: backHref, class: 'back' }, '← ' + (course.name || 'Lớp')),
            h('h1', null, 'Buổi học đã kết thúc'),
            h('section', { class: 'panel live-list' },
              h('h4', null, 'Có mặt (' + present.length + ')'),
              present.length ? h('ul', null, present.map(function (a) { return h('li', null, (a.fullName || a.username) + ' · ' + hhmm(a.joinedAt)); })) : h('p', { class: 'muted small' }, 'Không em nào vào lớp.'),
              h('h4', null, 'Vắng (' + absent.length + ')'),
              absent.length ? h('ul', null, absent.map(function (s) { return h('li', null, s.fullName || s.username); })) : h('p', { class: 'muted small' }, 'Không em nào vắng.'),
              copyBtn));
        });
      }

      /* ── Đồng bộ ── */
      var attTimer = null;
      function loadAttendance() {
        if (ended) return;
        t.api('liveAttendance', { sessionId: session.id }).then(function (d) {
          if (!tr.alive()) return;
          st.att = d.attendance || [];
          st.students = d.students || [];
          drawStats();
        }, function () { /* thử lại lần sau */ });
      }
      function scheduleAttendance() {
        if (attTimer) clearTimeout(attTimer);
        attTimer = setTimeout(loadAttendance, 2500);
      }

      tr.on(ref.child('members'), function (snap) {
        var before = keys(st.members).length;
        st.members = snap.val() || {};
        if (keys(st.members).length !== before) scheduleAttendance();
        drawStats();
        drawReactions();
      });
      tr.on(ref.child('presence'), function (snap) { st.presence = snap.val() || {}; drawStats(); });
      tr.on(ref.child('reactions'), function (snap) { st.reactions = snap.val() || {}; drawReactions(); });
      tr.on(ref.child('question'), function (snap) {
        var q = snap.val();
        var changed = !st.question || !q || st.question.qid !== q.qid;
        st.question = q;
        if (q && item && q.qid === item.qid && changed) watchAnswers();
        if (changed) drawAsk();
      });
      tr.on(ref.child('reveal'), function (snap) {
        var r = snap.val();
        revealed = !!(r && item && r.qid === item.qid);
      });
      tr.every(loadAttendance, 60000);
      tr.every(drawReactions, 15000);
      loadAttendance();
      drawStats();
      drawReactions();
      drawAsk();
    }
  }

  /* ═══════════════════════════════ Màn hình học sinh ═══════════════════════════════ */

  function renderStudent(courseId) {
    var t = T();
    var h = t.h;
    var backHref = '#/khoa/' + encodeURIComponent(courseId);
    if (!hasConfig()) return missingConfig(backHref);
    var seq = t.getSeq();
    var tr = createTracker(seq);
    var me = t.getMe() || {};
    var cleanupFb = null;
    t.setLeaveGuard(function () { return false; }, '', function () { tr.cleanup(); stopBlink(); if (cleanupFb) cleanupFb(); });
    t.fill(t.app, t.loading('Đang vào lớp…'));

    function waiting(msg) {
      var retry = h('button', { class: 'btn btn-ghost' }, 'Thử lại');
      retry.addEventListener('click', start);
      t.fill(t.app,
        h('a', { href: backHref, class: 'back' }, '← Quay lại lớp'),
        h('section', { class: 'panel live-wait' }, h('h1', null, '🎥 Lớp học trực tiếp'), h('p', null, msg), h('p', { class: 'muted small' }, 'Trang tự kiểm tra lại sau mỗi 15 giây.'), retry));
    }

    var polling = false;
    function start() {
      t.api('liveStatus', { courseId: courseId }).then(function (d) {
        if (!tr.alive()) return;
        if (!d.session) {
          waiting('Thầy chưa mở lớp học trực tiếp.');
          if (!polling) { polling = true; tr.every(function () { if (polling) start(); }, 15000); }
          return;
        }
        polling = false;
        return Promise.all([t.api('liveJoin', { sessionId: d.session.id }), ensureFirebase()]).then(function (res) {
          if (!tr.alive()) return;
          enter(res[0], res[1]);
        });
      }).catch(function (e) {
        if (!tr.alive()) return;
        t.fill(t.app, h('a', { href: backHref, class: 'back' }, '← Quay lại lớp'), t.errorBox(friendly(e, 'Không vào lớp được.')));
      });
    }

    function enter(join, fb) {
      var ref = fb.db.ref('live/' + join.session.code);
      var uid = fb.uid;
      var myRx = {};
      var question = null;
      var reveal = null;
      var mine = null;        // câu trả lời đã gửi cho câu đang hỏi
      var mineQid = null;
      var stopMine = null;
      var lastMood = 0;
      var timer = null;
      var lastQid = null;
      var hostSeen = false;
      var memberDone = false;
      var connRef = fb.db.ref('.info/connected');
      var presRef = ref.child('presence/' + uid);

      var statusEl = h('p', { class: 'live-joined' },
        join.joinedAt ? '✅ Đã điểm danh lúc ' + hhmm(join.joinedAt) : (me.role === 'student' ? '✅ Đã vào lớp' : 'Đang xem với tư cách giáo viên (không điểm danh)'));
      var handBtn = h('button', { class: 'live-big' }, '🙋 Xung phong');
      var askBtn = h('button', { class: 'live-big' }, '❓ Hỏi bài');
      var confBtn = h('button', { class: 'live-big' }, '🤔 Chưa hiểu');
      var okBtn = h('button', { class: 'live-big' }, '👍 Hiểu rồi');
      var qBox = h('section', { class: 'panel live-sq' });
      t.fill(t.app,
        h('a', { href: backHref, class: 'back' }, '← Quay lại lớp'),
        h('div', { class: 'live-head' }, h('h1', null, '🎥 Lớp học trực tiếp')),
        statusEl,
        h('p', { class: 'muted small' }, 'Em vẫn nghe giảng và xem màn hình thầy trên Google Meet. Khi thầy gửi câu hỏi, trang này kêu "bíp" và nhấp nháy.'),
        h('div', { class: 'live-btns' }, handBtn, askBtn, confBtn, okBtn),
        qBox);

      function canAct() {
        if (!memberDone) { t.toast('Đang kết nối lớp học, em chờ một chút.', 'error'); return false; }
        return true;
      }
      handBtn.addEventListener('click', function () {
        if (!canAct()) return;
        var up = !myRx.hand;
        ref.child('reactions/' + uid).update({ hand: up ? true : null, handAt: up ? TS() : null, t: TS() }).then(function () {
          if (up) t.toast('Đã báo thầy: em xung phong trả lời.', 'success');
        }, function (e) { t.toast(e.message, 'error'); });
      });
      askBtn.addEventListener('click', function () {
        if (!canAct()) return;
        if (typeof myRx.ask === 'string') {
          ref.child('reactions/' + uid).update({ ask: null, askAt: null, t: TS() }).catch(function (e) { t.toast(e.message, 'error'); });
          return;
        }
        var box = h('textarea', { rows: '3', maxlength: '300', placeholder: 'Em muốn hỏi gì? (có thể để trống, thầy sẽ gọi em hỏi trực tiếp)' });
        t.modal('Hỏi bài', h('div', { class: 'form' }, box), function (close) {
          var ok = h('button', { class: 'btn' }, 'Gửi cho thầy');
          ok.addEventListener('click', function () {
            t.busy(ok, true);
            ref.child('reactions/' + uid).update({ ask: box.value.trim().slice(0, 300), askAt: TS(), t: TS() }).then(function () {
              close();
              t.toast('Đã gửi câu hỏi cho thầy.', 'success');
            }, function (e) { t.busy(ok, false); t.toast(e.message, 'error'); });
          });
          return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
        });
      });
      function mood(kind) {
        if (!canAct()) return;
        if (Date.now() - lastMood < MOOD_WINDOW && myRx.mood === kind) { t.toast('Thầy đã nhận được rồi.', 'success'); return; }
        lastMood = Date.now();
        ref.child('reactions/' + uid).update({ mood: kind, moodAt: TS(), t: TS() }).then(function () {
          t.toast(kind === 'confused' ? 'Đã báo thầy: em chưa hiểu.' : 'Đã báo thầy: em hiểu rồi.', 'success');
        }, function (e) { t.toast(e.message, 'error'); });
      }
      confBtn.addEventListener('click', function () { mood('confused'); });
      okBtn.addEventListener('click', function () { mood('ok'); });

      function drawButtons() {
        handBtn.className = 'live-big' + (myRx.hand ? ' on' : '');
        handBtn.textContent = myRx.hand ? '🙋 Đang xung phong (bấm để hạ)' : '🙋 Xung phong';
        var asking = typeof myRx.ask === 'string';
        askBtn.className = 'live-big' + (asking ? ' on' : '');
        askBtn.textContent = asking ? '❓ Đã gửi câu hỏi (bấm để rút)' : '❓ Hỏi bài';
      }

      function joinMember() {
        return ref.child('members/' + uid).set({ name: String(me.fullName || me.username || 'Học sinh').slice(0, 80), username: String(me.username || '?').slice(0, 60), at: TS() }).then(function () {
          memberDone = true;
          tr.on(connRef, function (snap) {
            if (snap.val() !== true) return;
            presRef.onDisconnect().remove();
            presRef.set(true);
          });
          tr.on(ref.child('reactions/' + uid), function (snap) { myRx = snap.val() || {}; drawButtons(); });
        });
      }
      cleanupFb = function () {
        try { presRef.onDisconnect().cancel(); presRef.remove(); } catch (e) { /* bỏ qua */ }
      };

      function ended() {
        tr.cleanup();
        stopBlink();
        if (cleanupFb) cleanupFb();
        t.fill(t.app,
          h('a', { href: backHref, class: 'back' }, '← Quay lại lớp'),
          h('section', { class: 'panel live-wait' }, h('h1', null, 'Buổi học đã kết thúc'), h('p', null, 'Cảm ơn em đã tham gia!')));
      }

      tr.on(ref.child('host'), function (snap) {
        if (snap.val()) {
          if (!hostSeen) {
            hostSeen = true;
            joinMember().catch(function (e) { t.toast('Không vào lớp được: ' + e.message, 'error'); });
          }
        } else if (hostSeen) {
          ended();
        } else {
          t.fill(qBox, h('p', { class: 'muted' }, 'Đang chờ thầy mở lớp trên máy của thầy…'));
        }
      });

      function watchMine(qid) {
        if (mineQid === qid) return;
        if (stopMine) stopMine();
        mine = null;
        mineQid = qid;
        stopMine = tr.on(ref.child('answers/' + qid + '/' + uid), function (snap) { mine = snap.val(); drawQ(); });
      }

      function send(a, btn) {
        if (!question) return;
        if (btn) t.busy(btn, true);
        ref.child('answers/' + question.qid + '/' + uid).set({ a: a, t: TS() }).then(null, function () {
          if (btn) t.busy(btn, false);
          t.toast('Không gửi được (có thể đã hết giờ).', 'error');
        });
      }

      function drawQ() {
        if (timer) { clearInterval(timer); timer = null; }
        if (!hostSeen) return;
        var q = question;
        if (!q) { t.fill(qBox, h('p', { class: 'muted' }, 'Chưa có câu hỏi. Khi thầy gửi câu hỏi, câu hỏi sẽ hiện ở đây.')); return; }
        var endAt = Number(q.startedAt || 0) + Number(q.duration || 0) * 1000;
        var left = Math.max(0, Math.ceil((endAt - serverNow()) / 1000));
        var rv = reveal && reveal.qid === q.qid ? reveal : null;
        var clock = h('span', { class: 'live-clock' }, left > 0 ? left + 's' : 'Hết giờ');
        var body = [];
        if (q.hasImage) body.push(h('p', { class: 'muted small' }, '(Câu có hình – em xem hình trên màn hình thầy chia sẻ)'));
        var my = mine ? mine.a : null;
        var answered = my !== null && my !== undefined;
        if (q.type === 'mc') {
          var compact = (q.options || []).every(function (o) { return String(o || '').length <= 8; });
          body.push(h('div', { class: 'live-choices' + (compact ? ' compact' : '') }, (q.options || []).map(function (o, i) {
            var cls = 'live-choice';
            if (answered && Number(my) === i) cls += ' picked';
            if (rv && Number(rv.correct) === i) cls += ' right';
            else if (rv && answered && Number(my) === i) cls += ' wrong';
            var b = h('button', { class: cls, disabled: answered || left <= 0 }, h('b', null, LETTERS.charAt(i)), h('span', null, qText(o)));
            b.addEventListener('click', function () { send(i, b); });
            return b;
          })));
        } else if (!answered && left > 0) {
          var inp = h('input', { type: 'text', placeholder: 'Nhập câu trả lời', autocomplete: 'off' });
          var go = h('button', { class: 'btn' }, 'Gửi');
          var f = h('form', { class: 'live-short' }, inp, go);
          f.addEventListener('submit', function (e) {
            e.preventDefault();
            var v = inp.value.trim();
            if (!v) return t.toast('Em nhập câu trả lời trước.', 'error');
            send(v.slice(0, 200), go);
          });
          body.push(f);
          if (t.fracHint) body.push(t.fracHint(inp));
        } else if (answered) {
          body.push(h('p', null, 'Em trả lời: ', h('b', null, qText(String(my)))));
        }
        var state = null;
        if (rv) {
          var ok = answered && (q.type === 'mc' ? Number(my) === Number(rv.correct) :
            window.QuizFormat.isCorrect({ type: 'short', answers: String(rv.correct).split(/\s*\|\s*/) }, my));
          state = h('p', { class: 'live-verdict ' + (ok ? 'ok' : 'no') },
            answered ? (ok ? '🎉 Đúng rồi!' : '✗ Chưa đúng.') : 'Em chưa trả lời câu này.',
            ' Đáp án: ', h('b', null, q.type === 'mc' ? optLabel(q, Number(rv.correct)) : String(rv.correct)));
        } else if (answered) {
          state = h('p', { class: 'muted' }, '✓ Đã gửi, chờ thầy công bố đáp án.');
        } else if (left <= 0) {
          state = h('p', { class: 'muted' }, 'Hết giờ.');
        }
        t.fill(qBox,
          h('div', { class: 'live-q-head' }, h('b', null, 'Câu hỏi của thầy'), clock),
          h('div', { class: 'live-q-text prewrap' }, qText(q.text)),
          body, state);
        if (left > 0) {
          timer = setInterval(function () {
            if (!tr.alive()) { clearInterval(timer); return; }
            var l = Math.max(0, Math.ceil((endAt - serverNow()) / 1000));
            clock.textContent = l > 0 ? l + 's' : 'Hết giờ';
            if (l <= 0) drawQ();
          }, 500);
        }
      }

      tr.on(ref.child('question'), function (snap) {
        question = snap.val();
        if (question) {
          watchMine(question.qid);
          if (question.qid !== lastQid) {
            if (lastQid !== null || serverNow() < Number(question.startedAt || 0) + Number(question.duration || 0) * 1000) notifyHidden('Câu hỏi mới');
            lastQid = question.qid;
          }
        }
        drawQ();
      });
      tr.on(ref.child('reveal'), function (snap) { reveal = snap.val(); drawQ(); });
    }

    start();
  }

  /* ═══════════════════════════════ Khung trên trang lớp ═══════════════════════════════ */

  function historyDialog(c) {
    var t = T();
    var h = t.h;
    var body = h('div', { class: 'live-list' }, t.loading('Đang tải…'));
    t.modal('Lịch sử điểm danh – ' + c.name, body, null, { wide: true });
    t.api('liveHistory', { courseId: c.id }).then(function (d) {
      var students = d.students || [];
      if (!(d.sessions || []).length) { t.fill(body, h('p', { class: 'muted' }, 'Chưa có buổi học trực tiếp nào.')); return; }
      t.fill(body, d.sessions.map(function (s) {
        var byUser = {};
        (s.attendance || []).forEach(function (a) { byUser[a.username] = a; });
        var absent = students.filter(function (x) { return !byUser[x.username]; });
        var copyBtn = h('button', { class: 'chip-btn' }, 'Sao chép');
        copyBtn.addEventListener('click', function () {
          var lines = ['Điểm danh ' + c.name + ' – ' + dmy(s.startedAt) + ' ' + hhmm(s.startedAt), 'Có mặt (' + s.count + '):'];
          (s.attendance || []).forEach(function (a, i) { lines.push((i + 1) + '. ' + (a.fullName || a.username) + ' (' + hhmm(a.joinedAt) + ')'); });
          lines.push('Vắng (' + absent.length + '):');
          absent.forEach(function (x, i) { lines.push((i + 1) + '. ' + (x.fullName || x.username)); });
          t.copy(lines.join('\n'), 'Đã sao chép.');
        });
        return h('details', { class: 'live-hist' },
          h('summary', null, dmy(s.startedAt) + ' · ' + hhmm(s.startedAt) + (s.endedAt ? '–' + hhmm(s.endedAt) : s.open ? ' (đang mở)' : ''),
            h('span', { class: 'muted small' }, ' · ' + s.count + (students.length ? '/' + students.length : '') + ' em')),
          h('p', { class: 'small' }, h('b', null, 'Có mặt: '), (s.attendance || []).map(function (a) { return (a.fullName || a.username) + ' (' + hhmm(a.joinedAt) + ')'; }).join(', ') || '—'),
          h('p', { class: 'small' }, h('b', null, 'Vắng: '), absent.map(function (x) { return x.fullName || x.username; }).join(', ') || '—'),
          copyBtn);
      }));
    }, function (e) { t.fill(body, t.errorBox(e.message)); });
  }

  /** Khung "Lớp học trực tiếp" ở đầu trang lớp. Máy chủ cũ (chưa có liveStatus) → không hiện gì. */
  function courseBanner(c) {
    var t = T();
    var h = t.h;
    var box = h('div', { class: 'live-banner-wrap' });
    if (!hasConfig()) return box;
    var href = '#/lop-truc-tiep/' + encodeURIComponent(c.id);
    t.api('liveStatus', { courseId: c.id }).then(function (d) {
      var on = !!d.session;
      if (c.canEdit) {
        var hist = h('button', { class: 'link-btn small' }, 'Lịch sử điểm danh');
        hist.addEventListener('click', function () { historyDialog(c); });
        t.fill(box, h('div', { class: 'live-banner teacher' + (on ? ' on' : '') },
          h('a', { class: 'btn btn-sm' + (on ? ' btn-danger' : ''), href: href }, on ? '🔴 Đang dạy trực tiếp – vào lại' : '🎥 Bắt đầu buổi học trực tiếp'),
          h('span', { class: 'muted small' }, 'Điểm danh, hỏi cả lớp, xung phong, hỏi bài khi học qua Meet'),
          hist));
      } else if (on) {
        t.fill(box, h('a', { class: 'live-banner student on', href: href },
          h('span', { class: 'live-pulse' }), h('b', null, 'Thầy đang dạy trực tiếp'), h('span', { class: 'btn btn-sm' }, 'Vào lớp')));
      }
    }, function () { /* máy chủ chưa cập nhật: bỏ qua */ });
    return box;
  }

  window.TTMLive = { renderHost: renderHost, renderStudent: renderStudent, courseBanner: courseBanner };

  // Mở thẳng #/lop-truc-tiep/... khi mới tải trang: gọi lại route() khi TTMLive đã sẵn sàng.
  if (/^#\/?lop-truc-tiep(\/|$)/.test(location.hash) && window.TTM && window.TTM.route) window.TTM.route();
})();
