/**
 * Toán Thầy Minh – Máy chủ khu học tập (Google Apps Script)
 *
 * Dữ liệu nằm trong Google Sheets (file chứa script này):
 *   TaiKhoan       – tài khoản admin, giáo viên, học sinh
 *   KhoaHoc        – danh sách khóa học
 *   TaiLieu        – tài liệu (file hoặc link), có chủ đề
 *   BaiTap         – bài tập về nhà; có thể kèm câu hỏi trắc nghiệm / trả lời ngắn (máy chấm)
 *                    và tự luận (giáo viên chấm)
 *   BaiNop         – bài nộp của học sinh, điểm và nhận xét
 *   LuyenTap       – đề luyện tập tự chấm
 *   KetQua         – kết quả các lần làm bài luyện tập
 *   PhienDangNhap  – phiên đăng nhập (tự dọn khi hết hạn)
 * File nằm trong Google Drive ở chế độ RIÊNG TƯ. Người dùng chỉ tải được qua script này,
 * sau khi đã kiểm tra đăng nhập và quyền khóa học.
 *
 * Cài đặt / cập nhật: xem apps-script/HUONG-DAN.md trong repo.
 */

var SHEET_NAMES = {
  users: 'TaiKhoan',
  courses: 'KhoaHoc',
  docs: 'TaiLieu',
  assignments: 'BaiTap',
  submissions: 'BaiNop',
  quizzes: 'LuyenTap',
  attempts: 'KetQua',
  sessions: 'PhienDangNhap'
};
var COLUMNS = {
  users: ['username', 'fullName', 'role', 'courses', 'active', 'salt', 'passwordHash', 'createdAt'],
  courses: ['id', 'name', 'grade', 'order'],
  docs: ['id', 'courseId', 'title', 'description', 'type', 'fileId', 'fileName', 'mimeType', 'size', 'url', 'uploadedBy', 'uploadedAt', 'topic'],
  assignments: ['id', 'courseId', 'topic', 'title', 'instructions', 'dueAt', 'maxScore', 'fileId', 'fileName', 'mimeType', 'size', 'createdBy', 'createdAt', 'source', 'questions'],
  submissions: ['id', 'assignmentId', 'courseId', 'username', 'text', 'files', 'submittedAt', 'late', 'status', 'score', 'feedback', 'gradedBy', 'gradedAt', 'answers', 'itemScores', 'autoScore'],
  quizzes: ['id', 'courseId', 'topic', 'title', 'description', 'source', 'questions', 'timeLimit', 'showAnswers', 'createdBy', 'createdAt', 'updatedAt'],
  attempts: ['id', 'quizId', 'courseId', 'username', 'answers', 'score', 'total', 'submittedAt'],
  sessions: ['token', 'username', 'expiresAt']
};
// Các trang tự tạo khi chưa có (để cập nhật code mà không cần chạy lại setup).
var AUTO_CREATE = ['docs', 'assignments', 'submissions', 'quizzes', 'attempts', 'sessions'];

var DEFAULT_COURSES = [
  ['toan4', 'Toán', 'Lớp 4', '1'],
  ['tv4', 'Tiếng Việt', 'Lớp 4', '2'],
  ['toankhtn5', 'Toán & KHTN', 'Lớp 5', '3'],
  ['tvkhxh5', 'Tiếng Việt & KHXH', 'Lớp 5', '4'],
  ['anh5', 'Tiếng Anh', 'Lớp 5', '5']
];
var ROLES = ['admin', 'teacher', 'student'];
var SESSION_DAYS = 7;
var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
var MAX_SUBMIT_FILES = 10;
var MAX_LOGIN_FAILS = 5;

/* ───────────────────────── Cài đặt lần đầu ───────────────────────── */

/** Chạy hàm này MỘT LẦN trong trình soạn Apps Script. Mật khẩu admin hiện trong Nhật ký thực thi. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(function (k) { ensureSheet_(k); });

  if (sheet_('courses').getLastRow() === 1) {
    DEFAULT_COURSES.forEach(function (c) { sheet_('courses').appendRow(c); });
  }

  rootFolder_();

  if (!findUser_('admin')) {
    var pw = randomPassword_();
    insertUser_({ username: 'admin', fullName: 'Quản trị viên', role: 'admin', courses: '' }, pw);
    Logger.log('ĐÃ TẠO TÀI KHOẢN ADMIN  →  tên đăng nhập: admin   mật khẩu: ' + pw);
    Logger.log('Hãy ghi lại mật khẩu này, rồi đổi mật khẩu sau khi đăng nhập lần đầu.');
  } else {
    Logger.log('Đã có tài khoản admin. Nếu quên mật khẩu, chạy hàm resetAdminPassword().');
  }

  ['Sheet1', 'Trang tính1'].forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

/** Dùng khi quên mật khẩu admin: chạy hàm này, mật khẩu mới hiện trong Nhật ký thực thi. */
function resetAdminPassword() {
  var u = findUser_('admin');
  if (!u) { setup(); return; }
  var pw = randomPassword_();
  setPassword_(u, pw);
  Logger.log('Mật khẩu admin mới: ' + pw);
}

/* ───────────────────────── Cổng web ───────────────────────── */

function doGet() {
  return ContentService.createTextOutput('Máy chủ khu học tập Toán Thầy Minh đang hoạt động.');
}

function doPost(e) {
  var out;
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = handle_(p);
    out.ok = true;
  } catch (err) {
    out = {
      ok: false,
      code: err.code || 500,
      error: err.userFacing ? err.message : 'Lỗi máy chủ: ' + (err && err.message)
    };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  var action = String(p.action || '');
  if (action === 'login') return login_(p);

  var me = auth_(p.token);
  var id = String(p.id || p.docId || '');
  switch (action) {
    case 'me': return { user: publicUser_(me) };
    case 'logout': return logout_(p.token);
    case 'changePassword': return changePassword_(me, p);
    case 'courses': return { courses: visibleCourses_(me) };
    case 'course': return courseContent_(me, String(p.courseId || ''));
    case 'todo': return todo_(me);

    // Tài liệu
    case 'docs': return { docs: courseContent_(me, String(p.courseId || '')).docs };
    case 'upload': return withLock_(function () { return upload_(me, p); });
    case 'updateDoc': return withLock_(function () { return updateDoc_(me, p); });
    case 'deleteDoc': return withLock_(function () { return deleteDoc_(me, id); });
    case 'file': return getFile_(me, id);

    // Bài tập về nhà
    case 'assignment': return assignmentDetail_(me, id);
    case 'createAssignment': return withLock_(function () { return saveAssignment_(me, p, true); });
    case 'updateAssignment': return withLock_(function () { return saveAssignment_(me, p, false); });
    case 'deleteAssignment': return withLock_(function () { return deleteAssignment_(me, id); });
    case 'assignmentFile': return assignmentFile_(me, id);
    case 'submit': return withLock_(function () { return submit_(me, p); });
    case 'submissionFile': return submissionFile_(me, String(p.submissionId || ''), String(p.fileId || ''));
    case 'grade': return withLock_(function () { return grade_(me, p); });

    // Luyện tập
    case 'quiz': return quizDetail_(me, id);
    case 'saveQuiz': return withLock_(function () { return saveQuiz_(me, p); });
    case 'deleteQuiz': return withLock_(function () { return deleteQuiz_(me, id); });
    case 'submitQuiz': return withLock_(function () { return submitQuiz_(me, p); });
    case 'attempt': return attemptDetail_(me, String(p.attemptId || ''));
  }

  if (me.role !== 'admin') throw err_('Chỉ admin mới làm được thao tác này.', 403);
  switch (action) {
    case 'users': return { users: rows_('users').map(publicUser_) };
    case 'createUser': return withLock_(function () { return createUser_(me, p); });
    case 'bulkCreate': return withLock_(function () { return bulkCreate_(me, p); });
    case 'updateUser': return withLock_(function () { return updateUser_(me, p); });
    case 'resetPassword': return withLock_(function () { return resetPassword_(p); });
    case 'deleteUser': return withLock_(function () { return deleteUser_(me, p); });
  }
  throw err_('Yêu cầu không hợp lệ.');
}

