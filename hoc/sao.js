/* Sao thưởng – Toán Thầy Minh
 * Bảng sao từng lớp (#/sao/<courseId>), dải sao trên trang lớp, sao trên trang chủ học sinh.
 * Máy chủ tính sao (Code.gs: computeStars_); trang này chỉ hiển thị và cho thầy thưởng/trừ sao tay.
 * ES5 thuần.
 */
(function () {
  'use strict';

  var T = window.TTM;
  if (!T) return;
  var h = T.h;
  var fill = T.fill;

  var KIND = {
    hw: ['📅', 'Bài tập về nhà'],
    quiz: ['📝', 'Luyện tập'],
    match: ['🎮', 'Đấu cả lớp'],
    bonus: ['🎁', 'Thầy thưởng'],
    duel: ['⚔️', 'Thách đấu']
  };
  var MEDAL = ['🥇', '🥈', '🥉'];

  function dmy(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1);
  }
  function starText(n) { return '⭐ ' + n; }
  function rankLabel(r) { return r <= 3 ? MEDAL[r - 1] : String(r); }
  function av(o, size, cls) {
    return window.TTMAvatar ? window.TTMAvatar.el(o && o.avatar, size, o && o.username, cls) : null;
  }
  function badgeIcons(list, max) {
    var B = window.TTMAvatar ? window.TTMAvatar.BADGES : {};
    var icons = (list || []).filter(function (b) { return B[b]; }).map(function (b) { return B[b][0]; });
    if (!icons.length) return null;
    var extra = max && icons.length > max ? ' +' + (icons.length - max) : '';
    return h('span', { class: 'star-badges', title: (list || []).map(function (b) { return B[b] ? B[b][1] : ''; }).join(', ') }, icons.slice(0, max || icons.length).join('') + extra);
  }

  /* ── Dải sao trên trang lớp ── */
  function courseStrip(c) {
    var box = h('div', { class: 'star-strip-wrap' });
    var href = '#/sao/' + encodeURIComponent(c.id);
    T.api('starBoard', { courseId: c.id }).then(function (d) {
      var me = T.getMe();
      if (c.canEdit) {
        var top = d.list.slice(0, 3).map(function (o) { return rankLabel(o.rank) + ' ' + o.fullName + ' (' + o.stars + ')'; }).join(' · ');
        fill(box, h('a', { class: 'star-strip', href: href },
          h('b', null, '⭐ Bảng sao lớp'),
          h('span', { class: 'muted small' }, top || 'Chưa có em nào được sao.'),
          h('span', { class: 'star-strip-go' }, 'Xem & thưởng sao →')));
        return;
      }
      var mine = me && d.list.filter(function (o) { return o.username === me.username; })[0];
      if (!mine) return;
      fill(box, h('a', { class: 'star-strip', href: href },
        av(mine, 40),
        h('span', { class: 'star-big' }, starText(mine.stars)),
        mine.streak ? h('span', { class: 'star-fire' }, '🔥 ' + mine.streak + ' tuần liền') : null,
        h('span', { class: 'muted small' }, 'Hạng ' + mine.rank + '/' + d.list.length + ' trong lớp'),
        h('span', { class: 'star-strip-go' }, 'Bảng sao lớp →')));
    }, function () { /* máy chủ chưa cập nhật: bỏ qua */ });
    return box;
  }

  /* ── Sao trên trang chủ học sinh ── */
  function homeStrip(stars) {
    if (!stars || !stars.length) return null;
    var me = T.getMe() || {};
    return h('div', { class: 'star-home' },
      h('div', { class: 'star-home-head' },
        h('h2', { class: 'section-title' }, '⭐ Sao của em'),
        h('a', { class: 'star-me-link', href: '#/nhan-vat' }, av(me, 44), h('span', null, '🧑‍🎨 Nhân vật của em'))),
      h('div', { class: 'star-home-list' }, stars.map(function (s) {
        return h('a', { class: 'star-home-card', href: '#/sao/' + encodeURIComponent(s.courseId) },
          h('span', { class: 'muted small' }, s.courseName + ' · ' + s.courseGrade),
          h('span', { class: 'star-big' }, starText(s.stars)),
          h('span', { class: 'small' },
            s.streak ? '🔥 ' + s.streak + ' tuần liền · ' : '',
            'Hạng ' + s.rank + '/' + s.n,
            s.week ? ' · tuần này +' + s.week : ''),
          s.duels ? h('span', { class: 'star-duel-alert small', onclick: function (e) { e.preventDefault(); T.go('#/thach-dau/' + encodeURIComponent(s.courseId)); } }, '⚔️ ' + s.duels + ' lời thách đấu đang chờ em') : null);
      })));
  }

  /* ── Trang bảng sao #/sao/<courseId> ── */
  var period = 'all';

  function renderBoard(courseId) {
    var seq = T.getSeq();
    fill(T.app, T.loading('Đang đếm sao…'));
    T.api('starBoard', { courseId: courseId }).then(function (d) {
      if (!T.isCurrent(seq)) return;
      draw(d);
    }, function (e) {
      if (!T.isCurrent(seq)) return;
      fill(T.app, h('a', { href: '#/khoa/' + encodeURIComponent(courseId), class: 'back' }, '← Quay lại lớp'),
        T.errorBox(e.oldServer ? 'Máy chủ chưa cập nhật phần Sao thưởng. Thầy dán Code.gs mới và triển khai lại.' : e.message, function () { renderBoard(courseId); }));
    });
  }

  function draw(d) {
    var me = T.getMe();
    var c = d.course;
    var edit = c.canEdit;
    var picked = {};
    var tableBox = h('div');
    var giveBtn = edit ? h('button', { class: 'btn btn-sm' }, '🎁 Thưởng / trừ sao') : null;
    if (giveBtn) giveBtn.addEventListener('click', function () {
      var names = Object.keys(picked).filter(function (k) { return picked[k]; });
      giveDialog(c, d.list, names, function () { renderBoard(c.id); });
    });

    function drawTable() {
      var list = d.list.slice();
      if (period === 'week') {
        list.sort(function (a, b) { return b.week - a.week || b.stars - a.stars; });
        list.forEach(function (o, i) { o._r = i > 0 && list[i - 1].week === o.week ? list[i - 1]._r : i + 1; });
      } else {
        list.forEach(function (o) { o._r = o.rank; });
      }
      var tabs = h('div', { class: 'chips filter' },
        [['all', 'Cả kỳ'], ['week', 'Tuần này (từ ' + dmy(d.weekStart) + ')']].map(function (p) {
          return h('button', { class: 'chip-btn' + (period === p[0] ? ' active' : ''), onclick: function () { period = p[0]; drawTable(); } }, p[1]);
        }));
      if (!list.length) {
        fill(tableBox, tabs, h('div', { class: 'panel empty' }, h('p', null, 'Lớp chưa có học sinh.')));
        return;
      }
      var rows = list.map(function (o) {
        var isMe = me && o.username === me.username;
        var val = period === 'week' ? o.week : o.stars;
        var cb = edit ? h('input', { type: 'checkbox', checked: !!picked[o.username], 'aria-label': 'Chọn ' + o.fullName }) : null;
        if (cb) {
          cb.addEventListener('click', function (e) { e.stopPropagation(); });
          cb.addEventListener('change', function () { picked[o.username] = cb.checked; });
        }
        var canOpen = edit || isMe;
        var row = h(canOpen ? 'button' : 'div', { class: 'star-row' + (isMe ? ' me' : '') + (o._r <= 3 && val > 0 ? ' top' : ''), type: canOpen ? 'button' : null },
          cb || h('span'),
          h('span', { class: 'star-rank' }, val > 0 ? rankLabel(o._r) : '–'),
          av(o, 36) || h('span'),
          h('span', { class: 'star-name' }, h('span', { class: 'star-name-t' }, o.fullName, isMe ? ' (em)' : ''), badgeIcons(o.badges, 4)),
          h('span', { class: 'star-fire small', title: 'Số tuần liền nộp đủ bài đúng hạn' }, o.streak ? '🔥 ' + o.streak : ''),
          h('span', { class: 'star-val' }, starText(period === 'week' && val > 0 ? '+' + val : val)));
        if (canOpen) row.addEventListener('click', function () { detailDialog(c, o, function () { renderBoard(c.id); }); });
        return row;
      });
      fill(tableBox, tabs, h('div', { class: 'panel star-table' }, rows),
        edit ? h('p', { class: 'muted small' }, 'Bấm tên một em để xem chi tiết sao. Đánh dấu ô vuông để thưởng sao cho nhiều em cùng lúc.')
          : h('p', { class: 'muted small' }, 'Bấm vào tên em để xem em được sao từ những bài nào.'));
    }

    var meRow = me && d.list.filter(function (o) { return o.username === me.username; })[0];
    fill(T.app,
      h('a', { href: '#/khoa/' + encodeURIComponent(c.id), class: 'back' }, '← ' + c.name + ' · ' + c.grade),
      h('div', { class: 'page-head star-head' },
        h('div', null,
          h('h1', null, '⭐ Bảng sao lớp'),
          h('p', { class: 'muted' }, c.name + ' · ' + c.grade + ' – mỗi lớp tính sao riêng nên ai cũng so với bạn cùng lớp.')),
        h('div', { class: 'star-head-btns' },
          giveBtn,
          d.report ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: function () { zaloDialog(c, d); } }, '💬 Chép tin nhắn tuần') : null,
          h('a', { class: 'btn btn-sm' + (edit ? ' btn-ghost' : ''), href: '#/thach-dau/' + encodeURIComponent(c.id) }, edit ? '⚔️ Các trận thách đấu' : '⚔️ Thách đấu'),
          meRow ? h('a', { class: 'btn btn-sm btn-ghost', href: '#/nhan-vat' }, '🧑‍🎨 Nhân vật') : null)),
      goalBox(c, d.goal),
      honorBox(d.honor),
      tableBox,
      rulesBox());
    drawTable();
  }

  function goalBox(c, g) {
    if (!g) return null;
    var edit = c.canEdit;
    var btn = edit ? h('button', { class: 'link-btn small', type: 'button' }, 'Sửa mục tiêu') : null;
    if (btn) btn.addEventListener('click', function () { goalDialog(c, g); });
    if (!g.assignments) {
      return h('div', { class: 'panel star-goal' },
        h('div', { class: 'star-goal-top' }, h('b', null, '🎯 Mục tiêu cả lớp tuần này'), btn),
        h('p', { class: 'muted small' }, 'Tuần này chưa có bài tập về nhà có hạn nộp.' + (g.reward ? ' Phần thưởng khi đạt: ' + g.reward : '')));
    }
    var pct = g.total ? Math.round(g.done / g.total * 100) : 0;
    var reached = pct >= g.pct;
    return h('div', { class: 'panel star-goal' + (reached ? ' reached' : '') },
      h('div', { class: 'star-goal-top' },
        h('b', null, '🎯 Mục tiêu cả lớp tuần này: nộp ' + g.pct + '% bài'),
        btn),
      h('div', { class: 'star-goal-bar' }, h('i', { style: 'width:' + Math.min(100, pct) + '%' }), h('span', { class: 'star-goal-mark', style: 'left:' + g.pct + '%' })),
      h('p', { class: 'small' },
        reached ? '🎉 Cả lớp đã đạt mục tiêu! ' : '',
        'Đã nộp ', h('b', null, g.done + '/' + g.total), ' bài (' + pct + '%)',
        g.reward ? ' · Phần thưởng: ' : '', g.reward ? h('b', null, g.reward) : null));
  }

  function weekRange(iso) {
    var end = new Date(new Date(iso).getTime() + 6 * 86400000);
    return dmy(iso) + ' – ' + dmy(end.toISOString());
  }

  /** Vinh danh tuần trước: chỉ nêu 3 bạn chăm chỉ nhất và 3 bạn tiến bộ nhất, không xếp cuối bảng. */
  function honorBox(hn) {
    if (!hn || (!(hn.top && hn.top.length) && !(hn.gain && hn.gain.length))) return null;
    function col(title, items, val) {
      return h('div', { class: 'star-honor-col' },
        h('div', { class: 'star-honor-t' }, title),
        items.length ? items.map(function (o, i) {
          return h('div', { class: 'star-honor-row' },
            h('span', null, MEDAL[i]),
            av(o, 30) || h('span'),
            h('span', { class: 'star-honor-name' }, o.fullName),
            h('b', null, val(o)));
        }) : h('p', { class: 'muted small' }, 'Chưa có bạn nào.'));
    }
    return h('div', { class: 'panel star-honor' },
      h('b', null, '🏅 Vinh danh tuần trước (' + weekRange(hn.weekStart) + ')'),
      h('div', { class: 'star-honor-cols' },
        col('Chăm chỉ nhất', hn.top || [], function (o) { return '⭐ ' + o.stars; }),
        col('Tiến bộ nhất', hn.gain || [], function (o) { return '📈 +' + o.gain; })));
  }

  /** Thầy chép tin nhắn tổng kết tuần để dán vào nhóm Zalo phụ huynh. */
  function zaloDialog(c, d) {
    var rep = d.report;
    var day = new Date().getDay();
    var which = day === 1 || day === 2 ? 'prev' : 'cur'; // đầu tuần thì thường tổng kết tuần trước
    var withMissing = true;
    var weekBar = h('div', { class: 'chips' });
    var missCb = h('input', { type: 'checkbox', checked: true });
    var ta = h('textarea', { rows: '14', class: 'star-zalo-text' });

    function build() {
      var r = rep[which];
      var L = [];
      L.push('⭐ ' + c.name.toUpperCase() + ' · ' + c.grade + ' – TUẦN ' + weekRange(r.weekStart));
      L.push('');
      if (r.top.length) {
        L.push('🏅 Chăm chỉ nhất tuần:');
        r.top.slice(0, 5).forEach(function (o, i) { L.push((MEDAL[i] || '⭐') + ' ' + o.fullName + ' – ' + o.stars + ' sao'); });
      }
      if (r.gain.length) {
        L.push('📈 Tiến bộ so với tuần trước: ' + r.gain.slice(0, 3).map(function (o) { return o.fullName + ' (+' + o.gain + ' sao)'; }).join(', '));
      }
      var fire = d.list.filter(function (o) { return o.streak >= 2; }).sort(function (a, b) { return b.streak - a.streak; });
      if (fire.length) {
        L.push('🔥 Giữ chuỗi nộp bài đúng hạn: ' + fire.slice(0, 6).map(function (o) { return o.fullName + ' (' + o.streak + ' tuần)'; }).join(', '));
      }
      if (r.asg.length) {
        var n = d.list.length;
        var total = r.asg.length * n;
        var done = 0;
        r.asg.forEach(function (a) { done += n - a.missing.length; });
        var pct = total ? Math.round(done / total * 100) : 0;
        L.push('');
        L.push('🎯 Cả lớp đã nộp ' + done + '/' + total + ' bài (' + pct + '%)' +
          (d.goal && pct >= d.goal.pct ? ' – đạt mục tiêu ' + d.goal.pct + '%! 🎉' : d.goal ? ' – mục tiêu ' + d.goal.pct + '%' : ''));
        if (withMissing) {
          var miss = r.asg.filter(function (a) { return a.missing.length; });
          if (miss.length) {
            L.push('⏰ Bài chưa nộp:');
            miss.forEach(function (a) { L.push('• ' + a.title + (a.dueAt ? ' (hạn ' + dmy(a.dueAt) + ')' : '') + ': ' + a.missing.join(', ')); });
          } else {
            L.push('✅ Tất cả các con đã nộp đủ bài.');
          }
        }
      }
      if (L.length <= 2) L.push('Tuần này lớp chưa có hoạt động nào được tính sao.');
      L.push('');
      L.push('Bảng sao của lớp: ' + location.href.split('#')[0] + '#/sao/' + encodeURIComponent(c.id));
      ta.value = L.join('\n');
      fill(weekBar, [['cur', 'Tuần này (' + weekRange(rep.cur.weekStart) + ')'], ['prev', 'Tuần trước (' + weekRange(rep.prev.weekStart) + ')']].map(function (x) {
        return h('button', { type: 'button', class: 'chip-btn' + (which === x[0] ? ' active' : ''), onclick: function () { which = x[0]; build(); } }, x[1]);
      }));
    }
    missCb.addEventListener('change', function () { withMissing = missCb.checked; build(); });
    build();
    T.modal('💬 Tin nhắn tổng kết tuần', h('div', { class: 'form' },
      weekBar,
      h('label', { class: 'check' }, missCb, ' Kèm tên các con chưa nộp bài'),
      ta,
      h('p', { class: 'muted small' }, 'Thầy có thể sửa chữ trong ô trước khi chép, rồi dán vào nhóm Zalo.')), function (close) {
      var ok = h('button', { class: 'btn', type: 'button' }, '📋 Chép tin nhắn');
      ok.addEventListener('click', function () { T.copy(ta.value, 'Đã chép. Thầy dán vào Zalo nhé.'); close(); });
      return [h('button', { class: 'btn btn-ghost', type: 'button', onclick: close }, 'Đóng'), ok];
    });
  }

  function goalDialog(c, g) {
    var pct = h('select', null, [70, 80, 90, 100].map(function (n) { return h('option', { value: String(n), selected: n === g.pct }, n + '% bài được nộp'); }));
    var reward = h('input', { type: 'text', maxlength: '120', value: g.reward || '', placeholder: 'Ví dụ: Thứ 7 cả lớp chơi Đấu cả lớp' });
    T.modal('Mục tiêu cả lớp mỗi tuần', h('div', { class: 'form' },
      h('label', { class: 'field' }, h('span', null, 'Mục tiêu'), pct),
      h('label', { class: 'field' }, h('span', null, 'Phần thưởng khi cả lớp đạt (học sinh sẽ thấy)'), reward)), function (close) {
      var ok = h('button', { class: 'btn' }, 'Lưu');
      ok.addEventListener('click', function () {
        T.busy(ok, true);
        T.api('setStarGoal', { courseId: c.id, pct: Number(pct.value), reward: reward.value.trim() }).then(function () {
          T.toast('Đã lưu mục tiêu.', 'success');
          close();
          renderBoard(c.id);
        }, function (e) { T.busy(ok, false); T.toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    });
  }

  function badgeGrid(have) {
    var B = window.TTMAvatar ? window.TTMAvatar.BADGES : {};
    return h('div', { class: 'badge-grid' }, Object.keys(B).map(function (k) {
      var on = (have || []).indexOf(k) >= 0;
      return h('div', { class: 'badge' + (on ? ' on' : ''), title: B[k][2] },
        h('span', { class: 'badge-i' }, on ? B[k][0] : '🔒'),
        h('b', null, B[k][1]),
        h('span', { class: 'muted small' }, B[k][2]));
    }));
  }

  function rulesBox() {
    return h('details', { class: 'panel star-rules' },
      h('summary', null, 'Cách được sao'),
      h('ul', null,
        h('li', null, '📅 Bài tập về nhà: tối đa ', h('b', null, '10 ⭐'), ', theo điểm thầy chấm (ví dụ 8/10 điểm → 8 ⭐).'),
        h('li', null, '📝 Đề luyện tập: tối đa ', h('b', null, '5 ⭐'), ', theo lần làm tốt nhất. Làm lại cho đúng hơn thì sao tăng.'),
        h('li', null, '🎮 Đấu cả lớp: hạng 1, 2, 3 được 3, 2, 1 ⭐.'),
        h('li', null, '🎁 Thầy thưởng thêm sao khi em học tốt, phát biểu hay.'),
        h('li', null, '🔥 Chuỗi tuần: số tuần liền em nộp đủ bài tập về nhà đúng hạn.'),
        h('li', null, '🏅 Huy hiệu và tổng sao (mọi lớp) mở khóa đồ mới cho nhân vật.')));
  }

  function detailDialog(c, o, onChange) {
    var body = h('div', { class: 'star-detail' }, T.loading());
    var close = T.modal('⭐ ' + o.fullName, body, null, { wide: true });
    T.api('starDetail', { courseId: c.id, username: o.username }).then(function (d) {
      var s = d.student;
      var items = d.items || [];
      var sum = {};
      items.forEach(function (it) { if (!it.pending) sum[it.kind] = (sum[it.kind] || 0) + it.stars; });
      fill(body,
        h('div', { class: 'star-detail-head' },
          av(o, 64),
          h('span', { class: 'star-big' }, starText(s.stars)),
          s.streak ? h('span', { class: 'star-fire' }, '🔥 ' + s.streak + ' tuần liền') : null,
          h('span', { class: 'muted' }, 'Hạng ' + s.rank + ' · tuần này +' + s.week)),
        h('div', { class: 'star-sum' }, Object.keys(KIND).filter(function (k) { return sum[k]; }).map(function (k) {
          return h('span', { class: 'pill' }, KIND[k][0] + ' ' + KIND[k][1] + ': ' + sum[k]);
        })),
        items.length ? h('div', { class: 'star-items' }, items.map(function (it) {
          var k = KIND[it.kind] || KIND.bonus;
          var del = null;
          if (d.canEdit && it.kind === 'bonus') {
            del = h('button', { class: 'link-btn small', type: 'button' }, 'Xóa');
            del.addEventListener('click', function () {
              T.busy(del, true, '…');
              T.api('removeStars', { id: it.id }).then(function () {
                T.toast('Đã xóa lần thưởng sao.', 'success');
                close();
                onChange();
              }, function (e) { T.busy(del, false); T.toast(e.message, 'error'); });
            });
          }
          return h('div', { class: 'star-item' + (it.stars < 0 ? ' minus' : '') },
            h('span', { class: 'star-item-k' }, k[0]),
            h('span', { class: 'star-item-t' }, it.title, h('span', { class: 'muted small' }, ' · ' + dmy(it.at))),
            it.pending ? h('span', { class: 'muted small' }, 'Chờ thầy chấm')
              : h('span', { class: 'star-item-n' }, (it.stars > 0 ? '+' : '') + it.stars + (it.max ? '/' + it.max : '') + ' ⭐'),
            del);
        })) : h('p', { class: 'muted' }, 'Chưa có sao nào. Làm bài tập về nhà và đề luyện tập để nhận sao nhé!'),
        h('h4', { class: 'star-sub' }, '🏅 Huy hiệu (' + (o.badges || []).length + '/' + Object.keys(window.TTMAvatar ? window.TTMAvatar.BADGES : {}).length + ')'),
        badgeGrid(o.badges));
    }, function (e) { fill(body, T.errorBox(e.message)); });
  }

  function giveDialog(c, list, names, onDone) {
    var amount = 1;
    var sign = 1;
    var picked = {};
    names.forEach(function (n) { picked[n] = true; });
    var amountBar = h('div', { class: 'chips' });
    var signBar = h('div', { class: 'chips' });
    function drawAmount() {
      fill(signBar, [[1, '🎁 Thưởng'], [-1, '➖ Trừ']].map(function (x) {
        return h('button', { type: 'button', class: 'chip-btn' + (sign === x[0] ? ' active' : ''), onclick: function () { sign = x[0]; drawAmount(); } }, x[1]);
      }));
      fill(amountBar, [1, 2, 3, 5, 10].map(function (n) {
        return h('button', { type: 'button', class: 'chip-btn' + (amount === n ? ' active' : ''), onclick: function () { amount = n; drawAmount(); } }, n + ' ⭐');
      }));
    }
    drawAmount();
    var reason = h('input', { type: 'text', maxlength: '120', placeholder: 'Ví dụ: Phát biểu xây dựng bài' });
    var checks = h('div', { class: 'star-pick' }, list.map(function (o) {
      var cb = h('input', { type: 'checkbox', checked: !!picked[o.username] });
      cb.addEventListener('change', function () { picked[o.username] = cb.checked; });
      return h('label', { class: 'star-pick-item' }, cb, ' ', o.fullName);
    }));
    var body = h('div', { class: 'form' },
      signBar,
      amountBar,
      h('label', { class: 'field' }, h('span', null, 'Lý do (học sinh sẽ thấy)'), reason),
      h('div', { class: 'field' }, h('span', null, 'Học sinh'), checks));
    T.modal('Thưởng / trừ sao', body, function (close) {
      var ok = h('button', { class: 'btn' }, 'Lưu');
      ok.addEventListener('click', function () {
        var who = Object.keys(picked).filter(function (k) { return picked[k]; });
        if (!who.length) return T.toast('Thầy chọn ít nhất một em.', 'error');
        if (!reason.value.trim()) return T.toast('Thầy ghi lý do.', 'error');
        T.busy(ok, true);
        T.api('giveStars', { courseId: c.id, usernames: who, amount: sign * amount, reason: reason.value.trim() }).then(function (r) {
          T.toast((sign > 0 ? 'Đã thưởng ' : 'Đã trừ ') + amount + ' ⭐ cho ' + r.count + ' em.', 'success');
          close();
          onDone();
        }, function (e) { T.busy(ok, false); T.toast(e.message, 'error'); });
      });
      return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Hủy'), ok];
    }, { noFocus: true });
  }

  /* ── Trang tạo nhân vật #/nhan-vat ── */
  function renderAvatar() {
    var A = window.TTMAvatar;
    var seq = T.getSeq();
    fill(T.app, T.loading('Đang mở tủ đồ…'));
    T.api('myAvatar').then(function (d) {
      if (!T.isCurrent(seq)) return;
      var me = T.getMe();
      var cfg = A.normalize(d.avatar, me.username);
      var group = 'hair';
      var dirty = false;
      var preview = h('div', { class: 'av-preview' });
      var tabs = h('div', { class: 'chips av-tabs' });
      var grid = h('div', { class: 'av-grid' });
      var save = h('button', { class: 'btn' }, 'Lưu nhân vật');
      T.setLeaveGuard(function () { return dirty; }, 'Nhân vật chưa được lưu. Rời trang?');
      function locked(opt) { return d.allUnlocked ? null : A.lockText(opt, d.totalStars, d.badges); }
      function drawPreview() { fill(preview, A.el(cfg, 180, me.username)); }
      function drawTabs() {
        fill(tabs, A.GROUPS.map(function (g) {
          return h('button', { type: 'button', class: 'chip-btn' + (group === g[0] ? ' active' : ''), onclick: function () { group = g[0]; drawTabs(); drawGrid(); } }, g[1]);
        }));
      }
      function drawGrid() {
        fill(grid, A.OPTIONS[group].map(function (opt) {
          var lock = locked(opt);
          var test = {};
          Object.keys(cfg).forEach(function (k) { test[k] = cfg[k]; });
          test[group] = opt[0];
          var b = h('button', { type: 'button', class: 'av-opt' + (cfg[group] === opt[0] ? ' on' : '') + (lock ? ' locked' : ''), title: lock || opt[1] },
            A.el(test, 64, me.username),
            h('span', { class: 'small' }, opt[1]),
            lock ? h('span', { class: 'av-lock small' }, '🔒 ' + lock) : null);
          b.addEventListener('click', function () {
            if (lock) return T.toast('Món này: ' + lock + '. Cố lên nhé!', 'error');
            cfg[group] = opt[0];
            dirty = true;
            drawPreview();
            drawGrid();
          });
          return b;
        }));
      }
      save.addEventListener('click', function () {
        T.busy(save, true);
        T.api('saveAvatar', { avatar: cfg }).then(function (r) {
          dirty = false;
          T.busy(save, false);
          me.avatar = r.avatar;
          try { T.store.set('ttm_me', JSON.stringify(me)); } catch (e) { /* bỏ qua */ }
          T.toast('Đã lưu nhân vật!', 'success');
        }, function (e) { T.busy(save, false); T.toast(e.message, 'error'); });
      });
      fill(T.app,
        h('a', { href: '#/', class: 'back' }, '← Trang chủ'),
        h('div', { class: 'page-head' },
          h('h1', null, '🧑‍🎨 Nhân vật của em'),
          h('p', { class: 'muted' }, d.allUnlocked ? 'Thầy cô được dùng mọi món đồ.' : 'Em có ' + d.totalStars + ' ⭐ (cộng mọi lớp) và ' + d.badges.length + ' huy hiệu. Có thêm sao và huy hiệu sẽ mở khóa đồ mới.')),
        h('div', { class: 'av-layout' },
          h('div', { class: 'panel av-side' }, preview, save),
          h('div', { class: 'panel av-main' }, tabs, grid)),
        d.allUnlocked ? null : h('div', { class: 'panel' }, h('h3', { class: 'star-sub' }, '🏅 Huy hiệu của em'), badgeGrid(d.badges)));
      drawPreview();
      drawTabs();
      drawGrid();
    }, function (e) {
      if (!T.isCurrent(seq)) return;
      fill(T.app, h('a', { href: '#/', class: 'back' }, '← Trang chủ'),
        T.errorBox(e.oldServer ? 'Máy chủ chưa cập nhật phần Nhân vật. Thầy dán Code.gs mới và triển khai lại.' : e.message, renderAvatar));
    });
  }

  window.TTMStars = { courseStrip: courseStrip, homeStrip: homeStrip, renderBoard: renderBoard, renderAvatar: renderAvatar };

  // Mở thẳng #/sao/... khi mới tải trang: gọi lại route() khi file này đã sẵn sàng.
  if (/^#\/?(sao|nhan-vat)(\/|$)/.test(location.hash) && T.route) T.route();
})();
