# apps-GK

Công cụ nội bộ cho shop **Góc Kể Studio (GK)**: đăng nhập bằng Firebase, dữ liệu trên Firestore, dùng chung giữa nhân viên.

| Route | Trang |
|---|---|
| `/login` | Đăng nhập email + mật khẩu (không có đăng ký) |
| `/` | Tổng quan (Dashboard): số liệu, biểu đồ doanh thu, trạng thái, sản phẩm, việc cần gửi hàng |
| `/bao-gia`, `/bao-gia/moi`, `/bao-gia/:id` | Báo giá mác áo rời — port từ `D:\powerpoint\index.html` |
| `/bao-gia/:id/mau-cau` | File mẫu câu của báo giá (tờ A4 ô 4×3cm) — port từ `D:\projects\tool tạo mẫu câu\a4-grid.html` |
| `/don-ao`, `/don-ao/moi`, `/don-ao/:id` | Đơn áo |
| `/san-pham`, `/san-pham/moi`, `/san-pham/:id` | Sản phẩm: mác áo (bảng giá theo số lượng) và áo (giá / màu / size) |

Hai bản HTML gốc là spec cho báo giá và mẫu câu. Tài nguyên thương hiệu và thông tin shop: `D:\projects\ảnh GK\CLAUDE.md`.

Stack: React 19 + Vite 8 + TypeScript 7 + Ant Design 6, react-router 7, Firebase 13 (Auth + Firestore), html-to-image, jszip, jsbarcode, dayjs. Lint: oxlint. UI và comment bằng tiếng Việt.

## Lệnh

- `npm run dev` — dev server (cần `.env.local`, xem `.env.example`)
- `npm run build` — `tsc -b` rồi `vite build`; dùng để kiểm tra type
- `npm run lint` — oxlint
- `npm run setup:firebase -- [--dry-run] [--sample] [--remove-sample]` — seed Firebase (xem `docs/firestore.md`)

## Firebase

- Project **`my-apps-7797f`, dùng chung với `D:\projects\my-apps`** (trang CV). Config web ở `.env.local` (`VITE_FIREBASE_*`, không commit). Không bao giờ đưa `FIREBASE_PRIVATE_KEY` của my-apps vào app.
- Collection `gk_members`, `gk_products`, `gk_quotes`, `gk_orders` (+ `images`). Cấu trúc, trạng thái, cách cài: **`docs/firestore.md`** — đổi field / luật thì cập nhật file đó và `scripts/setup-firebase.mjs` (dữ liệu mẫu).
- Rules: `firebase/firestore.rules` (người dùng tự dán vào Console; service account không có quyền rules). Phần `content/cv` phải giữ y như my-apps. Đổi rules → nhắc người dùng publish lại.
- Quyền: đăng nhập + có `gk_members/{email viết thường}`; `role: admin` mới ghi `gk_products`.
- Ảnh lưu trong Firestore (data URL ≤ ~900 KB/ảnh, `lib/images.ts` tự nén), không dùng Cloud Storage.
- Script seed và test E2E chạy bằng tài khoản thật; ghi vào Firebase thật cần người dùng cho phép.

## Cấu trúc

```
src/
  App.tsx                    router; trang lazy-load; RequireAuth bọc AppLayout
  auth/                      AuthProvider (onAuthStateChanged + gk_members), LoginPage, RequireAuth
  lib/                       firebase (COL), firestoreHooks, useAutosave, images, payment (trạng thái, %, ngân hàng,
                             vận chuyển), statusFields (đọc/ghi field trạng thái chung), printLabel, useShipping, format
  components/                PageShell, EditorPage, SectionCard, ListToolbar (lọc trạng thái / ngày / tìm),
                             PaymentStatus (thẻ trạng thái 3 bước + ô gọn trong bảng), ShippingCard, ShippingLabel (tem
                             100×150mm), PayBox, DocSheet.module.css (bản in A4), Form.module.css, EmojiText, MoneyInput
  features/dashboard/        stats (tính số liệu), Charts (SVG tự vẽ theo skill dataviz), DashboardPage
  features/products/         catalog (mặc định, bậc giá), repo (useProducts), ProductListPage, ProductEditorPage
  features/quote/            repo, calc, QuoteForm, QuotePreview, QuoteListPage, QuoteEditorPage
  features/sentences/        SheetPages (tờ A4 + co chữ), exportPng, SentencesPage
  features/orders/           repo, state, OrderForm, OrderSlip, OrderListPage, OrderEditorPage
```

