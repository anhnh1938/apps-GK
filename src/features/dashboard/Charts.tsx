import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import s from './Charts.module.css'

/** Thang trục y "tròn": 0 + 4 vạch đều nhau phủ hết giá trị lớn nhất */
function niceScale(max: number) {
  if (max <= 0) return { max: 1, ticks: [0] }
  const rough = max / 4
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => st >= rough) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)
  return { max: top, ticks }
}

/** Cột: bo 4px ở đầu dữ liệu (trên), vuông ở đường gốc */
function colPath(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export interface Series {
  name: string
  color: string
}

/**
 * Cột chồng theo thời gian. Rê chuột / focus vào một cột → tooltip đủ mọi series + tổng.
 * Cột ≤ 24px, khe 2px giữa các phần, lưới mảnh. Giá trị đầy đủ còn ở bảng số liệu (Dashboard).
 */
export function StackedColumns({
  data,
  series,
  height = 260,
  format,
  formatTick,
  ariaLabel,
}: {
  data: { key: string; label: string; values: number[] }[]
  series: Series[]
  height?: number
  format: (n: number) => string
  formatTick: (n: number) => string
  ariaLabel: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const M = { top: 12, right: 8, bottom: 28, left: 56 }
  const plotW = Math.max(10, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0))
  const { max, ticks } = niceScale(Math.max(0, ...totals))
  const y = (v: number) => plotH - (v / max) * plotH
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(24, Math.max(2, band * 0.6))
  // Nhãn trục x thưa ra cho khỏi chồng nhau (mỗi nhãn ~56px)
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56))))

  const tipLeft = hover == null ? 0 : Math.min(Math.max(M.left + band * hover + band / 2 + 12, 0), Math.max(0, width - 190))

  return (
    <div ref={wrapRef} className={s.chart} style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <g transform={`translate(${M.left},${M.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} className={t === 0 ? s.baseline : s.grid} />
              <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" className={s.tick}>
                {formatTick(t)}
              </text>
            </g>
          ))}
          {hover != null && <rect className={s.band} x={band * hover} y={0} width={band} height={plotH} />}
          {data.map((d, i) => {
            const cx = band * i + band / 2
            let acc = 0
            const segs = d.values
              .map((v, si) => {
                const y0 = y(acc)
                acc += v
                return { si, v, y0, y1: y(acc) }
              })
              .filter((sg) => sg.v > 0)
            return (
              <g key={d.key} className={hover != null && hover !== i ? s.dim : undefined}>
                {segs.map((sg, k) => {
                  const gap = k > 0 ? 2 : 0 // khe 2px màu nền giữa các phần chồng
                  const h = Math.max(0, sg.y0 - sg.y1 - gap)
                  return (
                    <path
                      key={sg.si}
                      d={colPath(cx - barW / 2, sg.y1, barW, h, k === segs.length - 1 ? 4 : 0)}
                      style={{ fill: series[sg.si].color }}
                    />
                  )
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={plotH + 18} textAnchor="middle" className={s.tick}>
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
          {/* Vùng bắt chuột = cả dải cột (lớn hơn cột), có focus bằng bàn phím */}
          {data.map((d, i) => (
            <rect
              key={d.key}
              className={s.hit}
              x={band * i}
              y={0}
              width={band}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.label}: ${format(totals[i])}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </g>
      </svg>
      {hover != null && data[hover] && (
        <div className={s.tooltip} style={{ left: tipLeft }}>
          <div className={s.tipTitle}>{data[hover].label}</div>
          {series.map((se, si) => (
            <div key={se.name} className={s.tipRow}>
              <i className={s.tipKey} style={{ background: se.color }} />
              <b>{format(data[hover].values[si])}</b>
              <span>{se.name}</span>
            </div>
          ))}
          <div className={`${s.tipRow} ${s.tipTotal}`}>
            <b>{format(totals[hover])}</b>
            <span>Tổng</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function Legend({ items }: { items: Series[] }) {
  return (
    <div className={s.legend}>
      {items.map((it) => (
        <span key={it.name}>
          <i style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

/**
 * Thanh chia phần (một tổng → các phần): cao 28px, khối bo 4px, khe 2px; số in trong khối nếu đủ chỗ,
 * tên ở chú thích. Mỗi khối có title (rê chuột) đủ tên / số / %.
 */
export function SegmentedBar({
  label,
  parts,
}: {
  label: string
  parts: { name: string; value: number; color: string; ink: string }[]
}) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div className={s.segRow}>
      <div className={s.segLabel}>
        <span>{label}</span>
        <b>{total}</b>
      </div>
      <div
        className={s.segBar}
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.name} ${p.value}`).join(', ')}`}
      >
        {total === 0 ? (
          <div className={s.segEmpty} />
        ) : (
          parts
            .filter((p) => p.value > 0)
            .map((p) => {
              const pct = Math.round((p.value / total) * 100)
              return (
                <div
                  key={p.name}
                  className={s.seg}
                  style={{ flexGrow: p.value, flexBasis: 0, background: p.color, color: p.ink }}
                  title={`${p.name}: ${p.value} (${pct}%)`}
                >
                  {pct >= 12 ? p.value : ''}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

/** Thanh xếp hạng ngang, một tông màu, giá trị ở đầu thanh */
export function RankedBars({
  title,
  rows,
  unit,
  limit = 6,
}: {
  title: string
  rows: { name: string; value: number }[]
  unit: string
  limit?: number
}) {
  const top = rows.slice(0, limit)
  const max = Math.max(1, ...top.map((r) => r.value))
  return (
    <div>
      <p className={s.rankTitle}>{title}</p>
      {top.length === 0 ? (
        <div className={s.empty}>Chưa có dữ liệu trong khoảng ngày này</div>
      ) : (
        top.map((r) => (
          <div key={r.name} className={s.rankRow}>
            <span className={s.rankName} title={r.name}>
              {r.name}
            </span>
            <span className={s.rankTrack}>
              <span className={s.rankBar} style={{ width: `${(r.value / max) * 82}%` }} />
              <span className={s.rankValue}>
                {r.value.toLocaleString('vi-VN')} {unit}
              </span>
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/** Khung chứa biểu đồ — mang các biến màu (bảng màu đã kiểm bằng validator của skill dataviz) */
export function VizRoot({ children }: { children: ReactNode }) {
  return <div className={s.viz}>{children}</div>
}