/* ───────────────────────── Đăng nhập ───────────────────────── */

function login_(p) {
  var username = String(p.username || '').trim().toLowerCase();
  var password = String(p.password || '');
  if (!username || !password) throw err_('Vui lòng nhập tên đăng nhập và mật khẩu.');

  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + username;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_LOGIN_FAILS) throw err_('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.');

  var u = findUser_(username);
  if (!u || hash_(u.salt, password) !== u.passwordHash) {
    cache.put(failKey, String(fails + 1), 600);
    throw err_('Sai tên đăng nhập hoặc mật khẩu.');
  }
  if (!isActive_(u)) throw err_('Tài khoản đã bị khóa. Vui lòng liên hệ Thầy Minh.');
  cache.remove(failKey);

  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  append_('sessions', { token: token, username: u.username, expiresAt: String(Date.now() + SESSION_DAYS * 86400000) });
  if (Math.random() < 0.2) withLock_(cleanupSessions_);
  return { token: token, user: publicUser_(u) };
}

function auth_(token) {
  token = String(token || '');
  if (!token) throw err_('Vui lòng đăng nhập.', 401);
  var cache = CacheService.getScriptCache();
  var username = cache.get('s_' + token);
  if (!username) {
    var s = rows_('sessions').filter(function (r) { return r.token === token; })[0];
    if (!s || Number(s.expiresAt) < Date.now()) throw err_('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401);
    username = s.username;
    cache.put('s_' + token, username, 600);
  }
  var u = findUser_(username);
  if (!u || !isActive_(u)) throw err_('Tài khoản không còn hoạt động.', 401);
  return u;
}

function logout_(token) {
  withLock_(function () {
    var s = rows_('sessions').filter(function (r) { return r.token === token; })[0];
    if (s) delete_('sessions', s);
  });
  CacheService.getScriptCache().remove('s_' + token);
  return {};
}

function changePassword_(me, p) {
  if (hash_(me.salt, String(p.oldPassword || '')) !== me.passwordHash) throw err_('Mật khẩu hiện tại không đúng.');
  var pw = String(p.newPassword || '');
  checkPassword_(pw);
  withLock_(function () { setPassword_(findUser_(me.username), pw); });
  return {};
}

function cleanupSessions_() {
  var now = Date.now();
  var expired = rows_('sessions').filter(function (r) { return Number(r.expiresAt) < now; });
  for (var i = expired.length - 1; i >= 0; i--) sheet_('sessions').deleteRow(expired[i]._row);
}

function killSessions_(username) {
  var cache = CacheService.getScriptCache();
  var mine = rows_('sessions').filter(function (r) { return r.username === username; });
  for (var i = mine.length - 1; i >= 0; i--) {
    cache.remove('s_' + mine[i].token);
    sheet_('sessions').deleteRow(mine[i]._row);
  }
}

/* ───────────────────────── Khóa học ───────────────────────── */

function visibleCourses_(me) {
  var users = rows_('users');
  var docs = rows_('docs');
  var asg = rows_('assignments');
  var quizzes = rows_('quizzes');
  return rows_('courses')
    .filter(function (c) { return canSee_(me, c.id); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (c) {
      var inCourse = function (r) { return r.courseId === c.id; };
      return {
        id: c.id,
        name: c.name,
        grade: c.grade,
        canEdit: canEdit_(me, c.id),
        docCount: docs.filter(inCourse).length,
        assignmentCount: asg.filter(inCourse).length,
        quizCount: quizzes.filter(inCourse).length,
        teachers: users
          .filter(function (u) { return u.role === 'teacher' && isActive_(u) && courseIds_(u).indexOf(c.id) >= 0; })
          .map(function (u) { return u.fullName; })
      };
    });
}

/** Toàn bộ nội dung một khóa trong một lần gọi: tài liệu, bài tập, luyện tập, danh sách chủ đề. */
function courseContent_(me, courseId) {
  var c = findCourse_(courseId);
  if (!c) throw err_('Khóa học không tồn tại.', 404);
  if (!canSee_(me, courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var names = userNames_();
  var edit = canEdit_(me, courseId);
  var inCourse = function (r) { return r.courseId === courseId; };

  var docs = rows_('docs').filter(inCourse)
    .sort(function (a, b) { return a.uploadedAt < b.uploadedAt ? 1 : -1; })
    .map(function (d) { return publicDoc_(d, names); });

  var subs = rows_('submissions').filter(inCourse);
  var nStudents = studentsOf_(courseId).length;
  var assignments = rows_('assignments').filter(inCourse)
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .map(function (a) {
      var o = publicAssignment_(a, names);
      var mine = subs.filter(function (s) { return s.assignmentId === a.id; });
      if (edit) o.stats = submissionStats_(mine, nStudents);
      else o.my = summarizeSubmission_(mine.filter(function (s) { return s.username === me.username; })[0]);
      return o;
    });

  var attempts = rows_('attempts').filter(inCourse);
  var quizzes = rows_('quizzes').filter(inCourse)
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .map(function (q) {
      var o = publicQuizSummary_(q, names);
      var qa = attempts.filter(function (t) { return t.quizId === q.id; });
      if (edit) {
        var people = {};
        qa.forEach(function (t) { people[t.username] = 1; });
        o.stats = { attempts: qa.length, students: Object.keys(people).length, totalStudents: nStudents };
      }
      o.my = bestAttempt_(qa.filter(function (t) { return t.username === me.username; }));
      return o;
    });

  var topics = {};
  docs.concat(assignments, quizzes).forEach(function (x) { if (x.topic) topics[x.topic] = 1; });

  return {
    course: { id: c.id, name: c.name, grade: c.grade, canEdit: edit },
    docs: docs,
    assignments: assignments,
    quizzes: quizzes,
    topics: Object.keys(topics)
  };
}

/** Trang chủ: học sinh thấy bài cần làm, giáo viên thấy bài cần chấm. */
function todo_(me) {
  var courses = {};
  rows_('courses').forEach(function (c) { courses[c.id] = c; });
  var subs = rows_('submissions');
  var items = [];
  rows_('assignments').forEach(function (a) {
    if (!courses[a.courseId] || !canSee_(me, a.courseId)) return;
    var c = courses[a.courseId];
    var base = { id: a.id, title: a.title, dueAt: a.dueAt, courseId: c.id, courseName: c.name, courseGrade: c.grade, maxScore: Number(a.maxScore || 10) };
    var mine = subs.filter(function (s) { return s.assignmentId === a.id; });
    if (canEdit_(me, a.courseId)) {
      base.stats = submissionStats_(mine, studentsOf_(a.courseId).length);
      if (base.stats.ungraded > 0) items.push(base);
    } else if (me.role === 'student') {
      base.my = summarizeSubmission_(mine.filter(function (s) { return s.username === me.username; })[0]);
      items.push(base);
    }
  });
  return { items: items };
}

/* ───────────────────────── Tài liệu ───────────────────────── */

function upload_(me, p) {
  var courseId = String(p.courseId || '');
  requireEdit_(me, courseId);
  var title = clean_(p.title, 200);
  if (!title) throw err_('Vui lòng nhập tiêu đề tài liệu.');

  var doc = {
    id: Utilities.getUuid(),
    courseId: courseId,
    topic: clean_(p.topic, 100),
    title: title,
    description: clean_(p.description, 2000),
    uploadedBy: me.username,
    uploadedAt: new Date().toISOString()
  };

  if (p.url) {
    doc.type = 'link';
    doc.url = checkUrl_(p.url);
  } else {
    var f = saveUpload_(courseFolder_(courseId), p.data, p.fileName, p.mimeType, '');
    doc.type = 'file';
    doc.fileId = f.fileId;
    doc.fileName = f.name;
    doc.mimeType = f.mimeType;
    doc.size = String(f.size);
  }

  append_('docs', doc);
  return { doc: publicDoc_(doc, userNames_()) };
}

function updateDoc_(me, p) {
  var d = findBy_('docs', String(p.id || ''));
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  requireEdit_(me, d.courseId);
  var title = p.title !== undefined ? clean_(p.title, 200) : d.title;
  if (!title) throw err_('Vui lòng nhập tiêu đề tài liệu.');
  update_('docs', d, {
    title: title,
    description: p.description !== undefined ? clean_(p.description, 2000) : d.description,
    topic: p.topic !== undefined ? clean_(p.topic, 100) : d.topic
  });
  return {};
}

function deleteDoc_(me, docId) {
  var d = findBy_('docs', docId);
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  requireEdit_(me, d.courseId);
  trash_(d.fileId);
  delete_('docs', d);
  return {};
}

function getFile_(me, docId) {
  var d = findBy_('docs', docId);
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  if (!canSee_(me, d.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  if (d.type !== 'file') throw err_('Tài liệu này là đường link, không phải file.');
  return fileData_(d.fileId, d.fileName, d.mimeType);
}

/* ───────────────────────── Bài tập về nhà ───────────────────────── */

function saveAssignment_(me, p, isNew) {
  var a = null;
  var courseId;
  if (isNew) {
    courseId = String(p.courseId || '');
  } else {
    a = findBy_('assignments', String(p.id || ''));
    if (!a) throw err_('Không tìm thấy bài tập.', 404);
    courseId = a.courseId;
  }
  requireEdit_(me, courseId);

  var title = clean_(p.title, 200);
  if (!title) throw err_('Vui lòng nhập tên bài tập.');
  var questions = [];
  if (Array.isArray(p.questions) && p.questions.length) questions = validateQuestions_(p.questions, true);
  var maxScore = questions.length
    ? sumPoints_(questions)
    : Number(p.maxScore === undefined || p.maxScore === '' ? 10 : p.maxScore);
  if (!(maxScore > 0 && maxScore <= 1000)) throw err_('Thang điểm phải từ 1 đến 1000.');
  if (a && questions.length && a.questions && a.questions !== JSON.stringify(questions)) {
    var hasSubs = rows_('submissions').some(function (s) { return s.assignmentId === a.id; });
    if (hasSubs && JSON.parse(a.questions || '[]').length !== questions.length) {
      throw err_('Đã có học sinh nộp bài nên không thể thêm/bớt câu hỏi. Bạn chỉ sửa được nội dung, đáp án, điểm; hoặc tạo bài tập mới.');
    }
  }
  var dueAt = '';
  if (p.dueAt) {
    var dt = new Date(String(p.dueAt));
    if (isNaN(dt.getTime())) throw err_('Hạn nộp không hợp lệ.');
    dueAt = dt.toISOString();
  }
  var data = {
    courseId: courseId,
    topic: clean_(p.topic, 100),
    title: title,
    instructions: clean_(p.instructions, 5000),
    dueAt: dueAt,
    maxScore: String(maxScore),
    source: questions.length ? String(p.source || '').slice(0, 45000) : '',
    questions: questions.length ? JSON.stringify(questions) : ''
  };
  if (data.questions.length > 48000) throw err_('Đề quá dài. Hãy tách thành nhiều bài tập.');
  if (p.data) {
    var f = saveUpload_(courseFolder_(courseId), p.data, p.fileName, p.mimeType, 'De bai - ');
    if (a && a.fileId) trash_(a.fileId);
    data.fileId = f.fileId;
    data.fileName = f.name;
    data.mimeType = f.mimeType;
    data.size = String(f.size);
  } else if (p.removeFile && a && a.fileId) {
    trash_(a.fileId);
    data.fileId = data.fileName = data.mimeType = data.size = '';
  }

  if (isNew) {
    data.id = Utilities.getUuid();
    data.createdBy = me.username;
    data.createdAt = new Date().toISOString();
    append_('assignments', data);
    return { assignment: publicAssignment_(data, userNames_()) };
  }
  update_('assignments', a, data);
  return { assignment: publicAssignment_(findBy_('assignments', a.id), userNames_()) };
}

function deleteAssignment_(me, id) {
  var a = findBy_('assignments', id);
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  requireEdit_(me, a.courseId);
  var subs = rows_('submissions').filter(function (s) { return s.assignmentId === id; });
  for (var i = subs.length - 1; i >= 0; i--) {
    parseFiles_(subs[i].files).forEach(function (f) { trash_(f.fileId); });
    sheet_('submissions').deleteRow(subs[i]._row);
  }
  trash_(a.fileId);
  delete_('assignments', findBy_('assignments', id));
  return {};
}

function assignmentDetail_(me, id) {
  var a = findBy_('assignments', id);
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  if (!canSee_(me, a.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var c = findCourse_(a.courseId);
  var names = userNames_();
  var edit = canEdit_(me, a.courseId);
  var subs = rows_('submissions').filter(function (s) { return s.assignmentId === id; });
  var questions = parseQuestions_(a);
  var out = {
    assignment: publicAssignment_(a, names),
    course: { id: c.id, name: c.name, grade: c.grade },
    canEdit: edit,
    canSubmit: isStudentIn_(me, a.courseId),
    // Học sinh chỉ nhận đề, không nhận đáp án.
    questions: questions.map(function (x) { return { type: x.type, text: x.text, options: x.options || null, points: x.points }; })
  };
  if (edit) {
    out.fullQuestions = questions;
    out.source = a.source || '';
    var seen = {};
    var list = studentsOf_(a.courseId).map(function (u) {
      seen[u.username] = 1;
      var s = subs.filter(function (x) { return x.username === u.username; })[0];
      return { username: u.username, fullName: u.fullName, submission: s ? publicSubmission_(s, names) : null };
    });
    subs.forEach(function (s) {
      if (!seen[s.username]) list.push({ username: s.username, fullName: names[s.username] || s.username, submission: publicSubmission_(s, names), left: true });
    });
    list.sort(function (x, y) { return x.fullName.localeCompare(y.fullName, 'vi'); });
    out.students = list;
  } else {
    var mine = subs.filter(function (s) { return s.username === me.username; })[0];
    out.submission = mine ? forStudent_(publicSubmission_(mine, names)) : null;
    if (mine && questions.length) {
      // Đáp án và lời giải chỉ hiện khi bài đã chấm xong VÀ đã hết hạn nộp (tránh lộ đáp án cho bạn khác).
      out.reveal = mine.status === 'returned' && (!a.dueAt || Date.now() > new Date(a.dueAt).getTime());
      out.review = reviewHomework_(questions, mine, out.reveal);
    }
  }
  return out;
}

function assignmentFile_(me, id) {
  var a = findBy_('assignments', id);
  if (!a || !a.fileId) throw err_('Không tìm thấy file đề bài.', 404);
  if (!canSee_(me, a.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  return fileData_(a.fileId, a.fileName, a.mimeType);
}

function submit_(me, p) {
  var a = findBy_('assignments', String(p.assignmentId || ''));
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  if (!isStudentIn_(me, a.courseId)) throw err_('Chỉ học sinh của khóa này mới nộp bài được.', 403);
  var existing = rows_('submissions').filter(function (s) { return s.assignmentId === a.id && s.username === me.username; })[0];
  if (existing && existing.status === 'returned') {
    throw err_('Bài đã được chấm nên không nộp lại được. Hãy nhắn giáo viên nếu cần sửa.');
  }

  var questions = parseQuestions_(a);
  var keep = Array.isArray(p.keepFileIds) ? p.keepFileIds.map(String) : [];
  var oldFiles = existing ? parseFiles_(existing.files) : [];
  var files = oldFiles.filter(function (f) { return keep.indexOf(f.fileId) >= 0; });
  var incoming = Array.isArray(p.files) ? p.files : [];
  if (files.length + incoming.length > MAX_SUBMIT_FILES) throw err_('Chỉ nộp tối đa ' + MAX_SUBMIT_FILES + ' file mỗi lần.');
  var text = clean_(p.text, 5000);
  var answers = [];
  var itemScores = [];
  var autoScore = 0;
  if (questions.length) {
    var raw = Array.isArray(p.answers) ? p.answers : [];
    answers = questions.map(function (x, i) {
      var v = raw[i];
      if (v === null || v === undefined || v === '') return null;
      return x.type === 'mc' ? Number(v) : clean_(v, x.type === 'essay' ? 5000 : 200);
    });
    itemScores = questions.map(function (x, i) {
      if (x.type === 'essay') return null;
      var pts = isCorrect_(x, answers[i]) ? Number(x.points || 1) : 0;
      autoScore += pts;
      return pts;
    });
    autoScore = Math.round(autoScore * 100) / 100;
    if (!answers.some(function (v) { return v !== null; }) && !files.length && !incoming.length && !text) {
      throw err_('Em chưa trả lời câu nào.');
    }
  } else if (!text && !files.length && !incoming.length) {
    throw err_('Hãy đính kèm ảnh/file bài làm hoặc viết câu trả lời.');
  }

  var total = 0;
  incoming.forEach(function (f) { total += Math.floor(String(f.data || '').length * 3 / 4); });
  if (total > MAX_UPLOAD_BYTES) throw err_('Tổng dung lượng file quá lớn (tối đa 20 MB). Hãy chụp ảnh nhỏ hơn hoặc bớt file.');

  var folder = submissionsFolder_(a.courseId);
  incoming.forEach(function (f) {
    var q = f.q === undefined || f.q === null || f.q === '' ? null : Number(f.q);
    if (q !== null && !(questions[q] && questions[q].type === 'essay')) q = null;
    var saved = saveUpload_(folder, f.data, f.name, f.mimeType, me.username + (q !== null ? ' - Cau ' + (q + 1) : '') + ' - ');
    saved.q = q;
    files.push(saved);
  });
  oldFiles.forEach(function (f) { if (keep.indexOf(f.fileId) < 0) trash_(f.fileId); });

  var now = new Date();
  var hasEssay = questions.some(function (x) { return x.type === 'essay'; });
  var autoOnly = questions.length && !hasEssay;
  var data = {
    assignmentId: a.id,
    courseId: a.courseId,
    username: me.username,
    text: text,
    files: JSON.stringify(files),
    submittedAt: now.toISOString(),
    late: a.dueAt && now.getTime() > new Date(a.dueAt).getTime() ? '1' : '0',
    status: autoOnly ? 'returned' : 'submitted',
    score: autoOnly ? String(autoScore) : '',
    feedback: existing ? existing.feedback : '',
    gradedBy: autoOnly ? 'auto' : '',
    gradedAt: autoOnly ? now.toISOString() : '',
    answers: questions.length ? JSON.stringify(answers) : '',
    itemScores: questions.length ? JSON.stringify(itemScores) : '',
    autoScore: questions.length ? String(autoScore) : ''
  };
  if (existing) {
    update_('submissions', existing, data);
    data.id = existing.id;
  } else {
    data.id = Utilities.getUuid();
    append_('submissions', data);
  }
  var out = { submission: forStudent_(publicSubmission_(data, userNames_())) };
  if (questions.length) {
    out.reveal = autoOnly && (!a.dueAt || Date.now() > new Date(a.dueAt).getTime());
    out.review = reviewHomework_(questions, data, out.reveal);
  }
  return out;
}

/** Từng câu: học sinh trả lời gì, được mấy điểm; kèm đáp án/lời giải khi reveal. */
function reviewHomework_(questions, s, reveal) {
  var answers = parseJson_(s.answers, []);
  var scores = parseJson_(s.itemScores, []);
  return questions.map(function (x, i) {
    var done = s.status === 'returned';
    var r = {
      type: x.type, text: x.text, options: x.options || null, points: Number(x.points || 1),
      answer: answers[i] === undefined ? null : answers[i],
      // Đúng/sai và điểm từng câu chỉ hiện khi bài đã chấm xong (tránh dò đáp án rồi nộp lại).
      earned: done && scores[i] !== undefined ? scores[i] : null
    };
    if (x.type !== 'essay' && done) r.correct = isCorrect_(x, answers[i]);
    if (reveal) {
      if (x.type === 'mc') r.correctAnswer = x.correct;
      if (x.type === 'short') r.correctAnswer = x.answers[0];
      r.explain = x.explain || '';
    }
    return r;
  });
}

/** Học sinh chưa được thấy điểm phần máy chấm khi bài còn chờ giáo viên chấm. */
function forStudent_(sub) {
  if (sub.status !== 'returned') { sub.itemScores = null; sub.autoScore = null; }
  return sub;
}

function parseQuestions_(a) {
  return parseJson_(a && a.questions, []);
}

function sumPoints_(questions) {
  return Math.round(questions.reduce(function (n, x) { return n + Number(x.points || 1); }, 0) * 100) / 100;
}

function parseJson_(s, dflt) {
  if (!s) return dflt;
  try { return JSON.parse(s); } catch (e) { return dflt; }
}

function submissionFile_(me, submissionId, fileId) {
  var s = findBy_('submissions', submissionId);
  if (!s) throw err_('Không tìm thấy bài nộp.', 404);
  if (s.username !== me.username && !canEdit_(me, s.courseId)) throw err_('Bạn không có quyền xem bài nộp này.', 403);
  var f = parseFiles_(s.files).filter(function (x) { return x.fileId === fileId; })[0];
  if (!f) throw err_('Không tìm thấy file.', 404);
  return fileData_(f.fileId, f.name, f.mimeType);
}

function grade_(me, p) {
  var s = findBy_('submissions', String(p.submissionId || ''));
  if (!s) throw err_('Không tìm thấy bài nộp.', 404);
  requireEdit_(me, s.courseId);
  var a = findBy_('assignments', s.assignmentId);
  var max = Number((a && a.maxScore) || 10);
  if (p.reopen) {
    update_('submissions', s, { status: 'submitted', score: '', gradedBy: '', gradedAt: '' });
    return { submission: publicSubmission_(findBy_('submissions', s.id), userNames_()) };
  }
  var questions = parseQuestions_(a);
  var changes = {
    status: 'returned',
    feedback: clean_(p.feedback, 3000),
    gradedBy: me.username,
    gradedAt: new Date().toISOString()
  };
  if (questions.length && s.itemScores) {
    // Bài có câu hỏi: phần trắc nghiệm/trả lời ngắn đã chấm tự động, giáo viên chấm từng câu tự luận.
    var items = parseJson_(s.itemScores, []);
    var given = p.essayScores || {};
    questions.forEach(function (x, i) {
      if (x.type !== 'essay') return;
      var v = String(given[i] === undefined || given[i] === null ? '' : given[i]).replace(',', '.').trim();
      var n = Number(v);
      if (v === '' || isNaN(n) || n < 0 || n > Number(x.points)) {
        throw err_('Câu ' + (i + 1) + ': điểm phải là số từ 0 đến ' + x.points + '.');
      }
      items[i] = Math.round(n * 100) / 100;
    });
    changes.itemScores = JSON.stringify(items);
    changes.score = String(Math.round(items.reduce(function (t, v) { return t + Number(v || 0); }, 0) * 100) / 100);
  } else {
    var raw = String(p.score === undefined || p.score === null ? '' : p.score).replace(',', '.').trim();
    var score = Number(raw);
    if (raw === '' || isNaN(score) || score < 0 || score > max) throw err_('Điểm phải là số từ 0 đến ' + max + '.');
    changes.score = String(Math.round(score * 100) / 100);
  }
  update_('submissions', s, changes);
  return { submission: publicSubmission_(findBy_('submissions', s.id), userNames_()) };
}

function submissionStats_(subs, nStudents) {
  var graded = subs.filter(function (s) { return s.status === 'returned'; }).length;
  return { students: nStudents, submitted: subs.length, graded: graded, ungraded: subs.length - graded };
}

function summarizeSubmission_(s) {
  if (!s) return { status: 'todo' };
  return { status: s.status, score: s.score === '' ? null : Number(s.score), submittedAt: s.submittedAt, late: s.late === '1' };
}

/* ───────────────────────── Luyện tập (tự chấm) ───────────────────────── */

function saveQuiz_(me, p) {
  var q = null;
  var courseId = String(p.courseId || '');
  if (p.id) {
    q = findBy_('quizzes', String(p.id));
    if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
    courseId = q.courseId;
  }
  requireEdit_(me, courseId);
  var title = clean_(p.title, 200);
  if (!title) throw err_('Vui lòng nhập tên bài luyện tập.');
  var questions = validateQuestions_(p.questions, false);
  var limit = Number(p.timeLimit || 0);
  if (isNaN(limit) || limit < 0 || limit > 300) throw err_('Thời gian làm bài phải từ 0 đến 300 phút.');
  var now = new Date().toISOString();
  var data = {
    courseId: courseId,
    topic: clean_(p.topic, 100),
    title: title,
    description: clean_(p.description, 2000),
    source: String(p.source || '').slice(0, 45000),
    questions: JSON.stringify(questions),
    timeLimit: String(Math.round(limit)),
    showAnswers: p.showAnswers === false ? '0' : '1',
    updatedAt: now
  };
  if (data.questions.length > 48000) throw err_('Đề quá dài. Hãy tách thành nhiều bài luyện tập.');
  if (q) {
    update_('quizzes', q, data);
    data.id = q.id;
  } else {
    data.id = Utilities.getUuid();
    data.createdBy = me.username;
    data.createdAt = now;
    append_('quizzes', data);
  }
  return { id: data.id };
}

function validateQuestions_(list, allowEssay) {
  if (!Array.isArray(list) || !list.length) throw err_('Đề chưa có câu hỏi nào.');
  if (list.length > 200) throw err_('Tối đa 200 câu mỗi bài.');
  return list.map(function (q, i) {
    var n = 'Câu ' + (i + 1) + ': ';
    var text = clean_(q.text, 3000);
    if (!text) throw err_(n + 'thiếu nội dung câu hỏi.');
    var type = q.type === 'short' || q.type === 'essay' ? q.type : 'mc';
    if (type === 'essay' && !allowEssay) throw err_(n + 'bài luyện tập không dùng câu tự luận.');
    var points = q.points === undefined || q.points === '' ? 1 : Number(q.points);
    if (!(points > 0 && points <= 100)) throw err_(n + 'số điểm không hợp lệ.');
    var out = { type: type, text: text, explain: clean_(q.explain, 3000), points: Math.round(points * 100) / 100 };
    if (out.type === 'essay') {
      // không có đáp án tự động
    } else if (out.type === 'mc') {
      var opts = (Array.isArray(q.options) ? q.options : []).map(function (o) { return clean_(o, 500); });
      if (opts.length < 2 || opts.length > 8 || opts.some(function (o) { return !o; })) throw err_(n + 'cần từ 2 đến 8 lựa chọn.');
      var c = Number(q.correct);
      if (!(c >= 0 && c < opts.length && c === Math.floor(c))) throw err_(n + 'chưa đánh dấu đáp án đúng.');
      out.options = opts;
      out.correct = c;
    } else {
      var ans = (Array.isArray(q.answers) ? q.answers : []).map(function (a) { return clean_(a, 200); }).filter(String);
      if (!ans.length) throw err_(n + 'chưa có đáp án.');
      out.answers = ans;
    }
    return out;
  });
}

function quizDetail_(me, id) {
  var q = findBy_('quizzes', id);
  if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
  if (!canSee_(me, q.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var c = findCourse_(q.courseId);
  var names = userNames_();
  var edit = canEdit_(me, q.courseId);
  var questions = JSON.parse(q.questions || '[]');
  var out = {
    quiz: publicQuizSummary_(q, names),
    course: { id: c.id, name: c.name, grade: c.grade },
    canEdit: edit,
    // Học sinh KHÔNG nhận đáp án trước khi nộp bài.
    questions: questions.map(function (x) { return { type: x.type, text: x.text, options: x.options || null }; })
  };
  var attempts = rows_('attempts').filter(function (t) { return t.quizId === id; });
  out.myAttempts = attempts.filter(function (t) { return t.username === me.username; })
    .sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; })
    .map(function (t) { return { id: t.id, score: Number(t.score), total: Number(t.total), submittedAt: t.submittedAt }; });
  if (edit) {
    out.source = q.source;
    out.fullQuestions = questions;
    out.description = q.description;
    var by = {};
    attempts.forEach(function (t) {
      var r = by[t.username] || (by[t.username] = { username: t.username, fullName: names[t.username] || t.username, attempts: 0, best: -1, total: Number(t.total), last: '' });
      r.attempts++;
      if (Number(t.score) > r.best) r.best = Number(t.score);
      if (t.submittedAt > r.last) r.last = t.submittedAt;
    });
    var seen = {};
    var rowsOut = studentsOf_(q.courseId).map(function (u) {
      seen[u.username] = 1;
      return by[u.username] || { username: u.username, fullName: u.fullName, attempts: 0, best: null, total: questions.length, last: '' };
    });
    Object.keys(by).forEach(function (k) { if (!seen[k]) rowsOut.push(by[k]); });
    rowsOut.sort(function (x, y) { return x.fullName.localeCompare(y.fullName, 'vi'); });
    out.results = rowsOut;
  }
  return out;
}

function submitQuiz_(me, p) {
  var q = findBy_('quizzes', String(p.quizId || ''));
  if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
  if (!canSee_(me, q.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var questions = JSON.parse(q.questions || '[]');
  var answers = Array.isArray(p.answers) ? p.answers : [];
  var clean = questions.map(function (x, i) {
    var a = answers[i];
    if (a === null || a === undefined || a === '') return null;
    return x.type === 'mc' ? Number(a) : clean_(a, 200);
  });
  var score = 0;
  questions.forEach(function (x, i) { if (isCorrect_(x, clean[i])) score++; });
  var t = {
    id: Utilities.getUuid(),
    quizId: q.id,
    courseId: q.courseId,
    username: me.username,
    answers: JSON.stringify(clean),
    score: String(score),
    total: String(questions.length),
    submittedAt: new Date().toISOString()
  };
  // Chỉ lưu kết quả của học sinh; giáo viên làm thử thì không tính.
  if (isStudentIn_(me, q.courseId)) append_('attempts', t);
  return reviewAttempt_(q, t);
}

function attemptDetail_(me, attemptId) {
  var t = findBy_('attempts', attemptId);
  if (!t) throw err_('Không tìm thấy kết quả.', 404);
  if (t.username !== me.username && !canEdit_(me, t.courseId)) throw err_('Bạn không có quyền xem kết quả này.', 403);
  var q = findBy_('quizzes', t.quizId);
  if (!q) throw err_('Bài luyện tập đã bị xóa.', 404);
  return reviewAttempt_(q, t);
}

function reviewAttempt_(q, t) {
  var questions = JSON.parse(q.questions || '[]');
  var answers = JSON.parse(t.answers || '[]');
  var show = q.showAnswers !== '0';
  return {
    attempt: { id: t.id, score: Number(t.score), total: Number(t.total), submittedAt: t.submittedAt },
    showAnswers: show,
    review: questions.map(function (x, i) {
      var r = { type: x.type, text: x.text, options: x.options || null, answer: answers[i] === undefined ? null : answers[i], correct: isCorrect_(x, answers[i]) };
      if (show) {
        r.correctAnswer = x.type === 'mc' ? x.correct : x.answers[0];
        r.explain = x.explain || '';
      }
      return r;
    })
  };
}

function isCorrect_(x, a) {
  if (a === null || a === undefined || a === '') return false;
  if (x.type === 'mc') return Number(a) === Number(x.correct);
  var v = normAnswer_(a);
  var vn = numPart_(v);
  return (x.answers || []).some(function (ans) {
    var k = normAnswer_(ans);
    if (k === v) return true;
    // "24" khớp "24cm", "0.75" khớp "0,75kg": cùng con số, chỉ khác đơn vị (hoặc thiếu đơn vị).
    var kn = numPart_(k);
    return vn !== null && kn !== null && vn.num === kn.num && (!vn.unit || !kn.unit || vn.unit === kn.unit);
  });
}

function numPart_(s) {
  var m = /^(-?\d+(?:\.\d+)?(?:\/\d+)?)([a-zà-ỹđ²³]*)$/.exec(s);
  return m ? { num: m[1], unit: m[2] } : null;
}

function normAnswer_(s) {
  return String(s).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').replace(/\.$/, '');
}

function deleteQuiz_(me, id) {
  var q = findBy_('quizzes', id);
  if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
  requireEdit_(me, q.courseId);
  var ts = rows_('attempts').filter(function (t) { return t.quizId === id; });
  for (var i = ts.length - 1; i >= 0; i--) sheet_('attempts').deleteRow(ts[i]._row);
  delete_('quizzes', findBy_('quizzes', id));
  return {};
}

function bestAttempt_(list) {
  if (!list.length) return null;
  var best = list.reduce(function (b, t) { return Number(t.score) > Number(b.score) ? t : b; });
  return { best: Number(best.score), total: Number(best.total), attempts: list.length };
}

/* ───────────────────────── Quản lý tài khoản (admin) ───────────────────────── */

function createUser_(me, p) {
  var data = validateUserInput_(p, true);
  var pw = p.password ? String(p.password) : randomPassword_();
  checkPassword_(pw);
  var u = insertUser_(data, pw);
  return { user: publicUser_(u), password: pw };
}

/** p.users = [{username, fullName, role, courses}] – tạo nhiều tài khoản một lúc. */
function bulkCreate_(me, p) {
  var list = Array.isArray(p.users) ? p.users.slice(0, 300) : [];
  if (!list.length) throw err_('Danh sách trống.');
  var results = list.map(function (item) {
    try {
      var data = validateUserInput_(item, true);
      var pw = randomPassword_();
      insertUser_(data, pw);
      return { username: data.username, fullName: data.fullName, password: pw };
    } catch (e) {
      return { username: String(item.username || ''), fullName: String(item.fullName || ''), error: e.userFacing ? e.message : String(e.message) };
    }
  });
  return { results: results };
}

function updateUser_(me, p) {
  var u = findUser_(String(p.username || '').toLowerCase());
  if (!u) throw err_('Không tìm thấy tài khoản.', 404);
  var data = validateUserInput_({
    username: u.username,
    fullName: p.fullName !== undefined ? p.fullName : u.fullName,
    role: p.role !== undefined ? p.role : u.role,
    courses: p.courses !== undefined ? p.courses : courseIds_(u)
  }, false);
  var active = p.active !== undefined ? (p.active ? '1' : '0') : (isActive_(u) ? '1' : '0');
  if (u.username === me.username && (data.role !== 'admin' || active !== '1')) {
    throw err_('Bạn không thể tự khóa hoặc bỏ quyền admin của chính mình.');
  }
  update_('users', u, { fullName: data.fullName, role: data.role, courses: data.courses, active: active });
  if (active !== '1') killSessions_(u.username);
  return { user: publicUser_(findUser_(u.username)) };
}

function resetPassword_(p) {
  var u = findUser_(String(p.username || '').toLowerCase());
  if (!u) throw err_('Không tìm thấy tài khoản.', 404);
  var pw = randomPassword_();
  setPassword_(u, pw);
  killSessions_(u.username);
  return { username: u.username, password: pw };
}

function deleteUser_(me, p) {
  var u = findUser_(String(p.username || '').toLowerCase());
  if (!u) throw err_('Không tìm thấy tài khoản.', 404);
  if (u.username === me.username) throw err_('Bạn không thể xóa tài khoản của chính mình.');
  killSessions_(u.username);
  delete_('users', findUser_(u.username));
  return {};
}

function validateUserInput_(p, isNew) {
  var username = String(p.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw err_('Tên đăng nhập "' + username + '" không hợp lệ: 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang.');
  }
  if (isNew && findUser_(username)) throw err_('Tên đăng nhập "' + username + '" đã tồn tại.');
  var fullName = clean_(p.fullName, 100);
  if (!fullName) throw err_('Vui lòng nhập họ tên cho "' + username + '".');
  var role = String(p.role || 'student');
  if (ROLES.indexOf(role) < 0) throw err_('Vai trò không hợp lệ.');
  var wanted = Array.isArray(p.courses) ? p.courses : String(p.courses || '').split(/[\s,;]+/);
  var valid = rows_('courses').map(function (c) { return c.id; });
  var bad = wanted.filter(function (c) { return c && valid.indexOf(c) < 0; });
  if (bad.length) throw err_('Mã khóa không tồn tại: ' + bad.join(', ') + '. Mã hợp lệ: ' + valid.join(', '));
  var courses = valid.filter(function (c) { return wanted.indexOf(c) >= 0; });
  return { username: username, fullName: fullName, role: role, courses: courses.join(',') };
}

/* ───────────────────────── Quyền ───────────────────────── */

function courseIds_(u) {
  return String(u.courses || '').split(',').map(function (s) { return s.trim(); }).filter(String);
}
function canSee_(u, courseId) {
  return u.role === 'admin' || courseIds_(u).indexOf(courseId) >= 0;
}
function canEdit_(u, courseId) {
  return u.role === 'admin' || (u.role === 'teacher' && courseIds_(u).indexOf(courseId) >= 0);
}
function isStudentIn_(u, courseId) {
  return u.role === 'student' && courseIds_(u).indexOf(courseId) >= 0;
}
function requireEdit_(me, courseId) {
  if (!findCourse_(courseId)) throw err_('Khóa học không tồn tại.', 404);
  if (!canEdit_(me, courseId)) throw err_('Bạn không có quyền chỉnh sửa nội dung khóa này.', 403);
}
function isActive_(u) {
  return String(u.active) !== '0';
}
function findCourse_(id) {
  return rows_('courses').filter(function (c) { return c.id === id; })[0] || null;
}
function studentsOf_(courseId) {
  return rows_('users').filter(function (u) { return isStudentIn_(u, courseId) && isActive_(u); });
}
function userNames_() {
  var names = {};
  rows_('users').forEach(function (u) { names[u.username] = u.fullName; });
  return names;
}

/* ───────────────────────── Drive ───────────────────────── */

function rootFolder_() {
  return storedFolder_('ROOT_FOLDER_ID', function () { return DriveApp.createFolder('Toán Thầy Minh – Tài liệu khóa học'); });
}
function courseFolder_(courseId) {
  return storedFolder_('FOLDER_' + courseId, function () { return rootFolder_().createFolder(courseId); });
}
function submissionsFolder_(courseId) {
  return storedFolder_('SUBFOLDER_' + courseId, function () { return courseFolder_(courseId).createFolder('Bài nộp của học sinh'); });
}
function storedFolder_(key, create) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(key);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* bị xóa → tạo lại */ }
  }
  var f = create();
  props.setProperty(key, f.getId());
  return f;
}

function saveUpload_(folder, data, fileName, mimeType, prefix) {
  if (!data) throw err_('Vui lòng chọn file cần tải lên.');
  var bytes = Utilities.base64Decode(String(data));
  if (bytes.length > MAX_UPLOAD_BYTES) throw err_('File quá lớn (tối đa 20 MB). Với video, hãy đăng YouTube rồi dán link.');
  var name = clean_(fileName, 200) || 'tep';
  var blob = Utilities.newBlob(bytes, String(mimeType || 'application/octet-stream'), (prefix || '') + name);
  var file = folder.createFile(blob);
  return { fileId: file.getId(), name: name, mimeType: blob.getContentType(), size: bytes.length };
}

function fileData_(fileId, name, mimeType) {
  var blob;
  try { blob = DriveApp.getFileById(fileId).getBlob(); } catch (e) { throw err_('File không còn trong Google Drive.', 404); }
  return { name: name, mimeType: mimeType, data: Utilities.base64Encode(blob.getBytes()) };
}

function trash_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* đã xóa */ }
}

function parseFiles_(s) {
  try { var v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

/* ───────────────────────── Sheets ───────────────────────── */

var checkedSheets_ = {};

function ensureSheet_(k) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAMES[k]);
  if (!sh) sh = ss.insertSheet(SHEET_NAMES[k]);
  var cols = COLUMNS[k];
  // Định dạng văn bản thuần để Sheets không tự đổi "001" thành số hay chuỗi ngày thành ngày.
  sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), cols.length)).setNumberFormat('@');
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols);
    sh.setFrozenRows(1);
  } else {
    // Cập nhật tiêu đề khi phiên bản mới thêm cột (dữ liệu cũ giữ nguyên).
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  checkedSheets_[k] = true;
  return sh;
}

function sheet_(k) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[k]);
  if (!sh) {
    if (AUTO_CREATE.indexOf(k) >= 0) return ensureSheet_(k);
    throw err_('Máy chủ chưa được cài đặt: hãy chạy hàm setup() trong Apps Script.', 500);
  }
  if (!checkedSheets_[k]) {
    checkedSheets_[k] = true;
    var n = COLUMNS[k].length;
    if (sh.getLastColumn() < n || String(sh.getRange(1, n).getValue()) !== COLUMNS[k][n - 1]) return ensureSheet_(k);
  }
  return sh;
}

function rows_(k) {
  var sh = sheet_(k);
  var n = sh.getLastRow();
  if (n < 2) return [];
  var cols = COLUMNS[k];
  return sh.getRange(2, 1, n - 1, cols.length).getValues().map(function (v, i) {
    var o = { _row: i + 2 };
    cols.forEach(function (c, j) {
      o[c] = v[j] instanceof Date ? v[j].toISOString() : String(v[j] === null || v[j] === undefined ? '' : v[j]);
    });
    return o;
  });
}

function findBy_(k, id) {
  if (!id) return null;
  return rows_(k).filter(function (r) { return r.id === id; })[0] || null;
}

function append_(k, obj) {
  sheet_(k).appendRow(COLUMNS[k].map(function (c) { return obj[c] === undefined ? '' : String(obj[c]); }));
}

function update_(k, row, changes) {
  var cols = COLUMNS[k];
  var vals = cols.map(function (c) { return changes[c] !== undefined ? String(changes[c]) : row[c]; });
  sheet_(k).getRange(row._row, 1, 1, cols.length).setValues([vals]);
}

function delete_(k, row) {
  sheet_(k).deleteRow(row._row);
}

function findUser_(username) {
  username = String(username || '').toLowerCase();
  return rows_('users').filter(function (u) { return u.username.toLowerCase() === username; })[0] || null;
}

function insertUser_(data, password) {
  var salt = Utilities.getUuid();
  var u = {
    username: data.username,
    fullName: data.fullName,
    role: data.role,
    courses: data.courses,
    active: '1',
    salt: salt,
    passwordHash: hash_(salt, password),
    createdAt: new Date().toISOString()
  };
  append_('users', u);
  return u;
}

function setPassword_(u, password) {
  var salt = Utilities.getUuid();
  update_('users', u, { salt: salt, passwordHash: hash_(salt, password) });
}

/* ───────────────────────── Định dạng trả về ───────────────────────── */

function publicUser_(u) {
  return {
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    courses: courseIds_(u),
    active: isActive_(u),
    createdAt: u.createdAt
  };
}

function publicDoc_(d, names) {
  return {
    id: d.id,
    courseId: d.courseId,
    topic: d.topic || '',
    title: d.title,
    description: d.description,
    type: d.type,
    fileName: d.fileName || '',
    mimeType: d.mimeType || '',
    size: Number(d.size || 0),
    url: d.type === 'link' ? d.url : '',
    uploadedBy: (names && names[d.uploadedBy]) || d.uploadedBy,
    uploadedAt: d.uploadedAt
  };
}

function publicAssignment_(a, names) {
  return {
    id: a.id,
    courseId: a.courseId,
    topic: a.topic || '',
    title: a.title,
    instructions: a.instructions || '',
    dueAt: a.dueAt || '',
    maxScore: Number(a.maxScore || 10),
    file: a.fileId ? { name: a.fileName, mimeType: a.mimeType, size: Number(a.size || 0) } : null,
    questionCount: parseQuestions_(a).length,
    essayCount: parseQuestions_(a).filter(function (x) { return x.type === 'essay'; }).length,
    createdBy: (names && names[a.createdBy]) || a.createdBy,
    createdAt: a.createdAt
  };
}

function publicSubmission_(s, names) {
  return {
    id: s.id,
    username: s.username,
    text: s.text || '',
    files: parseFiles_(s.files).map(function (f) { return { id: f.fileId, name: f.name, mimeType: f.mimeType, size: Number(f.size || 0), q: f.q === undefined ? null : f.q }; }),
    submittedAt: s.submittedAt,
    late: s.late === '1',
    status: s.status,
    score: s.score === '' || s.score === undefined ? null : Number(s.score),
    feedback: s.feedback || '',
    gradedBy: s.gradedBy === 'auto' ? 'Máy chấm tự động' : s.gradedBy ? ((names && names[s.gradedBy]) || s.gradedBy) : '',
    gradedAt: s.gradedAt || '',
    answers: parseJson_(s.answers, null),
    itemScores: parseJson_(s.itemScores, null),
    autoScore: s.autoScore === '' || s.autoScore === undefined ? null : Number(s.autoScore)
  };
}

function publicQuizSummary_(q, names) {
  var n = 0;
  try { n = JSON.parse(q.questions || '[]').length; } catch (e) { n = 0; }
  return {
    id: q.id,
    courseId: q.courseId,
    topic: q.topic || '',
    title: q.title,
    description: q.description || '',
    count: n,
    timeLimit: Number(q.timeLimit || 0),
    showAnswers: q.showAnswers !== '0',
    createdBy: (names && names[q.createdBy]) || q.createdBy,
    createdAt: q.createdAt
  };
}

/* ───────────────────────── Tiện ích ───────────────────────── */

function hash_(salt, password) {
  var value = salt + '|' + password;
  var digest;
  for (var i = 0; i < 200; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
    value = Utilities.base64Encode(digest) + salt;
  }
  return Utilities.base64Encode(digest);
}

function randomPassword_() {
  var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  var s = '';
  var raw = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; i < 8; i++) s += chars.charAt(parseInt(raw.substr(i * 2, 2), 16) % chars.length);
  return s;
}

function checkPassword_(pw) {
  if (pw.length < 6) throw err_('Mật khẩu cần ít nhất 6 ký tự.');
  if (pw.length > 100) throw err_('Mật khẩu quá dài.');
}

function checkUrl_(u) {
  var url = String(u || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw err_('Đường link phải bắt đầu bằng http:// hoặc https://');
  return url;
}

function clean_(v, max) {
  return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function err_(message, code) {
  var e = new Error(message);
  e.code = code || 400;
  e.userFacing = true;
  return e;
}
