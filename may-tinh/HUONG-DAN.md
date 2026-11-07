# Hướng dẫn sử dụng & nhúng Máy tính Thầy Minh

## 1. Cách mở máy tính
- **Mở trực tuyến (có mạng):**
  Truy cập địa chỉ:
  `https://duyminhhqv03-cloud.github.io/ToanThayMinh/may-tinh/`
- **Mở ngoại tuyến (không cần mạng):**
  Mở trực tiếp tệp `may-tinh/index.html` trên máy tính hoặc iPad (hỗ trợ giao thức `file://`, không phụ thuộc thư viện hay phông chữ trên mạng).

---

## 2. Dùng trong app Bảng hình học

App Bảng hình học (repo `bang-hinh-hoc`) đã có sẵn mục **Bảng chọn (☰) → Máy tính**: mở khung máy tính nổi,
kéo thanh tiêu đề để di chuyển, nút ⤢ để phóng to/thu nhỏ, × để đóng. Máy tính được gói kèm trong app
(file `may-tinh.html`), nên **chạy được cả khi không có mạng** trong bản APK.

**Khi sửa máy tính và muốn cập nhật vào Bảng hình học:**
1. Trong repo ToanThayMinh chạy `node tools/build-may-tinh.js` → tạo `may-tinh/may-tinh-1-file.html`
   (gộp toàn bộ máy tính thành một file).
2. Chép file đó vào repo `bang-hinh-hoc` với tên `may-tinh.html` (GitHub: Add file → Upload files).
   Đẩy vào `main` thì GitHub tự build APK mới.

### Nhúng vào trang web khác (qua `iframe`)

Dán đoạn mã HTML sau vào trang:

```html
<iframe src="https://duyminhhqv03-cloud.github.io/ToanThayMinh/may-tinh/?gon=1" width="380" height="720" style="border:0" title="Máy tính"></iframe>
```

Khi đặt trong `iframe`, máy tính tự động nhận biết (`window.self !== window.top`), ẩn tiêu đề/chân trang và tự co giãn (`transform: scale`) vừa khít khung chứa (kể cả khung nhỏ `320×560` hay lớn hơn) mà không sinh thanh cuộn ngang.

---

## 3. Bảng tham số URL

Có thể ghép các tham số sau vào địa chỉ URL (ví dụ `?kieu=b&gon=1&nhatky=1&nen=trong-suot`):

| Tham số | Giá trị | Ý nghĩa |
| :--- | :--- | :--- |
| `kieu` | `a` hoặc `b` | Chọn giao diện **Kiểu A** (tông xám đen, 12 ứng dụng) hoặc **Kiểu B** (tông xanh đậm, có thêm Hộp toán học & Thuật toán). Mặc định: `a`. |
| `gon` | `1` hoặc `0` | `1`: Ẩn tiêu đề và chân trang (tự động bật khi nhúng trong `iframe`). `0`: Luôn hiện đầy đủ. |
| `nhatky` | `1` hoặc `0` | `1`: Hiện dải **Nhật ký phím** dưới màn hình (mặc định). `0`: Ẩn dải nhật ký phím. |
| `nen` | `trong-suot` | Đặt nền trang trong suốt (`transparent`) để hòa vào nền của ứng dụng bảng hình học. |

---

## 4. Giao tiếp hai chiều với trang cha (`postMessage`)

### a) Nhận kết quả từ máy tính gửi lên trang cha
Mỗi khi bấm `=` (hoặc giải xong `SOLVE`), máy tính gửi thông điệp lên `window.parent`:

```javascript
window.addEventListener('message', function (event) {
  var data = event.data;
  if (!data || data.nguon !== 'may-tinh-ttm') return;

  if (data.loai === 'ket-qua') {
    console.log('Biểu thức:', data.bieuThuc); // Ví dụ: "frac((1),(2))+frac((1),(3))"
    console.log('Giá trị số:', data.giaTri);  // Ví dụ: 0.8333333333333334
    console.log('Hiển thị:', data.hienThi);   // Ví dụ: "5/6"
  }
});
```