## Quy ước

- UI dùng antd; chỉnh qua token trong `src/theme.ts`, không override `.ant-*`. Tài liệu in (báo giá, phiếu đơn, tờ A4, tem) style bằng CSS module.
- Trang mới: `PageShell` (danh sách) hoặc `EditorPage` + `SectionCard` đánh số. Màu nhấn nâu `BRAND`.
- `message` / `modal` qua `App.useApp()`. antd 6: `Flex` thay `Space direction`, `Alert title`, `suffix` thay `addonAfter`.
- `verbatimModuleSyntax` bật → `import type`. Không export hằng số từ file component (oxlint only-export-components).
- Mọi thứ không thuộc bản in gắn `no-print`. In tem dùng `printShippingLabel()` (class `printing-label` + khổ 100×150mm).
- **Tạo mới không ghi Firestore** cho tới khi bấm nút "Tạo" (`/…/moi`). Đã có thì tự lưu (`useAutosave`).
- **Ghi theo nhóm field**: nội dung (`save…Content`), trạng thái (`set…Status`), vận chuyển (`save…Shipping`, `mark…LabelPrinted`), mẫu câu ghi `printContent` (`savePrintContent`). Đừng gộp — ghi đè thay đổi của người khác và vướng rules khoá.
- Trang sửa tải document **một lần** (`useDocOnce`); danh sách dùng `onSnapshot`. Query/ref truyền vào hook phải `useMemo`.
- Danh sách mặc định lọc **hôm nay**; Dashboard mặc định **30 ngày qua**.

## Trạng thái

`unpaid` → `paid` (+ `paidPercent`) → `shipped`, chỉ đi tới (`canSelectStatus`, rules `validStatusChange`). UI: `PaymentStatusCard` (trang sửa: 3 bước + đúng 1 nút việc kế tiếp) và `PaymentStatusCompact` (bảng). Báo giá khoá từ `paid`, đơn áo khoá ở `shipped`. Đã gửi → thẻ Vận chuyển + "In mã vận chuyển" (tem có mã vạch, thu hộ = phần còn lại), in xong ghi `shipping.printedAt`.

## Sản phẩm & giá

- Mác áo: bảng giá theo **tổng số lượng từng loại tag** (`tiers`, `tierIndex` / `tierLabel` trong `products/catalog.ts`). Báo giá chụp bảng giá lúc tạo (`products`), nút "Lấy bảng giá mới nhất". Gõ đơn giá = giá nhập tay (`manual`).
- Áo: đơn lưu `productId` + `name` lúc đặt. Chưa có sản phẩm trên Firestore (hoặc không đọc được) → `FALLBACK_PRODUCTS`.
- Logo `src/assets/logo.png`, QR `src/assets/qr.jpg` = ảnh nhúng của bản gốc (`LOGO_SRC`, `QR_SRC`). `BANK` (lib/payment.ts) phải khớp QR.

## Mẫu câu

- Lấy trực tiếp từ `printContent` của báo giá (`parseList`); sửa xuống dòng ở trang mẫu câu ghi ngược vào `printContent` (`serializeList`, giữ kiểu đánh số). Thêm / xoá câu làm ở báo giá. Ô ảnh = ảnh `print` của báo giá.
- Cỡ chữ 7pt → co tới 6pt (`fitText`, gán thẳng DOM trong `useLayoutEffect` — đừng thêm prop `style` cho các `<pre>`). Không tự ngắt dòng; giữ nguyên văn lời khách.
- Khổ giấy/ô/cỡ chữ: `features/sentences/constants.ts`. Xuất PNG 600 DPI có `pHYs`. Đổi logic co chữ: so từng ô với `a4-grid.html` gốc (Playwright ở `../node_modules/playwright`).

## Biểu đồ

Theo skill dataviz: bảng màu đã chạy validator (xanh/cam cho 2 nguồn, thang xanh ordinal cho 3 trạng thái, nền trắng); cột ≤ 24px, khe 2px, tooltip + focus, có bảng số liệu. Đổi màu → chạy lại validator.

## Lưu ý môi trường

- Repo nằm trong `cms-preview/` (có Tailwind + `postcss.config.js`). `vite.config.ts` đặt `css.postcss: {}` — đừng xoá.
- Font Google Fonts (`index.html`, `crossorigin` để nhúng PNG); emoji từ jsDelivr → cần mạng.
- Heredoc dài trong lệnh Bash hay lỗi với ký tự đặc biệt → ghi script ra file bằng công cụ Write rồi chạy.
