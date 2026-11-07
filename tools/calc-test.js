// Kiểm tra tự động lõi toán học may-tinh/engine.js (>= 60 ca kiểm tra)
var path = require('path');
var CalcEngine = require(path.join(__dirname, '..', 'may-tinh', 'engine.js'));

var passed = 0;
var failed = 0;

function approxEq(a, b, tol) {
  tol = tol || 1e-9;
  if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) return false;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
}

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('PASS  ' + name);
  } else {
    failed++;
    console.log('FAIL  ' + name + (detail ? ' -> ' + detail : ''));
  }
}

function testEval(expr, opts, expVal, expExact, tol) {
  var r = CalcEngine.evalText(expr, opts);
  var ok = r && r.ok === true && approxEq(r.value, expVal, tol || 1e-9);
  if (ok && expExact !== undefined) {
    ok = (r.exact === expExact);
  }
  check(
    'evalText(' + JSON.stringify(expr) + ')',
    ok,
    'got ' + JSON.stringify(r) + ', expected val=' + expVal + (expExact !== undefined ? ', exact=' + expExact : '')
  );
  return r;
}

function testError(expr, opts, expErr) {
  var r = CalcEngine.evalText(expr, opts);
  var ok = r && r.ok === false && (!expErr || r.error === expErr);
  check(
    'evalError(' + JSON.stringify(expr) + ')',
    ok,
    'got ' + JSON.stringify(r)
  );
}

// 1-15: Số học cơ bản, thứ tự ưu tiên, nhân ngầm, hậu tố
testEval('2+3*4', null, 14, '14');
testEval('-2^2', null, -4, '-4');
testEval('(-2)^2', null, 4, '4');
testEval('2^3^2', null, 512, '512');
testEval('2^-3', null, 0.125, '1/8');
testEval('1/2+1/3', null, 5 / 6, '5/6');
testEval('3/4-1/6', null, 7 / 12, '7/12');
testEval('1.2E-3*1000', null, 1.2, '6/5');
testEval('2(3+1)', null, 8, '8');
testEval('6/2(1+2)', null, 1, '1');
testEval('2pi', null, 2 * Math.PI, '2π');
testEval('3sqrt(2)', null, 3 * Math.sqrt(2), '3√2');
testEval('5!', null, 120, '120');
testEval('50%', null, 0.5, '1/2');
testEval('4²+2³-2⁻¹', null, 23.5, '47/2');

// 16-30: Căn thức, lượng giác, tổ hợp, logarit
testEval('sqrt(8)', null, Math.sqrt(8), '2√2');
testEval('cbrt(-27)', null, -3, '-3');
testEval('root(4,81)', null, 3, '3');
testEval('abs(-7.5)', null, 7.5, '15/2');
testEval('sin(30)', { angle: 'deg' }, 0.5, '1/2');
testEval('cos(30)', { angle: 'deg' }, Math.sqrt(3) / 2, '√3/2');
testEval('sin(180)', { angle: 'deg' }, 0, '0');
testEval('cos(90)', { angle: 'deg' }, 0, '0');
testEval('tan(45)', { angle: 'deg' }, 1, '1');
testEval('sin(pi/6)', { angle: 'rad' }, 0.5, '1/2');
testEval('asin(0.5)', { angle: 'deg' }, 30, '30');
testEval('asin(1)', { angle: 'rad' }, Math.PI / 2, 'π/2');
testEval('acos(1/2)', { angle: 'deg' }, 60, '60');
testEval('atan(1)', { angle: 'deg' }, 45, '45');
testEval('sin(100)', { angle: 'gra' }, 1, '1');

// 31-45: Hàm nâng cao, biến, tích phân, đạo hàm, tổng, tích
testEval('sinh(0)', null, 0, '0');
testEval('cosh(0)', null, 1, '1');
testEval('tanh(0)', null, 0, '0');
testEval('5C2', null, 10, '10');
testEval('5nCr2', null, 10, '10');
testEval('5P2', null, 20, '20');
testEval('5nPr2', null, 20, '20');
testEval('log(1000)', null, 3, '3');
testEval('log(2,8)', null, 3, '3');
testEval('ln(e)', null, 1, '1');
testEval('exp(0)', null, 1, '1');
testEval('gcd(12,18)', null, 6, '6');
testEval('lcm(4,6)', null, 12, '12');
testEval('int(-3.7)', null, -3, '-3');
testEval('intg(-3.7)', null, -4, '-4');

