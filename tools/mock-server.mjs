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

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/mock-api') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const p = JSON.parse(body);
      const me = USERS[p.token];
      let out;
      if (!me) out = { ok: false, code: 401, error: 'Hết phiên' };
      else if (p.action === 'me') out = { ok: true, user: me };
      else if (p.action === 'quiz') out = { ok: true, ...QUIZ, quiz: { ...QUIZ.quiz, gameOnly: true, count: 3, showAnswers: true }, source: 'Câu 1: 3/4 + 1/4 = ?\nA. 4/8\n*B. 1', results: [], myAttempts: [], canEdit: me.role !== 'student' };
      else if (p.action === 'course') out = { ok: true, course: { id: 'c1', name: 'Toán', grade: 'Lớp 5', canEdit: true, branches: ['Toán', 'Toán tiếng Anh', 'Science'] }, docs: [{ id: 'd1', courseId: 'c1', title: 'Chủ đề 10-13', type: 'file', mimeType: 'application/pdf', fileName: 'a.pdf', size: 323000, uploadedBy: 'Quản trị viên', uploadedAt: '2026-10-26T00:00:00Z', topic: '', branch: 'Toán' }, { id: 'd2', courseId: 'c1', title: 'Fractions vocabulary', type: 'link', url: 'https://example.com', uploadedBy: 'Thầy Minh', uploadedAt: '2026-10-26T00:00:00Z', topic: 'Unit 1', branch: 'Toán tiếng Anh' }], assignments: [{ id: 'a1', courseId: 'c1', branch: 'Toán', topic: 'Topic 5 - Logic', title: 'Bài tập về nhà - Thứ 7 24 tháng 10', dueAt: '2026-10-29T14:00:00Z', createdAt: '2026-10-24T03:00:00Z', maxScore: 10, questionCount: 8, essayCount: 3, stats: { submitted: 0, students: 11, ungraded: 0 } }, { id: 'a2', courseId: 'c1', branch: 'Toán', topic: 'Topic 4', title: 'Bài tập về nhà Thứ 7 17/10', dueAt: '2026-10-22T15:00:00Z', createdAt: '2026-10-17T03:00:00Z', maxScore: 10, questionCount: 0, essayCount: 0, stats: { submitted: 5, students: 11, ungraded: 0 } }, { id: 'a3', courseId: 'c1', branch: 'Toán', topic: '', title: 'Bài tập tuần sau', dueAt: '2026-11-05T14:00:00Z', createdAt: '2026-10-27T03:00:00Z', maxScore: 10, questionCount: 5, essayCount: 0, stats: { submitted: 0, students: 11, ungraded: 0 } }], topics: ['Phân số'],
        quizzes: [{ id: 'q1', courseId: 'c1', topic: 'Phân số', title: 'Phân số – Đề 1', count: 2, timeLimit: 0, showAnswers: true, gameOnly: true, branch: 'Toán', stats: { attempts: 0, students: 0, totalStudents: 2 } },
                  { id: 'q2', courseId: 'c1', topic: 'Phân số', title: 'Ôn tập thường', count: 5, timeLimit: 0, showAnswers: true, gameOnly: false, branch: 'Science', stats: { attempts: 0, students: 0, totalStudents: 2 } }] };
      else if (p.action === 'saveQuiz') { console.log('saveQuiz gameOnly=', p.gameOnly); out = { ok: true, id: 'q1' }; }
      else if (p.action === 'courses') out = { ok: true, courses: [] };
      else if (p.action === 'saveMatch') { saved.push(p); console.log('saveMatch', JSON.stringify(p.results)); out = { ok: true, id: 'm' + saved.length }; }
      else out = { ok: false, error: 'Yêu cầu không hợp lệ.' };
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
