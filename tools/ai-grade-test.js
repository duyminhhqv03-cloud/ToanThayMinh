// Kiểm thử tối ưu Gemini chấm bài (aiGrade_, addAiFile_, callGemini_).
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var codePath = path.join(__dirname, '..', 'apps-script', 'Code.gs');
var code = fs.readFileSync(codePath, 'utf8');

var propsStore = { GEMINI_API_KEY: 'test-key' };
var driveFiles = {};
var driveGetFileCalls = 0;
var driveGetBlobCalls = {};
var fetchHandler = null;
var fetchCalls = [];
var db = { courses: {}, assignments: {}, submissions: {} };
var updates = [];

var sandbox = {
  Date: Date,
  Math: Math,
  Number: Number,
  String: String,
  Boolean: Boolean,
  Array: Array,
  Object: Object,
  RegExp: RegExp,
  JSON: JSON,
  Error: Error,
  isNaN: isNaN,
  isFinite: isFinite,
  parseInt: parseInt,
  encodeURIComponent: encodeURIComponent,
  Logger: { log: function () {} },
  PropertiesService: {
    getScriptProperties: function () {
      return {
        getProperty: function (k) { return propsStore[k] || null; },
        getProperties: function () { return Object.assign({}, propsStore); },
        setProperty: function (k, v) { propsStore[k] = String(v); },
        deleteProperty: function (k) { delete propsStore[k]; }
      };
    }
  },
  CacheService: {
    getScriptCache: function () {
      return {
        get: function () { return null; },
        put: function () {},
        remove: function () {}
      };
    }
  },
  LockService: {
    getScriptLock: function () {
      return {
        waitLock: function () {},
        releaseLock: function () {}
      };
    }
  },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: function (algo, input) {
      var buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
      return crypto.createHash(algo || 'md5').update(buf).digest();
    },
    base64Encode: function (bytes) {
      return Buffer.from(bytes).toString('base64');
    },
    base64Decode: function (str) {
      return Buffer.from(String(str || ''), 'base64');
    },
    sleep: function () {},
    getUuid: function () { return '00000000-0000-4000-8000-000000000000'; }
  },
  DriveApp: {
    getFileById: function (id) {
      driveGetFileCalls++;
      var f = driveFiles[id];
      if (!f) throw new Error('Không thấy file ' + id);
      return {
        getSize: function () {
          return f.size !== undefined ? f.size : Buffer.from(f.bytes || '').length;
        },
        getBlob: function () {
          driveGetBlobCalls[id] = (driveGetBlobCalls[id] || 0) + 1;
          return {
            getBytes: function () { return Buffer.from(f.bytes || ''); }
          };
        }
      };
    }
  },
  UrlFetchApp: {
    fetch: function (url, opts) {
      var body = JSON.parse(opts.payload);
      fetchCalls.push({ url: url, opts: opts, body: body });
      return fetchHandler(body, fetchCalls.length);
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Thay các hàm đọc/ghi dữ liệu bằng dữ liệu giả trong bộ nhớ.
sandbox.findBy_ = function (k, id) {
  return (db[k] && db[k][id]) || null;
};
sandbox.findCourse_ = function (id) {
  return db.courses[id] || null;
};
sandbox.requireEdit_ = function () {};
sandbox.withLock_ = function (fn) { return fn(); };
sandbox.update_ = function (k, row, changes) {
  Object.assign(row, changes);
  updates.push({ k: k, id: row.id, changes: changes });
};

function mockGeminiResponse(code, obj, usage) {
  var payload = code === 200 ? {
    modelVersion: 'gemini-3.6-flash',
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
    usageMetadata: usage
  } : obj;
  return {
    getResponseCode: function () { return code; },
    getContentText: function () { return JSON.stringify(payload); }
  };
}

function splitAtMarker(parts) {
  var idx = -1;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].text && parts[i].text.indexOf('### BÀI LÀM CỦA HỌC SINH') >= 0) {
      idx = i;
      break;
    }
  }
  assert(idx > 0, 'Phải có dấu mốc ### BÀI LÀM CỦA HỌC SINH sau phần đề cố định');
  return {
    fixed: parts.slice(0, idx),
    student: parts.slice(idx)
  };
}

var teacher = { username: 'gv1', role: 'teacher', courses: 'toan5' };
db.courses.toan5 = { id: 'toan5', name: 'Toán', grade: 'Lớp 5' };

