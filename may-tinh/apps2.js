/* Các ứng dụng Giai đoạn 2 cho Máy tính Thầy Minh (ES5 thuần) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcEditor = root.CalcEditor;
  var CalcApps = root.CalcApps;

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var mapKeyToCellChar = CalcApps.mapKeyToCellChar;
  var evalCellInput = CalcApps.evalCellInput;

  // =========================================================================
  // 2. ỨNG DỤNG SỐ PHỨC (complex)
  // =========================================================================
  var CPLX_OPTN_ITEMS = [
    { label: '1. Đơn vị ảo — i', text: 'i', evalText: 'i' },
    { label: '2. Ký hiệu góc cực — ∠', text: '∠', evalText: '∠' },
    { label: '3. Đối số — Arg(', text: 'Arg(', evalText: 'arg(' },
    { label: '4. Số phức liên hợp — Conjg(', text: 'Conjg(', evalText: 'conj(' },
    { label: '5. Phần thực — ReP(', text: 'ReP(', evalText: 're(' },
    { label: '6. Phần ảo — ImP(', text: 'ImP(', evalText: 'im(' },
    { label: '7. Mô-đun — |z| (Abs)', tpl: 'abs' },
    { label: '8. Chuyển sang dạng cực — ▶r∠θ', text: '▶r∠θ', evalText: '▶r∠θ' },
    { label: '9. Chuyển sang dạng đại số — ▶a+bi', text: '▶a+bi', evalText: '▶a+bi' }
  ];

  CalcApps.register({
    id: 'complex',
    code: '2',
    name: 'Số phức',
    icon: 'a+bi',
    stage: 1,
    init: function (ctx) {
      if (!ctx.complexState) {
        ctx.complexState = {
          editor: CalcEditor.create(ctx.settings.ioMode === 'line'),
          hasResult: false,
          lastExprText: '',
          lastResult: null,
          displayMode: 'auto', // 'auto' | 'rect_exact' | 'rect_dec' | 'polar_exact' | 'polar_dec'
          step: 'calc', // 'calc' | 'optn'
          optnIdx: 0,
          cplxAns: { re: 0, im: 0 },
          history: [],
          historyIdx: -1
        };
      }
      ctx.complexState.editor.lineMode = (ctx.settings.ioMode === 'line');
      ctx.complexState.step = 'calc';
    },
    openOptn: function (ctx) {
      var st = ctx.complexState;
      st.step = (st.step === 'optn') ? 'calc' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.complexState;
      var lineMode = (ctx.settings.ioMode === 'line');
      st.editor.lineMode = lineMode;

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Số phức (Bấm 1–9 hoặc OK):</div>';
        for (var i = 0; i < CPLX_OPTN_ITEMS.length; i++) {
          var cls = (i === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + cls + '" data-action="cplx-optn" data-idx="' + i + '">' +
                   escapeHtml(CPLX_OPTN_ITEMS[i].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      var exprHtml = CalcEditor.renderHTML(st.editor, !st.hasResult);
      var resHtml = '';
      if (st.hasResult && st.lastResult) {
        var r = st.lastResult;
        if (!r.ok) {
          resHtml = '<div class="lcd-error">' + escapeHtml(r.error || 'Lỗi toán') + '</div>';
        } else {
          var shown = this.getShownString(st, ctx);
          resHtml = CalcEditor.renderResultHTML(shown, lineMode);
        }
      }

      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-expr-line">' + exprHtml + '</div>' +
          '<div class="lcd-res-line">' + resHtml + '</div>' +
        '</div>'
      );
    },
    getShownString: function (st, ctx) {
      var r = st.lastResult;
      if (!r || !r.ok) return 'Lỗi';
      var dm = st.displayMode;
      if (dm === 'rect_exact') return r.rectExact;
      if (dm === 'rect_dec') return r.rectDecimal;
      if (dm === 'polar_exact') return r.polar.exact;
      if (dm === 'polar_dec') return r.polar.decimal;
      // auto: theo cài đặt hoặc hậu tố ▶r∠θ / ▶a+bi
      return r.exact || r.decimal;
    },
    onKey: function (key, ctx) {
      var st = ctx.complexState;
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'optn') {
        if (key === 'AC') { st.step = 'calc'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + CPLX_OPTN_ITEMS.length - 1) % CPLX_OPTN_ITEMS.length; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % CPLX_OPTN_ITEMS.length; return; }
        var nKey = parseInt(key, 10);
        if (nKey >= 1 && nKey <= CPLX_OPTN_ITEMS.length) {
          this.pickOptnItem(ctx, nKey - 1);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.pickOptnItem(ctx, st.optnIdx);
          return;
        }
        return;
      }

      if (key === 'AC') {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        return;
      }
      if (key === 'DEL') {
        if (st.hasResult) { st.hasResult = false; return; }
        CalcEditor.deleteBack(st.editor);
        return;
      }
      if (key === 'LEFT') {
        if (st.hasResult) {
          st.hasResult = false;
          st.editor.cursor = { list: st.editor.root, index: st.editor.root.length };
          st.editor.stack = [];
          return;
        }
        CalcEditor.moveLeft(st.editor);
        return;
      }
      if (key === 'RIGHT') {
        if (st.hasResult) {
          st.hasResult = false;
          st.editor.cursor = { list: st.editor.root, index: 0 };
          st.editor.stack = [];
          return;
        }
        CalcEditor.moveRight(st.editor);
        return;
      }
      if (key === 'UP') {
        if (!st.hasResult) CalcEditor.moveUp(st.editor);
        return;
      }
      if (key === 'DOWN') {
        if (!st.hasResult) CalcEditor.moveDown(st.editor);
        return;
      }
      if (key === 'S_D') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          var order = ['rect_exact', 'rect_dec', 'polar_exact', 'polar_dec'];
          var curIdx = -1;
          for (var i = 0; i < order.length; i++) {
            if (order[i] === st.displayMode) curIdx = i;
          }
          st.displayMode = order[(curIdx + 1) % order.length];
        }
        return;
      }
      if (key === '=' || key === 'OK' || key === 'APPROX_EQ') {
        this.executeEval(ctx, key === 'APPROX_EQ');
        return;
      }

      if (st.hasResult) {
        var isCont = (
          key === '+' || key === '-' || key === '*' || key === '/' ||
          key === 'POW' || key === 'SQ' || key === 'CUBE' || key === 'INV'
        );
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        if (isCont) {
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        }
      }

      // Phím ENG trong chế độ Số phức nhập 'i', SHIFT+ENG nhập '∠'
      if (key === 'ENG' || key === 'COMPLEX_I') {
        CalcEditor.insertToken(st.editor, 'i', 'i');
        return;
      }
      if (key === 'ENG_BACK' || key === 'ANGLE_SYM') {
        CalcEditor.insertToken(st.editor, '∠', '∠');
        return;
      }

      calcApp.insertByKey(st.editor, key);
    },
    pickOptnItem: function (ctx, idx) {
      var st = ctx.complexState;
      var item = CPLX_OPTN_ITEMS[idx];
      st.step = 'calc';
      if (!item) return;
      if (st.hasResult) {
        if (item.evalText === '▶r∠θ' || item.evalText === '▶a+bi') {
          st.displayMode = (item.evalText === '▶r∠θ') ? 'polar_exact' : 'rect_exact';
          return;
        }
        var isWrap = (item.evalText === 'arg(' || item.evalText === 'conj(' || item.evalText === 're(' || item.evalText === 'im(');
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        if (isWrap) {
          CalcEditor.insertToken(st.editor, item.text, item.evalText);
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
          CalcEditor.insertToken(st.editor, ')', ')');
          this.executeEval(ctx, false);
          return;
        }
      }
      if (item.tpl) {
        CalcEditor.insertTemplate(st.editor, item.tpl);
      } else if (item.text) {
        CalcEditor.insertToken(st.editor, item.text, item.evalText);
      }
    },
    executeEval: function (ctx, forceDec) {
      var st = ctx.complexState;
      var exprText = CalcEditor.toEvalText(st.editor);
      if (!exprText.replace(/\s+/g, '')) return;
      var varsCopy = {};
      for (var k in ctx.vars) {
        if (Object.prototype.hasOwnProperty.call(ctx.vars, k)) varsCopy[k] = ctx.vars[k];
      }
      varsCopy.Ans = st.cplxAns;

      var opts = {
        angle: ctx.settings.angle,
        vars: varsCopy,
        form: ctx.settings.complexForm || 'rect',
        format: ctx.getFormatOpts()
      };
      var res = CalcEngine.complex.evalComplex(exprText, opts);
      st.hasResult = true;
      st.lastExprText = exprText;
      st.lastResult = res;
      if (res.ok) {
        st.cplxAns = { re: res.re, im: res.im };
        ctx.vars.Ans = res.re;
        ctx.saveState();
        st.displayMode = forceDec
          ? ((ctx.settings.complexForm === 'polar') ? 'polar_dec' : 'rect_dec')
          : 'auto';
        ctx.notifyParentResult(exprText, res.re, this.getShownString(st, ctx));
      }
    }
  });

  // =========================================================================
  // 3. ỨNG DỤNG CƠ SỐ N (baseN)
  // =========================================================================
  var BASEN_OPTN_ITEMS = [
    { label: '1. and — Phép VÀ bit (AND)', text: ' and ' },
    { label: '2. or — Phép HOẶC bit (OR)', text: ' or ' },
    { label: '3. xor — Phép XOR bit', text: ' xor ' },
    { label: '4. xnor — Phép XNOR bit', text: ' xnor ' },
    { label: '5. not( — Đảo bit (NOT)', text: 'not(' },
    { label: '6. neg( — Đổi dấu bù 2 (NEG)', text: 'neg(' },
    { label: '7. d — Tiền tố Hệ 10 (DEC)', text: 'd' },
    { label: '8. h — Tiền tố Hệ 16 (HEX)', text: 'h' },
    { label: '9. b — Tiền tố Hệ 2 (BIN)', text: 'b' },
    { label: '0. o — Tiền tố Hệ 8 (OCT)', text: 'o' }
  ];

  function getBaseName(b) {
    if (b === 16) return 'HEX';
    if (b === 2) return 'BIN';
    if (b === 8) return 'OCT';
    return 'DEC';
  }

  // Kiểm tra chữ số digit có hợp lệ tại cuối biểu thức expr trong cơ số curBase không
  function isDigitAllowedInBaseN(expr, digit, curBase) {
    // Kiểm tra xem ngay trước vị trí nhập có tiền tố d, h, b, o không
    var m = expr.match(/(^|[^A-Za-z0-9])([dhbo])([0-9A-Fa-f]*)$/);
    var activeBase = curBase;
    if (m) {
      var p = m[2];
      activeBase = p === 'd' ? 10 : (p === 'h' ? 16 : (p === 'b' ? 2 : 8));
    }
    if (activeBase === 2) return digit === '0' || digit === '1';
    if (activeBase === 8) return digit >= '0' && digit <= '7';
    if (activeBase === 10) return digit >= '0' && digit <= '9';
    if (activeBase === 16) return (digit >= '0' && digit <= '9') || (digit >= 'A' && digit <= 'F');
    return false;
  }

  CalcApps.register({
    id: 'baseN',
    code: '3',
    name: 'Cơ số N',
    icon: '0110',
    stage: 1,
    init: function (ctx) {
      if (!ctx.baseNState) {
        ctx.baseNState = {
          base: 10, // 10, 16, 2, 8
          expr: '',
          hasResult: false,
          lastRes: null, // { ok, value, display, allBases, error }
          step: 'calc', // 'calc' | 'optn'
          optnIdx: 0
        };
      }
      ctx.baseNState.step = 'calc';
    },
    openOptn: function (ctx) {
      var st = ctx.baseNState;
      st.step = (st.step === 'optn') ? 'calc' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.baseNState;
      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Cơ số N (Logic bit & Tiền tố):</div>';
        for (var i = 0; i < BASEN_OPTN_ITEMS.length; i++) {
          var cls = (i === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + cls + '" data-action="basen-optn" data-idx="' + i + '">' +
                   escapeHtml(BASEN_OPTN_ITEMS[i].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      var bName = getBaseName(st.base);
      var exprDisp = escapeHtml(st.expr) + (!st.hasResult ? '<span class="m-cursor"></span>' : '');
      var mainRes = '';
      var cmpHtml = '';

      if (st.hasResult && st.lastRes) {
        if (!st.lastRes.ok) {
          mainRes = '<div class="lcd-error">' + escapeHtml(st.lastRes.error || 'Lỗi toán') + '</div>';
        } else {
          mainRes = '<div class="basen-main-res">' + escapeHtml(st.lastRes.display) + ' <sub class="basen-tag">' + bName + '</sub></div>';
          var ab = st.lastRes.allBases;
          cmpHtml =
            '<table class="lcd-grid basen-cmp-grid">' +
              '<tr class="' + (st.base === 10 ? 'sel-row' : '') + '" data-action="basen-switch" data-base="10"><th>DEC</th><td>' + escapeHtml(ab.dec) + '</td><th>HEX</th><td>' + escapeHtml(ab.hex) + '</td></tr>' +
              '<tr class="' + (st.base === 2 ? 'sel-row' : '') + '" data-action="basen-switch" data-base="2"><th>BIN</th><td colspan="3" class="basen-bin-cell">' + escapeHtml(ab.bin) + '</td></tr>' +
              '<tr class="' + (st.base === 8 ? 'sel-row' : '') + '" data-action="basen-switch" data-base="8"><th>OCT</th><td colspan="3">' + escapeHtml(ab.oct) + '</td></tr>' +
            '</table>';
        }
      } else {
        cmpHtml =
          '<div class="basen-bar">' +
            '<span class="basen-pill ' + (st.base === 10 ? 'active' : '') + '" data-action="basen-switch" data-base="10">DEC (x²)</span>' +
            '<span class="basen-pill ' + (st.base === 16 ? 'active' : '') + '" data-action="basen-switch" data-base="16">HEX (x^■)</span>' +
            '<span class="basen-pill ' + (st.base === 2 ? 'active' : '') + '" data-action="basen-switch" data-base="2">BIN (log)</span>' +
            '<span class="basen-pill ' + (st.base === 8 ? 'active' : '') + '" data-action="basen-switch" data-base="8">OCT (ln)</span>' +
          '</div>';
      }

      return (
        '<div class="lcd-basen">' +
          '<div class="basen-top-row"><span class="basen-mode-lbl">Hệ: <b>' + bName + ' (' + st.base + ')</b></span>' +
          '<span class="lcd-inline-btn" data-action="basen-open-optn">[OPTN: Logic/d,h,b,o]</span></div>' +
          '<div class="basen-expr-line">' + (exprDisp || '<span class="m-cursor"></span>') + '</div>' +
          mainRes +
          cmpHtml +
        '</div>'
      );
    },
    switchBase: function (st, newBase) {
      if (st.hasResult && st.lastRes && st.lastRes.ok) {
        st.base = newBase;
        var mapKey = newBase === 10 ? 'dec' : (newBase === 16 ? 'hex' : (newBase === 2 ? 'bin' : 'oct'));
        st.lastRes.display = st.lastRes.allBases[mapKey];
        st.expr = st.lastRes.display;
      } else {
        st.base = newBase;
      }
    },
    onKey: function (key, ctx) {
      var st = ctx.baseNState;
      if (st.step === 'optn') {
        if (key === 'AC') { st.step = 'calc'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + BASEN_OPTN_ITEMS.length - 1) % BASEN_OPTN_ITEMS.length; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % BASEN_OPTN_ITEMS.length; return; }
        if (/^[0-9]$/.test(key)) {
          var idx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          if (BASEN_OPTN_ITEMS[idx]) {
            if (st.hasResult) { st.expr = ''; st.hasResult = false; }
            st.expr += BASEN_OPTN_ITEMS[idx].text;
            st.step = 'calc';
          }
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.hasResult) { st.expr = ''; st.hasResult = false; }
          st.expr += BASEN_OPTN_ITEMS[st.optnIdx].text;
          st.step = 'calc';
          return;
        }
        return;
      }

      // Đổi hệ đếm bằng 4 phím x² (DEC), x^■ (HEX), log (BIN), ln (OCT)
      if (key === 'SQ' || key === 'BASE_DEC') { this.switchBase(st, 10); return; }
      if (key === 'POW' || key === 'BASE_HEX') { this.switchBase(st, 16); return; }
      if (key === 'log' || key === 'BASE_BIN') { this.switchBase(st, 2); return; }
      if (key === 'ln' || key === 'BASE_OCT') { this.switchBase(st, 8); return; }

      if (key === 'AC') {
        st.expr = '';
        st.hasResult = false;
        st.lastRes = null;
        return;
      }
      if (key === 'DEL') {
        if (st.hasResult) { st.hasResult = false; return; }
        st.expr = st.expr.slice(0, -1);
        return;
      }
      if (key === '=' || key === 'OK') {
        if (!st.expr.replace(/\s+/g, '')) return;
        var res = CalcEngine.baseN(st.expr, st.base);
        st.hasResult = true;
        st.lastRes = res;
        return;
      }

      // Phím chữ số 0-9 và A-F
      var hexKeyMap = {
        'VAR_A': 'A', 'DMS': 'B', 'VAR_B': 'B',
        'INV': 'C', 'VAR_C': 'C', 'sin': 'D', 'VAR_D': 'D',
        'cos': 'E', 'VAR_E': 'E', 'tan': 'F', 'VAR_F': 'F'
      };
      if (key === '(-)') {
        // Trong HEX (hoặc sau tiền tố h), phím (-) nhập A; ngược lại nhập dấu '-'
        if (isDigitAllowedInBaseN(st.expr, 'A', st.base)) {
          hexKeyMap['(-)'] = 'A';
        } else {
          key = '-';
        }
      }
      var digit = (/^[0-9]$/.test(key)) ? key : (hexKeyMap[key] || null);
      if (digit) {
        var checkExpr = st.hasResult ? '' : st.expr;
        if (!isDigitAllowedInBaseN(checkExpr, digit, st.base)) {
          // Bỏ qua phím không hợp lệ trong cơ số hiện hành
          return;
        }
        if (st.hasResult) {
          st.expr = '';
          st.hasResult = false;
        }
        st.expr += digit;
        return;
      }

      var opMap = { '+': '+', '-': '-', '*': '*', '/': '/', '(': '(', ')': ')' };
      if (opMap[key]) {
        if (st.hasResult) {
          if (st.lastRes && st.lastRes.ok && (key === '+' || key === '-' || key === '*' || key === '/')) {
            st.expr = st.lastRes.display;
          } else {
            st.expr = '';
          }
          st.hasResult = false;
        }
        st.expr += opMap[key];
      }
    }
  });

  // =========================================================================
  // 4. ỨNG DỤNG MA TRẬN (matrix)
  // =========================================================================
  var MAT_NAMES = ['MatA', 'MatB', 'MatC', 'MatD'];
  var MAT_OPTN_ITEMS = [
    { label: '1. Ma trận A — MatA', text: 'MatA' },
    { label: '2. Ma trận B — MatB', text: 'MatB' },
    { label: '3. Ma trận C — MatC', text: 'MatC' },
    { label: '4. Ma trận D — MatD', text: 'MatD' },
    { label: '5. Kết quả trước — MatAns', text: 'MatAns' },
    { label: '6. Định thức — det(', text: 'det(' },
    { label: '7. Chuyển vị — Trn(', text: 'Trn(' },
    { label: '8. Ma trận đơn vị — Identity(', text: 'Identity(' },
    { label: '9. Bậc thang — Ref(', text: 'Ref(' },
    { label: '0. Bậc thang rút gọn — Rref(', text: 'Rref(' },
    { label: 'A. Tạo / Sửa ma trận (MatA–MatD)', action: 'define' }
  ];

  function createZeroMat(m, n) {
    var M = [];
    for (var i = 0; i < m; i++) {
      var row = [];
      for (var j = 0; j < n; j++) row.push(0);
      M.push(row);
    }
    return M;
  }

  CalcApps.register({
    id: 'matrix',
    code: '4',
    name: 'Ma trận',
    icon: '[M]',
    stage: 1,
    init: function (ctx) {
      if (!ctx.matrixState) {
        ctx.matrixState = {
          step: 'select', // 'select' | 'dim' | 'edit' | 'calc' | 'optn'
          activeMat: 'MatA',
          selectIdx: 0,
          dimM: 2,
          dimN: 2,
          dimFocus: 0, // 0: hàng, 1: cột
          mats: {
            MatA: [[1, 2], [3, 4]],
            MatB: [[2, 0], [1, 2]],
            MatC: createZeroMat(2, 2),
            MatD: createZeroMat(2, 2),
            MatAns: [[1, 0], [0, 1]]
          },
          rIdx: 0,
          cIdx: 0,
          editStr: '',
          calcExpr: 'MatA×MatB',
          calcRes: null, // { ok, result, error }
          resR: 0,
          resC: 0,
          showDecimal: false,
          optnIdx: 0
        };
      }
      ctx.matrixState.step = 'select';
    },
    openOptn: function (ctx) {
      var st = ctx.matrixState;
      st.step = (st.step === 'optn') ? 'calc' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.matrixState;
      var fmt = ctx.getFormatOpts();

      if (st.step === 'select') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn ma trận để tạo/sửa hoặc tính toán:</div>';
        for (var i = 0; i < 4; i++) {
          var mName = MAT_NAMES[i];
          var mat = st.mats[mName];
          var dimInfo = mat ? (mat.length + '×' + mat[0].length) : 'Chưa tạo';
          var cls = (st.selectIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="mat-pick" data-idx="' + i + '">' +
                  '<span>' + (i + 1) + '. ' + mName + '</span><b>[' + dimInfo + ']</b></div>';
        }
        var clsCalc = (st.selectIdx === 4) ? 'lcd-list-item active' : 'lcd-list-item';
        html += '<div class="' + clsCalc + '" data-action="mat-pick" data-idx="4"><span>5. Màn hình tính toán ma trận</span><b>▶</b></div>';
        html += '</div>';
        return html;
      }

      if (st.step === 'dim') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Kích thước ' + escapeHtml(st.activeMat) + ' (1–4 × 1–4):</div>' +
            '<div class="lcd-list-item ' + (st.dimFocus === 0 ? 'active' : '') + '" data-action="mat-dim-focus" data-f="0">' +
              '<span>Số hàng (m):</span><b>' + st.dimM + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.dimFocus === 1 ? 'active' : '') + '" data-action="mat-dim-focus" data-f="1">' +
              '<span>Số cột (n):</span><b>' + st.dimN + '</b>' +
            '</div>' +
            '<div class="lcd-sub-hint">Bấm phím 1–4 rồi bấm = để nhập các phần tử</div>' +
          '</div>'
        );
      }

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Ma trận:</div>';
        for (var j = 0; j < MAT_OPTN_ITEMS.length; j++) {
          var oCls = (j === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + oCls + '" data-action="mat-optn" data-idx="' + j + '">' +
                   escapeHtml(MAT_OPTN_ITEMS[j].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'edit') {
        var M = st.mats[st.activeMat];
        var m = M.length, n = M[0].length;
        var eHtml = '<div class="lcd-table-wrap">';
        eHtml += '<div class="lcd-table-bar"><span>Nhập ' + st.activeMat + ' (' + m + '×' + n + ')</span>' +
                 '<span class="lcd-inline-btn" data-action="mat-go-calc">[Tính toán ▶]</span></div>';
        eHtml += '<table class="lcd-grid"><tbody>';
        for (var r = 0; r < m; r++) {
          eHtml += '<tr>';
          for (var c = 0; c < n; c++) {
            var isSel = (r === st.rIdx && c === st.cIdx);
            eHtml += '<td class="' + (isSel ? 'sel' : '') + '" data-action="mat-cell" data-r="' + r + '" data-c="' + c + '">' +
                     escapeHtml(CalcEngine.format(M[r][c], fmt)) + '</td>';
          }
          eHtml += '</tr>';
        }
        eHtml += '</tbody></table>';
        var curStr = st.editStr !== '' ? st.editStr : String(M[st.rIdx][st.cIdx]);
        eHtml += '<div class="lcd-cell-edit">' + st.activeMat + '[' + (st.rIdx + 1) + ',' + (st.cIdx + 1) + '] = <b>' +
                 escapeHtml(curStr) + '</b><span class="m-cursor"></span> (AC/OPTN để tính)</div>';
        eHtml += '</div>';
        return eHtml;
      }

      // Màn hình tính toán ma trận ('calc')
      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>Biểu thức ma trận:</span>' +
               '<span><span class="lcd-inline-btn" data-action="mat-open-optn">[OPTN]</span> ' +
               '<span class="lcd-inline-btn" data-action="mat-open-select">[Sửa Mat]</span></span></div>';
      cHtml += '<div class="lcd-cell-edit"><b>' + escapeHtml(st.calcExpr) + '</b><span class="m-cursor"></span></div>';

      if (st.calcRes) {
        if (st.calcRes.error) {
          cHtml += '<div class="lcd-error">' + escapeHtml(st.calcRes.error) + '</div>';
        } else if (typeof st.calcRes.result === 'number') {
          var vNum = st.calcRes.result;
          var vEx = (!st.showDecimal && CalcEngine.toExact(vNum)) || CalcEngine.format(vNum, fmt);
          cHtml += '<div class="lcd-res-line">' + CalcEditor.renderResultHTML(vEx, false) + '</div>';
        } else if (Array.isArray(st.calcRes.result)) {
          var R = st.calcRes.result;
          var rm = R.length, rn = R[0].length;
          if (st.resR >= rm) st.resR = 0;
          if (st.resC >= rn) st.resC = 0;
          cHtml += '<table class="lcd-grid"><tbody>';
          for (var rr = 0; rr < rm; rr++) {
            cHtml += '<tr>';
            for (var rc = 0; rc < rn; rc++) {
              var cellVal = R[rr][rc];
              var cellDisp = (!st.showDecimal && CalcEngine.toExact(cellVal)) || CalcEngine.format(cellVal, fmt);
              var rSel = (rr === st.resR && rc === st.resC);
              cHtml += '<td class="' + (rSel ? 'sel' : '') + '" data-action="mat-res-cell" data-r="' + rr + '" data-c="' + rc + '">' +
                       escapeHtml(cellDisp) + '</td>';
            }
            cHtml += '</tr>';
          }
          cHtml += '</tbody></table>';
          var selV = R[st.resR][st.resC];
          var selEx = CalcEngine.toExact(selV);
          var selInfo = selEx ? (selEx + ' ≈ ' + CalcEngine.format(selV, fmt)) : CalcEngine.format(selV, fmt);
          cHtml += '<div class="lcd-sub-hint">Ô [' + (st.resR + 1) + ',' + (st.resC + 1) + ']: <b>' + escapeHtml(selInfo) + '</b> (S⇔D đổi dạng)</div>';
        }
      } else {
        cHtml += '<div class="lcd-sub-hint">Ví dụ: MatA×MatB, MatA⁻¹, det(MatA), Trn(MatA), Ref(MatA)</div>';
      }
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.matrixState;

      if (st.step === 'select') {
        if (key === 'UP') { st.selectIdx = (st.selectIdx + 4) % 5; return; }
        if (key === 'DOWN') { st.selectIdx = (st.selectIdx + 1) % 5; return; }
        if (key === 'AC') { st.step = 'calc'; return; }
        var nSel = parseInt(key, 10);
        if (nSel >= 1 && nSel <= 5) {
          st.selectIdx = nSel - 1;
          this.confirmSelect(st);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.confirmSelect(st);
          return;
        }
        return;
      }

      if (st.step === 'dim') {
        if (key === 'AC') { st.step = 'select'; return; }
        if (key === 'UP' || key === 'DOWN' || key === 'LEFT' || key === 'RIGHT') {
          st.dimFocus = st.dimFocus === 0 ? 1 : 0;
          return;
        }
        if (key === '1' || key === '2' || key === '3' || key === '4') {
          var d = parseInt(key, 10);
          if (st.dimFocus === 0) {
            st.dimM = d;
            st.dimFocus = 1;
          } else {
            st.dimN = d;
            this.applyMatrixDim(st);
          }
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.dimFocus === 0) st.dimFocus = 1;
          else this.applyMatrixDim(st);
          return;
        }
        return;
      }

      if (st.step === 'optn') {
        var len = MAT_OPTN_ITEMS.length;
        if (key === 'AC') { st.step = 'calc'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % len; return; }
        if (/^[0-9]$/.test(key)) {
          var oIdx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          this.pickMatOptn(st, oIdx);
          return;
        }
        if (key === 'VAR_A' || key === '(-)') {
          this.pickMatOptn(st, 10);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.pickMatOptn(st, st.optnIdx);
          return;
        }
        return;
      }

      if (st.step === 'edit') {
        var M = st.mats[st.activeMat];
        var m = M.length, n = M[0].length;
        if (key === 'AC') {
          if (st.editStr !== '') st.editStr = '';
          else st.step = 'calc';
          return;
        }
        if (key === 'DEL') { st.editStr = st.editStr.slice(0, -1); return; }
        if (key === 'LEFT') {
          this.commitMatCell(ctx);
          if (st.cIdx > 0) st.cIdx--;
          else if (st.rIdx > 0) { st.rIdx--; st.cIdx = n - 1; }
          return;
        }
        if (key === 'RIGHT') {
          this.commitMatCell(ctx);
          if (st.cIdx < n - 1) st.cIdx++;
          else if (st.rIdx < m - 1) { st.rIdx++; st.cIdx = 0; }
          return;
        }
        if (key === 'UP' && st.rIdx > 0) { this.commitMatCell(ctx); st.rIdx--; return; }
        if (key === 'DOWN' && st.rIdx < m - 1) { this.commitMatCell(ctx); st.rIdx++; return; }
        if (key === '=' || key === 'OK') {
          this.commitMatCell(ctx);
          if (st.cIdx < n - 1) st.cIdx++;
          else if (st.rIdx < m - 1) { st.rIdx++; st.cIdx = 0; }
          return;
        }
        var ch = mapKeyToCellChar(key);
        if (ch) st.editStr += ch;
        return;
      }

      // Đang ở màn 'calc'
      if (key === 'AC') {
        st.calcExpr = '';
        st.calcRes = null;
        return;
      }
      if (key === 'DEL') {
        st.calcExpr = st.calcExpr.replace(/(MatAns|MatA|MatB|MatC|MatD|Identity\(|Rref\(|Ref\(|Trn\(|det\(|⁻¹|.)$/, '');
        return;
      }
      if (key === 'S_D') {
        st.showDecimal = !st.showDecimal;
        return;
      }
      if (st.calcRes && Array.isArray(st.calcRes.result)) {
        var R = st.calcRes.result;
        if (key === 'UP' && st.resR > 0) { st.resR--; return; }
        if (key === 'DOWN' && st.resR < R.length - 1) { st.resR++; return; }
        if (key === 'LEFT' && st.resC > 0) { st.resC--; return; }
        if (key === 'RIGHT' && st.resC < R[0].length - 1) { st.resC++; return; }
      }
      if (key === '=' || key === 'OK') {
        var ev = CalcEngine.matrix.evalExpr(st.calcExpr, st.mats);
        st.calcRes = ev;
        st.resR = 0;
        st.resC = 0;
        st.showDecimal = false;
        if (ev.ok) {
          if (Array.isArray(ev.result)) st.mats.MatAns = ev.result;
          else if (typeof ev.result === 'number') ctx.vars.Ans = ev.result;
        }
        return;
      }

      var tokenMap = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '−', '(-)': '-', '*': '×', '/': '÷',
        '(': '(', ')': ')', 'INV': '⁻¹', 'SQ': '²', 'CUBE': '³', 'POW': '^',
        'VAR_A': 'MatA', 'VAR_B': 'MatB', 'VAR_C': 'MatC', 'VAR_D': 'MatD', 'ANS': 'MatAns'
      };
      if (tokenMap[key]) {
        st.calcExpr += tokenMap[key];
      }
    },
    confirmSelect: function (st) {
      if (st.selectIdx === 4) {
        st.step = 'calc';
        return;
      }
      st.activeMat = MAT_NAMES[st.selectIdx];
      var cur = st.mats[st.activeMat];
      st.dimM = cur ? cur.length : 2;
      st.dimN = cur ? cur[0].length : 2;
      st.dimFocus = 0;
      st.step = 'dim';
    },
    applyMatrixDim: function (st) {
      var old = st.mats[st.activeMat];
      var M = createZeroMat(st.dimM, st.dimN);
      if (old) {
        for (var i = 0; i < Math.min(st.dimM, old.length); i++) {
          for (var j = 0; j < Math.min(st.dimN, old[0].length); j++) {
            M[i][j] = old[i][j];
          }
        }
      }
      st.mats[st.activeMat] = M;
      st.rIdx = 0;
      st.cIdx = 0;
      st.editStr = '';
      st.step = 'edit';
    },
    commitMatCell: function (ctx) {
      var st = ctx.matrixState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (!isNaN(v)) {
        st.mats[st.activeMat][st.rIdx][st.cIdx] = v;
      }
    },
    pickMatOptn: function (st, idx) {
      var item = MAT_OPTN_ITEMS[idx];
      if (!item) return;
      if (item.action === 'define') {
        st.step = 'select';
        return;
      }
      st.calcExpr += item.text;
      st.step = 'calc';
    }
  });

  // =========================================================================
  // 5. ỨNG DỤNG VECTƠ (vector)
  // =========================================================================
  var VCT_NAMES = ['VctA', 'VctB', 'VctC', 'VctD'];
  var VCT_OPTN_ITEMS = [
    { label: '1. Vectơ A — VctA', text: 'VctA' },
    { label: '2. Vectơ B — VctB', text: 'VctB' },
    { label: '3. Vectơ C — VctC', text: 'VctC' },
    { label: '4. Vectơ D — VctD', text: 'VctD' },
    { label: '5. Kết quả trước — VctAns', text: 'VctAns' },
    { label: '6. Tích vô hướng — · (Dot)', text: '·' },
    { label: '7. Góc giữa 2 vectơ — Angle(', text: 'Angle(' },
    { label: '8. Vectơ đơn vị — UnitV(', text: 'UnitV(' },
    { label: '9. Độ dài vectơ — Abs(', text: 'Abs(' },
    { label: '0. Tạo / Sửa vectơ (VctA–VctD)', action: 'define' }
  ];

  CalcApps.register({
    id: 'vector',
    code: '5',
    name: 'Vectơ',
    icon: '→V',
    stage: 1,
    init: function (ctx) {
      if (!ctx.vectorState) {
        ctx.vectorState = {
          step: 'select', // 'select' | 'dim' | 'edit' | 'calc' | 'optn'
          activeVct: 'VctA',
          selectIdx: 0,
          dim: 3,
          vcts: {
            VctA: [1, 2, 3],
            VctB: [4, 5, 6],
            VctC: [1, 0],
            VctD: [0, 1],
            VctAns: [0, 0, 0]
          },
          cIdx: 0,
          editStr: '',
          calcExpr: 'VctA·VctB',
          calcRes: null,
          showDecimal: false,
          optnIdx: 0
        };
      }
      ctx.vectorState.step = 'select';
    },
    openOptn: function (ctx) {
      var st = ctx.vectorState;
      st.step = (st.step === 'optn') ? 'calc' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.vectorState;
      var fmt = ctx.getFormatOpts();

      if (st.step === 'select') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn vectơ để tạo/sửa hoặc tính toán:</div>';
        for (var i = 0; i < 4; i++) {
          var vName = VCT_NAMES[i];
          var v = st.vcts[vName];
          var cls = (st.selectIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="vct-pick" data-idx="' + i + '">' +
                  '<span>' + (i + 1) + '. ' + vName + '</span><b>[' + (v ? v.length + 'D' : '-') + ']</b></div>';
        }
        var clsCalc = (st.selectIdx === 4) ? 'lcd-list-item active' : 'lcd-list-item';
        html += '<div class="' + clsCalc + '" data-action="vct-pick" data-idx="4"><span>5. Màn hình tính toán vectơ</span><b>▶</b></div>';
        html += '</div>';
        return html;
      }

      if (st.step === 'dim') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Chọn số chiều cho ' + escapeHtml(st.activeVct) + ':</div>' +
            '<div class="lcd-list-item ' + (st.dim === 2 ? 'active' : '') + '" data-action="vct-dim" data-d="2">1. Không gian 2 chiều (2D: x, y)</div>' +
            '<div class="lcd-list-item ' + (st.dim === 3 ? 'active' : '') + '" data-action="vct-dim" data-d="3">2. Không gian 3 chiều (3D: x, y, z)</div>' +
          '</div>'
        );
      }

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Vectơ:</div>';
        for (var j = 0; j < VCT_OPTN_ITEMS.length; j++) {
          var oCls = (j === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + oCls + '" data-action="vct-optn" data-idx="' + j + '">' +
                   escapeHtml(VCT_OPTN_ITEMS[j].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'edit') {
        var V = st.vcts[st.activeVct];
        var d = V.length;
        var axis = ['x', 'y', 'z'];
        var eHtml = '<div class="lcd-table-wrap">';
        eHtml += '<div class="lcd-table-bar"><span>Nhập ' + st.activeVct + ' (' + d + 'D)</span>' +
                 '<span class="lcd-inline-btn" data-action="vct-go-calc">[Tính toán ▶]</span></div>';
        eHtml += '<table class="lcd-grid"><thead><tr>';
        for (var a = 0; a < d; a++) eHtml += '<th>' + axis[a] + '</th>';
        eHtml += '</tr></thead><tbody><tr>';
        for (var c = 0; c < d; c++) {
          eHtml += '<td class="' + (c === st.cIdx ? 'sel' : '') + '" data-action="vct-cell" data-c="' + c + '">' +
                   escapeHtml(CalcEngine.format(V[c], fmt)) + '</td>';
        }
        eHtml += '</tr></tbody></table>';
        var curStr = st.editStr !== '' ? st.editStr : String(V[st.cIdx]);
        eHtml += '<div class="lcd-cell-edit">' + st.activeVct + '[' + axis[st.cIdx] + '] = <b>' +
                 escapeHtml(curStr) + '</b><span class="m-cursor"></span></div>';
        eHtml += '</div>';
        return eHtml;
      }

      // Màn hình 'calc'
      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>Biểu thức vectơ:</span>' +
               '<span><span class="lcd-inline-btn" data-action="vct-open-optn">[OPTN]</span> ' +
               '<span class="lcd-inline-btn" data-action="vct-open-select">[Sửa Vct]</span></span></div>';
      cHtml += '<div class="lcd-cell-edit"><b>' + escapeHtml(st.calcExpr) + '</b><span class="m-cursor"></span></div>';

      if (st.calcRes) {
        if (st.calcRes.error) {
          cHtml += '<div class="lcd-error">' + escapeHtml(st.calcRes.error) + '</div>';
        } else if (typeof st.calcRes.result === 'number') {
          var vNum = st.calcRes.result;
          var vEx = (!st.showDecimal && CalcEngine.toExact(vNum)) || CalcEngine.format(vNum, fmt);
          cHtml += '<div class="lcd-res-line">' + CalcEditor.renderResultHTML(vEx, false) + '</div>';
        } else if (Array.isArray(st.calcRes.result)) {
          var RV = st.calcRes.result;
          cHtml += '<table class="lcd-grid"><tbody><tr>';
          for (var k = 0; k < RV.length; k++) {
            var cv = RV[k];
            var cDisp = (!st.showDecimal && CalcEngine.toExact(cv)) || CalcEngine.format(cv, fmt);
            cHtml += '<td>' + escapeHtml(cDisp) + '</td>';
          }
          cHtml += '</tr></tbody></table>';
          cHtml += '<div class="lcd-sub-hint">Bấm S⇔D để đổi phân số ↔ thập phân</div>';
        }
      } else {
        cHtml += '<div class="lcd-sub-hint">Ví dụ: VctA+VctB, VctA·VctB, VctA×VctB, Angle(VctA,VctB), UnitV(VctA)</div>';
      }
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.vectorState;

      if (st.step === 'select') {
        if (key === 'UP') { st.selectIdx = (st.selectIdx + 4) % 5; return; }
        if (key === 'DOWN') { st.selectIdx = (st.selectIdx + 1) % 5; return; }
        if (key === 'AC') { st.step = 'calc'; return; }
        var nSel = parseInt(key, 10);
        if (nSel >= 1 && nSel <= 5) {
          st.selectIdx = nSel - 1;
          this.confirmSelect(st);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.confirmSelect(st);
          return;
        }
        return;
      }

      if (st.step === 'dim') {
        if (key === 'AC') { st.step = 'select'; return; }
        if (key === 'UP' || key === 'DOWN') { st.dim = st.dim === 2 ? 3 : 2; return; }
        if (key === '1' || key === '2') {
          st.dim = key === '1' ? 2 : 3;
          this.applyVctDim(st);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.applyVctDim(st);
          return;
        }
        return;
      }

      if (st.step === 'optn') {
        var len = VCT_OPTN_ITEMS.length;
        if (key === 'AC') { st.step = 'calc'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % len; return; }
        if (/^[0-9]$/.test(key)) {
          var oIdx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          this.pickVctOptn(st, oIdx);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.pickVctOptn(st, st.optnIdx);
          return;
        }
        return;
      }

      if (st.step === 'edit') {
        var V = st.vcts[st.activeVct];
        var d = V.length;
        if (key === 'AC') {
          if (st.editStr !== '') st.editStr = '';
          else st.step = 'calc';
          return;
        }
        if (key === 'DEL') { st.editStr = st.editStr.slice(0, -1); return; }
        if (key === 'LEFT' && st.cIdx > 0) { this.commitVctCell(ctx); st.cIdx--; return; }
        if (key === 'RIGHT' && st.cIdx < d - 1) { this.commitVctCell(ctx); st.cIdx++; return; }
        if (key === '=' || key === 'OK') {
          this.commitVctCell(ctx);
          if (st.cIdx < d - 1) st.cIdx++;
          return;
        }
        var ch = mapKeyToCellChar(key);
        if (ch) st.editStr += ch;
        return;
      }

      // Màn hình 'calc'
      if (key === 'AC') { st.calcExpr = ''; st.calcRes = null; return; }
      if (key === 'DEL') {
        st.calcExpr = st.calcExpr.replace(/(VctAns|VctA|VctB|VctC|VctD|Angle\(|UnitV\(|Abs\(|Dot\(|.)$/, '');
        return;
      }
      if (key === 'S_D') { st.showDecimal = !st.showDecimal; return; }
      if (key === '=' || key === 'OK') {
        var ev = CalcEngine.vector.evalExpr(st.calcExpr, st.vcts, { angle: ctx.settings.angle });
        st.calcRes = ev;
        st.showDecimal = false;
        if (ev.ok) {
          if (Array.isArray(ev.result)) st.vcts.VctAns = ev.result;
          else if (typeof ev.result === 'number') ctx.vars.Ans = ev.result;
        }
        return;
      }

      var tokenMap = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '−', '(-)': '-', '*': '×', '/': '÷',
        '(': '(', ')': ')', ',': ',', 'ABS': 'Abs(',
        'VAR_A': 'VctA', 'VAR_B': 'VctB', 'VAR_C': 'VctC', 'VAR_D': 'VctD', 'ANS': 'VctAns'
      };
      if (tokenMap[key]) {
        st.calcExpr += tokenMap[key];
      }
    },
    confirmSelect: function (st) {
      if (st.selectIdx === 4) {
        st.step = 'calc';
        return;
      }
      st.activeVct = VCT_NAMES[st.selectIdx];
      var cur = st.vcts[st.activeVct];
      st.dim = cur ? cur.length : 3;
      st.step = 'dim';
    },
    applyVctDim: function (st) {
      var old = st.vcts[st.activeVct] || [0, 0, 0];
      var V = [];
      for (var i = 0; i < st.dim; i++) V.push(old[i] || 0);
      st.vcts[st.activeVct] = V;
      st.cIdx = 0;
      st.editStr = '';
      st.step = 'edit';
    },
    commitVctCell: function (ctx) {
      var st = ctx.vectorState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (!isNaN(v)) st.vcts[st.activeVct][st.cIdx] = v;
    },
    pickVctOptn: function (st, idx) {
      var item = VCT_OPTN_ITEMS[idx];
      if (!item) return;
      if (item.action === 'define') {
        st.step = 'select';
        return;
      }
      st.calcExpr += item.text;
      st.step = 'calc';
    }
  });

  // =========================================================================
  // 7. ỨNG DỤNG PHÂN PHỐI XÁC SUẤT (dist)
  // =========================================================================
  var DIST_TYPES = [
    { key: 'normPD', label: '1. Phân phối chuẩn PD (Normal PD)', hasList: true },
    { key: 'normCD', label: '2. Phân phối chuẩn CD (Normal CD)', hasList: false },
    { key: 'invN', label: '3. Nghịch đảo chuẩn (Inverse Normal)', hasList: false },
    { key: 'binomPD', label: '4. Nhị thức PD (Binomial PD)', hasList: true },
    { key: 'binomCD', label: '5. Nhị thức CD (Binomial CD)', hasList: true },
    { key: 'poissonPD', label: '6. Poisson PD', hasList: true },
    { key: 'poissonCD', label: '7. Poisson CD', hasList: true }
  ];

  CalcApps.register({
    id: 'dist',
    code: '7',
    name: 'Phân phối',
    icon: '🔔',
    stage: 1,
    init: function (ctx) {
      if (!ctx.distState) {
        ctx.distState = {
          step: 'menu', // 'menu' | 'mode' | 'params' | 'list' | 'result'
          typeIdx: 0,
          distKey: 'normPD',
          inputMode: 'var', // 'var' (Biến) | 'list' (Danh sách)
          params: {
            x: '0',
            lower: '-1',
            upper: '1',
            sigma: '1',
            mu: '0',
            area: '0.975',
            n: '10',
            p: '0.5',
            lambda: '3'
          },
          paramIdx: 0,
          listX: [0, 1, 2, 3],
          listP: [null, null, null, null],
          listRow: 0,
          editStr: '',
          resVal: null
        };
      }
      ctx.distState.step = 'menu';
    },
    openOptn: function (ctx) {
      ctx.distState.step = 'menu';
      return true;
    },
    getParamDefs: function (st) {
      var k = st.distKey;
      var isList = (st.inputMode === 'list');
      if (k === 'normPD') {
        return isList
          ? [{ k: 'sigma', lbl: 'Độ lệch chuẩn σ:' }, { k: 'mu', lbl: 'Trung bình μ:' }]
          : [{ k: 'x', lbl: 'Giá trị x:' }, { k: 'sigma', lbl: 'Độ lệch chuẩn σ:' }, { k: 'mu', lbl: 'Trung bình μ:' }];
      }
      if (k === 'normCD') {
        return [
          { k: 'lower', lbl: 'Cận dưới (Lower):' },
          { k: 'upper', lbl: 'Cận trên (Upper):' },
          { k: 'sigma', lbl: 'Độ lệch chuẩn σ:' },
          { k: 'mu', lbl: 'Trung bình μ:' }
        ];
      }
      if (k === 'invN') {
        return [
          { k: 'area', lbl: 'Diện tích trái (Area):' },
          { k: 'sigma', lbl: 'Độ lệch chuẩn σ:' },
          { k: 'mu', lbl: 'Trung bình μ:' }
        ];
      }
      if (k === 'binomPD' || k === 'binomCD') {
        return isList
          ? [{ k: 'n', lbl: 'Số phép thử N:' }, { k: 'p', lbl: 'Xác suất p:' }]
          : [{ k: 'x', lbl: 'Giá trị x:' }, { k: 'n', lbl: 'Số phép thử N:' }, { k: 'p', lbl: 'Xác suất p:' }];
      }
      return isList
        ? [{ k: 'lambda', lbl: 'Tham số λ:' }]
        : [{ k: 'x', lbl: 'Giá trị x:' }, { k: 'lambda', lbl: 'Tham số λ:' }];
    },
    render: function (ctx) {
      var st = ctx.distState;
      var fmt = ctx.getFormatOpts();

      if (st.step === 'menu') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn loại phân phối xác suất:</div>';
        for (var i = 0; i < DIST_TYPES.length; i++) {
          var cls = (i === st.typeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="dist-pick" data-idx="' + i + '">' +
                  escapeHtml(DIST_TYPES[i].label) + '</div>';
        }
        html += '</div>';
        return html;
      }

      if (st.step === 'mode') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Chọn kiểu dữ liệu đầu vào:</div>' +
            '<div class="lcd-list-item ' + (st.inputMode === 'var' ? 'active' : '') + '" data-action="dist-mode" data-m="var">1. Biến (Một giá trị x)</div>' +
            '<div class="lcd-list-item ' + (st.inputMode === 'list' ? 'active' : '') + '" data-action="dist-mode" data-m="list">2. Danh sách (Nhiều giá trị x)</div>' +
          '</div>'
        );
      }

      if (st.step === 'params') {
        var defs = this.getParamDefs(st);
        var pHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' +
                    escapeHtml(DIST_TYPES[st.typeIdx].label) + ':</div>';
        for (var j = 0; j < defs.length; j++) {
          var d = defs[j];
          var pCls = (j === st.paramIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          pHtml += '<div class="' + pCls + '" data-action="dist-param" data-idx="' + j + '">' +
                   '<span>' + escapeHtml(d.lbl) + '</span>' +
                   '<b>' + escapeHtml(st.params[d.k]) + (j === st.paramIdx ? '▏' : '') + '</b></div>';
        }
        pHtml += '<div class="lcd-sub-hint">Bấm = để ' + (st.inputMode === 'list' ? 'vào bảng danh sách x' : 'tính kết quả') + '</div></div>';
        return pHtml;
      }

      if (st.step === 'list') {
        var lHtml = '<div class="lcd-table-wrap">';
        lHtml += '<div class="lcd-table-bar"><span>Danh sách x (' + escapeHtml(st.distKey) + ')</span>' +
                 '<span class="lcd-inline-btn" data-action="dist-calc-list">[Tính P =]</span></div>';
        lHtml += '<table class="lcd-grid"><thead><tr><th>#</th><th>x</th><th>P</th></tr></thead><tbody>';
        var total = st.listX.length + 1;
        for (var r = 0; r < total; r++) {
          var xv = st.listX[r];
          var pv = st.listP[r];
          lHtml += '<tr><td class="lcd-grid-idx">' + (r + 1) + '</td>';
          lHtml += '<td class="' + (r === st.listRow ? 'sel' : '') + '" data-action="dist-list-row" data-r="' + r + '">' +
                   escapeHtml(xv !== undefined ? String(xv) : '') + '</td>';
          lHtml += '<td>' + escapeHtml(typeof pv === 'number' ? CalcEngine.format(pv, fmt) : (pv || '')) + '</td></tr>';
        }
        lHtml += '</tbody></table>';
        var curX = st.editStr !== '' ? st.editStr : (st.listX[st.listRow] !== undefined ? String(st.listX[st.listRow]) : '');
        lHtml += '<div class="lcd-cell-edit">x = <b>' + escapeHtml(curX) + '</b><span class="m-cursor"></span> (Bấm = để tính cả danh sách)</div>';
        lHtml += '</div>';
        return lHtml;
      }

      // Màn hình kết quả đơn ('result')
      var rStr = '';
      if (st.resVal && st.resVal.error) {
        rStr = '<div class="lcd-error">' + escapeHtml(st.resVal.error) + '</div>';
      } else if (typeof st.resVal === 'number') {
        var lbl = st.distKey === 'invN' ? 'x = ' : 'P = ';
        rStr = '<div class="lcd-res-line">' + lbl + escapeHtml(CalcEngine.format(st.resVal, fmt)) + '</div>';
      }
      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-list-title">' + escapeHtml(DIST_TYPES[st.typeIdx].label) + ' — Kết quả:</div>' +
          rStr +
          '<div class="lcd-sub-hint">Bấm = hoặc AC để quay lại sửa tham số</div>' +
        '</div>'
      );
    },
    onKey: function (key, ctx) {
      var st = ctx.distState;

      if (st.step === 'menu') {
        if (key === 'UP') { st.typeIdx = (st.typeIdx + DIST_TYPES.length - 1) % DIST_TYPES.length; return; }
        if (key === 'DOWN') { st.typeIdx = (st.typeIdx + 1) % DIST_TYPES.length; return; }
        var n = parseInt(key, 10);
        if (n >= 1 && n <= DIST_TYPES.length) {
          st.typeIdx = n - 1;
          this.selectDistType(st);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.selectDistType(st);
          return;
        }
        return;
      }

      if (st.step === 'mode') {
        if (key === 'AC') { st.step = 'menu'; return; }
        if (key === 'UP' || key === 'DOWN') { st.inputMode = st.inputMode === 'var' ? 'list' : 'var'; return; }
        if (key === '1' || key === '2') {
          st.inputMode = key === '1' ? 'var' : 'list';
          st.paramIdx = 0;
          st.step = 'params';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.paramIdx = 0;
          st.step = 'params';
          return;
        }
        return;
      }

      if (st.step === 'params') {
        var defs = this.getParamDefs(st);
        var curKey = defs[st.paramIdx].k;
        if (key === 'AC') {
          st.step = DIST_TYPES[st.typeIdx].hasList ? 'mode' : 'menu';
          return;
        }
        if (key === 'UP' && st.paramIdx > 0) { st.paramIdx--; return; }
        if (key === 'DOWN' && st.paramIdx < defs.length - 1) { st.paramIdx++; return; }
        if (key === 'DEL') {
          st.params[curKey] = st.params[curKey].slice(0, -1);
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.paramIdx < defs.length - 1) {
            st.paramIdx++;
          } else if (st.inputMode === 'list') {
            st.step = 'list';
            st.listRow = 0;
            st.editStr = '';
            this.computeDistList(ctx);
          } else {
            this.computeDistSingle(ctx);
          }
          return;
        }
        var ch = mapKeyToCellChar(key);
        if (ch) st.params[curKey] += ch;
        return;
      }

      if (st.step === 'list') {
        if (key === 'AC') {
          if (st.editStr !== '') st.editStr = '';
          else st.step = 'params';
          return;
        }
        if (key === 'UP') {
          this.commitListCell(ctx);
          if (st.listRow > 0) st.listRow--;
          return;
        }
        if (key === 'DOWN') {
          this.commitListCell(ctx);
          if (st.listRow < st.listX.length) st.listRow++;
          return;
        }
        if (key === 'DEL') {
          if (st.editStr !== '') {
            st.editStr = st.editStr.slice(0, -1);
          } else if (st.listX[st.listRow] !== undefined && st.listX.length > 1) {
            st.listX.splice(st.listRow, 1);
            st.listP.splice(st.listRow, 1);
            if (st.listRow >= st.listX.length) st.listRow = st.listX.length - 1;
          }
          return;
        }
        if (key === '=' || key === 'OK') {
          this.commitListCell(ctx);
          this.computeDistList(ctx);
          if (st.listRow < st.listX.length) st.listRow++;
          return;
        }
        var chL = mapKeyToCellChar(key);
        if (chL) st.editStr += chL;
        return;
      }

      if (st.step === 'result') {
        if (key === 'AC' || key === '=' || key === 'OK') {
          st.step = 'params';
        }
      }
    },
    selectDistType: function (st) {
      var info = DIST_TYPES[st.typeIdx];
      st.distKey = info.key;
      if (info.hasList) {
        st.step = 'mode';
      } else {
        st.inputMode = 'var';
        st.paramIdx = 0;
        st.step = 'params';
      }
    },
    commitListCell: function (ctx) {
      var st = ctx.distState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (!isNaN(v)) {
        st.listX[st.listRow] = v;
      }
    },
    computeDistSingle: function (ctx) {
      var st = ctx.distState;
      var p = st.params;
      var x = evalCellInput(p.x, ctx, 0);
      var low = evalCellInput(p.lower, ctx, -1);
      var up = evalCellInput(p.upper, ctx, 1);
      var sig = evalCellInput(p.sigma, ctx, 1);
      var mu = evalCellInput(p.mu, ctx, 0);
      var area = evalCellInput(p.area, ctx, 0.5);
      var n = evalCellInput(p.n, ctx, 10);
      var pr = evalCellInput(p.p, ctx, 0.5);
      var lam = evalCellInput(p.lambda, ctx, 1);

      var k = st.distKey;
      var res;
      if (k === 'normPD') res = CalcEngine.dist.normPD(x, sig, mu);
      else if (k === 'normCD') res = CalcEngine.dist.normCD(low, up, sig, mu);
      else if (k === 'invN') res = CalcEngine.dist.invN(area, sig, mu);
      else if (k === 'binomPD') res = CalcEngine.dist.binomPD(x, n, pr);
      else if (k === 'binomCD') res = CalcEngine.dist.binomCD(x, n, pr);
      else if (k === 'poissonPD') res = CalcEngine.dist.poissonPD(x, lam);
      else if (k === 'poissonCD') res = CalcEngine.dist.poissonCD(x, lam);

      st.resVal = res;
      if (typeof res === 'number') ctx.vars.Ans = res;
      st.step = 'result';
    },
    computeDistList: function (ctx) {
      var st = ctx.distState;
      var p = st.params;
      var sig = evalCellInput(p.sigma, ctx, 1);
      var mu = evalCellInput(p.mu, ctx, 0);
      var n = evalCellInput(p.n, ctx, 10);
      var pr = evalCellInput(p.p, ctx, 0.5);
      var lam = evalCellInput(p.lambda, ctx, 1);

      var k = st.distKey;
      var resArr;
      if (k === 'normPD') resArr = CalcEngine.dist.normPD(st.listX, sig, mu);
      else if (k === 'binomPD') resArr = CalcEngine.dist.binomPD(st.listX, n, pr);
      else if (k === 'binomCD') resArr = CalcEngine.dist.binomCD(st.listX, n, pr);
      else if (k === 'poissonPD') resArr = CalcEngine.dist.poissonPD(st.listX, lam);
      else if (k === 'poissonCD') resArr = CalcEngine.dist.poissonCD(st.listX, lam);

      if (Array.isArray(resArr)) {
        st.listP = resArr;
      }
    }
  });

  // =========================================================================
  // 8. ỨNG DỤNG BẢNG TÍNH (sheet) — 45 hàng × 5 cột (A–E)
  // =========================================================================
  var SHEET_OPTN_ITEMS = [
    { label: '1. Điền công thức (Fill Formula)', action: 'fill_formula' },
    { label: '2. Điền giá trị (Fill Value)', action: 'fill_value' },
    { label: '3. Chèn hàm Sum( — Tổng vùng', text: 'Sum(' },
    { label: '4. Chèn hàm Mean( — Trung bình', text: 'Mean(' },
    { label: '5. Chèn hàm Min( — Nhỏ nhất', text: 'Min(' },
    { label: '6. Chèn hàm Max( — Lớn nhất', text: 'Max(' },
    { label: '7. Chèn dấu : (Dải ô, vd A1:A5)', text: ':' },
    { label: '8. Tự tính lại (Bật / Tắt)', action: 'toggle_recalc' },
    { label: '9. Tính lại toàn bảng ngay', action: 'recalc_now' },
    { label: '0. Xóa toàn bộ bảng tính', action: 'clear_all' }
  ];

  CalcApps.register({
    id: 'sheet',
    code: '8',
    name: 'Bảng tính',
    icon: '▦',
    stage: 1,
    init: function (ctx) {
      if (!ctx.sheetState) {
        var sh = CalcEngine.sheet.newSheet();
        CalcEngine.sheet.setCell(sh, 'A1', 2);
        CalcEngine.sheet.setCell(sh, 'A2', 3);
        CalcEngine.sheet.setCell(sh, 'B1', '=A1+A2');
        ctx.sheetState = {
          sheet: sh,
          step: 'grid', // 'grid' | 'optn' | 'fill'
          selCol: 0,
          selRow: 0,
          scrollRow: 0,
          editStr: '',
          isEditing: false,
          optnIdx: 0,
          fillMode: 'formula', // 'formula' | 'value'
          fillExpr: '=A1*2',
          fillRange: 'B1:B5',
          fillFocus: 0
        };
      }
      ctx.sheetState.step = 'grid';
    },
    openOptn: function (ctx) {
      var st = ctx.sheetState;
      st.step = (st.step === 'optn') ? 'grid' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.sheetState;
      var sh = st.sheet;
      var fmt = ctx.getFormatOpts();

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Bảng tính (Tự tính lại: ' +
                    (sh.autoRecalc ? 'BẬT' : 'TẮT') + '):</div>';
        for (var i = 0; i < SHEET_OPTN_ITEMS.length; i++) {
          var cls = (i === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + cls + '" data-action="sheet-optn" data-idx="' + i + '">' +
                   escapeHtml(SHEET_OPTN_ITEMS[i].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'fill') {
        var title = st.fillMode === 'formula' ? 'Điền công thức (Fill Formula):' : 'Điền giá trị (Fill Value):';
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + title + '</div>' +
            '<div class="lcd-list-item ' + (st.fillFocus === 0 ? 'active' : '') + '" data-action="sheet-fill-focus" data-f="0">' +
              '<span>' + (st.fillMode === 'formula' ? 'Công thức:' : 'Biểu thức/Giá trị:') + '</span>' +
              '<b>' + escapeHtml(st.fillExpr) + (st.fillFocus === 0 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.fillFocus === 1 ? 'active' : '') + '" data-action="sheet-fill-focus" data-f="1">' +
              '<span>Phạm vi (vd B1:B5):</span>' +
              '<b>' + escapeHtml(st.fillRange) + (st.fillFocus === 1 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-sub-hint">Bấm = để thực hiện điền vào dải ô</div>' +
          '</div>'
        );
      }

      // Đảm bảo dòng chọn nằm trong khung nhìn 4 dòng
      if (st.selRow < st.scrollRow) st.scrollRow = st.selRow;
      if (st.selRow >= st.scrollRow + 4) st.scrollRow = st.selRow - 3;

      var colNames = ['A', 'B', 'C', 'D', 'E'];
      var curRef = colNames[st.selCol] + (st.selRow + 1);
      var cellObj = sh.cells[curRef];

      var html = '<div class="lcd-table-wrap">';
      html += '<div class="lcd-table-bar">' +
                '<span>Bảng tính (Hàng ' + (st.scrollRow + 1) + '–' + Math.min(45, st.scrollRow + 4) + '/45)</span>' +
                '<span>' +
                  '<span class="lcd-inline-btn" data-action="sheet-ins-eq">[=]</span> ' +
                  '<span class="lcd-inline-btn" data-action="sheet-ins-colon">[:]</span> ' +
                  '<span class="lcd-inline-btn" data-action="sheet-open-optn">[OPTN]</span>' +
                '</span>' +
              '</div>';
      html += '<table class="lcd-grid sheet-grid"><thead><tr><th>#</th>';
      for (var c = 0; c < 5; c++) html += '<th>' + colNames[c] + '</th>';
      html += '</tr></thead><tbody>';

      var endR = Math.min(45, st.scrollRow + 4);
      for (var r = st.scrollRow; r < endR; r++) {
        html += '<tr><td class="lcd-grid-idx">' + (r + 1) + '</td>';
        for (var c2 = 0; c2 < 5; c2++) {
          var k = colNames[c2] + (r + 1);
          var cVal = sh.cells[k].value;
          var disp = '';
          if (typeof cVal === 'number') disp = CalcEngine.format(cVal, fmt);
          else if (cVal !== null && cVal !== undefined) disp = String(cVal);
          var isSel = (r === st.selRow && c2 === st.selCol);
          html += '<td class="' + (isSel ? 'sel' : '') + '" data-action="sheet-cell" data-r="' + r + '" data-c="' + c2 + '">' +
                  escapeHtml(disp) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      var bottomText = st.isEditing ? st.editStr : (cellObj.raw || '');
      html += '<div class="lcd-cell-edit"><b>' + curRef + ':</b> ' + escapeHtml(bottomText) +
              '<span class="m-cursor"></span></div>';
      html += '</div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.sheetState;
      var sh = st.sheet;
      var colNames = ['A', 'B', 'C', 'D', 'E'];

      if (st.step === 'optn') {
        var len = SHEET_OPTN_ITEMS.length;
        if (key === 'AC') { st.step = 'grid'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % len; return; }
        if (/^[0-9]$/.test(key)) {
          var idx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          this.execSheetOptn(st, idx);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.execSheetOptn(st, st.optnIdx);
          return;
        }
        return;
      }

      if (st.step === 'fill') {
        var prop = st.fillFocus === 0 ? 'fillExpr' : 'fillRange';
        if (key === 'AC') { st.step = 'grid'; return; }
        if (key === 'UP' || key === 'DOWN') { st.fillFocus = st.fillFocus === 0 ? 1 : 0; return; }
        if (key === 'DEL') { st[prop] = st[prop].slice(0, -1); return; }
        if (key === '=' || key === 'OK') {
          if (st.fillFocus === 0) {
            st.fillFocus = 1;
          } else {
            if (st.fillMode === 'formula') {
              CalcEngine.sheet.fillFormula(sh, st.fillExpr, st.fillRange);
            } else {
              CalcEngine.sheet.fillValue(sh, st.fillExpr, st.fillRange);
            }
            st.step = 'grid';
          }
          return;
        }
        var fCh = this.mapKeyToSheetChar(key);
        if (fCh) st[prop] += fCh;
        return;
      }

      // Đang ở lưới bảng tính ('grid')
      if (key === 'UP') {
        this.commitSheetCell(st);
        if (st.selRow > 0) st.selRow--;
        return;
      }
      if (key === 'DOWN') {
        this.commitSheetCell(st);
        if (st.selRow < 44) st.selRow++;
        return;
      }
      if (key === 'LEFT') {
        this.commitSheetCell(st);
        if (st.selCol > 0) st.selCol--;
        return;
      }
      if (key === 'RIGHT') {
        this.commitSheetCell(st);
        if (st.selCol < 4) st.selCol++;
        return;
      }
      if (key === 'AC') {
        if (st.isEditing) {
          st.isEditing = false;
          st.editStr = '';
        }
        return;
      }
      if (key === 'DEL') {
        if (st.isEditing) {
          st.editStr = st.editStr.slice(0, -1);
        } else {
          var curRef = colNames[st.selCol] + (st.selRow + 1);
          CalcEngine.sheet.setCell(sh, curRef, '');
        }
        return;
      }
      if (key === '=' || key === 'OK') {
        this.commitSheetCell(st);
        if (st.selRow < 44) st.selRow++;
        return;
      }

      var sCh = this.mapKeyToSheetChar(key);
      if (sCh) {
        if (!st.isEditing) {
          st.isEditing = true;
          st.editStr = '';
        }
        st.editStr += sCh;
      }
    },
    mapKeyToSheetChar: function (key) {
      var m = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '-', '(-)': '-', '*': '*', '/': '/',
        '(': '(', ')': ')', ',': ':', 'EQUAL_SIGN': '=',
        'VAR_A': 'A', 'VAR_B': 'B', 'VAR_C': 'C', 'VAR_D': 'D', 'VAR_E': 'E',
        'DMS': 'B', 'INV': 'C', 'sin': 'D', 'cos': 'E', 'SUM': 'Sum('
      };
      return m[key] || null;
    },
    commitSheetCell: function (st) {
      if (!st.isEditing) return;
      var colNames = ['A', 'B', 'C', 'D', 'E'];
      var ref = colNames[st.selCol] + (st.selRow + 1);
      CalcEngine.sheet.setCell(st.sheet, ref, st.editStr);
      st.isEditing = false;
      st.editStr = '';
    },
    execSheetOptn: function (st, idx) {
      var item = SHEET_OPTN_ITEMS[idx];
      if (!item) return;
      var colNames = ['A', 'B', 'C', 'D', 'E'];
      var curRef = colNames[st.selCol] + (st.selRow + 1);
      var endRef = colNames[st.selCol] + Math.min(45, st.selRow + 5);

      if (item.action === 'fill_formula') {
        st.fillMode = 'formula';
        st.fillExpr = st.sheet.cells[curRef].raw || '=A1*2';
        st.fillRange = curRef + ':' + endRef;
        st.fillFocus = 0;
        st.step = 'fill';
        return;
      }
      if (item.action === 'fill_value') {
        st.fillMode = 'value';
        st.fillExpr = st.sheet.cells[curRef].raw || '1';
        st.fillRange = curRef + ':' + endRef;
        st.fillFocus = 0;
        st.step = 'fill';
        return;
      }
      if (item.action === 'toggle_recalc') {
        st.sheet.autoRecalc = !st.sheet.autoRecalc;
        if (st.sheet.autoRecalc) CalcEngine.sheet.recalc(st.sheet);
        st.step = 'grid';
        return;
      }
      if (item.action === 'recalc_now') {
        CalcEngine.sheet.recalc(st.sheet);
        st.step = 'grid';
        return;
      }
      if (item.action === 'clear_all') {
        st.sheet = CalcEngine.sheet.newSheet();
        st.step = 'grid';
        return;
      }
      if (item.text) {
        if (!st.isEditing) {
          st.isEditing = true;
          st.editStr = (item.text === ':') ? (st.sheet.cells[curRef].raw || '') : '=';
        }
        st.editStr += item.text;
        st.step = 'grid';
      }
    }
  });

  // =========================================================================
  // D. ỨNG DỤNG HỘP TOÁN HỌC (mathbox) — Chỉ hiện ở Kiểu B
  // =========================================================================
  CalcApps.register({
    id: 'mathbox',
    code: 'D',
    name: 'Hộp toán học',
    icon: '🎲',
    stage: 1,
    onlyTypeB: true,
    init: function (ctx) {
      if (!ctx.mathboxState) {
        ctx.mathboxState = {
          step: 'menu', // 'menu' | 'params' | 'result'
          mode: 'dice', // 'dice' | 'coin'
          timesStr: '30',
          count: 2, // 1..3
          focusIdx: 0, // 0: số lần thử, 1: số xúc xắc/đồng xu
          simRes: null
        };
      }
      ctx.mathboxState.step = 'menu';
    },
    render: function (ctx) {
      var st = ctx.mathboxState;

      if (st.step === 'menu') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Hộp toán học (Mô phỏng xác suất):</div>' +
            '<div class="lcd-list-item ' + (st.mode === 'dice' ? 'active' : '') + '" data-action="mb-mode" data-m="dice">1. Tung xúc xắc (1–3 con, 1–250 lần)</div>' +
            '<div class="lcd-list-item ' + (st.mode === 'coin' ? 'active' : '') + '" data-action="mb-mode" data-m="coin">2. Tung đồng xu (1–3 đồng, 1–250 lần)</div>' +
          '</div>'
        );
      }

      if (st.step === 'params') {
        var title = st.mode === 'dice' ? 'Thiết lập Tung xúc xắc:' : 'Thiết lập Tung đồng xu:';
        var cntLabel = st.mode === 'dice' ? 'Số con xúc xắc (1–3):' : 'Số đồng xu (1–3):';
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + title + '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 0 ? 'active' : '') + '" data-action="mb-focus" data-f="0">' +
              '<span>Số lần thử (1–250):</span>' +
              '<b>' + escapeHtml(st.timesStr) + (st.focusIdx === 0 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 1 ? 'active' : '') + '" data-action="mb-focus" data-f="1">' +
              '<span>' + cntLabel + '</span>' +
              '<b>' + st.count + ' (Bấm 1–3)</b>' +
            '</div>' +
            '<div class="lcd-sub-hint">Bấm = để thực hiện mô phỏng</div>' +
          '</div>'
        );
      }

      // Màn hình kết quả kèm biểu đồ cột bằng CSS
      var r = st.simRes;
      if (!r || r.error) {
        return '<div class="lcd-error">' + escapeHtml((r && r.error) || 'Lỗi toán') + '</div>';
      }
      var maxFreq = 1;
      for (var i = 0; i < r.table.length; i++) {
        if (r.table[i].freq > maxFreq) maxFreq = r.table[i].freq;
      }

      var col1Title = st.mode === 'dice' ? 'Tổng' : 'Ngửa';
      var html = '<div class="lcd-table-wrap">';
      html += '<div class="lcd-table-bar">' +
                '<span>' + (st.mode === 'dice' ? ('Xúc xắc (' + r.diceCount + ' con, n=' + r.times + ')') : ('Đồng xu (' + r.coinCount + ' xu, n=' + r.times + ')')) + '</span>' +
                '<span class="lcd-inline-btn" data-action="mb-retry">[Thử lại =]</span>' +
              '</div>';
      html += '<table class="lcd-grid mb-grid"><thead><tr>' +
                '<th>' + col1Title + '</th><th>Tần số</th><th>Tần suất</th><th>Biểu đồ cột</th>' +
              '</tr></thead><tbody>';

      for (var j = 0; j < r.table.length; j++) {
        var row = r.table[j];
        var pct = Math.round((row.freq / maxFreq) * 100);
        var rfStr = (Math.round(row.relFreq * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
        if (rfStr === '') rfStr = '0';
        html += '<tr>' +
                  '<td class="lcd-grid-idx"><b>' + row.sum + '</b></td>' +
                  '<td>' + row.freq + '</td>' +
                  '<td>' + rfStr + '</td>' +
                  '<td class="mb-bar-cell"><div class="mb-bar-track"><div class="mb-bar-fill" style="width:' + pct + '%"></div></div></td>' +
                '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.mathboxState;
      if (st.step === 'menu') {
        if (key === 'UP' || key === 'DOWN') { st.mode = st.mode === 'dice' ? 'coin' : 'dice'; return; }
        if (key === '1' || key === '2') {
          st.mode = key === '1' ? 'dice' : 'coin';
          st.focusIdx = 0;
          st.step = 'params';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.focusIdx = 0;
          st.step = 'params';
          return;
        }
        return;
      }

      if (st.step === 'params') {
        if (key === 'AC') { st.step = 'menu'; return; }
        if (key === 'UP' || key === 'DOWN') { st.focusIdx = st.focusIdx === 0 ? 1 : 0; return; }
        if (st.focusIdx === 0) {
          if (key === 'DEL') { st.timesStr = st.timesStr.slice(0, -1); return; }
          if (/^[0-9]$/.test(key)) { st.timesStr += key; return; }
        } else {
          if (key === '1' || key === '2' || key === '3') {
            st.count = parseInt(key, 10);
            this.runSimulation(st);
            return;
          }
        }
        if (key === '=' || key === 'OK') {
          if (st.focusIdx === 0) st.focusIdx = 1;
          else this.runSimulation(st);
          return;
        }
        return;
      }

      if (st.step === 'result') {
        if (key === 'AC') { st.step = 'params'; return; }
        if (key === '=' || key === 'OK') { this.runSimulation(st); return; }
      }
    },
    runSimulation: function (st) {
      var n = parseInt(st.timesStr, 10);
      if (isNaN(n) || n < 1) n = 10;
      if (n > 250) n = 250;
      st.timesStr = String(n);
      if (st.mode === 'dice') {
        st.simRes = CalcEngine.mathbox.rollDice(n, st.count);
      } else {
        st.simRes = CalcEngine.mathbox.tossCoin(n, st.count);
      }
      st.step = 'result';
    }
  });

  // =========================================================================
  // E. ỨNG DỤNG THUẬT TOÁN (algo) — Chỉ hiện ở Kiểu B (Kèm vẽ Rùa Canvas)
  // =========================================================================
  var ALGO_CMD_TEMPLATES = [
    { label: '1. Nhập giá trị biến (Input)', make: function () { return { op: 'input', v: 'A' }; } },
    { label: '2. Gán: Biến := Biểu thức', make: function () { return { op: 'set', v: 'A', expr: 'A+1' }; } },
    { label: '3. In ra biểu thức / chữ', make: function () { return { op: 'print', expr: 'A' }; } },
    { label: '4. Lặp lại n lần (Repeat)', make: function () { return { op: 'repeat', n: '5', body: [{ op: 'print', expr: 'A' }] }; } },
    { label: '5. Lặp khi điều kiện (While)', make: function () { return { op: 'while', cond: 'A<=5', body: [{ op: 'set', v: 'A', expr: 'A+1' }] }; } },
    { label: '6. Nếu ... thì ... / Nếu không', make: function () { return { op: 'if', cond: 'A>0', then: [{ op: 'print', expr: 'A' }], else: [] }; } },
    { label: '7. Rùa: Đi tới (Move)', make: function () { return { op: 'move', expr: '30' }; } },
    { label: '8. Rùa: Quay trái góc° (Turn)', make: function () { return { op: 'turn', expr: '90' }; } },
    { label: '9. Rùa: Đi đến (Goto x,y)', make: function () { return { op: 'goto', x: '0', y: '0' }; } },
    { label: '0. Rùa: Nhấc / Hạ bút (Pen)', make: function () { return { op: 'pen', up: false }; } },
    { label: 'A. Mẫu: In bình phương 1..5', preset: 'squares' },
    { label: 'B. Mẫu: Rùa vẽ hình vuông', preset: 'square_turtle' },
    { label: 'C. Mẫu: Rùa vẽ ngôi sao 5 cánh', preset: 'star_turtle' }
  ];

  function cloneProgram(prog) {
    return JSON.parse(JSON.stringify(prog));
  }

  var PRESET_PROGRAMS = {
    squares: [
      { op: 'set', v: 'A', expr: '1' },
      { op: 'repeat', n: '5', body: [
        { op: 'print', expr: 'A^2' },
        { op: 'set', v: 'A', expr: 'A+1' }
      ] }
    ],
    square_turtle: [
      { op: 'repeat', n: '4', body: [
        { op: 'move', expr: '35' },
        { op: 'turn', expr: '90' }
      ] }
    ],
    star_turtle: [
      { op: 'repeat', n: '5', body: [
        { op: 'move', expr: '45' },
        { op: 'turn', expr: '144' }
      ] }
    ]
  };

  // Trải phẳng cây lệnh thành danh sách dòng để hiển thị và sửa trực tiếp
  function flattenProgram(stmts, depth, out) {
    out = out || [];
    depth = depth || 0;
    var pad = '';
    for (var d = 0; d < depth; d++) pad += '  ';

    for (var i = 0; i < stmts.length; i++) {
      var st = stmts[i];
      if (st.op === 'input') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Nhập biến: ' + st.v, field: 'v' });
      } else if (st.op === 'set') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Gán ' + st.v + ' := ' + st.expr, field: 'expr' });
      } else if (st.op === 'print') {
        var pVal = st.text !== undefined && st.expr === undefined ? ('"' + st.text + '"') : st.expr;
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'In ra: ' + pVal, field: 'expr' });
      } else if (st.op === 'repeat') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Lặp lại (' + st.n + ') lần:', field: 'n', childBlock: st.body });
        flattenProgram(st.body, depth + 1, out);
      } else if (st.op === 'while') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Lặp khi (' + st.cond + '):', field: 'cond', childBlock: st.body });
        flattenProgram(st.body, depth + 1, out);
      } else if (st.op === 'if') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Nếu (' + st.cond + ') thì:', field: 'cond', childBlock: st.then });
        flattenProgram(st.then, depth + 1, out);
        if (st.else && st.else.length > 0) {
          flattenProgram(st.else, depth + 1, out);
        }
      } else if (st.op === 'move') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Rùa đi tới: ' + st.expr, field: 'expr' });
      } else if (st.op === 'turn') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Rùa quay trái: ' + st.expr + '°', field: 'expr' });
      } else if (st.op === 'goto') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Rùa đến (' + st.x + ', ' + st.y + ')', field: 'x' });
      } else if (st.op === 'pen') {
        out.push({ stmt: st, list: stmts, idx: i, depth: depth, text: pad + 'Bút vẽ: ' + (st.up ? 'Nhấc bút' : 'Hạ bút'), field: 'up' });
      }
    }
    return out;
  }

  CalcApps.register({
    id: 'algo',
    code: 'E',
    name: 'Thuật toán',
    icon: '{}',
    stage: 1,
    onlyTypeB: true,
    init: function (ctx) {
      if (!ctx.algoState) {
        ctx.algoState = {
          step: 'editor', // 'editor' | 'add' | 'edit_line' | 'output' | 'canvas'
          program: cloneProgram(PRESET_PROGRAMS.squares),
          selLine: 0,
          addIdx: 0,
          editVal: '',
          editVar: 'A',
          runRes: null
        };
      }
      ctx.algoState.step = 'editor';
    },
    openOptn: function (ctx) {
      var st = ctx.algoState;
      st.step = (st.step === 'add') ? 'editor' : 'add';
      st.addIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.algoState;

      if (st.step === 'add') {
        var aHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Chọn khối lệnh hoặc chương trình mẫu:</div>';
        for (var i = 0; i < ALGO_CMD_TEMPLATES.length; i++) {
          var cls = (i === st.addIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          aHtml += '<div class="' + cls + '" data-action="algo-pick-add" data-idx="' + i + '">' +
                   escapeHtml(ALGO_CMD_TEMPLATES[i].label) + '</div>';
        }
        aHtml += '</div>';
        return aHtml;
      }

      if (st.step === 'edit_line') {
        var linesE = flattenProgram(st.program);
        var curL = linesE[st.selLine];
        var stmt = curL ? curL.stmt : {};
        var varSelector = '';
        if (stmt.op === 'set' || stmt.op === 'input') {
          varSelector = '<div class="lcd-sub-hint" data-action="algo-cycle-var">Biến đích: <b>' + escapeHtml(st.editVar) + '</b> (Bấm ▲▼ hoặc chạm để đổi A–F)</div>';
        }
        var condBtns = '';
        if (stmt.op === 'while' || stmt.op === 'if') {
          condBtns =
            '<div class="lcd-sub-hint">Chèn nhanh: ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s="<">&lt;</span> ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s=">">&gt;</span> ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s="<=">&le;</span> ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s=">=">&ge;</span> ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s="=">=</span> ' +
              '<span class="lcd-inline-btn" data-action="algo-ins" data-s="≠">&ne;</span>' +
            '</div>';
        }
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Sửa lệnh (' + escapeHtml(stmt.op) + '):</div>' +
            varSelector +
            '<div class="lcd-prompt-input">' + escapeHtml(st.editVal) + '<span class="m-cursor"></span></div>' +
            condBtns +
            '<div class="lcd-sub-hint">Bấm = để lưu, AC để hủy</div>' +
          '</div>'
        );
      }

      if (st.step === 'canvas') {
        return (
          '<div class="lcd-table-wrap">' +
            '<div class="lcd-table-bar">' +
              '<span>Cửa sổ vẽ Rùa (Canvas)</span>' +
              '<span>' +
                '<span class="lcd-inline-btn" data-action="algo-view-out">[Xem KQ in]</span> ' +
                '<span class="lcd-inline-btn" data-action="algo-back-ed">[Sửa code]</span>' +
              '</span>' +
            '</div>' +
            '<div class="algo-canvas-wrap">' +
              '<canvas id="algo-turtle-canvas" width="310" height="86"></canvas>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.step === 'output') {
        var r = st.runRes;
        var outHtml = '<div class="lcd-table-wrap">';
        outHtml += '<div class="lcd-table-bar"><span>Kết quả chạy thuật toán</span>' +
                   '<span>' +
                     (r && r.turtle && r.turtle.lines.length > 0 ? '<span class="lcd-inline-btn" data-action="algo-view-canvas">[Hình vẽ Rùa]</span> ' : '') +
                     '<span class="lcd-inline-btn" data-action="algo-back-ed">[Quay lại]</span>' +
                   '</span></div>';
        if (!r || !r.ok) {
          outHtml += '<div class="lcd-error">' + escapeHtml((r && r.error) || 'Lỗi') + '</div>';
        } else {
          if (r.output.length === 0) {
            outHtml += '<div class="lcd-sub-hint">(Không có lệnh In ra — A=' + r.vars.A + ', B=' + r.vars.B + ')</div>';
          } else {
            outHtml += '<div class="lcd-menu-list">';
            for (var k = 0; k < r.output.length; k++) {
              outHtml += '<div class="lcd-list-item"><span>Dòng ' + (k + 1) + ':</span><b>' + escapeHtml(r.output[k]) + '</b></div>';
            }
            outHtml += '</div>';
          }
        }
        outHtml += '</div>';
        return outHtml;
      }

      // Màn hình soạn chương trình ('editor')
      var lines = flattenProgram(st.program);
      if (st.selLine >= lines.length) st.selLine = Math.max(0, lines.length - 1);

      var edHtml = '<div class="lcd-table-wrap">';
      edHtml += '<div class="lcd-table-bar">' +
                  '<span>Thuật toán (' + lines.length + ' dòng)</span>' +
                  '<span>' +
                    '<span class="lcd-inline-btn" data-action="algo-open-add">[+ Lệnh/Mẫu]</span> ' +
                    '<span class="lcd-inline-btn" data-action="algo-run-btn">[Chạy ▶]</span>' +
                  '</span>' +
                '</div>';
      edHtml += '<div class="lcd-menu-list">';
      for (var m = 0; m < lines.length; m++) {
        var lCls = (m === st.selLine) ? 'lcd-list-item active' : 'lcd-list-item';
        edHtml += '<div class="' + lCls + '" data-action="algo-line" data-idx="' + m + '">' +
                  '<span class="algo-code-line">' + (m + 1) + '. ' + escapeHtml(lines[m].text) + '</span></div>';
      }
      edHtml += '</div>';
      edHtml += '<div class="lcd-sub-hint">OK: Sửa dòng | DEL: Xóa dòng | OPTN: Thêm lệnh | CALC/=: Chạy</div>';
      edHtml += '</div>';
      return edHtml;
    },
    afterRender: function (ctx) {
      var st = ctx.algoState;
      if (!st || st.step !== 'canvas' || !st.runRes || !st.runRes.turtle) return;
      var cv = document.getElementById('algo-turtle-canvas');
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d');
      var w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);

      var lines = st.runRes.turtle.lines;
      var minX = 0, maxX = 0, minY = 0, maxY = 0;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        minX = Math.min(minX, ln.x1, ln.x2);
        maxX = Math.max(maxX, ln.x1, ln.x2);
        minY = Math.min(minY, ln.y1, ln.y2);
        maxY = Math.max(maxY, ln.y1, ln.y2);
      }
      var spanX = Math.max(20, maxX - minX);
      var spanY = Math.max(20, maxY - minY);
      var scale = Math.min((w - 28) / spanX, (h - 20) / spanY);
      var cx = w / 2 - ((minX + maxX) / 2) * scale;
      var cy = h / 2 + ((minY + maxY) / 2) * scale;

      g.strokeStyle = '#0b1911';
      g.lineWidth = 1.8;
      g.beginPath();
      for (var j = 0; j < lines.length; j++) {
        var seg = lines[j];
        g.moveTo(cx + seg.x1 * scale, cy - seg.y1 * scale);
        g.lineTo(cx + seg.x2 * scale, cy - seg.y2 * scale);
      }
      g.stroke();

      // Vẽ vị trí con rùa cuối cùng
      var tx = cx + st.runRes.turtle.x * scale;
      var ty = cy - st.runRes.turtle.y * scale;
      g.fillStyle = '#b91c1c';
      g.beginPath();
      g.arc(tx, ty, 3, 0, Math.PI * 2, false);
      g.fill();
    },
    onKey: function (key, ctx) {
      var st = ctx.algoState;

      if (st.step === 'add') {
        var len = ALGO_CMD_TEMPLATES.length;
        if (key === 'AC') { st.step = 'editor'; return; }
        if (key === 'UP') { st.addIdx = (st.addIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.addIdx = (st.addIdx + 1) % len; return; }
        if (/^[0-9]$/.test(key)) {
          var idx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          this.applyAddChoice(st, idx);
          return;
        }
        if (key === 'VAR_A' || key === '(-)') { this.applyAddChoice(st, 10); return; }
        if (key === 'VAR_B' || key === 'DMS') { this.applyAddChoice(st, 11); return; }
        if (key === 'VAR_C' || key === 'INV') { this.applyAddChoice(st, 12); return; }
        if (key === '=' || key === 'OK') {
          this.applyAddChoice(st, st.addIdx);
          return;
        }
        return;
      }

      if (st.step === 'edit_line') {
        if (key === 'AC') { st.step = 'editor'; return; }
        if (key === 'DEL') { st.editVal = st.editVal.slice(0, -1); return; }
        if (key === '=' || key === 'OK') {
          this.saveLineEdit(st);
          return;
        }
        if (key === 'UP' || key === 'DOWN') {
          var vList = ['A', 'B', 'C', 'D', 'E', 'F'];
          var curVIdx = vList.indexOf(st.editVar);
          if (curVIdx === -1) curVIdx = 0;
          curVIdx = (curVIdx + (key === 'UP' ? 5 : 1)) % 6;
          st.editVar = vList[curVIdx];
          var linesU = flattenProgram(st.program);
          if (linesU[st.selLine] && linesU[st.selLine].stmt.op === 'input') {
            st.editVal = st.editVar;
          }
          return;
        }
        var vMap = { 'VAR_A': 'A', 'VAR_B': 'B', 'VAR_C': 'C', 'VAR_D': 'D', 'VAR_E': 'E', 'VAR_F': 'F', 'VAR_x': 'x', 'VAR_y': 'y' };
        var linesE = flattenProgram(st.program);
        var curL = linesE[st.selLine];
        if (curL && curL.stmt.op === 'input' && vMap[key]) {
          st.editVar = vMap[key];
          st.editVal = vMap[key];
          return;
        }
        var ch = this.mapKeyToAlgoChar(key);
        if (ch) st.editVal += ch;
        return;
      }

      if (st.step === 'output' || st.step === 'canvas') {
        if (key === 'AC' || key === '=' || key === 'OK') {
          st.step = 'editor';
        } else if (key === 'S_D' && st.runRes && st.runRes.turtle && st.runRes.turtle.lines.length > 0) {
          st.step = (st.step === 'canvas') ? 'output' : 'canvas';
        }
        return;
      }

      // Đang ở màn 'editor'
      var lines = flattenProgram(st.program);
      if (key === 'UP' && st.selLine > 0) { st.selLine--; return; }
      if (key === 'DOWN' && st.selLine < lines.length - 1) { st.selLine++; return; }
      if (key === 'CALC' || key === '=') {
        this.runProgramNow(ctx);
        return;
      }
      if (key === 'OK') {
        this.openLineEdit(st);
        return;
      }
      if (key === 'DEL') {
        if (lines[st.selLine] && lines.length > 1) {
          var target = lines[st.selLine];
          target.list.splice(target.idx, 1);
          if (st.selLine >= lines.length - 1) st.selLine = Math.max(0, lines.length - 2);
        }
      }
    },
    mapKeyToAlgoChar: function (key) {
      var m = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '-', '(-)': '-', '*': '*', '/': '/',
        'POW': '^', 'SQ': '^2', '(': '(', ')': ')',
        'VAR_A': 'A', 'VAR_B': 'B', 'VAR_C': 'C', 'VAR_D': 'D', 'VAR_E': 'E', 'VAR_F': 'F',
        'x': 'x', 'VAR_x': 'x', 'VAR_y': 'y', 'EQUAL_SIGN': '='
      };
      return m[key] || null;
    },
    openLineEdit: function (st) {
      var lines = flattenProgram(st.program);
      var cur = lines[st.selLine];
      if (!cur) return;
      var s = cur.stmt;
      if (s.op === 'pen') {
        s.up = !s.up;
        return;
      }
      st.editVar = s.v || 'A';
      st.editVal = String(s[cur.field] !== undefined ? s[cur.field] : '');
      st.step = 'edit_line';
    },
    saveLineEdit: function (st) {
      var lines = flattenProgram(st.program);
      var cur = lines[st.selLine];
      if (cur && cur.stmt) {
        if (cur.stmt.op === 'set' || cur.stmt.op === 'input') {
          cur.stmt.v = st.editVar;
        }
        cur.stmt[cur.field] = st.editVal;
      }
      st.step = 'editor';
    },
    applyAddChoice: function (st, idx) {
      var item = ALGO_CMD_TEMPLATES[idx];
      if (!item) return;
      if (item.preset) {
        st.program = cloneProgram(PRESET_PROGRAMS[item.preset]);
        st.selLine = 0;
        st.step = 'editor';
        return;
      }
      var newStmt = item.make();
      var lines = flattenProgram(st.program);
      var cur = lines[st.selLine];
      if (cur && cur.childBlock) {
        cur.childBlock.push(newStmt);
      } else if (cur && cur.list) {
        cur.list.splice(cur.idx + 1, 0, newStmt);
      } else {
        st.program.push(newStmt);
      }
      st.step = 'editor';
    },
    runProgramNow: function (ctx) {
      var st = ctx.algoState;
      var res = CalcEngine.algo.run(st.program, {
        angle: ctx.settings.angle,
        vars: ctx.vars,
        format: ctx.getFormatOpts()
      });
      st.runRes = res;
      if (res.ok && res.turtle && res.turtle.lines.length > 0 && res.output.length === 0) {
        st.step = 'canvas';
      } else {
        st.step = 'output';
      }
    }
  });

})(this);
