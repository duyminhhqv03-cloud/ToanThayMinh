// Kiểm thử logic thuần của 5 chế độ chơi trong hoc/game-modes.js
var assert = require('assert');
var path = require('path');
var M = require(path.join(__dirname, '..', 'hoc', 'game-modes.js'));

var passCount = 0;
function check(name, fn) {
  fn();
  passCount++;
  console.log('PASS  ' + name);
}

check('GAMES có đủ 5 chế độ theo đúng thứ tự và thuộc tính', function () {
  assert.strictEqual(Array.isArray(M.GAMES), true);
  assert.strictEqual(M.GAMES.length, 5);
  assert.deepStrictEqual(M.GAMES.map(function (g) { return g.id; }), ['classic', 'race', 'tug', 'relay', 'wager']);
  assert.strictEqual(M.getGame('race').icon, '🏁');
  assert.strictEqual(M.getGame('tug').teams, 2);
  assert.strictEqual(M.getGame('khong-co').id, 'classic');
  assert.strictEqual(M.teamCount('race'), 3);
  assert.strictEqual(M.teamCount('tug'), 2);
  assert.strictEqual(M.teamCount('relay'), 3);
  assert.strictEqual(M.teamCount('classic'), 3);
  assert.strictEqual(M.teamCount('wager'), 0);
});

check('suggest(questions): < 3 câu thì ok=false, đủ câu thì đúng 1 game được gợi ý', function () {
  var s2 = M.suggest([{ type: 'mc' }, { type: 'mc' }]);
  assert.strictEqual(s2.classic.ok, false);
  assert.strictEqual(s2.race.ok, false);
  assert.strictEqual(s2.tug.ok, false);
  assert.strictEqual(s2.relay.ok, false);
  assert.strictEqual(s2.wager.ok, false);
  assert.strictEqual(s2.race.note, 'Cần ít nhất 3 câu');

  // 5 câu (< 8) -> tug
  var q5 = [
    { type: 'mc' }, { type: 'mc' }, { type: 'mc' }, { type: 'short' }, { type: 'mc' }
  ];
  var s5 = M.suggest(q5);
  assert.strictEqual(s5.tug.ok, true);
  assert.strictEqual(s5.tug.recommended, true);
  assert.strictEqual(Boolean(s5.tug.note), true);
  assert.strictEqual(
    ['classic', 'race', 'tug', 'relay', 'wager'].filter(function (k) { return s5[k].recommended; }).length,
    1
  );

  // 10 câu, 8 câu mc (tỉ lệ 0.8 >= 0.7, >= 8 câu) -> race
  var q10mc = [];
  for (var i = 0; i < 8; i++) q10mc.push({ type: 'mc' });
  q10mc.push({ type: 'short' }, { type: 'fill' });
  var s10mc = M.suggest(q10mc);
  assert.strictEqual(s10mc.race.recommended, true);
  assert.strictEqual(
    ['classic', 'race', 'tug', 'relay', 'wager'].filter(function (k) { return s10mc[k].recommended; }).length,
    1
  );

  // 8 câu, chỉ 4 câu mc (tỉ lệ 0.5 < 0.7, >= 8 câu) -> relay
  var q8short = [
    { type: 'mc' }, { type: 'mc' }, { type: 'mc' }, { type: 'mc' },
    { type: 'short' }, { type: 'short' }, { type: 'fill' }, { type: 'short' }
  ];
  var s8short = M.suggest(q8short);
  assert.strictEqual(s8short.relay.recommended, true);
  assert.strictEqual(
    ['classic', 'race', 'tug', 'relay', 'wager'].filter(function (k) { return s8short[k].recommended; }).length,
    1
  );
});

