/* Giao diện, bàn phím ảo, thực đơn và nhật ký phím cho Máy tính Thầy Minh (ES5 thuần — Máy 880 & Máy 580) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcEditor = root.CalcEditor;
  var CalcApps = root.CalcApps;
  var CalcMachines = root.CalcMachines || {};

  var STORAGE_KEY = 'ttm_may_tinh_state_v3';

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripHtmlTags(s) {
    return String(s || '').replace(/<[^>]*>/g, '');
  }

  function parseQueryParams() {
    var out = {};
    var q = window.location ? window.location.search : '';
    if (!q || q.charAt(0) !== '?') return out;
    var pairs = q.slice(1).split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (kv[0]) {
        out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      }
    }
    return out;
  }

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function createDefaultSettings(mId) {
    return {
      angle: 'deg', // 'deg' | 'rad' | 'gra'
      fmtMode: 'norm1', // 'norm1' | 'norm2' | 'fix' | 'sci'
      fmtDigits: 2,
      ioMode: 'math', // 'math' | 'math_dec' | 'line' | 'line_dec'
      fracMode: 'improper', // 'improper' (d/c) | 'mixed' (a b/c)
      tableTwoFuncs: true,
      statFreq: false,
      complexForm: 'rect', // 'rect' (a+bi) | 'polar' (r∠θ)
      eqComplexRoots: true,
      engSymbol: false,
      decimalMark: 'dot', // 'dot' | 'comma'
      digitSep: false,
      autoPowerOff: '10',
      contrast: 3,
      fontSize: 'norm', // 'norm' | 'small' (trên 880: Normal / Small)
      largeFont: false,
      modelType: mId === '580' ? 'a' : 'b'
    };
  }

  function createDefaultVars() {
    return {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0,
      x: 0, y: 0, z: 0, M: 0, Ans: 0, PreAns: 0
    };
  }

  // Trạng thái toàn cục của ứng dụng máy tính
  var AppContext = {
    machineId: '880', // '880' | '580'
    currentAppId: 'calc',
    overlay: null,
    // Các giá trị overlay:
    // null | 'home' | 'menu' | 'tree' | 'paged' | 'format' | 'vars880' | 'var880_act' | 'var880_edit' |
    // 'func_def' | 'periodic_table' | 'recall580' | 'digit_prompt' | 'confirm_msg' | 'qr_msg' | 'off'
    menuIdx: 0,
    treeStack: [], // [{ title, items, idx }] cho SETTINGS, CATALOG, TOOLS, CONST, CONV...
    pagedMenu: null, // { title, pages, pageIdx, itemIdx, kind } cho SETUP và OPTN trên 580
    formatItems: [],
    formatIdx: 0,
    varIdx: 0,
    varActIdx: 0,
    varEditStr: '',
    funcDefTarget: 'f', // 'f' | 'g'
    funcDefEditor: null,
    ptElementZ: 1, // Nguyên tố đang chọn trên bảng tuần hoàn (1..118)
    digitPromptKind: null, // 'fix' | 'sci' | 'norm'
    confirmMsg: null, // { title, sub, onYes }
    verifyMode: false, // Chế độ Verify ON trên máy 880
    shiftActive: false,
    alphaActive: false,
    statusHint: '',
    keyLog: [],
    keepKeyLog: false,
    showKeyLog: true,
    settings: createDefaultSettings('880'),
    vars: createDefaultVars(),
    perMachineStore: {
      '880': {
        settings: createDefaultSettings('880'),
        vars: createDefaultVars(),
        definedFuncs: { f: 'x²', g: '' }
      },
      '580': {
        settings: createDefaultSettings('580'),
        vars: createDefaultVars()
      }
    },

    getFormatOpts: function () {
      return {
        mode: this.settings.fmtMode,
        digits: this.settings.fmtDigits,
        decimalMark: this.settings.decimalMark,
        digitSep: this.settings.digitSep,
        engSymbol: this.settings.engSymbol
      };
    },

    getEvalOpts: function () {
      return {
        angle: this.settings.angle,
        vars: this.vars,
        funcs: CalcEngine.definedFuncs,
        fix: this.settings.fmtMode === 'fix' ? this.settings.fmtDigits : null,
        format: this.getFormatOpts()
      };
    },

    setStatusHint: function (msg) {
      this.statusHint = msg || '';
    },

    openMenu: function () {
      var apps = CalcApps.getVisibleApps(this.machineId);
      this.overlay = (this.machineId === '880') ? 'home' : 'menu';
      this.menuIdx = 0;
      for (var i = 0; i < apps.length; i++) {
        if (apps[i].id === this.currentAppId) {
          this.menuIdx = i;
          break;
        }
      }
      renderAll();
    },

    switchApp: function (appId) {
      var app = CalcApps.byId[appId];
      if (!app) return;
      this.currentAppId = appId;
      this.overlay = null;
      this.shiftActive = false;
      this.alphaActive = false;
      this.verifyMode = false;
      app.init(this);
      renderAll();
    },

    switchMachine: function (newMachineId) {
      var target = (newMachineId === '580' || newMachineId === 'a') ? '580' : '880';
      // Lưu cài đặt và biến của máy hiện tại vào kho riêng
      this.perMachineStore[this.machineId] = {
        settings: JSON.parse(JSON.stringify(this.settings)),
        vars: JSON.parse(JSON.stringify(this.vars)),
        definedFuncs: CalcEngine.definedFuncs ? JSON.parse(JSON.stringify(CalcEngine.definedFuncs)) : { f: '', g: '' }
      };

      this.machineId = target;
      var slot = this.perMachineStore[target] || {
        settings: createDefaultSettings(target),
        vars: createDefaultVars(),
        definedFuncs: { f: '', g: '' }
      };
      this.settings = slot.settings;
      this.settings.modelType = (target === '580') ? 'a' : 'b';
      this.vars = slot.vars;
      if (slot.definedFuncs && CalcEngine.definedFuncs) {
        CalcEngine.definedFuncs.f = slot.definedFuncs.f || '';
        CalcEngine.definedFuncs.g = slot.definedFuncs.g || '';
      }

      // Kiểm tra xem ứng dụng hiện tại có tồn tại trên máy mới không
      var visible = CalcApps.getVisibleApps(target);
      var found = false;
      for (var i = 0; i < visible.length; i++) {
        if (visible[i].id === this.currentAppId) {
          found = true;
          break;
        }
      }
      if (!found) {
        this.currentAppId = 'calc';
      }

      this.overlay = null;
      this.shiftActive = false;
      this.alphaActive = false;
      this.verifyMode = false;
      this.keyLog = [];

      this.saveState();
      updateBrandAndSwitcherDOM();
      buildKeypadDOM();
      var curApp = CalcApps.byId[this.currentAppId] || CalcApps.byId.calc;
      curApp.init(this);
      renderAll();
      renderKeyLog();
      updateScale();
    },

    onNewExpressionAfterEqual: function () {},

    saveState: function () {
      try {
        this.perMachineStore[this.machineId] = {
          settings: this.settings,
          vars: this.vars,
          definedFuncs: CalcEngine.definedFuncs || { f: '', g: '' }
        };
        if (window.localStorage) {
          var data = JSON.stringify({
            activeMachine: this.machineId,
            perMachineStore: this.perMachineStore
          });
          window.localStorage.setItem(STORAGE_KEY, data);
        }
      } catch (e) {}
    },

    loadState: function () {
      try {
        if (window.localStorage) {
          var raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed.perMachineStore) {
              if (parsed.perMachineStore['880']) {
                this.mergeMachineSlot('880', parsed.perMachineStore['880']);
              }
              if (parsed.perMachineStore['580']) {
                this.mergeMachineSlot('580', parsed.perMachineStore['580']);
              }
            }
            if (parsed.activeMachine === '880' || parsed.activeMachine === '580') {
              this.machineId = parsed.activeMachine;
            }
          }
        }
      } catch (e) {}
      var activeSlot = this.perMachineStore[this.machineId];
      this.settings = activeSlot.settings;
      this.vars = activeSlot.vars;
      if (activeSlot.definedFuncs && CalcEngine.definedFuncs) {
        CalcEngine.definedFuncs.f = activeSlot.definedFuncs.f || '';
        CalcEngine.definedFuncs.g = activeSlot.definedFuncs.g || '';
      }
    },

    mergeMachineSlot: function (mId, src) {
      var dst = this.perMachineStore[mId];
      if (src.settings) {
        for (var k in src.settings) {
          if (Object.prototype.hasOwnProperty.call(src.settings, k)) {
            dst.settings[k] = src.settings[k];
          }
        }
      }
      if (src.vars) {
        for (var vk in src.vars) {
          if (Object.prototype.hasOwnProperty.call(src.vars, vk) && typeof src.vars[vk] === 'number') {
            dst.vars[vk] = src.vars[vk];
          }
        }
      }
      if (src.definedFuncs) {
        dst.definedFuncs = {
          f: String(src.definedFuncs.f || ''),
          g: String(src.definedFuncs.g || '')
        };
      }
    },

    resetSetupData: function () {
      this.settings = createDefaultSettings(this.machineId);
      this.verifyMode = false;
      if (this.calcState) this.calcState.editor.lineMode = false;
      if (this.complexState) this.complexState.editor.lineMode = false;
      this.saveState();
    },

    resetVariableMemory: function () {
      this.vars = createDefaultVars();
      if (CalcEngine.definedFuncs) {
        CalcEngine.definedFuncs.f = '';
        CalcEngine.definedFuncs.g = '';
      }
      this.saveState();
    },

    resetInitializeAll: function () {
      this.resetSetupData();
      this.resetVariableMemory();
    },

    notifyParentResult: function (exprStr, valNum, dispStr) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            nguon: 'may-tinh-ttm',
            loai: 'ket-qua',
            bieuThuc: String(exprStr),
            giaTri: Number(valNum),
            hienThi: String(dispStr)
          }, '*');
        }
      } catch (e) {}
    }
  };

  function updateBrandAndSwitcherDOM() {
    var is880 = (AppContext.machineId === '880');
    var subEl = document.getElementById('brand-sub');
    if (subEl) {
      subEl.innerHTML = is880 ? 'Kiểu 880' : 'Kiểu 580';
    }
    var btn880 = document.getElementById('btn-switch-880');
    var btn580 = document.getElementById('btn-switch-580');
    if (btn880) btn880.className = 'machine-switch-btn' + (is880 ? ' active' : '');
    if (btn580) btn580.className = 'machine-switch-btn' + (!is880 ? ' active' : '');
  }

  // =========================================================================
  // NHẬT KÝ PHÍM BẤM (Keylog)
  // =========================================================================
  function recordKeyLog(label, modType, isStartingNewAfterEq, extraNote) {
    if (isStartingNewAfterEq && !AppContext.keepKeyLog) {
      AppContext.keyLog = [];
    }

    if (label === 'SHIFT' || label === 'ALPHA') {
      var m = label === 'SHIFT' ? 'shift' : 'alpha';
      var last = AppContext.keyLog.length > 0 ? AppContext.keyLog[AppContext.keyLog.length - 1] : null;
      if (last && last.pendingMod === m) {
        AppContext.keyLog.pop();
      } else if (last && last.pendingMod) {
        last.text = label;
        last.mod = m;
        last.pendingMod = m;
      } else {
        AppContext.keyLog.push({ text: label, mod: m, pendingMod: m });
      }
      renderKeyLog();
      return;
    }

    var displayTxt = label + (extraNote ? (' (' + extraNote + ')') : '');
    var prev = AppContext.keyLog.length > 0 ? AppContext.keyLog[AppContext.keyLog.length - 1] : null;
    if (prev && prev.pendingMod) {
      var prefix = prev.pendingMod === 'shift' ? 'SHIFT ' : 'ALPHA ';
      prev.text = prefix + displayTxt;
      prev.mod = prev.pendingMod;
      delete prev.pendingMod;
    } else {
      AppContext.keyLog.push({
        text: (modType === 'shift' ? 'SHIFT ' : (modType === 'alpha' ? 'ALPHA ' : '')) + displayTxt,
        mod: modType || ''
      });
    }

    if (AppContext.keyLog.length > 80) {
      AppContext.keyLog.shift();
    }
    renderKeyLog();
  }

  function renderKeyLog() {
    var wrap = document.getElementById('keylog-panel');
    var listEl = document.getElementById('keylog-list');
    if (!wrap || !listEl) return;

    wrap.style.display = AppContext.showKeyLog ? 'block' : 'none';
    if (!AppContext.showKeyLog) return;

    if (AppContext.keyLog.length === 0) {
      listEl.innerHTML = '<span class="keylog-empty">Chưa có phím bấm — hãy bấm phím trên máy tính...</span>';
      return;
    }

    var html = '';
    for (var i = 0; i < AppContext.keyLog.length; i++) {
      var item = AppContext.keyLog[i];
      var cls = 'key-pill';
      if (item.mod === 'shift') cls += ' pill-shift';
      else if (item.mod === 'alpha') cls += ' pill-alpha';
      html += '<span class="' + cls + '">' + escapeHtml(item.text) + '</span>';
    }
    listEl.innerHTML = html;
    listEl.scrollLeft = listEl.scrollWidth;
  }

  // =========================================================================
  // XÂY DỰNG BÀN PHÍM ẢO THEO HỒ SƠ MÁY (880 HOẶC 580)
  // =========================================================================
  var activeKeyLookup = {};

  function buildKeypadDOM() {
    var topEl = document.getElementById('calc-top-row');
    var sciEl = document.getElementById('calc-sci-grid');
    var numEl = document.getElementById('calc-num-grid');
    if (!topEl || !sciEl || !numEl) return;

    activeKeyLookup = {};
    if (AppContext.machineId === '880') {
      buildKeypad880(topEl, sciEl, numEl);
    } else {
      buildKeypad580(topEl, sciEl, numEl);
    }
  }

  function registerKeyObj(k) {
    if (k && k.id) {
      activeKeyLookup[k.id] = k;
    }
  }

  function buildKeypad880(topEl, sciEl, numEl) {
    var prof = CalcMachines['880'];
    if (!prof) return;
    var kp = prof.keypad;

    // 1. Khối điều hướng trên của Máy 880:
    // Hàng trên: [ON, HOME] + [SETTINGS, BACK] ở bên trái | D-Pad chữ thập (có OK) ở giữa | Phím cuộn trang dọc [⇑ / ⇓] bên phải
    // Hàng dưới: SHIFT, VARIABLE, FUNCTION | (dưới ▼ của D-Pad) | CATALOG, TOOLS
    var topLeft = kp.topLeftCluster;
    var navRow2 = kp.navRow2;
    for (var r = 0; r < topLeft.length; r++) {
      for (var c = 0; c < topLeft[r].length; c++) registerKeyObj(topLeft[r][c]);
    }
    registerKeyObj(kp.pageScroll.up);
    registerKeyObj(kp.pageScroll.down);
    for (var n = 0; n < navRow2.length; n++) registerKeyObj(navRow2[n]);

    var topHtml =
      '<div class="top880-wrap">' +
        '<div class="top880-upper">' +
          '<div class="top880-left-cluster">' +
            '<div class="top880-pair">' +
              renderKey880Top(topLeft[0][0]) +
              renderKey880Top(topLeft[0][1]) +
            '</div>' +
            '<div class="top880-pair">' +
              renderKey880Top(topLeft[1][0]) +
              renderKey880Top(topLeft[1][1]) +
            '</div>' +
          '</div>' +
          '<div class="dpad880-wrap">' +
            '<button type="button" class="dpad-btn dpad-up" data-dpad="UP" title="Lên">▲</button>' +
            '<button type="button" class="dpad-btn dpad-left" data-dpad="LEFT" title="Trái">◀</button>' +
            '<button type="button" class="dpad-btn dpad-ok" data-dpad="OK" title="OK">OK</button>' +
            '<button type="button" class="dpad-btn dpad-right" data-dpad="RIGHT" title="Phải">▶</button>' +
            '<button type="button" class="dpad-btn dpad-down" data-dpad="DOWN" title="Xuống">▼</button>' +
          '</div>' +
          '<div class="top880-right-cluster">' +
            '<div class="rocker880">' +
              '<button type="button" class="rocker880-btn rocker-up" data-key-id="PAGE_UP" title="Cuộn trang lên">' + kp.pageScroll.up.label + '</button>' +
              '<button type="button" class="rocker880-btn rocker-down" data-key-id="PAGE_DOWN" title="Cuộn trang xuống">' + kp.pageScroll.down.label + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="top880-lower">' +
          renderKey880Nav(navRow2[0]) +
          renderKey880Nav(navRow2[1]) +
          renderKey880Nav(navRow2[2]) +
          '<div class="top880-dpad-gap"></div>' +
          renderKey880Nav(navRow2[3]) +
          renderKey880Nav(navRow2[4]) +
        '</div>' +
      '</div>';
    topEl.innerHTML = topHtml;

    // 2. Lưới 12 phím hàm khoa học (2 hàng × 6 cột)
    var sciHtml = '';
    for (var sr = 0; sr < kp.sciRows.length; sr++) {
      var row = kp.sciRows[sr];
      for (var sc = 0; sc < row.length; sc++) {
        var sk = row[sc];
        registerKeyObj(sk);
        sciHtml +=
          '<div class="key-cell key-cell-880-sci">' +
            '<div class="key-sub-row"><span class="sub-shift-880">' + (sk.shiftLbl || '') + '</span></div>' +
            '<button type="button" class="calc-btn ' + (sk.cls || 'btn-880-sci') + '" data-key-id="' + sk.id + '">' + sk.label + '</button>' +
          '</div>';
      }
    }
    sciEl.innerHTML = sciHtml;

    // 3. Lưới 20 phím số và phép toán (4 hàng × 5 cột)
    var numHtml = '';
    for (var nr = 0; nr < kp.numRows.length; nr++) {
      var nRow = kp.numRows[nr];
      for (var nc = 0; nc < nRow.length; nc++) {
        var nk = nRow[nc];
        registerKeyObj(nk);
        var sCls = nk.isVarShift ? 'sub-shift-880 sub-var-880' : 'sub-shift-880';
        numHtml +=
          '<div class="key-cell key-cell-880-num">' +
            '<div class="key-sub-row"><span class="' + sCls + '">' + (nk.shiftLbl || '') + '</span></div>' +
            '<button type="button" class="calc-btn ' + (nk.cls || 'btn-880-num') + '" data-key-id="' + nk.id + '">' + nk.label + '</button>' +
          '</div>';
      }
    }
    numEl.innerHTML = numHtml;
  }

  function renderKey880Top(k) {
    return (
      '<div class="key-cell key-cell-880-top">' +
        '<div class="key-sub-row"><span class="sub-top-880">' + (k.topText || '') + '</span></div>' +
        '<button type="button" class="calc-btn ' + (k.cls || 'btn-880-ctrl') + '" data-key-id="' + k.id + '" title="' + escapeHtml(k.title || k.plainLbl) + '">' + k.label + '</button>' +
      '</div>'
    );
  }

  function renderKey880Nav(k) {
    var topCls = k.id === 'SHIFT' ? 'sub-shift-880' : 'sub-top-880';
    return (
      '<div class="key-cell key-cell-880-nav">' +
        '<div class="key-sub-row"><span class="' + topCls + '">' + (k.topText || '') + '</span></div>' +
        '<button type="button" class="calc-btn ' + (k.cls || 'btn-880-nav') + '" data-key-id="' + k.id + '" title="' + escapeHtml(k.title || k.plainLbl) + '">' + k.label + '</button>' +
      '</div>'
    );
  }

  function buildKeypad580(topEl, sciEl, numEl) {
    var prof = CalcMachines['580'];
    if (!prof) return;
    var kp = prof.keypad;

    var tRow = kp.topRow;
    var fRow = kp.flankRow;
    for (var i = 0; i < tRow.length; i++) registerKeyObj(tRow[i]);
    for (var j = 0; j < fRow.length; j++) registerKeyObj(fRow[j]);

    // Cụm trên của Máy 580:
    // Bên trái: Hàng 1 [SHIFT, ALPHA], Hàng 2 [OPTN, CALC]
    // Ở giữa: Cụm con trỏ bầu dục ▲ ▼ ◀ ▶ (KHÔNG có nút OK ở giữa)
    // Bên phải: Hàng 1 [MENU, ON], Hàng 2 [∫■, x]
    var topHtml =
      '<div class="top-side-col">' +
        '<div class="top-btn-pair">' +
          renderKey580Top(tRow[0]) +
          renderKey580Top(tRow[1]) +
        '</div>' +
        '<div class="top-btn-pair">' +
          renderKey580Sci(fRow[0]) +
          renderKey580Sci(fRow[1]) +
        '</div>' +
      '</div>' +
      '<div class="dpad-wrap dpad-580-oval">' +
        '<button type="button" class="dpad-btn dpad-up" data-dpad="UP" title="Lên">▲</button>' +
        '<button type="button" class="dpad-btn dpad-left" data-dpad="LEFT" title="Trái">◀</button>' +
        '<div class="dpad-580-center"></div>' +
        '<button type="button" class="dpad-btn dpad-right" data-dpad="RIGHT" title="Phải">▶</button>' +
        '<button type="button" class="dpad-btn dpad-down" data-dpad="DOWN" title="Xuống">▼</button>' +
      '</div>' +
      '<div class="top-side-col">' +
        '<div class="top-btn-pair">' +
          renderKey580Top(tRow[2]) +
          renderKey580Top(tRow[3]) +
        '</div>' +
        '<div class="top-btn-pair">' +
          renderKey580Sci(fRow[2]) +
          renderKey580Sci(fRow[3]) +
        '</div>' +
      '</div>';
    topEl.innerHTML = topHtml;

    // Lưới 18 phím hàm khoa học (3 hàng × 6 cột)
    var sciHtml = '';
    for (var sr = 0; sr < kp.sciRows.length; sr++) {
      var sRow = kp.sciRows[sr];
      for (var sc = 0; sc < sRow.length; sc++) {
        sciHtml += renderKey580Sci(sRow[sc]);
      }
    }
    sciEl.innerHTML = sciHtml;

    // Lưới 20 phím số và phép toán (4 hàng × 5 cột)
    var numHtml = '';
    for (var nr = 0; nr < kp.numRows.length; nr++) {
      var nRow = kp.numRows[nr];
      for (var nc = 0; nc < nRow.length; nc++) {
        var nk = nRow[nc];
        registerKeyObj(nk);
        numHtml +=
          '<div class="key-cell">' +
            '<div class="key-sub-row">' +
              '<span class="sub-shift">' + (nk.shiftLbl || '') + '</span>' +
              '<span class="sub-alpha">' + (nk.alphaLbl || '') + '</span>' +
            '</div>' +
            '<button type="button" class="calc-btn ' + (nk.cls || 'btn-580-num') + '" data-key-id="' + nk.id + '">' + nk.label + '</button>' +
          '</div>';
      }
    }
    numEl.innerHTML = numHtml;
  }

  function renderKey580Top(k) {
    var topSpan = '';
    if (k.topText) {
      var cls = k.id === 'SHIFT' ? 'sub-shift' : (k.id === 'ALPHA' ? 'sub-alpha' : 'sub-top-580');
      topSpan = '<span class="' + cls + '">' + k.topText + '</span>';
    } else if (k.shiftLbl) {
      topSpan = '<span class="sub-shift">' + k.shiftLbl + '</span>';
    }
    return (
      '<div class="key-cell">' +
        '<div class="key-sub-row">' + topSpan + '</div>' +
        '<button type="button" class="calc-btn ' + (k.cls || 'btn-580-metal') + '" data-key-id="' + k.id + '">' + k.label + '</button>' +
      '</div>'
    );
  }

  function renderKey580Sci(k) {
    registerKeyObj(k);
    var midSpan = '';
    if (k.baseLbl) midSpan = '<span class="sub-base">' + k.baseLbl + '</span>';
    else if (k.cplxLbl) midSpan = '<span class="sub-cplx">' + (k.shiftCplxLbl ? (k.shiftCplxLbl + '/' + k.cplxLbl) : k.cplxLbl) + '</span>';
    return (
      '<div class="key-cell">' +
        '<div class="key-sub-row">' +
          '<span class="sub-shift">' + (k.shiftLbl || '') + '</span>' +
          midSpan +
          '<span class="sub-alpha">' + (k.alphaLbl || '') + '</span>' +
        '</div>' +
        '<button type="button" class="calc-btn ' + (k.cls || 'btn-580-sci') + '" data-key-id="' + k.id + '">' + k.label + '</button>' +
      '</div>'
    );
  }

  // =========================================================================
  // VẼ MÀN HÌNH LCD, THANH TRẠNG THÁI VÀ CÁC THỰC ĐƠN (OVERLAYS)
  // =========================================================================
  function renderAll() {
    var shell = document.getElementById('calc-shell');
    if (shell) {
      var fontCls = (AppContext.settings.fontSize === 'small') ? ' font-small' : (AppContext.settings.largeFont ? ' font-large' : '');
      shell.className = 'calc-shell machine-' + AppContext.machineId + fontCls;
    }

    var statusEl = document.getElementById('lcd-status-bar');
    var bodyEl = document.getElementById('lcd-body');
    if (!statusEl || !bodyEl) return;

    renderStatusBar(statusEl);

    if (AppContext.overlay === 'off') {
      bodyEl.innerHTML =
        '<div class="lcd-off-screen">' +
          '<div class="lcd-off-title">Máy tính Thầy Minh</div>' +
          '<div class="lcd-off-sub">Đã tắt máy — Bấm ON để bật lại</div>' +
        '</div>';
      return;
    }

    if (AppContext.overlay === 'qr_msg') {
      bodyEl.innerHTML =
        '<div class="lcd-dev-box">' +
          '<div class="lcd-dev-title">QR Code</div>' +
          '<div class="lcd-dev-msg">Chức năng QR không có trên bản web</div>' +
          '<div class="lcd-dev-sub">Bấm BACK hoặc OK để quay lại</div>' +
        '</div>';
      return;
    }

    if (AppContext.overlay === 'confirm_msg' && AppContext.confirmMsg) {
      bodyEl.innerHTML =
        '<div class="lcd-dev-box">' +
          '<div class="lcd-dev-title">' + escapeHtml(AppContext.confirmMsg.title) + '</div>' +
          '<div class="lcd-dev-sub" style="margin-top:8px;font-weight:700;">' + escapeHtml(AppContext.confirmMsg.sub) + '</div>' +
        '</div>';
      return;
    }

    if (AppContext.overlay === 'digit_prompt') {
      var dpTitle = AppContext.digitPromptKind === 'fix'
        ? 'Fix: Select 0~9'
        : (AppContext.digitPromptKind === 'sci' ? 'Sci: Select 0~9 (0:10)' : 'Norm: Select 1~2');
      bodyEl.innerHTML =
        '<div class="lcd-dev-box">' +
          '<div class="lcd-dev-title">' + escapeHtml(dpTitle) + '</div>' +
          '<div class="lcd-dev-sub">Hãy bấm phím số tương ứng</div>' +
        '</div>';
      return;
    }

    if (AppContext.overlay === 'home') {
      bodyEl.innerHTML = renderHome880Overlay();
      return;
    }

    if (AppContext.overlay === 'menu') {
      bodyEl.innerHTML = renderMenu580Overlay();
      return;
    }

    if (AppContext.overlay === 'tree') {
      bodyEl.innerHTML = renderTreeOverlay();
      return;
    }

    if (AppContext.overlay === 'paged') {
      bodyEl.innerHTML = renderPagedOverlay();
      return;
    }

    if (AppContext.overlay === 'format') {
      bodyEl.innerHTML = renderFormatOverlay();
      return;
    }

    if (AppContext.overlay === 'vars880' || AppContext.overlay === 'var880_act' || AppContext.overlay === 'var880_edit') {
      bodyEl.innerHTML = renderVars880Overlay();
      return;
    }

    if (AppContext.overlay === 'func_def') {
      bodyEl.innerHTML = renderFuncDefOverlay();
      return;
    }

    if (AppContext.overlay === 'periodic_table') {
      bodyEl.innerHTML = renderPeriodicTableOverlay();
      return;
    }

    if (AppContext.overlay === 'recall580') {
      bodyEl.innerHTML = renderRecall580Overlay();
      return;
    }

    var curApp = CalcApps.byId[AppContext.currentAppId] || CalcApps.byId.calc;
    bodyEl.innerHTML = curApp.render(AppContext);
    if (curApp.afterRender) {
      curApp.afterRender(AppContext);
    }
  }

  function renderStatusBar(statusEl) {
    var angBadge = AppContext.settings.angle === 'rad' ? 'R' : (AppContext.settings.angle === 'gra' ? 'G' : 'D');
    var fmtBadge = '';
    if (AppContext.settings.fmtMode === 'fix') fmtBadge = 'FIX';
    else if (AppContext.settings.fmtMode === 'sci') fmtBadge = 'SCI';
    var mathBadge = (AppContext.settings.ioMode === 'math' || AppContext.settings.ioMode === 'math_dec') ? '√■' : '';
    var cplxBadge = '';
    if (AppContext.currentAppId === 'complex') {
      cplxBadge = AppContext.settings.complexForm === 'polar' ? '∠' : '<i>i</i>';
    }

    if (AppContext.machineId === '880') {
      statusEl.innerHTML =
        '<div class="st-left">' +
          '<span class="st-badge st-s ' + (AppContext.shiftActive ? 'on' : '') + '">⇧</span>' +
          '<span class="st-badge on">' + angBadge + '</span>' +
          (fmtBadge ? '<span class="st-badge on">' + fmtBadge + '</span>' : '') +
          (cplxBadge ? '<span class="st-badge on">' + cplxBadge + '</span>' : '') +
          (AppContext.verifyMode ? '<span class="st-badge st-verify on">✔</span>' : '') +
          (mathBadge ? '<span class="st-badge on">' + mathBadge + '</span>' : '') +
        '</div>' +
        '<div class="st-right">' +
          escapeHtml(AppContext.statusHint || '') +
          '<span class="st-battery" title="Pin">▮</span>' +
        '</div>';
    } else {
      var isSto = (AppContext.calcState && AppContext.calcState.promptMode === 'sto');
      var isRcl = (AppContext.overlay === 'recall580');
      var math580 = (AppContext.settings.ioMode === 'math' || AppContext.settings.ioMode === 'math_dec') ? 'Math' : '';
      statusEl.innerHTML =
        '<div class="st-left">' +
          '<span class="st-badge st-s ' + (AppContext.shiftActive ? 'on' : '') + '">S</span>' +
          '<span class="st-badge st-a ' + (AppContext.alphaActive ? 'on' : '') + '">A</span>' +
          '<span class="st-badge ' + (isSto ? 'on' : '') + '">STO</span>' +
          '<span class="st-badge ' + (isRcl ? 'on' : '') + '">RCL</span>' +
          '<span class="st-badge ' + (Math.abs(AppContext.vars.M) > 1e-15 ? 'on' : '') + '">M</span>' +
          '<span class="st-badge on">' + angBadge + '</span>' +
          (cplxBadge ? '<span class="st-badge on">' + cplxBadge + '</span>' : '') +
          (fmtBadge ? '<span class="st-badge on">' + fmtBadge + '</span>' : '') +
          (math580 ? '<span class="st-badge on">' + math580 + '</span>' : '') +
        '</div>' +
        '<div class="st-right">' +
          escapeHtml(AppContext.statusHint || '') +
        '</div>';
    }
  }

  // Màn hình HOME của Máy 880: Lưới 3 cột × 2 hàng mỗi trang (không đánh số, có thanh cuộn phải)
  function renderHome880Overlay() {
    var apps = CalcApps.getVisibleApps('880');
    if (AppContext.menuIdx >= apps.length) AppContext.menuIdx = 0;
    var page = Math.floor(AppContext.menuIdx / 6);
    var totalPages = Math.ceil(apps.length / 6);
    var startIdx = page * 6;
    var endIdx = Math.min(apps.length, startIdx + 6);

    var html = '<div class="home880-wrap"><div class="home880-grid">';
    for (var i = startIdx; i < endIdx; i++) {
      var a = apps[i];
      var cls = 'home880-cell' + (i === AppContext.menuIdx ? ' active' : '');
      html +=
        '<div class="' + cls + '" data-action="menu-pick" data-id="' + a.id + '">' +
          '<div class="home880-icon">' + (a.iconSvg || escapeHtml(a.name.slice(0, 3))) + '</div>' +
          '<div class="home880-name">' + escapeHtml(a.name) + '</div>' +
        '</div>';
    }
    html += '</div>';
    // Thanh cuộn dọc bên phải
    var thumbTop = Math.round((page / Math.max(1, totalPages)) * 100);
    var thumbH = Math.round(100 / Math.max(1, totalPages));
    html += '<div class="lcd-scrollbar"><div class="lcd-scroll-thumb" style="top:' + thumbTop + '%;height:' + thumbH + '%"></div></div>';
    html += '</div>';
    return html;
  }

  // Màn hình MENU của Máy 580: Lưới 4 cột × 2 hàng mỗi trang, góc dưới phải có số/chữ, thanh dưới cùng hiện "1:Calculate"
  function renderMenu580Overlay() {
    var apps = CalcApps.getVisibleApps('580');
    if (AppContext.menuIdx >= apps.length) AppContext.menuIdx = 0;
    var selApp = apps[AppContext.menuIdx];
    var page = Math.floor(AppContext.menuIdx / 8);
    var startIdx = page * 8;
    var endIdx = Math.min(apps.length, startIdx + 8);

    var html = '<div class="menu580-wrap"><div class="menu580-grid">';
    for (var i = startIdx; i < endIdx; i++) {
      var a = apps[i];
      var cls = 'menu580-cell' + (i === AppContext.menuIdx ? ' active' : '');
      html +=
        '<div class="' + cls + '" data-action="menu-pick" data-id="' + a.id + '">' +
          '<div class="menu580-icon">' + (a.iconSvg || escapeHtml(a.code)) + '</div>' +
          '<div class="menu580-code">' + escapeHtml(a.code) + '</div>' +
        '</div>';
    }
    html += '</div>';
    html += '<div class="menu580-bottom-bar">' + escapeHtml(selApp.code + ':' + selApp.name) + '</div>';
    html += '</div>';
    return html;
  }

  // Thực đơn phân cấp (SETTINGS, CATALOG, TOOLS trên 880; CONST, CONV, RESET trên 580)
  function renderTreeOverlay() {
    if (AppContext.treeStack.length === 0) return '';
    var level = AppContext.treeStack[AppContext.treeStack.length - 1];
    var items = level.items || [];
    if (level.idx >= items.length) level.idx = 0;

    // Hiển thị 4 dòng quanh vị trí chọn
    var pageSize = 4;
    var start = Math.max(0, Math.min(level.idx - 1, items.length - pageSize));
    var end = Math.min(items.length, start + pageSize);

    var html = '<div class="lcd-menu-list">';
    if (level.title) {
      html += '<div class="lcd-list-title">' + escapeHtml(level.title) + '</div>';
    }
    for (var i = start; i < end; i++) {
      var it = items[i];
      var cls = (i === level.idx) ? 'lcd-list-item active' : 'lcd-list-item';
      var leftPrefix = '';
      if (it.radio) {
        leftPrefix = (it.selected ? '◉ ' : '○ ');
      }
      var rightSuffix = '';
      if (it.children) rightSuffix = '<b>▶</b>';
      else if (it.rightText) rightSuffix = '<b>' + escapeHtml(it.rightText) + '</b>';
      html +=
        '<div class="' + cls + '" data-action="tree-item" data-idx="' + i + '">' +
          '<span>' + escapeHtml(leftPrefix + it.label) + '</span>' +
          rightSuffix +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  // Thực đơn phân trang đánh số 1..9 (SETUP và OPTN trên Máy 580)
  function renderPagedOverlay() {
    var pm = AppContext.pagedMenu;
    if (!pm || !pm.pages || pm.pages.length === 0) return '';
    var curPage = pm.pages[pm.pageIdx] || pm.pages[0];
    var html = '<div class="lcd-menu-list">';
    if (pm.title) {
      html += '<div class="lcd-list-title">' + escapeHtml(pm.title) +
              ' (' + (pm.pageIdx + 1) + '/' + pm.pages.length + ' ▲▼)</div>';
    }
    for (var i = 0; i < curPage.length; i++) {
      var it = curPage[i];
      var cls = (i === pm.itemIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html +=
        '<div class="' + cls + '" data-action="paged-item" data-idx="' + i + '">' +
          '<span>' + escapeHtml(it.num + ':' + it.label) + '</span>' +
          (it.sub ? '<b>▶</b>' : '') +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderFormatOverlay() {
    var list = AppContext.formatItems || [];
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">FORMAT</div>';
    for (var i = 0; i < list.length; i++) {
      var cls = (i === AppContext.formatIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html += '<div class="' + cls + '" data-action="format-pick" data-idx="' + i + '">' +
              escapeHtml(list[i].label) + '</div>';
    }
    html += '</div>';
    return html;
  }

  // Màn hình VARIABLE trên Máy 880 (A, B, C, D, E, F, x, y, z)
  var VAR_LIST_880 = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
  var VAR_ACTS_880 = [
    { id: 'recall', label: 'Recall Value' },
    { id: 'store', label: 'Store' },
    { id: 'edit', label: 'Edit' }
  ];

  function renderVars880Overlay() {
    var vn = VAR_LIST_880[AppContext.varIdx] || 'A';
    var fmt = AppContext.getFormatOpts();

    if (AppContext.overlay === 'var880_edit') {
      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-list-title">VARIABLE — Edit</div>' +
          '<div class="lcd-prompt-input"><b>' + vn + ' = </b>' + escapeHtml(AppContext.varEditStr) + '<span class="m-cursor"></span></div>' +
        '</div>'
      );
    }

    if (AppContext.overlay === 'var880_act') {
      var aHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' + vn + ' = ' +
                  escapeHtml(CalcEngine.format(AppContext.vars[vn] || 0, fmt)) + '</div>';
      for (var a = 0; a < VAR_ACTS_880.length; a++) {
        var aCls = (a === AppContext.varActIdx) ? 'lcd-list-item active' : 'lcd-list-item';
        aHtml += '<div class="' + aCls + '" data-action="var880-act" data-idx="' + a + '">' +
                 escapeHtml(VAR_ACTS_880[a].label) + '</div>';
      }
      aHtml += '</div>';
      return aHtml;
    }

    var page = Math.floor(AppContext.varIdx / 3);
    var start = page * 3;
    var end = Math.min(VAR_LIST_880.length, start + 3);
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">VARIABLE (' + (page + 1) + '/3)</div>';
    for (var i = start; i < end; i++) {
      var vName = VAR_LIST_880[i];
      var val = AppContext.vars[vName] || 0;
      var cls = (i === AppContext.varIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html +=
        '<div class="' + cls + '" data-action="var880-pick" data-idx="' + i + '">' +
          '<span><b>' + vName + ' =</b></span>' +
          '<b>' + escapeHtml(CalcEngine.toExact(val) || CalcEngine.format(val, fmt)) + '</b>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  // Màn hình RECALL (SHIFT STO) trên Máy 580
  var VAR_LIST_580 = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'];

  function renderRecall580Overlay() {
    var fmt = AppContext.getFormatOpts();
    var page = Math.floor(AppContext.varIdx / 4);
    var start = page * 4;
    var end = Math.min(VAR_LIST_580.length, start + 4);
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">RECALL (▲▼ / Variable Key / =)</div>';
    for (var i = start; i < end; i++) {
      var vn = VAR_LIST_580[i];
      var val = AppContext.vars[vn] || 0;
      var cls = (i === AppContext.varIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html +=
        '<div class="' + cls + '" data-action="rcl580-pick" data-idx="' + i + '">' +
          '<span><b>' + vn + ' =</b></span>' +
          '<b>' + escapeHtml(CalcEngine.toExact(val) || CalcEngine.format(val, fmt)) + '</b>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  // Màn hình Define f(x) / Define g(x) từ nút FUNCTION trên Máy 880
  function renderFuncDefOverlay() {
    var fn = AppContext.funcDefTarget;
    if (!AppContext.funcDefEditor) {
      AppContext.funcDefEditor = CalcEditor.create(false);
    }
    return (
      '<div class="lcd-calc">' +
        '<div class="lcd-list-title">Define ' + fn + '(x)</div>' +
        '<div class="lcd-expr-line"><b>' + fn + '(x) = </b>' + CalcEditor.renderHTML(AppContext.funcDefEditor, true) + '</div>' +
      '</div>'
    );
  }

  // Màn hình Bảng tuần hoàn tương tác (Periodic Table) trên Máy 880
  function renderPeriodicTableOverlay() {
    var z = AppContext.ptElementZ || 1;
    var el = CalcEngine.getElement ? CalcEngine.getElement(z) : null;
    if (!el) return '';
    var wStr = el.bracket ? ('[' + el.weight + ']') : String(el.weight);

    // Hiển thị các nguyên tố lân cận để dễ nhìn trên LCD
    var html = '<div class="pt880-wrap">';
    html += '<div class="pt880-header">' +
              '<span class="pt880-z">#' + el.z + '</span> ' +
              '<b class="pt880-sym">' + escapeHtml(el.symbol) + '</b> ' +
              '<span class="pt880-name">(' + escapeHtml(el.name) + ')</span>' +
              '<b class="pt880-wt">' + escapeHtml(wStr) + '</b>' +
            '</div>';
    html += '<div class="pt880-strip">';
    var startZ = Math.max(1, Math.min(z - 3, 112));
    for (var i = startZ; i <= Math.min(118, startZ + 6); i++) {
      var item = CalcEngine.elements[i - 1];
      var cls = (i === z) ? 'pt880-cell active' : 'pt880-cell';
      html += '<div class="' + cls + '" data-action="pt-pick" data-z="' + i + '">' +
                '<div class="pt-c-z">' + item.z + '</div>' +
                '<div class="pt-c-s">' + escapeHtml(item.symbol) + '</div>' +
              '</div>';
    }
    html += '</div>';
    html += '<div class="lcd-sub-hint">◀▶ đổi nguyên tố (1–118), ▲▼ nhảy chu kỳ, OK chèn ' + escapeHtml(wStr) + '</div>';
    html += '</div>';
    return html;
  }

  // =========================================================================
  // CHÈN MỤC TỪ CATALOG / OPTN / FUNCTION / CONST / CONV VÀO BIỂU THỨC
  // =========================================================================
  function getActiveEditor() {
    if (AppContext.overlay === 'func_def' && AppContext.funcDefEditor) {
      return AppContext.funcDefEditor;
    }
    if (AppContext.currentAppId === 'complex' && AppContext.complexState) {
      return AppContext.complexState.editor;
    }
    if (AppContext.currentAppId === 'verify' && AppContext.verifyAppState) {
      return AppContext.verifyAppState.editor;
    }
    if (AppContext.currentAppId === 'table' && AppContext.tableState) {
      if (AppContext.tableState.step === 'f') return AppContext.tableState.fEditor;
      if (AppContext.tableState.step === 'g') return AppContext.tableState.gEditor;
    }
    if (AppContext.currentAppId === 'eq' && AppContext.eqState && AppContext.eqState.step === 'solver_eq') {
      return AppContext.eqState.solverEditor;
    }
    if (AppContext.calcState) {
      return AppContext.calcState.editor;
    }
    return null;
  }

  function insertIntoActiveContext(item) {
    AppContext.overlay = null;
    AppContext.treeStack = [];
    AppContext.pagedMenu = null;

    // Nếu đang ở Base-N, Matrix, Vector, Spreadsheet (dùng chuỗi biểu thức riêng)
    if (AppContext.currentAppId === 'baseN' && AppContext.baseNState && item.text) {
      if (AppContext.baseNState.hasResult) {
        AppContext.baseNState.expr = '';
        AppContext.baseNState.hasResult = false;
      }
      AppContext.baseNState.expr += item.text;
      renderAll();
      return;
    }
    if (AppContext.currentAppId === 'matrix' && AppContext.matrixState && item.text) {
      AppContext.matrixState.step = 'calc';
      AppContext.matrixState.calcExpr += item.text;
      renderAll();
      return;
    }
    if (AppContext.currentAppId === 'vector' && AppContext.vectorState && item.text) {
      AppContext.vectorState.step = 'calc';
      AppContext.vectorState.calcExpr += item.text;
      renderAll();
      return;
    }
    if (AppContext.currentAppId === 'sheet' && AppContext.sheetState && item.text) {
      var sst = AppContext.sheetState;
      if (!sst.isEditing) {
        sst.isEditing = true;
        sst.editStr = item.text === '=' ? '=' : ('=' + item.text);
      } else {
        sst.editStr += item.text;
      }
      renderAll();
      return;
    }

    var ed = getActiveEditor();
    if (!ed) {
      AppContext.switchApp('calc');
      ed = AppContext.calcState.editor;
    }

    // Nếu vừa tính xong kết quả trong Calculate hoặc Complex
    if (AppContext.currentAppId === 'calc' && AppContext.calcState && AppContext.calcState.hasResult) {
      var st = AppContext.calcState;
      var isPostConv = (item.evalText && item.evalText.indexOf('▸') !== -1);
      var isRel = (item.evalText === '=' || item.evalText === '≠' || item.evalText === '>' || item.evalText === '<' || item.evalText === '≥' || item.evalText === '≤');
      CalcEditor.clear(ed);
      st.hasResult = false;
      if (isPostConv) {
        CalcEditor.insertToken(ed, 'Ans', 'Ans');
      } else if (AppContext.verifyMode && st.lastResult && st.lastResult.isVerify && isRel && st.lastVerifyRightExpr) {
        CalcEditor.insertTextString(ed, st.lastVerifyRightExpr);
      }
    } else if (AppContext.currentAppId === 'complex' && AppContext.complexState && AppContext.complexState.hasResult) {
      var cst = AppContext.complexState;
      if (item.evalText === '▶r∠θ' || item.evalText === '▶a+bi') {
        cst.displayMode = (item.evalText === '▶r∠θ') ? 'polar_exact' : 'rect_exact';
        renderAll();
        return;
      }
      CalcEditor.clear(ed);
      cst.hasResult = false;
    }

    if (item.tpl) {
      CalcEditor.insertTemplate(ed, item.tpl);
    } else if (item.text) {
      CalcEditor.insertToken(ed, item.text, item.evalText || item.text);
    }
    renderAll();
  }

  // =========================================================================
  // XỬ LÝ HÀNH ĐỘNG CỦA CÁC THỰC ĐƠN (SETTINGS, TOOLS, SETUP, RESET...)
  // =========================================================================
  function executeMenuAction(act, item) {
    var s = AppContext.settings;
    if (act === 'SET_IO_MATH') { s.ioMode = 'math'; syncEditorLineMode(); }
    else if (act === 'SET_IO_MATH_DEC') { s.ioMode = 'math_dec'; syncEditorLineMode(); }
    else if (act === 'SET_IO_LINE') { s.ioMode = 'line'; syncEditorLineMode(); }
    else if (act === 'SET_IO_LINE_DEC') { s.ioMode = 'line_dec'; syncEditorLineMode(); }
    else if (act === 'SET_ANG_DEG') { s.angle = 'deg'; }
    else if (act === 'SET_ANG_RAD') { s.angle = 'rad'; }
    else if (act === 'SET_ANG_GRA') { s.angle = 'gra'; }
    else if (act === 'SET_FMT_NORM1') { s.fmtMode = 'norm1'; }
    else if (act === 'SET_FMT_NORM2') { s.fmtMode = 'norm2'; }
    else if (act === 'SET_FMT_FIX') { s.fmtMode = 'fix'; s.fmtDigits = item.value; }
    else if (act === 'SET_FMT_SCI') { s.fmtMode = 'sci'; s.fmtDigits = item.value === 0 ? 10 : item.value; }
    else if (act === 'PROMPT_FIX') { AppContext.overlay = 'digit_prompt'; AppContext.digitPromptKind = 'fix'; renderAll(); return; }
    else if (act === 'PROMPT_SCI') { AppContext.overlay = 'digit_prompt'; AppContext.digitPromptKind = 'sci'; renderAll(); return; }
    else if (act === 'PROMPT_NORM') { AppContext.overlay = 'digit_prompt'; AppContext.digitPromptKind = 'norm'; renderAll(); return; }
    else if (act === 'SET_ENG_SYM') { s.engSymbol = !!item.value; }
    else if (act === 'SET_FRAC_MIXED') { s.fracMode = 'mixed'; }
    else if (act === 'SET_FRAC_IMPROPER') { s.fracMode = 'improper'; }
    else if (act === 'SET_CPLX_RECT') { s.complexForm = 'rect'; }
    else if (act === 'SET_CPLX_POLAR') { s.complexForm = 'polar'; }
    else if (act === 'SET_STAT_FREQ') { s.statFreq = !!item.value; }
    else if (act === 'SET_TBL_1') { s.tableTwoFuncs = false; }
    else if (act === 'SET_TBL_2') { s.tableTwoFuncs = true; }
    else if (act === 'SET_EQ_CPLX') { s.eqComplexRoots = !!item.value; }
    else if (act === 'SET_DEC_DOT') { s.decimalMark = 'dot'; }
    else if (act === 'SET_DEC_COMMA') { s.decimalMark = 'comma'; }
    else if (act === 'SET_SEP') { s.digitSep = !!item.value; }
    else if (act === 'SET_FONT_NORM') { s.fontSize = 'norm'; }
    else if (act === 'SET_FONT_SMALL') { s.fontSize = 'small'; }
    else if (act === 'SET_CONTRAST') { AppContext.overlay = null; }
    else if (act === 'RESET_SETTINGS_DATA') {
      AppContext.resetSetupData();
      showConfirmComplete('Settings & Data Reset');
      return;
    } else if (act === 'RESET_VAR_MEM') {
      AppContext.resetVariableMemory();
      showConfirmComplete('Variable Memory Clear');
      return;
    } else if (act === 'RESET_ALL') {
      AppContext.resetInitializeAll();
      showConfirmComplete('Initialize All');
      return;
    } else if (act === 'OPEN_PERIODIC_TABLE') {
      AppContext.overlay = 'periodic_table';
      AppContext.ptElementZ = 1;
      renderAll();
      return;
    } else if (act === 'TOGGLE_VERIFY') {
      AppContext.verifyMode = !AppContext.verifyMode;
      AppContext.overlay = null;
      renderAll();
      return;
    } else if (act === 'UNDO') {
      AppContext.overlay = null;
      renderAll();
      return;
    } else if (act === 'BASE_DEC' || act === 'BASE_HEX' || act === 'BASE_BIN' || act === 'BASE_OCT') {
      AppContext.overlay = null;
      CalcApps.byId.baseN.onKey(act, AppContext);
      renderAll();
      return;
    } else if (act === 'MAT_DIM') {
      AppContext.overlay = null;
      CalcApps.byId.matrix.init(AppContext);
      AppContext.matrixState.selectIdx = item.mat === 'MatA' ? 0 : (item.mat === 'MatB' ? 1 : (item.mat === 'MatC' ? 2 : 3));
      CalcApps.byId.matrix.confirmSelect(AppContext.matrixState);
      renderAll();
      return;
    } else if (act === 'MAT_ANS_VIEW') {
      insertIntoActiveContext({ text: 'MatAns', evalText: 'MatAns' });
      return;
    } else if (act === 'VCT_DIM') {
      AppContext.overlay = null;
      CalcApps.byId.vector.init(AppContext);
      AppContext.vectorState.selectIdx = item.vct === 'VctA' ? 0 : (item.vct === 'VctB' ? 1 : (item.vct === 'VctC' ? 2 : 3));
      CalcApps.byId.vector.confirmSelect(AppContext.vectorState);
      renderAll();
      return;
    } else if (act === 'VCT_ANS_VIEW') {
      insertIntoActiveContext({ text: 'VctAns', evalText: 'VctAns' });
      return;
    } else if (act === 'STAT_SORT_ASC' || act === 'STAT_SORT_DESC') {
      AppContext.overlay = null;
      if (AppContext.statState && AppContext.statState.rows) {
        var dir = act === 'STAT_SORT_ASC' ? 1 : -1;
        AppContext.statState.rows.sort(function (a, b) { return dir * (a.x - b.x); });
      }
      renderAll();
      return;
    } else if (act === 'STAT_DEL_ALL') {
      AppContext.overlay = null;
      if (AppContext.statState) {
        AppContext.statState.rows = [{ x: 0, y: 0, f: 1 }];
        AppContext.statState.rowIdx = 0;
      }
      renderAll();
      return;
    } else if (act === 'STAT_INS_ROW') {
      AppContext.overlay = null;
      if (AppContext.statState) {
        AppContext.statState.rows.splice(AppContext.statState.rowIdx, 0, { x: 0, y: 0, f: 1 });
      }
      renderAll();
      return;
    } else if (act === 'SHEET_FILL_FORMULA') {
      AppContext.overlay = null;
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, 0);
      renderAll();
      return;
    } else if (act === 'SHEET_FILL_VALUE') {
      AppContext.overlay = null;
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, 1);
      renderAll();
      return;
    } else if (act === 'SHEET_EDIT_CELL') {
      AppContext.overlay = null;
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, 2);
      renderAll();
      return;
    } else if (act === 'SHEET_DEL_ALL') {
      AppContext.overlay = null;
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, 3);
      renderAll();
      return;
    } else if (act === 'SHEET_RECALC') {
      AppContext.overlay = null;
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, 4);
      renderAll();
      return;
    } else if (act === 'TBL_RANGE') {
      AppContext.overlay = null;
      if (AppContext.tableState) {
        AppContext.tableState.step = 'range';
        AppContext.tableState.rangeIdx = 0;
      }
      renderAll();
      return;
    } else if (act === 'DEFINE_F' || act === 'DEFINE_G') {
      openDefineFuncModal(act === 'DEFINE_F' ? 'f' : 'g');
      return;
    } else if (act === 'TBL_DEL_ROW') {
      AppContext.overlay = null;
      if (AppContext.tableState && AppContext.tableState.rows.length > 0) {
        AppContext.tableState.rows.splice(AppContext.tableState.selRow, 1);
      }
      renderAll();
      return;
    } else if (act === 'TBL_INS_ROW') {
      AppContext.overlay = null;
      if (AppContext.tableState) {
        AppContext.tableState.rows.splice(AppContext.tableState.selRow, 0, { x: 0, f: 0, g: 0 });
      }
      renderAll();
      return;
    } else if (act === 'TBL_DEL_ALL') {
      AppContext.overlay = null;
      if (AppContext.tableState) {
        AppContext.tableState.rows = [];
      }
      renderAll();
      return;
    } else if (act === 'MB_VIEW_WIN') {
      AppContext.overlay = null;
      if (AppContext.mathboxState) {
        AppContext.mathboxState.nlScale = (AppContext.mathboxState.nlScale === 1) ? 2 : (AppContext.mathboxState.nlScale === 2 ? 5 : 1);
      }
      renderAll();
      return;
    } else if (act === 'MB_VIEW_RESET') {
      AppContext.overlay = null;
      if (AppContext.mathboxState) {
        AppContext.mathboxState.nlCenter = 0;
        AppContext.mathboxState.nlScale = 1;
      }
      renderAll();
      return;
    }

    AppContext.saveState();
    // Nếu đang ở trong SETTINGS trên máy 880, làm mới lại cây để cập nhật nút radio ◉
    if (AppContext.machineId === '880' && AppContext.overlay === 'tree' && AppContext.treeStack.length > 0 && AppContext.treeStack[0].title === 'SETTINGS') {
      refreshSettingsTree880();
    } else {
      AppContext.overlay = null;
      AppContext.treeStack = [];
      AppContext.pagedMenu = null;
    }
    renderAll();
  }

  function syncEditorLineMode() {
    var isLine = (AppContext.settings.ioMode === 'line' || AppContext.settings.ioMode === 'line_dec');
    if (AppContext.calcState) AppContext.calcState.editor.lineMode = isLine;
    if (AppContext.complexState) AppContext.complexState.editor.lineMode = isLine;
  }

  function showConfirmComplete(title) {
    AppContext.confirmMsg = {
      title: title,
      sub: 'Complete — Press [OK] or [AC]'
    };
    AppContext.overlay = 'confirm_msg';
    renderAll();
  }

  function refreshSettingsTree880() {
    var prof = CalcMachines['880'];
    if (!prof || !prof.getSettingsTree) return;
    var rootItems = prof.getSettingsTree(AppContext);
    AppContext.treeStack[0].items = rootItems;
    for (var i = 1; i < AppContext.treeStack.length; i++) {
      var parent = AppContext.treeStack[i - 1];
      var pItem = parent.items[parent.idx];
      if (pItem && pItem.children) {
        AppContext.treeStack[i].items = pItem.children;
      }
    }
  }

  function openDefineFuncModal(fnName) {
    AppContext.funcDefTarget = fnName;
    var ed = CalcEditor.create(AppContext.settings.ioMode === 'line');
    var curStr = (CalcEngine.getDefinedFunc && CalcEngine.getDefinedFunc(fnName)) || '';
    if (curStr) {
      CalcEditor.insertTextString(ed, curStr);
    }
    AppContext.funcDefEditor = ed;
    AppContext.overlay = 'func_def';
    renderAll();
  }

  // =========================================================================
  // ĐIỀU PHỐI PHÍM BẤM TỔNG QUÁT (dispatchAction)
  // =========================================================================
  function dispatchAction(actionKey, logLabel, modType, logExtraNote) {
    AppContext.statusHint = '';

    // 1. Khi màn hình đang tắt (OFF)
    if (AppContext.overlay === 'off') {
      if (actionKey === 'ON' || actionKey === 'AC') {
        AppContext.overlay = null;
        recordKeyLog(logLabel || 'ON', '');
        renderAll();
      }
      return;
    }

    if (actionKey === 'OFF') {
      AppContext.overlay = 'off';
      AppContext.shiftActive = false;
      AppContext.alphaActive = false;
      recordKeyLog('OFF', 'shift');
      renderAll();
      return;
    }

    // 2. Xác định xem có phải bắt đầu phép tính mới sau dấu = không (để tự xóa nhật ký phím)
    var curApp = CalcApps.byId[AppContext.currentAppId];
    var isNewStart = false;
    var hasCalcRes = (AppContext.currentAppId === 'calc' && AppContext.calcState && AppContext.calcState.hasResult) ||
                     (AppContext.currentAppId === 'complex' && AppContext.complexState && AppContext.complexState.hasResult);
    if (!AppContext.overlay && hasCalcRes) {
      var nonResetKeys = {
        '=': 1, 'OK': 1, 'APPROX_EQ': 1, 'FORMAT': 1, 'S_D': 1, 'MIXED_SD': 1,
        'FACT': 1, 'DMS': 1, 'DMS_CONV': 1, 'ENG': 1, 'ENG_BACK': 1,
        'LEFT': 1, 'RIGHT': 1, 'UP': 1, 'DOWN': 1, 'PAGE_UP': 1, 'PAGE_DOWN': 1,
        '+': 1, '-': 1, '*': 1, '/': 1, 'POW': 1, 'SQ': 1, 'CUBE': 1, 'INV': 1,
        'FACTORIAL': 1, 'DIV_R': 1, 'NPR': 1, 'NCR': 1, 'STO': 1, 'M+': 1, 'M-': 1
      };
      if (!nonResetKeys[actionKey]) {
        isNewStart = true;
      }
    }

    if (logLabel) {
      recordKeyLog(logLabel, modType, isNewStart, logExtraNote);
    }

    // 3. Các phím hệ thống mở thực đơn toàn cục
    if (actionKey === 'ON') {
      AppContext.overlay = null;
      dispatchAction('AC', '', '');
      renderAll();
      return;
    }

    if (actionKey === 'HOME') {
      if (AppContext.overlay === 'home') AppContext.overlay = null;
      else AppContext.openMenu();
      renderAll();
      return;
    }

    if (actionKey === 'MENU') {
      if (AppContext.overlay === 'menu') AppContext.overlay = null;
      else AppContext.openMenu();
      renderAll();
      return;
    }

    if (actionKey === 'SETTINGS') {
      if (AppContext.overlay === 'tree' && AppContext.treeStack.length > 0 && AppContext.treeStack[0].title === 'SETTINGS') {
        AppContext.overlay = null;
        AppContext.treeStack = [];
      } else {
        var prof880 = CalcMachines['880'];
        AppContext.treeStack = [{ title: 'SETTINGS', items: prof880.getSettingsTree(AppContext), idx: 0 }];
        AppContext.overlay = 'tree';
      }
      renderAll();
      return;
    }

    if (actionKey === 'CATALOG') {
      if (AppContext.overlay === 'tree' && AppContext.treeStack.length > 0 && AppContext.treeStack[0].title === 'CATALOG') {
        AppContext.overlay = null;
        AppContext.treeStack = [];
      } else {
        var profCat = CalcMachines['880'];
        AppContext.treeStack = [{ title: 'CATALOG', items: profCat.getCatalogTree(AppContext), idx: 0 }];
        AppContext.overlay = 'tree';
      }
      renderAll();
      return;
    }

    if (actionKey === 'TOOLS') {
      if (AppContext.overlay === 'tree' && AppContext.treeStack.length > 0 && AppContext.treeStack[0].title === 'TOOLS') {
        AppContext.overlay = null;
        AppContext.treeStack = [];
      } else {
        var profTools = CalcMachines['880'];
        AppContext.treeStack = [{ title: 'TOOLS', items: profTools.getToolsMenu(AppContext.currentAppId, AppContext), idx: 0 }];
        AppContext.overlay = 'tree';
      }
      renderAll();
      return;
    }

    if (actionKey === 'VARIABLE') {
      if (AppContext.overlay === 'vars880' || AppContext.overlay === 'var880_act' || AppContext.overlay === 'var880_edit') {
        AppContext.overlay = null;
      } else {
        AppContext.overlay = 'vars880';
        AppContext.varIdx = 0;
      }
      renderAll();
      return;
    }

    if (actionKey === 'FUNCTION') {
      if (AppContext.overlay === 'tree' && AppContext.treeStack.length > 0 && AppContext.treeStack[0].title === 'FUNCTION') {
        AppContext.overlay = null;
        AppContext.treeStack = [];
      } else {
        var profFn = CalcMachines['880'];
        AppContext.treeStack = [{ title: 'FUNCTION', items: profFn.getFunctionMenu(), idx: 0 }];
        AppContext.overlay = 'tree';
      }
      renderAll();
      return;
    }

    if (actionKey === 'FORMAT' || actionKey === 'FORMAT_MENU') {
      if (AppContext.overlay === 'format') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      var hasRes880 = (AppContext.currentAppId === 'calc' && AppContext.calcState && AppContext.calcState.hasResult && AppContext.calcState.lastResult && AppContext.calcState.lastResult.ok) ||
                      (AppContext.currentAppId === 'complex' && AppContext.complexState && AppContext.complexState.hasResult && AppContext.complexState.lastResult && AppContext.complexState.lastResult.ok);
      if (hasRes880) {
        // Như máy thật: phím FORMAT luôn mở danh sách dạng kết quả, chọn bằng ▲▼ rồi EXE/OK
        var profFmt = CalcMachines['880'];
        AppContext.formatItems = profFmt.getFormatMenu(AppContext.currentAppId);
        AppContext.formatIdx = 0;
        AppContext.overlay = 'format';
        renderAll();
      }
      return;
    }

    if (actionKey === 'QR') {
      AppContext.overlay = 'qr_msg';
      renderAll();
      return;
    }

    if (actionKey === 'SETUP') {
      if (AppContext.overlay === 'paged' && AppContext.pagedMenu && AppContext.pagedMenu.kind === 'setup') {
        AppContext.overlay = null;
      } else {
        var prof580 = CalcMachines['580'];
        AppContext.pagedMenu = {
          title: 'SETUP',
          pages: prof580.getSetupPages(AppContext),
          pageIdx: 0,
          itemIdx: 0,
          kind: 'setup'
        };
        AppContext.overlay = 'paged';
      }
      renderAll();
      return;
    }

    if (actionKey === 'OPTN') {
      if (AppContext.currentAppId === 'verify') {
        AppContext.overlay = null;
        CalcApps.byId.verify.openOptn(AppContext);
        renderAll();
        return;
      }
      if (AppContext.currentAppId === 'stat' && AppContext.statState && AppContext.statState.step !== 'type') {
        AppContext.overlay = null;
        CalcApps.byId.stat.openOptn(AppContext);
        renderAll();
        return;
      }
      if (AppContext.overlay === 'paged' && AppContext.pagedMenu && AppContext.pagedMenu.kind === 'optn') {
        AppContext.overlay = null;
      } else {
        var profOptn = CalcMachines['580'];
        AppContext.pagedMenu = {
          title: 'OPTN',
          pages: profOptn.getOptnPages(AppContext.currentAppId, AppContext),
          pageIdx: 0,
          itemIdx: 0,
          kind: 'optn'
        };
        AppContext.overlay = 'paged';
      }
      renderAll();
      return;
    }

    if (actionKey === 'CONST_MENU') {
      var profC = CalcMachines['580'];
      var cTree = profC.buildSciConstPages();
      AppContext.treeStack = [{ title: 'CONST (1~6)', items: cTree, idx: 0 }];
      AppContext.overlay = 'tree';
      renderAll();
      return;
    }

    if (actionKey === 'CONV_MENU') {
      var profV = CalcMachines['580'];
      var vTree = profV.buildUnitConvPages();
      AppContext.treeStack = [{ title: 'CONV (1~9)', items: vTree, idx: 0 }];
      AppContext.overlay = 'tree';
      renderAll();
      return;
    }

    if (actionKey === 'RESET_MENU') {
      var profR = CalcMachines['580'];
      AppContext.treeStack = [{ title: 'RESET', items: profR.getResetMenu(), idx: 0 }];
      AppContext.overlay = 'tree';
      renderAll();
      return;
    }

    if (actionKey === 'RCL') {
      AppContext.overlay = (AppContext.overlay === 'recall580') ? null : 'recall580';
      AppContext.varIdx = 0;
      renderAll();
      return;
    }

    // 4. Xử lý khi đang mở một lớp phủ (Overlay)
    if (AppContext.overlay) {
      handleOverlayKey(actionKey);
      return;
    }

    // 5. Chuyển phím cho ứng dụng đang hoạt động
    if (curApp && curApp.onKey) {
      curApp.onKey(actionKey, AppContext);
      renderAll();
    }
  }

  function handleOverlayKey(actionKey) {
    // Thông báo QR hoặc xác nhận Reset
    if (AppContext.overlay === 'qr_msg' || AppContext.overlay === 'confirm_msg') {
      if (actionKey === 'BACK' || actionKey === 'AC' || actionKey === 'OK' || actionKey === '=') {
        AppContext.overlay = null;
        AppContext.confirmMsg = null;
        renderAll();
      }
      return;
    }

    // Nhập chữ số cho Fix / Sci / Norm trên Máy 580
    if (AppContext.overlay === 'digit_prompt') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (/^[0-9]$/.test(actionKey)) {
        var dg = parseInt(actionKey, 10);
        if (AppContext.digitPromptKind === 'norm') {
          if (dg === 1 || dg === 2) {
            AppContext.settings.fmtMode = dg === 2 ? 'norm2' : 'norm1';
            AppContext.overlay = null;
            AppContext.saveState();
          }
        } else if (AppContext.digitPromptKind === 'fix') {
          AppContext.settings.fmtMode = 'fix';
          AppContext.settings.fmtDigits = dg;
          AppContext.overlay = null;
          AppContext.saveState();
        } else if (AppContext.digitPromptKind === 'sci') {
          AppContext.settings.fmtMode = 'sci';
          AppContext.settings.fmtDigits = dg === 0 ? 10 : dg;
          AppContext.overlay = null;
          AppContext.saveState();
        }
        renderAll();
      }
      return;
    }

    // Màn hình HOME (880) hoặc MENU (580)
    if (AppContext.overlay === 'home' || AppContext.overlay === 'menu') {
      var apps = CalcApps.getVisibleApps(AppContext.machineId);
      var cols = (AppContext.overlay === 'home') ? 3 : 4;
      if (actionKey === 'AC' || actionKey === 'BACK') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'LEFT' && AppContext.menuIdx > 0) { AppContext.menuIdx--; renderAll(); return; }
      if (actionKey === 'RIGHT' && AppContext.menuIdx < apps.length - 1) { AppContext.menuIdx++; renderAll(); return; }
      if (actionKey === 'UP' && AppContext.menuIdx >= cols) { AppContext.menuIdx -= cols; renderAll(); return; }
      if (actionKey === 'DOWN' && AppContext.menuIdx + cols < apps.length) { AppContext.menuIdx += cols; renderAll(); return; }
      // Hàng cuối thiếu ô: ▼ nhảy tới ô cuối cùng (vd Math Box) thay vì đứng yên
      if (actionKey === 'DOWN' && Math.floor(AppContext.menuIdx / cols) < Math.floor((apps.length - 1) / cols)) { AppContext.menuIdx = apps.length - 1; renderAll(); return; }
      if (actionKey === 'PAGE_UP') { AppContext.menuIdx = Math.max(0, AppContext.menuIdx - 6); renderAll(); return; }
      if (actionKey === 'PAGE_DOWN') { AppContext.menuIdx = Math.min(apps.length - 1, AppContext.menuIdx + 6); renderAll(); return; }
      if (actionKey === 'OK' || actionKey === '=') {
        var chosenApp = apps[AppContext.menuIdx];
        // Ghi chú tên ứng dụng vào viên phím cuối trong nhật ký phím
        annotateLastKeyLog(chosenApp.name);
        AppContext.switchApp(chosenApp.id);
        return;
      }
      // Trên máy 580: chọn nhanh bằng phím 1..9, A((-)), B(°′″), C(x⁻¹)
      if (AppContext.overlay === 'menu') {
        var codeMap = {
          '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
          '(-)': 'A', 'VAR_A': 'A', 'DMS': 'B', 'VAR_B': 'B', 'INV': 'C', 'VAR_C': 'C'
        };
        var pickedCode = codeMap[actionKey];
        if (pickedCode) {
          for (var mi = 0; mi < apps.length; mi++) {
            if (apps[mi].code === pickedCode) {
              annotateLastKeyLog(apps[mi].name);
              AppContext.switchApp(apps[mi].id);
              return;
            }
          }
        }
      }
      return;
    }

    // Thực đơn cây (SETTINGS, CATALOG, TOOLS, FUNCTION trên 880; CONST, CONV, RESET trên 580)
    if (AppContext.overlay === 'tree') {
      var lvl = AppContext.treeStack[AppContext.treeStack.length - 1];
      var items = lvl.items || [];
      if (actionKey === 'AC') {
        AppContext.overlay = null;
        AppContext.treeStack = [];
        renderAll();
        return;
      }
      if (actionKey === 'BACK' || actionKey === 'LEFT') {
        if (AppContext.treeStack.length > 1) {
          AppContext.treeStack.pop();
        } else {
          AppContext.overlay = null;
          AppContext.treeStack = [];
        }
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        lvl.idx = (lvl.idx + items.length - 1) % items.length;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        lvl.idx = (lvl.idx + 1) % items.length;
        renderAll();
        return;
      }
      if (actionKey === 'PAGE_UP') {
        lvl.idx = Math.max(0, lvl.idx - 4);
        renderAll();
        return;
      }
      if (actionKey === 'PAGE_DOWN') {
        lvl.idx = Math.min(items.length - 1, lvl.idx + 4);
        renderAll();
        return;
      }
      // Phím số 1..9 chọn nhanh mục trên Máy 580 (CONST, CONV, RESET)
      if (AppContext.machineId === '580' && /^[1-9]$/.test(actionKey)) {
        var nIdx = parseInt(actionKey, 10) - 1;
        if (items[nIdx]) {
          lvl.idx = nIdx;
          activateTreeItem(items[nIdx]);
          return;
        }
      }
      if (actionKey === 'OK' || actionKey === '=' || actionKey === 'RIGHT') {
        var selItem = items[lvl.idx];
        if (actionKey === 'RIGHT' && (!selItem || !selItem.children)) return;
        activateTreeItem(selItem);
      }
      return;
    }

    // Thực đơn phân trang đánh số (SETUP, OPTN trên Máy 580)
    if (AppContext.overlay === 'paged') {
      var pm = AppContext.pagedMenu;
      var curPage = pm.pages[pm.pageIdx] || [];
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        AppContext.pagedMenu = null;
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        pm.pageIdx = (pm.pageIdx + pm.pages.length - 1) % pm.pages.length;
        pm.itemIdx = 0;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        pm.pageIdx = (pm.pageIdx + 1) % pm.pages.length;
        pm.itemIdx = 0;
        renderAll();
        return;
      }
      if (/^[1-9]$/.test(actionKey)) {
        for (var pi = 0; pi < curPage.length; pi++) {
          if (curPage[pi].num === actionKey) {
            activatePagedItem(curPage[pi]);
            return;
          }
        }
      }
      if (actionKey === 'OK' || actionKey === '=') {
        if (curPage[pm.itemIdx]) {
          activatePagedItem(curPage[pm.itemIdx]);
        }
      }
      return;
    }

    // Thực đơn FORMAT trên Máy 880
    if (AppContext.overlay === 'format') {
      var fList = AppContext.formatItems || [];
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        AppContext.formatIdx = (AppContext.formatIdx + fList.length - 1) % fList.length;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        AppContext.formatIdx = (AppContext.formatIdx + 1) % fList.length;
        renderAll();
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        var fChosen = fList[AppContext.formatIdx];
        AppContext.overlay = null;
        if (fChosen) {
          annotateLastKeyLog(fChosen.label);
          if (AppContext.currentAppId === 'complex') {
            CalcApps.byId.complex.applyFormatOption(AppContext, fChosen.id);
          } else {
            CalcApps.byId.calc.applyFormatOption(AppContext, fChosen.id);
          }
        }
        renderAll();
      }
      return;
    }

    // Màn hình VARIABLE trên Máy 880
    if (AppContext.overlay === 'vars880') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        AppContext.varIdx = (AppContext.varIdx + VAR_LIST_880.length - 1) % VAR_LIST_880.length;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        AppContext.varIdx = (AppContext.varIdx + 1) % VAR_LIST_880.length;
        renderAll();
        return;
      }
      if (actionKey === 'PAGE_UP') {
        AppContext.varIdx = Math.max(0, AppContext.varIdx - 3);
        renderAll();
        return;
      }
      if (actionKey === 'PAGE_DOWN') {
        AppContext.varIdx = Math.min(VAR_LIST_880.length - 1, AppContext.varIdx + 3);
        renderAll();
        return;
      }
      // Nếu bấm phím biến (A..F, x, y, z) trực tiếp trong màn hình VARIABLE -> mở Edit cho biến đó
      var directVarMap = {
        'VAR_A': 0, 'VAR_B': 1, 'VAR_C': 2, 'VAR_D': 3, 'VAR_E': 4, 'VAR_F': 5,
        'VAR_x': 6, 'x': 6, 'VAR_y': 7, 'VAR_z': 8
      };
      if (directVarMap[actionKey] !== undefined) {
        AppContext.varIdx = directVarMap[actionKey];
        AppContext.varEditStr = '';
        AppContext.overlay = 'var880_edit';
        renderAll();
        return;
      }
      if (actionKey === 'OK' || actionKey === '=' || actionKey === 'TOOLS') {
        AppContext.varActIdx = 0;
        AppContext.overlay = 'var880_act';
        renderAll();
      }
      return;
    }

    if (AppContext.overlay === 'var880_act') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = 'vars880';
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        AppContext.varActIdx = (AppContext.varActIdx + 2) % 3;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        AppContext.varActIdx = (AppContext.varActIdx + 1) % 3;
        renderAll();
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        execVar880Action(AppContext.varActIdx);
      }
      return;
    }

    if (AppContext.overlay === 'var880_edit') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = 'vars880';
        renderAll();
        return;
      }
      if (actionKey === 'DEL') {
        AppContext.varEditStr = AppContext.varEditStr.slice(0, -1);
        renderAll();
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        var vn8 = VAR_LIST_880[AppContext.varIdx] || 'A';
        if (AppContext.varEditStr.replace(/\s+/g, '') !== '') {
          var ev = CalcEngine.evalText(AppContext.varEditStr, AppContext.getEvalOpts());
          if (ev.ok) {
            AppContext.vars[vn8] = ev.value;
            AppContext.saveState();
          }
        }
        AppContext.overlay = 'vars880';
        renderAll();
        return;
      }
      var chV = CalcApps.mapKeyToCellChar(actionKey);
      if (chV) {
        AppContext.varEditStr += chV;
        renderAll();
      }
      return;
    }

    // Màn hình RECALL trên Máy 580
    if (AppContext.overlay === 'recall580') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        AppContext.varIdx = (AppContext.varIdx + VAR_LIST_580.length - 1) % VAR_LIST_580.length;
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        AppContext.varIdx = (AppContext.varIdx + 1) % VAR_LIST_580.length;
        renderAll();
        return;
      }
      var rclKeyMap = {
        'VAR_A': 'A', '(-)': 'A',
        'VAR_B': 'B', 'DMS': 'B',
        'VAR_C': 'C', 'INV': 'C',
        'VAR_D': 'D', 'sin': 'D',
        'VAR_E': 'E', 'cos': 'E',
        'VAR_F': 'F', 'tan': 'F',
        'VAR_x': 'x', '(': 'x', 'x': 'x',
        'VAR_y': 'y', ')': 'y',
        'VAR_z': 'z', 'S_D': 'z',
        'VAR_M': 'M', 'M+': 'M'
      };
      if (rclKeyMap[actionKey]) {
        var rVar = rclKeyMap[actionKey];
        insertIntoActiveContext({ text: rVar, evalText: rVar });
        return;
      }
      if (actionKey === '=' || actionKey === 'OK') {
        var selV = VAR_LIST_580[AppContext.varIdx] || 'A';
        insertIntoActiveContext({ text: selV, evalText: selV });
      }
      return;
    }

    // Màn hình Define f(x) / g(x) trên Máy 880
    if (AppContext.overlay === 'func_def') {
      var edF = AppContext.funcDefEditor;
      if (actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (actionKey === 'AC') {
        CalcEditor.clear(edF);
        renderAll();
        return;
      }
      if (actionKey === 'DEL') {
        CalcEditor.deleteBack(edF);
        renderAll();
        return;
      }
      if (actionKey === 'LEFT') { CalcEditor.moveLeft(edF); renderAll(); return; }
      if (actionKey === 'RIGHT') { CalcEditor.moveRight(edF); renderAll(); return; }
      if (actionKey === 'UP') { CalcEditor.moveUp(edF); renderAll(); return; }
      if (actionKey === 'DOWN') { CalcEditor.moveDown(edF); renderAll(); return; }
      if (actionKey === '=' || actionKey === 'OK') {
        var exprF = CalcEditor.toEvalText(edF);
        if (CalcEngine.defineFunc) {
          CalcEngine.defineFunc(AppContext.funcDefTarget, exprF);
        }
        // Đồng bộ với ứng dụng Table nếu đã khởi tạo
        if (AppContext.tableState) {
          var targetEd = AppContext.funcDefTarget === 'f' ? AppContext.tableState.fEditor : AppContext.tableState.gEditor;
          CalcEditor.clear(targetEd);
          CalcEditor.insertTextString(targetEd, exprF);
        }
        AppContext.saveState();
        AppContext.overlay = null;
        renderAll();
        return;
      }
      CalcApps.byId.calc.insertByKey(edF, actionKey);
      renderAll();
      return;
    }

    // Bảng tuần hoàn nguyên tố hóa học (Periodic Table) trên Máy 880
    if (AppContext.overlay === 'periodic_table') {
      if (actionKey === 'AC' || actionKey === 'BACK') {
        AppContext.overlay = null;
        renderAll();
        return;
      }
      if (actionKey === 'LEFT') {
        AppContext.ptElementZ = AppContext.ptElementZ > 1 ? AppContext.ptElementZ - 1 : 118;
        renderAll();
        return;
      }
      if (actionKey === 'RIGHT') {
        AppContext.ptElementZ = AppContext.ptElementZ < 118 ? AppContext.ptElementZ + 1 : 1;
        renderAll();
        return;
      }
      if (actionKey === 'UP') {
        AppContext.ptElementZ = Math.max(1, AppContext.ptElementZ - 8);
        renderAll();
        return;
      }
      if (actionKey === 'DOWN') {
        AppContext.ptElementZ = Math.min(118, AppContext.ptElementZ + 8);
        renderAll();
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        var elChosen = CalcEngine.getElement(AppContext.ptElementZ);
        if (elChosen) {
          annotateLastKeyLog(elChosen.symbol + ':' + elChosen.weight);
          insertIntoActiveContext({ text: String(elChosen.weight), evalText: String(elChosen.weight) });
        }
      }
      return;
    }
  }

  function execVar880Action(actIdx) {
    var vn = VAR_LIST_880[AppContext.varIdx] || 'A';
    if (actIdx === 0) {
      // Recall Value: chèn giá trị của biến vào biểu thức
      var val = AppContext.vars[vn] || 0;
      var strVal = CalcEngine.toExact(val) || String(val);
      insertIntoActiveContext({ text: strVal, evalText: String(val) });
    } else if (actIdx === 1) {
      // Store: lưu kết quả Ans hoặc biểu thức hiện tại vào biến
      AppContext.overlay = null;
      if (AppContext.currentAppId === 'calc' && AppContext.calcState) {
        CalcApps.byId.calc.evaluateAndStore(AppContext, vn);
      } else {
        AppContext.vars[vn] = AppContext.vars.Ans || 0;
        AppContext.saveState();
      }
      renderAll();
    } else if (actIdx === 2) {
      // Edit: nhập giá trị mới cho biến
      AppContext.varEditStr = '';
      AppContext.overlay = 'var880_edit';
      renderAll();
    }
  }

  function activateTreeItem(item) {
    if (!item) return;
    annotateLastKeyLog(item.label);
    if (item.children) {
      AppContext.treeStack.push({
        title: item.label,
        items: item.children,
        idx: 0
      });
      renderAll();
      return;
    }
    if (item.action) {
      executeMenuAction(item.action, item);
      return;
    }
    if (item.tpl || item.text) {
      insertIntoActiveContext(item);
    }
  }

  function activatePagedItem(item) {
    if (!item) return;
    annotateLastKeyLog(item.label);
    if (item.sub) {
      AppContext.treeStack = [{
        title: item.label,
        items: item.sub,
        idx: 0
      }];
      AppContext.overlay = 'tree';
      renderAll();
      return;
    }
    if (item.action) {
      executeMenuAction(item.action, item);
      return;
    }
    if (item.tpl || item.text) {
      insertIntoActiveContext(item);
    }
  }

  function annotateLastKeyLog(note) {
    if (!note || AppContext.keyLog.length === 0) return;
    var last = AppContext.keyLog[AppContext.keyLog.length - 1];
    if (last && last.text.indexOf('(') === -1) {
      last.text += ' (' + note + ')';
      renderKeyLog();
    }
  }

  // Xử lý khi bấm một nút trên bàn phím ảo (theo đối tượng phím kObj)
  function handleKeyObjectPress(kObj) {
    if (!kObj) return;
    var id = kObj.id;

    // Phím SHIFT
    if (id === 'SHIFT') {
      AppContext.shiftActive = !AppContext.shiftActive;
      if (AppContext.shiftActive) AppContext.alphaActive = false;
      recordKeyLog('SHIFT', 'shift', false);
      renderAll();
      return;
    }

    // Phím ALPHA (chỉ có trên Máy 580)
    if (id === 'ALPHA') {
      AppContext.alphaActive = !AppContext.alphaActive;
      if (AppContext.alphaActive) AppContext.shiftActive = false;
      recordKeyLog('ALPHA', 'alpha', false);
      renderAll();
      return;
    }

    var mod = '';
    var act = kObj.normalAct;
    var baseKeyLbl = kObj.plainLbl || stripHtmlTags(kObj.label);
    var extraNote = '';

    if (AppContext.shiftActive) {
      mod = 'shift';
      act = kObj.shiftAct || kObj.normalAct;
      var sLbl = stripHtmlTags(kObj.shiftLbl);
      if (sLbl) extraNote = sLbl;
      AppContext.shiftActive = false;
    } else if (AppContext.alphaActive) {
      mod = 'alpha';
      act = kObj.alphaAct || kObj.normalAct;
      var aLbl = stripHtmlTags(kObj.alphaLbl);
      if (aLbl) extraNote = aLbl;
      AppContext.alphaActive = false;
    }

    dispatchAction(act, baseKeyLbl, mod, extraNote);
  }

  // =========================================================================
  // GẮN SỰ KIỆN CHUỘT / CẢM ỨNG / BÀN PHÍM
  // =========================================================================
  function bindEvents() {
    var lastTouchTime = 0;

    function addFastPress(el, handler) {
      if (!el) return;
      el.addEventListener('touchstart', function (ev) {
        lastTouchTime = Date.now();
        handler(ev);
      }, false);
      el.addEventListener('click', function (ev) {
        if (Date.now() - lastTouchTime < 450) return;
        handler(ev);
      }, false);
    }

    // Thanh chuyển máy: Máy 880 | Máy 580
    var switcherBar = document.getElementById('machine-switcher-bar');
    addFastPress(switcherBar, function (ev) {
      var target = ev.target;
      while (target && target !== switcherBar) {
        var mTarget = target.getAttribute && target.getAttribute('data-switch-machine');
        if (mTarget) {
          ev.preventDefault();
          AppContext.switchMachine(mTarget);
          return;
        }
        target = target.parentNode;
      }
    });

    var shell = document.getElementById('calc-shell');
    addFastPress(shell, function (ev) {
      var target = ev.target;
      while (target && target !== shell) {
        // Tương tác trên màn hình LCD
        var lcdAct = target.getAttribute && target.getAttribute('data-action');
        if (lcdAct) {
          ev.preventDefault();
          handleLcdTouch(lcdAct, target);
          return;
        }
        // Phím điều hướng D-Pad
        var dpad = target.getAttribute && target.getAttribute('data-dpad');
        if (dpad) {
          ev.preventDefault();
          var dLbl = { 'UP': '▲', 'DOWN': '▼', 'LEFT': '◀', 'RIGHT': '▶', 'OK': 'OK' }[dpad];
          AppContext.shiftActive = false;
          AppContext.alphaActive = false;
          dispatchAction(dpad, dLbl, '');
          return;
        }
        // Phím bất kỳ theo data-key-id
        var keyId = target.getAttribute && target.getAttribute('data-key-id');
        if (keyId && activeKeyLookup[keyId]) {
          ev.preventDefault();
          handleKeyObjectPress(activeKeyLookup[keyId]);
          return;
        }
        target = target.parentNode;
      }
    });

    // Các nút của thanh Nhật ký phím
    var btnClearLog = document.getElementById('btn-keylog-clear');
    addFastPress(btnClearLog, function () {
      AppContext.keyLog = [];
      renderKeyLog();
    });

    var btnKeepLog = document.getElementById('btn-keylog-keep');
    addFastPress(btnKeepLog, function () {
      AppContext.keepKeyLog = !AppContext.keepKeyLog;
      btnKeepLog.className = 'keylog-btn' + (AppContext.keepKeyLog ? ' active' : '');
      btnKeepLog.innerHTML = AppContext.keepKeyLog ? 'Giữ lại: BẬT' : 'Giữ lại: TẮT';
    });

    var btnToggleLog = document.getElementById('btn-keylog-toggle');
    addFastPress(btnToggleLog, function () {
      AppContext.showKeyLog = !AppContext.showKeyLog;
      renderKeyLog();
      updateScale();
    });

    // Bàn phím cứng của máy tính
    window.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var k = ev.key;
      var eqLabel = AppContext.machineId === '880' ? 'EXE' : '=';
      var delLabel = AppContext.machineId === '880' ? '⌫' : 'DEL';
      var map = {
        '0': ['0', '0'], '1': ['1', '1'], '2': ['2', '2'], '3': ['3', '3'], '4': ['4', '4'],
        '5': ['5', '5'], '6': ['6', '6'], '7': ['7', '7'], '8': ['8', '8'], '9': ['9', '9'],
        '.': ['.', '.'], ',': [',', ','],
        '+': ['+', '+'], '-': ['-', '−'], '*': ['*', '×'], '/': ['FRAC', '■/□'],
        '^': ['POW', 'x^■'], '(': ['(', '('], ')': [')', ')'],
        'Enter': ['=', eqLabel], '=': ['=', eqLabel],
        'Backspace': ['DEL', delLabel], 'Delete': ['DEL', delLabel],
        'Escape': ['AC', 'AC'],
        'ArrowLeft': ['LEFT', '◀'], 'ArrowRight': ['RIGHT', '▶'],
        'ArrowUp': ['UP', '▲'], 'ArrowDown': ['DOWN', '▼'],
        's': ['sin', 'sin'], 'c': ['cos', 'cos'], 't': ['tan', 'tan'],
        'l': ['ln', 'ln'], 'r': ['SQRT', '√■'], 'p': ['PI', 'π'],
        'x': ['x', 'x'], 'y': ['VAR_y', 'y'], 'z': ['VAR_z', 'z'], 'i': ['COMPLEX_I', 'i'],
        '!': ['FACTORIAL', 'x!'], '%': ['PERCENT', '%']
      };
      if (map[k]) {
        ev.preventDefault();
        AppContext.shiftActive = false;
        AppContext.alphaActive = false;
        dispatchAction(map[k][0], map[k][1], '');
      }
    }, false);

    // Lắng nghe postMessage từ bảng hình học
    window.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || d.nguon !== 'bang-hinh-hoc') return;
      if (d.lenh === 'ac') {
        dispatchAction('AC', 'AC', '');
      } else if (d.lenh === 'nhap' && d.vanBan !== undefined) {
        if (AppContext.currentAppId !== 'calc') {
          AppContext.switchApp('calc');
        }
        var st = AppContext.calcState;
        if (st.hasResult) {
          CalcEditor.clear(st.editor);
          st.hasResult = false;
        }
        CalcEditor.insertTextString(st.editor, String(d.vanBan));
        renderAll();
      }
    }, false);

    window.addEventListener('resize', updateScale, false);
  }

  function handleLcdTouch(act, el) {
    if (act === 'menu-pick') {
      var appId = el.getAttribute('data-id');
      AppContext.switchApp(appId);
      return;
    }
    if (act === 'tree-item') {
      var tIdx = parseInt(el.getAttribute('data-idx'), 10);
      var lvl = AppContext.treeStack[AppContext.treeStack.length - 1];
      if (lvl && lvl.items[tIdx]) {
        lvl.idx = tIdx;
        activateTreeItem(lvl.items[tIdx]);
      }
      return;
    }
    if (act === 'paged-item') {
      var pIdx = parseInt(el.getAttribute('data-idx'), 10);
      var pm = AppContext.pagedMenu;
      if (pm && pm.pages[pm.pageIdx] && pm.pages[pm.pageIdx][pIdx]) {
        pm.itemIdx = pIdx;
        activatePagedItem(pm.pages[pm.pageIdx][pIdx]);
      }
      return;
    }
    if (act === 'format-pick') {
      var fIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.formatIdx = fIdx;
      handleOverlayKey('OK');
      return;
    }
    if (act === 'var880-pick') {
      AppContext.varIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.varActIdx = 0;
      AppContext.overlay = 'var880_act';
      renderAll();
      return;
    }
    if (act === 'var880-act') {
      execVar880Action(parseInt(el.getAttribute('data-idx'), 10));
      return;
    }
    if (act === 'rcl580-pick') {
      var rIdx = parseInt(el.getAttribute('data-idx'), 10);
      var rVar = VAR_LIST_580[rIdx] || 'A';
      insertIntoActiveContext({ text: rVar, evalText: rVar });
      return;
    }
    if (act === 'pt-pick') {
      AppContext.ptElementZ = parseInt(el.getAttribute('data-z'), 10);
      handleOverlayKey('OK');
      return;
    }
    if (act === 'verify-optn') {
      CalcApps.byId.verify.pickVerifyOp(AppContext.verifyAppState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'stat-type') {
      var stIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.statState.typeIdx = stIdx;
      CalcApps.byId.stat.onKey('OK', AppContext);
      renderAll();
      return;
    }
    if (act === 'stat-optn') {
      var soIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.statState.optnIdx = soIdx;
      CalcApps.byId.stat.execOptnChoice(AppContext);
      renderAll();
      return;
    }
    if (act === 'stat-calc-btn') {
      CalcApps.byId.stat.commitStatCell(AppContext);
      CalcApps.byId.stat.openOptn(AppContext);
      renderAll();
      return;
    }
    if (act === 'stat-cell') {
      CalcApps.byId.stat.commitStatCell(AppContext);
      AppContext.statState.rowIdx = parseInt(el.getAttribute('data-r'), 10);
      AppContext.statState.colIdx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'tbl-range') {
      AppContext.tableState.rangeIdx = parseInt(el.getAttribute('data-idx'), 10);
      renderAll();
      return;
    }
    if (act === 'tbl-exec') {
      CalcApps.byId.table.buildTable(AppContext);
      renderAll();
      return;
    }
    if (act === 'tbl-open-range') {
      AppContext.tableState.step = 'range';
      AppContext.tableState.rangeIdx = 0;
      renderAll();
      return;
    }
    if (act === 'tbl-cell') {
      CalcApps.byId.table.commitCustomX(AppContext);
      AppContext.tableState.selRow = parseInt(el.getAttribute('data-r'), 10);
      AppContext.tableState.selCol = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'eq-mode') {
      var mMode = el.getAttribute('data-mode');
      AppContext.eqState.mode = mMode;
      AppContext.eqState.step = (mMode === 'solver') ? 'solver_eq' : 'size';
      renderAll();
      return;
    }
    if (act === 'eq-size') {
      AppContext.eqState.size = parseInt(el.getAttribute('data-n'), 10);
      AppContext.eqState.step = 'coeffs';
      AppContext.eqState.rIdx = 0;
      AppContext.eqState.cIdx = 0;
      AppContext.eqState.editStr = '';
      renderAll();
      return;
    }
    if (act === 'eq-solver-var') {
      var svIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.eqState.solverTargetIdx = svIdx;
      CalcApps.byId.eq.onKey('OK', AppContext);
      renderAll();
      return;
    }
    if (act === 'eq-solver-focus') {
      AppContext.eqState.solverFocus = parseInt(el.getAttribute('data-f'), 10);
      renderAll();
      return;
    }
    if (act === 'eq-solver-exec') {
      CalcApps.byId.eq.runSolver880(AppContext);
      renderAll();
      return;
    }
    if (act === 'eq-cell') {
      CalcApps.byId.eq.commitEqCell(AppContext);
      AppContext.eqState.rIdx = parseInt(el.getAttribute('data-r'), 10);
      AppContext.eqState.cIdx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'eq-solve-btn') {
      CalcApps.byId.eq.solveEqNow(AppContext);
      renderAll();
      return;
    }
    if (act === 'ineq-deg') {
      AppContext.ineqState.deg = parseInt(el.getAttribute('data-deg'), 10);
      AppContext.ineqState.step = 'op';
      renderAll();
      return;
    }
    if (act === 'ineq-op') {
      AppContext.ineqState.opIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.ineqState.step = 'coeffs';
      AppContext.ineqState.cIdx = 0;
      AppContext.ineqState.editStr = '';
      renderAll();
      return;
    }
    if (act === 'ineq-cell') {
      CalcApps.byId.ineq.commitIneqCell(AppContext);
      AppContext.ineqState.cIdx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'ineq-solve-btn') {
      CalcApps.byId.ineq.solveIneqNow(AppContext);
      renderAll();
      return;
    }
    if (act === 'ratio-type') {
      AppContext.ratioState.type = parseInt(el.getAttribute('data-type'), 10);
      AppContext.ratioState.step = 'input';
      AppContext.ratioState.idx = 0;
      AppContext.ratioState.editStr = '';
      renderAll();
      return;
    }
    if (act === 'ratio-cell') {
      CalcApps.byId.ratio.commitRatioCell(AppContext);
      AppContext.ratioState.idx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'ratio-solve-btn') {
      CalcApps.byId.ratio.solveRatioNow(AppContext);
      renderAll();
      return;
    }
    if (act === 'cplx-optn') {
      var coIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.complex.pickOptnItem(AppContext, coIdx);
      renderAll();
      return;
    }
    if (act === 'basen-optn') {
      var boIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.baseNState.optnIdx = boIdx;
      CalcApps.byId.baseN.onKey('OK', AppContext);
      renderAll();
      return;
    }
    if (act === 'basen-switch') {
      var bVal = parseInt(el.getAttribute('data-base'), 10);
      CalcApps.byId.baseN.switchBase(AppContext.baseNState, bVal);
      renderAll();
      return;
    }
    if (act === 'basen-open-optn') {
      CalcApps.byId.baseN.openOptn(AppContext);
      renderAll();
      return;
    }
    if (act === 'mat-pick') {
      AppContext.matrixState.selectIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.matrix.confirmSelect(AppContext.matrixState);
      renderAll();
      return;
    }
    if (act === 'mat-dim-focus') {
      AppContext.matrixState.dimFocus = parseInt(el.getAttribute('data-f'), 10);
      renderAll();
      return;
    }
    if (act === 'mat-dim-confirm') {
      CalcApps.byId.matrix.applyMatrixDim(AppContext.matrixState);
      renderAll();
      return;
    }
    if (act === 'mat-optn') {
      CalcApps.byId.matrix.pickMatOptn(AppContext.matrixState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'mat-go-calc') {
      CalcApps.byId.matrix.commitMatCell(AppContext);
      AppContext.matrixState.step = 'calc';
      renderAll();
      return;
    }
    if (act === 'mat-cell') {
      CalcApps.byId.matrix.commitMatCell(AppContext);
      AppContext.matrixState.rIdx = parseInt(el.getAttribute('data-r'), 10);
      AppContext.matrixState.cIdx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'mat-open-optn') {
      CalcApps.byId.matrix.openOptn(AppContext);
      renderAll();
      return;
    }
    if (act === 'mat-open-select') {
      AppContext.matrixState.step = 'select';
      renderAll();
      return;
    }
    if (act === 'mat-res-cell') {
      AppContext.matrixState.resR = parseInt(el.getAttribute('data-r'), 10);
      AppContext.matrixState.resC = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'vct-pick') {
      AppContext.vectorState.selectIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.vector.confirmSelect(AppContext.vectorState);
      renderAll();
      return;
    }
    if (act === 'vct-dim') {
      AppContext.vectorState.dim = parseInt(el.getAttribute('data-d'), 10);
      CalcApps.byId.vector.applyVctDim(AppContext.vectorState);
      renderAll();
      return;
    }
    if (act === 'vct-optn') {
      CalcApps.byId.vector.pickVctOptn(AppContext.vectorState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'vct-go-calc') {
      CalcApps.byId.vector.commitVctCell(AppContext);
      AppContext.vectorState.step = 'calc';
      renderAll();
      return;
    }
    if (act === 'vct-cell') {
      CalcApps.byId.vector.commitVctCell(AppContext);
      AppContext.vectorState.cIdx = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'vct-open-optn') {
      CalcApps.byId.vector.openOptn(AppContext);
      renderAll();
      return;
    }
    if (act === 'vct-open-select') {
      AppContext.vectorState.step = 'select';
      renderAll();
      return;
    }
    if (act === 'dist-pick') {
      AppContext.distState.typeIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.dist.selectDistType(AppContext.distState);
      renderAll();
      return;
    }
    if (act === 'dist-mode') {
      AppContext.distState.inputMode = el.getAttribute('data-m');
      AppContext.distState.paramIdx = 0;
      AppContext.distState.step = 'params';
      renderAll();
      return;
    }
    if (act === 'dist-param') {
      AppContext.distState.paramIdx = parseInt(el.getAttribute('data-idx'), 10);
      renderAll();
      return;
    }
    if (act === 'dist-calc-list') {
      CalcApps.byId.dist.commitListCell(AppContext);
      CalcApps.byId.dist.computeDistList(AppContext);
      renderAll();
      return;
    }
    if (act === 'dist-list-row') {
      CalcApps.byId.dist.commitListCell(AppContext);
      AppContext.distState.listRow = parseInt(el.getAttribute('data-r'), 10);
      renderAll();
      return;
    }
    if (act === 'sheet-optn') {
      CalcApps.byId.sheet.execSheetOptn(AppContext.sheetState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'sheet-fill-focus') {
      AppContext.sheetState.fillFocus = parseInt(el.getAttribute('data-f'), 10);
      renderAll();
      return;
    }
    if (act === 'sheet-fill-exec') {
      AppContext.sheetState.fillFocus = 2;
      CalcApps.byId.sheet.onKey('OK', AppContext);
      renderAll();
      return;
    }
    if (act === 'sheet-cell') {
      CalcApps.byId.sheet.commitSheetCell(AppContext.sheetState);
      AppContext.sheetState.selRow = parseInt(el.getAttribute('data-r'), 10);
      AppContext.sheetState.selCol = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    // Math Box touch actions
    if (act === 'mb-mode') {
      CalcApps.byId.mathbox.selectMenuTool(AppContext.mathboxState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'mb-focus') {
      var mf = parseInt(el.getAttribute('data-f'), 10);
      if (AppContext.mathboxState.focusIdx === mf && (mf === 0 || mf === 2)) {
        CalcApps.byId.mathbox.onKey('RIGHT', AppContext);
      } else {
        AppContext.mathboxState.focusIdx = mf;
      }
      renderAll();
      return;
    }
    if (act === 'mb-exec') {
      AppContext.mathboxState.step = 'res_type';
      renderAll();
      return;
    }
    if (act === 'mb-restype') {
      AppContext.mathboxState.resTypeIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.mathbox.runSimulation(AppContext.mathboxState);
      renderAll();
      return;
    }
    if (act === 'mb-toggle-view') {
      AppContext.mathboxState.resTypeIdx = AppContext.mathboxState.resTypeIdx === 0 ? 1 : 0;
      renderAll();
      return;
    }
    if (act === 'mb-retry') {
      CalcApps.byId.mathbox.runSimulation(AppContext.mathboxState);
      renderAll();
      return;
    }
    if (act === 'mb-nl-slot') {
      AppContext.mathboxState.nlFocusIdx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.mathboxState.nlTypeIdx = 0;
      AppContext.mathboxState.step = 'nl_type';
      renderAll();
      return;
    }
    if (act === 'mb-nl-exec') {
      AppContext.mathboxState.step = 'nl_graph';
      renderAll();
      return;
    }
    if (act === 'mb-nl-type') {
      AppContext.mathboxState.nlTypeIdx = parseInt(el.getAttribute('data-idx'), 10);
      CalcApps.byId.mathbox.onKey('OK', AppContext);
      renderAll();
      return;
    }
    if (act === 'mb-nl-vfocus') {
      AppContext.mathboxState.nlValFocus = parseInt(el.getAttribute('data-f'), 10);
      renderAll();
      return;
    }
    if (act === 'mb-nl-back') {
      AppContext.mathboxState.step = 'nl_list';
      renderAll();
      return;
    }
    if (act === 'mb-cir-focus') {
      var cf = parseInt(el.getAttribute('data-f'), 10);
      if (cf === 0 && AppContext.mathboxState.cirFocus === 0) {
        CalcApps.byId.mathbox.onKey('RIGHT', AppContext);
      } else {
        AppContext.mathboxState.cirFocus = cf;
      }
      renderAll();
      return;
    }
    if (act === 'mb-cir-exec') {
      CalcApps.byId.mathbox.executeCircle(AppContext);
      renderAll();
      return;
    }
  }

  // Co giãn tự động theo kích thước cửa sổ / iframe bằng transform: scale
  function updateScale() {
    var scaleWrap = document.getElementById('calc-scale-wrap');
    var unit = document.getElementById('calc-unit');
    if (!scaleWrap || !unit) return;

    unit.style.transform = 'none';
    unit.style.webkitTransform = 'none';

    var isCompact = document.body.className.indexOf('mode-compact') !== -1;
    var winW = window.innerWidth || document.documentElement.clientWidth || 380;
    var winH = window.innerHeight || document.documentElement.clientHeight || 720;

    var natW = unit.offsetWidth || 356;
    var natH = unit.offsetHeight || 680;

    var availW = winW - (isCompact ? 8 : 24);
    var availH = isCompact ? (winH - 8) : Math.max(natH, winH - 110);

    var scaleW = availW / natW;
    var scaleH = availH / natH;
    var scale = isCompact ? Math.min(scaleW, scaleH) : Math.min(1.08, scaleW);
    if (scale <= 0.2) scale = 0.2;

    unit.style.transformOrigin = 'top center';
    unit.style.webkitTransformOrigin = 'top center';
    unit.style.transform = 'scale(' + scale.toFixed(4) + ')';
    unit.style.webkitTransform = 'scale(' + scale.toFixed(4) + ')';

    scaleWrap.style.height = Math.ceil(natH * scale) + 'px';
  }

  function initUI() {
    AppContext.loadState();

    var params = parseQueryParams();
    // Hỗ trợ ?may=880|580 (mặc định 880) và tương thích ngược ?kieu=a|b (a->580, b->880)
    if (params.may === '580' || params.may === '880') {
      AppContext.machineId = params.may;
    } else if (params.kieu === 'a') {
      AppContext.machineId = '580';
    } else if (params.kieu === 'b') {
      AppContext.machineId = '880';
    }

    var activeSlot = AppContext.perMachineStore[AppContext.machineId];
    if (activeSlot) {
      AppContext.settings = activeSlot.settings;
      AppContext.settings.modelType = AppContext.machineId === '580' ? 'a' : 'b';
      AppContext.vars = activeSlot.vars;
      if (activeSlot.definedFuncs && CalcEngine.definedFuncs) {
        CalcEngine.definedFuncs.f = activeSlot.definedFuncs.f || '';
        CalcEngine.definedFuncs.g = activeSlot.definedFuncs.g || '';
      }
    }

    var compact = (params.gon === '1') || isInIframe();
    if (params.gon === '0') compact = false;

    if (params.nhatky === '0') AppContext.showKeyLog = false;
    else if (params.nhatky === '1') AppContext.showKeyLog = true;

    var bodyCls = [];
    if (compact) bodyCls.push('mode-compact');
    if (params.nen === 'trong-suot') bodyCls.push('bg-transparent');
    document.body.className = bodyCls.join(' ');

    updateBrandAndSwitcherDOM();
    buildKeypadDOM();
    CalcApps.byId.calc.init(AppContext);
    bindEvents();
    renderAll();
    renderKeyLog();
    updateScale();
    setTimeout(updateScale, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI, false);
  } else {
    initUI();
  }

  root.CalcUI = {
    context: AppContext,
    dispatchAction: dispatchAction,
    renderAll: renderAll
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
