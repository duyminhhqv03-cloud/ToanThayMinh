/* Các ứng dụng nâng cao cho Máy tính Thầy Minh (ES5 thuần — hỗ trợ Máy 880 & Máy 580) */
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
  // 2. ỨNG DỤNG SỐ PHỨC (complex — Complex)
  // =========================================================================
  var CPLX_OPTN_ITEMS = [
    { label: '1:Argument', text: 'Arg(', evalText: 'arg(' },
    { label: '2:Conjugate', text: 'Conjg(', evalText: 'conj(' },
    { label: '3:Real Part', text: 'ReP(', evalText: 're(' },
    { label: '4:Imaginary Part', text: 'ImP(', evalText: 'im(' },
    { label: '5:▸r∠θ', text: '▶r∠θ', evalText: '▶r∠θ' },
    { label: '6:▸a+bi', text: '▶a+bi', evalText: '▶a+bi' },
    { label: '7:i (Imaginary Unit)', text: 'i', evalText: 'i' },
    { label: '8:∠ (Polar Angle)', text: '∠', evalText: '∠' }
  ];

  CalcApps.register({
    id: 'complex',
    code: '2',
    name: 'Complex',
    viName: 'Số phức',
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
          formatConverted: false,
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
        var oHtml = '<div class="lcd-menu-list">';
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
          resHtml = '<div class="lcd-error">' + escapeHtml(r.error || 'Math ERROR') + '</div>';
        } else if (r.isVerify) {
          resHtml = '<div class="lcd-verify-res">' + escapeHtml(r.verifyText) + '</div>';
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
      if (r.isVerify) return r.verifyText;
      var dm = st.displayMode;
      if (dm === 'rect_exact') return r.rectExact;
      if (dm === 'rect_dec') return r.rectDecimal;
      if (dm === 'polar_exact') return r.polar.exact;
      if (dm === 'polar_dec') return r.polar.decimal;
      return r.exact || r.decimal;
    },
    applyFormatOption: function (ctx, optId) {
      var st = ctx.complexState;
      if (!st || !st.hasResult || !st.lastResult || !st.lastResult.ok) return;
      st.formatConverted = true;
      if (optId === 'rect') st.displayMode = 'rect_exact';
      else if (optId === 'polar') st.displayMode = 'polar_exact';
      else if (optId === 'standard') st.displayMode = (ctx.settings.complexForm === 'polar') ? 'polar_exact' : 'rect_exact';
      else if (optId === 'decimal') st.displayMode = (ctx.settings.complexForm === 'polar') ? 'polar_dec' : 'rect_dec';
    },
    onKey: function (key, ctx) {
      var st = ctx.complexState;
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'optn') {
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
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
        st.formatConverted = false;
        return;
      }
      if (key === 'DEL' || key === 'BACK') {
        if (st.hasResult) {
          if (st.formatConverted) {
            st.displayMode = 'auto';
            st.formatConverted = false;
            return;
          }
          st.hasResult = false;
          return;
        }
        if (key === 'DEL') CalcEditor.deleteBack(st.editor);
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
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
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
        if (st.hasResult && st.formatConverted && key !== 'APPROX_EQ') {
          st.displayMode = 'auto';
          st.formatConverted = false;
          return;
        }
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
        st.formatConverted = false;
        if (isCont && !ctx.verifyMode) {
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        }
      }

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

      // Hỗ trợ Verify trên số phức (so sánh = và ≠ trên máy 880)
      if (ctx.verifyMode && (exprText.indexOf('=') !== -1 || exprText.indexOf('≠') !== -1 || exprText.indexOf('!=') !== -1)) {
        var isNeq = (exprText.indexOf('≠') !== -1 || exprText.indexOf('!=') !== -1);
        var sep = isNeq ? (exprText.indexOf('≠') !== -1 ? '≠' : '!=') : '=';
        var sides = exprText.split(sep);
        if (sides.length !== 2) {
          st.hasResult = true;
          st.lastResult = { ok: false, error: 'Syntax ERROR' };
          return;
        }
        var cL = CalcEngine.complex.evalComplex(sides[0], opts);
        var cR = CalcEngine.complex.evalComplex(sides[1], opts);
        if (!cL.ok || !cR.ok) {
          st.hasResult = true;
          st.lastResult = { ok: false, error: (cL.error || cR.error || 'Math ERROR') };
          return;
        }
        var eqBool = (Math.abs(cL.re - cR.re) < 1e-9 && Math.abs(cL.im - cR.im) < 1e-9);
        var finalBool = isNeq ? !eqBool : eqBool;
        st.hasResult = true;
        st.lastResult = { ok: true, isVerify: true, verifyText: finalBool ? 'True' : 'False' };
        return;
      }

      var res = CalcEngine.complex.evalComplex(exprText, opts);
      st.hasResult = true;
      st.lastExprText = exprText;
      st.lastResult = res;
      st.formatConverted = false;
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
  // 3. ỨNG DỤNG CƠ SỐ N (baseN — Base-N)
  // =========================================================================
  var BASEN_OPTN_ITEMS = [
    { label: '1:Neg', text: 'neg(' },
    { label: '2:Not', text: 'not(' },
    { label: '3:and', text: ' and ' },
    { label: '4:or', text: ' or ' },
    { label: '5:xor', text: ' xor ' },
    { label: '6:xnor', text: ' xnor ' },
    { label: '7:d (Decimal)', text: 'd' },
    { label: '8:h (Hexadecimal)', text: 'h' },
    { label: '9:b (Binary)', text: 'b' },
    { label: '0:o (Octal)', text: 'o' }
  ];

  function getBaseName(b) {
    if (b === 16) return 'Hex';
    if (b === 2) return 'Bin';
    if (b === 8) return 'Oct';
    return 'Dec';
  }

  function isDigitAllowedInBaseN(expr, digit, curBase) {
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
    name: 'Base-N',
    viName: 'Cơ số N',
    icon: '0110',
    stage: 1,
    init: function (ctx) {
      if (!ctx.baseNState) {
        ctx.baseNState = {
          base: 10,
          expr: '',
          hasResult: false,
          lastRes: null,
          step: 'calc',
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
      var is880 = (ctx.machineId === '880');
      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list">';
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
          mainRes = '<div class="lcd-error">' + escapeHtml(st.lastRes.error || 'Math ERROR') + '</div>';
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
            '<span class="basen-pill ' + (st.base === 10 ? 'active' : '') + '" data-action="basen-switch" data-base="10">Dec</span>' +
            '<span class="basen-pill ' + (st.base === 16 ? 'active' : '') + '" data-action="basen-switch" data-base="16">Hex</span>' +
            '<span class="basen-pill ' + (st.base === 2 ? 'active' : '') + '" data-action="basen-switch" data-base="2">Bin</span>' +
            '<span class="basen-pill ' + (st.base === 8 ? 'active' : '') + '" data-action="basen-switch" data-base="8">Oct</span>' +
          '</div>';
      }

      return (
        '<div class="lcd-basen">' +
          '<div class="basen-top-row"><span class="basen-mode-lbl"><b>[' + bName + ']</b></span>' +
          '<span class="lcd-inline-btn" data-action="basen-open-optn">' + (is880 ? '[TOOLS: Base]' : '[OPTN]') + '</span></div>' +
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
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
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

      // Đổi hệ đếm bằng phím tắt trên máy 580: x² (DEC), x^■ (HEX), log■□ (BIN), ln (OCT)
      if (ctx.machineId === '580') {
        if (key === 'SQ' || key === 'BASE_DEC') { this.switchBase(st, 10); return; }
        if (key === 'POW' || key === 'BASE_HEX') { this.switchBase(st, 16); return; }
        if (key === 'LOG2' || key === 'log' || key === 'BASE_BIN') { this.switchBase(st, 2); return; }
        if (key === 'ln' || key === 'BASE_OCT') { this.switchBase(st, 8); return; }
      } else {
        if (key === 'BASE_DEC') { this.switchBase(st, 10); return; }
        if (key === 'BASE_HEX') { this.switchBase(st, 16); return; }
        if (key === 'BASE_BIN') { this.switchBase(st, 2); return; }
        if (key === 'BASE_OCT') { this.switchBase(st, 8); return; }
      }

      if (key === 'AC') {
        st.expr = '';
        st.hasResult = false;
        st.lastRes = null;
        return;
      }
      if (key === 'DEL' || key === 'BACK') {
        if (st.hasResult) { st.hasResult = false; return; }
        if (key === 'DEL') st.expr = st.expr.slice(0, -1);
        return;
      }
      if (key === '=' || key === 'OK') {
        if (!st.expr.replace(/\s+/g, '')) return;
        var res = CalcEngine.baseN(st.expr, st.base);
        st.hasResult = true;
        st.lastRes = res;
        return;
      }

      // Phím chữ số A–F (trên 580: (-), °′″, x⁻¹, sin, cos, tan; trên 880: SHIFT 4..9 -> VAR_A..VAR_F)
      var hexKeyMap = {
        'VAR_A': 'A', 'DMS': 'B', 'VAR_B': 'B',
        'INV': 'C', 'VAR_C': 'C', 'sin': 'D', 'VAR_D': 'D',
        'cos': 'E', 'VAR_E': 'E', 'tan': 'F', 'VAR_F': 'F'
      };
      if (key === '(-)') {
        if (ctx.machineId === '580' && isDigitAllowedInBaseN(st.expr, 'A', st.base)) {
          hexKeyMap['(-)'] = 'A';
        } else {
          key = '-';
        }
      }
      var digit = (/^[0-9]$/.test(key)) ? key : (hexKeyMap[key] || null);
      if (digit) {
        var checkExpr = st.hasResult ? '' : st.expr;
        if (!isDigitAllowedInBaseN(checkExpr, digit, st.base)) {
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
  // 4. ỨNG DỤNG MA TRẬN (matrix — Matrix)
  // =========================================================================
  var MAT_NAMES = ['MatA', 'MatB', 'MatC', 'MatD'];
  var MAT_OPTN_ITEMS = [
    { label: '1:Select Matrix', action: 'define' },
    { label: '2:Edit Matrix', action: 'edit_cur' },
    { label: '3:MatA', text: 'MatA' },
    { label: '4:MatB', text: 'MatB' },
    { label: '5:MatC', text: 'MatC' },
    { label: '6:MatD', text: 'MatD' },
    { label: '7:MatAns', text: 'MatAns' },
    { label: '8:Determinant', text: 'det(' },
    { label: '9:Transposition', text: 'Trn(' },
    { label: '0:Identity', text: 'Identity(' },
    { label: 'A:Row Echelon', text: 'Ref(' },
    { label: 'B:Reduced Row Echelon', text: 'Rref(' }
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
    name: 'Matrix',
    viName: 'Ma trận',
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
          dimFocus: 0,
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
          calcRes: null,
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
      var is880 = (ctx.machineId === '880');

      if (st.step === 'select') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">' + (is880 ? 'Matrix' : 'Select Matrix') + '</div>';
        for (var i = 0; i < 4; i++) {
          var mName = MAT_NAMES[i];
          var mat = st.mats[mName];
          var dimInfo = mat ? (mat.length + '×' + mat[0].length) : 'None';
          var cls = (st.selectIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="mat-pick" data-idx="' + i + '">' +
                  '<span>' + (is880 ? (mName + ' :') : ((i + 1) + ':' + mName)) + '</span><b>' + dimInfo + '</b></div>';
        }
        var clsCalc = (st.selectIdx === 4) ? 'lcd-list-item active' : 'lcd-list-item';
        html += '<div class="' + clsCalc + '" data-action="mat-pick" data-idx="4"><span>' + (is880 ? 'Matrix Calc' : '5:Matrix Calc') + '</span><b>▶</b></div>';
        html += '</div>';
        return html;
      }

      if (st.step === 'dim') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + escapeHtml(st.activeMat) + ' (1~4)</div>' +
            '<div class="lcd-list-item ' + (st.dimFocus === 0 ? 'active' : '') + '" data-action="mat-dim-focus" data-f="0">' +
              '<span>Rows:</span><b>' + st.dimM + ' Rows</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.dimFocus === 1 ? 'active' : '') + '" data-action="mat-dim-focus" data-f="1">' +
              '<span>Columns:</span><b>' + st.dimN + ' Columns</b>' +
            '</div>' +
            (is880 ? '<div class="lcd-list-item ' + (st.dimFocus === 2 ? 'active' : '') + '" data-action="mat-dim-confirm"><span>Confirm</span><b>▶</b></div>' : '') +
          '</div>'
        );
      }

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list">';
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
        eHtml += '<div class="lcd-table-bar"><span>' + st.activeMat + ' (' + m + '×' + n + ')</span>' +
                 '<span class="lcd-inline-btn" data-action="mat-go-calc">[Calc ▶]</span></div>';
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
                 escapeHtml(curStr) + '</b><span class="m-cursor"></span></div>';
        eHtml += '</div>';
        return eHtml;
      }

      // Màn hình tính toán ma trận ('calc')
      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>Matrix</span>' +
               '<span><span class="lcd-inline-btn" data-action="mat-open-optn">' + (is880 ? '[CATALOG]' : '[OPTN]') + '</span> ' +
               '<span class="lcd-inline-btn" data-action="mat-open-select">' + (is880 ? '[TOOLS]' : '[Mat]') + '</span></span></div>';
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
          cHtml += '<div class="lcd-sub-hint">[' + (st.resR + 1) + ',' + (st.resC + 1) + '] = <b>' + escapeHtml(selInfo) + '</b></div>';
        }
      }
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.matrixState;

      if (st.step === 'select') {
        if (key === 'UP') { st.selectIdx = (st.selectIdx + 4) % 5; return; }
        if (key === 'DOWN') { st.selectIdx = (st.selectIdx + 1) % 5; return; }
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
        var nSel = parseInt(key, 10);
        if (ctx.machineId === '580' && nSel >= 1 && nSel <= 5) {
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
        if (key === 'AC' || key === 'BACK') { st.step = 'select'; return; }
        if (key === 'UP' || key === 'DOWN') {
          st.dimFocus = st.dimFocus === 0 ? 1 : 0;
          return;
        }
        if (key === 'LEFT' || key === 'RIGHT') {
          var delta = key === 'RIGHT' ? 1 : -1;
          if (st.dimFocus === 0) st.dimM = ((st.dimM - 1 + delta + 4) % 4) + 1;
          else st.dimN = ((st.dimN - 1 + delta + 4) % 4) + 1;
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
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % len; return; }
        if (/^[0-9]$/.test(key)) {
          var oIdx = key === '0' ? 9 : (parseInt(key, 10) - 1);
          this.pickMatOptn(st, oIdx);
          return;
        }
        if (key === 'VAR_A' || key === '(-)') { this.pickMatOptn(st, 10); return; }
        if (key === 'VAR_B' || key === 'DMS') { this.pickMatOptn(st, 11); return; }
        if (key === '=' || key === 'OK') {
          this.pickMatOptn(st, st.optnIdx);
          return;
        }
        return;
      }

      if (st.step === 'edit') {
        var M = st.mats[st.activeMat];
        var m = M.length, n = M[0].length;
        if (key === 'AC' || key === 'BACK') {
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
      if (item.action === 'edit_cur') {
        st.step = 'edit';
        return;
      }
      st.calcExpr += item.text;
      st.step = 'calc';
    }
  });

  // =========================================================================
  // 5. ỨNG DỤNG VECTƠ (vector — Vector)
  // =========================================================================
  var VCT_NAMES = ['VctA', 'VctB', 'VctC', 'VctD'];
  var VCT_OPTN_ITEMS = [
    { label: '1:Select Vector', action: 'define' },
    { label: '2:Edit Vector', action: 'edit_cur' },
    { label: '3:VctA', text: 'VctA' },
    { label: '4:VctB', text: 'VctB' },
    { label: '5:VctC', text: 'VctC' },
    { label: '6:VctD', text: 'VctD' },
    { label: '7:VctAns', text: 'VctAns' },
    { label: '8:Dot Product', text: '·' },
    { label: '9:Angle', text: 'Angle(' },
    { label: '0:Unit Vector', text: 'UnitV(' }
  ];

  CalcApps.register({
    id: 'vector',
    code: '5',
    name: 'Vector',
    viName: 'Vectơ',
    icon: '→V',
    stage: 1,
    init: function (ctx) {
      if (!ctx.vectorState) {
        ctx.vectorState = {
          step: 'select',
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
      var is880 = (ctx.machineId === '880');

      if (st.step === 'select') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">' + (is880 ? 'Vector' : 'Select Vector') + '</div>';
        for (var i = 0; i < 4; i++) {
          var vName = VCT_NAMES[i];
          var v = st.vcts[vName];
          var cls = (st.selectIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="vct-pick" data-idx="' + i + '">' +
                  '<span>' + (is880 ? (vName + ' :') : ((i + 1) + ':' + vName)) + '</span><b>' + (v ? v.length + 'D' : 'None') + '</b></div>';
        }
        var clsCalc = (st.selectIdx === 4) ? 'lcd-list-item active' : 'lcd-list-item';
        html += '<div class="' + clsCalc + '" data-action="vct-pick" data-idx="4"><span>' + (is880 ? 'Vector Calc' : '5:Vector Calc') + '</span><b>▶</b></div>';
        html += '</div>';
        return html;
      }

      if (st.step === 'dim') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + escapeHtml(st.activeVct) + ' Dimension</div>' +
            '<div class="lcd-list-item ' + (st.dim === 2 ? 'active' : '') + '" data-action="vct-dim" data-d="2">' + (is880 ? '2 Dimensions' : '1:2 Dimensions (2D)') + '</div>' +
            '<div class="lcd-list-item ' + (st.dim === 3 ? 'active' : '') + '" data-action="vct-dim" data-d="3">' + (is880 ? '3 Dimensions' : '2:3 Dimensions (3D)') + '</div>' +
          '</div>'
        );
      }

      if (st.step === 'optn') {
        var oHtml = '<div class="lcd-menu-list">';
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
        eHtml += '<div class="lcd-table-bar"><span>' + st.activeVct + ' (' + d + 'D)</span>' +
                 '<span class="lcd-inline-btn" data-action="vct-go-calc">[Calc ▶]</span></div>';
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

      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>Vector</span>' +
               '<span><span class="lcd-inline-btn" data-action="vct-open-optn">' + (is880 ? '[CATALOG]' : '[OPTN]') + '</span> ' +
               '<span class="lcd-inline-btn" data-action="vct-open-select">' + (is880 ? '[TOOLS]' : '[Vct]') + '</span></span></div>';
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
        }
      }
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.vectorState;

      if (st.step === 'select') {
        if (key === 'UP') { st.selectIdx = (st.selectIdx + 4) % 5; return; }
        if (key === 'DOWN') { st.selectIdx = (st.selectIdx + 1) % 5; return; }
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
        var nSel = parseInt(key, 10);
        if (ctx.machineId === '580' && nSel >= 1 && nSel <= 5) {
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
        if (key === 'AC' || key === 'BACK') { st.step = 'select'; return; }
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
        if (key === 'AC' || key === 'BACK') { st.step = 'calc'; return; }
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
        if (key === 'AC' || key === 'BACK') {
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
      if (item.action === 'edit_cur') {
        st.step = 'edit';
        return;
      }
      st.calcExpr += item.text;
      st.step = 'calc';
    }
  });

  // =========================================================================
  // 7. ỨNG DỤNG PHÂN PHỐI XÁC SUẤT (dist — Distribution)
  // =========================================================================
  var DIST_TYPES = [
    { key: 'normPD', label: 'Normal PD', label580: '1:Normal PD', hasList: true },
    { key: 'normCD', label: 'Normal CD', label580: '2:Normal CD', hasList: false },
    { key: 'invN', label: 'Inverse Normal', label580: '3:Inverse Normal', hasList: false },
    { key: 'binomPD', label: 'Binomial PD', label580: '4:Binomial PD', hasList: true },
    { key: 'binomCD', label: 'Binomial CD', label580: '5:Binomial CD', hasList: true },
    { key: 'poissonPD', label: 'Poisson PD', label580: '6:Poisson PD', hasList: true },
    { key: 'poissonCD', label: 'Poisson CD', label580: '7:Poisson CD', hasList: true }
  ];

  CalcApps.register({
    id: 'dist',
    code: '7',
    name: 'Distribution',
    viName: 'Phân phối',
    icon: '🔔',
    stage: 1,
    init: function (ctx) {
      if (!ctx.distState) {
        ctx.distState = {
          step: 'menu',
          typeIdx: 0,
          distKey: 'normPD',
          inputMode: 'var',
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
          ? [{ k: 'sigma', lbl: 'σ :' }, { k: 'mu', lbl: 'μ :' }]
          : [{ k: 'x', lbl: 'x :' }, { k: 'sigma', lbl: 'σ :' }, { k: 'mu', lbl: 'μ :' }];
      }
      if (k === 'normCD') {
        return [
          { k: 'lower', lbl: 'Lower :' },
          { k: 'upper', lbl: 'Upper :' },
          { k: 'sigma', lbl: 'σ :' },
          { k: 'mu', lbl: 'μ :' }
        ];
      }
      if (k === 'invN') {
        return [
          { k: 'area', lbl: 'Area :' },
          { k: 'sigma', lbl: 'σ :' },
          { k: 'mu', lbl: 'μ :' }
        ];
      }
      if (k === 'binomPD' || k === 'binomCD') {
        return isList
          ? [{ k: 'n', lbl: 'N :' }, { k: 'p', lbl: 'p :' }]
          : [{ k: 'x', lbl: 'x :' }, { k: 'n', lbl: 'N :' }, { k: 'p', lbl: 'p :' }];
      }
      return isList
        ? [{ k: 'lambda', lbl: 'λ :' }]
        : [{ k: 'x', lbl: 'x :' }, { k: 'lambda', lbl: 'λ :' }];
    },
    render: function (ctx) {
      var st = ctx.distState;
      var fmt = ctx.getFormatOpts();
      var is880 = (ctx.machineId === '880');

      if (st.step === 'menu') {
        var html = '<div class="lcd-menu-list">';
        for (var i = 0; i < DIST_TYPES.length; i++) {
          var cls = (i === st.typeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          var lbl = is880 ? DIST_TYPES[i].label : DIST_TYPES[i].label580;
          html += '<div class="' + cls + '" data-action="dist-pick" data-idx="' + i + '">' +
                  escapeHtml(lbl) + '</div>';
        }
        html += '</div>';
        return html;
      }

      if (st.step === 'mode') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-item ' + (st.inputMode === 'list' ? 'active' : '') + '" data-action="dist-mode" data-m="list">' + (is880 ? 'List' : '1:List') + '</div>' +
            '<div class="lcd-list-item ' + (st.inputMode === 'var' ? 'active' : '') + '" data-action="dist-mode" data-m="var">' + (is880 ? 'Variable' : '2:Variable') + '</div>' +
          '</div>'
        );
      }

      if (st.step === 'params') {
        var defs = this.getParamDefs(st);
        var pHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' +
                    escapeHtml(DIST_TYPES[st.typeIdx].label) + '</div>';
        for (var j = 0; j < defs.length; j++) {
          var d = defs[j];
          var pCls = (j === st.paramIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          pHtml += '<div class="' + pCls + '" data-action="dist-param" data-idx="' + j + '">' +
                   '<span>' + escapeHtml(d.lbl) + '</span>' +
                   '<b>' + escapeHtml(st.params[d.k]) + (j === st.paramIdx ? '▏' : '') + '</b></div>';
        }
        pHtml += '</div>';
        return pHtml;
      }

      if (st.step === 'list') {
        var lHtml = '<div class="lcd-table-wrap">';
        lHtml += '<div class="lcd-table-bar"><span>' + escapeHtml(DIST_TYPES[st.typeIdx].label) + '</span>' +
                 '<span class="lcd-inline-btn" data-action="dist-calc-list">[=]</span></div>';
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
        lHtml += '<div class="lcd-cell-edit">x = <b>' + escapeHtml(curX) + '</b><span class="m-cursor"></span></div>';
        lHtml += '</div>';
        return lHtml;
      }

      var rStr = '';
      if (st.resVal && st.resVal.error) {
        rStr = '<div class="lcd-error">' + escapeHtml(st.resVal.error) + '</div>';
      } else if (typeof st.resVal === 'number') {
        var lblR = st.distKey === 'invN' ? 'xInv = ' : 'p = ';
        rStr = '<div class="lcd-res-line">' + lblR + escapeHtml(CalcEngine.format(st.resVal, fmt)) + '</div>';
      }
      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-list-title">' + escapeHtml(DIST_TYPES[st.typeIdx].label) + '</div>' +
          rStr +
        '</div>'
      );
    },
    onKey: function (key, ctx) {
      var st = ctx.distState;

      if (st.step === 'menu') {
        if (key === 'UP') { st.typeIdx = (st.typeIdx + DIST_TYPES.length - 1) % DIST_TYPES.length; return; }
        if (key === 'DOWN') { st.typeIdx = (st.typeIdx + 1) % DIST_TYPES.length; return; }
        var n = parseInt(key, 10);
        if (ctx.machineId === '580' && n >= 1 && n <= DIST_TYPES.length) {
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
        if (key === 'AC' || key === 'BACK') { st.step = 'menu'; return; }
        if (key === 'UP' || key === 'DOWN') { st.inputMode = st.inputMode === 'var' ? 'list' : 'var'; return; }
        if (ctx.machineId === '580' && (key === '1' || key === '2')) {
          st.inputMode = key === '1' ? 'list' : 'var';
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
        if (key === 'AC' || key === 'BACK') {
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
        if (key === 'AC' || key === 'BACK') {
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
        if (key === 'AC' || key === 'BACK' || key === '=' || key === 'OK') {
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
  // 8. ỨNG DỤNG BẢNG TÍNH (sheet — Spreadsheet, chỉ có trên Máy 880)
  // =========================================================================
  var SHEET_OPTN_ITEMS = [
    { label: 'Fill Formula', action: 'fill_formula' },
    { label: 'Fill Value', action: 'fill_value' },
    { label: 'Edit Cell', action: 'edit_cell' },
    { label: 'Delete All', action: 'clear_all' },
    { label: 'Recalculate', action: 'recalc_now' },
    { label: 'Min(', text: 'Min(' },
    { label: 'Max(', text: 'Max(' },
    { label: 'Mean(', text: 'Mean(' },
    { label: 'Sum(', text: 'Sum(' },
    { label: ':', text: ':' },
    { label: '=', text: '=' },
    { label: '$', text: '$' }
  ];

  CalcApps.register({
    id: 'sheet',
    code: '8',
    name: 'Spreadsheet',
    viName: 'Bảng tính',
    icon: '▦',
    stage: 1,
    onlyTypeB: true,
    init: function (ctx) {
      if (!ctx.sheetState) {
        var sh = CalcEngine.sheet.newSheet();
        CalcEngine.sheet.setCell(sh, 'A1', 2);
        CalcEngine.sheet.setCell(sh, 'A2', 3);
        CalcEngine.sheet.setCell(sh, 'B1', '=A1+A2');
        ctx.sheetState = {
          sheet: sh,
          step: 'grid',
          selCol: 0,
          selRow: 0,
          scrollRow: 0,
          editStr: '',
          isEditing: false,
          optnIdx: 0,
          fillMode: 'formula',
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
        var oHtml = '<div class="lcd-menu-list">';
        for (var i = 0; i < SHEET_OPTN_ITEMS.length; i++) {
          var cls = (i === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + cls + '" data-action="sheet-optn" data-idx="' + i + '">' +
                   escapeHtml(SHEET_OPTN_ITEMS[i].label) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'fill') {
        var title = st.fillMode === 'formula' ? 'Fill Formula' : 'Fill Value';
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + title + '</div>' +
            '<div class="lcd-list-item ' + (st.fillFocus === 0 ? 'active' : '') + '" data-action="sheet-fill-focus" data-f="0">' +
              '<span>' + (st.fillMode === 'formula' ? 'Form :' : 'Value :') + '</span>' +
              '<b>' + escapeHtml(st.fillExpr) + (st.fillFocus === 0 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.fillFocus === 1 ? 'active' : '') + '" data-action="sheet-fill-focus" data-f="1">' +
              '<span>Range :</span>' +
              '<b>' + escapeHtml(st.fillRange) + (st.fillFocus === 1 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.fillFocus === 2 ? 'active' : '') + '" data-action="sheet-fill-exec">' +
              '<span>Confirm</span><b>▶</b>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.selRow < st.scrollRow) st.scrollRow = st.selRow;
      if (st.selRow >= st.scrollRow + 4) st.scrollRow = st.selRow - 3;

      var colNames = ['A', 'B', 'C', 'D', 'E'];
      var curRef = colNames[st.selCol] + (st.selRow + 1);
      var cellObj = sh.cells[curRef];

      var html = '<div class="lcd-table-wrap">';
      html += '<table class="lcd-grid sheet-grid"><thead><tr><th></th>';
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
        if (key === 'AC' || key === 'BACK') { st.step = 'grid'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + len - 1) % len; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % len; return; }
        if (key === '=' || key === 'OK') {
          this.execSheetOptn(st, st.optnIdx);
          return;
        }
        return;
      }

      if (st.step === 'fill') {
        var prop = st.fillFocus === 0 ? 'fillExpr' : (st.fillFocus === 1 ? 'fillRange' : null);
        if (key === 'AC' || key === 'BACK') { st.step = 'grid'; return; }
        if (key === 'UP' && st.fillFocus > 0) { st.fillFocus--; return; }
        if (key === 'DOWN' && st.fillFocus < 2) { st.fillFocus++; return; }
        if (key === 'DEL' && prop) { st[prop] = st[prop].slice(0, -1); return; }
        if (key === '=' || key === 'OK') {
          if (st.fillFocus < 2) {
            st.fillFocus++;
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
        if (fCh && prop) st[prop] += fCh;
        return;
      }

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
      if (key === 'AC' || key === 'BACK') {
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
        '(': '(', ')': ')', ',': ':', 'COLON': ':', 'EQUAL_SIGN': '=',
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
      if (item.action === 'edit_cell') {
        st.isEditing = true;
        st.editStr = st.sheet.cells[curRef].raw || '';
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
          st.editStr = (item.text === ':' || item.text === '$') ? (st.sheet.cells[curRef].raw || '') : '=';
        }
        st.editStr += item.text;
        st.step = 'grid';
      }
    }
  });

  // =========================================================================
  // D. ỨNG DỤNG HỘP TOÁN HỌC (mathbox — Math Box, chỉ có trên Máy 880)
  // Gồm 4 công cụ: Dice Roll, Coin Toss, Number Line, Circle
  // =========================================================================
  var MB_MENU_ITEMS = [
    { key: 'dice', label: 'Dice Roll' },
    { key: 'coin', label: 'Coin Toss' },
    { key: 'numline', label: 'Number Line' },
    { key: 'circle', label: 'Circle' }
  ];

  var NL_TYPES = [
    { type: 'x<a', label: 'x < a', two: false },
    { type: 'x<=a', label: 'x ≤ a', two: false },
    { type: 'x=a', label: 'x = a', two: false },
    { type: 'x>a', label: 'x > a', two: false },
    { type: 'x>=a', label: 'x ≥ a', two: false },
    { type: 'a<x<b', label: 'a < x < b', two: true },
    { type: 'a<=x<b', label: 'a ≤ x < b', two: true },
    { type: 'a<x<=b', label: 'a < x ≤ b', two: true },
    { type: 'a<=x<=b', label: 'a ≤ x ≤ b', two: true },
    { type: 'clear', label: 'Clear', two: false }
  ];

  CalcApps.register({
    id: 'mathbox',
    code: 'D',
    name: 'Math Box',
    viName: 'Hộp toán học',
    icon: '🎲',
    stage: 1,
    onlyTypeB: true,
    init: function (ctx) {
      if (!ctx.mathboxState) {
        ctx.mathboxState = {
          step: 'menu', // 'menu'|'params'|'res_type'|'result'|'nl_list'|'nl_type'|'nl_val'|'nl_graph'|'nl_view'|'cir_params'|'cir_graph'
          menuIdx: 0,
          mode: 'dice', // 'dice' | 'coin' | 'numline' | 'circle'
          count: 2, // 1..3 dice or coins
          timesStr: '30',
          sameResult: 0, // 0: OFF, 1: Window 1, 2: Window 2, 3: Window 3
          focusIdx: 0, // 0: Dice/Coins, 1: Attempts, 2: Same Result, 3: Execute
          resTypeIdx: 1, // 0: List, 1: Relative Freq
          simRes: null,
          // Number Line state
          nlSlots: [
            { type: 'x>=a', a: -1, b: 2 },
            { type: 'a<x<=b', a: -2, b: 3 },
            null
          ],
          nlFocusIdx: 0, // 0: A, 1: B, 2: C, 3: Execute
          nlTypeIdx: 0,
          nlEditA: '0',
          nlEditB: '2',
          nlValFocus: 0, // 0: a, 1: b
          nlActiveAxis: 0, // 0..2
          nlCenter: 0,
          nlScale: 1,
          nlViewFocus: 0, // 0: Scale, 1: Center
          // Circle state
          cirType: 'unit', // 'unit' | 'half' | 'clock'
          cirTheta1: '30',
          cirTheta2: '120',
          cirFocus: 0, // 0: Type, 1: θ1, 2: θ2, 3: Execute
          cirActiveAngle: 0, // 0: θ1, 1: θ2
          cirRes: null
        };
      }
      ctx.mathboxState.step = 'menu';
    },
    render: function (ctx) {
      var st = ctx.mathboxState;

      if (st.step === 'menu') {
        var mHtml = '<div class="lcd-menu-list">';
        for (var i = 0; i < MB_MENU_ITEMS.length; i++) {
          var cls = (i === st.menuIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          mHtml += '<div class="' + cls + '" data-action="mb-mode" data-idx="' + i + '">' +
                   escapeHtml(MB_MENU_ITEMS[i].label) + '</div>';
        }
        mHtml += '</div>';
        return mHtml;
      }

      // 1 & 2. Dice Roll / Coin Toss Parameter Screen
      if (st.step === 'params') {
        var isDice = (st.mode === 'dice');
        var unitLbl = isDice ? (st.count + ' Dice') : (st.count + (st.count > 1 ? ' Coins' : ' Coin'));
        var sameLbl = st.sameResult === 0 ? 'OFF' : ('Window ' + st.sameResult);
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">' + (isDice ? 'Dice Roll' : 'Coin Toss') + '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 0 ? 'active' : '') + '" data-action="mb-focus" data-f="0">' +
              '<span>' + (isDice ? 'Dice :' : 'Coins :') + '</span><b>' + unitLbl + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 1 ? 'active' : '') + '" data-action="mb-focus" data-f="1">' +
              '<span>Attempts :</span><b>' + escapeHtml(st.timesStr) + (st.focusIdx === 1 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 2 ? 'active' : '') + '" data-action="mb-focus" data-f="2">' +
              '<span>Same Result :</span><b>' + sameLbl + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.focusIdx === 3 ? 'active' : '') + '" data-action="mb-exec">' +
              '<span>Execute</span><b>▶</b>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.step === 'res_type') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Result Type</div>' +
            '<div class="lcd-list-item ' + (st.resTypeIdx === 0 ? 'active' : '') + '" data-action="mb-restype" data-idx="0">List</div>' +
            '<div class="lcd-list-item ' + (st.resTypeIdx === 1 ? 'active' : '') + '" data-action="mb-restype" data-idx="1">Relative Freq</div>' +
          '</div>'
        );
      }

      if (st.step === 'result') {
        var r = st.simRes;
        if (!r || r.error) {
          return '<div class="lcd-error">' + escapeHtml((r && r.error) || 'Math ERROR') + '</div>';
        }
        if (st.resTypeIdx === 0 && r.rolls) {
          var lHtml = '<div class="lcd-table-wrap">';
          lHtml += '<div class="lcd-table-bar"><span>List (n=' + r.times + ')</span>' +
                   '<span class="lcd-inline-btn" data-action="mb-toggle-view">[Rel Freq]</span></div>';
          lHtml += '<table class="lcd-grid"><thead><tr><th>#</th><th>A</th>';
          if (st.count >= 2) lHtml += '<th>B</th>';
          if (st.count >= 3) lHtml += '<th>C</th>';
          lHtml += '<th>' + (st.mode === 'dice' ? 'Sum' : 'Heads') + '</th></tr></thead><tbody>';
          var maxShow = Math.min(r.rolls.length, 30);
          for (var ti = 0; ti < maxShow; ti++) {
            var item = r.rolls[ti];
            var faces = item.faces || [item.sum];
            lHtml += '<tr><td class="lcd-grid-idx">' + (ti + 1) + '</td>';
            for (var fi = 0; fi < st.count; fi++) {
              var fv = faces[fi] !== undefined ? faces[fi] : '';
              if (st.mode === 'coin') fv = fv === 1 ? '●' : '○';
              lHtml += '<td>' + fv + '</td>';
            }
            lHtml += '<td><b>' + (item.sum !== undefined ? item.sum : item.heads) + '</b></td></tr>';
          }
          lHtml += '</tbody></table></div>';
          return lHtml;
        }

        var maxFreq = 1;
        for (var k = 0; k < r.table.length; k++) {
          if (r.table[k].freq > maxFreq) maxFreq = r.table[k].freq;
        }
        var col1Title = st.mode === 'dice' ? 'Sum' : 'Heads';
        var html = '<div class="lcd-table-wrap">';
        html += '<div class="lcd-table-bar">' +
                  '<span>Relative Freq (n=' + r.times + ')</span>' +
                  '<span class="lcd-inline-btn" data-action="mb-retry">[Retry]</span>' +
                '</div>';
        html += '<table class="lcd-grid mb-grid"><thead><tr>' +
                  '<th>' + col1Title + '</th><th>Freq</th><th>Rel Frq</th><th>Graph</th>' +
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
      }

      // 3. Number Line Screens
      if (st.step === 'nl_list') {
        var slotNames = ['A', 'B', 'C'];
        var nlHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Number Line</div>';
        for (var si = 0; si < 3; si++) {
          var sl = st.nlSlots[si];
          var desc = sl ? this.formatNlSlot(sl) : '';
          var sCls = (st.nlFocusIdx === si) ? 'lcd-list-item active' : 'lcd-list-item';
          nlHtml += '<div class="' + sCls + '" data-action="mb-nl-slot" data-idx="' + si + '">' +
                    '<span>' + slotNames[si] + ': ' + escapeHtml(desc) + '</span><b>▶</b></div>';
        }
        var exCls = (st.nlFocusIdx === 3) ? 'lcd-list-item active' : 'lcd-list-item';
        nlHtml += '<div class="' + exCls + '" data-action="mb-nl-exec"><span>Execute</span><b>▶</b></div>';
        nlHtml += '</div>';
        return nlHtml;
      }

      if (st.step === 'nl_type') {
        var tHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Select Type (' + ['A', 'B', 'C'][st.nlFocusIdx] + ')</div>';
        for (var ti2 = 0; ti2 < NL_TYPES.length; ti2++) {
          var tCls = (ti2 === st.nlTypeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          tHtml += '<div class="' + tCls + '" data-action="mb-nl-type" data-idx="' + ti2 + '">' +
                   escapeHtml(NL_TYPES[ti2].label) + '</div>';
        }
        tHtml += '</div>';
        return tHtml;
      }

      if (st.step === 'nl_val') {
        var tObj = NL_TYPES[st.nlTypeIdx];
        var vHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' + escapeHtml(tObj.label) + '</div>';
        vHtml += '<div class="lcd-list-item ' + (st.nlValFocus === 0 ? 'active' : '') + '" data-action="mb-nl-vfocus" data-f="0">' +
                 '<span>a =</span><b>' + escapeHtml(st.nlEditA) + (st.nlValFocus === 0 ? '▏' : '') + '</b></div>';
        if (tObj.two) {
          vHtml += '<div class="lcd-list-item ' + (st.nlValFocus === 1 ? 'active' : '') + '" data-action="mb-nl-vfocus" data-f="1">' +
                   '<span>b =</span><b>' + escapeHtml(st.nlEditB) + (st.nlValFocus === 1 ? '▏' : '') + '</b></div>';
        }
        vHtml += '</div>';
        return vHtml;
      }

      if (st.step === 'nl_graph') {
        var actSlot = st.nlSlots[st.nlActiveAxis];
        var topTxt = ['A', 'B', 'C'][st.nlActiveAxis] + ': ' + (actSlot ? this.formatNlSlot(actSlot) : '(None)');
        return (
          '<div class="lcd-table-wrap">' +
            '<div class="lcd-table-bar"><span>' + escapeHtml(topTxt) + '</span>' +
            '<span class="lcd-inline-btn" data-action="mb-nl-back">[BACK]</span></div>' +
            '<div class="algo-canvas-wrap">' +
              '<canvas id="mb-numline-canvas" width="308" height="92"></canvas>' +
            '</div>' +
          '</div>'
        );
      }

      // 4. Circle Screens
      if (st.step === 'cir_params') {
        var typeName = st.cirType === 'unit' ? 'Unit Circle' : (st.cirType === 'half' ? 'Half Circle' : 'Clock');
        var isClock = (st.cirType === 'clock');
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Circle</div>' +
            '<div class="lcd-list-item ' + (st.cirFocus === 0 ? 'active' : '') + '" data-action="mb-cir-focus" data-f="0">' +
              '<span>Type :</span><b>' + typeName + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.cirFocus === 1 ? 'active' : '') + '" data-action="mb-cir-focus" data-f="1">' +
              '<span>' + (isClock ? 'Time (1~12) :' : 'θ1 :') + '</span><b>' + escapeHtml(st.cirTheta1) + (isClock ? ':00' : '°') + (st.cirFocus === 1 ? '▏' : '') + '</b>' +
            '</div>' +
            (!isClock
              ? '<div class="lcd-list-item ' + (st.cirFocus === 2 ? 'active' : '') + '" data-action="mb-cir-focus" data-f="2">' +
                  '<span>θ2 :</span><b>' + escapeHtml(st.cirTheta2) + '°' + (st.cirFocus === 2 ? '▏' : '') + '</b>' +
                '</div>'
              : '') +
            '<div class="lcd-list-item ' + (st.cirFocus === 3 ? 'active' : '') + '" data-action="mb-cir-exec">' +
              '<span>Execute</span><b>▶</b>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.step === 'cir_graph') {
        var cr = st.cirRes;
        if (!cr || !cr.ok) {
          return '<div class="lcd-error">' + escapeHtml((cr && cr.error) || 'Range ERROR') + '</div>';
        }
        var infoHtml = '';
        if (st.cirType === 'clock') {
          infoHtml =
            '<div class="mb-cir-info">' +
              '<div><b>' + cr.time + '</b></div>' +
              '<div>θ1 = ' + cr.theta1 + '°</div>' +
              '<div>θ2 = ' + cr.theta2 + '°</div>' +
              '<div class="lcd-sub-hint">▲▼ đổi giờ</div>' +
            '</div>';
        } else {
          var angObj = (st.cirActiveAngle === 1 && cr.angles[1]) ? cr.angles[1] : cr.angles[0];
          var lblA = (st.cirActiveAngle === 1 && cr.angles[1]) ? 'θ2' : 'θ1';
          infoHtml =
            '<div class="mb-cir-info">' +
              '<div><b>' + lblA + ' = ' + angObj.theta + '°</b></div>' +
              '<div>sin = ' + escapeHtml(angObj.sinExact) + '</div>' +
              '<div>cos = ' + escapeHtml(angObj.cosExact) + '</div>' +
              '<div>tan = ' + escapeHtml(angObj.tanExact) + '</div>' +
            '</div>';
        }
        return (
          '<div class="lcd-table-wrap">' +
            '<div class="mb-cir-layout">' +
              '<div class="mb-cir-canvas-box"><canvas id="mb-circle-canvas" width="128" height="102"></canvas></div>' +
              infoHtml +
            '</div>' +
          '</div>'
        );
      }

      return '';
    },
    formatNlSlot: function (sl) {
      if (!sl) return '';
      var s = sl.type.replace('<=', '≤').replace('>=', '≥');
      s = s.replace('a', String(sl.a));
      if (sl.b !== undefined) s = s.replace('b', String(sl.b));
      return s;
    },
    afterRender: function (ctx) {
      var st = ctx.mathboxState;
      if (!st) return;
      if (st.step === 'nl_graph') {
        this.drawNumberLineCanvas(st);
      } else if (st.step === 'cir_graph') {
        this.drawCircleCanvas(st);
      }
    },
    drawNumberLineCanvas: function (st) {
      var cv = document.getElementById('mb-numline-canvas');
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d');
      var w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);

      var center = st.nlCenter || 0;
      var scale = st.nlScale || 1;
      var halfSpan = 5 * scale;
      var minX = center - halfSpan;
      var maxX = center + halfSpan;

      function toPx(val) {
        return 22 + ((val - minX) / (maxX - minX)) * (w - 44);
      }

      // Vẽ trục số ở dưới cùng
      var axisY = h - 18;
      g.strokeStyle = '#0b1911';
      g.fillStyle = '#0b1911';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(14, axisY);
      g.lineTo(w - 14, axisY);
      g.stroke();

      // Vạch chia và số
      g.font = '9px sans-serif';
      g.textAlign = 'center';
      for (var tick = -5; tick <= 5; tick++) {
        var xv = center + tick * scale;
        var px = toPx(xv);
        g.beginPath();
        g.moveTo(px, axisY - 3);
        g.lineTo(px, axisY + 3);
        g.stroke();
        if (tick % 2 === 0 || tick === 0) {
          g.fillText(String(Math.round(xv * 100) / 100), px, axisY + 13);
        }
      }

      // Vẽ 3 đường biểu diễn A, B, C phía trên trục số
      var slotNames = ['A', 'B', 'C'];
      for (var i = 0; i < 3; i++) {
        var sl = st.nlSlots[i];
        var y = 14 + i * 20;
        g.font = (i === st.nlActiveAxis ? 'bold ' : '') + '10px sans-serif';
        g.textAlign = 'left';
        g.fillText(slotNames[i], 3, y + 3);
        if (!sl) continue;

        g.lineWidth = (i === st.nlActiveAxis) ? 2.2 : 1.4;
        var t = sl.type;
        var aPx = Math.max(16, Math.min(w - 16, toPx(sl.a)));
        var bPx = sl.b !== undefined ? Math.max(16, Math.min(w - 16, toPx(sl.b))) : aPx;

        if (t === 'x<a' || t === 'x<=a') {
          g.beginPath();
          g.moveTo(aPx, y);
          g.lineTo(18, y);
          g.lineTo(23, y - 3);
          g.moveTo(18, y);
          g.lineTo(23, y + 3);
          g.stroke();
          this.drawEndDot(g, aPx, y, t === 'x<=a');
        } else if (t === 'x>a' || t === 'x>=a') {
          g.beginPath();
          g.moveTo(aPx, y);
          g.lineTo(w - 18, y);
          g.lineTo(w - 23, y - 3);
          g.moveTo(w - 18, y);
          g.lineTo(w - 23, y + 3);
          g.stroke();
          this.drawEndDot(g, aPx, y, t === 'x>=a');
        } else if (t === 'x=a') {
          this.drawEndDot(g, aPx, y, true);
        } else {
          g.beginPath();
          g.moveTo(aPx, y);
          g.lineTo(bPx, y);
          g.stroke();
          var incL = (t.indexOf('a<=') === 0);
          var incR = (t.indexOf('<=b') !== -1);
          this.drawEndDot(g, aPx, y, incL);
          this.drawEndDot(g, bPx, y, incR);
        }
      }
    },
    drawEndDot: function (g, x, y, closed) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2, false);
      if (closed) {
        g.fillStyle = '#0b1911';
        g.fill();
      } else {
        g.fillStyle = '#d8e4d8';
        g.fill();
        g.strokeStyle = '#0b1911';
        g.stroke();
        g.fillStyle = '#0b1911';
      }
    },
    drawCircleCanvas: function (st) {
      var cv = document.getElementById('mb-circle-canvas');
      if (!cv || !cv.getContext || !st.cirRes || !st.cirRes.ok) return;
      var g = cv.getContext('2d');
      var w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);

      var cx = Math.round(w / 2);
      var cy = st.cirType === 'half' ? (h - 14) : Math.round(h / 2);
      var r = st.cirType === 'half' ? 42 : 40;

      g.strokeStyle = '#0b1911';
      g.fillStyle = '#0b1911';
      g.lineWidth = 1.2;

      if (st.cirType === 'clock') {
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2, false);
        g.stroke();
        for (var hr = 1; hr <= 12; hr++) {
          var ang = (hr * 30 - 90) * Math.PI / 180;
          g.beginPath();
          g.moveTo(cx + (r - 4) * Math.cos(ang), cy + (r - 4) * Math.sin(ang));
          g.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
          g.stroke();
        }
        // Kim phút chỉ 12h, kim giờ chỉ giờ hiện tại
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx, cy - (r - 6));
        g.stroke();

        var hAng = (st.cirRes.hour * 30 - 90) * Math.PI / 180;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + (r - 14) * Math.cos(hAng), cy + (r - 14) * Math.sin(hAng));
        g.stroke();
        return;
      }

      // Trục tọa độ
      g.beginPath();
      g.moveTo(cx - r - 8, cy);
      g.lineTo(cx + r + 8, cy);
      g.moveTo(cx, cy - r - 8);
      g.lineTo(cx, st.cirType === 'half' ? cy + 4 : cy + r + 8);
      g.stroke();

      // Đường tròn đơn vị hoặc nửa đường tròn
      g.beginPath();
      if (st.cirType === 'half') {
        g.arc(cx, cy, r, Math.PI, 0, false);
      } else {
        g.arc(cx, cy, r, 0, Math.PI * 2, false);
      }
      g.stroke();

      // Vẽ bán kính góc
      for (var i = 0; i < st.cirRes.angles.length; i++) {
        var ao = st.cirRes.angles[i];
        var rad = ao.theta * Math.PI / 180;
        var px = cx + r * Math.cos(rad);
        var py = cy - r * Math.sin(rad);
        g.lineWidth = (i === st.cirActiveAngle) ? 2.2 : 1.1;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(px, py);
        g.stroke();
        // Đường gióng sin/cos cho góc đang chọn
        if (i === st.cirActiveAngle) {
          g.setLineDash([2, 2]);
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px, cy);
          g.stroke();
          g.setLineDash([]);
        }
      }
    },
    onKey: function (key, ctx) {
      var st = ctx.mathboxState;

      if (st.step === 'menu') {
        if (key === 'UP') { st.menuIdx = (st.menuIdx + 3) % 4; return; }
        if (key === 'DOWN') { st.menuIdx = (st.menuIdx + 1) % 4; return; }
        if (key === '=' || key === 'OK') {
          this.selectMenuTool(st, st.menuIdx);
          return;
        }
        return;
      }

      // Dice Roll / Coin Toss Params
      if (st.step === 'params') {
        if (key === 'AC' || key === 'BACK') { st.step = 'menu'; return; }
        if (key === 'UP' && st.focusIdx > 0) { st.focusIdx--; return; }
        if (key === 'DOWN' && st.focusIdx < 3) { st.focusIdx++; return; }
        if (st.focusIdx === 0) {
          if (key === 'LEFT' || key === 'RIGHT' || key === 'OK') {
            st.count = (st.count % 3) + 1;
            return;
          }
          if (key === '1' || key === '2' || key === '3') {
            st.count = parseInt(key, 10);
            st.focusIdx = 1;
            return;
          }
        } else if (st.focusIdx === 1) {
          if (key === 'DEL') { st.timesStr = st.timesStr.slice(0, -1); return; }
          if (/^[0-9]$/.test(key)) { st.timesStr += key; return; }
        } else if (st.focusIdx === 2) {
          if (key === 'LEFT' || key === 'RIGHT' || key === 'OK') {
            st.sameResult = (st.sameResult + 1) % 4;
            return;
          }
        }
        if (key === '=' || key === 'OK') {
          if (st.focusIdx < 3) st.focusIdx++;
          else st.step = 'res_type';
          return;
        }
        return;
      }

      if (st.step === 'res_type') {
        if (key === 'AC' || key === 'BACK') { st.step = 'params'; return; }
        if (key === 'UP' || key === 'DOWN') { st.resTypeIdx = st.resTypeIdx === 0 ? 1 : 0; return; }
        if (key === '=' || key === 'OK') {
          this.runSimulation(st);
          return;
        }
        return;
      }

      if (st.step === 'result') {
        if (key === 'AC' || key === 'BACK') { st.step = 'params'; return; }
        if (key === '=' || key === 'OK') { this.runSimulation(st); return; }
        return;
      }

      // Number Line
      if (st.step === 'nl_list') {
        if (key === 'AC' || key === 'BACK') { st.step = 'menu'; return; }
        if (key === 'UP') { st.nlFocusIdx = (st.nlFocusIdx + 3) % 4; return; }
        if (key === 'DOWN') { st.nlFocusIdx = (st.nlFocusIdx + 1) % 4; return; }
        if (key === '=' || key === 'OK') {
          if (st.nlFocusIdx === 3) {
            st.step = 'nl_graph';
          } else {
            st.nlTypeIdx = 0;
            st.step = 'nl_type';
          }
          return;
        }
        return;
      }

      if (st.step === 'nl_type') {
        if (key === 'AC' || key === 'BACK') { st.step = 'nl_list'; return; }
        if (key === 'UP') { st.nlTypeIdx = (st.nlTypeIdx + NL_TYPES.length - 1) % NL_TYPES.length; return; }
        if (key === 'DOWN') { st.nlTypeIdx = (st.nlTypeIdx + 1) % NL_TYPES.length; return; }
        if (key === '=' || key === 'OK') {
          var chosenT = NL_TYPES[st.nlTypeIdx];
          if (chosenT.type === 'clear') {
            st.nlSlots[st.nlFocusIdx] = null;
            st.step = 'nl_list';
          } else {
            var curSl = st.nlSlots[st.nlFocusIdx];
            st.nlEditA = curSl ? String(curSl.a) : '0';
            st.nlEditB = (curSl && curSl.b !== undefined) ? String(curSl.b) : '2';
            st.nlValFocus = 0;
            st.step = 'nl_val';
          }
          return;
        }
        return;
      }

      if (st.step === 'nl_val') {
        var tObj2 = NL_TYPES[st.nlTypeIdx];
        if (key === 'AC' || key === 'BACK') { st.step = 'nl_type'; return; }
        if (tObj2.two && (key === 'UP' || key === 'DOWN')) {
          st.nlValFocus = st.nlValFocus === 0 ? 1 : 0;
          return;
        }
        var prop = st.nlValFocus === 0 ? 'nlEditA' : 'nlEditB';
        if (key === 'DEL') { st[prop] = st[prop].slice(0, -1); return; }
        if (key === '=' || key === 'OK') {
          if (tObj2.two && st.nlValFocus === 0) {
            st.nlValFocus = 1;
          } else {
            var va = evalCellInput(st.nlEditA, ctx, 0);
            var vb = evalCellInput(st.nlEditB, ctx, 2);
            st.nlSlots[st.nlFocusIdx] = { type: tObj2.type, a: va, b: vb };
            if (st.nlFocusIdx < 3) st.nlFocusIdx++;
            st.step = 'nl_list';
          }
          return;
        }
        var chNl = mapKeyToCellChar(key);
        if (chNl) st[prop] += chNl;
        return;
      }

      if (st.step === 'nl_graph') {
        if (key === 'AC' || key === 'BACK' || key === 'OK' || key === '=') {
          st.step = 'nl_list';
          return;
        }
        if (key === 'UP') { st.nlActiveAxis = (st.nlActiveAxis + 2) % 3; return; }
        if (key === 'DOWN') { st.nlActiveAxis = (st.nlActiveAxis + 1) % 3; return; }
        if (key === 'LEFT') { st.nlCenter -= st.nlScale; return; }
        if (key === 'RIGHT') { st.nlCenter += st.nlScale; return; }
        return;
      }

      // Circle
      if (st.step === 'cir_params') {
        var isClock = (st.cirType === 'clock');
        if (key === 'AC' || key === 'BACK') { st.step = 'menu'; return; }
        if (key === 'UP') {
          if (st.cirFocus === 3 && isClock) st.cirFocus = 1;
          else if (st.cirFocus > 0) st.cirFocus--;
          return;
        }
        if (key === 'DOWN') {
          if (st.cirFocus === 1 && isClock) st.cirFocus = 3;
          else if (st.cirFocus < 3) st.cirFocus++;
          return;
        }
        if (st.cirFocus === 0 && (key === 'LEFT' || key === 'RIGHT' || key === 'OK')) {
          st.cirType = st.cirType === 'unit' ? 'half' : (st.cirType === 'half' ? 'clock' : 'unit');
          if (st.cirType === 'clock') st.cirTheta1 = '3';
          else st.cirTheta1 = '30';
          return;
        }
        var cProp = st.cirFocus === 1 ? 'cirTheta1' : (st.cirFocus === 2 ? 'cirTheta2' : null);
        if (cProp && key === 'DEL') { st[cProp] = st[cProp].slice(0, -1); return; }
        if (key === '=' || key === 'OK') {
          if (st.cirFocus === 0) st.cirFocus = 1;
          else if (st.cirFocus === 1 && !isClock) st.cirFocus = 2;
          else if (st.cirFocus < 3) st.cirFocus = 3;
          else this.executeCircle(ctx);
          return;
        }
        var chCir = mapKeyToCellChar(key);
        if (chCir && cProp) st[cProp] += chCir;
        return;
      }

      if (st.step === 'cir_graph') {
        if (key === 'AC' || key === 'BACK' || key === 'OK' || key === '=') {
          st.step = 'cir_params';
          return;
        }
        if (key === 'UP' || key === 'DOWN') {
          if (st.cirType === 'clock') {
            var curH = parseInt(st.cirTheta1, 10) || 3;
            curH = key === 'UP' ? (curH % 12) + 1 : ((curH + 10) % 12) + 1;
            st.cirTheta1 = String(curH);
            this.executeCircle(ctx);
          } else {
            st.cirActiveAngle = st.cirActiveAngle === 0 ? 1 : 0;
          }
          return;
        }
      }
    },
    selectMenuTool: function (st, idx) {
      st.menuIdx = idx;
      st.mode = MB_MENU_ITEMS[idx].key;
      if (st.mode === 'dice' || st.mode === 'coin') {
        st.focusIdx = 0;
        st.step = 'params';
      } else if (st.mode === 'numline') {
        st.nlFocusIdx = 0;
        st.step = 'nl_list';
      } else if (st.mode === 'circle') {
        st.cirFocus = 0;
        st.step = 'cir_params';
      }
    },
    runSimulation: function (st) {
      var n = parseInt(st.timesStr, 10);
      if (isNaN(n) || n < 1) n = 10;
      if (n > 250) n = 250;
      st.timesStr = String(n);
      var seedOpt = st.sameResult > 0 ? { seed: st.sameResult * 12345 + 7 } : {};
      if (st.mode === 'dice') {
        st.simRes = CalcEngine.mathbox.rollDice(n, st.count, seedOpt);
      } else {
        st.simRes = CalcEngine.mathbox.tossCoin(n, st.count, seedOpt);
      }
      st.step = 'result';
    },
    executeCircle: function (ctx) {
      var st = ctx.mathboxState;
      var t1 = evalCellInput(st.cirTheta1, ctx, 30);
      var t2 = st.cirTheta2.replace(/\s+/g, '') !== '' ? evalCellInput(st.cirTheta2, ctx, null) : null;
      st.cirRes = CalcEngine.mathBox.circle(st.cirType, t1, t2, 'deg');
      // Lõi trả a1/a2 (và hour cho đồng hồ); phần vẽ dùng mảng angles và chuỗi time
      if (st.cirRes && st.cirRes.ok) {
        st.cirRes.angles = [];
        if (st.cirRes.a1) st.cirRes.angles.push(st.cirRes.a1);
        if (st.cirRes.a2) st.cirRes.angles.push(st.cirRes.a2);
        if (st.cirRes.type === 'clock') st.cirRes.time = st.cirRes.hour + ':00';
      }
      st.cirActiveAngle = 0;
      st.step = 'cir_graph';
    }
  });

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
