import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, App, Button, Flex, InputNumber, Modal, Segmented, Steps, Tag, Typography } from 'antd'
import { CarOutlined, CheckOutlined, DollarOutlined, EditOutlined, RollbackOutlined } from '@ant-design/icons'
import { fmtDateTime, fmtMoney } from '../lib/format'
import { PAY_STATUSES, PERCENT_PRESETS, PREV_STATUS, paymentAmounts, percentOf, statusColor, statusText } from '../lib/payment'
import type { PayStatus } from '../lib/payment'
import { SectionCard } from './SectionCard'

const { Text } = Typography

const statusLabel = (s: PayStatus) => PAY_STATUSES.find((x) => x.value === s)?.label ?? s

export interface PaymentValue {
  status: PayStatus
  paidPercent: number | null
}

/**
 * Các thao tác trạng thái — mỗi cái một lệnh ghi riêng (xem lib/statusFields.ts).
 * Hàm tự báo lỗi cho người dùng rồi ném lỗi lại (để hộp thoại không đóng khi ghi hỏng).
 */
export interface PaymentActions {
  /** Chưa nhận tiền → Đã nhận tiền, kèm % đã nhận */
  paid: (percent: number) => Promise<void>
  /** Sửa % đã nhận — giữ nguyên trạng thái và các mốc giờ */
  percent: (percent: number) => Promise<void>
  /** Đã nhận tiền → Đã mang ra bưu cục */
  shipped: () => Promise<void>
  /** Lùi: Đã nhận tiền → Chưa nhận tiền (bỏ % đã nhận) */
  backToUnpaid: () => Promise<void>
  /** Lùi: Đã mang ra bưu cục → Đã nhận tiền (giữ %) */
  backToPaid: () => Promise<void>
}

/** Ghi chú hiện trong hộp xác nhận (VD báo giá sẽ bị khoá / mở khoá) */
export interface PaymentNotes {
  paid?: string
  shipped?: string
  backToUnpaid?: string
  backToPaid?: string
}

export function PaymentTag({ status, paidPercent }: PaymentValue) {
  return (
    <Tag color={statusColor(status)} style={{ marginInlineEnd: 0 }}>
      {statusText(status, paidPercent)}
    </Tag>
  )
}

/** Hộp chọn % (30 / 50 / 100 / tự nhập) — dùng cho "Xác nhận đã nhận tiền" và "Sửa % đã nhận" */
function PercentModal({
  mode,
  initial,
  grand,
  note,
  busy,
  onCancel,
  onOk,
}: {
  mode: 'paid' | 'percent'
  initial: number
  grand: number
  note?: string
  busy: boolean
  onCancel: () => void
  onOk: (percent: number) => void
}) {
  const [percent, setPercent] = useState<number | null>(initial)
  const isPreset = PERCENT_PRESETS.includes(percent as (typeof PERCENT_PRESETS)[number])
  const { received, remaining } = paymentAmounts(grand, 'paid', percent)
  return (
    <Modal
      open
      title={mode === 'paid' ? 'Xác nhận đã nhận tiền' : 'Sửa % đã nhận'}
      okText={mode === 'paid' ? `Xác nhận đã nhận ${percent ?? '…'}%` : 'Lưu'}
      cancelText="Huỷ"
      okButtonProps={{ disabled: !percent }}
      confirmLoading={busy}
      onCancel={onCancel}
      onOk={() => percent && onOk(percent)}
      width={440}
    >
      <Flex vertical gap={12}>
        <Text>Đã nhận bao nhiêu % tổng tiền?</Text>
        <Segmented<number | 'other'>
          block
          value={isPreset ? (percent as number) : 'other'}
          onChange={(v) => setPercent(v === 'other' ? null : v)}
          options={[...PERCENT_PRESETS.map((p) => ({ value: p, label: `${p}%` })), { value: 'other', label: 'Khác' }]}
        />
        <InputNumber<number>
          min={1}
          max={100}
          precision={0}
          value={percent}
          onChange={setPercent}
          suffix="%"
          style={{ width: '100%' }}
          placeholder="Nhập % đã nhận (1–100)"
        />
        {percent ? (
          <Text type="secondary">
            Đã nhận <b>{fmtMoney(received)}</b> trên tổng {fmtMoney(grand)} · Còn lại <b>{fmtMoney(remaining)}</b>
          </Text>
        ) : null}
        {note && <Alert type="warning" showIcon title={note} />}
      </Flex>
    </Modal>
  )
}