### b) Gửi lệnh từ Bảng hình học vào máy tính
Trang cha có thể chèn số đo đoạn thẳng/góc vào máy tính hoặc xóa màn hình máy tính:

```javascript
var iframeMayTinh = document.querySelector('iframe');

// Chèn một số hoặc biểu thức vào vị trí con trỏ của máy tính
iframeMayTinh.contentWindow.postMessage({
  nguon: 'bang-hinh-hoc',
  lenh: 'nhap',
  vanBan: '3.5'
}, '*');

// Xóa trắng màn hình máy tính (tương đương bấm AC)
iframeMayTinh.contentWindow.postMessage({
  nguon: 'bang-hinh-hoc',
  lenh: 'ac'
}, '*');
```

---

## 5. Bảng phím tắt trên bàn phím máy tính

Khi dùng trên máy tính để bàn/laptop, có thể gõ trực tiếp bàn phím cứng (các phím bấm vẫn được ghi vào **Nhật ký phím**):

| Phím bàn phím cứng | Chức năng trên máy tính |
| :--- | :--- |
| `0` – `9`, `.`, `,` | Nhập chữ số, dấu chấm thập phân, dấu phẩy ngăn cách đối số |
| `+`, `-`, `*`, `/` | Cộng, trừ, nhân (`×`), tạo phân số (`■/□`) |
| `^` | Lũy thừa (`x^■`) |
| `(`, `)` | Mở ngoặc, đóng ngoặc |
| `Enter` hoặc `=` | Tính kết quả (`=`) |
| `Backspace` / `Delete` | Xóa ký tự trước con trỏ (`DEL`) |
| `Escape` (`Esc`) | Xóa toàn bộ (`AC`) |
| `◀` `▶` `▲` `▼` (Mũi tên) | Di chuyển con trỏ giữa các ô tử/mẫu/mũ và duyệt lịch sử phép tính |
| `s`, `c`, `t`, `l` | Chèn nhanh `sin(`, `cos(`, `tan(`, `ln(` |
| `r`, `p` | Chèn nhanh căn bậc hai `√■`, hằng số `π` |
| `x`, `y`, `i` | Chèn biến `x`, `y`, đơn vị ảo `i` |
| `!`, `%` | Giai thừa (`!`), phần trăm (`%`) |

---

## 6. Danh sách chức năng giai đoạn 1

1. **Tính toán (Math I/O & Line I/O)**:
   - Nhập biểu thức tự nhiên như sách giáo khoa: phân số, hỗn số, căn bậc hai, căn bậc $n$, lũy thừa, $\log_a b$, trị tuyệt đối $|x|$, tích phân $\int_a^b f(x)\,\mathrm{d}x$, đạo hàm $\frac{\mathrm{d}}{\mathrm{d}x}$, tổng $\sum$, tích $\prod$.
   - Nhận dạng kết quả chính xác: phân số tối giản, hỗn số, căn thức $a\sqrt{b}/c$, dạng nghiệm bậc hai $p/q \pm a\sqrt{b}/c$, bội của $\pi$, số thập phân tuần hoàn $0.(3)$.
   - Đổi dạng hiển thị qua lại bằng `S⇔D`, hỗn số `SHIFT + S⇔D`, độ-phút-giây `°'"`, phân tích thừa số nguyên tố `FACT`, ký hiệu kỹ thuật `ENG`.
   - Biến nhớ `A`–`F`, `x`, `y`, `M`, `Ans`, `PreAns`; tính giá trị biểu thức theo biến `CALC`; tìm nghiệm số học `SOLVE`.
   - Lưu lịch sử 30 phép tính gần nhất; dải **Nhật ký phím** tự gộp `SHIFT`/`ALPHA` phục vụ trình chiếu trên lớp.
