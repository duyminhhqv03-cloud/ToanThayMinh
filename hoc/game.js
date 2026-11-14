/* Đấu cả lớp (kiểu Kahoot) – Toán Thầy Minh
 * Thời gian thực qua Firebase Realtime Database + Anonymous Auth; kết quả cuối trận lưu vào Google Sheets.
 */
(function () {
  'use strict';

  var FB_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var SERVER_TS = { '.sv': 'timestamp' };
  var OPT_SYMS = ['▲', '◆', '●', '■', '★', '⬢', '♥', '✦'];
  var OPT_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7c3aed', '#0891b2', '#db2777', '#ea580c'];
  var DURATIONS = [10, 20, 30, 45, 60, 90, 120];
  var DUR_MIN = 5;
  var DUR_MAX = 300; // khớp luật Firebase state/duration (5–300 giây)

  function validDuration(v) {
    v = Math.round(Number(v));
    return (isFinite(v) && v >= DUR_MIN && v <= DUR_MAX) ? v : 0;
  }
  var MISSING_CFG_MSG = 'Chức năng đấu cả lớp chưa được cài đặt (thiếu FIREBASE_CONFIG trong hoc/config.js)';

  var fbPromise = null;
  var serverOffset = 0;
  var offsetListening = false;

  function hasConfig() {
    if (window.TTMDemo && window.TTMDemo.isDemo()) return true;
    var c = window.FIREBASE_CONFIG;
    return !!(c && typeof c === 'object' && c.apiKey && c.databaseURL);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Không tải được thư viện thời gian thực. Kiểm tra kết nối mạng rồi thử lại.')); };
      document.head.appendChild(s);
    });
  }

  /** Chỉ nạp động SDK Firebase khi người dùng mở trang đấu, rồi đăng nhập ẩn danh. */
  function ensureFirebase() {
    if (window.TTMDemo && window.TTMDemo.isDemo()) {
      var role = window.TTMDemo.demoRole();
      var demoDb = window.parent && window.parent.__ttmDemoDb;
      if (!offsetListening && demoDb) {
        offsetListening = true;
        demoDb.ref('.info/serverTimeOffset').on('value', function (snap) {
          serverOffset = Number(snap.val() || 0);
        });
      }
      return Promise.resolve({
        db: demoDb,
        auth: null,
        uid: role === 'host' ? 'demo-host' : 'demo-hs'
      });
    }

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

  // Bộ câu hỏi soạn sẵn, giáo viên bấm một nút là điền vào ô nhập đề.
  var GAME_PRESETS = [
    { label: 'Dùng bộ 15 từ Energy & Resources', title: 'Ôn nhanh 15 từ vựng Energy & Resources', file: '../de-mau/energy-resources-15-tu.txt' }
  ];

  var TEAMS = [
    { name: 'Nhóm Đỏ', icon: '🔴', color: '#e21b3c' },
    { name: 'Nhóm Xanh', icon: '🔵', color: '#1368ce' },
    { name: 'Nhóm Vàng', icon: '🟡', color: '#d89e00' }
  ];

  function splitTeams(uids, n) {
    if (window.TTMModes && window.TTMModes.splitTeams) {
      return window.TTMModes.splitTeams(uids, n, shuffleArray);
    }
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var shuffled = shuffleArray(uids || []);
    var res = {};
    for (var i = 0; i < shuffled.length; i++) {
      res[shuffled[i]] = i % count;
    }
    return res;
  }

  function teamStandings(teamOf, playersMap, scoresMap, n) {
    if (window.TTMModes && window.TTMModes.teamStandings) {
      return window.TTMModes.teamStandings(teamOf, playersMap, scoresMap, n);
    }
    teamOf = teamOf || {};
    playersMap = playersMap || {};
    scoresMap = scoresMap || {};
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var list = [];
    for (var t = 0; t < count; t++) {
      var total = 0;
      var cnt = 0;
      for (var uid in playersMap) {
        if (Object.prototype.hasOwnProperty.call(playersMap, uid)) {
          if (teamOf[uid] === t) {
            cnt++;
            var sObj = scoresMap[uid];
            total += (sObj && typeof sObj.score === 'number') ? sObj.score : 0;
          }
        }
      }
      if (cnt > 0) {
        var avg = Math.round(total / cnt * 10) / 10;
        list.push({ t: t, avg: avg, total: total, n: cnt, rank: 1 });
      }
    }
    list.sort(function (a, b) {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.total !== a.total) return b.total - a.total;
      return a.t - b.t;
    });
    for (var i = 0; i < list.length; i++) {
      if (i > 0 && list[i].avg === list[i - 1].avg) {
        list[i].rank = list[i - 1].rank;
      } else {
        list[i].rank = i + 1;
      }
    }
    return list;
  }

  function smallestTeam(teamOf, playersMap, n) {
    if (window.TTMModes && window.TTMModes.smallestTeam) {
      return window.TTMModes.smallestTeam(teamOf, playersMap, n);
    }
    teamOf = teamOf || {};
    playersMap = playersMap || {};
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var counts = [];
    for (var k = 0; k < count; k++) counts.push(0);
    for (var uid in playersMap) {
      if (Object.prototype.hasOwnProperty.call(playersMap, uid)) {
        var t = teamOf[uid];
        if (typeof t === 'number' && t >= 0 && t < count) {
          counts[t]++;
        }
      }
    }
    var minIdx = 0;
    var minCount = counts[0];
    for (var i = 1; i < count; i++) {
      if (counts[i] < minCount) {
        minCount = counts[i];
        minIdx = i;
      }
    }
    return minIdx;
  }

  function playerNameOf(playersMap, uid) {
    if (!playersMap || !uid || !playersMap[uid]) return 'bạn cùng nhóm';
    return playersMap[uid].name || playersMap[uid].username || 'Học sinh';
  }

  function teamBoardEl(teams, myTeam, gameType) {
    var T = window.TTM;
    var h = T.h;
    if (!teams || !teams.length) {
      return h('p', { class: 'muted' }, 'Chưa có dữ liệu điểm nhóm.');
    }
    return h('div', { class: 'game-team-board' }, teams.map(function (tm) {
      var info = TEAMS[tm.t] || { name: 'Nhóm ' + (tm.t + 1), icon: '👥', color: '#1368ce' };
      var isMine = (myTeam !== null && myTeam !== undefined && Number(myTeam) === Number(tm.t));
      var medal = tm.rank === 1 ? '🥇 ' : tm.rank === 2 ? '🥈 ' : tm.rank === 3 ? '🥉 ' : '';
      var subText;
      var badgeText;
      if (gameType === 'race') {
        var stepVal = tm.value !== undefined ? tm.value : (tm.avg || 0);
        subText = (tm.pct !== undefined ? Math.round(tm.pct) + '% đường đua · ' : '') + tm.n + ' bạn';
        badgeText = T.fmtScore(Math.round(stepVal * 10) / 10) + ' bước';
      } else if (gameType === 'relay') {
        var rVal = tm.value !== undefined ? tm.value : (tm.total || 0);
        subText = 'Tiếp sức · ' + tm.n + ' bạn';
        badgeText = T.fmtScore(rVal) + ' điểm';
      } else if (gameType === 'tug') {
        var adv = tm.value !== undefined ? tm.value : 0;
        subText = 'TB cá nhân ' + T.fmtScore(tm.avg || 0) + ' đ · ' + tm.n + ' bạn';
        badgeText = adv > 0 ? ('+' + T.fmtScore(adv) + '% dây') : (adv < 0 ? (T.fmtScore(adv) + '% dây') : (T.fmtScore(tm.avg || 0) + ' đ'));
      } else {
        subText = 'Tổng ' + T.fmtScore(tm.total || 0) + ' đ · ' + tm.n + ' bạn';
        badgeText = T.fmtScore(tm.avg || 0) + ' đ';
      }
      return h('div', {
        class: 'game-team-row' + (isMine ? ' is-mine' : ''),
        style: '--team-color:' + info.color
      },
        h('span', { class: 'game-team-rank' }, medal + '#' + tm.rank),
        h('div', { class: 'game-team-info' },
          h('div', { class: 'game-team-name' },
            h('span', { class: 'game-team-dot' }, info.icon),
            h('strong', null, info.name),
            isMine ? h('span', { class: 'pill p-blue small game-team-mine-badge' }, 'Nhóm của em') : null
          ),
          h('div', { class: 'muted small' }, subText)
        ),
        h('div', { class: 'game-team-score' },
          h('span', { class: 'pill p-done game-team-avg' }, badgeText)
        )
      );
    }));
  }

  function raceTrackEl(positions, total, teamOf, playersMap, compact) {
    var T = window.TTM;
    var h = T.h;
    var M = window.TTMModes;
    var posArr = M ? M.toNumArray(positions, 3, 0) : [0, 0, 0];
    var tot = Math.max(1, Number(total) || 1);
    var lanes = [0, 1, 2].map(function (t) {
      var info = TEAMS[t];
      var pos = Math.max(0, Math.min(tot, Number(posArr[t] || 0)));
      var pct = Math.min(100, Math.max(0, Math.round((pos / tot) * 1000) / 10));
      return h('div', {
        class: 'game-race-lane',
        style: '--team-color:' + info.color
      },
        h('div', { class: 'game-race-head' },
          h('span', { class: 'game-race-team' }, info.icon + ' ' + info.name),
          h('span', { class: 'game-race-step' }, T.fmtScore(Math.round(pos * 10) / 10) + '/' + tot + ' bước')
        ),
        h('div', { class: 'game-race-rail' },
          h('div', { class: 'game-race-fill', style: 'width:' + pct + '%' }),
          h('div', { class: 'game-race-finish', title: 'Vạch đích' }, '🏁'),
          h('div', { class: 'game-race-runner', style: 'left:' + pct + '%' }, info.icon)
        )
      );
    });
    return h('div', { class: 'panel game-race-track' + (compact ? ' is-compact' : '') }, lanes);
  }

  function tugRopeEl(rope, compact) {
    var T = window.TTM;
    var h = T.h;
    var r = Math.max(-100, Math.min(100, Number(rope || 0)));
    if (!isFinite(r)) r = 0;
    var knotLeft = Math.round((50 - r / 2) * 10) / 10;
    var statusText;
    if (r >= 100) statusText = '🏆 Nhóm Đỏ kéo thắng tuyệt đối!';
    else if (r <= -100) statusText = '🏆 Nhóm Xanh kéo thắng tuyệt đối!';
    else if (r > 0) statusText = 'Nhóm Đỏ đang kéo lệch +' + T.fmtScore(Math.abs(r)) + '%';
    else if (r < 0) statusText = 'Nhóm Xanh đang kéo lệch +' + T.fmtScore(Math.abs(r)) + '%';
    else statusText = 'Hai nhóm đang cân bằng (0%)';

    return h('div', { class: 'panel game-tug-wrap' + (compact ? ' is-compact' : '') },
      h('div', { class: 'game-tug-ends' },
        h('span', { class: 'game-tug-side is-red' }, '🔴 Nhóm Đỏ'),
        h('span', { class: 'game-tug-status muted small' }, statusText),
        h('span', { class: 'game-tug-side is-blue' }, '🔵 Nhóm Xanh')
      ),
      h('div', { class: 'game-tug-track' },
        h('div', { class: 'game-tug-zone is-red' }),
        h('div', { class: 'game-tug-zone is-blue' }),
        h('div', { class: 'game-tug-rope-line' }),
        h('div', { class: 'game-tug-center', title: 'Vạch giữa' }),
        h('div', { class: 'game-tug-knot', style: 'left:' + knotLeft + '%' }, '🪢')
      )
    );
  }

  function relayStatusEl(relayMap, teamOf, playersMap, points, compact) {
    var T = window.TTM;
    var h = T.h;
    var M = window.TTMModes;
    var pts = M ? M.toNumArray(points, 3, 0) : [0, 0, 0];
    var cols = [0, 1, 2].map(function (t) {
      var info = TEAMS[t];
      var slot = relayMap && (relayMap[t] || relayMap[String(t)]);
      var turnNote;
      if (!slot) {
        turnNote = 'Chưa có thành viên';
      } else if (slot.done && slot.ok) {
        var winName = playerNameOf(playersMap, slot.uid);
        var gained = slot.gain || (M ? M.relayPoints(slot.tried) : 100);
        turnNote = '✅ ' + winName + ' trả lời đúng (+' + T.fmtScore(gained) + ' đ)';
      } else if (slot.done && !slot.ok) {
        turnNote = '❌ Cả nhóm đã hết lượt';
      } else {
        var curName = playerNameOf(playersMap, slot.uid);
        turnNote = '⚡ Đang tới lượt: ' + curName + (slot.tried ? ' (lượt ' + (Number(slot.tried) + 1) + ')' : '');
      }
      return h('div', {
        class: 'game-relay-col',
        style: '--team-color:' + info.color
      },
        h('div', { class: 'game-relay-col-head' },
          h('strong', { style: 'color:' + info.color }, info.icon + ' ' + info.name),
          h('span', { class: 'pill p-done small' }, T.fmtScore(pts[t]) + ' điểm')
        ),
        h('div', { class: 'game-relay-col-turn small' }, turnNote)
      );
    });
    return h('div', { class: 'game-relay-strip' + (compact ? ' is-compact' : '') }, cols);
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
    var viewer = T.getMe();
    if (viewer && viewer.role !== 'student') return renderTeacherHub();

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
      if (!(window.TTMDemo && window.TTMDemo.isDemo())) {
        T.store.set('ttm_last_pin', pin);
      }
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

  /* ═══════════════════ MÀN HÌNH GIÁO VIÊN: QUẢN LÝ GAME (#/dau) ═══════════════════ */

  function loadPreset(preset) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', preset.file);
      xhr.onload = function () {
        if (xhr.status === 200) resolve(xhr.responseText);
        else reject(new Error('Không tải được bộ câu hỏi có sẵn.'));
      };
      xhr.onerror = function () { reject(new Error('Không tải được bộ câu hỏi có sẵn.')); };
      xhr.send();
    });
  }

  function renderTeacherHub() {
    var T = window.TTM;
    var h = T.h;
    var seq = T.getSeq();
    var box = h('div', { class: 'game-hub-box' });
    var classBar = h('div', { class: 'chips filter' });
    var formDirty = false;
    var courses = [];
    var curId = '';

    T.setLeaveGuard(function () { return formDirty; }, 'Bài đấu chưa được lưu. Rời trang?');
    T.fill(T.app, T.loading('Đang tải danh sách lớp…'));

    T.api('courses').then(function (r) {
      if (!T.isCurrent(seq)) return;
      courses = (r.courses || []).filter(function (c) { return c.canEdit; });
      T.fill(T.app,
        h('a', { href: '#/ung-dung', class: 'back' }, '← Ứng dụng'),
        h('div', { class: 'page-head' },
          h('h1', null, '🎮 Đấu cả lớp'),
          h('p', { class: 'muted' }, 'Chọn lớp, thêm bài đấu rồi mở phòng cho học sinh nhập mã.')),
        h('div', { class: 'panel' },
          h('h3', { class: 'game-subhead' }, 'Chọn lớp'),
          courses.length ? classBar : h('p', { class: 'muted' }, 'Bạn chưa được giao quản lý lớp nào.')),
        box);
      if (!courses.length) return;
      var saved = T.store.get('ttm_game_course');
      var found = courses.filter(function (c) { return c.id === saved; })[0];
      pickCourse((found || courses[0]).id);
    }).catch(function (err) {
      if (!T.isCurrent(seq)) return;
      T.fill(T.app, T.errorBox(err.message || 'Không tải được danh sách lớp.', renderTeacherHub));
    });

    function pickCourse(id) {
      if (formDirty && !confirm('Bài đấu chưa được lưu. Đổi lớp?')) return;
      formDirty = false;
      curId = id;
      T.store.set('ttm_game_course', id);
      T.fill(classBar, courses.map(function (c) {
        return h('button', {
          type: 'button',
          class: 'chip-btn' + (c.id === curId ? ' active' : ''),
          onclick: function () { pickCourse(c.id); }
        }, c.name + (c.grade ? ' · ' + c.grade : ''));
      }));
      loadQuizzes();
    }

    function loadQuizzes() {
      var id = curId;
      T.fill(box, T.loading('Đang tải bài đấu của lớp…'));
      T.api('course', { courseId: id }).then(function (cd) {
        if (!T.isCurrent(seq) || id !== curId) return;
        drawQuizzes(cd);
      }).catch(function (err) {
        if (!T.isCurrent(seq) || id !== curId) return;
        T.fill(box, T.errorBox(err.message || 'Không tải được bài đấu của lớp.', loadQuizzes));
      });
    }

    function drawQuizzes(cd) {
      var formBox = h('div');
      var quizzes = cd.quizzes || [];
      T.fill(box,
        h('div', { class: 'list-head game-hub-head' },
          h('h2', null, 'Bài đấu của lớp (' + quizzes.length + ')'),
          h('div', { class: 'add-bar' },
            h('button', { type: 'button', class: 'btn', onclick: function () {
              if (formDirty && !confirm('Bài đấu đang soạn chưa được lưu. Bỏ nội dung này?')) return;
              formDirty = false;
              drawGameWizard(cd, formBox);
            } }, '✨ Tạo game từ đề + đáp án'),
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () {
              if (formDirty && !confirm('Bài đấu đang soạn chưa được lưu. Bỏ nội dung này?')) return;
              formDirty = false;
              drawAddForm(cd, formBox);
            } }, '+ Thêm bài đấu'))),
        formBox,
        quizzes.length
          ? h('div', { class: 'game-hub-list' }, quizzes.map(function (x) { return quizRow(x, cd); }))
          : h('div', { class: 'panel empty' }, h('p', { class: 'muted' }, 'Lớp này chưa có bài nào. Bấm "✨ Tạo game từ đề + đáp án" hoặc "+ Thêm bài đấu" để tạo bài đầu tiên.')));
    }

    function quizRow(x, cd) {
      var meta = (x.count || 0) + ' câu' + (x.branch ? ' · ' + x.branch : '') + (x.topic ? ' · ' + x.topic : '');
      var visible = h('input', { type: 'checkbox', checked: !x.gameOnly });
      var stateText = h('span', null, x.gameOnly ? 'Đang ẩn với học sinh' : 'Đang hiện cho học sinh');
      visible.addEventListener('change', function () {
        var show = visible.checked;
        visible.disabled = true;
        stateText.textContent = 'Đang lưu…';
        setQuizVisible(x.id, show).then(function () {
          x.gameOnly = !show;
          T.forgetCourse(cd.course.id);
          T.toast(show ? 'Học sinh đã thấy bài này trong lớp.' : 'Đã ẩn bài này với học sinh.', 'success');
        }).catch(function (err) {
          visible.checked = !show;
          T.toast(err.message || 'Không đổi được trạng thái hiển thị.', 'error');
        }).then(function () {
          visible.disabled = false;
          stateText.textContent = x.gameOnly ? 'Đang ẩn với học sinh' : 'Đang hiện cho học sinh';
        });
      });
      return h('div', { class: 'panel game-hub-row' },
        h('div', { class: 'game-hub-info' },
          h('strong', null, x.title),
          h('span', { class: 'muted small' }, meta)),
        h('label', { class: 'check game-hub-toggle' }, visible, stateText),
        h('div', { class: 'add-bar' },
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/soan-de/' + encodeURIComponent(cd.course.id) + '/' + x.id); } }, 'Sửa'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/dau-host/' + encodeURIComponent(x.id) + '/on-tap'); } }, '⚡ Ôn từ vựng'),
          !(window.TTMDemo && window.TTMDemo.isDemo()) ? h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/dau-demo/' + encodeURIComponent(x.id)); } }, '👀 Xem thử như học sinh') : null,
          h('button', { class: 'btn btn-sm', onclick: function () { T.go('#/dau-host/' + encodeURIComponent(x.id)); } }, '🎮 Mở phòng'),
          h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () {
            if (formDirty && !confirm('Bài đấu đang soạn chưa được lưu. Bỏ nội dung này?')) return;
            T.confirmBox('Xóa bài đấu?', 'Xóa "' + x.title + '" cùng kết quả luyện tập của học sinh ở bài này. Không thể hoàn tác.', 'Xóa', function () {
              return T.api('deleteQuiz', { id: x.id }).then(function () {
                formDirty = false;
                cd.quizzes = (cd.quizzes || []).filter(function (o) { return o.id !== x.id; });
                T.forgetCourse(cd.course.id);
                T.toast('Đã xóa bài đấu.', 'success');
                drawQuizzes(cd);
              });
            });
          } }, 'Xóa')));
    }

    /** saveQuiz ghi đè cả bài nên phải đọc đủ nội dung rồi gửi lại, chỉ đổi cờ gameOnly. */
    function setQuizVisible(quizId, show) {
      return T.api('quiz', { id: quizId }).then(function (d) {
        return T.api('saveQuiz', {
          id: quizId,
          title: d.quiz.title,
          topic: d.quiz.topic,
          branch: d.branch || d.quiz.branch || '',
          description: d.description || '',
          timeLimit: d.quiz.timeLimit,
          showAnswers: d.quiz.showAnswers,
          gameOnly: !show,
          source: d.source,
          questions: d.fullQuestions
        });
      });
    }

    function drawAddForm(cd, formBox) {
      var c = cd.course;
      var title = h('input', { maxlength: '200', placeholder: 'VD: Ôn nhanh từ vựng Energy' });
      var br = T.branchSelect(c, '');
      var topic = T.topicInput(cd.topics, '');
      var src = h('textarea', { class: 'game-hub-src', rows: '12', spellcheck: 'false', placeholder: window.QuizFormat.SAMPLE });
      var visible = h('input', { type: 'checkbox' });
      var status = h('div', { class: 'parse-status' });
      var parsed = { questions: [], errors: [] };
      var saveBtn = h('button', { class: 'btn' }, 'Lưu bài đấu');

      function update() {
        formDirty = !!(src.value.trim() || title.value.trim());
        parsed = window.QuizFormat.parse(src.value);
        if (!src.value.trim()) {
          T.fill(status, h('span', { class: 'muted' }, 'Dán đề vào ô trên, mỗi câu bắt đầu bằng "Câu 1:", đáp án đúng có dấu * trước chữ cái.'));
          return;
        }
        T.fill(status, parsed.errors.length
          ? h('div', { class: 'errors' }, h('strong', null, 'Cần sửa ' + parsed.errors.length + ' lỗi:'), h('ul', null, parsed.errors.map(function (e) { return h('li', null, e); })))
          : h('span', { class: 'ok' }, '✓ Đọc được ' + parsed.questions.length + ' câu, không có lỗi.'));
      }
      src.addEventListener('input', update);
      title.addEventListener('input', update);

      saveBtn.addEventListener('click', function () {
        update();
        if (!title.value.trim()) return T.toast('Vui lòng nhập tên bài đấu.', 'error');
        if (!src.value.trim()) return T.toast('Vui lòng dán nội dung đề.', 'error');
        if (parsed.errors.length) return T.toast('Đề còn lỗi, xem danh sách lỗi bên dưới ô nhập.', 'error');
        T.busy(saveBtn, true, 'Đang lưu…');
        T.api('saveQuiz', {
          courseId: c.id,
          title: title.value.trim(),
          topic: topic[0].value.trim(),
          branch: br ? br.value : '',
          description: '',
          timeLimit: 0,
          showAnswers: true,
          gameOnly: !visible.checked,
          source: src.value,
          questions: parsed.questions
        }).then(function () {
          formDirty = false;
          T.forgetCourse(c.id);
          T.toast('Đã lưu bài đấu.', 'success');
          if (T.isCurrent(seq)) loadQuizzes();
        }, function (err) {
          T.busy(saveBtn, false);
          T.toast(err.message || 'Không lưu được bài đấu.', 'error');
        });
      });

      var presetBtns = GAME_PRESETS.map(function (p) {
        return h('button', {
          type: 'button',
          class: 'btn btn-sm btn-ghost',
          onclick: function () {
            if (src.value.trim() && !confirm('Thay nội dung đang có bằng bộ câu hỏi này?')) return;
            loadPreset(p).then(function (text) {
              src.value = text;
              if (!title.value.trim()) title.value = p.title;
              update();
            }).catch(function (err) { T.toast(err.message, 'error'); });
          }
        }, '📋 ' + p.label);
      });

      T.fill(formBox,
        h('div', { class: 'panel form game-hub-form' },
          h('h3', { class: 'game-subhead' }, 'Thêm bài đấu cho ' + c.name + (c.grade ? ' · ' + c.grade : '')),
          h('div', { class: 'row' + (br ? '' : ' two') }, T.field('Tên bài', title), br ? T.field('Nhánh', br) : null, T.field('Chủ đề', topic)),
          h('div', { class: 'add-bar' }, presetBtns),
          T.field('Nội dung đề', src),
          status,
          h('label', { class: 'check' }, visible, 'Hiện cho học sinh luyện tập (bỏ chọn: chỉ dùng để đấu)'),
          h('div', { class: 'actions-start' },
            saveBtn,
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () {
              if (formDirty && !confirm('Bỏ bài đấu đang soạn?')) return;
              formDirty = false;
              T.fill(formBox);
            } }, 'Hủy'))));
      update();
      formDirty = false;
      title.focus();
    }

    function defaultWizardTitle(course) {
      var now = new Date();
      var dd = now.getDate();
      var mm = now.getMonth() + 1;
      var dateStr = (dd < 10 ? '0' : '') + dd + '/' + (mm < 10 ? '0' : '') + mm;
      var cName = (course && course.name) ? course.name : 'Lớp';
      return 'Game ' + cName + ' ' + dateStr;
    }

    function loadSavedClassSize(courseId) {
      var raw = T.store.get('ttm_game_size_' + courseId);
      if (!raw) return '';
      var n = parseInt(raw, 10);
      if (isFinite(n) && n >= 1 && n <= 100) return String(n);
      return '';
    }

    function drawGameWizard(initialCd, formBox) {
      var QF = window.QuizFormat;
      var imgStore = T.imageStore ? T.imageStore('quiz', null, []) : null;
      var wiz = {
        step: 1,
        deText: '',
        dapAnText: '',
        fixSource: '',
        hasRead: false,
        showFixBox: false,
        previewOpen: false,
        essayDropped: 0,
        guessedCount: 0,
        noQuestionErr: '',
        questions: [],
        errors: [],
        courseId: initialCd.course.id,
        courseData: initialCd,
        branch: '',
        sizeStr: loadSavedClassSize(initialCd.course.id),
        minutes: 10,
        customMinStr: '',
        title: defaultWizardTitle(initialCd.course),
        titleTouched: false,
        selectedGame: ''
      };

      var stepBar = h('div', { class: 'game-wiz-steps' });
      var bodyBox = h('div', { class: 'game-wiz-body' });

      function syncDirty() {
        formDirty = !!(wiz.deText.trim() || wiz.dapAnText.trim() || wiz.fixSource.trim() || wiz.questions.length);
      }

      function cancelWizard() {
        if (formDirty && !confirm('Bỏ bài đấu đang tạo?')) return;
        formDirty = false;
        T.fill(formBox);
      }

      function drawStepBar() {
        var labels = ['1 Đề và đáp án', '2 Thông tin lớp', '3 Chọn game'];
        var nodes = [];
        for (var i = 0; i < labels.length; i++) {
          var sNum = i + 1;
          var cls = 'game-wiz-step';
          if (wiz.step === sNum) cls += ' is-active';
          else if (wiz.step > sNum) cls += ' is-done';
          if (i > 0) {
            nodes.push(h('span', { class: 'game-wiz-sep' }, '·'));
          }
          nodes.push(h('span', { class: cls }, labels[i]));
        }
        T.fill(stepBar, nodes);
      }

      function filterEssaysFromParsed(p) {
        var allQs = (p && p.questions) || [];
        var nonEssay = [];
        var dropped = 0;
        for (var i = 0; i < allQs.length; i++) {
          if (allQs[i].type === 'essay') dropped++;
          else nonEssay.push(allQs[i]);
        }
        return { questions: nonEssay, dropped: dropped };
      }

      function parseCleanSource(srcText) {
        var trimSrc = String(srcText || '').trim();
        if (!trimSrc) {
          return { questions: [], errors: ['Chưa có câu hỏi nào.'], dropped: 0 };
        }
        var pWithEssay = QF.parse(trimSrc, { allowEssay: true });
        var hasExplicitEssay = false;
        for (var i = 0; i < pWithEssay.questions.length; i++) {
          if (pWithEssay.questions[i].type === 'essay') {
            hasExplicitEssay = true;
          }
        }
        // Kiểm tra theo chế độ game (không nhận tự luận)
        var pGame = QF.parse(trimSrc, { allowEssay: false });
        var validQs = [];
        for (var j = 0; j < pGame.questions.length; j++) {
          if (pGame.questions[j].type !== 'essay') validQs.push(pGame.questions[j]);
        }
        void hasExplicitEssay;
        return { questions: validQs, errors: pGame.errors, dropped: 0 };
      }

      // Chỉ câu ghi rõ "tự luận" mới bị bỏ; câu thiếu đáp án phải báo lỗi để thầy cô bổ sung.
      function readGameSource(srcText) {
        var p = QF.parse(srcText, { allowEssay: false });
        return {
          questions: p.questions,
          errors: p.errors.filter(function (e) { return e.indexOf('bài luyện tập chỉ dùng') < 0; })
        };
      }

      function runReadExam(fromPdfResult) {
        var de = wiz.deText.trim();
        var dapAn = wiz.dapAnText.trim();
        wiz.noQuestionErr = '';
        wiz.essayDropped = 0;
        wiz.guessedCount = 0;

        if (!de) {
          wiz.hasRead = true;
          wiz.questions = [];
          wiz.errors = [];
          wiz.noQuestionErr = 'Không tìm thấy câu hỏi. Đề cần đánh số Câu 1, Câu 2… hoặc 1., 2.';
          T.toast(wiz.noQuestionErr, 'error');
          drawStep1Result();
          return;
        }

        var initialParsed = null;
        if (fromPdfResult) {
          wiz.guessedCount = Number(fromPdfResult.guessed || 0);
          initialParsed = readGameSource(de);
        } else {
          if (!dapAn) {
            var pTry = readGameSource(de);
            var hasNonEssay = false;
            var hasQMarker = /^\s*câu\s*\d+/im.test(de);
            for (var k = 0; k < pTry.questions.length; k++) {
              if (pTry.questions[k].type !== 'essay') hasNonEssay = true;
            }
            if (pTry.questions.length > 0 && pTry.errors.length === 0 && (hasNonEssay || hasQMarker)) {
              initialParsed = pTry;
            }
          }
          if (!initialParsed) {
            var ft = QF.fromText(de, dapAn || null, {});
            wiz.guessedCount = Number(ft.guessed || 0);
            if (!ft.count) {
              wiz.hasRead = true;
              wiz.questions = [];
              wiz.errors = [];
              wiz.fixSource = '';
              wiz.noQuestionErr = 'Không tìm thấy câu hỏi. Đề cần đánh số Câu 1, Câu 2… hoặc 1., 2.';
              T.toast(wiz.noQuestionErr, 'error');
              drawStep1Result();
              return;
            }
            initialParsed = readGameSource(ft.source);
          }
        }

        if (!initialParsed || !initialParsed.questions || !initialParsed.questions.length) {
          wiz.hasRead = true;
          wiz.questions = [];
          wiz.errors = [];
          wiz.fixSource = '';
          wiz.noQuestionErr = 'Không tìm thấy câu hỏi. Đề cần đánh số Câu 1, Câu 2… hoặc 1., 2.';
          T.toast(wiz.noQuestionErr, 'error');
          drawStep1Result();
          return;
        }

        var filtered = filterEssaysFromParsed(initialParsed);
        wiz.essayDropped = filtered.dropped;
        if (wiz.essayDropped > 0) {
          T.toast('Đã bỏ ' + wiz.essayDropped + ' câu tự luận vì không chơi trong game.');
        }
        if (wiz.guessedCount > 0) {
          setTimeout(function () {
            T.toast(wiz.guessedCount + ' câu điền khuyết: máy đoán đáp án, thầy cô hãy kiểm tra lại.');
          }, 400);
        }

        wiz.fixSource = filtered.questions.length ? QF.toSource(filtered.questions) : '';
        var recheck = filtered.questions.length
          ? QF.parse(wiz.fixSource, { allowEssay: false })
          : { questions: [], errors: [] };
        wiz.questions = recheck.questions;
        wiz.errors = recheck.errors;
        wiz.hasRead = true;
        wiz.showFixBox = wiz.errors.length > 0 || (wiz.questions.length > 0 && wiz.questions.length < 3);
        syncDirty();
        drawStep1Result();
      }

      var step1ResultBox = null;
      var step1NextBtn = null;

      function updateNextBtnState() {
        if (!step1NextBtn) return;
        var canNext = wiz.hasRead && wiz.errors.length === 0 && wiz.questions.length >= 3;
        step1NextBtn.disabled = !canNext;
      }

      function renderQuestionPreviewItem(q, idx) {
        var typeLabel = TYPE_LABELS[q.type] || 'Câu hỏi';
        var ansNode = null;
        if (q.type === 'mc') {
          var opts = (q.options || []).map(function (opt, oi) {
            var isRight = oi === q.correct;
            return h('div', { class: 'game-wiz-prev-opt' + (isRight ? ' is-correct' : '') },
              h('strong', null, (isRight ? '✓ ' : '') + String.fromCharCode(65 + oi) + '. '),
              T.mathNodes(opt));
          });
          ansNode = h('div', { class: 'game-wiz-prev-opts' },
            opts,
            (q.correct < 0 || q.correct >= (q.options || []).length)
              ? h('p', { class: 'err small' }, 'Chưa đánh dấu đáp án đúng')
              : null);
        } else if (q.type === 'fill') {
          var fillParts = (q.answers || []).map(function (arr, bi) {
            var s = Array.isArray(arr) ? arr.join(' | ') : String(arr || '');
            return 'Ô ' + (bi + 1) + ': ' + (s || '(thiếu)');
          });
          ansNode = h('p', { class: 'small' },
            h('strong', null, 'Đáp án: '),
            h('span', { class: fillParts.length ? 'ok' : 'err' }, T.mathNodes(fillParts.join(' ; ') || '(chưa có đáp án)')));
        } else {
          var shortStr = (q.answers || []).join(' | ');
          ansNode = h('p', { class: 'small' },
            h('strong', null, 'Đáp án: '),
            h('span', { class: shortStr ? 'ok' : 'err' }, T.mathNodes(shortStr || '(chưa có đáp án)')));
        }
        return h('div', { class: 'game-wiz-prev-item' },
          h('div', { class: 'game-wiz-prev-head' },
            h('strong', null, 'Câu ' + (idx + 1)),
            h('span', { class: 'pill p-blue small' }, typeLabel)),
          h('p', { class: 'prewrap game-wiz-prev-text' }, T.qNodes(q.text || '(thiếu nội dung)')),
          (q.image && imgStore) ? imgStore.el(q.image) : null,
          ansNode);
      }

      function drawStep1Result() {
        if (!step1ResultBox) return;
        updateNextBtnState();
        if (!wiz.hasRead) {
          T.fill(step1ResultBox);
          return;
        }
        if (wiz.noQuestionErr) {
          T.fill(step1ResultBox,
            h('div', { class: 'errors' }, h('strong', null, wiz.noQuestionErr)));
          return;
        }

        var summaryBox = h('div', { class: 'game-wiz-summary-box' });
        var errBox = h('div');
        var previewWrap = h('div', { class: 'game-wiz-preview-wrap' });

        var refreshLiveStatus = function () {
          var qs = wiz.questions;
          var sm = QF.summary(qs);
          var parts = [];
          if (sm.mc) parts.push(sm.mc + ' trắc nghiệm');
          if (sm.short) parts.push(sm.short + ' trả lời ngắn');
          if (sm.fill) parts.push(sm.fill + ' điền khuyết');
          var sumLine = 'Đọc được ' + qs.length + ' câu' + (parts.length ? ': ' + parts.join(' · ') : '');

          T.fill(summaryBox,
            wiz.essayDropped > 0
              ? h('div', { class: 'mode-note game-wiz-note' }, 'ℹ️ Đã bỏ ' + wiz.essayDropped + ' câu tự luận vì không chơi trong game.')
              : null,
            wiz.guessedCount > 0
              ? h('div', { class: 'mode-note game-wiz-note' }, '💡 Có ' + wiz.guessedCount + ' câu điền khuyết máy đoán đáp án, thầy cô hãy kiểm tra lại.')
              : null,
            h('div', { class: 'parse-status' },
              wiz.errors.length === 0 && qs.length >= 3
                ? h('span', { class: 'ok' }, '✓ ' + sumLine)
                : h('strong', null, sumLine)),
            qs.length < 3
              ? h('div', { class: 'errors' }, h('strong', null, 'Cần ít nhất 3 câu hỏi (không tính tự luận) để tạo game. Hiện có ' + qs.length + ' câu.'))
              : null);

          T.fill(errBox, wiz.errors.length
            ? h('div', { class: 'errors' },
                h('strong', null, 'Cần sửa ' + wiz.errors.length + ' lỗi:'),
                h('ul', null, wiz.errors.map(function (e) { return h('li', null, e); })))
            : null);

          if (!qs.length) {
            T.fill(previewWrap);
          } else {
            var toggleBtn = h('button', {
              type: 'button',
              class: 'btn btn-sm btn-ghost',
              onclick: function () {
                wiz.previewOpen = !wiz.previewOpen;
                refreshLiveStatus();
              }
            }, wiz.previewOpen ? ('▴ Thu gọn xem trước (' + qs.length + ' câu)') : ('▾ Xem trước câu hỏi & đáp án (' + qs.length + ' câu)'));

            var editToggleBtn = !wiz.showFixBox ? h('button', {
              type: 'button',
              class: 'btn btn-sm btn-ghost',
              onclick: function () {
                wiz.showFixBox = true;
                drawStep1Result();
              }
            }, '✏️ Sửa lại nội dung') : null;

            T.fill(previewWrap,
              h('div', { class: 'add-bar' }, toggleBtn, editToggleBtn),
              wiz.previewOpen
                ? h('div', { class: 'game-wiz-prev-list' }, qs.map(function (q, i) { return renderQuestionPreviewItem(q, i); }))
                : null);
          }
          updateNextBtnState();
        };

        var fixFieldNode = null;
        if (wiz.showFixBox) {
          var fixTa = h('textarea', {
            class: 'game-hub-src',
            rows: '10',
            spellcheck: 'false',
            placeholder: QF.SAMPLE
          });
          fixTa.value = wiz.fixSource;
          fixTa.addEventListener('input', function () {
            wiz.fixSource = fixTa.value;
            var rep = parseCleanSource(wiz.fixSource);
            wiz.questions = rep.questions;
            wiz.errors = rep.errors;
            syncDirty();
            refreshLiveStatus();
          });
          fixFieldNode = T.field('Sửa lại nội dung (kiểm tra tự động ngay khi gõ)', fixTa);
        }

        refreshLiveStatus();
        T.fill(step1ResultBox, summaryBox, errBox, fixFieldNode, previewWrap);
      }

      function drawStep1() {
        drawStepBar();
        var deTa = h('textarea', {
          class: 'game-hub-src',
          rows: '10',
          spellcheck: 'false',
          placeholder: 'Dán nội dung đề vào đây (Câu 1, Câu 2… hoặc 1., 2. kèm các lựa chọn A. B. C. D.)…'
        });
        deTa.value = wiz.deText;

        var dapAnTa = h('textarea', {
          rows: '3',
          spellcheck: 'false',
          placeholder: 'Ví dụ: 1.B 2.C 3.A, Câu 4: 4/5 (để trống nếu đáp án đã nằm sẵn trong đề)'
        });
        dapAnTa.value = wiz.dapAnText;

        deTa.addEventListener('input', function () {
          wiz.deText = deTa.value;
          syncDirty();
        });
        dapAnTa.addEventListener('input', function () {
          wiz.dapAnText = dapAnTa.value;
          syncDirty();
        });

        var pdfBtn = h('button', {
          type: 'button',
          class: 'btn btn-sm btn-ghost',
          onclick: function () {
            if (!T.importPdfDialog) return T.toast('Không tìm thấy bộ đọc PDF.', 'error');
            T.importPdfDialog(true, function (r) {
              if (wiz.deText.trim() && !confirm('Thay nội dung đề hiện tại bằng đề vừa đọc từ PDF?')) return;
              wiz.deText = r.source || '';
              wiz.dapAnText = '';
              deTa.value = wiz.deText;
              dapAnTa.value = '';
              if (imgStore && r.images) {
                Object.keys(r.images).forEach(function (k) {
                  imgStore.put(k, r.images[k]);
                });
              }
              syncDirty();
              runReadExam(r);
            });
          }
        }, '📄 Lấy từ file PDF');

        var readBtn = h('button', {
          type: 'button',
          class: 'btn',
          onclick: function () {
            wiz.deText = deTa.value;
            wiz.dapAnText = dapAnTa.value;
            runReadExam(null);
          }
        }, 'Đọc đề →');

        step1NextBtn = h('button', {
          type: 'button',
          class: 'btn',
          disabled: !(wiz.hasRead && wiz.errors.length === 0 && wiz.questions.length >= 3),
          onclick: function () {
            if (!wiz.hasRead || wiz.errors.length > 0 || wiz.questions.length < 3) {
              return T.toast('Cần đọc đề hết lỗi và có ít nhất 3 câu hỏi trước khi tiếp tục.', 'error');
            }
            wiz.step = 2;
            drawStep2();
          }
        }, 'Tiếp tục: Thông tin lớp →');

        step1ResultBox = h('div', { class: 'game-wiz-step1-res' });

        T.fill(bodyBox,
          h('div', { class: 'game-wiz-head-row' },
            h('p', { class: 'muted small' }, 'Thầy cô dán đề và đáp án (hoặc lấy từ file PDF), hệ thống sẽ tự tách câu hỏi.'),
            pdfBtn),
          T.field('Đề bài', deTa, 'Mẹo: câu có từ 2 chỗ trống "....", ví dụ ghép cặp "Solar = ...." hoặc xếp thứ tự "Bước 1: ....", sẽ cho học sinh kéo thả đáp án. Chia round: thêm dòng "Round 1: Tên round (60 giây)" trước các câu của round đó.'),
          T.field('Đáp án (nếu để riêng)', dapAnTa),
          h('div', { class: 'actions-start' }, readBtn),
          step1ResultBox,
          h('div', { class: 'actions-start game-wiz-foot' },
            step1NextBtn,
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: cancelWizard }, 'Hủy')));

        drawStep1Result();
      }

      function drawStep2() {
        drawStepBar();
        var courseChips = h('div', { class: 'chips filter' });
        var branchWrap = h('div');
        var sizeInp = h('input', {
          type: 'number',
          min: '1',
          max: '100',
          step: '1',
          value: wiz.sizeStr,
          placeholder: 'VD: 12'
        });
        var minChips = h('div', { class: 'chips filter' });
        var PRESET_MINS = [5, 10, 15, 20, 30];
        var customMinInp = h('input', {
          type: 'number',
          min: '3',
          max: '60',
          step: '1',
          class: 'game-wiz-min-input',
          value: wiz.customMinStr,
          placeholder: 'Số phút khác (3–60)'
        });
        var titleInp = h('input', {
          maxlength: '200',
          value: wiz.title,
          placeholder: 'Tên bài đấu'
        });

        sizeInp.addEventListener('input', function () {
          wiz.sizeStr = sizeInp.value;
          var v = parseInt(sizeInp.value, 10);
          if (isFinite(v) && v >= 1 && v <= 100) {
            T.store.set('ttm_game_size_' + wiz.courseId, String(v));
          }
        });

        titleInp.addEventListener('input', function () {
          wiz.title = titleInp.value;
          wiz.titleTouched = true;
        });

        var renderBranchField = function () {
          var cObj = wiz.courseData && wiz.courseData.course;
          var brSel = cObj ? T.branchSelect(cObj, wiz.branch) : null;
          if (!brSel) {
            wiz.branch = '';
            T.fill(branchWrap);
            return;
          }
          wiz.branch = brSel.value;
          brSel.addEventListener('change', function () {
            wiz.branch = brSel.value;
          });
          T.fill(branchWrap, T.field('Môn / nhánh', brSel));
        };

        var renderCourseChips = function () {
          T.fill(courseChips, courses.map(function (c) {
            return h('button', {
              type: 'button',
              class: 'chip-btn' + (c.id === wiz.courseId ? ' active' : ''),
              onclick: function () {
                if (c.id === wiz.courseId) return;
                wiz.courseId = c.id;
                var savedSz = loadSavedClassSize(c.id);
                if (savedSz) {
                  wiz.sizeStr = savedSz;
                  sizeInp.value = savedSz;
                }
                if (!wiz.titleTouched) {
                  wiz.title = defaultWizardTitle(c);
                  titleInp.value = wiz.title;
                }
                renderCourseChips();
                T.fill(branchWrap, h('p', { class: 'muted small' }, 'Đang tải nhánh của lớp…'));
                var targetCourseId = c.id;
                T.api('course', { courseId: targetCourseId }).then(function (cdNew) {
                  if (!T.isCurrent(seq) || wiz.courseId !== targetCourseId) return;
                  wiz.courseData = cdNew;
                  wiz.branch = '';
                  renderBranchField();
                }).catch(function (err) {
                  if (!T.isCurrent(seq) || wiz.courseId !== targetCourseId) return;
                  T.toast(err.message || 'Không tải được thông tin lớp.', 'error');
                  T.fill(branchWrap);
                });
              }
            }, c.name + (c.grade ? ' · ' + c.grade : ''));
          }));
        };

        var renderMinChips = function () {
          T.fill(minChips, PRESET_MINS.map(function (m) {
            var isAct = (!wiz.customMinStr && wiz.minutes === m) || Number(wiz.customMinStr) === m;
            return h('button', {
              type: 'button',
              class: 'chip-btn' + (isAct ? ' active' : ''),
              onclick: function () {
                wiz.minutes = m;
                wiz.customMinStr = '';
                customMinInp.value = '';
                renderMinChips();
              }
            }, m + ' phút');
          }));
        };

        customMinInp.addEventListener('input', function () {
          wiz.customMinStr = customMinInp.value.trim();
          if (wiz.customMinStr) {
            var n = parseInt(wiz.customMinStr, 10);
            if (isFinite(n)) wiz.minutes = n;
          } else {
            wiz.minutes = 10;
          }
          renderMinChips();
        });

        renderCourseChips();
        renderBranchField();
        renderMinChips();

        var nextStep3Btn = h('button', {
          type: 'button',
          class: 'btn',
          onclick: function () {
            var sz = parseInt(wiz.sizeStr, 10);
            if (!isFinite(sz) || sz < 1 || sz > 100) {
              sizeInp.focus();
              return T.toast('Thầy cô vui lòng nhập sĩ số dự kiến (từ 1 đến 100).', 'error');
            }
            var mins = wiz.customMinStr ? parseInt(wiz.customMinStr, 10) : wiz.minutes;
            if (!isFinite(mins) || mins < 3 || mins > 60) {
              customMinInp.focus();
              return T.toast('Thời lượng trận cần từ 3 đến 60 phút.', 'error');
            }
            if (!wiz.title.trim()) {
              titleInp.focus();
              return T.toast('Thầy cô vui lòng nhập tên bài.', 'error');
            }
            wiz.sizeStr = String(sz);
            wiz.minutes = mins;
            T.store.set('ttm_game_size_' + wiz.courseId, String(sz));
            wiz.step = 3;
            drawStep3();
          }
        }, 'Xem gợi ý game →');

        T.fill(bodyBox,
          h('div', { class: 'field' }, h('span', null, 'Lớp (môn học)'), courseChips),
          branchWrap,
          h('div', { class: 'row two' },
            T.field('Sĩ số dự kiến (1–100)', sizeInp),
            T.field('Tên bài', titleInp)),
          h('div', { class: 'field' },
            h('span', null, 'Thời lượng trận'),
            h('div', { class: 'game-wiz-min-row' }, minChips, customMinInp)),
          h('div', { class: 'actions-start game-wiz-foot' },
            h('button', {
              type: 'button',
              class: 'btn btn-ghost',
              onclick: function () {
                wiz.step = 1;
                drawStep1();
              }
            }, '← Quay lại'),
            nextStep3Btn,
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: cancelWizard }, 'Hủy')));
      }

      function getModeMeta(id) {
        if (id === 'review') {
          return {
            id: 'review',
            icon: '⚡',
            name: 'Ôn từ vựng',
            desc: 'Học sinh tự làm theo tốc độ riêng, mỗi em một thứ tự câu.'
          };
        }
        return window.TTMModes ? window.TTMModes.getGame(id) : { id: id, icon: '🎮', name: id, desc: '' };
      }

      function formatPlanLine(rec, totalQ) {
        if (rec.id === 'review') {
          return 'Mỗi em tự làm trong ' + rec.limitMin + ' phút';
        }
        var qPart = rec.useCount < totalQ
          ? ('Dùng ' + rec.useCount + '/' + totalQ + ' câu')
          : (totalQ + ' câu');
        return qPart + ' · ' + rec.duration + ' giây/câu · khoảng ' + rec.estMinutes + ' phút';
      }

      function drawStep3() {
        drawStepBar();
        var sz = parseInt(wiz.sizeStr, 10) || 12;
        var mins = Number(wiz.minutes) || 10;
        var recs = window.TTMModes
          ? window.TTMModes.recommend(wiz.questions, { size: sz, minutes: mins })
          : [];

        var firstOkId = '';
        var selectedStillOk = false;
        for (var i = 0; i < recs.length; i++) {
          if (recs[i].ok && !firstOkId) firstOkId = recs[i].id;
          if (recs[i].ok && recs[i].id === wiz.selectedGame) selectedStillOk = true;
        }
        if (!selectedStillOk) {
          wiz.selectedGame = firstOkId;
        }

        var cardsGrid = h('div', { class: 'game-mode-grid game-wiz-rec-grid' });
        var createBtn = h('button', {
          type: 'button',
          class: 'btn btn-lg',
          disabled: !wiz.selectedGame
        }, '🎮 Tạo phòng với game này');
        var savingQuiz = false;

        var renderRecCards = function () {
          T.fill(cardsGrid, recs.map(function (rec) {
            var meta = getModeMeta(rec.id);
            var isTopRec = rec.ok && rec.id === firstOkId;
            var isPicked = rec.ok && rec.id === wiz.selectedGame;
            var isDisabled = !rec.ok;
            return h('button', {
              type: 'button',
              class: 'game-mode-card game-wiz-rec-card'
                + (isPicked ? ' active' : '')
                + (isDisabled ? ' is-disabled' : '')
                + (isTopRec ? ' is-recommended' : ''),
              disabled: isDisabled,
              onclick: function () {
                if (isDisabled || savingQuiz) return;
                wiz.selectedGame = rec.id;
                createBtn.disabled = false;
                renderRecCards();
              }
            },
              h('div', { class: 'game-mode-card-head' },
                h('span', { class: 'game-mode-icon' }, meta.icon),
                h('strong', { class: 'game-mode-name' }, meta.name),
                isTopRec ? h('span', { class: 'pill p-done small game-mode-badge' }, 'Gợi ý') : null),
              rec.ok
                ? h('div', { class: 'game-wiz-plan-line' }, '⏱ ' + formatPlanLine(rec, wiz.questions.length))
                : null,
              h('ul', { class: 'game-wiz-why-list' + (isDisabled ? ' is-err' : '') },
                (rec.why || []).map(function (w) { return h('li', null, w); })),
              rec.warn
                ? h('div', { class: 'game-wiz-warn-line' }, '⚠️ ' + rec.warn)
                : null);
          }));
        };

        renderRecCards();

        createBtn.addEventListener('click', function () {
          if (savingQuiz) return;
          var picked = null;
          for (var k = 0; k < recs.length; k++) {
            if (recs[k].id === wiz.selectedGame && recs[k].ok) {
              picked = recs[k];
              break;
            }
          }
          if (!picked) return T.toast('Thầy cô vui lòng chọn một kiểu chơi phù hợp.', 'error');

          var finalQuestions = [];
          for (var qi = 0; qi < wiz.questions.length; qi++) {
            if (wiz.questions[qi] && wiz.questions[qi].type !== 'essay') {
              finalQuestions.push(wiz.questions[qi]);
            }
          }
          var finalSource = QF.toSource(finalQuestions);
          var payload = {
            courseId: wiz.courseId,
            title: wiz.title.trim() || defaultWizardTitle(wiz.courseData.course),
            topic: '',
            branch: wiz.branch || '',
            description: '',
            timeLimit: 0,
            showAnswers: true,
            gameOnly: true,
            source: finalSource,
            questions: finalQuestions
          };
          if (imgStore) {
            var newImgs = imgStore.newImages(finalQuestions);
            if (newImgs && newImgs.length) payload.newImages = newImgs;
          }

          savingQuiz = true;
          T.busy(createBtn, true, 'Đang tạo phòng…');
          T.api('saveQuiz', payload).then(function (res) {
            savingQuiz = false;
            T.forgetCourse(wiz.courseId);
            formDirty = false;
            var planObj = {
              quizId: res.id,
              gameType: picked.id,
              duration: picked.duration,
              useCount: picked.useCount,
              limitMin: picked.limitMin
            };
            if (!(window.TTMDemo && window.TTMDemo.isDemo())) {
              T.store.set('ttm_game_plan', JSON.stringify(planObj));
            }
            T.go('#/dau-host/' + encodeURIComponent(res.id));
          }, function (err) {
            savingQuiz = false;
            T.busy(createBtn, false);
            T.toast((err && err.message) || 'Không tạo được bài đấu.', 'error');
          });
        });

        var cInfo = wiz.courseData && wiz.courseData.course;
        var summaryMeta = (cInfo ? cInfo.name : '')
          + (wiz.branch ? ' · ' + wiz.branch : '')
          + ' · ' + sz + ' học sinh · ' + mins + ' phút · ' + wiz.questions.length + ' câu';

        T.fill(bodyBox,
          h('p', { class: 'muted small' }, summaryMeta),
          cardsGrid,
          h('div', { class: 'actions-start game-wiz-foot' },
            h('button', {
              type: 'button',
              class: 'btn btn-ghost',
              onclick: function () {
                if (savingQuiz) return;
                wiz.step = 2;
                drawStep2();
              }
            }, '← Quay lại'),
            createBtn,
            h('button', {
              type: 'button',
              class: 'btn btn-ghost',
              onclick: function () {
                if (savingQuiz) return;
                cancelWizard();
              }
            }, 'Hủy')));
      }

      T.fill(formBox,
        h('div', { class: 'panel form game-hub-form game-wiz-panel' },
          h('h3', { class: 'game-subhead' }, '✨ Tạo game từ đề + đáp án'),
          stepBar,
          bodyBox));
      drawStep1();
    }
  }

  /* ═══════════════════ MÀN HÌNH HỌC SINH: TRONG PHÒNG (#/dau/{pin}) ═══════════════════ */

  function renderPlay(rawPin) {
    var T = window.TTM;
    var h = T.h;
    var pin = String(rawPin || '').replace(/\D/g, '');
    if (!hasConfig()) return missingConfigView('#/tro-choi', 'Trò chơi');
    if (!/^\d{6}$/.test(pin)) {
      T.fill(T.app,
        h('a', { href: '#/tro-choi', class: 'back' }, '← Nhập mã khác'),
        T.errorBox('Mã phòng không hợp lệ (cần đúng 6 chữ số).', function () { T.go('#/tro-choi'); }));
      return;
    }

    var seq = T.getSeq();
    var tracker = createTracker(seq);
    var activeGame = false;
    var activeDragCleanup = null;
    function clearActiveDrag() {
      if (activeDragCleanup) {
        var fn = activeDragCleanup;
        activeDragCleanup = null;
        fn();
      }
    }
    T.setLeaveGuard(
      function () {
        if (window.TTMDemo && window.TTMDemo.isDemo()) return false;
        return activeGame;
      },
      'Trận đấu đang diễn ra. Em có chắc muốn rời phòng?',
      function () {
        clearActiveDrag();
        tracker.cleanup();
      }
    );

    T.fill(T.app, T.loading('Đang vào phòng ' + fmtPin(pin) + '…'));

    ensureFirebase().then(function (fb) {
      if (!tracker.alive()) return;
      var db = fb.db;
      var uid = fb.uid;
      var roomRef = db.ref('rooms/' + pin);

      // Kiểm tra phòng qua nhánh state (học sinh không đọc cả nút rooms/$pin để tránh lộ câu trả lời của bạn khác).
      return roomRef.child('state').once('value').then(function (stateSnap) {
        if (!tracker.alive()) return;
        if (!stateSnap.exists()) {
          activeGame = false;
          T.fill(T.app,
            h('a', { href: '#/tro-choi', class: 'back' }, '← Nhập mã khác'),
            T.errorBox('Phòng ' + fmtPin(pin) + ' không tồn tại hoặc đã kết thúc.', function () { T.go('#/tro-choi'); }));
          return;
        }

        if (!(window.TTMDemo && window.TTMDemo.isDemo())) {
          T.store.set('ttm_last_pin', pin);
        }
        var me = (window.TTMDemo && window.TTMDemo.isDemo() && window.TTMDemo.demoRole() === 'hs')
          ? { username: 'xem-thu', fullName: 'Bạn (xem thử)', role: 'student' }
          : (T.getMe() || { username: 'hs', fullName: 'Học sinh' });
        return Promise.all([
          roomRef.child('quizId').once('value'),
          roomRef.child('quizTitle').once('value'),
          roomRef.child('courseName').once('value'),
          roomRef.child('players/' + uid).once('value')
        ]).then(function (snaps) {
          if (!tracker.alive()) return;
          var roomMeta = {
            quizId: snaps[0].val() || '',
            quizTitle: snaps[1].val() || '',
            courseName: snaps[2].val() || ''
          };
          var playerRef = roomRef.child('players/' + uid);
          var existingPlayer = snaps[3].val();
          var playerInfo = {
            name: String(me.fullName || me.username || 'Học sinh').slice(0, 80),
            username: String(me.username || 'hs').slice(0, 60)
          };
          var joinPromise;
          if (existingPlayer) {
            // Vào lại phòng: giữ nguyên bài đang làm dở trong players/$uid/log.
            joinPromise = existingPlayer.name === (me.fullName || me.username) ? Promise.resolve() : playerRef.update(playerInfo);
          } else {
            playerInfo.joinedAt = SERVER_TS;
            joinPromise = playerRef.set(playerInfo);
          }

          return joinPromise.then(function () {
            if (!tracker.alive()) return;
            if ((stateSnap.val() || {}).mode === 'review' && window.TTMReview) {
              window.TTMReview.runStudent(pin, roomRef, uid, me, tracker, roomMeta, function (on) { activeGame = on; });
              return;
            }
            runStudentRoom(pin, roomRef, uid, me, tracker, roomMeta);
          });
        });
      });
    }).catch(function (err) {
      if (!tracker.alive()) return;
      activeGame = false;
      T.fill(T.app,
        h('a', { href: '#/tro-choi', class: 'back' }, '← Quay lại'),
        T.errorBox(err.message || 'Không vào được phòng đấu.', function () { renderPlay(pin); }));
    });

    function runStudentRoom(pinCode, roomRef, uid, me, tr, roomMeta) {
      var room = {
        quizId: (roomMeta && roomMeta.quizId) || '',
        quizTitle: (roomMeta && roomMeta.quizTitle) || '',
        courseName: (roomMeta && roomMeta.courseName) || ''
      };
      var st = null;
      var q = null;
      var rev = null;
      var hasServerScore = false;
      var myScoreObj = { score: 0, correctCount: 0, streak: 0, lastCorrect: false, lastGain: 0, lastLoss: 0, rank: null };
      var playersRoster = {};
      var playerCount = 1;
      var currentPhase = '';
      var currentQIndex = -1;
      var currentQKey = '';
      var currentSub = '';
      var lastRelaySig = '';
      var drawnQKey = '';
      var checkedAnsKey = '';
      var stopTimer = null;
      var answeredMap = {}; // qkey -> { a, sent }
      var stage = h('div', { class: 'game-student-stage' });
      var headMeta = h('span', { class: 'muted small' }, room.quizTitle || '');
      var lobbyCountPill = null;
      var qScorePill = null;

      T.fill(T.app,
        h('div', { class: 'game-student-bar' },
          h('span', { class: 'pill p-blue' }, 'Phòng ' + fmtPin(pinCode)),
          headMeta,
          h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/tro-choi'); } }, 'Rời phòng')),
        stage);

      function clearQTimer() {
        clearActiveDrag();
        if (stopTimer) { stopTimer(); stopTimer = null; }
      }

      function currentEffectiveScore() {
        if (!hasServerScore && st && st.gameType === 'wager') {
          return window.TTMModes ? window.TTMModes.WAGER_START : 1000;
        }
        return Number(myScoreObj.score || 0);
      }

      function updateHeadMeta() {
        var sc = currentEffectiveScore();
        headMeta.textContent = (room.quizTitle || '') + (sc ? ' · ' + T.fmtScore(sc) + ' đ' : '');
      }

      // Lắng nghe danh sách người chơi để đếm số bạn trong phòng và tự ghi danh lại nếu mất mạng
      tr.on(roomRef.child('players'), 'value', function (snap) {
        var players = snap.val() || {};
        playersRoster = players;
        playerCount = Object.keys(players).length;
        if (st && st.phase !== 'end' && !players[uid]) {
          roomRef.child('players/' + uid).set({
            name: String(me.fullName || me.username || 'Học sinh').slice(0, 80),
            username: String(me.username || 'hs').slice(0, 60),
            joinedAt: SERVER_TS
          }).catch(function () {});
        }
        if (currentPhase === 'lobby') {
          if (lobbyCountPill) {
            lobbyCountPill.textContent = playerCount + ' bạn đang trong phòng';
          }
          if (st && st.teamMode && st.teamOf) {
            drawStudentLobby();
          }
        } else if (currentPhase === 'question' && st && st.gameType === 'relay') {
          var curQ = (q && Number(q.index) === Number(st.index)) ? q : { index: Number(st.index), type: 'mc', text: '', options: [] };
          drawStudentQuestion(room, st, curQ, myScoreObj);
        } else if (currentPhase === 'end' && st) {
          drawStudentEnd(room, st, myScoreObj, playerCount);
        }
      });

      // Lắng nghe điểm của riêng mình
      tr.on(roomRef.child('scores/' + uid), 'value', function (snap) {
        hasServerScore = snap.exists();
        var val = snap.val();
        if (val) {
          myScoreObj = val;
        } else {
          var defSc = (st && st.gameType === 'wager' && window.TTMModes) ? window.TTMModes.WAGER_START : 0;
          myScoreObj = { score: defSc, correctCount: 0, streak: 0, lastCorrect: false, lastGain: 0, lastLoss: 0, rank: null };
        }
        updateHeadMeta();
        if (currentPhase === 'question' && qScorePill) {
          qScorePill.textContent = T.fmtScore(currentEffectiveScore()) + ' điểm';
        } else if (currentPhase === 'reveal' && st) {
          drawStudentReveal(room, st, rev || {}, myScoreObj, q);
        } else if (currentPhase === 'end' && st) {
          drawStudentEnd(room, st, myScoreObj, playerCount);
        }
      });

      // Lắng nghe câu hỏi đang chiếu
      tr.on(roomRef.child('question'), 'value', function (snap) {
        q = snap.val() || null;
        if (!st) return;
        if (st.phase === 'question' && q && Number(q.index) === Number(st.index)) {
          drawnQKey = String(st.qkey !== undefined && st.qkey !== null ? st.qkey : st.index);
          drawStudentQuestion(room, st, q, myScoreObj);
        } else if (st.phase === 'reveal') {
          drawStudentReveal(room, st, rev || {}, myScoreObj, q);
        }
      });

      // Lắng nghe kết quả công bố từng câu
      tr.on(roomRef.child('reveal'), 'value', function (snap) {
        rev = snap.val() || null;
        if (st && st.phase === 'reveal') {
          drawStudentReveal(room, st, rev || {}, myScoreObj, q);
        } else if (st && st.phase === 'end') {
          drawStudentEnd(room, st, myScoreObj, playerCount);
        }
      });

      function drawStudentLobby() {
        lobbyCountPill = h('p', { class: 'pill p-done' }, playerCount + ' bạn đang trong phòng');
        var isTeam = !!(st && st.teamMode);
        if (!isTeam) {
          T.fill(stage,
            h('div', { class: 'panel game-lobby-student' },
              h('div', { class: 'game-status-icon' }, '⏳'),
              h('h2', null, 'Đã vào phòng – chờ giáo viên bắt đầu'),
              h('p', { class: 'muted' }, (room.quizTitle || 'Bài luyện tập') + (room.courseName ? ' · ' + room.courseName : '')),
              h('div', { class: 'game-self-box' },
                h('span', { class: 'muted small' }, 'Người chơi'),
                h('strong', null, me.fullName || me.username)),
              lobbyCountPill));
          return;
        }

        var teamMap = (st && st.teamOf) || {};
        var myT = teamMap[uid];
        var tCount = Number((st && st.teamCount) || (window.TTMModes && st ? window.TTMModes.teamCount(st.gameType) : 3) || 3);
        var teamContent;
        if (myT !== undefined && myT !== null && TEAMS[myT]) {
          var tmInfo = TEAMS[myT];
          var teammates = [];
          for (var u in playersRoster) {
            if (Object.prototype.hasOwnProperty.call(playersRoster, u)) {
              if (teamMap[u] === myT) {
                var pName = (playersRoster[u] && (playersRoster[u].name || playersRoster[u].username)) || 'Học sinh';
                if (u === uid) {
                  teammates.unshift({ name: pName, isMe: true });
                } else {
                  teammates.push({ name: pName, isMe: false });
                }
              }
            }
          }
          if (!teammates.length) {
            teammates.push({ name: me.fullName || me.username || 'Học sinh', isMe: true });
          }

          teamContent = h('div', {
            class: 'panel game-team-card-mine',
            style: '--team-color:' + tmInfo.color
          },
            h('div', { class: 'game-team-card-mine-head' },
              h('span', null, tmInfo.icon),
              h('strong', null, tmInfo.name)),
            h('p', { class: 'muted small', style: 'margin:0 0 10px' }, 'Các bạn cùng nhóm (' + teammates.length + ' bạn):'),
            h('div', { class: 'game-players', style: 'justify-content:center' }, teammates.map(function (m) {
              return h('span', { class: 'game-player-chip' + (m.isMe ? ' is-me' : '') }, m.name + (m.isMe ? ' (em)' : ''));
            }))
          );
        } else {
          teamContent = h('div', { class: 'panel game-team-waiting' },
            h('div', { class: 'game-status-icon' }, '🎲'),
            h('h3', null, 'Thầy cô sắp chia nhóm…'),
            h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'Em sẽ được xếp ngẫu nhiên vào một trong ' + tCount + ' nhóm khi bắt đầu.'));
        }

        T.fill(stage,
          h('div', { class: 'panel game-lobby-student' },
            h('div', { class: 'game-status-icon' }, '⏳'),
            h('h2', null, 'Đã vào phòng – chờ giáo viên bắt đầu'),
            h('p', { class: 'muted' }, (room.quizTitle || 'Bài luyện tập') + (room.courseName ? ' · ' + room.courseName : '')),
            h('div', { class: 'game-self-box' },
              h('span', { class: 'muted small' }, 'Người chơi'),
              h('strong', null, me.fullName || me.username)),
            teamContent,
            lobbyCountPill));
      }

      // Lắng nghe trạng thái phòng (khi phòng bị xóa, state thành null)
      tr.on(roomRef.child('state'), 'value', function (snap) {
        if (!snap.exists()) {
          clearQTimer();
          st = null;
          currentPhase = 'closed';
          activeGame = false;
          T.fill(stage,
            h('div', { class: 'panel empty' },
              h('h2', null, 'Phòng đấu đã đóng'),
              h('p', { class: 'muted' }, 'Giáo viên đã kết thúc và đóng phòng đấu này.'),
              h('div', { class: 'actions-start', style: 'justify-content:center' },
                h('button', { class: 'btn', onclick: function () { T.go('#/tro-choi'); } }, 'Quay lại'))));
          return;
        }

        st = snap.val() || { phase: 'lobby', index: -1, total: 1 };
        activeGame = st.phase !== 'end';
        updateHeadMeta();

        if (st.phase === 'lobby') {
          clearQTimer();
          currentPhase = 'lobby';
          currentQIndex = -1;
          currentQKey = '';
          currentSub = '';
          lastRelaySig = '';
          drawnQKey = '';
          drawStudentLobby();
          return;
        }

        if (st.phase === 'question') {
          var qIdx = Number(st.index);
          var qKey = String(st.qkey !== undefined && st.qkey !== null ? st.qkey : qIdx);
          var sub = String(st.sub || '');
          var myT = st.teamOf && st.teamOf[uid];
          var relaySig = st.gameType === 'relay'
            ? ((st.relay && myT !== undefined && myT !== null) ? JSON.stringify(st.relay[myT] || null) : JSON.stringify(st.relay || null))
            : '';
          var phaseChanged = (currentPhase !== 'question' || currentQIndex !== qIdx || currentQKey !== qKey || currentSub !== sub || relaySig !== lastRelaySig);
          currentPhase = 'question';
          currentQIndex = qIdx;
          currentQKey = qKey;
          currentSub = sub;
          lastRelaySig = relaySig;

          // Kiểm tra xem mình đã trả lời (hoặc cược) bước đang mở chưa (khi vào lại giữa chừng)
          if (!answeredMap[qKey] && checkedAnsKey !== qKey) {
            checkedAnsKey = qKey;
            roomRef.child('answers/' + qKey + '/' + uid).once('value').then(function (ansSnap) {
              if (!tr.alive()) return;
              var existingAns = ansSnap.val();
              if (existingAns && existingAns.a !== undefined && !answeredMap[qKey]) {
                answeredMap[qKey] = { a: existingAns.a, sent: true };
                var curKeyNow = st ? String(st.qkey !== undefined && st.qkey !== null ? st.qkey : st.index) : '';
                if (st && st.phase === 'question' && curKeyNow === qKey) {
                  var curQ = (q && Number(q.index) === qIdx) ? q : { index: qIdx, type: 'mc', text: '', options: [] };
                  drawStudentQuestion(room, st, curQ, myScoreObj);
                }
              }
            }).catch(function () {});
          }

          if (q && Number(q.index) === qIdx && (phaseChanged || drawnQKey !== qKey)) {
            drawnQKey = qKey;
            drawStudentQuestion(room, st, q, myScoreObj);
          } else if (phaseChanged && (!q || Number(q.index) !== qIdx)) {
            drawStudentQuestion(room, st, { index: qIdx, type: 'mc', text: '', options: [] }, myScoreObj);
          }
          return;
        }

        if (st.phase === 'reveal') {
          clearQTimer();
          var revIdx = Number(st.index);
          currentPhase = 'reveal';
          currentQIndex = revIdx;
          drawStudentReveal(room, st, rev || {}, myScoreObj, q);
          return;
        }

        if (st.phase === 'end') {
          clearQTimer();
          currentPhase = 'end';
          activeGame = false;
          drawStudentEnd(room, st, myScoreObj, playerCount);
        }
      });

      function studentRoundPill(stObj) {
        var r = stObj && stObj.round;
        if (!r || r.n === undefined || r.n === null) return null;
        var txt = 'Round ' + r.n + (r.title ? ' · ' + r.title : '') + (r.i && r.count ? ' · câu ' + r.i + '/' + r.count : '');
        return h('span', { class: 'pill game-round-pill' }, txt);
      }

      function drawStudentQuestion(room, st, q, myScoreObj) {
        clearQTimer();
        var qIdx = Number(st.index);
        var qKey = String(st.qkey !== undefined && st.qkey !== null ? st.qkey : qIdx);
        var gType = (st && st.gameType) || 'classic';
        var isBetStep = (gType === 'wager' && (st.sub === 'bet' || qKey.charAt(0) === 'b'));
        var curScoreVal = currentEffectiveScore();
        var clockEl = h('span', { class: 'clock game-clock' }, '⏱ ' + (st.duration || (isBetStep ? 10 : 20)) + 's');
        var bodyBox = h('div', { class: 'game-student-answer-area' });
        qScorePill = h('span', { class: 'pill p-blue' }, T.fmtScore(curScoreVal) + ' điểm');

        var teamMap = (st && st.teamOf) || {};
        var myT = teamMap[uid];
        var myTeamPill = null;
        if (st && st.teamMode && myT !== undefined && myT !== null && TEAMS[myT]) {
          var tmInfo = TEAMS[myT];
          myTeamPill = h('span', {
            class: 'pill game-team-pill',
            style: '--team-color:' + tmInfo.color
          }, tmInfo.icon + ' ' + tmInfo.name);
        }

        if (isBetStep) {
          var M = window.TTMModes;
          var levels = (M && M.BET_LEVELS) ? M.BET_LEVELS : [100, 200, 300, 500, 'all'];

          var renderBetLocked = function (msg) {
            T.fill(bodyBox,
              h('div', { class: 'panel game-sent-box' },
                h('div', { class: 'game-status-icon' }, '🎲'),
                h('h3', null, msg)));
          };

          var betLabelText = function (lvlIdx) {
            var amt = M ? M.betAmount(lvlIdx, curScoreVal) : 100;
            return T.fmtScore(amt);
          };

          var submitBet = function (lvlIdx) {
            if (answeredMap[qKey]) return;
            answeredMap[qKey] = { a: lvlIdx, sent: true };
            renderBetLocked('Đã cược ' + betLabelText(lvlIdx) + ', chờ câu hỏi…');
            roomRef.child('answers/' + qKey + '/' + uid).set({
              a: lvlIdx,
              t: SERVER_TS
            }).catch(function (err) {
              delete answeredMap[qKey];
              T.toast('Không gửi được mức cược: ' + (err.message || 'Hết giờ hoặc lỗi mạng.'), 'error');
              drawBetControls();
            });
          };

          var drawBetControls = function () {
            if (answeredMap[qKey]) {
              renderBetLocked('Đã cược ' + betLabelText(answeredMap[qKey].a) + ', chờ câu hỏi…');
              return;
            }
            var leftMs = (Number(st.startedAt || 0) + Number(st.duration || 10) * 1000) - serverNow();
            if (st.startedAt && leftMs <= 0) {
              renderBetLocked('Em chưa chọn, mức cược là 100');
              return;
            }
            T.fill(bodyBox,
              h('div', { class: 'game-bet-grid' }, levels.map(function (lv, idx) {
                var isAll = lv === 'all';
                var amt = M ? M.betAmount(idx, curScoreVal) : (isAll ? Math.max(curScoreVal, 100) : lv);
                return h('button', {
                  type: 'button',
                  class: 'game-bet-btn' + (isAll ? ' is-all' : ''),
                  onclick: function () { submitBet(idx); }
                },
                  h('span', { class: 'game-bet-title' }, isAll ? '🔥 Tất tay' : (T.fmtScore(lv) + ' điểm')),
                  h('span', { class: 'game-bet-sub muted small' }, isAll ? ('Cược ' + T.fmtScore(amt) + ' điểm') : 'Đúng cộng · Sai trừ')
                );
              }))
            );
          };

          var tickBet = function () {
            if (!st.startedAt) return;
            var leftMs = (Number(st.startedAt) + Number(st.duration || 10) * 1000) - serverNow();
            var sec = Math.max(0, Math.ceil(leftMs / 1000));
            clockEl.textContent = '⏱ ' + sec + 's';
            clockEl.classList.toggle('low', sec <= 3);
            if (leftMs <= 0 && !answeredMap[qKey]) {
              clearQTimer();
              renderBetLocked('Em chưa chọn, mức cược là 100');
            }
          };

          T.fill(stage,
            h('div', { class: 'panel game-student-q' },
              h('div', { class: 'game-q-top' },
                h('span', { class: 'q-num' }, 'Câu ' + (qIdx + 1) + ' / ' + (st.total || 1) + ' · Đặt cược'),
                studentRoundPill(st),
                clockEl,
                qScorePill),
              h('p', { class: 'game-student-qtext' }, '🎲 Chọn mức điểm em muốn cược cho câu ' + (qIdx + 1) + ':'),
              h('p', { class: 'muted small', style: 'margin:4px 0 0' }, 'Điểm hiện có của em: ' + T.fmtScore(curScoreVal) + ' điểm')),
            bodyBox);

          drawBetControls();
          tickBet();
          stopTimer = tr.interval(tickBet, 250);
          return;
        }

        function renderLocked(msg, pickedLabel, iconStr) {
          clearActiveDrag();
          T.fill(bodyBox,
            h('div', { class: 'panel game-sent-box' },
              h('div', { class: 'game-status-icon' }, iconStr || '📨'),
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
          if (q.blanks && q.blanks >= 2) {
            return String(val).split('\u241F').join(' ; ');
          }
          return String(val);
        }

        function submitAnswer(val) {
          if (answeredMap[qKey]) return;
          clearActiveDrag();
          answeredMap[qKey] = { a: val, sent: true };
          renderLocked('Đã gửi, chờ các bạn…', formatPicked(val));
          roomRef.child('answers/' + qKey + '/' + uid).set({
            a: val,
            t: SERVER_TS
          }).catch(function (err) {
            delete answeredMap[qKey];
            T.toast('Không gửi được câu trả lời: ' + (err.message || 'Hết giờ hoặc lỗi mạng.'), 'error');
            drawControls();
          });
        }

        var relaySlot = (gType === 'relay' && st.relay && myT !== undefined && myT !== null)
          ? (st.relay[myT] || st.relay[String(myT)])
          : null;
        var relayTriedUids = (gType === 'relay' && window.TTMModes)
          ? window.TTMModes.toStrArray(relaySlot && relaySlot.triedUids)
          : [];
        var isRelayMyTurn = (gType === 'relay' && relaySlot && !relaySlot.done && relaySlot.uid === uid);

        function drawControls() {
          clearActiveDrag();
          if (gType === 'relay') {
            if (relaySlot && relaySlot.done) {
              renderLocked('Nhóm em đã xong câu này', null, relaySlot.ok ? '✅' : '🏁');
              return;
            }
            if (!isRelayMyTurn && (relayTriedUids.indexOf(uid) >= 0 || answeredMap[qKey])) {
              renderLocked('Em đã trả lời, chờ các bạn nhé', null, '⏳');
              return;
            }
            if (!isRelayMyTurn) {
              var holderName = playerNameOf(playersRoster, relaySlot && relaySlot.uid);
              renderLocked('Lượt của ' + holderName, null, '🏃');
              return;
            }
          }

          if (answeredMap[qKey]) {
            renderLocked('Đã gửi, chờ các bạn…', formatPicked(answeredMap[qKey].a));
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
                  h('span', { class: 'game-pad-text' }, T.mathNodes(optText)));
              })));
          } else if (q.blanks && q.blanks >= 2 && Array.isArray(q.bank) && q.bank.length > 0) {
            var bank = q.bank;
            var QF = window.QuizFormat;
            var splitText = QF && QF.splitParts ? QF.splitParts(q.text || '') : String(q.text || '');
            var textParts = QF && QF.splitBlanks ? QF.splitBlanks(splitText) : [splitText];
            var slotCount = Math.max(Number(q.blanks) || 2, textParts.length - 1);
            var slotChipIdx = [];
            for (var sbi = 0; sbi < slotCount; sbi++) slotChipIdx.push(-1);
            var selectedChipIdx = -1;
            var suppressClickUntil = 0;
            var dragState = null;
            var touchMoveOpts = { passive: false };

            var slotEls = [];
            var textNodes = [];
            for (var pk = 0; pk < textParts.length; pk++) {
              if (textParts[pk]) {
                var mns = T.mathNodes(textParts[pk]);
                for (var mi = 0; mi < mns.length; mi++) textNodes.push(mns[mi]);
              }
              if (pk < textParts.length - 1) {
                var sBtn = h('button', {
                  type: 'button',
                  class: 'game-drop-slot',
                  'data-i': String(pk)
                });
                slotEls.push(sBtn);
                textNodes.push(sBtn);
              }
            }
            while (slotEls.length < slotCount) {
              var extraIdx = slotEls.length;
              var extraBtn = h('button', {
                type: 'button',
                class: 'game-drop-slot',
                'data-i': String(extraIdx)
              });
              slotEls.push(extraBtn);
              textNodes.push(' ', extraBtn);
            }

            var chipEls = bank.map(function (cardText, cIdx) {
              return h('button', {
                type: 'button',
                class: 'game-drag-chip',
                'data-chip': String(cIdx)
              }, T.mathNodes(cardText));
            });

            var fillTextEl = h('div', { class: 'game-fill-text prewrap fill-wrap game-drag-text' }, textNodes);
            var bankEl = h('div', { class: 'game-chip-bank' }, chipEls);
            var fillBox = h('div', { class: 'panel game-fill-box game-drag-box' }, fillTextEl, bankEl);

            var syncDragFillUI = function () {
              var usedMap = {};
              var si;
              for (si = 0; si < slotCount; si++) {
                var placed = slotChipIdx[si];
                if (placed >= 0 && placed < bank.length) {
                  usedMap[placed] = true;
                }
              }
              if (selectedChipIdx >= 0 && usedMap[selectedChipIdx]) {
                selectedChipIdx = -1;
              }
              for (si = 0; si < slotEls.length; si++) {
                var slotEl = slotEls[si];
                var cIdx = slotChipIdx[si];
                var hasCard = cIdx >= 0 && cIdx < bank.length;
                slotEl.className = 'game-drop-slot' + (hasCard ? ' is-filled' : '');
                if (hasCard) {
                  slotEl.setAttribute('data-chip', String(cIdx));
                  T.fill(slotEl, T.mathNodes(bank[cIdx]));
                } else {
                  slotEl.removeAttribute('data-chip');
                  T.fill(slotEl);
                }
              }
              for (var ci = 0; ci < chipEls.length; ci++) {
                var chipEl = chipEls[ci];
                var isUsed = !!usedMap[ci];
                var isSel = !isUsed && selectedChipIdx === ci;
                chipEl.hidden = isUsed;
                chipEl.className = 'game-drag-chip'
                  + (isSel ? ' is-selected' : '')
                  + (isUsed ? ' is-used' : '');
              }
            };

            var findSlotIndexAt = function (x, y) {
              if (typeof document.elementFromPoint !== 'function') return -1;
              var el = document.elementFromPoint(x, y);
              while (el && el !== document.body && el !== document.documentElement) {
                if (el.classList && el.classList.contains('game-drop-slot') && fillBox.contains(el)) {
                  var attr = el.getAttribute('data-i');
                  var idx = attr !== null ? parseInt(attr, 10) : -1;
                  return (isFinite(idx) && idx >= 0 && idx < slotEls.length) ? idx : -1;
                }
                el = el.parentNode;
              }
              return -1;
            };

            var onDocMouseMove = function (e) {
              handlePointerMove(e.clientX, e.clientY, e);
            };
            var onDocMouseUp = function (e) {
              handlePointerEnd(e.clientX, e.clientY);
            };
            var onDocTouchMove = function (e) {
              if (!e.touches || !e.touches.length) return;
              var t = e.touches[0];
              handlePointerMove(t.clientX, t.clientY, e);
            };
            var onDocTouchEnd = function (e) {
              var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
              var cx = t ? t.clientX : (dragState ? dragState.lastX : null);
              var cy = t ? t.clientY : (dragState ? dragState.lastY : null);
              handlePointerEnd(cx, cy);
            };
            var onDocTouchCancel = function () {
              cancelDrag();
              syncDragFillUI();
            };

            var cancelDrag = function () {
              document.removeEventListener('mousemove', onDocMouseMove, false);
              document.removeEventListener('mouseup', onDocMouseUp, false);
              document.removeEventListener('touchmove', onDocTouchMove, touchMoveOpts);
              document.removeEventListener('touchmove', onDocTouchMove, false);
              document.removeEventListener('touchmove', onDocTouchMove, true);
              document.removeEventListener('touchend', onDocTouchEnd, false);
              document.removeEventListener('touchcancel', onDocTouchCancel, false);
              if (dragState) {
                if (dragState.overSlotIdx >= 0 && slotEls[dragState.overSlotIdx]) {
                  slotEls[dragState.overSlotIdx].classList.remove('is-over');
                }
                if (dragState.srcEl) {
                  dragState.srcEl.classList.remove('is-dragging-src');
                }
                if (dragState.ghostEl && dragState.ghostEl.parentNode) {
                  dragState.ghostEl.parentNode.removeChild(dragState.ghostEl);
                }
                dragState = null;
              }
              if (activeDragCleanup === cancelDrag) {
                activeDragCleanup = null;
              }
            };

            var handlePointerMove = function (clientX, clientY, rawEv) {
              if (!dragState || !document.body.contains(fillBox)) {
                cancelDrag();
                return;
              }
              dragState.lastX = clientX;
              dragState.lastY = clientY;
              var dx = clientX - dragState.startX;
              var dy = clientY - dragState.startY;
              if (!dragState.moved) {
                if (dx * dx + dy * dy <= 36) return;
                dragState.moved = true;
                var ghost = h('div', {
                  class: 'game-drag-chip game-drag-ghost',
                  style: 'position:fixed;pointer-events:none;z-index:9999'
                }, T.mathNodes(bank[dragState.chipIdx]));
                document.body.appendChild(ghost);
                dragState.ghostEl = ghost;
                if (dragState.srcEl) {
                  dragState.srcEl.classList.add('is-dragging-src');
                }
              }
              if (rawEv && dragState.isTouch && rawEv.cancelable) {
                rawEv.preventDefault();
              }
              if (dragState.ghostEl) {
                dragState.ghostEl.style.left = Math.round(clientX - dragState.offsetX) + 'px';
                dragState.ghostEl.style.top = Math.round(clientY - dragState.offsetY) + 'px';
              }
              var hitIdx = findSlotIndexAt(clientX, clientY);
              if (hitIdx !== dragState.overSlotIdx) {
                if (dragState.overSlotIdx >= 0 && slotEls[dragState.overSlotIdx]) {
                  slotEls[dragState.overSlotIdx].classList.remove('is-over');
                }
                dragState.overSlotIdx = hitIdx;
                if (hitIdx >= 0 && slotEls[hitIdx]) {
                  slotEls[hitIdx].classList.add('is-over');
                }
              }
            };

            var handlePointerEnd = function (clientX, clientY) {
              if (!dragState) return;
              var ds = dragState;
              if (!ds.moved) {
                cancelDrag();
                return;
              }
              var targetSlot = (typeof clientX === 'number' && typeof clientY === 'number' && document.body.contains(fillBox))
                ? findSlotIndexAt(clientX, clientY)
                : ds.overSlotIdx;
              cancelDrag();
              suppressClickUntil = Date.now() + 400;
              if (!document.body.contains(fillBox)) return;
              if (targetSlot >= 0 && targetSlot < slotCount) {
                for (var k = 0; k < slotCount; k++) {
                  if (slotChipIdx[k] === ds.chipIdx) slotChipIdx[k] = -1;
                }
                if (ds.fromSlot >= 0 && ds.fromSlot !== targetSlot) {
                  slotChipIdx[ds.fromSlot] = -1;
                }
                slotChipIdx[targetSlot] = ds.chipIdx;
                selectedChipIdx = -1;
              } else {
                if (ds.fromSlot >= 0) {
                  slotChipIdx[ds.fromSlot] = -1;
                }
                selectedChipIdx = -1;
              }
              syncDragFillUI();
            };

            var beginPress = function (chipIdx, fromSlot, srcEl, startX, startY, isTouch) {
              cancelDrag();
              var rect = srcEl.getBoundingClientRect ? srcEl.getBoundingClientRect() : null;
              var offX = (rect && rect.width) ? Math.min(Math.max(16, startX - rect.left), rect.width - 16) : 36;
              var offY = (rect && rect.height) ? Math.min(Math.max(12, startY - rect.top), rect.height - 12) : 22;
              dragState = {
                chipIdx: chipIdx,
                fromSlot: fromSlot,
                srcEl: srcEl,
                startX: startX,
                startY: startY,
                lastX: startX,
                lastY: startY,
                offsetX: offX,
                offsetY: offY,
                moved: false,
                ghostEl: null,
                overSlotIdx: -1,
                isTouch: !!isTouch
              };
              activeDragCleanup = cancelDrag;
              if (isTouch) {
                document.addEventListener('touchmove', onDocTouchMove, touchMoveOpts);
                document.addEventListener('touchend', onDocTouchEnd, false);
                document.addEventListener('touchcancel', onDocTouchCancel, false);
              } else {
                document.addEventListener('mousemove', onDocMouseMove, false);
                document.addEventListener('mouseup', onDocMouseUp, false);
              }
            };

            chipEls.forEach(function (chipBtn, cIdx) {
              chipBtn.addEventListener('mousedown', function (e) {
                if (e.button !== undefined && e.button !== 0) return;
                if (chipBtn.hidden) return;
                beginPress(cIdx, -1, chipBtn, e.clientX, e.clientY, false);
              });
              chipBtn.addEventListener('touchstart', function (e) {
                if (!e.touches || !e.touches.length || chipBtn.hidden) return;
                var t = e.touches[0];
                beginPress(cIdx, -1, chipBtn, t.clientX, t.clientY, true);
              });
              chipBtn.addEventListener('click', function (e) {
                if (Date.now() < suppressClickUntil) {
                  e.preventDefault();
                  return;
                }
                if (chipBtn.hidden) return;
                selectedChipIdx = (selectedChipIdx === cIdx) ? -1 : cIdx;
                syncDragFillUI();
              });
            });

            slotEls.forEach(function (slotBtn, sIdx) {
              slotBtn.addEventListener('mousedown', function (e) {
                if (e.button !== undefined && e.button !== 0) return;
                var cIdx = slotChipIdx[sIdx];
                if (cIdx < 0) return;
                beginPress(cIdx, sIdx, slotBtn, e.clientX, e.clientY, false);
              });
              slotBtn.addEventListener('touchstart', function (e) {
                if (!e.touches || !e.touches.length) return;
                var cIdx = slotChipIdx[sIdx];
                if (cIdx < 0) return;
                var t = e.touches[0];
                beginPress(cIdx, sIdx, slotBtn, t.clientX, t.clientY, true);
              });
              slotBtn.addEventListener('click', function (e) {
                if (Date.now() < suppressClickUntil) {
                  e.preventDefault();
                  return;
                }
                if (selectedChipIdx >= 0 && selectedChipIdx < bank.length) {
                  for (var k = 0; k < slotCount; k++) {
                    if (slotChipIdx[k] === selectedChipIdx) slotChipIdx[k] = -1;
                  }
                  slotChipIdx[sIdx] = selectedChipIdx;
                  selectedChipIdx = -1;
                  syncDragFillUI();
                } else if (slotChipIdx[sIdx] >= 0) {
                  slotChipIdx[sIdx] = -1;
                  syncDragFillUI();
                }
              });
            });

            syncDragFillUI();

            var dfBtn = h('button', { type: 'button', class: 'btn btn-lg btn-block' }, 'Gửi đáp án');
            dfBtn.addEventListener('click', function () {
              var outVals = [];
              var hasFilled = false;
              for (var bi = 0; bi < slotCount; bi++) {
                var cIdx = slotChipIdx[bi];
                if (cIdx >= 0 && cIdx < bank.length && bank[cIdx] != null && String(bank[cIdx]).trim() !== '') {
                  outVals.push(String(bank[cIdx]));
                  hasFilled = true;
                } else {
                  outVals.push('');
                }
              }
              if (!hasFilled) return T.toast('Em hãy kéo ít nhất một thẻ vào ô trống trước khi gửi.', 'error');
              cancelDrag();
              var joined = outVals.join('\u241F').slice(0, 200);
              submitAnswer(joined);
            });
            var dfForm = h('div', { class: 'game-short-form' }, fillBox, dfBtn);
            T.fill(bodyBox, dfForm);
          } else if (q.blanks && q.blanks >= 2) {
            var vals = [];
            for (var b = 0; b < q.blanks; b++) vals.push('');
            var fillBox = h('div', { class: 'panel game-fill-box' },
              h('div', { class: 'game-fill-text prewrap fill-wrap' },
                T.fillNodes(q.text, vals, {
                  onChange: function (k, val) { vals[k] = val; }
                })
              )
            );
            var fBtn = h('button', { type: 'button', class: 'btn btn-lg btn-block' }, 'Gửi đáp án');
            fBtn.addEventListener('click', function () {
              var hasAny = false;
              for (var bi = 0; bi < vals.length; bi++) {
                if (vals[bi] != null && String(vals[bi]).trim() !== '') { hasAny = true; break; }
              }
              if (!hasAny) return T.toast('Em hãy điền ít nhất một ô trống trước khi gửi.', 'error');
              var joined = vals.join('\u241F').slice(0, 200);
              submitAnswer(joined);
            });
            var sForm = h('div', { class: 'game-short-form' }, fillBox, fBtn);
            T.fill(bodyBox, sForm);
          } else {
            var sInp = h('input', {
              type: 'text',
              class: 'short-input game-short-input',
              placeholder: 'Nhập đáp án của em…',
              autocomplete: 'off',
              maxlength: '200'
            });
            var sBtn = h('button', { type: 'submit', class: 'btn btn-lg btn-block' }, 'Gửi đáp án');
            var sForm = h('form', { class: 'panel form game-short-form' }, sInp, T.fracHint(sInp), sBtn);
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
          if (leftMs <= 0 && !answeredMap[qKey]) {
            clearQTimer();
            renderLocked('Đã hết giờ! Chờ thầy cô công bố đáp án…', null);
          }
        }

        var relayTurnBanner = isRelayMyTurn
          ? h('div', { class: 'game-relay-turn-banner' }, '⚡ Tới lượt em!')
          : null;

        T.fill(stage,
          h('div', { class: 'panel game-student-q' },
            h('div', { class: 'game-q-top' },
              h('span', { class: 'q-num' }, 'Câu ' + (qIdx + 1) + ' / ' + (st.total || 1)),
              studentRoundPill(st),
              myTeamPill,
              clockEl,
              qScorePill),
            relayTurnBanner,
            (q.blanks && q.blanks >= 2 && (gType !== 'relay' || isRelayMyTurn)) ? null : h('p', { class: 'game-student-qtext prewrap' }, T.qNodes(q.text || '')),
            q.image && room.quizId ? T.qImageEl({ kind: 'quiz', id: room.quizId, key: q.image }) : null),
          bodyBox);

        drawControls();
        tick();
        stopTimer = tr.interval(tick, 250);
      }

      function drawStudentReveal(room, st, rev, myScoreObj, q) {
        var gType = (st && st.gameType) || 'classic';
        var right = !!myScoreObj.lastCorrect;
        var gain = Number(myScoreObj.lastGain || 0);
        var loss = Number(myScoreObj.lastLoss || 0);
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

        var teamMap = (st && st.teamOf) || {};
        var myT = teamMap[uid];
        var modeVisualEl = null;
        if (gType === 'race' && st && st.gameData) {
          modeVisualEl = raceTrackEl(st.gameData.pos, st.total || 1, teamMap, playersRoster, true);
        } else if (gType === 'tug' && st && st.gameData) {
          modeVisualEl = tugRopeEl(st.gameData.rope, true);
        } else if (gType === 'relay') {
          modeVisualEl = relayStatusEl((rev && rev.relay) || (st && st.relay), teamMap, playersRoster, st && st.gameData && st.gameData.points, true);
        }

        var teamBoardSection = null;
        if (gType !== 'wager' && ((rev && rev.teams && rev.teams.length) || modeVisualEl)) {
          teamBoardSection = h('div', { class: 'game-student-team-wrap' },
            modeVisualEl,
            (rev && rev.teams && rev.teams.length) ? h('h3', { class: 'game-subhead', style: 'margin:10px 0 8px' }, '👥 Bảng xếp hạng nhóm') : null,
            (rev && rev.teams && rev.teams.length) ? teamBoardEl(rev.teams, myT, gType) : null
          );
        }

        if (st && st.roundBreak) {
          var rb = st.roundBreak;
          var doneText = rb.doneLabel || ('Round ' + rb.done);
          var nextText = rb.nextLabel || ('Round ' + rb.next);
          var nextSub = (rb.nextCount && rb.nextSec)
            ? (rb.nextCount + ' câu · ' + rb.nextSec + ' giây/câu')
            : '';
          var myTeamBanner = null;
          if (st.teamMode && gType !== 'wager' && myT !== undefined && myT !== null && TEAMS[myT]) {
            var tmInf = TEAMS[myT];
            myTeamBanner = h('div', { class: 'game-reveal-round-wrap' },
              h('span', {
                class: 'pill game-team-pill',
                style: '--team-color:' + tmInf.color
              }, tmInf.icon + ' ' + tmInf.name));
          }
          T.fill(stage,
            h('div', { class: 'panel game-reveal-student game-round-break-student' },
              h('div', { class: 'game-verdict-icon' }, '🏁'),
              h('h2', { class: 'game-round-break-title sm' }, 'Hết ' + doneText),
              myTeamBanner,
              h('div', { class: 'stats game-student-stats' },
                h('div', { class: 'stat' }, h('strong', null, T.fmtScore(currentEffectiveScore())), h('span', null, 'Tổng điểm')),
                h('div', { class: 'stat' }, h('strong', null, rank ? '#' + rank : '–'), h('span', null, 'Hạng hiện tại')),
                h('div', { class: 'stat' }, h('strong', null, streak ? '🔥 ' + streak : '0'), h('span', null, 'Chuỗi đúng'))),
              teamBoardSection,
              h('div', { class: 'game-round-next-box student' },
                h('strong', null, 'Chuẩn bị ' + nextText + '…'),
                nextSub ? h('div', { class: 'muted small' }, nextSub) : null)));
          return;
        }

        var verdictHeading;
        var badgeText;
        var badgePositive = gain > 0;
        if (gType === 'wager') {
          if (right) {
            verdictHeading = 'Đúng! +' + T.fmtScore(gain) + ' điểm';
            badgeText = '+' + T.fmtScore(gain) + ' điểm';
            badgePositive = true;
          } else if (myScoreObj.lastPartial) {
            verdictHeading = 'Đúng một phần (giữ nguyên điểm)';
            badgeText = '0 điểm';
            badgePositive = false;
          } else {
            verdictHeading = 'Chưa đúng −' + T.fmtScore(loss) + ' điểm';
            badgeText = '−' + T.fmtScore(loss) + ' điểm';
            badgePositive = false;
          }
        } else if (gType === 'relay' && myScoreObj.lastTurn === false) {
          var mySlot = ((rev && rev.relay) || (st && st.relay) || {})[myT];
          var teamRight = !!(mySlot && mySlot.ok);
          right = teamRight;
          verdictHeading = teamRight ? 'Nhóm em trả lời đúng!' : 'Câu này chưa tới lượt em';
          badgeText = '+' + T.fmtScore(gain) + ' điểm cá nhân';
        } else {
          verdictHeading = right ? 'Đúng rồi!' : gain > 0 ? 'Đúng một phần' : 'Chưa đúng';
          badgeText = '+' + T.fmtScore(gain) + ' điểm';
        }

        var rPill = studentRoundPill(st);
        T.fill(stage,
          h('div', { class: 'panel game-reveal-student ' + (right ? 'is-ok' : 'is-bad') },
            rPill ? h('div', { class: 'game-reveal-round-wrap' }, rPill) : null,
            h('div', { class: 'game-verdict-icon' }, right ? '✅' : '❌'),
            h('h2', null, verdictHeading),
            h('div', { class: 'game-gain-badge ' + (badgePositive ? 'ok' : 'bad') }, badgeText),
            (gType !== 'wager' && streak >= 2) ? h('div', { class: 'game-streak-pill' }, '🔥 Chuỗi ' + streak + ' câu đúng liên tiếp!') : null,
            !right && correctText ? h('p', { class: 'game-correct-note' }, 'Đáp án đúng: ', h('strong', null, T.mathNodes(correctText))) : null,
            h('div', { class: 'stats game-student-stats' },
              h('div', { class: 'stat' }, h('strong', null, T.fmtScore(currentEffectiveScore())), h('span', null, 'Tổng điểm')),
              h('div', { class: 'stat' }, h('strong', null, rank ? '#' + rank : '–'), h('span', null, 'Hạng hiện tại')),
              h('div', { class: 'stat' }, h('strong', null, streak ? '🔥 ' + streak : '0'), h('span', null, 'Chuỗi đúng'))),
            teamBoardSection,
            h('p', { class: 'muted small' }, 'Chờ thầy cô chuyển sang câu tiếp theo…')));
      }

      function drawStudentEnd(room, st, myScoreObj, playerCount) {
        var gType = (st && st.gameType) || 'classic';
        var curScoreVal = currentEffectiveScore();
        // Không trao huy chương cho bạn 0 điểm (lớp ít người vẫn có thể "hạng Nhì" khi sai hết).
        var rank = curScoreVal > 0 ? Number(myScoreObj.rank || 0) : 0;
        var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏁';
        var rankTitle = rank === 1 ? 'Hạng Nhất xuất sắc!' : rank === 2 ? 'Hạng Nhì tuyệt vời!' : rank === 3 ? 'Hạng Ba giỏi lắm!' : (rank ? 'Hạng #' + rank + ' / ' + playerCount : 'Hoàn thành trận đấu');

        var teamMap = (st && st.teamOf) || {};
        var myT = teamMap[uid];
        var teamSection = null;

        if (st && st.teamMode && gType !== 'wager' && rev && rev.teams && rev.teams.length) {
          var topTeams = rev.teams.filter(function (tm) { return tm.rank === 1; });
          var isTie = topTeams.length > 1;
          var myTeamStanding = null;
          if (myT !== undefined && myT !== null) {
            for (var ti = 0; ti < rev.teams.length; ti++) {
              if (Number(rev.teams[ti].t) === Number(myT)) {
                myTeamStanding = rev.teams[ti];
                break;
              }
            }
          }
          if (myTeamStanding) {
            var tRank = myTeamStanding.rank;
            var tInfo = TEAMS[myT] || { name: 'Nhóm ' + (myT + 1) };
            if (tRank === 1 && isTie) {
              medal = '🤝';
              rankTitle = 'Hòa chung cuộc!';
            } else if (tRank === 1) {
              medal = '🥇';
              rankTitle = tInfo.name + ' về Nhất!';
            } else if (tRank === 2) {
              medal = '🥈';
              rankTitle = tInfo.name + ' về Nhì!';
            } else if (tRank === 3) {
              medal = '🥉';
              rankTitle = tInfo.name + ' về Ba!';
            } else {
              medal = '🏁';
              rankTitle = '#' + tRank + ' ' + tInfo.name;
            }
          }

          var winnerNote = null;
          if (topTeams.length === 1) {
            var winT = topTeams[0].t;
            var winInfo = TEAMS[winT] || { name: 'Nhóm ' + (winT + 1), icon: '🏆' };
            var winNames = (window.TTMModes ? window.TTMModes.teamMembers(teamMap, playersRoster, winT) : []).map(function (u) {
              return playerNameOf(playersRoster, u);
            });
            winnerNote = h('div', { class: 'panel game-winner-banner' },
              h('strong', null, '🏆 Nhóm thắng: ' + winInfo.icon + ' ' + winInfo.name),
              winNames.length ? h('p', { class: 'muted small', style: 'margin:4px 0 0' }, 'Thành viên: ' + winNames.join(', ')) : null
            );
          } else if (isTie) {
            winnerNote = h('div', { class: 'panel game-winner-banner' },
              h('strong', null, '🤝 Kết quả: Hòa chung cuộc!')
            );
          }

          var endVisual = null;
          if (gType === 'race' && st.gameData) {
            endVisual = raceTrackEl(st.gameData.pos, st.total || 1, teamMap, playersRoster, true);
          } else if (gType === 'tug' && st.gameData) {
            endVisual = tugRopeEl(st.gameData.rope, true);
          }

          teamSection = h('div', { class: 'game-student-team-wrap' },
            winnerNote,
            endVisual,
            h('h3', { class: 'game-subhead', style: 'margin:10px 0 8px' }, '👥 Bảng xếp hạng nhóm'),
            teamBoardEl(rev.teams, myT, gType)
          );
        }

        T.fill(stage,
          h('div', { class: 'panel game-end-student' },
            h('div', { class: 'game-medal-big' }, medal),
            h('h1', null, rankTitle),
            h('p', { class: 'muted' }, room.quizTitle || ''),
            teamSection,
            h('div', { class: 'stats game-student-stats' },
              h('div', { class: 'stat' }, h('strong', null, T.fmtScore(curScoreVal)), h('span', null, 'Tổng điểm')),
              h('div', { class: 'stat' }, h('strong', null, (myScoreObj.correctCount || 0) + '/' + (st.total || 0)), h('span', null, 'Câu trả lời đúng')),
              h('div', { class: 'stat' }, h('strong', null, rank ? '#' + rank : '–'), h('span', null, 'Xếp hạng cuối'))),
            h('div', { class: 'actions-start', style: 'justify-content:center' },
              h('button', { class: 'btn', onclick: function () { T.go('#/tro-choi'); } }, 'Đấu trận khác'),
              h('button', { class: 'btn btn-ghost', onclick: function () { T.go('#/'); } }, 'Về khóa học'))));
      }
    }
  }

  /* ═══════════════════ MÀN HÌNH GIÁO VIÊN: TỔ CHỨC ĐẤU (#/dau-host/{quizId}) ═══════════════════ */

  function hostStoreKey(quizId) {
    return 'ttm_host_room:' + quizId;
  }

  function loadHostState(quizId) {
    if (window.TTMDemo && window.TTMDemo.isDemo()) return null;
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
    if (window.TTMDemo && window.TTMDemo.isDemo()) return;
    if (!data) {
      window.TTM.store.set(hostStoreKey(quizId), null);
      return;
    }
    data.at = Date.now();
    window.TTM.store.set(hostStoreKey(quizId), JSON.stringify(data));
  }

  function renderHost(quizId, presetMode) {
    var T = window.TTM;
    var h = T.h;
    var backHref = '#/luyen/' + encodeURIComponent(quizId);
    if (!hasConfig()) return missingConfigView(backHref, 'Bài luyện tập');

    var seq = T.getSeq();
    var tracker = createTracker(seq);
    var roomActive = false;

    T.setLeaveGuard(
      function () {
        if (window.TTMDemo && window.TTMDemo.isDemo()) return false;
        return roomActive;
      },
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
      var fullQs = d.fullQuestions || [];
      var rawSrc = (d.quiz && d.quiz.source) || d.source || '';
      if (rawSrc && window.QuizFormat && window.QuizFormat.parse) {
        var parsedSrc = window.QuizFormat.parse(rawSrc);
        if (parsedSrc && parsedSrc.questions && parsedSrc.questions.length === fullQs.length) {
          for (var qi = 0; qi < fullQs.length; qi++) {
            if (fullQs[qi] && parsedSrc.questions[qi] && parsedSrc.questions[qi].round) {
              fullQs[qi].round = parsedSrc.questions[qi].round;
            }
          }
        }
      }
      var allQs = fullQs.filter(function (q) {
        return q && (q.type === 'mc' || q.type === 'short' || q.type === 'fill');
      });
      if (!allQs.length) {
        T.fill(T.app,
          h('a', { href: backHref, class: 'back' }, '← ' + d.quiz.title),
          T.errorBox('Đề này không có câu hỏi trắc nghiệm, trả lời ngắn hoặc điền khuyết nào để đấu cả lớp.'));
        return;
      }

      var saved = loadHostState(quizId);
      if (saved && saved.pin) {
        fb.db.ref('rooms/' + saved.pin + '/host').once('value').then(function (hSnap) {
          if (!tracker.alive() || !hSnap.exists() || hSnap.val() !== fb.uid) return null;
          return fb.db.ref('rooms/' + saved.pin).once('value');
        }).then(function (snap) {
          if (!tracker.alive()) return;
          var rVal = snap && snap.exists() ? snap.val() : null;
          if (rVal && rVal.host === fb.uid) {
            drawSetup(d, allQs, fb, { pin: saved.pin, room: rVal, saved: saved });
          } else {
            saveHostState(quizId, null);
            drawSetup(d, allQs, fb, null);
          }
        }).catch(function () {
          if (!tracker.alive()) return;
          saveHostState(quizId, null);
          drawSetup(d, allQs, fb, null);
        });
      } else {
        drawSetup(d, allQs, fb, null);
      }
    }).catch(function (err) {
      if (!tracker.alive()) return;
      T.fill(T.app,
        h('a', { href: backHref, class: 'back' }, '← Quay lại'),
        T.errorBox(err.message || 'Không tải được dữ liệu.', function () { renderHost(quizId, presetMode); }));
    });

    function drawSetup(d, baseQuestions, fb, existing) {
      var q = d.quiz;
      var c = d.course;
      var duration = validDuration(T.store.get('ttm_game_dur')) || 20;
      var customDurInp = h('input', {
        type: 'number',
        min: String(DUR_MIN),
        max: String(DUR_MAX),
        step: '5',
        class: 'game-wiz-min-input',
        placeholder: 'Số giây khác (' + DUR_MIN + '–' + DUR_MAX + ')'
      });
      var shuffleBox = h('input', { type: 'checkbox' });
      var dragFillBox = h('input', { type: 'checkbox', checked: true });
      var durBar = h('div', { class: 'chips filter' });
      var gameMode = presetMode === 'on-tap' ? 'review' : 'classic';
      var limitMin = 5;
      var suggestions = window.TTMModes ? window.TTMModes.suggest(baseQuestions) : {};
      var modeBar = h('div', { class: 'game-mode-grid' });
      var limitBar = h('div', { class: 'chips filter' });
      var modeHint = h('small', { class: 'muted small' });
      var baseRounds = (window.TTMModes && window.TTMModes.roundsOf) ? window.TTMModes.roundsOf(baseQuestions) : [];
      var hasRounds = baseRounds.length >= 2;
      var roundsListWrap = h('div', { class: 'game-rounds-setup' });
      var roundsField = h('div', { class: 'field', style: hasRounds ? '' : 'display:none' },
        h('span', null, '🏁 Trận có ' + baseRounds.length + ' round'),
        roundsListWrap);
      var durField = h('div', { class: 'field' }, h('span', null, 'Thời gian suy nghĩ mỗi câu'), durBar, customDurInp);
      var limitField = h('div', { class: 'field' }, h('span', null, 'Thời gian cho cả lượt ôn'), limitBar);
      var shuffleLabelSpan = h('span', null, hasRounds ? 'Trộn câu trong từng round' : 'Trộn thứ tự câu hỏi');
      var shuffleField = h('label', { class: 'check' }, shuffleBox, shuffleLabelSpan);
      var dragFillField = h('div', { class: 'field' },
        h('label', { class: 'check' }, dragFillBox, 'Học sinh kéo thả đáp án vào ô trống (câu điền khuyết)'),
        h('small', null, 'Tắt nếu cần các em tự tính và gõ đáp án, vì thẻ làm lộ các đáp số'));
      var planBanner = h('div');

      var mcCount = baseQuestions.filter(function (x) { return x.type === 'mc'; }).length;
      var shortCount = baseQuestions.filter(function (x) { return x.type === 'short'; }).length;
      var fillCount = baseQuestions.filter(function (x) { return x.type === 'fill'; }).length;
      var parts = [];
      if (mcCount) parts.push(mcCount + ' câu trắc nghiệm');
      if (shortCount) parts.push(shortCount + ' câu trả lời ngắn');
      if (fillCount) parts.push(fillCount + ' câu điền khuyết');

      var allModeCards = (window.TTMModes ? window.TTMModes.GAMES : []).concat([
        {
          id: 'review',
          icon: '⚡',
          name: 'Ôn từ vựng',
          teams: 0,
          desc: 'Học sinh tự làm theo tốc độ riêng, mỗi em một thứ tự câu. Chỉ dùng câu trắc nghiệm.'
        }
      ]);

      var plan = null;
      var rawPlan = T.store.get('ttm_game_plan');
      if (rawPlan) {
        try {
          var parsedPlan = JSON.parse(rawPlan);
          if (parsedPlan && parsedPlan.quizId === q.id && parsedPlan.gameType) {
            plan = parsedPlan;
            if (!(window.TTMDemo && window.TTMDemo.isDemo())) {
              T.store.set('ttm_game_plan', null);
            }
          }
        } catch (e) {
          plan = null;
        }
      }

      if (plan) {
        var validMode = false;
        for (var mi = 0; mi < allModeCards.length; mi++) {
          if (allModeCards[mi].id === plan.gameType) validMode = true;
        }
        if (validMode) gameMode = plan.gameType;
        var pDur = Number(plan.duration);
        if (validDuration(pDur)) duration = validDuration(pDur);
        var pLim = Number(plan.limitMin);
        if (pLim && window.TTMReview && window.TTMReview.LIMITS.indexOf(pLim) !== -1) limitMin = pLim;
      }

      var roundSecs = baseRounds.map(function (r) {
        return validDuration(r.sec) || duration;
      });

      function drawRoundsSetup() {
        if (!hasRounds) return;
        T.fill(roundsListWrap, baseRounds.map(function (r, ri) {
          var rLbl = (window.TTMModes && window.TTMModes.roundLabel)
            ? window.TTMModes.roundLabel(r)
            : ('Round ' + r.n + (r.title ? ' · ' + r.title : ''));
          var curSec = roundSecs[ri] || duration;
          var rChips = h('div', { class: 'chips filter game-round-dur-chips' });
          var rCustomInp = h('input', {
            type: 'number',
            min: String(DUR_MIN),
            max: String(DUR_MAX),
            step: '5',
            class: 'game-wiz-min-input game-round-sec-input',
            value: DURATIONS.indexOf(curSec) === -1 ? String(curSec) : '',
            placeholder: 'Khác (' + DUR_MIN + '–' + DUR_MAX + 's)'
          });
          var renderRChips = function () {
            var activeSec = roundSecs[ri] || duration;
            T.fill(rChips, DURATIONS.map(function (sec) {
              return h('button', {
                type: 'button',
                class: 'chip-btn' + (activeSec === sec ? ' active' : ''),
                onclick: function () {
                  roundSecs[ri] = sec;
                  rCustomInp.value = '';
                  renderRChips();
                }
              }, sec < 60 || sec % 60 ? sec + 's' : (sec / 60) + 'p');
            }));
          };
          rCustomInp.addEventListener('input', function () {
            var v = validDuration(rCustomInp.value);
            if (v) {
              roundSecs[ri] = v;
              renderRChips();
            }
          });
          rCustomInp.addEventListener('change', function () {
            if (rCustomInp.value !== '' && !validDuration(rCustomInp.value)) {
              T.toast('Thời gian mỗi câu từ ' + DUR_MIN + ' đến ' + DUR_MAX + ' giây.', 'error');
              var curVal = roundSecs[ri] || duration;
              rCustomInp.value = DURATIONS.indexOf(curVal) === -1 ? String(curVal) : '';
            }
          });
          renderRChips();
          return h('div', { class: 'game-round-setup-row' },
            h('div', { class: 'game-round-setup-info' },
              h('strong', null, rLbl),
              h('span', { class: 'pill p-blue small' }, r.count + ' câu')),
            h('div', { class: 'game-round-setup-controls' }, rChips, rCustomInp));
        }));
      }
      drawRoundsSetup();

      function getModeTitle(id) {
        for (var i = 0; i < allModeCards.length; i++) {
          if (allModeCards[i].id === id) return allModeCards[i].name;
        }
        return id;
      }

      function drawPlanBanner() {
        if (!plan) {
          T.fill(planBanner);
          return;
        }
        var pName = getModeTitle(plan.gameType);
        var detail = plan.gameType === 'review'
          ? (limitMin + ' phút')
          : (duration + ' giây/câu');
        var planUseCount = Number(plan.useCount || 0);
        var hasSubset = !hasRounds && plan.gameType !== 'review' && planUseCount > 0 && planUseCount < baseQuestions.length;
        var subsetActive = hasSubset && gameMode === plan.gameType;
        T.fill(planBanner,
          h('div', { class: 'mode-note game-plan-banner' },
            h('div', null, '✨ Đã chọn theo gợi ý: ', h('strong', null, pName + ' (' + detail + ')'), ', thầy cô vẫn đổi được.'),
            hasSubset
              ? h('div', { class: 'small' + (subsetActive ? '' : ' muted') },
                  '🎲 Dùng ngẫu nhiên ' + planUseCount + '/' + baseQuestions.length + ' câu'
                  + (subsetActive ? ' khi mở phòng với kiểu chơi này.' : ' (chỉ áp dụng khi mở đúng kiểu chơi đã gợi ý).'))
              : null));
      }

      function drawMode() {
        var isReview = gameMode === 'review';
        T.fill(modeBar, allModeCards.map(function (m) {
          var sug = m.id === 'review'
            ? { ok: true, recommended: false, note: '' }
            : (suggestions[m.id] || { ok: true, recommended: false, note: '' });
          var isDisabled = !sug.ok;
          var isActive = gameMode === m.id;
          var isRec = plan ? (m.id === plan.gameType && !isDisabled) : !!sug.recommended;
          var noteText = plan ? (isDisabled ? sug.note : '') : sug.note;
          return h('button', {
            type: 'button',
            class: 'game-mode-card'
              + (isActive ? ' active' : '')
              + (isDisabled ? ' is-disabled' : '')
              + (isRec ? ' is-recommended' : ''),
            disabled: isDisabled,
            onclick: function () {
              if (isDisabled) return;
              gameMode = m.id;
              drawMode();
            }
          },
            h('div', { class: 'game-mode-card-head' },
              h('span', { class: 'game-mode-icon' }, m.icon),
              h('strong', { class: 'game-mode-name' }, m.name),
              isRec ? h('span', { class: 'pill p-done small game-mode-badge' }, 'Gợi ý') : null
            ),
            h('span', { class: 'game-mode-desc' }, m.desc),
            noteText ? h('span', { class: 'game-mode-note' + (isDisabled ? ' is-err' : '') },
              (isRec ? '💡 ' : '') + noteText
            ) : null
          );
        }));
        T.fill(limitBar, window.TTMReview.LIMITS.map(function (min) {
          return h('button', {
            type: 'button',
            class: 'chip-btn' + (limitMin === min ? ' active' : ''),
            onclick: function () { limitMin = min; drawMode(); }
          }, min + ' phút');
        }));
        var curGameInfo = isReview ? null : (window.TTMModes ? window.TTMModes.getGame(gameMode) : null);
        modeHint.textContent = isReview
          ? 'Học sinh tự làm theo tốc độ riêng, mỗi em một thứ tự câu. Thầy cô theo dõi từng em và xếp hạng cuối lượt. Chỉ dùng câu trắc nghiệm.'
          : (curGameInfo ? curGameInfo.desc : 'Thầy cô điều khiển, cả lớp trả lời cùng một câu rồi xem đáp án. Có thể chia 3 nhóm ở sảnh chờ.');
        var useRoundsNow = hasRounds && !isReview;
        var useSubsetNow = !useRoundsNow && plan && gameMode === plan.gameType && gameMode !== 'review' && Number(plan.useCount) > 0 && Number(plan.useCount) < baseQuestions.length;
        roundsField.style.display = useRoundsNow ? '' : 'none';
        durField.style.display = (isReview || useRoundsNow) ? 'none' : '';
        shuffleLabelSpan.textContent = useRoundsNow ? 'Trộn câu trong từng round' : 'Trộn thứ tự câu hỏi';
        shuffleField.style.display = (isReview || useSubsetNow) ? 'none' : '';
        dragFillField.style.display = (!isReview && fillCount > 0) ? '' : 'none';
        limitField.style.display = isReview ? '' : 'none';
        drawPlanBanner();
      }

      function openReviewRoom() {
        var deck = window.TTMReview.buildDeck(baseQuestions);
        if (!deck.length) return T.toast('Đề này không có câu trắc nghiệm để ôn từ vựng.', 'error');
        T.busy(openBtn, true, 'Đang tạo mã phòng…');
        createUniquePin(fb.db, 0).then(function (pin) {
          if (!tracker.alive()) return;
          var me = T.getMe() || { username: 'gv', fullName: 'Giáo viên' };
          return fb.db.ref('rooms/' + pin).set({
            host: fb.uid,
            hostName: String(me.fullName || me.username || 'Giáo viên').slice(0, 100),
            quizId: q.id,
            quizTitle: String(q.title || '').slice(0, 300),
            courseId: c.id,
            courseName: String(c.name + (c.grade ? ' · ' + c.grade : '')).slice(0, 200),
            createdAt: SERVER_TS,
            state: {
              phase: 'lobby',
              index: -1,
              total: deck.length,
              startedAt: 0,
              mode: 'review',
              limitSec: limitMin * 60,
              deck: deck
            }
          }).then(function () {
            if (!tracker.alive()) return;
            var hostState = { pin: pin, quizId: q.id, mode: 'review', savedMatch: false };
            saveHostState(quizId, hostState);
            startReviewHost(d, fb, hostState);
          });
        }).catch(function (err) {
          T.busy(openBtn, false);
          T.toast(err.message || 'Không tạo được phòng.', 'error');
        });
      }

      function setDuration(sec) {
        duration = sec;
        T.store.set('ttm_game_dur', String(sec));
        drawDur();
        drawPlanBanner();
      }

      function drawDur() {
        T.fill(durBar, DURATIONS.map(function (sec) {
          return h('button', {
            type: 'button',
            class: 'chip-btn' + (duration === sec ? ' active' : ''),
            onclick: function () { customDurInp.value = ''; setDuration(sec); }
          }, sec < 60 || sec % 60 ? sec + ' giây' : (sec / 60) + ' phút');
        }));
      }
      if (DURATIONS.indexOf(duration) === -1) customDurInp.value = String(duration);
      customDurInp.addEventListener('input', function () {
        var v = validDuration(customDurInp.value);
        if (v) setDuration(v);
      });
      customDurInp.addEventListener('change', function () {
        if (customDurInp.value !== '' && !validDuration(customDurInp.value)) {
          T.toast('Thời gian mỗi câu từ ' + DUR_MIN + ' đến ' + DUR_MAX + ' giây.', 'error');
          customDurInp.value = DURATIONS.indexOf(duration) === -1 ? String(duration) : '';
        }
      });
      drawDur();

      var openBtn = h('button', { class: 'btn btn-lg' }, '🎮 Mở phòng đấu');
      openBtn.addEventListener('click', function () {
        if (gameMode === 'review') return openReviewRoom();
        var sugNow = suggestions[gameMode];
        if (sugNow && !sugNow.ok) {
          return T.toast(sugNow.note || 'Cần ít nhất 3 câu để mở kiểu chơi này.', 'error');
        }
        var selectedType = (gameMode === 'match' || !gameMode) ? 'classic' : gameMode;
        var tCount = window.TTMModes ? window.TTMModes.teamCount(selectedType) : 3;
        var isAutoTeam = (selectedType === 'race' || selectedType === 'tug' || selectedType === 'relay');
        var initGameData = null;
        if (selectedType === 'race') initGameData = { pos: [0, 0, 0] };
        else if (selectedType === 'tug') initGameData = { rope: 0 };
        else if (selectedType === 'relay') initGameData = { points: [0, 0, 0], pointers: [0, 0, 0] };

        var usePlanSubset = !hasRounds && plan && selectedType === plan.gameType && Number(plan.useCount) > 0 && Number(plan.useCount) < baseQuestions.length;
        var qs;
        if (usePlanSubset) {
          qs = shuffleArray(baseQuestions).slice(0, Number(plan.useCount));
        } else if (hasRounds && window.TTMModes && window.TTMModes.shuffleWithinRounds) {
          qs = shuffleBox.checked ? window.TTMModes.shuffleWithinRounds(baseQuestions, shuffleArray) : baseQuestions.slice();
        } else {
          qs = shuffleBox.checked ? shuffleArray(baseQuestions) : baseQuestions.slice();
        }
        var useDragFill = !!dragFillBox.checked;
        var initDur = (hasRounds && roundSecs.length) ? (validDuration(roundSecs[0]) || duration) : duration;
        T.busy(openBtn, true, 'Đang tạo mã phòng…');
        createUniquePin(fb.db, 0).then(function (pin) {
          if (!tracker.alive()) return;
          var me = T.getMe() || { username: 'gv', fullName: 'Giáo viên' };
          var initState = {
            phase: 'lobby',
            index: -1,
            total: qs.length,
            startedAt: 0,
            duration: initDur,
            gameType: selectedType,
            dragFill: useDragFill
          };
          if (hasRounds) {
            initState.roundSecs = roundSecs.slice();
          }
          if (isAutoTeam) {
            initState.teamMode = true;
            initState.teamCount = tCount;
          }
          if (initGameData) {
            initState.gameData = initGameData;
          }
          var roomData = {
            host: fb.uid,
            hostName: String(me.fullName || me.username || 'Giáo viên').slice(0, 100),
            quizId: q.id,
            quizTitle: String(q.title || '').slice(0, 300),
            courseId: c.id,
            courseName: String(c.name + (c.grade ? ' · ' + c.grade : '')).slice(0, 200),
            createdAt: SERVER_TS,
            state: initState
          };
          return fb.db.ref('rooms/' + pin).set(roomData).then(function () {
            if (!tracker.alive()) return;
            var hostState = {
              pin: pin,
              quizId: q.id,
              duration: initDur,
              roundSecs: hasRounds ? roundSecs.slice() : null,
              questions: qs,
              scores: {},
              savedMatch: false,
              gameType: selectedType,
              dragFill: useDragFill,
              teamMode: isAutoTeam,
              teamCount: tCount,
              teamOf: {},
              gameData: initGameData,
              bets: {}
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
        var exSt = (existing.room && existing.room.state) || {};
        var exSaved = existing.saved || {};
        var phaseLabel = {
          lobby: 'Đang ở sảnh chờ',
          question: (exSt.sub === 'bet' ? 'Đang đặt cược câu ' : 'Đang hỏi câu ') + ((exSt.index || 0) + 1) + '/' + (exSt.total || baseQuestions.length),
          reveal: 'Đang công bố câu ' + ((exSt.index || 0) + 1) + '/' + (exSt.total || baseQuestions.length),
          end: 'Đã kết thúc'
        }[exSt.phase || 'lobby'] || 'Đang mở';
        var resumeReview = exSt.mode === 'review';
        if (resumeReview && exSt.phase === 'question') phaseLabel = 'Học sinh đang ôn từ vựng';

        var resumeBtn = h('button', { class: 'btn', onclick: function () {
          if (resumeReview) {
            return startReviewHost(d, fb, { pin: existing.pin, quizId: q.id, mode: 'review', savedMatch: !!exSaved.savedMatch });
          }
          var qs = exSaved.questions && exSaved.questions.length === exSt.total
            ? exSaved.questions
            : baseQuestions.slice();
          var rGameType = exSt.gameType || exSaved.gameType || 'classic';
          var rTeamCount = Number(exSt.teamCount || exSaved.teamCount || (window.TTMModes ? window.TTMModes.teamCount(rGameType) : 3) || 3);
          var isTeam = !!(exSt.teamMode || exSaved.teamMode || rGameType === 'race' || rGameType === 'tug' || rGameType === 'relay');
          var qDur = (exSt.sub === 'bet' && exSaved.duration)
            ? Number(exSaved.duration)
            : Number(exSt.duration || exSaved.duration || 20);
          var rDragFill = exSt.dragFill !== undefined
            ? !!exSt.dragFill
            : (exSaved.dragFill !== undefined ? !!exSaved.dragFill : true);
          var hsObj = {
            pin: existing.pin,
            quizId: q.id,
            duration: qDur,
            roundSecs: exSt.roundSecs || exSaved.roundSecs || null,
            questions: qs,
            scores: existing.room.scores || exSaved.scores || {},
            savedMatch: !!exSaved.savedMatch,
            gameType: rGameType,
            dragFill: rDragFill,
            teamMode: isTeam,
            teamCount: rTeamCount,
            teamOf: exSt.teamOf || exSaved.teamOf || {},
            gameData: exSt.gameData || exSaved.gameData || null,
            bets: exSaved.bets || {},
            resumedRoom: existing.room
          };
          runHostRoom(d, fb, hsObj);
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
          planBanner,
          h('div', { class: 'field' },
            h('span', null, 'Kiểu chơi'),
            modeBar,
            modeHint),
          roundsField,
          durField,
          limitField,
          shuffleField,
          dragFillField,
          h('div', { class: 'actions-start' },
            openBtn,
            !(window.TTMDemo && window.TTMDemo.isDemo())
              ? h('button', {
                  type: 'button',
                  class: 'btn btn-sm btn-ghost',
                  onclick: function () { T.go('#/dau-demo/' + encodeURIComponent(q.id)); }
                }, '👀 Xem thử như học sinh')
              : null
          )));
      drawMode();
    }

    function startReviewHost(d, fb, hostState) {
      roomActive = true;
      window.TTMReview.runHost(d, fb, hostState, tracker, function (on) { roomActive = on; }, backHref);
    }

    function createUniquePin(db, attempt) {
      if (attempt > 12) return Promise.reject(new Error('Không tạo được mã phòng trống. Vui lòng thử lại.'));
      var pin = String(Math.floor(100000 + Math.random() * 900000));
      return db.ref('rooms/' + pin + '/host').once('value').then(function (snap) {
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

      var rState = (hostState.resumedRoom && hostState.resumedRoom.state) || {};
      var gameType = hostState.gameType || rState.gameType || 'classic';
      var dragFill = hostState.dragFill !== undefined
        ? !!hostState.dragFill
        : (rState.dragFill !== undefined ? !!rState.dragFill : true);
      var isFixedTeamGame = (gameType === 'race' || gameType === 'tug' || gameType === 'relay');
      var teamMode = !!(isFixedTeamGame || hostState.teamMode || rState.teamMode);
      var teamCount = Number(hostState.teamCount || rState.teamCount || (window.TTMModes ? window.TTMModes.teamCount(gameType) : 3) || 3);
      if (teamCount <= 0) teamCount = 3;
      var teamOf = rState.teamOf || hostState.teamOf || {};

      var rawGameData = rState.gameData || hostState.gameData || null;
      var gameData = null;
      if (gameType === 'race') {
        gameData = {
          pos: window.TTMModes ? window.TTMModes.toNumArray(rawGameData && rawGameData.pos, 3, 0) : [0, 0, 0]
        };
      } else if (gameType === 'tug') {
        var initRope = (rawGameData && typeof rawGameData.rope === 'number' && isFinite(rawGameData.rope)) ? rawGameData.rope : 0;
        gameData = { rope: initRope };
      } else if (gameType === 'relay') {
        gameData = {
          points: window.TTMModes ? window.TTMModes.toNumArray(rawGameData && rawGameData.points, 3, 0) : [0, 0, 0],
          pointers: window.TTMModes ? window.TTMModes.toNumArray(rawGameData && rawGameData.pointers, 3, 0) : [0, 0, 0]
        };
      }

      var curRelay = rState.relay || null;
      var curSub = rState.sub || null;
      var betsByQ = hostState.bets || {};
      var roundsList = (window.TTMModes && window.TTMModes.roundsOf) ? window.TTMModes.roundsOf(questions) : [];
      var hasRounds = roundsList.length >= 2;
      var roundSecs = hostState.roundSecs || rState.roundSecs || null;

      function roundDurationOf(roundIdx) {
        if (Array.isArray(roundSecs) && roundSecs[roundIdx] !== undefined) {
          var rs = validDuration(roundSecs[roundIdx]);
          if (rs) return rs;
        }
        var r = roundsList[roundIdx];
        if (r && validDuration(r.sec)) return validDuration(r.sec);
        return validDuration(duration) || 20;
      }

      function qRoundInfo(idx) {
        if (!hasRounds || idx < 0 || idx >= questions.length) return null;
        for (var ri = 0; ri < roundsList.length; ri++) {
          var r = roundsList[ri];
          if (idx >= r.start && idx < r.start + r.count) {
            var lbl = (window.TTMModes && window.TTMModes.roundLabel)
              ? window.TTMModes.roundLabel(r)
              : ('Round ' + r.n + (r.title ? ' · ' + r.title : ''));
            return {
              roundIndex: ri,
              n: r.n,
              title: r.title || '',
              i: (idx - r.start) + 1,
              count: r.count,
              sec: roundDurationOf(ri),
              label: lbl
            };
          }
        }
        return null;
      }

      function questionDuration(idx) {
        var ri = qRoundInfo(idx);
        if (ri && validDuration(ri.sec)) return validDuration(ri.sec);
        return validDuration(duration) || 20;
      }

      function hostRoundPill(rInfo) {
        if (!rInfo) return null;
        var txt = 'Round ' + rInfo.n + (rInfo.title ? ' · ' + rInfo.title : '') + ' · câu ' + rInfo.i + '/' + rInfo.count;
        return h('span', { class: 'pill game-round-pill' }, txt);
      }

      var playersMap = (hostState.resumedRoom && hostState.resumedRoom.players) || {};
      var scoresMap = hostState.scores || (hostState.resumedRoom && hostState.resumedRoom.scores) || {};
      var phase = rState.phase || 'lobby';
      var curIndex = typeof rState.index === 'number' ? rState.index : -1;

      roomActive = phase !== 'end';

      var stage = h('div', { class: 'game-host-stage' });
      var offAnswerListener = null;
      var stopQTimer = null;
      var lobbyListEl = null;
      var lobbyCountEl = null;
      var lobbyStartBtn = null;
      var splitBtn = null;
      var qAnsweredEl = null;
      var relayProgressWrap = null;
      var currentQAnswers = {};
      var curStartedAt = rState.startedAt || 0;
      var revealing = false;
      var closingBet = false;

      T.fill(T.app, stage);

      function clearQuestionWatchers() {
        if (offAnswerListener) { offAnswerListener(); offAnswerListener = null; }
        if (stopQTimer) { stopQTimer(); stopQTimer = null; }
      }

      function buildStatePayload(base) {
        var st = {};
        var k;
        for (k in base) {
          if (Object.prototype.hasOwnProperty.call(base, k) && base[k] !== undefined) {
            st[k] = base[k];
          }
        }
        st.gameType = gameType;
        st.dragFill = dragFill;
        if (teamMode && gameType !== 'wager') {
          st.teamMode = true;
          st.teamCount = teamCount;
          if (teamOf && Object.keys(teamOf).length > 0) {
            st.teamOf = teamOf;
          }
        }
        if (gameData) {
          st.gameData = gameData;
        }
        if (gameType === 'relay' && curRelay) {
          st.relay = curRelay;
        }
        if (hasRounds && Array.isArray(roundSecs)) {
          st.roundSecs = roundSecs;
        }
        return st;
      }

      function persistLocal() {
        var hsObj = {
          pin: pin,
          quizId: q.id,
          duration: duration,
          roundSecs: roundSecs,
          questions: questions,
          scores: scoresMap,
          savedMatch: !!hostState.savedMatch,
          gameType: gameType,
          dragFill: dragFill,
          teamMode: teamMode,
          teamCount: teamCount,
          teamOf: teamOf,
          gameData: gameData,
          bets: betsByQ
        };
        saveHostState(quizId, hsObj);
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

      function allRelayTeamsDone(relayObj) {
        if (!relayObj) return false;
        var keys = Object.keys(relayObj);
        if (!keys.length) return false;
        for (var i = 0; i < keys.length; i++) {
          var s = relayObj[keys[i]];
          if (s && !s.done) return false;
        }
        return true;
      }

      function evaluateRelayAnswers(item, ansMap) {
        if (!curRelay || !window.TTMModes) return false;
        var changed = false;
        var nowMs = serverNow();
        for (var t = 0; t < 3; t++) {
          var slot = curRelay[String(t)];
          if (!slot || slot.done) continue;
          var members = window.TTMModes.teamMembers(teamOf, playersMap, t);
          if (!members.length) {
            slot.done = true;
            slot.ok = false;
            changed = true;
            continue;
          }
          // Nếu người cầm lượt đã rời phòng, chuyển sang bạn tiếp theo
          if (members.indexOf(slot.uid) < 0) {
            window.TTMModes.relayAdvance(curRelay, t, members, nowMs);
            slot = curRelay[String(t)];
            changed = true;
          }
          var guard = 0;
          while (slot && !slot.done && slot.uid && guard < members.length + 2) {
            guard++;
            var ans = ansMap && ansMap[slot.uid];
            var hasAns = ans && ans.a !== undefined && ans.a !== null && ans.a !== '';
            if (!hasAns) break;
            var right = false;
            if (item.type === 'fill') {
              var parts = String(ans.a).split('\u241F');
              right = (window.QuizFormat.fillScore(item, parts) === 1);
            } else {
              right = window.QuizFormat.isCorrect(item, ans.a);
            }
            if (right) {
              slot.done = true;
              slot.ok = true;
              var pts = window.TTMModes.relayPoints(slot.tried);
              slot.gain = pts;
              gameData.points[t] = Number(gameData.points[t] || 0) + pts;
              changed = true;
            } else {
              window.TTMModes.relayAdvance(curRelay, t, members, nowMs);
              slot = curRelay[String(t)];
              changed = true;
            }
          }
        }
        return changed;
      }

      // Lắng nghe danh sách học sinh vào phòng trực tiếp
      tracker.on(roomRef.child('players'), 'value', function (snap) {
        playersMap = snap.val() || {};
        var uids = Object.keys(playersMap);
        if (teamMode && gameType !== 'wager' && (isFixedTeamGame || Object.keys(teamOf).length > 0) && phase !== 'end') {
          uids.forEach(function (u) {
            if (teamOf[u] === undefined) {
              var stIdx = smallestTeam(teamOf, playersMap, teamCount);
              teamOf[u] = stIdx;
              roomRef.child('state/teamOf/' + u).set(stIdx).catch(function () {});
              if (phase === 'question' && gameType === 'relay' && curRelay && !curRelay[String(stIdx)]) {
                curRelay[String(stIdx)] = {
                  uid: u,
                  tried: 0,
                  triedUids: [],
                  done: false,
                  ok: false,
                  at: serverNow()
                };
                roomRef.child('state/relay/' + stIdx).set(curRelay[String(stIdx)]).catch(function () {});
              }
            }
          });
        }
        if (phase === 'lobby') {
          updateLobbyPlayers();
        } else if (phase === 'question') {
          updateAnsweredCount();
          if (gameType === 'wager' && curSub === 'bet') {
            var betCount = countValidAnswers(currentQAnswers, playersMap);
            if (uids.length > 0 && betCount >= uids.length && !closingBet) {
              finishBetStep(curIndex);
            }
          } else if (gameType === 'relay') {
            if (relayProgressWrap && curRelay) {
              T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
            }
          } else {
            var ansCount = countValidAnswers(currentQAnswers, playersMap);
            if (uids.length > 0 && ansCount >= uids.length && !revealing) {
              revealQuestion(curIndex);
            }
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
        var list = Object.keys(playersMap).map(function (u) {
          var p = playersMap[u] || {};
          return {
            uid: u,
            name: p.name || p.username || 'Học sinh',
            username: p.username || '',
            joinedAt: p.joinedAt || 0
          };
        });
        list.sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
        lobbyCountEl.textContent = list.length + ' học sinh đã vào phòng';

        lobbyStartBtn.disabled = list.length < 1;
        if (splitBtn) {
          if (gameType === 'wager') {
            splitBtn.style.display = 'none';
          } else {
            splitBtn.style.display = '';
            splitBtn.disabled = list.length < teamCount;
            var hasSplit = teamMode && Object.keys(teamOf).length > 0;
            splitBtn.textContent = hasSplit ? '🎲 Chia lại' : ('🎲 Chia ' + teamCount + ' nhóm');
          }
        }

        if (teamMode && gameType !== 'wager') {
          var teamIdxs = [];
          for (var ti = 0; ti < teamCount; ti++) teamIdxs.push(ti);
          var cols = teamIdxs.map(function (t) {
            var tmInfo = TEAMS[t] || { name: 'Nhóm ' + (t + 1), icon: '👥', color: '#1368ce' };
            var members = list.filter(function (p) {
              return teamOf[p.uid] === t;
            });
            return h('div', {
              class: 'game-team-col',
              style: '--team-color:' + tmInfo.color
            },
              h('div', { class: 'game-team-col-head' },
                h('span', { class: 'game-team-col-title' }, tmInfo.icon + ' ' + tmInfo.name),
                h('span', { class: 'pill small' }, members.length + ' bạn')
              ),
              h('div', { class: 'game-team-col-chips' },
                members.length ? members.map(function (p) {
                  return h('span', { class: 'game-player-chip' }, p.name);
                }) : h('span', { class: 'muted small' }, 'Chưa có thành viên')
              )
            );
          });
          T.fill(lobbyListEl, h('div', { class: 'game-team-cols' + (teamCount === 2 ? ' cols-2' : '') }, cols));
        } else {
          if (!list.length) {
            T.fill(lobbyListEl, h('p', { class: 'muted' }, 'Đang chờ học sinh nhập mã vào phòng…'));
            return;
          }
          T.fill(lobbyListEl, list.map(function (p) {
            return h('span', { class: 'game-player-chip' }, p.name || p.username);
          }));
        }
      }

      function updateAnsweredCount() {
        if (!qAnsweredEl) return;
        var totalP = Object.keys(playersMap).length;
        var ansP = countValidAnswers(currentQAnswers, playersMap);
        if (gameType === 'wager' && curSub === 'bet') {
          qAnsweredEl.textContent = 'Đã cược: ' + ansP + '/' + totalP;
        } else {
          qAnsweredEl.textContent = 'Đã trả lời: ' + ansP + '/' + totalP;
        }
      }

      function drawLobby() {
        clearQuestionWatchers();
        phase = 'lobby';
        roomActive = true;
        lobbyCountEl = h('span', { class: 'pill p-blue game-count-pill' }, '0 học sinh đã vào phòng');
        lobbyListEl = h('div', { class: 'game-players' });

        // Giáo viên chủ động chia khi học sinh đã vào đủ; với game nhóm tự chia sẵn nhưng vẫn bấm Chia lại được.
        splitBtn = h('button', {
          class: 'btn btn-ghost',
          disabled: true,
          onclick: function () {
            var uids = Object.keys(playersMap);
            if (uids.length < teamCount) return;
            var nextTeams = splitTeams(uids, teamCount);
            T.busy(splitBtn, true, 'Đang chia…');
            roomRef.child('state').update({
              teamMode: true,
              teamCount: teamCount,
              teamOf: nextTeams
            }).then(function () {
              teamMode = true;
              teamOf = nextTeams;
              persistLocal();
              T.busy(splitBtn, false);
              updateLobbyPlayers();
            }).catch(function (err) {
              T.busy(splitBtn, false);
              updateLobbyPlayers();
              T.toast('Lỗi khi chia nhóm: ' + err.message, 'error');
            });
          }
        }, '🎲 Chia ' + teamCount + ' nhóm');

        lobbyStartBtn = h('button', {
          class: 'btn btn-lg',
          disabled: true,
          onclick: function () {
            var uids = Object.keys(playersMap);
            if (teamMode && gameType !== 'wager') {
              if (uids.length < teamCount) {
                if (!confirm('Hiện mới có ' + uids.length + ' học sinh, ít hơn ' + teamCount + ' nhóm. Thầy cô vẫn muốn bắt đầu?')) {
                  return;
                }
              }
              var needSplit = Object.keys(teamOf).length === 0;
              uids.forEach(function (u) {
                if (teamOf[u] === undefined) needSplit = true;
              });
              if (needSplit) {
                teamOf = splitTeams(uids, teamCount);
              }
            }
            startQuestion(0, false, false);
          }
        }, '▶ Bắt đầu');

        var gameMeta = window.TTMModes ? window.TTMModes.getGame(gameType) : null;
        var modeBadgeText = gameMeta ? (gameMeta.icon + ' ' + gameMeta.name) : '🎮 Đấu từng câu';

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('div', null,
              h('span', { class: 'tag' }, d.course.name + ' · ' + d.course.grade + ' · ' + modeBadgeText),
              h('h2', null, q.title)),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-ghost', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'),
              splitBtn,
              lobbyStartBtn)),
          h('div', { class: 'panel game-lobby-hero' },
            h('p', { class: 'game-lobby-step' }, 'Vào Khu học tập → 🎮 Đấu cả lớp → nhập mã'),
            h('div', {
              class: 'game-pin',
              title: 'Bấm để sao chép mã phòng',
              onclick: function () { T.copy(pin); }
            }, fmtPin(pin)),
            h('p', { class: 'muted small' }, 'Bấm vào mã phòng để sao chép · ' + modeBadgeText + ' · ' + (hasRounds ? (roundsList.length + ' round · ' + questions.length + ' câu') : (questions.length + ' câu · ' + duration + ' giây/câu')))),
          h('div', { class: 'panel' },
            h('div', { class: 'list-head', style: 'margin-bottom:14px' },
              h('h3', null, 'Danh sách học sinh'),
              lobbyCountEl),
            lobbyListEl));

        updateLobbyPlayers();
      }

      function startBetStep(idx, isResume) {
        clearQuestionWatchers();
        revealing = false;
        closingBet = false;
        phase = 'question';
        curIndex = idx;
        curSub = 'bet';
        roomActive = true;
        currentQAnswers = {};
        var betDur = 10;

        if (idx === 0 && !isResume) {
          var startPts = (window.TTMModes && window.TTMModes.WAGER_START) || 1000;
          Object.keys(playersMap).forEach(function (u) {
            if (!scoresMap[u]) {
              scoresMap[u] = {
                score: startPts,
                correctCount: 0,
                streak: 0,
                lastCorrect: false,
                lastGain: 0,
                lastLoss: 0,
                lastBet: 0,
                rank: 1
              };
            }
          });
          persistLocal();
        }

        var rInfoBet = qRoundInfo(idx);
        var clockEl = h('span', { class: 'clock game-timer' }, '⏱ ' + betDur + 's');
        qAnsweredEl = h('span', { class: 'pill p-blue game-count-pill' }, 'Đã cược: 0/' + Object.keys(playersMap).length);
        var startQBtn = h('button', {
          class: 'btn btn-sm',
          onclick: function () { finishBetStep(idx); }
        }, 'Bắt đầu câu hỏi');

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Mã phòng: ' + fmtPin(pin) + ' · Câu ' + (idx + 1) + ' / ' + questions.length + ' (Đặt cược)'),
            hostRoundPill(rInfoBet),
            clockEl,
            qAnsweredEl,
            h('div', { class: 'add-bar' },
              startQBtn,
              h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'))),
          h('div', { class: 'panel game-q-panel game-bet-host-panel' },
            h('div', { class: 'game-badge' }, '🎲 Đặt cược điểm · Câu ' + (idx + 1)),
            h('h2', { class: 'game-q-text' }, 'Mọi người đang đặt cược'),
            h('p', { class: 'muted' }, 'Học sinh chọn mức cược (100, 200, 300, 500 hoặc Tất tay) trên điện thoại trước khi mở câu hỏi.')));

        var applyPromise;
        if (isResume && curStartedAt) {
          applyPromise = Promise.resolve();
        } else {
          curStartedAt = serverNow();
          var betBaseSt = {
            phase: 'question',
            index: idx,
            sub: 'bet',
            qkey: 'b' + idx,
            total: questions.length,
            startedAt: SERVER_TS,
            duration: betDur
          };
          if (rInfoBet) {
            betBaseSt.round = { n: rInfoBet.n, title: rInfoBet.title, i: rInfoBet.i, count: rInfoBet.count };
          }
          var statePayload = buildStatePayload(betBaseSt);
          var qPlaceholder = {
            index: idx,
            type: 'mc',
            text: 'Đặt cược'
          };
          var upd = {
            state: statePayload,
            question: qPlaceholder,
            reveal: null
          };
          if (idx === 0 && Object.keys(scoresMap).length > 0) {
            upd.scores = scoresMap;
          }
          applyPromise = roomRef.update(upd).then(function () {
            return roomRef.child('state/startedAt').once('value').then(function (s) {
              if (s.val()) curStartedAt = Number(s.val());
            });
          });
        }

        applyPromise.then(function () {
          if (!tracker.alive() || phase !== 'question' || curIndex !== idx || curSub !== 'bet') return;

          offAnswerListener = tracker.on(roomRef.child('answers/b' + idx), 'value', function (snap) {
            currentQAnswers = snap.val() || {};
            updateAnsweredCount();
            var totalP = Object.keys(playersMap).length;
            var ansP = countValidAnswers(currentQAnswers, playersMap);
            if (totalP > 0 && ansP >= totalP && !closingBet) {
              finishBetStep(idx);
            }
          });

          function tickBet() {
            var leftMs = (Number(curStartedAt) + betDur * 1000) - serverNow();
            var sec = Math.max(0, Math.ceil(leftMs / 1000));
            clockEl.textContent = '⏱ ' + sec + 's';
            clockEl.classList.toggle('low', sec <= 3);
            if (leftMs <= 0 && !closingBet) {
              finishBetStep(idx);
            }
          }
          tickBet();
          stopQTimer = tracker.interval(tickBet, 200);
        });
      }

      function finishBetStep(idx) {
        if (closingBet) return;
        closingBet = true;
        clearQuestionWatchers();
        roomRef.child('answers/b' + idx).once('value').then(function (snap) {
          if (!tracker.alive()) return;
          var rawBets = snap.val() || {};
          var map = {};
          Object.keys(rawBets).forEach(function (u) {
            if (rawBets[u] && rawBets[u].a !== undefined) {
              map[u] = rawBets[u].a;
            }
          });
          betsByQ[idx] = map;
          persistLocal();
          startQuestion(idx, false, true);
        }).catch(function () {
          if (!tracker.alive()) return;
          startQuestion(idx, false, true);
        });
      }

      function startQuestion(idx, isResume, skipBet) {
        if (gameType === 'wager' && !skipBet && (!isResume || curSub === 'bet')) {
          return startBetStep(idx, isResume);
        }
        clearQuestionWatchers();
        revealing = false;
        closingBet = false;
        phase = 'question';
        curIndex = idx;
        curSub = gameType === 'wager' ? 'answer' : null;
        roomActive = true;
        currentQAnswers = {};
        var item = questions[idx];
        var qDur = questionDuration(idx);
        var rInfo = qRoundInfo(idx);

        var clockEl = h('span', { class: 'clock game-timer' }, '⏱ ' + qDur + 's');
        qAnsweredEl = h('span', { class: 'pill p-blue game-count-pill' }, 'Đã trả lời: 0/' + Object.keys(playersMap).length);
        var skipBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          onclick: function () { revealQuestion(idx); }
        }, 'Bỏ qua thời gian ⏭');

        var progressBanner = null;
        relayProgressWrap = null;
        if (gameType === 'race') {
          progressBanner = raceTrackEl(gameData && gameData.pos, questions.length, teamOf, playersMap, true);
        } else if (gameType === 'tug') {
          progressBanner = tugRopeEl(gameData && gameData.rope, true);
        } else if (gameType === 'relay') {
          relayProgressWrap = h('div', { class: 'game-relay-host-wrap' });
          if (curRelay) {
            T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
          }
          progressBanner = relayProgressWrap;
        }

        var bCount = item.type === 'fill' ? (window.QuizFormat ? window.QuizFormat.blankCount(item.text) : 2) : 0;
        var builtBank = null;
        var hasBank = false;
        if (isResume && curStartedAt) {
          var resumedQ = hostState.resumedRoom && hostState.resumedRoom.question;
          if (resumedQ && Number(resumedQ.index) === idx) {
            hasBank = !!(resumedQ.bank && resumedQ.bank.length > 0);
          } else if (dragFill && item.type === 'fill' && bCount >= 2 && window.TTMModes && window.TTMModes.buildBank) {
            var chkBank = window.TTMModes.buildBank(item, questions);
            hasBank = !!(chkBank && chkBank.length > 0);
          }
        } else if (dragFill && item.type === 'fill' && bCount >= 2 && window.TTMModes && window.TTMModes.buildBank) {
          var candBank = window.TTMModes.buildBank(item, questions);
          if (candBank && candBank.length > 0) {
            builtBank = candBank;
            hasBank = true;
          }
        }

        var optionsEl = null;
        if (item.type === 'mc') {
          optionsEl = h('div', { class: 'game-mc-grid' }, (item.options || []).map(function (optText, k) {
            var color = OPT_COLORS[k % OPT_COLORS.length];
            var sym = OPT_SYMS[k % OPT_SYMS.length];
            var letter = String.fromCharCode(65 + k);
            return h('div', { class: 'game-opt', style: '--opt-bg:' + color },
              h('span', { class: 'game-opt-sym' }, sym),
              h('span', { class: 'game-opt-letter' }, letter),
              h('span', { class: 'game-opt-text' }, T.mathNodes(optText)));
          }));
        } else if (item.type === 'fill') {
          optionsEl = h('div', { class: 'panel game-short-banner' },
            hasBank
              ? '🧩 Học sinh kéo thẻ vào ô trống trên điện thoại'
              : '✍️ Câu điền khuyết — học sinh điền các ô trống trên điện thoại và bấm Gửi.');
        } else {
          optionsEl = h('div', { class: 'panel game-short-banner' },
            '✍️ Câu trả lời ngắn — học sinh nhập đáp án trên điện thoại và bấm Gửi.');
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Mã phòng: ' + fmtPin(pin) + ' · Câu ' + (idx + 1) + ' / ' + questions.length),
            hostRoundPill(rInfo),
            clockEl,
            qAnsweredEl,
            h('div', { class: 'add-bar' },
              skipBtn,
              h('button', { class: 'btn btn-sm btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'))),
          progressBanner,
          h('div', { class: 'panel game-q-panel' },
            h('h2', { class: 'game-q-text prewrap' }, T.qNodes(item.text || '')),
            item.image ? T.qImageEl({ kind: 'quiz', id: q.id, key: item.image }) : null),
          optionsEl);

        var applyPromise;
        if (isResume && curStartedAt) {
          if (gameType === 'relay' && !curRelay && window.TTMModes) {
            curRelay = window.TTMModes.relayStart(teamOf, playersMap, gameData && gameData.pointers, curStartedAt);
          }
          if (relayProgressWrap && curRelay) {
            T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
          }
          applyPromise = Promise.resolve();
        } else {
          curStartedAt = serverNow();
          if (gameType === 'relay' && window.TTMModes) {
            curRelay = window.TTMModes.relayStart(teamOf, playersMap, gameData && gameData.pointers, curStartedAt);
            if (relayProgressWrap) {
              T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
            }
          }
          var qPayload = {
            index: idx,
            type: item.type === 'fill' ? 'short' : item.type,
            text: item.text,
            options: item.type === 'mc' ? item.options : null,
            image: item.image || null
          };
          if (bCount >= 2) qPayload.blanks = bCount;
          if (builtBank) qPayload.bank = builtBank;
          var baseSt = {
            phase: 'question',
            index: idx,
            // Khóa câu dạng chuỗi: luật Firebase so với tên nút answers/$i (luôn là chuỗi).
            qkey: String(idx),
            total: questions.length,
            startedAt: SERVER_TS,
            duration: qDur
          };
          if (rInfo) {
            baseSt.round = { n: rInfo.n, title: rInfo.title, i: rInfo.i, count: rInfo.count };
          }
          if (gameType === 'wager') {
            baseSt.sub = 'answer';
          }
          var statePayload = buildStatePayload(baseSt);
          applyPromise = roomRef.update({
            state: statePayload,
            question: qPayload,
            reveal: null
          }).then(function () {
            return roomRef.child('state/startedAt').once('value').then(function (s) {
              if (s.val()) {
                curStartedAt = Number(s.val());
                if (gameType === 'relay' && curRelay) {
                  for (var tk in curRelay) {
                    if (Object.prototype.hasOwnProperty.call(curRelay, tk) && curRelay[tk]) {
                      curRelay[tk].at = curStartedAt;
                    }
                  }
                  roomRef.child('state/relay').set(curRelay).catch(function () {});
                }
              }
            });
          });
        }

        applyPromise.then(function () {
          if (!tracker.alive() || phase !== 'question' || curIndex !== idx || (gameType === 'wager' && curSub !== 'answer')) return;

          offAnswerListener = tracker.on(roomRef.child('answers/' + idx), 'value', function (snap) {
            currentQAnswers = snap.val() || {};
            updateAnsweredCount();
            if (gameType === 'relay') {
              var changed = evaluateRelayAnswers(item, currentQAnswers);
              if (changed) {
                var deepUpd = {};
                for (var kt in curRelay) {
                  if (Object.prototype.hasOwnProperty.call(curRelay, kt)) {
                    deepUpd['state/relay/' + kt] = curRelay[kt];
                  }
                }
                deepUpd['state/gameData'] = gameData;
                roomRef.update(deepUpd).catch(function () {});
                persistLocal();
                if (relayProgressWrap) {
                  T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
                }
              }
              if (allRelayTeamsDone(curRelay) && !revealing) {
                revealQuestion(idx);
              }
            } else {
              var totalP = Object.keys(playersMap).length;
              var ansP = countValidAnswers(currentQAnswers, playersMap);
              if (totalP > 0 && ansP >= totalP && !revealing) {
                revealQuestion(idx);
              }
            }
          });

          function tick() {
            var nowMs = serverNow();
            var leftMs = (Number(curStartedAt) + qDur * 1000) - nowMs;
            var sec = Math.max(0, Math.ceil(leftMs / 1000));
            clockEl.textContent = '⏱ ' + sec + 's';
            clockEl.classList.toggle('low', sec <= 5);

            if (gameType === 'relay' && curRelay && !revealing && leftMs > 0 && window.TTMModes) {
              var turnLimitMs = Math.max(6, Math.floor(qDur / 3)) * 1000;
              var relayUpdates = {};
              var anyTimedOut = false;
              for (var rt = 0; rt < 3; rt++) {
                var rSlot = curRelay[String(rt)];
                if (rSlot && !rSlot.done && rSlot.uid) {
                  var startedTurnAt = Number(rSlot.at || curStartedAt || nowMs);
                  if (nowMs - startedTurnAt >= turnLimitMs) {
                    var tMembers = window.TTMModes.teamMembers(teamOf, playersMap, rt);
                    window.TTMModes.relayAdvance(curRelay, rt, tMembers, nowMs);
                    evaluateRelayAnswers(item, currentQAnswers);
                    relayUpdates['state/relay/' + rt] = curRelay[String(rt)];
                    anyTimedOut = true;
                  }
                }
              }
              if (anyTimedOut) {
                relayUpdates['state/gameData'] = gameData;
                roomRef.update(relayUpdates).catch(function () {});
                persistLocal();
                if (relayProgressWrap) {
                  T.fill(relayProgressWrap, relayStatusEl(curRelay, teamOf, playersMap, gameData && gameData.points, true));
                }
                if (allRelayTeamsDone(curRelay) && !revealing) {
                  revealQuestion(idx);
                  return;
                }
              }
            }

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
        var qDur = questionDuration(idx);

        Promise.all([
          roomRef.child('answers/' + idx).once('value'),
          roomRef.child('players').once('value'),
          roomRef.child('state/startedAt').once('value'),
          gameType === 'wager' ? roomRef.child('answers/b' + idx).once('value') : Promise.resolve(null)
        ]).then(function (snaps) {
          if (!tracker.alive()) return;
          var ansMap = snaps[0].val() || {};
          playersMap = snaps[1].val() || playersMap || {};
          var startedAt = Number(snaps[2].val() || curStartedAt || serverNow());
          if (gameType === 'wager' && snaps[3]) {
            var rawB = snaps[3].val() || {};
            var bMap = betsByQ[idx] || {};
            Object.keys(rawB).forEach(function (u) {
              if (rawB[u] && rawB[u].a !== undefined) bMap[u] = rawB[u].a;
            });
            betsByQ[idx] = bMap;
          }

          if (gameType === 'relay') {
            evaluateRelayAnswers(item, ansMap);
          }

          var counts = item.type === 'mc'
            ? (item.options || []).map(function () { return 0; })
            : [0, 0];

          var pUids = Object.keys(playersMap);
          var newScores = {};
          var ratioByUid = {};
          var qBets = betsByQ[idx] || {};
          var startPts = (window.TTMModes && window.TTMModes.WAGER_START) || 1000;

          pUids.forEach(function (u) {
            var defaultPrevScore = gameType === 'wager' ? startPts : 0;
            var prev = scoresMap[u] || { score: defaultPrevScore, correctCount: 0, streak: 0, lastCorrect: false, lastGain: 0, rank: 1 };
            var ans = ansMap[u];
            var hasAns = !!(ans && ans.a !== undefined && ans.a !== null && ans.a !== '');
            var right = false;
            var ratio = 0;

            if (gameType === 'relay') {
              var uTeam = teamOf[u];
              var slot = (uTeam !== undefined && curRelay) ? curRelay[String(uTeam)] : null;
              var triedList = (slot && window.TTMModes) ? window.TTMModes.toStrArray(slot.triedUids) : [];
              var hadTurn = !!(slot && (triedList.indexOf(u) >= 0 || slot.uid === u));
              var rightOnTurn = !!(slot && slot.done && slot.ok && slot.uid === u);

              if (hadTurn && hasAns) {
                if (item.type === 'mc') {
                  var kRel = Number(ans.a);
                  if (kRel >= 0 && kRel < counts.length) counts[kRel]++;
                } else {
                  if (rightOnTurn) counts[0]++;
                  else counts[1]++;
                }
              }

              if (rightOnTurn) {
                var relElapsed = (ans && ans.t && startedAt)
                  ? Math.max(0, Math.min(qDur, (Number(ans.t) - startedAt) / 1000))
                  : qDur;
                var relBase = Math.round(1000 * (1 - 0.5 * (relElapsed / qDur)));
                var relStreak = Number(prev.streak || 0) + 1;
                var relBonus = relStreak >= 2 ? Math.min(500, 100 * (relStreak - 1)) : 0;
                var relGain = relBase + relBonus;
                newScores[u] = {
                  score: Number(prev.score || 0) + relGain,
                  correctCount: Number(prev.correctCount || 0) + 1,
                  streak: relStreak,
                  lastCorrect: true,
                  lastGain: relGain,
                  lastTurn: true,
                  rank: 1
                };
              } else {
                newScores[u] = {
                  score: Number(prev.score || 0),
                  correctCount: Number(prev.correctCount || 0),
                  streak: Number(prev.streak || 0),
                  lastCorrect: false,
                  lastGain: 0,
                  lastTurn: !!hadTurn,
                  rank: 1
                };
              }
              return;
            }

            if (item.type === 'mc') {
              right = hasAns ? window.QuizFormat.isCorrect(item, ans.a) : false;
              ratio = right ? 1 : 0;
              if (hasAns) {
                var k = Number(ans.a);
                if (k >= 0 && k < counts.length) counts[k]++;
              }
            } else if (item.type === 'fill') {
              if (hasAns) {
                var parts = String(ans.a).split('\u241F');
                ratio = window.QuizFormat.fillScore(item, parts);
                right = (ratio === 1);
              }
              if (right) counts[0]++;
              else counts[1]++;
            } else {
              right = hasAns ? window.QuizFormat.isCorrect(item, ans.a) : false;
              ratio = right ? 1 : 0;
              if (right) counts[0]++;
              else counts[1]++;
            }

            ratioByUid[u] = ratio;

            if (gameType === 'wager' && window.TTMModes) {
              var betLevel = qBets[u];
              var betAmt = window.TTMModes.betAmount(betLevel, prev.score);
              var wRes = window.TTMModes.applyWager(prev.score, betAmt, ratio, hasAns);
              var wStreak = ratio === 1 ? (Number(prev.streak || 0) + 1) : 0;
              newScores[u] = {
                score: wRes.score,
                correctCount: Number(prev.correctCount || 0) + (right ? 1 : 0),
                streak: wStreak,
                lastCorrect: !!right,
                lastGain: wRes.gain,
                lastLoss: wRes.loss,
                lastBet: betAmt,
                lastPartial: ratio > 0 && ratio < 1,
                rank: 1
              };
              return;
            }

            var gain = 0;
            var streak = 0;
            if (ratio > 0) {
              var elapsed = (ans && ans.t && startedAt)
                ? Math.max(0, Math.min(qDur, (Number(ans.t) - startedAt) / 1000))
                : qDur;
              var base = Math.round(1000 * (1 - 0.5 * (elapsed / qDur)));
              if (ratio === 1) {
                streak = Number(prev.streak || 0) + 1;
                var bonus = streak >= 2 ? Math.min(500, 100 * (streak - 1)) : 0;
                gain = Math.round(base * ratio) + bonus;
              } else {
                streak = 0;
                gain = Math.round(base * ratio);
              }
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

          var correctVal;
          if (item.type === 'mc') {
            correctVal = Number(item.correct);
          } else if (item.type === 'fill') {
            correctVal = (item.answers || []).map(function (a) {
              return Array.isArray(a) ? a[0] : String(a || '');
            }).join('  ;  ').slice(0, 300);
          } else {
            correctVal = String((item.answers && item.answers[0]) || '');
          }

          var revealObj = {
            index: idx,
            correct: correctVal,
            counts: counts,
            top: top
          };

          if (gameType === 'race' && window.TTMModes) {
            gameData.pos = window.TTMModes.raceStep(gameData && gameData.pos, teamOf, playersMap, ratioByUid);
            revealObj.teams = window.TTMModes.raceStandings(gameData.pos, teamOf, playersMap, questions.length);
          } else if (gameType === 'tug' && window.TTMModes) {
            gameData.rope = window.TTMModes.tugStep(gameData && gameData.rope, teamOf, playersMap, ratioByUid, questions.length);
            revealObj.teams = window.TTMModes.tugStandings(gameData.rope, teamOf, playersMap, newScores);
          } else if (gameType === 'relay' && window.TTMModes) {
            gameData.pointers = window.TTMModes.relayNextPointers(gameData && gameData.pointers, curRelay, teamOf, playersMap);
            revealObj.teams = window.TTMModes.relayStandings(gameData.points, teamOf, playersMap);
            revealObj.relay = curRelay;
          } else if (teamMode && gameType !== 'wager') {
            revealObj.teams = teamStandings(teamOf, playersMap, newScores, teamCount);
          }

          scoresMap = newScores;
          persistLocal();

          var fbUpd = {
            'state/phase': 'reveal',
            reveal: revealObj,
            scores: newScores
          };
          if (gameData) {
            fbUpd['state/gameData'] = gameData;
          }
          if (gameType === 'relay' && curRelay) {
            fbUpd['state/relay'] = curRelay;
          }

          return roomRef.update(fbUpd).then(function () {
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
        var tugKo = (gameType === 'tug' && gameData && Math.abs(Number(gameData.rope || 0)) >= 100);
        var isLast = (idx >= questions.length - 1) || tugKo;
        var rCur = qRoundInfo(idx);
        var rNext = (idx + 1 < questions.length) ? qRoundInfo(idx + 1) : null;
        var isRoundEnd = !isLast && !!(rCur && rNext && rCur.n !== rNext.n);
        var nextBtnLabel = isLast
          ? '🏆 Xem kết quả'
          : (isRoundEnd ? ('🏁 Kết thúc Round ' + rCur.n + ' →') : 'Câu tiếp →');

        var nextBtn = h('button', {
          class: 'btn btn-lg' + ((isLast || isRoundEnd) ? ' btn-accent' : ''),
          onclick: function () {
            if (isLast) {
              finishMatch();
              return;
            }
            if (isRoundEnd) {
              var rbPayload = {
                done: rCur.n,
                doneLabel: rCur.label,
                next: rNext.n,
                nextLabel: rNext.label,
                nextCount: rNext.count,
                nextSec: rNext.sec
              };
              T.busy(nextBtn, true, 'Đang chuyển round…');
              roomRef.child('state/roundBreak').set(rbPayload).then(function () {
                if (!tracker.alive()) return;
                drawRoundBreakView(idx, revealObj, rbPayload);
              }).catch(function (err) {
                T.busy(nextBtn, false);
                T.toast('Lỗi khi chuyển round: ' + (err.message || ''), 'error');
              });
              return;
            }
            startQuestion(idx + 1, false, false);
          }
        }, nextBtnLabel);

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
              h('span', { class: 'game-opt-text' }, T.mathNodes(optText)),
              isRight ? h('span', { class: 'game-opt-check' }, '✓ Đúng') : null);
          }));
        } else if (item.type === 'fill') {
          var rightAnsStr = (item.answers || []).map(function (a) {
            return Array.isArray(a) ? a.join(' | ') : String(a || '');
          }).join('  ;  ');
          answerHighlight = h('div', { class: 'panel game-short-correct' },
            '✓ Đáp án đúng: ',
            h('strong', null, T.mathNodes(rightAnsStr)));
        } else {
          answerHighlight = h('div', { class: 'panel game-short-correct' },
            '✓ Đáp án đúng: ',
            h('strong', null, T.mathNodes((item.answers || [revealObj.correct]).join('  |  '))));
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

        var modeVisualBanner = null;
        if (gameType === 'race') {
          modeVisualBanner = raceTrackEl(gameData && gameData.pos, questions.length, teamOf, playersMap, false);
        } else if (gameType === 'tug') {
          modeVisualBanner = tugRopeEl(gameData && gameData.rope, false);
        } else if (gameType === 'relay') {
          modeVisualBanner = relayStatusEl((revealObj && revealObj.relay) || curRelay, teamOf, playersMap, gameData && gameData.points, false);
        }

        var rightCol;
        if (teamMode && gameType !== 'wager') {
          rightCol = h('div', { class: 'panel' },
            h('h3', { class: 'game-subhead' }, '👥 Bảng điểm nhóm'),
            teamBoardEl(revealObj.teams || [], null, gameType));
        } else {
          rightCol = h('div', { class: 'panel' },
            h('h3', { class: 'game-subhead' }, '🔥 Top 5 dẫn đầu'),
            top.length ? h('div', { class: 'game-top-list' }, top.map(function (t, i) {
              return h('div', { class: 'game-top-row' },
                h('span', { class: 'game-top-rank' }, '#' + (i + 1)),
                h('strong', { class: 'game-top-name' }, t.name),
                h('span', { class: 'pill p-done' }, T.fmtScore(t.score) + ' đ'));
            })) : h('p', { class: 'muted' }, 'Chưa có dữ liệu điểm.'));
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Kết quả câu ' + (idx + 1) + ' / ' + questions.length),
            hostRoundPill(rCur),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'),
              nextBtn)),
          modeVisualBanner,
          h('div', { class: 'panel game-q-panel compact' },
            h('h2', { class: 'game-q-text sm prewrap' }, T.qNodes(item.text || '')),
            item.image ? T.qImageEl({ kind: 'quiz', id: q.id, key: item.image }) : null,
            item.explain ? h('div', { class: 'explain' }, h('strong', null, '💡 Lời giải: '), h('span', { class: 'prewrap' }, T.mathNodes(item.explain))) : null),
          answerHighlight,
          h('div', { class: 'game-reveal-grid' },
            h('div', { class: 'panel' },
              h('h3', { class: 'game-subhead' }, 'Thống kê câu trả lời'),
              h('div', { class: 'game-chart' }, chartCols)),
            rightCol));
      }

      function drawRoundBreakView(idx, revealObj, rb) {
        clearQuestionWatchers();
        phase = 'reveal';
        curIndex = idx;
        revealObj = revealObj || {};
        rb = rb || {};
        var doneLabel = rb.doneLabel || ('Round ' + rb.done);
        var nextLabel = rb.nextLabel || ('Round ' + rb.next);
        var startNextBtn = h('button', {
          class: 'btn btn-lg btn-accent',
          onclick: function () { startQuestion(idx + 1, false, false); }
        }, '▶ Bắt đầu Round ' + rb.next);

        var modeVisualBanner = null;
        if (gameType === 'race') {
          modeVisualBanner = raceTrackEl(gameData && gameData.pos, questions.length, teamOf, playersMap, false);
        } else if (gameType === 'tug') {
          modeVisualBanner = tugRopeEl(gameData && gameData.rope, false);
        } else if (gameType === 'relay') {
          modeVisualBanner = relayStatusEl((revealObj && revealObj.relay) || curRelay, teamOf, playersMap, gameData && gameData.points, false);
        }

        var boardPanel;
        if (teamMode && gameType !== 'wager') {
          var teamsData = (revealObj.teams && revealObj.teams.length) ? revealObj.teams : computeFinalTeams();
          boardPanel = h('div', { class: 'panel game-round-break-board' },
            h('h3', { class: 'game-subhead' }, '👥 Bảng điểm nhóm hiện tại'),
            teamBoardEl(teamsData || [], null, gameType));
        } else {
          var top = revealObj.top || [];
          boardPanel = h('div', { class: 'panel game-round-break-board' },
            h('h3', { class: 'game-subhead' }, '🔥 Top 5 dẫn đầu'),
            top.length ? h('div', { class: 'game-top-list' }, top.map(function (t, i) {
              return h('div', { class: 'game-top-row' },
                h('span', { class: 'game-top-rank' }, '#' + (i + 1)),
                h('strong', { class: 'game-top-name' }, t.name),
                h('span', { class: 'pill p-done' }, T.fmtScore(t.score) + ' đ'));
            })) : h('p', { class: 'muted' }, 'Chưa có dữ liệu điểm.'));
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('span', { class: 'pill p-blue game-count-pill' }, 'Mã phòng: ' + fmtPin(pin) + ' · Chuyển round'),
            h('div', { class: 'add-bar' },
              h('button', { class: 'btn btn-ghost danger-text', onclick: function () { closeRoomAndExit(false); } }, 'Đóng phòng'),
              startNextBtn)),
          h('div', { class: 'panel game-round-break-hero' },
            h('h1', { class: 'game-round-break-title' }, '🏁 Hết ' + doneLabel),
            h('div', { class: 'game-round-next-box' },
              'Tiếp theo: ',
              h('strong', null, nextLabel),
              ' — ' + (rb.nextCount || 0) + ' câu · ' + (rb.nextSec || duration) + ' giây/câu')),
          modeVisualBanner,
          boardPanel);
      }

      function computeFinalTeams() {
        if (gameType === 'race' && window.TTMModes) {
          return window.TTMModes.raceStandings(gameData && gameData.pos, teamOf, playersMap, questions.length);
        }
        if (gameType === 'tug' && window.TTMModes) {
          return window.TTMModes.tugStandings(gameData && gameData.rope, teamOf, playersMap, scoresMap);
        }
        if (gameType === 'relay' && window.TTMModes) {
          return window.TTMModes.relayStandings(gameData && gameData.points, teamOf, playersMap);
        }
        return teamStandings(teamOf, playersMap, scoresMap, teamCount);
      }

      function finishMatch() {
        clearQuestionWatchers();
        phase = 'end';
        roomActive = false;
        if (teamMode && gameType !== 'wager') {
          var finalTeams = computeFinalTeams();
          roomRef.child('reveal/teams').set(finalTeams).catch(function () {});
        }
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
            score: Math.max(0, Number(s.score || 0)),
            correctCount: Math.max(0, Number(s.correctCount || 0)),
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
          if (window.TTMDemo && window.TTMDemo.isDemo()) {
            hostState.savedMatch = true;
            T.toast('Xem thử: không lưu kết quả.', 'info');
            T.fill(saveStatusBox, h('span', { class: 'pill p-done' }, 'Xem thử: không lưu kết quả'));
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

        var podiumOrTeamBlock = null;
        if (teamMode && gameType !== 'wager') {
          var endTeams = computeFinalTeams();
          var topTeams = endTeams.filter(function (tm) { return tm.rank === 1 && tm.n > 0; });
          var winnerBanner = null;
          if (topTeams.length === 1) {
            var winT = topTeams[0].t;
            var winInfo = TEAMS[winT] || { name: 'Nhóm ' + (winT + 1), icon: '🏆', color: '#1368ce' };
            var winNames = results.filter(function (r) { return teamOf[r.uid] === winT; }).map(function (r) { return r.fullName; });
            winnerBanner = h('div', { class: 'game-winner-banner', style: '--team-color:' + winInfo.color },
              h('div', { class: 'game-winner-title' }, '🏆 Nhóm chiến thắng: ' + winInfo.icon + ' ' + winInfo.name),
              winNames.length ? h('div', { class: 'game-winner-members muted small' }, 'Thành viên: ' + winNames.join(', ')) : null
            );
          } else if (topTeams.length > 1) {
            var tieNames = topTeams.map(function (tm) {
              var inf = TEAMS[tm.t];
              return inf ? (inf.icon + ' ' + inf.name) : ('Nhóm ' + (tm.t + 1));
            }).join(' & ');
            winnerBanner = h('div', { class: 'game-winner-banner is-tie' },
              h('div', { class: 'game-winner-title' }, '🤝 Kết quả chung cuộc: Hòa (' + tieNames + ')')
            );
          }

          var endVisual = null;
          if (gameType === 'race') {
            endVisual = raceTrackEl(gameData && gameData.pos, questions.length, teamOf, playersMap, false);
          } else if (gameType === 'tug') {
            endVisual = tugRopeEl(gameData && gameData.rope, false);
          }

          podiumOrTeamBlock = h('div', { class: 'panel' },
            h('h3', { class: 'game-subhead', style: 'margin-bottom:14px' }, '🏆 Bảng xếp hạng nhóm chung cuộc'),
            winnerBanner,
            endVisual,
            h('div', { class: 'game-team-cols game-team-end-grid' + (teamCount === 2 ? ' cols-2' : '') }, endTeams.map(function (tm) {
              var tmInfo = TEAMS[tm.t] || { name: 'Nhóm ' + (tm.t + 1), icon: '👥', color: '#1368ce' };
              var isTiedFirst = tm.rank === 1 && topTeams.length > 1;
              var medal = isTiedFirst ? '🤝' : (tm.rank === 1 ? '🥇' : tm.rank === 2 ? '🥈' : tm.rank === 3 ? '🥉' : '🏁');
              var members = results.filter(function (r) {
                return teamOf[r.uid] === tm.t;
              });
              var bigScoreStr;
              var subScoreStr;
              if (gameType === 'race') {
                var stp = tm.value !== undefined ? tm.value : 0;
                bigScoreStr = T.fmtScore(Math.round(stp * 10) / 10) + ' bước';
                subScoreStr = Math.round(tm.pct || 0) + '% đường đua · ' + tm.n + ' bạn';
              } else if (gameType === 'relay') {
                var rPts = tm.value !== undefined ? tm.value : 0;
                bigScoreStr = T.fmtScore(rPts) + ' điểm';
                subScoreStr = 'Tiếp sức · ' + tm.n + ' bạn';
              } else if (gameType === 'tug') {
                var adv = tm.value !== undefined ? tm.value : 0;
                bigScoreStr = (adv > 0 ? '+' : '') + T.fmtScore(adv) + '% dây';
                subScoreStr = 'TB cá nhân ' + T.fmtScore(tm.avg || 0) + ' đ · ' + tm.n + ' bạn';
              } else {
                bigScoreStr = T.fmtScore(tm.avg) + ' đ';
                subScoreStr = 'Tổng ' + T.fmtScore(tm.total) + ' đ · ' + tm.n + ' bạn';
              }
              return h('div', {
                class: 'game-team-end-card',
                style: '--team-color:' + tmInfo.color
              },
                h('div', { class: 'game-team-end-head' },
                  h('span', { class: 'game-team-end-medal' }, medal),
                  h('span', null, tmInfo.icon + ' ' + tmInfo.name)
                ),
                h('div', { class: 'game-team-big-score' }, bigScoreStr),
                h('div', { class: 'muted small' }, subScoreStr),
                h('div', { class: 'game-team-member-list' },
                  members.length ? members.map(function (m) {
                    return h('div', { class: 'game-team-member-item' },
                      h('span', null, m.fullName),
                      h('strong', null, T.fmtScore(m.score) + ' đ')
                    );
                  }) : h('span', { class: 'muted small' }, 'Không có thành viên')
                )
              );
            }))
          );
        } else {
          if (results.length) {
            podiumOrTeamBlock = h('div', { class: 'panel game-podium-panel' },
              h('div', { class: 'game-podium' }, podiumOrder.map(function (slot) {
                if (!slot.r) return h('div', { class: 'game-podium-col empty ' + slot.cls });
                return h('div', { class: 'game-podium-col ' + slot.cls },
                  h('div', { class: 'game-podium-medal' }, slot.medal),
                  h('strong', { class: 'game-podium-name' }, slot.r.fullName),
                  h('span', { class: 'game-podium-score' }, T.fmtScore(slot.r.score) + ' điểm'),
                  h('span', { class: 'muted small' }, 'Đúng ' + slot.r.correctCount + '/' + questions.length + ' câu'),
                  h('div', { class: 'game-podium-pedestal' }, slot.place));
              })));
          }
        }

        T.fill(stage,
          h('div', { class: 'game-host-top' },
            h('div', null,
              h('span', { class: 'tag' }, 'Kết thúc trận đấu · Phòng ' + fmtPin(pin)),
              h('h1', null, '🏆 Bảng vàng chung cuộc: ' + q.title)),
            h('div', { class: 'add-bar' },
              saveStatusBox,
              h('button', { class: 'btn btn-lg', onclick: function () { closeRoomAndExit(true); } }, 'Đóng phòng'))),
          podiumOrTeamBlock,
          h('div', { class: 'panel' },
            h('h3', { class: 'game-subhead' }, 'Bảng xếp hạng đầy đủ (' + results.length + ' học sinh)'),
            results.length ? h('div', { class: 'table-wrap' },
              h('table', { class: 'table' },
                h('thead', null,
                  h('tr', null,
                    h('th', null, 'Hạng'),
                    h('th', null, 'Học sinh'),
                    (teamMode && gameType !== 'wager') ? h('th', null, 'Nhóm') : null,
                    h('th', null, 'Số câu đúng'),
                    h('th', null, 'Tổng điểm'))),
                h('tbody', null, results.map(function (r) {
                  var medal = r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : '';
                  var tmIdx = teamOf[r.uid];
                  var tmInfo = (tmIdx !== undefined && TEAMS[tmIdx]) ? TEAMS[tmIdx] : null;
                  return h('tr', null,
                    h('td', null, h('strong', null, medal + '#' + r.rank)),
                    h('td', null, r.fullName, r.username ? h('span', { class: 'muted small' }, ' (' + r.username + ')') : null),
                    (teamMode && gameType !== 'wager') ? h('td', null, tmInfo ? h('span', {
                      class: 'pill',
                      style: 'border-color:' + tmInfo.color + ';color:' + tmInfo.color + ';font-weight:700'
                    }, tmInfo.icon + ' ' + tmInfo.name) : '–') : null,
                    h('td', null, r.correctCount + ' / ' + questions.length),
                    h('td', null, h('span', { class: 'pill p-done' }, T.fmtScore(r.score) + ' điểm')));
                })))) : h('p', { class: 'muted' }, 'Không có học sinh nào tham gia.')));

        saveMatchToSheets();
      }

      // Khởi chạy màn hình phù hợp (kể cả khi giáo viên tải lại trang và tiếp tục phòng đang mở)
      if (phase === 'question' && curIndex >= 0 && curIndex < questions.length) {
        startQuestion(curIndex, true, curSub === 'answer');
      } else if (phase === 'reveal' && curIndex >= 0 && curIndex < questions.length) {
        var revData = (hostState.resumedRoom && hostState.resumedRoom.reveal) || {};
        if (rState.roundBreak) {
          drawRoundBreakView(curIndex, revData, rState.roundBreak);
        } else {
          drawRevealView(curIndex, revData);
        }
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
    renderPlay: renderPlay,
    renderDemo: function (quizId) { return window.TTMDemo && window.TTMDemo.renderDemo(quizId); },
    fmtPin: fmtPin,
    serverNow: serverNow,
    saveHostState: saveHostState
  };

  // Nếu mở trực tiếp đường dẫn #/dau hoặc #/dau-host hoặc #/dau-demo khi mới tải trang, gọi lại route() sau khi TTMGame đã sẵn sàng
  if (/^#\/?dau(-host|-demo)?(\/|$)/.test(location.hash) && window.TTM && window.TTM.route) {
    window.TTM.route();
  }
})();
