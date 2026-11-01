var assert = require('assert');
var QuizFormat = require('../hoc/quiz-format.js');

// Ca 1: Dạng cũ (đề có đáp án ở cuối file sau ĐÁP ÁN dạng gọn "1.B 2.C 3.A")
(function testCase1() {
  var text = [
    'Câu 1: Kết quả của 1 + 1 là:',
    'A. 1',
    'B. 2',
    'C. 3',
    'D. 4',
    'Câu 2: Kết quả của 2 + 2 là:',
    'A. 1',
    'B. 2',
    'C. 4',
    'D. 5',
    'Câu 3: Kết quả của 3 + 3 là:',
    'A. 6',
    'B. 7',
    'C. 8',
    'D. 9',
    'ĐÁP ÁN',
    '1.B 2.C 3.A'
  ].join('\n');

  var r = QuizFormat.fromText(text);
  assert.strictEqual(r.count, 3, 'Ca 1: Số câu phải là 3');
  var p = QuizFormat.parse(r.source);
  assert.strictEqual(p.questions.length, 3, 'Ca 1: Parse phải được 3 câu');
  assert.strictEqual(p.questions[0].correct, 1, 'Ca 1: Câu 1 đáp án B (chỉ số 1)');
  assert.strictEqual(p.questions[1].correct, 2, 'Ca 1: Câu 2 đáp án C (chỉ số 2)');
  assert.strictEqual(p.questions[2].correct, 0, 'Ca 1: Câu 3 đáp án A (chỉ số 0)');
})();

// Ca 2: Dạng cũ (file đáp án riêng có câu trả lời ngắn)
(function testCase2() {
  var text = [
    'Câu 1: Thủ đô nước Việt Nam là gì?',
    'A. Hải Phòng',
    'B. Hà Nội',
    'C. Đà Nẵng',
    'D. Cần Thơ',
    'Câu 2: Một hình vuông có cạnh 6 cm. Chu vi của hình vuông là bao nhiêu xăng-ti-mét?'
  ].join('\n');

  var keyText = [
    'Câu 1: B',
    'Câu 2: 24 cm'
  ].join('\n');

  var r = QuizFormat.fromText(text, keyText);
  assert.strictEqual(r.count, 2, 'Ca 2: Số câu phải là 2');
  var p = QuizFormat.parse(r.source);
  assert.strictEqual(p.questions[0].correct, 1, 'Ca 2: Câu 1 đáp án B');
  assert.strictEqual(p.questions[1].type, 'short', 'Ca 2: Câu 2 là trả lời ngắn');
  assert.strictEqual(p.questions[1].answers[0], '24 cm', 'Ca 2: Câu 2 đáp án là 24 cm');
})();

