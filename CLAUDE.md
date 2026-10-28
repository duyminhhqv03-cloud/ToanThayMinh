# Toán Thầy Minh – hướng dẫn cho Claude

## Làm việc với chủ dự án
- **Trao đổi bằng tiếng Việt**, dễ hiểu cho người không chuyên lập trình. Thao tác trên giao diện tiếng Pháp của Firebase Console thì ghi kèm tên nút tiếng Pháp.
- Việc code lớn: **giao Gemini qua Antigravity CLI** (`agy`, ở `~/.local/bin/agy`), không dùng lệnh `gemini`:
  ```bash
  agy -p "$(cat <file đặc tả>)" --model gemini-4-argon-high --dangerously-skip-permissions --sandbox
  ```
  Chạy nền, viết đặc tả chi tiết (bối cảnh, file, hàm, yêu cầu ES5, tiếng Việt, KHÔNG commit/push). Rà soát chỉ đọc thì dùng `--mode plan`. Sau đó **luôn tự đọc lại diff và chạy thử** trước khi báo — Gemini từng viết sai luật Firebase. Sửa nhỏ (vài dòng CSS/JS) thì tự làm.
- Mỗi việc làm trên **nhánh riêng** từ `main`; commit xong **hỏi trước khi gộp vào `main` và đẩy lên GitHub** (mỗi lần đều hỏi). Gộp kiểu `git merge --ff-only`.
- Commit với tác giả `Claude <noreply@anthropic.com>` (giống lịch sử repo), không đổi git config toàn máy.

## Cấu trúc
- `index.html`, `style.css`: trang giới thiệu cho phụ huynh.
- `hoc/`: Khu học tập (SPA ES5 thuần, không build) trên GitHub Pages: `app.js` (đăng nhập, khóa học, nhánh, tài liệu, bài tập về nhà theo tuần, luyện tập, học phí, tài khoản), `game.js` (Đấu cả lớp kiểu Kahoot qua Firebase), `quiz-format.js` (đọc đề dạng chữ, chấm trả lời ngắn), `config.js` (API_URL Apps Script + FIREBASE_CONFIG — các giá trị này công khai).
- `apps-script/Code.gs`: máy chủ Google Apps Script + Google Sheets. Hướng dẫn: `apps-script/HUONG-DAN.md`, `apps-script/FIREBASE.md`.
- `firebase/database.rules.json`: luật bảo mật Realtime Database (dự án Firebase `toan-thay-minh`).
- Trang thật: https://duyminhhqv03-cloud.github.io/ToanThayMinh/ (Khu học tập ở `/hoc/`).

## Quy tắc code
- ES5 (var, function; không arrow/class/let/const/template string) để chạy trên iPad/điện thoại cũ. Không dùng `replaceChildren`, `append`/`prepend` của DOM, `inset`, `color-mix` không có màu dự phòng.
- Mỗi lần đổi file trong `hoc/`, nâng số `?v=` cho mọi file trong `hoc/index.html`.
- `normAnswer/numPart/isCorrect` trong `hoc/quiz-format.js` và `normAnswer_/numPart_/isCorrect_` trong `Code.gs` **phải cho kết quả giống hệt nhau** → chạy `node tools/grade-test.js`.
- Thêm cột Sheets: luôn thêm vào CUỐI `COLUMNS.<trang>`; nhớ `LITE_COLS` nếu hàm đọc nhanh cần cột đó.
- Kiểm tra quyền phải nằm ở máy chủ (`Code.gs`), không chỉ ẩn trên giao diện.

## Triển khai
- **Web (`hoc/`, trang giới thiệu)**: gộp vào `main` + push → GitHub Pages cập nhật sau 1–2 phút (người dùng nhấn Cmd+Shift+R).
- **`Code.gs` thay đổi** → chủ dự án phải tự dán vào Apps Script và **Triển khai → Quản lý các bản triển khai → ✏️ → Phiên bản mới → Triển khai**. Chép vào bộ nhớ tạm cho họ, BẮT BUỘC đặt UTF-8 (nếu không chữ tiếng Việt bị hỏng):
  ```bash
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pbcopy < apps-script/Code.gs
  ```
  rồi kiểm tra `pbpaste | cmp - apps-script/Code.gs`.
- **Luật Firebase thay đổi** → chép `firebase/database.rules.json` vào bộ nhớ tạm như trên; chủ dự án dán ở https://console.firebase.google.com/project/toan-thay-minh/database/toan-thay-minh-default-rtdb/rules → **Publier**. Nếu luật mới không tương thích web cũ, đẩy web lên ngay sau khi dán (và báo trước việc Đấu cả lớp tạm lỗi).
- Sửa trực tiếp Google Sheets (vd cột `branches` của trang `KhoaHoc`) có thể mất tới 5 phút mới hiện vì bộ nhớ đệm máy chủ.

## Chạy thử
- `node tools/mock-server.mjs` → http://localhost:8765/hoc/ với máy chủ Apps Script giả (sửa dữ liệu giả trong file). Đặt `localStorage` `ttm_token` = `tk-teacher` / `tk-student` / `tk-student2` và `ttm_me` tương ứng. Thử Đấu cả lớp nhiều người: mở thêm tab ở `127.0.0.1:8765` và `[::1]:8765` (khác origin → khác tài khoản Firebase ẩn danh). Phòng đấu dùng Firebase THẬT — đóng/xóa phòng thử sau khi xong.
- `node tools/rules-test.mjs`: kiểm tra luật Firebase trên database thật (sau khi đã dán luật).
- `node tools/grade-test.js`: so khớp hàm chấm trả lời ngắn web ↔ máy chủ.
- Không chạy được `Code.gs` trên máy: đọc kỹ diff và kiểm tra cú pháp bằng `node --check` trên bản sao đuôi `.js`.

## Dữ liệu lớp học
- 5 lớp (trang `KhoaHoc`): Toán 4, Tiếng Việt 4, Toán & KHTN 5, Tiếng Việt & KHXH 5, Tiếng Anh 5. Ghi danh và học phí tính theo lớp.
- Nhánh trong lớp (cột `branches`): Toán 4 = Toán, Toán tiếng Anh; Toán 5 = Toán, Toán tiếng Anh, Science; Tiếng Việt 5 = Tiếng Việt, Social Sciences.
- Trang lớp: khu **Bài tập về nhà** gom theo tuần (Thứ 2 – Chủ nhật, theo hạn nộp), khu **Chủ đề** chỉ gồm tài liệu + luyện tập, chủ đề số lớn nhất lên đầu.

## Việc còn lại (từ đợt rà soát 26/10/2026)
- Nhóm C: nút xoay ảnh khi chấm, hiện/ẩn mật khẩu, bỏ tự nhảy câu trắc nghiệm, lời giải trên điện thoại khi Đấu cả lớp, chữ nhãn nhỏ trên điện thoại, hoàn tác khi đánh dấu học phí.
- Trang giới thiệu: thẻ Open Graph + favicon (ảnh xem trước khi gửi Zalo/Facebook); cập nhật khóa học theo nhánh mới; thêm trường mục tiêu, hình thức học, nút Zalo (chờ chủ dự án cung cấp thông tin).
- Tính năng đề xuất: sao chép DS chưa nộp/kết quả gửi Zalo, trang tiến độ học sinh, chép bài sang lớp khác, lịch sử trận đấu, điểm danh.
