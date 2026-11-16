import { AutoComplete, Button, Col, Flex, Form, Input, Row, Tag } from 'antd'
import { CarOutlined, CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons'
import { fmtDateTime } from '../lib/format'
import { CARRIERS } from '../lib/payment'
import type { ShippingInfo } from '../lib/payment'
import type { SaveStatus } from '../lib/useAutosave'
import { SectionCard } from './SectionCard'
import { SaveIndicator } from './Status'

/** Thẻ "Vận chuyển" (khi đã mang ra bưu cục): đơn vị, mã vận đơn, in mã vận chuyển + trạng thái đã in */
export function ShippingCard({
  value,
  onChange,
  printedAt,
  saveStatus,
  savedAt,
  onPrint,
}: {
  value: Pick<ShippingInfo, 'carrier' | 'trackingCode'>
  onChange: (v: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) => void
  printedAt: Date | null
  saveStatus: SaveStatus
  savedAt: Date | null
  onPrint: () => void
}) {
  return (
    <SectionCard
      step={<CarOutlined />}
      title="Vận chuyển"
      extra={
        printedAt ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Đã in mã · {fmtDateTime(printedAt)}
          </Tag>
        ) : (
          <Tag>Chưa in mã</Tag>
        )
      }
    >
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item label="Đơn vị vận chuyển">
              <AutoComplete
                value={value.carrier}
                onChange={(carrier) => onChange({ ...value, carrier })}
                options={CARRIERS.map((c) => ({ value: c }))}
                filterOption={(input, opt) => (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                placeholder="VD: GHTK, Viettel Post…"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item label="Mã vận đơn">
              <Input
                value={value.trackingCode}
                onChange={(e) => onChange({ ...value, trackingCode: e.target.value.trim() })}
                placeholder="Mã do bưu cục / đơn vị vận chuyển cấp"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <Flex align="center" justify="space-between" gap={12} wrap>
        <SaveIndicator status={saveStatus} savedAt={savedAt} />
        <Button type="primary" icon={<PrinterOutlined />} onClick={onPrint}>
          {printedAt ? 'In lại mã vận chuyển' : 'In mã vận chuyển'}
        </Button>
      </Flex>
    </SectionCard>
  )
}