check('splitTeams, smallestTeam, teamMembers, teamStandings hỗ trợ số nhóm n', function () {
  var noShuffle = function (a) { return a.slice(); };
  var t2 = M.splitTeams(['u1', 'u2', 'u3', 'u4'], 2, noShuffle);
  assert.deepStrictEqual(t2, { u1: 0, u2: 1, u3: 0, u4: 1 });

  var t3 = M.splitTeams(['u1', 'u2', 'u3', 'u4'], 3, noShuffle);
  assert.deepStrictEqual(t3, { u1: 0, u2: 1, u3: 2, u4: 0 });

  var players = {
    u1: { name: 'A', joinedAt: 20 },
    u2: { name: 'B', joinedAt: 10 },
    u3: { name: 'C', joinedAt: 10 },
    u4: { name: 'D', joinedAt: 5 }
  };
  var teamOf = { u1: 0, u2: 0, u3: 0, u4: 1, uLeft: 0 };
  // u2 và u3 cùng joinedAt=10 -> sắp theo uid ('u2' rồi 'u3'), sau đó 'u1' (joinedAt=20), bỏ qua uLeft đã rời phòng
  assert.deepStrictEqual(M.teamMembers(teamOf, players, 0), ['u2', 'u3', 'u1']);
  assert.strictEqual(M.smallestTeam(teamOf, players, 2), 1);
  assert.strictEqual(M.smallestTeam(teamOf, players, 3), 2);

  var scores = {
    u1: { score: 300 },
    u2: { score: 600 },
    u3: { score: 900 },
    u4: { score: 600 }
  };
  var st2 = M.teamStandings(teamOf, players, scores, 2);
  assert.strictEqual(st2.length, 2);
  assert.strictEqual(st2[0].avg, 600);
  assert.strictEqual(st2[1].avg, 600);
  // Cùng avg=600 -> hòa cùng hạng 1, nhóm 0 xếp trước vì total 1800 > 600
  assert.strictEqual(st2[0].t, 0);
  assert.strictEqual(st2[0].rank, 1);
  assert.strictEqual(st2[1].rank, 1);
});

check('Đua nhóm (raceStep & raceStandings): tính theo tỉ lệ, làm tròn 3 chữ số, bỏ nhóm 0 người', function () {
  var players = {
    a1: { joinedAt: 1 }, a2: { joinedAt: 2 }, a3: { joinedAt: 3 },
    b1: { joinedAt: 4 },
    c1: { joinedAt: 5 }, c2: { joinedAt: 6 }
  };
  var teamOf = { a1: 0, a2: 0, a3: 0, b1: 1, c1: 2, c2: 2 };
  // Nhóm 0 có 1/3 đúng (0.333), nhóm 1 có 1/1 đúng (1), nhóm 2 có 1/2 đúng (0.5)
  var pos1 = M.raceStep([0, 0, 0], teamOf, players, { a1: 1, a2: 0, a3: 0, b1: 1, c1: 0.5, c2: 0.5 }, 5);
  assert.deepStrictEqual(pos1, [0.333, 1, 0.5]);

  // Chịu được positions dạng object của Firebase và nhóm 0 người
  var playersNoB = { a1: { joinedAt: 1 }, a2: { joinedAt: 2 }, a3: { joinedAt: 3 }, c1: { joinedAt: 5 }, c2: { joinedAt: 6 } };
  var pos2 = M.raceStep({ '0': 0.333, '1': 1, '2': 0.5 }, teamOf, playersNoB, { a1: 1, a2: 1, a3: 1, c1: 1, c2: 0 }, 5);
  assert.deepStrictEqual(pos2, [1.333, 1, 1]);

  var standings = M.raceStandings(pos2, teamOf, playersNoB, 4);
  // Nhóm 1 không còn người trong playersNoB nên bị bỏ
  assert.strictEqual(standings.length, 2);
  assert.strictEqual(standings[0].t, 0);
  assert.strictEqual(standings[0].rank, 1);
  assert.strictEqual(standings[0].value, 1.333);
  assert.strictEqual(standings[1].t, 2);
  assert.strictEqual(standings[1].rank, 2);
  assert.strictEqual(standings[1].pct, 25);

  // Hòa cùng hạng và pct tối đa 100
  var stTie = M.raceStandings([5, 0, 5], teamOf, playersNoB, 4);
  assert.strictEqual(stTie[0].rank, 1);
  assert.strictEqual(stTie[1].rank, 1);
  assert.strictEqual(stTie[0].pct, 100);
});