// 46-56: Phân số, hỗn số, DMS, ÷R, Pol/Rec, biến, giải tích
testEval('frac(3,4)+frac(1,2)', null, 1.25, '5/4');
testEval('mixed(1,2,3)', null, 5 / 3, '5/3');
testEval('dms(12,30,0)', null, 12.5, '25/2');
var divR = testEval('17÷R5', null, 3, 'q=3, r=2');
check('17÷R5 extra', divR.extra && divR.extra.q === 3 && divR.extra.r === 2, JSON.stringify(divR.extra));
var polRes = testEval('Pol(3,4)', { angle: 'deg' }, 5, '5');
check('Pol(3,4) extra', polRes.extra && approxEq(polRes.extra[0], 5) && approxEq(polRes.extra[1], 53.13010235415598), JSON.stringify(polRes.extra));
var recRes = testEval('Rec(2,60)', { angle: 'deg' }, 1, '1');
check('Rec(2,60) extra', recRes.extra && approxEq(recRes.extra[0], 1) && approxEq(recRes.extra[1], Math.sqrt(3)), JSON.stringify(recRes.extra));
testEval('2A+3B', { vars: { A: 4, B: -1 } }, 5, '5');
testEval('integ(x^2,0,3)', null, 9, '9', 1e-6);
testEval('deriv(x^3,2)', null, 12, '12', 1e-6);
testEval('sum(x,1,100)', null, 5050, '5050');
testEval('prod(x,1,5)', null, 120, '120');

// 57-61: Kiểm tra bắt lỗi toán học và cú pháp
testError('1/0', null, 'Lỗi toán');
testError('sqrt(-4)', null, 'Lỗi toán');
testError('log(0)', null, 'Lỗi toán');
testError('tan(90)', { angle: 'deg' }, 'Lỗi toán');
testError('70!', null, 'Lỗi toán');

// 62-68: Nhận dạng chính xác toExact, format, toDMS, toMixed, factorize, toEng
check('toExact((1+sqrt(5))/2)', CalcEngine.toExact((1 + Math.sqrt(5)) / 2) === '1/2+√5/2', CalcEngine.toExact((1 + Math.sqrt(5)) / 2));
check('format(1/3, norm1)', CalcEngine.format(1 / 3, { mode: 'norm1' }) === '0.3333333333', CalcEngine.format(1 / 3, { mode: 'norm1' }));
check('format(0.001, norm1)', CalcEngine.format(0.001, { mode: 'norm1' }) === '1×10^-3', CalcEngine.format(0.001, { mode: 'norm1' }));
check('format(0.001, norm2)', CalcEngine.format(0.001, { mode: 'norm2' }) === '0.001', CalcEngine.format(0.001, { mode: 'norm2' }));
check('toDMS(12.5)', CalcEngine.toDMS(12.5) === '12°30\'0"', CalcEngine.toDMS(12.5));
check('toMixed(3,2)', CalcEngine.toMixed(3, 2) === '1 1/2', CalcEngine.toMixed(3, 2));
check('factorize(360)', CalcEngine.factorize(360) === '2^3×3^2×5', CalcEngine.factorize(360));
check('toEng(12345)', CalcEngine.toEng(12345) === '12.345×10^3', CalcEngine.toEng(12345));

// 69-74: Giải phương trình đa thức solvePoly (bậc 2, 3, 4)
var p1 = CalcEngine.solvePoly([1, -3, 2]);
check('solvePoly([1,-3,2])', p1.roots.length === 2 && approxEq(p1.roots[0].re, 2) && approxEq(p1.roots[1].re, 1) && p1.extremum && approxEq(p1.extremum.x, 1.5), JSON.stringify(p1));

var p2 = CalcEngine.solvePoly([1, 0, -2]);
check('solvePoly([1,0,-2])', p2.roots.length === 2 && p2.roots[0].exact === '√2' && p2.roots[1].exact === '-√2', JSON.stringify(p2));

var p3 = CalcEngine.solvePoly([1, 1, 1]);
check('solvePoly([1,1,1])', p3.roots.length === 2 && p3.roots[0].exact === '-1/2+√3/2 i' && p3.roots[1].exact === '-1/2-√3/2 i', JSON.stringify(p3));

