/* Giao diện, bàn phím ảo, nhật ký phím và kết nối iframe cho Máy tính Thầy Minh (ES5) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcEditor = root.CalcEditor;
  var CalcApps = root.CalcApps;

  var STORAGE_KEY = 'ttm_may_tinh_state_v1';

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  // Định nghĩa các phím của bàn phím ảo
  var TOP_KEYS = [
    { id: 'SHIFT', label: 'SHIFT', cls: 'btn-shift' },
    { id: 'ALPHA', label: 'ALPHA', cls: 'btn-alpha' },
    { id: 'HOME', label: 'HOME', shiftLbl: 'CÀI ĐẶT', cls: 'btn-ctrl' },
    { id: 'MENU', label: 'MENU', shiftLbl: 'SETUP', cls: 'btn-ctrl' },
    { id: 'ON_AC', label: 'ON', shiftLbl: 'OFF', cls: 'btn-ctrl btn-on' }
  ];

  var FUNC_BAR_KEYS = [
    { id: 'OPTN', label: 'OPTN', shiftLbl: 'TOOLS', alphaLbl: '' },
    { id: 'CALC_BTN', label: 'CALC', shiftLbl: 'SOLVE', alphaLbl: '=' },
    { id: 'VAR_BTN', label: 'BIẾN', shiftLbl: 'RCL', alphaLbl: '' },
    { id: 'CATALOG_BTN', label: 'DANH MỤC', shiftLbl: 'HẰNG', alphaLbl: '' }
  ];

  // Lưới 24 phím hàm khoa học (6 cột x 4 hàng)
  var SCI_KEYS = [
    // Hàng 1
    { id: 'KEY_X', label: '<i>x</i>', shiftLbl: '|<i>x</i>|', alphaLbl: '<i>x</i>', normalAct: 'x', shiftAct: 'ABS', alphaAct: 'VAR_x' },
    { id: 'KEY_FRAC', label: '■/□', shiftLbl: '□■/□', alphaLbl: '÷R', normalAct: 'FRAC', shiftAct: 'MIXED', alphaAct: 'DIV_R' },
    { id: 'KEY_SQRT', label: '√■', shiftLbl: '∛■', alphaLbl: 'Pol', normalAct: 'SQRT', shiftAct: 'CBRT', alphaAct: 'POL' },
    { id: 'KEY_SQ', label: '<i>x</i>²', shiftLbl: '<i>x</i>³', alphaLbl: 'Rec', baseLbl: 'DEC', normalAct: 'SQ', shiftAct: 'CUBE', alphaAct: 'REC' },
    { id: 'KEY_POW', label: '<i>x</i>^■', shiftLbl: 'ⁿ√■', alphaLbl: 'GCD', baseLbl: 'HEX', normalAct: 'POW', shiftAct: 'ROOT', alphaAct: 'GCD_FN' },
    { id: 'KEY_LOG', label: 'log', shiftLbl: '10^■', alphaLbl: 'LCM', baseLbl: 'BIN', normalAct: 'log', shiftAct: 'POW10', alphaAct: 'LCM_FN' },
    // Hàng 2
    { id: 'KEY_LN', label: 'ln', shiftLbl: '<i>e</i>^■', alphaLbl: '<i>e</i>', baseLbl: 'OCT', normalAct: 'ln', shiftAct: 'POWE', alphaAct: 'E_CONST' },
    { id: 'KEY_NEG', label: '(−)', shiftLbl: 'log■□', alphaLbl: 'A', normalAct: '(-)', shiftAct: 'LOG2', alphaAct: 'VAR_A' },
    { id: 'KEY_DMS', label: '°\'"', shiftLbl: 'FACT', alphaLbl: 'B', normalAct: 'DMS', shiftAct: 'FACT', alphaAct: 'VAR_B' },
    { id: 'KEY_INV', label: '<i>x</i>⁻¹', shiftLbl: '<i>x</i>!', alphaLbl: 'C', normalAct: 'INV', shiftAct: 'FACTORIAL', alphaAct: 'VAR_C' },
    { id: 'KEY_SIN', label: 'sin', shiftLbl: 'sin⁻¹', alphaLbl: 'D', normalAct: 'sin', shiftAct: 'asin', alphaAct: 'VAR_D' },
    { id: 'KEY_COS', label: 'cos', shiftLbl: 'cos⁻¹', alphaLbl: 'E', normalAct: 'cos', shiftAct: 'acos', alphaAct: 'VAR_E' },
    // Hàng 3
    { id: 'KEY_TAN', label: 'tan', shiftLbl: 'tan⁻¹', alphaLbl: 'F', normalAct: 'tan', shiftAct: 'atan', alphaAct: 'VAR_F' },
    { id: 'KEY_STO', label: 'STO', shiftLbl: 'RCL', alphaLbl: '<i>x</i>', normalAct: 'STO', shiftAct: 'RCL', alphaAct: 'VAR_x' },
    { id: 'KEY_ENG', label: 'ENG', shiftLbl: '←ENG', alphaLbl: '<i>i</i>', normalAct: 'ENG', shiftAct: 'ENG_BACK', alphaAct: 'COMPLEX_I' },
    { id: 'KEY_LPAREN', label: '(', shiftLbl: '%', alphaLbl: '(', normalAct: '(', shiftAct: 'PERCENT', alphaAct: '(' },
    { id: 'KEY_RPAREN', label: ')', shiftLbl: ',', alphaLbl: '<i>x</i>', normalAct: ')', shiftAct: ',', alphaAct: 'VAR_x' },
    { id: 'KEY_SD', label: 'S⇔D', shiftLbl: 'a b/c', alphaLbl: '<i>y</i>', normalAct: 'S_D', shiftAct: 'MIXED_SD', alphaAct: 'VAR_y' },
    // Hàng 4
    { id: 'KEY_MPLUS', label: 'M+', shiftLbl: 'M−', alphaLbl: 'M', normalAct: 'M+', shiftAct: 'M-', alphaAct: 'VAR_M' },
    { id: 'KEY_INTEG', label: '∫d<i>x</i>', shiftLbl: 'd/d<i>x</i>', alphaLbl: ':', normalAct: 'INTEG', shiftAct: 'DERIV', alphaAct: ',' },
    { id: 'KEY_SUM', label: '∑', shiftLbl: '∏', alphaLbl: '', normalAct: 'SUM', shiftAct: 'PROD', alphaAct: 'PROD' },
    { id: 'KEY_LOG2', label: 'log■□', shiftLbl: '|<i>x</i>|', alphaLbl: '', normalAct: 'LOG2', shiftAct: 'ABS', alphaAct: 'ABS' },
    { id: 'KEY_NCR', label: 'nCr', shiftLbl: 'nPr', alphaLbl: '', normalAct: 'NCR', shiftAct: 'NPR', alphaAct: 'NPR' },
    { id: 'KEY_FACT', label: 'FACT', shiftLbl: '÷R', alphaLbl: '∠', normalAct: 'FACT', shiftAct: 'DIV_R', alphaAct: 'ANGLE_SYM' }
  ];

  // Lưới 20 phím số và phép tính chính (5 cột x 4 hàng)
  var NUM_KEYS = [
    { id: 'KEY_7', label: '7', shiftLbl: '', alphaLbl: '', normalAct: '7', shiftAct: '7', alphaAct: '7', cls: 'btn-num' },
    { id: 'KEY_8', label: '8', shiftLbl: '', alphaLbl: '', normalAct: '8', shiftAct: '8', alphaAct: '8', cls: 'btn-num' },
    { id: 'KEY_9', label: '9', shiftLbl: '', alphaLbl: '', normalAct: '9', shiftAct: '9', alphaAct: '9', cls: 'btn-num' },
    { id: 'KEY_DEL', label: 'DEL', shiftLbl: 'INS', alphaLbl: '', normalAct: 'DEL', shiftAct: 'INS', alphaAct: 'DEL', cls: 'btn-accent' },
    { id: 'KEY_AC', label: 'AC', shiftLbl: 'OFF', alphaLbl: '', normalAct: 'AC', shiftAct: 'OFF', alphaAct: 'AC', cls: 'btn-accent' },

    { id: 'KEY_4', label: '4', shiftLbl: '', alphaLbl: '', normalAct: '4', shiftAct: '4', alphaAct: '4', cls: 'btn-num' },
    { id: 'KEY_5', label: '5', shiftLbl: '', alphaLbl: '', normalAct: '5', shiftAct: '5', alphaAct: '5', cls: 'btn-num' },
    { id: 'KEY_6', label: '6', shiftLbl: '', alphaLbl: '', normalAct: '6', shiftAct: '6', alphaAct: '6', cls: 'btn-num' },
    { id: 'KEY_MUL', label: '×', shiftLbl: 'nPr', alphaLbl: 'GCD', normalAct: '*', shiftAct: 'NPR', alphaAct: 'GCD_FN', cls: 'btn-op' },
    { id: 'KEY_DIV', label: '÷', shiftLbl: 'nCr', alphaLbl: 'LCM', normalAct: '/', shiftAct: 'NCR', alphaAct: 'LCM_FN', cls: 'btn-op' },

    { id: 'KEY_1', label: '1', shiftLbl: '', alphaLbl: '', normalAct: '1', shiftAct: '1', alphaAct: '1', cls: 'btn-num' },
    { id: 'KEY_2', label: '2', shiftLbl: '', alphaLbl: '', normalAct: '2', shiftAct: '2', alphaAct: '2', cls: 'btn-num' },
    { id: 'KEY_3', label: '3', shiftLbl: '', alphaLbl: '', normalAct: '3', shiftAct: '3', alphaAct: '3', cls: 'btn-num' },
    { id: 'KEY_ADD', label: '+', shiftLbl: 'Pol', alphaLbl: 'Int', normalAct: '+', shiftAct: 'POL', alphaAct: 'INT_FN', cls: 'btn-op' },
    { id: 'KEY_SUB', label: '−', shiftLbl: 'Rec', alphaLbl: 'Intg', normalAct: '-', shiftAct: 'REC', alphaAct: 'INTG_FN', cls: 'btn-op' },

    { id: 'KEY_0', label: '0', shiftLbl: 'Rnd', alphaLbl: '', normalAct: '0', shiftAct: 'RND_FN', alphaAct: '0', cls: 'btn-num' },
    { id: 'KEY_DOT', label: '.', shiftLbl: 'Ran#', alphaLbl: 'RanInt', normalAct: '.', shiftAct: 'RAN', alphaAct: 'RANINT', cls: 'btn-num' },
    { id: 'KEY_EXP', label: '×10<sup>x</sup>', plainLbl: '×10^x', shiftLbl: 'π', alphaLbl: '<i>e</i>', normalAct: 'EXP10', shiftAct: 'PI', alphaAct: 'E_CONST', cls: 'btn-num' },
    { id: 'KEY_ANS', label: 'Ans', shiftLbl: 'PreAns', alphaLbl: '', normalAct: 'ANS', shiftAct: 'PREANS', alphaAct: 'ANS', cls: 'btn-num' },
    { id: 'KEY_EQ', label: '=', shiftLbl: '≈', alphaLbl: '', normalAct: '=', shiftAct: 'APPROX_EQ', alphaAct: '=', cls: 'btn-eq' }
  ];

  // Trạng thái toàn cục của ứng dụng máy tính
  var AppContext = {
    currentAppId: 'calc',
    overlay: null, // null | 'menu' | 'setup' | 'optn' | 'optn_hyp' | 'catalog' | 'vars' | 'off'
    menuIdx: 0,
    setupIdx: 0,
    setupSubMode: null, // null | 'fix' | 'sci'
    optnIdx: 0,
    catalogIdx: 0,
    varIdx: 0,
    shiftActive: false,
    alphaActive: false,
    statusHint: '',
    keyLog: [], // [{ text, mod: ''|'shift'|'alpha' }]
    keepKeyLog: false,
    showKeyLog: true,
    pendingNewCalcLogReset: false,
    settings: {
      angle: 'deg', // 'deg' | 'rad' | 'gra'
      fmtMode: 'norm1', // 'norm1' | 'norm2' | 'fix' | 'sci'
      fmtDigits: 2,
      ioMode: 'math', // 'math' | 'line'
      fracMode: 'improper', // 'improper' (d/c) | 'mixed' (a b/c)
      tableTwoFuncs: true,
      statFreq: false,
      complexForm: 'rect', // 'rect' (a+bi) | 'polar' (r∠θ)
      modelType: 'a', // 'a' (580) | 'b' (880)
      largeFont: false
    },
    vars: {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0,
      x: 0, y: 0, M: 0, Ans: 0, PreAns: 0
    },

    getFormatOpts: function () {
      return {
        mode: this.settings.fmtMode,
        digits: this.settings.fmtDigits
      };
    },

    getEvalOpts: function () {
      return {
        angle: this.settings.angle,
        vars: this.vars,
        fix: this.settings.fmtMode === 'fix' ? this.settings.fmtDigits : null,
        format: this.getFormatOpts()
      };
    },

    setStatusHint: function (msg) {
      this.statusHint = msg || '';
    },

    openMenu: function () {
      this.overlay = 'menu';
      var apps = CalcApps.getVisibleApps(this.settings.modelType);
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
      app.init(this);
      renderAll();
    },

    onNewExpressionAfterEqual: function () {
      if (!this.keepKeyLog) {
        // Giữ lại viên phím vừa bấm nếu nó đã được ghi, hoặc đặt cờ xóa trước khi ghi phím mới
      }
    },

    saveState: function () {
      try {
        if (window.localStorage) {
          var data = JSON.stringify({
            settings: this.settings,
            vars: this.vars
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
            if (parsed.settings) {
              for (var k in parsed.settings) {
                if (Object.prototype.hasOwnProperty.call(parsed.settings, k)) {
                  this.settings[k] = parsed.settings[k];
                }
              }
            }
            if (parsed.vars) {
              for (var vk in parsed.vars) {
                if (Object.prototype.hasOwnProperty.call(parsed.vars, vk) && typeof parsed.vars[vk] === 'number') {
                  this.vars[vk] = parsed.vars[vk];
                }
              }
            }
          }
        }
      } catch (e) {}
    },

    resetDefaults: function () {
      this.settings = {
        angle: 'deg',
        fmtMode: 'norm1',
        fmtDigits: 2,
        ioMode: 'math',
        fracMode: 'improper',
        tableTwoFuncs: true,
        statFreq: false,
        complexForm: 'rect',
        modelType: this.settings.modelType || 'a',
        largeFont: false
      };
      this.saveState();
      if (this.calcState) {
        this.calcState.editor.lineMode = false;
      }
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

  // Ghi nhận phím bấm vào nhật ký phím
  function recordKeyLog(label, modType, isStartingNewAfterEq) {
    if (isStartingNewAfterEq && !AppContext.keepKeyLog) {
      AppContext.keyLog = [];
    }

    // Nếu phím là SHIFT hoặc ALPHA: nếu viên cuối đang là SHIFT/ALPHA cùng loại thì xóa (hủy), ngược lại thêm viên tạm
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

    // Nếu viên cuối là SHIFT/ALPHA đang chờ gộp -> gộp thành "SHIFT sin" hoặc "ALPHA A"
    var prev = AppContext.keyLog.length > 0 ? AppContext.keyLog[AppContext.keyLog.length - 1] : null;
    if (prev && prev.pendingMod) {
      var prefix = prev.pendingMod === 'shift' ? 'SHIFT ' : 'ALPHA ';
      prev.text = prefix + label;
      prev.mod = prev.pendingMod;
      delete prev.pendingMod;
    } else {
      AppContext.keyLog.push({
        text: (modType === 'shift' ? 'SHIFT ' : (modType === 'alpha' ? 'ALPHA ' : '')) + label,
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

  // Xây dựng khung bàn phím ảo một lần khi khởi động
  function buildKeypadDOM() {
    var topEl = document.getElementById('calc-top-row');
    var sciEl = document.getElementById('calc-sci-grid');
    var numEl = document.getElementById('calc-num-grid');
    if (!topEl || !sciEl || !numEl) return;

    // Cụm phím điều khiển + D-Pad
    var topHtml =
      '<div class="top-side-col">' +
        '<div class="top-btn-pair">' +
          renderTopBtn(TOP_KEYS[0]) +
          renderTopBtn(TOP_KEYS[1]) +
        '</div>' +
        '<div class="top-btn-pair">' +
          renderFuncBtn(FUNC_BAR_KEYS[0]) +
          renderFuncBtn(FUNC_BAR_KEYS[1]) +
        '</div>' +
      '</div>' +
      '<div class="dpad-wrap">' +
        '<button type="button" class="dpad-btn dpad-up" data-dpad="UP" title="Lên">▲</button>' +
        '<button type="button" class="dpad-btn dpad-left" data-dpad="LEFT" title="Trái">◀</button>' +
        '<button type="button" class="dpad-btn dpad-ok" data-dpad="OK" title="Chọn / OK">OK</button>' +
        '<button type="button" class="dpad-btn dpad-right" data-dpad="RIGHT" title="Phải">▶</button>' +
        '<button type="button" class="dpad-btn dpad-down" data-dpad="DOWN" title="Xuống">▼</button>' +
      '</div>' +
      '<div class="top-side-col">' +
        '<div class="top-btn-pair">' +
          renderTopBtn(TOP_KEYS[2]) +
          renderTopBtn(TOP_KEYS[3]) +
          renderTopBtn(TOP_KEYS[4]) +
        '</div>' +
        '<div class="top-btn-pair">' +
          renderFuncBtn(FUNC_BAR_KEYS[2]) +
          renderFuncBtn(FUNC_BAR_KEYS[3]) +
        '</div>' +
      '</div>';
    topEl.innerHTML = topHtml;

    // Lưới phím hàm khoa học
    var sciHtml = '';
    for (var i = 0; i < SCI_KEYS.length; i++) {
      var k = SCI_KEYS[i];
      sciHtml +=
        '<div class="key-cell">' +
          '<div class="key-sub-row">' +
            '<span class="sub-shift">' + (k.shiftLbl || '') + '</span>' +
            (k.baseLbl ? '<span class="sub-base">' + k.baseLbl + '</span>' : '') +
            '<span class="sub-alpha">' + (k.alphaLbl || '') + '</span>' +
          '</div>' +
          '<button type="button" class="calc-btn btn-sci" data-sci-idx="' + i + '">' + k.label + '</button>' +
        '</div>';
    }
    sciEl.innerHTML = sciHtml;

    // Lưới phím số và phép tính
    var numHtml = '';
    for (var j = 0; j < NUM_KEYS.length; j++) {
      var nk = NUM_KEYS[j];
      numHtml +=
        '<div class="key-cell">' +
          '<div class="key-sub-row">' +
            '<span class="sub-shift">' + (nk.shiftLbl || '') + '</span>' +
            '<span class="sub-alpha">' + (nk.alphaLbl || '') + '</span>' +
          '</div>' +
          '<button type="button" class="calc-btn ' + (nk.cls || 'btn-num') + '" data-num-idx="' + j + '">' + nk.label + '</button>' +
        '</div>';
    }
    numEl.innerHTML = numHtml;
  }

  function renderTopBtn(b) {
    return (
      '<div class="key-cell">' +
        '<div class="key-sub-row"><span class="sub-shift">' + (b.shiftLbl || '') + '</span></div>' +
        '<button type="button" class="calc-btn ' + b.cls + '" data-top-id="' + b.id + '">' + b.label + '</button>' +
      '</div>'
    );
  }

  function renderFuncBtn(b) {
    return (
      '<div class="key-cell">' +
        '<div class="key-sub-row">' +
          '<span class="sub-shift">' + (b.shiftLbl || '') + '</span>' +
          '<span class="sub-alpha">' + (b.alphaLbl || '') + '</span>' +
        '</div>' +
        '<button type="button" class="calc-btn btn-sci-sm" data-func-id="' + b.id + '">' + b.label + '</button>' +
      '</div>'
    );
  }

  // Vẽ màn hình LCD và thanh trạng thái
  function renderAll() {
    var shell = document.getElementById('calc-shell');
    if (shell) {
      shell.className = 'calc-shell model-' + AppContext.settings.modelType +
                        (AppContext.settings.largeFont ? ' font-large' : '');
    }

    var statusEl = document.getElementById('lcd-status-bar');
    var bodyEl = document.getElementById('lcd-body');
    if (!statusEl || !bodyEl) return;

    var curApp = CalcApps.byId[AppContext.currentAppId] || CalcApps.byId.calc;
    var angBadge = AppContext.settings.angle === 'rad' ? 'R' : (AppContext.settings.angle === 'gra' ? 'G' : 'D');
    var fmtBadge = '';
    if (AppContext.settings.fmtMode === 'fix') fmtBadge = 'FIX';
    else if (AppContext.settings.fmtMode === 'sci') fmtBadge = 'SCI';
    var mathBadge = AppContext.settings.ioMode === 'math' ? 'Math' : 'Line';
    var cplxBadge = '';
    if (AppContext.currentAppId === 'complex') {
      cplxBadge = AppContext.settings.complexForm === 'polar' ? '∠' : '<i>i</i>';
    }

    statusEl.innerHTML =
      '<div class="st-left">' +
        '<span class="st-badge st-s ' + (AppContext.shiftActive ? 'on' : '') + '">S</span>' +
        '<span class="st-badge st-a ' + (AppContext.alphaActive ? 'on' : '') + '">A</span>' +
        '<span class="st-badge on">' + angBadge + '</span>' +
        '<span class="st-badge ' + (Math.abs(AppContext.vars.M) > 1e-15 ? 'on' : '') + '">M</span>' +
        (cplxBadge ? '<span class="st-badge on">' + cplxBadge + '</span>' : '') +
        (fmtBadge ? '<span class="st-badge on">' + fmtBadge + '</span>' : '') +
        '<span class="st-badge on">' + mathBadge + '</span>' +
      '</div>' +
      '<div class="st-right">' +
        escapeHtml(AppContext.statusHint || (curApp.code + ':' + curApp.name)) +
      '</div>';

    if (AppContext.overlay === 'off') {
      bodyEl.innerHTML =
        '<div class="lcd-off-screen">' +
          '<div class="lcd-off-title">Máy tính Thầy Minh</div>' +
          '<div class="lcd-off-sub">Đã tắt màn hình — Bấm ON hoặc AC để bật lại</div>' +
        '</div>';
      return;
    }

    if (AppContext.overlay === 'menu') {
      bodyEl.innerHTML = renderMenuOverlay();
      return;
    }

    if (AppContext.overlay === 'setup') {
      bodyEl.innerHTML = renderSetupOverlay();
      return;
    }

    if (AppContext.overlay === 'optn' || AppContext.overlay === 'optn_hyp') {
      bodyEl.innerHTML = renderOptnOverlay();
      return;
    }

    if (AppContext.overlay === 'catalog') {
      bodyEl.innerHTML = renderCatalogOverlay();
      return;
    }

    if (AppContext.overlay === 'vars') {
      bodyEl.innerHTML = renderVarsOverlay();
      return;
    }

    bodyEl.innerHTML = curApp.render(AppContext);
    if (curApp.afterRender) {
      curApp.afterRender(AppContext);
    }
  }

  function renderMenuOverlay() {
    var apps = CalcApps.getVisibleApps(AppContext.settings.modelType);
    if (AppContext.menuIdx >= apps.length) AppContext.menuIdx = 0;
    var selApp = apps[AppContext.menuIdx];
    var html = '<div class="lcd-menu-wrap">';
    html += '<div class="lcd-menu-header">MENU ỨNG DỤNG — Chọn: <b>' + escapeHtml(selApp.code + ': ' + selApp.name) + '</b></div>';
    html += '<div class="lcd-menu-grid">';
    for (var i = 0; i < apps.length; i++) {
      var a = apps[i];
      var cls = 'lcd-menu-cell' + (i === AppContext.menuIdx ? ' active' : '') + (a.stage === 2 ? ' stage2' : '');
      html +=
        '<div class="' + cls + '" data-action="menu-pick" data-id="' + a.id + '">' +
          '<div class="menu-cell-code">' + escapeHtml(a.code) + '</div>' +
          '<div class="menu-cell-icon">' + escapeHtml(a.icon) + '</div>' +
          '<div class="menu-cell-name">' + escapeHtml(a.name) + '</div>' +
        '</div>';
    }
    html += '</div></div>';
    return html;
  }

  var SETUP_ITEMS = [
    { key: 'angle', label: '1. Đơn vị góc (Độ / Rad / Grad)' },
    { key: 'fmt', label: '2. Định dạng số (Norm / Fix / Sci)' },
    { key: 'io', label: '3. Nhập/Xuất (Math I/O ↔ Line)' },
    { key: 'frac', label: '4. Kết quả phân số (d/c ↔ a b/c)' },
    { key: 'tbl', label: '5. Bảng giá trị (f(x) ↔ f(x),g(x))' },
    { key: 'freq', label: '6. Tần số thống kê (Bật ↔ Tắt)' },
    { key: 'model', label: '7. Kiểu máy (Kiểu A ↔ Kiểu B)' },
    { key: 'font', label: '8. Cỡ chữ màn hình (Thường ↔ Lớn)' },
    { key: 'cplx', label: '9. Kết quả phức (a+bi ↔ r∠θ)' },
    { key: 'reset', label: '0. Khôi phục cài đặt mặc định' }
  ];

  function getSetupValueText(key) {
    var s = AppContext.settings;
    if (key === 'angle') return s.angle === 'deg' ? 'Độ (D)' : (s.angle === 'rad' ? 'Radian (R)' : 'Grad (G)');
    if (key === 'fmt') {
      if (s.fmtMode === 'fix') return 'Fix ' + s.fmtDigits;
      if (s.fmtMode === 'sci') return 'Sci ' + s.fmtDigits;
      return s.fmtMode === 'norm2' ? 'Norm 2' : 'Norm 1';
    }
    if (key === 'io') return s.ioMode === 'math' ? 'Tự nhiên (Math)' : 'Một dòng (Line)';
    if (key === 'frac') return s.fracMode === 'mixed' ? 'a b/c (Hỗn số)' : 'd/c (Phân số)';
    if (key === 'tbl') return s.tableTwoFuncs ? 'f(x), g(x)' : 'Chỉ f(x)';
    if (key === 'freq') return s.statFreq ? 'Bật' : 'Tắt';
    if (key === 'model') return s.modelType === 'b' ? 'Kiểu B (Xanh đậm)' : 'Kiểu A (Xám đen)';
    if (key === 'font') return s.largeFont ? 'Lớn' : 'Bình thường';
    if (key === 'cplx') return s.complexForm === 'polar' ? 'r∠θ (Cực)' : 'a+bi (Đại số)';
    return 'Bấm OK/=';
  }

  function renderSetupOverlay() {
    if (AppContext.setupSubMode === 'fix' || AppContext.setupSubMode === 'sci') {
      var isFix = AppContext.setupSubMode === 'fix';
      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-list-title">' + (isFix ? 'Chọn số chữ số thập phân Fix (0–9):' : 'Chọn số chữ số có nghĩa Sci (1–9, 0=10):') + '</div>' +
          '<div class="lcd-sub-hint">Hãy bấm một phím số từ 0 đến 9</div>' +
        '</div>'
      );
    }

    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">CÀI ĐẶT (SETUP) — Bấm ▲▼ hoặc 0–9, OK để đổi:</div>';
    for (var i = 0; i < SETUP_ITEMS.length; i++) {
      var it = SETUP_ITEMS[i];
      var cls = (i === AppContext.setupIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html +=
        '<div class="' + cls + '" data-action="setup-item" data-idx="' + i + '">' +
          '<span>' + escapeHtml(it.label) + '</span>' +
          '<b class="setup-val">' + escapeHtml(getSetupValueText(it.key)) + '</b>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function applySetupToggle(idx) {
    var s = AppContext.settings;
    var key = SETUP_ITEMS[idx].key;
    if (key === 'angle') {
      s.angle = s.angle === 'deg' ? 'rad' : (s.angle === 'rad' ? 'gra' : 'deg');
    } else if (key === 'fmt') {
      if (s.fmtMode === 'norm1') s.fmtMode = 'norm2';
      else if (s.fmtMode === 'norm2') { AppContext.setupSubMode = 'fix'; return; }
      else if (s.fmtMode === 'fix') { AppContext.setupSubMode = 'sci'; return; }
      else s.fmtMode = 'norm1';
    } else if (key === 'io') {
      s.ioMode = s.ioMode === 'math' ? 'line' : 'math';
      if (AppContext.calcState) AppContext.calcState.editor.lineMode = (s.ioMode === 'line');
      if (AppContext.complexState) AppContext.complexState.editor.lineMode = (s.ioMode === 'line');
    } else if (key === 'frac') {
      s.fracMode = s.fracMode === 'improper' ? 'mixed' : 'improper';
    } else if (key === 'tbl') {
      s.tableTwoFuncs = !s.tableTwoFuncs;
    } else if (key === 'freq') {
      s.statFreq = !s.statFreq;
    } else if (key === 'model') {
      s.modelType = s.modelType === 'a' ? 'b' : 'a';
    } else if (key === 'font') {
      s.largeFont = !s.largeFont;
    } else if (key === 'cplx') {
      s.complexForm = s.complexForm === 'polar' ? 'rect' : 'polar';
      if (AppContext.complexState && AppContext.complexState.hasResult && AppContext.complexState.lastResult && AppContext.complexState.lastResult.ok) {
        AppContext.complexState.displayMode = s.complexForm === 'polar' ? 'polar_exact' : 'rect_exact';
      }
    } else if (key === 'reset') {
      AppContext.resetDefaults();
      AppContext.overlay = null;
      return;
    }
    AppContext.saveState();
  }

  function renderOptnOverlay() {
    var list = AppContext.overlay === 'optn_hyp' ? CalcApps.HYP_ITEMS : CalcApps.CALC_OPTN_ITEMS;
    var title = AppContext.overlay === 'optn_hyp' ? 'Hàm Hyperbol:' : 'TÙY CHỌN TOÁN HỌC (OPTN):';
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">' + title + '</div>';
    for (var i = 0; i < list.length; i++) {
      var cls = (i === AppContext.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html += '<div class="' + cls + '" data-action="optn-pick" data-idx="' + i + '">' + escapeHtml(list[i].label) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderCatalogOverlay() {
    var list = CalcApps.CATALOG_ITEMS;
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">DANH MỤC HÀM (CATALOG) — ▲▼ + OK:</div>';
    for (var i = 0; i < list.length; i++) {
      var cls = (i === AppContext.catalogIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html += '<div class="' + cls + '" data-action="cat-pick" data-idx="' + i + '">' + escapeHtml(list[i].label) + '</div>';
    }
    html += '</div>';
    return html;
  }

  var VAR_LIST = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'M', 'Ans'];

  function renderVarsOverlay() {
    var fmt = AppContext.getFormatOpts();
    var html = '<div class="lcd-menu-list"><div class="lcd-list-title">DANH SÁCH BIẾN NHỚ (Bấm OK để chèn vào biểu thức):</div>';
    for (var i = 0; i < VAR_LIST.length; i++) {
      var vn = VAR_LIST[i];
      var val = AppContext.vars[vn] || 0;
      var cls = (i === AppContext.varIdx) ? 'lcd-list-item active' : 'lcd-list-item';
      html +=
        '<div class="' + cls + '" data-action="var-pick" data-idx="' + i + '">' +
          '<span>Biến <b>' + vn + '</b></span>' +
          '<b>' + escapeHtml(CalcEngine.toExact(val) || CalcEngine.format(val, fmt)) + '</b>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function insertCatalogOrOptnItem(item) {
    AppContext.overlay = null;
    if (AppContext.currentAppId === 'complex') {
      var cst = AppContext.complexState;
      if (cst.hasResult) {
        CalcEditor.clear(cst.editor);
        cst.hasResult = false;
      }
      if (item.tpl) {
        CalcEditor.insertTemplate(cst.editor, item.tpl);
      } else if (item.text) {
        CalcEditor.insertToken(cst.editor, item.text, item.evalText);
      }
      renderAll();
      return;
    }
    if (AppContext.currentAppId !== 'calc') {
      AppContext.switchApp('calc');
    }
    var st = AppContext.calcState;
    if (st.hasResult) {
      CalcEditor.clear(st.editor);
      st.hasResult = false;
    }
    if (item.tpl) {
      CalcEditor.insertTemplate(st.editor, item.tpl);
    } else if (item.text) {
      CalcEditor.insertToken(st.editor, item.text, item.evalText);
    }
    renderAll();
  }

  // Xử lý sự kiện bấm phím tổng quát (từ bàn phím ảo hoặc bàn phím cứng)
  function dispatchAction(actionKey, logLabel, modType) {
    AppContext.statusHint = '';

    // Nếu màn hình đang tắt (OFF)
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

    // Kiểm tra xem có phải đang bắt đầu biểu thức mới sau dấu = không (để tự xóa nhật ký phím)
    var curApp = CalcApps.byId[AppContext.currentAppId];
    var isNewStart = false;
    var hasCalcRes = (AppContext.currentAppId === 'calc' && AppContext.calcState && AppContext.calcState.hasResult) ||
                     (AppContext.currentAppId === 'complex' && AppContext.complexState && AppContext.complexState.hasResult);
    if (!AppContext.overlay && hasCalcRes) {
      var nonResetKeys = {
        '=': 1, 'OK': 1, 'APPROX_EQ': 1, 'S_D': 1, 'MIXED_SD': 1,
        'FACT': 1, 'DMS': 1, 'DMS_CONV': 1, 'ENG': 1, 'ENG_BACK': 1,
        'LEFT': 1, 'RIGHT': 1, 'UP': 1, 'DOWN': 1,
        '+': 1, '-': 1, '*': 1, '/': 1, 'POW': 1, 'SQ': 1, 'CUBE': 1, 'INV': 1,
        'FACTORIAL': 1, 'DIV_R': 1, 'NPR': 1, 'NCR': 1, 'STO': 1, 'M+': 1, 'M-': 1
      };
      if (!nonResetKeys[actionKey]) {
        isNewStart = true;
      }
    }

    if (logLabel) {
      recordKeyLog(logLabel, modType, isNewStart);
    }

    // Xử lý phím toàn cục: HOME, MENU, SETUP, OPTN, CATALOG, VARS
    if (actionKey === 'HOME') {
      AppContext.switchApp('calc');
      return;
    }
    if (actionKey === 'MENU') {
      if (AppContext.overlay === 'menu') AppContext.overlay = null;
      else AppContext.openMenu();
      renderAll();
      return;
    }
    if (actionKey === 'SETUP') {
      AppContext.overlay = (AppContext.overlay === 'setup') ? null : 'setup';
      AppContext.setupSubMode = null;
      renderAll();
      return;
    }
    if (actionKey === 'OPTN') {
      if (AppContext.overlay === 'optn' || AppContext.overlay === 'optn_hyp') {
        AppContext.overlay = null;
      } else if (curApp && curApp.openOptn) {
        AppContext.overlay = null;
        curApp.openOptn(AppContext);
      } else {
        AppContext.overlay = 'optn';
        AppContext.optnIdx = 0;
      }
      renderAll();
      return;
    }
    if (actionKey === 'CATALOG') {
      AppContext.overlay = (AppContext.overlay === 'catalog') ? null : 'catalog';
      AppContext.catalogIdx = 0;
      renderAll();
      return;
    }
    if (actionKey === 'VARS' || actionKey === 'RCL') {
      AppContext.overlay = (AppContext.overlay === 'vars') ? null : 'vars';
      AppContext.varIdx = 0;
      renderAll();
      return;
    }

    // Nếu đang mở lớp phủ MENU
    if (AppContext.overlay === 'menu') {
      var apps = CalcApps.getVisibleApps(AppContext.settings.modelType);
      if (actionKey === 'AC') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'LEFT' && AppContext.menuIdx > 0) { AppContext.menuIdx--; renderAll(); return; }
      if (actionKey === 'RIGHT' && AppContext.menuIdx < apps.length - 1) { AppContext.menuIdx++; renderAll(); return; }
      if (actionKey === 'UP' && AppContext.menuIdx >= 4) { AppContext.menuIdx -= 4; renderAll(); return; }
      if (actionKey === 'DOWN' && AppContext.menuIdx + 4 < apps.length) { AppContext.menuIdx += 4; renderAll(); return; }
      if (actionKey === 'OK' || actionKey === '=') {
        AppContext.switchApp(apps[AppContext.menuIdx].id);
        return;
      }
      // Chọn nhanh bằng phím 1-9, A-F
      var codeMap = {
        '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '(-)': 'A', 'VAR_A': 'A', 'DMS': 'B', 'VAR_B': 'B', 'INV': 'C', 'VAR_C': 'C',
        'sin': 'D', 'VAR_D': 'D', 'cos': 'E', 'VAR_E': 'E', 'tan': 'F', 'VAR_F': 'F'
      };
      var pickedCode = codeMap[actionKey];
      if (pickedCode) {
        for (var mi = 0; mi < apps.length; mi++) {
          if (apps[mi].code === pickedCode) {
            AppContext.switchApp(apps[mi].id);
            return;
          }
        }
      }
      return;
    }

    // Nếu đang mở lớp phủ SETUP
    if (AppContext.overlay === 'setup') {
      if (AppContext.setupSubMode === 'fix' || AppContext.setupSubMode === 'sci') {
        if (/^[0-9]$/.test(actionKey)) {
          var dg = parseInt(actionKey, 10);
          AppContext.settings.fmtMode = AppContext.setupSubMode;
          AppContext.settings.fmtDigits = (AppContext.setupSubMode === 'sci' && dg === 0) ? 10 : dg;
          AppContext.setupSubMode = null;
          AppContext.saveState();
          renderAll();
        } else if (actionKey === 'AC') {
          AppContext.setupSubMode = null;
          renderAll();
        }
        return;
      }
      if (actionKey === 'AC') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'UP') { AppContext.setupIdx = (AppContext.setupIdx + SETUP_ITEMS.length - 1) % SETUP_ITEMS.length; renderAll(); return; }
      if (actionKey === 'DOWN') { AppContext.setupIdx = (AppContext.setupIdx + 1) % SETUP_ITEMS.length; renderAll(); return; }
      if (/^[0-9]$/.test(actionKey)) {
        var sIdx = actionKey === '0' ? 9 : (parseInt(actionKey, 10) - 1);
        if (SETUP_ITEMS[sIdx]) {
          AppContext.setupIdx = sIdx;
          applySetupToggle(AppContext.setupIdx);
          renderAll();
        }
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        applySetupToggle(AppContext.setupIdx);
        renderAll();
        return;
      }
      return;
    }

    // Nếu đang mở lớp phủ OPTN
    if (AppContext.overlay === 'optn' || AppContext.overlay === 'optn_hyp') {
      var oList = AppContext.overlay === 'optn_hyp' ? CalcApps.HYP_ITEMS : CalcApps.CALC_OPTN_ITEMS;
      if (actionKey === 'AC') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'UP') { AppContext.optnIdx = (AppContext.optnIdx + oList.length - 1) % oList.length; renderAll(); return; }
      if (actionKey === 'DOWN') { AppContext.optnIdx = (AppContext.optnIdx + 1) % oList.length; renderAll(); return; }
      if (/^[1-9]$/.test(actionKey)) {
        var oIdx = parseInt(actionKey, 10) - 1;
        if (oList[oIdx]) {
          if (oList[oIdx].group === 'hyp') {
            AppContext.overlay = 'optn_hyp';
            AppContext.optnIdx = 0;
            renderAll();
          } else {
            insertCatalogOrOptnItem(oList[oIdx]);
          }
        }
        return;
      }
      if (actionKey === 'OK' || actionKey === '=') {
        var chosen = oList[AppContext.optnIdx];
        if (chosen.group === 'hyp') {
          AppContext.overlay = 'optn_hyp';
          AppContext.optnIdx = 0;
          renderAll();
        } else {
          insertCatalogOrOptnItem(chosen);
        }
        return;
      }
      return;
    }

    // Nếu đang mở lớp phủ CATALOG
    if (AppContext.overlay === 'catalog') {
      var cList = CalcApps.CATALOG_ITEMS;
      if (actionKey === 'AC') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'UP') { AppContext.catalogIdx = (AppContext.catalogIdx + cList.length - 1) % cList.length; renderAll(); return; }
      if (actionKey === 'DOWN') { AppContext.catalogIdx = (AppContext.catalogIdx + 1) % cList.length; renderAll(); return; }
      if (actionKey === 'OK' || actionKey === '=') {
        insertCatalogOrOptnItem(cList[AppContext.catalogIdx]);
      }
      return;
    }

    // Nếu đang mở lớp phủ VARS
    if (AppContext.overlay === 'vars') {
      if (actionKey === 'AC') { AppContext.overlay = null; renderAll(); return; }
      if (actionKey === 'UP') { AppContext.varIdx = (AppContext.varIdx + VAR_LIST.length - 1) % VAR_LIST.length; renderAll(); return; }
      if (actionKey === 'DOWN') { AppContext.varIdx = (AppContext.varIdx + 1) % VAR_LIST.length; renderAll(); return; }
      if (actionKey === 'OK' || actionKey === '=') {
        var vn = VAR_LIST[AppContext.varIdx];
        insertCatalogOrOptnItem({ text: vn, evalText: vn });
      }
      return;
    }

    // Các phím hàm tắt (GCD_FN, LCM_FN, INT_FN, INTG_FN, RND_FN)
    var fnShortMap = {
      'GCD_FN': { text: 'GCD(', evalText: 'gcd(' },
      'LCM_FN': { text: 'LCM(', evalText: 'lcm(' },
      'INT_FN': { text: 'Int(', evalText: 'int(' },
      'INTG_FN': { text: 'Intg(', evalText: 'intg(' },
      'RND_FN': { text: 'Rnd(', evalText: 'round(' }
    };
    if (fnShortMap[actionKey]) {
      insertCatalogOrOptnItem(fnShortMap[actionKey]);
      return;
    }

    // Chuyển phím cho ứng dụng đang hoạt động
    if (curApp && curApp.onKey) {
      curApp.onKey(actionKey, AppContext);
      renderAll();
    }
  }

  function stripHtmlTags(s) {
    return String(s || '').replace(/<[^>]*>/g, '');
  }

  function handleKeyObjectPress(kObj) {
    var mod = '';
    var act = kObj.normalAct;
    var lbl = kObj.plainLbl || stripHtmlTags(kObj.label);

    if (AppContext.shiftActive) {
      mod = 'shift';
      act = kObj.shiftAct || kObj.normalAct;
      lbl = stripHtmlTags(kObj.shiftLbl) || lbl;
      AppContext.shiftActive = false;
    } else if (AppContext.alphaActive) {
      mod = 'alpha';
      act = kObj.alphaAct || kObj.normalAct;
      lbl = stripHtmlTags(kObj.alphaLbl) || lbl;
      AppContext.alphaActive = false;
    }
    dispatchAction(act, lbl, mod);
  }

  // Gắn sự kiện chuột / cảm ứng (tránh nhân đôi sự kiện trên iPad)
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

    var shell = document.getElementById('calc-shell');
    addFastPress(shell, function (ev) {
      var target = ev.target;
      while (target && target !== shell) {
        // Nút trên màn hình LCD (menu, setup, bảng...)
        var lcdAct = target.getAttribute && target.getAttribute('data-action');
        if (lcdAct) {
          ev.preventDefault();
          handleLcdTouch(lcdAct, target);
          return;
        }
        // Phím D-Pad
        var dpad = target.getAttribute && target.getAttribute('data-dpad');
        if (dpad) {
          ev.preventDefault();
          var dLbl = { 'UP': '▲', 'DOWN': '▼', 'LEFT': '◀', 'RIGHT': '▶', 'OK': 'OK' }[dpad];
          AppContext.shiftActive = false;
          AppContext.alphaActive = false;
          dispatchAction(dpad, dLbl, '');
          return;
        }
        // Phím hàng trên
        var topId = target.getAttribute && target.getAttribute('data-top-id');
        if (topId) {
          ev.preventDefault();
          handleTopKey(topId);
          return;
        }
        // Phím thanh chức năng
        var funcId = target.getAttribute && target.getAttribute('data-func-id');
        if (funcId) {
          ev.preventDefault();
          handleFuncBarKey(funcId);
          return;
        }
        // Phím hàm khoa học
        var sciIdx = target.getAttribute && target.getAttribute('data-sci-idx');
        if (sciIdx !== null && sciIdx !== '') {
          ev.preventDefault();
          handleKeyObjectPress(SCI_KEYS[parseInt(sciIdx, 10)]);
          return;
        }
        // Phím số
        var numIdx = target.getAttribute && target.getAttribute('data-num-idx');
        if (numIdx !== null && numIdx !== '') {
          ev.preventDefault();
          handleKeyObjectPress(NUM_KEYS[parseInt(numIdx, 10)]);
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

    // Bàn phím máy tính
    window.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var k = ev.key;
      var map = {
        '0': ['0', '0'], '1': ['1', '1'], '2': ['2', '2'], '3': ['3', '3'], '4': ['4', '4'],
        '5': ['5', '5'], '6': ['6', '6'], '7': ['7', '7'], '8': ['8', '8'], '9': ['9', '9'],
        '.': ['.', '.'], ',': [',', ','],
        '+': ['+', '+'], '-': ['-', '−'], '*': ['*', '×'], '/': ['FRAC', '■/□'],
        '^': ['POW', 'x^■'], '(': ['(', '('], ')': [')', ')'],
        'Enter': ['=', '='], '=': ['=', '='],
        'Backspace': ['DEL', 'DEL'], 'Delete': ['DEL', 'DEL'],
        'Escape': ['AC', 'AC'],
        'ArrowLeft': ['LEFT', '◀'], 'ArrowRight': ['RIGHT', '▶'],
        'ArrowUp': ['UP', '▲'], 'ArrowDown': ['DOWN', '▼'],
        's': ['sin', 'sin'], 'c': ['cos', 'cos'], 't': ['tan', 'tan'],
        'l': ['ln', 'ln'], 'r': ['SQRT', '√■'], 'p': ['PI', 'π'],
        'x': ['x', 'x'], 'y': ['VAR_y', 'y'], 'i': ['COMPLEX_I', 'i'],
        '!': ['FACTORIAL', 'x!'], '%': ['PERCENT', '%']
      };
      if (map[k]) {
        ev.preventDefault();
        AppContext.shiftActive = false;
        AppContext.alphaActive = false;
        dispatchAction(map[k][0], map[k][1], '');
      }
    }, false);

    // Lắng nghe postMessage từ ứng dụng bảng hình học
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

  function handleTopKey(topId) {
    if (topId === 'SHIFT') {
      AppContext.shiftActive = !AppContext.shiftActive;
      if (AppContext.shiftActive) AppContext.alphaActive = false;
      recordKeyLog('SHIFT', 'shift', false);
      renderAll();
      return;
    }
    if (topId === 'ALPHA') {
      AppContext.alphaActive = !AppContext.alphaActive;
      if (AppContext.alphaActive) AppContext.shiftActive = false;
      recordKeyLog('ALPHA', 'alpha', false);
      renderAll();
      return;
    }
    if (topId === 'HOME') {
      if (AppContext.shiftActive) {
        AppContext.shiftActive = false;
        dispatchAction('SETUP', 'SETUP', 'shift');
      } else {
        AppContext.alphaActive = false;
        dispatchAction('HOME', 'HOME', '');
      }
      return;
    }
    if (topId === 'MENU') {
      if (AppContext.shiftActive) {
        AppContext.shiftActive = false;
        dispatchAction('SETUP', 'SETUP', 'shift');
      } else {
        AppContext.alphaActive = false;
        dispatchAction('MENU', 'MENU', '');
      }
      return;
    }
    if (topId === 'ON_AC') {
      if (AppContext.shiftActive) {
        AppContext.shiftActive = false;
        dispatchAction('OFF', 'OFF', 'shift');
      } else {
        AppContext.alphaActive = false;
        AppContext.overlay = null;
        dispatchAction('AC', 'ON', '');
      }
    }
  }

  function handleFuncBarKey(funcId) {
    if (funcId === 'OPTN') {
      AppContext.shiftActive = false;
      AppContext.alphaActive = false;
      dispatchAction('OPTN', 'OPTN', '');
      return;
    }
    if (funcId === 'CALC_BTN') {
      if (AppContext.shiftActive) {
        AppContext.shiftActive = false;
        dispatchAction('SOLVE', 'SOLVE', 'shift');
      } else if (AppContext.alphaActive) {
        AppContext.alphaActive = false;
        dispatchAction('EQUAL_SIGN', '=', 'alpha');
      } else {
        dispatchAction('CALC', 'CALC', '');
      }
      return;
    }
    if (funcId === 'VAR_BTN') {
      var m = AppContext.shiftActive ? 'shift' : '';
      AppContext.shiftActive = false;
      AppContext.alphaActive = false;
      dispatchAction('VARS', m ? 'RCL' : 'BIẾN', m);
      return;
    }
    if (funcId === 'CATALOG_BTN') {
      AppContext.shiftActive = false;
      AppContext.alphaActive = false;
      dispatchAction('CATALOG', 'DANH MỤC', '');
    }
  }

  function handleLcdTouch(act, el) {
    if (act === 'menu-pick') {
      var appId = el.getAttribute('data-id');
      AppContext.switchApp(appId);
      return;
    }
    if (act === 'setup-item') {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      AppContext.setupIdx = idx;
      applySetupToggle(idx);
      renderAll();
      return;
    }
    if (act === 'optn-pick') {
      var oIdx = parseInt(el.getAttribute('data-idx'), 10);
      var oList = AppContext.overlay === 'optn_hyp' ? CalcApps.HYP_ITEMS : CalcApps.CALC_OPTN_ITEMS;
      var item = oList[oIdx];
      if (item.group === 'hyp') {
        AppContext.overlay = 'optn_hyp';
        AppContext.optnIdx = 0;
        renderAll();
      } else {
        insertCatalogOrOptnItem(item);
      }
      return;
    }
    if (act === 'cat-pick') {
      var cIdx = parseInt(el.getAttribute('data-idx'), 10);
      insertCatalogOrOptnItem(CalcApps.CATALOG_ITEMS[cIdx]);
      return;
    }
    if (act === 'var-pick') {
      var vIdx = parseInt(el.getAttribute('data-idx'), 10);
      var vn = VAR_LIST[vIdx];
      insertCatalogOrOptnItem({ text: vn, evalText: vn });
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
    if (act === 'tbl-cell') {
      CalcApps.byId.table.commitCustomX(AppContext);
      AppContext.tableState.selRow = parseInt(el.getAttribute('data-r'), 10);
      AppContext.tableState.selCol = parseInt(el.getAttribute('data-c'), 10);
      renderAll();
      return;
    }
    if (act === 'eq-mode') {
      AppContext.eqState.mode = el.getAttribute('data-mode');
      AppContext.eqState.step = 'size';
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
    // Các thao tác chạm màn hình LCD cho ứng dụng Giai đoạn 2
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
    if (act === 'sheet-ins-eq') {
      if (!AppContext.sheetState.isEditing) {
        AppContext.sheetState.isEditing = true;
        AppContext.sheetState.editStr = '=';
      } else {
        AppContext.sheetState.editStr += '=';
      }
      renderAll();
      return;
    }
    if (act === 'sheet-ins-colon') {
      if (!AppContext.sheetState.isEditing) {
        AppContext.sheetState.isEditing = true;
        AppContext.sheetState.editStr = ':';
      } else {
        AppContext.sheetState.editStr += ':';
      }
      renderAll();
      return;
    }
    if (act === 'sheet-open-optn') {
      CalcApps.byId.sheet.openOptn(AppContext);
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
    if (act === 'mb-mode') {
      AppContext.mathboxState.mode = el.getAttribute('data-m');
      AppContext.mathboxState.focusIdx = 0;
      AppContext.mathboxState.step = 'params';
      renderAll();
      return;
    }
    if (act === 'mb-focus') {
      AppContext.mathboxState.focusIdx = parseInt(el.getAttribute('data-f'), 10);
      renderAll();
      return;
    }
    if (act === 'mb-retry') {
      CalcApps.byId.mathbox.runSimulation(AppContext.mathboxState);
      renderAll();
      return;
    }
    if (act === 'algo-pick-add') {
      CalcApps.byId.algo.applyAddChoice(AppContext.algoState, parseInt(el.getAttribute('data-idx'), 10));
      renderAll();
      return;
    }
    if (act === 'algo-view-out') {
      AppContext.algoState.step = 'output';
      renderAll();
      return;
    }
    if (act === 'algo-view-canvas') {
      AppContext.algoState.step = 'canvas';
      renderAll();
      return;
    }
    if (act === 'algo-back-ed') {
      AppContext.algoState.step = 'editor';
      renderAll();
      return;
    }
    if (act === 'algo-open-add') {
      CalcApps.byId.algo.openOptn(AppContext);
      renderAll();
      return;
    }
    if (act === 'algo-run-btn') {
      CalcApps.byId.algo.runProgramNow(AppContext);
      renderAll();
      return;
    }
    if (act === 'algo-line') {
      var lIdx = parseInt(el.getAttribute('data-idx'), 10);
      if (AppContext.algoState.selLine === lIdx) {
        CalcApps.byId.algo.openLineEdit(AppContext.algoState);
      } else {
        AppContext.algoState.selLine = lIdx;
      }
      renderAll();
      return;
    }
    if (act === 'algo-cycle-var') {
      CalcApps.byId.algo.onKey('DOWN', AppContext);
      renderAll();
      return;
    }
    if (act === 'algo-ins') {
      AppContext.algoState.editVal += (el.getAttribute('data-s') || '');
      renderAll();
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
    var availH = isCompact ? (winH - 8) : Math.max(natH, winH - 90);

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

  // Khởi tạo toàn bộ giao diện khi DOM sẵn sàng
  function initUI() {
    AppContext.loadState();

    var params = parseQueryParams();
    if (params.kieu === 'a' || params.kieu === 'b') {
      AppContext.settings.modelType = params.kieu;
    }
    var compact = (params.gon === '1') || isInIframe();
    if (params.gon === '0') compact = false;

    if (params.nhatky === '0') AppContext.showKeyLog = false;
    else if (params.nhatky === '1') AppContext.showKeyLog = true;

    var bodyCls = [];
    if (compact) bodyCls.push('mode-compact');
    if (params.nen === 'trong-suot') bodyCls.push('bg-transparent');
    document.body.className = bodyCls.join(' ');

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
})(this);
