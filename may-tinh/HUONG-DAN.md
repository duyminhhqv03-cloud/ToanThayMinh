# Hướng dẫn sử dụng & nhúng Máy tính Thầy Minh (Máy 880 & Máy 580)

## 1. Giới thiệu hai máy giả lập
Ứng dụng **Máy tính Thầy Minh** giả lập tách biệt hai dòng máy tính khoa học học sinh phổ thông đang sử dụng, giúp giáo viên trình chiếu và học sinh nhìn màn hình + **Nhật ký phím** để bấm theo trên máy thật:

1. **Máy 880 (`Kiểu 880` — mặc định)**:
   - Bố cục phím tròn xám đậm, phím `SHIFT` màu vàng đồng, cụm phím con trỏ chữ thập có nút `OK` ở giữa, phím cuộn trang dọc `⇑` / `⇓` bên phải.
   - Các phím hệ thống đặc trưng: `HOME`, `SETTINGS`, `BACK`, `VARIABLE`, `FUNCTION`, `CATALOG`, `TOOLS`, `FORMAT`, `⌫`, `EXE`.
   - Màn hình `HOME` gồm 13 ứng dụng (lưới 3 cột × 2 hàng mỗi trang, có thanh cuộn dọc bên phải, không đánh số): `Calculate`, `Statistics`, `Distribution`, `Spreadsheet`, `Table`, `Equation`, `Inequality`, `Complex`, `Base-N`, `Matrix`, `Vector`, `Ratio`, `Math Box`.

2. **Máy 580 (`Kiểu 580`)**:
   - Bố cục thân đen vân carbon, phím số màu trắng, hai phím `DEL` và `AC` màu xanh dương, chữ `SHIFT` màu vàng, `ALPHA` màu đỏ/hồng, cụm con trỏ bầu dục (không có nút `OK` ở giữa).
   - Các phím hệ thống đặc trưng: `SHIFT`, `ALPHA`, `MENU` (`SETUP`), `OPTN`, `CALC` (`SOLVE`), `STO` (`RECALL`), `ENG`, `S⇔D`, `M+`, `CONST`, `CONV`, `RESET`, `=`.
   - Màn hình `MENU` gồm 12 phương thức (lưới 4 cột, đánh mã `1`–`9`, `A`–`C`): `1:Calculate`, `2:Complex`, `3:Base-N`, `4:Matrix`, `5:Vector`, `6:Statistics`, `7:Distribution`, `8:Table`, `9:Equation/Func`, `A:Inequality`, `B:Verify`, `C:Ratio`.

---

## 2. Cách mở & Nhúng vào trang web / Bảng hình học

- **Mở trực tuyến:** `https://duyminhhqv03-cloud.github.io/ToanThayMinh/may-tinh/`
- **Mở ngoại tuyến (`file://`):** Mở trực tiếp tệp `may-tinh/index.html` trên máy tính, điện thoại hoặc iPad (hoạt động hoàn toàn offline, không phụ thuộc mạng hay thư viện ngoài).

### Nhúng qua `iframe`
```html
<iframe src="https://duyminhhqv03-cloud.github.io/ToanThayMinh/may-tinh/?may=880&gon=1" width="380" height="720" style="border:0" title="Máy tính Thầy Minh"></iframe>
```
Khi đặt trong `iframe` (hoặc có `?gon=1`), máy tính tự động ẩn tiêu đề, thanh chuyển máy và chân trang, đồng thời tự co giãn (`transform: scale`) vừa khít khung chứa.

### Bảng tham số URL
| Tham số | Giá trị | Ý nghĩa |
| :--- | :--- | :--- |
| `may` | `880` hoặc `580` | Chọn **Máy 880** (`880`, mặc định) hoặc **Máy 580** (`580`). |
| `kieu` | `a` hoặc `b` | Tham số tương thích ngược: `a` → Máy `580`, `b` → Máy `880`. |
| `gon` | `1` hoặc `0` | `1`: Ẩn tiêu đề, thanh chuyển máy và chân trang (tự động bật khi nhúng trong `iframe`). `0`: Hiện đầy đủ. |
| `nhatky` | `1` hoặc `0` | `1`: Hiện dải **Nhật ký phím** dưới màn hình (mặc định). `0`: Ẩn dải nhật ký phím. |
| `nen` | `trong-suot` | Đặt nền trang trong suốt (`transparent`) để hòa vào nền của Bảng hình học. |

