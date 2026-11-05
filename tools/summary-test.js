// Kiểm thử QuizFormat.classStats (thống kê bài làm cả lớp).
const assert = require('assert');
const path = require('path');
const QF = require(path.join(__dirname, '..', 'hoc', 'quiz-format.js'));

const questions = [
  { type: 'mc', text: '3/4 + 1/4 = ?', options: ['4/8', '1', '5/4', '3/16'], correct: 1, points: 1 },
  { type: 'short', text: '1/2 + 1/4 = ?', answers: ['3/4', '0,75'], points: 2 },
  { type: 'fill', text: 'a) 3 m² 2 cm² = …… m²  b) 123 tạ = …… tấn', answers: [['3,0002'], ['12,3', '123/10']], points: 2 },
  { type: 'essay', text: 'Giải bài toán có lời văn…', explain: 'Bước 1: 40 kg; Bước 2: 60 kg', points: 4 }
];

// 1. Không có bài nào (hoặc chỉ có người chưa nộp / bài reopened)
{
  const rEmpty = QF.classStats(questions, []);
  assert.strictEqual(rEmpty.total, 0);
  assert.strictEqual(rEmpty.students.length, 0);
  assert.strictEqual(rEmpty.items.length, 4);
  rEmpty.items.forEach((it, idx) => {
    assert.strictEqual(it.index, idx);
    assert.strictEqual(it.scored, 0);
    assert.strictEqual(it.pending, 0);
    assert.strictEqual(it.avgRatio, null);
    assert.strictEqual(it.level, null);
    assert.strictEqual(it.correctCount, 0);
    assert.strictEqual(it.partialCount, 0);
    assert.strictEqual(it.wrongCount, 0);
    assert.strictEqual(it.blankCount, 0);
    assert.deepStrictEqual(it.wrongNames, []);
    assert.deepStrictEqual(it.wrongAnswers, []);
  });
  assert.strictEqual(rEmpty.items[0].blanks, null);
  assert.strictEqual(rEmpty.items[2].blanks.length, 2);
  assert.strictEqual(rEmpty.items[2].blanks[0].total, 0);

  const rIgnored = QF.classStats(questions, [
    { fullName: 'Chưa Nộp', submission: null },
    { fullName: 'Nộp Lại', submission: { status: 'reopened', answers: [0, '0', ['', ''], ''], itemScores: [0, 0, 0, null] } }
  ]);
  assert.strictEqual(rIgnored.total, 0);
  assert.strictEqual(rIgnored.students.length, 0);
}

