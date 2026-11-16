import { Fragment } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import logo from '../../assets/logo.png'
import s from '../../components/DocSheet.module.css'
import { EmojiText } from '../../components/EmojiText'
import { PayBox } from '../../components/PayBox'
import { fmtDay, fmtMoney, pad2 } from '../../lib/format'
import type { StoredImage } from '../../lib/images'
import { statusText } from '../../lib/payment'
import { orderCode } from './state'
import type { OrderContent, OrderStatus, OrderTotals } from './types'

interface Props {
  /** null = đơn chưa tạo */
  id: string | null
  createdAt: Date | null
  status: OrderStatus
  paidPercent: number | null
  content: OrderContent
  totals: OrderTotals
  tagImages: StoredImage[]
  embroideryImages: StoredImage[]
  ref?: Ref<HTMLDivElement>
}

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
const rich = (text: string) => <EmojiText text={text} emojiClassName={s.emoji} />
const FONT_VARS = { '--font-heading': '"Inter"', '--font-body': '"Inter"' } as CSSProperties

/** Phiếu đơn áo khổ A4 — xem trước = bản in (gửi khách / dán vào xưởng). Dùng chung style với bản báo giá. */
export function OrderSlip({ id, createdAt, status, paidPercent, content, totals, tagImages, embroideryImages, ref }: Props) {
  const r = content.recipient
  const recipientRows = (
    [
      ['Người nhận', r.name],
      ['Điện thoại', r.phone],
      ['Địa chỉ', r.address],
    ] as const
  ).filter(([, v]) => v.trim())
  const lines = content.items.filter((it) => it.qty > 0)
  const statusLabel = statusText(status, paidPercent)

  // Mục nào trống thì ẩn và không chiếm số thứ tự
  const blocks: { title: string; body: ReactNode; flow?: boolean }[] = []
  const contentBlock = (text: string, images: StoredImage[]) =>
    (text.trim() || images.length > 0) && (
      <div className={s.printBox}>
        {text.trim() && <div className={s.printText}>{rich(text.trim())}</div>}
        {images.length > 0 && (
          <div className={s.printImages}>
            {images.map((img) => (
              <img key={img.id} src={img.src} alt={img.name} className={images.length === 1 ? s.imgSingle : s.imgMulti} />
            ))}
          </div>
        )}
      </div>
    )
  blocks.push({
    title: 'Chi tiết áo',
    body: (
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.th}>ÁO</th>
            <th className={s.th}>SIZE</th>
            <th className={s.th}>SỐ LƯỢNG</th>
            <th className={s.th}>ĐƠN GIÁ</th>
            <th className={s.th}>THÀNH TIỀN</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? (
            lines.map((it) => (
              <tr key={it.id}>
                <td className={cx(s.td, s.left)}>
                  <div className={s.productName}>{it.name}</div>
                  <div className={s.productDetail}>Màu {it.color}</div>
                </td>
                <td className={s.td}>{it.size}</td>
                <td className={s.td}>{it.qty}</td>
                <td className={s.td}>{it.price == null ? '—' : fmtMoney(it.price)}</td>
                <td className={cx(s.td, s.semibold)}>{it.price == null ? '—' : fmtMoney(it.price * it.qty)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className={cx(s.td, s.emptyRow)}>
                Chưa có áo
              </td>
            </tr>
          )}
          <tr className={s.totalRow}>
            <td colSpan={4} className={cx(s.td, s.left)}>
              TỔNG SỐ ÁO: {totals.qty}
            </td>
            <td className={s.td}>{fmtMoney(totals.goods)}</td>
          </tr>
          {content.ship != null && (
            <tr>
              <td colSpan={4} className={cx(s.td, s.left)}>
                Phí vận chuyển
              </td>
              <td className={cx(s.td, s.semibold)}>{content.ship === 0 ? 'Miễn phí' : fmtMoney(content.ship)}</td>
            </tr>
          )}
        </tbody>
      </table>
    ),
  })
  const tag = contentBlock(content.tagContent, tagImages)
  if (tag) blocks.push({ title: 'Nội dung in tag', body: tag, flow: true })
  const embroidery = contentBlock(content.embroideryContent, embroideryImages)
  if (embroidery) blocks.push({ title: 'Nội dung thêu', body: embroidery, flow: true })
  if (content.note.trim()) {
    blocks.push({ title: 'Ghi chú', body: <div className={cx(s.printBox, s.printText)}>{rich(content.note.trim())}</div> })
  }

  return (
    <div ref={ref} className={s.root} style={FONT_VARS}>
      <img src={logo} alt="" aria-hidden="true" className={s.watermark} />

      <div className={s.header}>
        <div className={cx(s.docLabel, s.display)}>PHIẾU ĐƠN ÁO</div>
        <div className={s.meta}>
          Mã đơn: <b>{id ? orderCode(id) : '(chưa tạo)'}</b>
          {createdAt && (
            <>
              {' · '}Ngày: <b>{fmtDay(createdAt)}</b>
            </>
          )}
        </div>
      </div>

      <div className={s.titleBlock}>
        <h1 className={cx(s.title, s.display)}>ĐƠN ĐẶT ÁO</h1>
        {statusLabel && <p className={s.subtitle}>Trạng thái: {statusLabel}</p>}
      </div>

      {recipientRows.length > 0 && (
        <div className={s.customer}>
          {recipientRows.map(([k, v]) => (
            <Fragment key={k}>
              <div className={s.custKey}>{k}</div>
              <div className={cx(s.custVal, s.printText)}>{rich(v)}</div>
            </Fragment>
          ))}
        </div>
      )}

      {blocks.map((b, i) => (
        <section key={b.title} className={b.flow ? s.sectionFlow : s.section}>
          <div className={cx(s.sectionTitle, s.display)}>
            <span className={s.sectionNo}>{pad2(i + 1)}.</span> {b.title.toUpperCase()}
          </div>
          {b.body}
        </section>
      ))}

      <PayBox
        grand={totals.grand}
        note={content.ship != null && content.ship > 0 ? 'Đã bao gồm phí vận chuyển' : 'GÓC KỂ STUDIO'}
        showQr
        status={status}
        paidPercent={paidPercent}
      />

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