check('Kéo co (tugStep & tugWinner): kéo dây theo tỉ lệ đúng, kẹp [-100, 100], xử lý hòa', function () {
  var players = {
    r1: { joinedAt: 1 }, r2: { joinedAt: 2 },
    b1: { joinedAt: 3 }, b2: { joinedAt: 4 }
  };
  var teamOf = { r1: 0, r2: 0, b1: 1, b2: 1 };
  // total = 8 -> ceil(8/4) = 2 -> max(2, 2) = 2 -> bước 50
  // Nhóm 0 đúng 100% (pA=1), nhóm 1 đúng 50% (pB=0.5) -> rope += (1 - 0.5) * 50 = +25
  var rope1 = M.tugStep(0, teamOf, players, { r1: 1, r2: 1, b1: 1, b2: 0 }, 8);
  assert.strictEqual(rope1, 25);

  // Kẹp ở 100
  var ropeMax = M.tugStep(80, teamOf, players, { r1: 1, r2: 1, b1: 0, b2: 0 }, 8);
  assert.strictEqual(ropeMax, 100);

  // Kẹp ở -100
  var ropeMin = M.tugStep(-80, teamOf, players, { r1: 0, r2: 0, b1: 1, b2: 1 }, 8);
  assert.strictEqual(ropeMin, -100);

  // Làm tròn 1 chữ số với total = 12 (bước = 100/3 = 33.333...)
  var ropeRound = M.tugStep(0, teamOf, players, { r1: 1, r2: 1, b1: 0, b2: 0 }, 12);
  assert.strictEqual(ropeRound, 33.3);

  assert.strictEqual(M.tugWinner(10, 100, 900), 0);
  assert.strictEqual(M.tugWinner(-5, 900, 100), 1);
  assert.strictEqual(M.tugWinner(0, 500, 400), 0);
  assert.strictEqual(M.tugWinner(0, 400, 500), 1);
  assert.strictEqual(M.tugWinner(0, 500, 500), -1);
});

check('Tiếp sức (relayStart, relayAdvance, relayPoints, relayNextPointers)', function () {
  var players = {
    a1: { joinedAt: 1 }, a2: { joinedAt: 2 }, a3: { joinedAt: 3 },
    b1: { joinedAt: 4 }
  };
  // Nhóm 2 có 0 người -> không có mục '2'
  var teamOf = { a1: 0, a2: 0, a3: 0, b1: 1 };
  var r = M.relayStart(teamOf, players, [1, 0, 0], 1000);
  assert.strictEqual(r['0'].uid, 'a2');
  assert.strictEqual(r['0'].tried, 0);
  assert.strictEqual(r['0'].done, false);
  assert.strictEqual(r['1'].uid, 'b1');
  assert.strictEqual(r['2'], undefined);

  var mem0 = M.teamMembers(teamOf, players, 0); // ['a1', 'a2', 'a3']
  // a2 trả lời sai -> chuyển sang a3
  M.relayAdvance(r, 0, mem0, 2000);
  assert.strictEqual(r['0'].uid, 'a3');
  assert.strictEqual(r['0'].tried, 1);
  assert.deepStrictEqual(r['0'].triedUids, ['a2']);
  assert.strictEqual(r['0'].done, false);

  // a3 sai -> chuyển xoay vòng sang a1
  M.relayAdvance(r, 0, mem0, 3000);
  assert.strictEqual(r['0'].uid, 'a1');
  assert.strictEqual(r['0'].tried, 2);
  assert.deepStrictEqual(r['0'].triedUids, ['a2', 'a3']);
  assert.strictEqual(r['0'].done, false);

  // a1 cũng sai -> hết người -> done=true, ok=false, giữ uid cuối là a1
  M.relayAdvance(r, 0, mem0, 4000);
  assert.strictEqual(r['0'].done, true);
  assert.strictEqual(r['0'].ok, false);
  assert.strictEqual(r['0'].tried, 3);
  assert.deepStrictEqual(r['0'].triedUids, ['a2', 'a3', 'a1']);

  // Sang câu sau đi tiếp từ người kế của người cầm lượt cuối (a1 ở index 0 -> kế là index 1 tức a2)
  var nextPtrs = M.relayNextPointers([1, 0, 0], r, teamOf, players);
  assert.deepStrictEqual(nextPtrs, [1, 0, 0]);

  // Tính điểm relayPoints
  assert.strictEqual(M.relayPoints(0), 100);
  assert.strictEqual(M.relayPoints(1), 70);
  assert.strictEqual(M.relayPoints(2), 40);
  assert.strictEqual(M.relayPoints(5), 40);
});

