/* Ôn từ vựng – Toán Thầy Minh
 * Học sinh tự làm theo tốc độ riêng, giáo viên theo dõi trực tiếp từng em rồi xếp hạng cuối trận.
 * Dùng chung phòng rooms/$pin của Đấu cả lớp: bộ câu nằm ở state/deck, bài làm ở players/$uid/log/q{i}.
 * Mọi máy tự tính điểm từ bài làm và giờ máy chủ, nên học sinh không tự ghi được điểm của mình.
 */
(function () {
  'use strict';

  var LIMITS = [3, 5, 10]; // số phút cho cả lượt ôn
  var BASE_POINTS = 1000;
  var SPEED_BONUS = 500;
  var SPEED_WINDOW_MS = 15000;
  var LATE_GRACE_MS = 2000;
  var IDLE_MS = 30000;
  var RIGHT_PAUSE_MS = 900;
  var WRONG_PAUSE_MS = 3500;
  var OPT_SYMS = ['▲', '◆', '●', '■', '★', '⬢', '♥', '✦'];
  var OPT_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#7c3aed', '#0891b2', '#db2777', '#ea580c'];

  /* ═══════════ Tính điểm và xếp hạng (giáo viên và học sinh dùng chung) ═══════════ */

  function deadline(st) {
    if (!st || !st.startedAt) return 0;
    var limitAt = Number(st.startedAt) + Number(st.limitSec || 300) * 1000;
    return st.endedAt ? Math.min(limitAt, Number(st.endedAt)) : limitAt;
  }

  /** Chấm một học sinh. Bỏ câu trả lời sau giờ kết thúc; câu đúng càng nhanh càng được thêm điểm. */
  function summarize(player, st) {
    var deck = st.deck || [];
    var log = (player && player.log) || {};
    var end = deadline(st);
    var entries = [];
    deck.forEach(function (q, i) {
      var e = log['q' + i];
      if (!e || typeof e.a !== 'number') return;
      var t = Number(e.t || 0);
      if (end && t > end + LATE_GRACE_MS) return;
      entries.push({ i: i, a: e.a, t: t, ok: e.a === Number(q.correct) });
    });
    entries.sort(function (a, b) { return a.t - b.t; });

    var prev = Math.max(Number(st.startedAt || 0), Number((player && player.joinedAt) || 0));
    var firstAt = prev;
    var score = 0;
    var correct = 0;
    entries.forEach(function (e) {
      e.spent = Math.max(0, e.t - prev);
      prev = e.t;
      if (e.ok) {
        correct++;
        score += BASE_POINTS + Math.round(SPEED_BONUS * Math.max(0, 1 - e.spent / SPEED_WINDOW_MS));
      }
    });
    var done = entries.length;
    return {
      entries: entries,
      done: done,
      correct: correct,
      wrong: done - correct,
      score: score,
      lastAt: done ? entries[done - 1].t : firstAt,
      finishedAt: done && done >= deck.length ? entries[done - 1].t : 0
    };
  }

  function rankPlayers(players, st) {
    var list = Object.keys(players || {}).map(function (uid) {
      var p = players[uid] || {};
      var s = summarize(p, st);
      s.uid = uid;
      s.name = p.name || p.username || 'Học sinh';
      s.username = p.username || '';
      s.joinedAt = Number(p.joinedAt || 0);
      return s;
    });
    list.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correct !== a.correct) return b.correct - a.correct;
      if ((a.finishedAt || Infinity) !== (b.finishedAt || Infinity)) return (a.finishedAt || Infinity) - (b.finishedAt || Infinity);
      return a.joinedAt - b.joinedAt;
    });
    list.forEach(function (s, i) { s.rank = i + 1; });
    return list;
  }

  /** Trộn cố định theo uid: tải lại trang vẫn đúng thứ tự cũ, mỗi em một thứ tự khác nhau. */
  function seededShuffle(n, seedText) {
    var seed = 5381;
    for (var c = 0; c < seedText.length; c++) seed = (seed * 33 + seedText.charCodeAt(c)) % 2147483647;
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    for (var j = n - 1; j > 0; j--) {
      seed = (seed * 48271) % 2147483647;
      var k = seed % (j + 1);
      var tmp = out[j];
      out[j] = out[k];
      out[k] = tmp;
    }
    return out;
  }

  function fmtClock(ms) {
    var sec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function medalOf(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  }

  /** Bộ câu cho phòng ôn: chỉ lấy câu trắc nghiệm để học sinh làm nhanh. */
  function buildDeck(questions) {
    return (questions || []).filter(function (q) { return q && q.type === 'mc'; }).map(function (q) {
      var item = { text: q.text, options: q.options, correct: Number(q.correct), explain: q.explain || '' };
      if (q.image) item.image = q.image;
      return item;
    });
  }

  function topList(ranked, myUid) {
    var T = window.TTM;
    var h = T.h;
    var shown = ranked.slice(0, 5);
    var mine = ranked.filter(function (s) { return s.uid === myUid; })[0];
    if (mine && mine.rank > 5) shown.push(mine);
    return h('div', { class: 'game-top-list' }, shown.map(function (s) {
      return h('div', { class: 'game-top-row' + (s.uid === myUid ? ' game-rv-mine' : '') },
        h('span', { class: 'game-top-rank' }, (s.score > 0 && medalOf(s.rank)) || '#' + s.rank),
        h('strong', { class: 'game-top-name' }, s.name + (s.uid === myUid ? ' (em)' : '')),
        h('span', { class: 'muted small' }, s.done + '/' + (s.total || '') ),
        h('span', { class: 'pill p-done' }, T.fmtScore(s.score) + ' đ'));
    }));
  }

  /* ═══════════ Màn hình học sinh ═══════════ */

  function runStudent(pin, roomRef, uid, me, tr, meta, setActive) {
    var T = window.TTM;
    var h = T.h;
    var G = window.TTMGame;
    var st = null;
    var roster = {};
    var localLog = {};
    var shownIdx = -1;
    var feedback = null;
    var viewKey = '';
    var stage = h('div', { class: 'game-student-stage' });
    var clockEl = null;
    var progressEl = null;
    var rankEl = null;

    T.fill(T.app,
      h('div', { class: 'game-student-bar' },
        h('span', { class: 'pill p-blue' }, 'Phòng ' + G.fmtPin(pin)),
        h('span', { class: 'muted small' }, meta.quizTitle || ''),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: function () { T.go('#/dau'); } }, 'Rời phòng')),
      stage);

    function myPlayer() {
      var p = roster[uid] || {};
      var merged = {};
      Object.keys(localLog).forEach(function (k) { merged[k] = localLog[k]; });
      Object.keys(p.log || {}).forEach(function (k) { merged[k] = p.log[k]; });
      return { name: p.name, username: p.username, joinedAt: p.joinedAt, log: merged };
    }

    function rankedNow() {
      var total = (st.deck || []).length;
      var players = {};
      Object.keys(roster).forEach(function (u) { players[u] = roster[u]; });
      players[uid] = myPlayer();
      var ranked = rankPlayers(players, st);
      ranked.forEach(function (s) { s.total = total; });
      return ranked;
    }

    function nextIndex() {
      var deck = st.deck || [];
      var log = myPlayer().log;
      var order = seededShuffle(deck.length, uid);
      for (var i = 0; i < order.length; i++) {
        if (!log['q' + order[i]]) return order[i];
      }
      return -1;
    }

    function timeOver() {
      var end = deadline(st);
      return !!end && G.serverNow() > end;
    }

    function sync() {
      if (!st) return;
      if (st.phase === 'lobby') return drawLobby();
      if (st.phase === 'end' || timeOver()) return drawResult(true);
      if (feedback) return updatePills();
      var next = nextIndex();
      if (next < 0) return drawResult(false);
      if (viewKey !== 'q' || shownIdx !== next) drawQuestion(next);
      else updatePills();
    }

    function drawLobby() {
      viewKey = 'lobby';
      setActive(true);
      T.fill(stage,
        h('div', { class: 'panel game-lobby-student' },
          h('div', { class: 'game-status-icon' }, '⏳'),
          h('h2', null, 'Đã vào phòng – chờ thầy cô bắt đầu'),
          h('p', { class: 'muted' }, (meta.quizTitle || 'Ôn từ vựng') + (meta.courseName ? ' · ' + meta.courseName : '')),
          h('div', { class: 'game-self-box' },
            h('span', { class: 'muted small' }, 'Người chơi'),
            h('strong', null, me.fullName || me.username)),
          h('p', { class: 'muted small' }, '⚡ Em tự làm theo tốc độ của mình: đúng càng nhanh, điểm càng cao.'),
          h('p', { class: 'pill p-done' }, Object.keys(roster).length + ' bạn đang trong phòng')));
    }

    function updatePills() {
      var total = (st.deck || []).length;
      var ranked = rankedNow();
      var mine = ranked.filter(function (s) { return s.uid === uid; })[0];
      if (progressEl && mine) progressEl.textContent = 'Đã làm ' + mine.done + ' / ' + total;
      if (rankEl && mine) rankEl.textContent = T.fmtScore(mine.score) + ' đ · Hạng ' + mine.rank;
    }

    function drawQuestion(idx) {
      var deck = st.deck || [];
      var q = deck[idx];
      viewKey = 'q';
      shownIdx = idx;
      setActive(true);
      clockEl = h('span', { class: 'clock game-clock' }, '⏱ ' + fmtClock(deadline(st) - G.serverNow()));
      progressEl = h('span', { class: 'q-num' });
      rankEl = h('span', { class: 'pill p-blue' });
      var opts = q.options || [];
      var shuffled = seededShuffle(opts.length, uid + ':' + idx);
      T.fill(stage,
        h('div', { class: 'panel game-student-q' },
          h('div', { class: 'game-q-top' }, progressEl, clockEl, rankEl),
          h('p', { class: 'game-student-qtext prewrap' }, T.qNodes(q.text || '')),
          q.image && meta.quizId ? T.qImageEl({ kind: 'quiz', id: meta.quizId, key: q.image }) : null),
        h('div', { class: 'game-student-answer-area' },
          h('div', { class: 'game-pad-grid' }, shuffled.map(function (k, pos) {
            return h('button', {
              type: 'button',
              class: 'game-pad-btn',
              style: '--opt-bg:' + OPT_COLORS[pos % OPT_COLORS.length],
              onclick: function () { answer(idx, k); }
            },
              h('span', { class: 'game-pad-head' },
                h('span', { class: 'game-pad-sym' }, OPT_SYMS[pos % OPT_SYMS.length]),
                h('span', { class: 'game-pad-letter' }, String.fromCharCode(65 + pos))),
              h('span', { class: 'game-pad-text' }, T.mathNodes(opts[k])));
          }))));
      updatePills();
    }

    function answer(idx, k) {
      if (feedback || localLog['q' + idx] || timeOver()) return;
      var q = st.deck[idx];
      localLog['q' + idx] = { a: k, t: G.serverNow() };
      roomRef.child('players/' + uid + '/log/q' + idx).set({
        a: k,
        t: window.firebase.database.ServerValue.TIMESTAMP
      }).catch(function (err) {
        delete localLog['q' + idx];
        feedback = null;
        viewKey = '';
        T.toast('Không gửi được câu trả lời: ' + (err.message || 'lỗi mạng.'), 'error');
        sync();
      });
      drawFeedback(q, k);
    }

    function drawFeedback(q, k) {
      var ok = k === Number(q.correct);
      var token = {};
      feedback = token;
      viewKey = 'feedback';
      function goNext() {
        if (feedback !== token || !tr.alive()) return;
        feedback = null;
        sync();
      }
      T.fill(stage,
        h('div', { class: 'panel game-reveal-student ' + (ok ? 'is-ok' : 'is-bad') },
          h('div', { class: 'game-verdict-icon' }, ok ? '✅' : '❌'),
          h('h2', null, ok ? 'Đúng rồi!' : 'Chưa đúng'),
          ok ? null : h('p', { class: 'game-correct-note' }, 'Đáp án đúng: ', h('strong', null, T.mathNodes((q.options || [])[q.correct] || ''))),
          q.explain ? h('p', { class: 'muted prewrap' }, T.mathNodes(q.explain)) : null,
          h('button', { type: 'button', class: 'btn', onclick: goNext }, 'Câu tiếp →')));
      setTimeout(goNext, ok ? RIGHT_PAUSE_MS : WRONG_PAUSE_MS);
    }

    function drawResult(isOver) {
      viewKey = 'result';
      clockEl = null;
      setActive(st.phase !== 'end');
      var deck = st.deck || [];
      var ranked = rankedNow();
      var mine = ranked.filter(function (s) { return s.uid === uid; })[0] || { done: 0, correct: 0, score: 0, rank: 0, entries: [] };
      var wrongs = mine.entries.filter(function (e) { return !e.ok; });
      var medal = isOver && mine.score > 0 ? medalOf(mine.rank) : '';
      var head = isOver
        ? (st.phase === 'end' ? (mine.score > 0 ? 'Em đạt hạng ' + mine.rank + ' / ' + ranked.length : 'Đã kết thúc lượt ôn') : 'Hết giờ! Chờ thầy cô chốt kết quả…')
        : 'Em đã làm xong! Xem các bạn đang đua nhé';
      T.fill(stage,
        h('div', { class: 'panel game-end-student' },
          h('div', { class: 'game-medal-big' }, medal || (isOver ? '🏁' : '🎉')),
          h('h1', null, head),
          h('div', { class: 'stats game-student-stats' },
            h('div', { class: 'stat' }, h('strong', null, T.fmtScore(mine.score)), h('span', null, 'Điểm')),
            h('div', { class: 'stat' }, h('strong', null, mine.correct + '/' + deck.length), h('span', null, 'Câu đúng')),
            h('div', { class: 'stat' }, h('strong', null, mine.rank ? '#' + mine.rank : '–'), h('span', null, 'Xếp hạng'))),
          st.phase === 'end' ? h('div', { class: 'actions-start', style: 'justify-content:center' },
            h('button', { class: 'btn', onclick: function () { T.go('#/dau'); } }, 'Vào phòng khác'),
            h('button', { class: 'btn btn-ghost', onclick: function () { T.go('#/'); } }, 'Về khóa học')) : null),
        h('div', { class: 'panel' },
          h('h3', { class: 'game-subhead' }, '🏆 Bảng xếp hạng'),
          topList(ranked, uid)),
        wrongs.length ? h('div', { class: 'panel' },
          h('h3', { class: 'game-subhead' }, '📝 Từ cần ôn lại (' + wrongs.length + ')'),
          h('div', { class: 'game-rv-wrongs' }, wrongs.map(function (e) {
            var q = deck[e.i];
            return h('div', { class: 'game-rv-wrong' },
              h('strong', { class: 'prewrap' }, T.qNodes(q.text || '')),
              h('span', null, 'Đáp án đúng: ', h('strong', null, T.mathNodes((q.options || [])[q.correct] || ''))),
              q.explain ? h('span', { class: 'muted small prewrap' }, T.mathNodes(q.explain)) : null);
          }))) : null);
    }

    tr.on(roomRef.child('players'), 'value', function (snap) {
      roster = snap.val() || {};
      if (st && st.phase !== 'end' && !roster[uid]) {
        roomRef.child('players/' + uid).set({
          name: String(me.fullName || me.username || 'Học sinh').slice(0, 80),
          username: String(me.username || 'hs').slice(0, 60),
          joinedAt: window.firebase.database.ServerValue.TIMESTAMP
        }).catch(function () {});
      }
      sync();
    });

    tr.on(roomRef.child('state'), 'value', function (snap) {
      if (!snap.exists()) {
        st = null;
        setActive(false);
        T.fill(stage,
          h('div', { class: 'panel empty' },
            h('h2', null, 'Phòng đã đóng'),
            h('p', { class: 'muted' }, 'Thầy cô đã kết thúc và đóng phòng này.'),
            h('div', { class: 'actions-start', style: 'justify-content:center' },
              h('button', { class: 'btn', onclick: function () { T.go('#/dau'); } }, 'Quay lại'))));
        return;
      }
      st = snap.val();
      sync();
    });

    var wasOver = false;
    tr.interval(function () {
      if (!st || st.phase === 'lobby') return;
      var over = st.phase === 'end' || timeOver();
      if (over && !wasOver) {
        wasOver = true;
        feedback = null;
        sync();
      }
      if (clockEl && !over) {
        var left = deadline(st) - G.serverNow();
        clockEl.textContent = '⏱ ' + fmtClock(left);
        clockEl.classList.toggle('low', left <= 30000);
      }
    }, 500);
  }

  /* ═══════════ Màn hình giáo viên ═══════════ */

  function runHost(d, fb, hostState, tr, setActive, backHref) {
    var T = window.TTM;
    var h = T.h;
    var G = window.TTMGame;
    var q = d.quiz;
    var pin = hostState.pin;
    var roomRef = fb.db.ref('rooms/' + pin);
    var st = null;
    var players = {};
    var openUid = '';
    var savedMatch = !!hostState.savedMatch;
    var saving = false;
    var finishing = false;
    var stage = h('div', { class: 'game-host-stage' });
    var clockEl = null;
    var boardEl = null;
    var drawnPhase = '';

    T.fill(T.app, stage);

    function persist() {
      G.saveHostState(q.id, { pin: pin, quizId: q.id, mode: 'review', savedMatch: savedMatch });
    }

    function closeRoom(skipConfirm) {
      function doClose() {
        setActive(false);
        G.saveHostState(q.id, null);
        return roomRef.remove().catch(function () {}).then(function () {
          T.toast('Đã đóng phòng.', 'success');
          T.go(backHref);
        });
      }
      if (skipConfirm) return doClose();
      T.confirmBox('Đóng phòng?', 'Phòng ' + G.fmtPin(pin) + ' sẽ bị đóng và xóa khỏi hệ thống.', 'Đóng phòng', doClose);
    }

    function finish() {
      if (finishing || !st || st.phase === 'end') return;
      finishing = true;
      roomRef.child('state').update({
        phase: 'end',
        endedAt: window.firebase.database.ServerValue.TIMESTAMP
      }).catch(function (err) {
        finishing = false;
        T.toast('Không kết thúc được: ' + err.message, 'error');
      });
    }

    function ranked() {
      var list = rankPlayers(players, st);
      list.forEach(function (s) { s.total = (st.deck || []).length; });
      return list;
    }

    function render() {
      if (!st) return;
      if (st.phase === 'lobby') {
        drawLobby();
      } else if (st.phase === 'end') {
        drawEnd();
      } else {
        if (drawnPhase !== 'live') drawLive();
        drawBoard();
      }
      drawnPhase = st.phase === 'lobby' ? 'lobby' : st.phase === 'end' ? 'end' : 'live';
    }

    function drawLobby() {
      setActive(true);
      var list = Object.keys(players).map(function (u) { return players[u]; });
      list.sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
      var startBtn = h('button', {
        class: 'btn btn-lg',
        disabled: !list.length,
        onclick: function () {
          T.busy(startBtn, true, 'Đang bắt đầu…');
          roomRef.child('state').update({
            phase: 'question',
            index: 0,
            startedAt: window.firebase.database.ServerValue.TIMESTAMP
          }).catch(function (err) {
            T.busy(startBtn, false);
            T.toast('Không bắt đầu được: ' + err.message, 'error');
          });
        }
      }, '▶ Bắt đầu');
      T.fill(stage,
        h('div', { class: 'game-host-top' },
          h('div', null,
            h('span', { class: 'tag' }, '⚡ Ôn từ vựng · ' + d.course.name + ' · ' + d.course.grade),
            h('h2', null, q.title)),
          h('div', { class: 'add-bar' },
            h('button', { class: 'btn btn-ghost', onclick: function () { closeRoom(false); } }, 'Đóng phòng'),
            startBtn)),
        h('div', { class: 'panel game-lobby-hero' },
          h('p', { class: 'game-lobby-step' }, 'Vào Khu học tập → 🎮 Đấu cả lớp → nhập mã'),
          h('div', { class: 'game-pin', title: 'Bấm để sao chép mã phòng', onclick: function () { T.copy(pin); } }, G.fmtPin(pin)),
          h('p', { class: 'muted small' }, (st.deck || []).length + ' câu · ' + Math.round(Number(st.limitSec || 0) / 60) + ' phút · học sinh tự làm theo tốc độ riêng')),
        h('div', { class: 'panel' },
          h('div', { class: 'list-head', style: 'margin-bottom:14px' },
            h('h3', null, 'Danh sách học sinh'),
            h('span', { class: 'pill p-blue game-count-pill' }, list.length + ' học sinh đã vào phòng')),
          h('div', { class: 'game-players' }, list.length ? list.map(function (p) {
            return h('span', { class: 'game-player-chip' }, p.name || p.username);
          }) : h('p', { class: 'muted' }, 'Đang chờ học sinh nhập mã vào phòng…'))));
    }

    function drawLive() {
      setActive(true);
      clockEl = h('span', { class: 'clock game-timer' }, '⏱ ' + fmtClock(deadline(st) - G.serverNow()));
      boardEl = h('div');
      T.fill(stage,
        h('div', { class: 'game-host-top' },
          h('span', { class: 'pill p-blue game-count-pill' }, '⚡ Mã phòng: ' + G.fmtPin(pin)),
          clockEl,
          h('div', { class: 'add-bar' },
            h('button', { class: 'btn btn-ghost danger-text', onclick: function () { closeRoom(false); } }, 'Đóng phòng'),
            h('button', { class: 'btn', onclick: function () {
              T.confirmBox('Kết thúc lượt ôn?', 'Học sinh sẽ không làm tiếp được và bảng xếp hạng được chốt.', 'Kết thúc', finish);
            } }, '🏁 Kết thúc'))),
        h('div', { class: 'panel game-q-panel compact' }, h('h2', { class: 'game-q-text sm' }, q.title)),
        boardEl);
    }

    /** Dòng trạng thái của một em, tính theo giờ máy chủ. */
    function statusOf(s) {
      var total = (st.deck || []).length;
      if (s.finishedAt) return { text: '✅ Đã xong', cls: 'p-done' };
      if (st.phase === 'end') return { text: 'Làm ' + s.done + '/' + total, cls: '' };
      var idle = G.serverNow() - s.lastAt;
      if (idle > IDLE_MS) return { text: '⏸ Dừng ' + Math.round(idle / 1000) + ' giây', cls: 'p-wait' };
      return { text: s.done ? '✏️ Đang làm' : '✏️ Câu đầu tiên', cls: 'p-blue' };
    }

    function historyEl(s) {
      var deck = st.deck || [];
      if (!s.entries.length) return h('p', { class: 'muted small' }, 'Em này chưa trả lời câu nào.');
      return h('div', { class: 'game-rv-history' }, s.entries.map(function (e, n) {
        var item = deck[e.i];
        var picked = (item.options || [])[e.a];
        return h('div', { class: 'game-rv-hist-row ' + (e.ok ? 'is-ok' : 'is-bad') },
          h('span', { class: 'game-rv-hist-mark' }, (n + 1) + '. ' + (e.ok ? '✅' : '❌')),
          h('div', { class: 'game-rv-hist-body' },
            h('span', { class: 'prewrap' }, T.qNodes(item.text || '')),
            h('span', { class: 'small' }, 'Em chọn: ', h('strong', null, T.mathNodes(picked === undefined ? '' : picked)),
              e.ok ? null : h('span', { class: 'muted' }, ' · Đúng: ', T.mathNodes((item.options || [])[item.correct] || '')))),
          h('span', { class: 'muted small' }, Math.round(e.spent / 1000) + 's'));
      }));
    }

    function boardTable(list) {
      var total = (st.deck || []).length;
      var rows = [];
      list.forEach(function (s) {
        var status = statusOf(s);
        var pct = total ? Math.round(s.done / total * 100) : 0;
        var isOpen = openUid === s.uid;
        rows.push(h('tr', {
          class: 'game-rv-row' + (isOpen ? ' is-open' : ''),
          onclick: function () { openUid = isOpen ? '' : s.uid; render(); }
        },
          h('td', null, h('strong', null, (s.score > 0 && medalOf(s.rank) ? medalOf(s.rank) + ' ' : '') + '#' + s.rank)),
          h('td', null, h('strong', null, s.name), s.username ? h('span', { class: 'muted small' }, ' (' + s.username + ')') : null),
          h('td', { class: 'game-rv-progress' },
            h('div', { class: 'game-rv-track' }, h('div', { class: 'game-rv-bar', style: 'width:' + pct + '%' })),
            h('span', { class: 'small' }, s.done + '/' + total)),
          h('td', null, h('span', { class: 'game-rv-ok' }, '✓ ' + s.correct), ' ', h('span', { class: 'game-rv-bad' }, '✗ ' + s.wrong)),
          h('td', null, h('strong', null, T.fmtScore(s.score))),
          h('td', null, h('span', { class: 'pill ' + status.cls }, status.text))));
        if (isOpen) rows.push(h('tr', { class: 'game-rv-detail' }, h('td', { colspan: '6' }, historyEl(s))));
      });
      return h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Hạng'), h('th', null, 'Học sinh'), h('th', null, 'Tiến độ'),
            h('th', null, 'Đúng / Sai'), h('th', null, 'Điểm'), h('th', null, 'Trạng thái'))),
          h('tbody', null, rows)));
    }

    /** Từ cả lớp hay sai, để giáo viên giảng lại ngay. */
    function hardWords(list) {
      var deck = st.deck || [];
      var stats = deck.map(function (item, i) { return { i: i, wrong: 0, answered: 0, item: item }; });
      list.forEach(function (s) {
        s.entries.forEach(function (e) {
          stats[e.i].answered++;
          if (!e.ok) stats[e.i].wrong++;
        });
      });
      var bad = stats.filter(function (x) { return x.wrong > 0; }).sort(function (a, b) { return b.wrong - a.wrong; }).slice(0, 6);
      return h('div', { class: 'panel' },
        h('h3', { class: 'game-subhead' }, '📌 Từ cả lớp hay sai'),
        bad.length ? h('div', { class: 'game-top-list' }, bad.map(function (x) {
          return h('div', { class: 'game-top-row game-rv-hard' },
            h('span', { class: 'game-rv-hard-text prewrap' }, T.qNodes(x.item.text || '')),
            h('span', { class: 'pill p-wait' }, x.wrong + '/' + x.answered + ' sai'));
        })) : h('p', { class: 'muted' }, 'Chưa có câu sai nào.'));
    }

    function summaryStats(list) {
      var finished = list.filter(function (s) { return s.finishedAt; }).length;
      var answered = 0;
      var right = 0;
      list.forEach(function (s) { answered += s.done; right += s.correct; });
      return h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('strong', null, String(list.length)), h('span', null, 'Học sinh')),
        h('div', { class: 'stat' }, h('strong', null, finished + '/' + list.length), h('span', null, 'Đã làm xong')),
        h('div', { class: 'stat' }, h('strong', null, answered ? Math.round(right / answered * 100) + '%' : '–'), h('span', null, 'Tỉ lệ đúng')));
    }

    function boardBlocks(list) {
      return [
        summaryStats(list),
        h('div', { class: 'panel' },
          h('h3', { class: 'game-subhead' }, 'Theo dõi từng học sinh'),
          h('p', { class: 'muted small' }, 'Bấm vào một dòng để xem em đó đã chọn gì ở từng câu.'),
          list.length ? boardTable(list) : h('p', { class: 'muted' }, 'Chưa có học sinh nào.')),
        hardWords(list)
      ];
    }

    function drawBoard() {
      if (!boardEl) return;
      T.fill(boardEl, boardBlocks(ranked()));
    }

    function saveResults(list, box) {
      if (savedMatch) {
        T.fill(box, h('span', { class: 'pill p-done' }, '✓ Đã lưu kết quả vào Google Sheets'));
        return;
      }
      if (!list.length) return;
      if (saving) {
        T.fill(box, h('span', { class: 'muted small' }, 'Đang lưu kết quả…'));
        return;
      }
      saving = true;
      T.fill(box, h('span', { class: 'muted small' }, 'Đang lưu kết quả…'));
      T.api('saveMatch', {
        quizId: q.id,
        questionCount: (st.deck || []).length,
        playerCount: list.length,
        results: list.map(function (s) {
          return { username: s.username, fullName: s.name, score: s.score, correctCount: s.correct, rank: s.rank };
        })
      }).then(function () {
        saving = false;
        savedMatch = true;
        persist();
        if (tr.alive()) render();
      }, function (err) {
        saving = false;
        T.toast('Chưa lưu được kết quả: ' + err.message, 'error');
        if (!tr.alive()) return;
        T.fill(box,
          h('span', { class: 'err small' }, 'Chưa lưu được kết quả. '),
          h('button', { class: 'btn btn-sm', onclick: function () { saveResults(ranked(), box); } }, 'Thử lưu lại'));
      });
    }

    function drawEnd() {
      setActive(false);
      clockEl = null;
      boardEl = null;
      var list = ranked();
      var saveBox = h('div', { class: 'game-save-status' });
      var slots = [
        { r: list[1], medal: '🥈', cls: 'podium-2', place: 'Hạng Nhì' },
        { r: list[0], medal: '🥇', cls: 'podium-1', place: 'Hạng Nhất' },
        { r: list[2], medal: '🥉', cls: 'podium-3', place: 'Hạng Ba' }
      ];
      var total = (st.deck || []).length;
      var blocks = boardBlocks(list);
      T.fill(stage,
        h('div', { class: 'game-host-top' },
          h('div', null,
            h('span', { class: 'tag' }, 'Kết thúc lượt ôn · Phòng ' + G.fmtPin(pin)),
            h('h1', null, '🏆 Bảng xếp hạng: ' + q.title)),
          h('div', { class: 'add-bar' },
            saveBox,
            h('button', { class: 'btn btn-lg', onclick: function () { closeRoom(true); } }, 'Đóng phòng'))),
        list.length ? h('div', { class: 'panel game-podium-panel' },
          h('div', { class: 'game-podium' }, slots.map(function (slot) {
            if (!slot.r) return h('div', { class: 'game-podium-col empty ' + slot.cls });
            return h('div', { class: 'game-podium-col ' + slot.cls },
              h('div', { class: 'game-podium-medal' }, slot.medal),
              h('strong', { class: 'game-podium-name' }, slot.r.name),
              h('span', { class: 'game-podium-score' }, T.fmtScore(slot.r.score) + ' điểm'),
              h('span', { class: 'muted small' }, 'Đúng ' + slot.r.correct + '/' + total + ' câu'),
              h('div', { class: 'game-podium-pedestal' }, slot.place));
          }))) : null,
        blocks);
      saveResults(list, saveBox);
    }

    tr.on(roomRef.child('players'), 'value', function (snap) {
      players = snap.val() || {};
      render();
    });

    tr.on(roomRef.child('state'), 'value', function (snap) {
      if (!snap.exists()) return;
      st = snap.val();
      render();
    });

    var lastBoardAt = 0;
    tr.interval(function () {
      if (!st || st.phase !== 'question' || st.startedAt === undefined) return;
      var left = deadline(st) - G.serverNow();
      if (clockEl) {
        clockEl.textContent = '⏱ ' + fmtClock(left);
        clockEl.classList.toggle('low', left <= 30000);
      }
      if (left <= 0) finish();
      // Cập nhật số giây đứng yên ngay cả khi không có em nào trả lời.
      var now = Date.now();
      if (now - lastBoardAt > 5000) {
        lastBoardAt = now;
        drawBoard();
      }
    }, 500);
  }

  window.TTMReview = {
    LIMITS: LIMITS,
    buildDeck: buildDeck,
    summarize: summarize,
    rankPlayers: rankPlayers,
    runStudent: runStudent,
    runHost: runHost
  };
})();
