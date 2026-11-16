import { Fragment, useMemo } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import logo from '../../assets/logo.png'
import { EmojiText } from '../../components/EmojiText'
import { PayBox } from '../../components/PayBox'
import { fmtDate, fmtMoney, joinVi, pad2 } from '../../lib/format'
import type { PayStatus } from '../../lib/payment'
import { tierIndex, tierLabel } from '../products/catalog'
import { SheetPages } from '../sentences/SheetPages'
import { parseList } from '../sentences/state'
import { itemName, shipText } from './calc'
import type { QuoteCalc } from './calc'
import { DEFAULT_FONT, FONTS } from './constants'
import type { QuoteState } from './types'
import s from '../../components/DocSheet.module.css'

interface Props {
  state: QuoteState
  calc: QuoteCalc
  /** Trạng thái thanh toán — đã nhận một phần thì ghi đã nhận / còn lại */
  payment?: { status: PayStatus; paidPercent: number | null }
  ref?: Ref<HTMLDivElement>
}

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
const rich = (text: string) => <EmojiText text={text} emojiClassName={s.emoji} />

export function QuotePreview({ state, calc, payment, ref }: Props) {
  const font = FONTS[state.font] ?? FONTS[DEFAULT_FONT]
  const fontVars = { '--font-heading': font.heading, '--font-body': font.body } as CSSProperties

  const printText = state.printContent.trim()
  const images = state.printImages
  const hasPrint = printText !== '' || images.length > 0
  // Tách câu giống trang Mẫu câu; giữ tham chiếu khi nội dung không đổi (SheetPages đo lại cỡ chữ khi đổi)
  const sentences = useMemo(() => parseList(state.printContent), [state.printContent])
  const cellImages = useMemo(() => images.map((img) => ({ id: img.id, src: img.src, name: 'Ảnh nội dung in' })), [images])

  const tagLines = calc.lines.filter((l) => l.product)
  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))]
  const tagSizes = uniq(tagLines.map((l) => l.item.size))
  const tagColors = uniq(tagLines.map((l) => l.item.color))
  const infoLines = [
    ...(tagSizes.length ? [`Kích thước tag: ${joinVi(tagSizes)}.`] : []),
    ...(tagColors.length ? [`Màu tag: ${joinVi(tagColors)}.`] : []),
    ...state.notes
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  ]

  // Các mục được đánh số 01, 02… theo thứ tự xuất hiện; mục bị ẩn không chiếm số
  const noPrint = 2
  const noInfo = noPrint + (hasPrint ? 1 : 0)
  const noTables = noInfo + (infoLines.length ? 1 : 0)
  const sectionTitle = (no: number, text: string) => (
    <div className={cx(s.sectionTitle, s.display)}>
      <span className={s.sectionNo}>{pad2(no)}.</span> {rich(text.toUpperCase())}
    </div>
  )

  const c = state.customer
  const customerRows = (
    [
      ['Khách hàng', c.name],
      ['Điện thoại', c.phone],
      ['Địa chỉ', c.address],
    ] as const
  ).filter(([, v]) => v.trim())

  const order = (
    <section className={s.section}>
      {sectionTitle(1, 'Chi tiết đơn hàng')}
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.th}>SẢN PHẨM</th>
            <th className={s.th}>SỐ LƯỢNG</th>
            <th className={s.th}>ĐƠN GIÁ</th>
            <th className={s.th}>THÀNH TIỀN</th>
          </tr>
        </thead>
        <tbody>
          {calc.lines.length ? (
            calc.lines.map((line) => (
              <tr key={line.item.id}>
                <td className={cx(s.td, s.left)}>
                  <div className={s.productName}>{rich(itemName(line))}</div>
                  {line.product && (line.item.color || line.item.size) && (
                    <div className={s.productDetail}>
                      {[line.item.color && `Màu ${line.item.color}`, line.item.size].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </td>
                <td className={s.td}>{line.item.qty}</td>
                <td className={s.td}>{line.price == null ? 'Thương lượng' : fmtMoney(line.price)}</td>
                <td className={cx(s.td, s.semibold)}>{line.total == null ? '—' : fmtMoney(line.total)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className={cx(s.td, s.emptyRow)}>
                Chưa có sản phẩm
              </td>
            </tr>
          )}
          <tr className={s.totalRow}>
            <td colSpan={3} className={cx(s.td, s.left)}>
              TỔNG SỐ LƯỢNG: {calc.qty} CHIẾC
            </td>
            <td className={s.td}>{fmtMoney(calc.goods)}</td>
          </tr>
          {state.ship != null && (
            <tr>
              <td colSpan={3} className={cx(s.td, s.left)}>
                Phí vận chuyển
              </td>
              <td className={cx(s.td, s.semibold)}>{shipText(state.ship)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )

  // Nội dung in = các ô mẫu câu (mỗi câu / mỗi ảnh một ô, cỡ thật 4 × 3 cm, chữ tự co như trang Mẫu câu)
  const printContent = hasPrint && (
    <section className={s.sectionFlow}>
      {sectionTitle(noPrint, 'Nội dung in')}
      <div className={s.printBox}>
        <SheetPages texts={sentences} images={cellImages} layout="cards" />
      </div>
    </section>
  )

  const info = infoLines.length > 0 && (
    <section className={s.section}>
      {sectionTitle(noInfo, 'Thông tin sản phẩm')}
      <ul className={s.infoList}>
        {infoLines.map((line, i) => (
          <li key={i}>{rich(line)}</li>
        ))}
      </ul>
    </section>
  )

  // Bảng giá ít khi cần xem nên đặt cuối báo giá, sau phần thanh toán
  const priceTables: ReactNode =
    state.showPriceTables &&
    state.products.map((p, pi) => {
      const applied = calc.totals[p.id] > 0 ? tierIndex(p.tiers, calc.totals[p.id]) : -1
      return (
        <section key={p.id} className={s.section}>
          {sectionTitle(noTables + pi, `Bảng giá ${p.name}`)}
          <table className={s.table}>
            <thead>
              <tr>
                <th className={cx(s.th, s.thHalf)}>SỐ LƯỢNG</th>
                <th className={s.th}>ĐƠN GIÁ</th>
              </tr>
            </thead>
            <tbody>
              {p.tiers.map((tier, ti) => (
                <tr key={tier.min} className={ti === applied ? s.applied : undefined}>
                  <td className={cx(s.td, s.left)}>
                    {tierLabel(p.tiers, ti)}
                    {ti === applied && <span className={s.badge}>Áp dụng</span>}
                  </td>
                  <td className={s.td}>{tier.price == null ? 'Thương lượng' : `${fmtMoney(tier.price)}/chiếc`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )
    })

  const payNote =
    state.ship != null && state.ship > 0
      ? 'Đã bao gồm phí vận chuyển'
      : state.ship === 0
        ? 'Miễn phí vận chuyển'
        : 'GÓC KỂ STUDIO'

  return (
    <div ref={ref} className={s.root} style={fontVars}>
      <img src={logo} alt="" aria-hidden="true" className={s.watermark} />

      <div className={s.header}>
        <div className={cx(s.docLabel, s.display)}>BẢNG BÁO GIÁ</div>
        <div className={s.meta}>
          {state.date && (
            <>
              Ngày: <b>{fmtDate(state.date)}</b>
            </>
          )}
        </div>
      </div>

      <div className={s.titleBlock}>
        <h1 className={cx(s.title, s.display)}>{rich(state.title)}</h1>
        {state.subtitle && <p className={s.subtitle}>{rich(state.subtitle)}</p>}
      </div>

      {customerRows.length > 0 && (
        <div className={s.customer}>
          {customerRows.map(([k, v]) => (
            <Fragment key={k}>
              <div className={s.custKey}>{k}</div>
              <div className={s.custVal}>{rich(v)}</div>
            </Fragment>
          ))}
        </div>
      )}

      {order}
      {printContent}
      {info}

      <PayBox
        grand={calc.grand}
        note={payNote}
        unpriced={calc.unpriced}
        showQr={state.showPayment}
        status={payment?.status ?? 'unpaid'}
        paidPercent={payment?.paidPercent ?? null}
      />

      {priceTables}

      <div className={s.footer}>
        <strong className={cx(s.footerBrand, s.display)}>GÓC KỂ STUDIO</strong>
        <br />
        Cảm ơn bạn đã tin tưởng và lựa chọn chúng mình!
        <br />
        <i>Made with care ♡</i>
      </div>
    </div>
  )
}