---

## 3. Giao tiếp hai chiều với trang cha (`postMessage`)

### a) Nhận kết quả từ máy tính gửi lên trang cha
Mỗi khi bấm `EXE` / `=` (hoặc giải xong `SOLVE`), máy tính gửi thông điệp lên `window.parent`:
```javascript
window.addEventListener('message', function (event) {
  var data = event.data;
  if (!data || data.nguon !== 'may-tinh-ttm') return;

  if (data.loai === 'ket-qua') {
    console.log('Biểu thức:', data.bieuThuc);
    console.log('Giá trị số:', data.giaTri);
    console.log('Hiển thị:', data.hienThi);
  }
});
```

### b) Gửi lệnh từ Bảng hình học vào máy tính
```javascript
var iframeMayTinh = document.querySelector('iframe');

// Chèn số hoặc biểu thức vào vị trí con trỏ của máy tính
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

## 4. Hướng dẫn thao tác trên Máy 880 (`Kiểu 880`)

1. **Chuyển ứng dụng (`HOME`)**:
   - Bấm `HOME`, dùng `▲▼◀▶` di chuyển đến ứng dụng cần mở rồi bấm `OK` (hoặc `EXE`).
2. **Đổi định dạng kết quả (`FORMAT`)**:
   - Sau khi bấm `EXE` có kết quả: bấm `FORMAT` để đổi nhanh **Chuẩn ↔ Thập phân**; bấm `SHIFT` + `FORMAT` để mở thực đơn chọn: `Standard`, `Decimal`, `Recurring Decimal`, `Improper Fraction`, `Mixed Fraction`, `Sexagesimal`, `Prime Factor`, `ENG Notation` (trong `Complex`: `a+bi`, `r∠θ`).
3. **Biến nhớ (`VARIABLE`)**:
   - Cách nhanh: bấm `SHIFT` + phím số (`4`→`A`, `5`→`B`, `6`→`C`, `1`→`D`, `2`→`E`, `3`→`F`, `0`→`x`, `.`→`y`, `×10^■`→`z`).
   - Màn hình quản lý biến: bấm `VARIABLE` → chọn biến `A`..`z` → bấm `OK` → chọn `Recall Value`, `Store` hoặc `Edit`.
4. **Hàm số `f(x)`, `g(x)` (`FUNCTION`)**:
   - Bấm `FUNCTION` → chọn `Define f(x)` hoặc `Define g(x)` để nhập biểu thức theo `x` (dùng chung với ứng dụng `Table`). Khi đang tính toán, bấm `FUNCTION` → `f(x)` để tính giá trị như `f(3)`.
5. **Danh mục hàm, hằng số, đổi đơn vị & Bảng tuần hoàn (`CATALOG`)**:
   - Bấm `CATALOG` để truy cập: `Func Analysis` (`d/dx`, `∫`, `Σ`, `Π`, `÷R`, `logab`), `Probability` (`%`, `!`, `P`, `C`, `Ran#`, `RanInt#`), `Numeric Calc` (`GCD`, `LCM`, `Abs`, `Recurring Decimal`, `Int`, `Intg`, `Rnd`), `Angle/Coord/Sexa`, `Hyperbolic/Trig`, `Engineer Symbol`, `Sci Constants` (47 hằng số khoa học), `Unit Conversions` (40 cặp đổi đơn vị), `Atomic Table` (**Bảng tuần hoàn 118 nguyên tố** `Periodic Table` & `Atomic Weight`).