var pDouble = CalcEngine.solvePoly([1, -4, 4]);
check('solvePoly([1,-4,4]) nghiệm kép', pDouble.roots.length === 1 && pDouble.roots[0].exact === '2', JSON.stringify(pDouble));

var pCubic = CalcEngine.solvePoly([1, -6, 11, -6]);
check('solvePoly([1,-6,11,-6])', pCubic.roots.length === 3 && approxEq(pCubic.roots[0].re, 3) && approxEq(pCubic.roots[1].re, 2) && approxEq(pCubic.roots[2].re, 1), JSON.stringify(pCubic));

var pQuartic = CalcEngine.solvePoly([1, 0, -5, 0, 4]);
check('solvePoly([1,0,-5,0,4])', pQuartic.roots.length === 4 && approxEq(pQuartic.roots[0].re, 2) && approxEq(pQuartic.roots[1].re, 1) && approxEq(pQuartic.roots[2].re, -1) && approxEq(pQuartic.roots[3].re, -2), JSON.stringify(pQuartic));

// 75-78: Giải hệ phương trình tuyến tính solveLinear
var lin1 = CalcEngine.solveLinear([[1, 1], [1, -1]], [3, 1]);
check('solveLinear 2x2', lin1.solution && approxEq(lin1.solution[0], 2) && approxEq(lin1.solution[1], 1), JSON.stringify(lin1));

var lin3 = CalcEngine.solveLinear([[1, 1, 1], [0, 2, 5], [2, 5, -1]], [6, -4, 27]);
check('solveLinear 3x3', lin3.solution && approxEq(lin3.solution[0], 5) && approxEq(lin3.solution[1], 3) && approxEq(lin3.solution[2], -2), JSON.stringify(lin3));

var linNo = CalcEngine.solveLinear([[1, 1], [1, 1]], [2, 3]);
check('solveLinear vô nghiệm', linNo.error === 'Vô nghiệm', JSON.stringify(linNo));

var linInf = CalcEngine.solveLinear([[1, 2], [2, 4]], [3, 6]);
check('solveLinear vô số nghiệm', linInf.error === 'Vô số nghiệm', JSON.stringify(linInf));

// 79-83: Giải bất phương trình solveIneq
var ineq1 = CalcEngine.solveIneq([1, -3, 2], '>');
check('solveIneq([1,-3,2], ">")', ineq1.text === 'x<1, 2<x', JSON.stringify(ineq1));

var ineq2 = CalcEngine.solveIneq([1, -3, 2], '<=');
check('solveIneq([1,-3,2], "<=")', ineq2.text === '1≤x≤2', JSON.stringify(ineq2));

var ineq3 = CalcEngine.solveIneq([1, 0, 1], '<');
check('solveIneq([1,0,1], "<")', ineq3.text === 'Vô nghiệm', JSON.stringify(ineq3));

var ineq4 = CalcEngine.solveIneq([1, 0, 1], '>');
check('solveIneq([1,0,1], ">")', ineq4.text === 'Mọi số thực', JSON.stringify(ineq4));

var ineq5 = CalcEngine.solveIneq([1, -4, 4], '<=');
check('solveIneq([1,-4,4], "<=")', ineq5.text === 'x=2', JSON.stringify(ineq5));

// 84-88: SOLVE, Bảng giá trị, Thống kê 1 biến, Thống kê 2 biến, Tỉ lệ thức
var numSol = CalcEngine.solveNumeric('x^2=2', 1, { angle: 'deg' });
check('solveNumeric("x^2=2", 1)', approxEq(numSol.x, Math.sqrt(2)) && Math.abs(numSol.lr) < 1e-9, JSON.stringify(numSol));

var tbl = CalcEngine.table('x^2', '2x', 1, 5, 1);
check('table("x^2", "2x", 1, 5, 1)', Array.isArray(tbl) && tbl.length === 5 && tbl[2].x === 3 && tbl[2].f === 9 && tbl[2].g === 6, JSON.stringify(tbl));

var tblErr = CalcEngine.table('x', null, 1, 100, 1);
check('table quá 45 dòng', tblErr.error === 'Quá phạm vi', JSON.stringify(tblErr));

