import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EmojiText } from '../../components/EmojiText'
import { COLS, GAP, MAX_PT, MIN_PT, PER_PAGE, SHEET_VARS, STEP_PT } from './constants'
import { clean } from './state'
import type { CellImage } from './state'
import s from './SheetPages.module.css'

export interface FitResult {
  /** Số thứ tự câu (từ 1) → cỡ chữ thực tế (pt) */
  sizes: Record<number, number>
  /** Số thứ tự các câu vẫn tràn ô ở cỡ nhỏ nhất */
  overflow: number[]
  textCount: number
  pageCount: number
}

interface Props {
  /** Nội dung từng câu theo thứ tự danh sách; câu trống bị bỏ qua (không chiếm ô) */
  texts: string[]
  /** Ô ảnh, xếp sau các câu */
  images: CellImage[]
  /** Câu đang sửa (số thứ tự từ 1) */
  activeN?: number | null
  onCellClick?: (n: number) => void
  onFit?: (result: FitResult) => void
  /**
   * `pages` (mặc định): các tờ A4 đủ ô như bản in — trang Mẫu câu.
   * `cards`: chỉ các ô có nội dung, cỡ thật, xếp liền nhau — mục "Nội dung in" của bản xem trước báo giá.
   */
  layout?: 'pages' | 'cards'
}

type Cell = { kind: 'text'; text: string; n: number } | { kind: 'image'; img: CellImage }

const px = (v: string) => parseFloat(v) || 0

/**
 * Cỡ chữ bắt đầu từ MAX_PT. Nếu trình duyệt phải tự xuống dòng thêm (có dòng dài hơn bề ngang ô)
 * hoặc chữ cao hơn ô thì co dần STEP_PT tới MIN_PT. Ở MIN_PT mà vẫn cao hơn ô → tràn.
 */
function fitText(cell: HTMLElement, text: HTMLElement) {
  const cs = getComputedStyle(cell)
  const availH = cell.getBoundingClientRect().height - px(cs.paddingTop) - px(cs.paddingBottom)
  const lines = (text.textContent ?? '').split('\n').length

  let size = MAX_PT
  const apply = () => (text.style.fontSize = `${size}pt`)
  const height = () => text.getBoundingClientRect().height
  const wrapped = () => Math.round(height() / px(getComputedStyle(text).lineHeight)) > lines
  const tooTall = () => height() > availH + 0.5

  apply()
  while (size > MIN_PT && (wrapped() || tooTall())) {
    size = Math.max(MIN_PT, Math.round((size - STEP_PT) * 10) / 10)
    apply()
  }
  return { pt: size, over: tooTall() }
}

function ImageCell({ img }: { img: CellImage }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <div className={s.missing}>Thiếu ảnh: {img.name}</div>
  return <img className={s.photo} src={img.src} alt={img.name} onError={() => setBroken(true)} />
}

/** Các tờ A4: hết ô ở tờ trước thì sang tờ mới. Mỗi tờ có `data-sheet-page` (dùng khi xuất ảnh). */
export const SheetPages = memo(function SheetPages({
  texts,
  images,
  activeN = null,
  onCellClick,
  onFit,
  layout = 'pages',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onFitRef = useRef(onFit)
  useEffect(() => {
    onFitRef.current = onFit
  })

  const cells = useMemo<Cell[]>(
    () => [
      ...texts
        .map((t, i): Cell => ({ kind: 'text', text: clean(t), n: i + 1 }))
        .filter((c) => c.kind === 'text' && c.text),
      ...images.map((img): Cell => ({ kind: 'image', img })),
    ],
    [texts, images],
  )
  const textCount = cells.filter((c) => c.kind === 'text').length
  const pageCount = Math.max(1, Math.ceil(cells.length / PER_PAGE))

  // Font web tải xong thì đo lại (cỡ chữ phụ thuộc font thật)
  const [fontsVersion, setFontsVersion] = useState(0)
  useEffect(() => {
    const bump = () => setFontsVersion((v) => v + 1)
    void document.fonts.ready.then(bump)
    document.fonts.addEventListener('loadingdone', bump)
    return () => document.fonts.removeEventListener('loadingdone', bump)
  }, [])

  // Co chữ từng ô — gán thẳng vào DOM (React không quản lý style/data-overflow của các ô này)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const sizes: Record<number, number> = {}
    const overflow: number[] = []
    root.querySelectorAll<HTMLElement>(`.${s.cell}`).forEach((cell) => {
      cell.removeAttribute('data-overflow')
      const text = cell.firstElementChild
      if (!cell.dataset.n || !(text instanceof HTMLElement)) return
      const n = Number(cell.dataset.n)
      const { pt, over } = fitText(cell, text)
      sizes[n] = pt
      if (over) {
        overflow.push(n)
        cell.setAttribute('data-overflow', '')
      }
    })
    onFitRef.current?.({ sizes, overflow, textCount, pageCount })
  }, [cells, fontsVersion, textCount, pageCount, layout])

  if (layout === 'cards') {
    return (
      <div ref={rootRef} className={s.cards} style={SHEET_VARS}>
        {cells.map((item) =>
          item.kind === 'text' ? (
            <div key={`t${item.n}`} className={s.cell} data-n={item.n}>
              <pre className={s.text}>
                <EmojiText text={item.text} emojiClassName={s.emoji} />
              </pre>
            </div>
          ) : (
            <div key={`i${item.img.id}`} className={s.cell}>
              <ImageCell img={item.img} />
            </div>
          ),
        )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      onClick={(e) => {
        const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-n]')
        if (cell) onCellClick?.(Number(cell.dataset.n))
      }}
    >
      {Array.from({ length: pageCount }, (_, p) => {
        const at = (i: number) => (i < PER_PAGE ? cells[p * PER_PAGE + i] : undefined)
        return (
          <div key={p} className={s.page} data-sheet-page="">
            {Array.from({ length: PER_PAGE }, (_, i) => {
              const item = at(i)
              const cls = [s.cell]
              // Ô sát nhau: cạnh chung với ô có nội dung bên phải/bên dưới để ô đó vẽ
              if (GAP === 0) {
                if (i % COLS < COLS - 1 && at(i + 1)) cls.push(s.noR)
                if (at(i + COLS)) cls.push(s.noB)
              }
              if (!item) cls.push(s.empty)
              if (item?.kind === 'text' && item.n === activeN) cls.push(s.active)
              return (
                <div key={i} className={cls.join(' ')} data-n={item?.kind === 'text' ? item.n : undefined}>
                  {item?.kind === 'text' && (
                    <pre className={s.text}>
                      <EmojiText text={item.text} emojiClassName={s.emoji} />
                    </pre>
                  )}
                  {item?.kind === 'image' && <ImageCell img={item.img} />}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})
