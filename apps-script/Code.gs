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
 *   TranDau        – kết quả các trận đấu cả lớp
 *   HocPhi         – học phí đã đóng: mỗi dòng = một học sinh đã đóng một lớp trong một tháng
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
  sessions: 'PhienDangNhap',
  fees: 'HocPhi',
  matches: 'TranDau'
};
var COLUMNS = {
  users: ['username', 'fullName', 'role', 'courses', 'active', 'salt', 'passwordHash', 'createdAt'],
  courses: ['id', 'name', 'grade', 'order', 'branches'],
  docs: ['id', 'courseId', 'title', 'description', 'type', 'fileId', 'fileName', 'mimeType', 'size', 'url', 'uploadedBy', 'uploadedAt', 'topic', 'branch', 'free'],
  assignments: ['id', 'courseId', 'topic', 'title', 'instructions', 'dueAt', 'maxScore', 'fileId', 'fileName', 'mimeType', 'size', 'createdBy', 'createdAt', 'source', 'questions', 'images', 'branch'],
  submissions: ['id', 'assignmentId', 'courseId', 'username', 'text', 'files', 'submittedAt', 'late', 'status', 'score', 'feedback', 'gradedBy', 'gradedAt', 'answers', 'itemScores', 'autoScore', 'aiSuggest'],
  quizzes: ['id', 'courseId', 'topic', 'title', 'description', 'source', 'questions', 'timeLimit', 'showAnswers', 'createdBy', 'createdAt', 'updatedAt', 'images', 'gameOnly', 'branch'],
  attempts: ['id', 'quizId', 'courseId', 'username', 'answers', 'score', 'total', 'submittedAt'],
  sessions: ['token', 'username', 'expiresAt'],
  fees: ['username', 'courseId', 'month', 'paidAt', 'markedBy', 'note'],
  matches: ['id', 'quizId', 'courseId', 'host', 'playedAt', 'playerCount', 'questionCount', 'results']
};
// Đọc nhanh: BaiNop chỉ lấy 13 cột đầu (bỏ câu trả lời, điểm từng câu, gợi ý AI ở cuối); LuyenTap/BaiTap đọc đủ tới cột branch.
// Chỉ dùng ở các hàm CHỈ ĐỌC (danh sách, trang chủ) – không bao giờ update_ một dòng đọc thiếu cột.
var LITE_COLS = { submissions: 13, quizzes: 15, assignments: 17 };
// Kết quả các trang danh sách được nhớ trong CacheService tới khi có thao tác ghi (hoặc hết hạn).
var RESULT_TTL = 300;
// Các trang tự tạo khi chưa có (để cập nhật code mà không cần chạy lại setup).
var AUTO_CREATE = ['docs', 'assignments', 'submissions', 'quizzes', 'attempts', 'sessions', 'fees', 'matches'];
var TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
var PUBLIC_USER_ = { username: '_public', role: 'guest', courses: '' };

/* ───────────────────────── Cài đặt lần đầu ───────────────────────── */

/** Chạy hàm này MỘT LẦN trong trình soạn Apps Script. Mật khẩu admin hiện trong Nhật ký thực thi. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(function (k) { ensureSheet_(k); });

  if (sheet_('courses').getLastRow() === 1) {
    DEFAULT_COURSES.forEach(function (c) { sheet_('courses').appendRow(c); });
    dirty_('courses');
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
  killSessions_('admin');
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

  // Công khai (không cần đăng nhập): mục lục các lớp và kho tài liệu miễn phí.
  if (action === 'catalog') return { courses: cached_('catalog', PUBLIC_USER_, '', catalog_) };
  if (action === 'freeDocs') return { docs: cached_('freeDocs', PUBLIC_USER_, '', freeDocs_) };
  if (action === 'freeFile') return freeFile_(String(p.id || ''));

  var me = auth_(p.token);
  var id = String(p.id || p.docId || '');
  switch (action) {
    case 'me': return { user: publicUser_(me) };
    case 'logout': return logout_(p.token);
    case 'changePassword': return changePassword_(me, p);
    case 'courses': return { courses: cached_('courses', me, '', function () { return visibleCourses_(me); }) };
    case 'course': return cached_('course', me, String(p.courseId || ''), function () { return courseContent_(me, String(p.courseId || '')); });
    case 'todo': return cached_('todo', me, thisMonth_(), function () { return todo_(me); });
    // Trang chủ trong MỘT lần gọi: thông tin tài khoản + khóa học + bài cần làm/chấm + học phí.
    case 'home': return home_(me);

    // Tài liệu
    case 'docs': return { docs: courseContent_(me, String(p.courseId || '')).docs };
    case 'upload': return upload_(me, p);
    case 'updateDoc': return withLock_(function () { return updateDoc_(me, p); });
    case 'deleteDoc': return withLock_(function () { return deleteDoc_(me, id); });
    case 'file': return getFile_(me, id);
    case 'qimage': return questionImage_(me, String(p.kind || ''), id, String(p.key || ''));

    // Bài tập về nhà
    case 'assignment': return assignmentDetail_(me, id);
    case 'createAssignment': return saveAssignment_(me, p, true);
    case 'updateAssignment': return saveAssignment_(me, p, false);
    case 'deleteAssignment': return withLock_(function () { return deleteAssignment_(me, id); });
    case 'assignmentFile': return assignmentFile_(me, id);
    case 'submit': return submit_(me, p);
    case 'submissionFile': return submissionFile_(me, String(p.submissionId || ''), String(p.fileId || ''));
    case 'grade': return withLock_(function () { return grade_(me, p); });
    case 'finalizeAll': return withLock_(function () { return finalizeAll_(me, p); });
    case 'aiGrade': return aiGrade_(me, String(p.submissionId || ''));

    // Luyện tập
    case 'quiz': return quizDetail_(me, id);
    case 'saveQuiz': return saveQuiz_(me, p);
    case 'deleteQuiz': return withLock_(function () { return deleteQuiz_(me, id); });
    case 'submitQuiz': return withLock_(function () { return submitQuiz_(me, p); });
    case 'attempt': return attemptDetail_(me, String(p.attemptId || ''));
    case 'saveMatch': return withLock_(function () { return saveMatch_(me, p); });
  }

  if (me.role !== 'admin') throw err_('Chỉ admin mới làm được thao tác này.', 403);
  switch (action) {
    case 'users': return { users: rows_('users').map(publicUser_) };
    case 'createUser': return withLock_(function () { return createUser_(me, p); });
    case 'bulkCreate': return withLock_(function () { return bulkCreate_(me, p); });
    case 'updateUser': return withLock_(function () { return updateUser_(me, p); });
    case 'resetPassword': return withLock_(function () { return resetPassword_(p); });
    case 'deleteUser': return withLock_(function () { return deleteUser_(me, p); });

    // Thống kê & học phí
    case 'feeBoard': return cached_('feeBoard', me, String(p.month || thisMonth_()), function () { return feeBoard_(String(p.month || thisMonth_())); });
    case 'setFee': return withLock_(function () { return setFee_(me, p); });
    case 'setFees': return withLock_(function () { return setFees_(me, p); });
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
    cache.put('s_' + token, username, 21600);
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
  withLock_(function () {
    setPassword_(findUser_(me.username), pw);
    killSessions_(me.username, String(p.token || ''));
  });
  return {};
}

function cleanupSessions_() {
  var now = Date.now();
  var expired = rows_('sessions').filter(function (r) { return Number(r.expiresAt) < now; });
  for (var i = expired.length - 1; i >= 0; i--) sheet_('sessions').deleteRow(expired[i]._row);
  dirty_('sessions');
}

function killSessions_(username, keepToken) {
  var cache = CacheService.getScriptCache();
  var mine = rows_('sessions').filter(function (r) { return r.username === username && r.token !== keepToken; });
  for (var i = mine.length - 1; i >= 0; i--) {
    cache.remove('s_' + mine[i].token);
    sheet_('sessions').deleteRow(mine[i]._row);
    dirty_('sessions');
  }
}

/* ───────────────────────── Khóa học ───────────────────────── */