var sampleQuestions = [
  { type: 'mc', text: '1 + 1 = ?', options: ['1', '2'], correct: 1, points: 2 },
  { type: 'essay', text: 'Tìm hai số khi biết tổng là 50 và hiệu là 10.', explain: 'Số lớn: (50+10):2 = 30 (2đ); Số bé: 20 (2đ).', points: 4, image: 'img_c2' },
  { type: 'essay', text: 'Tính diện tích hình chữ nhật dài 8 cm, rộng 5 cm.', explain: '8 x 5 = 40 cm² (4đ).', points: 4 }
];

db.assignments.a1 = {
  id: 'a1',
  courseId: 'toan5',
  title: 'Bài tập Tổng – Hiệu',
  instructions: 'Trình bày rõ lời giải và phép tính.',
  maxScore: '10',
  questions: JSON.stringify(sampleQuestions),
  images: JSON.stringify({ img_c2: 'file_de_c2' })
};

driveFiles.file_de_c2 = { bytes: 'anh-minh-hoa-de-cau-2' };
driveFiles.f_hs1_c2 = { bytes: 'bai-lam-hs1-cau-2' };
driveFiles.f_hs1_c3 = { bytes: 'bai-lam-hs1-cau-3' };
driveFiles.f_hs2_c3 = { bytes: 'bai-lam-hs2-cau-3' };

// 1 & 2. Hai học sinh khác nhau cùng một bài: phần trước ### BÀI LÀM CỦA HỌC SINH giống hệt nhau;
//        câu bỏ trống được 0đ, không nằm trong "Chỉ chấm các câu", và Gemini trả điểm cho câu đó vẫn bị bỏ qua.
{
  db.submissions.s1 = {
    id: 's1',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs1',
    submittedAt: '2026-11-05T10:00:00Z',
    answers: JSON.stringify([1, 'Số lớn là 30, số bé là 20', 'Diện tích là 40 cm2']),
    files: JSON.stringify([
      { fileId: 'f_hs1_c2', name: 'c2.jpg', mimeType: 'image/jpeg', q: 1 },
      { fileId: 'f_hs1_c3', name: 'c3.jpg', mimeType: 'image/jpeg', q: 2 }
    ])
  };
  db.submissions.s2 = {
    id: 's2',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs2',
    submittedAt: '2026-11-05T10:05:00Z',
    // Câu 2 (chỉ số 1) bỏ trống hoàn toàn; chỉ làm Câu 3 (chỉ số 2)
    answers: JSON.stringify([1, '   ', '8 x 5 = 40 (cm2)']),
    files: JSON.stringify([
      { fileId: 'f_hs2_c3', name: 'c3_hs2.jpg', mimeType: 'image/jpeg', q: 2 }
    ])
  };

  fetchCalls = [];
  fetchHandler = function () {
    return mockGeminiResponse(200, {
      // Cố tình trả cả điểm cho câu 2 (đang bỏ trống ở s2) để kiểm tra máy chủ có bỏ qua không
      items: [
        { q: 2, score: 3.5, reason: 'Gemini tự chấm câu trống', comment: 'Tốt', unsure: false },
        { q: 3, score: 4, reason: 'Đúng phép tính và đơn vị.', comment: 'Đúng', unsure: false }
      ],
      feedback: 'Làm bài cẩn thận.'
    });
  };

  var r1 = sandbox.aiGrade_(teacher, 's1');
  var r2 = sandbox.aiGrade_(teacher, 's2');
  assert.strictEqual(fetchCalls.length, 2);

  var sp1 = splitAtMarker(fetchCalls[0].body.contents[0].parts);
  var sp2 = splitAtMarker(fetchCalls[1].body.contents[0].parts);

  // Kiểm tra 1: phần cố định trước dấu mốc giống hệt nhau từng byte (JSON)
  assert.strictEqual(JSON.stringify(sp1.fixed), JSON.stringify(sp2.fixed));
  assert(JSON.stringify(sp1.fixed).indexOf('### CÂU 2') >= 0);
  assert(JSON.stringify(sp1.fixed).indexOf('### CÂU 3') >= 0);

  // Kiểm tra 2: học sinh 1 chấm câu 2, 3; học sinh 2 chỉ chấm câu 3
  assert(sp1.student[0].text.indexOf('Chỉ chấm các câu: 2, 3.') >= 0);
  assert(sp2.student[0].text.indexOf('Chỉ chấm các câu: 3.') >= 0);
  assert.strictEqual(sp2.student[0].text.indexOf('2'), -1);

  // Câu 2 của học sinh 2 bỏ trống -> điểm 0, reason cố định, bỏ qua điểm 3.5 của Gemini
  assert.strictEqual(r2.ai.items.length, 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r2.ai.items[0])), {
    q: 1,
    score: 0,
    reason: 'Học sinh bỏ trống.',
    comment: '',
    unsure: false
  });
  assert.strictEqual(r2.ai.items[1].q, 2);
  assert.strictEqual(r2.ai.items[1].score, 4);
}

