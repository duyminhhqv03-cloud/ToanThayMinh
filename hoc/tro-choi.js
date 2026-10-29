/* Trò chơi học tập – Toán Thầy Minh
 * Bản Free ai cũng chơi được; bản Plus dành cho học sinh có tài khoản.
 */
(function () {
  'use strict';

  var VER = '23';
  var TTM = window.TTM;
  var h = TTM.h;
  var fill = TTM.fill;
  var append = TTM.append;
  var store = TTM.store;
  var toast = TTM.toast;
  var modal = TTM.modal;
  var go = TTM.go;
  var loading = TTM.loading;
  var busy = TTM.busy;
  var app = TTM.app;

  var STORE_KEY_STATE = 'ttm_qr_free';
  var STORE_KEY_WINS = 'ttm_qr_free_wins';

  // Danh sách trò chơi trên trang #/tro-choi
  var GAMES = [
    {
      id: 'hoa-si-qr',
      icon: '🎨',
      name: 'Họa sĩ mã QR',
      desc: 'Tô từng ô đen của mã QR lên vở ô ly. Chép đủ chuẩn, điện thoại quét sẽ hiện bí mật!',
      render: renderQrGame
    }
  ];

  // Danh sách mã bí ẩn có sẵn (không lộ nội dung ra giao diện)
  var PRESET_CODES = [
    // Cấp 1 = 21×21 ô
    { level: 1, id: 1, text: '1+1=2' },
    { level: 1, id: 2, text: 'Hello!' },
    { level: 1, id: 3, text: 'Be gioi qua!' },
    { level: 1, id: 4, text: 'Toan Thay Minh' },
    // Cấp 2 = 25×25 ô
    { level: 2, id: 5, text: 'Chào bạn nhỏ!' },
    { level: 2, id: 6, text: 'Chúc em học giỏi!' },
    { level: 2, id: 7, text: 'Em yêu toán học!' },
    { level: 2, id: 8, text: 'Họa sĩ nhí tài ba!' }
  ];

  /* ═════════ Nạp động thư viện mã QR ═════════ */
  var libsPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Không tải được: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureQrLibs() {
    if (window.qrcode && window.jsQR) {
      if (window.qrcode.stringToBytesFuncs) {
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
      }
      return Promise.resolve();
    }
    if (!libsPromise) {
      libsPromise = Promise.all([
        loadScript('vendor/qrcode.js?v=' + VER),
        loadScript('vendor/jsQR.js?v=' + VER)
      ]).then(function () {
        if (window.qrcode && window.qrcode.stringToBytesFuncs) {
          window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
        }
      }).catch(function (e) {
        libsPromise = null;
        throw e;
      });
    }
    return libsPromise;
  }

  /* ═════════ Tiện ích tạo ma trận QR & xử lý ═════════ */

  /**
   * Tạo ma trận từ chuỗi văn bản.
   * Thử lần lượt 'H', 'Q', 'M', 'L'; chọn mức cao nhất mà không làm tăng kích thước ma trận.
   */
  function makeMatrix(text) {
    if (!text || !window.qrcode) return null;
    var levels = ['H', 'Q', 'M', 'L'];
    var qL = null;
    try {
      qL = window.qrcode(0, 'L');
      qL.addData(text, 'Byte');
      qL.make();
    } catch (e) {
      return null;
    }
    var minCount = qL.getModuleCount();
    var chosenQ = qL;
    var chosenEcc = 'L';

    for (var i = 0; i < levels.length; i++) {
      try {
        var q = window.qrcode(0, levels[i]);
        q.addData(text, 'Byte');
        q.make();
        if (q.getModuleCount() === minCount) {
          chosenQ = q;
          chosenEcc = levels[i];
          break;
        }
      } catch (err) {
        // bỏ qua nếu dung lượng mức này không đủ
      }
    }

    var n = chosenQ.getModuleCount();
    var dark = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) {
        row.push(chosenQ.isDark(r, c));
      }
      dark.push(row);
    }

    return {
      n: n,
      dark: dark,
      ecc: chosenEcc,
      text: text
    };
  }

  /** Cỡ ô (px) để cả lưới (mã + lề 4 ô + cột số hàng) vừa chiều ngang màn hình. */
  function fitCellSize(n) {
    var availableWidth = Math.min((document.documentElement.clientWidth || window.innerWidth) - 60, 680);
    var autoCell = Math.floor((availableWidth - 36) / (n + 8));
    return Math.max(8, Math.min(22, autoCell));
  }

  /** Đổi chỉ số cột 0..N-1 thành chữ cái A, B, C... Z, AA, AB... */
  function colName(c) {
    var s = '';
    c++;
    while (c > 0) {
      var rem = (c - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      c = Math.floor((c - 1) / 26);
    }
    return s;
  }

  /** Gom các ô liền nhau cùng màu trong hàng: vd "đen 7 · trắng 1 · đen 2" */
  function describeRow(rowBools) {
    if (!rowBools || !rowBools.length) return '';
    var parts = [];
    var curColor = rowBools[0];
    var count = 1;
    for (var i = 1; i < rowBools.length; i++) {
      if (rowBools[i] === curColor) {
        count++;
      } else {
        parts.push((curColor ? 'đen ' : 'trắng ') + count);
        curColor = rowBools[i];
        count = 1;
      }
    }
    parts.push((curColor ? 'đen ' : 'trắng ') + count);
    return parts.join(' · ');
  }

  /** Đếm số ô đen trong 1 hàng */
  function countBlack(rowBools) {
    var cnt = 0;
    for (var i = 0; i < rowBools.length; i++) {
      if (rowBools[i]) cnt++;
    }
    return cnt;
  }

  /** Kiểm tra ô (r, c) có thuộc 1 trong 3 ô định vị 7×7 ở góc không */
  function isCornerFinder(r, c, n) {
    // Góc trên-trái
    if (r < 7 && c < 7) return true;
    // Góc trên-phải
    if (r < 7 && c >= n - 7) return true;
    // Góc dưới-trái
    if (r >= n - 7 && c < 7) return true;
    return false;
  }

  /** Đọc ảnh từ file input (qua FileReader) thành Image */
  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('Không tải được ảnh.')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Không đọc được file.')); };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Đánh dấu điểm đen: tối hơn hẳn (dưới 80%) độ sáng trung bình của vùng xung quanh, hoặc rất tối so với cả ảnh
   * (giữa một mảng tô đen lớn thì vùng xung quanh cũng tối). So với vùng lân cận nên ảnh chụp sáng không đều
   * (bóng tay, đèn) vẫn tách đúng nét bút khỏi giấy.
   */
  function localDark(vals, w, ht) {
    var rad = Math.max(8, Math.round(Math.min(w, ht) / 8));
    var W1 = w + 1;
    var sum = new Float64Array(W1 * (ht + 1)); // bảng cộng dồn để tính trung bình vùng nhanh
    for (var y = 0; y < ht; y++) {
      var rowSum = 0;
      for (var x = 0; x < w; x++) {
        rowSum += vals[y * w + x];
        sum[(y + 1) * W1 + x + 1] = sum[y * W1 + x + 1] + rowSum;
      }
    }
    var veryDark = sum[ht * W1 + w] / (w * ht) * 0.55;
    var out = new Uint8Array(w * ht);
    for (var yy = 0; yy < ht; yy++) {
      var y0 = Math.max(0, yy - rad), y1 = Math.min(ht, yy + rad + 1);
      for (var xx = 0; xx < w; xx++) {
        var x0 = Math.max(0, xx - rad), x1 = Math.min(w, xx + rad + 1);
        var area = (x1 - x0) * (y1 - y0);
        var s = sum[y1 * W1 + x1] - sum[y0 * W1 + x1] - sum[y1 * W1 + x0] + sum[y0 * W1 + x0];
        var v = vals[yy * w + xx];
        out[yy * w + xx] = (v * area < s * 0.8 || v < veryDark) ? 1 : 0;
      }
    }
    return out;
  }

  /** Lấp khe hẹp hơn 2r điểm ảnh giữa các ô đen mà không làm ô to ra (nới rộng rồi co lại r điểm ảnh). */
  function closeGaps(src, w, ht, r) {
    var g = growDark(src, w, ht, r);
    for (var i = 0; i < g.length; i++) g[i] = 1 - g[i];
    g = growDark(g, w, ht, r);
    for (var j = 0; j < g.length; j++) g[j] = 1 - g[j];
    return g;
  }

  /** Nới rộng vùng đen (1 = đen) thêm r điểm ảnh theo cả hai chiều. */
  function growDark(src, w, ht, r) {
    var tmp = new Uint8Array(src.length);
    var out = new Uint8Array(src.length);
    var x, y, d, row;
    for (y = 0; y < ht; y++) {
      row = y * w;
      for (x = 0; x < w; x++) {
        if (!src[row + x]) continue;
        for (d = Math.max(0, x - r); d <= Math.min(w - 1, x + r); d++) tmp[row + d] = 1;
      }
    }
    for (y = 0; y < ht; y++) {
      row = y * w;
      for (x = 0; x < w; x++) {
        if (!tmp[row + x]) continue;
        for (d = Math.max(0, y - r); d <= Math.min(ht - 1, y + r); d++) out[d * w + x] = 1;
      }
    }
    return out;
  }

  /**
   * Thử giải mã QR từ ảnh bằng jsQR ở nhiều độ phân giải
   * và thử cả bản đen trắng (bỏ đường kẻ màu của vở ô ly).
   */
  function decodeImageMultiPass(img) {
    if (!window.jsQR) return null;
    var origW = img.naturalWidth || img.width;
    var origH = img.naturalHeight || img.height;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var targetSizes = [800, 500, 350, 1200]; // ảnh nhỏ làm mờ khe giữa các ô, ảnh lớn giữ nét khi mã nằm nhỏ trong ảnh

    for (var i = 0; i < targetSizes.length; i++) {
      var maxDim = targetSizes[i];
      var scale = Math.min(1, maxDim / Math.max(origW, origH));
      var w = Math.round(origW * scale);
      var ht = Math.round(origH * scale);
      if (w <= 0 || ht <= 0) continue;

      canvas.width = w;
      canvas.height = ht;
      ctx.drawImage(img, 0, 0, w, ht);

      // Cách A: Thử ảnh gốc
      var imgData = ctx.getImageData(0, 0, w, ht);
      var code = window.jsQR(imgData.data, w, ht, { inversionAttempts: 'attemptBoth' });
      if (code && code.data && code.data.trim()) {
        return code.data.trim();
      }

      // Cách B: làm đen trắng theo kênh màu SÁNG NHẤT của mỗi điểm: đường kẻ vở (xanh, tím, đỏ) có một kênh
      // sáng nên thành trắng, còn nét bút chì/bút bi tối ở mọi kênh nên thành đen.
      var pixels = imgData.data;
      var pixelCount = w * ht;
      var vals = new Uint8Array(pixelCount);
      for (var j = 0, p = 0; p < pixelCount; j += 4, p++) {
        vals[p] = Math.max(pixels[j], pixels[j + 1], pixels[j + 2]);
      }
      var dark = localDark(vals, w, ht);
      // Bé tô từng ô nên giữa các ô đen thường còn khe trắng (đường kẻ vở) → lấp khe rộng tới 2, 4, 6 điểm ảnh
      for (var grow = 0; grow <= 3; grow++) {
        var mask = grow ? closeGaps(dark, w, ht, grow) : dark;
        var bwData = ctx.createImageData(w, ht);
        var bw = bwData.data;
        for (var k = 0, m = 0; m < pixelCount; k += 4, m++) {
          var val = mask[m] ? 0 : 255;
          bw[k] = val;
          bw[k + 1] = val;
          bw[k + 2] = val;
          bw[k + 3] = 255;
        }
        var codeBw = window.jsQR(bw, w, ht, { inversionAttempts: 'dontInvert' });
        if (codeBw && codeBw.data && codeBw.data.trim()) {
          return codeBw.data.trim();
        }
      }
    }
    return null;
  }

  /** Bắn pháo giấy confetti ăn mừng (tự dọn sau 4 giây) */
  function showConfetti() {
    var holder = h('div', { class: 'tc-confetti-holder' });
    var colors = ['#0f9d74', '#ff7a59', '#ffb547', '#3b82f6', '#ec4899', '#10b981'];
    for (var i = 0; i < 40; i++) {
      var piece = h('span', { class: 'tc-confetti-piece' });
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 1.5) + 's';
      piece.style.width = (Math.random() * 8 + 6) + 'px';
      piece.style.height = (Math.random() * 10 + 8) + 'px';
      holder.appendChild(piece);
    }
    document.body.appendChild(holder);
    setTimeout(function () {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
    }, 4200);
  }

  /* ═════════ 1a. Trang danh sách trò chơi #/tro-choi ═════════ */

  function renderGameList() {
    var me = TTM.getMe();
    var list = h('div', { class: 'tc-game-grid' });

    GAMES.forEach(function (g) {
      // Nhãn Free
      var freeBox = h('div', { class: 'tc-sec-box' },
        h('div', { class: 'tc-sec-header' },
          h('span', { class: 'tc-badge tc-free' }, 'Free'),
          h('span', { class: 'tc-sec-status' }, 'Chơi không cần đăng nhập')
        ),
        h('p', { class: 'small muted', style: 'margin: 4px 0 0;' }, 'Mở cho tất cả học sinh và phụ huynh.')
      );

      // Nhãn Plus
      var plusStatusText = null;
      if (!me) {
        plusStatusText = h('span', { class: 'tc-sec-status' },
          '🔒 Đăng nhập để mở · Sắp ra mắt · ',
          h('a', { href: '#/' }, 'Đăng nhập')
        );
      } else {
        plusStatusText = h('span', { class: 'tc-sec-status' }, '⏳ Sắp ra mắt');
      }

      var plusBox = h('div', { class: 'tc-sec-box tc-sec-plus' },
        h('div', { class: 'tc-sec-header' },
          h('span', { class: 'tc-badge tc-plus' }, 'Plus'),
          plusStatusText
        ),
        h('ul', { class: 'tc-sec-list' },
          h('li', null, 'Mã bí mật thầy giao cho lớp'),
          h('li', null, 'Mã cấp 3–4 (29×29, 33×33)'),
          h('li', null, 'Luyện chép trên màn hình với mọi mã'),
          h('li', null, 'Lưu thành tích, huy hiệu'),
          h('li', null, 'Bảng thành tích của lớp')
        )
      );

      var card = h('article', { class: 'tc-card' },
        h('div', { class: 'tc-card-top' },
          h('div', { class: 'tc-card-icon' }, g.icon),
          h('div', { class: 'tc-card-heading' },
            h('h2', null, g.name),
            h('p', { class: 'tc-card-desc' }, g.desc)
          )
        ),
        h('div', { class: 'tc-card-sections' },
          freeBox,
          plusBox
        ),
        h('div', { class: 'tc-card-action' },
          h('a', { href: '#/tro-choi/' + g.id, class: 'btn btn-block' }, 'Chơi ngay')
        )
      );
      list.appendChild(card);
    });

    fill(app,
      h('div', { class: 'page-head' },
        h('h1', null, 'Trò chơi'),
        h('p', { class: 'muted' }, 'Vừa chơi vừa luyện mắt, luyện tay. Bản Free ai cũng chơi được, bản Plus dành cho học sinh có tài khoản.')
      ),
      list
    );
  }

  /* ═════════ 1b. Trò Họa sĩ mã QR #/tro-choi/hoa-si-qr ═════════ */

  function renderQrGame() {
    var seq = TTM.getSeq();
    fill(app, loading('Đang chuẩn bị…'));

    ensureQrLibs().then(function () {
      if (!TTM.isCurrent(seq)) return;
      initQrGameView(seq);
    }, function (err) {
      if (!TTM.isCurrent(seq)) return;
      fill(app, TTM.errorBox('Không tải được thư viện mã QR. Kiểm tra mạng rồi thử lại.', function () {
        renderQrGame();
      }));
    });
  }

  function initQrGameView(seq) {
    // Trạng thái hiện tại của trò chơi
    var state = {
      step: 1,            // 1: Chọn mã, 2: Chép vào vở, 3: Kiểm tra
      text: '',           // Nội dung mã
      matrix: null,       // { n, dark, ecc, text }
      curRow: 1,          // Hàng đang chép (1..N)
      doneRows: [],       // Mảng các hàng đã xong [1, 2, ...]
      mode: 'row',        // 'row' (từng hàng) hoặc 'all' (cả mã)
      cellSize: 18,       // Kích thước 1 ô pixel trên canvas chép
      tipCorner: false,   // Bật mẹo 3 góc
      showSecret: false,  // Hiện ảnh mã gốc (với mã có sẵn)
      isPreset: false,    // Có phải mã có sẵn không
      level: 1            // Cấp 1, 2
    };

    // Đọc trạng thái đã lưu trước đó nếu có
    try {
      var raw = store.get(STORE_KEY_STATE);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.text && typeof saved.text === 'string') {
          var mat = makeMatrix(saved.text);
          if (mat && mat.n <= 41) {
            state.text = saved.text;
            state.matrix = mat;
            state.curRow = Math.max(1, Math.min(mat.n, Number(saved.row) || 1));
            state.doneRows = Array.isArray(saved.doneRows) ? saved.doneRows : [];
            state.isPreset = !!saved.isPreset;
            state.level = saved.level || (mat.n === 21 ? 1 : (mat.n === 25 ? 2 : 0));
            state.cellSize = fitCellSize(mat.n);
            state.step = 2; // Nhảy thẳng sang bước chép
          }
        }
      }
    } catch (e) {
      // bỏ qua lỗi đọc bộ nhớ
    }

    function saveState() {
      try {
        if (!state.text) {
          store.set(STORE_KEY_STATE, null);
        } else {
          store.set(STORE_KEY_STATE, JSON.stringify({
            text: state.text,
            ecc: state.matrix ? state.matrix.ecc : 'L',
            row: state.curRow,
            doneRows: state.doneRows,
            isPreset: state.isPreset,
            level: state.level
          }));
        }
      } catch (e) {}
    }

    // Biến quản lý camera bước 1
    var activeStream = null;
    var cameraScanTimer = null;

    function stopCamera() {
      if (activeStream) {
        try {
          activeStream.getTracks().forEach(function (t) { t.stop(); });
        } catch (e) {}
        activeStream = null;
      }
      if (cameraScanTimer) {
        clearInterval(cameraScanTimer);
        cameraScanTimer = null;
      }
    }

    // Đăng ký dọn camera khi rời trang hoặc ẩn tab
    var onVisibilityChange = function () {
      if (!document.hidden || !activeStream) return;
      stopCamera();
      if (state.step === 1) renderAll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    TTM.setLeaveGuard(function () { return false; }, '', function () {
      stopCamera();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });

    // Hàm chọn mã và chuyển sang bước 2
    function setCode(text, isPreset, level) {
      stopCamera();
      var mat = makeMatrix(text);
      if (!mat) {
        toast('Không tạo được mã từ nội dung này.', 'error');
        return false;
      }
      if (mat.n > 41) {
        toast('Mã này quá lớn để chép tay (' + mat.n + '×' + mat.n + ' ô). Em thử mã khác ngắn hơn nhé.', 'error');
        return false;
      }
      state.text = text;
      state.matrix = mat;
      state.curRow = 1;
      state.doneRows = [];
      state.isPreset = !!isPreset;
      state.level = level || (mat.n === 21 ? 1 : (mat.n === 25 ? 2 : 0));
      state.showSecret = false;
      state.step = 2;

      state.cellSize = fitCellSize(mat.n);

      saveState();
      renderAll();
      if (mat.n > 25) {
        toast('Mã khá lớn (' + mat.n + '×' + mat.n + ' ô), cần kiên nhẫn khi chép nhé.', 'info');
      }
      return true;
    }

    // Vẽ lại toàn bộ giao diện trò chơi
    function renderAll() {
      if (!TTM.isCurrent(seq)) {
        stopCamera();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        return;
      }

      var root = h('div', { class: 'tc-game-wrap' });

      // Link quay lại danh sách trò chơi
      var backLink = h('a', { href: '#/tro-choi', class: 'back', onclick: function () { stopCamera(); } }, '← Trò chơi');

      // Tiêu đề trang
      var header = h('div', { class: 'tc-game-header' },
        backLink,
        h('div', { class: 'tc-game-title-row' },
          h('h1', null, '🎨 Họa sĩ mã QR'),
          h('span', { class: 'tc-badge tc-free' }, 'Free')
        ),
        h('p', { class: 'muted' }, 'Tô từng ô đen của mã QR lên vở ô ly. Chép đủ chuẩn, điện thoại quét sẽ hiện nội dung bí mật!')
      );

      // Thanh bước 1 - 2 - 3
      var step1Btn = h('button', {
        class: 'tc-step-item' + (state.step === 1 ? ' active' : ' clickable done'),
        onclick: function () {
          if (state.step !== 1) {
            stopCamera();
            state.step = 1;
            renderAll();
          }
        }
      }, '1 Chọn mã');

      var step2Btn = h('button', {
        class: 'tc-step-item' + (state.step === 2 ? ' active' : (state.matrix ? ' clickable done' : '')),
        disabled: !state.matrix,
        onclick: function () {
          if (state.matrix && state.step !== 2) {
            stopCamera();
            state.step = 2;
            renderAll();
          }
        }
      }, '2 Chép vào vở');

      var step3Btn = h('button', {
        class: 'tc-step-item' + (state.step === 3 ? ' active' : (state.matrix ? ' clickable' : '')),
        disabled: !state.matrix,
        onclick: function () {
          if (state.matrix && state.step !== 3) {
            stopCamera();
            state.step = 3;
            renderAll();
          }
        }
      }, '3 Kiểm tra');

      var stepsBar = h('div', { class: 'tc-steps-bar' },
        step1Btn,
        h('span', { class: 'tc-step-sep' }, '·'),
        step2Btn,
        h('span', { class: 'tc-step-sep' }, '·'),
        step3Btn
      );

      root.appendChild(header);
      root.appendChild(stepsBar);

      // Khối nội dung theo từng bước
      if (state.step === 1) {
        root.appendChild(renderStep1());
      } else if (state.step === 2) {
        root.appendChild(renderStep2());
      } else if (state.step === 3) {
        root.appendChild(renderStep3());
      }

      fill(app, root);
    }

    /* ═════════ Giao diện BƯỚC 1: Chọn mã ═════════ */
    function renderStep1() {
      var wrap = h('div', null);

      // Thẻ 1: Quét mã trên bìa sách
      var scanBox = h('div', { class: 'tc-choice-card' },
        h('h3', null, '📷 Quét mã trên bìa sách'),
        h('p', null, 'Hướng camera vào mã QR trên sách để web đọc nội dung rồi vẽ lưới cho em chép.'),
        h('p', { class: 'small muted', style: 'margin-top:-8px; margin-bottom:12px;' }, 'Mã trên màn hình có thể trông khác mã trên sách một chút nhưng chứa cùng nội dung – chép theo mã trên màn hình nhé.')
      );

      var cameraArea = h('div');
      var fileInput = h('input', {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        style: 'display:none',
        onchange: function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var btn = chooseImgBtn;
          busy(btn, true, 'Đang đọc ảnh…');
          loadImageFromFile(f).then(function (img) {
            var decoded = decodeImageMultiPass(img);
            busy(btn, false);
            if (decoded) {
              setCode(decoded, false);
            } else {
              toast('Không tìm thấy mã QR trong ảnh. Em chọn ảnh chụp thẳng và rõ nét hơn nhé.', 'error');
            }
          }, function (err) {
            busy(btn, false);
            toast(err.message, 'error');
          });
          e.target.value = '';
        }
      });

      var chooseImgBtn = h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onclick: function () { fileInput.click(); }
      }, 'Chọn ảnh có mã QR');

      var startCamBtn = h('button', {
        type: 'button',
        class: 'btn',
        onclick: function () {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast('Trình duyệt không hỗ trợ mở camera trực tiếp. Em hãy dùng nút "Chọn ảnh" nhé.', 'info');
            fileInput.click();
            return;
          }
          busy(startCamBtn, true, 'Đang mở…');
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          }).then(function (stream) {
            busy(startCamBtn, false);
            activeStream = stream;
            var video = h('video', { playsinline: true, muted: true, autoplay: true });
            video.muted = true;
            video.srcObject = stream;
            var playing = video.play();
            if (playing && playing.catch) playing.catch(function () {});

            var stopBtn = h('button', {
              class: 'btn btn-sm btn-ghost',
              style: 'margin-top: 10px;',
              onclick: function () {
                stopCamera();
                fill(cameraArea, null);
                startCamBtn.style.display = '';
              }
            }, 'Tắt camera');

            var box = h('div', { class: 'tc-camera-box' },
              video,
              h('div', { class: 'tc-camera-target' })
            );

            fill(cameraArea, box, stopBtn);
            startCamBtn.style.display = 'none';

            // Quét khung hình mỗi ~250ms
            var scanCanvas = document.createElement('canvas');
            var sctx = scanCanvas.getContext('2d');
            cameraScanTimer = setInterval(function () {
              if (!video || !video.videoWidth) return;
              var vw = video.videoWidth;
              var vh = video.videoHeight;
              var scale = Math.min(1, 640 / Math.max(vw, vh));
              var w = Math.round(vw * scale);
              var ht = Math.round(vh * scale);
              scanCanvas.width = w;
              scanCanvas.height = ht;
              sctx.drawImage(video, 0, 0, w, ht);
              var imgData = sctx.getImageData(0, 0, w, ht);
              var code = window.jsQR(imgData.data, w, ht, { inversionAttempts: 'attemptBoth' });
              if (code && code.data && code.data.trim()) {
                stopCamera();
                setCode(code.data.trim(), false);
              }
            }, 250);
          }).catch(function () {
            busy(startCamBtn, false);
            toast('Không mở được camera. Em có thể chọn ảnh chụp có sẵn để quét.', 'info');
            fileInput.click();
          });
        }
      }, '📷 Mở camera quét mã');

      var btnRow = h('div', { class: 'tc-scan-btns' }, startCamBtn, chooseImgBtn, fileInput);
      scanBox.appendChild(btnRow);
      scanBox.appendChild(cameraArea);

      // Thẻ 2: Tự tạo mã
      var customInput = h('input', {
        type: 'text',
        maxlength: '60',
        placeholder: 'Ví dụ: Bé yêu môn Toán',
        autocomplete: 'off'
      });
      var charCount = h('span', null, '0/60');
      var sizePreview = h('span', { class: 'tc-size-preview' }, '');
      var countRow = h('div', { class: 'tc-char-counter' }, sizePreview, charCount);

      customInput.addEventListener('input', function () {
        var v = customInput.value;
        charCount.textContent = v.length + '/60';
        if (!v.trim()) {
          sizePreview.textContent = '';
          return;
        }
        var mat = makeMatrix(v.trim());
        if (!mat) {
          sizePreview.textContent = 'Chữ hơi dài';
        } else {
          sizePreview.textContent = 'Mã ' + mat.n + '×' + mat.n + ' ô';
        }
      });

      var createBtn = h('button', {
        class: 'btn',
        onclick: function () {
          var val = customInput.value.trim();
          if (!val) {
            toast('Em hãy gõ nội dung mã trước nhé.', 'error');
            customInput.focus();
            return;
          }
          setCode(val, false);
        }
      }, 'Tạo mã');

      var customBox = h('div', { class: 'tc-choice-card' },
        h('h3', null, '✏️ Tự tạo mã'),
        h('p', null, 'Gợi ý: Viết tên em, một lời chúc, hoặc một đường link ngắn.'),
        h('div', { style: 'margin-bottom: 12px;' }, customInput, countRow),
        createBtn
      );

      // Thẻ 3: Mã có sẵn (Bản Free: Cấp 1 và Cấp 2)
      var presetBox = h('div', { class: 'tc-choice-card' },
        h('h3', null, '⭐ Mã có sẵn'),
        h('p', null, 'Mã bí ẩn đã chuẩn bị sẵn. Chép xong quét vở để mở điều bất ngờ!')
      );

      var lvl1Btns = h('div', { class: 'tc-preset-buttons' });
      var lvl2Btns = h('div', { class: 'tc-preset-buttons' });

      PRESET_CODES.forEach(function (p) {
        var btn = h('button', {
          class: 'tc-btn-preset',
          onclick: function () {
            setCode(p.text, true, p.level);
          }
        }, 'Mã bí ẩn ' + p.id, h('div', { class: 'small muted' }, p.level === 1 ? '21×21 ô' : '25×25 ô'));

        if (p.level === 1) lvl1Btns.appendChild(btn);
        else lvl2Btns.appendChild(btn);
      });

      var presetLevels = h('div', { class: 'tc-preset-levels' },
        h('div', null,
          h('div', { class: 'tc-preset-group-title' }, 'Cấp 1 – Dễ (21×21 ô)'),
          lvl1Btns
        ),
        h('div', null,
          h('div', { class: 'tc-preset-group-title' }, 'Cấp 2 – Vừa (25×25 ô)'),
          lvl2Btns
        )
      );
      presetBox.appendChild(presetLevels);

      wrap.appendChild(h('div', { class: 'tc-choice-grid' }, scanBox, customBox, presetBox));
      return wrap;
    }

    /* ═════════ Giao diện BƯỚC 2: Chép vào vở ═════════ */
    function renderStep2() {
      var wrap = h('div', null);
      var mat = state.matrix;
      var n = mat.n;

      // Hàng nút trên cùng
      var changeCodeBtn = h('button', {
        class: 'btn btn-sm btn-ghost',
        onclick: function () {
          if (confirm('Em có muốn chọn mã khác không?')) {
            state.text = '';
            state.matrix = null;
            saveState();
            state.step = 1;
            renderAll();
          }
        }
      }, '← Đổi mã khác');

      var topRow = h('div', { class: 'tc-stage-top' },
        changeCodeBtn,
        h('div', { class: 'tc-code-info' },
          h('span', null, 'Cỡ mã: ' + n + '×' + n + ' ô'),
          mat.n > 25 ? h('span', { class: 'pill p-wait' }, 'Cần kiên nhẫn') : null
        )
      );
      wrap.appendChild(topRow);

      // Thanh công cụ điều khiển
      var modeRowBtn = h('button', {
        class: 'tc-seg-btn' + (state.mode === 'row' ? ' active' : ''),
        onclick: function () {
          state.mode = 'row';
          renderAll();
        }
      }, 'Từng hàng');

      var modeAllBtn = h('button', {
        class: 'tc-seg-btn' + (state.mode === 'all' ? ' active' : ''),
        onclick: function () {
          state.mode = 'all';
          renderAll();
        }
      }, 'Cả mã');

      var zoomOutBtn = h('button', {
        class: 'tc-zoom-btn',
        title: 'Thu nhỏ',
        onclick: function () {
          if (state.cellSize > 8) {
            state.cellSize -= 2;
            drawGridCanvas();
          }
        }
      }, '−');

      var zoomInBtn = h('button', {
        class: 'tc-zoom-btn',
        title: 'Phóng to',
        onclick: function () {
          if (state.cellSize < 36) {
            state.cellSize += 2;
            drawGridCanvas();
          }
        }
      }, '+');

      var tipCornerBtn = h('button', {
        class: 'btn btn-sm ' + (state.tipCorner ? 'btn' : 'btn-ghost'),
        style: state.tipCorner ? 'background: #ea580c; border-color: #ea580c;' : '',
        onclick: function () {
          state.tipCorner = !state.tipCorner;
          renderAll();
        }
      }, '💡 Mẹo: tô 3 góc trước');

      var practiceBtn = null;
      if (state.isPreset && state.level === 1) {
        practiceBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          onclick: function () { openPracticeModal(); }
        }, '✍️ Luyện trên màn hình');
      } else {
        practiceBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          title: 'Dành cho bản Plus',
          onclick: function () {
            toast('Tính năng Plus – sắp ra mắt cho học sinh có tài khoản.', 'info');
          }
        }, '🔒 Luyện trên màn hình');
      }

      var toolbar = h('div', { class: 'tc-toolbar' },
        h('div', { class: 'tc-tool-group' }, modeRowBtn, modeAllBtn),
        h('div', { class: 'tc-tool-group' }, zoomOutBtn, zoomInBtn, tipCornerBtn),
        h('div', { class: 'tc-tool-group' }, practiceBtn)
      );
      wrap.appendChild(toolbar);

      // Nếu ở chế độ Từng hàng: hiện thanh điều khiển hàng
      if (state.mode === 'row') {
        var prevRowBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          disabled: state.curRow <= 1,
          onclick: function () {
            if (state.curRow > 1) {
              state.curRow--;
              saveState();
              renderAll();
            }
          }
        }, '◀ Hàng trước');

        var nextRowBtn = h('button', {
          class: 'btn btn-sm',
          onclick: function () {
            if (state.doneRows.indexOf(state.curRow) === -1) {
              state.doneRows.push(state.curRow);
            }
            if (state.curRow < n) {
              state.curRow++;
            } else {
              toast('Em đã xem hết ' + n + ' hàng rồi! Kiểm tra lại rồi bấm "Chép xong".', 'success');
            }
            saveState();
            renderAll();
          }
        }, state.curRow < n ? 'Xong hàng này ▶' : 'Đã xong hàng cuối ✓');

        var rowBools = mat.dark[state.curRow - 1];
        var blackNum = countBlack(rowBools);
        var rowDescText = describeRow(rowBools);

        var doneCount = state.doneRows.length;
        var progressPct = Math.round((doneCount / n) * 100);

        var rowCtrl = h('div', { class: 'tc-row-ctrl' },
          h('div', { class: 'tc-row-nav' },
            prevRowBtn,
            h('span', { class: 'tc-row-cur-label' }, 'Hàng ' + state.curRow + ' / ' + n + ' · ' + blackNum + ' ô đen'),
            nextRowBtn
          ),
          h('div', { class: 'tc-row-desc' },
            h('span', { class: 'small muted', style: 'display:block; margin-bottom:2px;' }, 'Thứ tự tô từ trái sang phải:'),
            rowDescText
          ),
          h('div', { class: 'tc-progress-wrap' },
            h('div', { class: 'tc-progress-bar' },
              h('div', { class: 'tc-progress-fill', style: 'width: ' + progressPct + '%;' })
            ),
            h('span', null, 'Đã chép ' + doneCount + '/' + n + ' hàng')
          )
        );
        wrap.appendChild(rowCtrl);
      }

      // Khung chứa canvas vẽ lưới
      var canvasWrap = h('div', { class: 'tc-canvas-wrap' });
      var canvas = h('canvas');
      canvasWrap.appendChild(canvas);
      canvasWrap.appendChild(h('div', { class: 'tc-canvas-note' }, '💡 Để trống 4 ô quanh mã. Em có thể bấm vào một hàng trên lưới để chuyển tới hàng đó.'));
      wrap.appendChild(canvasWrap);

      // Hàm vẽ canvas lưới
      function drawGridCanvas() {
        var dpr = window.devicePixelRatio || 1;
        var cellSize = state.cellSize;
        var quiet = 4; // lề trắng 4 ô quanh mã
        var totalCols = n + quiet * 2;
        var totalRows = n + quiet * 2;
        var headL = 36; // lề trái cho số hàng
        var headT = 24; // lề trên cho tên cột

        var w = headL + totalCols * cellSize;
        var hPix = headT + totalRows * cellSize;

        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(hPix * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = hPix + 'px';

        var ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // Nền chung
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, hPix);

        // Vùng lề 4 ô: tô màu nhạt khác biệt
        var qX = headL;
        var qY = headT;
        var qW = totalCols * cellSize;
        var qH = totalRows * cellSize;
        ctx.fillStyle = '#f0f5f2';
        ctx.fillRect(qX, qY, qW, qH);

        // Vùng mã N×N: tô màu trắng
        var matX = headL + quiet * cellSize;
        var matY = headT + quiet * cellSize;
        var matSize = n * cellSize;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(matX, matY, matSize, matSize);

        // Vẽ các ô đen của mã
        for (var r = 0; r < n; r++) {
          for (var c = 0; c < n; c++) {
            if (!mat.dark[r][c]) continue;
            var ox = matX + c * cellSize;
            var oy = matY + r * cellSize;

            if (state.tipCorner && isCornerFinder(r, c, n)) {
              // Nổi bật 3 ô góc
              ctx.fillStyle = '#ea580c';
            } else if (state.mode === 'row') {
              if (r === state.curRow - 1) {
                ctx.fillStyle = '#12201c'; // hàng đang chép: đen đậm
              } else {
                ctx.fillStyle = '#cbd5e1'; // các hàng khác: xám mờ
              }
            } else {
              ctx.fillStyle = '#12201c';
            }
            ctx.fillRect(ox, oy, cellSize, cellSize);
          }
        }

        // Vẽ đường kẻ ô giống vở ô ly
        ctx.strokeStyle = '#cbe0d5';
        ctx.lineWidth = 1;

        // Kẻ dọc
        for (var i = 0; i <= totalCols; i++) {
          var lx = headL + i * cellSize;
          ctx.beginPath();
          ctx.moveTo(lx, headT);
          ctx.lineTo(lx, headT + qH);
          ctx.stroke();
        }
        // Kẻ ngang
        for (var j = 0; j <= totalRows; j++) {
          var ly = headT + j * cellSize;
          ctx.beginPath();
          ctx.moveTo(headL, ly);
          ctx.lineTo(headL + qW, ly);
          ctx.stroke();
        }

        // Đường kẻ đậm hơn mỗi 5 ô trong vùng mã để dễ đếm
        ctx.strokeStyle = '#689f84';
        ctx.lineWidth = 1.5;
        for (var ci = 0; ci <= n; ci += 5) {
          var cx = matX + ci * cellSize;
          ctx.beginPath();
          ctx.moveTo(cx, matY);
          ctx.lineTo(cx, matY + matSize);
          ctx.stroke();
        }
        for (var ri = 0; ri <= n; ri += 5) {
          var ry = matY + ri * cellSize;
          ctx.beginPath();
          ctx.moveTo(matX, ry);
          ctx.lineTo(matX + matSize, ry);
          ctx.stroke();
        }

        // Khung viền vùng mã
        ctx.strokeStyle = '#2d5a45';
        ctx.lineWidth = 2;
        ctx.strokeRect(matX, matY, matSize, matSize);

        // Khung nổi bật hàng đang chép
        if (state.mode === 'row') {
          var curY = matY + (state.curRow - 1) * cellSize;
          ctx.strokeStyle = '#0f9d74';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(matX - 1, curY - 1, matSize + 2, cellSize + 2);
        }

        // Đánh số cột A, B, C... phía trên (chỉ đánh cho vùng mã)
        ctx.font = 'bold ' + Math.max(7, Math.min(11, cellSize - (n > 26 ? 4 : 2))) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#5b6b66';
        for (var colIdx = 0; colIdx < n; colIdx++) {
          var colLabel = colName(colIdx);
          var tx = matX + (colIdx + 0.5) * cellSize;
          ctx.fillText(colLabel, tx, headT - 10);
        }

        // Đánh số hàng 1..N bên trái (chỉ đánh cho vùng mã)
        ctx.font = 'bold ' + Math.max(8, Math.min(12, cellSize - 1)) + 'px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (var rowIdx = 0; rowIdx < n; rowIdx++) {
          var rowNum = rowIdx + 1;
          var ty = matY + (rowIdx + 0.5) * cellSize;
          var isDone = state.doneRows.indexOf(rowNum) !== -1;
          if (isDone) {
            ctx.fillStyle = '#0f9d74';
            ctx.fillText('✓ ' + rowNum, headL - 6, ty);
          } else {
            ctx.fillStyle = (state.mode === 'row' && rowNum === state.curRow) ? '#0f9d74' : '#5b6b66';
            ctx.fillText(String(rowNum), headL - 6, ty);
          }
        }
      }

      // Xử lý bấm vào canvas để chọn hàng
      canvas.onclick = function (e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / (rect.width * (window.devicePixelRatio || 1));
        var scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));
        var x = (e.clientX - rect.left) * scaleX;
        var y = (e.clientY - rect.top) * scaleY;

        var headT = 24;
        var matY = headT + 4 * state.cellSize;
        var clickedR = Math.floor((y - matY) / state.cellSize);
        if (clickedR >= 0 && clickedR < n) {
          state.curRow = clickedR + 1;
          saveState();
          renderAll();
        }
      };

      // Vẽ canvas ngay sau khi gắn DOM
      setTimeout(drawGridCanvas, 0);

      // Hộp mẹo 3 góc
      if (state.tipCorner) {
        var tipBox = h('div', { class: 'tc-tip-box' },
          h('p', null,
            h('strong', null, '💡 3 ô vuông lớn ở góc là quan trọng nhất: '),
            'Chép đúng 3 góc này trước, điện thoại mới nhận ra mã. Sai vài ô ở giữa thì mã vẫn quét được.'
          )
        );
        wrap.appendChild(tipBox);
      }

      // Hộp hướng dẫn chép
      var guideBox = h('div', { class: 'tc-guide-box' },
        h('p', { style: 'margin:0;' },
          h('strong', null, '📝 Cách chép: '),
          'Dùng bút chì đen hoặc bút bi đen, tô kín cả ô. Mỗi ô của mã = 1 ô vuông nhỏ trên vở. Chừa trống 4 ô quanh mã. Đánh dấu hàng đã chép.'
        )
      );
      wrap.appendChild(guideBox);

      // Ảnh mã QR gốc nhỏ
      var origQrBox = h('div', { class: 'tc-orig-box' });
      var origCanvas = h('canvas');
      var origCanvasWrap = h('div', { class: 'tc-orig-canvas-wrap' }, origCanvas);

      function drawOrigThumb() {
        var thumbCell = 4;
        var thumbQuiet = 4;
        var thumbSize = (n + thumbQuiet * 2) * thumbCell;
        origCanvas.width = thumbSize;
        origCanvas.height = thumbSize;
        var octx = origCanvas.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, thumbSize, thumbSize);
        octx.fillStyle = '#000000';
        for (var r = 0; r < n; r++) {
          for (var c = 0; c < n; c++) {
            if (mat.dark[r][c]) {
              octx.fillRect((thumbQuiet + c) * thumbCell, (thumbQuiet + r) * thumbCell, thumbCell, thumbCell);
            }
          }
        }
      }

      var origDesc = h('div', { class: 'tc-orig-text' });
      if (state.isPreset) {
        var secretToggleBtn = h('button', {
          class: 'btn btn-sm btn-ghost',
          onclick: function () {
            state.showSecret = !state.showSecret;
            renderAll();
          }
        }, state.showSecret ? 'Ẩn mã gốc' : 'Hiện mã gốc');

        origDesc.appendChild(h('p', null, 'Đừng quét vội! Chép xong rồi quét vở của em để xem bí mật.'));
        origDesc.appendChild(secretToggleBtn);

        if (state.showSecret) {
          origQrBox.appendChild(origCanvasWrap);
          setTimeout(drawOrigThumb, 0);
        }
      } else {
        origDesc.appendChild(h('p', null, 'Mã gốc – quét thử bằng điện thoại để xem phần thưởng:'));
        origQrBox.appendChild(origCanvasWrap);
        setTimeout(drawOrigThumb, 0);
      }
      origQrBox.appendChild(origDesc);
      wrap.appendChild(origQrBox);

      // Nút hành động lớn: Chuyển sang Bước 3
      var doneCheckBtn = h('button', {
        class: 'btn',
        style: 'padding: 14px 28px; font-size: 16px;',
        onclick: function () {
          state.step = 3;
          renderAll();
          window.scrollTo(0, 0);
        }
      }, 'Chép xong rồi → Kiểm tra');

      var actionRow = h('div', { class: 'tc-action-row' }, doneCheckBtn);
      wrap.appendChild(actionRow);

      return wrap;
    }

    /* ═════════ Giao diện BƯỚC 3: Kiểm tra ═════════ */
    function renderStep3() {
      var wrap = h('div', null);
      var mat = state.matrix;

      var checkArea = h('div', { class: 'tc-check-card' },
        h('h2', null, '🔍 Kiểm tra mã QR trên vở'),
        h('p', { class: 'muted' }, 'Xem điện thoại có đọc được tác phẩm của em không nhé!')
      );

      var waysBox = h('div', { class: 'tc-check-ways' },
        h('h4', null, 'Hai cách kiểm tra:'),
        h('ol', null,
          h('li', null, h('strong', null, 'Cách 1: '), 'Mở camera điện thoại, hướng vào vở. Hiện ra đúng nội dung là em thắng!'),
          h('li', null, h('strong', null, 'Cách 2: '), 'Chụp ảnh vở ở đây để web chấm tự động.')
        )
      );
      checkArea.appendChild(waysBox);

      var resultBox = h('div');
      checkArea.appendChild(resultBox);

      var fileInput = h('input', {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        style: 'display:none',
        onchange: function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var btn = shootBtn;
          busy(btn, true, 'Đang chấm bài…');
          fill(resultBox, loading('Đang phân tích ảnh vở…'));

          loadImageFromFile(f).then(function (img) {
            // Dùng setTimeout để giao diện kịp vẽ spinner
            setTimeout(function () {
              var decoded = decodeImageMultiPass(img);
              busy(btn, false);
              showGradingResult(decoded);
            }, 60);
          }, function (err) {
            busy(btn, false);
            toast(err.message, 'error');
            fill(resultBox, null);
          });
          e.target.value = '';
        }
      });

      var shootBtn = h('button', {
        class: 'btn',
        style: 'padding: 13px 26px;',
        onclick: function () { fileInput.click(); }
      }, '📷 Chụp ảnh vở để web chấm');

      checkArea.appendChild(shootBtn);
      checkArea.appendChild(fileInput);

      function showGradingResult(decoded) {
        if (decoded && decoded.trim() === state.text.trim()) {
          // Thành công: đúng mã!
          var wins = (parseInt(store.get(STORE_KEY_WINS) || '0', 10) || 0) + 1;
          store.set(STORE_KEY_WINS, wins);

          showConfetti();
          var winBox = h('div', { class: 'tc-check-status-box tc-success' },
            h('h3', { style: 'margin:0 0 8px; font-size:20px;' }, '🎉 Tuyệt vời! Em là Họa sĩ mã QR!'),
            h('p', null, 'Điện thoại đã đọc được đúng nội dung bí mật:'),
            h('div', { class: 'tc-secret-box' }, decoded),
            h('div', { class: 'tc-win-count' }, '🏆 Em đã chép thành công ' + wins + ' mã QR!')
          );
          fill(resultBox, winBox);
        } else if (decoded && decoded.trim()) {
          // Đọc được nhưng nội dung khác
          var misBox = h('div', { class: 'tc-check-status-box tc-mismatch' },
            h('h3', { style: 'margin:0 0 8px; font-size:18px;' }, '⚠️ Web đọc được một mã khác'),
            h('p', null, 'Nội dung đọc được là:'),
            h('div', { class: 'tc-secret-box', style: 'border-color: #f59e0b;' }, decoded),
            h('p', { class: 'small' }, 'Em có chụp nhầm mã khác không? Hoặc một vài ô quan trọng bị nhầm lẫn.')
          );
          fill(resultBox, misBox);
        } else {
          // Không đọc được
          var failBox = h('div', { class: 'tc-check-status-box tc-fail' },
            h('h3', { style: 'margin:0 0 8px; font-size:18px;' }, 'Chưa quét được mã'),
            h('p', null, 'Em hãy kiểm tra các điểm sau rồi thử lại:'),
            h('ul', { style: 'margin: 6px 0 12px; padding-left: 20px;' },
              h('li', null, '1) Kiểm tra lại 3 ô vuông lớn ở góc (phải vuông và chuẩn).'),
              h('li', null, '2) Tô thật đậm và kín các ô đen bằng bút bi hoặc bút chì đậm.'),
              h('li', null, '3) Chừa trống ít nhất 4 ô trắng xung quanh mã.'),
              h('li', null, '4) Khi chụp: đặt điện thoại thẳng góc, đủ ánh sáng, mã nằm trọn trong ảnh.')
            ),
            h('div', { style: 'display: flex; gap: 8px;' },
              h('button', {
                class: 'btn btn-sm btn-ghost',
                onclick: function () {
                  state.step = 2;
                  renderAll();
                }
              }, 'Xem lại lưới'),
              h('button', {
                class: 'btn btn-sm',
                onclick: function () { fileInput.click(); }
              }, 'Chụp lại')
            )
          );
          fill(resultBox, failBox);
        }
      }

      // Hàng nút dưới cùng
      var backToStep2Btn = h('button', {
        class: 'btn btn-ghost',
        onclick: function () {
          state.step = 2;
          renderAll();
        }
      }, '← Quay lại chép tiếp');

      var newCodeBtn = h('button', {
        class: 'btn btn-ghost',
        onclick: function () {
          state.text = '';
          state.matrix = null;
          saveState();
          state.step = 1;
          renderAll();
        }
      }, 'Chép mã khác');

      wrap.appendChild(checkArea);
      wrap.appendChild(h('div', { class: 'tc-action-row', style: 'justify-content: center;' }, backToStep2Btn, newCodeBtn));
      return wrap;
    }

    /* ═════════ Modal Luyện trên màn hình (Cấp 1 có sẵn) ═════════ */
    function openPracticeModal() {
      var mat = state.matrix;
      var n = mat.n;
      var userGrid = [];
      for (var r = 0; r < n; r++) {
        var row = [];
        for (var c = 0; c < n; c++) {
          row.push(false);
        }
        userGrid.push(row);
      }

      var cellSize = 14;
      var pCanvasW = n * cellSize;
      var pCanvasH = n * cellSize;

      // Canvas mẫu
      var sampleCanvas = h('canvas', { width: pCanvasW, height: pCanvasH, class: 'tc-canvas-practice' });
      var sctx = sampleCanvas.getContext('2d');
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, pCanvasW, pCanvasH);
      for (var sr = 0; sr < n; sr++) {
        for (var sc = 0; sc < n; sc++) {
          if (mat.dark[sr][sc]) {
            sctx.fillStyle = '#12201c';
            sctx.fillRect(sc * cellSize, sr * cellSize, cellSize, cellSize);
          }
        }
      }
      sctx.strokeStyle = '#d0ded6';
      sctx.lineWidth = 0.5;
      for (var si = 0; si <= n; si++) {
        sctx.beginPath();
        sctx.moveTo(si * cellSize, 0);
        sctx.lineTo(si * cellSize, pCanvasH);
        sctx.stroke();
        sctx.beginPath();
        sctx.moveTo(0, si * cellSize);
        sctx.lineTo(pCanvasW, si * cellSize);
        sctx.stroke();
      }

      // Canvas luyện tập của em
      var userCanvas = h('canvas', {
        width: pCanvasW,
        height: pCanvasH,
        class: 'tc-canvas-practice'
      });
      var uctx = userCanvas.getContext('2d');
      var errors = []; // mảng các ô sai sau khi chấm: [{ r, c }]

      function drawUserGrid() {
        uctx.fillStyle = '#ffffff';
        uctx.fillRect(0, 0, pCanvasW, pCanvasH);

        // Vẽ các ô học sinh tô
        for (var ur = 0; ur < n; ur++) {
          for (var uc = 0; uc < n; uc++) {
            if (userGrid[ur][uc]) {
              uctx.fillStyle = '#12201c';
              uctx.fillRect(uc * cellSize, ur * cellSize, cellSize, cellSize);
            }
          }
        }

        // Vẽ lưới
        uctx.strokeStyle = '#d0ded6';
        uctx.lineWidth = 0.5;
        for (var ui = 0; ui <= n; ui++) {
          uctx.beginPath();
          uctx.moveTo(ui * cellSize, 0);
          uctx.lineTo(ui * cellSize, pCanvasH);
          uctx.stroke();
          uctx.beginPath();
          uctx.moveTo(0, ui * cellSize);
          uctx.lineTo(pCanvasW, ui * cellSize);
          uctx.stroke();
        }

        // Tô đỏ các ô sai nếu có kết quả chấm
        if (errors.length > 0) {
          uctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
          uctx.strokeStyle = '#dc2626';
          uctx.lineWidth = 1.5;
          for (var ei = 0; ei < errors.length; ei++) {
            var er = errors[ei].r;
            var ec = errors[ei].c;
            uctx.fillRect(ec * cellSize, er * cellSize, cellSize, cellSize);
            uctx.strokeRect(ec * cellSize + 0.5, er * cellSize + 0.5, cellSize - 1, cellSize - 1);
          }
        }
      }

      drawUserGrid();

      // Xử lý chạm / kéo trên userCanvas
      var isDrawing = false;
      var drawMode = true; // true = tô, false = xóa

      // Ô dưới ngón tay; canvas có thể bị co nhỏ trên điện thoại nên phải quy đổi theo cỡ hiển thị
      function cellAt(clientX, clientY) {
        var rect = userCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        var c = Math.floor((clientX - rect.left) * pCanvasW / rect.width / cellSize);
        var r = Math.floor((clientY - rect.top) * pCanvasH / rect.height / cellSize);
        return (r >= 0 && r < n && c >= 0 && c < n) ? { r: r, c: c } : null;
      }

      function startAt(clientX, clientY) {
        isDrawing = true;
        var p = cellAt(clientX, clientY);
        if (!p) return;
        drawMode = !userGrid[p.r][p.c];
        userGrid[p.r][p.c] = drawMode;
        errors = [];
        drawUserGrid();
      }

      function applyPoint(clientX, clientY) {
        if (!isDrawing) return;
        var p = cellAt(clientX, clientY);
        if (p && userGrid[p.r][p.c] !== drawMode) {
          userGrid[p.r][p.c] = drawMode;
          errors = []; // Xóa đánh dấu lỗi khi em sửa
          drawUserGrid();
        }
      }

      var stopDrawing = function () { isDrawing = false; };

      if (window.PointerEvent) {
        userCanvas.addEventListener('pointerdown', function (e) {
          startAt(e.clientX, e.clientY);
          try { userCanvas.setPointerCapture(e.pointerId); } catch (err) {}
        });
        userCanvas.addEventListener('pointermove', function (e) { applyPoint(e.clientX, e.clientY); });
        userCanvas.addEventListener('pointerup', stopDrawing);
        userCanvas.addEventListener('pointercancel', stopDrawing);
      } else {
        // iPad/iPhone cũ (iOS 12 trở về trước) chưa có PointerEvent
        userCanvas.addEventListener('touchstart', function (e) {
          e.preventDefault();
          startAt(e.touches[0].clientX, e.touches[0].clientY);
        });
        userCanvas.addEventListener('touchmove', function (e) {
          e.preventDefault();
          applyPoint(e.touches[0].clientX, e.touches[0].clientY);
        });
        userCanvas.addEventListener('touchend', stopDrawing);
        userCanvas.addEventListener('mousedown', function (e) { startAt(e.clientX, e.clientY); });
        userCanvas.addEventListener('mousemove', function (e) { applyPoint(e.clientX, e.clientY); });
        document.addEventListener('mouseup', stopDrawing);
      }

      var scoreBox = h('div', { class: 'tc-practice-score' }, 'Chạm hoặc kéo ngón tay để tô các ô đen theo mẫu bên trái.');

      var gradeBtn = h('button', {
        class: 'btn btn-sm',
        onclick: function () {
          errors = [];
          var total = n * n;
          var correct = 0;
          for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
              if (userGrid[r][c] === mat.dark[r][c]) {
                correct++;
              } else {
                errors.push({ r: r, c: c });
              }
            }
          }
          var pct = Math.round((correct / total) * 100);
          drawUserGrid();

          // Thử quét chính hình em tô bằng jsQR
          var testCanvas = document.createElement('canvas');
          var quietTest = 4;
          var testCell = 8;
          var testDim = (n + quietTest * 2) * testCell;
          testCanvas.width = testDim;
          testCanvas.height = testDim;
          var tctx = testCanvas.getContext('2d');
          tctx.fillStyle = '#ffffff';
          tctx.fillRect(0, 0, testDim, testDim);
          tctx.fillStyle = '#000000';
          for (var tr = 0; tr < n; tr++) {
            for (var tc = 0; tc < n; tc++) {
              if (userGrid[tr][tc]) {
                tctx.fillRect((quietTest + tc) * testCell, (quietTest + tr) * testCell, testCell, testCell);
              }
            }
          }

          var testData = tctx.getImageData(0, 0, testDim, testDim);
          var qrRead = window.jsQR ? window.jsQR(testData.data, testDim, testDim, { inversionAttempts: 'attemptBoth' }) : null;

          if (qrRead && qrRead.data && qrRead.data.trim() === state.text.trim()) {
            scoreBox.className = 'tc-practice-score tc-sc-pass';
            scoreBox.textContent = '🎉 Đúng ' + correct + '/' + total + ' ô (' + pct + '%). 📱 Điện thoại quét được mã của em!';
          } else {
            scoreBox.className = 'tc-practice-score tc-sc-fail';
            scoreBox.textContent = 'Đúng ' + correct + '/' + total + ' ô (' + pct + '%). Các ô sai được tô đỏ – em sửa thêm nhé!';
          }
        }
      }, 'Chấm bài');

      var clearBtn = h('button', {
        class: 'btn btn-sm btn-ghost',
        onclick: function () {
          for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
              userGrid[r][c] = false;
            }
          }
          errors = [];
          drawUserGrid();
          scoreBox.className = 'tc-practice-score';
          scoreBox.textContent = 'Đã xóa lưới. Em hãy tô lại nhé.';
        }
      }, 'Xóa hết');

      var modalBody = h('div', null,
        h('p', { class: 'tc-practice-intro' }, 'Nhìn mã mẫu bên trái, chạm hoặc vuốt ngón tay trên lưới bên phải để tô các ô đen. Tô xong bấm "Chấm bài"!'),
        h('div', { class: 'tc-practice-grid-row' },
          h('div', { class: 'tc-practice-col' },
            h('h4', null, 'Mã mẫu'),
            sampleCanvas
          ),
          h('div', { class: 'tc-practice-col' },
            h('h4', null, 'Em tô ở đây'),
            userCanvas
          )
        ),
        scoreBox,
        h('div', { class: 'tc-practice-actions' }, clearBtn, gradeBtn)
      );

      modal('Luyện chép trên màn hình', modalBody, function (close) {
        return [h('button', { class: 'btn btn-ghost', onclick: close }, 'Đóng')];
      }, { wide: true });
    }

    // Bắt đầu vẽ màn hình
    renderAll();
  }

  // Xuất module ra toàn cục
  window.TTMPlay = {
    render: function (parts) {
      parts = parts || [];
      var gameId = parts[0];
      if (!gameId) {
        renderGameList();
        return;
      }
      for (var i = 0; i < GAMES.length; i++) {
        if (GAMES[i].id === gameId) {
          GAMES[i].render(parts.slice(1));
          return;
        }
      }
      go('#/tro-choi');
    }
  };

  // Mở thẳng #/tro-choi khi mới tải trang: app.js đã route() trước khi file này nạp → gọi lại
  if (/^#\/?tro-choi(\/|$)/.test(location.hash) && TTM.route) TTM.route();

})();
