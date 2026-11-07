/* Hệ thống mô-đun ứng dụng cho Máy tính Thầy Minh (ES5 thuần — hỗ trợ Máy 880 & Máy 580) */
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

  CalcApps.getVisibleApps = function (machineId) {
    var mId = (machineId === '580' || machineId === 'a') ? '580' : '880';
    if (root.CalcMachines && root.CalcMachines[mId] && root.CalcMachines[mId].apps) {
      return root.CalcMachines[mId].apps;
    }
    return CalcApps.registry;
  };

  // Chuyển phím bấm thành ký tự cho ô nhập bảng (hỗ trợ số, phân số, căn, pi)
  function mapKeyToCellChar(key) {
    var m = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '.': '.', '+': '+', '-': '-', '(-)': '-', '*': '*', '/': '/',
      'FRAC': '/', 'SQRT': 'sqrt(', '(': '(', ')': ')', 'PI': 'pi', 'E_CONST': 'e'
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

  // =========================================================================
  // 1. ỨNG DỤNG TÍNH TOÁN (calc — Calculate)
  // =========================================================================
  CalcApps.register({
    id: 'calc',
    code: '1',
    name: 'Calculate',
    viName: 'Tính toán',
    icon: '±×÷',
    stage: 1,
    init: function (ctx) {
      if (!ctx.calcState) {
        ctx.calcState = {
          editor: CalcEditor.create(ctx.settings.ioMode === 'line'),
          hasResult: false,
          lastExprText: '',
          lastResult: null,
          displayStyle: 'auto', // 'auto'|'exact'|'decimal'|'recurring'|'mixed'|'improper'|'dms'|'fact'|'eng'
          formatConverted: false, // Đánh dấu vừa chuyển đổi bằng FORMAT trên máy 880 (bấm EXE để hủy)
          engShift: 0,
          engInteractive: false,
          history: [],
          historyIdx: -1,
          promptMode: null, // null | 'calc' | 'solve' | 'sto'
          promptVars: [],
          promptVarIdx: 0,
          promptInput: '',
          solveInfo: null, // { x, lr, varName }
          multiQueue: null, // Danh sách câu lệnh phân tách bởi ':' trên máy 580
          multiIdx: 0,
          lastVerifyRightExpr: '' // Vế phải của phép Verify vừa thực hiện (để nối tiếp)
        };
      }
      ctx.calcState.editor.lineMode = (ctx.settings.ioMode === 'line');
    },
    render: function (ctx) {
      var st = ctx.calcState;
      st.editor.lineMode = (ctx.settings.ioMode === 'line');

      // Chế độ hỏi biến (CALC trên máy 580)
      if (st.promptMode === 'calc') {
        var vName = st.promptVars[st.promptVarIdx];
        var curVal = ctx.vars[vName] || 0;
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-prompt-box">' +
              '<div class="lcd-prompt-title"><b>' + escapeHtml(vName) + '?</b> (hiện tại: ' + CalcEngine.format(curVal, ctx.getFormatOpts()) + ')</div>' +
              '<div class="lcd-prompt-input">' + escapeHtml(st.promptInput) + '<span class="m-cursor"></span></div>' +
            '</div>' +
          '</div>'
        );
      }

      // Chế độ hỏi giá trị ban đầu SOLVE trên máy 580
      if (st.promptMode === 'solve') {
        var sVar = st.solveTargetVar || 'x';
        var curX = ctx.vars[sVar] || 0;
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-prompt-box">' +
              '<div class="lcd-prompt-title"><b>' + escapeHtml(sVar) + ' =</b></div>' +
              '<div class="lcd-prompt-input">' + escapeHtml(st.promptInput !== '' ? st.promptInput : String(curX)) + '<span class="m-cursor"></span></div>' +
            '</div>' +
          '</div>'
        );
      }

      // Hiển thị kết quả SOLVE
      if (st.solveInfo) {
        var sInfo = st.solveInfo;
        var vLbl = sInfo.varName || 'x';
        var xDisp = CalcEngine.format(sInfo.x, ctx.getFormatOpts());
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-line">' + CalcEditor.renderHTML(st.editor, false) + '</div>' +
            '<div class="lcd-solve-res">' +
              '<div><b>' + escapeHtml(vLbl) + ' = </b>' + escapeHtml(xDisp) + '</div>' +
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
      if (st.multiQueue && st.multiIdx < st.multiQueue.length - 1) {
        histHint = '<span class="lcd-hist-ind lcd-disp-ind">Disp ▲</span>';
      }
      if (st.engInteractive) {
        histHint = '<span class="lcd-hist-ind">◀ ENG ▶</span>';
      }

      if (st.hasResult && st.lastResult) {
        var r = st.lastResult;
        if (!r.ok) {
          resHtml = '<div class="lcd-error">' + escapeHtml(r.error || 'Math ERROR') + '</div>';
        } else if (r.isVerify) {
          resHtml = '<div class="lcd-verify-res">' + escapeHtml(r.verifyText) + '</div>';
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

      // Đang ở chế độ điều chỉnh số mũ kỹ thuật ENG bằng ◀ / ▶ trên máy 880
      if (st.engInteractive) {
        if (key === 'LEFT') {
          st.engShift -= 1;
          return;
        }
        if (key === 'RIGHT') {
          st.engShift += 1;
          return;
        }
        if (key === '=' || key === 'OK' || key === 'BACK' || key === 'AC') {
          st.engInteractive = false;
          return;
        }
        st.engInteractive = false;
      }

      // Đang hiển thị câu lệnh trung gian của đa câu lệnh ':' trên máy 580
      if (st.multiQueue && st.multiIdx < st.multiQueue.length - 1) {
        if (key === '=' || key === 'OK') {
          st.multiIdx++;
          this.evalSingleStatementFromQueue(ctx);
          return;
        }
        if (key === 'AC') {
          st.multiQueue = null;
          CalcEditor.clear(st.editor);
          st.hasResult = false;
          st.lastResult = null;
          return;
        }
        st.multiQueue = null;
      }

      // Đang hiển thị kết quả SOLVE
      if (st.solveInfo) {
        st.solveInfo = null;
        if (key === 'AC' || key === 'OK' || key === '=' || key === 'BACK') {
          return;
        }
      }

      // Đang chờ chọn phím biến sau khi bấm STO trên máy 580
      if (st.promptMode === 'sto') {
        st.promptMode = null;
        ctx.setStatusHint('');
        var varMap = {
          'VAR_A': 'A', '(-)': 'A',
          'VAR_B': 'B', 'DMS': 'B',
          'VAR_C': 'C', 'INV': 'C', 'HYP': 'C',
          'VAR_D': 'D', 'sin': 'D',
          'VAR_E': 'E', 'cos': 'E',
          'VAR_F': 'F', 'tan': 'F',
          'VAR_x': 'x', '(': 'x', 'x': 'x',
          'VAR_y': 'y', ')': 'y',
          'VAR_z': 'z', 'S_D': 'z',
          'VAR_M': 'M', 'M+': 'M'
        };
        var targetVar = varMap[key];
        if (targetVar) {
          this.evaluateAndStore(ctx, targetVar);
          return;
        }
      }

      // Đang nhập giá trị biến cho CALC hoặc SOLVE
      if (st.promptMode === 'calc' || st.promptMode === 'solve') {
        this.handlePromptKey(key, ctx);
        return;
      }

      if (key === 'AC') {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        st.historyIdx = -1;
        st.formatConverted = false;
        st.multiQueue = null;
        return;
      }

      if (key === 'DEL' || key === 'BACK') {
        if (st.hasResult) {
          if (st.formatConverted) {
            st.displayStyle = 'auto';
            st.formatConverted = false;
            return;
          }
          st.hasResult = false;
          return;
        }
        if (key === 'DEL') {
          CalcEditor.deleteBack(st.editor);
        }
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

      if (key === 'UP' || key === 'PAGE_UP') {
        if (!st.hasResult && key === 'UP' && CalcEditor.moveUp(st.editor)) {
          return;
        }
        if (st.history.length > 0) {
          if (st.historyIdx === -1) st.historyIdx = st.history.length - 1;
          else if (st.historyIdx > 0) st.historyIdx--;
          this.loadHistoryItem(st, st.historyIdx);
        }
        return;
      }

      if (key === 'DOWN' || key === 'PAGE_DOWN') {
        if (!st.hasResult && key === 'DOWN' && CalcEditor.moveDown(st.editor)) {
          return;
        }
        if (st.history.length > 0 && st.historyIdx !== -1 && st.historyIdx < st.history.length - 1) {
          st.historyIdx++;
          this.loadHistoryItem(st, st.historyIdx);
        }
        return;
      }

      if (key === '=' || key === 'OK' || key === 'APPROX_EQ') {
        // Trên máy 880: nếu vừa đổi định dạng bằng FORMAT, bấm EXE lần nữa sẽ hủy chuyển đổi về mặc định
        if (st.hasResult && st.formatConverted && key !== 'APPROX_EQ') {
          st.displayStyle = 'auto';
          st.formatConverted = false;
          return;
        }
        this.executeEval(ctx, key === 'APPROX_EQ');
        return;
      }

      if (key === 'S_D') {
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
          this.cycleSD(st);
        }
        return;
      }

      if (key === 'MIXED_SD') {
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
          st.displayStyle = (st.displayStyle === 'mixed') ? 'improper' : 'mixed';
        }
        return;
      }

      if (key === 'FACT' || key === 'DMS_CONV') {
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
          if (key === 'FACT') {
            st.displayStyle = (st.displayStyle === 'fact') ? 'auto' : 'fact';
          } else {
            st.displayStyle = (st.displayStyle === 'dms') ? 'auto' : 'dms';
          }
        }
        return;
      }

      if (key === 'DMS') {
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
          st.displayStyle = (st.displayStyle === 'dms') ? 'auto' : 'dms';
          return;
        }
        CalcEditor.insertToken(st.editor, '°', '°');
        return;
      }

      if (key === 'ENG' || key === 'ENG_BACK') {
        if (st.hasResult && st.lastResult && st.lastResult.ok && !st.lastResult.isVerify) {
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
        ctx.setStatusHint('STO');
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
        st.solveTargetVar = 'x';
        st.promptInput = '';
        return;
      }

      // Nếu vừa tính xong (hasResult = true) và bấm phím nhập mới
      if (st.hasResult) {
        var isRelKey = (
          key === 'EQUAL_SIGN' || key === 'REL_EQ' || key === 'REL_NEQ' ||
          key === 'REL_GT' || key === 'REL_LT' || key === 'REL_GE' || key === 'REL_LE'
        );
        // Trong chế độ Verify: nếu bấm toán tử quan hệ ngay sau kết quả True/False, lấy vế phải làm vế trái mới
        if (ctx.verifyMode && st.lastResult && st.lastResult.isVerify && isRelKey && st.lastVerifyRightExpr) {
          CalcEditor.clear(st.editor);
          st.hasResult = false;
          st.lastResult = null;
          CalcEditor.insertTextString(st.editor, st.lastVerifyRightExpr);
          this.insertByKey(st.editor, key);
          return;
        }

        var isContOp = (
          key === '+' || key === '-' || key === '*' || key === '/' ||
          key === 'POW' || key === 'SQ' || key === 'CUBE' || key === 'INV' ||
          key === 'FACTORIAL' || key === 'DIV_R' || key === 'NPR' || key === 'NCR'
        );
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastResult = null;
        st.formatConverted = false;
        if (isContOp && !ctx.verifyMode) {
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        } else {
          if (ctx.onNewExpressionAfterEqual) ctx.onNewExpressionAfterEqual();
        }
      }

      this.insertByKey(st.editor, key);
    },

    insertByKey: function (ed, key) {
      // Các mẫu toán học 2D
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
      if (key === 'RECUR') { CalcEditor.insertTemplate(ed, 'recur'); return; }

      var tokenMap = {
        '0': ['0', '0'], '1': ['1', '1'], '2': ['2', '2'], '3': ['3', '3'], '4': ['4', '4'],
        '5': ['5', '5'], '6': ['6', '6'], '7': ['7', '7'], '8': ['8', '8'], '9': ['9', '9'],
        '.': ['.', '.'],
        '+': ['+', '+'], '-': ['−', '-'], '(-)': ['-', '-'],
        '*': ['×', '*'], '/': ['÷', '/'],
        '(': ['(', '('], ')': [')', ')'], ',': [',', ','],
        'COLON': [':', ':'],
        'PERCENT': ['%', '%'],
        'SQ': ['²', '²'], 'CUBE': ['³', '³'], 'INV': ['⁻¹', '⁻¹'],
        'FACTORIAL': ['!', '!'],
        'sin': ['sin(', 'sin('], 'cos': ['cos(', 'cos('], 'tan': ['tan(', 'tan('],
        'asin': ['sin⁻¹(', 'asin('], 'acos': ['cos⁻¹(', 'acos('], 'atan': ['tan⁻¹(', 'atan('],
        'sinh': ['sinh(', 'sinh('], 'cosh': ['cosh(', 'cosh('], 'tanh': ['tanh(', 'tanh('],
        'asinh': ['sinh⁻¹(', 'asinh('], 'acosh': ['cosh⁻¹(', 'acosh('], 'atanh': ['tanh⁻¹(', 'atanh('],
        'log': ['log(', 'log('], 'ln': ['ln(', 'ln('],
        'EXP10': ['×10^', 'E'],
        'PI': ['π', 'pi'], 'E_CONST': ['e', 'e'],
        'ANS': ['Ans', 'Ans'], 'PREANS': ['PreAns', 'PreAns'],
        'x': ['x', 'x'], 'VAR_x': ['x', 'x'], 'VAR_y': ['y', 'y'], 'VAR_z': ['z', 'z'],
        'VAR_A': ['A', 'A'], 'VAR_B': ['B', 'B'], 'VAR_C': ['C', 'C'],
        'VAR_D': ['D', 'D'], 'VAR_E': ['E', 'E'], 'VAR_F': ['F', 'F'], 'VAR_M': ['M', 'M'],
        'NPR': ['P', 'nPr'], 'NCR': ['C', 'nCr'],
        'POL': ['Pol(', 'Pol('], 'REC': ['Rec(', 'Rec('],
        'DIV_R': ['÷R', '÷R'],
        'RAN': ['Ran#', 'ran#'], 'RANINT': ['RanInt#(', 'ranint('],
        'GCD_FN': ['GCD(', 'gcd('], 'LCM_FN': ['LCM(', 'lcm('],
        'INT_FN': ['Int(', 'int('], 'INTG_FN': ['Intg(', 'intg('], 'RND_FN': ['Rnd(', 'round('],
        'FUNC_F': ['f(', 'f('], 'FUNC_G': ['g(', 'g('], 'ATWT': ['AtWt(', 'AtWt('],
        'EQUAL_SIGN': ['=', '='], 'REL_EQ': ['=', '='], 'REL_NEQ': ['≠', '≠'],
        'REL_GT': ['>', '>'], 'REL_LT': ['<', '<'], 'REL_GE': ['≥', '≥'], 'REL_LE': ['≤', '≤'],
        'ANG_DEG': ['°', '°'], 'ANG_RAD': ['ʳ', 'ʳ'], 'ANG_GRA': ['ᵍ', 'ᵍ'],
        'ENG_m': ['m', 'm'], 'ENG_u': ['μ', 'μ'], 'ENG_n': ['n', 'n'], 'ENG_p': ['p', 'p'], 'ENG_f': ['f', 'f'],
        'ENG_k': ['k', 'k'], 'ENG_M': ['M', 'M'], 'ENG_G': ['G', 'G'], 'ENG_T': ['T', 'T'],
        'ENG_P': ['P', 'P'], 'ENG_E': ['E', 'E']
      };
      if (tokenMap[key]) {
        CalcEditor.insertToken(ed, tokenMap[key][0], tokenMap[key][1]);
      }
    },

    handlePromptKey: function (key, ctx) {
      var st = ctx.calcState;
      if (key === 'AC' || key === 'BACK') {
        st.promptMode = null;
        return;
      }
      if (key === 'DEL') {
        st.promptInput = st.promptInput.slice(0, -1);
        return;
      }
      if (key === '=' || key === 'OK') {
        var vName = st.promptMode === 'calc' ? st.promptVars[st.promptVarIdx] : (st.solveTargetVar || 'x');
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
          var opts = ctx.getEvalOpts();
          opts.targetVar = vName;
          var sol = CalcEngine.solveNumeric(exprStr, val, opts);
          if (sol.error) {
            st.hasResult = true;
            st.lastResult = { ok: false, error: sol.error };
          } else {
            ctx.vars[vName] = sol.x;
            ctx.vars.Ans = sol.x;
            ctx.saveState();
            st.solveInfo = { x: sol.x, lr: sol.lr, varName: vName };
            ctx.notifyParentResult(exprStr, sol.x, CalcEngine.format(sol.x, ctx.getFormatOpts()));
          }
        }
        return;
      }

      var ch = mapKeyToCellChar(key);
      if (ch) {
        st.promptInput += ch;
      }
    },

    executeEval: function (ctx, forceDecimal) {
      var st = ctx.calcState;
      var exprText = CalcEditor.toEvalText(st.editor);
      if (!exprText.replace(/\s+/g, '')) return;

      // Tiền xử lý độ-phút-giây kiểu 12°30°0° -> dms(12,30,0)
      var normText = exprText.replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°?/g, 'dms($1,$2,$3)')
        .replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°/g, 'dms($1,$2,0)');

      // Chế độ Verify (trên máy 880 khi bật TOOLS > Verify ON)
      if (ctx.verifyMode) {
        var vRes = CalcEngine.verify(normText, ctx.getEvalOpts());
        st.hasResult = true;
        st.lastExprText = exprText;
        if (!vRes.ok) {
          st.lastResult = { ok: false, error: vRes.error || 'Syntax ERROR' };
        } else {
          var vStr = vRes.result ? 'True' : 'False';
          st.lastResult = { ok: true, isVerify: true, verifyText: vStr, value: vRes.result ? 1 : 0 };
          var parts = normText.split(/<=|>=|!=|≠|≤|≥|=|<|>/);
          if (parts.length >= 2) {
            st.lastVerifyRightExpr = parts[parts.length - 1].replace(/^\s+|\s+$/g, '');
          }
          ctx.notifyParentResult(exprText, vRes.result ? 1 : 0, vStr);
        }
        return;
      }

      // Kiểm tra đa câu lệnh ':' trên máy 580
      var stmts = CalcEngine.splitMultiStatements(normText);
      if (stmts.length > 1) {
        st.multiQueue = stmts;
        st.multiIdx = 0;
        this.evalSingleStatementFromQueue(ctx);
        return;
      }

      this.evalSingleStatement(ctx, normText, exprText, forceDecimal);
    },

    evalSingleStatementFromQueue: function (ctx) {
      var st = ctx.calcState;
      var stmt = st.multiQueue[st.multiIdx];
      this.evalSingleStatement(ctx, stmt, stmt, false);
    },

    evalSingleStatement: function (ctx, normText, rawExprText, forceDecimal) {
      var st = ctx.calcState;
      var assignVar = null;
      var evalPart = normText;
      var mAssign = normText.match(/^([A-Fx-zM])\s*=\s*(.+)$/);
      if (mAssign) {
        assignVar = mAssign[1];
        evalPart = mAssign[2];
      }

      var res = CalcEngine.evalText(evalPart, ctx.getEvalOpts());
      st.hasResult = true;
      st.lastExprText = rawExprText;
      st.formatConverted = false;
      st.engInteractive = false;

      if (res.ok) {
        res.recurring = CalcEngine.toRecurring(res.value);
        ctx.vars.PreAns = ctx.vars.Ans;
        ctx.vars.Ans = res.value;
        if (assignVar) {
          ctx.vars[assignVar] = res.value;
        }
        ctx.saveState();
        st.displayStyle = forceDecimal ? 'decimal' : 'auto';
        st.engShift = 0;

        st.history.push({
          editorClone: CalcEditor.cloneState(st.editor),
          exprText: rawExprText,
          result: res
        });
        if (st.history.length > 30) st.history.shift();
        st.historyIdx = st.history.length - 1;
        st.lastResult = res;

        var shownStr = getPlainResultString(st, ctx);
        ctx.notifyParentResult(rawExprText, res.value, shownStr);
      } else {
        st.lastResult = res;
      }
    },

    evaluateAndStore: function (ctx, varName) {
      var st = ctx.calcState;
      if (!st.hasResult && !CalcEditor.isEmpty(st.editor)) {
        this.executeEval(ctx, false);
      } else if (!st.hasResult && CalcEditor.isEmpty(st.editor)) {
        CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        this.executeEval(ctx, false);
      }
      if (st.lastResult && st.lastResult.ok) {
        ctx.vars[varName] = st.lastResult.value;
        ctx.saveState();
        ctx.setStatusHint(varName + ' = ' + (st.lastResult.exact || st.lastResult.decimal));
      }
    },

    handleMemoryAdd: function (ctx, sign) {
      var st = ctx.calcState;
      if (!st.hasResult) {
        if (CalcEditor.isEmpty(st.editor)) {
          CalcEditor.insertToken(st.editor, 'Ans', 'Ans');
        }
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
      st.formatConverted = false;
    },

    cycleSD: function (st) {
      var r = st.lastResult;
      if (!r || !r.ok) return;
      var cur = st.displayStyle;
      if (cur === 'auto' || cur === 'exact' || cur === 'improper' || cur === 'mixed' || cur === 'dms' || cur === 'fact' || cur === 'eng') {
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
    },

    applyFormatOption: function (ctx, optId) {
      var st = ctx.calcState;
      if (!st || !st.hasResult || !st.lastResult || !st.lastResult.ok) return;
      st.formatConverted = true;
      st.engInteractive = false;
      if (optId === 'standard') st.displayStyle = 'exact';
      else if (optId === 'decimal') st.displayStyle = 'decimal';
      else if (optId === 'improper') st.displayStyle = 'improper';
      else if (optId === 'mixed') st.displayStyle = 'mixed';
      else if (optId === 'eng') {
        st.displayStyle = 'eng';
        st.engShift = 0;
        st.engInteractive = true;
      } else if (optId === 'sexagesimal') st.displayStyle = 'dms';
      else if (optId === 'prime') st.displayStyle = 'fact';
    }
  });

  function getPlainResultString(st, ctx) {
    var r = st.lastResult;
    if (!r || !r.ok) return 'Lỗi';
    if (r.isVerify) return r.verifyText;
    var style = st.displayStyle;
    var decStr = CalcEngine.format(r.value, ctx.getFormatOpts());
    if (style === 'decimal') return decStr;
    if (style === 'recurring' && r.recurring) return r.recurring;
    if (style === 'dms') return CalcEngine.toDMS(r.value);
    if (style === 'fact') return CalcEngine.factorize(r.value);
    if (style === 'eng') return CalcEngine.toEng(r.value, st.engShift);
    if (style === 'improper') {
      return r.exact || decStr;
    }
    if (style === 'mixed' || (style === 'auto' && ctx.settings.fracMode === 'mixed')) {
      if (r.exact && r.exact.indexOf('/') !== -1 && r.exact.indexOf('√') === -1 && r.exact.indexOf('π') === -1) {
        return CalcEngine.toMixed(r.value);
      }
    }
    if (style === 'auto' && ctx.settings.ioMode === 'math_dec') {
      return decStr;
    }
    return r.exact || decStr;
  }

  function formatCalcResultHTML(st, ctx) {
    var r = st.lastResult;
    var lineMode = (ctx.settings.ioMode === 'line');
    if (r.extra && Array.isArray(r.extra)) {
      if (st.lastExprText.indexOf('÷R') !== -1) {
        return (
          '<div class="lcd-extra-res">' +
            escapeHtml(String(r.extra[0])) + ', R=' + escapeHtml(String(r.extra[1])) +
          '</div>'
        );
      }
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

  // =========================================================================
  // B (580). ỨNG DỤNG KIỂM CHỨNG ĐẲNG THỨC / BẤT ĐẲNG THỨC (verify — Máy 580)
  // =========================================================================
  var VERIFY_OPTN_ITEMS = [
    { label: '1: =', text: '=', evalText: '=' },
    { label: '2: ≠', text: '≠', evalText: '≠' },
    { label: '3: >', text: '>', evalText: '>' },
    { label: '4: <', text: '<', evalText: '<' },
    { label: '5: ≥', text: '≥', evalText: '≥' },
    { label: '6: ≤', text: '≤', evalText: '≤' }
  ];

  CalcApps.register({
    id: 'verify',
    code: 'B',
    name: 'Verify',
    viName: 'Kiểm chứng',
    icon: 'TRUE',
    stage: 1,
    init: function (ctx) {
      if (!ctx.verifyAppState) {
        ctx.verifyAppState = {
          editor: CalcEditor.create(ctx.settings.ioMode === 'line'),
          hasResult: false,
          lastRes: null, // { ok, result, error }
          lastRightExpr: '',
          step: 'edit', // 'edit' | 'optn'
          optnIdx: 0
        };
      }
      ctx.verifyAppState.editor.lineMode = (ctx.settings.ioMode === 'line');
      ctx.verifyAppState.step = 'edit';
    },
    openOptn: function (ctx) {
      var st = ctx.verifyAppState;
      st.step = (st.step === 'optn') ? 'edit' : 'optn';
      st.optnIdx = 0;
      return true;
    },
    render: function (ctx) {
      var st = ctx.verifyAppState;
      st.editor.lineMode = (ctx.settings.ioMode === 'line');

      if (st.step === 'optn') {
        var html = '<div class="lcd-menu-list">';
        for (var i = 0; i < VERIFY_OPTN_ITEMS.length; i++) {
          var cls = (i === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="verify-optn" data-idx="' + i + '">' +
                  escapeHtml(VERIFY_OPTN_ITEMS[i].label) + '</div>';
        }
        html += '</div>';
        return html;
      }

      var exprHtml = CalcEditor.renderHTML(st.editor, !st.hasResult);
      var resHtml = '';
      if (st.hasResult && st.lastRes) {
        if (!st.lastRes.ok) {
          resHtml = '<div class="lcd-error">' + escapeHtml(st.lastRes.error || 'Syntax ERROR') + '</div>';
        } else {
          resHtml = '<div class="lcd-verify-res">' + (st.lastRes.result ? 'TRUE' : 'FALSE') + '</div>';
        }
      }
      return (
        '<div class="lcd-calc">' +
          '<div class="lcd-expr-line">' + exprHtml + '</div>' +
          '<div class="lcd-res-line">' + resHtml + '</div>' +
        '</div>'
      );
    },
    onKey: function (key, ctx) {
      var st = ctx.verifyAppState;
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'optn') {
        if (key === 'AC' || key === 'BACK') { st.step = 'edit'; return; }
        if (key === 'UP') { st.optnIdx = (st.optnIdx + 5) % 6; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % 6; return; }
        var nKey = parseInt(key, 10);
        if (nKey >= 1 && nKey <= 6) {
          this.pickVerifyOp(st, nKey - 1);
          return;
        }
        if (key === '=' || key === 'OK') {
          this.pickVerifyOp(st, st.optnIdx);
          return;
        }
        return;
      }

      if (key === 'AC') {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        st.lastRes = null;
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
      if (key === 'UP') { CalcEditor.moveUp(st.editor); return; }
      if (key === 'DOWN') { CalcEditor.moveDown(st.editor); return; }

      if (key === '=' || key === 'OK') {
        var exprText = CalcEditor.toEvalText(st.editor);
        if (!exprText.replace(/\s+/g, '')) return;
        var vRes = CalcEngine.verify(exprText, ctx.getEvalOpts());
        st.hasResult = true;
        st.lastRes = vRes;
        if (vRes.ok) {
          var parts = exprText.split(/<=|>=|!=|≠|≤|≥|=|<|>/);
          if (parts.length >= 2) {
            st.lastRightExpr = parts[parts.length - 1].replace(/^\s+|\s+$/g, '');
          }
          ctx.notifyParentResult(exprText, vRes.result ? 1 : 0, vRes.result ? 'TRUE' : 'FALSE');
        }
        return;
      }

      var isRelKey = (
        key === 'EQUAL_SIGN' || key === 'REL_EQ' || key === 'REL_NEQ' ||
        key === 'REL_GT' || key === 'REL_LT' || key === 'REL_GE' || key === 'REL_LE'
      );
      if (st.hasResult) {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        if (isRelKey && st.lastRightExpr) {
          CalcEditor.insertTextString(st.editor, st.lastRightExpr);
        }
      }
      calcApp.insertByKey(st.editor, key);
    },
    pickVerifyOp: function (st, idx) {
      var item = VERIFY_OPTN_ITEMS[idx];
      st.step = 'edit';
      if (!item) return;
      if (st.hasResult) {
        CalcEditor.clear(st.editor);
        st.hasResult = false;
        if (st.lastRightExpr) {
          CalcEditor.insertTextString(st.editor, st.lastRightExpr);
        }
      }
      CalcEditor.insertToken(st.editor, item.text, item.evalText);
    }
  });

  // =========================================================================
  // 6. ỨNG DỤNG THỐNG KÊ (stat — Statistics)
  // =========================================================================
  var STAT_TYPES_580 = [
    { key: '1var', label: '1:1-Variable' },
    { key: 'lin', label: '2:y=a+bx' },
    { key: 'quad', label: '3:y=a+bx+cx²' },
    { key: 'log', label: '4:y=a+b·ln(x)' },
    { key: 'exp', label: '5:y=a·e^(bx)' },
    { key: 'abexp', label: '6:y=a·b^x' },
    { key: 'pow', label: '7:y=a·x^b' },
    { key: 'inv', label: '8:y=a+b/x' }
  ];

  var STAT_TYPES_880 = [
    { key: '1var', label: '1-Variable' },
    { key: 'lin', label: '2-Variable (y=a+bx)' },
    { key: 'quad', label: 'y=a+bx+cx²' },
    { key: 'log', label: 'y=a+b·ln(x)' },
    { key: 'exp', label: 'y=a·e^(bx)' },
    { key: 'abexp', label: 'y=a·b^x' },
    { key: 'pow', label: 'y=a·x^b' },
    { key: 'inv', label: 'y=a+b/x' }
  ];

  CalcApps.register({
    id: 'stat',
    code: '6',
    name: 'Statistics',
    viName: 'Thống kê',
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
          estTarget: 'y',
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
      var is880 = (ctx.machineId === '880');
      var typeList = is880 ? STAT_TYPES_880 : STAT_TYPES_580;

      if (st.step === 'type') {
        var html = '<div class="lcd-menu-list"><div class="lcd-list-title">' +
                   (is880 ? 'Statistics — Select Type' : 'Select Type') + '</div>';
        for (var i = 0; i < typeList.length; i++) {
          var cls = (i === st.typeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          html += '<div class="' + cls + '" data-action="stat-type" data-idx="' + i + '">' + escapeHtml(typeList[i].label) + '</div>';
        }
        html += '</div>';
        return html;
      }

      if (st.step === 'optn') {
        var is1Var = (st.statType === '1var');
        var opts = is1Var
          ? [
              is880 ? '1-Var Results' : '1:1-Variable Calc',
              is880 ? 'Data' : '2:Data',
              is880 ? 'Select Type' : '3:Select Type',
              is880 ? 'Delete All' : '4:Delete All'
            ]
          : [
              is880 ? '2-Var / Reg Results' : '1:2-Variable / Reg Calc',
              is880 ? 'Estimate (ŷ, x̂)' : '2:Regression Estimate (ŷ, x̂)',
              is880 ? 'Data' : '3:Data',
              is880 ? 'Select Type' : '4:Select Type'
            ];
        var oHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Statistics Menu</div>';
        for (var j = 0; j < opts.length; j++) {
          var oCls = (j === st.optnIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          oHtml += '<div class="' + oCls + '" data-action="stat-optn" data-idx="' + j + '">' + escapeHtml(opts[j]) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'result') {
        var rHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">' +
                    (st.statType === '1var' ? '1-Var Results' : '2-Var / Reg Results') + '</div>';
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
            '<div class="lcd-list-title">Regression (' + escapeHtml(st.statType) + ') — ◀▶ ŷ/x̂</div>' +
            '<div class="lcd-prompt-box">' +
              '<div><b>' + (st.estTarget === 'y' ? 'Find ŷ from x' : 'Find x̂ from y') + '</b></div>' +
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

      var hasY = (st.statType !== '1var');
      var hasFreq = !!ctx.settings.statFreq;
      var tHtml = '<div class="lcd-table-wrap">';
      tHtml += '<div class="lcd-table-bar"><span>' + escapeHtml(st.statType === '1var' ? '1-Variable' : '2-Variable') + '</span>' +
               '<span class="lcd-inline-btn" data-action="stat-calc-btn">' + (is880 ? '[EXE: Calc]' : '[OPTN: Calc]') + '</span></div>';
      tHtml += '<table class="lcd-grid"><thead><tr><th>#</th><th>x</th>';
      if (hasY) tHtml += '<th>y</th>';
      if (hasFreq) tHtml += '<th>Freq</th>';
      tHtml += '</tr></thead><tbody>';

      var totalRows = st.rows.length + 1;
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
      tHtml += '<div class="lcd-cell-edit"><b>' + escapeHtml(curCellVal) + '</b><span class="m-cursor"></span></div>';
      tHtml += '</div>';
      return tHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.statState;
      if (st.step === 'type') {
        if (key === 'UP') { st.typeIdx = (st.typeIdx + STAT_TYPES_580.length - 1) % STAT_TYPES_580.length; return; }
        if (key === 'DOWN') { st.typeIdx = (st.typeIdx + 1) % STAT_TYPES_580.length; return; }
        var numIdx = parseInt(key, 10);
        if (ctx.machineId === '580' && numIdx >= 1 && numIdx <= STAT_TYPES_580.length) {
          st.typeIdx = numIdx - 1;
          st.statType = STAT_TYPES_580[st.typeIdx].key;
          st.step = 'table';
          st.rowIdx = 0; st.colIdx = 0; st.editingStr = '';
          return;
        }
        if (key === '=' || key === 'OK') {
          st.statType = STAT_TYPES_580[st.typeIdx].key;
          st.step = 'table';
          st.rowIdx = 0; st.colIdx = 0; st.editingStr = '';
          return;
        }
        return;
      }

      if (st.step === 'optn') {
        var maxOpt = 4;
        if (key === 'UP') { st.optnIdx = (st.optnIdx + maxOpt - 1) % maxOpt; return; }
        if (key === 'DOWN') { st.optnIdx = (st.optnIdx + 1) % maxOpt; return; }
        if (key === 'AC' || key === 'BACK') { st.step = 'table'; return; }
        var oNum = parseInt(key, 10);
        if (ctx.machineId === '580' && oNum >= 1 && oNum <= maxOpt) {
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
        if (key === 'AC' || key === 'BACK' || key === '=' || key === 'OK') { st.step = 'table'; return; }
        return;
      }

      if (st.step === 'estimate') {
        if (key === 'AC' || key === 'BACK') { st.step = 'table'; return; }
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
        if (chEst) st.estInput += chEst;
        return;
      }

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
      if (key === 'BACK') {
        st.step = 'type';
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
        if (st.editingStr === '' && ctx.machineId === '880' && key === '=') {
          st.step = 'optn';
          st.optnIdx = 0;
          return;
        }
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
            'x̄ = ' + CalcEngine.format(r1.mean, fmt),
            'Σx = ' + CalcEngine.format(r1.sumx, fmt),
            'Σx² = ' + CalcEngine.format(r1.sumx2, fmt),
            'σx = ' + CalcEngine.format(r1.sigma, fmt),
            'sx = ' + CalcEngine.format(r1.s, fmt),
            'n = ' + r1.n,
            'min(x) = ' + CalcEngine.format(r1.min, fmt),
            'Q1 = ' + CalcEngine.format(r1.q1, fmt),
            'Med = ' + CalcEngine.format(r1.med, fmt),
            'Q3 = ' + CalcEngine.format(r1.q3, fmt),
            'max(x) = ' + CalcEngine.format(r1.max, fmt)
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
          st.resultLines.push('x̄ = ' + CalcEngine.format(r2.meanx, fmt));
          st.resultLines.push('Σx = ' + CalcEngine.format(r2.sumx, fmt));
          st.resultLines.push('σx = ' + CalcEngine.format(r2.sigmax, fmt));
          st.resultLines.push('sx = ' + CalcEngine.format(r2.sx, fmt));
          st.resultLines.push('ȳ = ' + CalcEngine.format(r2.meany, fmt));
          st.resultLines.push('Σy = ' + CalcEngine.format(r2.sumy, fmt));
          st.resultLines.push('σy = ' + CalcEngine.format(r2.sigmay, fmt));
          st.resultLines.push('sy = ' + CalcEngine.format(r2.sy, fmt));
          st.resultLines.push('Σxy = ' + CalcEngine.format(r2.sumxy, fmt));
          st.resultLines.push('n = ' + r2.n);
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
        st.estOutput = 'Syntax ERROR';
        return;
      }
      var outVal = (st.estTarget === 'y') ? r2.estY(inVal) : r2.estX(inVal);
      st.estOutput = CalcEngine.format(outVal, ctx.getFormatOpts());
    }
  });

  // =========================================================================
  // 8/9. ỨNG DỤNG BẢNG GIÁ TRỊ HÀM SỐ (table — Table)
  // =========================================================================
  CalcApps.register({
    id: 'table',
    code: '8',
    name: 'Table',
    viName: 'Bảng giá trị',
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
          rangeIdx: 0, // 0: start, 1: end, 2: step, 3: Execute (880)
          rows: [],
          selRow: 0,
          selCol: 0,
          editXStr: '',
          errorMsg: null
        };
        if (CalcEngine.defineFunc) {
          CalcEngine.defineFunc('f', 'x²');
        }
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
            '<div class="lcd-list-title">Define f(x)</div>' +
            '<div class="lcd-expr-line"><b>f(x) = </b>' + CalcEditor.renderHTML(st.fEditor, true) + '</div>' +
          '</div>'
        );
      }
      if (st.step === 'g') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Define g(x)</div>' +
            '<div class="lcd-expr-line"><b>g(x) = </b>' + CalcEditor.renderHTML(st.gEditor, true) + '</div>' +
          '</div>'
        );
      }
      if (st.step === 'range') {
        var fields = [
          ['Start :', st.startStr],
          ['End   :', st.endStr],
          ['Step  :', st.stepStr]
        ];
        var rHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Table Range</div>';
        for (var i = 0; i < 3; i++) {
          var cls = (i === st.rangeIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          rHtml += '<div class="' + cls + '" data-action="tbl-range" data-idx="' + i + '">' +
            '<span>' + escapeHtml(fields[i][0]) + '</span><b>' + escapeHtml(fields[i][1]) +
            (i === st.rangeIdx ? '▏' : '') + '</b></div>';
        }
        if (ctx.machineId === '880') {
          var exCls = (st.rangeIdx === 3) ? 'lcd-list-item active' : 'lcd-list-item';
          rHtml += '<div class="' + exCls + '" data-action="tbl-exec"><span>Execute</span><b>▶</b></div>';
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
      if (ctx.machineId === '880') {
        html += '<div class="lcd-table-bar"><span>Table</span>' +
                '<span class="lcd-inline-btn" data-action="tbl-open-range">[Range]</span></div>';
      }
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
      html += '<div class="lcd-cell-edit"><b>' + escapeHtml(fullVal) + '</b></div>';
      html += '</div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.tableState;
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'f' || st.step === 'g') {
        var ed = (st.step === 'f') ? st.fEditor : st.gEditor;
        if (key === 'AC') { CalcEditor.clear(ed); return; }
        if (key === 'BACK') {
          if (st.rows.length > 0) st.step = 'view';
          else if (st.step === 'g') st.step = 'f';
          return;
        }
        if (key === 'DEL') { CalcEditor.deleteBack(ed); return; }
        if (key === 'LEFT') { CalcEditor.moveLeft(ed); return; }
        if (key === 'RIGHT') { CalcEditor.moveRight(ed); return; }
        if (key === 'UP') { CalcEditor.moveUp(ed); return; }
        if (key === 'DOWN') { CalcEditor.moveDown(ed); return; }
        if (key === '=' || key === 'OK') {
          if (st.step === 'f') {
            var fTxt = CalcEditor.toEvalText(st.fEditor);
            if (!fTxt.replace(/\s+/g, '')) return;
            if (CalcEngine.defineFunc) CalcEngine.defineFunc('f', fTxt);
            st.step = ctx.settings.tableTwoFuncs ? 'g' : 'range';
            st.rangeIdx = 0;
            st.errorMsg = null;
          } else {
            var gTxt = CalcEditor.toEvalText(st.gEditor);
            if (CalcEngine.defineFunc) CalcEngine.defineFunc('g', gTxt);
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
        var maxIdx = ctx.machineId === '880' ? 3 : 2;
        var props = ['startStr', 'endStr', 'stepStr'];
        var curProp = props[st.rangeIdx];
        if (key === 'AC' || key === 'BACK') { st.step = 'f'; return; }
        if (key === 'UP' && st.rangeIdx > 0) { st.rangeIdx--; return; }
        if (key === 'DOWN' && st.rangeIdx < maxIdx) { st.rangeIdx++; return; }
        if (key === 'DEL' && curProp) {
          st[curProp] = st[curProp].slice(0, -1);
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.rangeIdx < 2) {
            st.rangeIdx++;
          } else if (ctx.machineId === '880' && st.rangeIdx === 2) {
            st.rangeIdx = 3;
          } else {
            this.buildTable(ctx);
          }
          return;
        }
        var ch = mapKeyToCellChar(key);
        if (ch && curProp) st[curProp] += ch;
        return;
      }

      var hasG = ctx.settings.tableTwoFuncs && !CalcEditor.isEmpty(st.gEditor);
      var maxCol = hasG ? 2 : 1;
      if (key === 'AC' || key === 'BACK') {
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
        if (st.editXStr !== '') {
          st.editXStr = st.editXStr.slice(0, -1);
        } else if (st.rows.length > 1) {
          st.rows.splice(st.selRow, 1);
          if (st.selRow >= st.rows.length) st.selRow = st.rows.length - 1;
        }
        return;
      }
      if (key === '=' || key === 'OK') {
        if (st.rows.length === 0) {
          st.step = 'range';
          return;
        }
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
      if (CalcEngine.defineFunc) {
        CalcEngine.defineFunc('f', fStr);
        if (gStr) CalcEngine.defineFunc('g', gStr);
      }
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
      if (isNaN(newX)) return;
      var fStr = CalcEditor.toEvalText(st.fEditor);
      var gStr = ctx.settings.tableTwoFuncs ? CalcEditor.toEvalText(st.gEditor) : null;
      var single = CalcEngine.table(fStr, gStr, newX, newX, 1, ctx.getEvalOpts());
      if (Array.isArray(single) && single[0]) {
        if (st.rows[st.selRow]) st.rows[st.selRow] = single[0];
        else st.rows.push(single[0]);
      }
    }
  });

  // =========================================================================
  // 9 / A. ỨNG DỤNG PHƯƠNG TRÌNH / HỆ PHƯƠNG TRÌNH / SOLVER (eq — Equation)
  // =========================================================================
  var SOLVER_VARS = ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F'];

  CalcApps.register({
    id: 'eq',
    code: '9',
    name: 'Equation',
    viName: 'Phương trình',
    icon: 'x=?',
    stage: 1,
    init: function (ctx) {
      if (!ctx.eqState) {
        var sEd = CalcEditor.create(false);
        CalcEditor.insertToken(sEd, '2', '2');
        CalcEditor.insertToken(sEd, 'x', 'x');
        CalcEditor.insertToken(sEd, '+', '+');
        CalcEditor.insertToken(sEd, '1', '1');
        CalcEditor.insertToken(sEd, '=', '=');
        CalcEditor.insertToken(sEd, '5', '5');
        ctx.eqState = {
          step: 'main', // 'main'|'size'|'coeffs'|'result'|'solver_eq'|'solver_target'|'solver_init'|'solver_res'
          mainIdx: 0, // 0: Simul Equation, 1: Polynomial, 2: Solver (880 only)
          mode: 'sys', // 'sys' | 'poly' | 'solver'
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
          resItems: [],
          resIdx: 0,
          showDecimal: false,
          solverEditor: sEd,
          solverTargetIdx: 0,
          solverTargetVar: 'x',
          solverInitStr: '0',
          solverFocus: 0, // 0: giá trị đầu, 1: Execute
          solverResult: null // { x, lr, error }
        };
      }
    },
    render: function (ctx) {
      var st = ctx.eqState;
      var is880 = (ctx.machineId === '880');

      if (st.step === 'main') {
        if (is880) {
          var items880 = [
            { m: 'sys', lbl: 'Simul Equation' },
            { m: 'poly', lbl: 'Polynomial' },
            { m: 'solver', lbl: 'Solver' }
          ];
          var h880 = '<div class="lcd-menu-list">';
          for (var i = 0; i < items880.length; i++) {
            var cls = (st.mainIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
            h880 += '<div class="' + cls + '" data-action="eq-mode" data-mode="' + items880[i].m + '">' +
                    escapeHtml(items880[i].lbl) + '</div>';
          }
          h880 += '</div>';
          return h880;
        }
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-item ' + (st.mode === 'sys' ? 'active' : '') + '" data-action="eq-mode" data-mode="sys">1:Simul Equation</div>' +
            '<div class="lcd-list-item ' + (st.mode === 'poly' ? 'active' : '') + '" data-action="eq-mode" data-mode="poly">2:Polynomial</div>' +
          '</div>'
        );
      }

      if (st.step === 'size') {
        if (is880) {
          var sHtml880 = '<div class="lcd-menu-list"><div class="lcd-list-title">' +
                         (st.mode === 'sys' ? 'Simul Equation' : 'Polynomial') + '</div>';
          var polyLbls = { 2: 'ax²+bx+c', 3: 'ax³+bx²+cx+d', 4: 'ax⁴+bx³+cx²+dx+e' };
          for (var n = 2; n <= 4; n++) {
            var cls880 = (st.size === n) ? 'lcd-list-item active' : 'lcd-list-item';
            var desc880 = st.mode === 'sys' ? (n + ' Unknowns') : polyLbls[n];
            sHtml880 += '<div class="' + cls880 + '" data-action="eq-size" data-n="' + n + '">' + escapeHtml(desc880) + '</div>';
          }
          sHtml880 += '</div>';
          return sHtml880;
        }
        var title580 = st.mode === 'sys' ? 'Number of Unknowns?' : 'Polynomial Degree?';
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">' + title580 + '</div>' +
            '<div class="lcd-prompt-box" style="text-align:center;padding:12px 0;font-weight:700;">Select 2~4</div>' +
          '</div>'
        );
      }

      // Các màn hình của Solver trên máy 880
      if (st.step === 'solver_eq') {
        st.solverEditor.lineMode = (ctx.settings.ioMode === 'line');
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Input Equation</div>' +
            '<div class="lcd-expr-line">' + CalcEditor.renderHTML(st.solverEditor, true) + '</div>' +
          '</div>'
        );
      }

      if (st.step === 'solver_target') {
        var tHtml = '<div class="lcd-menu-list"><div class="lcd-list-title">Solve Target</div>';
        for (var vIdx = 0; vIdx < SOLVER_VARS.length; vIdx++) {
          var vCls = (vIdx === st.solverTargetIdx) ? 'lcd-list-item active' : 'lcd-list-item';
          tHtml += '<div class="' + vCls + '" data-action="eq-solver-var" data-idx="' + vIdx + '">' +
                   '<span>' + SOLVER_VARS[vIdx] + '</span><b>▶</b></div>';
        }
        tHtml += '</div>';
        return tHtml;
      }

      if (st.step === 'solver_init') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.solverEditor, false) + '</div>' +
            '<div class="lcd-list-item ' + (st.solverFocus === 0 ? 'active' : '') + '" data-action="eq-solver-focus" data-f="0">' +
              '<span>' + escapeHtml(st.solverTargetVar) + ' =</span>' +
              '<b>' + escapeHtml(st.solverInitStr) + (st.solverFocus === 0 ? '▏' : '') + '</b>' +
            '</div>' +
            '<div class="lcd-list-item ' + (st.solverFocus === 1 ? 'active' : '') + '" data-action="eq-solver-exec">' +
              '<span>Execute</span><b>▶</b>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.step === 'solver_res') {
        var sr = st.solverResult;
        if (!sr || sr.error) {
          return '<div class="lcd-error">' + escapeHtml((sr && sr.error) || 'Can Not Solve') + '</div>';
        }
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-expr-small">' + CalcEditor.renderHTML(st.solverEditor, false) + '</div>' +
            '<div class="lcd-solve-res">' +
              '<div><b>' + escapeHtml(st.solverTargetVar) + ' = </b>' + escapeHtml(CalcEngine.format(sr.x, ctx.getFormatOpts())) + '</div>' +
              '<div><b>L − R = </b>' + escapeHtml(CalcEngine.format(sr.lr, ctx.getFormatOpts())) + '</div>' +
            '</div>' +
          '</div>'
        );
      }

      if (st.step === 'result') {
        var item = st.resItems[st.resIdx] || { label: '', exact: '', decimal: '' };
        var valHtml = (!st.showDecimal && item.exact)
          ? CalcEditor.renderResultHTML(item.exact, ctx.settings.ioMode === 'line')
          : escapeHtml(item.decimal);
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">' +
              '(' + (st.resIdx + 1) + '/' + st.resItems.length + ')' +
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
        pHtml += '<div class="lcd-table-bar"><span>' +
                 (deg === 2 ? 'ax²+bx+c=0' : (deg === 3 ? 'ax³+bx²+cx+d=0' : 'ax⁴+bx³+cx²+dx+e=0')) + '</span>' +
                 '<span class="lcd-inline-btn" data-action="eq-solve-btn">[=]</span></div>';
        pHtml += '<table class="lcd-grid"><thead><tr>';
        for (var j = 0; j <= deg; j++) pHtml += '<th>' + labels[j] + '</th>';
        pHtml += '</tr></thead><tbody><tr>';
        for (var j2 = 0; j2 <= deg; j2++) {
          var sel = (j2 === st.cIdx);
          pHtml += '<td class="' + (sel ? 'sel' : '') + '" data-action="eq-cell" data-r="0" data-c="' + j2 + '">' +
                   escapeHtml(CalcEngine.format(st.polyCoeffs[j2], fmt)) + '</td>';
        }
        pHtml += '</tr></tbody></table>';
        var curP = st.editStr !== '' ? st.editStr : String(st.polyCoeffs[st.cIdx]);
        pHtml += '<div class="lcd-cell-edit"><b>' + escapeHtml(curP) + '</b><span class="m-cursor"></span></div>';
        pHtml += '</div>';
        return pHtml;
      }

      var nSys = st.size;
      var vNames = ['x', 'y', 'z', 't'];
      var hSys = '<div class="lcd-table-wrap">';
      hSys += '<div class="lcd-table-bar"><span>Simul (' + nSys + ' Unknowns)</span>' +
              '<span class="lcd-inline-btn" data-action="eq-solve-btn">[=]</span></div>';
      hSys += '<table class="lcd-grid"><thead><tr>';
      for (var c = 0; c < nSys; c++) hSys += '<th>' + vNames[c] + '</th>';
      hSys += '<th>=</th></tr></thead><tbody>';
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
      hSys += '<div class="lcd-cell-edit"><b>' + escapeHtml(curS) + '</b><span class="m-cursor"></span></div>';
      hSys += '</div>';
      return hSys;
    },
    onKey: function (key, ctx) {
      var st = ctx.eqState;
      var is880 = (ctx.machineId === '880');
      var calcApp = CalcApps.byId.calc;

      if (st.step === 'main') {
        var maxMain = is880 ? 3 : 2;
        if (key === 'UP') {
          st.mainIdx = (st.mainIdx + maxMain - 1) % maxMain;
          st.mode = st.mainIdx === 0 ? 'sys' : (st.mainIdx === 1 ? 'poly' : 'solver');
          return;
        }
        if (key === 'DOWN') {
          st.mainIdx = (st.mainIdx + 1) % maxMain;
          st.mode = st.mainIdx === 0 ? 'sys' : (st.mainIdx === 1 ? 'poly' : 'solver');
          return;
        }
        if (!is880 && key === '1') { st.mode = 'sys'; st.step = 'size'; return; }
        if (!is880 && key === '2') { st.mode = 'poly'; st.step = 'size'; return; }
        if (key === '=' || key === 'OK') {
          if (is880 && st.mode === 'solver') {
            st.step = 'solver_eq';
          } else {
            st.step = 'size';
          }
          return;
        }
        return;
      }

      if (st.step === 'size') {
        if (key === 'AC' || key === 'BACK') { st.step = 'main'; return; }
        if (key === 'UP') { st.size = st.size > 2 ? st.size - 1 : 4; return; }
        if (key === 'DOWN') { st.size = st.size < 4 ? st.size + 1 : 2; return; }
        if (!is880 && (key === '2' || key === '3' || key === '4')) {
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

      if (st.step === 'solver_eq') {
        var ed = st.solverEditor;
        if (key === 'BACK') { st.step = 'main'; return; }
        if (key === 'AC') { CalcEditor.clear(ed); return; }
        if (key === 'DEL') { CalcEditor.deleteBack(ed); return; }
        if (key === 'LEFT') { CalcEditor.moveLeft(ed); return; }
        if (key === 'RIGHT') { CalcEditor.moveRight(ed); return; }
        if (key === 'UP') { CalcEditor.moveUp(ed); return; }
        if (key === 'DOWN') { CalcEditor.moveDown(ed); return; }
        if (key === '=' || key === 'OK') {
          if (CalcEditor.isEmpty(ed)) return;
          st.step = 'solver_target';
          st.solverTargetIdx = 0;
          return;
        }
        calcApp.insertByKey(ed, key);
        return;
      }

      if (st.step === 'solver_target') {
        if (key === 'BACK' || key === 'AC') { st.step = 'solver_eq'; return; }
        if (key === 'UP') { st.solverTargetIdx = (st.solverTargetIdx + SOLVER_VARS.length - 1) % SOLVER_VARS.length; return; }
        if (key === 'DOWN') { st.solverTargetIdx = (st.solverTargetIdx + 1) % SOLVER_VARS.length; return; }
        if (key === 'OK' || key === '=') {
          st.solverTargetVar = SOLVER_VARS[st.solverTargetIdx];
          st.solverInitStr = String(ctx.vars[st.solverTargetVar] || 0);
          st.solverFocus = 0;
          st.step = 'solver_init';
          return;
        }
        return;
      }

      if (st.step === 'solver_init') {
        if (key === 'BACK' || key === 'AC') { st.step = 'solver_eq'; return; }
        if (key === 'UP' || key === 'DOWN') { st.solverFocus = st.solverFocus === 0 ? 1 : 0; return; }
        if (st.solverFocus === 0 && key === 'DEL') {
          st.solverInitStr = st.solverInitStr.slice(0, -1);
          return;
        }
        if (key === '=' || key === 'OK') {
          if (st.solverFocus === 0) {
            st.solverFocus = 1;
          } else {
            this.runSolver880(ctx);
          }
          return;
        }
        var chS = mapKeyToCellChar(key);
        if (chS && st.solverFocus === 0) {
          st.solverInitStr += chS;
        }
        return;
      }

      if (st.step === 'solver_res') {
        if (key === 'AC' || key === 'BACK' || key === 'OK' || key === '=') {
          st.step = 'solver_init';
          st.solverFocus = 0;
        }
        return;
      }

      if (st.step === 'result') {
        if (key === 'AC' || key === 'BACK') { st.step = 'coeffs'; return; }
        if (key === 'S_D') { st.showDecimal = !st.showDecimal; return; }
        if (key === 'UP') { st.resIdx = (st.resIdx + st.resItems.length - 1) % st.resItems.length; return; }
        if (key === 'DOWN' || key === '=' || key === 'OK') {
          st.resIdx = (st.resIdx + 1) % st.resItems.length;
          return;
        }
        return;
      }

      // Nhập hệ số
      var maxR = st.mode === 'poly' ? 0 : st.size - 1;
      var maxC = st.size;
      if (key === 'BACK') {
        st.step = 'size';
        return;
      }
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
    runSolver880: function (ctx) {
      var st = ctx.eqState;
      var initVal = evalCellInput(st.solverInitStr, ctx, 0);
      var exprStr = CalcEditor.toEvalText(st.solverEditor);
      var opts = ctx.getEvalOpts();
      opts.targetVar = st.solverTargetVar;
      var sol = CalcEngine.solveNumeric(exprStr, initVal, opts);
      st.solverResult = sol;
      if (!sol.error) {
        ctx.vars[st.solverTargetVar] = sol.x;
        ctx.vars.Ans = sol.x;
        ctx.saveState();
      }
      st.step = 'solver_res';
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
          st.resItems.push({ label: 'Result:', exact: null, decimal: pRes.error });
        } else {
          for (var i = 0; i < pRes.roots.length; i++) {
            var rt = pRes.roots[i];
            if (!ctx.settings.eqComplexRoots && Math.abs(rt.im) >= 1e-10) {
              continue;
            }
            var lbl = pRes.roots.length === 1 ? 'x =' : ('x' + (i + 1) + ' =');
            var dec = Math.abs(rt.im) < 1e-10
              ? CalcEngine.format(rt.re, fmt)
              : (CalcEngine.format(rt.re, fmt) + (rt.im >= 0 ? '+' : '') + CalcEngine.format(rt.im, fmt) + 'i');
            st.resItems.push({ label: lbl, exact: rt.exact, decimal: dec });
          }
          if (st.resItems.length === 0) {
            st.resItems.push({ label: 'Result:', exact: null, decimal: 'No Real Roots' });
          }
          if (pRes.extremum) {
            var minOrMax = cfs[0] > 0 ? 'Minimum' : 'Maximum';
            st.resItems.push({
              label: minOrMax + ' of y=f(x): x =',
              exact: pRes.extremum.xExact,
              decimal: CalcEngine.format(pRes.extremum.x, fmt)
            });
            st.resItems.push({
              label: minOrMax + ' of y=f(x): y =',
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
          st.resItems.push({ label: 'Result:', exact: null, decimal: sRes.error });
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
  // A / B. ỨNG DỤNG BẤT PHƯƠNG TRÌNH (ineq — Inequality)
  // =========================================================================
  var INEQ_OPS = ['>', '<', '>=', '<='];
  var INEQ_LABELS = ['> 0', '< 0', '≥ 0', '≤ 0'];

  CalcApps.register({
    id: 'ineq',
    code: 'A',
    name: 'Inequality',
    viName: 'Bất phương trình',
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
      var is880 = (ctx.machineId === '880');
      if (st.step === 'deg') {
        if (is880) {
          var polyLbls = { 2: 'ax²+bx+c', 3: 'ax³+bx²+cx+d', 4: 'ax⁴+bx³+cx²+dx+e' };
          var html = '<div class="lcd-menu-list"><div class="lcd-list-title">Polynomial</div>';
          for (var d = 2; d <= 4; d++) {
            var cls = (st.deg === d) ? 'lcd-list-item active' : 'lcd-list-item';
            html += '<div class="' + cls + '" data-action="ineq-deg" data-deg="' + d + '">' + escapeHtml(polyLbls[d]) + '</div>';
          }
          html += '</div>';
          return html;
        }
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-list-title">Polynomial Degree?</div>' +
            '<div class="lcd-prompt-box" style="text-align:center;padding:12px 0;font-weight:700;">Select 2~4</div>' +
          '</div>'
        );
      }

      if (st.step === 'op') {
        var polyStr = st.deg === 2 ? 'ax²+bx+c' : (st.deg === 3 ? 'ax³+bx²+cx+d' : 'ax⁴+bx³+cx²+dx+e');
        var oHtml = '<div class="lcd-menu-list">';
        for (var i = 0; i < 4; i++) {
          var oCls = (st.opIdx === i) ? 'lcd-list-item active' : 'lcd-list-item';
          var prefix = is880 ? '' : ((i + 1) + ':');
          oHtml += '<div class="' + oCls + '" data-action="ineq-op" data-idx="' + i + '">' +
                   escapeHtml(prefix + polyStr + INEQ_LABELS[i]) + '</div>';
        }
        oHtml += '</div>';
        return oHtml;
      }

      if (st.step === 'result') {
        return (
          '<div class="lcd-calc">' +
            '<div class="lcd-res-line">' + escapeHtml(st.resText) + '</div>' +
          '</div>'
        );
      }

      var deg = st.deg;
      var fmt = ctx.getFormatOpts();
      var labels = deg === 2 ? ['x²', 'x', 'c'] : (deg === 3 ? ['x³', 'x²', 'x', 'd'] : ['x⁴', 'x³', 'x²', 'x', 'e']);
      var cHtml = '<div class="lcd-table-wrap">';
      cHtml += '<div class="lcd-table-bar"><span>' + (deg === 2 ? 'ax²+bx+c' : (deg === 3 ? 'ax³+bx²+cx+d' : 'ax⁴+bx³+cx²+dx+e')) + INEQ_LABELS[st.opIdx] + '</span>' +
               '<span class="lcd-inline-btn" data-action="ineq-solve-btn">[=]</span></div>';
      cHtml += '<table class="lcd-grid"><thead><tr>';
      for (var j = 0; j <= deg; j++) cHtml += '<th>' + labels[j] + '</th>';
      cHtml += '</tr></thead><tbody><tr>';
      for (var k = 0; k <= deg; k++) {
        cHtml += '<td class="' + (k === st.cIdx ? 'sel' : '') + '" data-action="ineq-cell" data-c="' + k + '">' +
                 escapeHtml(CalcEngine.format(st.coeffs[k], fmt)) + '</td>';
      }
      cHtml += '</tr></tbody></table>';
      var curC = st.editStr !== '' ? st.editStr : String(st.coeffs[st.cIdx]);
      cHtml += '<div class="lcd-cell-edit"><b>' + escapeHtml(curC) + '</b><span class="m-cursor"></span></div>';
      cHtml += '</div>';
      return cHtml;
    },
    onKey: function (key, ctx) {
      var st = ctx.ineqState;
      var is880 = (ctx.machineId === '880');
      if (st.step === 'deg') {
        if (key === 'UP') { st.deg = st.deg > 2 ? st.deg - 1 : 4; return; }
        if (key === 'DOWN') { st.deg = st.deg < 4 ? st.deg + 1 : 2; return; }
        if (!is880 && (key === '2' || key === '3' || key === '4')) {
          st.deg = parseInt(key, 10);
          st.step = 'op';
          return;
        }
        if (key === '=' || key === 'OK') { st.step = 'op'; return; }
        return;
      }
      if (st.step === 'op') {
        if (key === 'AC' || key === 'BACK') { st.step = 'deg'; return; }
        if (key === 'UP') { st.opIdx = (st.opIdx + 3) % 4; return; }
        if (key === 'DOWN') { st.opIdx = (st.opIdx + 1) % 4; return; }
        var nOp = parseInt(key, 10);
        if (!is880 && nOp >= 1 && nOp <= 4) {
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
        if (key === 'AC' || key === 'BACK' || key === '=' || key === 'OK') {
          st.step = 'coeffs';
        }
        return;
      }

      if (key === 'BACK') { st.step = 'op'; return; }
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
  // C. ỨNG DỤNG TỈ LỆ THỨC (ratio — Ratio)
  // =========================================================================
  CalcApps.register({
    id: 'ratio',
    code: 'C',
    name: 'Ratio',
    viName: 'Tỉ lệ thức',
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
      var is880 = (ctx.machineId === '880');
      if (st.step === 'type') {
        return (
          '<div class="lcd-menu-list">' +
            '<div class="lcd-list-item ' + (st.type === 1 ? 'active' : '') + '" data-action="ratio-type" data-type="1">' + (is880 ? 'A:B=X:D' : '1:A:B=X:D') + '</div>' +
            '<div class="lcd-list-item ' + (st.type === 2 ? 'active' : '') + '" data-action="ratio-type" data-type="2">' + (is880 ? 'A:B=C:X' : '2:A:B=C:X') + '</div>' +
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
            '<div class="lcd-expr-line"><b>X =</b></div>' +
            '<div class="lcd-res-line">' + vHtml + '</div>' +
          '</div>'
        );
      }

      var names = st.type === 1 ? ['A', 'B', 'D'] : ['A', 'B', 'C'];
      var html = '<div class="lcd-table-wrap">';
      html += '<div class="lcd-table-bar"><span>' + (st.type === 1 ? 'A:B=X:D' : 'A:B=C:X') + '</span>' +
              '<span class="lcd-inline-btn" data-action="ratio-solve-btn">[=]</span></div>';
      html += '<table class="lcd-grid"><thead><tr>';
      for (var i = 0; i < 3; i++) html += '<th>' + names[i] + '</th>';
      html += '</tr></thead><tbody><tr>';
      for (var j = 0; j < 3; j++) {
        html += '<td class="' + (j === st.idx ? 'sel' : '') + '" data-action="ratio-cell" data-c="' + j + '">' +
                escapeHtml(CalcEngine.format(st.vals[j], fmt)) + '</td>';
      }
      html += '</tr></tbody></table>';
      var cur = st.editStr !== '' ? st.editStr : String(st.vals[st.idx]);
      html += '<div class="lcd-cell-edit"><b>' + escapeHtml(cur) + '</b><span class="m-cursor"></span></div>';
      html += '</div>';
      return html;
    },
    onKey: function (key, ctx) {
      var st = ctx.ratioState;
      if (st.step === 'type') {
        if (key === 'UP' || key === 'DOWN') { st.type = st.type === 1 ? 2 : 1; return; }
        if (ctx.machineId === '580' && (key === '1' || key === '2')) { st.type = parseInt(key, 10); st.step = 'input'; st.idx = 0; st.editStr = ''; return; }
        if (key === '=' || key === 'OK') { st.step = 'input'; st.idx = 0; st.editStr = ''; return; }
        return;
      }
      if (st.step === 'result') {
        if (key === 'S_D') { st.showDecimal = !st.showDecimal; return; }
        if (key === 'AC' || key === 'BACK' || key === '=' || key === 'OK') { st.step = 'input'; return; }
        return;
      }

      if (key === 'BACK') { st.step = 'type'; return; }
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

  root.CalcApps = CalcApps;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
