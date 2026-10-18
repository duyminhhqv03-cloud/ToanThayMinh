# Cài máy chủ khu học tập (Google Apps Script)

Làm một lần, khoảng 10 phút. Dùng tài khoản Google của người quản lý trung tâm. Tài liệu sẽ nằm trong Google Drive của tài khoản này.

## 1. Tạo file Google Sheets chứa dữ liệu
1. Mở **https://sheets.new** để tạo bảng tính mới.
2. Đặt tên, ví dụ: `Toán Thầy Minh – Dữ liệu`.

## 2. Dán code máy chủ
1. Trong bảng tính: **Tiện ích mở rộng → Apps Script**.
2. Xóa đoạn code mẫu `function myFunction() {...}`.
3. Mở file [`Code.gs`](Code.gs) trên GitHub, bấm nút **Copy raw file** (biểu tượng hai ô vuông), rồi dán vào trình soạn Apps Script.
4. Bấm biểu tượng **💾 Lưu**.

## 3. Chạy cài đặt lần đầu
1. Ở thanh trên cùng, ô chọn hàm: chọn **setup** → bấm **▶ Chạy**.
2. Google hỏi quyền truy cập:
   - **Xem xét quyền** → chọn tài khoản của bạn.
   - Nếu hiện "Google chưa xác minh ứng dụng này": bấm **Nâng cao** → **Đi tới … (không an toàn)**. Đây là script của chính bạn nên an toàn.
   - Bấm **Cho phép**.
3. Xem **Nhật ký thực thi** ở dưới. Dòng `ĐÃ TẠO TÀI KHOẢN ADMIN` có **mật khẩu admin**. Hãy ghi lại.

Bảng tính giờ có 4 trang: `TaiKhoan`, `KhoaHoc`, `TaiLieu`, `PhienDangNhap`. Drive có thêm thư mục `Toán Thầy Minh – Tài liệu khóa học`.

## 4. Xuất bản thành ứng dụng web
1. Bấm **Triển khai → Tùy chọn triển khai mới**.
2. Bấm biểu tượng ⚙️ cạnh "Chọn loại" → chọn **Ứng dụng web**.
3. Điền:
   - **Thực thi với tư cách:** Tôi
   - **Người có quyền truy cập:** Bất kỳ ai
4. Bấm **Triển khai**, rồi sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).

"Bất kỳ ai" chỉ có nghĩa là trang web gọi được máy chủ. Mọi thao tác vẫn bắt buộc đăng nhập và kiểm tra quyền.

## 5. Nối trang web với máy chủ
Gửi URL vừa sao chép cho Claude, hoặc tự sửa file [`hoc/config.js`](../hoc/config.js):

```js
window.API_URL = 'https://script.google.com/macros/s/…/exec';
```

## 6. Đăng nhập lần đầu
1. Mở `…/hoc/` trên trang web, đăng nhập bằng `admin` và mật khẩu ở bước 3.
2. Bấm tên ở góc phải → **Đổi mật khẩu**.
3. Vào **Tài khoản** để tạo tài khoản cho giáo viên và học sinh.

---

## Khi cập nhật code máy chủ
1. Mở [`Code.gs`](Code.gs) trên GitHub → **Copy raw file**.
2. Trong Apps Script: chọn hết code cũ (Ctrl/Cmd + A), dán code mới đè lên, bấm **💾 Lưu**.
3. **Triển khai → Quản lý các bản triển khai → ✏️ (Chỉnh sửa) → Phiên bản: Phiên bản mới → Triển khai**.

URL giữ nguyên, không phải sửa trang web. Các trang mới trong Google Sheets (`BaiTap`, `BaiNop`, `LuyenTap`, `KetQua`) tự được tạo ở lần dùng đầu, không cần chạy lại `setup`.

Nếu trang web báo "Máy chủ chưa được cập nhật bản mới" thì nghĩa là bước 3 chưa làm.

## Quên mật khẩu admin
Trong Apps Script, chọn hàm **resetAdminPassword** → **Chạy**. Mật khẩu mới hiện trong Nhật ký thực thi.

## Phân quyền
| Vai trò | Được làm gì |
|---|---|
| **Admin** | Mọi việc: tạo, sửa, khóa tài khoản; mọi thao tác của giáo viên ở mọi khóa |
| **Giáo viên** | Ở các khóa được gán: đăng tài liệu, soạn bài luyện tập, giao bài tập, chấm bài, xem kết quả |
| **Học sinh** | Ở các khóa được ghi danh: xem/tải tài liệu, làm bài luyện tập, nộp bài tập, xem điểm và nhận xét |

