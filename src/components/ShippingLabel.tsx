import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import logo from '../assets/logo.png'
import { fmtDay, fmtMoney } from '../lib/format'
import { SENDER } from '../lib/payment'
import s from './ShippingLabel.module.css'

export interface ShippingLabelData {
  /** Mã đơn / mã báo giá của shop (in nhỏ, và làm mã vạch khi chưa có mã vận đơn) */
  code: string
  carrier: string
  trackingCode: string
  recipient: { name: string; phone: string; address: string }
  /** Nội dung hàng, VD "Áo thun Đen L ×1" */
  contents: string
  /** Tiền thu hộ (phần còn lại chưa nhận); 0 = không thu */
  cod: number
  note?: string
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2 })
    } catch {
      ref.current.innerHTML = '' // ký tự không mã hoá được (VD có dấu) → chỉ in chữ
    }
  }, [value])
  return <svg ref={ref} aria-label={`Mã vạch ${value}`} />
}

/**
 * Tem vận chuyển 100 × 150 mm. Render vào <body> (ngoài #root), ẩn trên màn hình;
 * printShippingLabel() bật class printing-label để chỉ in tem này (xem index.css).
 */
export function ShippingLabel({ data }: { data: ShippingLabelData }) {
  const barcodeValue = (data.trackingCode || data.code).replace(/^#/, '').trim()
  const [printDay] = useState(() => fmtDay(new Date()))
  return createPortal(
    <div className="shipping-label-root">
      <div className={s.label}>
        <div className={s.head}>
          <div className={s.brand}>
            <img src={logo} alt="" />
            GÓC KỂ STUDIO
          </div>
          <div className={s.carrier}>{data.carrier || 'Đơn vị vận chuyển: …'}</div>
        </div>

        <div className={s.barcode}>
          {barcodeValue && <Barcode value={barcodeValue} />}
          <div className={s.code}>{data.trackingCode || data.code}</div>
        </div>

        <div className={s.box}>
          <div className={s.boxTitle}>Người nhận</div>
          <div className={s.big}>
            {data.recipient.name || '—'} · {data.recipient.phone || '—'}
          </div>
          <div className={s.address}>{data.recipient.address || '—'}</div>
        </div>

        <div className={s.box}>
          <div className={s.boxTitle}>Người gửi</div>
          {SENDER.name} · {SENDER.phone} · {SENDER.social}
        </div>

        <div className={`${s.box} ${s.grow}`}>
          <div className={s.boxTitle}>Nội dung hàng</div>
          {data.contents || '—'}
          {data.note && <div style={{ marginTop: '1mm' }}>Ghi chú: {data.note}</div>}
        </div>

        <div className={s.cod}>
          <span>{data.cod > 0 ? 'THU HỘ (COD)' : 'KHÔNG THU TIỀN'}</span>
          <span className={s.codValue}>{data.cod > 0 ? fmtMoney(data.cod) : '0đ'}</span>
        </div>

        <div className={s.foot}>
          <span>Mã đơn: {data.code}</span>
          <span>In ngày {printDay}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