var st1 = CalcEngine.stat1([1, 2, 3, 4, 5]);
check(
  'stat1([1,2,3,4,5])',
  st1.n === 5 && approxEq(st1.mean, 3) && approxEq(st1.sigma, Math.sqrt(2)) &&
  approxEq(st1.s, Math.sqrt(2.5), 1e-7) && st1.med === 3 && st1.q1 === 1.5 && st1.q3 === 4.5,
  JSON.stringify(st1)
);

var st2 = CalcEngine.stat2([1, 2, 3], [2, 4, 6], null, 'lin');
check(
  'stat2([1,2,3],[2,4,6],null,"lin")',
  approxEq(st2.a, 0) && approxEq(st2.b, 2) && approxEq(st2.r, 1) && approxEq(st2.estY(5), 10) && approxEq(st2.estX(8), 4),
  JSON.stringify(st2)
);

check('ratio(1, 2, 3, 6)', approxEq(CalcEngine.ratio(1, 2, 3, 6), 4), String(CalcEngine.ratio(1, 2, 3, 6)));
check('ratio(2, 2, 3, 6)', approxEq(CalcEngine.ratio(2, 2, 3, 6), 9), String(CalcEngine.ratio(2, 2, 3, 6)));

// 95-100: Kiểm tra bộ soạn biểu thức CalcEditor (cây -> văn bản -> tính toán)
var CalcEditor = require(path.join(__dirname, '..', 'may-tinh', 'editor.js'));
var ed = CalcEditor.create(false);
CalcEditor.insertToken(ed, '1', '1');
CalcEditor.insertTemplate(ed, 'frac'); // hút 1 vào tử, nhảy xuống mẫu
CalcEditor.insertToken(ed, '2', '2');
CalcEditor.moveRight(ed); // thoát khỏi mẫu phân số
CalcEditor.insertToken(ed, '+', '+');
CalcEditor.insertTemplate(ed, 'frac');
CalcEditor.insertToken(ed, '1', '1');
CalcEditor.moveDown(ed);
CalcEditor.insertToken(ed, '3', '3');
var edExpr = CalcEditor.toEvalText(ed);
var edEval = CalcEngine.evalText(edExpr);
check('CalcEditor 1/2 + 1/3 -> 5/6', edEval.ok && edEval.exact === '5/6', edExpr + ' -> ' + JSON.stringify(edEval));

var edInt = CalcEditor.create(false);
CalcEditor.insertTemplate(edInt, 'integ');
CalcEditor.insertToken(edInt, 'x', 'x');
CalcEditor.insertToken(edInt, '²', '²');
CalcEditor.moveDown(edInt);
CalcEditor.insertToken(edInt, '0', '0');
CalcEditor.moveUp(edInt);
CalcEditor.insertToken(edInt, '3', '3');
var intExpr = CalcEditor.toEvalText(edInt);
var intEval = CalcEngine.evalText(intExpr);
check('CalcEditor tích phân x² từ 0 đến 3 = 9', intEval.ok && approxEq(intEval.value, 9), intExpr + ' -> ' + JSON.stringify(intEval));

// ===========================================================================
// KIỂM TRA GIAI ĐOẠN 2 (>= 50 ca kiểm tra mới)
// ===========================================================================

// 1. Số phức (CalcEngine.complex.evalComplex)
function testComplex(expr, opts, expRe, expIm, expExact) {
  var r = CalcEngine.complex.evalComplex(expr, opts);
  var ok = r && r.ok === true && approxEq(r.re, expRe) && approxEq(r.im, expIm);
  if (ok && expExact !== undefined) {
    ok = (r.exact === expExact);
  }
  check(
    'evalComplex(' + JSON.stringify(expr) + ')',
    ok,
    'got ' + JSON.stringify(r) + ', expected re=' + expRe + ', im=' + expIm + (expExact !== undefined ? ', exact=' + expExact : '')
  );
  return r;
}