// Ca 3: Dạng mới (mục 3: Đề trộn Câu trắc nghiệm và Bài tự luận, file đáp án có Đáp án: B và Hướng dẫn)
(function testCase3() {
  var text = [
    'ĐỀ SỐ 2',
    'I. TRẮC NGHIỆM (3 điểm) Mỗi đáp án đúng ghi nhận 0,5 điểm',
    'Câu 1. Phân số 234/100 viết ở dạng hỗn số là:',
    'A. 23 4/100',
    'B. 2 34/100',
    'C. 234/10',
    'D. 2 34/10',
    'Câu 2. Số thích hợp để điền vào chỗ chấm là:',
    'A. 10',
    'B. 20',
    'C. 30',
    'D. 40',
    'Câu 3. Kết quả của phép tính là:',
    'A. 5',
    'B. 6',
    'C. 7',
    'D. 8',
    'II. TỰ LUẬN (7 điểm)',
    'Bài 1. Viết số thích hợp vào chỗ trống:',
    'a) 2 m² = ... dm²',
    'b) 5 km = ... m',
    'Bài 2. Một cửa hàng có 100 kg gạo. Buổi sáng bán được 50 kg gạo. Hỏi còn lại bao nhiêu kg gạo?'
  ].join('\n');

  var keyText = [
    'ĐỀ SỐ 2',
    'I. TRẮC NGHIỆM (3 điểm) Mỗi đáp án đúng ghi nhận 0,5 điểm',
    'Câu 1. Phân số 234/100 viết ở dạng hỗn số là:',
    'A. 23 4/100',
    'B. 2 34/100',
    'C. 234/10',
    'D. 2 34/10',
    'Đáp án: B',
    'Câu 2. Số thích hợp để điền vào chỗ chấm là:',
    'A. 10',
    'B. 20',
    'C. 30',
    'D. 40',
    'Đáp án: C',
    'Câu 3. Kết quả của phép tính là:',
    'A. 5',
    'B. 6',
    'C. 7',
    'D. 8',
    'Đáp án: A',
    'II. TỰ LUẬN (7 điểm)',
    'Bài 1. Viết số thích hợp vào chỗ trống:',
    'a) 2 m² = ... dm²',
    'b) 5 km = ... m',
    'Hướng dẫn',
    'a) 200 dm²',
    'b) 5000 m',
    'Bài 2. Một cửa hàng có 100 kg gạo. Buổi sáng bán được 50 kg gạo. Hỏi còn lại bao nhiêu kg gạo?',
    'Hướng dẫn',
    'Số gạo còn lại là: 100 - 50 = 50 (kg).',
    'Đáp số: 50 kg gạo.'
  ].join('\n');

  var r = QuizFormat.fromText(text, keyText);
  assert.strictEqual(r.count, 5, 'Ca 3: Tổng số câu là 5');
  var p = QuizFormat.parse(r.source, { allowEssay: true });
  assert.strictEqual(p.questions.length, 5, 'Ca 3: Parse được 5 câu');

  // 3 câu trắc nghiệm
  assert.strictEqual(p.questions[0].type, 'mc', 'Ca 3: Câu 1 là trắc nghiệm');
  assert.strictEqual(p.questions[0].correct, 1, 'Ca 3: Câu 1 đúng B');
  assert.strictEqual(p.questions[1].type, 'mc', 'Ca 3: Câu 2 là trắc nghiệm');
  assert.strictEqual(p.questions[1].correct, 2, 'Ca 3: Câu 2 đúng C');
  assert.strictEqual(p.questions[2].type, 'mc', 'Ca 3: Câu 3 là trắc nghiệm');
  assert.strictEqual(p.questions[2].correct, 0, 'Ca 3: Câu 3 đúng A');

  // 1 câu điền khuyết (tự luận nhưng có 2 chỗ trống) và 1 câu tự luận
  assert.strictEqual(p.questions[3].type, 'fill', 'Ca 3: Bài 1 có 2 chỗ trống nên là điền khuyết');
  assert.deepStrictEqual(p.questions[3].answers, [['200'], ['5000']], 'Ca 3: Bài 1 đoán đúng đáp án');
  assert.ok(p.questions[3].explain.indexOf('200 dm²') >= 0, 'Ca 3: Bài 1 có lời giải đúng');
  assert.ok(p.questions[3].explain.indexOf('50 kg') < 0, 'Ca 3: Bài 1 không lẫn lời giải Bài 2');

  assert.strictEqual(p.questions[4].type, 'essay', 'Ca 3: Bài 2 là tự luận');
  assert.ok(p.questions[4].explain.indexOf('50 kg') >= 0, 'Ca 3: Bài 2 có lời giải đúng');
  assert.ok(p.questions[4].explain.indexOf('200 dm²') < 0, 'Ca 3: Bài 2 không lẫn lời giải Bài 1');
})();

