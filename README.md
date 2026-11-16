# apps-GK

Công cụ nội bộ cho **Góc Kể Studio**. Đăng nhập bằng tài khoản được cấp, dữ liệu lưu trên Firebase và dùng chung giữa mọi người.

- **Báo giá mác áo rời**: danh sách báo giá (Chưa chuyển / Đã chuyển). Mỗi báo giá: khách hàng, các dòng tag (đơn giá tự tính theo bậc số lượng), phí ship, nội dung in (chữ + ảnh); xem trước bản A4 có QR thanh toán, **In / Lưu PDF**, **Xuất PNG**.
- **Mẫu câu** (mở từ báo giá): tách danh sách lời nhắn trong "Nội dung in" thành tờ A4 ô 4×3cm (45 ô/tờ, chữ tự co 7pt → 6pt) để in và cắt; xuất PNG 600 DPI.
- **Đơn áo**: danh sách + tạo / sửa / xoá. Loại áo, màu, size, số lượng; nội dung in tag và nội dung thêu (chữ hoặc ảnh); phí ship; người nhận; trạng thái Chưa chuyển tiền → Đã chuyển tiền → Đã làm xong → Đã mang ra bưu cục. In phiếu đơn.

## Bắt đầu

```bash
npm install
cp .env.example .env.local   # điền config web Firebase (VITE_FIREBASE_*)
npm run dev
```

Lần đầu dùng cần bật đăng nhập, tạo tài khoản, cấp quyền và publish rules trên Firebase Console — làm theo [docs/firestore.md](docs/firestore.md).

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm run build` | Kiểm tra type và build production ra `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | Lint bằng oxlint |

## Công nghệ

React 19, Vite, TypeScript, [Ant Design](https://ant.design/) 6, react-router, Firebase (Auth + Firestore), html-to-image, JSZip.

Triển khai dạng SPA: máy chủ cần trả `index.html` cho mọi đường dẫn, và tên miền phải được thêm vào *Authentication → Authorized domains*.