// 2. Đủ 4 loại câu, bỏ qua reopened & chưa nộp, ưu tiên itemScores hơn auto,
//    câu tự luận chưa chấm vào pending, câu bỏ trống, gom câu sai theo normAnswer, fill theo từng ô.
{
  const submissions = [
    // HS 1: đúng hết câu 1, 2, 3; câu 4 tự luận được 3/4 điểm (partial)
    {
      fullName: 'Nguyễn An',
      submission: {
        status: 'returned',
        answers: [1, '0,75', ['3,0002', '12,3'], 'Bài giải của An'],
        itemScores: [1, 2, 2, 3],
        auto: [1, 2, 2, null],
        files: []
      }
    },
    // HS 2: câu 1 sai (chọn A), câu 2 gõ "0,5" (sai), câu 3 đúng 1 ô (ô 1 gõ "3,02", ô 2 đúng "123/10"), câu 4 chưa chấm nhưng có ảnh q=3
    {
      fullName: 'Trần Bình',
      submission: {
        status: 'submitted',
        answers: [0, '0,5', ['3,02', '123/10'], ''],
        itemScores: [0, 0, 1, null],
        auto: [0, 0, 1, null],
        files: [{ id: 'f1', q: 3 }]
      }
    },
    // HS 3: câu 1 chọn A, câu 2 gõ "0.5" (gom chung với "0,5" của Bình), câu 3 ô 1 gõ "3.02", ô 2 bỏ trống, câu 4 bỏ trống & chưa chấm
    {
      fullName: 'Lê Chi',
      submission: {
        status: 'submitted',
        answers: [0, ' 0.5 ', ['3.02', ''], '   '],
        itemScores: [0, 0, 0, null],
        auto: [0, 0, 0, null],
        files: [{ id: 'f_chung', q: null }]
      }
    },
    // HS 4: câu 1 bỏ trống, câu 2 máy chấm 0 nhưng giáo viên sửa itemScores = 2 (ưu tiên itemScores hơn auto),
    //       câu 3 bỏ trống cả 2 ô, câu 4 đã chấm 0 điểm và bỏ trống
    {
      fullName: 'Phạm Dũng',
      submission: {
        status: 'returned',
        answers: [null, 'ba phần tư', ['', '  '], ''],
        itemScores: [null, 2, 0, 0],
        auto: [0, 0, 0, null],
        files: []
      }
    },
    // HS 5: trạng thái reopened -> phải bị bỏ qua
    {
      fullName: 'Hoàng Em',
      submission: {
        status: 'reopened',
        answers: [0, 'sai', ['sai', 'sai'], 'sai'],
        itemScores: [0, 0, 0, 0],
        auto: [0, 0, 0, null]
      }
    },
    // HS 6: chưa nộp -> phải bị bỏ qua
    {
      fullName: 'Vũ Phương',
      submission: null
    }
  ];

  const st = QF.classStats(questions, submissions);
  assert.strictEqual(st.total, 4);

  // Kiểm tra Câu 1 (mc, 1đ): An(1), Bình(0 - A), Chi(0 - A), Dũng(auto=0, bỏ trống)
  const q1 = st.items[0];
  assert.strictEqual(q1.index, 0);
  assert.strictEqual(q1.type, 'mc');
  assert.strictEqual(q1.points, 1);
  assert.strictEqual(q1.scored, 4);
  assert.strictEqual(q1.pending, 0);
  assert(Math.abs(q1.avgRatio - 0.25) < 1e-9);
  assert.strictEqual(q1.level, 'weak');
  assert.strictEqual(q1.correctCount, 1);
  assert.strictEqual(q1.partialCount, 0);
  assert.strictEqual(q1.wrongCount, 3);
  assert.strictEqual(q1.blankCount, 1);
  assert.deepStrictEqual(q1.wrongNames, ['Trần Bình', 'Lê Chi', 'Phạm Dũng']);
  assert.deepStrictEqual(q1.wrongAnswers, [{ answer: 'A. 4/8', count: 2 }]);
  assert.strictEqual(q1.blanks, null);

  // Kiểm tra Câu 2 (short, 2đ): An(2), Bình(0 - "0,5"), Chi(0 - "0.5"), Dũng(itemScores=2 dù auto=0)
  const q2 = st.items[1];
  assert.strictEqual(q2.scored, 4);
  assert.strictEqual(q2.pending, 0);
  assert(Math.abs(q2.avgRatio - 0.5) < 1e-9);
  assert.strictEqual(q2.level, 'watch');
  assert.strictEqual(q2.correctCount, 2);
  assert.strictEqual(q2.partialCount, 0);
  assert.strictEqual(q2.wrongCount, 2);
  assert.strictEqual(q2.blankCount, 0);
  assert.deepStrictEqual(q2.wrongNames, ['Trần Bình', 'Lê Chi']);
  // Gom "0,5" và "0.5" theo normAnswer, hiển thị dạng học sinh gõ đầu tiên ("0,5")
  assert.deepStrictEqual(q2.wrongAnswers, [{ answer: '0,5', count: 2 }]);

  // Kiểm tra Câu 3 (fill, 2đ): An(2), Bình(1 - partial), Chi(0), Dũng(0 - blank cả 2 ô)
  const q3 = st.items[2];
  assert.strictEqual(q3.scored, 4);
  assert.strictEqual(q3.pending, 0);
  assert(Math.abs(q3.avgRatio - 3 / 8) < 1e-9);
  assert.strictEqual(q3.level, 'weak');
  assert.strictEqual(q3.correctCount, 1);
  assert.strictEqual(q3.partialCount, 1);
  assert.strictEqual(q3.wrongCount, 2);
  assert.strictEqual(q3.blankCount, 1); // Chỉ Dũng bỏ trống mọi ô; Chi có điền ô 1
  assert.deepStrictEqual(q3.wrongNames, ['Trần Bình', 'Lê Chi', 'Phạm Dũng']);
  assert.deepStrictEqual(q3.wrongAnswers, []);
  assert.strictEqual(q3.blanks.length, 2);
  assert.strictEqual(q3.blanks[0].correctCount, 1);
  assert.strictEqual(q3.blanks[0].total, 4);
  assert.deepStrictEqual(q3.blanks[0].wrongAnswers, [{ answer: '3,02', count: 2 }]);
  assert.strictEqual(q3.blanks[1].correctCount, 2);
  assert.strictEqual(q3.blanks[1].total, 4);
  assert.deepStrictEqual(q3.blanks[1].wrongAnswers, []);

  // Kiểm tra Câu 4 (essay, 4đ): An(3/4 - partial), Bình(pending, có file q=3 nên không blank), Chi(pending, blank), Dũng(0/4 - blank)
  const q4 = st.items[3];
  assert.strictEqual(q4.scored, 2);
  assert.strictEqual(q4.pending, 2);
  assert(Math.abs(q4.avgRatio - 3 / 8) < 1e-9);
  assert.strictEqual(q4.level, 'weak');
  assert.strictEqual(q4.correctCount, 0);
  assert.strictEqual(q4.partialCount, 1);
  assert.strictEqual(q4.wrongCount, 1);
  assert.strictEqual(q4.blankCount, 2); // Chi và Dũng bỏ trống; Bình có ảnh q=3 nên không trống
  assert.deepStrictEqual(q4.wrongNames, ['Nguyễn An', 'Phạm Dũng']);
  assert.deepStrictEqual(q4.wrongAnswers, []);
  assert.strictEqual(q4.blanks, null);

  // Kiểm tra danh sách học sinh (sắp xếp ratio tăng dần):
  // - Lê Chi: đã có điểm câu 1,2,3 (tổng 5đ) = 0/5 = 0, wrongQuestions = [1, 2, 3] (câu 4 chưa chấm nên không tính)
  // - Trần Bình: đã có điểm câu 1,2,3 (tổng 5đ) = 1/5 = 0.2, wrongQuestions = [1, 2, 3]
  // - Phạm Dũng: đã có điểm câu 1,2,3,4 (tổng 9đ) = 2/9, wrongQuestions = [1, 3, 4]
  // - Nguyễn An: đã có điểm câu 1,2,3,4 (tổng 9đ) = 8/9, wrongQuestions = [4]
  assert.strictEqual(st.students.length, 4);
  assert.strictEqual(st.students[0].fullName, 'Lê Chi');
  assert(Math.abs(st.students[0].ratio - 0) < 1e-9);
  assert.deepStrictEqual(st.students[0].wrongQuestions, [1, 2, 3]);

  assert.strictEqual(st.students[1].fullName, 'Trần Bình');
  assert(Math.abs(st.students[1].ratio - 0.2) < 1e-9);
  assert.deepStrictEqual(st.students[1].wrongQuestions, [1, 2, 3]);

  assert.strictEqual(st.students[2].fullName, 'Phạm Dũng');
  assert(Math.abs(st.students[2].ratio - 2 / 9) < 1e-9);
  assert.deepStrictEqual(st.students[2].wrongQuestions, [1, 3, 4]);

  assert.strictEqual(st.students[3].fullName, 'Nguyễn An');
  assert(Math.abs(st.students[3].ratio - 8 / 9) < 1e-9);
  assert.deepStrictEqual(st.students[3].wrongQuestions, [4]);
}

