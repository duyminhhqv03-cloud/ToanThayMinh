/* Đọc đề luyện tập viết theo mẫu chữ đơn giản.
 *
 *   Câu 1: Kết quả của 2 + 3 là:
 *   A. 4
 *   *B. 5            ← dấu * đánh dấu đáp án đúng (hoặc dùng dòng "Đáp án: B")
 *   C. 6
 *   Giải thích: 2 + 3 = 5
 *
 *   Câu 2: 1/2 + 1/4 = ?
 *   Đáp án: 3/4 | 0,75    ← câu điền đáp số, nhiều đáp án chấp nhận cách nhau bằng |
 */
(function (root) {
  'use strict';

  var Q_START = /^\s*câu\s*\d+\s*[:.)\-–]?\s*/i;
  var OPTION = /^\s*(\*)?\s*([A-Ha-h])\s*[.)]\s*(\S.*)$/;
  var ANSWER = /^\s*đáp\s*án\s*[:：]\s*(.*)$/i;
  var EXPLAIN = /^\s*(giải\s*thích|lời\s*giải|hướng\s*dẫn)\s*[:：]\s*(.*)$/i;

  function splitBlocks(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var hasMarkers = lines.some(function (l) { return Q_START.test(l); });
    var blocks = [];
    var cur = null;
    lines.forEach(function (line) {
      var startsNew = hasMarkers ? Q_START.test(line) : (line.trim() !== '' && (!cur || cur.blankBefore));
      if (startsNew) {
        cur = { lines: [], blankBefore: false };
        blocks.push(cur);
        line = hasMarkers ? line.replace(Q_START, '') : line;
      }
      if (!cur) return; // chữ trước "Câu 1" → bỏ qua
      if (line.trim() === '') { cur.blankBefore = true; cur.lines.push(''); return; }
      cur.blankBefore = false;
      cur.lines.push(line);
    });
    return blocks.map(function (b) { return b.lines; });
  }

  function parse(text) {
    var questions = [];
    var errors = [];
    splitBlocks(text).forEach(function (lines, i) {
      var n = i + 1;
      var qText = [];
      var options = [];
      var correct = -1;
      var answerLine = null;
      var explain = [];
      var mode = 'text';
      lines.forEach(function (line) {
        var m;
        if ((m = EXPLAIN.exec(line))) { mode = 'explain'; if (m[2].trim()) explain.push(m[2].trim()); return; }
        if (mode === 'explain') { explain.push(line); return; }
        if ((m = ANSWER.exec(line))) { answerLine = m[1].trim(); mode = 'answer'; return; }
        if ((m = OPTION.exec(line)) && mode !== 'answer') {
          if (m[1]) correct = options.length;
          options.push(m[3].trim());
          mode = 'options';
          return;
        }
        if (mode === 'options' && line.trim() && options.length) {
          options[options.length - 1] += ' ' + line.trim();
          return;
        }
        if (mode === 'text') qText.push(line);
      });
      var q = { text: qText.join('\n').trim(), explain: explain.join('\n').trim() };
      if (!q.text) errors.push('Câu ' + n + ': thiếu nội dung câu hỏi.');
      if (options.length) {
        q.type = 'mc';
        q.options = options;
        if (correct < 0 && answerLine) {
          var letter = /^([A-Ha-h])\b/.exec(answerLine);
          if (letter) correct = letter[1].toUpperCase().charCodeAt(0) - 65;
        }
        q.correct = correct;
        if (options.length < 2) errors.push('Câu ' + n + ': cần ít nhất 2 lựa chọn.');
        if (options.length > 8) errors.push('Câu ' + n + ': tối đa 8 lựa chọn (A–H).');
        if (correct < 0 || correct >= options.length) errors.push('Câu ' + n + ': chưa đánh dấu đáp án đúng (thêm * trước chữ cái, ví dụ *B.)');
      } else {
        q.type = 'short';
        q.answers = (answerLine || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!q.answers.length) errors.push('Câu ' + n + ': chưa có lựa chọn A, B, C… và cũng chưa có dòng "Đáp án: …".');
      }
      questions.push(q);
    });
    if (!questions.length) errors.push('Chưa có câu hỏi nào. Bắt đầu mỗi câu bằng "Câu 1:", "Câu 2:"…');
    return { questions: questions, errors: errors };
  }

  var SAMPLE = [
    'Câu 1: Kết quả của phép tính 3/4 + 1/4 là:',
    'A. 4/8',
    '*B. 1',
    'C. 4/4 + 1',
    'D. 3/16',
    'Giải thích: Cùng mẫu số nên cộng tử số: 3 + 1 = 4, được 4/4 = 1.',
    '',
    'Câu 2: Một hình chữ nhật có chiều dài 8 cm, chiều rộng 5 cm. Chu vi hình chữ nhật là bao nhiêu xăng-ti-mét?',
    'Đáp án: 26 | 26cm | 26 cm',
    'Giải thích: Chu vi = (8 + 5) × 2 = 26 (cm).',
    '',
    'Câu 3: Số nào chia hết cho cả 2 và 5?',
    'A. 25',
    'B. 52',
    'C. 105',
    'D. 250',
    'Đáp án: D',
    'Giải thích: Số chia hết cho cả 2 và 5 có chữ số tận cùng là 0.'
  ].join('\n');

  var api = { parse: parse, SAMPLE: SAMPLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizFormat = api;
})(this);