function visibleCourses_(me) {
  var users = rows_('users');
  var docs = rows_('docs');
  var asg = rows_('assignments', LITE_COLS.assignments);
  var quizzes = rows_('quizzes', LITE_COLS.quizzes);
  return rows_('courses')
    .filter(function (c) { return canSee_(me, c.id); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (c) {
      var inCourse = function (r) { return r.courseId === c.id; };
      var edit = canEdit_(me, c.id);
      return {
        id: c.id,
        name: c.name,
        grade: c.grade,
        branches: branchesOf_(c),
        canEdit: edit,
        docCount: docs.filter(inCourse).length,
        assignmentCount: asg.filter(inCourse).length,
        quizCount: quizzes.filter(function (q) { return q.courseId === c.id && (edit || q.gameOnly !== '1'); }).length,
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
    .map(function (d) { return publicDoc_(d, names, c); });

  var subs = rows_('submissions', LITE_COLS.submissions).filter(inCourse);
  var nStudents = studentsOf_(courseId).length;
  var assignments = rows_('assignments', LITE_COLS.assignments).filter(inCourse)
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .map(function (a) {
      var o = publicAssignment_(a, names, c);
      var mine = subs.filter(function (s) { return s.assignmentId === a.id; });
      if (edit) o.stats = submissionStats_(mine, nStudents);
      else o.my = summarizeSubmission_(mine.filter(function (s) { return s.username === me.username; })[0]);
      return o;
    });

  var attempts = rows_('attempts').filter(inCourse);
  var quizzes = rows_('quizzes', LITE_COLS.quizzes).filter(inCourse)
    .filter(function (q) { return edit || q.gameOnly !== '1'; })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .map(function (q) {
      var o = publicQuizSummary_(q, names, c);
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
    course: { id: c.id, name: c.name, grade: c.grade, branches: branchesOf_(c), canEdit: edit },
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
  var subs = rows_('submissions', LITE_COLS.submissions);
  var nStudents = {};
  var items = [];
  rows_('assignments', LITE_COLS.assignments).forEach(function (a) {
    if (!courses[a.courseId] || !canSee_(me, a.courseId)) return;
    var c = courses[a.courseId];
    var base = { id: a.id, title: a.title, dueAt: a.dueAt, courseId: c.id, courseName: c.name, courseGrade: c.grade, branch: itemBranch_(c, a), maxScore: Number(a.maxScore || 10) };
    var mine = subs.filter(function (s) { return s.assignmentId === a.id; });
    if (canEdit_(me, a.courseId)) {
      if (nStudents[a.courseId] === undefined) nStudents[a.courseId] = studentsOf_(a.courseId).length;
      base.stats = submissionStats_(mine, nStudents[a.courseId]);
      if (base.stats.ungraded > 0) items.push(base);
    } else if (me.role === 'student') {
      base.my = summarizeSubmission_(mine.filter(function (s) { return s.username === me.username; })[0]);
      items.push(base);
    }
  });
  var out = { items: items };
  if (me.role === 'student') out.fees = myFees_(me, courses);
  if (me.role === 'admin') out.feeSummary = feeSummary_(thisMonth_());
  return out;
}

/** Trang chủ trong một lần gọi (thay cho 3 lần me → courses → todo nối tiếp nhau). */
function home_(me) {
  return cached_('home', me, thisMonth_(), function () {
    var t = todo_(me);
    t.user = publicUser_(me);
    t.courses = visibleCourses_(me);
    return t;
  });
}

/* ───────────────────────── Thống kê & học phí ───────────────────────── */

/** Tháng hiện tại theo giờ Việt Nam, dạng "2026-10". */
function thisMonth_() {
  return Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM');
}
function checkMonth_(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw err_('Tháng không hợp lệ.');
  return month;
}

/**
 * Bảng của admin cho một tháng: mỗi lớp có danh sách học sinh đang học (tài khoản không bị khóa)
 * và ai đã đóng học phí; kèm số học sinh bị khóa / số giáo viên để thống kê.
 * Học sinh đã đóng tháng đó nhưng nay đã nghỉ (bỏ ghi danh / khóa) vẫn hiện, đánh dấu "left".
 */
function feeBoard_(month) {
  checkMonth_(month);
  var users = rows_('users');
  var byName = {};
  users.forEach(function (u) { byName[u.username] = u; });
  var paid = {};
  rows_('fees').forEach(function (f) {
    if (f.month === month) paid[f.courseId + '|' + f.username] = f;
  });
  var active = {};
  var courses = rows_('courses').sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); }).map(function (c) {
    var students = [];
    var inactive = 0;
    var teachers = [];
    users.forEach(function (u) {
      if (courseIds_(u).indexOf(c.id) < 0) return;
      if (u.role === 'teacher') { teachers.push(u.fullName); return; }
      if (u.role !== 'student') return;
      if (!isActive_(u)) { inactive++; return; }
      active[u.username] = true;
      var f = paid[c.id + '|' + u.username];
      students.push({ username: u.username, fullName: u.fullName, paid: !!f, paidAt: f ? f.paidAt : '', note: f ? f.note : '' });
    });
    Object.keys(paid).forEach(function (k) {
      var f = paid[k];
      if (f.courseId !== c.id || students.some(function (s) { return s.username === f.username; })) return;
      var u = byName[f.username];
      students.push({ username: f.username, fullName: u ? u.fullName : f.username, paid: true, paidAt: f.paidAt, note: f.note, left: true });
    });
    students.sort(function (a, b) { return a.fullName.localeCompare(b.fullName, 'vi'); });
    return { id: c.id, name: c.name, grade: c.grade, teachers: teachers, inactive: inactive, students: students };
  });
  return { month: month, today: thisMonth_(), courses: courses, activeStudents: Object.keys(active).length };
}

/** Số lượt đã đóng / phải đóng trong tháng (cho trang chủ admin). */
function feeSummary_(month) {
  var b = feeBoard_(month);
  var total = 0;
  var paid = 0;
  b.courses.forEach(function (c) {
    c.students.forEach(function (s) { if (!s.left) { total++; if (s.paid) paid++; } });
  });
  return { month: month, total: total, paid: paid, activeStudents: b.activeStudents };
}

/** Học phí tháng này của chính học sinh, theo từng lớp em đang học. */
function myFees_(me, courses) {
  var month = thisMonth_();
  var mine = {};
  rows_('fees').forEach(function (f) { if (f.username === me.username && f.month === month) mine[f.courseId] = f; });
  return courseIds_(me).filter(function (id) { return courses[id]; }).map(function (id) {
    var c = courses[id];
    return { courseId: id, courseName: c.name, courseGrade: c.grade, month: month, paid: !!mine[id], paidAt: mine[id] ? mine[id].paidAt : '' };
  });
}

/** Admin đánh dấu đã đóng / bỏ đánh dấu cho một học sinh, một lớp, một tháng. */
function setFee_(me, p) {
  var month = checkMonth_(String(p.month || ''));
  var courseId = String(p.courseId || '');
  if (!findCourse_(courseId)) throw err_('Khóa học không tồn tại.', 404);
  var u = findUser_(String(p.username || ''));
  if (!u) throw err_('Không tìm thấy tài khoản.', 404);
  var row = rows_('fees').filter(function (f) { return f.username === u.username && f.courseId === courseId && f.month === month; })[0];
  if (p.paid && u.role !== 'student') throw err_('Chỉ ghi học phí cho tài khoản học sinh.');
  if (p.paid) {
    var note = clean_(p.note, 200);
    if (row) {
      if (p.note !== undefined) update_('fees', row, { note: note });
      row = rows_('fees').filter(function (f) { return f.username === u.username && f.courseId === courseId && f.month === month; })[0];
    } else {
      row = { username: u.username, courseId: courseId, month: month, paidAt: new Date().toISOString(), markedBy: me.username, note: note };
      append_('fees', row);
    }
    return { fee: { username: u.username, courseId: courseId, month: month, paid: true, paidAt: row.paidAt, note: row.note } };
  }
  if (row) delete_('fees', row);
  return { fee: { username: u.username, courseId: courseId, month: month, paid: false, paidAt: '', note: '' } };
}

/**
 * Nhiều thay đổi học phí trong MỘT lần gọi (admin bấm liên tục nhiều em):
 * p.month, p.changes = [{username, courseId, paid, note?}]. Đọc bảng một lần, ghi gộp.
 * Trả results theo đúng thứ tự: {fee} hoặc {error} cho từng thay đổi.
 */
function setFees_(me, p) {
  var month = checkMonth_(String(p.month || ''));
  var list = Array.isArray(p.changes) ? p.changes.slice(0, 500) : [];
  var courses = {};
  rows_('courses').forEach(function (c) { courses[c.id] = c; });
  var users = {};
  rows_('users').forEach(function (u) { users[u.username.toLowerCase()] = u; });
  var existing = {};
  rows_('fees').forEach(function (f) { if (f.month === month) existing[f.username + '|' + f.courseId] = f; });

  // Thay đổi sau cùng cho cùng một ô (học sinh + lớp) là thay đổi có hiệu lực.
  var last = {};
  var results = list.map(function (ch, i) {
    var courseId = String(ch && ch.courseId || '');
    var u = users[String(ch && ch.username || '').toLowerCase()];
    if (!courses[courseId]) return { error: 'Khóa học không tồn tại.' };
    if (!u) return { error: 'Không tìm thấy tài khoản.' };
    if (ch.paid && u.role !== 'student') return { error: 'Chỉ ghi học phí cho tài khoản học sinh.' };
    last[u.username + '|' + courseId] = i;
    return { key: u.username + '|' + courseId, username: u.username, courseId: courseId };
  });

  var now = new Date().toISOString();
  var updates = [];
  var deletes = [];
  var appends = [];
  Object.keys(last).forEach(function (key) {
    var i = last[key];
    var ch = list[i];
    var r = results[i];
    var row = existing[key];
    if (ch.paid) {
      var note = clean_(ch.note, 200);
      if (row) {
        if (ch.note !== undefined && note !== row.note) updates.push({ row: row, note: note });
        r.fee = { paid: true, paidAt: row.paidAt, note: ch.note !== undefined ? note : row.note };
      } else {
        appends.push({ username: r.username, courseId: r.courseId, month: month, paidAt: now, markedBy: me.username, note: note });
        r.fee = { paid: true, paidAt: now, note: note };
      }
    } else {
      if (row) deletes.push(row);
      r.fee = { paid: false, paidAt: '', note: '' };
    }
  });

  var sh = sheet_('fees');
  var cols = COLUMNS.fees;
  updates.forEach(function (x) { update_('fees', x.row, { note: x.note }); });
  deletes.sort(function (a, b) { return b._row - a._row; }).forEach(function (row) { sh.deleteRow(row._row); });
  if (appends.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, cols.length).setValues(appends.map(function (o) {
      return cols.map(function (c) { return o[c] === undefined ? '' : String(o[c]); });
    }));
  }
  dirty_('fees');

  return {
    month: month,
    results: results.map(function (r, i) {
      if (r.error) return { error: r.error };
      // Thay đổi bị thay đổi sau ghi đè: trả trạng thái cuối cùng.
      var f = results[last[r.key]].fee;
      return { fee: { username: r.username, courseId: r.courseId, month: month, paid: f.paid, paidAt: f.paidAt, note: f.note } };
    })
  };
}

/* ───────────────────────── Tài liệu ───────────────────────── */

function upload_(me, p) {
  var courseId = String(p.courseId || '');
  requireEdit_(me, courseId);
  var c = findCourse_(courseId);
  var title = clean_(p.title, 200);
  if (!title) throw err_('Vui lòng nhập tiêu đề tài liệu.');

  var doc = {
    id: Utilities.getUuid(),
    courseId: courseId,
    topic: clean_(p.topic, 100),
    branch: itemBranch_(c, p),
    title: title,
    description: clean_(p.description, 2000),
    uploadedBy: me.username,
    uploadedAt: new Date().toISOString(),
    free: p.free ? '1' : ''
  };

  var createdFileId = '';
  if (p.url) {
    doc.type = 'link';
    doc.url = checkUrl_(p.url);
  } else {
    var f = saveUpload_(courseFolder_(courseId), p.data, p.fileName, p.mimeType, '');
    createdFileId = f.fileId;
    doc.type = 'file';
    doc.fileId = f.fileId;
    doc.fileName = f.name;
    doc.mimeType = f.mimeType;
    doc.size = String(f.size);
  }

  try {
    return withLock_(function () {
      requireEdit_(me, courseId);
      var cNow = findCourse_(courseId);
      doc.branch = itemBranch_(cNow, p);
      append_('docs', doc);
      return { doc: publicDoc_(doc, userNames_(), cNow) };
    });
  } catch (e) {
    if (createdFileId) trash_(createdFileId);
    throw e;
  }
}

function updateDoc_(me, p) {
  var d = findBy_('docs', String(p.id || ''));
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  requireEdit_(me, d.courseId);
  var c = findCourse_(d.courseId);
  var title = p.title !== undefined ? clean_(p.title, 200) : d.title;
  if (!title) throw err_('Vui lòng nhập tiêu đề tài liệu.');
  update_('docs', d, {
    title: title,
    description: p.description !== undefined ? clean_(p.description, 2000) : d.description,
    topic: p.topic !== undefined ? clean_(p.topic, 100) : d.topic,
    branch: p.branch !== undefined ? itemBranch_(c, p) : d.branch,
    free: p.free !== undefined ? (p.free ? '1' : '') : (d.free || '')
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

function freeFile_(docId) {
  var d = findBy_('docs', docId);
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  if (d.free !== '1') throw err_('Tài liệu này dành cho học sinh của lớp. Vui lòng đăng nhập để xem.', 403);
  if (d.type !== 'file') throw err_('Tài liệu này là đường link, không phải file.');
  return fileData_(d.fileId, d.fileName, d.mimeType);
}

/** Mục lục công khai: mọi khóa học, từng nhánh, tên chủ đề và tên từng tài liệu/luyện tập. */
function catalog_() {
  var docs = rows_('docs');
  var quizzes = rows_('quizzes', LITE_COLS.quizzes);
  return rows_('courses')
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (c) {
      var inCourse = function (r) { return r.courseId === c.id; };
      var cDocs = docs.filter(inCourse);
      var cQuizzes = quizzes.filter(function (q) { return q.courseId === c.id && q.gameOnly !== '1'; });
      var items = [];
      cDocs.forEach(function (d) {
        var isFree = d.free === '1';
        var it = {
          kind: 'doc',
          branch: itemBranch_(c, d),
          topic: d.topic || '',
          title: d.title,
          free: isFree,
          _time: d.uploadedAt || ''
        };
        if (isFree) {
          it.id = d.id;
          it.type = d.type;
          it.fileName = d.fileName || '';
          it.mimeType = d.mimeType || '';
          if (d.type === 'link') it.url = d.url || '';
        }
        items.push(it);
      });
      cQuizzes.forEach(function (q) {
        items.push({
          kind: 'quiz',
          branch: itemBranch_(c, q),
          topic: q.topic || '',
          title: q.title,
          free: false,
          _time: q.createdAt || ''
        });
      });
      items.sort(function (a, b) { return a._time < b._time ? 1 : (a._time > b._time ? -1 : 0); });
      items.forEach(function (it) { delete it._time; });
      return {
        id: c.id,
        name: c.name,
        grade: c.grade,
        branches: branchesOf_(c),
        items: items
      };
    });
}

/** Kho tài liệu miễn phí: gom mọi tài liệu free === '1' theo khóa còn tồn tại, mới nhất trước. */
function freeDocs_() {
  var courseMap = {};
  rows_('courses').forEach(function (c) { courseMap[c.id] = c; });
  return rows_('docs')
    .filter(function (d) { return d.free === '1' && courseMap[d.courseId]; })
    .sort(function (a, b) { return a.uploadedAt < b.uploadedAt ? 1 : (a.uploadedAt > b.uploadedAt ? -1 : 0); })
    .map(function (d) {
      var c = courseMap[d.courseId];
      var o = publicDoc_(d, null, c);
      delete o.uploadedBy;
      o.courseName = c.name;
      o.courseGrade = c.grade;
      return o;
    });
}

/* ───────────────────────── Bài tập về nhà ───────────────────────── */

/** Kiểm tra khi sửa bài tập đã có bài nộp: chặn đổi số lượng câu hoặc đổi loại câu ở bất kỳ vị trí nào. */
function checkAssignmentStructure_(a, questions) {
  var subs = rows_('submissions').filter(function (s) { return s.assignmentId === a.id; });
  var oldQuestions = parseQuestions_(a);
  if (subs.length) {
    if (oldQuestions.length !== questions.length) {
      throw err_('Đã có học sinh nộp bài nên không thể thêm/bớt câu hỏi. Bạn chỉ sửa được nội dung, đáp án, điểm; hoặc tạo bài tập mới.');
    }
    for (var i = 0; i < questions.length; i++) {
      if (oldQuestions[i].type !== questions[i].type) {
        throw err_('Đã có học sinh nộp bài nên không thể đổi loại câu hỏi (Câu ' + (i + 1) + '). Bạn chỉ sửa được nội dung, đáp án, điểm; hoặc tạo bài tập mới.');
      }
    }
  }
  return { subs: subs, oldQuestions: oldQuestions };
}

/** Có câu không phải tự luận nào thay đổi đáp án hoặc điểm số không. */
function hasGradingChange_(oldQuestions, questions) {
  return questions.some(function (q, i) {
    if (q.type === 'essay') return false;
    var oq = oldQuestions[i];
    if (!oq) return true;
    if (Number(oq.points || 1) !== Number(q.points || 1)) return true;
    if (q.type === 'mc') return Number(oq.correct) !== Number(q.correct);
    return JSON.stringify(oq.answers || []) !== JSON.stringify(q.answers || []);
  });
}

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
  var qJson = questions.length ? JSON.stringify(questions) : '';
  if (qJson.length > 48000) throw err_('Đề quá dài. Hãy tách thành nhiều bài tập.');
  var maxScore = questions.length
    ? sumPoints_(questions)
    : Number(p.maxScore === undefined || p.maxScore === '' ? 10 : p.maxScore);
  if (!(maxScore > 0 && maxScore <= 1000)) throw err_('Thang điểm phải từ 1 đến 1000.');
  if (a) checkAssignmentStructure_(a, questions);
  var dueAt = '';
  if (p.dueAt) {
    var dt = new Date(String(p.dueAt));
    if (isNaN(dt.getTime())) throw err_('Hạn nộp không hợp lệ.');
    dueAt = dt.toISOString();
  }

  // Tạo file trên Drive ngoài khóa; nếu bước ghi Sheets lỗi thì dọn vào thùng rác.
  var createdIds = [];
  var toTrashIds = [];
  var imagesJson = '';
  var uploadedFile = null;
  try {
    imagesJson = saveImages_(courseId, a ? a.images : '', questions, p.newImages, createdIds, toTrashIds);
    if (p.data) {
      uploadedFile = saveUpload_(courseFolder_(courseId), p.data, p.fileName, p.mimeType, 'De bai - ');
      createdIds.push(uploadedFile.fileId);
    }
  } catch (e) {
    createdIds.forEach(trash_);
    throw e;
  }

  try {
    var res = withLock_(function () {
      var curA = null;
      if (!isNew) {
        curA = findBy_('assignments', String(p.id || ''));
        if (!curA) throw err_('Không tìm thấy bài tập.', 404);
        courseId = curA.courseId;
      }
      requireEdit_(me, courseId);
      var check = curA ? checkAssignmentStructure_(curA, questions) : null;
      var c = findCourse_(courseId);
      var data = {
        courseId: courseId,
        topic: clean_(p.topic, 100),
        branch: itemBranch_(c, p),
        title: title,
        instructions: clean_(p.instructions, 5000),
        dueAt: dueAt,
        maxScore: String(maxScore),
        source: questions.length ? String(p.source || '').slice(0, 45000) : '',
        questions: qJson,
        images: imagesJson
      };
      if (uploadedFile) {
        if (curA && curA.fileId) toTrashIds.push(curA.fileId);
        data.fileId = uploadedFile.fileId;
        data.fileName = uploadedFile.name;
        data.mimeType = uploadedFile.mimeType;
        data.size = String(uploadedFile.size);
      } else if (p.removeFile && curA && curA.fileId) {
        toTrashIds.push(curA.fileId);
        data.fileId = data.fileName = data.mimeType = data.size = '';
      }

      if (isNew) {
        data.id = Utilities.getUuid();
        data.createdBy = me.username;
        data.createdAt = new Date().toISOString();
        append_('assignments', data);
        return { assignment: publicAssignment_(data, userNames_(), c), regraded: 0, skippedReturned: 0 };
      }

      update_('assignments', curA, data);
      var regraded = 0;
      var skippedReturned = 0;
      // Chấm lại phần máy chấm cho các bài chưa chốt điểm khi đáp án / điểm câu thay đổi.
      if (questions.length && check.subs.length && hasGradingChange_(check.oldQuestions, questions)) {
        check.subs.forEach(function (s) {
          if (s.status === 'returned') {
            skippedReturned++;
            return;
          }
          var ans = parseJson_(s.answers, []);
          var oldScores = parseJson_(s.itemScores, []);
          var autoScore = 0;
          var newScores = questions.map(function (q, i) {
            if (q.type === 'essay') return oldScores[i] !== undefined ? oldScores[i] : null;
            var oq = check.oldQuestions[i];
            var oldAuto = isCorrect_(oq, ans[i]) ? Number(oq.points || 1) : 0;
            var hasOld = oldScores[i] !== null && oldScores[i] !== undefined;
            // Giữ điểm câu giáo viên đã sửa tay (itemScores[i] cũ khác điểm máy chấm theo đề cũ).
            var pts = (hasOld && Number(oldScores[i]) !== oldAuto)
              ? Number(oldScores[i])
              : (isCorrect_(q, ans[i]) ? Number(q.points || 1) : 0);
            autoScore += pts;
            return pts;
          });
          autoScore = Math.round(autoScore * 100) / 100;
          update_('submissions', s, {
            itemScores: JSON.stringify(newScores),
            autoScore: String(autoScore)
          });
          regraded++;
        });
      }
      return {
        assignment: publicAssignment_(findBy_('assignments', curA.id), userNames_(), c),
        regraded: regraded,
        skippedReturned: skippedReturned
      };
    });
    toTrashIds.forEach(trash_);
    return res;
  } catch (e) {
    createdIds.forEach(trash_);
    throw e;
  }
}

function deleteAssignment_(me, id) {
  var a = findBy_('assignments', id);
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  requireEdit_(me, a.courseId);
  var subs = rows_('submissions').filter(function (s) { return s.assignmentId === id; });
  for (var i = subs.length - 1; i >= 0; i--) {
    parseFiles_(subs[i].files).forEach(function (f) { trash_(f.fileId); });
    sheet_('submissions').deleteRow(subs[i]._row);
    dirty_('submissions');
  }
  trash_(a.fileId);
  trashImages_(a.images);
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
    assignment: publicAssignment_(a, names, c),
    branch: itemBranch_(c, a),
    course: { id: c.id, name: c.name, grade: c.grade, branches: branchesOf_(c) },
    canEdit: edit,
    canSubmit: isStudentIn_(me, a.courseId),
    // Học sinh chỉ nhận đề, không nhận đáp án.
    questions: questions.map(function (x) { return { type: x.type, text: x.text, options: x.options || null, points: x.points, image: x.image || null }; })
  };
  if (edit) {
    out.fullQuestions = questions;
    out.source = a.source || '';
    var seen = {};
    var list = studentsOf_(a.courseId).map(function (u) {
      seen[u.username] = 1;
      var s = subs.filter(function (x) { return x.username === u.username; })[0];
      return { username: u.username, fullName: u.fullName, submission: s ? withAuto_(withAi_(publicSubmission_(s, names), s), s, questions) : null };
    });
    subs.forEach(function (s) {
      if (!seen[s.username]) list.push({ username: s.username, fullName: names[s.username] || s.username, submission: withAuto_(withAi_(publicSubmission_(s, names), s), s, questions), left: true });
    });
    list.sort(function (x, y) { return x.fullName.localeCompare(y.fullName, 'vi'); });
    out.students = list;
  } else {
    var mine = subs.filter(function (s) { return s.username === me.username; })[0];
    out.submission = mine ? forStudent_(publicSubmission_(mine, names)) : null;
    if (mine && questions.length) {
      // Có hạn nộp: hiện đáp án khi bài đã chốt điểm VÀ quá hạn nộp.
      // Không có hạn nộp: chỉ hiện khi mọi học sinh đang hoạt động của khóa đều đã có bài nộp ở trạng thái returned.
      var returnedBy = {};
      subs.forEach(function (s) { if (s.status === 'returned') returnedBy[s.username] = 1; });
      out.reveal = mine.status === 'returned' && (a.dueAt
        ? Date.now() > new Date(a.dueAt).getTime()
        : studentsOf_(a.courseId).every(function (u) { return !!returnedBy[u.username]; }));
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
  var assignmentId = String(p.assignmentId || '');
  var a = findBy_('assignments', assignmentId);
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  if (!isStudentIn_(me, a.courseId)) throw err_('Chỉ học sinh của khóa này mới nộp bài được.', 403);
  var existing = rows_('submissions').filter(function (s) { return s.assignmentId === a.id && s.username === me.username; })[0];
  if (existing && existing.status === 'returned') {
    throw err_('Bài đã được chốt điểm nên không nộp lại được. Hãy nhắn giáo viên nếu cần sửa.');
  }
  // Chưa chốt điểm thì nộp lại / nộp bổ sung được, kể cả sau hạn (khi đó bài ghi là nộp muộn).

  var questions = parseQuestions_(a);
  var keep = Array.isArray(p.keepFileIds) ? p.keepFileIds.map(String) : [];
  var oldFiles = existing ? parseFiles_(existing.files) : [];
  var keptPre = oldFiles.filter(function (f) { return keep.indexOf(f.fileId) >= 0; });
  var incoming = Array.isArray(p.files) ? p.files : [];
  if (keptPre.length + incoming.length > MAX_SUBMIT_FILES) throw err_('Chỉ nộp tối đa ' + MAX_SUBMIT_FILES + ' file mỗi lần.');
  var text = clean_(p.text, 5000);
  var raw = Array.isArray(p.answers) ? p.answers : [];
  if (questions.length) {
    var hasAnsPre = questions.some(function (_, i) { var v = raw[i]; return v !== null && v !== undefined && v !== ''; });
    if (!hasAnsPre && !keptPre.length && !incoming.length && !text) {
      throw err_('Em chưa trả lời câu nào.');
    }
  } else if (!text && !keptPre.length && !incoming.length) {
    throw err_('Hãy đính kèm ảnh/file bài làm hoặc viết câu trả lời.');
  }

  var total = 0;
  incoming.forEach(function (f) { total += Math.floor(String(f.data || '').length * 3 / 4); });
  if (total > MAX_UPLOAD_BYTES) throw err_('Tổng dung lượng file quá lớn (tối đa 20 MB). Hãy chụp ảnh nhỏ hơn hoặc bớt file.');

  // Tải file lên Drive ngoài khóa; nếu bước sau lỗi thì xóa các file vừa tạo.
  var createdIds = [];
  var uploaded = [];
  try {
    if (incoming.length) {
      var folder = submissionsFolder_(a.courseId);
      incoming.forEach(function (f) {
        var q = f.q === undefined || f.q === null || f.q === '' ? null : Number(f.q);
        if (q !== null && !(questions[q] && questions[q].type === 'essay')) q = null;
        var saved = saveUpload_(folder, f.data, f.name, f.mimeType, me.username + (q !== null ? ' - Cau ' + (q + 1) : '') + ' - ');
        createdIds.push(saved.fileId);
        saved.q = q;
        uploaded.push(saved);
      });
    }
  } catch (e) {
    createdIds.forEach(trash_);
    throw e;
  }

  var toTrashIds = [];
  try {
    var res = withLock_(function () {
      var curA = findBy_('assignments', assignmentId);
      if (!curA) throw err_('Không tìm thấy bài tập.', 404);
      if (!isStudentIn_(me, curA.courseId)) throw err_('Chỉ học sinh của khóa này mới nộp bài được.', 403);
      var curExisting = rows_('submissions').filter(function (s) { return s.assignmentId === curA.id && s.username === me.username; })[0];
      if (curExisting && curExisting.status === 'returned') {
        throw err_('Bài đã được chốt điểm nên không nộp lại được. Hãy nhắn giáo viên nếu cần sửa.');
      }

      var curQuestions = parseQuestions_(curA);
      var curOldFiles = curExisting ? parseFiles_(curExisting.files) : [];
      var files = curOldFiles.filter(function (f) { return keep.indexOf(f.fileId) >= 0; });
      if (files.length + uploaded.length > MAX_SUBMIT_FILES) throw err_('Chỉ nộp tối đa ' + MAX_SUBMIT_FILES + ' file mỗi lần.');
      uploaded.forEach(function (saved) {
        var q = saved.q;
        if (q !== null && !(curQuestions[q] && curQuestions[q].type === 'essay')) q = null;
        files.push({ fileId: saved.fileId, name: saved.name, mimeType: saved.mimeType, size: saved.size, q: q });
      });

      var answers = [];
      var itemScores = [];
      var autoScore = 0;
      if (curQuestions.length) {
        answers = curQuestions.map(function (x, i) {
          var v = raw[i];
          if (v === null || v === undefined || v === '') return null;
          return x.type === 'mc' ? Number(v) : clean_(v, x.type === 'essay' ? 5000 : 200);
        });
        itemScores = curQuestions.map(function (x, i) {
          if (x.type === 'essay') return null;
          var pts = isCorrect_(x, answers[i]) ? Number(x.points || 1) : 0;
          autoScore += pts;
          return pts;
        });
        autoScore = Math.round(autoScore * 100) / 100;
        if (!answers.some(function (v) { return v !== null; }) && !files.length && !text) {
          throw err_('Em chưa trả lời câu nào.');
        }
      } else if (!text && !files.length) {
        throw err_('Hãy đính kèm ảnh/file bài làm hoặc viết câu trả lời.');
      }

      curOldFiles.forEach(function (f) { if (keep.indexOf(f.fileId) < 0) toTrashIds.push(f.fileId); });

      var now = new Date();
      // Máy chấm ngay phần trắc nghiệm/trả lời ngắn nhưng KHÔNG công bố: bài luôn chờ giáo viên chốt điểm
      // (máy có thể chấm sai cách viết đúng mà đáp án chưa liệt kê).
      var data = {
        assignmentId: curA.id,
        courseId: curA.courseId,
        username: me.username,
        text: text,
        files: JSON.stringify(files),
        submittedAt: now.toISOString(),
        // Giáo viên cho nộp lại sau hạn: giữ nguyên dấu đúng hạn/muộn của lần nộp trước.
        late: curExisting && curExisting.status === 'reopened' ? curExisting.late
          : curA.dueAt && now.getTime() > new Date(curA.dueAt).getTime() ? '1' : '0',
        status: 'submitted',
        score: '',
        feedback: curExisting ? curExisting.feedback : '',
        gradedBy: '',
        gradedAt: '',
        answers: curQuestions.length ? JSON.stringify(answers) : '',
        itemScores: curQuestions.length ? JSON.stringify(itemScores) : '',
        autoScore: curQuestions.length ? String(autoScore) : '',
        aiSuggest: ''
      };
      if (curExisting) {
        update_('submissions', curExisting, data);
        data.id = curExisting.id;
      } else {
        data.id = Utilities.getUuid();
        append_('submissions', data);
      }
      var out = { submission: forStudent_(publicSubmission_(data, userNames_())) };
      if (curQuestions.length) {
        out.reveal = false;
        out.review = reviewHomework_(curQuestions, data, out.reveal);
      }
      return out;
    });
    toTrashIds.forEach(trash_);
    return res;
  } catch (e) {
    createdIds.forEach(trash_);
    throw e;
  }
}

/** Từng câu: học sinh trả lời gì, được mấy điểm; kèm đáp án/lời giải khi reveal. */
function reviewHomework_(questions, s, reveal) {
  var answers = parseJson_(s.answers, []);
  var scores = parseJson_(s.itemScores, []);
  return questions.map(function (x, i) {
    var done = s.status === 'returned';
    var r = {
      type: x.type, text: x.text, options: x.options || null, points: Number(x.points || 1), image: x.image || null,
      answer: answers[i] === undefined ? null : answers[i],
      // Đúng/sai và điểm từng câu chỉ hiện khi bài đã chấm xong (tránh dò đáp án rồi nộp lại).
      earned: done && scores[i] !== undefined ? scores[i] : null
    };
    // Theo điểm giáo viên đã chốt (thầy có thể sửa điểm khi máy chấm sai).
    if (x.type !== 'essay' && done) r.correct = r.earned !== null ? Number(r.earned) >= Number(x.points || 1) : isCorrect_(x, answers[i]);
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
  var questions = parseQuestions_(a);
  if (p.reopen) {
    // 'reopened': học sinh được sửa và nộp lại kể cả khi đã quá hạn.
    update_('submissions', s, { status: 'reopened', score: '', gradedBy: '', gradedAt: '' });
    var s1 = findBy_('submissions', s.id);
    return { submission: withAuto_(withAi_(publicSubmission_(s1, userNames_()), s1), s1, questions) };
  }
  var changes = {
    status: 'returned',
    feedback: clean_(p.feedback, 3000),
    gradedBy: me.username,
    gradedAt: new Date().toISOString()
  };
  if (questions.length && s.itemScores) {
    // Bài có câu hỏi: máy đã chấm trắc nghiệm/trả lời ngắn; giáo viên chấm tự luận và có thể sửa điểm máy chấm.
    // p.scores: điểm từng câu (mọi loại); p.essayScores: kiểu cũ, chỉ câu tự luận.
    var items = parseJson_(s.itemScores, []);
    var given = p.scores || p.essayScores || {};
    questions.forEach(function (x, i) {
      var has = given[i] !== undefined && given[i] !== null;
      if (x.type !== 'essay' && !has) return; // giữ điểm máy chấm
      var v = String(has ? given[i] : '').replace(',', '.').trim();
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
  var s2 = findBy_('submissions', s.id);
  return { submission: withAuto_(withAi_(publicSubmission_(s2, userNames_()), s2), s2, questions) };
}

/**
 * Chốt điểm một loạt bài cùng lúc (bài chỉ có trắc nghiệm/trả lời ngắn): điểm = điểm máy chấm hiện có.
 * Bài có câu tự luận chưa chấm thì bỏ qua. p.ids: danh sách submissionId (bỏ trống = mọi bài đang chờ).
 */
function finalizeAll_(me, p) {
  var a = findBy_('assignments', String(p.assignmentId || ''));
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  requireEdit_(me, a.courseId);
  var questions = parseQuestions_(a);
  if (!questions.length) throw err_('Bài tập không có câu hỏi nên không chốt tự động được.');
  var ids = Array.isArray(p.ids) ? p.ids.map(String) : null;
  var now = new Date().toISOString();
  var done = [];
  var skipped = 0;
  rows_('submissions').filter(function (s) {
    return s.assignmentId === a.id && s.status === 'submitted' && (!ids || ids.indexOf(s.id) >= 0);
  }).forEach(function (s) {
    var items = parseJson_(s.itemScores, []);
    var ready = questions.every(function (x, i) { return items[i] !== null && items[i] !== undefined; });
    if (!ready) { skipped++; return; }
    update_('submissions', s, {
      status: 'returned',
      score: String(Math.round(items.reduce(function (t, v) { return t + Number(v || 0); }, 0) * 100) / 100),
      gradedBy: me.username,
      gradedAt: now
    });
    done.push(s.id);
  });
  return { finalized: done, skipped: skipped };
}

/** Giáo viên: máy chấm từng câu đúng/sai thế nào (để biết câu nào thầy đã sửa điểm). */
function withAuto_(pub, row, questions) {
  if (!questions || !questions.length || !row.answers) return pub;
  var answers = parseJson_(row.answers, []);
  pub.auto = questions.map(function (x, i) { return x.type === 'essay' ? null : isCorrect_(x, answers[i]) ? Number(x.points || 1) : 0; });
  return pub;
}

/* ───────────────────────── Gemini gợi ý điểm ─────────────────────────
 * Giáo viên bấm nút trong màn chấm → máy chủ gửi đề, hướng dẫn chấm và ảnh bài làm
 * cho Gemini, nhận lại điểm gợi ý + nhận xét từng câu tự luận. KHÔNG tự lưu điểm:
 * gợi ý chỉ điền sẵn vào ô, giáo viên duyệt rồi bấm Lưu điểm như bình thường.
 * Không gửi tên học sinh. Khóa API để trong Script Property GEMINI_API_KEY.
 */
// gemini-flash-latest (= 3.8-flash, 21/10/2026) trả lời rất chậm: 40–145 giây cho một câu chào; 3.6-flash chỉ ~2 giây.
var GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';
var AI_FILE_MAX = 7 * 1024 * 1024;   // mỗi ảnh/file gửi Gemini
var AI_TOTAL_MAX = 16 * 1024 * 1024; // tổng một lần gọi (giới hạn của Gemini khoảng 20 MB)
var AI_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

/** Gợi ý của Gemini chỉ gắn vào bài nộp khi trả cho giáo viên (học sinh không bao giờ nhận). */
function withAi_(pub, row) {
  pub.ai = parseJson_(row && row.aiSuggest, null);
  return pub;
}

function aiGrade_(me, submissionId) {
  var s = findBy_('submissions', submissionId);
  if (!s) throw err_('Không tìm thấy bài nộp.', 404);
  requireEdit_(me, s.courseId);
  var a = findBy_('assignments', s.assignmentId);
  if (!a) throw err_('Không tìm thấy bài tập.', 404);
  var c = findCourse_(a.courseId) || {};
  var questions = parseQuestions_(a);
  var answers = parseJson_(s.answers, []);
  var files = parseFiles_(s.files);
  var budget = { left: AI_TOTAL_MAX, skipped: [] };
  var parts = [];
  var targets = []; // [{q: chỉ số câu (null = cả bài), max: điểm tối đa}]

  parts.push({ text: 'Môn/lớp: ' + (c.name || '') + ' – ' + (c.grade || 'tiểu học') +
    '\nBài tập: ' + a.title + (a.instructions ? '\nYêu cầu chung của giáo viên: ' + a.instructions : '') });

  if (questions.length) {
    var essays = questions.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.type === 'essay'; });
    if (!essays.length) throw err_('Bài này không có câu tự luận – máy đã chấm hết.');
    var imgs = parseJson_(a.images, {});
    essays.forEach(function (o) {
      var x = o.x, i = o.i;
      targets.push({ q: i, max: Number(x.points || 1) });
      parts.push({ text: '\n### CÂU ' + (i + 1) + ' (tối đa ' + x.points + ' điểm)\nĐề: ' + x.text +
        '\nĐáp án / hướng dẫn chấm của giáo viên: ' + (x.explain || '(không có – hãy tự giải cẩn thận rồi chấm)') +
        (answers[i] ? '\nHọc sinh gõ câu trả lời: ' + answers[i] : '') });
      if (x.image && imgs[x.image]) addAiFile_(parts, budget, imgs[x.image], 'image/jpeg', 'Hình trong đề câu ' + (i + 1));
      var photos = files.filter(function (f) { return f.q === i; });
      var lost = 0;
      photos.forEach(function (f, k) { if (!addAiFile_(parts, budget, f.fileId, f.mimeType, 'Bài làm câu ' + (i + 1) + (photos.length > 1 ? ' (ảnh ' + (k + 1) + ')' : ''), f.name)) lost++; });
      if (lost) parts.push({ text: '(Học sinh có ' + lost + ' ảnh bài làm câu ' + (i + 1) + ' nhưng không gửi được cho bạn – KHÔNG coi là bỏ trống; chấm phần thấy được và đặt "unsure": true.)' });
      if (!answers[i] && !photos.length) parts.push({ text: '(Không có ảnh riêng cho câu ' + (i + 1) + ' – có thể nằm trong ảnh bài làm chung bên dưới, nếu không thấy thì coi là bỏ trống.)' });
    });
    var general = files.filter(function (f) { return f.q === null || f.q === undefined; });
    if (general.length) {
      parts.push({ text: '\n### ẢNH BÀI LÀM CHUNG (có thể chứa lời giải của nhiều câu – tự tìm phần của từng câu tự luận ở trên)' });
      general.forEach(function (f, k) { addAiFile_(parts, budget, f.fileId, f.mimeType, 'Ảnh chung ' + (k + 1), f.name); });
    }
  } else {
    var max = Number(a.maxScore || 10);
    targets.push({ q: null, max: max });
    parts.push({ text: '\nChấm CẢ BÀI theo thang ' + max + ' điểm (mục "q" trong kết quả để null).' });
    if (a.fileId) addAiFile_(parts, budget, a.fileId, a.mimeType, 'ĐỀ BÀI (file của giáo viên)', a.fileName);
    if (s.text) parts.push({ text: 'Học sinh viết: ' + s.text });
    files.forEach(function (f, k) { addAiFile_(parts, budget, f.fileId, f.mimeType, 'Bài làm của học sinh (file ' + (k + 1) + ')', f.name); });
    if (!s.text && !files.length) throw err_('Bài nộp trống.');
  }
  if (budget.skipped.length) parts.push({ text: '(Có ' + budget.skipped.length + ' file không gửi được vì quá lớn hoặc không phải ảnh/PDF.)' });

  var sys = 'Bạn là giáo viên tiểu học Việt Nam đang chấm bài tự luận của học sinh. ' +
    'Đọc kỹ chữ viết tay trong ảnh. Chấm theo đáp án/hướng dẫn chấm của giáo viên; cho điểm từng phần hợp lý, điểm là bội số của 0,25, không vượt điểm tối đa của câu. ' +
    'Học sinh làm cách khác nhưng đúng vẫn cho điểm. Không đọc được chữ, ảnh mờ hoặc không chắc chắn thì đặt "unsure": true và nói rõ trong "reason". ' +
    'Chỉ trả về JSON đúng dạng: {"items":[{"q":<số thứ tự câu như trong đề, ví dụ 3>,"score":<số>,"reason":"<1 câu ngắn cho giáo viên: vì sao cho điểm này, sai ở đâu>","comment":"<1–2 câu nhận xét gửi học sinh: xưng em, nhẹ nhàng, khen phần làm đúng, chỉ rõ chỗ cần sửa, không nêu điểm số>","unsure":<true|false>}],' +
    '"feedback":"<1–2 câu nhận xét chung gửi học sinh>"}. Mỗi câu tự luận đúng một mục trong items.';

  var res = callGemini_(sys, parts);
  var byQ = {};
  (Array.isArray(res.items) ? res.items : []).forEach(function (it) {
    var q = it && it.q !== null && it.q !== undefined && it.q !== '' ? Number(it.q) - 1 : null;
    byQ[q === null || isNaN(q) ? 'all' : q] = it;
  });
  var items = targets.map(function (t) {
    var it = byQ[t.q === null ? 'all' : t.q] || (targets.length === 1 ? (res.items || [])[0] : null);
    if (!it) return { q: t.q, score: null, reason: 'Gemini không trả lời câu này.', comment: '', unsure: true };
    var n = Number(String(it.score).replace(',', '.'));
    n = isNaN(n) ? null : Math.max(0, Math.min(t.max, Math.round(n * 4) / 4));
    return { q: t.q, score: n, reason: clean_(it.reason, 400), comment: clean_(it.comment, 400), unsure: !!it.unsure || n === null };
  });
  var out = { items: items, feedback: clean_(res.feedback, 600), model: res._model, secs: res._secs, at: new Date().toISOString(), skipped: budget.skipped.length };

  // Lưu lại để mở lại màn chấm vẫn thấy (khóa chỉ giữ lúc ghi, không giữ trong lúc chờ Gemini).
  withLock_(function () {
    var cur = findBy_('submissions', s.id);
    if (cur && cur.submittedAt === s.submittedAt) update_('submissions', cur, { aiSuggest: JSON.stringify(out) });
  });
  return { ai: out };
}

function addAiFile_(parts, budget, fileId, mimeType, label, name) {
  var mt = String(mimeType || '').toLowerCase();
  if (mt === 'image/jpg') mt = 'image/jpeg';
  if (!AI_MIME.test(mt)) { budget.skipped.push(name || label); return false; }
  var bytes;
  try { bytes = DriveApp.getFileById(fileId).getBlob().getBytes(); } catch (e) { budget.skipped.push(name || label); return false; }
  if (bytes.length > AI_FILE_MAX || bytes.length > budget.left) { budget.skipped.push(name || label); return false; }
  budget.left -= bytes.length;
  parts.push({ text: label + ':' });
  parts.push({ inline_data: { mime_type: mt, data: Utilities.base64Encode(bytes) } });
  return true;
}

function callGemini_(system, parts) {
  var props = PropertiesService.getScriptProperties();
  var key = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  if (!key) throw err_('Chưa có khóa Gemini. Admin vào Apps Script → Cài đặt dự án → Thuộc tính tập lệnh, thêm GEMINI_API_KEY (lấy ở aistudio.google.com).');
  var model = String(props.getProperty('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL).trim();
  // Mức "suy nghĩ" của Gemini: mặc định 'low' cho nhanh (mặc định của Google là high → chấm 1 bài mất vài phút).
  // Đổi bằng Thuộc tính tập lệnh GEMINI_THINKING = minimal / low / medium / high, hoặc 'off' để không gửi.
  var thinking = String(props.getProperty('GEMINI_THINKING') || 'low').trim().toLowerCase();
  var body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  };
  if (thinking && thinking !== 'off') body.generationConfig.thinkingConfig = { thinkingLevel: thinking };

  var started = Date.now();
  var code, data, tries = 0;
  while (true) {
    tries++;
    var resp;
    try {
      resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
        payload: JSON.stringify(body), muteHttpExceptions: true
      });
    } catch (e) {
      throw err_('Không gọi được Gemini: ' + e.message);
    }
    code = resp.getResponseCode();
    data = parseJson_(resp.getContentText(), {});
    var msg = (data.error && data.error.message) || '';
    // Mô hình không hỗ trợ mức suy nghĩ → gửi lại không kèm thinkingConfig.
    if (code === 400 && body.generationConfig.thinkingConfig && /think/i.test(msg)) {
      delete body.generationConfig.thinkingConfig;
      continue;
    }
    // Gemini bận / hết lượt tạm thời → đợi chút rồi thử lại (tối đa 2 lần, khi còn thời gian).
    if ((code === 429 || code >= 500) && tries < 3 && Date.now() - started < 120000) {
      Utilities.sleep(tries * 4000);
      continue;
    }
    break;
  }
  if (code !== 200) {
    var m = (data.error && data.error.message) || ('mã ' + code);
    if (code === 429) throw err_('Gemini đang hết lượt (giới hạn gói miễn phí). Thử lại sau ít phút.');
    if (code === 400 && /api key/i.test(m)) throw err_('Khóa GEMINI_API_KEY không đúng. Kiểm tra lại trong Thuộc tính tập lệnh.');
    if (code === 403) throw err_('Khóa Gemini không có quyền dùng (' + m + ').');
    if (code === 404) throw err_('Không có mô hình "' + model + '". Đặt Thuộc tính tập lệnh GEMINI_MODEL thành tên mô hình khác.');
    if (code >= 500) throw err_('Gemini đang bận (mã ' + code + '), thử lại sau ít phút.');
    throw err_('Gemini báo lỗi: ' + m);
  }
  var cand = (data.candidates || [])[0];
  if (!cand || !cand.content) {
    var why = (data.promptFeedback && data.promptFeedback.blockReason) || (cand && cand.finishReason) || 'không rõ';
    throw err_('Gemini không trả lời (' + why + ').');
  }
  var text = (cand.content.parts || []).filter(function (x) { return x.text && !x.thought; }).map(function (x) { return x.text; }).join('');
  var out = parseJson_(text, null) || parseJson_((text.match(/\{[\s\S]*\}/) || [''])[0], null);
  if (!out) throw err_('Gemini trả kết quả không đọc được. Bấm thử lại.');
  out._model = data.modelVersion || model;
  out._secs = Math.round((Date.now() - started) / 1000);
  return out;
}

/** Chạy hàm này MỘT LẦN trong trình soạn Apps Script để cấp quyền gọi Gemini và thử khóa. */
function kiemTraGemini() {
  var r = callGemini_('Trả lời bằng JSON {"ok":true,"loiChao":"..."}', [{ text: 'Chào thầy Minh bằng một câu tiếng Việt.' }]);
  Logger.log('Gemini hoạt động (' + r._model + ', ' + r._secs + ' giây): ' + JSON.stringify(r));
}

function submissionStats_(subs, nStudents) {
  var graded = subs.filter(function (s) { return s.status === 'returned'; }).length;
  // 'reopened' = đang chờ học sinh nộp lại, chưa cần giáo viên chấm.
  var waiting = subs.filter(function (s) { return s.status === 'reopened'; }).length;
  return { students: nStudents, submitted: subs.length, graded: graded, ungraded: subs.length - graded - waiting };
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
  var questionsJson = JSON.stringify(questions);
  if (questionsJson.length > 48000) throw err_('Đề quá dài. Hãy tách thành nhiều bài luyện tập.');
  var limit = Number(p.timeLimit || 0);
  if (isNaN(limit) || limit < 0 || limit > 300) throw err_('Thời gian làm bài phải từ 0 đến 300 phút.');

  // Tạo file hình trên Drive ngoài khóa; chỉ ghi Sheets trong khóa.
  var createdIds = [];
  var toTrashIds = [];
  var imagesJson = saveImages_(courseId, q ? q.images : '', questions, p.newImages, createdIds, toTrashIds);
  var outId = '';
  try {
    withLock_(function () {
      var c = findCourse_(courseId);
      requireEdit_(me, courseId);
      var cur = p.id ? findBy_('quizzes', String(p.id)) : null;
      if (p.id && !cur) throw err_('Không tìm thấy bài luyện tập.', 404);
      var now = new Date().toISOString();
      var data = {
        courseId: courseId,
        topic: clean_(p.topic, 100),
        branch: itemBranch_(c, p),
        title: title,
        description: clean_(p.description, 2000),
        source: String(p.source || '').slice(0, 45000),
        questions: questionsJson,
        timeLimit: String(Math.round(limit)),
        showAnswers: p.showAnswers === false ? '0' : '1',
        updatedAt: now,
        images: imagesJson,
        gameOnly: p.gameOnly ? '1' : '0'
      };
      if (cur) {
        update_('quizzes', cur, data);
        outId = cur.id;
      } else {
        data.id = Utilities.getUuid();
        data.createdBy = me.username;
        data.createdAt = now;
        append_('quizzes', data);
        outId = data.id;
      }
    });
  } catch (e) {
    createdIds.forEach(trash_);
    throw e;
  }
  toTrashIds.forEach(trash_);
  return { id: outId };
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
    var img = String(q.image || '').trim();
    if (img) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(img)) throw err_(n + 'tên hình không hợp lệ.');
      out.image = img;
    }
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
  var edit = canEdit_(me, q.courseId);
  if (q.gameOnly === '1' && !edit) throw err_('Bài này chỉ dùng để đấu cả lớp, chưa mở cho học sinh luyện tập.', 403);
  var c = findCourse_(q.courseId);
  var names = userNames_();
  var questions = JSON.parse(q.questions || '[]');
  var out = {
    quiz: publicQuizSummary_(q, names, c),
    branch: itemBranch_(c, q),
    course: { id: c.id, name: c.name, grade: c.grade, branches: branchesOf_(c) },
    canEdit: edit,
    // Học sinh KHÔNG nhận đáp án trước khi nộp bài.
    questions: questions.map(function (x) { return { type: x.type, text: x.text, options: x.options || null, image: x.image || null }; })
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
  if (q.gameOnly === '1' && !canEdit_(me, q.courseId)) throw err_('Bài này chỉ dùng để đấu cả lớp, chưa mở cho học sinh luyện tập.', 403);
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
  if (q.gameOnly === '1' && !canEdit_(me, q.courseId)) throw err_('Bài này chỉ dùng để đấu cả lớp, chưa mở cho học sinh luyện tập.', 403);
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
      var r = { type: x.type, text: x.text, options: x.options || null, image: x.image || null, answer: answers[i] === undefined ? null : answers[i], correct: isCorrect_(x, answers[i]) };
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
    // "24" khớp "24cm", "0.75" khớp "3/4", "0,75kg": cùng giá trị số, chỉ khác đơn vị (hoặc thiếu đơn vị).
    var kn = numPart_(k);
    return vn !== null && kn !== null && Math.abs(vn.val - kn.val) <= 1e-9 && (!vn.unit || !kn.unit || vn.unit === kn.unit);
  });
}

function numPart_(s) {
  var m = /^(-?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)([a-zà-ỹđ²³°%][a-zà-ỹđ0-9²³°%/]*)?$/.exec(s);
  if (!m) return null;
  var raw = m[1];
  var val;
  if (raw.indexOf('/') >= 0) {
    var parts = raw.split('/');
    var den = Number(parts[1]);
    if (!den) return null;
    val = Number(parts[0]) / den;
  } else {
    val = Number(raw);
  }
  if (!isFinite(val)) return null;
  return { num: raw, val: val, unit: m[2] || '' };
}

function normAnswer_(s) {
  // 12.500 = 12500 (dấu chấm phân cách hàng nghìn kiểu Việt Nam), bỏ trước khi đổi dấu phẩy thập phân thành dấu chấm.
  return String(s).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d.,])(-?[1-9]\d{0,2}(?:\.\d{3})+)(?![\d.])/g, function (m, pre, n) { return pre + n.replace(/\./g, ''); }).replace(/,/g, '.').replace(/\.$/, '')
    .replace(/([a-zà-ỹđ])2(?![0-9])/g, '$1²').replace(/([a-zà-ỹđ])3(?![0-9])/g, '$1³');
}

