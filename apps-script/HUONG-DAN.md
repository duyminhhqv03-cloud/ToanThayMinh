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

URL giữ nguyên, không phải sửa trang web. Các trang mới trong Google Sheets (`BaiTap`, `BaiNop`, `LuyenTap`, `KetQua`, `HocPhi`) tự được tạo ở lần dùng đầu, không cần chạy lại `setup`.

Nếu trang web báo "Máy chủ chưa được cập nhật bản mới" thì nghĩa là bước 3 chưa làm.

## Thống kê & học phí (chỉ admin)
- Menu **Học phí**: sĩ số từng lớp (chỉ đếm học sinh đang mở tài khoản) và danh sách đóng học phí theo tháng.
- Bấm **Chưa đóng** cạnh tên học sinh để đánh dấu đã đóng. Bấm vào ô **Đã đóng** để thêm ghi chú hoặc bỏ đánh dấu.
- Học phí tính riêng từng lớp: em học 2 lớp có 2 ô.
- **Sao chép DS chưa đóng** để dán vào Zalo nhắc phụ huynh. **Tải bảng (Excel)** tải file CSV mở bằng Excel.
- Học sinh thấy học phí tháng này của chính em ở trang chủ (đã đóng / chưa đóng).
- Dữ liệu nằm ở trang `HocPhi`: mỗi dòng là một lượt đã đóng (học sinh, lớp, tháng). Xóa dòng = chưa đóng.

## Gemini gợi ý điểm bài tự luận
Gemini đọc ảnh bài làm, đề, đáp án và **Hướng dẫn chấm** của từng câu tự luận. Sau đó Gemini điền sẵn điểm và nhận xét vào màn chấm. Điểm **chưa được lưu**: thầy xem lại, sửa nếu cần rồi bấm **Lưu điểm** như bình thường. Học sinh không thấy gợi ý của Gemini, chỉ thấy điểm và nhận xét thầy đã lưu.

Cài một lần:
1. Vào **aistudio.google.com** bằng tài khoản Google của web, bấm **Get API key → Create API key**, rồi sao chép khóa.
2. Trong Apps Script, vào **⚙️ Cài đặt dự án → Thuộc tính tập lệnh → Thêm thuộc tính**. Đặt tên `GEMINI_API_KEY` và dán khóa vào ô giá trị.
3. Dán Code.gs mới vào trình soạn. Chọn hàm **`kiemTraGemini`** ở thanh trên rồi bấm **▶ Chạy**. Lần đầu Google sẽ hỏi quyền *kết nối với dịch vụ bên ngoài*, thầy bấm cho phép. Nhật ký hiện "Gemini hoạt động…" là xong.
4. Triển khai **Phiên bản mới** như mục *Khi cập nhật code máy chủ*.

Dùng: mở bài cần chấm, bấm **✨ Gemini gợi ý điểm**. Mỗi lần Gemini đọc bài mất khoảng 10–60 giây. Câu nào có nhãn **Cần xem kỹ** thì thầy tự xem lại, thường do ảnh mờ hoặc Gemini không chắc.

Lưu ý:
- Hướng dẫn chấm càng rõ thì Gemini chấm càng sát, ví dụ: *đúng phép tính 2đ, đúng đáp số 1đ, thiếu đơn vị trừ 0,5đ*.
- Ảnh hoặc file trên 7 MB, hay file không phải ảnh/PDF, sẽ không được gửi cho Gemini. Màn chấm sẽ báo khi có file như vậy.
- Tên học sinh không được gửi cho Gemini. Với **gói miễn phí**, Google dùng dữ liệu gửi lên (gồm ảnh bài làm) để cải thiện sản phẩm và có thể cho người xem xét đọc. **Gói trả phí** thì không. Vì đây là bài làm của trẻ em, nên bật thanh toán cho khóa trong AI Studio (chấm vài trăm bài mỗi tháng tốn rất ít).
- Điều khoản Gemini API yêu cầu người dùng từ 18 tuổi và không dùng trong ứng dụng hướng tới người dưới 18 tuổi. Ở web này chỉ giáo viên/admin bấm được nút Gemini, học sinh không gọi được — thầy tự cân nhắc điều khoản này.
- Báo "hết lượt" nghĩa là đã vượt giới hạn của gói miễn phí, thầy đợi vài phút rồi bấm lại.
- Gemini mặc định "suy nghĩ" ở mức thấp (`low`) cho nhanh. Muốn chấm kỹ hơn nhưng chậm hơn thì thêm thuộc tính `GEMINI_THINKING` = `medium` hoặc `high`.
- Mặc định web dùng mô hình `gemini-3.6-flash` (bản 3.8 mới hơn nhưng trả lời rất chậm, có khi vài phút). Muốn đổi mô hình thì thêm thuộc tính `GEMINI_MODEL`, ví dụ `gemini-flash-latest` (luôn là bản Flash mới nhất).

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
- **Hình vẽ, bảng** (ảnh chèn, hình vẽ bằng nét, bảng kẻ) được tự cắt và gắn vào đúng câu — hình nằm giữa "Câu k" và "Câu k+1" thuộc về câu k. Trong ô soạn đề, hình hiện thành dòng `[Hình: …]`.
- Dưới mỗi câu ở phần xem trước có nút **🖼 Thêm hình / Đổi hình / Bỏ hình** để tự chèn hình (ảnh chụp, ảnh cắt màn hình) khi máy không tự nhận ra. Dùng được cho cả bài luyện tập.
- Hình ở **đầu trang**, trước nhóm câu (kiểu "Quan sát hình, trả lời câu 11–15" / "answer Questions 11–15") được gắn cho **cả nhóm câu**, lời dẫn đặt lên đầu câu đầu nhóm.
- Đầu trang / chân trang lặp lại, số trang, dải nền màu của tiêu đề phần được tự bỏ qua; chữ nằm trong hình không bị lẫn vào câu hỏi.
- Điểm ghi ở tiêu đề phần (`PHẦN I … (4 điểm)`, `Questions 1–5 • 5 marks`) được chia đều cho các câu trong phần.
- Hình được lưu trong thư mục Drive `Hình trong đề` của từng khóa.
- Không đọc được chữ: PDF ảnh scan, phông chữ cũ (.VnTime, VNI…), phân số dạng công thức chồng. Khi đó dán đề dạng chữ rồi dùng nút Thêm hình.
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
