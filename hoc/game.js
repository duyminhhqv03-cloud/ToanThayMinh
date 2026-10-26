/* Đấu cả lớp (kiểu Kahoot) – Toán Thầy Minh
 * Thời gian thực qua Firebase Realtime Database + Anonymous Auth; kết quả cuối trận lưu vào Google Sheets.
 */
(function () {
  'use strict';

  var FB_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var OPT_SYMS = ['▲', '◆', '●', '■', '★', '⬢', '♥', '✦'];
  var OPT_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7c3aed', '#0891b2', '#db2777', '#ea580c'];
  var DURATIONS = [10, 20, 30, 60];
  var MISSING_CFG_MSG = 'Chức năng đấu cả lớp chưa được cài đặt (thiếu FIREBASE_CONFIG trong hoc/config.js)';

  var fbPromise = null;
  var serverOffset = 0;
  var offsetListening = false;

  function hasConfig() {
    var c = window.FIREBASE_CONFIG;
    return !!(c && typeof c === 'object' && c.apiKey && c.databaseURL);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Không tải được thư viện thời gian thực. Kiểm tra kết nối mạng rồi thử lại.')); };
      document.head.append(s);
    });
  }

  /** Chỉ nạp động SDK Firebase khi người dùng mở trang đấu, rồi đăng nhập ẩn danh. */
  function ensureFirebase() {
    if (!hasConfig()) return Promise.reject(new Error(MISSING_CFG_MSG));
    var loadSdk = window.firebase && window.firebase.database && window.firebase.auth
      ? Promise.resolve()
      : (fbPromise || (fbPromise = loadScript(FB_BASE + 'firebase-app-compat.js').then(function () {
          return Promise.all([
            loadScript(FB_BASE + 'firebase-auth-compat.js'),
            loadScript(FB_BASE + 'firebase-database-compat.js')
          ]);
        }).catch(function (e) {
          fbPromise = null;
          throw e;
        })));

    return loadSdk.then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      var db = window.firebase.database();
      if (!offsetListening) {
        offsetListening = true;
        db.ref('.info/serverTimeOffset').on('value', function (snap) {
          serverOffset = Number(snap.val() || 0);
        });
      }
      var auth = window.firebase.auth();
      if (auth.currentUser) return { db: db, auth: auth, uid: auth.currentUser.uid };
      return auth.signInAnonymously().then(function (cred) {
        return { db: db, auth: auth, uid: cred.user.uid };
      }, function () {
        throw new Error('Không đăng nhập ẩn danh vào Firebase được. Hãy kiểm tra đã bật Anonymous Sign-in trong Firebase Console chưa.');
      });
    });
  }

  function serverNow() {
    return Date.now() + serverOffset;
  }

  function fmtPin(pin) {
    var s = String(pin || '');
    return s.length === 6 ? s.slice(0, 3) + ' ' + s.slice(3) : s;
  }

  function shuffleArray(arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Quản lý các listener Firebase và đồng hồ đếm ngược, tự dọn sạch khi rời trang. */
  function createTracker(seq) {
    var listeners = [];
    var timers = [];
    var cleaned = false;
    return {
      alive: function () { return !cleaned && window.TTM.isCurrent(seq); },
      on: function (ref, ev, fn) {
        var wrapped = function (snap) {
          if (cleaned || !window.TTM.isCurrent(seq)) return;
          fn(snap);
        };
        ref.on(ev, wrapped);
        listeners.push({ ref: ref, ev: ev, fn: wrapped });
        return function () {
          ref.off(ev, wrapped);
        };
      },
      interval: function (fn, ms) {
        var id = setInterval(function () {
          if (cleaned || !window.TTM.isCurrent(seq)) { clearInterval(id); return; }
          fn();
        }, ms);
        timers.push(id);
        return function () { clearInterval(id); };
      },
      cleanup: function () {
        if (cleaned) return;
        cleaned = true;
        listeners.forEach(function (l) {
          try { l.ref.off(l.ev, l.fn); } catch (e) { /* bỏ qua */ }
        });
        listeners = [];
        timers.forEach(function (id) { clearInterval(id); });
        timers = [];
      }
    };
  }

  function missingConfigView(backHref, backText) {
    var T = window.TTM;
    var h = T.h;
    T.fill(T.app,
      h('a', { href: backHref || '#/', class: 'back' }, '← ' + (backText || 'Quay lại')),
      h('div', { class: 'panel empty' },
        h('p', { class: 'err' }, h('strong', null, MISSING_CFG_MSG)),
        h('p', { class: 'muted small' }, 'Xem hướng dẫn cài đặt trong file apps-script/FIREBASE.md.')));
  }

  /* ═══════════════════ MÀN HÌNH HỌC SINH: NHẬP MÃ PHÒNG (#/dau) ═══════════════════ */

  function renderJoin() {
    var T = window.TTM;
    var h = T.h;
    if (!hasConfig()) return missingConfigView('#/', 'Khóa học');

    var lastPin = T.store.get('ttm_last_pin') || '';
    var inp = h('input', {
      type: 'text',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: '6',
      class: 'pin-input',
      placeholder: '000000',
      autocomplete: 'off',
      value: /^\d{6}$/.test(lastPin) ? lastPin : ''
    });
    inp.addEventListener('input', function () {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 6);
    });

    var btn = h('button', { type: 'submit', class: 'btn btn-lg btn-block' }, 'Vào phòng');
    var form = h('form', { class: 'form game-join-form' },
      h('label', { class: 'field' },
        h('span', null, 'Nhập mã phòng 6 chữ số trên màn hình của thầy cô'),
        inp),
      btn);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = inp.value.replace(/\D/g, '');
      if (pin.length !== 6) return T.toast('Vui lòng nhập đủ 6 chữ số mã phòng.', 'error');
      T.store.set('ttm_last_pin', pin);
      T.go('#/dau/' + pin);
    });

    T.fill(T.app,
      h('section', { class: 'game-join-wrap' },
        h('div', { class: 'panel game-join-card' },
          h('div', { class: 'game-badge' }, '🎮 Đấu cả lớp'),
          h('h1', null, 'Vào phòng thi đấu'),
          h('p', { class: 'muted' }, 'Trả lời đúng và nhanh nhất để lên bục vinh quang!'),
          form)));
    setTimeout(function () { inp.focus(); inp.select(); }, 0);
  }

  /* ═══════════════════ MÀN HÌNH HỌC SINH: TRONG PHÒNG (#/dau/{pin}) ═══════════════════ */

  function renderPlay(rawPin) {
    var T = window.TTM;
    var h = T.h;
    var pin = String(rawPin || '').replace(/\D/g, '');
    if (!hasConfig()) return missingConfigView('#/dau', 'Đấu cả lớp');
    if (!/^\d{6}$/.test(pin)) {
      T.fill(T.app,
        h('a', { href: '#/dau', class: 'back' }, '← Nhập mã khác'),
        T.errorBox('Mã phòng không hợp lệ (cần đúng 6 chữ số).', function () { T.go('#/dau'); }));
      return;
    }

    var seq = T.getSeq();
    var tracker = createTracker(seq);
    var activeGame = false;
    T.setLeaveGuard(
      function () { return activeGame; },
      'Trận đấu đang diễn ra. Em có chắc muốn rời phòng?',
      tracker.cleanup
    );

    T.fill(T.app, T.loading('Đang vào phòng ' + fmtPin(pin) + '…'));

    ensureFirebase().then(function (fb) {
      if (!tracker.alive()) return;
      var db = fb.db;
      var uid = fb.uid;
      var roomRef = db.ref('rooms/' + pin);

      return roomRef.once('value').then(function (snap) {
        if (!tracker.alive()) return;
        if (!snap.exists()) {
          activeGame = false;
          T.fill(T.app,
            h('a', { href: '#/dau', class: 'back' }, '← Nhập mã khác'),
            T.errorBox('Phòng ' + fmtPin(pin) + ' không tồn tại hoặc đã kết thúc.', function () { T.go('#/dau'); }));
          return;
        }

        T.store.set('ttm_last_pin', pin);
        var me = T.getMe() || { username: 'hs', fullName: 'Học sinh' };
        var playerRef = roomRef.child('players/' + uid);
        var existingPlayer = snap.child('players/' + uid).val();
        var joinPromise = existingPlayer && existingPlayer.name === (me.fullName || me.username)
          ? Promise.resolve()
          : playerRef.set({
              name: String(me.fullName || me.username || 'Học sinh').slice(0, 80),
              username: String(me.username || 'hs').slice(0, 60),
              joinedAt: existingPlayer && existingPlayer.joinedAt ? existingPlayer.joinedAt : window.firebase.database.ServerValue.TIMESTAMP
            });

        return joinPromise.then(function () {
          if (!tracker.alive()) return;
          runStudentRoom(pin, roomRef, uid, me, tracker);
        });
      });
    }).catch(function (err) {
      if (!tracker.alive()) return;
      activeGame = false;
      T.fill(T.app,
        h('a', { href: '#/dau', class: 'back' }, '← Quay lại'),
        T.errorBox(err.message || 'Không vào được phòng đấu.', function () { renderPlay(pin); }));
    });

    function runStudentRoom(pinCode, roomRef, uid, me, tr) {
      var currentPhase = '';
      var currentQIndex = -1;
      var stopTimer = null;
      var answeredMap = {}; // index -> { a, sent }
      var stage = h('div', { class: 'game-student-stage' });
      var headMeta = h('span', { class: 'muted small' });

      T.fill(T.app,
        h('div', { class: 'game-student-bar' },
          h('span', { class: 'pill p-blue' }, 'Phòng ' + fmtPin(pinCode)),
          headMeta,
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/dau'); } }, 'Rời phòng')),
        stage);

      function clearQTimer() {
        if (stopTimer) { stopTimer(); stopTimer = null; }
      }

      tr.on(roomRef, 'value', function (snap) {
        if (!snap.exists()) {
          clearQTimer();
          activeGame = false;
          T.fill(stage,
            h('div', { class: 'panel empty' },
              h('h2', null, 'Phòng đấu đã đóng'),
              h('p', { class: 'muted' }, 'Giáo viên đã kết thúc và đóng phòng đấu này.'),
              h('div', { class: 'actions-start', style: 'justify-content:center' },
                h('button', { class: 'btn', onclick: function () { T.go('#/dau'); } }, 'Quay lại'))));
          return;
        }

        var room = snap.val() || {};
        var st = room.state || { phase: 'lobby', index: -1, total: 1 };
        var players = room.players || {};
        var playerCount = Object.keys(players).length;
        var myScoreObj = (room.scores && room.scores[uid]) || { score: 0, correctCount: 0, streak: 0, lastCorrect: false, lastGain: 0, rank: null };

        // Đảm bảo tên học sinh luôn có trong danh sách phòng (kể cả khi mất mạng vào lại)
        if (!players[uid] && st.phase !== 'end') {
          roomRef.child('players/' + uid).set({
            name: String(me.fullName || me.username || 'Học sinh').slice(0, 80),
            username: String(me.username || 'hs').slice(0, 60),
            joinedAt: window.firebase.database.ServerValue.TIMESTAMP
          }).catch(function () {});
        }

        activeGame = st.phase !== 'end';
        headMeta.textContent = (room.quizTitle || '') + (myScoreObj.score ? ' · ' + T.fmtScore(myScoreObj.score) + ' đ' : '');

        if (st.phase === 'lobby') {
          clearQTimer();
          currentPhase = 'lobby';
          currentQIndex = -1;
          T.fill(stage,
            h('div', { class: 'panel game-lobby-student' },
              h('div', { class: 'game-status-icon' }, '⏳'),
              h('h2', null, 'Đã vào phòng – chờ giáo viên bắt đầu'),
              h('p', { class: 'muted' }, (room.quizTitle || 'Bài luyện tập') + (room.courseName ? ' · ' + room.courseName : '')),
              h('div', { class: 'game-self-box' },
                h('span', { class: 'muted small' }, 'Người chơi'),
                h('strong', null, me.fullName || me.username)),
              h('p', { class: 'pill p-done' }, playerCount + ' bạn đang trong phòng')));
          return;
        }

        if (st.phase === 'question') {
          var q = room.question || { index: st.index, type: 'mc', text: '', options: [] };
          var qIdx = Number(st.index);
          var existingAns = room.answers && room.answers[qIdx] && room.answers[qIdx][uid];
          if (existingAns && !answeredMap[qIdx]) {
            answeredMap[qIdx] = { a: existingAns.a, sent: true };
          }
          // Chỉ vẽ lại màn câu hỏi khi sang câu mới hoặc mới chuyển sang pha đang hỏi
          if (currentPhase !== 'question' || currentQIndex !== qIdx) {
            currentPhase = 'question';
            currentQIndex = qIdx;
            drawStudentQuestion(room, st, q, myScoreObj);
          }
          return;
        }

        if (st.phase === 'reveal') {
          clearQTimer();
          var revIdx = Number(st.index);
          if (currentPhase !== 'reveal' || currentQIndex !== revIdx) {
            currentPhase = 'reveal';
            currentQIndex = revIdx;
          }
          drawStudentReveal(room, st, room.reveal || {}, myScoreObj, room.question);
          return;
        }

        if (st.phase === 'end') {
          clearQTimer();
          currentPhase = 'end';
          activeGame = false;
          drawStudentEnd(room, st, myScoreObj, playerCount);
        }
      });

      function drawStudentQuestion(room, st, q, myScoreObj) {
        clearQTimer();
        var qIdx = Number(st.index);
        var clockEl = h('span', { class: 'clock game-clock' }, '⏱ ' + (st.duration || 20) + 's');
        var bodyBox = h('div', { class: 'game-student-answer-area' });

        function renderLocked(msg, pickedLabel) {
          T.fill(bodyBox,
            h('div', { class: 'panel game-sent-box' },
              h('div', { class: 'game-status-icon' }, '📨'),
              h('h3', null, msg || 'Đã gửi, chờ các bạn…'),
              pickedLabel ? h('p', { class: 'muted' }, 'Câu trả lời của em: ', h('strong', null, pickedLabel)) : null));
        }

        function formatPicked(val) {
          if (q.type === 'mc') {
            var k = Number(val);
            var letter = String.fromCharCode(65 + k);
            var optText = q.options && q.options[k] ? ' – ' + q.options[k] : '';
            return letter + optText;
          }
          return String(val);
        }

        function submitAnswer(val) {
          if (answeredMap[qIdx]) return;
          answeredMap[qIdx] = { a: val, sent: true };
          renderLocked('Đã gửi, chờ các bạn…', formatPicked(val));
          roomRef.child('answers/' + qIdx + '/' + uid).set({
            a: val,
            t: window.firebase.database.ServerValue.TIMESTAMP
          }).catch(function (err) {
            delete answeredMap[qIdx];
            T.toast('Không gửi được câu trả lời: ' + (err.message || 'Hết giờ hoặc lỗi mạng.'), 'error');
            drawControls();
          });
        }

        function drawControls() {
          if (answeredMap[qIdx]) {
            renderLocked('Đã gửi, chờ các bạn…', formatPicked(answeredMap[qIdx].a));
            return;
          }
          var leftMs = (Number(st.startedAt || 0) + Number(st.duration || 20) * 1000) - serverNow();
          if (st.startedAt && leftMs <= 0) {
            renderLocked('Đã hết giờ! Chờ thầy cô công bố đáp án…', null);
            return;
          }
          if (q.type === 'mc') {
            var opts = q.options || [];
            T.fill(bodyBox,
              h('div', { class: 'game-pad-grid' }, opts.map(function (optText, k) {
                var color = OPT_COLORS[k % OPT_COLORS.length];
                var sym = OPT_SYMS[k % OPT_SYMS.length];
                var letter = String.fromCharCode(65 + k);
                return h('button', {
                  type: 'button',
                  class: 'game-pad-btn',
                  style: '--opt-bg:' + color,
                  onclick: function () { submitAnswer(k); }
                },
                  h('span', { class: 'game-pad-head' },
                    h('span', { class: 'game-pad-sym' }, sym),
                    h('span', { class: 'game-pad-letter' }, letter)),
                  h('span', { class: 'game-pad-text' }, optText));
              })));
          } else {
            var sInp = h('input', {
              type: 'text',
              class: 'short-input game-short-input',
              placeholder: 'Nhập đáp án của em…',
              autocomplete: 'off',
              maxlength: '200'
            });
            var sBtn = h('button', { type: 'submit', class: 'btn btn-lg btn-block' }, 'Gửi đáp án');
            var sForm = h('form', { class: 'panel form game-short-form' }, sInp, sBtn);
            sForm.addEventListener('submit', function (e) {
              e.preventDefault();
              var v = sInp.value.trim();
              if (!v) return T.toast('Em hãy nhập đáp án trước khi bấm Gửi.', 'error');
              submitAnswer(v);
            });
            T.fill(bodyBox, sForm);
            setTimeout(function () { sInp.focus(); }, 0);
          }
        }

        function tick() {
          if (!st.startedAt) return;
          var leftMs = (Number(st.startedAt) + Number(st.duration || 20) * 1000) - serverNow();
          var sec = Math.max(0, Math.ceil(leftMs / 1000));
          clockEl.textContent = '⏱ ' + sec + 's';
          clockEl.classList.toggle('low', sec <= 5);
          if (leftMs <= 0 && !answeredMap[qIdx]) {
            clearQTimer();
            renderLocked('Đã hết giờ! Chờ thầy cô công bố đáp án…', null);
          }
        }

        T.fill(stage,
          h('div', { class: 'panel game-student-q' },
            h('div', { class: 'game-q-top' },
              h('span', { class: 'q-num' }, 'Câu ' + (qIdx + 1) + ' / ' + (st.total || 1)),
              clockEl,
              h('span', { class: 'pill p-blue' }, T.fmtScore(myScoreObj.score || 0) + ' điểm')),
            h('p', { class: 'game-student-qtext prewrap' }, q.text || ''),
            q.image && room.quizId ? T.qImageEl({ kind: 'quiz', id: room.quizId, key: q.image }) : null),
          bodyBox);

        drawControls();
        tick();
        stopTimer = tr.interval(tick, 250);
      }

      function drawStudentReveal(room, st, rev, myScoreObj, q) {
        var right = !!myScoreObj.lastCorrect;
        var gain = Number(myScoreObj.lastGain || 0);
        var streak = Number(myScoreObj.streak || 0);
        var rank = myScoreObj.rank;
        var correctText = '';
        if (rev && rev.correct !== undefined && rev.correct !== null) {
          if (q && q.type === 'mc') {
            var cIdx = Number(rev.correct);
            var cOpt = q.options && q.options[cIdx] ? ' – ' + q.options[cIdx] : '';
            correctText = String.fromCharCode(65 + cIdx) + cOpt;
          } else {
            correctText = String(rev.correct);
          }
        }

        T.fill(stage,
          h('div', { class: 'panel game-reveal-student ' + (right ? 'is-ok' : 'is-bad') },
            h('div', { class: 'game-verdict-icon' }, right ? '✅' : '❌'),
            h('h2', null, right ? 'Đúng rồi!' : 'Chưa đúng'),
            h('div', { class: 'game-gain-badge ' + (right ? 'ok' : 'bad') },
              right ? '+' + T.fmtScore(gain) + ' điểm' : '+0 điểm'),
            streak >= 2 ? h('div', { class: 'game-streak-pill' }, '🔥 Chuỗi ' + streak + ' câu đúng liên tiếp!') : null,
            !right && correctText ? h('p', { class: 'game-correct-note' }, 'Đáp án đúng: ', h('strong', null, correctText)) : null,
            h('div', { class: 'stats game-student-stats' },
              h('div', { class: 'stat' }, h('strong', null, T.fmtScore(myScoreObj.score || 0)), h('span', null, 'Tổng điểm')),
              h('div', { class: 'stat' }, h('strong', null, rank ? '#' + rank : '–'), h('span', null, 'Hạng hiện tại')),
              h('div', { class: 'stat' }, h('strong', null, streak ? '🔥 ' + streak : '0'), h('span', null, 'Chuỗi đúng'))),
            h('p', { class: 'muted small' }, 'Chờ thầy cô chuyển sang câu tiếp theo…')));
      }

      function drawStudentEnd(room, st, myScoreObj, playerCount) {
        // Không trao huy chương cho bạn 0 điểm (lớp ít người vẫn có thể "hạng Nhì" khi sai hết).
        var rank = myScoreObj.score > 0 ? Number(myScoreObj.rank || 0) : 0;
        var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏁';
        var rankTitle = rank === 1 ? 'Hạng Nhất xuất sắc!' : rank === 2 ? 'Hạng Nhì tuyệt vời!' : rank === 3 ? 'Hạng Ba giỏi lắm!' : (rank ? 'Hạng #' + rank + ' / ' + playerCount : 'Hoàn thành trận đấu');

        T.fill(stage,
          h('div', { class: 'panel game-end-student' },
            h('div', { class: 'game-medal-big' }, medal),
            h('h1', null, rankTitle),
            h('p', { class: 'muted' }, room.quizTitle || ''),
            h('div', { class: 'stats game-student-stats' },
              h('div', { class: 'stat' }, h('strong', null, T.fmtScore(myScoreObj.score || 0)), h('span', null, 'Tổng điểm')),
              h('div', { class: 'stat' }, h('strong', null, (myScoreObj.correctCount || 0) + '/' + (st.total || 0)), h('span', null, 'Câu trả lời đúng')),
              h('div', { class: 'stat' }, h('strong', null, rank ? '#' + rank : '–'), h('span', null, 'Xếp hạng cuối'))),
            h('div', { class: 'actions-start', style: 'justify-content:center' },
              h('button', { class: 'btn', onclick: function () { T.go('#/dau'); } }, 'Đấu trận khác'),
              h('button', { class: 'btn btn-ghost', onclick: function () { T.go('#/'); } }, 'Về khóa học'))));
      }
    }
  }

  /* ═══════════════════ MÀN HÌNH GIÁO VIÊN: TỔ CHỨC ĐẤU (#/dau-host/{quizId}) ═══════════════════ */

  function hostStoreKey(quizId) {
    return 'ttm_host_room:' + quizId;
  }

  function loadHostState(quizId) {
    try {
      var raw = window.TTM.store.get(hostStoreKey(quizId));
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.pin || Date.now() - (d.at || 0) > 12 * 3600 * 1000) {
        window.TTM.store.set(hostStoreKey(quizId), null);
        return null;
      }
      return d;
    } catch (e) {
      return null;
    }
  }

  function saveHostState(quizId, data) {
    if (!data) {
      window.TTM.store.set(hostStoreKey(quizId), null);
      return;
    }
    data.at = Date.now();
    window.TTM.store.set(hostStoreKey(quizId), JSON.stringify(data));
  }

  function renderHost(quizId) {
    var T = window.TTM;
    var h = T.h;
    var backHref = '#/luyen/' + encodeURIComponent(quizId);
    if (!hasConfig()) return missingConfigView(backHref, 'Bài luyện tập');

    var seq = T.getSeq();
    var tracker = createTracker(seq);
    var roomActive = false;

    T.setLeaveGuard(
      function () { return roomActive; },
      'Phòng đấu cả lớp đang diễn ra. Bạn có chắc muốn rời trang?',
      tracker.cleanup
    );

    T.fill(T.app, T.loading('Đang tải đề và kết nối máy chủ đấu…'));

    Promise.all([T.api('quiz', { id: quizId }), ensureFirebase()]).then(function (res) {
      if (!tracker.alive()) return;
      var d = res[0];
      var fb = res[1];
      if (!d.canEdit) {
        T.fill(T.app,
          h('a', { href: backHref, class: 'back' }, '← Quay lại'),
          T.errorBox('Bạn không có quyền tổ chức đấu cả lớp cho bài luyện tập này.'));
        return;
      }
      var allQs = (d.fullQuestions || []).filter(function (q) {
        return q && (q.type === 'mc' || q.type === 'short');
      });
      if (!allQs.length) {
        T.fill(T.app,
          h('a', { href: backHref, class: 'back' }, '← ' + d.quiz.title),
          T.errorBox('Đề này không có câu hỏi trắc nghiệm hoặc trả lời ngắn nào để đấu cả lớp.'));
        return;
      }

      var saved = loadHostState(quizId);
      if (saved && saved.pin) {
        fb.db.ref('rooms/' + saved.pin).once('value').then(function (snap) {
          if (!tracker.alive()) return;
          var rVal = snap.exists() ? snap.val() : null;
          if (rVal && rVal.host === fb.uid) {
            drawSetup(d, allQs, fb, { pin: saved.pin, room: rVal, saved: saved });
          } else {
            saveHostState(quizId, null);
            drawSetup(d, allQs, fb, null);
          }
        }).catch(function () {
          if (!tracker.alive()) return;
          drawSetup(d, allQs, fb, null);
        });
      } else {
        drawSetup(d, allQs, fb, null);
      }
    }).catch(function (err) {
      if (!tracker.alive()) return;
      T.fill(T.app,
        h('a', { href: backHref, class: 'back' }, '← Quay lại'),
        T.errorBox(err.message || 'Không tải được dữ liệu.', function () { renderHost(quizId); }));
    });

    function drawSetup(d, baseQuestions, fb, existing) {
      var q = d.quiz;
      var c = d.course;
      var duration = 20;
      var shuffleBox = h('input', { type: 'checkbox' });
      var durBar = h('div', { class: 'chips filter' });

      function drawDur() {
        T.fill(durBar, DURATIONS.map(function (sec) {
          return h('button', {
            type: 'button',
            class: 'chip-btn' + (duration === sec ? ' active' : ''),
            onclick: function () { duration = sec; drawDur(); }
          }, sec + ' giây');
        }));
      }
      drawDur();

      var mcCount = baseQuestions.filter(function (x) { return x.type === 'mc'; }).length;
      var shortCount = baseQuestions.filter(function (x) { return x.type === 'short'; }).length;
      var parts = [];
      if (mcCount) parts.push(mcCount + ' câu trắc nghiệm');
      if (shortCount) parts.push(shortCount + ' câu trả lời ngắn');

      var openBtn = h('button', { class: 'btn btn-lg' }, '🎮 Mở phòng đấu');
      openBtn.addEventListener('click', function () {
        var qs = shuffleBox.checked ? shuffleArray(baseQuestions) : baseQuestions.slice();
        T.busy(openBtn, true, 'Đang tạo mã phòng…');
        createUniquePin(fb.db, 0).then(function (pin) {
          if (!tracker.alive()) return;
          var me = T.getMe() || { username: 'gv', fullName: 'Giáo viên' };
          var roomData = {
            host: fb.uid,
            hostName: String(me.fullName || me.username || 'Giáo viên').slice(0, 100),
            quizId: q.id,
            quizTitle: String(q.title || '').slice(0, 300),
            courseId: c.id,
            courseName: String(c.name + (c.grade ? ' · ' + c.grade : '')).slice(0, 200),
            createdAt: window.firebase.database.ServerValue.TIMESTAMP,
            state: {
              phase: 'lobby',
              index: -1,
              total: qs.length,
              startedAt: 0,
              duration: duration
            }
          };
          return fb.db.ref('rooms/' + pin).set(roomData).then(function () {
            if (!tracker.alive()) return;
            var hostState = {
              pin: pin,
              quizId: q.id,
              duration: duration,
              questions: qs,
              scores: {},
              savedMatch: false
            };
            saveHostState(quizId, hostState);
            runHostRoom(d, fb, hostState);
          });
        }).catch(function (err) {
          T.busy(openBtn, false);
          T.toast(err.message || 'Không tạo được phòng đấu.', 'error');
        });
      });

      var resumeBanner = null;
      if (existing) {
        var phaseLabel = {
          lobby: 'Đang ở sảnh chờ',
          question: 'Đang hỏi câu ' + ((existing.room.state && existing.room.state.index || 0) + 1) + '/' + (existing.room.state && existing.room.state.total || baseQuestions.length),
          reveal: 'Đang công bố câu ' + ((existing.room.state && existing.room.state.index || 0) + 1) + '/' + (existing.room.state && existing.room.state.total || baseQuestions.length),
          end: 'Đã kết thúc'
        }[(existing.room.state && existing.room.state.phase) || 'lobby'] || 'Đang mở';

        var resumeBtn = h('button', { class: 'btn', onclick: function () {
          var qs = existing.saved.questions && existing.saved.questions.length === (existing.room.state && existing.room.state.total)
            ? existing.saved.questions
            : baseQuestions.slice();
          runHostRoom(d, fb, {
            pin: existing.pin,
            quizId: q.id,
            duration: Number((existing.room.state && existing.room.state.duration) || existing.saved.duration || 20),
            questions: qs,
            scores: existing.room.scores || existing.saved.scores || {},
            savedMatch: !!existing.saved.savedMatch,
            resumedRoom: existing.room
          });
        } }, 'Tiếp tục phòng ' + fmtPin(existing.pin));

        var closeOldBtn = h('button', { class: 'btn btn-ghost danger-text', onclick: function () {
          T.busy(closeOldBtn, true, 'Đang đóng…');
          fb.db.ref('rooms/' + existing.pin).remove().catch(function () {}).then(function () {
            saveHostState(quizId, null);
            if (resumeBanner) resumeBanner.remove();
            T.toast('Đã đóng phòng cũ.', 'success');
          });
        } }, 'Đóng phòng cũ');

        resumeBanner = h('div', { class: 'panel finalize-bar' },
          h('div', null,
            h('strong', null, 'Phòng ' + fmtPin(existing.pin) + ' đang mở (' + phaseLabel + ')'),
            h('p', { class: 'muted small' }, 'Bạn có thể tiếp tục điều khiển phòng này hoặc đóng để mở phòng mới.')),
          h('div', { class: 'add-bar' }, resumeBtn, closeOldBtn));
      }

      T.fill(T.app,
        h('a', { href: backHref, class: 'back' }, '← ' + q.title),
        h('div', { class: 'page-head' },
          h('span', { class: 'tag' }, c.name + ' · ' + c.grade),
          h('h1', null, '🎮 Đấu cả lớp: ' + q.title),
          h('p', { class: 'muted' }, baseQuestions.length + ' câu (' + parts.join(', ') + ')')),
        resumeBanner,
        h('div', { class: 'panel form game-setup-panel' },
          h('div', { class: 'field' },
            h('span', null, 'Thời gian suy nghĩ mỗi câu'),
            durBar),
          h('label', { class: 'check' }, shuffleBox, 'Trộn thứ tự câu hỏi'),
          h('div', { class: 'actions-start' }, openBtn)));
    }

    function createUniquePin(db, attempt) {
      if (attempt > 12) return Promise.reject(new Error('Không tạo được mã phòng trống. Vui lòng thử lại.'));
      var pin = String(Math.floor(100000 + Math.random() * 900000));
      return db.ref('rooms/' + pin).once('value').then(function (snap) {
        if (snap.exists()) return createUniquePin(db, attempt + 1);
        return pin;
      });
    }

    function runHostRoom(d, fb, hostState) {
      var q = d.quiz;
      var pin = hostState.pin;
      var questions = hostState.questions;
      var duration = hostState.duration;
      var roomRef = fb.db.ref('rooms/' + pin);

      var playersMap = (hostState.resumedRoom && hostState.resumedRoom.players) || {};
      var scoresMap = hostState.scores || (hostState.resumedRoom && hostState.resumedRoom.scores) || {};
      var phase = (hostState.resumedRoom && hostState.resumedRoom.state && hostState.resumedRoom.state.phase) || 'lobby';
      var curIndex = (hostState.resumedRoom && hostState.resumedRoom.state && typeof hostState.resumedRoom.state.index === 'number')
        ? hostState.resumedRoom.state.index : -1;

      roomActive = phase !== 'end';

      var stage = h('div', { class: 'game-host-stage' });
      var offAnswerListener = null;
      var stopQTimer = null;
      var lobbyListEl = null;
      var lobbyCountEl = null;
      var lobbyStartBtn = null;
      var qAnsweredEl = null;
      var currentQAnswers = {};
      var curStartedAt = (hostState.resumedRoom && hostState.resumedRoom.state && hostState.resumedRoom.state.startedAt) || 0;
      var revealing = false;

      T.fill(T.app, stage);

      function clearQuestionWatchers() {
        if (offAnswerListener) { offAnswerListener(); offAnswerListener = null; }
        if (stopQTimer) { stopQTimer(); stopQTimer = null; }
      }

      function persistLocal() {
        saveHostState(quizId, {
          pin: pin,
          quizId: q.id,
          duration: duration,
          questions: questions,
          scores: scoresMap,
          savedMatch: !!hostState.savedMatch
        });
      }

      function closeRoomAndExit(skipConfirm) {
        var doClose = function () {
          clearQuestionWatchers();
          roomActive = false;
          saveHostState(quizId, null);
          return roomRef.remove().catch(function () {}).then(function () {
            T.toast('Đã đóng phòng đấu.', 'success');
            T.go(backHref);
          });
        };
        if (skipConfirm) return doClose();
        T.confirmBox(
          'Đóng phòng đấu?',
          'Phòng ' + fmtPin(pin) + ' sẽ bị đóng và xóa khỏi hệ thống.',
          'Đóng phòng',
          doClose
        );
      }

      // Lắng nghe danh sách học sinh vào phòng trực tiếp
      tracker.on(roomRef.child('players'), 'value', function (snap) {
        playersMap = snap.val() || {};
        var uids = Object.keys(playersMap);
        if (phase === 'lobby') {
          updateLobbyPlayers();
        } else if (phase === 'question') {
          updateAnsweredCount();
          var ansCount = countValidAnswers(currentQAnswers, playersMap);
          if (uids.length > 0 && ansCount >= uids.length && !revealing) {
            revealQuestion(curIndex);
          }
        }
      });

      function countValidAnswers(ansObj, pMap) {
        var c = 0;
        Object.keys(ansObj || {}).forEach(function (u) {
          if (pMap[u]) c++;
        });
        return c;
      }

      function updateLobbyPlayers() {
        if (!lobbyListEl || !lobbyCountEl || !lobbyStartBtn) return;
        var list = Object.keys(playersMap).map(function (u) { return playersMap[u]; });
        list.sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
        lobbyCountEl.textContent = list.length + ' học sinh đã vào phòng';
        lobbyStartBtn.disabled = list.length < 1;
        if (!list.length) {
          T.fill(lobbyListEl, h('p', { class: 'muted' }, 'Đang chờ học sinh nhập mã vào phòng…'));
          return;
        }
        T.fill(lobbyListEl, list.map(function (p) {
          return h('span', { class: 'game-player-chip' }, p.name || p.username);
        }));
      }

      function updateAnsweredCount() {
        if (!qAnsweredEl) return;
        var totalP = Object.keys(playersMap).length;
        var ansP = countValidAnswers(currentQAnswers, playersMap);
        qAnsweredEl.textContent = 'Đã trả lời: ' + ansP + '/' + totalP;
      }

      function drawLobby() {
        clearQuestionWatchers();
        phase = 'lobby';
        roomActive = true;
        lobbyCountEl = h('span', { class: 'pill p-blue game-count-pill' }, '0 học sinh đã vào phòng');
        lobbyListEl = h('div', { class: 'game-players' });
        lobbyStartBtn = h('button', {
          class: 'btn btn-lg',
          disabled: true,
          onclick: function () { startQuestion(0, false); }
        }, '▶ Bắt đầu');

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('div', null,
              h('span', { class: 'tag' }, d.course.name + ' · ' + d.course.grade),
              h('h2', null, q.title)),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-ghost', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'),
              lobbyStartBtn)),
          h('div', { class: 'panel game-lobby-hero' },
            h('p', { class: 'game-lobby-step' }, 'Vào Khu học tập → 🎮 Đấu cả lớp → nhập mã'),
            h('div', {
              class: 'game-pin',
              title: 'Bấm để sao chép mã phòng',
              onclick: function () { T.copy(pin); }
            }, fmtPin(pin)),
            h('p', { class: 'muted small' }, 'Bấm vào mã phòng để sao chép · ' + questions.length + ' câu · ' + duration + ' giây/câu')),
          h('div', { class: 'panel' },
            h('div', { class: 'list-head', style: 'margin-bottom:14px' },
              h('h3', null, 'Danh sách học sinh'),
              lobbyCountEl),
            lobbyListEl));

        updateLobbyPlayers();
      }

      function startQuestion(idx, isResume) {
        clearQuestionWatchers();
        revealing = false;
        phase = 'question';
        curIndex = idx;
        roomActive = true;
        currentQAnswers = {};
        var item = questions[idx];

        var clockEl = h('span', { class: 'clock game-timer' }, '⏱ ' + duration + 's');
        qAnsweredEl = h('span', { class: 'pill p-blue game-count-pill' }, 'Đã trả lời: 0/' + Object.keys(playersMap).length);
        var skipBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          onclick: function () { revealQuestion(idx); }
        }, 'Bỏ qua thời gian ⏭');

        var optionsEl = null;
        if (item.type === 'mc') {
          optionsEl = h('div', { class: 'game-mc-grid' }, (item.options || []).map(function (optText, k) {
            var color = OPT_COLORS[k % OPT_COLORS.length];
            var sym = OPT_SYMS[k % OPT_SYMS.length];
            var letter = String.fromCharCode(65 + k);
            return h('div', { class: 'game-opt', style: '--opt-bg:' + color },
              h('span', { class: 'game-opt-sym' }, sym),
              h('span', { class: 'game-opt-letter' }, letter),
              h('span', { class: 'game-opt-text' }, optText));
          }));
        } else {
          optionsEl = h('div', { class: 'panel game-short-banner' },
            '✍️ Câu trả lời ngắn — học sinh nhập đáp án trên điện thoại và bấm Gửi.');
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Mã phòng: ' + fmtPin(pin) + ' · Câu ' + (idx + 1) + ' / ' + questions.length),
            clockEl,
            qAnsweredEl,
            h('div', { class: 'add-bar' },
              skipBtn,
              h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'))),
          h('div', { class: 'panel game-q-panel' },
            h('h2', { class: 'game-q-text prewrap' }, item.text || ''),
            item.image ? T.qImageEl({ kind: 'quiz', id: q.id, key: item.image }) : null),
          optionsEl);

        var applyPromise;
        if (isResume && curStartedAt) {
          applyPromise = Promise.resolve();
        } else {
          curStartedAt = serverNow();
          applyPromise = roomRef.update({
            state: {
              phase: 'question',
              index: idx,
              // Khóa câu dạng chuỗi: luật Firebase so với tên nút answers/$i (luôn là chuỗi).
              qkey: String(idx),
              total: questions.length,
              startedAt: window.firebase.database.ServerValue.TIMESTAMP,
              duration: duration
            },
            question: {
              index: idx,
              type: item.type,
              text: item.text,
              options: item.type === 'mc' ? item.options : null,
              image: item.image || null
            },
            reveal: null
          }).then(function () {
            return roomRef.child('state/startedAt').once('value').then(function (s) {
              if (s.val()) curStartedAt = Number(s.val());
            });
          });
        }

        applyPromise.then(function () {
          if (!tracker.alive() || phase !== 'question' || curIndex !== idx) return;

          offAnswerListener = tracker.on(roomRef.child('answers/' + idx), 'value', function (snap) {
            currentQAnswers = snap.val() || {};
            updateAnsweredCount();
            var totalP = Object.keys(playersMap).length;
            var ansP = countValidAnswers(currentQAnswers, playersMap);
            if (totalP > 0 && ansP >= totalP && !revealing) {
              revealQuestion(idx);
            }
          });

          function tick() {
            var leftMs = (Number(curStartedAt) + duration * 1000) - serverNow();
            var sec = Math.max(0, Math.ceil(leftMs / 1000));
            clockEl.textContent = '⏱ ' + sec + 's';
            clockEl.classList.toggle('low', sec <= 5);
            if (leftMs <= 0 && !revealing) {
              revealQuestion(idx);
            }
          }
          tick();
          stopQTimer = tracker.interval(tick, 200);
        });
      }

      function revealQuestion(idx) {
        if (revealing) return;
        revealing = true;
        clearQuestionWatchers();
        phase = 'reveal';
        var item = questions[idx];

        Promise.all([
          roomRef.child('answers/' + idx).once('value'),
          roomRef.child('players').once('value'),
          roomRef.child('state/startedAt').once('value')
        ]).then(function (snaps) {
          if (!tracker.alive()) return;
          var ansMap = snaps[0].val() || {};
          playersMap = snaps[1].val() || playersMap || {};
          var startedAt = Number(snaps[2].val() || curStartedAt || serverNow());

          var counts = item.type === 'mc'
            ? (item.options || []).map(function () { return 0; })
            : [0, 0];

          var pUids = Object.keys(playersMap);
          var newScores = {};

          pUids.forEach(function (u) {
            var prev = scoresMap[u] || { score: 0, correctCount: 0, streak: 0, lastCorrect: false, lastGain: 0, rank: 1 };
            var ans = ansMap[u];
            var hasAns = ans && ans.a !== undefined && ans.a !== null && ans.a !== '';
            var right = hasAns ? window.QuizFormat.isCorrect(item, ans.a) : false;

            if (item.type === 'mc') {
              if (hasAns) {
                var k = Number(ans.a);
                if (k >= 0 && k < counts.length) counts[k]++;
              }
            } else {
              if (right) counts[0]++;
              else counts[1]++;
            }

            var gain = 0;
            var streak = 0;
            if (right) {
              var elapsed = (ans && ans.t && startedAt)
                ? Math.max(0, Math.min(duration, (Number(ans.t) - startedAt) / 1000))
                : duration;
              var base = Math.round(1000 * (1 - 0.5 * (elapsed / duration)));
              streak = Number(prev.streak || 0) + 1;
              var bonus = streak >= 2 ? Math.min(500, 100 * (streak - 1)) : 0;
              gain = base + bonus;
            }

            newScores[u] = {
              score: Number(prev.score || 0) + gain,
              correctCount: Number(prev.correctCount || 0) + (right ? 1 : 0),
              streak: streak,
              lastCorrect: !!right,
              lastGain: gain,
              rank: 1
            };
          });

          var sortedUids = pUids.slice().sort(function (a, b) {
            if (newScores[b].score !== newScores[a].score) return newScores[b].score - newScores[a].score;
            if (newScores[b].correctCount !== newScores[a].correctCount) return newScores[b].correctCount - newScores[a].correctCount;
            return (playersMap[a].joinedAt || 0) - (playersMap[b].joinedAt || 0);
          });

          sortedUids.forEach(function (u, i) {
            newScores[u].rank = i + 1;
          });

          var top = sortedUids.slice(0, 5).map(function (u) {
            return {
              name: playersMap[u].name || playersMap[u].username || 'Học sinh',
              score: newScores[u].score
            };
          });

          var revealObj = {
            index: idx,
            correct: item.type === 'mc' ? Number(item.correct) : String((item.answers && item.answers[0]) || ''),
            counts: counts,
            top: top
          };

          scoresMap = newScores;
          persistLocal();

          return roomRef.update({
            'state/phase': 'reveal',
            reveal: revealObj,
            scores: newScores
          }).then(function () {
            if (!tracker.alive()) return;
            drawRevealView(idx, revealObj);
          });
        }).catch(function (err) {
          revealing = false;
          T.toast('Lỗi khi chấm câu hỏi: ' + err.message, 'error');
        });
      }

      function drawRevealView(idx, revealObj) {
        clearQuestionWatchers();
        phase = 'reveal';
        curIndex = idx;
        var item = questions[idx];
        var counts = revealObj.counts || [];
        var top = revealObj.top || [];
        var isLast = idx >= questions.length - 1;

        var nextBtn = h('button', {
          class: 'btn btn-lg' + (isLast ? ' btn-accent' : ''),
          onclick: function () {
            if (isLast) finishMatch();
            else startQuestion(idx + 1, false);
          }
        }, isLast ? '🏆 Xem kết quả' : 'Câu tiếp →');

        // Phần hiển thị đáp án đúng
        var answerHighlight;
        if (item.type === 'mc') {
          answerHighlight = h('div', { class: 'game-mc-grid game-mc-reveal' }, (item.options || []).map(function (optText, k) {
            var isRight = Number(item.correct) === k;
            var color = OPT_COLORS[k % OPT_COLORS.length];
            var sym = OPT_SYMS[k % OPT_SYMS.length];
            var letter = String.fromCharCode(65 + k);
            return h('div', {
              class: 'game-opt ' + (isRight ? 'is-correct' : 'is-dim'),
              style: '--opt-bg:' + color
            },
              h('span', { class: 'game-opt-sym' }, sym),
              h('span', { class: 'game-opt-letter' }, letter),
              h('span', { class: 'game-opt-text' }, optText),
              isRight ? h('span', { class: 'game-opt-check' }, '✓ Đúng') : null);
          }));
        } else {
          answerHighlight = h('div', { class: 'panel game-short-correct' },
            '✓ Đáp án đúng: ',
            h('strong', null, (item.answers || [revealObj.correct]).join('  |  ')));
        }

        // Biểu đồ cột số người chọn từng lựa chọn (mc) hoặc đúng/sai (short)
        var maxCount = Math.max.apply(null, counts.concat([1]));
        var chartCols;
        if (item.type === 'mc') {
          chartCols = (item.options || []).map(function (_, k) {
            var cnt = Number(counts[k] || 0);
            var pct = Math.round(cnt / maxCount * 100);
            var isRight = Number(item.correct) === k;
            var color = OPT_COLORS[k % OPT_COLORS.length];
            var sym = OPT_SYMS[k % OPT_SYMS.length];
            var letter = String.fromCharCode(65 + k);
            return h('div', { class: 'game-col' + (isRight ? ' is-correct' : '') },
              h('div', { class: 'game-col-count' }, (isRight ? '✓ ' : '') + cnt),
              h('div', { class: 'game-col-track' },
                h('div', { class: 'game-col-bar', style: 'height:' + Math.max(8, pct) + '%;--opt-bg:' + color })),
              h('div', { class: 'game-col-label', style: '--opt-bg:' + color }, sym + ' ' + letter));
          });
        } else {
          var cRight = Number(counts[0] || 0);
          var cWrong = Number(counts[1] || 0);
          var mShort = Math.max(1, cRight, cWrong);
          chartCols = [
            h('div', { class: 'game-col is-correct' },
              h('div', { class: 'game-col-count' }, '✓ ' + cRight),
              h('div', { class: 'game-col-track' },
                h('div', { class: 'game-col-bar', style: 'height:' + Math.max(8, Math.round(cRight / mShort * 100)) + '%;--opt-bg:#0f9d74' })),
              h('div', { class: 'game-col-label', style: '--opt-bg:#0f9d74' }, '✓ Đúng')),
            h('div', { class: 'game-col' },
              h('div', { class: 'game-col-count' }, String(cWrong)),
              h('div', { class: 'game-col-track' },
                h('div', { class: 'game-col-bar', style: 'height:' + Math.max(8, Math.round(cWrong / mShort * 100)) + '%;--opt-bg:#e21b3c' })),
              h('div', { class: 'game-col-label', style: '--opt-bg:#e21b3c' }, '✗ Sai / Chưa TL'))
          ];
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Kết quả câu ' + (idx + 1) + ' / ' + questions.length),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'),
              nextBtn)),
          h('div', { class: 'panel game-q-panel compact' },
            h('h2', { class: 'game-q-text sm prewrap' }, item.text || ''),
            item.image ? T.qImageEl({ kind: 'quiz', id: q.id, key: item.image }) : null,
            item.explain ? h('div', { class: 'explain' }, h('strong', null, '💡 Lời giải: '), h('span', { class: 'prewrap' }, item.explain)) : null),
          answerHighlight,
          h('div', { class: 'game-reveal-grid' },
            h('div', { class: 'panel' },
              h('h3', { class: 'game-subhead' }, 'Thống kê câu trả lời'),
              h('div', { class: 'game-chart' }, chartCols)),
            h('div', { class: 'panel' },
              h('h3', { class: 'game-subhead' }, '🔥 Top 5 dẫn đầu'),
              top.length ? h('div', { class: 'game-top-list' }, top.map(function (t, i) {
                return h('div', { class: 'game-top-row' },
                  h('span', { class: 'game-top-rank' }, '#' + (i + 1)),
                  h('strong', { class: 'game-top-name' }, t.name),
                  h('span', { class: 'pill p-done' }, T.fmtScore(t.score) + ' đ'));
              })) : h('p', { class: 'muted' }, 'Chưa có dữ liệu điểm.'))));
      }

      function finishMatch() {
        clearQuestionWatchers();
        phase = 'end';
        roomActive = false;
        roomRef.child('state/phase').set('end').catch(function () {});
        drawEndView();
      }

      function drawEndView() {
        clearQuestionWatchers();
        phase = 'end';
        roomActive = false;

        var pUids = Object.keys(playersMap);
        Object.keys(scoresMap).forEach(function (u) {
          if (pUids.indexOf(u) < 0) pUids.push(u);
        });

        var results = pUids.map(function (u) {
          var p = playersMap[u] || {};
          var s = scoresMap[u] || { score: 0, correctCount: 0, rank: 999 };
          return {
            uid: u,
            username: p.username || '',
            fullName: p.name || p.username || 'Học sinh',
            score: Number(s.score || 0),
            correctCount: Number(s.correctCount || 0),
            joinedAt: p.joinedAt || 0
          };
        }).sort(function (a, b) {
          if (b.score !== a.score) return b.score - a.score;
          if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
          return a.joinedAt - b.joinedAt;
        });

        results.forEach(function (r, i) { r.rank = i + 1; });

        var podiumOrder = [
          { r: results[1], medal: '🥈', cls: 'podium-2', place: 'Hạng Nhì' },
          { r: results[0], medal: '🥇', cls: 'podium-1', place: 'Hạng Nhất' },
          { r: results[2], medal: '🥉', cls: 'podium-3', place: 'Hạng Ba' }
        ];

        var saveStatusBox = h('div', { class: 'game-save-status' });

        function saveMatchToSheets() {
          if (hostState.savedMatch) {
            T.fill(saveStatusBox, h('span', { class: 'pill p-done' }, '✓ Đã lưu kết quả vào Google Sheets'));
            return;
          }
          T.fill(saveStatusBox, T.loading('Đang lưu kết quả trận đấu…'));
          var payload = {
            quizId: q.id,
            questionCount: questions.length,
            playerCount: results.length,
            results: results.map(function (r) {
              return {
                username: r.username,
                fullName: r.fullName,
                score: r.score,
                correctCount: r.correctCount,
                rank: r.rank
              };
            })
          };
          T.api('saveMatch', payload).then(function () {
            hostState.savedMatch = true;
            persistLocal();
            T.toast('Đã lưu kết quả trận đấu vào Google Sheets.', 'success');
            if (!tracker.alive()) return;
            T.fill(saveStatusBox, h('span', { class: 'pill p-done' }, '✓ Đã lưu kết quả vào Google Sheets'));
          }, function (err) {
            T.toast('Chưa lưu được kết quả: ' + err.message, 'error');
            if (!tracker.alive()) return;
            T.fill(saveStatusBox,
              h('span', { class: 'err small' }, 'Chưa lưu được kết quả: ' + err.message + ' '),
              h('button', { class: 'btn btn-sm', onclick: saveMatchToSheets }, 'Thử lưu lại'));
          });
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('div', null,
              h('span', { class: 'tag' }, 'Kết thúc trận đấu · Phòng ' + fmtPin(pin)),
              h('h1', null, '🏆 Bảng vàng chung cuộc: ' + q.title)),
            h('div', { class: 'add-bar' },
              saveStatusBox,
              h('button', { class: 'btn btn-lg', onclick: function () { closeRoomAndExit(true); } }, 'Đóng phòng'))),
          results.length ? h('div', { class: 'panel game-podium-panel' },
            h('div', { class: 'game-podium' }, podiumOrder.map(function (slot) {
              if (!slot.r) return h('div', { class: 'game-podium-col empty ' + slot.cls });
              return h('div', { class: 'game-podium-col ' + slot.cls },
                h('div', { class: 'game-podium-medal' }, slot.medal),
                h('strong', { class: 'game-podium-name' }, slot.r.fullName),
                h('span', { class: 'game-podium-score' }, T.fmtScore(slot.r.score) + ' điểm'),
                h('span', { class: 'muted small' }, 'Đúng ' + slot.r.correctCount + '/' + questions.length + ' câu'),
                h('div', { class: 'game-podium-pedestal' }, slot.place));
            }))) : null,
          h('div', { class: 'panel' },
            h('h3', { class: 'game-subhead' }, 'Bảng xếp hạng đầy đủ (' + results.length + ' học sinh)'),
            results.length ? h('div', { class: 'table-wrap' },
              h('table', { class: 'table' },
                h('thead', null,
                  h('tr', null,
                    h('th', null, 'Hạng'),
                    h('th', null, 'Học sinh'),
                    h('th', null, 'Số câu đúng'),
                    h('th', null, 'Tổng điểm'))),
                h('tbody', null, results.map(function (r) {
                  var medal = r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : '';
                  return h('tr', null,
                    h('td', null, h('strong', null, medal + '#' + r.rank)),
                    h('td', null, r.fullName, r.username ? h('span', { class: 'muted small' }, ' (' + r.username + ')') : null),
                    h('td', null, r.correctCount + ' / ' + questions.length),
                    h('td', null, h('span', { class: 'pill p-done' }, T.fmtScore(r.score) + ' điểm')));
                })))) : h('p', { class: 'muted' }, 'Không có học sinh nào tham gia.')));

        saveMatchToSheets();
      }

      // Khởi chạy màn hình phù hợp (kể cả khi giáo viên tải lại trang và tiếp tục phòng đang mở)
      if (phase === 'question' && curIndex >= 0 && curIndex < questions.length) {
        startQuestion(curIndex, true);
      } else if (phase === 'reveal' && curIndex >= 0 && curIndex < questions.length && hostState.resumedRoom && hostState.resumedRoom.reveal) {
        drawRevealView(curIndex, hostState.resumedRoom.reveal);
      } else if (phase === 'end') {
        drawEndView();
      } else {
        drawLobby();
      }
    }
  }

  window.TTMGame = {
    renderHost: renderHost,
    renderJoin: renderJoin,
    renderPlay: renderPlay
  };

  // Nếu mở trực tiếp đường dẫn #/dau hoặc #/dau-host khi mới tải trang, gọi lại route() sau khi TTMGame đã sẵn sàng
  if (/^#\/?dau(-host)?(\/|$)/.test(location.hash) && window.TTM && window.TTM.route) {
    window.TTM.route();
  }
})();
