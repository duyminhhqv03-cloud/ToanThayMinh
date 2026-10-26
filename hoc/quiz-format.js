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
  var POINTS = /(\d+(?:[.,]\d+)?)\s*(?:điểm|đ\b|đ$|d\b)/i;
  var IMAGE = /^\s*\[\s*(?:hình|ảnh|hinh|anh)\s*:?\s*([A-Za-z0-9_-]{1,40})\s*\]\s*$/i;

  /** Chữ nghiêng toán học trong PDF (𝑥, 𝑦…) → chữ thường để học sinh gõ được. */
  function plainMath(t) {
    return String(t).replace(/[\uD835][\uDC00-\uDFFF]/g, function (c) { return c.normalize('NFKC'); });
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
        if (!essayMarked && (m = OPTION.exec(line)) && mode !== 'answer') {
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
    var s = { mc: 0, short: 0, essay: 0, total: 0, autoPoints: 0, essayPoints: 0 };
    questions.forEach(function (q) {
      s[q.type]++;
      s.total += q.points || 1;
      if (q.type === 'essay') s.essayPoints += q.points || 1; else s.autoPoints += q.points || 1;
    });
    s.total = Math.round(s.total * 100) / 100;
    return s;
  }

  function normAnswer(s) {
    return String(s).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').replace(/\.$/, '');
  }

  function numPart(s) {
    var m = /^(-?\d+(?:\.\d+)?(?:\/\d+)?)([a-zà-ỹđ²³]*)$/.exec(s);
    return m ? { num: m[1], unit: m[2] } : null;
  }

  /** So khớp câu trả lời (trắc nghiệm hoặc trả lời ngắn), giống isCorrect_ của Code.gs. */
  function isCorrect(x, a) {
    if (!x || a === null || a === undefined || a === '') return false;
    if (x.type === 'mc') return Number(a) === Number(x.correct);
    var v = normAnswer(a);
    var vn = numPart(v);
    return (x.answers || []).some(function (ans) {
      var k = normAnswer(ans);
      if (k === v) return true;
      // "24" khớp "24cm", "0.75" khớp "0,75kg": cùng con số, chỉ khác đơn vị (hoặc thiếu đơn vị).
      var kn = numPart(k);
      return vn !== null && kn !== null && vn.num === kn.num && (!vn.unit || !kn.unit || vn.unit === kn.unit);
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
    'Câu 3: Số nào chia hết cho cả 2 và 5?',
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
    'Câu 3 (tự luận, 6 điểm): Một cửa hàng có 120 kg gạo. Buổi sáng bán 1/3 số gạo, buổi chiều bán 1/4 số gạo còn lại. Hỏi cửa hàng còn bao nhiêu ki-lô-gam gạo?',
    'Hướng dẫn chấm: Buổi sáng bán 40 kg (2đ). Còn 80 kg, buổi chiều bán 20 kg (2đ). Còn lại 60 kg, có đáp số (2đ).'
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

  var QH = /^\s*(?:câu|bài)\s*(\d{1,3})\s*(?:\(([^)]*)\)|\[([^\]]*)\])?\s*[:.)\-–]?\s*(.*)$/i;
  var NUMQ = /^\s*(\d{1,2})\s*[.)]\s+(\S.*)$/;
  var SECTION = /^\s*(?:phần|part|dạng)\s*[IVX\d]*\b|^\s*[IVX]{1,4}\s*[.\-–)]\s+/i;
  var KEY_HEAD = /^\s*(?:bảng\s+)?(?:đáp\s*án|hướng\s*dẫn\s*(?:giải|chấm)|lời\s*giải|answer\s*key)\b/i;
  var OPT_MARK = /(^|\s)\(?([A-H])\s*[.)]\s*/g;

  var PAGE_MARK = '⟦TRANG⟧';
  var RANGE = /(?:questions?|câu|bài)\s*(\d{1,3})\s*(?:[-–—]|đến|tới|to)\s*(\d{1,3})/i;
  var MARKS = /(\d+(?:[.,]\d+)?)\s*(?:điểm|marks?|points?|pts?)\b/i;

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

  function parseKey(lines) {
    var key = {};
    var cur = null;
    var blocks = {};
    var skip = false;
    lines.forEach(function (line, i) {
      if (skip) { skip = false; return; }
      if (KEY_HEAD.test(line) && line.length < 60 && !/\d/.test(line)) return;
      // Bảng: "Câu | 1 | 2 | 3" rồi dòng dưới "Đáp án | B | C | A"
      if (/^\s*câu\b/i.test(line) && (line.match(/\d+/g) || []).length >= 2 && lines[i + 1] && /^\s*đáp\s*án\b/i.test(lines[i + 1])) {
        var ns = line.match(/\d+/g) || [];
        var as = lines[i + 1].replace(/^\s*đáp\s*án\s*[:：]?/i, '').trim().split(/[\s|,;]+/).filter(Boolean);
        ns.forEach(function (n, k) { if (as[k] && !key[n]) key[n] = as[k]; });
        cur = null;
        skip = true;
        return;
      }
      var m = QH.exec(line);
      if (m) { cur = Number(m[1]); blocks[cur] = [m[4]]; return; }
      if (cur !== null) blocks[cur].push(line);
    });
    Object.keys(blocks).forEach(function (n) { key[n] = blocks[n].join('\n').trim(); });
    // Dạng gọn: "1.B 2.C 3-A" hoặc "1B 2C"
    lines.join('\n').replace(/(?:^|[\s,;|])(\d{1,3})\s*[.:\-–)]?\s*([A-Ha-h])(?![\wÀ-ỹ])/g, function (all, n, l) {
      if (!key[n]) key[n] = l.toUpperCase();
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
      if (seenQ && KEY_HEAD.test(l) && l.length < 60) break;
      if (isQ && !(SECTION.test(l) && l.length < 90 && !QH.test(l))) out.push(i);
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

    if (!keyLines) {
      var seenQ = false;
      for (var i = 0; i < lines.length; i++) {
        if (QH.test(lines[i]) || (useNum && NUMQ.test(lines[i]))) seenQ = true;
        if (seenQ && KEY_HEAD.test(lines[i]) && lines[i].length < 60) {
          keyLines = lines.slice(i + 1);
          lines = lines.slice(0, i);
          break;
        }
      }
    }

    var qs = [];
    var section = null;
    var sections = [];
    var sec = null;
    var cur = null;
    var afterBreak = false;
    var preamble = [];
    var groups = [];
    lines.forEach(function (line) {
      if (line === PAGE_MARK) { afterBreak = true; return; }
      if (SECTION.test(line) && line.length < 90 && !QH.test(line)) {
        var t = sectionType(line);
        if (t) section = t;
        var mk = MARKS.exec(line);
        var rg = RANGE.exec(line);
        sec = { marks: mk ? Number(mk[1].replace(',', '.')) : null, range: rg ? [Number(rg[1]), Number(rg[2])] : null, qs: [] };
        sections.push(sec);
        if (cur) afterBreak = true; // chữ ngay sau tiêu đề phần là lời dẫn cho các câu sau
        return;
      }
      var m = QH.exec(line);
      var nm = !m && useNum ? NUMQ.exec(line) : null;
      if (m || nm) {
        cur = { n: m ? Number(m[1]) : Number(nm[1]), meta: m ? (m[2] || m[3] || '') : '', text: [], options: [], section: section };
        if (sec) sec.qs.push(cur);
        if (preamble.length) {
          // Lời dẫn đứng trước nhóm câu ("Quan sát hình, trả lời câu 11–15") → đặt lên đầu câu đầu nhóm.
          var pr = RANGE.exec(preamble.join(' '));
          cur.pre = preamble.slice();
          if (pr) groups.push([Number(pr[1]), Number(pr[2])]);
        }
        preamble = [];
        afterBreak = false;
        var rest = m ? m[4] : nm[2];
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

    var key = keyLines ? parseKey(keyLines) : {};
    var keyed = 0;
    var questions = qs.map(function (c) {
      var k = key[c.n] !== undefined ? String(key[c.n]).trim() : '';
      if (k) keyed++;
      var pm = POINTS.exec(c.meta);
      if (c.pre) c.text = c.pre.concat(c.text);
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
      var essayMarked = ESSAY_WORD.test(c.meta) || c.section === 'essay';
      if (c.options.length >= 2 && !essayMarked) {
        q.type = 'mc';
        q.options = c.options;
        var lm = /^\(?([A-Ha-h])\b/.exec(k);
        q.correct = lm ? lm[1].toUpperCase().charCodeAt(0) - 65 : -1;
        var rest = lm ? k.slice(lm[0].length).replace(/^[\s.:)\-–]+/, '').trim() : k;
        if (rest && rest.length > 1) q.explain = rest;
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
    return { source: toSource(questions), count: questions.length, keyed: keyed, hasKey: !!keyLines, groups: groups };
  }

  var api = { parse: parse, summary: summary, isCorrect: isCorrect, toSource: toSource, spreadPoints: spreadPoints, fromText: fromText, questionStarts: questionStarts, plainMath: plainMath, PAGE_MARK: PAGE_MARK, RANGE: RANGE, SAMPLE: SAMPLE, SAMPLE_HW: SAMPLE_HW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizFormat = api;
})(this);