check('Đặt cược (betAmount & applyWager)', function () {
  assert.deepStrictEqual(M.BET_LEVELS, [100, 200, 300, 500, 'all']);
  assert.strictEqual(M.WAGER_START, 1000);

  // Chọn theo chỉ số 0..4 hoặc giá trị trực tiếp
  assert.strictEqual(M.betAmount(0, 1000), 100);
  assert.strictEqual(M.betAmount(1, 1000), 200);
  assert.strictEqual(M.betAmount(2, 1000), 300);
  assert.strictEqual(M.betAmount(3, 1000), 500);
  assert.strictEqual(M.betAmount(4, 1200), 1200);
  assert.strictEqual(M.betAmount('all', 1200), 1200);
  assert.strictEqual(M.betAmount('all', 0), 100);
  assert.strictEqual(M.betAmount('all', 50), 100);
  assert.strictEqual(M.betAmount(null, 800), 100);
  assert.strictEqual(M.betAmount(undefined, 800), 100);
  assert.strictEqual(M.betAmount(99, 800), 100);

  // applyWager: đúng hoàn toàn -> cộng
  assert.deepStrictEqual(M.applyWager(1000, 300, 1, true), { score: 1300, gain: 300, loss: 0 });
  // đúng một phần -> giữ nguyên
  assert.deepStrictEqual(M.applyWager(1000, 300, 0.5, true), { score: 1000, gain: 0, loss: 0 });
  // sai -> trừ
  assert.deepStrictEqual(M.applyWager(1000, 300, 0, true), { score: 700, gain: 0, loss: 300 });
  // không trả lời -> trừ
  assert.deepStrictEqual(M.applyWager(1000, 200, 0, false), { score: 800, gain: 0, loss: 200 });
  // trừ không âm, loss là phần thực trừ
  assert.deepStrictEqual(M.applyWager(150, 500, 0, true), { score: 0, gain: 0, loss: 150 });
  assert.deepStrictEqual(M.applyWager(0, 100, 0, false), { score: 0, gain: 0, loss: 0 });
});

function findById(list, id) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

check('recommend(questions, info): N < 3 chặn mọi game; size 2 chặn tug/race/relay', function () {
  var q2 = [{ type: 'mc' }, { type: 'mc' }];
  var r2 = M.recommend(q2, { size: 12, minutes: 10 });
  assert.strictEqual(r2.length, 6);
  for (var i = 0; i < r2.length; i++) {
    assert.strictEqual(r2[i].ok, false);
    assert.strictEqual(r2[i].why[0], 'Cần ít nhất 3 câu');
  }

  var q6 = [];
  for (var j = 0; j < 6; j++) q6.push({ type: 'mc' });
  var rSize2 = M.recommend(q6, { size: 2, minutes: 10 });
  assert.strictEqual(findById(rSize2, 'tug').ok, false);
  assert.strictEqual(findById(rSize2, 'tug').why[0], 'Cần ít nhất 4 em để chia 2 nhóm');
  assert.strictEqual(findById(rSize2, 'race').ok, false);
  assert.strictEqual(findById(rSize2, 'race').why[0], 'Cần ít nhất 6 em để chia 3 nhóm');
  assert.strictEqual(findById(rSize2, 'relay').ok, false);
  assert.strictEqual(findById(rSize2, 'relay').why[0], 'Cần ít nhất 6 em để chia 3 nhóm');
  assert.strictEqual(findById(rSize2, 'wager').ok, true);
  assert.strictEqual(findById(rSize2, 'classic').ok, true);
  assert.strictEqual(findById(rSize2, 'review').ok, true);
  // Các game ok=true luôn đứng trước ok=false
  assert.strictEqual(rSize2[0].ok, true);
  assert.strictEqual(rSize2[1].ok, true);
  assert.strictEqual(rSize2[2].ok, true);
  assert.strictEqual(rSize2[3].ok, false);
});

check('recommend: 15 mc, size 12, 15 phút xếp race đầu', function () {
  var q15 = [];
  for (var i = 0; i < 15; i++) q15.push({ type: 'mc' });
  var r = M.recommend(q15, { size: 12, minutes: 15 });
  assert.strictEqual(r[0].id, 'race');
  assert.strictEqual(r[0].ok, true);
  assert.strictEqual(r[0].useCount, 15);
  assert.strictEqual(r[0].duration, 30);
  assert.strictEqual(r[0].estMinutes, 12);
});

