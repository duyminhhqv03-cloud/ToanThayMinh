/* Chế độ "Xem thử" Đấu cả lớp cho giáo viên – Toán Thầy Minh
 * Database ảo trong bộ nhớ (mô phỏng Firebase compat) và giao diện xem thử 2 màn hình.
 * Thuần ES5 (chỉ var, function).
 */
(function () {
  'use strict';

  var SERVER_TS = { '.sv': 'timestamp' };

  var BOT_PROFILES = [
    { name: 'An', username: 'bot-an', skill: 0.85 },
    { name: 'Bình', username: 'bot-binh', skill: 0.75 },
    { name: 'Chi', username: 'bot-chi', skill: 0.70 },
    { name: 'Dũng', username: 'bot-dung', skill: 0.65 },
    { name: 'Hà', username: 'bot-ha', skill: 0.60 },
    { name: 'Khôi', username: 'bot-khoi', skill: 0.55 },
    { name: 'Lan', username: 'bot-lan', skill: 0.80 },
    { name: 'Minh', username: 'bot-minh', skill: 0.65 },
    { name: 'Nam', username: 'bot-nam', skill: 0.50 },
    { name: 'Thảo', username: 'bot-thao', skill: 0.70 }
  ];

  function isDemo() {
    try {
      if (typeof window === 'undefined') return false;
      if (window.parent === window || !window.parent || !window.parent.__ttmDemoDb) return false;
      var search = window.location.search || '';
      return /[?&]demo=(host|hs)\b/.test(search);
    } catch (e) {
      return false;
    }
  }

  function demoRole() {
    try {
      if (!isDemo()) return '';
      var m = (window.location.search || '').match(/[?&]demo=(host|hs)\b/);
      return m ? m[1] : '';
    } catch (e) {
      return '';
    }
  }

  function initDemoFrame() {
    if (typeof document === 'undefined') return;
    if (isDemo()) {
      var addCls = function () {
        if (document.body && document.body.className.indexOf('demo-frame') < 0) {
          document.body.className = (document.body.className ? document.body.className + ' ' : '') + 'demo-frame';
        }
      };
      if (document.body) {
        addCls();
      } else {
        document.addEventListener('DOMContentLoaded', addCls);
      }
    }
  }
  initDemoFrame();

  function splitPath(p) {
    if (p == null) return [];
    var str = String(p);
    var rawParts = str.split('/');
    var parts = [];
    for (var i = 0; i < rawParts.length; i++) {
      var seg = rawParts[i].replace(/^\s+|\s+$/g, '');
      if (seg) parts.push(seg);
    }
    return parts;
  }

  function pathOverlaps(a, b) {
    var minLen = Math.min(a.length, b.length);
    for (var i = 0; i < minLen; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function firebaseKeySort(keys) {
    return keys.slice().sort(function (a, b) {
      var isIntA = /^(0|[1-9]\d*)$/.test(a);
      var isIntB = /^(0|[1-9]\d*)$/.test(b);
      if (isIntA && isIntB) return Number(a) - Number(b);
      if (isIntA && !isIntB) return -1;
      if (!isIntA && isIntB) return 1;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }

  function processWriteValue(val, now) {
    if (val === undefined || val === null) return null;
    if (typeof val !== 'object') return val;
    if (val['.sv'] === 'timestamp') return now;

    if (Array.isArray(val)) {
      var arrObj = {};
      for (var i = 0; i < val.length; i++) {
        var item = processWriteValue(val[i], now);
        if (item !== null && item !== undefined) {
          arrObj[String(i)] = item;
        }
      }
      return Object.keys(arrObj).length === 0 ? null : arrObj;
    }

    var res = {};
    var keys = Object.keys(val);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var v = processWriteValue(val[key], now);
      if (v !== null && v !== undefined) {
        res[key] = v;
      }
    }
    return Object.keys(res).length === 0 ? null : res;
  }

  function toVal(node) {
    if (node === undefined || node === null) return null;
    if (typeof node !== 'object') return node;
    var keys = Object.keys(node);
    if (keys.length === 0) return null;

    var isArrayLike = true;
    var maxIndex = -1;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!/^(0|[1-9]\d*)$/.test(k)) {
        isArrayLike = false;
        break;
      }
      var num = parseInt(k, 10);
      if (num > maxIndex) maxIndex = num;
    }

    if (isArrayLike && maxIndex >= 0 && keys.length >= (maxIndex + 1) / 2) {
      var arr = [];
      for (var j = 0; j <= maxIndex; j++) {
        arr.push(Object.prototype.hasOwnProperty.call(node, String(j)) ? toVal(node[String(j)]) : null);
      }
      return arr;
    }

    var obj = {};
    for (var m = 0; m < keys.length; m++) {
      var prop = keys[m];
      obj[prop] = toVal(node[prop]);
    }
    return obj;
  }

  function createDb() {
    var root = {};
    var listeners = [];

    function getNode(pathParts) {
      if (pathParts.length > 0 && pathParts[0] === '.info') {
        if (pathParts[1] === 'serverTimeOffset') return 0;
        if (pathParts[1] === 'connected') return true;
        return { serverTimeOffset: 0, connected: true };
      }
      var curr = root;
      for (var i = 0; i < pathParts.length; i++) {
        if (curr == null || typeof curr !== 'object') return undefined;
        curr = curr[pathParts[i]];
      }
      return curr;
    }

    function deleteAt(pathParts) {
      if (!pathParts || pathParts.length === 0) {
        root = {};
        return;
      }
      var stack = [];
      var curr = root;
      for (var i = 0; i < pathParts.length; i++) {
        if (curr == null || typeof curr !== 'object') return;
        stack.push({ parent: curr, key: pathParts[i] });
        curr = curr[pathParts[i]];
      }
      for (var j = stack.length - 1; j >= 0; j--) {
        var frame = stack[j];
        delete frame.parent[frame.key];
        if (frame.parent === root) break;
        if (Object.keys(frame.parent).length > 0) break;
      }
    }

    function setAt(pathParts, val) {
      var now = Date.now();
      var processed = processWriteValue(val, now);
      if (processed === null || processed === undefined || (typeof processed === 'object' && Object.keys(processed).length === 0)) {
        deleteAt(pathParts);
        return;
      }
      if (pathParts.length === 0) {
        root = processed;
        return;
      }
      var curr = root;
      for (var i = 0; i < pathParts.length - 1; i++) {
        var part = pathParts[i];
        if (curr[part] == null || typeof curr[part] !== 'object') {
          curr[part] = {};
        }
        curr = curr[part];
      }
      curr[pathParts[pathParts.length - 1]] = processed;
    }

    function notifyListeners(affectedPaths) {
      var list = listeners.slice();
      for (var i = 0; i < list.length; i++) {
        var l = list[i];
        if (!l.active) continue;
        var overlaps = false;
        for (var j = 0; j < affectedPaths.length; j++) {
          if (pathOverlaps(l.pathParts, affectedPaths[j])) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) {
          var currentVal = toVal(getNode(l.pathParts));
          var currentJson = JSON.stringify(currentVal);
          if (currentJson !== l.lastJson) {
            l.lastJson = currentJson;
            l.initialDelivered = true;
            try {
              l.cb(createSnapshot(l.pathParts, currentVal));
            } catch (err) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('Lỗi listener trong DB ảo:', err);
              }
            }
          }
        }
      }
    }

    function createSnapshot(pathParts, val) {
      return {
        key: pathParts.length > 0 ? pathParts[pathParts.length - 1] : null,
        val: function () {
          return toVal(val);
        },
        exists: function () {
          return val !== null && val !== undefined;
        },
        child: function (childPath) {
          var subParts = splitPath(childPath);
          var targetParts = pathParts.concat(subParts);
          var subVal = toVal(getNode(targetParts));
          return createSnapshot(targetParts, subVal);
        },
        hasChild: function (childPath) {
          var subParts = splitPath(childPath);
          var targetParts = pathParts.concat(subParts);
          var subVal = getNode(targetParts);
          return subVal !== undefined && subVal !== null;
        },
        numChildren: function () {
          if (val === null || val === undefined || typeof val !== 'object') return 0;
          return Object.keys(val).length;
        },
        forEach: function (fn) {
          if (val === null || val === undefined || typeof val !== 'object') return false;
          var keys = Object.keys(val);
          var sortedKeys = firebaseKeySort(keys);
          for (var i = 0; i < sortedKeys.length; i++) {
            var k = sortedKeys[i];
            var childParts = pathParts.concat([k]);
            var childSnap = createSnapshot(childParts, val[k]);
            if (fn(childSnap) === true) return true;
          }
          return false;
        }
      };
    }

    function createRef(pathParts) {
      var pathStr = pathParts.join('/');
      return {
        key: pathParts.length > 0 ? pathParts[pathParts.length - 1] : null,
        child: function (subPath) {
          return createRef(pathParts.concat(splitPath(subPath)));
        },
        set: function (val) {
          setAt(pathParts, val);
          notifyListeners([pathParts]);
          return Promise.resolve();
        },
        update: function (obj) {
          if (!obj || typeof obj !== 'object') return Promise.resolve();
          var keys = Object.keys(obj);
          var affected = [];
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var target = pathParts.concat(splitPath(k));
            var v = obj[k];
            if (v === null || v === undefined) {
              deleteAt(target);
            } else {
              setAt(target, v);
            }
            affected.push(target);
          }
          notifyListeners(affected);
          return Promise.resolve();
        },
        remove: function () {
          deleteAt(pathParts);
          notifyListeners([pathParts]);
          return Promise.resolve();
        },
        once: function (eventType, successCb, failureCb) {
          var val = toVal(getNode(pathParts));
          var snap = createSnapshot(pathParts, val);
          if (typeof successCb === 'function') {
            try { successCb(snap); } catch (e) { if (failureCb) failureCb(e); }
          }
          return Promise.resolve(snap);
        },
        on: function (eventType, cb) {
          if (eventType !== 'value') return cb;
          var listener = {
            pathParts: pathParts.slice(),
            pathStr: pathStr,
            eventType: eventType,
            cb: cb,
            active: true,
            lastJson: undefined,
            initialDelivered: false
          };
          listeners.push(listener);

          setTimeout(function () {
            if (!listener.active) return;
            if (listener.initialDelivered) return;
            listener.initialDelivered = true;
            var currentVal = toVal(getNode(listener.pathParts));
            listener.lastJson = JSON.stringify(currentVal);
            try {
              cb(createSnapshot(listener.pathParts, currentVal));
            } catch (err) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('Lỗi listener ban đầu trong DB ảo:', err);
              }
            }
          }, 0);

          return cb;
        },
        off: function (eventType, cb) {
          for (var i = listeners.length - 1; i >= 0; i--) {
            var l = listeners[i];
            if (l.pathStr === pathStr) {
              if (!eventType || l.eventType === eventType) {
                if (!cb || l.cb === cb) {
                  l.active = false;
                  listeners.splice(i, 1);
                }
              }
            }
          }
        },
        onDisconnect: function () {
          return {
            set: function () { return Promise.resolve(); },
            update: function () { return Promise.resolve(); },
            remove: function () { return Promise.resolve(); },
            cancel: function () { return Promise.resolve(); }
          };
        },
        transaction: function (updateFn) {
          var current = toVal(getNode(pathParts));
          var newVal = updateFn(current);
          if (newVal === undefined) {
            return Promise.resolve({ committed: false, snapshot: createSnapshot(pathParts, current) });
          }
          setAt(pathParts, newVal);
          notifyListeners([pathParts]);
          return Promise.resolve({ committed: true, snapshot: createSnapshot(pathParts, toVal(getNode(pathParts))) });
        }
      };
    }

    return {
      ref: function (p) {
        return createRef(splitPath(p));
      }
    };
  }

  /* ═══════════════════ Giao diện Xem thử (Parent Page) ═══════════════════ */

  function renderDemo(quizId) {
    var T = window.TTM;
    var h = T.h;
    var seq = T.getSeq();
    var backHref = '#/dau';

    T.fill(T.app, T.loading('Đang chuẩn bị màn hình xem thử…'));

    T.api('quiz', { id: quizId }).then(function (d) {
      if (!T.isCurrent(seq)) return;
      if (!d.canEdit) {
        T.fill(T.app,
          h('a', { href: backHref, class: 'back' }, '← Quay lại'),
          T.errorBox('Bạn không có quyền tổ chức đấu cả lớp cho bài luyện tập này.'));
        return;
      }

      var fullQuestions = (d.fullQuestions || []).filter(function (q) {
        return q && (q.type === 'mc' || q.type === 'short' || q.type === 'fill');
      });
      if (!fullQuestions.length) {
        T.fill(T.app,
          h('a', { href: backHref, class: 'back' }, '← Quay lại'),
          T.errorBox('Đề này không có câu hỏi trắc nghiệm, trả lời ngắn hoặc điền khuyết nào để đấu cả lớp.'));
        return;
      }

      var quiz = d.quiz || {};
      var demoDb = createDb();
      window.__ttmDemoDb = demoDb;

      var botCount = 6;
      var currentPin = null;
      var activeBotTimers = [];
      var offRoomsListener = null;
      var offStateListener = null;
      var lastHandledRound = '';
      var relayPending = {};

      function clearBotTimers() {
        while (activeBotTimers.length) {
          clearTimeout(activeBotTimers.pop());
        }
      }

      function stopBots() {
        clearBotTimers();
        if (offStateListener) {
          try { offStateListener(); } catch (e) {}
          offStateListener = null;
        }
      }

      function cleanupAll() {
        stopBots();
        if (offRoomsListener) {
          try { offRoomsListener(); } catch (e) {}
          offRoomsListener = null;
        }
      }

      T.setLeaveGuard(function () { return false; }, '', cleanupAll);

      var botSelect = h('select', {
        class: 'demo-bot-select-control',
        onchange: function () {
          botCount = parseInt(botSelect.value, 10);
          if (isNaN(botCount)) botCount = 6;
          if (currentPin) {
            syncBotsInLobby(currentPin);
          }
        }
      },
        h('option', { value: '0' }, '0 bạn ảo'),
        h('option', { value: '3' }, '3 bạn ảo'),
        h('option', { value: '6', selected: true }, '6 bạn ảo (mặc định)'),
        h('option', { value: '10' }, '10 bạn ảo')
      );

      var restartBtn = h('button', {
        type: 'button',
        class: 'btn btn-ghost btn-sm demo-restart-btn',
        onclick: function () {
          resetDemo();
        }
      }, '↺ Chơi lại từ đầu');

      var noteBanner = h('div', { class: 'demo-note panel' },
        'Chế độ xem thử: dữ liệu chỉ nằm trong trình duyệt này, không tạo phòng thật, không lưu kết quả.'
      );

      var hostIframe = h('iframe', {
        class: 'demo-host-frame',
        src: 'index.html?demo=host#/dau-host/' + encodeURIComponent(quizId),
        title: 'Màn hình chiếu của thầy cô'
      });

      var phonePlaceholder = h('div', { class: 'demo-phone-placeholder' },
        h('div', { class: 'demo-phone-placeholder-icon' }, '📱'),
        h('h4', null, 'Điện thoại học sinh'),
        h('p', { class: 'muted small' }, 'Bấm "Mở phòng đấu" ở màn hình chiếu bên cạnh để bắt đầu…'),
        h('p', { class: 'muted small' }, 'Khi phòng được tạo, khung này sẽ tự động tham gia đấu với tên "Bạn (xem thử)".')
      );

      var phoneIframe = h('iframe', {
        class: 'demo-phone-frame',
        style: 'display:none',
        src: 'about:blank',
        title: 'Điện thoại học sinh'
      });

      var phoneBox = h('div', { class: 'demo-phone' },
        h('div', { class: 'demo-phone-notch' }),
        phonePlaceholder,
        phoneIframe
      );

      var layout = h('div', { class: 'demo-wrap' },
        h('div', { class: 'demo-topbar' },
          h('div', { class: 'demo-topbar-left' },
            h('a', { href: '#/dau', class: 'btn btn-ghost btn-sm demo-back-btn' }, '← Về danh sách bài đấu'),
            h('h2', { class: 'demo-title' }, '👀 Xem thử: ' + (quiz.title || 'Đấu cả lớp'))
          ),
          h('div', { class: 'demo-topbar-right' },
            h('label', { class: 'demo-bot-label' },
              h('span', null, 'Số bạn ảo: '),
              botSelect
            ),
            restartBtn
          )
        ),
        noteBanner,
        h('div', { class: 'demo-body' },
          h('div', { class: 'demo-host-col' },
            h('h3', { class: 'demo-col-heading' }, '🖥️ Màn hình chiếu của thầy cô'),
            h('div', { class: 'demo-host-box' }, hostIframe)
          ),
          h('div', { class: 'demo-phone-col' },
            h('h3', { class: 'demo-col-heading' }, '📱 Điện thoại học sinh'),
            phoneBox
          )
        )
      );

      T.fill(T.app, layout);

      function syncBotsInLobby(pin) {
        if (!pin || !demoDb) return;
        demoDb.ref('rooms/' + pin + '/state').once('value').then(function (sSnap) {
          var st = sSnap.val() || {};
          if (st.phase !== 'lobby') return;
          for (var i = 0; i < BOT_PROFILES.length; i++) {
            var botUid = 'bot-' + (i + 1);
            var b = BOT_PROFILES[i];
            if (i < botCount) {
              demoDb.ref('rooms/' + pin + '/players/' + botUid).set({
                name: b.name,
                username: b.username,
                joinedAt: SERVER_TS
              });
            } else {
              demoDb.ref('rooms/' + pin + '/players/' + botUid).remove();
            }
          }
        });
      }

      function submitNormalBotAnswer(pin, botUid, b, qIdx, qKey) {
        demoDb.ref('rooms/' + pin + '/question').once('value').then(function (qSnap) {
          var qPayload = qSnap.val();
          var matchingQ = null;
          if (qPayload && qPayload.text) {
            for (var i = 0; i < fullQuestions.length; i++) {
              if (fullQuestions[i].text === qPayload.text) {
                matchingQ = fullQuestions[i];
                break;
              }
            }
          }
          if (!matchingQ && fullQuestions.length) {
            matchingQ = fullQuestions[qIdx] || fullQuestions[0];
          }
          if (!matchingQ) return;

          var isRight = Math.random() < b.skill;
          var ansVal;
          if (matchingQ.type === 'mc') {
            var correctIdx = Number(matchingQ.correct);
            if (isRight) {
              ansVal = correctIdx;
            } else {
              var total = (matchingQ.options && matchingQ.options.length) || 4;
              ansVal = (correctIdx + 1 + Math.floor(Math.random() * (total - 1))) % total;
            }
          } else if (matchingQ.type === 'fill') {
            var blanks = matchingQ.answers || [];
            var parts = [];
            for (var bi = 0; bi < blanks.length; bi++) {
              var bAns = blanks[bi];
              var blankRight = isRight || Math.random() < b.skill * 0.6;
              parts.push(blankRight ? (Array.isArray(bAns) ? bAns[0] : String(bAns || '')) : '0');
            }
            ansVal = parts.join('\u241F');
          } else {
            var ansList = matchingQ.answers || [];
            ansVal = isRight ? String(ansList[0] || '') : '0';
          }

          demoDb.ref('rooms/' + pin + '/answers/' + qKey + '/' + botUid).set({
            a: ansVal,
            t: SERVER_TS
          });
        });
      }

      function scheduleBotAnswers(pin, st, qIdx, qKey) {
        var gType = st.gameType || 'classic';
        var isBetStep = (gType === 'wager' && (st.sub === 'bet' || qKey.charAt(0) === 'b'));
        var duration = Number(st.duration || (isBetStep ? 10 : 20));
        var startedAt = Number(st.startedAt || Date.now());

        for (var i = 0; i < botCount; i++) {
          (function (botIndex) {
            var b = BOT_PROFILES[botIndex];
            var botUid = 'bot-' + (botIndex + 1);
            var pct = 0.2 + Math.random() * 0.6;
            var delayMs = Math.round(duration * 1000 * pct);
            var elapsed = Date.now() - startedAt;
            var waitMs = Math.max(200, delayMs - elapsed);

            var tid = setTimeout(function () {
              if (!T.isCurrent(seq) || pin !== currentPin) return;
              if (isBetStep) {
                var betLvl = Math.floor(Math.random() * 5);
                demoDb.ref('rooms/' + pin + '/answers/' + qKey + '/' + botUid).set({
                  a: betLvl,
                  t: SERVER_TS
                });
              } else {
                submitNormalBotAnswer(pin, botUid, b, qIdx, qKey);
              }
            }, waitMs);
            activeBotTimers.push(tid);
          })(i);
        }
      }

      function handleRelayBots(pin, st, qIdx) {
        var relay = st.relay;
        if (!relay) return;
        for (var t = 0; t < 3; t++) {
          var slot = relay[String(t)] || relay[t];
          if (slot && !slot.done && slot.uid && slot.uid.indexOf('bot-') === 0) {
            var botUid = slot.uid;
            var bIdx = parseInt(botUid.replace('bot-', ''), 10) - 1;
            var b = BOT_PROFILES[bIdx];
            var pendKey = pin + '_' + qIdx + '_' + botUid;
            if (b && !relayPending[pendKey]) {
              relayPending[pendKey] = true;
              (function (targetUid, profile) {
                var waitMs = 1500 + Math.random() * 2000;
                var tid = setTimeout(function () {
                  if (!T.isCurrent(seq) || pin !== currentPin) return;
                  submitNormalBotAnswer(pin, targetUid, profile, qIdx, String(qIdx));
                }, waitMs);
                activeBotTimers.push(tid);
              })(botUid, b);
            }
          }
        }
      }

      function watchRoomState(pin) {
        if (offStateListener) offStateListener();
        var stRef = demoDb.ref('rooms/' + pin + '/state');
        var stCb = stRef.on('value', function (snap) {
          if (!T.isCurrent(seq) || pin !== currentPin) return;
          var st = snap.val();
          if (!st) return;

          if (st.mode === 'review') {
            // Chế độ ôn từ vựng: bot không tham gia
            return;
          }

          if (st.phase === 'lobby') {
            lastHandledRound = '';
            clearBotTimers();
            syncBotsInLobby(pin);
            return;
          }

          if (st.phase === 'question') {
            var qIdx = Number(st.index);
            var qKey = String(st.qkey !== undefined && st.qkey !== null ? st.qkey : qIdx);
            var roundKey = qKey + '_' + (st.sub || '');
            var gType = st.gameType || 'classic';

            if (gType === 'relay') {
              handleRelayBots(pin, st, qIdx);
              return;
            }

            if (roundKey !== lastHandledRound) {
              lastHandledRound = roundKey;
              clearBotTimers();
              scheduleBotAnswers(pin, st, qIdx, qKey);
            }
          } else {
            clearBotTimers();
          }
        });
        offStateListener = function () { stRef.off('value', stCb); };
      }

      function watchRooms() {
        if (offRoomsListener) offRoomsListener();
        var roomsRef = demoDb.ref('rooms');
        var roomsCb = roomsRef.on('value', function (snap) {
          if (!T.isCurrent(seq)) return;
          var roomsVal = snap.val();
          if (!roomsVal || Object.keys(roomsVal).length === 0) {
            currentPin = null;
            stopBots();
            phoneIframe.style.display = 'none';
            phoneIframe.src = 'about:blank';
            phonePlaceholder.style.display = 'flex';
            return;
          }
          var pinKeys = Object.keys(roomsVal);
          var pin = pinKeys[pinKeys.length - 1];
          if (pin !== currentPin) {
            currentPin = pin;
            lastHandledRound = '';
            phonePlaceholder.style.display = 'none';
            phoneIframe.style.display = 'block';
            phoneIframe.src = 'index.html?demo=hs&r=' + Date.now() + '#/dau/' + encodeURIComponent(pin);
            syncBotsInLobby(pin);
            watchRoomState(pin);
          }
        });
        offRoomsListener = function () { roomsRef.off('value', roomsCb); };
      }

      function resetDemo() {
        clearBotTimers();
        stopBots();
        currentPin = null;
        lastHandledRound = '';
        relayPending = {};
        if (offRoomsListener) { try { offRoomsListener(); } catch (e) {} offRoomsListener = null; }
        demoDb = createDb();
        window.__ttmDemoDb = demoDb;
        hostIframe.src = 'index.html?demo=host&r=' + Date.now() + '#/dau-host/' + encodeURIComponent(quizId);
        phoneIframe.src = 'about:blank';
        phoneIframe.style.display = 'none';
        phonePlaceholder.style.display = 'flex';
        watchRooms();
      }

      watchRooms();
    }).catch(function (err) {
      if (!T.isCurrent(seq)) return;
      T.fill(T.app,
        h('a', { href: backHref, class: 'back' }, '← Quay lại'),
        T.errorBox(err.message || 'Không tải được dữ liệu bài đấu.', function () { renderDemo(quizId); }));
    });
  }

  var exported = {
    createDb: createDb,
    isDemo: isDemo,
    demoRole: demoRole,
    renderDemo: renderDemo,
    SERVER_TS: SERVER_TS
  };

  if (typeof window !== 'undefined') {
    window.TTMDemo = exported;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})();
