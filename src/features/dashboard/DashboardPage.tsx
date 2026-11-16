import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Row, Table, Tag, Typography } from 'antd'
import { CheckCircleOutlined, TableOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { DateRangeFilter, Stats, SubText } from '../../components/ListToolbar'
import { PageShell } from '../../components/PageShell'
import { firestoreErrorText, useLiveQuery } from '../../lib/firestoreHooks'
import { fmtDateTime, fmtMoney } from '../../lib/format'
import type { DateRange } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { ordersQuery, toOrder } from '../orders/repo'
import { orderCode } from '../orders/state'
import { quotesQuery, toQuote } from '../quote/repo'
import { Legend, RankedBars, SegmentedBar, StackedColumns, VizRoot } from './Charts'
import { buildDashboard, fmtCompactVnd, toShipList } from './stats'
import type { Bucket, ToShip } from './stats'

const { Text } = Typography

const SERIES = [
  { name: 'Báo giá mác áo', color: 'var(--series-1)' },
  { name: 'Đơn áo', color: 'var(--series-2)' },
]
// 3 bước trạng thái: thang một tông, nhạt → đậm (chữ trong khối: đen trên nhạt, trắng trên đậm)
const STEP_PARTS = [
  { key: 'unpaid', name: 'Chưa nhận tiền', color: 'var(--step-1)', ink: '#0b0b0b' },
  { key: 'paid', name: 'Đã nhận tiền', color: 'var(--step-2)', ink: '#ffffff' },
  { key: 'shipped', name: 'Đã mang ra bưu cục', color: 'var(--step-3)', ink: '#ffffff' },
] as const

/** Mặc định 30 ngày gần nhất (biểu đồ theo ngày cần nhiều ngày mới có ý nghĩa) */
function last30(): Exclude<DateRange, null> {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 29)
  return [start, end]
}