testComplex('(1+i)(1-i)', { angle: 'deg' }, 2, 0, '2');
testComplex('(1+i)^2', { angle: 'deg' }, 0, 2, '2i');
testComplex('1/(1+i)', { angle: 'deg' }, 0.5, -0.5, '1/2-1/2i');
testComplex('(1+i)^-1', { angle: 'deg' }, 0.5, -0.5, '1/2-1/2i');
testComplex('i^2', { angle: 'deg' }, -1, 0, '-1');
testComplex('abs(3+4i)', { angle: 'deg' }, 5, 0, '5');
testComplex('arg(1+i)', { angle: 'deg' }, 45, 0, '45');
testComplex('arg(i)', { angle: 'deg' }, 90, 0, '90');
testComplex('sqrt(-9)', { angle: 'deg' }, 0, 3, '3i');
testComplex('sqrt(-4)', { angle: 'deg' }, 0, 2, '2i');
testComplex('conj(3+4i)', { angle: 'deg' }, 3, -4, '3-4i');
testComplex('re(3-4i)', { angle: 'deg' }, 3, 0, '3');
testComplex('im(3-4i)', { angle: 'deg' }, -4, 0, '-4');
var cPol = testComplex('1∠60', { angle: 'deg' }, 0.5, Math.sqrt(3) / 2, '1/2+√3/2i');
check('1∠60 polar info', cPol.polar && approxEq(cPol.polar.r, 1) && approxEq(cPol.polar.theta, 60) && cPol.polar.exact === '1∠60', JSON.stringify(cPol.polar));
testComplex('1+i', { angle: 'deg', form: 'polar' }, 1, 1, '√2∠45');

// 2. Cơ số N (CalcEngine.baseN)
function testBaseN(expr, base, expDisp, expVal) {
  var r = CalcEngine.baseN(expr, base);
  var ok = r && r.ok === true && r.display === expDisp && (expVal === undefined || r.value === expVal);
  check(
    'baseN(' + JSON.stringify(expr) + ', ' + base + ')',
    ok,
    'got ' + JSON.stringify(r) + ', expected display=' + expDisp
  );
}

testBaseN('hFF+1', 16, '100', 256);
testBaseN('-1', 16, 'FFFFFFFF', -1);
testBaseN('b1010 and b0110', 2, '10', 2);
testBaseN('d10', 2, '1010', 10);
testBaseN('b1010 or b0101', 2, '1111', 15);
testBaseN('b1010 xor b1100', 2, '110', 6);
testBaseN('not 0', 16, 'FFFFFFFF', -1);
testBaseN('neg 5', 10, '-5', -5);
testBaseN('o17+o1', 8, '20', 16);
testBaseN('15/4', 10, '3', 3);
var bOverflow = CalcEngine.baseN('2147483647+1', 10);
check('baseN tràn 32-bit -> Lỗi toán', bOverflow.ok === false && bOverflow.error === 'Lỗi toán', JSON.stringify(bOverflow));

// 3. Ma trận (CalcEngine.matrix)
var mDet2 = CalcEngine.matrix.det([[1, 2], [3, 4]]);
check('matrix.det([[1,2],[3,4]]) = -2', approxEq(mDet2, -2), String(mDet2));

var mInv2 = CalcEngine.matrix.inv([[1, 2], [3, 4]]);
check(
  'matrix.inv([[1,2],[3,4]]) = [[-2,1],[1.5,-0.5]]',
  Array.isArray(mInv2) && approxEq(mInv2[0][0], -2) && approxEq(mInv2[0][1], 1) &&
  approxEq(mInv2[1][0], 1.5) && approxEq(mInv2[1][1], -0.5),
  JSON.stringify(mInv2)
);

var mMul = CalcEngine.matrix.mul([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 1], [2, 3]]);
check(
  'matrix.mul 2x3 * 3x2',
  Array.isArray(mMul) && mMul.length === 2 && mMul[0].length === 2 &&
  mMul[0][0] === 31 && mMul[0][1] === 19 && mMul[1][0] === 85 && mMul[1][1] === 55,
  JSON.stringify(mMul)
);

var mDet3Zero = CalcEngine.matrix.det([[2, 0, 1], [1, 3, 2], [1, 1, 1]]);
check('matrix.det 3x3 [[2,0,1],[1,3,2],[1,1,1]] = 0', approxEq(mDet3Zero, 0), String(mDet3Zero));

var mDet3 = CalcEngine.matrix.det([[2, 0, 1], [1, 2, 1], [1, 1, 1]]);
check('matrix.det 3x3 [[2,0,1],[1,2,1],[1,1,1]] = 1', approxEq(mDet3, 1), String(mDet3));

var mAdd = CalcEngine.matrix.add([[1, 2], [3, 4]], [[5, 6], [7, 8]]);
check('matrix.add 2x2', mAdd[0][0] === 6 && mAdd[1][1] === 12, JSON.stringify(mAdd));

