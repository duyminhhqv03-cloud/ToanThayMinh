/* Các chế độ chơi của Đấu cả lớp – Toán Thầy Minh
 * Logic thuần (ES5), không phụ thuộc DOM hay Firebase, dùng chung cho trình duyệt và kiểm thử Node.
 */
(function (root) {
  'use strict';

  var GAMES = [
    {
      id: 'classic',
      icon: '🎮',
      name: 'Đấu từng câu (kiểu Kahoot)',
      teams: 0,
      desc: 'Cả lớp trả lời cùng một câu, nhanh và đúng thì nhiều điểm. Có thể chia 3 nhóm ở sảnh chờ.'
    },
    {
      id: 'race',
      icon: '🏁',
      name: 'Đua nhóm',
      teams: 3,
      desc: 'Chia 3 nhóm. Mỗi câu, nhóm tiến theo tỉ lệ thành viên trả lời đúng, nhóm đông không có lợi hơn.'
    },
    {
      id: 'tug',
      icon: '🪢',
      name: 'Kéo co',
      teams: 2,
      desc: 'Chia 2 nhóm. Nhóm có tỉ lệ đúng cao hơn kéo dây về phía mình.'
    },
    {
      id: 'relay',
      icon: '🏃',
      name: 'Tiếp sức',
      teams: 3,
      desc: 'Chia 3 nhóm. Mỗi câu một bạn của nhóm trả lời, sai hoặc chậm thì lượt chuyển cho bạn tiếp theo.'
    },
    {
      id: 'wager',
      icon: '🎲',
      name: 'Đặt cược điểm',
      teams: 0,
      desc: 'Mỗi em có 1000 điểm, trước mỗi câu chọn mức cược. Đúng được cộng, sai bị trừ.'
    }
  ];

  var BET_LEVELS = [100, 200, 300, 500, 'all'];
  var WAGER_START = 1000;

  function getGame(id) {
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === id) return GAMES[i];
    }
    return GAMES[0];
  }

  function teamCount(id) {
    if (id === 'tug') return 2;
    if (id === 'wager') return 0;
    if (id === 'race' || id === 'relay' || id === 'classic' || !id) return 3;
    return 0;
  }

  function suggest(questions) {
    var qs = Array.isArray(questions) ? questions : [];
    var total = qs.length;
    var out = {};
    var i;
    if (total < 3) {
      for (i = 0; i < GAMES.length; i++) {
        out[GAMES[i].id] = {
          ok: false,
          recommended: false,
          note: 'Cần ít nhất 3 câu'
        };
      }
      return out;
    }

    var mcCount = 0;
    for (i = 0; i < total; i++) {
      if (qs[i] && qs[i].type === 'mc') mcCount++;
    }
    var mcRatio = mcCount / total;
    var recId;
    var recNote;
    if (mcRatio >= 0.7 && total >= 8) {
      recId = 'race';
      recNote = 'Nhiều câu trắc nghiệm, hợp đua đường dài';
    } else if (total < 8) {
      recId = 'tug';
      recNote = 'Ít câu, trận nhanh gọn';
    } else {
      recId = 'relay';
      recNote = 'Nhiều câu gõ đáp án, hợp thay phiên tiếp sức';
    }

    for (i = 0; i < GAMES.length; i++) {
      var gid = GAMES[i].id;
      var isRec = gid === recId;
      out[gid] = {
        ok: true,
        recommended: isRec,
        note: isRec ? recNote : ''
      };
    }
    return out;
  }

  function defaultShuffle(arr) {
    var out = (arr || []).slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function splitTeams(uids, n, shuffleFn) {
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var list = Array.isArray(uids) ? uids.slice() : [];
    var shuffled = typeof shuffleFn === 'function' ? shuffleFn(list) : defaultShuffle(list);
    var res = {};
    for (var i = 0; i < shuffled.length; i++) {
      res[shuffled[i]] = i % count;
    }
    return res;
  }

  function smallestTeam(teamOf, playersMap, n) {
    teamOf = teamOf || {};
    playersMap = playersMap || {};
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var counts = [];
    for (var k = 0; k < count; k++) counts.push(0);
    for (var uid in playersMap) {
      if (Object.prototype.hasOwnProperty.call(playersMap, uid) && playersMap[uid]) {
        var t = Number(teamOf[uid]);
        if (teamOf[uid] !== undefined && teamOf[uid] !== null && t >= 0 && t < count && t === Math.floor(t)) {
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

  function teamMembers(teamOf, playersMap, t) {
    teamOf = teamOf || {};
    playersMap = playersMap || {};
    var target = Number(t);
    var uids = [];
    for (var uid in playersMap) {
      if (Object.prototype.hasOwnProperty.call(playersMap, uid) && playersMap[uid]) {
        if (teamOf[uid] !== undefined && teamOf[uid] !== null && Number(teamOf[uid]) === target) {
          uids.push(uid);
        }
      }
    }
    uids.sort(function (a, b) {
      var ja = Number((playersMap[a] && playersMap[a].joinedAt) || 0);
      var jb = Number((playersMap[b] && playersMap[b].joinedAt) || 0);
      if (ja !== jb) return ja - jb;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    return uids;
  }

  function teamStandings(teamOf, playersMap, scoresMap, n) {
    teamOf = teamOf || {};
    playersMap = playersMap || {};
    scoresMap = scoresMap || {};
    var count = (typeof n === 'number' && n > 0) ? Math.floor(n) : 3;
    var list = [];
    for (var t = 0; t < count; t++) {
      var total = 0;
      var cnt = 0;
      for (var uid in playersMap) {
        if (Object.prototype.hasOwnProperty.call(playersMap, uid) && playersMap[uid]) {
          if (teamOf[uid] !== undefined && teamOf[uid] !== null && Number(teamOf[uid]) === t) {
            cnt++;
            var sObj = scoresMap[uid];
            var sc = (sObj && typeof sObj.score === 'number' && isFinite(sObj.score)) ? sObj.score : 0;
            total += sc;
          }
        }
      }
      if (cnt > 0) {
        var avg = Math.round((total / cnt) * 10) / 10;
        list.push({ t: t, avg: avg, value: avg, total: total, n: cnt, rank: 1 });
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

  function toNumArray(raw, len, defVal) {
    var out = [];
    var d = defVal !== undefined ? defVal : 0;
    for (var i = 0; i < len; i++) {
      var v = (raw && raw[i] !== undefined && raw[i] !== null) ? Number(raw[i]) : d;
      out.push(isFinite(v) ? v : d);
    }
    return out;
  }

  /* ═══════════ 1. Đua nhóm (race) ═══════════ */

  function raceStep(positions, teamOf, playersMap, ratioByUid, total) {
    var pos = toNumArray(positions, 3, 0);
    ratioByUid = ratioByUid || {};
    var maxPos = (typeof total === 'number' && total > 0) ? total : null;
    var next = [];
    for (var t = 0; t < 3; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      var cur = pos[t];
      if (members.length > 0) {
        var sum = 0;
        for (var i = 0; i < members.length; i++) {
          var r = Number(ratioByUid[members[i]] || 0);
          if (isFinite(r) && r > 0) sum += r;
        }
        cur = Math.round((cur + sum / members.length) * 1000) / 1000;
      } else {
        cur = Math.round(cur * 1000) / 1000;
      }
      if (cur < 0) cur = 0;
      if (maxPos !== null && cur > maxPos) cur = maxPos;
      next.push(cur);
    }
    return next;
  }

  function raceStandings(positions, teamOf, playersMap, total) {
    var pos = toNumArray(positions, 3, 0);
    var tot = (typeof total === 'number' && total > 0) ? total : 1;
    var list = [];
    for (var t = 0; t < 3; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      if (members.length > 0) {
        var val = Math.round(Math.max(0, pos[t]) * 1000) / 1000;
        var rawPct = (val / tot) * 100;
        var pct = Math.min(100, Math.max(0, Math.round(rawPct * 100) / 100));
        list.push({
          t: t,
          value: val,
          avg: val,
          total: val,
          n: members.length,
          pct: pct,
          rank: 1
        });
      }
    }
    list.sort(function (a, b) {
      if (b.value !== a.value) return b.value - a.value;
      return a.t - b.t;
    });
    for (var i = 0; i < list.length; i++) {
      if (i > 0 && list[i].value === list[i - 1].value) {
        list[i].rank = list[i - 1].rank;
      } else {
        list[i].rank = i + 1;
      }
    }
    return list;
  }

  /* ═══════════ 2. Kéo co (tug) ═══════════ */

  function teamAvgRatio(teamOf, playersMap, ratioByUid, t) {
    var members = teamMembers(teamOf, playersMap, t);
    if (!members.length) return 0;
    var sum = 0;
    for (var i = 0; i < members.length; i++) {
      var r = Number((ratioByUid && ratioByUid[members[i]]) || 0);
      if (isFinite(r) && r > 0) sum += r;
    }
    return sum / members.length;
  }

  function tugStep(rope, teamOf, playersMap, ratioByUid, total) {
    var cur = (typeof rope === 'number' && isFinite(rope)) ? rope : (Number(rope) || 0);
    if (!isFinite(cur)) cur = 0;
    var tot = (typeof total === 'number' && total > 0) ? total : 1;
    var pA = teamAvgRatio(teamOf, playersMap, ratioByUid, 0);
    var pB = teamAvgRatio(teamOf, playersMap, ratioByUid, 1);
    var denom = Math.max(2, Math.ceil(tot / 4));
    var step = (pA - pB) * (100 / denom);
    var next = Math.max(-100, Math.min(100, cur + step));
    next = Math.round(next * 10) / 10;
    if (next === 0) next = 0;
    return next;
  }

  function tugWinner(rope, avgA, avgB) {
    var r = (typeof rope === 'number' && isFinite(rope)) ? rope : (Number(rope) || 0);
    if (r > 0) return 0;
    if (r < 0) return 1;
    var a = (typeof avgA === 'number' && isFinite(avgA)) ? avgA : (Number(avgA) || 0);
    var b = (typeof avgB === 'number' && isFinite(avgB)) ? avgB : (Number(avgB) || 0);
    if (a > b) return 0;
    if (b > a) return 1;
    return -1;
  }

  function tugStandings(rope, teamOf, playersMap, scoresMap) {
    var r = (typeof rope === 'number' && isFinite(rope)) ? rope : (Number(rope) || 0);
    if (!isFinite(r)) r = 0;
    scoresMap = scoresMap || {};
    var list = [];
    for (var t = 0; t < 2; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      if (members.length > 0) {
        var total = 0;
        for (var i = 0; i < members.length; i++) {
          var sObj = scoresMap[members[i]];
          total += (sObj && typeof sObj.score === 'number' && isFinite(sObj.score)) ? sObj.score : 0;
        }
        var avg = Math.round((total / members.length) * 10) / 10;
        var adv = Math.round((t === 0 ? r : -r) * 10) / 10;
        if (adv === 0) adv = 0;
        list.push({
          t: t,
          value: adv,
          rope: r,
          avg: avg,
          total: total,
          n: members.length,
          rank: 1
        });
      }
    }
    list.sort(function (a, b) {
      if (b.value !== a.value) return b.value - a.value;
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.total !== a.total) return b.total - a.total;
      return a.t - b.t;
    });
    for (var j = 0; j < list.length; j++) {
      if (j > 0 && list[j].value === list[j - 1].value && list[j].avg === list[j - 1].avg) {
        list[j].rank = list[j - 1].rank;
      } else {
        list[j].rank = j + 1;
      }
    }
    return list;
  }

  /* ═══════════ 3. Tiếp sức (relay) ═══════════ */

  function toStrArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.slice();
    if (typeof raw === 'object') {
      var keys = Object.keys(raw);
      var out = [];
      for (var i = 0; i < keys.length; i++) {
        if (raw[keys[i]]) out.push(String(raw[keys[i]]));
      }
      return out;
    }
    return [];
  }

  function relayStart(teamOf, playersMap, pointers, nowTs) {
    var ptrs = toNumArray(pointers, 3, 0);
    var atVal = (typeof nowTs === 'number' && isFinite(nowTs)) ? nowTs : 0;
    var out = {};
    for (var t = 0; t < 3; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      if (members.length > 0) {
        var idx = Math.max(0, Math.floor(ptrs[t])) % members.length;
        out[String(t)] = {
          uid: members[idx],
          tried: 0,
          triedUids: [],
          done: false,
          ok: false,
          at: atVal
        };
      }
    }
    return out;
  }

  function relayAdvance(relay, t, members, nowTs) {
    if (!relay || typeof relay !== 'object') return null;
    var slot = (t !== undefined && t !== null && !Array.isArray(t))
      ? (relay[t] || relay[String(t)])
      : relay;
    var mem = Array.isArray(members) ? members : (Array.isArray(t) ? t : []);
    if (!slot || typeof slot !== 'object') return null;
    if (slot.done) return slot;

    var triedUids = toStrArray(slot.triedUids);
    if (slot.uid && triedUids.indexOf(slot.uid) < 0) {
      triedUids.push(slot.uid);
    }
    slot.triedUids = triedUids;
    slot.tried = triedUids.length;
    if (typeof nowTs === 'number' && isFinite(nowTs)) {
      slot.at = nowTs;
    }

    var curIdx = slot.uid ? mem.indexOf(slot.uid) : -1;
    var nextUid = null;
    for (var i = 1; i <= mem.length; i++) {
      var candIdx = curIdx >= 0 ? (curIdx + i) % mem.length : (i - 1);
      var cand = mem[candIdx];
      if (cand && triedUids.indexOf(cand) < 0) {
        nextUid = cand;
        break;
      }
    }

    if (nextUid !== null) {
      slot.uid = nextUid;
      slot.done = false;
      slot.ok = false;
    } else {
      slot.done = true;
      slot.ok = false;
    }
    return slot;
  }

  function relayPoints(tried) {
    var tr = Math.max(0, Math.floor(Number(tried) || 0));
    return Math.max(40, 100 - 30 * tr);
  }

  function relayNextPointers(pointers, relay, teamOf, playersMap) {
    var ptrs = toNumArray(pointers, 3, 0);
    var next = [];
    for (var t = 0; t < 3; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      var slot = relay && (relay[t] || relay[String(t)]);
      if (members.length > 0 && slot && slot.uid) {
        var idx = members.indexOf(slot.uid);
        if (idx >= 0) {
          next.push((idx + 1) % members.length);
        } else {
          next.push((Math.max(0, Math.floor(ptrs[t])) + 1) % members.length);
        }
      } else if (members.length > 0) {
        next.push(Math.max(0, Math.floor(ptrs[t])) % members.length);
      } else {
        next.push(0);
      }
    }
    return next;
  }

  function relayStandings(points, teamOf, playersMap) {
    var pts = toNumArray(points, 3, 0);
    var list = [];
    for (var t = 0; t < 3; t++) {
      var members = teamMembers(teamOf, playersMap, t);
      if (members.length > 0) {
        var val = Math.max(0, Math.round(pts[t]));
        list.push({
          t: t,
          value: val,
          avg: val,
          total: val,
          n: members.length,
          rank: 1
        });
      }
    }
    list.sort(function (a, b) {
      if (b.value !== a.value) return b.value - a.value;
      return a.t - b.t;
    });
    for (var i = 0; i < list.length; i++) {
      if (i > 0 && list[i].value === list[i - 1].value) {
        list[i].rank = list[i - 1].rank;
      } else {
        list[i].rank = i + 1;
      }
    }
    return list;
  }

  /* ═══════════ 4. Đặt cược điểm (wager) ═══════════ */

  function betAmount(level, score) {
    var sc = (typeof score === 'number' && isFinite(score)) ? Math.max(0, Math.round(score)) : WAGER_START;
    if (level === null || level === undefined || level === '' || typeof level === 'boolean') {
      return 100;
    }
    var resolved = level;
    if (typeof level === 'number' && isFinite(level) && level >= 0 && level < BET_LEVELS.length && level === Math.floor(level)) {
      resolved = BET_LEVELS[level];
    }
    if (resolved === 'all') {
      return Math.max(sc, 100);
    }
    if (resolved === 100 || resolved === 200 || resolved === 300 || resolved === 500) {
      return resolved;
    }
    return 100;
  }

  function applyWager(score, amount, ratio, answered) {
    var cur = (typeof score === 'number' && isFinite(score)) ? Math.max(0, Math.round(score)) : 0;
    var amt = (typeof amount === 'number' && isFinite(amount) && amount > 0) ? Math.round(amount) : 100;
    var r = (answered === false) ? 0 : ((typeof ratio === 'number' && isFinite(ratio)) ? ratio : 0);

    if (r === 1) {
      return { score: cur + amt, gain: amt, loss: 0 };
    }
    if (r > 0 && r < 1) {
      return { score: cur, gain: 0, loss: 0 };
    }
    var nextScore = Math.max(0, cur - amt);
    var actualLoss = cur - nextScore;
    return { score: nextScore, gain: 0, loss: actualLoss };
  }

  var TTMModes = {
    GAMES: GAMES,
    BET_LEVELS: BET_LEVELS,
    WAGER_START: WAGER_START,
    getGame: getGame,
    teamCount: teamCount,
    suggest: suggest,
    splitTeams: splitTeams,
    smallestTeam: smallestTeam,
    teamMembers: teamMembers,
    teamStandings: teamStandings,
    toNumArray: toNumArray,
    toStrArray: toStrArray,
    raceStep: raceStep,
    raceStandings: raceStandings,
    tugStep: tugStep,
    tugWinner: tugWinner,
    tugStandings: tugStandings,
    relayStart: relayStart,
    relayAdvance: relayAdvance,
    relayPoints: relayPoints,
    relayNextPointers: relayNextPointers,
    relayStandings: relayStandings,
    betAmount: betAmount,
    applyWager: applyWager
  };

  if (typeof window !== 'undefined') window.TTMModes = TTMModes;
  if (root) root.TTMModes = TTMModes;
  if (typeof module !== 'undefined' && module.exports) module.exports = TTMModes;
})(typeof window !== 'undefined' ? window : this);