// 3. Mọi câu bỏ trống: không gọi UrlFetchApp.fetch, không đọc Drive, vẫn lưu aiSuggest.
{
  db.submissions.s_blank = {
    id: 's_blank',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs3',
    submittedAt: '2026-11-05T10:10:00Z',
    answers: JSON.stringify([0, '', '   ']),
    files: JSON.stringify([])
  };
  fetchCalls = [];
  driveGetFileCalls = 0;
  updates = [];

  var rBlank = sandbox.aiGrade_(teacher, 's_blank');
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(driveGetFileCalls, 0);
  assert.strictEqual(rBlank.ai.feedback, '');
  assert.strictEqual(rBlank.ai.model, '');
  assert.strictEqual(rBlank.ai.secs, 0);
  assert.strictEqual(rBlank.ai.skipped, 0);
  assert.strictEqual(rBlank.ai.usage, null);
  assert.strictEqual(rBlank.ai.items.length, 2);
  assert.strictEqual(rBlank.ai.items[0].score, 0);
  assert.strictEqual(rBlank.ai.items[0].reason, 'Học sinh bỏ trống.');
  assert.strictEqual(rBlank.ai.items[1].score, 0);
  assert.strictEqual(rBlank.ai.items[1].reason, 'Học sinh bỏ trống.');
  assert.strictEqual(updates.length, 1);
  assert(db.submissions.s_blank.aiSuggest);
}

// 4. Có ảnh chung thì câu không gõ gì KHÔNG bị coi là bỏ trống.
{
  driveFiles.f_general = { bytes: 'anh-bai-lam-chung-ca-trang' };
  db.submissions.s_gen = {
    id: 's_gen',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs4',
    submittedAt: '2026-11-05T10:15:00Z',
    answers: JSON.stringify([1, null, '']),
    files: JSON.stringify([
      { fileId: 'f_general', name: 'chung.jpg', mimeType: 'image/jpeg', q: null }
    ])
  };
  fetchCalls = [];
  fetchHandler = function () {
    return mockGeminiResponse(200, {
      items: [
        { q: 2, score: 3, reason: 'Làm trong ảnh chung.', comment: 'Đúng', unsure: false },
        { q: 3, score: 4, reason: 'Làm trong ảnh chung.', comment: 'Đúng', unsure: false }
      ],
      feedback: 'Tốt.'
    });
  };
  var rGen = sandbox.aiGrade_(teacher, 's_gen');
  assert.strictEqual(fetchCalls.length, 1);
  var spGen = splitAtMarker(fetchCalls[0].body.contents[0].parts);
  assert(spGen.student[0].text.indexOf('Chỉ chấm các câu: 2, 3.') >= 0);
  assert.strictEqual(rGen.ai.items[0].score, 3);
  assert.strictEqual(rGen.ai.items[1].score, 4);
}

// 5. Cùng fileId hai lần và hai file khác id cùng nội dung: inline_data của ảnh đó chỉ xuất hiện một lần.
{
  driveFiles.f_dup_a = { bytes: 'noi-dung-anh-trung-nhau' };
  driveFiles.f_dup_b = { bytes: 'noi-dung-anh-trung-nhau' }; // khác fileId nhưng cùng nội dung với f_dup_a
  db.submissions.s_dup = {
    id: 's_dup',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs5',
    submittedAt: '2026-11-05T10:20:00Z',
    answers: JSON.stringify([1, '', '']),
    files: JSON.stringify([
      { fileId: 'f_dup_a', name: 'a1.jpg', mimeType: 'image/jpeg', q: 1 },
      { fileId: 'f_dup_a', name: 'a2.jpg', mimeType: 'image/jpeg', q: 1 }, // cùng fileId
      { fileId: 'f_dup_b', name: 'b1.jpg', mimeType: 'image/jpeg', q: 2 }  // khác fileId, cùng bytes
    ])
  };
  fetchCalls = [];
  var rDup = sandbox.aiGrade_(teacher, 's_dup');
  assert.strictEqual(rDup.ai.skipped, 0);
  var spDup = splitAtMarker(fetchCalls[0].body.contents[0].parts);
  var studentInlines = spDup.student.filter(function (p) { return !!p.inline_data; });
  assert.strictEqual(studentInlines.length, 1, 'Ảnh trùng chỉ được gửi inline_data đúng 1 lần');
  var studentTexts = spDup.student.filter(function (p) { return !!p.text; }).map(function (p) { return p.text; }).join('\n');
  assert(studentTexts.indexOf('(cùng ảnh với "Bài làm câu 2 (ảnh 1)")') >= 0);
}