## Nội dung khóa học
- **Chủ đề:** mỗi tài liệu, bài luyện tập, bài tập đều có ô "Chủ đề". Gõ tên chủ đề mới hoặc chọn chủ đề có sẵn. Trang khóa học tự nhóm theo chủ đề, sắp theo số (Chủ đề 1, 2, … 10).
- **Tài liệu:** PDF và ảnh xem trực tiếp trên web (cả điện thoại), hoặc tải về.
- **Bài luyện tập:** soạn đề bằng chữ, chấm tự động, học sinh làm lại bao nhiêu lần cũng được; giáo viên thấy điểm cao nhất của từng em.
- **Bài tập về nhà** có 2 kiểu:
  - *Không có câu hỏi:* học sinh chụp ảnh / nộp file cả bài, giáo viên chấm cả bài.
  - *Có câu hỏi:* bấm **Lấy đề từ PDF** (hoặc gõ theo mẫu). Hệ thống tự tách câu và phân loại: **trắc nghiệm**, **trả lời ngắn** (máy chấm ngay khi nộp) và **tự luận** (học sinh gõ hoặc chụp ảnh riêng từng câu, giáo viên chấm từng câu). Tổng điểm = phần máy chấm + phần giáo viên chấm. Bài không có câu tự luận được chấm xong ngay khi nộp.
  - Học sinh chỉ thấy đúng/sai và điểm từng câu khi bài đã chấm xong; đáp án và lời giải chỉ hiện **sau hạn nộp**.
  - Học sinh sửa và nộp lại được cho tới khi bài được chấm. Ảnh bài nộp lưu trong thư mục Drive `Bài nộp của học sinh` của từng khóa.

## Lấy đề từ PDF
- Đánh số câu `Câu 1`, `Câu 2`… (hoặc `1.`, `2.`); lựa chọn `A.` `B.` `C.` `D.` (cùng dòng hoặc mỗi dòng một lựa chọn).
- Có thể chia phần: `PHẦN I. TRẮC NGHIỆM`, `PHẦN II. TRẢ LỜI NGẮN`, `PHẦN III. TỰ LUẬN` — câu trong phần tự luận được xếp là tự luận.
- Điểm câu ghi trong ngoặc: `Câu 5 (2 điểm).` Không ghi thì mỗi câu 1 điểm; bấm **Chia lại cho tổng = 10** để quy về thang 10.
- Đáp án đặt cuối file sau chữ `ĐÁP ÁN`, hoặc file riêng, hoặc dán vào ô. Hiểu được: `1.B 2.C 3-A`, `Câu 4: 4/5`, bảng `Câu | 1 | 2` / `Đáp án | B | C`, và lời giải nhiều dòng cho câu tự luận.
- Không đọc được: PDF ảnh scan, phông chữ cũ (.VnTime, VNI…), phân số dạng công thức chồng. Khi đó dán đề dạng chữ.
- Luôn **xem lại phần "Học sinh sẽ thấy"** trước khi bấm Giao bài.

## Mẫu soạn đề luyện tập
```
Câu 1: Kết quả của phép tính 3/4 + 1/4 là:
A. 4/8
*B. 1
C. 4/4 + 1
Giải thích: Cùng mẫu số nên cộng tử số.

Câu 2: Chu vi hình chữ nhật dài 8 cm, rộng 5 cm là bao nhiêu xăng-ti-mét?
Đáp án: 26 | 26 cm
Giải thích: (8 + 5) × 2 = 26.
```
- Dấu `*` trước chữ cái đánh dấu đáp án đúng (hoặc viết dòng `Đáp án: B`).
- Câu không có A, B, C là câu điền đáp số. Nhiều cách viết đúng thì ngăn bằng `|`. Máy chấm bỏ qua chữ hoa/thường, dấu cách, coi `0,75` = `0.75`, và chấp nhận thiếu đơn vị (`24` = `24 cm`, nhưng `24 m` ≠ `24 cm`).
- Bài tập về nhà dùng thêm câu tự luận: `Câu 3 (tự luận, 4 điểm): …` kèm `Hướng dẫn chấm: …`.

Muốn các giáo viên dạy chung, chỉ cần gán họ vào cùng các khóa.

## Lưu ý
- **Không chia sẻ file Google Sheets** cho giáo viên hay học sinh. Mọi việc quản lý làm qua trang web.
- File tài liệu trong Drive để **riêng tư**. Học sinh chỉ tải được qua trang web sau khi đăng nhập đúng khóa.
- Mỗi file tối đa **20 MB**. Video nên đăng lên YouTube (Không công khai) rồi dán link.
- Mã khóa học nằm ở trang `KhoaHoc`. Muốn thêm khóa mới, thêm một dòng (mã khóa viết liền không dấu, ví dụ `toan5`).
