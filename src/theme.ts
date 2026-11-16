import type { ThemeConfig } from 'antd'

/** Màu thương hiệu Góc Kể Studio (lấy từ app báo giá gốc) */
export const BRAND = {
  brand: '#5B4335',
  soft: '#7D6151',
  cream: '#FAF6F0',
  sand: '#ECE2D4',
  bg: '#F5F1EB',
}

// Design token chung của app — đổi màu/bo góc/font ở đây thay vì override CSS của antd.
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.brand,
    colorLink: BRAND.brand,
    colorBgLayout: BRAND.bg,
    borderRadius: 8,
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Layout: { siderBg: '#ffffff', triggerBg: '#ffffff', triggerColor: BRAND.brand },
    Menu: { itemSelectedBg: BRAND.sand, itemSelectedColor: BRAND.brand, itemHoverBg: BRAND.cream },
    Form: { itemMarginBottom: 16, verticalLabelPadding: '0 0 4px' },
  },
}