function deleteQuiz_(me, id) {
  var q = findBy_('quizzes', id);
  if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
  requireEdit_(me, q.courseId);
  var ts = rows_('attempts').filter(function (t) { return t.quizId === id; });
  for (var i = ts.length - 1; i >= 0; i--) sheet_('attempts').deleteRow(ts[i]._row);
  dirty_('attempts');
  trashImages_(q.images);
  delete_('quizzes', findBy_('quizzes', id));
  return {};
}

/** Lưu kết quả cuối trận đấu cả lớp vào trang TranDau. */
function saveMatch_(me, p) {
  var q = findBy_('quizzes', String(p.quizId || ''));
  if (!q) throw err_('Không tìm thấy bài luyện tập.', 404);
  requireEdit_(me, q.courseId);
  var raw = Array.isArray(p.results) ? p.results : [];
  if (raw.length > 300) throw err_('Danh sách người chơi quá lớn (tối đa 300).');
  var results = raw.map(function (r, i) {
    return {
      username: clean_(r && r.username, 60),
      fullName: clean_(r && r.fullName, 100),
      score: Math.max(0, Math.min(1000000, Math.round(Number((r && r.score) || 0)))),
      correctCount: Math.max(0, Math.min(500, Math.round(Number((r && r.correctCount) || 0)))),
      rank: Math.max(1, Math.min(1000, Math.round(Number((r && r.rank) || (i + 1)))))
    };
  });
  var json = JSON.stringify(results);
  if (json.length > 48000) throw err_('Dữ liệu kết quả quá lớn.');
  var qCount = Math.max(0, Math.min(500, Math.round(Number(p.questionCount || JSON.parse(q.questions || '[]').length || 0))));
  var pCount = Math.max(0, Math.min(300, Math.round(Number(p.playerCount !== undefined ? p.playerCount : results.length))));
  var m = {
    id: Utilities.getUuid(),
    quizId: q.id,
    courseId: q.courseId,
    host: me.username,
    playedAt: new Date().toISOString(),
    playerCount: String(pCount),
    questionCount: String(qCount),
    results: json
  };
  append_('matches', m);
  return { id: m.id };
}