check('recommend: 6 câu có 1 câu short, size 8, 5 phút xếp tug đầu', function () {
  var q6 = [
    { type: 'mc' }, { type: 'mc' }, { type: 'mc' },
    { type: 'mc' }, { type: 'mc' }, { type: 'short' }
  ];
  var r = M.recommend(q6, { size: 8, minutes: 5 });
  assert.strictEqual(r[0].id, 'tug');
  assert.strictEqual(r[0].ok, true);
  assert.strictEqual(r[0].useCount, 6);
});

check('recommend: toàn short 10 câu, size 12, 20 phút -> relay có duration >= 30, review bị chặn', function () {
  var q10 = [];
  for (var i = 0; i < 10; i++) q10.push({ type: 'short' });
  var r = M.recommend(q10, { size: 12, minutes: 20 });
  var relay = findById(r, 'relay');
  assert.strictEqual(relay.ok, true);
  assert.strictEqual(relay.duration >= 30, true);
  assert.strictEqual(relay.useCount, 10);
  var rev = findById(r, 'review');
  assert.strictEqual(rev.ok, false);
  assert.strictEqual(rev.why[0], 'Cần ít nhất 3 câu trắc nghiệm');
});

check('recommend: review trên đề có short có warn', function () {
  var qMixed = [
    { type: 'mc' }, { type: 'mc' }, { type: 'mc' },
    { type: 'mc' }, { type: 'short' }, { type: 'fill' }
  ];
  var r = M.recommend(qMixed, { size: 10, minutes: 10 });
  var rev = findById(r, 'review');
  assert.strictEqual(rev.ok, true);
  assert.strictEqual(rev.useCount, 4);
  assert.strictEqual(rev.limitMin, 10);
  assert.strictEqual(rev.warn.indexOf('Chỉ dùng được 4/6 câu trắc nghiệm') !== -1, true);
});

check('recommend: useCount giảm đúng khi 30 câu, 5 phút và có warn thời lượng ngắn', function () {
  var q30 = [];
  for (var i = 0; i < 30; i++) q30.push({ type: 'mc' });
  var r = M.recommend(q30, { size: 12, minutes: 5 });
  var race = findById(r, 'race');
  // 5 phút = 300s, d nhỏ nhất = 10, phụ = 15 -> 25s/câu -> floor(300/25) = 12 câu
  assert.strictEqual(race.duration, 10);
  assert.strictEqual(race.useCount, 12);
  assert.strictEqual(race.warn.indexOf('Thời lượng ngắn nên chỉ dùng 12/30 câu') !== -1, true);

  var relay = findById(r, 'relay');
  // relay d nhỏ nhất = 30, phụ = 15 -> 45s/câu -> floor(300/45) = 6 câu
  assert.strictEqual(relay.duration, 30);
  assert.strictEqual(relay.useCount, 6);
  assert.strictEqual(relay.warn.indexOf('Thời lượng ngắn nên chỉ dùng 6/30 câu') !== -1, true);

  var rev = findById(r, 'review');
  // review không bị giảm useCount theo giây mà dùng hết M câu mc trong limitMin = 5
  assert.strictEqual(rev.useCount, 30);
  assert.strictEqual(rev.limitMin, 5);
  assert.strictEqual(rev.warn, '');
});

check('buildBank: đủ thẻ đúng, tối đa 2 thẻ nhiễu, không trùng (bỏ khoảng trắng/hoa thường)', function () {
  var noShuffle = function (arr) { return arr.slice(); };
  var item = {
    type: 'fill',
    text: 'Solar = .... ; Wind = ....',
    answers: [['Mặt trời', 'Năng lượng mặt trời'], ['Gió']]
  };
  var allQ = [
    item,
    { type: 'fill', text: 'A = .... ; B = ....', answers: [['mặt  trời'], ['Nước', 'Thủy điện']] },
    { type: 'short', text: 'Than đá là gì?', answers: ['Than đá', 'Hóa thạch'] },
    { type: 'short', text: 'Khí đốt?', answers: ['Khí đốt'] }
  ];
  var bank = M.buildBank(item, allQ, noShuffle);
  // 2 thẻ đúng ('Mặt trời', 'Gió') + tối đa 2 thẻ nhiễu ('Nước', 'Than đá'), bỏ qua 'mặt  trời' vì trùng 'Mặt trời'
  assert.deepStrictEqual(bank, ['Mặt trời', 'Gió', 'Nước', 'Than đá']);
});

