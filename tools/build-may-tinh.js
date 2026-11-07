// Gộp máy tính (may-tinh/) thành MỘT file HTML để gói vào app Bảng hình học (chạy offline trong APK).
//   node tools/build-may-tinh.js [file đích]   (mặc định: may-tinh/may-tinh-1-file.html)
// Chép file kết quả vào repo bang-hinh-hoc với tên may-tinh.html.
var fs = require('fs'), path = require('path');
var dir = path.join(__dirname, '..', 'may-tinh');
var out = process.argv[2] || path.join(dir, 'may-tinh-1-file.html');
var html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
function local(href) { return path.join(dir, href.split('?')[0]); }
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, function (m, href) {
  if (/^https?:/.test(href)) throw new Error('Không gộp được tệp ngoài: ' + href);
  return '<style>\n' + fs.readFileSync(local(href), 'utf8') + '\n</style>';
});
html = html.replace(/<script([^>]*)src="([^"]+)"([^>]*)><\/script>/g, function (m, a, src) {
  if (/^https?:/.test(src)) throw new Error('Không gộp được tệp ngoài: ' + src);
  // tránh chuỗi </script> trong mã làm vỡ thẻ
  return '<script>\n' + fs.readFileSync(local(src), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
fs.writeFileSync(out, html);
console.log('Đã tạo', out, '(' + Math.round(html.length / 1024) + ' KB)');