/* ───────────────────────── Hình trong câu hỏi ───────────────────────── */

/**
 * Lưu hình mới (từ PDF hoặc giáo viên thêm) vào Drive, bỏ hình không còn dùng.
 * Nếu truyền createdIds / toTrashIds thì gom ID file mới tạo và file cũ cần xóa để xử lý ngoài khóa.
 * Trả về JSON {key: fileId} để lưu trong cột images.
 */
function saveImages_(courseId, oldJson, questions, newImages, createdIds, toTrashIds) {
  var map = parseJson_(oldJson, {});
  var used = {};
  questions.forEach(function (x) { if (x.image) used[x.image] = 1; });
  var list = Array.isArray(newImages) ? newImages : [];
  if (list.length > 60) throw err_('Quá nhiều hình trong một đề (tối đa 60).');
  var validNew = [];
  var incomingKeys = {};
  list.forEach(function (im) {
    var key = String((im && im.key) || '');
    if (!used[key] || !/^[A-Za-z0-9_-]{1,40}$/.test(key)) return;
    var bytes = Utilities.base64Decode(String(im.data || ''));
    if (bytes.length > 4 * 1024 * 1024) throw err_('Hình "' + key + '" quá lớn (tối đa 4 MB).');
    validNew.push({ key: key, bytes: bytes, mimeType: String(im.mimeType || 'image/jpeg') });
    incomingKeys[key] = 1;
  });
  var missing = Object.keys(used).filter(function (k) { return !map[k] && !incomingKeys[k]; });
  if (missing.length) throw err_('Thiếu file hình: ' + missing.join(', ') + '. Hãy thêm lại hình cho câu đó.');
  var oldToTrash = [];
  try {
    validNew.forEach(function (im) {
      if (map[im.key]) oldToTrash.push(map[im.key]);
      var blob = Utilities.newBlob(im.bytes, im.mimeType, 'hinh-' + im.key + '.jpg');
      var fid = imagesFolder_(courseId).createFile(blob).getId();
      if (createdIds) createdIds.push(fid);
      map[im.key] = fid;
    });
  } catch (e) {
    if (createdIds) {
      while (createdIds.length) trash_(createdIds.pop());
    }
    throw e;
  }
  Object.keys(map).forEach(function (k) {
    if (!used[k]) {
      oldToTrash.push(map[k]);
      delete map[k];
    }
  });
  if (toTrashIds) {
    oldToTrash.forEach(function (id) { toTrashIds.push(id); });
  } else {
    oldToTrash.forEach(trash_);
  }
  return Object.keys(map).length ? JSON.stringify(map) : '';
}

