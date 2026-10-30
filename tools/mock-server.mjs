// Máy chủ thử: phục vụ file tĩnh của repo + giả lập vài action Apps Script cho trang Đấu cả lớp.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Chạy: node tools/mock-server.mjs  → http://localhost:8765/hoc/ (API_URL được thay bằng /mock-api).
// Đăng nhập giả: đặt localStorage ttm_token = tk-teacher | tk-student | tk-student2 và ttm_me tương ứng.
const ROOT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8765;
const USERS = {
  'tk-teacher': { username: 'gv1', fullName: 'Thầy Minh', role: 'teacher', courses: 'c1' },
  'tk-student': { username: 'hs1', fullName: 'Nguyễn An', role: 'student', courses: 'c1' },
  'tk-student2': { username: 'hs2', fullName: 'Trần Bình', role: 'student', courses: 'c1' }
};
const QUIZ = {
  quiz: { id: 'q1', title: 'Phân số – Đề 1', topic: 'Phân số' },
  course: { id: 'c1', name: 'Toán tư duy', grade: 'Lớp 5' },
  canEdit: true,
  fullQuestions: [
    { type: 'mc', text: '3/4 + 1/4 = ?', options: ['4/8', '1', '5/4', '3/16'], correct: 1, explain: '3/4 + 1/4 = 4/4 = 1', points: 1 },
    { type: 'short', text: '1/2 + 1/4 = ? (viết số thập phân)', answers: ['0,75', '3/4'], explain: '', points: 1 },
    { type: 'essay', text: 'Trình bày lời giải…', points: 2 }
  ]
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const saved = [];

const MOCK_PDF_BASE64 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n147\n%%EOF\n').toString('base64');

const MOCK_CATALOG = [
  {
    id: 'c1',
    name: 'Toán',
    grade: 'Lớp 5',
    branches: ['Toán', 'Toán tiếng Anh', 'Science'],
    items: [
      { kind: 'doc', branch: 'Toán', topic: 'Phân số', title: 'Chuyên đề Phân số – Lý thuyết & bài tập', free: true, id: 'd1', type: 'file', fileName: 'phan-so.pdf', mimeType: 'application/pdf' },
      { kind: 'doc', branch: 'Toán', topic: 'Phân số', title: 'Video hướng dẫn giải bài toán tỉ số', free: true, id: 'd2', type: 'link', url: 'https://youtu.be/sample123' },
      { kind: 'quiz', branch: 'Toán', topic: 'Phân số', title: 'Phân số – Đề 1', free: false },
      { kind: 'doc', branch: 'Toán', topic: 'Topic 4', title: 'Tài liệu nội bộ lớp Toán 5', free: false },
      { kind: 'quiz', branch: 'Toán', topic: 'Topic 4', title: 'Luyện tập Topic 4', free: false },
      { kind: 'doc', branch: 'Toán tiếng Anh', topic: 'Topic 5', title: 'Fractions vocabulary', free: false },
      { kind: 'doc', branch: 'Science', topic: 'Topic 5', title: 'Science Unit 5 - Plants', free: false }
    ]
  },
  {
    id: 'c2',
    name: 'Tiếng Việt',
    grade: 'Lớp 4',
    branches: ['Tiếng Việt'],
    items: [
      { kind: 'doc', branch: 'Tiếng Việt', topic: 'Luyện từ và câu', title: 'Cẩm nang Luyện từ và câu Lớp 4', free: true, id: 'd3', type: 'file', fileName: 'luyen-tu-cau.pdf', mimeType: 'application/pdf' },
      { kind: 'quiz', branch: 'Tiếng Việt', topic: 'Luyện từ và câu', title: 'Luyện từ và câu – Bài 1', free: false },
      { kind: 'doc', branch: 'Tiếng Việt', topic: 'Tập làm văn', title: 'Đề cương kiểm tra giữa kỳ', free: false }
    ]
  },
  {
    id: 'c3',
    name: 'Tiếng Anh',
    grade: 'Lớp 5',
    branches: ['Tiếng Anh'],
    items: [
      { kind: 'doc', branch: 'Tiếng Anh', topic: 'Topic 4', title: 'English Grammar Review Topic 4', free: true, id: 'd4', type: 'link', url: 'https://youtu.be/grammar-review' },
      { kind: 'quiz', branch: 'Tiếng Anh', topic: 'Topic 4', title: 'English Test 4', free: false }
    ]
  }
];

const MOCK_FREE_DOCS = [
  {
    id: 'd1', courseId: 'c1', branch: 'Toán', topic: 'Phân số', title: 'Chuyên đề Phân số – Lý thuyết & bài tập',
    description: 'Tài liệu ôn tập kiến thức nền tảng và bài tập nâng cao về phân số.',
    type: 'file', fileName: 'phan-so.pdf', mimeType: 'application/pdf', size: 323000, url: '',
    uploadedAt: '2026-10-28T08:00:00Z', free: true, courseName: 'Toán', courseGrade: 'Lớp 5'
  },
  {
    id: 'd2', courseId: 'c1', branch: 'Toán', topic: 'Phân số', title: 'Video hướng dẫn giải bài toán tỉ số',
    description: 'Thầy Minh hướng dẫn giải chi tiết các dạng toán tỉ số.',
    type: 'link', fileName: '', mimeType: '', size: 0, url: 'https://youtu.be/sample123',
    uploadedAt: '2026-10-27T10:00:00Z', free: true, courseName: 'Toán', courseGrade: 'Lớp 5'
  },
  {
    id: 'd3', courseId: 'c2', branch: 'Tiếng Việt', topic: 'Luyện từ và câu', title: 'Cẩm nang Luyện từ và câu Lớp 4',
    description: 'Tổng hợp quy tắc ngữ pháp và bài tập thực hành.',
    type: 'file', fileName: 'luyen-tu-cau.pdf', mimeType: 'application/pdf', size: 215000, url: '',
    uploadedAt: '2026-10-25T14:00:00Z', free: true, courseName: 'Tiếng Việt', courseGrade: 'Lớp 4'
  },
  {
    id: 'd4', courseId: 'c3', branch: 'Tiếng Anh', topic: 'Topic 4', title: 'English Grammar Review Topic 4',
    description: 'Video bài giảng ngữ pháp tiếng Anh tuyển sinh.',
    type: 'link', fileName: '', mimeType: '', size: 0, url: 'https://youtu.be/grammar-review',
    uploadedAt: '2026-10-24T09:00:00Z', free: true, courseName: 'Tiếng Anh', courseGrade: 'Lớp 5'
  }
];

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/mock-api') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const p = JSON.parse(body);
      let out;
      if (p.action === 'catalog') {
        out = { ok: true, courses: MOCK_CATALOG };
      } else if (p.action === 'freeDocs') {
        out = { ok: true, docs: MOCK_FREE_DOCS };
      } else if (p.action === 'freeFile') {
        out = { ok: true, name: 'tai-lieu-mau.pdf', mimeType: 'application/pdf', data: MOCK_PDF_BASE64 };
      } else {
        const me = USERS[p.token];
        if (!me) out = { ok: false, code: 401, error: 'Hết phiên' };
        else if (p.action === 'me') out = { ok: true, user: me };
        else if (p.action === 'quiz') out = { ok: true, ...QUIZ, quiz: { ...QUIZ.quiz, gameOnly: true, count: 3, showAnswers: true }, source: 'Câu 1: 3/4 + 1/4 = ?\nA. 4/8\n*B. 1', results: [], myAttempts: [], canEdit: me.role !== 'student' };
        else if (p.action === 'course') out = { ok: true, course: { id: 'c1', name: 'Toán', grade: 'Lớp 5', canEdit: true, branches: ['Toán', 'Toán tiếng Anh', 'Science'] }, docs: [{ id: 'd1', courseId: 'c1', title: 'Chủ đề 10-13', type: 'file', mimeType: 'application/pdf', fileName: 'a.pdf', size: 323000, uploadedBy: 'Quản trị viên', uploadedAt: '2026-10-26T00:00:00Z', topic: '', branch: 'Toán', free: true }, { id: 'd2', courseId: 'c1', title: 'Fractions vocabulary', type: 'link', url: 'https://example.com', uploadedBy: 'Thầy Minh', uploadedAt: '2026-10-26T00:00:00Z', topic: 'Unit 1', branch: 'Toán tiếng Anh' }], assignments: [{ id: 'a1', courseId: 'c1', branch: 'Toán', topic: 'Topic 5 - Logic', title: 'Bài tập về nhà - Thứ 7 24 tháng 10', dueAt: '2026-10-29T14:00:00Z', createdAt: '2026-10-24T03:00:00Z', maxScore: 10, questionCount: 8, essayCount: 3, stats: { submitted: 0, students: 11, ungraded: 0 } }, { id: 'a2', courseId: 'c1', branch: 'Toán', topic: 'Topic 4', title: 'Bài tập về nhà Thứ 7 17/10', dueAt: '2026-10-22T15:00:00Z', createdAt: '2026-10-17T03:00:00Z', maxScore: 10, questionCount: 0, essayCount: 0, stats: { submitted: 5, students: 11, ungraded: 0 } }, { id: 'a3', courseId: 'c1', branch: 'Toán', topic: '', title: 'Bài tập tuần sau', dueAt: '2026-11-05T14:00:00Z', createdAt: '2026-10-27T03:00:00Z', maxScore: 10, questionCount: 5, essayCount: 0, stats: { submitted: 0, students: 11, ungraded: 0 } }], topics: ['Phân số'],
          quizzes: [{ id: 'q1', courseId: 'c1', topic: 'Phân số', title: 'Phân số – Đề 1', count: 2, timeLimit: 0, showAnswers: true, gameOnly: true, branch: 'Toán', stats: { attempts: 0, students: 0, totalStudents: 2 } },
                    { id: 'q2', courseId: 'c1', topic: 'Phân số', title: 'Ôn tập thường', count: 5, timeLimit: 0, showAnswers: true, gameOnly: false, branch: 'Science', stats: { attempts: 0, students: 0, totalStudents: 2 } }] };
        else if (p.action === 'saveQuiz') { console.log('saveQuiz gameOnly=', p.gameOnly); out = { ok: true, id: 'q1' }; }
        else if (p.action === 'courses') out = { ok: true, courses: [] };
        else if (p.action === 'saveMatch') { saved.push(p); console.log('saveMatch', JSON.stringify(p.results)); out = { ok: true, id: 'm' + saved.length }; }
        else out = { ok: false, error: 'Yêu cầu không hợp lệ.' };
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  let data = fs.readFileSync(f);
  if (u === '/hoc/config.js') data = Buffer.from(String(data).replace(/window\.API_URL = '[^']*'/, "window.API_URL = '/mock-api'"));
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
}).listen(PORT, () => console.log('ready on ' + PORT));
