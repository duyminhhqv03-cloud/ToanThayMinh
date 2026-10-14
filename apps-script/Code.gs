/**
 * Toán Thầy Minh – Máy chủ khu học tập (Google Apps Script)
 *
 * Dữ liệu nằm trong Google Sheets (file chứa script này):
 *   TaiKhoan       – tài khoản admin, giáo viên, học sinh
 *   KhoaHoc        – danh sách khóa học
 *   TaiLieu        – danh sách tài liệu đã đăng
 *   PhienDangNhap  – phiên đăng nhập (tự dọn khi hết hạn)
 * File tài liệu nằm trong Google Drive, ở chế độ RIÊNG TƯ (chỉ chủ Drive xem được).
 * Học sinh tải tài liệu qua script này, sau khi đã kiểm tra đăng nhập và quyền khóa học.
 *
 * Cài đặt: xem apps-script/HUONG-DAN.md trong repo.
 */

var SHEET_NAMES = {
  users: 'TaiKhoan',
  courses: 'KhoaHoc',
  docs: 'TaiLieu',
  sessions: 'PhienDangNhap'
};
var COLUMNS = {
  users: ['username', 'fullName', 'role', 'courses', 'active', 'salt', 'passwordHash', 'createdAt'],
  courses: ['id', 'name', 'grade', 'order'],
  docs: ['id', 'courseId', 'title', 'description', 'type', 'fileId', 'fileName', 'mimeType', 'size', 'url', 'uploadedBy', 'uploadedAt'],
  sessions: ['token', 'username', 'expiresAt']
};
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
var MAX_LOGIN_FAILS = 5;

/* ───────────────────────── Cài đặt lần đầu ───────────────────────── */

/** Chạy hàm này MỘT LẦN trong trình soạn Apps Script. Mật khẩu admin hiện trong Nhật ký thực thi. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(function (k) {
    var sh = ss.getSheetByName(SHEET_NAMES[k]);
    if (!sh) sh = ss.insertSheet(SHEET_NAMES[k]);
    // Định dạng văn bản thuần để Sheets không tự đổi "001" thành số hay chuỗi ngày thành ngày.
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), COLUMNS[k].length)).setNumberFormat('@');
    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUMNS[k]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COLUMNS[k].length).setFontWeight('bold');
    }
  });

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
  switch (action) {
    case 'me': return { user: publicUser_(me) };
    case 'logout': return logout_(p.token);
    case 'changePassword': return changePassword_(me, p);
    case 'courses': return { courses: visibleCourses_(me) };
    case 'docs': return { docs: listDocs_(me, String(p.courseId || '')) };
    case 'upload': return withLock_(function () { return upload_(me, p); });
    case 'deleteDoc': return withLock_(function () { return deleteDoc_(me, String(p.docId || '')); });
    case 'file': return getFile_(me, String(p.docId || ''));
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

/* ───────────────────────── Khóa học & tài liệu ───────────────────────── */

function visibleCourses_(me) {
  var users = rows_('users');
  var docs = rows_('docs');
  return rows_('courses')
    .filter(function (c) { return canSee_(me, c.id); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); })
    .map(function (c) {
      return {
        id: c.id,
        name: c.name,
        grade: c.grade,
        canEdit: canEdit_(me, c.id),
        docCount: docs.filter(function (d) { return d.courseId === c.id; }).length,
        teachers: users
          .filter(function (u) { return u.role === 'teacher' && isActive_(u) && courseIds_(u).indexOf(c.id) >= 0; })
          .map(function (u) { return u.fullName; })
      };
    });
}