/** / — Tổng quan: số liệu, doanh thu theo ngày, trạng thái, sản phẩm, việc cần gửi hàng */
export default function DashboardPage() {
  useDocumentTitle('Tổng quan')
  const qQuotes = useMemo(() => quotesQuery(), [])
  const qOrders = useMemo(() => ordersQuery(), [])
  const quotes = useLiveQuery(qQuotes, toQuote)
  const orders = useLiveQuery(qOrders, toOrder)
  const [range, setRange] = useState<DateRange>(last30)
  const [showTable, setShowTable] = useState(false)

  const loading = quotes.data == null || orders.data == null
  const error = quotes.error ?? orders.error
  // So theo mốc thời gian (số) để không tính lại khi chỉ đổi tham chiếu Date
  const [fromT, toT] = (range ?? last30()).map((d) => d.getTime())
  const dash = useMemo(
    () => buildDashboard(quotes.data ?? [], orders.data ?? [], [new Date(fromT), new Date(toT)]),
    [quotes.data, orders.data, fromT, toT],
  )
  const toShip = useMemo(() => toShipList(quotes.data ?? [], orders.data ?? []), [quotes.data, orders.data])
  const hasRevenue = dash.buckets.some((b) => b.quotes + b.orders > 0)

  if (error) {
    return (
      <PageShell title="Tổng quan">
        <Text type="danger">{firestoreErrorText(error)}</Text>
      </PageShell>
    )
  }

  return (
    <PageShell title="Tổng quan" subtitle="Số liệu báo giá mác áo và đơn áo — cập nhật trực tiếp">
      {/* Bộ lọc: một hàng phía trên, áp cho mọi số liệu / biểu đồ bên dưới */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <DateRangeFilter value={range} onChange={setRange} placeholder={['Từ ngày', 'Đến ngày']} allowClear={false} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Báo giá tính theo ngày báo giá · đơn áo theo ngày tạo đơn
        </Text>
      </div>

      <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <Stats
          items={[
            { label: 'Tổng giá trị', value: fmtMoney(dash.kpi.total) },
            { label: 'Đã thu', value: fmtMoney(dash.kpi.received) },
            { label: 'Còn phải thu', value: fmtMoney(dash.kpi.remaining) },
            {
              label: 'Báo giá',
              value: (
                <>
                  {dash.kpi.quotes}
                  <SubText>{dash.kpi.quotesUnpaid} chưa nhận tiền</SubText>
                </>
              ),
            },
            {
              label: 'Đơn áo',
              value: (
                <>
                  {dash.kpi.orders}
                  <SubText>{dash.kpi.ordersUnpaid} chưa nhận tiền</SubText>
                </>
              ),
            },
          ]}
        />

        <VizRoot>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                title={dash.byMonth ? 'Giá trị báo giá & đơn áo theo tháng' : 'Giá trị báo giá & đơn áo theo ngày'}
                extra={
                  <Button size="small" icon={<TableOutlined />} onClick={() => setShowTable((v) => !v)}>
                    {showTable ? 'Ẩn bảng số liệu' : 'Bảng số liệu'}
                  </Button>
                }
              >
                <Legend items={SERIES} />
                {hasRevenue ? (
                  <StackedColumns
                    ariaLabel="Biểu đồ cột giá trị báo giá và đơn áo theo thời gian"
                    data={dash.buckets.map((b) => ({ key: b.key, label: b.label, values: [b.quotes, b.orders] }))}
                    series={SERIES}
                    format={fmtMoney}
                    formatTick={fmtCompactVnd}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có báo giá / đơn nào trong khoảng ngày này" />
                )}
                {showTable && (
                  <Table<Bucket>
                    style={{ marginTop: 16 }}
                    size="small"
                    rowKey="key"
                    pagination={false}
                    scroll={{ y: 320 }}
                    dataSource={dash.buckets.filter((b) => b.quotes + b.orders > 0)}
                    columns={[
                      { title: dash.byMonth ? 'Tháng' : 'Ngày', dataIndex: 'label' },
                      { title: 'Báo giá mác áo', align: 'right', render: (_, b) => fmtMoney(b.quotes) },
                      { title: 'Đơn áo', align: 'right', render: (_, b) => fmtMoney(b.orders) },
                      { title: 'Tổng', align: 'right', render: (_, b) => <b>{fmtMoney(b.quotes + b.orders)}</b> },
                    ]}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} xl={12}>
              <Card title="Trạng thái" style={{ height: '100%' }}>
                <SegmentedBar
                  label="Báo giá mác áo"
                  parts={STEP_PARTS.map((p) => ({ ...p, value: dash.statusQuotes[p.key] }))}
                />
                <SegmentedBar label="Đơn áo" parts={STEP_PARTS.map((p) => ({ ...p, value: dash.statusOrders[p.key] }))} />
                <div style={{ marginTop: 14 }}>
                  <Legend items={STEP_PARTS.map((p) => ({ name: p.name, color: p.color }))} />
                </div>
              </Card>
            </Col>

            <Col xs={24} xl={12}>
              <Card title="Sản phẩm theo số lượng" style={{ height: '100%' }}>
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <RankedBars title="Mác áo (trong báo giá)" rows={dash.tagProducts} unit="chiếc" />
                  </Col>
                  <Col xs={24} md={12}>
                    <RankedBars title="Áo (trong đơn áo)" rows={dash.shirtProducts} unit="áo" />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </VizRoot>

        <Card title={`Cần mang ra bưu cục (${toShip.length})`} style={{ marginTop: 16 }}>
          <Table<ToShip>
            size="small"
            rowKey={(r) => `${r.kind}-${r.id}`}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            dataSource={toShip}
            locale={{ emptyText: 'Không có đơn nào đang chờ gửi' }}
            columns={[
              {
                title: 'Loại',
                width: 130,
                render: (_, r) => (r.kind === 'quote' ? <Tag color="gold">Báo giá</Tag> : <Tag color="blue">Đơn áo {orderCode(r.id)}</Tag>),
              },
              {
                title: 'Khách / người nhận',
                render: (_, r) => (
                  <>
                    <Link to={r.kind === 'quote' ? `/bao-gia/${r.id}` : `/don-ao/${r.id}`}>
                      <b>{r.name || '(chưa có tên)'}</b>
                    </Link>
                    <SubText>{r.phone}</SubText>
                  </>
                ),
              },
              {
                title: 'Tổng tiền',
                align: 'right',
                render: (_, r) => (
                  <>
                    {fmtMoney(r.grand)}
                    <SubText>{r.remaining > 0 ? `Còn ${fmtMoney(r.remaining)}` : 'Đã thu đủ'}</SubText>
                  </>
                ),
              },
              {
                title: 'Mã vận chuyển',
                width: 140,
                render: (_, r) =>
                  r.printedAt ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      Đã in
                    </Tag>
                  ) : (
                    <Tag>Chưa in</Tag>
                  ),
              },
              { title: 'Nhận tiền lúc', width: 150, render: (_, r) => fmtDateTime(r.paidAt) },
            ]}
          />
        </Card>
      </div>
    </PageShell>
  )
}
