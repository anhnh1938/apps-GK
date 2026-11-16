import qr from '../assets/qr.jpg'
import { fmtMoney } from '../lib/format'
import { BANK, paymentAmounts } from '../lib/payment'
import type { PayStatus } from '../lib/payment'
import s from './DocSheet.module.css'

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')

/**
 * Khối "Tổng thanh toán" + QR chuyển khoản của bản báo giá / phiếu đơn.
 * Đã nhận một phần → ghi đã nhận / còn lại, QR chỉ hiện số còn lại; nhận đủ → ẩn QR.
 */
export function PayBox({
  grand,
  note,
  unpriced,
  showQr,
  status,
  paidPercent,
}: {
  grand: number
  note: string
  /** Có sản phẩm giá thương lượng (tổng chưa tính) */
  unpriced?: boolean
  showQr: boolean
  status: PayStatus
  paidPercent: number | null
}) {
  const { percent, received, remaining } = paymentAmounts(grand, status, paidPercent)
  return (
    <div className={s.payBox}>
      <div className={s.payRow}>
        <div className={s.payLabel}>
          <div className={cx(s.payLabelTitle, s.display)}>TỔNG THANH TOÁN</div>
          <div className={s.payNote}>{note}</div>
        </div>
        <div className={s.grand}>{fmtMoney(grand)}</div>
      </div>
      {unpriced && <p className={s.unpriced}>* Chưa bao gồm sản phẩm có giá thương lượng.</p>}
      {received > 0 && (
        <div className={s.payDetail}>
          <span>
            Đã nhận {percent}%: <b>{fmtMoney(received)}</b>
          </span>
          <span>
            {remaining > 0 ? (
              <>
                Còn lại: <b>{fmtMoney(remaining)}</b>
              </>
            ) : (
              <b>Đã thanh toán đủ</b>
            )}
          </span>
        </div>
      )}
      {showQr && remaining > 0 && (
        <div className={s.payment}>
          <img src={qr} alt="QR thanh toán" className={s.qr} />
          <div className={s.paymentBody}>
            <div className={cx(s.paymentTitle, s.display)}>QUÉT MÃ ĐỂ THANH TOÁN</div>
            <dl className={s.bank}>
              <dt>Ngân hàng</dt>
              <dd>
                {BANK.name} <span className={s.bankFull}>– {BANK.fullName}</span>
              </dd>
              <dt>Số tài khoản</dt>
              <dd>{BANK.account}</dd>
              <dt>Chủ tài khoản</dt>
              <dd>{BANK.holder}</dd>
              <dt>Số tiền</dt>
              <dd className={s.amount}>{fmtMoney(remaining)}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