var mSub = CalcEngine.matrix.sub([[5, 6], [7, 8]], [[1, 2], [3, 4]]);
check('matrix.sub 2x2', mSub[0][0] === 4 && mSub[1][1] === 4, JSON.stringify(mSub));

var mScale = CalcEngine.matrix.scale(3, [[1, -2], [0, 4]]);
check('matrix.scale', mScale[0][0] === 3 && mScale[0][1] === -6 && mScale[1][1] === 12, JSON.stringify(mScale));

var mTrn = CalcEngine.matrix.trn([[1, 2, 3], [4, 5, 6]]);
check('matrix.trn 2x3 -> 3x2', mTrn.length === 3 && mTrn[0].length === 2 && mTrn[2][1] === 6, JSON.stringify(mTrn));

var mPow = CalcEngine.matrix.pow([[1, 1], [1, 0]], 5);
check('matrix.pow([[1,1],[1,0]], 5)', mPow[0][0] === 8 && mPow[0][1] === 5 && mPow[1][0] === 5 && mPow[1][1] === 3, JSON.stringify(mPow));

var mId = CalcEngine.matrix.identity(3);
check('matrix.identity(3)', mId.length === 3 && mId[0][0] === 1 && mId[1][1] === 1 && mId[0][1] === 0, JSON.stringify(mId));

var mRref = CalcEngine.matrix.rref([[1, 2, -1, -4], [2, 3, -1, -11], [-2, 0, -3, 22]]);
check('matrix.rref 3x4', approxEq(mRref[0][3], -8) && approxEq(mRref[1][3], 1) && approxEq(mRref[2][3], -2), JSON.stringify(mRref));

var mRef = CalcEngine.matrix.ref([[2, 4], [1, 3]]);
check('matrix.ref 2x2', approxEq(mRef[0][0], 1) && approxEq(mRef[1][0], 0) && approxEq(mRef[1][1], 1), JSON.stringify(mRef));

var mDimErr = CalcEngine.matrix.add([[1, 2]], [[1, 2, 3]]);
check('matrix lỗi kích thước', mDimErr && mDimErr.error === 'Lỗi kích thước', JSON.stringify(mDimErr));

var mSingErr = CalcEngine.matrix.inv([[1, 2], [2, 4]]);
check('matrix không khả nghịch -> Lỗi toán', mSingErr && mSingErr.error === 'Lỗi toán', JSON.stringify(mSingErr));

// 4. Vectơ (CalcEngine.vector)
check('vector.dot([1,2,3],[4,5,6]) = 32', CalcEngine.vector.dot([1, 2, 3], [4, 5, 6]) === 32, String(CalcEngine.vector.dot([1, 2, 3], [4, 5, 6])));
var vCross = CalcEngine.vector.cross([1, 0, 0], [0, 1, 0]);
check('vector.cross([1,0,0],[0,1,0]) = [0,0,1]', Array.isArray(vCross) && vCross[0] === 0 && vCross[1] === 0 && vCross[2] === 1, JSON.stringify(vCross));
var vCross2D = CalcEngine.vector.cross([1, 2], [3, 4]);
check('vector.cross 2D (z=0)', vCross2D[0] === 0 && vCross2D[1] === 0 && vCross2D[2] === -2, JSON.stringify(vCross2D));
check('vector.angle([1,0],[0,1]) = 90', approxEq(CalcEngine.vector.angle([1, 0], [0, 1]), 90), String(CalcEngine.vector.angle([1, 0], [0, 1])));
check('vector.norm([3,4]) = 5', approxEq(CalcEngine.vector.norm([3, 4]), 5), String(CalcEngine.vector.norm([3, 4])));
var vUnit = CalcEngine.vector.unit([3, 4]);
check('vector.unit([3,4]) = [0.6, 0.8]', approxEq(vUnit[0], 0.6) && approxEq(vUnit[1], 0.8), JSON.stringify(vUnit));
var vAdd = CalcEngine.vector.add([1, 2], [3, -1]);
check('vector.add', vAdd[0] === 4 && vAdd[1] === 1, JSON.stringify(vAdd));
var vSub = CalcEngine.vector.sub([5, 2], [3, -1]);
check('vector.sub', vSub[0] === 2 && vSub[1] === 3, JSON.stringify(vSub));

