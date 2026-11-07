/* Đọc đề viết theo mẫu chữ đơn giản (dùng cho Luyện tập và Bài tập về nhà).
 *
 *   Câu 1 (1 điểm): Kết quả của 2 + 3 là:
 *   A. 4
 *   *B. 5            ← dấu * đánh dấu đáp án đúng (hoặc dùng dòng "Đáp án: B")
 *   C. 6
 *   Giải thích: 2 + 3 = 5
 *
 *   Câu 2 (2 điểm): 1/2 + 1/4 = ?
 *   Đáp án: 3/4 | 0,75    ← trả lời ngắn, nhiều đáp án chấp nhận cách nhau bằng |
 *
 *   Câu 3 (tự luận, 4 điểm): Giải bài toán sau…
 *   Hướng dẫn chấm: …       ← tự luận: giáo viên chấm (chỉ dùng trong Bài tập về nhà)
 *
 * Điểm mỗi câu mặc định là 1 nếu không ghi.
 */
(function (root) {
  'use strict';

  var Q_START = /^\s*câu\s*\d+\s*(?:\(([^)]*)\)|\[([^\]]*)\])?\s*[:.)\-–]?\s*/i;
  var OPTION = /^\s*(\*)?\s*([A-Ha-h])\s*[.)]\s*(\S.*)$/;
  var ANSWER = /^\s*đáp\s*án(?:\s*mẫu)?\s*[:：]\s*(.*)$/i;
  var EXPLAIN = /^\s*(giải\s*thích|lời\s*giải|hướng\s*dẫn(?:\s*chấm)?|gợi\s*ý\s*chấm)\s*[:：]\s*(.*)$/i;
  var ESSAY_WORD = /tự\s*luận|essay/i;
  var POINTS = /(\d+(?:[.,]\d+)?)\s*(?:điểm|đ|d)(?![a-zà-ỹđ])/i;
  var IMAGE = /^\s*\[\s*(?:hình|ảnh|hinh|anh)\s*:?\s*([A-Za-z0-9_-]{1,40})\s*\]\s*$/i;

  var BLANK_RE = /…[.…]*|\.{3,}[.…]*/g;
  var SUB_LABEL_RE = /(?:^|\s)([a-hA-H]|\d+)\s*[.)]/g;

  function blankCount(text) {
    var m = String(text || '').match(BLANK_RE);
    return m ? m.length : 0;
  }

  function splitBlanks(text) {
    return String(text || '').split(BLANK_RE);
  }

  function isTokenBorder(c) {
    if (!c) return true;
    return !/[0-9A-Za-z\u00C0-\u024F\u1EA0-\u1EF9_/]/.test(c);
  }

  var NUM_BEFORE_RE = /(?:(\d+(?: \d{3})+(?:,\d+)?)|(\d+(?:,\d+)?))$/;
  var NUM_AFTER_RE = /^(?:(\d+(?: \d{3})+(?:,\d+)?)|(\d+(?:,\d+)?))/;
  var WHOLE_RE = /(\d+)\s+$/;
  // Tử/mẫu là phép tính trong ngoặc: (3 × 5)/(4 × 5)
  var PAREN_BEFORE_RE = /\(\s*([\d.,]+(?:\s*[×·*+\-−]\s*[\d.,]+)+)\s*\)$/;
  var PAREN_AFTER_RE = /^\(\s*([\d.,]+(?:\s*[×·*+\-−]\s*[\d.,]+)+)\s*\)/;

  /** Dòng bắt đầu bằng "a)" mà có "b)", "c)"… nối tiếp trên cùng dòng → mỗi ý một dòng. */
  function splitParts(text) {
    return String(text || '').split('\n').map(function (line) {
      var m = /^\s*([a-g])\)\s/.exec(line);
      if (!m) return line;
      var cur = m[1];
      var from = m[0].length;
      while (cur < 'h') {
        var nx = String.fromCharCode(cur.charCodeAt(0) + 1);
        var re = new RegExp('\\s+' + nx + '\\)(?=\\s)', 'g');
        re.lastIndex = from;
        var mm = re.exec(line);
        if (!mm) break;
        line = line.slice(0, mm.index) + '\n' + nx + ')' + line.slice(mm.index + mm[0].length);
        from = mm.index + 3;
        cur = nx;
      }
      return line;
    }).join('\n');
  }

  function mathTokens(str) {
    var s = String(str || '');
    if (!s) return [];
    var tokens = [];
    var lastIndex = 0;
    var i = 0;
    while (i < s.length) {
      var slash = s.indexOf('/', i);
      if (slash === -1) break;

      var before = s.slice(lastIndex, slash);
      var mBefore = NUM_BEFORE_RE.exec(before);
      var after = s.slice(slash + 1);
      var mAfter = NUM_AFTER_RE.exec(after);
      var pBefore = mBefore ? null : PAREN_BEFORE_RE.exec(before);
      var pAfter = mAfter ? null : PAREN_AFTER_RE.exec(after);

      if (!(mBefore || pBefore) || !(mAfter || pAfter)) {
        i = slash + 1;
        continue;
      }

      var numN = mBefore ? mBefore[1] || mBefore[2] : pBefore[1];
      var numD = mAfter ? mAfter[1] || mAfter[2] : pAfter[1];
      var startN = slash - (mBefore ? numN.length : pBefore[0].length);
      var endD = slash + 1 + (mAfter ? numD.length : pAfter[0].length);

      var nextChar = s.charAt(endD);
      if (nextChar && !isTokenBorder(nextChar)) {
        i = slash + 1;
        continue;
      }

      var prevChar = startN > 0 ? s.charAt(startN - 1) : '';

      var beforeN = s.slice(lastIndex, startN);
      var mWhole = pBefore ? null : WHOLE_RE.exec(beforeN);
      var whole = null;
      var startWhole = startN;

      if (mWhole) {
        var wCandidate = mWhole[1];
        var wStart = startN - mWhole[0].length;
        var wPrevChar = wStart > 0 ? s.charAt(wStart - 1) : '';
        if (isTokenBorder(wPrevChar)) {
          whole = wCandidate;
          startWhole = wStart;
        }
      }

      if (!whole && prevChar && !isTokenBorder(prevChar)) {
        i = slash + 1;
        continue;
      }

      var tokenStart = whole ? startWhole : startN;
      if (tokenStart > lastIndex) {
        tokens.push({ t: 'text', v: s.slice(lastIndex, tokenStart) });
      }

      if (whole) {
        tokens.push({ t: 'mixed', whole: whole, n: numN, d: numD });
      } else {
        tokens.push({ t: 'frac', n: numN, d: numD });
      }

      lastIndex = endD;
      i = endD;
    }
    if (lastIndex < s.length) {
      tokens.push({ t: 'text', v: s.slice(lastIndex) });
    }
    return tokens;
  }

  // Phông Symbol của Word/MathType cho ra ký tự vùng riêng U+F0xx: đổi về ký tự thường.
  // Ngoặc lớn ghép nhiều mảnh: mảnh giữa thành "(" ")", mảnh trên/dưới bỏ đi.
  var SYMBOL_MAP = {
    'B4': '×', 'B8': '÷', 'B3': '≥', 'A3': '≤', 'B9': '≠', 'B1': '±', 'B0': '°', 'BC': '…', 'D7': '·', 'B7': '•',
    '2D': '−', '2B': '+', '3D': '=', '3C': '<', '3E': '>', '28': '(', '29': ')', '5B': '[', '5D': ']', '7B': '{', '7D': '}',
    'AE': '→', 'DE': '⇒', 'DB': '⇔', 'CE': '∈', 'C6': '∅', 'D6': '√', 'A5': '∞', 'BB': '≈', 'D0': '∠', '5E': '⊥', 'B5': '∝',
    'E7': '(', 'F7': ')', 'EA': '[', 'FA': ']', 'ED': '{', 'FD': '}',
    'E6': '', 'E8': '', 'F6': '', 'F8': '', 'E9': '', 'EB': '', 'F9': '', 'FB': '', 'EC': '', 'EE': '', 'FC': '', 'FE': '', 'EF': ''
  };
  /** Chữ nghiêng toán học trong PDF (𝑥, 𝑦…) → chữ thường để học sinh gõ được; ký tự phông Symbol → ký tự thường. */
  function plainMath(t) {
    return String(t).replace(/[\uD835][\uDC00-\uDFFF]/g, function (c) { return c.normalize('NFKC'); })
      .replace(/[\uF020-\uF0FF]/g, function (c) {
        var k = c.charCodeAt(0).toString(16).slice(2).toUpperCase();
        return SYMBOL_MAP[k] !== undefined ? SYMBOL_MAP[k] : c;
      });
  }

  function splitBlocks(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var hasMarkers = lines.some(function (l) { return Q_START.test(l); });
    var blocks = [];
    var cur = null;
    lines.forEach(function (line) {
      var m = hasMarkers ? Q_START.exec(line) : null;
      var startsNew = hasMarkers ? !!m : (line.trim() !== '' && (!cur || cur.blankBefore));
      if (startsNew) {
        cur = { lines: [], blankBefore: false, meta: m ? (m[1] || m[2] || '') : '' };
        blocks.push(cur);
        if (m) line = line.slice(m[0].length);
      }
      if (!cur) return; // chữ trước "Câu 1" → bỏ qua
      if (line.trim() === '') { cur.blankBefore = true; cur.lines.push(''); return; }
      cur.blankBefore = false;
      cur.lines.push(line);
    });
    return blocks;
  }

  /** opts.allowEssay: cho phép câu tự luận (Bài tập về nhà). */
  function parse(text, opts) {
    opts = opts || {};
    var questions = [];
    var errors = [];
    splitBlocks(text).forEach(function (block, i) {
      var n = i + 1;
      var qText = [];
      var options = [];
      var correct = -1;
      var answerLine = null;
      var explain = [];
      var mode = 'text';
      var essayMarked = ESSAY_WORD.test(block.meta);
      var pm = POINTS.exec(block.meta);
      var points = pm ? Number(pm[1].replace(',', '.')) : 1;
      var hasFillAnswer = block.lines.some(function (l) { return ANSWER.test(l) && l.indexOf(';') >= 0; });

      var image = null;
      block.lines.forEach(function (line) {
        var m;
        if ((m = IMAGE.exec(line))) { image = m[1]; return; }
        if ((m = EXPLAIN.exec(line))) { mode = 'explain'; if (m[2].trim()) explain.push(m[2].trim()); return; }
        if (mode === 'explain') { explain.push(line); return; }
        if ((m = ANSWER.exec(line))) {
          if (essayMarked) { mode = 'explain'; if (m[1].trim()) explain.push(m[1].trim()); return; }
          answerLine = m[1].trim(); mode = 'answer'; return;
        }
        // Câu điền khuyết ("Đáp án: x; y") hay có ý a), b)… → không phải lựa chọn A, B.
        if (!essayMarked && !hasFillAnswer && (m = OPTION.exec(line)) && mode !== 'answer') {
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

      var q = { text: qText.join('\n').trim(), explain: explain.join('\n').trim(), points: points };
      if (image) q.image = image;
      if (!q.text) errors.push('Câu ' + n + ': thiếu nội dung câu hỏi.');
      if (!(points > 0 && points <= 100)) errors.push('Câu ' + n + ': số điểm không hợp lệ.');

      var bCount = blankCount(q.text);
      if (essayMarked || (opts.allowEssay && !options.length && answerLine === null)) {
        q.type = 'essay';
        if (!opts.allowEssay) errors.push('Câu ' + n + ': bài luyện tập chỉ dùng trắc nghiệm và trả lời ngắn (câu tự luận hãy đưa vào Bài tập về nhà).');
      } else if (options.length) {
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
      } else if (bCount >= 2) {
        q.type = 'fill';
        var parts = (answerLine || '').trim() ? answerLine.split(';') : [];
        if (parts.length !== bCount) {
          errors.push('Câu ' + n + ': có ' + bCount + ' chỗ trống nhưng đáp án có ' + parts.length + ' phần (ngăn cách bằng dấu ;).');
          q.answers = parts.map(function (p) {
            return p.split(/\s*\|\s*|\s+hoặc\s+/i).map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== '?'; });
          });
        } else {
          var answers = [];
          for (var bi = 0; bi < bCount; bi++) {
            var p = parts[bi];
            var ways = p ? p.split(/\s*\|\s*|\s+hoặc\s+/i).map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== '?'; }) : [];
            if (!ways.length) {
              errors.push('Câu ' + n + ': chưa có đáp án cho chỗ trống thứ ' + (bi + 1) + '.');
            }
            answers.push(ways);
          }
          q.answers = answers;
        }
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

  function summary(questions) {
    var s = { mc: 0, short: 0, fill: 0, essay: 0, total: 0, autoPoints: 0, essayPoints: 0 };
    questions.forEach(function (q) {
      if (s[q.type] !== undefined) s[q.type]++;
      s.total += q.points || 1;
      if (q.type === 'essay') s.essayPoints += q.points || 1; else s.autoPoints += q.points || 1;
    });
    s.total = Math.round(s.total * 100) / 100;
    return s;
  }

  function normAnswer(s) {
    // 12.500 = 12500 (dấu chấm phân cách hàng nghìn kiểu Việt Nam), bỏ trước khi đổi dấu phẩy thập phân thành dấu chấm.
    return String(s).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d.,])(-?[1-9]\d{0,2}(?:\.\d{3})+)(?![\d.])/g, function (m, pre, n) { return pre + n.replace(/\./g, ''); }).replace(/,/g, '.').replace(/\.$/, '')
      .replace(/([a-zà-ỹđ])2(?![0-9])/g, '$1²').replace(/([a-zà-ỹđ])3(?![0-9])/g, '$1³');
  }

  function numPart(s) {
    // Sau "/" là chữ số → phân số a/b; sau "/" là chữ cái → đơn vị như km/h, m/s.
    var m = /^(-?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)([a-zà-ỹđ²³°%][a-zà-ỹđ0-9²³°%/]*)?$/.exec(s);
    if (!m) return null;
    var parts = m[1].split('/');
    var num = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(m[1]);
    if (!isFinite(num)) return null;
    return { num: num, unit: m[2] || '' };
  }

  /** Tỉ lệ điểm câu điền khuyết 0..1 (mỗi ô trống đúng tính theo cách chấm trả lời ngắn). */
  function fillScore(x, a) {
    if (!x || !Array.isArray(x.answers) || !x.answers.length) return 0;
    if (!Array.isArray(a)) return 0;
    var correct = 0;
    for (var i = 0; i < x.answers.length; i++) {
      if (isCorrect({ type: 'short', answers: x.answers[i] }, a[i])) {
        correct++;
      }
    }
    return correct / x.answers.length;
  }

  /** So khớp câu trả lời (trắc nghiệm, trả lời ngắn hoặc điền khuyết), giống isCorrect_ của Code.gs. */
  function isCorrect(x, a) {
    if (!x || a === null || a === undefined || a === '') return false;
    if (x.type === 'mc') return Number(a) === Number(x.correct);
    if (x.type === 'fill') return fillScore(x, a) === 1;
    var v = normAnswer(a);
    var vn = numPart(v);
    return (x.answers || []).some(function (ans) {
      var k = normAnswer(ans);
      if (k === v) return true;
      // "24" khớp "24cm", "3/4" khớp "0,75kg": cùng giá trị số, chỉ khác đơn vị (hoặc thiếu đơn vị).
      var kn = numPart(k);
      return vn !== null && kn !== null && Math.abs(vn.num - kn.num) <= 1e-9 && (!vn.unit || !kn.unit || vn.unit === kn.unit);
    });
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
    'Câu 3: Viết số thích hợp vào chỗ trống.',
    'a) 3 m² 2 cm² = …… m²   b) 123 tạ = …… tấn',
    'Đáp án: 3,0002; 12,3 | 123/10',
    'Giải thích: a) 3 m² 2 cm² = 3,0002 m²; b) 123 tạ = 12,3 tấn.',
    '',
    'Câu 4: Số nào chia hết cho cả 2 và 5?',
    'A. 25',
    'B. 52',
    'C. 105',
    'D. 250',
    'Đáp án: D',
    'Giải thích: Số chia hết cho cả 2 và 5 có chữ số tận cùng là 0.'
  ].join('\n');

  var SAMPLE_HW = [
    'Câu 1 (2 điểm): Phân số nào bằng 1/2?',
    'A. 2/3',
    '*B. 3/6',
    'C. 4/6',
    'D. 1/4',
    '',
    'Câu 2 (2 điểm): Tính 3/5 + 1/5 = ? (viết dạng phân số)',
    'Đáp án: 4/5',
    '',
    'Câu 3 (2 điểm): Viết số thích hợp vào chỗ trống.',
    'a) 3 m² 2 cm² = …… m²   b) 123 tạ = …… tấn',
    'Đáp án: 3,0002; 12,3 | 123/10',
    'Lời giải: a) 3 m² 2 cm² = 3,0002 m²; b) 123 tạ = 12,3 tấn.',
    '',
    'Câu 4 (tự luận, 4 điểm): Một cửa hàng có 120 kg gạo. Buổi sáng bán 1/3 số gạo, buổi chiều bán 1/4 số gạo còn lại. Hỏi cửa hàng còn bao nhiêu ki-lô-gam gạo?',
    'Hướng dẫn chấm: Buổi sáng bán 40 kg (1,5đ). Còn 80 kg, buổi chiều bán 20 kg (1,5đ). Còn lại 60 kg, có đáp số (1đ).'
  ].join('\n');

  /* ───── Ghi ngược câu hỏi ra mẫu chữ (để giáo viên xem lại, sửa) ───── */

  function num(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

  function toSource(questions) {
    return questions.map(function (q, i) {
      var meta = [];
      if (q.type === 'essay') meta.push('tự luận');
      if (q.points && q.points !== 1) meta.push(num(q.points) + ' điểm');
      var lines = ['Câu ' + (i + 1) + (meta.length ? ' (' + meta.join(', ') + ')' : '') + ': ' + (q.text || '')];
      if (q.image) lines.push('[Hình: ' + q.image + ']');
      if (q.type === 'mc') {
        (q.options || []).forEach(function (o, k) { lines.push((k === q.correct ? '*' : '') + String.fromCharCode(65 + k) + '. ' + o); });
      } else if (q.type === 'fill') {
        lines.push('Đáp án: ' + (q.answers || []).map(function (sub) {
          return (Array.isArray(sub) ? sub : [sub]).join(' | ');
        }).join('; '));
      } else if (q.type === 'short') {
        lines.push('Đáp án: ' + (q.answers || []).join(' | '));
      }
      if (q.explain) lines.push((q.type === 'essay' ? 'Hướng dẫn chấm: ' : 'Giải thích: ') + q.explain);
      return lines.join('\n');
    }).join('\n\n');
  }

  /** Nhân điểm các câu theo cùng tỉ lệ để tổng = total (mặc định 10), làm tròn 0,25. */
  function spreadPoints(questions, total) {
    total = total || 10;
    var sum = questions.reduce(function (a, q) { return a + (q.points || 1); }, 0) || 1;
    var acc = 0;
    return questions.map(function (q, i) {
      var p = i === questions.length - 1
        ? Math.round((total - acc) * 100) / 100
        : Math.max(0.25, Math.round((q.points || 1) * total / sum * 4) / 4);
      acc += p;
      return Object.assign({}, q, { points: p > 0 ? p : 0.25 });
    });
  }

  /* ───── Đọc chữ lấy từ file PDF đề (+ đáp án) và tự phân loại ───── */

  var QH = /^\s*(câu|bài)\s*(\d{1,3})\s*(?:\(([^)]*)\)|\[([^\]]*)\])?\s*[:.)\-–]?\s*(.*)$/i;
  var NUMQ = /^\s*(\d{1,2})\s*[.)]\s+(\S.*)$/;
  var SECTION = /^\s*(?:phần|part|dạng)\s*[IVX\d]*\b|^\s*[IVX]{1,4}\s*[.\-–)]\s+/i;
  var KEY_HEAD = /^\s*(?:bảng\s+)?(?:đáp\s*án|hướng\s*dẫn\s*(?:giải|chấm)|lời\s*giải|answer\s*key)\b/i;
  var EXPLAIN_HEAD = /^\s*(?:hướng\s*dẫn(?:\s*(?:giải|chấm))?|lời\s*giải|bài\s*giải|giải(?:\s*thích)?)\s*[:：]?\s*(.*)$/i;
  var OPT_MARK = /(^|\s)\(?([A-H])\s*[.)]\s*/g;

  var PAGE_MARK = '⟦TRANG⟧';
  var RANGE = /(?:questions?|câu|bài)\s*(\d{1,3})\s*(?:[-–—]|đến|tới|to)\s*(\d{1,3})/i;
  var MARKS = /(\d+(?:[.,]\d+)?)\s*(?:điểm|marks?|points?|pts?)\b/i;

  function matchExplainHead(line) {
    var m = EXPLAIN_HEAD.exec(line);
    if (!m) return null;
    if (line.indexOf(':') < 0 && line.indexOf('：') < 0 && m[1].trim()) return null;
    return m;
  }

  function isKeyHead(l) {
    if (!l || l.length >= 60) return false;
    if (!KEY_HEAD.test(l)) return false;
    if (/^\s*đáp\s*án(?:\s*mẫu)?\s*[:：]\s*\S+/i.test(l)) return false;
    return true;
  }

  var EXAM_RE = /^\s*đề\s*(?:thi\s*|kiểm\s*tra\s*)?(?:số\s*)?(\d{1,3})\b/i;
  function isExamHead(line) {
    var l = String(line || '').normalize('NFC').trim();
    return l.length < 40 && EXAM_RE.test(l);
  }

  function examSections(lines) {
    var list = [];
    (lines || []).forEach(function (line, i) {
      var l = String(line || '').normalize('NFC').trim();
      if (!l || l.length >= 40) return;
      var m = EXAM_RE.exec(l);
      if (m) {
        list.push({ name: l, num: m[1], start: i });
      }
    });
    return list.length >= 2 ? list : [];
  }

  /**
   * Tiêu đề phần: "I. TRẮC NGHIỆM", "PHẦN II", "Phần trắc nghiệm (3 điểm)", "Part 1".
   * "Phần trồng cây xanh là: …" trong lời giải không phải tiêu đề: sau "phần/part/dạng" phải là số,
   * số La Mã, chữ cái A–D, hoặc cả dòng là tên loại câu / viết HOA.
   */
  function isSection(line) {
    if (!SECTION.test(line) || line.length >= 90 || QH.test(line)) return false;
    if (!/^\s*(?:phần|part|dạng)\b/i.test(line)) return true;
    if (/^\s*(?:phần|part|dạng)\s*(?:[IVX]+|\d+|[A-D])\b/i.test(line)) return true;
    var head = line.split(/[(:]/)[0];
    return !!sectionType(head) || (head === head.toUpperCase() && /[A-ZĐÀ-Ỹ]/.test(head));
  }

  function sectionType(line) {
    if (/tự\s*luận|essay|written|open[-\s]*ended|extended/i.test(line)) return 'essay';
    if (/trả\s*lời\s*ngắn|điền|đáp\s*số|short\s*answer|fill/i.test(line)) return 'short';
    if (/trắc\s*nghiệm|multiple\s*choice/i.test(line)) return 'mc';
    return null;
  }

  /** Tách "A. 4   B. 5   C. 6" thành các lựa chọn, đúng thứ tự A, B, C… */
  function splitOptions(line, startIndex) {
    var marks = [];
    var m;
    var expect = startIndex;
    OPT_MARK.lastIndex = 0;
    while ((m = OPT_MARK.exec(line))) {
      if (m[2].toUpperCase().charCodeAt(0) - 65 === expect) {
        marks.push({ at: m.index + m[1].length, end: OPT_MARK.lastIndex });
        expect++;
      }
    }
    if (!marks.length || marks[0].at > 0 && line.slice(0, marks[0].at).trim()) return null;
    return marks.map(function (mk, i) {
      return line.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : line.length).trim();
    });
  }

  function extractNumberBeforeUnit(text, unit, groupIdx, groupTotal) {
    var lastEq = text.lastIndexOf('=');
    var part = lastEq >= 0 ? text.slice(lastEq + 1).trim() : text.trim();
    if (unit) {
      var escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(\\d[\\d .,]*(?:/\\s*\\d[\\d .,]*)?)\\s*' + escapedUnit + '(?![\\wà-ỹĐđ²³])', 'i');
      var m = re.exec(part);
      if (m) {
        return m[1].trim().replace(/\s+/g, ' ');
      }
    }
    var allNums = [];
    var numRe = /\d[\d .,]*(?:\/\s*\d[\d .,]*)?/g;
    var nm;
    while ((nm = numRe.exec(part))) {
      var nStr = nm[0].trim().replace(/[,;:.?!]+$/, '').trim();
      if (nStr) allNums.push(nStr.replace(/\s+/g, ' '));
    }
    if (!allNums.length) return '?';
    if (groupTotal > 1) {
      return allNums[Math.min(groupIdx, allNums.length - 1)];
    }
    return allNums[allNums.length - 1];
  }

  function guessFillAnswers(qText, kText) {
    kText = String(kText || '').trim();
    var blanks = [];
    var m;
    BLANK_RE.lastIndex = 0;
    while ((m = BLANK_RE.exec(qText))) {
      var bIdx = m.index;
      var bEnd = BLANK_RE.lastIndex;
      var beforeText = qText.slice(0, bIdx);
      var lm;
      var lastLabel = null;
      var ord = 0;
      SUB_LABEL_RE.lastIndex = 0;
      while ((lm = SUB_LABEL_RE.exec(beforeText))) {
        lastLabel = lm[1].toLowerCase();
        ord++;
      }
      var afterText = qText.slice(bEnd).replace(/^\s+/, '');
      var um = /^([^\s….)]+)/.exec(afterText);
      var unit = um ? um[1] : '';
      if (/^[a-hA-H\d][.)]$/.test(unit) || /^[=+\-*×÷]/.test(unit)) unit = '';
      unit = unit.replace(/[,;:.?!)]+$/, '');
      blanks.push({ label: lastLabel, ord: ord, unit: unit });
    }

    if (!kText) {
      return blanks.map(function () { return '?'; });
    }

    var kSections = [];
    var km;
    SUB_LABEL_RE.lastIndex = 0;
    var labelMatches = [];
    while ((km = SUB_LABEL_RE.exec(kText))) {
      var matchStart = km.index + km[0].indexOf(km[1]);
      labelMatches.push({ label: km[1].toLowerCase(), start: matchStart, end: SUB_LABEL_RE.lastIndex });
    }

    for (var i = 0; i < labelMatches.length; i++) {
      var curM = labelMatches[i];
      var nextStart = (i + 1 < labelMatches.length) ? labelMatches[i + 1].start : kText.length;
      var secText = kText.slice(curM.end, nextStart).trim();
      kSections.push({ label: curM.label, text: secText });
    }

    // Nhóm ô trống theo phần a), b)… theo thứ tự xuất hiện (đề có thể ghi nhầm nhãn, vd hai lần "b)")
    var groupCounts = {};
    var ordCount = 0;
    blanks.forEach(function (b) {
      var key = b.label ? 'o' + b.ord : '__all__';
      if (!groupCounts[key] && b.label) ordCount++;
      groupCounts[key] = (groupCounts[key] || 0) + 1;
    });
    var byOrder = ordCount > 1 && ordCount === kSections.length;
    var ordIndex = {};
    var groupIndices = {};

    var usedSecIndices = {};
    return blanks.map(function (b, bIdx) {
      var grpKey = b.label ? 'o' + b.ord : '__all__';
      var gIdx = groupIndices[grpKey] || 0;
      groupIndices[grpKey] = gIdx + 1;
      var gTotal = groupCounts[grpKey] || 1;
      if (b.label && ordIndex[grpKey] == null) ordIndex[grpKey] = Object.keys(ordIndex).length;

      var secText = null;
      if (b.label && byOrder) {
        secText = kSections[ordIndex[grpKey]].text;
      } else if (b.label) {
        for (var si = 0; si < kSections.length; si++) {
          if (kSections[si].label === b.label && !usedSecIndices[si]) {
            secText = kSections[si].text;
            if (gIdx + 1 >= gTotal) usedSecIndices[si] = true;
            break;
          }
        }
      }
      if (!secText) {
        if (kSections[bIdx] && !usedSecIndices[bIdx]) {
          secText = kSections[bIdx].text;
        } else {
          secText = kText;
        }
      }
      return extractNumberBeforeUnit(secText, b.unit, gIdx, gTotal);
    });
  }

  function extractBlockValue(blockLines) {
    var ansText = '';
    var hasAns = false;
    var expLines = [];
    var hasExp = false;
    var mode = 'pre';
    for (var i = 0; i < blockLines.length; i++) {
      var line = blockLines[i];
      var am = ANSWER.exec(line);
      var em = matchExplainHead(line);
      if (em) {
        hasExp = true;
        mode = 'exp';
        if (em[1].trim()) expLines.push(em[1].trim());
        continue;
      }
      if (am) {
        hasAns = true;
        ansText = am[1].trim();
        mode = 'ans';
        continue;
      }
      if (mode === 'exp' && line !== PAGE_MARK) {
        expLines.push(line);
      }
    }
    if (hasAns || hasExp) {
      var parts = [];
      if (hasAns && ansText) parts.push(ansText);
      var expText = expLines.join('\n').trim();
      if (hasExp && expText) parts.push(expText);
      return parts.join('\n').trim();
    }
    return blockLines.join('\n').trim();
  }

  function parseKey(lines) {
    var key = {};
    var blocks = [];
    var cur = null;
    var skip = false;
    var tableKw = ''; // "câu"/"bài" theo tiêu đề cột của bảng đáp án
    lines.forEach(function (line, i) {
      if (skip) { skip = false; return; }
      if (isKeyHead(line) && !/\d/.test(line)) return;
      if (isSection(line)) { cur = null; return; }
      // Bảng: "Câu | 1 | 2 | 3" rồi dòng dưới "Đáp án | B | C | A"
      if (/^\s*câu\b/i.test(line) && (line.match(/\d+/g) || []).length >= 2 && lines[i + 1] && /^\s*đáp\s*án\b/i.test(lines[i + 1])) {
        var ns = line.match(/\d+/g) || [];
        var as = lines[i + 1].replace(/^\s*đáp\s*án\s*[:：]?/i, '').trim().split(/[\s|,;]+/).filter(Boolean);
        ns.forEach(function (n, k) { if (as[k] && !key[n]) key[n] = as[k]; });
        cur = null;
        skip = true;
        return;
      }
      if (line.indexOf('|') >= 0) {
        // Dòng tiêu đề bảng "Câu | Đáp án | Hướng dẫn", dòng tổng "Tổng Phần II | 7" → bỏ.
        var th = /^\s*(câu|bài|stt)\s*\|/i.exec(line);
        if (th && !/^\s*(?:câu|bài)\s*\d/i.test(line)) { tableKw = /stt/i.test(th[1]) ? '' : th[1].toLowerCase(); cur = null; return; }
        if (/^\s*tổng\b/i.test(line)) { cur = null; return; }
        // Hàng bảng "1 | 75 | Số nữ: …" (cột số câu, cột đáp án, cột hướng dẫn).
        var tr = /^\s*(?:câu\s*)?(\d{1,3})\s*\|\s*([^|]*?)\s*(?:\|\s*(.*))?$/i.exec(line);
        if (tr && tr[2]) {
          cur = { kw: tableKw, n: Number(tr[1]), lines: ['Đáp án: ' + tr[2]].concat(tr[3] ? ['Hướng dẫn: ' + tr[3]] : []) };
          blocks.push(cur);
          return;
        }
        // Bảng hướng dẫn chấm "Bài 1 | lời giải | 0,5": cột điểm cuối → "(0,5 đ)"; ô "(1,5 đ)" dưới số bài → bỏ.
        line = line.replace(/^\s*\(\s*\d+(?:[.,]\d+)?\s*(?:đ|điểm)\s*\)\s*\|\s*/i, '')
          .replace(/\s*\|\s*(\d+(?:[.,]\d+)?)\s*$/, ' ($1 đ)')
          .replace(/\s*\|\s*/g, ' ').trim();
        if (!line) return;
      }
      var m = QH.exec(line);
      if (m) {
        cur = { kw: m[1].toLowerCase(), n: Number(m[2]), lines: [m[5]] };
        blocks.push(cur);
        return;
      }
      if (cur !== null) cur.lines.push(line);
    });
    blocks.forEach(function (b) {
      var val = extractBlockValue(b.lines);
      if (b.kw) key[b.kw + b.n] = val;
      if (key[b.n] === undefined) key[b.n] = val;
    });
    // Dạng gọn: "1.B 2.C 3-A" hoặc "1B 2C"
    lines.join('\n').replace(/(?:^|[\s,;|])(\d{1,3})\s*[.:\-–)]?\s*([A-Ha-h])(?![\wÀ-ỹ])/g, function (all, n, l) {
      if (!key[n]) { key[n] = l.toUpperCase(); key['_short_' + n] = true; }
      return all;
    });
    return key;
  }

  function cleanAnswer(s) {
    return String(s).replace(/^\s*(?:đáp\s*án|đáp\s*số|trả\s*lời)\s*[:：]?\s*/i, '').replace(/[.。]\s*$/, '').trim();
  }

  /** Vị trí (số thứ tự dòng) của các dòng mở đầu câu hỏi, cùng quy tắc với fromText. */
  function questionStarts(lines) {
    var useNum = !lines.some(function (l) { return QH.test(l); });
    var out = [];
    var seenQ = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var isQ = QH.test(l) || (useNum && NUMQ.test(l));
      if (isQ) seenQ = true;
      if (seenQ && isKeyHead(l)) break;
      if (isQ && !isSection(l)) out.push(i);
    }
    return out;
  }

  /** text: chữ của file đề; keyText: chữ của file đáp án (nếu để riêng); opts.figures[i]: tên hình của câu thứ i. */
  function fromText(text, keyText, opts) {
    opts = opts || {};
    text = plainMath(text);
    keyText = keyText ? plainMath(keyText) : keyText;
    var lines = String(text || '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var keyLines = keyText ? String(keyText).normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean) : null;
    var useNum = !lines.some(function (l) { return QH.test(l); });
    // Câu dẫn khi gặp NUMQ: bỏ các số trang lẻ.
    lines = lines.filter(function (l) { return l === PAGE_MARK || !/^\s*\d+\s*(?:\/|of|trên)\s*\d+\s*$/i.test(l); });

    var allExams = examSections(lines);
    var exams = allExams.map(function (s) { return s.name; });
    var chosenExam = null;
    if (opts.exam !== undefined && opts.exam !== null && allExams.length >= 2) {
      var examIdx = Number(opts.exam);
      if (examIdx >= 0 && examIdx < allExams.length) {
        chosenExam = allExams[examIdx];
        if (!opts.examKeyOnly) {
          var start = chosenExam.start;
          var end = (examIdx + 1 < allExams.length) ? allExams[examIdx + 1].start : lines.length;
          lines = lines.slice(start, end);
        }
      }
    }

    if (keyLines) {
      var keyExams = examSections(keyLines);
      if (keyExams.length >= 2) {
        var chosenKeyExam = null;
        var targetNum = (chosenExam && chosenExam.num) || (opts.examNum ? String(opts.examNum) : null);
        if (targetNum) {
          for (var ki = 0; ki < keyExams.length; ki++) {
            if (keyExams[ki].num === targetNum) { chosenKeyExam = keyExams[ki]; break; }
          }
        }
        if (!chosenKeyExam && opts.exam !== undefined && opts.exam !== null) {
          var kIdx = Number(opts.exam);
          if (kIdx >= 0 && kIdx < keyExams.length) chosenKeyExam = keyExams[kIdx];
        }
        if (chosenKeyExam) {
          var kStart = chosenKeyExam.start;
          var kPos = keyExams.indexOf(chosenKeyExam);
          var kEnd = kPos + 1 < keyExams.length ? keyExams[kPos + 1].start : keyLines.length;
          keyLines = keyLines.slice(kStart, kEnd);
        }
      }
    }

    if (!keyLines) {
      var seenQ = false;
      for (var i = 0; i < lines.length; i++) {
        if (QH.test(lines[i]) || (useNum && NUMQ.test(lines[i]))) seenQ = true;
        if (seenQ && isKeyHead(lines[i])) {
          keyLines = lines.slice(i + 1);
          lines = lines.slice(0, i);
          break;
        }
      }
    }

    var inlineCount = 0;
    lines.forEach(function (l) {
      if (ANSWER.test(l) || matchExplainHead(l)) inlineCount++;
    });
    var hasInlineKeys = inlineCount >= 2 || (inlineCount >= 1 && questionStarts(lines).length <= 1);

    var qs = [];
    var section = null;
    var sections = [];
    var sec = null;
    var cur = null;
    var afterBreak = false;
    var preamble = [];
    var groups = [];
    lines.forEach(function (line) {
      // Lời giải chèn sau câu có thể sang trang sau → vẫn thuộc câu đó, không phải lời dẫn câu kế.
      if (line === PAGE_MARK) { if (!(hasInlineKeys && cur && cur.state !== 'body')) afterBreak = true; return; }
      if (isSection(line)) {
        var t = sectionType(line);
        if (t) section = t;
        var mk = MARKS.exec(line);
        var rg = RANGE.exec(line);
        if (!t && !mk && !rg && sec && /^\s*dạng\b/i.test(line)) { if (cur) afterBreak = true; return; }
        sec = { marks: mk ? Number(mk[1].replace(',', '.')) : null, range: rg ? [Number(rg[1]), Number(rg[2])] : null, qs: [] };
        sections.push(sec);
        if (cur) afterBreak = true; // chữ ngay sau tiêu đề phần là lời dẫn cho các câu sau
        return;
      }
      var m = QH.exec(line);
      var nm = !m && useNum ? NUMQ.exec(line) : null;
      if (m || nm) {
        cur = {
          kw: m ? m[1].toLowerCase() : '',
          n: m ? Number(m[2]) : Number(nm[1]),
          meta: m ? (m[3] || m[4] || '') : '',
          text: [],
          options: [],
          section: section,
          state: 'body',
          inlineAns: '',
          inlineExp: []
        };
        if (sec) sec.qs.push(cur);
        if (preamble.length) {
          // Lời dẫn đứng trước nhóm câu ("Quan sát hình, trả lời câu 11–15") → đặt lên đầu câu đầu nhóm.
          var pr = RANGE.exec(preamble.join(' '));
          cur.pre = preamble.slice();
          if (pr) groups.push([Number(pr[1]), Number(pr[2])]);
        }
        preamble = [];
        afterBreak = false;
        var rest = m ? m[5] : nm[2];
        var pts = !cur.meta && rest ? /^\(\s*(\d+(?:[.,]\d+)?)\s*(điểm|đ)?\s*\)\s*[:.\-–]?\s*/i.exec(rest) : null;
        if (pts && Number(pts[1].replace(',', '.')) > 0 && Number(pts[1].replace(',', '.')) <= 20) {
          cur.meta = pts[1] + ' điểm';
          rest = rest.slice(pts[0].length);
        }
        var inline = rest ? splitOptions(rest, 0) : null;
        if (rest) {
          // Lựa chọn có thể nằm ngay sau câu hỏi trên cùng dòng: "… là: A. 4 B. 5"
          var at = rest.search(/(^|\s)A\s*[.)]\s/);
          if (!inline && at > 0) {
            var opts = splitOptions(rest.slice(at).trim(), 0);
            if (opts && opts.length >= 2) { cur.text.push(rest.slice(0, at).trim()); cur.options = opts; }
            else cur.text.push(rest);
          } else cur.text.push(rest);
        }
        qs.push(cur);
        return;
      }
      if (!cur) return; // tiêu đề, họ tên… trước câu 1
      if (afterBreak) { preamble.push(line); return; }

      if (hasInlineKeys) {
        if (cur.state === 'explain') {
          cur.inlineExp.push(line);
          return;
        }
        if (cur.state === 'answer') {
          var em0 = matchExplainHead(line);
          if (em0) {
            cur.state = 'explain';
            if (em0[1].trim()) cur.inlineExp.push(em0[1].trim());
            return;
          }
          cur.inlineExp.push(line);
          return;
        }
        var am = ANSWER.exec(line);
        if (am) {
          cur.state = 'answer';
          cur.inlineAns = am[1].trim();
          return;
        }
        var em = matchExplainHead(line);
        if (em) {
          cur.state = 'explain';
          if (em[1].trim()) cur.inlineExp.push(em[1].trim());
          return;
        }
      }

      var more = splitOptions(line, cur.options.length);
      if (more && more.length && (cur.options.length || /^\(?A\s*[.)]/.test(line))) { cur.options = cur.options.concat(more); return; }
      if (cur.options.length) cur.options[cur.options.length - 1] += ' ' + line;
      else cur.text.push(line);
    });

    // Lời dẫn còn lại ở cuối trang (không có câu nào theo sau) → trả về câu cuối.
    if (preamble.length && cur) cur.text = cur.text.concat(preamble);

    // Điểm theo tiêu đề phần: "PHẦN I (4 điểm)", "Questions 1–5 • 5 marks" → chia đều cho các câu của phần.
    var perQ = {};
    sections.forEach(function (sc) {
      if (!sc.marks || !sc.qs.length) return;
      sc.qs.forEach(function (c) { perQ[qs.indexOf(c)] = Math.round(sc.marks / sc.qs.length * 100) / 100; });
    });

    var countByN = {};
    qs.forEach(function (c) { countByN[c.n] = (countByN[c.n] || 0) + 1; });

    var key = keyLines ? parseKey(keyLines) : {};
    var keyed = 0;
    var fillCount = 0;
    var guessed = 0;
    var questions = qs.map(function (c) {
      var k = '';
      if (c.kw && key[c.kw + c.n] !== undefined) {
        k = String(key[c.kw + c.n]).trim();
      } else if (countByN[c.n] === 1 && key[c.n] !== undefined) {
        k = String(key[c.n]).trim();
      } else if (c.options.length >= 2 && key[c.n] !== undefined && key['_short_' + c.n]) {
        k = String(key[c.n]).trim();
      }

      if (!k && (c.inlineAns || (c.inlineExp && c.inlineExp.length))) {
        var parts = [];
        if (c.inlineAns) parts.push(c.inlineAns);
        if (c.inlineExp && c.inlineExp.length) parts.push(c.inlineExp.join('\n').trim());
        k = parts.join('\n').trim();
      }

      // "Bài giải" + dòng chấm để học sinh viết: không phải đáp án.
      var writingSpace = /[.…]{16,}/.test(c.text.join(' ') + ' ' + (c.inlineExp || []).join(' ') + ' ' + k);
      if (/^[\s.…]*$/.test(k)) k = '';
      if (k) keyed++;
      var pm = POINTS.exec(c.meta);
      if (c.pre) c.text = c.pre.concat(c.text);
      if (writingSpace) c.text = c.text.filter(function (l) { return !/^[\s.…]{16,}$/.test(l); });
      // Nối các dòng bị PDF ngắt giữa câu; giữ xuống dòng ở ý nhỏ a), b)… hoặc gạch đầu dòng.
      var joined = c.text.reduce(function (acc, l, k) {
        if (!k) return l;
        var prevL = c.text[k - 1];
        var heading = prevL.length > 3 && prevL === prevL.toUpperCase() && /[A-ZĐÀ-Ỹ]/.test(prevL);
        return acc + (heading || /^\s*(?:[a-hA-H]\s*[).]|\d+\s*\)|[-–•+*]\s)/.test(l) || /[:;?!.]\s*$/.test(prevL) && /^\s*[A-ZĐÀ-Ỹ(]/.test(l) ? '\n' : ' ') + l;
      }, '');
      var q = { text: joined.trim(), points: pm ? Number(pm[1].replace(',', '.')) : (perQ[qs.indexOf(c)] || 1), explain: '' };
      var fig = opts.figures && opts.figures[qs.indexOf(c)];
      if (fig) q.image = fig;
      var bCount = blankCount(joined);
      var essayMarked = ESSAY_WORD.test(c.meta) || c.section === 'essay';
      if (c.options.length >= 2 && !essayMarked) {
        q.type = 'mc';
        q.options = c.options;
        var lm = /^\(?([A-Ha-h])\b/.exec(k);
        q.correct = lm ? lm[1].toUpperCase().charCodeAt(0) - 65 : -1;
        var rest = lm ? k.slice(lm[0].length).replace(/^[\s.:)\-–]+/, '').trim() : k;
        if (rest && rest.length > 1) q.explain = rest;
      } else if (bCount >= 2 && !writingSpace) {
        // Dòng chấm dài ("……………………") là chỗ viết bài giải → giữ tự luận.
        q.type = 'fill';
        fillCount++;
        var guessedAns = guessFillAnswers(joined, k);
        q.answers = guessedAns.map(function (a) { return [a]; });
        if (k && guessedAns.some(function (a) { return a !== '?'; })) guessed++;
        q.explain = k;
      } else {
        var ans = cleanAnswer(k.split('\n')[0] || '');
        var long = k.length > 40 || k.indexOf('\n') >= 0;
        var qtext = c.text.join(' ');
        var looksEssay = /trình\s*bày|giải\s*bài|lời\s*giải|giải\s*thích|tại\s*sao|vì\s*sao|viết\s*(một\s*)?(đoạn|bài|câu)|chứng\s*minh|hỏi\b.*\?/i.test(qtext);
        var looksShort = /điền|=\s*\?|=\s*\.{2,}|\.{3,}|bằng\s*bao\s*nhiêu|là\s*bao\s*nhiêu|kết\s*quả\s*(của|là)/i.test(qtext);
        if (essayMarked || c.section !== 'short' && (long || (!k && (looksEssay || !looksShort)))) {
          q.type = 'essay';
          q.explain = k;
        } else {
          q.type = 'short';
          q.answers = ans.split(/\s*\|\s*|\s+hoặc\s+/i).filter(Boolean);
          var after = k.split('\n').slice(1).join('\n').trim();
          if (after) q.explain = after;
        }
      }
      return q;
    });
    return {
      source: toSource(questions),
      count: questions.length,
      keyed: keyed,
      hasKey: !!keyLines || hasInlineKeys,
      groups: groups,
      exams: exams,
      examName: chosenExam ? chosenExam.name : '',
      fillCount: fillCount,
      guessed: guessed
    };
  }

  function classStats(questions, submissions) {
    var qs = Array.isArray(questions) ? questions : [];
    var valid = (Array.isArray(submissions) ? submissions : []).filter(function (x) {
      return x && x.submission && (x.submission.status === 'submitted' || x.submission.status === 'returned');
    });
    var total = valid.length;

    function itemScore(sub, i) {
      if (sub.itemScores && sub.itemScores[i] !== null && sub.itemScores[i] !== undefined && sub.itemScores[i] !== '') {
        var n1 = Number(sub.itemScores[i]);
        if (!isNaN(n1)) return n1;
      }
      if (sub.auto && sub.auto[i] !== null && sub.auto[i] !== undefined && sub.auto[i] !== '') {
        var n2 = Number(sub.auto[i]);
        if (!isNaN(n2)) return n2;
      }
      return null;
    }

    function isBlank(q, idx, sub) {
      var ans = sub.answers ? sub.answers[idx] : null;
      if (q.type === 'mc') {
        return ans === null || ans === undefined || ans === '';
      }
      if (q.type === 'fill') {
        if (!Array.isArray(ans) || !ans.length) return true;
        for (var k = 0; k < ans.length; k++) {
          if (ans[k] !== null && ans[k] !== undefined && String(ans[k]).trim() !== '') return false;
        }
        return true;
      }
      if (q.type === 'essay') {
        var hasText = ans !== null && ans !== undefined && String(ans).trim() !== '';
        if (hasText) return false;
        var files = Array.isArray(sub.files) ? sub.files : [];
        for (var f = 0; f < files.length; f++) {
          if (files[f] && files[f].q === idx) return false;
        }
        return true;
      }
      return ans === null || ans === undefined || String(ans).trim() === '';
    }

    function addWrong(map, list, key, display) {
      if (!map[key]) {
        map[key] = { answer: display, count: 0 };
        list.push(map[key]);
      }
      map[key].count++;
    }

    var items = qs.map(function (q, i) {
      var pts = Number(q.points) || 1;
      var scored = 0;
      var pending = 0;
      var sumScore = 0;
      var correctCount = 0;
      var partialCount = 0;
      var wrongCount = 0;
      var blankCountVal = 0;
      var blankZero = 0; // đã có điểm 0 vì bỏ trống (để không đếm hai lần với "sai")
      var wrongNames = [];
      var wrongMap = {};
      var wrongList = [];

      valid.forEach(function (x) {
        var sub = x.submission;
        var blank = isBlank(q, i, sub);
        if (blank) blankCountVal++;

        var sc = itemScore(sub, i);
        if (sc === null) {
          pending++;
          return;
        }
        scored++;
        sumScore += sc;
        if (sc >= pts - 1e-9) {
          correctCount++;
        } else {
          if (sc > 1e-9) partialCount++;
          else {
            wrongCount++;
            if (blank) blankZero++;
          }
          wrongNames.push(x.fullName || '');
          if (!blank) {
            var ans = sub.answers ? sub.answers[i] : null;
            if (q.type === 'mc') {
              var optIdx = Number(ans);
              if (!isNaN(optIdx) && optIdx >= 0) {
                var optText = q.options && q.options[optIdx] !== undefined ? q.options[optIdx] : '';
                var mcLabel = String.fromCharCode(65 + optIdx) + '. ' + optText;
                addWrong(wrongMap, wrongList, 'mc:' + optIdx, mcLabel);
              }
            } else if (q.type === 'short') {
              var raw = String(ans).trim();
              if (raw) {
                addWrong(wrongMap, wrongList, normAnswer(raw), raw);
              }
            }
          }
        }
      });

      wrongList.sort(function (a, b) { return b.count - a.count; });
      var wrongAnswers = (q.type === 'mc' || q.type === 'short') ? wrongList.slice(0, 5) : [];

      var blanks = null;
      if (q.type === 'fill') {
        var ansArr = Array.isArray(q.answers) ? q.answers : [];
        blanks = ansArr.map(function (bAns, k) {
          var bCorrect = 0;
          var bMap = {};
          var bList = [];
          valid.forEach(function (x) {
            var sub = x.submission;
            var ans = sub.answers && Array.isArray(sub.answers[i]) ? sub.answers[i] : [];
            var a = ans[k] !== null && ans[k] !== undefined ? String(ans[k]).trim() : '';
            if (isCorrect({ type: 'short', answers: bAns }, a)) {
              bCorrect++;
            } else if (a !== '') {
              addWrong(bMap, bList, normAnswer(a), a);
            }
          });
          bList.sort(function (a, b) { return b.count - a.count; });
          return {
            correctCount: bCorrect,
            total: total,
            wrongAnswers: bList.slice(0, 3)
          };
        });
      }

      var avgRatio = scored > 0 ? sumScore / (scored * pts) : null;
      var level = avgRatio === null ? null : (avgRatio < 0.5 - 1e-9 ? 'weak' : (avgRatio < 0.8 - 1e-9 ? 'watch' : 'good'));

      return {
        index: i,
        type: q.type,
        points: pts,
        scored: scored,
        pending: pending,
        avgRatio: avgRatio,
        correctCount: correctCount,
        partialCount: partialCount,
        wrongCount: wrongCount,
        blankCount: blankCountVal,
        blankZero: blankZero,
        wrongNames: wrongNames,
        wrongAnswers: wrongAnswers,
        blanks: blanks,
        level: level
      };
    });

    var students = valid.map(function (x) {
      var sub = x.submission;
      var earnedSum = 0;
      var ptsSum = 0;
      var wrongQs = [];
      qs.forEach(function (q, i) {
        var pts = Number(q.points) || 1;
        var sc = itemScore(sub, i);
        if (sc === null) return;
        earnedSum += sc;
        ptsSum += pts;
        if (sc < pts - 1e-9) wrongQs.push(i + 1);
      });
      return {
        fullName: x.fullName || '',
        ratio: ptsSum > 0 ? earnedSum / ptsSum : null,
        wrongQuestions: wrongQs
      };
    });

    students.sort(function (a, b) {
      if (a.ratio === null && b.ratio === null) return 0;
      if (a.ratio === null) return 1;
      if (b.ratio === null) return -1;
      return a.ratio - b.ratio;
    });

    return { total: total, items: items, students: students };
  }

  var api = {
    parse: parse,
    summary: summary,
    classStats: classStats,
    isCorrect: isCorrect,
    fillScore: fillScore,
    blankCount: blankCount,
    splitBlanks: splitBlanks,
    mathTokens: mathTokens,
    splitParts: splitParts,
    toSource: toSource,
    spreadPoints: spreadPoints,
    fromText: fromText,
    questionStarts: questionStarts,
    plainMath: plainMath,
    PAGE_MARK: PAGE_MARK,
    RANGE: RANGE,
    SAMPLE: SAMPLE,
    SAMPLE_HW: SAMPLE_HW,
    examSections: examSections,
    isKeyHead: isKeyHead,
    isExamHead: isExamHead
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizFormat = api;
})(this);
