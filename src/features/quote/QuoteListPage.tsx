import { useMemo, useState } from 'react'
import { App, Button, Card, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router'
import { ListFilters, Stats, SubText } from '../../components/ListToolbar'
import { PageShell } from '../../components/PageShell'
import { PaymentStatusCompact } from '../../components/PaymentStatus'
import { firestoreErrorText, useLiveQuery } from '../../lib/firestoreHooks'
import { fmtDate, fmtDateTime, fmtMoney, inDateRange, isoToDate, matchText, todayRange } from '../../lib/format'
import type { DateRange } from '../../lib/format'
import { PAY_STATUSES, paymentAmounts } from '../../lib/payment'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { parseList } from '../sentences/state'
import { quoteItemsSummary } from './calc'
import { deleteQuote, quotesQuery, setQuoteStatus, toQuote } from './repo'
import type { QuoteDoc, QuoteStatus } from './types'

const sum = (list: QuoteDoc[], f: (q: QuoteDoc) => number) => list.reduce((s, q) => s + f(q), 0)
const amounts = (q: QuoteDoc) => paymentAmounts(q.totals.grand, q.status, q.paidPercent)

/** /bao-gia — danh sách báo giá mác áo rời (realtime) */
export default function QuoteListPage() {
  useDocumentTitle('Báo giá mác áo')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const q = useMemo(() => quotesQuery(), [])
  const { data, error } = useLiveQuery(q, toQuote)
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  // Mặc định xem báo giá hôm nay; xoá ô ngày để xem tất cả
  const [dateRange, setDateRange] = useState<DateRange>(todayRange)

  const quotes = useMemo(() => data ?? [], [data])
  // Lọc ngày (theo ngày báo giá) + tìm kiếm trước; số đếm trạng thái và số liệu tính trên phần này
  const scope = quotes.filter(
    (it) =>
      inDateRange(isoToDate(it.date), dateRange) &&
      matchText(
        [it.customer.name, it.customer.phone, it.customer.address, it.printContent, it.shipping.trackingCode],
        search,
      ),
  )
  const counts = scope.reduce<Record<string, number>>((acc, it) => ({ ...acc, [it.status]: (acc[it.status] ?? 0) + 1 }), {})
  const rows = scope.filter((it) => filter === 'all' || it.status === filter)

  // Trạng thái chỉ đi một chiều; chuyển sang "Đã nhận tiền" thì báo giá bị khoá
  const changeStatus = (r: QuoteDoc, next: { status: QuoteStatus; paidPercent: number | null }) =>
    setQuoteStatus(r.id, next.status, next.paidPercent).catch((err) => message.error(firestoreErrorText(err)))

  const columns: TableColumnsType<QuoteDoc> = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      width: 110,
      render: (_, r) => (
        <>
          {fmtDate(r.date)}
          <SubText>{r.createdBy}</SubText>
        </>
      ),
    },
    {
      title: 'Khách hàng',
      render: (_, r) => (
        <>
          <Link to={`/bao-gia/${r.id}`}>
            <b>{r.customer.name || '(chưa có tên)'}</b>
          </Link>
          <SubText>{r.customer.phone}</SubText>
        </>
      ),
    },
    { title: 'Sản phẩm', render: (_, r) => quoteItemsSummary(r) || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Tổng tiền',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.totals.grand - b.totals.grand,
      render: (_, r) => {
        const { received, remaining } = amounts(r)
        return (
          <>
            <b>{fmtMoney(r.totals.grand)}</b>
            {received > 0 && <SubText>{remaining > 0 ? `Còn ${fmtMoney(remaining)}` : 'Đã thu đủ'}</SubText>}
          </>
        )
      },
    },
    {
      title: 'Trạng thái',
      width: 210,
      render: (_, r) => (
        <PaymentStatusCompact
          value={{ status: r.status, paidPercent: r.paidPercent }}
          grand={r.totals.grand}
          onChange={(v) => changeStatus(r, v)}
          paidNote="Sau khi nhận tiền, báo giá sẽ bị khoá: không sửa, không xoá được nữa. Không chuyển ngược lại được."
          extra={
            r.status === 'shipped' &&
            (r.shipping.printedAt ? (
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
      title: 'Mẫu câu',
      width: 110,
      render: (_, r) => (
        <Button size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/bao-gia/${r.id}/mau-cau`)}>
          {parseList(r.printContent).length} câu
        </Button>
      ),
    },
    {
      title: 'Cập nhật',
      width: 150,
      render: (_, r) => (
        <>
          {fmtDateTime(r.updatedAt)}
          <SubText>{r.updatedBy}</SubText>
        </>
      ),
    },
    {
      key: 'actions',
      width: 96,
      align: 'right',
      render: (_, r) =>
        r.status !== 'unpaid' ? (
          // Đã nhận tiền: chỉ xem, không xoá
          <>
            <Tooltip title="Xem (đã nhận tiền — không sửa được)">
              <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/bao-gia/${r.id}`)} />
            </Tooltip>
            <Tooltip title="Đã nhận tiền — không xoá được">
              <Button type="text" icon={<LockOutlined />} disabled aria-label="Không xoá được" />
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="Sửa">
              <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/bao-gia/${r.id}`)} />
            </Tooltip>
            <Popconfirm
              title="Xoá báo giá này?"
              description="Xoá cả ảnh đi kèm. Không hoàn tác được."
              okText="Xoá"
              okButtonProps={{ danger: true }}
              cancelText="Huỷ"
              onConfirm={() =>
                deleteQuote(r.id).then(
                  () => message.success('Đã xoá báo giá'),
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
      title="Báo giá mác áo rời"
      subtitle="Lưu trên Firebase · cập nhật trực tiếp khi người khác sửa"
      actions={
        // Chỉ mở form trống — báo giá được ghi khi bấm "Tạo báo giá" trong form
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/bao-gia/moi')}>
          Tạo báo giá
        </Button>
      }
    >
      <Stats
        items={[
          { label: dateRange ? 'Báo giá trong khoảng ngày' : 'Tổng số báo giá', value: scope.length },
          { label: 'Chưa nhận tiền', value: counts.unpaid ?? 0 },
          { label: 'Đã thu', value: fmtMoney(sum(scope, (it) => amounts(it).received)) },
          { label: 'Còn phải thu', value: fmtMoney(sum(scope, (it) => amounts(it).remaining)) },
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
          datePlaceholder={['Báo giá từ ngày', 'Đến ngày']}
          search={search}
          onSearch={setSearch}
          placeholder="Tìm tên, SĐT, nội dung, mã vận đơn…"
        />
        {error ? (
          <Typography.Text type="danger">{firestoreErrorText(error)}</Typography.Text>
        ) : (
          <Table<QuoteDoc>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={data == null}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: 'Chưa có báo giá nào' }}
          />
        )}
      </Card>
    </PageShell>
  )
}
