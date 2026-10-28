// Kiểm tra luật Firebase (firebase/database.rules.json) trên database THẬT qua REST, bằng tài khoản ẩn danh thử nghiệm.
// Chạy SAU khi đã dán luật vào Firebase Console: node tools/rules-test.mjs
const KEY = 'AIzaSyAn1fJ6AkyXnk8jSjVYRZ2ZxoOWSYXHCjE';
const DB = 'https://toan-thay-minh-default-rtdb.asia-southeast1.firebasedatabase.app';
const TS = { '.sv': 'timestamp' };
const pin = String(800000 + Math.floor(Math.random() * 99999));

async function anon() {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('signUp lỗi: ' + JSON.stringify(j));
  return { uid: j.localId, tok: j.idToken };
}
async function req(method, path, who, body) {
  const url = DB + '/' + path + '.json' + (who ? '?auth=' + who.tok : '');
  const r = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
let fails = 0;
async function expect(name, want, p) {
  const st = await p;
  const ok = want === 'ok' ? st === 200 : st === 401 || st === 403;
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  (HTTP ' + st + ')');
}

const host = await anon(), s1 = await anon(), s2 = await anon();
const room = `rooms/${pin}`;
await expect('Khách chưa đăng nhập đọc phòng → chặn', 'deny', req('GET', room, null));
await expect('Đọc toàn bộ rooms → chặn', 'deny', req('GET', 'rooms', host));
await expect('Tạo phòng với host là người khác → chặn', 'deny', req('PUT', room, s1, { host: host.uid, quizId: 'q', state: { phase: 'lobby', index: -1, total: 2 } }));
await expect('Giáo viên tạo phòng', 'ok', req('PUT', room, host, { host: host.uid, quizId: 'q1', quizTitle: 'Thử', createdAt: TS, state: { phase: 'lobby', index: -1, total: 2, startedAt: 0, duration: 5 } }));
await expect('Học sinh ghi đè phòng → chặn', 'deny', req('PUT', room, s1, { host: s1.uid, quizId: 'x', state: { phase: 'lobby', index: -1, total: 1 } }));
await expect('Học sinh 1 vào phòng', 'ok', req('PUT', `${room}/players/${s1.uid}`, s1, { name: 'HS Một', username: 'hs1', joinedAt: TS }));
await expect('Học sinh 2 vào phòng', 'ok', req('PUT', `${room}/players/${s2.uid}`, s2, { name: 'HS Hai', username: 'hs2', joinedAt: TS }));
await expect('Học sinh ghi tên hộ bạn khác → chặn', 'deny', req('PUT', `${room}/players/${s2.uid}`, s1, { name: 'Giả', username: 'x' }));
await expect('Học sinh trả lời khi còn ở sảnh → chặn', 'deny', req('PUT', `${room}/answers/0/${s1.uid}`, s1, { a: 1, t: TS }));
await expect('Giáo viên bắt đầu câu 1', 'ok', req('PATCH', room, host, {
  state: { phase: 'question', index: 0, qkey: '0', total: 2, startedAt: TS, duration: 5 },
  question: { index: 0, type: 'mc', text: '1+1=?', options: ['1', '2'] }
}));
await expect('Học sinh sửa trạng thái phòng → chặn', 'deny', req('PATCH', `${room}/state`, s1, { duration: 300 }));
await expect('Học sinh tự cộng điểm → chặn', 'deny', req('PUT', `${room}/scores/${s1.uid}`, s1, { score: 99999, correctCount: 9, streak: 9 }));
await expect('Học sinh tự ghi thời điểm trả lời giả → chặn', 'deny', req('PUT', `${room}/answers/0/${s1.uid}`, s1, { a: 1, t: 1 }));
await expect('Học sinh 1 trả lời câu 1', 'ok', req('PUT', `${room}/answers/0/${s1.uid}`, s1, { a: 1, t: TS }));
await expect('Học sinh 1 đổi câu trả lời → chặn', 'deny', req('PUT', `${room}/answers/0/${s1.uid}`, s1, { a: 0, t: TS }));
await expect('Trả lời hộ bạn khác → chặn', 'deny', req('PUT', `${room}/answers/0/${s2.uid}`, s1, { a: 1, t: TS }));
await expect('Trả lời trước câu chưa mở → chặn', 'deny', req('PUT', `${room}/answers/1/${s1.uid}`, s1, { a: 1, t: TS }));
console.log('… chờ hết giờ (5 giây + 2 giây bù) …');
await new Promise(r => setTimeout(r, 7600));
await expect('Học sinh 2 trả lời sau khi hết giờ → chặn', 'deny', req('PUT', `${room}/answers/0/${s2.uid}`, s2, { a: 1, t: TS }));
await expect('Giáo viên công bố và ghi điểm', 'ok', req('PATCH', room, host, { 'state/phase': 'reveal', reveal: { index: 0, correct: 1, counts: [0, 1] }, scores: { [s1.uid]: { score: 900, correctCount: 1, streak: 1, lastCorrect: true, lastGain: 900, rank: 1 } } }));
await expect('Học sinh đọc cả phòng (gồm câu trả lời) → chặn', 'deny', req('GET', room, s1));
await expect('Học sinh đọc câu trả lời của bạn → chặn', 'deny', req('GET', `${room}/answers/0/${s1.uid}`, s2));
await expect('Học sinh đọc toàn bộ câu trả lời → chặn', 'deny', req('GET', `${room}/answers`, s2));
await expect('Học sinh đọc câu trả lời của chính mình', 'ok', req('GET', `${room}/answers/0/${s1.uid}`, s1));
await expect('Học sinh đọc trạng thái, câu hỏi, điểm', 'ok', Promise.all([req('GET', `${room}/state`, s1), req('GET', `${room}/question`, s1), req('GET', `${room}/scores`, s1), req('GET', `${room}/players`, s1)]).then(a => a.every(x => x === 200) ? 200 : 403));
await expect('Giáo viên đọc cả phòng', 'ok', req('GET', room, host));
await expect('Giáo viên mở câu 2 (trả lời ngắn)', 'ok', req('PATCH', room, host, { state: { phase: 'question', index: 1, qkey: '1', total: 2, startedAt: TS, duration: 5 }, question: { index: 1, type: 'short', text: '1/2 + 1/4 = ?' } }));
await expect('Học sinh gửi câu trả lời ngắn (chữ)', 'ok', req('PUT', `${room}/answers/1/${s2.uid}`, s2, { a: '0,75', t: TS }));
await expect('Câu trả lời ngắn rỗng → chặn', 'deny', req('PUT', `${room}/answers/1/${s1.uid}`, s1, { a: '', t: TS }));
await expect('Học sinh xóa phòng → chặn', 'deny', req('DELETE', room, s1));
await expect('Giáo viên đóng (xóa) phòng', 'ok', req('DELETE', room, host));
console.log(fails ? `\n${fails} kiểm tra KHÔNG đạt` : '\nTất cả kiểm tra đều đạt');
