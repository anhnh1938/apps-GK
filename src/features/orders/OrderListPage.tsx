import { useMemo, useState } from 'react'
import { App, Button, Card, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router'
import { ListFilters, Stats, SubText } from '../../components/ListToolbar'
import { PageShell } from '../../components/PageShell'
import { PaymentStatusCompact } from '../../components/PaymentStatus'
import { firestoreErrorText, useLiveQuery } from '../../lib/firestoreHooks'
import { fmtDateTime, fmtDay, fmtMoney, inDateRange, matchText, todayRange } from '../../lib/format'
import type { DateRange } from '../../lib/format'
import { PAY_STATUSES, paymentAmounts } from '../../lib/payment'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { deleteOrder, ordersQuery, setOrderStatus, toOrder } from './repo'
import { itemsSummary, orderCode } from './state'
import type { OrderDoc, OrderStatus } from './types'

const amounts = (o: OrderDoc) => paymentAmounts(o.totals.grand, o.status, o.paidPercent)

/** /don-ao — danh sách đơn áo (realtime) */
export default function OrderListPage() {
  useDocumentTitle('Đơn áo')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const q = useMemo(() => ordersQuery(), [])
  const { data, error } = useLiveQuery(q, toOrder)
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
    { title: 'Áo', render: (_, o) => itemsSummary(o.items) || <Typography.Text type="secondary">—</Typography.Text> },
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
        // Chỉ đi một chiều: Chưa nhận tiền → Đã nhận tiền (%) → Đã mang ra bưu cục
        <PaymentStatusCompact
          value={{ status: o.status, paidPercent: o.paidPercent }}
          grand={o.totals.grand}
          onChange={(v) =>
            setOrderStatus(o.id, v.status, v.paidPercent).catch((err) => message.error(firestoreErrorText(err)))
          }
          extra={
            o.status === 'shipped' &&
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
