/* Nhân vật của học sinh – Toán Thầy Minh
 * Ghép từ các bộ phận vẽ bằng SVG (tự thiết kế): nền, áo, da, tóc, mắt, miệng, phụ kiện.
 * Một số món mở khóa khi đủ tổng sao (mọi lớp) hoặc có huy hiệu. Máy chủ (Code.gs: AVATAR_*) kiểm tra lại.
 * TTMAvatar.svg(cfg, size, seed) → chuỗi SVG; TTMAvatar.el(...) → phần tử.
 * ES5 thuần.
 */
(function () {
  'use strict';

  // Danh mục: [mã, tên, màu/giá trị, khóa]  (khóa: số = cần tổng sao; chuỗi = cần huy hiệu)
  var OPTIONS = {
    bg: [
      ['xanhla', 'Xanh lá', '#d9f2e6'], ['xanhduong', 'Xanh dương', '#dbe9fb'], ['hong', 'Hồng', '#fbe1ea'],
      ['vang', 'Vàng', '#fbefcf'], ['tim', 'Tím', '#e6e3fb'], ['xam', 'Xám', '#ecebe6'],
      ['dem', 'Bầu trời đêm', '#23305e', 60], ['cauvong', 'Cầu vồng', '#ffffff', 200]
    ],
    skin: [
      ['s1', 'Da 1', '#ffe0c7'], ['s2', 'Da 2', '#f6cfa8'], ['s3', 'Da 3', '#e0ac7e'], ['s4', 'Da 4', '#b9814f'], ['s5', 'Da 5', '#8a5a36']
    ],
    hair: [
      ['ngan', 'Tóc ngắn'], ['xu', 'Tóc xù'], ['dai', 'Tóc dài'], ['buoi', 'Búi tóc'], ['bob', 'Tóc ngang vai'], ['troc', 'Không tóc']
    ],
    hairColor: [
      ['den', 'Đen', '#2b2522'], ['nau', 'Nâu', '#6b4226'], ['vang', 'Vàng', '#e2b450'], ['do', 'Đỏ', '#b5482a'],
      ['xanh', 'Xanh biển', '#2f6fd6', 50], ['hong', 'Hồng phấn', '#f08bb4', 50]
    ],
    eyes: [
      ['tron', 'Mắt tròn'], ['cuoi', 'Mắt cười'], ['nhay', 'Nháy mắt'], ['to', 'Mắt to'], ['sao', 'Mắt ngôi sao', null, 'tuyetdoi']
    ],
    mouth: [
      ['cuoi', 'Cười'], ['cuoito', 'Cười to'], ['o', 'Ngạc nhiên'], ['leluoi', 'Lè lưỡi']
    ],
    shirt: [
      ['luc', 'Lục', '#2f9e74'], ['lam', 'Lam', '#3b7dd8'], ['do', 'Đỏ', '#d9534f'], ['cam', 'Cam', '#ee8a2b'],
      ['tim', 'Tím', '#7d5bd0'], ['hong', 'Hồng', '#e46f9b'], ['vang', 'Vàng', '#e9b933'], ['xam', 'Xám', '#6b6f76']
    ],
    pattern: [
      ['tron', 'Áo trơn'], ['soc', 'Áo sọc'], ['sao', 'Áo ngôi sao', null, 30], ['cup', 'Áo nhà vô địch', null, 'vodich']
    ],
    acc: [
      ['khong', 'Không'], ['kinh', 'Kính'], ['no', 'Nơ'], ['mu', 'Mũ lưỡi trai', null, 20], ['tainghe', 'Tai nghe', null, 40],
      ['totnghiep', 'Mũ tốt nghiệp', null, 'motsach'], ['vuongmien', 'Vương miện', null, 100], ['phihanhgia', 'Mũ phi hành gia', null, 150]
    ]
  };
  var GROUPS = [
    ['bg', 'Nền'], ['skin', 'Màu da'], ['hair', 'Kiểu tóc'], ['hairColor', 'Màu tóc'], ['eyes', 'Mắt'],
    ['mouth', 'Miệng'], ['shirt', 'Màu áo'], ['pattern', 'Kiểu áo'], ['acc', 'Phụ kiện']
  ];
  var BADGES = {
    chamchi: ['🐝', 'Ong chăm chỉ', 'Nộp đủ bài đúng hạn 4 tuần liền'],
    benbi: ['🔥', 'Bền bỉ', 'Nộp đủ bài đúng hạn 8 tuần liền'],
    tuyetdoi: ['💯', 'Điểm tuyệt đối', 'Một bài tập về nhà đạt điểm tối đa'],
    khongbocuoc: ['💪', 'Không bỏ cuộc', 'Làm lại đề luyện tập từ dưới 80% lên từ 80% trở lên'],
    motsach: ['📚', 'Mọt sách', 'Làm 10 đề luyện tập, mỗi đề từ 50% trở lên'],
    tiachop: ['⚡', 'Tia chớp', 'Nộp 5 bài tập về nhà sớm hơn hạn ít nhất 1 ngày'],
    vodich: ['🏆', 'Nhà vô địch', 'Đứng hạng 1 một trận Đấu cả lớp'],
    ngoisao: ['🌟', 'Ngôi sao lớp', 'Đạt 100 sao trong một lớp']
  };

  function find(group, id) {
    var list = OPTIONS[group];
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i];
    return null;
  }
  function hashOf(s) {
    var x = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 1000003;
    return x;
  }
  /** Nhân vật mặc định (chỉ dùng món miễn phí), cố định theo tên đăng nhập. */
  function defaults(seed) {
    var x = hashOf(seed);
    var out = {};
    GROUPS.forEach(function (g, i) {
      var free = OPTIONS[g[0]].filter(function (o) { return o[3] === undefined && o[0] !== 'troc'; });
      out[g[0]] = free[(x >> i) % free.length][0];
    });
    out.acc = 'khong';
    out.pattern = 'tron';
    return out;
  }
  /** Ghép cấu hình đã lưu với mặc định; bỏ giá trị lạ. */
  function normalize(cfg, seed) {
    var d = defaults(seed);
    var out = {};
    GROUPS.forEach(function (g) {
      var v = cfg && cfg[g[0]];
      out[g[0]] = v && find(g[0], v) ? v : d[g[0]];
    });
    return out;
  }
  /** Món có bị khóa với số sao / huy hiệu này không. Trả về null nếu mở, hoặc chữ giải thích. */
  function lockText(opt, totalStars, badges) {
    var need = opt[3];
    if (need === undefined || need === null) return null;
    if (typeof need === 'number') return totalStars >= need ? null : 'Cần ' + need + ' ⭐';
    return (badges || []).indexOf(need) >= 0 ? null : 'Cần huy hiệu ' + BADGES[need][1];
  }

  var uid = 0;
  function svg(cfg, size, seed) {
    var c = normalize(cfg, seed);
    var id = 'av' + (++uid);
    var bg = find('bg', c.bg);
    var skin = find('skin', c.skin)[2];
    var hairC = find('hairColor', c.hairColor)[2];
    var shirt = find('shirt', c.shirt)[2];
    var ink = '#2b2522';
    var p = [];
    p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" class="avatar-svg" aria-hidden="true">');
    p.push('<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="50"/></clipPath></defs>');
    p.push('<g clip-path="url(#' + id + ')">');
    // Nền
    p.push('<rect width="100" height="100" fill="' + bg[2] + '"/>');
    if (c.bg === 'dem') {
      p.push('<g fill="#fff4b8"><circle cx="16" cy="20" r="1.6"/><circle cx="82" cy="16" r="1.2"/><circle cx="88" cy="44" r="1.6"/><circle cx="10" cy="52" r="1.1"/><circle cx="74" cy="30" r="0.9"/></g><circle cx="84" cy="80" r="7" fill="#fff4b8" opacity=".25"/>');
    } else if (c.bg === 'cauvong') {
      var rb = ['#f26b6b', '#f5a54a', '#f2d24b', '#69c06f', '#55a7e8', '#8f74dc'];
      for (var r = 0; r < rb.length; r++) p.push('<circle cx="50" cy="100" r="' + (96 - r * 8) + '" fill="' + rb[r] + '"/>');
      p.push('<circle cx="50" cy="100" r="47" fill="#ffffff"/>');
    }
    // Tóc phía sau
    if (c.hair === 'dai') p.push('<path d="M24 46 Q22 17 50 17 Q78 17 76 46 L79 80 Q66 72 64 62 L36 62 Q34 72 21 80 Z" fill="' + hairC + '"/>');
    if (c.hair === 'bob') p.push('<path d="M24 54 Q20 17 50 17 Q80 17 76 54 Q74 63 66 62 L66 44 L34 44 L34 62 Q26 63 24 54 Z" fill="' + hairC + '"/>');
    if (c.hair === 'buoi') p.push('<circle cx="50" cy="16" r="10" fill="' + hairC + '"/>');
    // Áo + cổ
    p.push('<rect x="43" y="62" width="14" height="14" rx="4" fill="' + skin + '"/>');
    p.push('<path d="M16 102 Q18 75 50 73 Q82 75 84 102 Z" fill="' + shirt + '"/>');
    if (c.pattern === 'soc') p.push('<g stroke="#ffffff" stroke-opacity=".45" stroke-width="3.2"><path d="M18 86 H82"/><path d="M17 95 H83"/></g>');
    if (c.pattern === 'sao') p.push('<path d="M50 80 L52.6 86 L59 86.4 L54 90.4 L55.8 96.6 L50 93 L44.2 96.6 L46 90.4 L41 86.4 L47.4 86 Z" fill="#fff4b8"/>');
    if (c.pattern === 'cup') p.push('<g fill="#ffd34d"><path d="M43 80 H57 V84 Q57 91 50 91 Q43 91 43 84 Z"/><rect x="48" y="91" width="4" height="4"/><rect x="44.5" y="95" width="11" height="3" rx="1"/></g>');
    p.push('<path d="M42 73 Q50 80 58 73" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/>');
    // Đầu
    p.push('<circle cx="28" cy="49" r="5" fill="' + skin + '"/><circle cx="72" cy="49" r="5" fill="' + skin + '"/>');
    p.push('<ellipse cx="50" cy="47" rx="22" ry="24" fill="' + skin + '"/>');
    // Má
    p.push('<circle cx="37" cy="56" r="3.6" fill="#f08b8b" opacity=".35"/><circle cx="63" cy="56" r="3.6" fill="#f08b8b" opacity=".35"/>');
    // Mắt
    if (c.eyes === 'tron') p.push('<circle cx="41" cy="48" r="3" fill="' + ink + '"/><circle cx="59" cy="48" r="3" fill="' + ink + '"/>');
    if (c.eyes === 'cuoi') p.push('<path d="M37 49 Q41 44 45 49 M55 49 Q59 44 63 49" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>');
    if (c.eyes === 'nhay') p.push('<circle cx="41" cy="48" r="3" fill="' + ink + '"/><path d="M55 49 Q59 45 63 49" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>');
    if (c.eyes === 'to') p.push('<circle cx="41" cy="48" r="4.6" fill="#fff"/><circle cx="59" cy="48" r="4.6" fill="#fff"/><circle cx="41.6" cy="48.6" r="2.7" fill="' + ink + '"/><circle cx="59.6" cy="48.6" r="2.7" fill="' + ink + '"/><circle cx="42.6" cy="47.4" r=".9" fill="#fff"/><circle cx="60.6" cy="47.4" r=".9" fill="#fff"/>');
    if (c.eyes === 'sao') {
      var star = function (x, y) { return '<path transform="translate(' + x + ' ' + y + ') scale(.55)" d="M0 -8 L2.4 -2.6 L8 -2.4 L3.6 1.2 L5 7 L0 3.8 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.6 Z" fill="#f2b705"/>'; };
      p.push(star(41, 48) + star(59, 48));
    }
    // Miệng
    if (c.mouth === 'cuoi') p.push('<path d="M43 58 Q50 64 57 58" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/>');
    if (c.mouth === 'cuoito') p.push('<path d="M42 57 Q50 69 58 57 Z" fill="#9b2c2c"/><path d="M45 61.5 Q50 65 55 61.5" fill="#f28c8c"/>');
    if (c.mouth === 'o') p.push('<ellipse cx="50" cy="60" rx="3" ry="3.6" fill="#9b2c2c"/>');
    if (c.mouth === 'leluoi') p.push('<path d="M43 58 Q50 63 57 58" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/><path d="M48 61 Q48 66 51 66 Q54 66 53.5 60.6" fill="#f07a8a"/>');
    // Tóc phía trước
    if (c.hair === 'ngan' || c.hair === 'buoi') p.push('<path d="M27 44 Q25 20 50 20 Q75 20 73 44 Q66 31 50 30 Q34 31 27 44 Z" fill="' + hairC + '"/>');
    if (c.hair === 'xu') p.push('<path d="M27 43 L29 24 L36 30 L41 17 L50 27 L59 17 L64 30 L71 24 L73 43 Q62 33 50 33 Q38 33 27 43 Z" fill="' + hairC + '"/>');
    if (c.hair === 'dai') p.push('<path d="M27 43 Q27 21 50 21 Q73 21 73 43 Q60 30 47 32 Q36 34 27 43 Z" fill="' + hairC + '"/>');
    if (c.hair === 'bob') p.push('<path d="M28 40 Q29 21 50 21 Q71 21 72 40 Z" fill="' + hairC + '"/>');
    // Phụ kiện
    if (c.acc === 'kinh') p.push('<g fill="none" stroke="' + ink + '" stroke-width="1.8"><circle cx="41" cy="48" r="6.5"/><circle cx="59" cy="48" r="6.5"/><path d="M47.5 48 H52.5 M34.5 47 L29 45 M65.5 47 L71 45"/></g>');
    if (c.acc === 'no') p.push('<g fill="#e5486f"><path d="M66 24 L58 18 L58 30 Z"/><path d="M66 24 L74 18 L74 30 Z"/><circle cx="66" cy="24" r="2.6"/></g>');
    if (c.acc === 'mu') p.push('<path d="M26 37 Q27 15 50 15 Q73 15 74 37 Z" fill="' + shirt + '"/><path d="M50 35 L88 37 Q86 42 72 41 L50 39 Z" fill="' + shirt + '"/><path d="M26 37 H74" stroke="#000" stroke-opacity=".15" stroke-width="2"/><circle cx="50" cy="15.5" r="2" fill="#000" fill-opacity=".2"/>');
    if (c.acc === 'tainghe') p.push('<path d="M26 47 Q25 14 50 14 Q75 14 74 47" fill="none" stroke="#3d3f46" stroke-width="5"/><rect x="20" y="41" width="10" height="15" rx="4" fill="#e5486f"/><rect x="70" y="41" width="10" height="15" rx="4" fill="#e5486f"/>');
    if (c.acc === 'totnghiep') p.push('<path d="M26 22 L50 12 L74 22 L50 32 Z" fill="#2b2f3a"/><path d="M36 26 V33 Q50 39 64 33 V26 L50 32 Z" fill="#3a3f4d"/><path d="M50 22 L70 26 V36" fill="none" stroke="#f2b705" stroke-width="1.6"/><circle cx="70" cy="37" r="2" fill="#f2b705"/>');
    if (c.acc === 'vuongmien') p.push('<path d="M33 24 L36 9 L43 18 L50 6 L57 18 L64 9 L67 24 Z" fill="#f2b705" stroke="#c98b00" stroke-width="1.2"/><circle cx="50" cy="17" r="2.2" fill="#e5486f"/><circle cx="40" cy="20" r="1.6" fill="#3b7dd8"/><circle cx="60" cy="20" r="1.6" fill="#3b7dd8"/>');
    if (c.acc === 'phihanhgia') p.push('<circle cx="50" cy="46" r="32" fill="#bfe3ff" fill-opacity=".28" stroke="#dfe6ee" stroke-width="5"/><path d="M30 30 Q36 22 44 20" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/><path d="M50 14 V6" stroke="#dfe6ee" stroke-width="2.4"/><circle cx="50" cy="5" r="3" fill="#e5486f"/>');
    p.push('</g></svg>');
    return p.join('');
  }
  function el(cfg, size, seed, extraClass) {
    var span = document.createElement('span');
    span.className = 'ttm-av' + (extraClass ? ' ' + extraClass : '');
    span.innerHTML = svg(cfg, size, seed);
    return span;
  }

  window.TTMAvatar = {
    OPTIONS: OPTIONS,
    GROUPS: GROUPS,
    BADGES: BADGES,
    find: find,
    normalize: normalize,
    lockText: lockText,
    svg: svg,
    el: el
  };
})();