function listDocs_(me, courseId) {
  if (!courseExists_(courseId)) throw err_('Khóa học không tồn tại.', 404);
  if (!canSee_(me, courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  var names = {};
  rows_('users').forEach(function (u) { names[u.username] = u.fullName; });
  return rows_('docs')
    .filter(function (d) { return d.courseId === courseId; })
    .sort(function (a, b) { return a.uploadedAt < b.uploadedAt ? 1 : -1; })
    .map(function (d) { return publicDoc_(d, names); });
}

function upload_(me, p) {
  var courseId = String(p.courseId || '');
  if (!courseExists_(courseId)) throw err_('Khóa học không tồn tại.', 404);
  if (!canEdit_(me, courseId)) throw err_('Bạn không có quyền đăng tài liệu cho khóa này.', 403);
  var title = clean_(p.title, 200);
  if (!title) throw err_('Vui lòng nhập tiêu đề tài liệu.');

  var doc = {
    id: Utilities.getUuid(),
    courseId: courseId,
    title: title,
    description: clean_(p.description, 2000),
    uploadedBy: me.username,
    uploadedAt: new Date().toISOString()
  };

  if (p.url) {
    var url = String(p.url).trim();
    if (!/^https?:\/\/\S+$/i.test(url)) throw err_('Đường link phải bắt đầu bằng http:// hoặc https://');
    doc.type = 'link';
    doc.url = url;
  } else {
    if (!p.data) throw err_('Vui lòng chọn file cần tải lên.');
    var bytes = Utilities.base64Decode(String(p.data));
    if (bytes.length > MAX_UPLOAD_BYTES) throw err_('File quá lớn (tối đa 20 MB). Với video, hãy đăng YouTube rồi dán link.');
    var name = clean_(p.fileName, 200) || 'tai-lieu';
    var blob = Utilities.newBlob(bytes, String(p.mimeType || 'application/octet-stream'), name);
    var file = courseFolder_(courseId).createFile(blob);
    doc.type = 'file';
    doc.fileId = file.getId();
    doc.fileName = name;
    doc.mimeType = blob.getContentType();
    doc.size = String(bytes.length);
  }

  append_('docs', doc);
  var names = {};
  names[me.username] = me.fullName;
  return { doc: publicDoc_(doc, names) };
}

function deleteDoc_(me, docId) {
  var d = rows_('docs').filter(function (r) { return r.id === docId; })[0];
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  if (!canEdit_(me, d.courseId)) throw err_('Bạn không có quyền xóa tài liệu này.', 403);
  if (d.fileId) {
    try { DriveApp.getFileById(d.fileId).setTrashed(true); } catch (e) { /* file đã bị xóa thủ công */ }
  }
  delete_('docs', d);
  return {};
}

function getFile_(me, docId) {
  var d = rows_('docs').filter(function (r) { return r.id === docId; })[0];
  if (!d) throw err_('Không tìm thấy tài liệu.', 404);
  if (!canSee_(me, d.courseId)) throw err_('Bạn chưa được ghi danh vào khóa học này.', 403);
  if (d.type !== 'file') throw err_('Tài liệu này là đường link, không phải file.');
  var blob;
  try { blob = DriveApp.getFileById(d.fileId).getBlob(); } catch (e) { throw err_('File không còn trong Google Drive.', 404); }
  return { name: d.fileName, mimeType: d.mimeType, data: Utilities.base64Encode(blob.getBytes()) };
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
function isActive_(u) {
  return String(u.active) !== '0';
}
function courseExists_(id) {
  return rows_('courses').some(function (c) { return c.id === id; });
}

/* ───────────────────────── Drive ───────────────────────── */

function rootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* thư mục bị xóa → tạo lại */ }
  }
  var f = DriveApp.createFolder('Toán Thầy Minh – Tài liệu khóa học');
  props.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}

function courseFolder_(courseId) {
  var props = PropertiesService.getScriptProperties();
  var key = 'FOLDER_' + courseId;
  var id = props.getProperty(key);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* tạo lại */ }
  }
  var f = rootFolder_().createFolder(courseId);
  props.setProperty(key, f.getId());
  return f;
}

/* ───────────────────────── Sheets ───────────────────────── */

function sheet_(k) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES[k]);
  if (!sh) throw err_('Máy chủ chưa được cài đặt: hãy chạy hàm setup() trong Apps Script.', 500);
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

/* ───────────────────────── Tiện ích ───────────────────────── */

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