// 5. Phân phối xác suất (CalcEngine.dist)
check('dist.normCD(-1,1,1,0) ≈ 0.6826894921', approxEq(CalcEngine.dist.normCD(-1, 1, 1, 0), 0.6826894921370859, 1e-10), String(CalcEngine.dist.normCD(-1, 1, 1, 0)));
check('dist.normPD(0,1,0) ≈ 0.3989422804', approxEq(CalcEngine.dist.normPD(0, 1, 0), 0.3989422804014327, 1e-10), String(CalcEngine.dist.normPD(0, 1, 0)));
check('dist.invN(0.975,1,0) ≈ 1.959963985', approxEq(CalcEngine.dist.invN(0.975, 1, 0), 1.959963984540054, 1e-9), String(CalcEngine.dist.invN(0.975, 1, 0)));
check('dist.binomPD(3,10,0.5) ≈ 0.1171875', approxEq(CalcEngine.dist.binomPD(3, 10, 0.5), 0.1171875, 1e-10), String(CalcEngine.dist.binomPD(3, 10, 0.5)));
check('dist.binomCD(3,10,0.5) ≈ 0.171875', approxEq(CalcEngine.dist.binomCD(3, 10, 0.5), 0.171875, 1e-10), String(CalcEngine.dist.binomCD(3, 10, 0.5)));
check('dist.poissonPD(2,3) ≈ 0.2240418077', approxEq(CalcEngine.dist.poissonPD(2, 3), 0.22404180765538775, 1e-10), String(CalcEngine.dist.poissonPD(2, 3)));
check('dist.poissonCD(2,3)', approxEq(CalcEngine.dist.poissonCD(2, 3), 8.5 * Math.exp(-3), 1e-10), String(CalcEngine.dist.poissonCD(2, 3)));
var bList = CalcEngine.dist.binomPD([0, 1, 2], 2, 0.5);
check('dist.binomPD nhận danh sách x', Array.isArray(bList) && approxEq(bList[0], 0.25) && approxEq(bList[1], 0.5) && approxEq(bList[2], 0.25), JSON.stringify(bList));

// 6. Bảng tính (CalcEngine.sheet)
var sh = CalcEngine.sheet.newSheet();
CalcEngine.sheet.setCell(sh, 'A1', 2);
CalcEngine.sheet.setCell(sh, 'A2', 3);
CalcEngine.sheet.setCell(sh, 'B1', '=A1+A2');
check('sheet A1=2, A2=3, B1==A1+A2 -> 5', CalcEngine.sheet.getValue(sh, 'B1') === 5, String(CalcEngine.sheet.getValue(sh, 'B1')));
CalcEngine.sheet.setCell(sh, 'A1', 10);
check('sheet đổi A1=10 -> B1=13', CalcEngine.sheet.getValue(sh, 'B1') === 13, String(CalcEngine.sheet.getValue(sh, 'B1')));

CalcEngine.sheet.setCell(sh, 'A3', 5);
CalcEngine.sheet.setCell(sh, 'C1', '=Sum(A1:A3)');
CalcEngine.sheet.setCell(sh, 'C2', '=Mean(A1:A3)');
CalcEngine.sheet.setCell(sh, 'C3', '=Min(A1:A3)');
CalcEngine.sheet.setCell(sh, 'C4', '=Max(A1:A3)');
check('sheet Sum/Mean/Min/Max',
  CalcEngine.sheet.getValue(sh, 'C1') === 18 &&
  CalcEngine.sheet.getValue(sh, 'C2') === 6 &&
  CalcEngine.sheet.getValue(sh, 'C3') === 3 &&
  CalcEngine.sheet.getValue(sh, 'C4') === 10,
  JSON.stringify([CalcEngine.sheet.getValue(sh, 'C1'), CalcEngine.sheet.getValue(sh, 'C2'), CalcEngine.sheet.getValue(sh, 'C3'), CalcEngine.sheet.getValue(sh, 'C4')])
);