check('buildBank: thẻ đúng trùng nhau giữ đủ số lượng, câu fill nhiều cách viết chỉ lấy cách đầu', function () {
  var revShuffle = function (arr) { return arr.slice().reverse(); };
  var item = {
    type: 'fill',
    text: 'Ô 1: .... ; Ô 2: .... ; Ô 3: ....',
    answers: [['1/2', '0,5'], ['3/4', '0,75'], ['1/2', '0.5']]
  };
  var allQ = [
    item,
    { type: 'short', text: 'Câu khác', answers: ['1 / 2'] }, // trùng với 1/2 khi bỏ khoảng trắng -> không lấy làm nhiễu
    { type: 'short', text: 'Câu khác 2', answers: ['5/6', 'năm phần sáu'] }
  ];
  var bank = M.buildBank(item, allQ, revShuffle);
  assert.strictEqual(bank.length, 4);
  var countHalf = bank.filter(function (x) { return x === '1/2'; }).length;
  assert.strictEqual(countHalf, 2);
  assert.strictEqual(bank.indexOf('0,5'), -1);
  assert.strictEqual(bank.indexOf('0,75'), -1);
  assert.strictEqual(bank.indexOf('5/6') !== -1, true);
});

check('buildBank: không có câu khác thì không có thẻ nhiễu; bỏ qua rỗng/thẻ nhiễu > 40 ký tự; quá 1500 ký tự trả []', function () {
  var noShuffle = function (arr) { return arr.slice(); };
  var item = {
    type: 'fill',
    text: 'Bước 1: .... ; Bước 2: ....',
    answers: [['Đọc đề'], [''], ['Giải bài']]
  };
  var bankSingle = M.buildBank(item, [item], noShuffle);
  assert.deepStrictEqual(bankSingle, ['Đọc đề', 'Giải bài']);

  var longDistractor = 'Chuỗi nhiễu này dài hơn bốn mươi ký tự nên không được chọn vào ngân hàng thẻ';
  var bankFiltered = M.buildBank(item, [
    item,
    { type: 'short', answers: [longDistractor] },
    { type: 'short', answers: ['Kiểm tra lại'] }
  ], noShuffle);
  assert.deepStrictEqual(bankFiltered, ['Đọc đề', 'Giải bài', 'Kiểm tra lại']);

  var hugeStr = new Array(800).join('ab'); // 1598 ký tự
  var hugeItem = {
    type: 'fill',
    text: '.... và ....',
    answers: [[hugeStr], ['ngắn']]
  };
  assert.deepStrictEqual(M.buildBank(hugeItem, [hugeItem], noShuffle), []);
});

check('Kiểm tra mã nguồn thuần ES5 (không let/const/arrow/class/template literal/block function)', function () {
  var fs = require('fs');
  var files = ['game-modes.js', 'game.js', 'app.js', 'quiz-format.js', 'review.js'];
  for (var i = 0; i < files.length; i++) {
    var p = path.join(__dirname, '..', 'hoc', files[i]);
    var code = fs.readFileSync(p, 'utf8');
    // Bỏ comment và chuỗi đơn giản trước khi kiểm tra cú pháp ES6
    var stripped = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    assert.strictEqual(/(^|[^\w$.])(let|const)\s+[A-Za-z_$]/.test(stripped), false, files[i] + ' chứa let/const');
    assert.strictEqual(/(^|[^\w$.])class\s+[A-Za-z_${]/.test(stripped), false, files[i] + ' chứa class');
    assert.strictEqual(/=>/.test(stripped), false, files[i] + ' chứa arrow function');
    assert.strictEqual(/`/.test(stripped), false, files[i] + ' chứa template string');
    assert.strictEqual(/\b(replaceChildren)\b/.test(stripped), false, files[i] + ' chứa replaceChildren');
  }
});

console.log('\nĐã vượt qua ' + passCount + ' nhóm kiểm thử modes-test.js!');
