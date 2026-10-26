# Cài Firebase cho chức năng "Đấu cả lớp"

Làm một lần, khoảng 5–10 phút. Dùng tài khoản Google của trung tâm. Gói miễn phí (Spark) của Firebase dư sức cho hàng chục lớp đấu trực tiếp mỗi tháng.

## 1. Tạo dự án Firebase
1. Mở **https://console.firebase.google.com** → bấm **Create a project** (hoặc **Add project**).
2. Đặt tên dự án, ví dụ: `toan-thay-minh`.
3. Tắt Google Analytics (không cần dùng) → bấm **Create project** → **Continue**.

## 2. Bật đăng nhập ẩn danh (Anonymous sign-in)
1. Ở menu trái, vào **Build → Authentication** → bấm **Get started**.
2. Trong tab **Sign-in method**, chọn **Anonymous**.
3. Gạt công tắc **Enable** → bấm **Save**.

Nhờ đăng nhập ẩn danh, mỗi trình duyệt có một mã định danh cố định (học sinh lỡ tải lại trang vẫn vào lại đúng vị trí trong phòng) và người lạ bên ngoài không tự ý sửa dữ liệu phòng đấu được.

## 3. Tạo Realtime Database
1. Ở menu trái, vào **Build → Realtime Database** → bấm **Create Database**.
2. Chọn khu vực **Singapore (`asia-southeast1`)** để tốc độ phản hồi nhanh nhất tại Việt Nam → bấm **Next**.
3. Chọn **Start in locked mode** (chế độ khóa) → bấm **Enable**.

## 4. Cài luật bảo mật (Rules)
1. Trong trang **Realtime Database**, chuyển sang tab **Rules**.
2. Xóa toàn bộ nội dung cũ, dán toàn bộ nội dung file [`firebase/database.rules.json`](../firebase/database.rules.json) trong repo vào.
3. Bấm **Publish**.

Luật này đảm bảo:
- Chỉ giáo viên tạo phòng mới được chuyển câu, công bố đáp án, ghi điểm và đóng phòng.
- Đáp án không bao giờ nằm trên Firebase khi đang hỏi — máy giáo viên tự chấm sau khi hết giờ.
- Học sinh chỉ gửi được câu trả lời của chính mình, đúng 1 lần mỗi câu và trong thời gian cho phép.

## 5. Lấy cấu hình Web App dán vào `hoc/config.js`
1. Bấm biểu tượng **⚙️ Project Overview** (góc trên bên trái) → **Project settings**.
2. Kéo xuống mục **Your apps** → bấm biểu tượng **`</>` (Web)**.
3. Đặt tên app (ví dụ `khu-hoc-tap`), **không** cần chọn Firebase Hosting → bấm **Register app**.
4. Sao chép object `firebaseConfig` (gồm `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`…) rồi dán vào [`hoc/config.js`](../hoc/config.js):

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "toan-thay-minh.firebaseapp.com",
  databaseURL: "https://toan-thay-minh-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "toan-thay-minh",
  storageBucket: "toan-thay-minh.firebasestorage.app",
  messagingSenderId: "...",
  appId: "1:..."
};
```

5. Lưu và đẩy `hoc/config.js` lên GitHub.

## Cách dùng trên lớp
- **Soạn đề riêng cho trận đấu:** khi tạo hoặc sửa bài luyện tập, đánh dấu **🎮 Chỉ dùng để đấu cả lớp (ẩn với học sinh)** để học sinh không thấy bài và không làm trước. Đấu xong, giáo viên có thể vào **Sửa đề** rồi bỏ chọn để mở bài cho học sinh tự luyện lại.
- **Giáo viên (máy tính nối máy chiếu):** mở một bài luyện tập bất kỳ → bấm **🎮 Đấu cả lớp** → chọn thời gian mỗi câu → **Mở phòng**. Mã phòng 6 chữ số sẽ hiện to trên màn chiếu.
- **Học sinh (điện thoại / máy tính bảng):** đăng nhập Khu học tập → bấm **🎮 Đấu cả lớp** trên thanh menu → nhập mã 6 số → chờ giáo viên bấm **Bắt đầu**.
- Cuối trận, kết quả xếp hạng được tự động lưu về trang `TranDau` trong Google Sheets (nhớ cập nhật [`Code.gs`](Code.gs) bản mới theo [HUONG-DAN.md](HUONG-DAN.md)).