// Ca 4: Mục 4 (Chỉ truyền file đáp án làm text, keyText = null)
(function testCase4() {
  var keyAsText = [
    'ĐỀ SỐ 2',
    'I. TRẮC NGHIỆM (3 điểm)',
    'Câu 1. Phân số 234/100 viết ở dạng hỗn số là:',
    'A. 23 4/100',
    'B. 2 34/100',
    'C. 234/10',
    'D. 2 34/10',
    'Đáp án: B',
    'Câu 2. Số thích hợp để điền vào chỗ chấm là:',
    'A. 10',
    'B. 20',
    'C. 30',
    'D. 40',
    'Đáp án: C',
    'Câu 3. Kết quả của phép tính là:',
    'A. 5',
    'B. 6',
    'C. 7',
    'D. 8',
    'Đáp án: A',
    'II. TỰ LUẬN (7 điểm)',
    'Bài 1. Viết số thích hợp vào chỗ trống:',
    'a) 2 m² = ... dm²',
    'b) 5 km = ... m',
    'Hướng dẫn',
    'a) 200 dm²',
    'b) 5000 m',
    'Bài 2. Một cửa hàng có 100 kg gạo. Buổi sáng bán được 50 kg gạo. Hỏi còn lại bao nhiêu kg gạo?',
    'Hướng dẫn',
    'Số gạo còn lại là: 100 - 50 = 50 (kg).',
    'Đáp số: 50 kg gạo.'
  ].join('\n');

  var r = QuizFormat.fromText(keyAsText, null);
  assert.strictEqual(r.count, 5, 'Ca 4: Tổng số câu là 5');
  var p = QuizFormat.parse(r.source, { allowEssay: true });

  // Câu hỏi không chứa chữ Đáp án hoặc Hướng dẫn
  p.questions.forEach(function (q, idx) {
    assert.ok(q.text.indexOf('Đáp án:') < 0, 'Ca 4: Câu ' + (idx + 1) + ' không chứa "Đáp án:"');
    assert.ok(q.text.indexOf('Hướng dẫn') < 0, 'Ca 4: Câu ' + (idx + 1) + ' không chứa "Hướng dẫn"');
  });

  // Đáp án và lời giải đúng
  assert.strictEqual(p.questions[0].correct, 1, 'Ca 4: Câu 1 đúng B');
  assert.strictEqual(p.questions[1].correct, 2, 'Ca 4: Câu 2 đúng C');
  assert.strictEqual(p.questions[2].correct, 0, 'Ca 4: Câu 3 đúng A');
  assert.strictEqual(p.questions[3].type, 'fill', 'Ca 4: Bài 1 điền khuyết');
  assert.ok(p.questions[3].explain.indexOf('200 dm²') >= 0, 'Ca 4: Lời giải bài 1 đúng');
  assert.strictEqual(p.questions[4].type, 'essay', 'Ca 4: Bài 2 tự luận');
  assert.ok(p.questions[4].explain.indexOf('50 kg') >= 0, 'Ca 4: Lời giải bài 2 đúng');
})();