2. **Phương trình / Hệ phương trình (`9`)**:
   - Hệ phương trình tuyến tính 2, 3, 4 ẩn (báo nghiệm chính xác, Vô nghiệm, Vô số nghiệm).
   - Phương trình đa thức bậc 2, 3, 4 (kể cả nghiệm phức $a+bi$ và tọa độ đỉnh cực trị parabol bậc 2).
3. **Bất phương trình (`A`)**:
   - Bất phương trình đa thức bậc 2, 3, 4 với các dấu `>`, `<`, `≥`, `≤`.
4. **Bảng giá trị (`B`)**:
   - Lập bảng giá trị cho $f(x)$ và $g(x)$ (tối đa 45 dòng), cho phép sửa trực tiếp giá trị $x$ trên từng dòng.
5. **Thống kê (`6`)**:
   - Thống kê 1 biến ($\bar{x}, \sum x, \sum x^2, \sigma_x, s_x, \min, Q_1, \text{Med}, Q_3, \max, \text{Mode}$).
   - Thống kê 2 biến và 7 mô hình hồi quy (tuyến tính, bậc hai, logarit, mũ $e$, mũ $a\cdot b^x$, lũy thừa, nghịch đảo) kèm ước lượng $\hat{x}, \hat{y}$.
6. **Tỉ lệ thức (`C`)**:
   - Giải nhanh $A:B = X:D$ và $A:B = C:X$.
7. **Cài đặt (`SETUP`)**:
   - Lưu tự động vào `localStorage`: đơn vị góc, định dạng số, chế độ nhập, dạng số phức (`a+bi` / `r∠θ`), kiểu máy A/B, cỡ chữ màn hình.

---

## 7. Các ứng dụng mới (Giai đoạn 2)

1. **Số phức (`MENU` → `2`)**:
   - Tính toán biểu thức phức tự nhiên với đơn vị ảo `i` (bấm `ENG` hoặc `ALPHA + ENG`) và góc cực `∠` (`SHIFT + ENG` hoặc `ALPHA + FACT`). `OPTN` cung cấp: Đối số (`Arg`), Liên hợp (`Conjg`), Phần thực (`ReP`), Phần ảo (`ImP`), Mô-đun (`|z|`), đổi dạng `▶r∠θ` và `▶a+bi`.
   - *Ví dụ bấm phím:* `MENU` → `2` → `(` `1` `+` `ENG` `)` `x²` `=` → Kết quả: `2i` (bấm `OPTN` → `8` `=` để đổi sang dạng cực `2∠90`).

2. **Cơ số N (`MENU` → `3`)**:
   - Tính toán số nguyên 32-bit bù 2 trong các hệ đếm `DEC` (phím `x²`), `HEX` (`x^■`), `BIN` (`log`), `OCT` (`ln`); nhập chữ số `A`–`F`, phép toán logic bit (`and, or, xor, xnor, not, neg`) và tiền tố `d, h, b, o` qua `OPTN`; kèm bảng đối chiếu 4 cơ số trực tiếp dưới màn hình.
   - *Ví dụ bấm phím:* `MENU` → `3` → `x^■` (chọn HEX) → `tan` (`F`) `tan` (`F`) `+` `1` `=` → Kết quả: `100` (HEX), bảng đối chiếu hiện đồng thời `DEC: 256`, `BIN: 100000000`, `OCT: 400`.

3. **Ma trận (`MENU` → `4`)**:
   - Tạo và sửa 4 ma trận `MatA`–`MatD` (kích thước từ `1×1` đến `4×4`) và `MatAns`. Tính toán cộng, trừ, nhân, lũy thừa, nghịch đảo `MatA⁻¹`, định thức `det(`, chuyển vị `Trn(`, bậc thang `Ref(`, bậc thang rút gọn `Rref(`, ma trận đơn vị `Identity(`.
   - *Ví dụ bấm phím:* `MENU` → `4` → `5` (vào màn tính toán, mặc định `MatA = [[1,2],[3,4]]`) → `AC` → `OPTN` → `6` (`det(`) → `OPTN` → `1` (`MatA`) → `)` `=` → Kết quả: `-2`.

