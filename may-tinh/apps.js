/* Hệ thống mô-đun ứng dụng cho Máy tính Thầy Minh (ES5) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcEditor = root.CalcEditor;

  var CalcApps = {
    registry: [],
    byId: {}
  };

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  CalcApps.register = function (appDef) {
    var replaced = false;
    for (var i = 0; i < CalcApps.registry.length; i++) {
      if (CalcApps.registry[i].id === appDef.id) {
        CalcApps.registry[i] = appDef;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      CalcApps.registry.push(appDef);
    }
    CalcApps.byId[appDef.id] = appDef;
  };

  CalcApps.getVisibleApps = function (modelType) {
    var list = [];
    for (var i = 0; i < CalcApps.registry.length; i++) {
      var app = CalcApps.registry[i];
      if (app.onlyTypeB && modelType !== 'b') continue;
      list.push(app);
    }
    return list;
  };

  // Danh sách hàm trong CATALOG và OPTN
  var CATALOG_ITEMS = [
    { label: 'sin( — Сиnus', text: 'sin(', evalText: 'sin(' },
    { label: 'cos( — Cosinus', text: 'cos(', evalText: 'cos(' },
    { label: 'tan( — Tang', text: 'tan(', evalText: 'tan(' },
    { label: 'asin( — Arcsin', text: 'sin⁻¹(', evalText: 'asin(' },
    { label: 'acos( — Arccos', text: 'cos⁻¹(', evalText: 'acos(' },
    { label: 'atan( — Arctan', text: 'tan⁻¹(', evalText: 'atan(' },
    { label: 'sinh( — Sinus hyperbol', text: 'sinh(', evalText: 'sinh(' },
    { label: 'cosh( — Cosinus hyperbol', text: 'cosh(', evalText: 'cosh(' },
    { label: 'tanh( — Tang hyperbol', text: 'tanh(', evalText: 'tanh(' },
    { label: 'asinh( — Arcsinh', text: 'sinh⁻¹(', evalText: 'asinh(' },
    { label: 'acosh( — Arccosh', text: 'cosh⁻¹(', evalText: 'acosh(' },
    { label: 'atanh( — Arctanh', text: 'tanh⁻¹(', evalText: 'atanh(' },
    { label: 'GCD(a,b) — Ước chung lớn nhất', text: 'GCD(', evalText: 'gcd(' },
    { label: 'LCM(a,b) — Bội chung nhỏ nhất', text: 'LCM(', evalText: 'lcm(' },
    { label: 'Int(x) — Phần nguyên', text: 'Int(', evalText: 'int(' },
    { label: 'Intg(x) — Làm tròn xuống (Sàn)', text: 'Intg(', evalText: 'intg(' },
    { label: 'Rnd(x) — Làm tròn theo Fix', text: 'Rnd(', evalText: 'round(' },
    { label: '∏(f,a,b) — Tích dãy số', tpl: 'prod' },
    { label: '∑(f,a,b) — Tổng dãy số', tpl: 'sum' },
    { label: '∫(f,a,b) — Tích phân xác định', tpl: 'integ' },
    { label: 'd/dx(f,a) — Đạo hàm tại điểm', tpl: 'deriv' },
    { label: 'Pol(x,y) — Đổi sang tọa độ cực', text: 'Pol(', evalText: 'Pol(' },
    { label: 'Rec(r,θ) — Đổi sang tọa độ vuông', text: 'Rec(', evalText: 'Rec(' },
    { label: '÷R — Phép chia có dư', text: '÷R', evalText: '÷R' },
    { label: 'nPr — Chỉnh hợp', text: 'P', evalText: 'nPr' },
    { label: 'nCr — Tổ hợp', text: 'C', evalText: 'nCr' },
    { label: 'Ran# — Số ngẫu nhiên [0,1)', text: 'Ran#', evalText: 'ran#' },
    { label: 'RanInt#(a,b) — Số nguyên ngẫu nhiên', text: 'RanInt#(', evalText: 'ranint(' }
  ];

  var CALC_OPTN_ITEMS = [
    { label: '1. Hàm Hyperbol (sinh, cosh, tanh...)', group: 'hyp' },
    { label: '2. Ước chung lớn nhất — GCD(a,b)', text: 'GCD(', evalText: 'gcd(' },
    { label: '3. Bội chung nhỏ nhất — LCM(a,b)', text: 'LCM(', evalText: 'lcm(' },
    { label: '4. Phần nguyên — Int(x)', text: 'Int(', evalText: 'int(' },
    { label: '5. Phần nguyên sàn — Intg(x)', text: 'Intg(', evalText: 'intg(' },
    { label: '6. Làm tròn — Rnd(x)', text: 'Rnd(', evalText: 'round(' },
    { label: '7. Tích dãy số — ∏(f,a,b)', tpl: 'prod' },
    { label: '8. Phép chia có dư — ÷R', text: '÷R', evalText: '÷R' },
    { label: '9. Số nguyên ngẫu nhiên — RanInt#(a,b)', text: 'RanInt#(', evalText: 'ranint(' }
  ];

  var HYP_ITEMS = [
    { label: '1. sinh(', text: 'sinh(', evalText: 'sinh(' },
    { label: '2. cosh(', text: 'cosh(', evalText: 'cosh(' },
    { label: '3. tanh(', text: 'tanh(', evalText: 'tanh(' },
    { label: '4. sinh⁻¹(', text: 'sinh⁻¹(', evalText: 'asinh(' },
    { label: '5. cosh⁻¹(', text: 'cosh⁻¹(', evalText: 'acosh(' },
    { label: '6. tanh⁻¹(', text: 'tanh⁻¹(', evalText: 'atanh(' }
  ];

  CalcApps.CATALOG_ITEMS = CATALOG_ITEMS;
  CalcApps.CALC_OPTN_ITEMS = CALC_OPTN_ITEMS;
  CalcApps.HYP_ITEMS = HYP_ITEMS;

  // =========================================================================
  // 1. ỨNG DỤNG TÍNH TOÁN (calc)
  // =========================================================================
  CalcApps.register({
    id: 'calc',
    code: '1',
    name: 'Tính toán',
    icon: '±×÷',
    stage: 1,
    init: function (ctx) {
      if (!ctx.calcState) {
        ctx.calcState = {
          editor: CalcEditor.create(ctx.settings.ioMode === 'line'),
          hasResult: false,
          lastExprText: '',
          lastResult: null, // { value, exact, decimal, recurring, extra }
          displayStyle: 'auto', // 'auto' | 'exact' | 'decimal' | 'recurring' | 'mixed' | 'dms' | 'fact' | 'eng'
          engShift: 0,
          history: [], // tối đa 30 mục { editorClone, exprText, result }
          historyIdx: -1,
          promptMode: null, // null | 'calc' | 'solve' | 'sto'
          promptVars: [],
          promptVarIdx: 0,
          promptInput: '',
          solveInfo: null // { x, lr }
        };
      }
      ctx.calcState.editor.lineMode = (ctx.settings.ioMode === 'line');
    },
    render: function (ctx) {
      var st = ctx.calcState;
      st.editor.lineMode = (ctx.settings.ioMode === 'line');

      // Chế độ hỏi biến (CALC) hoặc hỏi nghiệm đoán (SOLVE)
      if (st.promptMode === 'calc') {
        var vName = st.promptVars[st.promptVarIdx];
        var curVal = ctx.vars[vName] || 0;
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-prompt-box">' +
              '<div class="lcd-prompt-title">Nhập giá trị biến <b>' + escapeHtml(vName) + '</b> (hiện tại: ' + CalcEngine.format(curVal, ctx.getFormatOpts()) + '):</div>' +
              '<div class="lcd-prompt-input">' + escapeHtml(vName) + ' = ' + escapeHtml(st.promptInput) + '<span class="m-cursor"></span></div>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.promptMode === 'solve') {
        var curX = ctx.vars.x || 0;
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-prompt-box">' +
              '<div class="lcd-prompt-title">SOLVE — Nhập giá trị ban đầu cho <b>x</b>:</div>' +
              '<div class="lcd-prompt-input">x = ' + escapeHtml(st.promptInput !== '' ? st.promptInput : String(curX)) + '<span class="m-cursor"></span></div>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.solveInfo) {
        var sInfo = st.solveInfo;
        var xEx = CalcEngine.toExact(sInfo.x);
        var xDisp = xEx ? (xEx + ' ≈ ' + CalcEngine.format(sInfo.x, ctx.getFormatOpts())) : CalcEngine.format(sInfo.x, ctx.getFormatOpts());
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-line">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-solve-res">' +
              '<div><b>x = </b>' + escapeHtml(xDisp) + '</div>' +
              '<div><b>L − R = </b>' + escapeHtml(CalcEngine.format(sInfo.lr, ctx.getFormatOpts())) + '</div>' +
            '</div>' +
          '</div>'
        );
      }

      var exprHtml = CalcEditor.renderHTML(st.editor, !st.hasResult);
      var resHtml = '';
      var histHint = '';
      if (st.history.length > 0) {
        histHint = '<span class="lcd-hist-ind">' +
          (st.historyIdx > 0 ? '▲' : '') +
          (st.historyIdx >= 0 && st.historyIdx < st.history.length - 1 ? '▼' : '') +
        '</span>';
      }

      if (st.hasResult && st.lastResult) {
        var r = st.lastResult;
        if (!r.ok) {
          resHtml = '<div class="lcd-error">' + escapeHtml(r.error || 'Lỗi toán') + '</div>';
        } else {
          resHtml = formatCalcResultHTML(st, ctx);
        }
      }

      return (
        '<div class="lcd-calc">' +
          histHint +
          '<div class="lcd-expr-line">' + exprHtml + '</div>' +
          '<div class="lcd-res-line">' + resHtml + '</div>' +
        '</div>'
      );
    },
    onKey: function (key, ctx) {
      var st = ctx.calcState;

      // Xử lý khi đang hiển thị kết quả SOLVE
      if (st.solveInfo) {
        st.solveInfo = null;
        if (key === 'AC' || key === 'OK' || key === '=') {
          return;
        }
      }

      // Xử lý khi đang ở chế độ chờ chọn biến để STO (lưu biến)
      if (st.promptMode === 'sto') {
        st.promptMode = null;
        var varMap = {
          'VAR_A': 'A', '(-)' : 'A',
          'VAR_B': 'B', 'DMS': 'B',
          'VAR_C': 'C', 'HYP': 'C',
          'VAR_D': 'D', 'sin': 'D',
          'VAR_E': 'E', 'cos': 'E',
          'VAR_F': 'F', 'tan': 'F',
          'VAR_x': 'x', 'x': 'x',
          'VAR_y': 'y', 'S_D': 'y',
          'VAR_M': 'M', 'M+': 'M'
        };
        var targetVar = varMap[key];
        if (targetVar) {
          this.evaluateAndStore(ctx, targetVar);
          return;
        }
      }

      // Xử lý khi đang nhập giá trị biến cho CALC hoặc SOLVE
      if (st.promptMode === 'calc' || st.promptMode === 'solve') {
        this.handlePromptKey(key, ctx);
        return;
      }

      // Phím chức năng đặc biệt
      if (key === 'AC') {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        st.historyIdx = -1;
        return;
      }

      if (key === 'DEL') {
        if (st.hasResult) {
          st.hasResult = false;
          return;
        }
        CalcEditor.deleteBack(st.editor);
        return;
      }

      if (key === 'INS') {
        st.editor.insertMode = !st.editor.insertMode;
        if (st.hasResult) st.hasResult = false;
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
        if (!st.hasResult && CalcEditor.moveUp(st.editor)) {
          return;
        }
        // Duyệt lịch sử lên
        if (st.history.length > 0) {
          if (st.historyIdx === -1) st.historyIdx = st.history.length - 1;
          else if (st.historyIdx > 0) st.historyIdx--;
          this.loadHistoryItem(st, st.historyIdx);
        }
        return;
      }

      if (key === 'DOWN') {
        if (!st.hasResult && CalcEditor.moveDown(st.editor)) {
          return;
        }
        // Duyệt lịch sử xuống
        if (st.history.length > 0 && st.historyIdx !== -1 && st.historyIdx < st.history.length - 1) {
          st.historyIdx++;
          this.loadHistoryItem(st, st.historyIdx);
        }
        return;
      }

      if (key === '=' || key === 'OK' || key === 'APPROX_EQ') {
        this.executeEval(ctx, key === 'APPROX_EQ');
        return;
      }

      if (key === 'S_D') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          this.cycleSD(st);
        }
        return;
      }

      if (key === 'MIXED_SD') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          st.displayStyle = (st.displayStyle === 'mixed') ? 'exact' : 'mixed';
        }
        return;
      }

      if (key === 'FACT' || key === 'DMS_CONV') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          if (key === 'FACT') {
            st.displayStyle = (st.displayStyle === 'fact') ? 'auto' : 'fact';
          } else {
            st.displayStyle = (st.displayStyle === 'dms') ? 'auto' : 'dms';
          }
        }
        return;
      }

      if (key === 'DMS') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          st.displayStyle = (st.displayStyle === 'dms') ? 'auto' : 'dms';
          return;
        }
        CalcEditor.insertToken(st.editor, '°', '°');
        return;
      }

      if (key === 'ENG' || key === 'ENG_BACK') {
        if (st.hasResult && st.lastResult && st.lastResult.ok) {
          if (st.displayStyle !== 'eng') {
            st.displayStyle = 'eng';
            st.engShift = 0;
          } else {
            st.engShift += (key === 'ENG' ? 1 : -1);
          }
        }
        return;
      }

      if (key === 'M+' || key === 'M-') {
        this.handleMemoryAdd(ctx, key === 'M+' ? 1 : -1);
        return;
      }

      if (key === 'STO') {
        st.promptMode = 'sto';
        ctx.setStatusHint('STO → Chọn phím biến (A–F, x, y, M)');
        return;
      }

      if (key === 'CALC') {
        var varsInExpr = CalcEditor.findVariables(st.editor);
        if (varsInExpr.length === 0) {
          this.executeEval(ctx, false);
        } else {
          st.promptMode = 'calc';
          st.promptVars = varsInExpr;
          st.promptVarIdx = 0;
          st.promptInput = '';
        }
        return;
      }

      if (key === 'SOLVE') {
        if (CalcEditor.isEmpty(st.editor)) return;
        st.promptMode = 'solve';
        st.promptInput = '';
        return;
      }

      // Nếu vừa tính xong (hasResult = true) và bấm phím nhập mới:
      if (st.hasResult) {
        var isContOp = (
          key === '+' || key === '-' || key === '*' || key === '/' ||
          key === 'POW' || key === 'SQ' || key === 'CUBE' || key === 'INV' ||
          key === 'FACTORIAL' || key === 'DIV_R' || key === 'NPR' || key === 'NCR'
        );
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        if (isContOp) {
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        } else {
          // Báo cho nhật ký phím biết bắt đầu phép tính mới
          if (ctx.onNewExpressionAfterEqual) ctx.onNewExpressionAfterEqual();
        }
      }

      this.insertByKey(st.editor, key);
    },

    insertByKey: function (ed, key) {
      // Các mẫu toán học
      if (key === 'FRAC') { CalcEditor.insertTemplate(ed, 'frac'); return; }
      if (key === 'MIXED') { CalcEditor.insertTemplate(ed, 'mixed'); return; }
      if (key === 'SQRT') { CalcEditor.insertTemplate(ed, 'sqrt'); return; }
      if (key === 'CBRT') { CalcEditor.insertTemplate(ed, 'cbrt'); return; }
      if (key === 'ROOT') { CalcEditor.insertTemplate(ed, 'root'); return; }
      if (key === 'POW') { CalcEditor.insertTemplate(ed, 'pow'); return; }
      if (key === 'POW10') { CalcEditor.insertTemplate(ed, 'pow10'); return; }
      if (key === 'POWE') { CalcEditor.insertTemplate(ed, 'powe'); return; }
      if (key === 'LOG2') { CalcEditor.insertTemplate(ed, 'log2'); return; }
      if (key === 'ABS') { CalcEditor.insertTemplate(ed, 'abs'); return; }
      if (key === 'INTEG') { CalcEditor.insertTemplate(ed, 'integ'); return; }
      if (key === 'DERIV') { CalcEditor.insertTemplate(ed, 'deriv'); return; }
      if (key === 'SUM') { CalcEditor.insertTemplate(ed, 'sum'); return; }
      if (key === 'PROD') { CalcEditor.insertTemplate(ed, 'prod'); return; }

      // Các phím đơn và hàm
      var tokenMap = {
        '0': ['0', '0'], '1': ['1', '1'], '2': ['2', '2'], '3': ['3', '3'], '4': ['4', '4'],
        '5': ['5', '5'], '6': ['6', '6'], '7': ['7', '7'], '8': ['8', '8'], '9': ['9', '9'],
        '.': ['.', '.'],
        '+': ['+', '+'], '-': ['−', '-'], '(-)': ['-', '-'],
        '*': ['×', '*'], '/': ['÷', '/'],
        '(': ['(', '('], ')': [')', ')'], ',': [',', ','],
        'PERCENT': ['%', '%'],
        'SQ': ['²', '²'], 'CUBE': ['³', '³'], 'INV': ['⁻¹', '⁻¹'],
        'FACTORIAL': ['!', '!'],
        'sin': ['sin(', 'sin('], 'cos': ['cos(', 'cos('], 'tan': ['tan(', 'tan('],
        'asin': ['sin⁻¹(', 'asin('], 'acos': ['cos⁻¹(', 'acos('], 'atan': ['tan⁻¹(', 'atan('],
        'log': ['log(', 'log('], 'ln': ['ln(', 'ln('],
        'EXP10': ['×10^', 'E'],
        'PI': ['π', 'pi'], 'E_CONST': ['e', 'e'],
        'ANS': ['Ans', 'Ans'], 'PREANS': ['PreAns', 'PreAns'],
        'x': ['x', 'x'], 'VAR_x': ['x', 'x'], 'VAR_y': ['y', 'y'],
        'VAR_A': ['A', 'A'], 'VAR_B': ['B', 'B'], 'VAR_C': ['C', 'C'],
        'VAR_D': ['D', 'D'], 'VAR_E': ['E', 'E'], 'VAR_F': ['F', 'F'], 'VAR_M': ['M', 'M'],
        'NPR': ['P', 'nPr'], 'NCR': ['C', 'nCr'],
        'POL': ['Pol(', 'Pol('], 'REC': ['Rec(', 'Rec('],
        'DIV_R': ['÷R', '÷R'],
        'RAN': ['Ran#', 'ran#'], 'RANINT': ['RanInt#(', 'ranint('],
        'EQUAL_SIGN': ['=', '=']
      };
      if (tokenMap[key]) {
        CalcEditor.insertToken(ed, tokenMap[key][0], tokenMap[key][1]);
      }
    },

    handlePromptKey: function (key, ctx) {
      var st = ctx.calcState;
      if (key === 'AC') {
        st.promptMode = null;
        return;
      }
      if (key === 'DEL') {
        st.promptInput = st.promptInput.slice(0, -1);
        return;
      }
      if (key === '=' || key === 'OK') {
        var vName = st.promptMode === 'calc' ? st.promptVars[st.promptVarIdx] : 'x';
        var val = ctx.vars[vName] || 0;
        if (st.promptInput.replace(/\s+/g, '') !== '') {
          var r = CalcEngine.evalText(st.promptInput, ctx.getEvalOpts());
          if (!r.ok) {
            st.promptMode = null;
            st.hasResult = true;
            st.lastResult = r;
            return;
          }
          val = r.value;
        }
        ctx.vars[vName] = val;
        ctx.saveState();

        if (st.promptMode === 'calc') {
          st.promptVarIdx++;
          st.promptInput = '';
          if (st.promptVarIdx >= st.promptVars.length) {
            st.promptMode = null;
            this.executeEval(ctx, false);
          }
        } else {
          // Giải phương trình SOLVE
          st.promptMode = null;
          var exprStr = CalcEditor.toEvalText(st.editor);
          var sol = CalcEngine.solveNumeric(exprStr, val, ctx.getEvalOpts());
          if (sol.error) {
            st.hasResult = true;
            st.lastResult = { ok: false, error: sol.error };
          } else {
            ctx.vars.x = sol.x;
            ctx.vars.Ans = sol.x;
            ctx.saveState();
            st.solveInfo = sol;
            ctx.notifyParentResult(exprStr, sol.x, CalcEngine.format(sol.x, ctx.getFormatOpts()));
          }
        }
        return;
      }

      var mapChar = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '-', '(-)': '-', '*': '*', '/': '/',
        '(': '(', ')': ')', 'PI': 'pi', 'SQRT': 'sqrt('
      };
      if (mapChar[key]) {
        st.promptInput += mapChar[key];
      }
    },

    executeEval: function (ctx, forceDecimal) {
      var st = ctx.calcState;
      var exprText = CalcEditor.toEvalText(st.editor);
      if (!exprText.replace(/\s+/g, '')) return;

      // Tiền xử lý cú pháp độ-phút-giây kiểu 12°30°0° -> dms(12,30,0)
      var normText = exprText.replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°?/g, 'dms($1,$2,$3)')
        .replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°/g, 'dms($1,$2,0)')
        .replace(/(\d+(?:\.\d+)?)°/g, '$1');

      var res = CalcEngine.evalText(normText, ctx.getEvalOpts());
      st.hasResult = true;
      st.lastExprText = exprText;
      if (res.ok) {
        res.recurring = CalcEngine.toRecurring(res.value);
        ctx.vars.PreAns = ctx.vars.Ans;
        ctx.vars.Ans = res.value;
        ctx.saveState();
        st.displayStyle = forceDecimal ? 'decimal' : 'auto';
        st.engShift = 0;

        // Lưu lịch sử (tối đa 30 phép)
        st.history.push({
          editorClone: CalcEditor.cloneState(st.editor),
          exprText: exprText,
          result: res
        });
        if (st.history.length > 30) st.history.shift();
        st.historyIdx = st.history.length - 1;

        st.lastResult = res;

        var shownStr = getPlainResultString(st, ctx);
        ctx.notifyParentResult(exprText, res.value, shownStr);
      }
      st.lastResult = res;
    },

    evaluateAndStore: function (ctx, varName) {
      var st = ctx.calcState;
      if (!st.hasResult) {
        this.executeEval(ctx, false);
      }
      if (st.lastResult && st.lastResult.ok) {
        ctx.vars[varName] = st.lastResult.value;
        ctx.saveState();
        ctx.setStatusHint( varName + ' = ' + (st.lastResult.exact || st.lastResult.decimal));
      }
    },

    handleMemoryAdd: function (ctx, sign) {
      var st = ctx.calcState;
      if (!st.hasResult) {
        this.executeEval(ctx, false);
      }
      if (st.lastResult && st.lastResult.ok) {
        ctx.vars.M = (ctx.vars.M || 0) + sign * st.lastResult.value;
        ctx.saveState();
        ctx.setStatusHint('M = ' + CalcEngine.format(ctx.vars.M, ctx.getFormatOpts()));
      }
    },

    loadHistoryItem: function (st, idx) {
      var item = st.history[idx];
      if (!item) return;
      st.editor = CalcEditor.cloneState(item.editorClone);
      st.lastExprText = item.exprText;
      st.lastResult = item.result;
      st.hasResult = true;
      st.displayStyle = 'auto';
    },

    cycleSD: function (st) {
      var r = st.lastResult;
      if (!r || !r.ok) return;
      // Chu trình: exact (hoặc auto) -> decimal -> recurring (nếu có) -> exact
      var cur = st.displayStyle;
      if (cur === 'auto' || cur === 'exact' || cur === 'mixed' || cur === 'dms' || cur === 'fact' || cur === 'eng') {
        if (r.exact && r.exact !== r.decimal) {
          st.displayStyle = 'decimal';
        } else if (r.recurring) {
          st.displayStyle = 'recurring';
        } else {
          st.displayStyle = 'decimal';
        }
      } else if (cur === 'decimal') {
        if (r.recurring) {
          st.displayStyle = 'recurring';
        } else if (r.exact) {
          st.displayStyle = 'exact';
        }
      } else {
        st.displayStyle = 'exact';
      }
    }
  });

  function getPlainResultString(st, ctx) {
    var r = st.lastResult;
    if (!r || !r.ok) return 'Lỗi';
    var style = st.displayStyle;
    var decStr = CalcEngine.format(r.value, ctx.getFormatOpts());
    if (style === 'decimal') return decStr;
    if (style === 'recurring' && r.recurring) return r.recurring;
    if (style === 'dms') return CalcEngine.toDMS(r.value);
    if (style === 'fact') return CalcEngine.factorize(r.value);
    if (style === 'eng') return CalcEngine.toEng(r.value, st.engShift);
    if (style === 'mixed' || (style === 'auto' && ctx.settings.fracMode === 'mixed')) {
      if (r.exact && r.exact.indexOf('/') !== -1 && r.exact.indexOf('√') === -1 && r.exact.indexOf('π') === -1) {
        return CalcEngine.toMixed(r.value);
      }
    }
    return r.exact || decStr;
  }

  function formatCalcResultHTML(st, ctx) {
    var r = st.lastResult;
    var lineMode = (ctx.settings.ioMode === 'line');
    // Nếu có extra (Pol, Rec, ÷R)
    if (r.extra && Array.isArray(r.extra)) {
      var lbl1 = st.lastExprText.indexOf('Rec') !== -1 ? 'x=' : 'r=';
      var lbl2 = st.lastExprText.indexOf('Rec') !== -1 ? 'y=' : 'θ=';
      return (
        '<div class="lcd-extra-res">' +
          lbl1 + escapeHtml(CalcEngine.format(r.extra[0], ctx.getFormatOpts())) + ', ' +
          lbl2 + escapeHtml(CalcEngine.format(r.extra[1], ctx.getFormatOpts())) +
        '</div>'
      );
    }
    var plain = getPlainResultString(st, ctx);
    return CalcEditor.renderResultHTML(plain, lineMode);
  }

  root.CalcApps = CalcApps;

  // Hàm tiện ích tạo ứng dụng Giai đoạn 2 ("Đang phát triển")
  function registerStage2App(id, code, name, icon, onlyTypeB) {
    CalcApps.register({
      id: id,
      code: code,
      name: name,
      icon: icon,
      stage: 2,
      onlyTypeB: !!onlyTypeB,
      init: function () {},
      render: function () {
        return (
          '<div class="lcd-dev-box">' +
            '<div class="lcd-dev-icon">' + escapeHtml(icon) + '</div>' +
            '<div class="lcd-dev-title">' + escapeHtml(code + ': ' + name) + '</div>' +
            '<div class="lcd-dev-msg">Đang phát triển (Giai đoạn 2)</div>' +
            '<div class="lcd-dev-sub">Bấm MENU hoặc HOME để chọn ứng dụng khác</div>' +
          '</div>'
        );
      },
      onKey: function (key, ctx) {
        if (key === 'AC' || key === 'OK' || key === '=') {
          ctx.openMenu();
        }
      }
    });
  }

  // Chuyển phím bấm thành ký tự cho ô nhập bảng (hỗ trợ số, phân số, căn, pi)
  function mapKeyToCellChar(key) {
    var m = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '.': '.', '+': '+', '-': '-', '(-)': '-', '*': '*', '/': '/',
      'FRAC': '/', 'SQRT': 'sqrt(', '(': '(', ')': ')', 'PI': 'pi'
    };
    return m[key] || null;
  }

  function evalCellInput(str, ctx, fallbackVal) {
    str = String(str || '').replace(/^\s+|\s+$/g, '');
    if (str === '') return fallbackVal !== undefined ? fallbackVal : 0;
    var r = CalcEngine.evalText(str, ctx.getEvalOpts());
    return r.ok ? r.value : NaN;
  }

  CalcApps.mapKeyToCellChar = mapKeyToCellChar;
  CalcApps.evalCellInput = evalCellInput;

  // Đăng ký các mục 2, 3, 4, 5 (Giai đoạn 2)
  registerStage2App('complex', '2', 'Số phức', 'a+bi', false);
  registerStage2App('baseN', '3', 'Cơ số N', '0110', false);
  registerStage2App('matrix', '4', 'Ma trận', '[M]', false);
  registerStage2App('vector', '5', 'Vectơ', '→V', false);

  // =========================================================================
  // 6. ỨNG DỤNG THỐNG KÊ (stat)
  // =========================================================================
  var STAT_TYPES = [
    { key: '1var', label: '1. Thống kê 1 biến (1-Variable)' },
    { key: 'lin', label: '2. y = a + bx (Tuyến tính)' },
    { key: 'quad', label: '3. y = a + bx + cx² (Bậc hai)' },
    { key: 'log', label: '4. y = a + b·ln(x) (Logarit)' },
    { key: 'exp', label: '5. y = a·e^(bx) (Mũ e)' },
    { key: 'abexp', label: '6. y = a·b^x (Mũ tổng quát)' },
    { key: 'pow', label: '7. y = a·x^b (Lũy thừa)' },
    { key: 'inv', label: '8. y = a + b/x (Nghịch đảo)' }
  ];

  CalcApps.register({
    id: 'stat',
    code: '6',
    name: 'Thống kê',
    icon: '📊',
    stage: 1,
    init: function (ctx) {
      if (!ctx.statState) {
        ctx.statState = {
          step: 'type', // 'type' | 'table' | 'optn' | 'result' | 'estimate'
          typeIdx: 0,
          statType: '1var',
          rows: [
            { x: 1, y: 2, f: 1 },
            { x: 2, y: 4, f: 1 },
            { x: 3, y: 6, f: 1 }
          ],
          rowIdx: 0,
          colIdx: 0,
          editingStr: '',
          optnIdx: 0,
          resultLines: [],
          resScroll: 0,
          estTarget: 'y', // 'y' (tính y mũ từ x) | 'x' (tính x mũ từ y)
          estInput: '4',
          estOutput: null
        };
      }
    },
    openOptn: function (ctx) {
      var st = ctx.statState;
      if (st.step === 'type') return true;
      st.step = 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.statState;
      if (st.step === 'type') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn loại thống kê:</div>';
        for (var i = 0; i < STAT_TYPES.length; i++) {
          var cls = (i === st.typeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="stat-type" data-idx="' + i + '">' + escapeHtml(STAT_TYPES[i].label) + '</div>';
        }
        html += '</div>';
        return html;
      }

      if (st.step === 'optn') {
        var is1Var = (st.statType === '1var');
        var opts = is1Var
          ? [
              '1. Tính các đặc trưng 1 biến',
              '2. Bảng dữ liệu',
              '3. Đổi loại thống kê',
              '4. Xóa toàn bộ dữ liệu'
            ]
          : [
              '1. Tính toán hồi quy & 2 biến',
              '2. Ước lượng giá trị (ŷ, x̂)',
              '3. Bảng dữ liệu',
              '4. Đổi loại thống kê'
            ];
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">OPTN — Thống kê:</div>';
        for (var j = 0; j < opts.length; j++) {
          var oCls = (j === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + oCls + '" data-action="stat-optn" data-idx="' + j + '">' + escapeHtml(opts[j]) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'result') {
        var rHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Kết quả thống kê (▲▼ cuộn, AC quay lại):</div>';
        for (var k = 0; k < st.resultLines.length; k++) {
          var rCls = (k === st.resScroll) ? 'lcd-list-item active' : 'lcd-list-item';
          rHtml += '<div class="' + rCls + '">' + escapeHtml(st.resultLines[k]) + '</div>';
        }
        rHtml += '</div>';
        return rHtml;
      }

      if (st.step === 'estimate') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Ước lượng hồi quy (' + escapeHtml(st.statType) + ') — Bấm ◀▶ đổi ŷ/x̂:</div>' +
            '<div class="lcd-prompt-box">' +
              '<div>Chế độ: <b>' + (st.estTarget === 'y' ? 'Tìm ŷ từ x' : 'Tìm x̂ từ y') + '</b></div>' +
              '<div class="lcd-prompt-input">' +
                (st.estTarget === 'y' ? 'x = ' : 'y = ') +
                escapeHtml(st.estInput) + '<span class="m-cursor"></span>' +
              '</div>' +
              (st.estOutput !== null
                ? '<div class="lcd-est-res"><b>' + (st.estTarget === 'y' ? 'ŷ = ' : 'x̂ = ') + escapeHtml(st.estOutput) + '</b></div>'
                : '') +
            '</div>' +
          '</div>'
        );
      }

      // Màn hình bảng dữ liệu
      var hasY = (st.statType !== '1var');
      var hasFreq = !!ctx.settings.statFreq;
      var tHtml = '<div class="lcd-table-wrap">';
      tHtml += '<div class="lcd-table-bar"><span>Bảng dữ liệu (' + escapeHtml(st.statType) + ')</span>' +
               '<span class="lcd-inline-btn" data-action="stat-calc-btn">[OPTN / Tính]</span></div>';
      tHtml += '<table class="lcd-grid"><thead><tr><th>#</th><th>x</th>';
      if (hasY) tHtml += '<th>y</th>';
      if (hasFreq) tHtml += '<th>Tần số</th>';
      tHtml += '</tr></thead><tbody>';

      var totalRows = st.rows.length + 1; // +1 dòng trống để thêm mới
      for (var r = 0; r < totalRows; r++) {
        var rowObj = st.rows[r];
        tHtml += '<tr><td class="lcd-grid-idx">' + (r + 1) + '</td>';
        var c0Sel = (r === st.rowIdx && st.colIdx === 0);
        tHtml += '<td class="' + (c0Sel ? 'sel' : '') + '" data-action="stat-cell" data-r="' + r + '" data-c="0">' +
                 escapeHtml(rowObj ? CalcEngine.format(rowObj.x, ctx.getFormatOpts()) : '') + '</td>';
        if (hasY) {
          var c1Sel = (r === st.rowIdx && st.colIdx === 1);
          tHtml += '<td class="' + (c1Sel ? 'sel' : '') + '" data-action="stat-cell" data-r="' + r + '" data-c="1">' +
                   escapeHtml(rowObj ? CalcEngine.format(rowObj.y, ctx.getFormatOpts()) : '') + '</td>';
        }
        if (hasFreq) {
          var fCol = hasY ? 2 : 1;
          var cfSel = (r === st.rowIdx && st.colIdx === fCol);
          tHtml += '<td class="' + (cfSel ? 'sel' : '') + '" data-action="stat-cell" data-r="' + r + '" data-c="' + fCol + '">' +
                   escapeHtml(rowObj ? String(rowObj.f) : '') + '</td>';
        }
        tHtml += '</tr>';
      }
      tHtml += '</tbody></table>';
      var curCellVal = '';
      if (st.editingStr !== '') {
        curCellVal = st.editingStr;
      } else if (st.rows[st.rowIdx]) {
        var ro = st.rows[st.rowIdx];
        if (st.colIdx === 0) curCellVal = String(ro.x);
        else if (hasY && st.colIdx === 1) curCellVal = String(ro.y);
        else curCellVal = String(ro.f);
      }
      tHtml += '<div class="lcd-cell-edit">Nhập: <b>' + escapeHtml(curCellVal) + '</b><span class="m-cursor"></span> (Bấm = để lưu, OPTN để tính)</div>';
      tHtml += '</div>';
      return tHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.statState;
      if (st.step === 'type') {
        if (key === 'UP') { st.typeIdx = (st.typeIdx + STAT_TYPES.length - 1) % STAT_TYPES.length; return; }
        if (key === 'DOWN') { st.typeIdx = (st.typeIdx + 1) % STAT_TYPES.length; return; }
        var numIdx = parseInt(key, 10);
        if (numIdx >= 1 && numIdx <= STAT_TYPES.length) {
          st.typeIdx = numIdx - 1;
          st.statType = STAT_TYPES[st.typeIdx].key;
          st.step = 'table';
          st.rowIdx = 0; st.colIdx = 0; st.editingStr = '';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.statType = STAT_TYPES[st.typeIdx].key;
          st.step = 'table';
          st.rowIdx = 0; st.colIdx = 0; st.editingStr = '';
          return;
        }
        return;
      }

      if (st.step === 'optn') {
        var maxOpt = (st.statType === '1var') ? 4 : 4;
        if (key === 'UP') { st.optnIdx = (st.optnIdx + maxOpt - 1) % maxOpt; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % maxOpt; return; }
        if (key === 'AC') { st.step = 'table'; return; }
        var oNum = parseInt(key, 10);
        if (oNum >= 1 && oNum <= maxOpt) {
          st.optnIdx = oNum - 1;
          this.execOptnChoice(ctx);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.execOptnChoice(ctx);
          return;
        }
        return;
      }

      if (st.step === 'result') {
        if (key === 'UP' && st.resScroll > 0) { st.resScroll--; return; }
        if (key === 'DOWN' && st.resScroll < st.resultLines.length - 1) { st.resScroll++; return; }
        if (key === 'AC' || key === '=' || key === 'OK') { st.step = 'table'; return; }
        return;
      }

      if (st.step === 'estimate') {
        if (key === 'AC') { st.step = 'table'; return; }
        if (key === 'LEFT' || key === 'RIGHT') {
          st.estTarget = (st.estTarget === 'y') ? 'x' : 'y';
          st.estOutput = null;
          return;
        }
        if (key === 'DEL') {
          st.estInput = st.estInput.slice(0, -1);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.computeEstimate(ctx);
          return;
        }
        var chEst = mapKeyToCellChar(key);
        if (chEst) {
          st.estInput += chEst;
        }
        return;
      }

      // Đang ở bảng dữ liệu
      var hasY = (st.statType !== '1var');
      var hasFreq = !!ctx.settings.statFreq;
      var colCount = 1 + (hasY ? 1 : 0) + (hasFreq ? 1 : 0);

      if (key === 'UP') {
        this.commitStatCell(ctx);
        if (st.rowIdx > 0) st.rowIdx--;
        return;
      }
      if (key === 'DOWN') {
        this.commitStatCell(ctx);
        if (st.rowIdx < st.rows.length) st.rowIdx++;
        return;
      }
      if (key === 'LEFT') {
        this.commitStatCell(ctx);
        if (st.colIdx > 0) st.colIdx--;
        return;
      }
      if (key === 'RIGHT') {
        this.commitStatCell(ctx);
        if (st.colIdx < colCount - 1) st.colIdx++;
        return;
      }
      if (key === 'AC') {
        if (st.editingStr !== '') {
          st.editingStr = '';
        } else {
          this.computeStatResults(ctx);
        }
        return;
      }
      if (key === 'DEL') {
        if (st.editingStr !== '') {
          st.editingStr = st.editingStr.slice(0, -1);
        } else if (st.rows[st.rowIdx] && st.rows.length > 1) {
          st.rows.splice(st.rowIdx, 1);
          if (st.rowIdx >= st.rows.length) st.rowIdx = st.rows.length - 1;
        }
        return;
      }
      if (key === '=' || key === 'OK') {
        this.commitStatCell(ctx);
        if (st.colIdx < colCount - 1) {
          st.colIdx++;
        } else {
          st.colIdx = 0;
          st.rowIdx = Math.min(st.rows.length, st.rowIdx + 1);
        }
        return;
      }

      var cChar = mapKeyToCellChar(key);
      if (cChar) {
        st.editingStr += cChar;
      }
    },
    commitStatCell: function (ctx) {
      var st = ctx.statState;
      if (st.editingStr === '') return;
      var val = evalCellInput(st.editingStr, ctx, NaN);
      st.editingStr = '';
      if (isNaN(val)) return;
      var hasY = (st.statType !== '1var');
      if (!st.rows[st.rowIdx]) {
        st.rows[st.rowIdx] = { x: 0, y: 0, f: 1 };
      }
      if (st.colIdx === 0) st.rows[st.rowIdx].x = val;
      else if (hasY && st.colIdx === 1) st.rows[st.rowIdx].y = val;
      else st.rows[st.rowIdx].f = Math.max(1, Math.round(val));
    },
    execOptnChoice: function (ctx) {
      var st = ctx.statState;
      var is1Var = (st.statType === '1var');
      if (st.optnIdx === 0) {
        this.computeStatResults(ctx);
      } else if (!is1Var && st.optnIdx === 1) {
        st.step = 'estimate';
        st.estOutput = null;
      } else if ((is1Var && st.optnIdx === 1) || (!is1Var && st.optnIdx === 2)) {
        st.step = 'table';
      } else if ((is1Var && st.optnIdx === 2) || (!is1Var && st.optnIdx === 3)) {
        st.step = 'type';
      } else if (is1Var && st.optnIdx === 3) {
        st.rows = [{ x: 0, y: 0, f: 1 }];
        st.rowIdx = 0; st.colIdx = 0;
        st.step = 'table';
      }
    },
    computeStatResults: function (ctx) {
      var st = ctx.statState;
      var xs = [], ys = [], freqs = [];
      for (var i = 0; i < st.rows.length; i++) {
        xs.push(st.rows[i].x);
        ys.push(st.rows[i].y);
        freqs.push(ctx.settings.statFreq ? st.rows[i].f : 1);
      }
      var fmt = ctx.getFormatOpts();
      if (st.statType === '1var') {
        var r1 = CalcEngine.stat1(xs, freqs);
        if (r1.error) {
          st.resultLines = [r1.error];
        } else {
          st.resultLines = [
            'n = ' + r1.n,
            'x̄ (Trung bình) = ' + (CalcEngine.toExact(r1.mean) || CalcEngine.format(r1.mean, fmt)),
            'Σx = ' + CalcEngine.format(r1.sumx, fmt),
            'Σx² = ' + CalcEngine.format(r1.sumx2, fmt),
            'σx = ' + (CalcEngine.toExact(r1.sigma) || CalcEngine.format(r1.sigma, fmt)) + ' (≈ ' + CalcEngine.format(r1.sigma, fmt) + ')',
            'sx = ' + CalcEngine.format(r1.s, fmt),
            'min(x) = ' + CalcEngine.format(r1.min, fmt),
            'Q1 = ' + CalcEngine.format(r1.q1, fmt),
            'Med (Trung vị) = ' + CalcEngine.format(r1.med, fmt),
            'Q3 = ' + CalcEngine.format(r1.q3, fmt),
            'max(x) = ' + CalcEngine.format(r1.max, fmt),
            'Mode (Mốt) = ' + CalcEngine.format(r1.mode, fmt)
          ];
        }
      } else {
        var r2 = CalcEngine.stat2(xs, ys, freqs, st.statType);
        if (r2.error) {
          st.resultLines = [r2.error];
        } else {
          st.resultLines = [
            'a = ' + CalcEngine.format(r2.a, fmt),
            'b = ' + CalcEngine.format(r2.b, fmt)
          ];
          if (r2.c !== undefined) st.resultLines.push('c = ' + CalcEngine.format(r2.c, fmt));
          if (r2.r !== undefined) st.resultLines.push('r = ' + CalcEngine.format(r2.r, fmt));
          st.resultLines.push('n = ' + r2.n);
          st.resultLines.push('x̄ = ' + CalcEngine.format(r2.meanx, fmt));
          st.resultLines.push('ȳ = ' + CalcEngine.format(r2.meany, fmt));
          st.resultLines.push('Σx = ' + CalcEngine.format(r2.sumx, fmt));
          st.resultLines.push('Σy = ' + CalcEngine.format(r2.sumy, fmt));
          st.resultLines.push('Σxy = ' + CalcEngine.format(r2.sumxy, fmt));
          st.resultLines.push('σx = ' + CalcEngine.format(r2.sigmax, fmt));
          st.resultLines.push('sx = ' + CalcEngine.format(r2.sx, fmt));
          st.resultLines.push('σy = ' + CalcEngine.format(r2.sigmay, fmt));
          st.resultLines.push('sy = ' + CalcEngine.format(r2.sy, fmt));
        }
      }
      st.resScroll = 0;
      st.step = 'result';
    },
    computeEstimate: function (ctx) {
      var st = ctx.statState;
      var xs = [], ys = [], freqs = [];
      for (var i = 0; i < st.rows.length; i++) {
        xs.push(st.rows[i].x);
        ys.push(st.rows[i].y);
        freqs.push(ctx.settings.statFreq ? st.rows[i].f : 1);
      }
      var r2 = CalcEngine.stat2(xs, ys, freqs, st.statType);
      if (r2.error) {
        st.estOutput = r2.error;
        return;
      }
      var inVal = evalCellInput(st.estInput, ctx, NaN);
      if (isNaN(inVal)) {
        st.estOutput = 'Lỗi cú pháp';
        return;
      }
      var outVal = (st.estTarget === 'y') ? r2.estY(inVal) : r2.estX(inVal);
      st.estOutput = CalcEngine.format(outVal, ctx.getFormatOpts());
    }
  });

  // Đăng ký mục 7, 8 (Giai đoạn 2)
  registerStage2App('dist', '7', 'Phân phối', '🔔', false);
  registerStage2App('sheet', '8', 'Bảng tính', '▦', false);

  // =========================================================================
  // 9. ỨNG DỤNG BẢNG GIÁ TRỊ (table)
  // =========================================================================
  CalcApps.register({
    id: 'table',
    code: '9',
    name: 'Bảng giá trị',
    icon: 'f(x)',
    stage: 1,
    init: function (ctx) {
      if (!ctx.tableState) {
        var fEd = CalcEditor.create(false);
        CalcEditor.insertToken(fEd, 'x', 'x');
        CalcEditor.insertToken(fEd, '²', '²');
        var gEd = CalcEditor.create(false);
        ctx.tableState = {
          step: 'f', // 'f' | 'g' | 'range' | 'view'
          fEditor: fEd,
          gEditor: gEd,
          startStr: '1',
          endStr: '5',
          stepStr: '1',
          rangeIdx: 0, // 0: start, 1: end, 2: step
          rows: [],
          selRow: 0,
          selCol: 0,
          editXStr: '',
          errorMsg: null
        };
      }
    },
    render: function (ctx) {
      var st = ctx.tableState;
      var lineMode = (ctx.settings.ioMode === 'line');
      st.fEditor.lineMode = lineMode;
      st.gEditor.lineMode = lineMode;

      if (st.step === 'f') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Nhập hàm số f(x):</div>' +
            '<div class="lcd-expr-line"><b>f(x) = </b>' + CalcEditor.renderHTML(st.fEditor, true) + '</div>' +
            '<div class="lcd-sub-hint">Bấm = để tiếp tục</div>' +
          '</div>'
        );
      }
      if (st.step === 'g') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Nhập hàm số g(x) (để trống nếu chỉ tính f(x)):</div>' +
            '<div class="lcd-expr-line"><b>g(x) = </b>' + CalcEditor.renderHTML(st.gEditor, true) + '</div>' +
            '<div class="lcd-sub-hint">Bấm = để tiếp tục</div>' +
          '</div>'
        );
      }
      if (st.step === 'range') {
        var fields = [
          ['Bắt đầu (Start):', st.startStr],
          ['Kết thúc (End):', st.endStr],
          ['Bước nhảy (Step):', st.stepStr]
        ];
        var rHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Phạm vi bảng giá trị (tối đa 45 dòng):</div>';
        for (var i = 0; i < 3; i++) {
          var cls = (i === st.rangeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          rHtml += '<div class="' + cls + '" data-action="tbl-range" data-idx="' + i + '">' +
            escapeHtml(fields[i][0]) + ' <b>' + escapeHtml(fields[i][1]) + '</b>' +
            (i === st.rangeIdx ? '<span class="m-cursor"></span>' : '') +
          '</div>';
        }
        if (st.errorMsg) {
          rHtml += '<div class="lcd-error">' + escapeHtml(st.errorMsg) + '</div>';
        }
        rHtml += '</div>';
        return rHtml;
      }

      // Xem bảng kết quả
      var hasG = ctx.settings.tableTwoFuncs && !CalcEditor.isEmpty(st.gEditor);
      var fmt = ctx.getFormatOpts();
      var html = '<div class="lcd-table-wrap">';
      html += '<table class="lcd-grid"><thead><tr><th>#</th><th>x</th><th>f(x)</th>';
      if (hasG) html += '<th>g(x)</th>';
      html += '</tr></thead><tbody>';

      for (var r = 0; r < st.rows.length; r++) {
        var row = st.rows[r];
        var fDisp = (typeof row.f === 'number') ? CalcEngine.format(row.f, fmt) : String(row.f);
        var gDisp = (typeof row.g === 'number') ? CalcEngine.format(row.g, fmt) : String(row.g || '');
        html += '<tr><td class="lcd-grid-idx">' + (r + 1) + '</td>';
        html += '<td class="' + (r === st.selRow && st.selCol === 0 ? 'sel' : '') + '" data-action="tbl-cell" data-r="' + r + '" data-c="0">' + escapeHtml(CalcEngine.format(row.x, fmt)) + '</td>';
        html += '<td class="' + (r === st.selRow && st.selCol === 1 ? 'sel' : '') + '" data-action="tbl-cell" data-r="' + r + '" data-c="1">' + escapeHtml(fDisp) + '</td>';
        if (hasG) {
          html += '<td class="' + (r === st.selRow && st.selCol === 2 ? 'sel' : '') + '" data-action="tbl-cell" data-r="' + r + '" data-c="2">' + escapeHtml(gDisp) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      var curRow = st.rows[st.selRow];
      var fullVal = '';
      if (st.editXStr !== '') {
        fullVal = 'x = ' + st.editXStr;
      } else if (curRow) {
        var rawV = st.selCol === 0 ? curRow.x : (st.selCol === 1 ? curRow.f : curRow.g);
        if (typeof rawV === 'number') {
          var ex = CalcEngine.toExact(rawV);
          fullVal = ex ? (ex + ' ≈ ' + CalcEngine.format(rawV, fmt)) : CalcEngine.format(rawV, fmt);
        } else {
          fullVal = String(rawV);
        }
      }
      html += '<div class="lcd-cell-edit">Giá trị: <b>' + escapeHtml(fullVal) + '</b> (Gõ số để đổi x, AC sửa hàm)</div>';
      html += '</div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.tableState;
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'f' || st.step === 'g') {
        var ed = (st.step === 'f') ? st.fEditor : st.gEditor;
        if (key === 'AC') { CalcEditor.clear(ed); return; }
        if (key === 'DEL') { CalcEditor.deleteBack(ed); return; }
        if (key === 'LEFT') { CalcEditor.moveLeft(ed); return; }
        if (key === 'RIGHT') { CalcEditor.moveRight(ed); return; }
        if (key === 'UP') { CalcEditor.moveUp(ed); return; }
        if (key === 'DOWN') { CalcEditor.moveDown(ed); return; }
        if (key === '=' || key === 'OK') {
          if (st.step === 'f') {
            if (CalcEditor.isEmpty(st.fEditor)) return;
            st.step = ctx.settings.tableTwoFuncs ? 'g' : 'range';
            st.rangeIdx = 0;
            st.errorMsg = null;
          } else {
            st.step = 'range';
            st.rangeIdx = 0;
            st.errorMsg = null;
          }
          return;
        }
        calcApp.insertByKey(ed, key);
        return;
      }

      if (st.step === 'range') {
        st.errorMsg = null;
        var props = ['startStr', 'endStr', 'stepStr'];
        var curProp = props[st.rangeIdx];
        if (key === 'AC') { st.step = 'f'; return; }
        if (key === 'UP' && st.rangeIdx > 0) { st.rangeIdx--; return; }
        if (key === 'DOWN' && st.rangeIdx < 2) { st.rangeIdx++; return; }
        if (key === 'DEL') {
          st[curProp] = st[curProp].slice(0, -1);
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.rangeIdx < 2) {
            st.rangeIdx++;
          } else {
            this.buildTable(ctx);
          }
          return;
        }
        var ch = mapKeyToCellChar(key);
        if (ch) st[curProp] += ch;
        return;
      }

      // Đang ở chế độ xem bảng
      var hasG = ctx.settings.tableTwoFuncs && !CalcEditor.isEmpty(st.gEditor);
      var maxCol = hasG ? 2 : 1;
      if (key === 'AC') {
        if (st.editXStr !== '') st.editXStr = '';
        else st.step = 'f';
        return;
      }
      if (key === 'UP') {
        this.commitCustomX(ctx);
        if (st.selRow > 0) st.selRow--;
        return;
      }
      if (key === 'DOWN') {
        this.commitCustomX(ctx);
        if (st.selRow < st.rows.length - 1) st.selRow++;
        return;
      }
      if (key === 'LEFT') {
        this.commitCustomX(ctx);
        if (st.selCol > 0) st.selCol--;
        return;
      }
      if (key === 'RIGHT') {
        this.commitCustomX(ctx);
        if (st.selCol < maxCol) st.selCol++;
        return;
      }
      if (key === 'DEL') {
        st.editXStr = st.editXStr.slice(0, -1);
        return;
      }
      if (key === '=' || key === 'OK') {
        this.commitCustomX(ctx);
        if (st.selRow < st.rows.length - 1) st.selRow++;
        return;
      }
      var chX = mapKeyToCellChar(key);
      if (chX) {
        st.selCol = 0;
        st.editXStr += chX;
      }
    },
    buildTable: function (ctx) {
      var st = ctx.tableState;
      var sVal = evalCellInput(st.startStr, ctx, 1);
      var eVal = evalCellInput(st.endStr, ctx, 5);
      var stepVal = evalCellInput(st.stepStr, ctx, 1);
      var fStr = CalcEditor.toEvalText(st.fEditor);
      var gStr = ctx.settings.tableTwoFuncs ? CalcEditor.toEvalText(st.gEditor) : null;
      var tbl = CalcEngine.table(fStr, gStr, sVal, eVal, stepVal, ctx.getEvalOpts());
      if (tbl.error) {
        st.errorMsg = tbl.error;
        return;
      }
      st.rows = tbl;
      st.selRow = 0;
      st.selCol = 0;
      st.editXStr = '';
      st.step = 'view';
    },
    commitCustomX: function (ctx) {
      var st = ctx.tableState;
      if (st.editXStr === '') return;
      var newX = evalCellInput(st.editXStr, ctx, NaN);
      st.editXStr = '';
      if (isNaN(newX) || !st.rows[st.selRow]) return;
      var fStr = CalcEditor.toEvalText(st.fEditor);
      var gStr = ctx.settings.tableTwoFuncs ? CalcEditor.toEvalText(st.gEditor) : null;
      var single = CalcEngine.table(fStr, gStr, newX, newX, 1, ctx.getEvalOpts());
      if (Array.isArray(single) && single[0]) {
        st.rows[st.selRow] = single[0];
      }
    }
  });

  // =========================================================================
  // A. ỨNG DỤNG PHƯƠNG TRÌNH / HỆ PHƯƠNG TRÌNH (eq)
  // =========================================================================
  CalcApps.register({
    id: 'eq',
    code: 'A',
    name: 'Phương trình/Hệ',
    icon: 'x=?',
    stage: 1,
    init: function (ctx) {
      if (!ctx.eqState) {
        ctx.eqState = {
          step: 'main', // 'main' | 'size' | 'coeffs' | 'result'
          mode: 'poly', // 'sys' | 'poly'
          size: 2, // 2, 3, 4
          polyCoeffs: [1, -3, 2, 0, 0],
          sysCoeffs: [
            [1, 1, 0, 0, 3],
            [1, -1, 0, 0, 1],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0]
          ],
          rIdx: 0,
          cIdx: 0,
          editStr: '',
          resItems: [], // [{ label, exact, decimal }]
          resIdx: 0,
          showDecimal: false
        };
      }
    },
    render: function (ctx) {
      var st = ctx.eqState;
      if (st.step === 'main') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Chọn loại phương trình:</div>' +
            '<div class="lcd-list-item ' + (st.mode === 'sys' ? 'active' : '') + '" data-action="eq-mode" data-mode="sys">1. Hệ phương trình tuyến tính</div>' +
            '<div class="lcd-list-item ' + (st.mode === 'poly' ? 'active' : '') + '" data-action="eq-mode" data-mode="poly">2. Phương trình đa thức</div>' +
          '</div>'
        );
      }

      if (st.step === 'size') {
        var title = st.mode === 'sys' ? 'Chọn số ẩn (2–4):' : 'Chọn bậc đa thức (2–4):';
        var sHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' + title + '</div>';
        for (var n = 2; n <= 4; n++) {
          var cls = (st.size === n) ? 'lcd-list-item active' : 'lcd-list-item';
          var desc = st.mode === 'sys' ? (n + ' ẩn') : ('Bậc ' + n);
          sHtml += '<div class="' + cls + '" data-action="eq-size" data-n="' + n + '">' + n + '. ' + desc + '</div>';
        }
        sHtml += '</div>';
        return sHtml;
      }

      if (st.step === 'result') {
        var item = st.resItems[st.resIdx] || { label: '', exact: '', decimal: '' };
        var valHtml = (!st.showDecimal && item.exact)
          ? CalcEditor.renderResultHTML(item.exact, ctx.settings.ioMode === 'line')
          : escapeHtml(item.decimal);
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">' +
              'Nghiệm (' + (st.resIdx + 1) + '/' + st.resItems.length + ') — Bấm = / ▲▼ xem tiếp, S⇔D đổi dạng:' +
            '</div>' +
            '<div class="lcd-expr-line"><b>' + escapeHtml(item.label) + '</b></div>' +
            '<div class="lcd-res-line">' + valHtml + '</div>' +
          '</div>'
        );
      }

      // Nhập hệ số
      var fmt = ctx.getFormatOpts();
      if (st.mode === 'poly') {
        var deg = st.size;
        var labels = deg === 2 ? ['x²', 'x', 'c'] : (deg === 3 ? ['x³', 'x²', 'x', 'd'] : ['x⁴', 'x³', 'x²', 'x', 'e']);
        var pHtml = '<div class="lcd-table-wrap">';
        pHtml += '<div class="lcd-table-bar"><span>Đa thức bậc ' + deg + ' (= 0)</span>' +
                 '<span class="lcd-inline-btn" data-action="eq-solve-btn">[Giải =]</span></div>';
        pHtml += '<table class="lcd-grid"><thead><tr>';
        for (var i = 0; i <= deg; i++) pHtml += '<th>' + labels[i] + '</th>';
        pHtml += '</tr></thead><tbody><tr>';
        for (var j = 0; j <= deg; j++) {
          var sel = (j === st.cIdx);
          pHtml += '<td class="' + (sel ? 'sel' : '') + '" data-action="eq-cell" data-r="0" data-c="' + j + '">' +
                   escapeHtml(CalcEngine.format(st.polyCoeffs[j], fmt)) + '</td>';
        }
        pHtml += '</tr></tbody></table>';
        var curP = st.editStr !== '' ? st.editStr : String(st.polyCoeffs[st.cIdx]);
        pHtml += '<div class="lcd-cell-edit">Hệ số ' + labels[st.cIdx] + ': <b>' + escapeHtml(curP) + '</b><span class="m-cursor"></span></div>';
        pHtml += '</div>';
        return pHtml;
      }

      // Hệ phương trình n ẩn
      var nSys = st.size;
      var vNames = ['x', 'y', 'z', 't'];
      var hSys = '<div class="lcd-table-wrap">';
      hSys += '<div class="lcd-table-bar"><span>Hệ ' + nSys + ' ẩn</span>' +
              '<span class="lcd-inline-btn" data-action="eq-solve-btn">[Giải =]</span></div>';
      hSys += '<table class="lcd-grid"><thead><tr>';
      for (var c = 0; c < nSys; c++) hSys += '<th>' + vNames[c] + '</th>';
      hSys += '<th>= c</th></tr></thead><tbody>';
      for (var r = 0; r < nSys; r++) {
        hSys += '<tr>';
        for (var c2 = 0; c2 <= nSys; c2++) {
          var idxActual = (c2 === nSys) ? 4 : c2;
          var isSel = (r === st.rIdx && c2 === st.cIdx);
          hSys += '<td class="' + (isSel ? 'sel' : '') + '" data-action="eq-cell" data-r="' + r + '" data-c="' + c2 + '">' +
                  escapeHtml(CalcEngine.format(st.sysCoeffs[r][idxActual], fmt)) + '</td>';
        }
        hSys += '</tr>';
      }
      hSys += '</tbody></table>';
      var curAct = (st.cIdx === nSys) ? 4 : st.cIdx;
      var curS = st.editStr !== '' ? st.editStr : String(st.sysCoeffs[st.rIdx][curAct]);
      hSys += '<div class="lcd-cell-edit">Ô (' + (st.rIdx + 1) + ',' + (st.cIdx + 1) + '): <b>' + escapeHtml(curS) + '</b><span class="m-cursor"></span></div>';
      hSys += '</div>';
      return hSys;
    },
    onKey: function (key, ctx) {
      var st = ctx.eqState;
      if (st.step === 'main') {
        if (key === 'UP' || key === 'DOWN') { st.mode = (st.mode === 'sys') ? 'poly' : 'sys'; return; }
        if (key === '1') { st.mode = 'sys'; st.step = 'size'; return; }
        if (key === '2') { st.mode = 'poly'; st.step = 'size'; return; }
        if (key === '=' || key === 'OK') { st.step = 'size'; return; }
        return;
      }
      if (st.step === 'size') {
        if (key === 'AC') { st.step = 'main'; return; }
        if (key === 'UP') { st.size = st.size > 2 ? st.size - 1 : 4; return; }
        if (key === 'DOWN') { st.size = st.size < 4 ? st.size + 1 : 2; return; }
        if (key === '2' || key === '3' || key === '4') {
          st.size = parseInt(key, 10);
          st.step = 'coeffs';
          st.rIdx = 0; st.cIdx = 0; st.editStr = '';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.step = 'coeffs';
          st.rIdx = 0; st.cIdx = 0; st.editStr = '';
          return;
        }
        return;
      }
      if (st.step === 'result') {
        if (key === 'AC') { st.step = 'coeffs'; return; }
        if (key === 'S_D') { st.showDecimal = !st.showDecimal; return; }
        if (key === 'UP') { st.resIdx = (st.resIdx + st.resItems.length - 1) % st.resItems.length; return; }
        if (key === 'DOWN' || key === '=' || key === 'OK') {
          st.resIdx = (st.resIdx + 1) % st.resItems.length;
          return;
        }
        return;
      }

      // Đang ở màn nhập hệ số
      var maxR = st.mode === 'poly' ? 0 : st.size - 1;
      var maxC = st.size;
      if (key === 'AC') {
        if (st.editStr !== '') st.editStr = '';
        else st.step = 'main';
        return;
      }
      if (key === 'DEL') {
        st.editStr = st.editStr.slice(0, -1);
        return;
      }
      if (key === 'LEFT') {
        this.commitEqCell(ctx);
        if (st.cIdx > 0) st.cIdx--;
        else if (st.rIdx > 0) { st.rIdx--; st.cIdx = maxC; }
        return;
      }
      if (key === 'RIGHT') {
        this.commitEqCell(ctx);
        if (st.cIdx < maxC) st.cIdx++;
        else if (st.rIdx < maxR) { st.rIdx++; st.cIdx = 0; }
        return;
      }
      if (key === 'UP' && st.rIdx > 0) {
        this.commitEqCell(ctx);
        st.rIdx--;
        return;
      }
      if (key === 'DOWN' && st.rIdx < maxR) {
        this.commitEqCell(ctx);
        st.rIdx++;
        return;
      }
      if (key === '=' || key === 'OK') {
        var hadEdit = (st.editStr !== '');
        this.commitEqCell(ctx);
        if (st.cIdx < maxC) {
          st.cIdx++;
        } else if (st.rIdx < maxR) {
          st.rIdx++;
          st.cIdx = 0;
        } else if (!hadEdit || (st.rIdx === maxR && st.cIdx === maxC)) {
          this.solveEqNow(ctx);
        }
        return;
      }
      var ch = mapKeyToCellChar(key);
      if (ch) st.editStr += ch;
    },
    commitEqCell: function (ctx) {
      var st = ctx.eqState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (isNaN(v)) return;
      if (st.mode === 'poly') {
        st.polyCoeffs[st.cIdx] = v;
      } else {
        var act = (st.cIdx === st.size) ? 4 : st.cIdx;
        st.sysCoeffs[st.rIdx][act] = v;
      }
    },
    solveEqNow: function (ctx) {
      var st = ctx.eqState;
      this.commitEqCell(ctx);
      var fmt = ctx.getFormatOpts();
      st.resItems = [];
      st.resIdx = 0;
      st.showDecimal = false;

      if (st.mode === 'poly') {
        var cfs = st.polyCoeffs.slice(0, st.size + 1);
        var pRes = CalcEngine.solvePoly(cfs);
        if (pRes.error) {
          st.resItems.push({ label: 'Thông báo:', exact: null, decimal: pRes.error });
        } else {
          for (var i = 0; i < pRes.roots.length; i++) {
            var rt = pRes.roots[i];
            var lbl = pRes.roots.length === 1 ? 'x =' : ('x' + (i + 1) + ' =');
            var dec = Math.abs(rt.im) < 1e-10
              ? CalcEngine.format(rt.re, fmt)
              : (CalcEngine.format(rt.re, fmt) + (rt.im >= 0 ? '+' : '') + CalcEngine.format(rt.im, fmt) + 'i');
            st.resItems.push({ label: lbl, exact: rt.exact, decimal: dec });
          }
          if (pRes.extremum) {
            var minOrMax = cfs[0] > 0 ? 'Cực tiểu' : 'Cực đại';
            st.resItems.push({
              label: minOrMax + ' của hàm số: x =',
              exact: pRes.extremum.xExact,
              decimal: CalcEngine.format(pRes.extremum.x, fmt)
            });
            st.resItems.push({
              label: minOrMax + ' của hàm số: y =',
              exact: pRes.extremum.yExact,
              decimal: CalcEngine.format(pRes.extremum.y, fmt)
            });
          }
        }
      } else {
        var n = st.size;
        var A = [], b = [];
        for (var r = 0; r < n; r++) {
          A.push(st.sysCoeffs[r].slice(0, n));
          b.push(st.sysCoeffs[r][4]);
        }
        var sRes = CalcEngine.solveLinear(A, b);
        if (sRes.error) {
          st.resItems.push({ label: 'Kết quả:', exact: null, decimal: sRes.error });
        } else {
          var vNames = ['x =', 'y =', 'z =', 't ='];
          for (var k = 0; k < n; k++) {
            st.resItems.push({
              label: vNames[k],
              exact: sRes.exact[k],
              decimal: CalcEngine.format(sRes.solution[k], fmt)
            });
          }
        }
      }
      st.step = 'result';
    }
  });

  // =========================================================================
  // B. ỨNG DỤNG BẤT PHƯƠNG TRÌNH (ineq)
  // =========================================================================
  var INEQ_OPS = ['>', '<', '>=', '<='];
  var INEQ_LABELS = ['> 0', '< 0', '≥ 0', '≤ 0'];

  CalcApps.register({
    id: 'ineq',
    code: 'B',
    name: 'Bất phương trình',
    icon: 'x>0',
    stage: 1,
    init: function (ctx) {
      if (!ctx.ineqState) {
        ctx.ineqState = {
          step: 'deg', // 'deg' | 'op' | 'coeffs' | 'result'
          deg: 2,
          opIdx: 0,
          coeffs: [1, -3, 2, 0, 0],
          cIdx: 0,
          editStr: '',
          resText: ''
        };
      }
    },
    render: function (ctx) {
      var st = ctx.ineqState;
      if (st.step === 'deg') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn bậc bất phương trình (2–4):</div>';
        for (var d = 2; d <= 4; d++) {
          var cls = (st.deg === d) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="ineq-deg" data-deg="' + d + '">' + (d - 1) + '. Đa thức bậc ' + d + '</div>';
        }
        html += '</div>';
        return html;
      }

      if (st.step === 'op') {
        var polyStr = st.deg === 2 ? 'ax² + bx + c ' : (st.deg === 3 ? 'ax³ + bx² + cx + d ' : 'ax⁴ + bx³ + cx² + dx + e ');
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Chọn chiều bất phương trình:</div>';
        for (var i = 0; i < 4; i++) {
          var oCls = (st.opIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + oCls + '" data-action="ineq-op" data-idx="' + i + '">' + (i + 1) + '. ' + polyStr + INEQ_LABELS[i] + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'result') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Tập nghiệm bất phương trình:</div>' +
            '<div class="lcd-res-line">' + escapeHtml(st.resText) + '</div>' +
            '<div class="lcd-sub-hint">Bấm = hoặc AC để quay lại sửa hệ số</div>' +
          '</div>'
        );
      }

      // Nhập hệ số
      var deg = st.deg;
      var fmt = ctx.getFormatOpts();
      var labels = deg === 2 ? ['a (x²)', 'b (x)', 'c'] : (deg === 3 ? ['a (x³)', 'b (x²)', 'c (x)', 'd'] : ['a (x⁴)', 'b (x³)', 'c (x²)', 'd (x)', 'e']);
      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>BPT bậc ' + deg + ' (' + INEQ_LABELS[st.opIdx] + ')</span>' +
               '<span class="lcd-inline-btn" data-action="ineq-solve-btn">[Giải =]</span></div>';
      cHtml += '<table class="lcd-grid"><thead><tr>';
      for (var j = 0; j <= deg; j++) cHtml += '<th>' + labels[j] + '</th>';
      cHtml += '</tr></thead><tbody><tr>';
      for (var k = 0; k <= deg; k++) {
        cHtml += '<td class="' + (k === st.cIdx ? 'sel' : '') + '" data-action="ineq-cell" data-c="' + k + '">' +
                 escapeHtml(CalcEngine.format(st.coeffs[k], fmt)) + '</td>';
      }
      cHtml += '</tr></tbody></table>';
      var curC = st.editStr !== '' ? st.editStr : String(st.coeffs[st.cIdx]);
      cHtml += '<div class="lcd-cell-edit">Hệ số ' + labels[st.cIdx] + ': <b>' + escapeHtml(curC) + '</b><span class="m-cursor"></span></div>';
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.ineqState;
      if (st.step === 'deg') {
        if (key === 'UP') { st.deg = st.deg > 2 ? st.deg - 1 : 4; return; }
        if (key === 'DOWN') { st.deg = st.deg < 4 ? st.deg + 1 : 2; return; }
        if (key === '1' || key === '2' || key === '3') {
          st.deg = parseInt(key, 10) + 1;
          st.step = 'op';
          return;
        }
        if (key === '=' || key === 'OK') { st.step = 'op'; return; }
        return;
      }
      if (st.step === 'op') {
        if (key === 'AC') { st.step = 'deg'; return; }
        if (key === 'UP') { st.opIdx = (st.opIdx + 3) % 4; return; }
        if (key === 'DOWN') { st.opIdx = (st.opIdx + 1) % 4; return; }
        var nOp = parseInt(key, 10);
        if (nOp >= 1 && nOp <= 4) {
          st.opIdx = nOp - 1;
          st.step = 'coeffs';
          st.cIdx = 0; st.editStr = '';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.step = 'coeffs';
          st.cIdx = 0; st.editStr = '';
          return;
        }
        return;
      }
      if (st.step === 'result') {
        if (key === 'AC' || key === '=' || key === 'OK') {
          st.step = 'coeffs';
        }
        return;
      }

      if (key === 'AC') {
        if (st.editStr !== '') st.editStr = '';
        else st.step = 'op';
        return;
      }
      if (key === 'DEL') {
        st.editStr = st.editStr.slice(0, -1);
        return;
      }
      if (key === 'LEFT' && st.cIdx > 0) {
        this.commitIneqCell(ctx);
        st.cIdx--;
        return;
      }
      if (key === 'RIGHT' && st.cIdx < st.deg) {
        this.commitIneqCell(ctx);
        st.cIdx++;
        return;
      }
      if (key === '=' || key === 'OK') {
        var hadEdit = (st.editStr !== '');
        this.commitIneqCell(ctx);
        if (st.cIdx < st.deg) {
          st.cIdx++;
        } else if (!hadEdit || st.cIdx === st.deg) {
          this.solveIneqNow(ctx);
        }
        return;
      }
      var ch = mapKeyToCellChar(key);
      if (ch) st.editStr += ch;
    },
    commitIneqCell: function (ctx) {
      var st = ctx.ineqState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (!isNaN(v)) st.coeffs[st.cIdx] = v;
    },
    solveIneqNow: function (ctx) {
      var st = ctx.ineqState;
      this.commitIneqCell(ctx);
      var cfs = st.coeffs.slice(0, st.deg + 1);
      var res = CalcEngine.solveIneq(cfs, INEQ_OPS[st.opIdx]);
      st.resText = res.text;
      st.step = 'result';
    }
  });

  // =========================================================================
  // C. ỨNG DỤNG TỈ LỆ THỨC (ratio)
  // =========================================================================
  CalcApps.register({
    id: 'ratio',
    code: 'C',
    name: 'Tỉ lệ thức',
    icon: 'A:B',
    stage: 1,
    init: function (ctx) {
      if (!ctx.ratioState) {
        ctx.ratioState = {
          step: 'type', // 'type' | 'input' | 'result'
          type: 1, // 1: A:B = X:D, 2: A:B = C:X
          vals: [2, 3, 6],
          idx: 0,
          editStr: '',
          resVal: 4,
          showDecimal: false
        };
      }
    },
    render: function (ctx) {
      var st = ctx.ratioState;
      if (st.step === 'type') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-title">Chọn dạng tỉ lệ thức:</div>' +
            '<div class="lcd-list-item ' + (st.type === 1 ? 'active' : '') + '" data-action="ratio-type" data-type="1">1. A : B = X : D (Tìm X)</div>' +
            '<div class="lcd-list-item ' + (st.type === 2 ? 'active' : '') + '" data-action="ratio-type" data-type="2">2. A : B = C : X (Tìm X)</div>' +
          '</div>'
        );
      }

      var fmt = ctx.getFormatOpts();
      if (st.step === 'result') {
        var ex = CalcEngine.toExact(st.resVal);
        var dec = CalcEngine.format(st.resVal, fmt);
        var vHtml = (!st.showDecimal && ex) ? CalcEditor.renderResultHTML(ex, ctx.settings.ioMode === 'line') : escapeHtml(dec);
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">' + (st.type === 1 ? 'A : B = X : D' : 'A : B = C : X') + ' — Kết quả (S⇔D đổi dạng):</div>' +
            '<div class="lcd-expr-line"><b>X =</b></div>' +
            '<div class="lcd-res-line">' + vHtml + '</div>' +
          '</div>'
        );
      }

      var names = st.type === 1 ? ['A', 'B', 'D'] : ['A', 'B', 'C'];
      var html = '<div class="lcd-table-wrap">';
      html += '<div class="lcd-table-bar"><span>' + (st.type === 1 ? 'A : B = X : D' : 'A : B = C : X') + '</span>' +
              '<span class="lcd-inline-btn" data-action="ratio-solve-btn">[Tính X =]</span></div>';
      html += '<table class="lcd-grid"><thead><tr>';
      for (var i = 0; i < 3; i++) html += '<th>' + names[i] + '</th>';
      html += '</tr></thead><tbody><tr>';
      for (var j = 0; j < 3; j++) {
        html += '<td class="' + (j === st.idx ? 'sel' : '') + '" data-action="ratio-cell" data-c="' + j + '">' +
                escapeHtml(CalcEngine.format(st.vals[j], fmt)) + '</td>';
      }
      html += '</tr></tbody></table>';
      var cur = st.editStr !== '' ? st.editStr : String(st.vals[st.idx]);
      html += '<div class="lcd-cell-edit">' + names[st.idx] + ' = <b>' + escapeHtml(cur) + '</b><span class="m-cursor"></span></div>';
      html += '</div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.ratioState;
      if (st.step === 'type') {
        if (key === 'UP' || key === 'DOWN') { st.type = st.type === 1 ? 2 : 1; return; }
        if (key === '1' || key === '2') { st.type = parseInt(key, 10); st.step = 'input'; st.idx = 0; st.editStr = ''; return; }
        if (key === '=' || key === 'OK') { st.step = 'input'; st.idx = 0; st.editStr = ''; return; }
        return;
      }
      if (st.step === 'result') {
        if (key === 'S_D') { st.showDecimal = !st.showDecimal; return; }
        if (key === 'AC' || key === '=' || key === 'OK') { st.step = 'input'; return; }
        return;
      }

      if (key === 'AC') {
        if (st.editStr !== '') st.editStr = '';
        else st.step = 'type';
        return;
      }
      if (key === 'DEL') { st.editStr = st.editStr.slice(0, -1); return; }
      if (key === 'LEFT' && st.idx > 0) { this.commitRatioCell(ctx); st.idx--; return; }
      if (key === 'RIGHT' && st.idx < 2) { this.commitRatioCell(ctx); st.idx++; return; }
      if (key === '=' || key === 'OK') {
        var hadEdit = (st.editStr !== '');
        this.commitRatioCell(ctx);
        if (st.idx < 2) {
          st.idx++;
        } else if (!hadEdit || st.idx === 2) {
          this.solveRatioNow(ctx);
        }
        return;
      }
      var ch = mapKeyToCellChar(key);
      if (ch) st.editStr += ch;
    },
    commitRatioCell: function (ctx) {
      var st = ctx.ratioState;
      if (st.editStr === '') return;
      var v = evalCellInput(st.editStr, ctx, NaN);
      st.editStr = '';
      if (!isNaN(v)) st.vals[st.idx] = v;
    },
    solveRatioNow: function (ctx) {
      var st = ctx.ratioState;
      this.commitRatioCell(ctx);
      st.resVal = CalcEngine.ratio(st.type, st.vals[0], st.vals[1], st.vals[2]);
      st.showDecimal = false;
      st.step = 'result';
    }
  });

  // Đăng ký mục D, E (Chỉ có ở Kiểu B, Giai đoạn 2)
  registerStage2App('mathbox', 'D', 'Hộp toán học', '🎲', true);
  registerStage2App('algo', 'E', 'Thuật toán', '{}', true);

})(this);
