# apps-GK

React 19 + Vite 8 + TypeScript 7 + Ant Design 6 (`antd`, `@ant-design/icons`). Lint bằng oxlint. Chưa có router / state / API layer — thêm khi cần.

## Lệnh

- `npm run dev` — dev server
- `npm run build` — `tsc -b` rồi `vite build`; dùng lệnh này để kiểm tra type
- `npm run lint` — oxlint (config: `.oxlintrc.json`)

## Cấu trúc

- `src/main.tsx` — bọc app trong `ConfigProvider` (locale `vi_VN`, theme) và `<App>` của antd
- `src/theme.ts` — design token antd (`appTheme`)
- `src/App.tsx` — layout gốc: `Layout` + `Sider` + `Menu` + `Header` + `Content`
- `src/index.css` — CSS toàn cục tối thiểu; reset lấy từ `antd/dist/reset.css`

## Quy ước

- UI dùng component antd trước; chỉnh giao diện qua token trong `src/theme.ts` (hoặc `ConfigProvider` lồng nhau), không override class `.ant-*` bằng CSS.
- Gọi `message` / `notification` / `modal` qua `App.useApp()`, không dùng hàm static (`message.success(...)` import thẳng) — hàm static không nhận theme/locale từ context.
- antd 6: dùng `Flex` (hoặc `Space` với `orientation`) cho layout dọc; prop `direction` đã deprecated.
- `verbatimModuleSyntax` đang bật → import kiểu phải dùng `import type`.
- Chuỗi hiển thị cho người dùng viết bằng tiếng Việt.

## Lưu ý môi trường

- Repo này nằm trong `cms-preview/` (project khác, có Tailwind + `postcss.config.js`). `vite.config.ts` đặt `css.postcss: {}` để Vite không dò ngược lên config của thư mục cha — đừng xoá dòng đó.
- Cảnh báo chunk > 500 kB khi build là do antd nằm chung một bundle; xử lý bằng `React.lazy` theo route khi có router.