CalcEngine.sheet.fillFormula(sh, '=A1*2', 'D1:D3');
check('sheet fillFormula =A1*2 vào D1:D3',
  CalcEngine.sheet.getValue(sh, 'D1') === 20 &&
  CalcEngine.sheet.getValue(sh, 'D2') === 6 &&
  CalcEngine.sheet.getValue(sh, 'D3') === 10 &&
  CalcEngine.sheet.getRaw(sh, 'D2') === '=A2*2',
  JSON.stringify([CalcEngine.sheet.getValue(sh, 'D1'), CalcEngine.sheet.getValue(sh, 'D2'), CalcEngine.sheet.getValue(sh, 'D3'), CalcEngine.sheet.getRaw(sh, 'D2')])
);

CalcEngine.sheet.setCell(sh, 'E1', '=E2+1');
CalcEngine.sheet.setCell(sh, 'E2', '=E1+1');
check('sheet phát hiện tham chiếu vòng -> Lỗi', CalcEngine.sheet.getValue(sh, 'E1') === 'Lỗi' && CalcEngine.sheet.getValue(sh, 'E2') === 'Lỗi', String(CalcEngine.sheet.getValue(sh, 'E1')));

// 7. Hộp toán học (CalcEngine.mathbox)
var dice1 = CalcEngine.mathbox.rollDice(50, 2, 12345);
var dice2 = CalcEngine.mathbox.rollDice(50, 2, 12345);
var totalFreq = 0;
for (var di = 0; di < dice1.freq.length; di++) totalFreq += dice1.freq[di];
check(
  'mathbox.rollDice cùng seed cho cùng kết quả & tổng tần số = số lần thử',
  JSON.stringify(dice1.results) === JSON.stringify(dice2.results) && totalFreq === 50,
  'totalFreq=' + totalFreq
);

var coin1 = CalcEngine.mathbox.tossCoin(40, 3, 999);
var coin2 = CalcEngine.mathbox.tossCoin(40, 3, 999);
var totalCoinFreq = 0;
for (var ci = 0; ci < coin1.freq.length; ci++) totalCoinFreq += coin1.freq[ci];
check(
  'mathbox.tossCoin cùng seed cho cùng kết quả & tổng tần số = 40',
  JSON.stringify(coin1.results) === JSON.stringify(coin2.results) && totalCoinFreq === 40,
  'totalCoinFreq=' + totalCoinFreq
);

// 8. Thuật toán (CalcEngine.algo)
var sqProg = [
  { op: 'set', v: 'A', expr: '1' },
  {
    op: 'repeat',
    n: '5',
    body: [
      { op: 'print', expr: 'A^2' },
      { op: 'set', v: 'A', expr: 'A+1' }
    ]
  }
];
var sqRes = CalcEngine.algo.run(sqProg);
check(
  'algo in bình phương 1..5 -> ["1","4","9","16","25"]',
  sqRes.ok && JSON.stringify(sqRes.output) === JSON.stringify(['1', '4', '9', '16', '25']),
  JSON.stringify(sqRes)
);

var condProg = [
  { op: 'input', v: 'A' },
  { op: 'if', cond: 'A>=5 and A<10', then: [{ op: 'print', text: 'Đạt' }], else: [{ op: 'print', text: 'Không' }] }
];
var condRes = CalcEngine.algo.run(condProg, { inputs: [7] });
check('algo input + if/else + and', condRes.ok && condRes.output[0] === 'Đạt' && condRes.vars.A === 7, JSON.stringify(condRes));

var infProg = [
  { op: 'set', v: 'A', expr: '1' },
  { op: 'while', cond: 'A>0', body: [{ op: 'set', v: 'A', expr: 'A+1' }] }
];
var infRes = CalcEngine.algo.run(infProg);
check('algo giới hạn 10000 bước -> Quá nhiều bước', infRes.ok === false && infRes.error === 'Quá nhiều bước', JSON.stringify(infRes));

var turtleProg = [
  { op: 'repeat', n: '4', body: [{ op: 'move', expr: '20' }, { op: 'turn', expr: '90' }] }
];
var turtleRes = CalcEngine.algo.run(turtleProg);
check('algo lệnh rùa vẽ hình vuông (4 đoạn)', turtleRes.ok && turtleRes.turtle.lines.length === 4 && approxEq(turtleRes.turtle.x, 0) && approxEq(turtleRes.turtle.y, 0), JSON.stringify(turtleRes.turtle));

console.log('\nTổng kết: ' + passed + '/' + (passed + failed) + ' ca kiểm tra đạt (' + failed + ' trượt).');
if (failed > 0) {
  process.exit(1);
}
