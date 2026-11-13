/* Nút "Cài app" cho web Toán Thầy Minh — dành cho người không rành công nghệ.
 * - Android (Chrome, Samsung…): bấm "Cài app" là hiện ngay hộp cài của máy.
 * - iPhone/iPad: Apple không cho web tự cài → hiện hướng dẫn 2 bước có hình.
 * - Mở trong Zalo/Facebook: chỉ cách mở bằng trình duyệt trước.
 * - Đã cài (đang chạy như app) hoặc đã bấm × thì không hiện nữa.
 * Viết ES5 để chạy trên máy cũ. */
(function () {
  'use strict';
  var KEY_AN = 'ttm_caiapp_an';           // thời điểm bấm ×
  var AN_NGAY = 14;                        // ẩn 14 ngày sau khi bấm ×
  var ua = navigator.userAgent || '';
  var laApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (laApp) return;

  var iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var trongApp = /Zalo|FBAN|FBAV|FB_IAB|Instagram|Line\//i.test(ua);
  var cam = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  var hoiCai = null;                       // sự kiện cài của Android/Chrome

  function daAn() {
    try { var t = +localStorage.getItem(KEY_AN) || 0; return t && (Date.now() - t) < AN_NGAY * 864e5; } catch (e) { return false; }
  }
  if (daAn()) return;

  var css = '' +
    '#caiApp{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#eafaf4;border-bottom:1px solid #cdeee1;font:500 14.5px/1.35 "Be Vietnam Pro",system-ui,sans-serif;color:#0b5c44}' +
    '#caiApp .ca-ic{font-size:22px;flex:none}' +
    '#caiApp .ca-tx{flex:1;min-width:0}' +
    '#caiApp .ca-tx b{display:block;font-weight:700}' +
    '#caiApp .ca-bt{flex:none;border:0;border-radius:999px;background:#0f9d74;color:#fff;font-family:inherit;font-weight:700;font-size:15px;line-height:1;padding:11px 16px;cursor:pointer}' +
    '#caiApp .ca-x{flex:none;border:0;background:none;color:#5b7f72;font-size:22px;line-height:1;padding:6px;cursor:pointer}' +
    '#caiHd{position:fixed;inset:0;z-index:9999;background:rgba(10,30,22,.55);display:flex;align-items:flex-end;justify-content:center;font-family:"Be Vietnam Pro",system-ui,sans-serif}' +
    '#caiHd .hd{background:#fff;color:#16302a;width:100%;max-width:460px;border-radius:18px 18px 0 0;padding:20px 20px 26px;box-shadow:0 -8px 30px rgba(0,0,0,.2);max-height:90vh;overflow:auto}' +
    '@media(min-width:600px){#caiHd{align-items:center}#caiHd .hd{border-radius:18px}}' +
    '#caiHd h3{margin:0 0 4px;font-size:19px}' +
    '#caiHd .phu{margin:0 0 14px;color:#5b6f68;font-size:14.5px}' +
    '#caiHd ol{margin:0;padding:0;list-style:none;counter-reset:b}' +
    '#caiHd li{counter-increment:b;display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid #eef2f0;font-size:16px;line-height:1.45}' +
    '#caiHd li:before{content:counter(b);flex:none;width:28px;height:28px;border-radius:50%;background:#0f9d74;color:#fff;font-weight:700;display:grid;place-items:center;font-size:15px}' +
    '#caiHd .nut{display:inline-flex;align-items:center;gap:4px;vertical-align:middle;border:1px solid #cfd8d4;border-radius:8px;padding:2px 8px;background:#f6f8f7;font-weight:600;white-space:nowrap}' +
    '#caiHd .nut svg{width:18px;height:18px}' +
    '#caiHd .dong{margin-top:16px;width:100%;border:0;border-radius:12px;background:#0f9d74;color:#fff;font-family:inherit;font-weight:700;font-size:16px;line-height:1;padding:14px;cursor:pointer}' +
    '#caiHd .mui{display:block;text-align:center;font-size:30px;line-height:1;color:#0f9d74;margin-top:8px;animation:caMui 1s ease-in-out infinite alternate}' +
    '@keyframes caMui{to{transform:translateY(6px)}}';

  var ICON_CHIASE = '<svg viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var ICON_THEM = '<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }

  function huongDan() {
    if (document.getElementById('caiHd')) return;
    var iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var noiDung;
    if (trongApp) {
      noiDung = '<h3>Mở bằng trình duyệt trước</h3>' +
        '<p class="phu">Trang đang mở bên trong Zalo/Facebook nên chưa cài được.</p><ol>' +
        '<li><span>Bấm nút <span class="nut">⋯</span> hoặc <span class="nut">⋮</span> ở góc trên bên phải.</span></li>' +
        '<li><span>Chọn <b>' + (iOS ? 'Mở bằng Safari' : 'Mở bằng trình duyệt') + '</b>.</span></li>' +
        '<li><span>Ở trang vừa mở, bấm lại nút <b>📲 Cài app</b>.</span></li></ol>';
    } else if (iOS) {
      noiDung = '<h3>Cài app Thầy Minh</h3>' +
        '<p class="phu">Chỉ 2 bước, làm một lần là xong.</p><ol>' +
        '<li><span>Bấm nút Chia sẻ <span class="nut">' + ICON_CHIASE + '</span> ' +
        (iPad ? 'ở <b>góc trên bên phải</b> màn hình.' : 'ở <b>dưới cùng</b> màn hình (giữa thanh dưới).') + '</span></li>' +
        '<li><span>Kéo xuống, chọn <span class="nut">' + ICON_THEM + ' Thêm vào MH chính</span> rồi bấm <b>Thêm</b>.</span></li></ol>' +
        '<p class="phu" style="margin-top:12px">Biểu tượng <b>Thầy Minh</b> sẽ nằm trên màn hình như các app khác.</p>' +
        (iPad ? '' : '<span class="mui">↓</span>');
    } else {
      noiDung = '<h3>Cài app Thầy Minh</h3><ol>' +
        '<li><span>Bấm nút <span class="nut">⋮</span> ở góc trên bên phải trình duyệt.</span></li>' +
        '<li><span>Chọn <b>Cài đặt ứng dụng</b> (hoặc <b>Thêm vào màn hình chính</b>).</span></li>' +
        '<li><span>Bấm <b>Cài đặt</b>.</span></li></ol>';
    }
    var hop = el('<div id="caiHd" role="dialog" aria-modal="true"><div class="hd">' + noiDung +
      '<button type="button" class="dong">Đã hiểu</button></div></div>');
    hop.addEventListener('click', function (e) { if (e.target === hop || e.target.className === 'dong') hop.parentNode.removeChild(hop); });
    document.body.appendChild(hop);
  }

  function bamCai() {
    if (hoiCai) {
      var p = hoiCai; hoiCai = null;
      p.prompt();
      if (p.userChoice) p.userChoice.then(function (r) { if (r && r.outcome === 'accepted') an(false); });
      return;
    }
    huongDan();
  }

  var dai = null;
  function an(nho) {
    if (nho) { try { localStorage.setItem(KEY_AN, String(Date.now())); } catch (e) {} }
    if (dai && dai.parentNode) dai.parentNode.removeChild(dai);
    dai = null;
  }

  function hien() {
    if (dai || !document.body) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    dai = el('<div id="caiApp" role="region" aria-label="Cài app">' +
      '<span class="ca-ic">📲</span>' +
      '<span class="ca-tx"><b>Cài app Thầy Minh</b>Mở nhanh từ màn hình, không cần tìm link.</span>' +
      '<button type="button" class="ca-bt">Cài app</button>' +
      '<button type="button" class="ca-x" aria-label="Ẩn">×</button></div>');
    dai.querySelector('.ca-bt').addEventListener('click', bamCai);
    dai.querySelector('.ca-x').addEventListener('click', function () { an(true); });
    var dau = document.querySelector('header.nav');
    if (dau && dau.parentNode) dau.parentNode.insertBefore(dai, dau.nextSibling);
    else document.body.insertBefore(dai, document.body.firstChild);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); hoiCai = e; hien();
  });
  window.addEventListener('appinstalled', function () { an(false); });

  function batDau() {
    // iPhone/iPad và trình duyệt trong Zalo/Facebook: không có hộp cài tự động → hiện ngay.
    if (iOS || trongApp) { hien(); return; }
    // Android: chờ hộp cài của máy; nếu trình duyệt không hỗ trợ thì vẫn hiện với hướng dẫn tay.
    if (cam) setTimeout(function () { hien(); }, 3500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', batDau);
  else batDau();
})();