/** Trạng thái hộp thoại + đang ghi; mỗi thao tác chỉ một hộp thoại, nút khoá trong lúc ghi */
function usePaymentFlow(value: PaymentValue, grand: number, actions: PaymentActions, notes: PaymentNotes) {
  const { modal } = App.useApp()
  const [dialog, setDialog] = useState<'paid' | 'percent' | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      setDialog(null)
    } catch {
      // Hàm thao tác đã báo lỗi; giữ hộp thoại để thử lại
    } finally {
      setBusy(false)
    }
  }

  const ship = () =>
    modal.confirm({
      title: 'Xác nhận đã mang ra bưu cục?',
      content: notes.shipped ?? 'Nhớ in mã vận chuyển dán lên gói trước khi gửi.',
      okText: 'Đã mang ra bưu cục',
      cancelText: 'Huỷ',
      // Trả promise → nút OK tự hiện đang xử lý. Ghi lỗi: hàm thao tác đã báo + trả lại trạng thái cũ, đóng hộp thoại
      onOk: () => actions.shipped().catch(() => undefined),
    })

  // Lùi một bước (bấm nhầm)
  const back = () => {
    const toUnpaid = value.status === 'paid'
    const note = toUnpaid ? notes.backToUnpaid : notes.backToPaid
    modal.confirm({
      title: toUnpaid ? 'Chuyển về “Chưa nhận tiền”?' : 'Chuyển về “Đã nhận tiền”?',
      content: (
        <Flex vertical gap={6}>
          <span>
            {toUnpaid
              ? `Bỏ ${percentOf(value.status, value.paidPercent)}% đã nhận và mốc giờ nhận tiền.`
              : 'Bỏ mốc giờ mang ra bưu cục. Giữ nguyên % đã nhận và mã vận chuyển.'}
          </span>
          {note && <span>{note}</span>}
        </Flex>
      ),
      okText: 'Chuyển về',
      cancelText: 'Huỷ',
      onOk: () => (toUnpaid ? actions.backToUnpaid() : actions.backToPaid()).catch(() => undefined),
    })
  }

  const dialogNode = dialog && (
    <PercentModal
      mode={dialog}
      initial={value.status === 'unpaid' ? 100 : percentOf(value.status, value.paidPercent)}
      grand={grand}
      note={dialog === 'paid' ? notes.paid : undefined}
      busy={busy}
      onCancel={() => !busy && setDialog(null)}
      onOk={(p) => void run(() => (dialog === 'paid' ? actions.paid(p) : actions.percent(p)))}
    />
  )

  return { askPaid: () => setDialog('paid'), askPercent: () => setDialog('percent'), ship, back, busy, dialogNode }
}

const STEP_INDEX: Record<PayStatus, number> = { unpaid: 0, paid: 1, shipped: 2 }