// Ca 5: Mục 5 (Text có ĐỀ SỐ 2 và ĐỀ SỐ 3, mỗi đề 2 câu + 1 bài, keyText tương ứng)
(function testCase5() {
  var text = [
    'ĐỀ SỐ 2',
    'I. TRẮC NGHIỆM',
    'Câu 1: Câu 1 đề 2?',
    'A. 1',
    'B. 2',
    'Câu 2: Câu 2 đề 2?',
    'A. 3',
    'B. 4',
    'II. TỰ LUẬN',
    'Bài 1: Tự luận đề 2',
    'ĐỀ SỐ 3',
    'I. TRẮC NGHIỆM',
    'Câu 1: Câu 1 đề 3?',
    'A. 10',
    'B. 20',
    'Câu 2: Câu 2 đề 3?',
    'A. 30',
    'B. 40',
    'II. TỰ LUẬN',
    'Bài 1: Tự luận đề 3'
  ].join('\n');

  var keyText = [
    'ĐỀ SỐ 2',
    'Câu 1: A',
    'Câu 2: B',
    'Bài 1: Lời giải đề 2',
    'ĐỀ SỐ 3',
    'Câu 1: B',
    'Câu 2: A',
    'Bài 1: Lời giải đề 3'
  ].join('\n');

  var lines = text.split('\n');
  var secs = QuizFormat.examSections(lines);
  assert.strictEqual(secs.length, 2, 'Ca 5: examSections phải tìm thấy 2 đề');
  assert.strictEqual(secs[0].name, 'ĐỀ SỐ 2', 'Ca 5: Đề 1 là ĐỀ SỐ 2');
  assert.strictEqual(secs[1].name, 'ĐỀ SỐ 3', 'Ca 5: Đề 2 là ĐỀ SỐ 3');

  var r = QuizFormat.fromText(text, keyText, { exam: 1 });
  assert.deepStrictEqual(r.exams, ['ĐỀ SỐ 2', 'ĐỀ SỐ 3'], 'Ca 5: r.exams giữ nguyên chữ gốc');
  assert.strictEqual(r.count, 3, 'Ca 5: Đề 3 có 3 câu');
  var p = QuizFormat.parse(r.source, { allowEssay: true });
  assert.strictEqual(p.questions.length, 3, 'Ca 5: Parse được 3 câu');
  assert.ok(p.questions[0].text.indexOf('đề 3') >= 0, 'Ca 5: Câu 1 thuộc đề 3');
  assert.strictEqual(p.questions[0].correct, 1, 'Ca 5: Câu 1 đề 3 có đáp án B (chỉ số 1)');
  assert.strictEqual(p.questions[1].correct, 0, 'Ca 5: Câu 2 đề 3 có đáp án A (chỉ số 0)');
  assert.ok(p.questions[2].explain.indexOf('đề 3') >= 0, 'Ca 5: Lời giải bài 1 đề 3 đúng');
  assert.ok(p.questions[2].explain.indexOf('đề 2') < 0, 'Ca 5: Không bị lẫn lời giải của đề 2');
})();

// Ca 6: Dòng đầu trang "Đề kiểm tra giữa kì I" không bị tính là tiêu đề đề
(function testCase6() {
  var lines = [
    'Đề kiểm tra giữa kì I',
    'Năm học 2023 - 2024',
    'Câu 1: 1 + 1 = ?',
    'A. 2',
    'B. 3'
  ];
  var secs = QuizFormat.examSections(lines);
  assert.strictEqual(secs.length, 0, 'Ca 6: "Đề kiểm tra giữa kì I" không bị tính là tiêu đề đề');
})();

// Ca 7: lời giải có dòng "Phần …" và sang trang vẫn thuộc đúng bài; tiêu đề phần thật vẫn nhận.
(function testCase7() {
  var text = [
    'PHẦN II. TỰ LUẬN (4 điểm)',
    'Bài 1. Tính diện tích còn lại',
    'Hướng dẫn',
    'Phần trồng cây xanh là: 4/5 × 323',
    QuizFormat.PAGE_MARK,
    'Đổi 323/5 ha',
    'Bài 2. Giải bài toán sau',
    'Một người đi 5 km.',
    'Hướng dẫn',
    'Đi 5 km.'
  ].join('\n');
  var r = QuizFormat.fromText(text, null, {});
  var qs = QuizFormat.parse(r.source).questions;
  assert.strictEqual(qs.length, 2, 'Ca 7: đúng 2 bài');
  assert.ok(/Phần trồng cây xanh[\s\S]*Đổi 323\/5 ha/.test(qs[0].explain), 'Ca 7: lời giải bài 1 đủ, kể cả phần sang trang');
  assert.ok(qs[1].text.indexOf('Đổi') < 0 && /Giải bài toán sau/.test(qs[1].text), 'Ca 7: bài 2 không dính lời giải bài 1');
  assert.strictEqual(qs[0].points, 2, 'Ca 7: tiêu đề phần (4 điểm) vẫn chia điểm');
})();

