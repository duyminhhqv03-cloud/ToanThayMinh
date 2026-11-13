/* Thách đấu – Toán Thầy Minh
 * #/thach-dau/<courseId>: lời mời đang chờ, thách bạn mới, làm 5 câu có đồng hồ, xem lại trận.
 * Máy chủ (Code.gs: duel*) chọn câu, chấm, bấm giờ và chuyển sao. ES5 thuần.
 */
(function () {
  'use strict';

  var T = window.TTM;
  if (!T) return;
  var h = T.h;
  var fill = T.fill;
  var LETTERS = 'ABCDEFGH';

  function av(p, size) {
    return window.TTMAvatar ? window.TTMAvatar.el(p && p.avatar, size, p && p.username) : null;
  }
  function hoursLeft(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (!(ms > 0)) return 'sắp hết hạn';
    var hr = Math.floor(ms / 3600000);
    return hr >= 1 ? 'còn ' + hr + ' giờ' : 'còn ' + Math.max(1, Math.round(ms / 60000)) + ' phút';
  }
  function stakeText(n) { return n > 0 ? 'cược ' + n + ' ⭐' : 'giao hữu'; }
  function back(courseId) {
    return h('a', { href: '#/sao/' + encodeURIComponent(courseId), class: 'back' }, '← Bảng sao lớp');
  }

  /* ── Sảnh ── */
  function renderLobby(courseId) {
    var seq = T.getSeq();
    fill(T.app, T.loading('Đang mở sàn đấu…'));
    T.api('duelInfo', { courseId: courseId }).then(function (d) {
      if (!T.isCurrent(seq)) return;
      drawLobby(courseId, d);
    }, function (e) {
      if (!T.isCurrent(seq)) return;
      fill(T.app, back(courseId), T.errorBox(e.oldServer ? 'Máy chủ chưa cập nhật phần Thách đấu. Thầy dán Code.gs mới và triển khai lại.' : e.message, function () { renderLobby(courseId); }));
    });
  }

  function drawLobby(courseId, d) {
    var me = T.getMe();
    var edit = d.course.canEdit;
    var r = d.rules;
    var incoming = d.duels.filter(function (x) { return x.role === 'b' && (x.status === 'waiting' || x.status === 'b-playing'); });
    var others = d.duels.filter(function (x) { return incoming.indexOf(x) < 0; });

    var newBtn = null;
    if (!edit) {
      newBtn = h('button', { class: 'btn' }, '⚔️ Thách đấu bạn mới');
      newBtn.addEventListener('click', function () {
        if (d.bankSize < r.questions) return T.toast('Lớp chưa có đủ ' + r.questions + ' câu trắc nghiệm / trả lời ngắn để thách đấu.', 'error');
        if (!d.me.todayLeft) return T.toast('Hôm nay em đã thách đấu ' + r.perDay + ' trận rồi. Mai thách tiếp nhé!', 'error');
        pickDialog(courseId, d);
      });
    }

    fill(T.app,
      back(courseId),
      h('div', { class: 'page-head star-head' },
        h('div', null,
          h('h1', null, '⚔️ Thách đấu'),
          h('p', { class: 'muted' }, d.course.name + ' · ' + d.course.grade + ' – ' + r.questions + ' câu trong ' + r.seconds + ' giây. Ai đúng nhiều hơn thắng, bằng nhau thì ai nhanh hơn thắng.')),
        newBtn),
      edit ? null : h('p', { class: 'duel-me' }, 'Em có ', h('b', null, d.me.stars + ' ⭐'), ' · hôm nay còn ', h('b', null, d.me.todayLeft + '/' + r.perDay), ' lượt thách đấu'),
      incoming.length ? h('h2', { class: 'section-title' }, '📨 Lời thách đấu đang chờ em') : null,
      incoming.length ? h('div', { class: 'duel-list' }, incoming.map(function (x) { return incomingCard(courseId, x); })) : null,
      h('h2', { class: 'section-title' }, edit ? 'Các trận gần đây của lớp' : 'Các trận của em'),
      others.length ? h('div', { class: 'panel duel-history' }, others.map(function (x) { return historyRow(courseId, x, edit); }))
        : h('div', { class: 'panel empty' }, h('p', null, edit ? 'Lớp chưa có trận thách đấu nào.' : 'Em chưa có trận nào. Bấm "Thách đấu bạn mới" để bắt đầu!')),
      h('details', { class: 'panel star-rules' },
        h('summary', null, 'Luật thách đấu'),
        h('ul', null,
          h('li', null, 'Em chọn một bạn cùng lớp và mức cược 0–' + r.maxStake + ' ⭐ (0 = giao hữu). Máy lấy ngẫu nhiên ' + r.questions + ' câu từ các bài luyện tập của lớp.'),
          h('li', null, 'Em làm ngay. Bạn có ' + r.waitHours + ' giờ để nhận lời và làm đúng ' + r.questions + ' câu đó.'),
          h('li', null, 'Người thắng nhận số sao cược của người thua. Hòa hoàn toàn thì không ai mất sao.'),
          h('li', null, 'Bạn được quyền từ chối mà không mất gì. Quá hạn không làm thì trận bị hủy, không ai mất sao.'),
          h('li', null, 'Bạn có dưới ' + r.minStars + ' ⭐ thì chỉ đấu giao hữu. Mỗi ngày em thách tối đa ' + r.perDay + ' trận, mỗi cặp bạn 1 trận.'),
          h('li', null, 'Đã bắt đầu làm thì phải làm xong: thoát giữa chừng sẽ bị tính 0 điểm.'))));
  }

  function incomingCard(courseId, x) {
    var go = h('button', { class: 'btn btn-sm' }, x.status === 'b-playing' ? 'Làm tiếp' : 'Nhận lời');
    var no = x.status === 'waiting' ? h('button', { class: 'btn btn-sm btn-ghost' }, 'Từ chối') : null;
    go.addEventListener('click', function () {
      if (x.status === 'b-playing') return start(courseId, x, go);
      T.confirmBox('Nhận lời thách đấu?', 'Em sẽ làm ngay 5 câu, đồng hồ bắt đầu chạy khi bấm "Bắt đầu". Đã bắt đầu thì phải làm xong.', 'Bắt đầu', function () {
        return start(courseId, x);
      });
    });
    if (no) no.addEventListener('click', function () {
      T.confirmBox('Từ chối lời thách đấu?', 'Em không mất sao khi từ chối.', 'Từ chối', function () {
        return T.api('duelDecline', { id: x.id }).then(function () { T.toast('Đã từ chối.', 'success'); renderLobby(courseId); });
      });
    });
    return h('div', { class: 'panel duel-card' },
      av(x.a, 52),
      h('div', { class: 'duel-card-t' },
        h('b', null, x.a.fullName + ' thách đấu em'),
        h('span', { class: 'muted small' }, stakeText(x.stake) + ' · ' + hoursLeft(x.expiresAt))),
      h('div', { class: 'duel-card-b' }, go, no));
  }

  function statusText(x, edit) {
    var me = T.getMe();
    var opp = x.role === 'a' ? x.b : x.a;
    if (x.status === 'a-playing') return x.a.fullName + ' đang làm bài';
    if (x.status === 'waiting') return x.role === 'a' ? 'Chờ ' + x.b.fullName + ' nhận lời (' + hoursLeft(x.expiresAt) + ')' : 'Chờ ' + x.b.fullName + ' nhận lời';
    if (x.status === 'b-playing') return x.b.fullName + ' đang làm bài';
    if (x.status === 'declined') return x.b.fullName + ' đã từ chối';
    if (x.status === 'expired') return 'Hết hạn, ' + x.b.fullName + ' chưa nhận lời';
    if (x.status === 'cancelled') return 'Đã hủy (bỏ dở)';
    if (x.status === 'done') {
      var score = ' (' + x.aScore + '–' + x.bScore + ')';
      if (!x.winner) return 'Hòa' + score;
      if (!edit && me && x.role) return (x.winner === me.username ? '🎉 Em thắng ' : '😅 Em thua ') + opp.fullName + score;
      return (x.winner === x.a.username ? x.a.fullName : x.b.fullName) + ' thắng' + score;
    }
    return x.status;
  }

  function historyRow(courseId, x, edit) {
    var win = x.status === 'done' && x.winner && T.getMe() && x.winner === T.getMe().username;
    var lose = x.status === 'done' && x.winner && x.role && !win;
    var view = x.status === 'done' ? h('button', { class: 'link-btn small', type: 'button' }, 'Xem lại') : null;
    if (view) view.addEventListener('click', function () { detailDialog(x.id); });
    return h('div', { class: 'duel-row' + (win ? ' win' : lose && !edit ? ' lose' : '') },
      h('span', { class: 'duel-pair' }, av(x.a, 30), h('span', { class: 'duel-vs' }, '⚔️'), av(x.b, 30)),
      h('span', { class: 'duel-row-t' },
        h('b', null, x.a.fullName + ' – ' + x.b.fullName),
        h('span', { class: 'small' }, statusText(x, edit))),
      h('span', { class: 'muted small duel-stake' }, stakeText(x.stake)),
      view);
  }

  /* ── Chọn bạn + mức cược ── */
  function pickDialog(courseId, d) {
    var r = d.rules;
    var who = null;
    var stake = 0;
    var listBox = h('div', { class: 'duel-pick' });
    var stakeBox = h('div', { class: 'chips' });
    var note = h('p', { class: 'muted small' });
    function oppStars() { return who ? who.stars : 0; }
    function maxStake() {
      if (!who || oppStars() < r.minStars) return 0;
      return Math.min(r.maxStake, d.me.stars);
    }
    function drawStake() {
      if (stake > maxStake()) stake = maxStake();
      fill(stakeBox, [0, 1, 2, 3].filter(function (n) { return n <= r.maxStake; }).map(function (n) {
        var dis = n > maxStake();
        return h('button', { type: 'button', class: 'chip-btn' + (stake === n ? ' active' : ''), disabled: dis, onclick: function () { stake = n; drawStake(); } }, n ? n + ' ⭐' : 'Giao hữu');
      }));
      fill(note, !who ? 'Chọn một bạn trước.' : oppStars() < r.minStars ? who.fullName + ' có dưới ' + r.minStars + ' ⭐ nên chỉ đấu giao hữu.' :
        d.me.stars < r.maxStake ? 'Em chỉ cược được tối đa số sao em đang có.' : 'Thắng được thêm sao cược, thua thì mất số sao đó.');
    }
    function drawList() {
      fill(listBox, d.classmates.length ? d.classmates.map(function (o) {
        var b = h('button', { type: 'button', class: 'duel-mate' + (who === o ? ' on' : ''), disabled: o.playedToday, title: o.playedToday ? 'Hôm nay đã đấu với bạn này' : '' },
          av(o, 44),
          h('b', null, o.fullName),
          h('span', { class: 'muted small' }, o.playedToday ? 'Hôm nay đã đấu' : o.stars + ' ⭐'));
        b.addEventListener('click', function () { who = o; drawList(); drawStake(); });
        return b;
      }) : h('p', { class: 'muted' }, 'Lớp chưa có bạn nào khác.'));
    }
    drawList();
    drawStake();
    T.modal('Thách đấu bạn nào?', h('div', null, listBox, h('h4', { class: 'star-sub' }, 'Mức cược'), stakeBox, note), function (close) {
      var ok = h('button', { class: 'btn' }, 'Bắt đầu làm bài');
      ok.addEventListener('click', function () {
        if (!who) return T.toast('Em chọn một bạn để thách đấu.', 'error');
        T.busy(ok, true);
        T.api('duelCreate', { courseId: courseId, opponent: who.username, stake: stake }).then(function (res) {
          close();
          play(courseId, { id: res.id, role: 'a', opp: who, stake: stake }, res.questions, res.seconds);
        }, function (e) { T.busy(ok, false); T.toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    }, { wide: true, noFocus: true });
  }

  function start(courseId, x, btn) {
    if (btn) T.busy(btn, true);
    return T.api('duelStart', { id: x.id }).then(function (res) {
      play(courseId, { id: x.id, role: 'b', opp: x.a, stake: x.stake }, res.questions, res.seconds);
    }, function (e) {
      if (btn) T.busy(btn, false);
      throw e;
    }).catch(function (e) { T.toast(e.message, 'error'); });
  }

  /* ── Làm bài ── */
  function play(courseId, info, questions, seconds) {
    var answers = questions.map(function () { return null; });
    var idx = 0;
    var done = false;
    var deadline = Date.now() + seconds * 1000;
    var timer = null;
    var clock = h('span', { class: 'duel-clock' });
    var bar = h('i');
    var body = h('div', { class: 'duel-q' });
    T.setLeaveGuard(function () { return !done; }, 'Em đang làm bài thách đấu. Rời trang thì bài làm được nộp ngay. Rời trang?', function () { if (!done) submit(true); });

    function tick() {
      var left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      clock.textContent = '⏱ ' + left + 's';
      bar.style.width = Math.max(0, (deadline - Date.now()) / (seconds * 1000) * 100) + '%';
      clock.className = 'duel-clock' + (left <= 15 ? ' hurry' : '');
      if (left <= 0) submit();
    }
    function next() {
      if (done) return;
      if (idx < questions.length - 1) { idx++; drawQ(); } else submit();
    }
    function drawQ() {
      var q = questions[idx];
      var parts = [
        h('div', { class: 'duel-q-head' }, h('b', null, 'Câu ' + (idx + 1) + '/' + questions.length)),
        h('div', { class: 'duel-q-text prewrap' }, T.qNodes(q.text || ''))
      ];
      if (q.type === 'mc') {
        parts.push(h('div', { class: 'duel-opts' }, (q.options || []).map(function (o, i) {
          var b = h('button', { type: 'button', class: 'duel-opt' + (answers[idx] === i ? ' on' : '') }, h('b', null, LETTERS.charAt(i)), h('span', null, T.mathNodes(o)));
          b.addEventListener('click', function () {
            answers[idx] = i;
            drawQ();
            setTimeout(next, 250);
          });
          return b;
        })));
      } else {
        var inp = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Nhập câu trả lời', value: answers[idx] || '' });
        var go = h('button', { type: 'submit', class: 'btn' }, idx < questions.length - 1 ? 'Câu tiếp →' : 'Nộp bài');
        var form = h('form', { class: 'duel-short' }, inp, go);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          answers[idx] = inp.value.trim() || null;
          next();
        });
        parts.push(form, T.fracHint(inp));
        setTimeout(function () { inp.focus(); }, 0);
      }
      if (q.type === 'mc' || idx < questions.length - 1) {
        var skip = h('button', { type: 'button', class: 'link-btn small' }, idx < questions.length - 1 ? 'Bỏ qua câu này' : 'Nộp bài');
        skip.addEventListener('click', function () {
          if (q.type !== 'mc') { var i2 = body.querySelector('input'); if (i2 && i2.value.trim()) answers[idx] = i2.value.trim(); }
          next();
        });
        parts.push(h('div', { class: 'duel-skip' }, skip));
      }
      fill(body, parts);
    }
    function submit(silent) {
      if (done) return;
      done = true;
      clearInterval(timer);
      if (!silent) fill(body, T.loading('Đang chấm…'));
      T.api('duelSubmit', { id: info.id, answers: answers }).then(function (res) {
        if (silent || !T.app.contains(body)) return;
        result(courseId, info, questions, answers, res);
      }, function (e) {
        if (silent) return;
        fill(body, T.errorBox(e.message), h('a', { class: 'btn', href: '#/thach-dau/' + encodeURIComponent(courseId) }, 'Về sàn đấu'));
      });
    }

    fill(T.app,
      h('div', { class: 'duel-top' },
        h('span', { class: 'duel-pair' }, av(T.getMe(), 40), h('span', { class: 'duel-vs' }, '⚔️'), av(info.opp, 40)),
        h('span', { class: 'duel-top-t' }, h('b', null, 'Em ⚔️ ' + info.opp.fullName), h('span', { class: 'muted small' }, stakeText(info.stake))),
        clock),
      h('div', { class: 'duel-bar' }, bar),
      h('div', { class: 'panel' }, body));
    drawQ();
    tick();
    timer = setInterval(function () {
      if (!T.app.contains(body)) { clearInterval(timer); return; }
      tick();
    }, 250);
  }

  function result(courseId, info, questions, answers, res) {
    var x = res.duel;
    var me = T.getMe();
    var head;
    if (info.role === 'a') {
      head = h('div', { class: 'duel-result' },
        h('div', { class: 'duel-big' }, res.score + '/' + questions.length),
        h('p', null, 'Em đúng ' + res.score + ' câu trong ' + res.sec + ' giây.'),
        h('p', { class: 'muted' }, 'Đã gửi lời thách đấu tới ' + info.opp.fullName + '. Bạn có 48 giờ để nhận lời. Kết quả sẽ hiện ở sàn đấu.'));
    } else {
      var win = x.winner && x.winner === me.username;
      var draw = !x.winner;
      head = h('div', { class: 'duel-result' + (win ? ' win' : draw ? '' : ' lose') },
        h('div', { class: 'duel-big' }, win ? '🎉 Em thắng!' : draw ? '🤝 Hòa' : '😅 Em thua'),
        h('p', null, 'Em: ', h('b', null, x.bScore + ' câu, ' + x.bSec + ' giây'), ' · ' + info.opp.fullName + ': ', h('b', null, x.aScore + ' câu, ' + x.aSec + ' giây')),
        info.stake && !draw ? h('p', { class: 'duel-stars' }, (win ? '+' : '−') + info.stake + ' ⭐') : null);
    }
    var marks = h('div', { class: 'duel-marks' }, res.correct.map(function (ok, i) {
      return h('span', { class: 'duel-mark' + (ok ? ' ok' : '') }, 'Câu ' + (i + 1) + (ok ? ' ✓' : ' ✗'));
    }));
    var actions = [h('a', { class: 'btn', href: '#/thach-dau/' + encodeURIComponent(courseId) }, 'Về sàn đấu')];
    if (info.role === 'b') {
      var view = h('button', { class: 'btn btn-ghost' }, 'Xem đáp án');
      view.addEventListener('click', function () { detailDialog(x.id); });
      actions.push(view);
    }
    fill(T.app, h('div', { class: 'panel' }, head, marks, h('div', { class: 'duel-actions' }, actions)));
  }

  /* ── Xem lại trận ── */
  function detailDialog(id) {
    var body = h('div', null, T.loading());
    T.modal('Xem lại trận', body, null, { wide: true });
    T.api('duelDetail', { id: id }).then(function (d) {
      var x = d.duel;
      var ansText = function (q, a) {
        if (a === null || a === undefined || a === '') return '(bỏ trống)';
        return q.type === 'mc' ? LETTERS.charAt(Number(a)) + '. ' + (q.options[Number(a)] || '') : String(a);
      };
      fill(body,
        h('p', null, h('b', null, x.a.fullName), ': ' + x.aScore + ' câu, ' + x.aSec + ' giây · ', h('b', null, x.b.fullName), ': ' + x.bScore + ' câu, ' + x.bSec + ' giây'),
        d.questions.map(function (q, i) {
          return h('div', { class: 'duel-review' },
            h('div', { class: 'prewrap' }, h('b', null, 'Câu ' + (i + 1) + '. '), T.qNodes(q.text || '')),
            q.type === 'mc' ? h('ol', { class: 'duel-review-opts' }, q.options.map(function (o, k) {
              return h('li', { class: k === q.right ? 'right' : '' }, h('b', null, LETTERS.charAt(k) + '. '), T.mathNodes(o));
            })) : h('p', { class: 'small' }, 'Đáp án: ', h('b', null, q.right)),
            h('p', { class: 'small' },
              h('span', { class: q.aOk ? 'ok' : 'bad' }, (q.aOk ? '✓ ' : '✗ ') + x.a.fullName + ': ' + ansText(q, q.a)), ' · ',
              h('span', { class: q.bOk ? 'ok' : 'bad' }, (q.bOk ? '✓ ' : '✗ ') + x.b.fullName + ': ' + ansText(q, q.b))));
        }));
    }, function (e) { fill(body, T.errorBox(e.message)); });
  }

  window.TTMDuel = { renderLobby: renderLobby };

  if (/^#\/?thach-dau(\/|$)/.test(location.hash) && T.route) T.route();
})();
