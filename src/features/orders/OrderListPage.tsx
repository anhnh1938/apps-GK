import { useMemo, useState } from 'react'
import { App, Button, Card, Flex, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router'
import { ListFilters, Stats, SubText } from '../../components/ListToolbar'
import { PageShell } from '../../components/PageShell'
import { PaymentStatusCompact } from '../../components/PaymentStatus'
import type { PaymentActions } from '../../components/PaymentStatus'
import { firestoreErrorText, useLiveQuery } from '../../lib/firestoreHooks'
import { fmtDateTime, fmtDay, fmtMoney, inDateRange, matchText, todayRange } from '../../lib/format'
import type { DateRange } from '../../lib/format'
import { PAY_STATUSES, paymentAmounts } from '../../lib/payment'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { colorOf } from '../products/catalog'
import { useProducts } from '../products/repo'
import { ORDER_PAYMENT_NOTES } from './constants'
import {
  deleteOrder,
  markOrderPaid,
  markOrderShipped,
  ordersQuery,
  revertOrderToPaid,
  revertOrderToUnpaid,
  setOrderPaidPercent,
  toOrder,
} from './repo'
import { orderCode } from './state'
import type { OrderDoc, OrderItem, OrderStatus } from './types'

const amounts = (o: OrderDoc) => paymentAmounts(o.totals.grand, o.status, o.paidPercent)

const dotStyle = {
  display: 'inline-block',
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '1px solid rgba(0, 0, 0, 0.2)',
  flex: 'none',
} as const

/** Số dòng tối đa trong ô bảng; đơn nhiều áo hơn thì ghi "… và N áo nữa" */
const MAX_LINES = 8

/**
 * Liệt kê từng chiếc áo một dòng (đơn 2 áo giống nhau → 2 dòng, không ghi "×2"):
 * số thứ tự · chấm màu (rê chuột xem tên màu) · loại áo · size
 */
function ItemsCell({ items, hexOf }: { items: OrderItem[]; hexOf: (it: OrderItem) => string }) {
  const shirts = items.flatMap((it) => Array.from({ length: Math.max(0, it.qty) }, (_, n) => ({ it, key: `${it.id}-${n}` })))
  if (!shirts.length) return <Typography.Text type="secondary">—</Typography.Text>
  const shown = shirts.length > MAX_LINES ? shirts.slice(0, MAX_LINES - 1) : shirts
  return (
    <Flex vertical gap={4}>
      {shown.map(({ it, key }, i) => (
        <Flex key={key} align="center" gap={8}>
          <Typography.Text type="secondary" style={{ width: 18, textAlign: 'right', flex: 'none' }}>
            {i + 1}.
          </Typography.Text>
          <Tooltip title={it.color || 'Chưa chọn màu'}>
            <span
              role="img"
              aria-label={it.color ? `Màu ${it.color}` : 'Chưa chọn màu'}
              style={{ ...dotStyle, background: it.color ? hexOf(it) : 'transparent' }}
            />
          </Tooltip>
          <span>{it.name}</span>
          {it.size && <Tag style={{ marginInlineEnd: 0 }}>{it.size}</Tag>}
        </Flex>
      ))}
      {shown.length < shirts.length && (
        <Typography.Text type="secondary" style={{ paddingLeft: 26 }}>
          … và {shirts.length - shown.length} áo nữa
        </Typography.Text>
      )}
    </Flex>
  )
}

/** /don-ao — danh sách đơn áo (realtime) */
export default function OrderListPage() {
  useDocumentTitle('Đơn áo')
  const { message } = App.useApp()
  // Trạng thái đi tới từng bước, lùi lại được một bước; "Đã mang ra bưu cục" thì đơn bị khoá.
  // Lỗi: báo rồi ném lại để hộp thoại không đóng.
  const fail = (err: unknown): never => {
    message.error(firestoreErrorText(err))
    throw err
  }
  const actionsFor = (o: OrderDoc): PaymentActions => ({
    paid: (percent) => markOrderPaid(o.id, percent).catch(fail),
    percent: (percent) => setOrderPaidPercent(o.id, percent).catch(fail),
    shipped: () => markOrderShipped(o.id).catch(fail),
    backToUnpaid: () => revertOrderToUnpaid(o.id).catch(fail),
    backToPaid: () => revertOrderToPaid(o.id).catch(fail),
  })
  const navigate = useNavigate()
  const q = useMemo(() => ordersQuery(), [])
  const { data, error } = useLiveQuery(q, toOrder)
  // Đơn chỉ lưu tên màu → mã màu lấy theo sản phẩm hiện tại (màu lạ / sản phẩm đã xoá: theo tên màu quen thuộc)
  const { products } = useProducts()
  const hexOf = (it: OrderItem) =>
    products?.find((p) => p.id === it.productId)?.colors.find((c) => c.name === it.color)?.hex ?? colorOf(it.color).hex
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  // Mặc định xem đơn tạo hôm nay; xoá ô ngày để xem tất cả
  const [dateRange, setDateRange] = useState<DateRange>(todayRange)

  const orders = useMemo(() => data ?? [], [data])
  // Lọc ngày (theo ngày tạo đơn) + tìm kiếm trước; số đếm trạng thái và số liệu tính trên phần này
  const scope = orders.filter(
    (o) =>
      inDateRange(o.createdAt, dateRange) &&
      matchText(
        [orderCode(o.id), o.recipient.name, o.recipient.phone, o.recipient.address, o.tagContent, o.embroideryContent, o.note, o.shipping.trackingCode],
        search,
      ),
  )
  const counts = scope.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {})
  const rows = scope.filter((o) => filter === 'all' || o.status === filter)
  const unpaid = scope.filter((o) => o.status === 'unpaid')

  const columns: TableColumnsType<OrderDoc> = [
    {
      title: 'Mã đơn',
      width: 120,
      render: (_, o) => (
        <>
          <Link to={`/don-ao/${o.id}`}>
            <b>{orderCode(o.id)}</b>
          </Link>
          <SubText>{fmtDay(o.createdAt)}</SubText>
        </>
      ),
    },
    {
      title: 'Người nhận',
      render: (_, o) => (
        <>
          <b>{o.recipient.name || '(chưa có tên)'}</b>
          <SubText>{o.recipient.phone}</SubText>
        </>
      ),
    },
    { title: 'Áo', render: (_, o) => <ItemsCell items={o.items} hexOf={hexOf} /> },
    {
      title: 'Tổng tiền',
      align: 'right',
      width: 130,
      sorter: (a, b) => a.totals.grand - b.totals.grand,
      render: (_, o) => {
        const { received, remaining } = amounts(o)
        return (
          <>
            <b>{fmtMoney(o.totals.grand)}</b>
            {received > 0 && <SubText>{remaining > 0 ? `Còn ${fmtMoney(remaining)}` : 'Đã thu đủ'}</SubText>}
          </>
        )
      },
    },
    {
      title: 'Trạng thái',
      width: 210,
      render: (_, o) => (
        // Chưa nhận tiền → Đã nhận tiền (%) → Đã mang ra bưu cục; nút ↶ lùi lại một bước
        <PaymentStatusCompact
          value={{ status: o.status, paidPercent: o.paidPercent }}
          grand={o.totals.grand}
          actions={actionsFor(o)}
          notes={ORDER_PAYMENT_NOTES}
          extra={
            o.status !== 'unpaid' &&
            (o.shipping.printedAt ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Đã in mã
              </Tag>
            ) : (
              <Tag>Chưa in mã</Tag>
            ))
          }
        />
      ),
    },
    {
      title: 'Cập nhật',
      width: 150,
      render: (_, o) => (
        <>
          {fmtDateTime(o.updatedAt)}
          <SubText>{o.updatedBy}</SubText>
        </>
      ),
    },
    {
      key: 'actions',
      width: 96,
      align: 'right',
      render: (_, o) =>
        o.status === 'shipped' ? (
          // Đã mang ra bưu cục: chỉ xem, không xoá
          <>
            <Tooltip title="Xem (đã mang ra bưu cục — không sửa được)">
              <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/don-ao/${o.id}`)} />
            </Tooltip>
            <Tooltip title="Đã mang ra bưu cục — không xoá được">
              <Button type="text" icon={<LockOutlined />} disabled aria-label="Không xoá được" />
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="Sửa">
              <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/don-ao/${o.id}`)} />
            </Tooltip>
            <Popconfirm
              title="Xoá đơn này?"
              description="Xoá cả ảnh tag / thêu. Không hoàn tác được."
              okText="Xoá"
              okButtonProps={{ danger: true }}
              cancelText="Huỷ"
              onConfirm={() =>
                deleteOrder(o.id).then(
                  () => message.success('Đã xoá đơn'),
                  (err) => message.error(firestoreErrorText(err)),
                )
              }
            >
              <Button type="text" danger icon={<DeleteOutlined />} aria-label="Xoá" />
            </Popconfirm>
          </>
        ),
    },
  ]

  return (
    <PageShell
      title="Đơn áo"
      subtitle="Lưu trên Firebase · cập nhật trực tiếp khi người khác sửa"
      actions={
        // Chỉ mở form trống — đơn được ghi khi bấm "Tạo đơn áo" trong form
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/don-ao/moi')}>
          Tạo đơn áo
        </Button>
      }
    >
      <Stats
        items={[
          { label: 'Chưa nhận tiền', value: `${unpaid.length} đơn` },
          { label: 'Cần làm & gửi (đã nhận tiền)', value: counts.paid ?? 0 },
          { label: 'Đã mang ra bưu cục', value: counts.shipped ?? 0 },
          { label: 'Đã thu', value: fmtMoney(scope.reduce((s, o) => s + amounts(o).received, 0)) },
          { label: 'Còn phải thu', value: fmtMoney(scope.reduce((s, o) => s + amounts(o).remaining, 0)) },
        ]}
      />
      <Card>
        <ListFilters
          statuses={PAY_STATUSES}
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          dateRange={dateRange}
          onDateRange={setDateRange}
          datePlaceholder={['Đơn tạo từ ngày', 'Đến ngày']}
          search={search}
          onSearch={setSearch}
          placeholder="Tìm mã đơn, tên, SĐT, nội dung…"
        />
        {error ? (
          <Typography.Text type="danger">{firestoreErrorText(error)}</Typography.Text>
        ) : (
          <Table<OrderDoc>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={data == null}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            scroll={{ x: 1000 }}
            locale={{ emptyText: 'Chưa có đơn áo nào' }}
          />
        )}
      </Card>
    </PageShell>
  )
}
