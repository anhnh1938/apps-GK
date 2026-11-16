# Firebase cho apps-GK

App dùng chung Firebase project **`my-apps-7797f`** với `D:\projects\my-apps` (trang CV). Mọi collection của GK có tiền tố **`gk_`** để không lẫn với dữ liệu CV.

| Dùng gì | Để làm gì |
|---|---|
| Authentication (Email/Mật khẩu) | Đăng nhập. App không có nút đăng ký — tài khoản do chủ shop tạo |
| Firestore | Sản phẩm, báo giá, đơn áo, ảnh (ảnh lưu thẳng trong Firestore, không dùng Cloud Storage vì cần gói trả phí) |

## Cài đặt nhanh bằng script (một lệnh)

`scripts/setup-firebase.mjs` tạo `gk_members`, tài khoản đăng nhập (và bật Email/Mật khẩu nếu Authentication đã "Get started"), tuỳ chọn thêm dữ liệu mẫu. Script dùng khoá service account trong `D:\projects\my-apps\.env.local`: đọc tại chỗ, không chép khoá sang repo này.

```bash
cp firebase/members.example.json firebase/members.local.json   # điền email / tên / role / mật khẩu
npm run setup:firebase -- --dry-run                             # chạy thử: chỉ đọc & báo sẽ làm gì
npm run setup:firebase                                          # làm thật
npm run setup:firebase -- --sample                              # + 4 sản phẩm mặc định, 2 báo giá, 4 đơn áo mẫu
npm run setup:firebase -- --remove-sample                       # xoá báo giá / đơn áo / sản phẩm mẫu
```

- `firebase/members.local.json` (không commit): mỗi người `{ "email", "name", "role": "admin" | "staff", "password" }`. Có tài khoản rồi thì không đổi mật khẩu; bỏ `password` nếu chỉ muốn cấp quyền.
- Khoá service account của my-apps **không có quyền quản lý rules** → script báo và bỏ qua; rules phải dán tay (bước 4 bên dưới).
- Dữ liệu mẫu có ID cố định (`chu`, `hinh`, `thun`, `polo`, `sample-quote-1..2`, `sample-order-1..4`), tên khách có "(mẫu)", field `seed: true`. Chạy lại thì ghi đè, không nhân đôi.

## Cài đặt lần đầu (làm tay trên Firebase Console)

Mở https://console.firebase.google.com → project **my-apps-7797f**.

1. **Bật đăng nhập Email/Mật khẩu** — *Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.*
2. **Tạo tài khoản** — *Authentication → Users → Add user* (email + mật khẩu) cho từng người.
3. **Cấp quyền dùng app** — *Firestore Database → Data → Start collection* `gk_members`, mỗi người một document:
   - **Document ID: email, viết thường** (VD `chushop@gmail.com`)
   - `name` (string): tên hiển thị · `role` (string): `admin` (được sửa sản phẩm / bảng giá) hoặc `staff`
4. **Publish rules** — *Firestore Database → Rules* → xoá hết, dán toàn bộ [`firebase/firestore.rules`](../firebase/firestore.rules) → **Publish**. **Mỗi lần file này đổi phải publish lại.**
5. **Sản phẩm** — đăng nhập bằng tài khoản `admin` → mục *Sản phẩm* → **Tạo sản phẩm mặc định** (hoặc thêm tay).
6. **Khi đưa app lên mạng** — *Authentication → Settings → Authorized domains → Add domain*.

> **Rules dùng chung.** Một database chỉ có một bộ rules. Deploy rules từ `D:\projects\my-apps` (file ở đó chưa có phần GK) sẽ làm app GK mất quyền. Giữ 2 file giống nhau.

## Trạng thái & khoá (báo giá và đơn áo dùng chung)

```
unpaid (Chưa nhận tiền) ──► paid (Đã nhận tiền, paidPercent %) ──► shipped (Đã mang ra bưu cục)
                        ◄──                                     ◄──   (lùi một bước khi bấm nhầm)
```

- Đi tới từng bước; **lùi được đúng một bước** (`paid → unpaid`, `shipped → paid`), không nhảy cóc (rules `validStatusChange` chặn). Đã nhận tiền / đã gửi vẫn sửa được `paidPercent`.
- Lùi `paid → unpaid`: `paidPercent = null`, xoá `statusAt.paid` / `statusAt.shipped`. Lùi `shipped → paid`: xoá `statusAt.shipped`, giữ `paidPercent` và `shipping`.
- **Báo giá khoá từ `paid`**, **đơn áo khoá ở `shipped`**: không sửa nội dung, không xoá, không thêm/xoá ảnh. Khi khoá chỉ đổi được `status`, `paidPercent`, `statusAt`, `shipping`, `updatedAt`, `updatedBy`. Lùi trạng thái về trước bước khoá thì mở khoá lại.
- Bản ghi mới luôn tạo ở `unpaid` và **chỉ được ghi khi bấm nút "Tạo"** trong form (`/bao-gia/moi`, `/don-ao/moi`).

## Cấu trúc dữ liệu

```
gk_members/{email}                  người được dùng app (tạo tay trong Console / script)
gk_products/{productId}             sản phẩm: mác áo (bảng giá theo số lượng, màu, kích thước) và áo (giá, màu, size) — chỉ admin ghi
gk_quotes/{quoteId}                 báo giá mác áo rời (file mẫu câu tách từ printContent, không lưu riêng)
  └─ images/{imageId}               kind = "print" (ảnh nội dung in — cũng là ô ảnh trên tờ mẫu câu)
gk_orders/{orderId}                 đơn áo
  └─ images/{imageId}               kind = "tag" (in tag) | "embroidery" (thêu)
```

