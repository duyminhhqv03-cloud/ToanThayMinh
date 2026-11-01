var assert = require('assert');
var QuizFormat = require('../hoc/quiz-format.js');

function testFrac() {
  // 1. 234/100
  var t1 = QuizFormat.mathTokens('234/100');
  assert.deepStrictEqual(t1, [{ t: 'frac', n: '234', d: '100' }], 'Ca 234/100');

  // 2. 2 34/100 (hỗn số)
  var t2 = QuizFormat.mathTokens('2 34/100');
  assert.deepStrictEqual(t2, [{ t: 'mixed', whole: '2', n: '34', d: '100' }], 'Ca 2 34/100');

  // 3. 23 4/100 (hỗn số)
  var t3 = QuizFormat.mathTokens('23 4/100');
  assert.deepStrictEqual(t3, [{ t: 'mixed', whole: '23', n: '4', d: '100' }], 'Ca 23 4/100');

  // 4. 400 000/1000 000 (nhóm nghìn)
  var t4 = QuizFormat.mathTokens('400 000/1000 000');
  assert.deepStrictEqual(t4, [{ t: 'frac', n: '400 000', d: '1000 000' }], 'Ca 400 000/1000 000');

  // 5. 2 345/1000 (nhóm nghìn, không phải hỗn số)
  var t5 = QuizFormat.mathTokens('2 345/1000');
  assert.deepStrictEqual(t5, [{ t: 'frac', n: '2 345', d: '1000' }], 'Ca 2 345/1000');

  // 6. 24/10/2026 (ngày tháng, không phải phân số)
  var t6 = QuizFormat.mathTokens('24/10/2026');
  assert.deepStrictEqual(t6, [{ t: 'text', v: '24/10/2026' }], 'Ca 24/10/2026');

  // 7. km/h (đơn vị, không phải phân số)
  var t7 = QuizFormat.mathTokens('km/h');
  assert.deepStrictEqual(t7, [{ t: 'text', v: 'km/h' }], 'Ca km/h');

  // 8. 65/10 000 (mẫu có nhóm nghìn)
  var t8 = QuizFormat.mathTokens('65/10 000');
  assert.deepStrictEqual(t8, [{ t: 'frac', n: '65', d: '10 000' }], 'Ca 65/10 000');

  // 9. 3,5/2 (tử là số thập phân có phẩy)
  var t9 = QuizFormat.mathTokens('3,5/2');
  assert.deepStrictEqual(t9, [{ t: 'frac', n: '3,5', d: '2' }], 'Ca 3,5/2');

  // 10. Văn bản xen kẽ
  var t10 = QuizFormat.mathTokens('Tính 1/2 + 3/4 = ? Đã đi 40 km/h lúc 15/10/2024.');
  assert.deepStrictEqual(t10, [
    { t: 'text', v: 'Tính ' },
    { t: 'frac', n: '1', d: '2' },
    { t: 'text', v: ' + ' },
    { t: 'frac', n: '3', d: '4' },
    { t: 'text', v: ' = ? Đã đi 40 km/h lúc 15/10/2024.' }
  ], 'Ca văn bản xen kẽ');

  // 11. Tử/mẫu là phép tính trong ngoặc (lời giải từ PDF)
  var t11 = QuizFormat.mathTokens('(3 × 5)/(4 × 5) + (44 − 5)/6 và (ha)/ngày');
  assert.deepStrictEqual(t11, [
    { t: 'frac', n: '3 × 5', d: '4 × 5' },
    { t: 'text', v: ' + ' },
    { t: 'frac', n: '44 − 5', d: '6' },
    { t: 'text', v: ' và (ha)/ngày' }
  ], 'Ca phép tính trong ngoặc');

  console.log('OK (frac-test)');
}

testFrac();