function trashImages_(json) {
  var map = parseJson_(json, {});
  Object.keys(map).forEach(function (k) { trash_(map[k]); });
}

function imagesFolder_(courseId) {
  return storedFolder_('IMGFOLDER_' + courseId, function () { return courseFolder_(courseId).createFolder('Hình trong đề'); });
}

function questionImage_(me, kind, id, key) {
  var row = kind === 'quiz' ? findBy_('quizzes', id) : findBy_('assignments', id);
  if (!row) throw err_('Không tìm thấy đề.', 404);
  if (!canSee_(me, row.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var fileId = parseJson_(row.images, {})[key];
  if (!fileId) throw err_('Không tìm thấy hình.', 404);
  return fileData_(fileId, 'hinh-' + key + '.jpg', 'image/jpeg');
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
  var oldRole = u.role;
  update_('users', u, { fullName: data.fullName, role: data.role, courses: data.courses, active: active });
  // Khóa tài khoản hoặc đổi vai trò → xóa phiên và cache s_<token> để áp dụng ngay.
  if (active !== '1' || data.role !== oldRole) killSessions_(u.username);
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
/** Các nhánh (tab môn) của một khóa: tách theo dấu phẩy, bỏ rỗng, bỏ trùng, tối đa 10. */
function branchesOf_(course) {
  var seen = {};
  return String((course && course.branches) || '').split(',').map(function (s) { return s.trim(); }).filter(function (b) {
    if (!b || seen[b]) return false;
    seen[b] = 1;
    return true;
  }).slice(0, 10);
}
/** Nhánh của một mục: khóa có nhánh mà mục trống / tên không khớp → gán về nhánh đầu tiên. */
function itemBranch_(course, row) {
  var list = branchesOf_(course);
  if (!list.length) return '';
  var b = String((row && typeof row === 'object' ? row.branch : row) || '').trim();
  return list.indexOf(b) >= 0 ? b : list[0];
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

/*
 * Bộ nhớ trong MỘT lần gọi máy chủ (Apps Script chạy lại script từ đầu ở mỗi request,
 * nên các biến này tự trống ở request sau). Mỗi lần gọi Sheets tốn vài chục ms,
 * nên đọc một trang tính một lần rồi dùng lại thay vì đọc lại nhiều lần.
 */
var checkedSheets_ = {};
var SS_ = null;
var SHEETS_ = {};
var ROWS_ = {};
var SCHEMA_PROPS_ = null;
// Cờ đánh dấu có ghi dữ liệu hiển thị trong khóa (khác trang sessions và không phải chỉ đổi mật khẩu).
var NEED_BUMP_ = false;

function ss_() {
  return SS_ || (SS_ = SpreadsheetApp.getActiveSpreadsheet());
}

/** Dấu hiệu cấu trúc cột của một trang; lưu trong Script Properties khi đã kiểm tra xong. */
function schemaSig_(k) {
  return COLUMNS[k].join(',');
}
function schemaProps_() {
  if (!SCHEMA_PROPS_) SCHEMA_PROPS_ = PropertiesService.getScriptProperties().getProperties();
  return SCHEMA_PROPS_;
}
function markSchema_(k) {
  try {
    PropertiesService.getScriptProperties().setProperty('SCHEMA_' + k, schemaSig_(k));
    if (SCHEMA_PROPS_) SCHEMA_PROPS_['SCHEMA_' + k] = schemaSig_(k);
  } catch (e) { /* không bắt buộc */ }
}

function ensureSheet_(k) {
  var ss = ss_();
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
  SHEETS_[k] = sh;
  dirty_(k);
  markSchema_(k);
  return sh;
}

function sheet_(k) {
  if (SHEETS_[k]) return SHEETS_[k];
  var sh = ss_().getSheetByName(SHEET_NAMES[k]);
  if (!sh) {
    if (AUTO_CREATE.indexOf(k) >= 0) return ensureSheet_(k);
    throw err_('Máy chủ chưa được cài đặt: hãy chạy hàm setup() trong Apps Script.', 500);
  }
  // Kiểm tra cột tiêu đề chỉ khi cấu trúc cột thay đổi (lần đầu chạy bản code mới), không phải mọi request.
  if (!checkedSheets_[k] && schemaProps_()['SCHEMA_' + k] !== schemaSig_(k)) {
    checkedSheets_[k] = true;
    var n = COLUMNS[k].length;
    if (sh.getLastColumn() < n || String(sh.getRange(1, n).getValue()) !== COLUMNS[k][n - 1]) return ensureSheet_(k);
    markSchema_(k);
  }
  checkedSheets_[k] = true;
  SHEETS_[k] = sh;
  return sh;
}

/**
 * Các dòng của một trang dưới dạng object. Đọc Sheets một lần mỗi request rồi nhớ lại.
 * nCols (tùy chọn): chỉ đọc nCols cột đầu (xem LITE_COLS) – dòng đọc thiếu cột KHÔNG được update_.
 * Mọi thao tác ghi phải gọi dirty_(k) (append_/update_/delete_ đã tự gọi).
 */
function rows_(k, nCols) {
  var cols = COLUMNS[k];
  var n = nCols && nCols < cols.length ? nCols : cols.length;
  // Trả bản sao mảng: nơi gọi có thể sort() mà không làm đổi thứ tự cho nơi khác.
  if (ROWS_[k + ':' + cols.length]) return ROWS_[k + ':' + cols.length].slice();
  if (ROWS_[k + ':' + n]) return ROWS_[k + ':' + n].slice();
  var sh = sheet_(k);
  var last = sh.getLastRow();
  var list = last < 2 ? [] : sh.getRange(2, 1, last - 1, n).getValues().map(function (v, i) {
    var o = { _row: i + 2, _n: n };
    for (var j = 0; j < n; j++) {
      o[cols[j]] = v[j] instanceof Date ? v[j].toISOString() : String(v[j] === null || v[j] === undefined ? '' : v[j]);
    }
    return o;
  });
  ROWS_[k + ':' + n] = list;
  return list.slice();
}

/**
 * Dữ liệu trang k đã đổi → lần đọc sau trong request này phải đọc lại.
 * skipBump = true khi chỉ cập nhật cột mật khẩu (không ảnh hưởng dữ liệu hiển thị).
 */
function dirty_(k, skipBump) {
  Object.keys(ROWS_).forEach(function (key) { if (key.split(':')[0] === k) delete ROWS_[key]; });
  if (k !== 'sessions' && !skipBump) NEED_BUMP_ = true;
}

function findBy_(k, id) {
  if (!id) return null;
  return rows_(k).filter(function (r) { return r.id === id; })[0] || null;
}

function append_(k, obj) {
  sheet_(k).appendRow(COLUMNS[k].map(function (c) { return obj[c] === undefined ? '' : String(obj[c]); }));
  dirty_(k);
}

function update_(k, row, changes, skipBump) {
  var cols = COLUMNS[k];
  if (row._n && row._n < cols.length) throw new Error('update_: dòng ' + k + ' được đọc thiếu cột.');
  var vals = cols.map(function (c) { return changes[c] !== undefined ? String(changes[c]) : row[c]; });
  sheet_(k).getRange(row._row, 1, 1, cols.length).setValues([vals]);
  dirty_(k, skipBump);
}

function delete_(k, row) {
  sheet_(k).deleteRow(row._row);
  dirty_(k);
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
  // Chỉ đổi salt/passwordHash, không ảnh hưởng dữ liệu hiển thị nên bỏ qua bumpDataVersion_.
  update_('users', u, { salt: salt, passwordHash: hash_(salt, password) }, true);
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

function publicDoc_(d, names, course) {
  return {
    id: d.id,
    courseId: d.courseId,
    branch: itemBranch_(course || findCourse_(d.courseId), d),
    topic: d.topic || '',
    title: d.title,
    description: d.description,
    type: d.type,
    fileName: d.fileName || '',
    mimeType: d.mimeType || '',
    size: Number(d.size || 0),
    url: d.type === 'link' ? d.url : '',
    uploadedBy: (names && names[d.uploadedBy]) || d.uploadedBy,
    uploadedAt: d.uploadedAt,
    free: d.free === '1'
  };
}

function publicAssignment_(a, names, course) {
  return {
    id: a.id,
    courseId: a.courseId,
    branch: itemBranch_(course || findCourse_(a.courseId), a),
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

function publicQuizSummary_(q, names, course) {
  var n = 0;
  try { n = JSON.parse(q.questions || '[]').length; } catch (e) { n = 0; }
  return {
    id: q.id,
    courseId: q.courseId,
    branch: itemBranch_(course || findCourse_(q.courseId), q),
    topic: q.topic || '',
    title: q.title,
    description: q.description || '',
    count: n,
    timeLimit: Number(q.timeLimit || 0),
    showAnswers: q.showAnswers !== '0',
    gameOnly: q.gameOnly === '1',
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
  // Xóa bộ nhớ tạm đọc trước khi giữ khóa để đọc lại dữ liệu mới nhất trong khóa.
  ROWS_ = {};
  NEED_BUMP_ = false;
  try {
    return fn();
  } finally {
    // Ghi xong vào Sheets trước khi nhả khóa; chỉ đổi "phiên bản dữ liệu" khi có ghi
    // vào trang khác sessions (và không phải chỉ đổi mật khẩu).
    try { SpreadsheetApp.flush(); } catch (e) { /* bỏ qua */ }
    if (NEED_BUMP_) bumpDataVersion_();
    lock.releaseLock();
  }
}

/* ── Nhớ kết quả các trang danh sách giữa các request (CacheService) ──
 * Khóa gồm phiên bản dữ liệu: mọi thao tác ghi (qua withLock_) đổi phiên bản → kết quả cũ tự bỏ.
 * Sửa tay trực tiếp trong Google Sheets sẽ hiện lên web chậm tối đa RESULT_TTL giây.
 */
var DATA_VERSION_ = null;
function dataVersion_() {
  if (DATA_VERSION_) return DATA_VERSION_;
  var cache = CacheService.getScriptCache();
  var v = cache.get('dv');
  if (!v) {
    v = Utilities.getUuid().slice(0, 8);
    cache.put('dv', v, 21600);
  }
  DATA_VERSION_ = v;
  return v;
}
function bumpDataVersion_() {
  DATA_VERSION_ = Utilities.getUuid().slice(0, 8);
  try { CacheService.getScriptCache().put('dv', DATA_VERSION_, 21600); } catch (e) { /* bỏ qua */ }
}
function cached_(name, me, arg, fn) {
  var cache = CacheService.getScriptCache();
  var key = 'r' + dataVersion_() + '|' + name + '|' + me.username + '|' + me.role + '|' + me.courses + '|' + arg;
  if (key.length > 240) key = key.slice(0, 200) + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key));
  var hit = null;
  try { hit = cache.get(key); } catch (e) { hit = null; }
  if (hit) return JSON.parse(hit);
  var out = fn();
  try {
    var json = JSON.stringify(out);
    if (json.length < 95000) cache.put(key, json, RESULT_TTL);
  } catch (e) { /* kết quả quá lớn để nhớ → bỏ qua */ }
  return out;
}

function err_(message, code) {
  var e = new Error(message);
  e.code = code || 400;
  e.userFacing = true;
  return e;
}
