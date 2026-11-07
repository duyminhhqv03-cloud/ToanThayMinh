/* Hồ sơ Máy 580 (Kiểu 580 - dòng EX) cho Máy tính Thầy Minh (ES5 thuần) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcMachines = root.CalcMachines || (root.CalcMachines = {});

  // Biểu tượng SVG tự vẽ cho 12 phương thức trên màn hình MENU của Máy 580
  var APP_ICONS_580 = {
    calc: '<svg viewBox="0 0 36 26"><text x="4" y="12" font-size="10" font-weight="bold" fill="currentColor">+ −</text><text x="4" y="23" font-size="10" font-weight="bold" fill="currentColor">× ÷</text></svg>',
    complex: '<svg viewBox="0 0 36 26"><circle cx="15" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="17" font-size="12" font-style="italic" font-weight="bold" fill="currentColor">i</text></svg>',
    baseN: '<svg viewBox="0 0 36 26"><text x="4" y="17" font-size="10.5" font-family="monospace" font-weight="bold" fill="currentColor">0110</text></svg>',
    matrix: '<svg viewBox="0 0 36 26"><path d="M7 4H4v18h3M25 4h3v18h-3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="11" cy="9" r="1.6" fill="currentColor"/><circle cx="19" cy="9" r="1.6" fill="currentColor"/><circle cx="11" cy="17" r="1.6" fill="currentColor"/><circle cx="19" cy="17" r="1.6" fill="currentColor"/></svg>',
    vector: '<svg viewBox="0 0 36 26"><line x1="5" y1="21" x2="25" y2="6" stroke="currentColor" stroke-width="2"/><polyline points="18,5 25,6 23,13" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="5" y1="21" x2="26" y2="21" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2,2"/></svg>',
    stat: '<svg viewBox="0 0 36 26"><rect x="4" y="14" width="4.5" height="8" fill="currentColor"/><rect x="11" y="8" width="4.5" height="14" fill="currentColor"/><rect x="18" y="11" width="4.5" height="11" fill="currentColor"/></svg>',
    dist: '<svg viewBox="0 0 36 26"><path d="M3 22 L29 22" stroke="currentColor" stroke-width="1.4"/><path d="M4 22 C9 22 12 5 16 5 C20 5 23 22 28 22" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    table: '<svg viewBox="0 0 36 26"><text x="3" y="10" font-size="8.5" font-style="italic" font-weight="bold" fill="currentColor">f(x)</text><rect x="3" y="12" width="24" height="11" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="15" y1="12" x2="15" y2="23" stroke="currentColor" stroke-width="1.3"/><line x1="3" y1="17.5" x2="27" y2="17.5" stroke="currentColor" stroke-width="1.3"/></svg>',
    eq: '<svg viewBox="0 0 36 26"><text x="3" y="12" font-size="9" font-weight="bold" fill="currentColor">x+y=0</text><text x="3" y="22" font-size="9" font-weight="bold" fill="currentColor">x²=0</text></svg>',
    ineq: '<svg viewBox="0 0 36 26"><path d="M4 20 Q15 4 26 20" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="2" y1="15" x2="28" y2="15" stroke="currentColor" stroke-width="1.4"/><text x="11" y="11" font-size="9" font-weight="bold" fill="currentColor">&gt;0</text></svg>',
    verify: '<svg viewBox="0 0 36 26"><text x="3" y="12" font-size="8.5" font-weight="bold" fill="currentColor">TRUE</text><polyline points="9,18 14,23 24,13" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    ratio: '<svg viewBox="0 0 36 26"><text x="3" y="12" font-size="9" font-weight="bold" fill="currentColor">A:B</text><text x="3" y="22" font-size="9" font-weight="bold" fill="currentColor">=X:D</text></svg>'
  };

  // Danh sách 12 phương thức trên màn hình MENU của Máy 580 (lưới 4 cột, mã 1..9, A..C)
  var APPS_580 = [
    { id: 'calc', code: '1', name: 'Calculate', iconSvg: APP_ICONS_580.calc },
    { id: 'complex', code: '2', name: 'Complex', iconSvg: APP_ICONS_580.complex },
    { id: 'baseN', code: '3', name: 'Base-N', iconSvg: APP_ICONS_580.baseN },
    { id: 'matrix', code: '4', name: 'Matrix', iconSvg: APP_ICONS_580.matrix },
    { id: 'vector', code: '5', name: 'Vector', iconSvg: APP_ICONS_580.vector },
    { id: 'stat', code: '6', name: 'Statistics', iconSvg: APP_ICONS_580.stat },
    { id: 'dist', code: '7', name: 'Distribution', iconSvg: APP_ICONS_580.dist },
    { id: 'table', code: '8', name: 'Table', iconSvg: APP_ICONS_580.table },
    { id: 'eq', code: '9', name: 'Equation/Func', iconSvg: APP_ICONS_580.eq },
    { id: 'ineq', code: 'A', name: 'Inequality', iconSvg: APP_ICONS_580.ineq },
    { id: 'verify', code: 'B', name: 'Verify', iconSvg: APP_ICONS_580.verify },
    { id: 'ratio', code: 'C', name: 'Ratio', iconSvg: APP_ICONS_580.ratio }
  ];

  // Bố cục bàn phím Máy 580 đúng theo ảnh mặt máy anh-mat-may-580.jpg
  var KEYPAD_580 = {
    // Hàng 1: SHIFT, ALPHA | [Cụm con trỏ bầu dục ở giữa, không có OK] | MENU (SETUP), ON
    topRow: [
      { id: 'SHIFT', topText: 'SHIFT', label: '', plainLbl: 'SHIFT', normalAct: 'SHIFT', cls: 'btn-580-metal' },
      { id: 'ALPHA', topText: 'ALPHA', label: '', plainLbl: 'ALPHA', normalAct: 'ALPHA', cls: 'btn-580-metal' },
      { id: 'MENU', topText: 'MENU', shiftLbl: 'SETUP', label: '', plainLbl: 'MENU', normalAct: 'MENU', shiftAct: 'SETUP', cls: 'btn-580-metal' },
      { id: 'ON', topText: 'ON', label: '', plainLbl: 'ON', normalAct: 'ON', cls: 'btn-580-metal' }
    ],

    // Hàng 2 (hai bên cụm con trỏ): OPTN, CALC (SOLVE, =) | ∫■ (d/dx, :), x (Σ, Π)
    flankRow: [
      { id: 'K580_OPTN', label: 'OPTN', plainLbl: 'OPTN', shiftLbl: '', alphaLbl: '', normalAct: 'OPTN', shiftAct: 'OPTN', alphaAct: 'OPTN', cls: 'btn-580-sci' },
      { id: 'K580_CALC', label: 'CALC', plainLbl: 'CALC', shiftLbl: 'SOLVE', alphaLbl: '=', normalAct: 'CALC', shiftAct: 'SOLVE', alphaAct: 'EQUAL_SIGN', cls: 'btn-580-sci' },
      { id: 'K580_INT', label: '∫■', plainLbl: '∫■', shiftLbl: 'd/dx', alphaLbl: ':', normalAct: 'INTEG', shiftAct: 'DERIV', alphaAct: 'COLON', cls: 'btn-580-sci' },
      { id: 'K580_X', label: '<i>x</i>', plainLbl: 'x', shiftLbl: '∑', alphaLbl: '∏', normalAct: 'x', shiftAct: 'SUM', alphaAct: 'PROD', cls: 'btn-580-sci' }
    ],

    // Hàng 3, 4, 5 (3 hàng × 6 cột phím đen)
    sciRows: [
      // Hàng 3: ■/□, √■, x², x^■, log■□, ln
      [
        { id: 'K580_FRAC', label: '■/□', plainLbl: '■/□', shiftLbl: '■■/□', alphaLbl: '÷R', normalAct: 'FRAC', shiftAct: 'MIXED', alphaAct: 'DIV_R', cls: 'btn-580-sci' },
        { id: 'K580_SQRT', label: '√■', plainLbl: '√■', shiftLbl: '∛■', alphaLbl: '(■)', normalAct: 'SQRT', shiftAct: 'CBRT', alphaAct: 'RECUR', cls: 'btn-580-sci' },
        { id: 'K580_SQ', label: '<i>x</i>²', plainLbl: 'x²', shiftLbl: '<i>x</i>³', baseLbl: 'DEC', alphaLbl: '', normalAct: 'SQ', shiftAct: 'CUBE', alphaAct: 'SQ', cls: 'btn-580-sci' },
        { id: 'K580_POW', label: '<i>x</i><sup>■</sup>', plainLbl: 'x^■', shiftLbl: '■√□', baseLbl: 'HEX', alphaLbl: '', normalAct: 'POW', shiftAct: 'ROOT', alphaAct: 'POW', cls: 'btn-580-sci' },
        { id: 'K580_LOG2', label: 'log<sub>■</sub>□', plainLbl: 'log■□', shiftLbl: '10<sup>■</sup>', baseLbl: 'BIN', alphaLbl: '', normalAct: 'LOG2', shiftAct: 'POW10', alphaAct: 'LOG2', cls: 'btn-580-sci' },
        { id: 'K580_LN', label: 'ln', plainLbl: 'ln', shiftLbl: '<i>e</i><sup>■</sup>', baseLbl: 'OCT', alphaLbl: '', normalAct: 'ln', shiftAct: 'POWE', alphaAct: 'ln', cls: 'btn-580-sci' }
      ],
      // Hàng 4: (−), °′″, x⁻¹, sin, cos, tan
      [
        { id: 'K580_NEG', label: '(−)', plainLbl: '(−)', shiftLbl: 'log', alphaLbl: 'A', normalAct: '(-)', shiftAct: 'log', alphaAct: 'VAR_A', cls: 'btn-580-sci' },
        { id: 'K580_DMS', label: '°′″', plainLbl: '°′″', shiftLbl: 'FACT', alphaLbl: 'B', normalAct: 'DMS', shiftAct: 'FACT', alphaAct: 'VAR_B', cls: 'btn-580-sci' },
        { id: 'K580_INV', label: '<i>x</i>⁻¹', plainLbl: 'x⁻¹', shiftLbl: '<i>x</i>!', alphaLbl: 'C', normalAct: 'INV', shiftAct: 'FACTORIAL', alphaAct: 'VAR_C', cls: 'btn-580-sci' },
        { id: 'K580_SIN', label: 'sin', plainLbl: 'sin', shiftLbl: 'sin⁻¹', alphaLbl: 'D', normalAct: 'sin', shiftAct: 'asin', alphaAct: 'VAR_D', cls: 'btn-580-sci' },
        { id: 'K580_COS', label: 'cos', plainLbl: 'cos', shiftLbl: 'cos⁻¹', alphaLbl: 'E', normalAct: 'cos', shiftAct: 'acos', alphaAct: 'VAR_E', cls: 'btn-580-sci' },
        { id: 'K580_TAN', label: 'tan', plainLbl: 'tan', shiftLbl: 'tan⁻¹', alphaLbl: 'F', normalAct: 'tan', shiftAct: 'atan', alphaAct: 'VAR_F', cls: 'btn-580-sci' }
      ],
      // Hàng 5: STO, ENG, (, ), S⇔D, M+
      [
        { id: 'K580_STO', label: 'STO', plainLbl: 'STO', shiftLbl: 'RECALL', alphaLbl: '', normalAct: 'STO', shiftAct: 'RCL', alphaAct: 'STO', cls: 'btn-580-sci' },
        { id: 'K580_ENG', label: 'ENG', plainLbl: 'ENG', shiftLbl: '←', cplxLbl: 'i', shiftCplxLbl: '∠', alphaLbl: '<i>i</i>', normalAct: 'ENG', shiftAct: 'ENG_BACK', alphaAct: 'COMPLEX_I', cls: 'btn-580-sci' },
        { id: 'K580_LP', label: '(', plainLbl: '(', shiftLbl: 'Abs', alphaLbl: '<i>x</i>', normalAct: '(', shiftAct: 'ABS', alphaAct: 'VAR_x', cls: 'btn-580-sci' },
        { id: 'K580_RP', label: ')', plainLbl: ')', shiftLbl: ',', alphaLbl: '<i>y</i>', normalAct: ')', shiftAct: ',', alphaAct: 'VAR_y', cls: 'btn-580-sci' },
        { id: 'K580_SD', label: 'S⇔D', plainLbl: 'S⇔D', shiftLbl: 'a b/c⇔d/c', alphaLbl: '<i>z</i>', normalAct: 'S_D', shiftAct: 'MIXED_SD', alphaAct: 'VAR_z', cls: 'btn-580-sci' },
        { id: 'K580_MP', label: 'M+', plainLbl: 'M+', shiftLbl: 'M−', alphaLbl: 'M', normalAct: 'M+', shiftAct: 'M-', alphaAct: 'VAR_M', cls: 'btn-580-sci' }
      ]
    ],

    // 4 hàng × 5 cột phím số (phím trắng chữ đen; DEL và AC xanh dương chữ trắng)
    numRows: [
      [
        { id: 'K580_7', label: '7', plainLbl: '7', shiftLbl: 'CONST', alphaLbl: '', normalAct: '7', shiftAct: 'CONST_MENU', alphaAct: '7', cls: 'btn-580-num' },
        { id: 'K580_8', label: '8', plainLbl: '8', shiftLbl: 'CONV', alphaLbl: '', normalAct: '8', shiftAct: 'CONV_MENU', alphaAct: '8', cls: 'btn-580-num' },
        { id: 'K580_9', label: '9', plainLbl: '9', shiftLbl: 'RESET', alphaLbl: '', normalAct: '9', shiftAct: 'RESET_MENU', alphaAct: '9', cls: 'btn-580-num' },
        { id: 'K580_DEL', label: 'DEL', plainLbl: 'DEL', shiftLbl: 'INS', alphaLbl: 'UNDO', normalAct: 'DEL', shiftAct: 'INS', alphaAct: 'DEL', cls: 'btn-580-blue' },
        { id: 'K580_AC', label: 'AC', plainLbl: 'AC', shiftLbl: 'OFF', alphaLbl: '', normalAct: 'AC', shiftAct: 'OFF', alphaAct: 'AC', cls: 'btn-580-blue' }
      ],
      [
        { id: 'K580_4', label: '4', plainLbl: '4', shiftLbl: '', alphaLbl: '', normalAct: '4', shiftAct: '4', alphaAct: '4', cls: 'btn-580-num' },
        { id: 'K580_5', label: '5', plainLbl: '5', shiftLbl: '', alphaLbl: '', normalAct: '5', shiftAct: '5', alphaAct: '5', cls: 'btn-580-num' },
        { id: 'K580_6', label: '6', plainLbl: '6', shiftLbl: '', alphaLbl: '', normalAct: '6', shiftAct: '6', alphaAct: '6', cls: 'btn-580-num' },
        { id: 'K580_MUL', label: '×', plainLbl: '×', shiftLbl: 'nPr', alphaLbl: 'GCD', normalAct: '*', shiftAct: 'NPR', alphaAct: 'GCD_FN', cls: 'btn-580-num' },
        { id: 'K580_DIV', label: '÷', plainLbl: '÷', shiftLbl: 'nCr', alphaLbl: 'LCM', normalAct: '/', shiftAct: 'NCR', alphaAct: 'LCM_FN', cls: 'btn-580-num' }
      ],
      [
        { id: 'K580_1', label: '1', plainLbl: '1', shiftLbl: '', alphaLbl: '', normalAct: '1', shiftAct: '1', alphaAct: '1', cls: 'btn-580-num' },
        { id: 'K580_2', label: '2', plainLbl: '2', shiftLbl: '', alphaLbl: '', normalAct: '2', shiftAct: '2', alphaAct: '2', cls: 'btn-580-num' },
        { id: 'K580_3', label: '3', plainLbl: '3', shiftLbl: '', alphaLbl: '', normalAct: '3', shiftAct: '3', alphaAct: '3', cls: 'btn-580-num' },
        { id: 'K580_ADD', label: '+', plainLbl: '+', shiftLbl: 'Pol', alphaLbl: 'Int', normalAct: '+', shiftAct: 'POL', alphaAct: 'INT_FN', cls: 'btn-580-num' },
        { id: 'K580_SUB', label: '−', plainLbl: '−', shiftLbl: 'Rec', alphaLbl: 'Intg', normalAct: '-', shiftAct: 'REC', alphaAct: 'INTG_FN', cls: 'btn-580-num' }
      ],
      [
        { id: 'K580_0', label: '0', plainLbl: '0', shiftLbl: 'Rnd', alphaLbl: '', normalAct: '0', shiftAct: 'RND_FN', alphaAct: '0', cls: 'btn-580-num' },
        { id: 'K580_DOT', label: '.', plainLbl: '.', shiftLbl: 'Ran#', alphaLbl: 'RanInt', normalAct: '.', shiftAct: 'RAN', alphaAct: 'RANINT', cls: 'btn-580-num' },
        { id: 'K580_EXP', label: '×10<sup><i>x</i></sup>', plainLbl: '×10^x', shiftLbl: 'π', alphaLbl: '<i>e</i>', normalAct: 'EXP10', shiftAct: 'PI', alphaAct: 'E_CONST', cls: 'btn-580-num' },
        { id: 'K580_ANS', label: 'Ans', plainLbl: 'Ans', shiftLbl: '%', alphaLbl: 'PreAns', normalAct: 'ANS', shiftAct: 'PERCENT', alphaAct: 'PREANS', cls: 'btn-580-num' },
        { id: 'K580_EQ', label: '=', plainLbl: '=', shiftLbl: '≈', alphaLbl: '', normalAct: '=', shiftAct: 'APPROX_EQ', alphaAct: '=', cls: 'btn-580-num' }
      ]
    ]
  };

  // Thực đơn SETUP (SHIFT + MENU) đánh số 4 trang như sách hướng dẫn fx-580VN X
  function getSetupPages(ctx) {
    return [
      [
        {
          num: '1', label: 'Input/Output',
          sub: [
            { label: '1:MathI/MathO', action: 'SET_IO_MATH' },
            { label: '2:MathI/DecimalO', action: 'SET_IO_MATH_DEC' },
            { label: '3:LineI/LineO', action: 'SET_IO_LINE' },
            { label: '4:LineI/DecimalO', action: 'SET_IO_LINE_DEC' }
          ]
        },
        {
          num: '2', label: 'Angle Unit',
          sub: [
            { label: '1:Degree', action: 'SET_ANG_DEG' },
            { label: '2:Radian', action: 'SET_ANG_RAD' },
            { label: '3:Gradian', action: 'SET_ANG_GRA' }
          ]
        },
        {
          num: '3', label: 'Number Format',
          sub: [
            { label: '1:Fix (0~9)', action: 'PROMPT_FIX' },
            { label: '2:Sci (0~9)', action: 'PROMPT_SCI' },
            { label: '3:Norm (1~2)', action: 'PROMPT_NORM' }
          ]
        },
        {
          num: '4', label: 'Engineer Symbol',
          sub: [
            { label: '1:On', action: 'SET_ENG_SYM', value: true },
            { label: '2:Off', action: 'SET_ENG_SYM', value: false }
          ]
        }
      ],
      [
        {
          num: '1', label: 'Fraction Result',
          sub: [
            { label: '1:ab/c (Mixed)', action: 'SET_FRAC_MIXED' },
            { label: '2:d/c (Improper)', action: 'SET_FRAC_IMPROPER' }
          ]
        },
        {
          num: '2', label: 'Complex',
          sub: [
            { label: '1:a+bi', action: 'SET_CPLX_RECT' },
            { label: '2:r∠θ', action: 'SET_CPLX_POLAR' }
          ]
        },
        {
          num: '3', label: 'Statistics (Freq)',
          sub: [
            { label: '1:On', action: 'SET_STAT_FREQ', value: true },
            { label: '2:Off', action: 'SET_STAT_FREQ', value: false }
          ]
        },
        {
          num: '4', label: 'Table',
          sub: [
            { label: '1:f(x)', action: 'SET_TBL_1' },
            { label: '2:f(x),g(x)', action: 'SET_TBL_2' }
          ]
        }
      ],
      [
        {
          num: '1', label: 'Equation/Func',
          sub: [
            { label: '1:Complex Roots On', action: 'SET_EQ_CPLX', value: true },
            { label: '2:Complex Roots Off', action: 'SET_EQ_CPLX', value: false }
          ]
        },
        {
          num: '2', label: 'Decimal Mark',
          sub: [
            { label: '1:Dot (.)', action: 'SET_DEC_DOT' },
            { label: '2:Comma (,)', action: 'SET_DEC_COMMA' }
          ]
        },
        {
          num: '3', label: 'Digit Separator',
          sub: [
            { label: '1:On', action: 'SET_SEP', value: true },
            { label: '2:Off', action: 'SET_SEP', value: false }
          ]
        },
        {
          num: '4', label: 'Multiline Font',
          sub: [
            { label: '1:Normal Font', action: 'SET_FONT_NORM' },
            { label: '2:Small Font', action: 'SET_FONT_SMALL' }
          ]
        }
      ],
      [
        {
          num: '1', label: 'Contrast',
          sub: [
            { label: '1:Light', action: 'SET_CONTRAST' },
            { label: '2:Normal', action: 'SET_CONTRAST' },
            { label: '3:Dark', action: 'SET_CONTRAST' }
          ]
        }
      ]
    ];
  }

  // Thực đơn OPTN đánh số theo từng phương thức của Máy 580
  function getOptnPages(appId, ctx) {
    var commonPage = [
      {
        num: '1', label: 'Hyperbolic Func',
        sub: [
          { label: '1:sinh', text: 'sinh(', evalText: 'sinh(' },
          { label: '2:cosh', text: 'cosh(', evalText: 'cosh(' },
          { label: '3:tanh', text: 'tanh(', evalText: 'tanh(' },
          { label: '4:sinh⁻¹', text: 'sinh⁻¹(', evalText: 'asinh(' },
          { label: '5:cosh⁻¹', text: 'cosh⁻¹(', evalText: 'acosh(' },
          { label: '6:tanh⁻¹', text: 'tanh⁻¹(', evalText: 'atanh(' }
        ]
      },
      {
        num: '2', label: 'Angle Unit',
        sub: [
          { label: '1:° (Degree)', text: '°', evalText: '°' },
          { label: '2:ʳ (Radian)', text: 'ʳ', evalText: 'ʳ' },
          { label: '3:ᵍ (Gradian)', text: 'ᵍ', evalText: 'ᵍ' }
        ]
      },
      {
        num: '3', label: 'Engineer Symbol',
        sub: [
          { label: '1:m (Milli)', text: 'm', evalText: 'm' },
          { label: '2:μ (Micro)', text: 'μ', evalText: 'μ' },
          { label: '3:n (Nano)', text: 'n', evalText: 'n' },
          { label: '4:p (Pico)', text: 'p', evalText: 'p' },
          { label: '5:f (Femto)', text: 'f', evalText: 'f' },
          { label: '6:k (Kilo)', text: 'k', evalText: 'k' },
          { label: '7:M (Mega)', text: 'M', evalText: 'M' },
          { label: '8:G (Giga)', text: 'G', evalText: 'G' },
          { label: '9:T (Tera)', text: 'T', evalText: 'T' },
          { label: 'P (Peta)', text: 'P', evalText: 'P' },
          { label: 'E (Exa)', text: 'E', evalText: 'E' }
        ]
      }
    ];

    if (appId === 'complex') {
      return [
        [
          { num: '1', label: 'Argument', text: 'Arg(', evalText: 'arg(' },
          { num: '2', label: 'Conjugate', text: 'Conjg(', evalText: 'conj(' },
          { num: '3', label: 'Real Part', text: 'ReP(', evalText: 're(' },
          { num: '4', label: 'Imaginary Part', text: 'ImP(', evalText: 'im(' }
        ],
        [
          { num: '1', label: '▸r∠θ', text: '▶r∠θ', evalText: '▶r∠θ' },
          { num: '2', label: '▸a+bi', text: '▶a+bi', evalText: '▶a+bi' },
          { num: '3', label: 'Hyperbolic Func', sub: commonPage[0].sub },
          { num: '4', label: 'Angle Unit', sub: commonPage[1].sub }
        ]
      ];
    }

    if (appId === 'baseN') {
      return [
        [
          { num: '1', label: 'Neg', text: 'Neg(' },
          { num: '2', label: 'Not', text: 'Not(' },
          { num: '3', label: 'and', text: ' and ' },
          { num: '4', label: 'or', text: ' or ' },
          { num: '5', label: 'xor', text: ' xor ' },
          { num: '6', label: 'xnor', text: ' xnor ' }
        ],
        [
          { num: '1', label: 'd (Decimal)', text: 'd' },
          { num: '2', label: 'h (Hexadecimal)', text: 'h' },
          { num: '3', label: 'b (Binary)', text: 'b' },
          { num: '4', label: 'o (Octal)', text: 'o' }
        ]
      ];
    }

    if (appId === 'matrix') {
      return [
        [
          {
            num: '1', label: 'Define Matrix',
            sub: [
              { label: '1:MatA', action: 'MAT_DIM', mat: 'MatA' },
              { label: '2:MatB', action: 'MAT_DIM', mat: 'MatB' },
              { label: '3:MatC', action: 'MAT_DIM', mat: 'MatC' },
              { label: '4:MatD', action: 'MAT_DIM', mat: 'MatD' }
            ]
          },
          { num: '2', label: 'MatA', text: 'MatA' },
          { num: '3', label: 'MatB', text: 'MatB' },
          { num: '4', label: 'MatC', text: 'MatC' },
          { num: '5', label: 'MatD', text: 'MatD' },
          { num: '6', label: 'MatAns', text: 'MatAns' }
        ],
        [
          { num: '1', label: 'Determinant', text: 'Det(' },
          { num: '2', label: 'Transposition', text: 'Trn(' },
          { num: '3', label: 'Identity', text: 'Identity(' },
          { num: '4', label: 'RowEchelon', text: 'Ref(' },
          { num: '5', label: 'ReducedRowEchelon', text: 'Rref(' }
        ]
      ];
    }

    if (appId === 'vector') {
      return [
        [
          {
            num: '1', label: 'Define Vector',
            sub: [
              { label: '1:VctA', action: 'VCT_DIM', vct: 'VctA' },
              { label: '2:VctB', action: 'VCT_DIM', vct: 'VctB' },
              { label: '3:VctC', action: 'VCT_DIM', vct: 'VctC' },
              { label: '4:VctD', action: 'VCT_DIM', vct: 'VctD' }
            ]
          },
          { num: '2', label: 'VctA', text: 'VctA' },
          { num: '3', label: 'VctB', text: 'VctB' },
          { num: '4', label: 'VctC', text: 'VctC' },
          { num: '5', label: 'VctD', text: 'VctD' },
          { num: '6', label: 'VctAns', text: 'VctAns' }
        ],
        [
          { num: '1', label: 'Dot Product', text: '·' },
          { num: '2', label: 'Angle', text: 'Angle(' },
          { num: '3', label: 'Unit Vector', text: 'UnitV(' }
        ]
      ];
    }

    return [commonPage];
  }

  // Thực đơn Hằng số khoa học CONST (SHIFT + 7)
  function buildSciConstPages() {
    var tree = [];
    if (CalcEngine && CalcEngine.constants) {
      for (var i = 0; i < CalcEngine.constants.length; i++) {
        var grp = CalcEngine.constants[i];
        var kids = [];
        for (var j = 0; j < grp.items.length; j++) {
          var it = grp.items[j];
          kids.push({
            label: (j + 1) + ':' + it.sym580 + ' (' + it.desc + ')',
            text: it.sym580,
            evalText: it.token
          });
        }
        tree.push({
          label: (i + 1) + ':' + grp.name,
          children: kids
        });
      }
    }
    return tree;
  }

  // Thực đơn Đổi đơn vị CONV (SHIFT + 8)
  function buildUnitConvPages() {
    var tree = [];
    if (CalcEngine && CalcEngine.conversions) {
      for (var i = 0; i < CalcEngine.conversions.length; i++) {
        var grp = CalcEngine.conversions[i];
        var kids = [];
        for (var j = 0; j < grp.items.length; j++) {
          var it = grp.items[j];
          kids.push({
            label: (j + 1) + ':' + it.label,
            text: it.label,
            evalText: it.label
          });
        }
        tree.push({
          label: (i + 1) + ':' + grp.name,
          children: kids
        });
      }
    }
    return tree;
  }

  // Thực đơn RESET (SHIFT + 9) của Máy 580
  function getResetMenu() {
    return [
      { label: '1:Setup Data', action: 'RESET_SETTINGS_DATA' },
      { label: '2:Memory', action: 'RESET_VAR_MEM' },
      { label: '3:Initialize All', action: 'RESET_ALL' }
    ];
  }

  CalcMachines['580'] = {
    id: '580',
    name: 'Máy 580',
    brandTitle: 'Máy tính Thầy Minh',
    brandSub: 'Kiểu 580',
    hasAlpha: true,
    execKey: '=',
    selectKey: '=',
    variables: ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'],
    apps: APPS_580,
    keypad: KEYPAD_580,
    getSetupPages: getSetupPages,
    getOptnPages: getOptnPages,
    buildSciConstPages: buildSciConstPages,
    buildUnitConvPages: buildUnitConvPages,
    getResetMenu: getResetMenu
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
