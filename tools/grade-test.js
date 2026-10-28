// So sánh hàm chấm của trang web (quiz-format.js) và máy chủ (Code.gs) trên cùng bộ ví dụ.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const QF = require(path.join(ROOT, 'hoc/quiz-format.js'));
const gs = fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8');
const pick = n => gs.match(new RegExp('function ' + n + '\\([\\s\\S]*?\\n}\\n'))[0];
const GS = new Function(pick('isCorrect_') + pick('numPart_') + pick('normAnswer_') + 'return isCorrect_;')();
const cases = [
  // [đáp án, học sinh gõ, mong đợi]
  ['2,5', '2,50', true], ['2,5', '2.5', true], ['3/4', '0,75', true], ['0,75', '3/4', true],
  ['1/2', '0,5', true], ['1/3', '0,33', false], ['25 cm²', '25cm2', true], ['25 cm²', '25', true],
  ['25 cm²', '25 cm³', false], ['40 km/h', '40', true], ['40 km/h', '40 m/s', false], ['90°', '90', true],
  ['50%', '50 %', true], ['-3/2', '-1,5', true], ['3/4 kg', '0,75kg', true], ['3/4 kg', '0,75 g', false],
  ['12.500', '12500', true], ['12.500 đồng', '12500đồng', true], ['12.500', '12,5', false], ['12.500', '12.5', false],
  ['1.250.000', '1250000', true], ['1.250,5', '1250,5', true], ['24', '24cm', true], ['24', '42', false],
  ['0,125', '0.125', true], ['x = 5', 'x=5', true], ['Hà Nội', 'hà nội', true], ['12', '12.000', false],
  ['2,5', '25', false], ['100', '1.00', false]
];
let fail = 0;
cases.forEach(([ans, stu, want]) => {
  const q = { type: 'short', answers: [ans] };
  const a = QF.isCorrect(q, stu), b = GS(q, stu);
  const ok = a === want && b === want;
  if (!ok) fail++;
  console.log((ok ? 'PASS' : 'FAIL') + `  đáp án "${ans}"  gõ "${stu}"  → web ${a}, máy chủ ${b}, mong đợi ${want}`);
});
// Thử ngẫu nhiên: hai bên phải luôn cho cùng kết quả.
const parts = ['1', '2', '12', '0', '3/4', '0,75', '12.500', '2,50', 'cm', 'cm2', 'km/h', ' ', ',', '.', '-', 'đ', '%', '°', 'x', '/'];
let diff = 0;
for (let i = 0; i < 20000; i++) {
  const r = () => Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => parts[Math.floor(Math.random() * parts.length)]).join('');
  const q = { type: 'short', answers: [r()] }, s = r();
  if (QF.isCorrect(q, s) !== GS(q, s)) { diff++; if (diff < 5) console.log('KHÁC', q.answers[0], s); }
}
console.log(`\n${cases.length - fail}/${cases.length} ví dụ đạt; ${diff} khác biệt web/máy chủ trên 20000 lần thử ngẫu nhiên`);
