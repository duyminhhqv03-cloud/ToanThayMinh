/* Hồ sơ Máy 880 (Kiểu 880 - dòng CW) cho Máy tính Thầy Minh (ES5 thuần) */
(function (root) {
  'use strict';

  var CalcEngine = root.CalcEngine;
  var CalcMachines = root.CalcMachines || (root.CalcMachines = {});

  // Biểu tượng SVG tự vẽ cho các phím điều khiển của Máy 880
  var KEY_SVGS = {
    on: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M12 3v9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M7.5 6.5a7 7 0 1 0 9 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="6" r="2.3" fill="currentColor"/><circle cx="15" cy="12" r="2.3" fill="currentColor"/><circle cx="10" cy="18" r="2.3" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M9 7L4 12l5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12h11a5 5 0 0 1 5 5v1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    shift: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M12 4l7 8h-4.5v8h-5v-8H5l7-8z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    variable: '<span class="k-icon-var">⇄<i>x</i></span>',
    func: '<span class="k-icon-fn"><i>f</i>(<i>x</i>)</span>',
    catalog: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M3 5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2V5zm18 0a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5a2 2 0 0 0 2-2V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    tools: '<svg viewBox="0 0 24 24" class="k-svg"><circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    del: '<svg viewBox="0 0 28 20" class="k-svg k-svg-del"><path d="M9 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-7-7 7-7z" fill="currentColor"/><path d="M14 7l6 6M20 7l-6 6" stroke="#23272e" stroke-width="2.2" stroke-linecap="round"/></svg>',
    format: '<span class="k-icon-format"><span class="k-fmt-arr">⇄</span><span>FORMAT</span></span>',
    pgup: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M6 13l6-5 6 5M6 18l6-5 6 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pgdn: '<svg viewBox="0 0 24 24" class="k-svg"><path d="M6 6l6 5 6-5M6 11l6 5 6-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // Biểu tượng SVG tự vẽ cho 13 ứng dụng trên màn hình HOME của Máy 880
  var APP_ICONS_880 = {
    calc: '<svg viewBox="0 0 36 26"><text x="5" y="12" font-size="10.5" font-weight="bold" fill="currentColor">× ÷</text><text x="5" y="23" font-size="10.5" font-weight="bold" fill="currentColor">+ −</text></svg>',
    stat: '<svg viewBox="0 0 36 26"><rect x="5" y="13" width="5" height="10" fill="currentColor"/><rect x="13" y="7" width="5" height="16" fill="currentColor"/><rect x="21" y="10" width="5" height="13" fill="currentColor"/><rect x="28" y="15" width="4" height="8" fill="currentColor"/></svg>',
    dist: '<svg viewBox="0 0 36 26"><path d="M3 22 L33 22" stroke="currentColor" stroke-width="1.5"/><path d="M4 22 C10 22 13 5 18 5 C23 5 26 22 32 22" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 5 L18 22" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2,2"/></svg>',
    sheet: '<svg viewBox="0 0 36 26"><rect x="4" y="4" width="28" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="10" x2="32" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="4" x2="13" y2="22" stroke="currentColor" stroke-width="1.5"/></svg>',
    table: '<svg viewBox="0 0 36 26"><rect x="4" y="4" width="28" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="18" y1="4" x2="18" y2="22" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="10" x2="32" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="1.5"/></svg>',
    eq: '<svg viewBox="0 0 36 26"><text x="3" y="16" font-size="10.5" font-weight="bold" fill="currentColor">xy=0</text><line x1="3" y1="20" x2="33" y2="20" stroke="currentColor" stroke-width="1.8"/></svg>',
    ineq: '<svg viewBox="0 0 36 26"><path d="M6 20 Q18 4 30 20" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="15" x2="33" y2="15" stroke="currentColor" stroke-width="1.5"/><text x="13" y="11" font-size="9.5" font-weight="bold" fill="currentColor">≥0</text></svg>',
    complex: '<svg viewBox="0 0 36 26"><circle cx="18" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="15" y="17" font-size="12" font-style="italic" font-weight="bold" fill="currentColor">i</text></svg>',
    baseN: '<svg viewBox="0 0 36 26"><rect x="4" y="4" width="28" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="7" y="17" font-size="10.5" font-family="monospace" font-weight="bold" fill="currentColor">0110</text></svg>',
    matrix: '<svg viewBox="0 0 36 26"><path d="M8 4H5v18h3M28 4h3v18h-3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="9" r="1.8" fill="currentColor"/><circle cx="23" cy="9" r="1.8" fill="currentColor"/><circle cx="13" cy="17" r="1.8" fill="currentColor"/><circle cx="23" cy="17" r="1.8" fill="currentColor"/></svg>',
    vector: '<svg viewBox="0 0 36 26"><line x1="6" y1="20" x2="28" y2="6" stroke="currentColor" stroke-width="2.2"/><polyline points="21,5 28,6 26,13" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="20" x2="29" y2="20" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2,2"/></svg>',
    ratio: '<svg viewBox="0 0 36 26"><text x="4" y="12" font-size="9.5" font-weight="bold" fill="currentColor">A : B</text><text x="4" y="22" font-size="9.5" font-weight="bold" fill="currentColor">= X : D</text></svg>',
    mathbox: '<svg viewBox="0 0 36 26"><rect x="8" y="4" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="13" cy="9" r="1.6" fill="currentColor"/><circle cx="17" cy="13" r="1.6" fill="currentColor"/><circle cx="21" cy="17" r="1.6" fill="currentColor"/></svg>'
  };

  // Danh sách 13 ứng dụng trên màn hình HOME của Máy 880 (3 cột × 2 hàng mỗi trang, không đánh số)
  var APPS_880 = [
    { id: 'calc', name: 'Calculate', iconSvg: APP_ICONS_880.calc },
    { id: 'stat', name: 'Statistics', iconSvg: APP_ICONS_880.stat },
    { id: 'dist', name: 'Distribution', iconSvg: APP_ICONS_880.dist },
    { id: 'sheet', name: 'Spreadsheet', iconSvg: APP_ICONS_880.sheet },
    { id: 'table', name: 'Table', iconSvg: APP_ICONS_880.table },
    { id: 'eq', name: 'Equation', iconSvg: APP_ICONS_880.eq },
    { id: 'ineq', name: 'Inequality', iconSvg: APP_ICONS_880.ineq },
    { id: 'complex', name: 'Complex', iconSvg: APP_ICONS_880.complex },
    { id: 'baseN', name: 'Base-N', iconSvg: APP_ICONS_880.baseN },
    { id: 'matrix', name: 'Matrix', iconSvg: APP_ICONS_880.matrix },
    { id: 'vector', name: 'Vector', iconSvg: APP_ICONS_880.vector },
    { id: 'ratio', name: 'Ratio', iconSvg: APP_ICONS_880.ratio },
    { id: 'mathbox', name: 'Math Box', iconSvg: APP_ICONS_880.mathbox }
  ];

  // Bố cục bàn phím Máy 880 đúng theo ảnh mặt máy anh-mat-may-880.png
  var KEYPAD_880 = {
    topLeftCluster: [
      [
        { id: 'ON', topText: 'ON', label: KEY_SVGS.on, plainLbl: 'ON', normalAct: 'ON', cls: 'btn-880-ctrl btn-880-on', title: 'Bật máy (ON)' },
        { id: 'HOME', topText: 'HOME', label: KEY_SVGS.home, plainLbl: 'HOME', normalAct: 'HOME', cls: 'btn-880-ctrl', title: 'Màn hình chính (HOME)' }
      ],
      [
        { id: 'SETTINGS', topText: 'SETTINGS', label: KEY_SVGS.settings, plainLbl: 'SETTINGS', normalAct: 'SETTINGS', cls: 'btn-880-ctrl', title: 'Cài đặt (SETTINGS)' },
        { id: 'BACK', topText: '', label: KEY_SVGS.back, plainLbl: 'BACK', normalAct: 'BACK', cls: 'btn-880-ctrl', title: 'Quay lại (BACK)' }
      ]
    ],
    pageScroll: {
      up: { id: 'PAGE_UP', label: KEY_SVGS.pgup, plainLbl: '⇑', normalAct: 'PAGE_UP' },
      down: { id: 'PAGE_DOWN', label: KEY_SVGS.pgdn, plainLbl: '⇓', normalAct: 'PAGE_DOWN' }
    },
    navRow2: [
      { id: 'SHIFT', topText: 'SHIFT', label: KEY_SVGS.shift, plainLbl: 'SHIFT', normalAct: 'SHIFT', cls: 'btn-880-shift', title: 'Phím chức năng phụ (SHIFT)' },
      { id: 'VARIABLE', topText: 'VARIABLE', label: KEY_SVGS.variable, plainLbl: 'VARIABLE', normalAct: 'VARIABLE', cls: 'btn-880-nav', title: 'Biến nhớ (VARIABLE)' },
      { id: 'FUNCTION', topText: 'FUNCTION', label: KEY_SVGS.func, plainLbl: 'FUNCTION', normalAct: 'FUNCTION', cls: 'btn-880-nav', title: 'Hàm số f(x), g(x) (FUNCTION)' },
      { id: 'CATALOG', topText: 'CATALOG', label: KEY_SVGS.catalog, plainLbl: 'CATALOG', normalAct: 'CATALOG', cls: 'btn-880-nav', title: 'Danh mục hàm & hằng (CATALOG)' },
      { id: 'TOOLS', topText: 'TOOLS', label: KEY_SVGS.tools, plainLbl: 'TOOLS', normalAct: 'TOOLS', cls: 'btn-880-nav', title: 'Công cụ ứng dụng (TOOLS)' }
    ],

    // 2 hàng × 6 cột phím hàm khoa học
    sciRows: [
      [
        { id: 'K880_X', label: '<i>x</i>', plainLbl: 'x', shiftLbl: 'QR', normalAct: 'x', shiftAct: 'QR', cls: 'btn-880-sci' },
        { id: 'K880_FRAC', label: '■/□', plainLbl: '■/□', shiftLbl: '■■/□', normalAct: 'FRAC', shiftAct: 'MIXED', cls: 'btn-880-sci' },
        { id: 'K880_SQRT', label: '√■', plainLbl: '√■', shiftLbl: '■√□', normalAct: 'SQRT', shiftAct: 'ROOT', cls: 'btn-880-sci' },
        { id: 'K880_POW', label: '<i>x</i><sup>■</sup>', plainLbl: 'x^■', shiftLbl: '■⁻¹', normalAct: 'POW', shiftAct: 'INV', cls: 'btn-880-sci' },
        { id: 'K880_SQ', label: '<i>x</i>²', plainLbl: 'x²', shiftLbl: 'log', normalAct: 'SQ', shiftAct: 'log', cls: 'btn-880-sci' },
        { id: 'K880_LOG2', label: 'log<sub>■</sub>□', plainLbl: 'log■□', shiftLbl: 'ln', normalAct: 'LOG2', shiftAct: 'ln', cls: 'btn-880-sci' }
      ],
      [
        { id: 'K880_ANS', label: 'Ans', plainLbl: 'Ans', shiftLbl: 'PreAns', normalAct: 'ANS', shiftAct: 'PREANS', cls: 'btn-880-sci' },
        { id: 'K880_SIN', label: 'sin', plainLbl: 'sin', shiftLbl: 'sin⁻¹', normalAct: 'sin', shiftAct: 'asin', cls: 'btn-880-sci' },
        { id: 'K880_COS', label: 'cos', plainLbl: 'cos', shiftLbl: 'cos⁻¹', normalAct: 'cos', shiftAct: 'acos', cls: 'btn-880-sci' },
        { id: 'K880_TAN', label: 'tan', plainLbl: 'tan', shiftLbl: 'tan⁻¹', normalAct: 'tan', shiftAct: 'atan', cls: 'btn-880-sci' },
        { id: 'K880_LP', label: '(', plainLbl: '(', shiftLbl: '=', normalAct: '(', shiftAct: 'REL_EQ', cls: 'btn-880-sci' },
        { id: 'K880_RP', label: ')', plainLbl: ')', shiftLbl: ',', normalAct: ')', shiftAct: ',', cls: 'btn-880-sci' }
      ]
    ],

    // 4 hàng × 5 cột phím số và phép toán (phím tròn xám đậm)
    numRows: [
      [
        { id: 'K880_7', label: '7', plainLbl: '7', shiftLbl: 'π', normalAct: '7', shiftAct: 'PI', cls: 'btn-880-num' },
        { id: 'K880_8', label: '8', plainLbl: '8', shiftLbl: '<i>e</i>', normalAct: '8', shiftAct: 'E_CONST', cls: 'btn-880-num' },
        { id: 'K880_9', label: '9', plainLbl: '9', shiftLbl: '<i>i</i>', normalAct: '9', shiftAct: 'COMPLEX_I', cls: 'btn-880-num' },
        { id: 'K880_DEL', label: KEY_SVGS.del, plainLbl: '⌫', shiftLbl: 'INS', normalAct: 'DEL', shiftAct: 'INS', cls: 'btn-880-num btn-880-del' },
        { id: 'K880_AC', label: 'AC', plainLbl: 'AC', shiftLbl: 'OFF', normalAct: 'AC', shiftAct: 'OFF', cls: 'btn-880-num btn-880-ac' }
      ],
      [
        { id: 'K880_4', label: '4', plainLbl: '4', shiftLbl: 'A', normalAct: '4', shiftAct: 'VAR_A', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_5', label: '5', plainLbl: '5', shiftLbl: 'B', normalAct: '5', shiftAct: 'VAR_B', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_6', label: '6', plainLbl: '6', shiftLbl: 'C', normalAct: '6', shiftAct: 'VAR_C', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_MUL', label: '×', plainLbl: '×', shiftLbl: '', normalAct: '*', shiftAct: '*', cls: 'btn-880-num' },
        { id: 'K880_DIV', label: '÷', plainLbl: '÷', shiftLbl: '', normalAct: '/', shiftAct: '/', cls: 'btn-880-num' }
      ],
      [
        { id: 'K880_1', label: '1', plainLbl: '1', shiftLbl: 'D', normalAct: '1', shiftAct: 'VAR_D', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_2', label: '2', plainLbl: '2', shiftLbl: 'E', normalAct: '2', shiftAct: 'VAR_E', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_3', label: '3', plainLbl: '3', shiftLbl: 'F', normalAct: '3', shiftAct: 'VAR_F', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_ADD', label: '+', plainLbl: '+', shiftLbl: '°′″', normalAct: '+', shiftAct: 'DMS', cls: 'btn-880-num' },
        { id: 'K880_SUB', label: '−', plainLbl: '−', shiftLbl: '(−)', normalAct: '-', shiftAct: '(-)', cls: 'btn-880-num' }
      ],
      [
        { id: 'K880_0', label: '0', plainLbl: '0', shiftLbl: '<i>x</i>', normalAct: '0', shiftAct: 'VAR_x', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_DOT', label: '.', plainLbl: '.', shiftLbl: '<i>y</i>', normalAct: '.', shiftAct: 'VAR_y', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_EXP', label: '×10<sup>■</sup>', plainLbl: '×10^■', shiftLbl: '<i>z</i>', normalAct: 'EXP10', shiftAct: 'VAR_z', cls: 'btn-880-num', isVarShift: true },
        { id: 'K880_FMT', label: KEY_SVGS.format, plainLbl: 'FORMAT', shiftLbl: '', normalAct: 'FORMAT', shiftAct: 'FORMAT_MENU', cls: 'btn-880-num btn-880-format' },
        { id: 'K880_EXE', label: 'EXE', plainLbl: 'EXE', shiftLbl: '≈', normalAct: '=', shiftAct: 'APPROX_EQ', cls: 'btn-880-num btn-880-exe' }
      ]
    ]
  };

  // Thực đơn SETTINGS phân cấp (có nút radio ○/◉ và mũi tên ▶)
  function getSettingsTree(ctx) {
    var s = (ctx && ctx.settings) ? ctx.settings : {};
    var fixItems = [];
    for (var f = 0; f <= 9; f++) {
      fixItems.push({
        label: String(f),
        radio: true,
        selected: s.fmtMode === 'fix' && s.fmtDigits === f,
        action: 'SET_FMT_FIX',
        value: f
      });
    }
    var sciItems = [];
    for (var sc = 1; sc <= 10; sc++) {
      sciItems.push({
        label: String(sc),
        radio: true,
        selected: s.fmtMode === 'sci' && s.fmtDigits === sc,
        action: 'SET_FMT_SCI',
        value: sc
      });
    }

    return [
      {
        label: 'Calc Settings',
        children: [
          {
            label: 'Input/Output',
            children: [
              { label: 'MathI/MathO', radio: true, selected: s.ioMode === 'math', action: 'SET_IO_MATH' },
              { label: 'MathI/DecimalO', radio: true, selected: s.ioMode === 'math_dec', action: 'SET_IO_MATH_DEC' },
              { label: 'LineI/LineO', radio: true, selected: s.ioMode === 'line', action: 'SET_IO_LINE' },
              { label: 'LineI/DecimalO', radio: true, selected: s.ioMode === 'line_dec', action: 'SET_IO_LINE_DEC' }
            ]
          },
          {
            label: 'Angle Unit',
            children: [
              { label: 'Degree', radio: true, selected: s.angle === 'deg', action: 'SET_ANG_DEG' },
              { label: 'Radian', radio: true, selected: s.angle === 'rad', action: 'SET_ANG_RAD' },
              { label: 'Gradian', radio: true, selected: s.angle === 'gra', action: 'SET_ANG_GRA' }
            ]
          },
          {
            label: 'Number Format',
            children: [
              { label: 'Fix', children: fixItems },
              { label: 'Sci', children: sciItems },
              {
                label: 'Norm',
                children: [
                  { label: 'Norm 1', radio: true, selected: s.fmtMode === 'norm1', action: 'SET_FMT_NORM1' },
                  { label: 'Norm 2', radio: true, selected: s.fmtMode === 'norm2', action: 'SET_FMT_NORM2' }
                ]
              }
            ]
          },
          {
            label: 'Engineer Symbol',
            children: [
              { label: 'On', radio: true, selected: !!s.engSymbol, action: 'SET_ENG_SYM', value: true },
              { label: 'Off', radio: true, selected: !s.engSymbol, action: 'SET_ENG_SYM', value: false }
            ]
          },
          {
            label: 'Fraction Result',
            children: [
              { label: 'Mixed Fraction', radio: true, selected: s.fracMode === 'mixed', action: 'SET_FRAC_MIXED' },
              { label: 'Improp Fraction', radio: true, selected: s.fracMode !== 'mixed', action: 'SET_FRAC_IMPROPER' }
            ]
          },
          {
            label: 'Complex Result',
            children: [
              { label: 'a+bi', radio: true, selected: s.complexForm !== 'polar', action: 'SET_CPLX_RECT' },
              { label: 'r∠θ', radio: true, selected: s.complexForm === 'polar', action: 'SET_CPLX_POLAR' }
            ]
          },
          {
            label: 'Decimal Mark',
            children: [
              { label: 'Dot', radio: true, selected: s.decimalMark !== 'comma', action: 'SET_DEC_DOT' },
              { label: 'Comma', radio: true, selected: s.decimalMark === 'comma', action: 'SET_DEC_COMMA' }
            ]
          },
          {
            label: 'Digit Separator',
            children: [
              { label: 'On', radio: true, selected: !!s.digitSep, action: 'SET_SEP', value: true },
              { label: 'Off', radio: true, selected: !s.digitSep, action: 'SET_SEP', value: false }
            ]
          }
        ]
      },
      {
        label: 'System Settings',
        children: [
          {
            label: 'Contrast',
            children: [
              { label: 'Light', action: 'SET_CONTRAST' },
              { label: 'Normal', action: 'SET_CONTRAST' },
              { label: 'Dark', action: 'SET_CONTRAST' }
            ]
          },
          {
            label: 'Auto Power Off',
            children: [
              { label: '10 Min.', radio: true, selected: true, action: 'SET_CONTRAST' },
              { label: '60 Min.', radio: true, selected: false, action: 'SET_CONTRAST' }
            ]
          },
          {
            label: 'Font Size',
            children: [
              { label: 'Normal', radio: true, selected: s.fontSize !== 'small', action: 'SET_FONT_NORM' },
              { label: 'Small', radio: true, selected: s.fontSize === 'small', action: 'SET_FONT_SMALL' }
            ]
          }
        ]
      },
      {
        label: 'Reset',
        children: [
          { label: 'Settings & Data', action: 'RESET_SETTINGS_DATA' },
          { label: 'Variable Memory', action: 'RESET_VAR_MEM' },
          { label: 'Initialize All', action: 'RESET_ALL' }
        ]
      }
    ];
  }

  // Thực đơn CATALOG phân cấp đúng theo sách hướng dẫn fx-880BTG
  function getCatalogTree(ctx) {
    var tree = [];
    var appId = (ctx && ctx.currentAppId) || 'calc';

    if (ctx && ctx.verifyMode) {
      tree.push({
        label: 'Verify',
        children: [
          { label: '=', text: '=', evalText: '=' },
          { label: '≠', text: '≠', evalText: '≠' },
          { label: '>', text: '>', evalText: '>' },
          { label: '<', text: '<', evalText: '<' },
          { label: '≥', text: '≥', evalText: '≥' },
          { label: '≤', text: '≤', evalText: '≤' }
        ]
      });
    }

    if (appId === 'complex') {
      tree.push({
        label: 'Complex',
        children: [
          { label: 'i', text: 'i', evalText: 'i' },
          { label: 'Angle(∠)', text: '∠', evalText: '∠' },
          { label: 'Argument', text: 'Arg(', evalText: 'arg(' },
          { label: 'Conjugate', text: 'Conjg(', evalText: 'conj(' },
          { label: 'Real Part', text: 'ReP(', evalText: 're(' },
          { label: 'Imaginary Part', text: 'ImP(', evalText: 'im(' },
          { label: '▸r∠θ', text: '▶r∠θ', evalText: '▶r∠θ' },
          { label: '▸a+bi', text: '▶a+bi', evalText: '▶a+bi' }
        ]
      });
    } else if (appId === 'baseN') {
      tree.push({
        label: 'Base-N',
        children: [
          { label: 'Neg', text: 'Neg(' },
          { label: 'Not', text: 'Not(' },
          { label: 'and', text: ' and ' },
          { label: 'or', text: ' or ' },
          { label: 'xor', text: ' xor ' },
          { label: 'xnor', text: ' xnor ' },
          { label: 'd (Decimal)', text: 'd' },
          { label: 'h (Hexadecimal)', text: 'h' },
          { label: 'b (Binary)', text: 'b' },
          { label: 'o (Octal)', text: 'o' }
        ]
      });
    } else if (appId === 'matrix') {
      tree.push({
        label: 'Matrix',
        children: [
          { label: 'MatA', text: 'MatA' },
          { label: 'MatB', text: 'MatB' },
          { label: 'MatC', text: 'MatC' },
          { label: 'MatD', text: 'MatD' },
          { label: 'MatAns', text: 'MatAns' },
          { label: 'Determinant', text: 'Det(' },
          { label: 'Transposition', text: 'Trn(' },
          { label: 'Identity', text: 'Identity(' },
          { label: 'Ref', text: 'Ref(' },
          { label: 'Rref', text: 'Rref(' }
        ]
      });
    } else if (appId === 'vector') {
      tree.push({
        label: 'Vector',
        children: [
          { label: 'VctA', text: 'VctA' },
          { label: 'VctB', text: 'VctB' },
          { label: 'VctC', text: 'VctC' },
          { label: 'VctD', text: 'VctD' },
          { label: 'VctAns', text: 'VctAns' },
          { label: 'Dot Product', text: '·' },
          { label: 'Angle', text: 'Angle(' },
          { label: 'Unit Vector', text: 'UnitV(' }
        ]
      });
    } else if (appId === 'sheet') {
      tree.push({
        label: 'Spreadsheet',
        children: [
          { label: 'Grab ($)', text: '$' },
          { label: 'Min', text: 'Min(' },
          { label: 'Max', text: 'Max(' },
          { label: 'Mean', text: 'Mean(' },
          { label: 'Sum', text: 'Sum(' },
          { label: ':', text: ':' },
          { label: '=', text: '=' }
        ]
      });
    } else if (appId === 'eq') {
      tree.push({
        label: 'Equation',
        children: [
          { label: '=', text: '=', evalText: '=' }
        ]
      });
    }

    // 1. Func Analysis
    tree.push({
      label: 'Func Analysis',
      children: [
        { label: 'Derivative(d/dx)', tpl: 'deriv' },
        { label: 'Integration(∫)', tpl: 'integ' },
        { label: 'Summation(Σ)', tpl: 'sum' },
        { label: 'Product(Π)', tpl: 'prod' },
        { label: 'Remainder(÷R)', text: '÷R', evalText: '÷R' },
        { label: 'Logarithm(logab)', tpl: 'log2' },
        { label: 'Logarithm(log)', text: 'log(', evalText: 'log(' },
        { label: 'Natural Logarithm(ln)', text: 'ln(', evalText: 'ln(' }
      ]
    });

    // 2. Probability
    tree.push({
      label: 'Probability',
      children: [
        { label: '%', text: '%', evalText: '%' },
        { label: 'Factorial(!)', text: '!', evalText: '!' },
        { label: 'Permutation(P)', text: 'P', evalText: 'nPr' },
        { label: 'Combination(C)', text: 'C', evalText: 'nCr' },
        { label: 'Random Number(Ran#)', text: 'Ran#', evalText: 'ran#' },
        { label: 'Random Integer(RanInt#)', text: 'RanInt#(', evalText: 'ranint(' }
      ]
    });

    // 3. Numeric Calc
    tree.push({
      label: 'Numeric Calc',
      children: [
        { label: 'GCD', text: 'GCD(', evalText: 'gcd(' },
        { label: 'LCM', text: 'LCM(', evalText: 'lcm(' },
        { label: 'Absolute Value(Abs)', tpl: 'abs' },
        { label: 'Recurring Decimal', tpl: 'recur' },
        { label: 'Integer Part(Int)', text: 'Int(', evalText: 'int(' },
        { label: 'Largest Integer(Intg)', text: 'Intg(', evalText: 'intg(' },
        { label: 'Round Off(Rnd)', text: 'Rnd(', evalText: 'round(' }
      ]
    });

    // 4. Angle/Coord/Sexa
    tree.push({
      label: 'Angle/Coord/Sexa',
      children: [
        { label: 'Degrees(°)', text: '°', evalText: '°' },
        { label: 'Radians(ʳ)', text: 'ʳ', evalText: 'ʳ' },
        { label: 'Gradians(ᵍ)', text: 'ᵍ', evalText: 'ᵍ' },
        { label: 'Rect to Polar(Pol)', text: 'Pol(', evalText: 'Pol(' },
        { label: 'Polar to Rect(Rec)', text: 'Rec(', evalText: 'Rec(' },
        { label: 'Degs Mins Secs(°′″)', text: '°', evalText: '°' }
      ]
    });

    // 5. Hyperbolic/Trig
    tree.push({
      label: 'Hyperbolic/Trig',
      children: [
        { label: 'sinh', text: 'sinh(', evalText: 'sinh(' },
        { label: 'cosh', text: 'cosh(', evalText: 'cosh(' },
        { label: 'tanh', text: 'tanh(', evalText: 'tanh(' },
        { label: 'sinh⁻¹', text: 'sinh⁻¹(', evalText: 'asinh(' },
        { label: 'cosh⁻¹', text: 'cosh⁻¹(', evalText: 'acosh(' },
        { label: 'tanh⁻¹', text: 'tanh⁻¹(', evalText: 'atanh(' }
      ]
    });

    // 6. Engineer Symbol
    tree.push({
      label: 'Engineer Symbol',
      children: [
        { label: 'm (Milli)', text: 'm', evalText: 'm' },
        { label: 'μ (Micro)', text: 'μ', evalText: 'μ' },
        { label: 'n (Nano)', text: 'n', evalText: 'n' },
        { label: 'p (Pico)', text: 'p', evalText: 'p' },
        { label: 'f (Femto)', text: 'f', evalText: 'f' },
        { label: 'k (Kilo)', text: 'k', evalText: 'k' },
        { label: 'M (Mega)', text: 'M', evalText: 'M' },
        { label: 'G (Giga)', text: 'G', evalText: 'G' },
        { label: 'T (Tera)', text: 'T', evalText: 'T' },
        { label: 'P (Peta)', text: 'P', evalText: 'P' },
        { label: 'E (Exa)', text: 'E', evalText: 'E' }
      ]
    });

    // 7. Sci Constants
    var sciCats = [];
    if (CalcEngine && CalcEngine.constants) {
      for (var ci = 0; ci < CalcEngine.constants.length; ci++) {
        var cGrp = CalcEngine.constants[ci];
        var cKids = [];
        for (var cj = 0; cj < cGrp.items.length; cj++) {
          var cItem = cGrp.items[cj];
          cKids.push({
            label: cItem.sym880 + ' (' + cItem.desc + ')',
            text: cItem.sym880,
            evalText: cItem.token
          });
        }
        sciCats.push({ label: cGrp.name, children: cKids });
      }
    }
    tree.push({ label: 'Sci Constants', children: sciCats });

    // 8. Unit Conversions
    var convCats = [];
    if (CalcEngine && CalcEngine.conversions) {
      for (var ui = 0; ui < CalcEngine.conversions.length; ui++) {
        var uGrp = CalcEngine.conversions[ui];
        var uKids = [];
        for (var uj = 0; uj < uGrp.items.length; uj++) {
          var uItem = uGrp.items[uj];
          uKids.push({
            label: uItem.label880,
            text: uItem.label880,
            evalText: uItem.label
          });
        }
        convCats.push({ label: uGrp.name, children: uKids });
      }
    }
    tree.push({ label: 'Unit Conversions', children: convCats });

    // 9. Atomic Table (Periodic Table & Atomic Weight)
    tree.push({
      label: 'Atomic Table',
      children: [
        { label: 'Periodic Table', action: 'OPEN_PERIODIC_TABLE' },
        { label: 'Atomic Weight', text: 'AtWt(', evalText: 'AtWt(' }
      ]
    });

    // 10. Other
    tree.push({
      label: 'Other',
      children: [
        { label: ': (Multi-statement)', text: ':', evalText: ':' },
        { label: 'Ans', text: 'Ans', evalText: 'Ans' },
        { label: 'PreAns', text: 'PreAns', evalText: 'PreAns' },
        { label: 'π', text: 'π', evalText: 'pi' },
        { label: 'e', text: 'e', evalText: 'e' }
      ]
    });

    return tree;
  }

  // Thực đơn TOOLS theo ứng dụng đang mở trên Máy 880
  function getToolsMenu(appId, ctx) {
    var s = (ctx && ctx.settings) ? ctx.settings : {};
    var verifyItem = {
      label: (ctx && ctx.verifyMode) ? 'Verify OFF' : 'Verify ON',
      action: 'TOGGLE_VERIFY'
    };

    if (appId === 'calc' || appId === 'complex') {
      return [
        { label: 'Undo', action: 'UNDO' },
        verifyItem
      ];
    }
    if (appId === 'baseN') {
      return [
        { label: 'Decimal (DEC)', action: 'BASE_DEC' },
        { label: 'Hexadecimal (HEX)', action: 'BASE_HEX' },
        { label: 'Binary (BIN)', action: 'BASE_BIN' },
        { label: 'Octal (OCT)', action: 'BASE_OCT' }
      ];
    }
    if (appId === 'matrix') {
      return [
        { label: 'MatA', action: 'MAT_DIM', mat: 'MatA' },
        { label: 'MatB', action: 'MAT_DIM', mat: 'MatB' },
        { label: 'MatC', action: 'MAT_DIM', mat: 'MatC' },
        { label: 'MatD', action: 'MAT_DIM', mat: 'MatD' },
        { label: 'MatAns', action: 'MAT_ANS_VIEW' }
      ];
    }
    if (appId === 'vector') {
      return [
        { label: 'VctA', action: 'VCT_DIM', vct: 'VctA' },
        { label: 'VctB', action: 'VCT_DIM', vct: 'VctB' },
        { label: 'VctC', action: 'VCT_DIM', vct: 'VctC' },
        { label: 'VctD', action: 'VCT_DIM', vct: 'VctD' },
        { label: 'VctAns', action: 'VCT_ANS_VIEW' }
      ];
    }
    if (appId === 'stat') {
      return [
        {
          label: 'Frequency',
          children: [
            { label: 'On', radio: true, selected: !!s.statFreq, action: 'SET_STAT_FREQ', value: true },
            { label: 'Off', radio: true, selected: !s.statFreq, action: 'SET_STAT_FREQ', value: false }
          ]
        },
        {
          label: 'Sort',
          children: [
            { label: 'x Ascending', action: 'STAT_SORT_ASC' },
            { label: 'x Descending', action: 'STAT_SORT_DESC' }
          ]
        },
        { label: 'Insert Row', action: 'STAT_INS_ROW' },
        { label: 'Delete All', action: 'STAT_DEL_ALL' }
      ];
    }
    if (appId === 'sheet') {
      return [
        { label: 'Fill Formula', action: 'SHEET_FILL_FORMULA' },
        { label: 'Fill Value', action: 'SHEET_FILL_VALUE' },
        { label: 'Edit Cell', action: 'SHEET_EDIT_CELL' },
        { label: 'Delete All', action: 'SHEET_DEL_ALL' },
        { label: 'Recalculate', action: 'SHEET_RECALC' }
      ];
    }
    if (appId === 'table') {
      return [
        { label: 'Table Range', action: 'TBL_RANGE' },
        {
          label: 'Table Type',
          children: [
            { label: 'f(x)', radio: true, selected: !s.tableTwoFuncs, action: 'SET_TBL_1' },
            { label: 'f(x),g(x)', radio: true, selected: !!s.tableTwoFuncs, action: 'SET_TBL_2' }
          ]
        },
        {
          label: 'Define f(x)/g(x)',
          children: [
            { label: 'Define f(x)', action: 'DEFINE_F' },
            { label: 'Define g(x)', action: 'DEFINE_G' }
          ]
        },
        {
          label: 'Edit',
          children: [
            { label: 'Delete Row', action: 'TBL_DEL_ROW' },
            { label: 'Insert Row', action: 'TBL_INS_ROW' },
            { label: 'Delete All', action: 'TBL_DEL_ALL' }
          ]
        },
        verifyItem
      ];
    }
    if (appId === 'eq') {
      return [
        {
          label: 'Complex Roots',
          children: [
            { label: 'On', radio: true, selected: s.eqComplexRoots !== false, action: 'SET_EQ_CPLX', value: true },
            { label: 'Off', radio: true, selected: s.eqComplexRoots === false, action: 'SET_EQ_CPLX', value: false }
          ]
        },
        verifyItem
      ];
    }
    if (appId === 'mathbox') {
      return [
        { label: 'View Window', action: 'MB_VIEW_WIN' },
        { label: 'View Reset', action: 'MB_VIEW_RESET' }
      ];
    }
    return [{ label: 'Undo', action: 'UNDO' }];
  }

  // Thực đơn FORMAT của Máy 880
  function getFormatMenu(appId) {
    if (appId === 'complex') {
      return [
        { id: 'rect', label: 'a+bi' },
        { id: 'polar', label: 'r∠θ' },
        { id: 'decimal', label: 'Decimal' },
        { id: 'standard', label: 'Standard' }
      ];
    }
    return [
      { id: 'standard', label: 'Standard' },
      { id: 'decimal', label: 'Decimal' },
      { id: 'recurring', label: 'Recurring Decimal' },
      { id: 'improper', label: 'Improper Fraction' },
      { id: 'mixed', label: 'Mixed Fraction' },
      { id: 'dms', label: 'Sexagesimal' },
      { id: 'fact', label: 'Prime Factor' },
      { id: 'eng', label: 'ENG Notation' }
    ];
  }

  // Thực đơn FUNCTION f(x) của Máy 880
  function getFunctionMenu() {
    return [
      { label: 'f(x)', text: 'f(', evalText: 'f(' },
      { label: 'g(x)', text: 'g(', evalText: 'g(' },
      { label: 'Define f(x)', action: 'DEFINE_F' },
      { label: 'Define g(x)', action: 'DEFINE_G' }
    ];
  }

  CalcMachines['880'] = {
    id: '880',
    name: 'Máy 880',
    brandTitle: 'Máy tính Thầy Minh',
    brandSub: 'Kiểu 880',
    hasAlpha: false,
    execKey: 'EXE',
    selectKey: 'OK',
    variables: ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'],
    apps: APPS_880,
    keypad: KEYPAD_880,
    getSettingsTree: getSettingsTree,
    getCatalogTree: getCatalogTree,
    getToolsMenu: getToolsMenu,
    getFormatMenu: getFormatMenu,
    getFunctionMenu: getFunctionMenu
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