// Ca 8: ký tự phông Symbol (×, ngoặc lớn) đổi về ký tự thường.
(function testCase8() {
  assert.strictEqual(QuizFormat.plainMath('65kg \uf0b4 5 \uf0e6\uf0e7a\uf0f7\uf0f8'), '65kg × 5 (a)');
})();

// Ca 9: Mục 2 ví dụ thật chuyển thành điền khuyết với đúng 5 đáp án
(function testCaseSection2RealExample() {
  var text = [
    'Câu 1 (tự luận): Viết số thích hợp vào chỗ trống.',
    'a) 3 m² 2 cm² =…… m² b) 123 tạ = …… tấn',
    'c) 403 460 m² = …… km² …… ha d) 6,5 ml = …… lít',
    'Hướng dẫn:',
    'a) 3 m² 2 cm² = 3 m² 2/10 000 m² = 3,0002 m²',
    'b) 123 tạ = 123/10 tấn',
    'c)',
    '403 460 m² = 400 000 m² + 3 460 m²',
    '= 400 000/1000 000 km² + 3 460/10 000 ha',
    '= 0,4 km² 0,346 ha',
    'd) 6, 5 ml = 65/10 ml = 65/10 × 1/1000 lít = 65/10 000 lít'
  ].join('\n');

  var r = QuizFormat.fromText(text, null);
  assert.strictEqual(r.count, 1, 'Mục 2: Đúng 1 câu');
  assert.strictEqual(r.fillCount, 1, 'Mục 2: fillCount = 1');
  assert.strictEqual(r.guessed, 1, 'Mục 2: guessed = 1');
  var p = QuizFormat.parse(r.source, { allowEssay: true });
  assert.strictEqual(p.questions[0].type, 'fill', 'Mục 2: type là fill');
  var expected = [['3,0002'], ['123/10'], ['0,4'], ['0,346'], ['65/10 000']];
  assert.deepStrictEqual(p.questions[0].answers, expected, 'Mục 2: Đúng 5 đáp án theo thứ tự');
})();

// Ca 9b: đề PDF thật ghi nhầm "b)" hai lần (đáng lẽ "c)") — vẫn ghép đáp án theo thứ tự phần
(function testCaseWrongLabel() {
  var text = [
    'Câu 1 (tự luận): Viết số thích hợp vào chỗ trống.',
    'a) 3 m² 2 cm² =…… m² b) 123 tạ = …… tấn',
    'b) 403 460 m² = …… km² …… ha d) 6,5 ml = …… lít',
    'Hướng dẫn:',
    'a) 3 m² 2 cm² = 3 m² 2/10 000 m² = 3,0002 m²',
    'b) 123 tạ = 123/10 tấn',
    'c)',
    '403 460 m² = 400 000 m² + 3 460 m²',
    '= 400 000/1000 000 km² + 3 460/10 000 ha',
    '= 0,4 km² 0,346 ha',
    'd) 6, 5 ml = 65/10 ml = 65/10 × 1/1000 lít = 65/10 000 lít'
  ].join('\n');
  var r = QuizFormat.fromText(text, null);
  var p = QuizFormat.parse(r.source, { allowEssay: true });
  assert.deepStrictEqual(p.questions[0].answers, [['3,0002'], ['123/10'], ['0,4'], ['0,346'], ['65/10 000']], 'Ca 9b: ghép theo thứ tự phần');
})();