6. **Kiểm chứng đúng/sai (`TOOLS` → `Verify ON`)**:
   - Trong `Calculate`, `Complex`, `Table` hoặc `Equation`, bấm `TOOLS` → `Verify ON` (trên thanh trạng thái hiện biểu tượng `✔`).
   - Nhập đẳng thức/bất đẳng thức (dấu `=` lấy từ `SHIFT + (` hoặc các dấu `=, ≠, >, <, ≥, ≤` trong `CATALOG` → `Verify`), bấm `EXE` → màn hình hiện `True` hoặc `False`.
7. **Giải phương trình tìm `x` (`Equation` → `Solver`)**:
   - `HOME` → `Equation` → `Solver`: nhập phương trình (dùng `SHIFT + (` để gõ dấu `=`), chọn biến cần giải (`Solve Target`), nhập giá trị đầu rồi chọn `Execute` → hiện nghiệm và `L−R = 0`.
8. **Hộp toán học (`Math Box`)**:
   - Gồm 4 công cụ trực quan: `Dice Roll` (Tung xúc xắc), `Coin Toss` (Tung đồng xu), `Number Line` (Biểu diễn tới 3 bất phương trình trên trục số Canvas), `Circle` (`Unit Circle` đường tròn lượng giác, `Half Circle` nửa đường tròn, `Clock` góc kim đồng hồ hiển thị giá trị chính xác $\sin, \cos, \tan$).

---

## 5. Hướng dẫn thao tác trên Máy 580 (`Kiểu 580`)

1. **Chọn phương thức (`MENU`)**:
   - Bấm `MENU`, dùng phím mũi tên + `=` hoặc bấm trực tiếp phím số/chữ `1`–`9`, `A` (phím `(−)`), `B` (phím `°′″`), `C` (phím `x⁻¹`).
2. **Cài đặt (`SHIFT` + `MENU` → `SETUP`)**:
   - Thực đơn 4 trang đánh số (chọn nhanh bằng phím số `1`–`4`, chuyển trang bằng `▲▼`): `Input/Output`, `Angle Unit`, `Number Format`, `Engineer Symbol`, `Fraction Result`, `Complex`, `Statistics`, `Table`, `Equation/Func`, `Decimal Mark`, `Digit Separator`, `Contrast`.
3. **Tùy chọn theo phương thức (`OPTN`)**:
   - Trong `Calculate`: Hàm hypebol, Đơn vị góc, Ký hiệu kỹ thuật.
   - Trong `Complex`: `Argument`, `Conjugate`, `Real Part`, `Imaginary Part`, `▸r∠θ`, `▸a+bi`.
   - Trong `Matrix` / `Vector`: tạo/sửa ma trận & vectơ, chèn `MatA`–`MatD`, `VctA`–`VctD`, `Det`, `Trn`, `Identity`, `Ref`, `Rref`, `Dot Product`, `Angle`, `Unit Vector`.
4. **Kiểm chứng (`MENU` → `B:Verify`)**:
   - Nhập biểu thức so sánh, bấm `OPTN` để chọn dấu `=`, `≠`, `>`, `<`, `≥`, `≤`, bấm `=` → màn hình hiện `TRUE` hoặc `FALSE`.
5. **Tính theo biến (`CALC`), Giải phương trình (`SHIFT` + `CALC` → `SOLVE`) & Đa câu lệnh (`:`)**:
   - Nhập biểu thức chứa biến (như `2A + 3B`), bấm `CALC` để nhập lần lượt từng biến.
   - Nhập phương trình (dấu `=` từ `ALPHA + CALC`), bấm `SHIFT + CALC` (`SOLVE`) để tìm nghiệm.
   - Nối nhiều câu lệnh bằng `ALPHA + ∫■` (`:`), bấm `=` để duyệt từng kết quả (`Disp ▲`).
6. **Hằng số (`SHIFT + 7`), Đổi đơn vị (`SHIFT + 8`) & Đặt lại máy (`SHIFT + 9`)**:
   - `SHIFT + 7 (CONST)`: chọn nhóm và hằng số khoa học bằng phím số.
   - `SHIFT + 8 (CONV)`: chọn nhóm và đơn vị cần chuyển đổi.
   - `SHIFT + 9 (RESET)`: `1:Setup Data`, `2:Memory`, `3:Initialize All`.
