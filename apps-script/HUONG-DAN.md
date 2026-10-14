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
Sau khi dán `Code.gs` mới và lưu: **Triển khai → Quản lý các bản triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai**. URL giữ nguyên, không phải sửa trang web.

## Quên mật khẩu admin
Trong Apps Script, chọn hàm **resetAdminPassword** → **Chạy**. Mật khẩu mới hiện trong Nhật ký thực thi.

## Phân quyền
| Vai trò | Được làm gì |
|---|---|
| **Admin** | Mọi việc: tạo, sửa, khóa tài khoản; đăng và xóa tài liệu ở mọi khóa |
| **Giáo viên** | Đăng và xóa tài liệu ở các khóa được gán; xem tài liệu các khóa đó |
| **Học sinh** | Xem và tải tài liệu ở các khóa được ghi danh |

Muốn các giáo viên dạy chung, chỉ cần gán họ vào cùng các khóa.

## Lưu ý
- **Không chia sẻ file Google Sheets** cho giáo viên hay học sinh. Mọi việc quản lý làm qua trang web.
- File tài liệu trong Drive để **riêng tư**. Học sinh chỉ tải được qua trang web sau khi đăng nhập đúng khóa.
- Mỗi file tối đa **20 MB**. Video nên đăng lên YouTube (Không công khai) rồi dán link.
- Mã khóa học nằm ở trang `KhoaHoc`. Muốn thêm khóa mới, thêm một dòng (mã khóa viết liền không dấu, ví dụ `toan5`).