// Ca 10: đề cũ không bị đổi nghĩa — tự luận chấm tay có "……" mà không có dòng Đáp án vẫn là tự luận;
// lựa chọn trắc nghiệm chứa "…" vẫn là lựa chọn; dòng chấm dài để viết bài giải không thành ô trống.
(function testCase10() {
  var p = QuizFormat.parse('Câu 1: Viết số vào chỗ chấm: 3 m = …… cm; 2 kg = …… g', { allowEssay: true });
  assert.strictEqual(p.questions[0].type, 'essay', 'Ca 10: không có Đáp án → tự luận');
  p = QuizFormat.parse('Câu 1: Dãy số nào đúng?\nA. 1, 2, 3, …\n*B. 2, 4, 6, …\nC. 1, 3, 4', {});
  assert.strictEqual(p.questions[0].type, 'mc', 'Ca 10: lựa chọn có … vẫn là trắc nghiệm');
  assert.strictEqual(p.questions[0].options.length, 3);
  var r = QuizFormat.fromText(['II. TỰ LUẬN', 'Bài 1. Giải bài toán: a) Tính …… b) Tìm ……', 'Bài giải', '…………………………………………………………'].join('\n'), null);
  assert.ok(/tự luận/.test(r.source), 'Ca 10: dòng chấm dài → giữ tự luận');
  // "Câu (…)" không có số không phải đầu câu mới.
  assert.strictEqual(QuizFormat.questionStarts(['Câu 1: Đọc đoạn sau', 'Câu (a) nói về điều gì?']).length, 1);
})();

// Ca 10: Parse / toSource khứ hồi của câu fill
(function testCaseFillRoundTrip() {
  var src = [
    'Câu 7 (1,4 điểm): Viết số thích hợp vào chỗ trống.',
    'a) 3 m² 2 cm² = …… m²   b) 123 tạ = …… tấn',
    'Đáp án: 3,0002; 12,3 | 123/10',
    'Lời giải: a) 3,0002; b) 12,3'
  ].join('\n');
  var p = QuizFormat.parse(src);
  assert.strictEqual(p.errors.length, 0, 'Parse fill không có lỗi');
  assert.strictEqual(p.questions[0].type, 'fill', 'Là câu fill');
  var genSrc = QuizFormat.toSource(p.questions);
  var p2 = QuizFormat.parse(genSrc);
  assert.strictEqual(p2.errors.length, 0, 'Parse lại source không có lỗi');
  assert.strictEqual(p2.questions[0].type, 'fill', 'Parse lại vẫn là fill');
  assert.deepStrictEqual(p2.questions[0].answers, p.questions[0].answers, 'Đáp án khứ hồi khớp');
  assert.strictEqual(p2.questions[0].points, 1.4, 'Điểm khứ hồi khớp');
})();

// Ca 11: Lỗi số phần khác số ô và ô rỗng hoặc ?
(function testCaseFillErrors() {
  var src = [
    'Câu 1: Điền vào chỗ trống: a) ……   b) ……   c) ……   d) ……   e) ……',
    'Đáp án: 1; 2; 3; 4'
  ].join('\n');
  var p = QuizFormat.parse(src);
  assert.ok(p.errors.length > 0, 'Có lỗi số phần ≠ số ô');
  assert.strictEqual(p.errors[0], 'Câu 1: có 5 chỗ trống nhưng đáp án có 4 phần (ngăn cách bằng dấu ;).');

  var src2 = [
    'Câu 1: Điền vào chỗ trống: a) ……   b) ……   c) ……',
    'Đáp án: 1; 2; ?'
  ].join('\n');
  var p2 = QuizFormat.parse(src2);
  assert.ok(p2.errors.length > 0, 'Có lỗi chưa có đáp án cho ô 3');
  assert.strictEqual(p2.errors[0], 'Câu 1: chưa có đáp án cho chỗ trống thứ 3.');
})();

// Ca 12: Câu 1 ô trống vẫn là short
(function testCaseSingleBlankIsShort() {
  var src = [
    'Câu 1 (2 điểm): 2 m² = ... dm²',
    'Đáp án: 200'
  ].join('\n');
  var p = QuizFormat.parse(src);
  assert.strictEqual(p.errors.length, 0, 'Không lỗi');
  assert.strictEqual(p.questions[0].type, 'short', 'Câu 1 ô trống là short');
  assert.deepStrictEqual(p.questions[0].answers, ['200']);
})();

console.log('OK');