// 6. File quá lớn theo getSize(): không gọi getBlob, skipped tăng.
{
  driveFiles.f_oversize = { size: 8 * 1024 * 1024, bytes: 'khong-duoc-doc' };
  driveGetBlobCalls = {};
  db.submissions.s_big = {
    id: 's_big',
    assignmentId: 'a1',
    courseId: 'toan5',
    username: 'hs6',
    submittedAt: '2026-11-05T10:25:00Z',
    answers: JSON.stringify([1, 'Em làm trong ảnh', '']),
    files: JSON.stringify([
      { fileId: 'f_oversize', name: 'anh-nang.jpg', mimeType: 'image/jpeg', q: 1 }
    ])
  };
  fetchCalls = [];
  var rBig = sandbox.aiGrade_(teacher, 's_big');
  assert.strictEqual(driveGetBlobCalls.f_oversize || 0, 0, 'Không được gọi getBlob khi getSize() đã vượt AI_FILE_MAX');
  assert.strictEqual(rBig.ai.skipped, 1);
}

// 7. Gemini trả 400 có chữ "schema": gửi lại không có responseSchema và thành công; không lặp vô hạn nếu 400 lặp lại.
{
  fetchCalls = [];
  fetchHandler = function (body, n) {
    if (n === 1) {
      assert(body.generationConfig.responseSchema, 'Lần gọi đầu phải có responseSchema');
      return mockGeminiResponse(400, { error: { message: 'Invalid JSON payload received. Unknown name "responseSchema"' } });
    }
    assert.strictEqual(body.generationConfig.responseSchema, undefined, 'Lần gửi lại phải bỏ responseSchema');
    return mockGeminiResponse(200, {
      items: [{ q: 3, score: 4, reason: 'Đúng.', comment: 'Đúng', unsure: false }],
      feedback: 'Tốt.'
    });
  };
  var rRetryOk = sandbox.aiGrade_(teacher, 's2');
  assert.strictEqual(fetchCalls.length, 2);
  assert.strictEqual(rRetryOk.ai.items[1].score, 4);

  // Nếu 400 có chữ "schema" lặp lại ở cả lần 2 -> không lặp vô hạn (dừng sau 2 lần gọi và ném lỗi).
  fetchCalls = [];
  fetchHandler = function () {
    return mockGeminiResponse(400, { error: { message: 'schema is still invalid' } });
  };
  assert.throws(function () {
    sandbox.aiGrade_(teacher, 's2');
  }, /schema/i);
  assert.strictEqual(fetchCalls.length, 2, 'Không được lặp vô hạn khi lỗi 400 schema lặp lại');
}

// 8. Không có GEMINI_MEDIA_RES: body không có mediaResolution; đặt medium: có MEDIA_RESOLUTION_MEDIUM.
{
  delete propsStore.GEMINI_MEDIA_RES;
  fetchCalls = [];
  fetchHandler = function () {
    return mockGeminiResponse(200, {
      items: [{ q: 3, score: 4, reason: 'Đúng.', comment: 'Đúng', unsure: false }],
      feedback: 'Tốt.'
    });
  };
  sandbox.aiGrade_(teacher, 's2');
  assert.strictEqual(fetchCalls[0].body.generationConfig.mediaResolution, undefined);

  propsStore.GEMINI_MEDIA_RES = 'medium';
  fetchCalls = [];
  sandbox.aiGrade_(teacher, 's2');
  assert.strictEqual(fetchCalls[0].body.generationConfig.mediaResolution, 'MEDIA_RESOLUTION_MEDIUM');
  delete propsStore.GEMINI_MEDIA_RES;
}

// 9. usage được đọc đúng từ usageMetadata.
{
  fetchCalls = [];
  fetchHandler = function () {
    return mockGeminiResponse(200, {
      items: [{ q: 3, score: 3.5, reason: 'Đúng.', comment: 'Đúng', unsure: false }],
      feedback: 'Tốt.'
    }, {
      promptTokenCount: 3450,
      cachedContentTokenCount: 1200,
      candidatesTokenCount: 95,
      thoughtsTokenCount: 60,
      totalTokenCount: 3605
    });
  };
  var rUsage = sandbox.aiGrade_(teacher, 's2');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rUsage.ai.usage)), {
    input: 3450,
    cached: 1200,
    output: 95,
    thoughts: 60,
    total: 3605
  });
}

console.log('OK');
