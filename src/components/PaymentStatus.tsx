import { useState } from 'react'
import { App, Button, Flex, InputNumber, Modal, Segmented, Steps, Tag, Typography } from 'antd'
import { CarOutlined, CheckOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons'
import { fmtDateTime, fmtMoney } from '../lib/format'
import { PERCENT_PRESETS, paymentAmounts, percentOf, statusColor, statusText } from '../lib/payment'
import type { PayStatus } from '../lib/payment'
import { SectionCard } from './SectionCard'

const { Text } = Typography

export interface PaymentValue {
  status: PayStatus
  paidPercent: number | null
}

export function PaymentTag({ status, paidPercent }: PaymentValue) {
  return (
    <Tag color={statusColor(status)} style={{ marginInlineEnd: 0 }}>
      {statusText(status, paidPercent)}
    </Tag>
  )
}

/** Hộp hỏi đã nhận bao nhiêu % (30 / 50 / 100 / tự nhập), hiện số tiền tương ứng */
function PercentModal({
  open,
  initial,
  grand,
  onCancel,
  onOk,
}: {
  open: boolean
  initial: number
  grand: number
  onCancel: () => void
  onOk: (percent: number) => void
}) {
  const [percent, setPercent] = useState<number | null>(initial)
  const isPreset = PERCENT_PRESETS.includes(percent as (typeof PERCENT_PRESETS)[number])
  const { received, remaining } = paymentAmounts(grand, 'paid', percent)
  return (
    <Modal
      open={open}
      title="Đã nhận bao nhiêu % tiền?"
      okText="Lưu"
      cancelText="Huỷ"
      okButtonProps={{ disabled: !percent }}
      onCancel={onCancel}
      onOk={() => percent && onOk(percent)}
      width={420}
    >
      <Flex vertical gap={12}>
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
      </Flex>
    </Modal>
  )
}

/**
 * Các thao tác đổi trạng thái — chỉ đi một chiều:
 * Chưa nhận tiền → (hỏi %) Đã nhận tiền → (xác nhận) Đã mang ra bưu cục. Đã nhận tiền thì sửa được %.
 */
function usePaymentActions(
  value: PaymentValue,
  onChange: (next: PaymentValue) => void,
  confirmNotes: { paid?: string; shipped?: string },
) {
  const { modal } = App.useApp()
  const [asking, setAsking] = useState(false)
  const percentModal = (grand: number) =>
    asking && (
      <PercentModal
        open
        initial={value.status === 'unpaid' ? 100 : percentOf(value.status, value.paidPercent)}
        grand={grand}
        onCancel={() => setAsking(false)}
        onOk={(percent) => {
          setAsking(false)
          if (value.status === 'unpaid' && confirmNotes.paid) {
            modal.confirm({
              title: `Xác nhận đã nhận ${percent}% tiền?`,
              content: confirmNotes.paid,
              okText: 'Xác nhận',
              cancelText: 'Huỷ',
              onOk: () => onChange({ status: 'paid', paidPercent: percent }),
            })
          } else {
            // Sửa % giữ nguyên trạng thái hiện tại (đã nhận tiền / đã mang ra bưu cục)
            onChange({ status: value.status === 'unpaid' ? 'paid' : value.status, paidPercent: percent })
          }
        }}
      />
    )
  const ship = () =>
    modal.confirm({
      title: 'Xác nhận đã mang ra bưu cục?',
      content: confirmNotes.shipped ?? 'Không chuyển ngược lại được. Sau bước này có thể nhập mã vận đơn và in mã vận chuyển.',
      okText: 'Đã mang ra bưu cục',
      cancelText: 'Huỷ',
      onOk: () => onChange({ status: 'shipped', paidPercent: value.paidPercent ?? 100 }),
    })
  return { askPercent: () => setAsking(true), ship, percentModal }
}

const STEP_INDEX: Record<PayStatus, number> = { unpaid: 0, paid: 1, shipped: 2 }

/** Thẻ "Trạng thái" trong trang sửa: 3 bước + đúng 1 nút chính cho bước kế tiếp */
export function PaymentStatusCard({
  value,
  onChange,
  grand,
  statusAt,
  paidNote,
}: {
  value: PaymentValue
  onChange: (next: PaymentValue) => void
  grand: number
  statusAt?: Partial<Record<PayStatus, Date | null>>
  /** Nhắc thêm khi xác nhận đã nhận tiền (VD báo giá sẽ bị khoá) */
  paidNote?: string
}) {
  const { askPercent, ship, percentModal } = usePaymentActions(value, onChange, {
    paid: paidNote ?? 'Không chuyển ngược về “Chưa nhận tiền” được.',
  })
  const { percent, received, remaining } = paymentAmounts(grand, value.status, value.paidPercent)
  const at = (s: PayStatus) => (statusAt?.[s] ? fmtDateTime(statusAt[s] ?? null) : undefined)

  return (
    <SectionCard step={<DollarOutlined />} title="Trạng thái" extra={<PaymentTag {...value} />}>
      <Steps
        size="small"
        current={STEP_INDEX[value.status]}
        items={[
          { title: 'Chưa nhận tiền', description: at('unpaid') },
          {
            title: value.status === 'unpaid' ? 'Đã nhận tiền' : `Đã nhận ${percent}%`,
            description: at('paid'),
          },
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
          <Button type="primary" icon={<CheckOutlined />} onClick={askPercent}>
            Xác nhận đã nhận tiền
          </Button>
        )}
        {value.status === 'paid' && (
          <Button type="primary" icon={<CarOutlined />} onClick={ship}>
            Đã mang ra bưu cục
          </Button>
        )}
        {value.status !== 'unpaid' && (
          <Button icon={<EditOutlined />} onClick={askPercent}>
            Sửa % đã nhận
          </Button>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Trạng thái chỉ đi tới, không quay lại.
        </Text>
      </Flex>
      {percentModal(grand)}
    </SectionCard>
  )
}

/** Ô trạng thái gọn trong bảng danh sách: tag + 1 nút nhỏ cho bước kế tiếp */
export function PaymentStatusCompact({
  value,
  onChange,
  grand,
  paidNote,
  extra,
}: {
  value: PaymentValue
  onChange: (next: PaymentValue) => void
  grand: number
  paidNote?: string
  /** Hiện thêm dưới tag (VD "Đã in mã") */
  extra?: React.ReactNode
}) {
  const { askPercent, ship, percentModal } = usePaymentActions(value, onChange, {
    paid: paidNote ?? 'Không chuyển ngược về “Chưa nhận tiền” được.',
  })
  return (
    <Flex vertical gap={4} align="flex-start">
      <Flex gap={4} align="center">
        <PaymentTag {...value} />
        {value.status !== 'unpaid' && (
          <Button type="text" size="small" icon={<EditOutlined />} title="Sửa % đã nhận" onClick={askPercent} />
        )}
      </Flex>
      {value.status === 'unpaid' && (
        <Button size="small" icon={<CheckOutlined />} onClick={askPercent}>
          Nhận tiền
        </Button>
      )}
      {value.status === 'paid' && (
        <Button size="small" icon={<CarOutlined />} onClick={ship}>
          Gửi bưu cục
        </Button>
      )}
      {extra}
      {percentModal(grand)}
    </Flex>
  )
}