/** Thẻ "Trạng thái" trong trang sửa: 3 bước + đúng 1 nút chính cho bước kế tiếp */
export function PaymentStatusCard({
  value,
  grand,
  actions,
  notes = {},
  statusAt,
}: {
  value: PaymentValue
  grand: number
  actions: PaymentActions
  notes?: PaymentNotes
  statusAt?: Partial<Record<PayStatus, Date | null>>
}) {
  const flow = usePaymentFlow(value, grand, actions, notes)
  const prev = PREV_STATUS[value.status]
  const { percent, received, remaining } = paymentAmounts(grand, value.status, value.paidPercent)
  const at = (s: PayStatus) => (statusAt?.[s] ? fmtDateTime(statusAt[s] ?? null) : undefined)

  return (
    <SectionCard step={<DollarOutlined />} title="Trạng thái" extra={<PaymentTag {...value} />}>
      <Steps
        size="small"
        current={STEP_INDEX[value.status]}
        // Bước cuối (đã mang ra bưu cục) là đã xong, không phải "đang làm"
        status={value.status === 'shipped' ? 'finish' : 'process'}
        items={[
          { title: 'Chưa nhận tiền', description: at('unpaid') },
          { title: value.status === 'unpaid' ? 'Đã nhận tiền' : `Đã nhận ${percent}%`, description: at('paid') },
          { title: 'Đã mang ra bưu cục', description: at('shipped') },
        ]}
      />
      {value.status !== 'unpaid' && (
        <Text style={{ display: 'block', marginTop: 16 }}>
          Đã nhận <b>{fmtMoney(received)}</b>
          {remaining > 0 ? (
            <>
              {' '}
              · Còn lại <b>{fmtMoney(remaining)}</b>
            </>
          ) : (
            ' · Đã thu đủ'
          )}
        </Text>
      )}
      <Flex wrap gap={8} align="center" style={{ marginTop: 16 }}>
        {value.status === 'unpaid' && (
          <Button type="primary" icon={<CheckOutlined />} loading={flow.busy} onClick={flow.askPaid}>
            Xác nhận đã nhận tiền
          </Button>
        )}
        {value.status === 'paid' && (
          <Button type="primary" icon={<CarOutlined />} disabled={flow.busy} onClick={flow.ship}>
            Đã mang ra bưu cục
          </Button>
        )}
        {value.status !== 'unpaid' && (
          <Button icon={<EditOutlined />} disabled={flow.busy} onClick={flow.askPercent}>
            Sửa % đã nhận
          </Button>
        )}
        {prev && (
          <Button type="text" icon={<RollbackOutlined />} disabled={flow.busy} onClick={flow.back}>
            Về “{statusLabel(prev)}”
          </Button>
        )}
      </Flex>
      {flow.dialogNode}
    </SectionCard>
  )
}

/** Ô trạng thái gọn trong bảng danh sách: tag + 1 nút nhỏ cho bước kế tiếp */
export function PaymentStatusCompact({
  value,
  grand,
  actions,
  notes = {},
  extra,
}: {
  value: PaymentValue
  grand: number
  actions: PaymentActions
  notes?: PaymentNotes
  /** Hiện thêm dưới tag (VD "Đã in mã") */
  extra?: ReactNode
}) {
  const flow = usePaymentFlow(value, grand, actions, notes)
  const prev = PREV_STATUS[value.status]
  return (
    <Flex vertical gap={4} align="flex-start">
      <Flex gap={0} align="center">
        <PaymentTag {...value} />
        {value.status !== 'unpaid' && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            title="Sửa % đã nhận"
            aria-label="Sửa % đã nhận"
            disabled={flow.busy}
            onClick={flow.askPercent}
            style={{ marginInlineStart: 4 }}
          />
        )}
        {prev && (
          <Button
            type="text"
            size="small"
            icon={<RollbackOutlined />}
            title={`Chuyển về “${statusLabel(prev)}”`}
            aria-label={`Chuyển về ${statusLabel(prev)}`}
            disabled={flow.busy}
            onClick={flow.back}
          />
        )}
      </Flex>
      {value.status === 'unpaid' && (
        <Button size="small" icon={<CheckOutlined />} loading={flow.busy} onClick={flow.askPaid}>
          Nhận tiền
        </Button>
      )}
      {value.status === 'paid' && (
        <Button size="small" icon={<CarOutlined />} disabled={flow.busy} onClick={flow.ship}>
          Gửi bưu cục
        </Button>
      )}
      {extra}
      {flow.dialogNode}
    </Flex>
  )
}