4. **Vectơ (`MENU` → `5`)**:
   - Tạo và sửa 4 vectơ `VctA`–`VctD` (2D hoặc 3D) và `VctAns`. Tính cộng, trừ, nhân vô hướng `·` (`Dot`), tích có hướng `×`, độ dài `Abs(`, góc giữa hai vectơ `Angle(`, vectơ đơn vị `UnitV(`.
   - *Ví dụ bấm phím:* `MENU` → `5` → `5` (màn tính toán với `VctA=[1,2,3], VctB=[4,5,6]`) → `=` (tính `VctA·VctB`) → Kết quả: `32`.

5. **Phân phối xác suất (`MENU` → `7`)**:
   - Gồm 7 hàm phân phối: Chuẩn PD (`Normal PD`), Chuẩn tích lũy CD (`Normal CD`), Nghịch đảo chuẩn (`Inverse Normal`), Nhị thức PD (`Binomial PD`), Nhị thức CD (`Binomial CD`), `Poisson PD`, `Poisson CD`; hỗ trợ tính theo một giá trị (**Biến**) hoặc bảng nhiều giá trị (**Danh sách**).
   - *Ví dụ bấm phím:* `MENU` → `7` → `2` (Phân phối chuẩn CD) → nhập `Lower = -1` `=` `Upper = 1` `=` `σ = 1` `=` `μ = 0` `=` → Kết quả: `P = 0.6826894921`.

6. **Bảng tính (`MENU` → `8`)**:
   - Bảng tính 45 hàng × 5 cột (`A`–`E`), hỗ trợ công thức bắt đầu bằng `=` (`ALPHA + CALC` hoặc nút `[=]`), tham chiếu ô, dải ô `A1:A5`, các hàm `Sum(`, `Mean(`, `Min(`, `Max(`, **Điền công thức** (tự dịch địa chỉ tương đối), **Điền giá trị**, bật/tắt tự tính lại và phát hiện tham chiếu vòng.
   - *Ví dụ bấm phím:* `MENU` → `8` (ô `A1=2`, `A2=3`, `B1==A1+A2` đang hiện `5`) → tại ô `A1` gõ `1` `0` `=` → ô `B1` tự động cập nhật thành `13`.

7. **Hộp toán học (`MENU` → `D`, chỉ có ở Kiểu B)**:
   - Mô phỏng **Tung xúc xắc** (1–3 con, 1–250 lần thử) và **Tung đồng xu** (1–3 đồng, 1–250 lần thử); thống kê bảng Tổng / Số mặt ngửa, Tần số, Tần suất tương đối kèm **biểu đồ cột trực quan bằng CSS** và nút **Thử lại**.
   - *Ví dụ bấm phím:* Mở Kiểu B (`?kieu=b` hoặc đổi trong `SETUP` mục `7`) → `MENU` → `sin` (`D`) → `1` (Tung xúc xắc) → nhập `50` `=` `2` (2 con xúc xắc) → Xem bảng tần số và biểu đồ cột, bấm `=` để thử lại.

8. **Thuật toán (`MENU` → `E`, chỉ có ở Kiểu B)**:
   - Soạn chương trình bằng các khối lệnh tiếng Việt (`Nhập biến`, `Gán :=`, `In ra`, `Lặp lại n lần`, `Lặp khi`, `Nếu ... thì ...`) và các lệnh **Rùa vẽ hình trên Canvas** (`Đi tới`, `Quay trái`, `Đi đến (x,y)`, `Nhấc/Hạ bút`); có sẵn chương trình mẫu in bình phương và vẽ đa giác/ngôi sao.
   - *Ví dụ bấm phím:* Ở Kiểu B → `MENU` → `cos` (`E`) → bấm `=` (hoặc `CALC`) để chạy chương trình mẫu in bình phương `1..5` → Kết quả in ra 5 dòng: `1, 4, 9, 16, 25` (hoặc bấm `OPTN` → `DMS` (`B`) → `=` để xem Rùa vẽ hình vuông trên Canvas).
