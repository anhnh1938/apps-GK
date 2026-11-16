# apps-GK

Base React 19 + Vite + TypeScript + [Ant Design](https://ant.design/).

## Bắt đầu

```bash
npm install
npm run dev
```

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm run build` | Kiểm tra type và build production ra `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | Lint bằng oxlint |

## Cấu trúc

```
src/
  main.tsx    # ConfigProvider (locale vi_VN, theme) + antd App
  theme.ts    # design token antd
  App.tsx     # layout gốc (Sider + Header + Content)
  index.css   # CSS toàn cục
```
