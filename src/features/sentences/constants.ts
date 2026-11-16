import type { CSSProperties } from 'react'

// ===== Khổ giấy & ô (cm) =====
// A4 21 × 29.7cm, lề 0.5cm → vùng nội dung 20 × 28.7cm.
// Ô 4 × 3cm, GAP 0: 5 cột × 9 hàng = 45 ô/tờ — nhiều nhất có thể (GAP > 0 thì chỉ còn 4 cột).
export const PAGE_W = 21
export const PAGE_H = 29.7
export const PAD = 0.5
export const CELL_W = 4
export const CELL_H = 3
/** 0 = các ô sát nhau, chung 1 đường cắt */
export const GAP = 0

export const COLS = Math.floor((PAGE_W - 2 * PAD + GAP) / (CELL_W + GAP) + 1e-9)
export const ROWS = Math.floor((PAGE_H - 2 * PAD + GAP) / (CELL_H + GAP) + 1e-9)
export const PER_PAGE = COLS * ROWS

// ===== Chữ (giống bảng Character của Illustrator; pt CSS = pt Illustrator khi in 100%) =====
/** Cỡ chuẩn, lớn nhất */
export const MAX_PT = 7
/** Cỡ nhỏ nhất khi phải co chữ cho vừa ô */
export const MIN_PT = 6
export const STEP_PT = 0.1
/** Leading — Illustrator "Auto" = 120% cỡ chữ */
export const LEADING = 1.4
/** Tracking — đơn vị 1/1000 em */
export const TRACKING = 0
export const FONT_WEIGHT = 400
/** Ô sửa câu bên trái = vùng chữ của thẻ phóng to bấy nhiêu lần */
export const EDIT_SCALE = 1.8
/** Font iPhone (San Francisco); Inter thay khi máy không có SF Pro; PingFang SC / Microsoft YaHei cho chữ Trung */
export const CARD_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Inter", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'

/** Biến CSS dùng chung cho tờ A4 và ô sửa câu — một nguồn duy nhất là các hằng số ở trên */
export const SHEET_VARS = {
  '--page-w': `${PAGE_W}cm`,
  '--page-h': `${PAGE_H}cm`,
  '--pad': `${PAD}cm`,
  '--cell-w': `${CELL_W}cm`,
  '--cell-h': `${CELL_H}cm`,
  '--gap': `${GAP}cm`,
  '--cols': COLS,
  '--rows': ROWS,
  '--font-size': `${MAX_PT}pt`,
  '--leading': LEADING,
  '--tracking': TRACKING,
  '--font-weight': FONT_WEIGHT,
  '--edit-scale': EDIT_SCALE,
  '--card-font': CARD_FONT,
} as CSSProperties

// ===== Xuất ảnh =====
/** 600 DPI = 4962 × 7018 px mỗi tờ, đủ nét cho máy in (1200 thì file rất nặng, xuất lâu) */
export const EXPORT_DPI = 600
/** Cạnh dài nhất của ảnh thêm vào ô (px) — ô 4cm ở 600 DPI ≈ 945px */
export const MAX_CELL_IMAGE = 1600