// 3. Học sinh chưa có câu nào được chấm (ratio = null xếp xuống cuối) & câu tự luận chưa ai được chấm (avgRatio = null, level = null)
{
  const essayOnly = [{ type: 'essay', text: 'Tự luận', points: 5 }];
  const st = QF.classStats(essayOnly, [
    { fullName: 'Bình', submission: { status: 'submitted', answers: ['Làm bài'], itemScores: [null], auto: [null] } },
    { fullName: 'An', submission: { status: 'returned', answers: ['Làm tốt'], itemScores: [5], auto: [null] } }
  ]);
  assert.strictEqual(st.students[0].fullName, 'An');
  assert.strictEqual(st.students[0].ratio, 1);
  assert.strictEqual(st.students[1].fullName, 'Bình');
  assert.strictEqual(st.students[1].ratio, null);

  const stPending = QF.classStats(essayOnly, [
    { fullName: 'Bình', submission: { status: 'submitted', answers: ['Làm bài'], itemScores: null, auto: null } }
  ]);
  assert.strictEqual(stPending.items[0].scored, 0);
  assert.strictEqual(stPending.items[0].pending, 1);
  assert.strictEqual(stPending.items[0].avgRatio, null);
  assert.strictEqual(stPending.items[0].level, null);
}

console.log('OK');