Field chung của `gk_quotes` và `gk_orders`:

| Field | Kiểu | Ghi chú |
|---|---|---|
| `status` | string | `unpaid` · `paid` · `shipped` (dữ liệu cũ: `done` = `paid`) |
| `paidPercent` | number \| null | % đã nhận (1–100) khi đã nhận tiền |
| `statusAt` | map `{ unpaid?, paid?, shipped? }` | timestamp lúc chuyển sang từng trạng thái |
| `shipping` | map `{ carrier, trackingCode, printedAt }` | từ "Đã nhận tiền" trở đi: đơn vị vận chuyển, mã vận đơn, lúc bấm "In mã vận chuyển" (null = chưa in) |
| `totals` | map `{ qty, goods, grand }` | số lượng, tiền hàng, tổng (gồm ship) — tính sẵn khi lưu |
| `createdAt`, `updatedAt` | timestamp | giờ server |
| `createdBy`, `updatedBy` | string | email người tạo / sửa gần nhất |

### `gk_members/{email}`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `name` | string | tên hiển thị |
| `role` | string | `admin` (sửa sản phẩm) / `staff` |

### `gk_products/{productId}`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `type` | string | `tag` (mác áo) · `shirt` (áo) |
| `name` | string | |
| `active` | boolean | false = ẩn khi tạo báo giá / đơn mới |
| `tiers` | array `{ min, price }` | **mác áo**: đặt từ `min` chiếc trở lên thì đơn giá `price` (null = thương lượng); bậc đầu `min = 1` |
| `printKind` | string | **mác áo**: số lượng trên báo giá tự tính theo `text` = số câu, `image` = số ảnh của "Nội dung in". Thiếu field: `hinh` / tên có "hình" → `image`, còn lại `text` |
| `price` | number \| null | **áo**: giá 1 áo |
| `colors` | array `{ name, hex }` | cả hai loại (mác áo: màu tag; áo: màu áo). `hex` dạng `#rrggbb` cho chấm màu. Dữ liệu cũ dạng `["Đen", …]` app tự đổi (`toColors`) |
| `sizes` | array string | cả hai loại (mác áo: kích thước, VD `4 × 6 cm gấp đôi`, `3 × 5 cm`; áo: `S`, `M`…) |
| `spec`, `note` | string | mô tả, ghi chú |
| `sortOrder` | number | thứ tự trong danh sách — không có ô sửa trên form; sản phẩm mới = `Date.now()` (xếp cuối) |

### `gk_quotes/{quoteId}` — báo giá mác áo rời

| Field | Kiểu | Ghi chú |
|---|---|---|
| `customer` | map `{ name, phone, address }` | |
| `date` | string `YYYY-MM-DD` | ngày báo giá = ngày bấm "Tạo báo giá", không sửa được (Dashboard / bộ lọc ngày dùng ngày này) |
| `items` | array | `{ id, productId, name, color, size, qty, price, manual }` — `productId` = id sản phẩm mác áo hoặc `custom`; `manual` = giá nhập tay. Dòng mác áo: `qty` app tự tính lúc lưu (tag in chữ = số câu của `printContent`, tag in hình = số ảnh `print`; mỗi cách tính một dòng), `manual = false`. Chỉ dòng `custom` nhập số lượng / đơn giá tay |
| `products` | array `{ id, name, tiers, printKind, colors, sizes }` | **bản chụp** mác áo lúc tạo: bảng giá, màu tag, kích thước (đổi sản phẩm sau này không ảnh hưởng). Dữ liệu cũ dạng `prices: [5 giá]` / thiếu `colors`, `sizes` app tự đổi (màu Trắng / Be, 3 kích thước cũ) |
| `ship` | number \| null | null = không tính ship, 0 = miễn phí |
| `printContent` | string | danh sách câu cần in — nguồn duy nhất của file mẫu câu |
| `title`, `subtitle`, `notes`, `font` | string | |
| `showPriceTables`, `showPayment` | boolean | |

### `gk_orders/{orderId}` — đơn áo

| Field | Kiểu | Ghi chú |
|---|---|---|
| `recipient` | map `{ name, phone, address }` | người nhận |
| `items` | array | `{ id, productId, name, color, size, qty, price }` — `name` là tên áo lúc đặt (dữ liệu cũ: `shirtType`) |
| `tagContent`, `embroideryContent` | string | chữ in tag, chữ thêu |
| `ship` | number \| null | |
| `note` | string | |

Mã đơn hiện trên app (`#AB12CD`) là 6 ký tự cuối của `orderId`.

### `images/{imageId}`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `kind` | string | `print` (báo giá) · `tag`, `embroidery` (đơn áo) |
| `name` | string | tên file gốc |
| `src` | string | data URL, app tự nén dưới ~900 KB (1 document ≤ 1 MiB) |
| `createdAt`, `createdBy` | timestamp, string | |

Xoá báo giá / đơn áo trong app thì app xoá luôn ảnh bên dưới. Xoá tay trong Console thì nhớ xoá cả `images`.

## Chạy thử với Firebase Emulator (tuỳ chọn)

Cần Java + `npx firebase-tools emulators:start --only auth,firestore`. Đặt `VITE_FIREBASE_EMULATORS=1` trong `.env.local` để app nối vào emulator (auth :9099, firestore :8080) thay vì dữ liệu thật.
