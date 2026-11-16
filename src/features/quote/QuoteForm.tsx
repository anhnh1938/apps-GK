import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { App, Button, Card, Checkbox, Col, DatePicker, Flex, Form, Input, InputNumber, Radio, Row, Select, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { MoneyInput } from '../../components/MoneyInput'
import { ImageDropzone, ImageThumbs, SectionCard } from '../../components/SectionCard'
import { fmtMoney } from '../../lib/format'
import { tierLabel } from '../products/catalog'
import { shipText } from './calc'
import type { PricedLine, QuoteCalc } from './calc'
import { COLORS, CUSTOM, FONTS, SIZES } from './constants'
import { newItem } from './state'
import type { FontKey, Product, QuoteContent, QuoteItem, QuoteState } from './types'
import s from '../../components/Form.module.css'

const { Text } = Typography

type SetQuote = Dispatch<SetStateAction<QuoteContent>>

interface Props {
  /** Nội dung + ảnh nội dung in (để hiển thị) */
  state: QuoteState
  calc: QuoteCalc
  /** Sửa nội dung (ảnh thêm/xoá qua onAddImages / onRemoveImage) */
  setState: SetQuote
  onAddImages: (files: File[]) => void
  onRemoveImage: (id: string) => void
  /** Khoá cả form (báo giá đã nhận tiền) — antd tự vô hiệu mọi ô nhập / nút bên trong */
  readOnly?: boolean
  /** Bảng giá hiện tại của các sản phẩm mác áo đang bán (nút "Lấy bảng giá mới nhất") */
  catalog: Product[]
}

export function QuoteForm({ state, calc, setState, onAddImages, onRemoveImage, readOnly, catalog }: Props) {
  return (
    <Form layout="vertical" component="div" className={s.form} disabled={readOnly}>
      <CustomerSection state={state} setState={setState} />
      <ItemsSection state={state} calc={calc} setState={setState} />
      <PrintContentSection state={state} setState={setState} onAddImages={onAddImages} onRemoveImage={onRemoveImage} />
      <PriceTableSection state={state} setState={setState} catalog={catalog} />
      <SettingsSection state={state} setState={setState} />
    </Form>
  )
}

// ---------- 1. Khách hàng ----------
function CustomerSection({ state, setState }: { state: QuoteState; setState: SetQuote }) {
  const setCustomer = (patch: Partial<QuoteState['customer']>) =>
    setState((s) => ({ ...s, customer: { ...s.customer, ...patch } }))
  const c = state.customer

  return (
    <SectionCard step={1} title="Thông tin khách hàng">
      <Row gutter={12}>
        <Col span={24}>
          <Form.Item label="Tên khách hàng">
            <Input
              value={c.name}
              onChange={(e) => setCustomer({ name: e.target.value })}
              placeholder="VD: Chị Lan – shop Mộc"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Số điện thoại">
            <Input
              value={c.phone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              inputMode="tel"
              placeholder="09xx xxx xxx"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Ngày báo giá">
            <DatePicker
              value={state.date ? dayjs(state.date) : null}
              onChange={(d) => setState((s) => ({ ...s, date: d ? d.format('YYYY-MM-DD') : '' }))}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="Địa chỉ giao hàng" style={{ marginBottom: 0 }}>
            <Input
              value={c.address}
              onChange={(e) => setCustomer({ address: e.target.value })}
              placeholder="Số nhà, đường, phường, quận, tỉnh"
            />
          </Form.Item>
        </Col>
      </Row>
    </SectionCard>
  )
}

// ---------- 2. Chi tiết đơn hàng ----------
function ItemsSection({ state, calc, setState }: { state: QuoteState; calc: QuoteCalc; setState: SetQuote }) {
  const [focusId, setFocusId] = useState<string | null>(null)

  const patchItem = (id: string, patch: Partial<QuoteItem>) =>
    setState((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const removeItem = (id: string) => setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }))
  const addItem = () => {
    // Dòng mới lấy loại tag / màu / kích thước của dòng cuối
    const item = newItem({ ...state.items.at(-1), qty: 0 })
    setState((s) => ({ ...s, items: [...s.items, item] }))
    setFocusId(item.id)
  }

  const productOptions = [
    ...state.products.map((p) => ({ value: p.id, label: p.name })),
    { value: CUSTOM, label: 'Sản phẩm khác…' },
  ]

  return (
    <SectionCard
      step={2}
      title="Chi tiết đơn hàng"
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={addItem}>
          Thêm dòng
        </Button>
      }
    >
      <div className={s.items}>
        {calc.rows.length === 0 && <p className={s.empty}>Chưa có sản phẩm nào.</p>}
        {calc.rows.map((row, i) => {
          const { item, product } = row
          return (
            <div key={item.id} className={s.item}>
              <Flex align="center" gap={8}>
                <span className={s.itemNo}>{i + 1}.</span>
                <Select
                  style={{ flex: 1, minWidth: 0 }}
                  value={product ? item.productId : CUSTOM}
                  options={productOptions}
                  onChange={(v: string) =>
                    patchItem(item.id, v === CUSTOM ? { productId: v, manual: true, price: null } : { productId: v, manual: false })
                  }
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  title="Xoá dòng"
                  aria-label={`Xoá dòng ${i + 1}`}
                  onClick={() => removeItem(item.id)}
                />
              </Flex>

              {product ? (
                <div className={s.options}>
                  <Flex align="center" gap={6} wrap>
                    <span className={s.optLabel}>Màu tag</span>
                    <Radio.Group
                      size="small"
                      optionType="button"
                      buttonStyle="solid"
                      value={item.color}
                      onChange={(e) => patchItem(item.id, { color: e.target.value })}
                      options={COLORS.map((c) => ({
                        value: c.name,
                        label: (
                          <>
                            <span className={s.swatch} style={{ background: c.swatch }} />
                            {c.name}
                          </>
                        ),
                      }))}
                    />
                  </Flex>
                  <Flex align="center" gap={6} wrap>
                    <span className={s.optLabel}>Kích thước</span>
                    <Radio.Group
                      size="small"
                      optionType="button"
                      buttonStyle="solid"
                      value={item.size}
                      onChange={(e) => patchItem(item.id, { size: e.target.value })}
                      options={SIZES.map((v) => ({ value: v, label: v }))}
                    />
                  </Flex>
                </div>
              ) : (
                <Input
                  style={{ marginTop: 8 }}
                  value={item.name}
                  onChange={(e) => patchItem(item.id, { name: e.target.value })}
                  placeholder="Tên sản phẩm / dịch vụ"
                />
              )}

              <div className={s.itemGrid}>
                <label>
                  <span className={s.fieldLabel}>Số lượng</span>
                  <InputNumber<number>
                    autoFocus={item.id === focusId}
                    min={0}
                    precision={0}
                    inputMode="numeric"
                    value={item.qty || null}
                    placeholder="0"
                    onChange={(v) => patchItem(item.id, { qty: Math.max(0, Math.floor(v ?? 0)) })}
                    style={{ width: '100%' }}
                    styles={{ input: { textAlign: 'center' } }}
                  />
                </label>
                <label>
                  <span className={s.fieldLabel}>Đơn giá</span>
                  <MoneyInput
                    value={row.price}
                    placeholder="0"
                    status={item.qty > 0 && row.price == null ? 'warning' : undefined}
                    // Gõ giá = chuyển sang giá nhập tay
                    onChange={(v) => patchItem(item.id, { price: v, manual: true })}
                  />
                </label>
                <div>
                  <span className={s.fieldLabel}>Thành tiền</span>
                  <div className={s.lineTotal}>{row.total == null ? '—' : fmtMoney(row.total)}</div>
                </div>
              </div>
              <div className={s.hint}>
                <ItemHint row={row} onUseAuto={() => patchItem(item.id, { manual: false })} />
              </div>
            </div>
          )
        })}
      </div>

      <div className={s.ship}>
        <span className={s.fieldLabel}>Phí vận chuyển</span>
        <MoneyInput
          value={state.ship}
          placeholder="Để trống nếu không tính phí vận chuyển"
          onChange={(v) => setState((s) => ({ ...s, ship: v }))}
        />
        <Text type="secondary" className={s.help}>
          Để trống: không hiện dòng phí vận chuyển · Nhập 0: hiện “Miễn phí”.
        </Text>
      </div>

      <dl className={s.summary}>
        <div className={s.summaryRow}>
          <dt>Tổng số lượng</dt>
          <dd>{calc.qty} chiếc</dd>
        </div>
        <div className={s.summaryRow}>
          <dt>Tiền hàng</dt>
          <dd>{fmtMoney(calc.goods)}</dd>
        </div>
        <div className={s.summaryRow}>
          <dt>Phí vận chuyển</dt>
          <dd>{shipText(state.ship)}</dd>
        </div>
        <div className={s.summaryTotal}>
          <dt>Tổng thanh toán</dt>
          <dd>{fmtMoney(calc.grand)}</dd>
        </div>
        {calc.unpriced && (
          <Text type="warning" className={s.help}>
            ⚠ Có sản phẩm chưa có đơn giá – tổng chưa tính phần này.
          </Text>
        )}
      </dl>
    </SectionCard>
  )
}

function ItemHint({ row, onUseAuto }: { row: PricedLine; onUseAuto: () => void }) {
  const { item, product, price, autoPrice, productQty } = row
  if (!product) return item.qty > 0 && price == null ? <Text type="warning">⚠ Nhập đơn giá cho sản phẩm này.</Text> : null
  if (!item.qty) return <Text type="secondary">Nhập số lượng để tính giá.</Text>
  if (item.manual) {
    return (
      <>
        <Text type="secondary">Giá nhập tay.</Text>
        <Button type="link" size="small" onClick={onUseAuto}>
          ↺ Dùng giá bảng ({autoPrice == null ? 'thương lượng' : fmtMoney(autoPrice)})
        </Button>
      </>
    )
  }
  if (autoPrice == null) {
    return (
      <Text type="warning">
        ⚠ {product.name} tổng {productQty} chiếc: giá thương lượng – hãy nhập đơn giá.
      </Text>
    )
  }
  return (
    <Text type="secondary">
      Theo bảng giá · {product.name} tổng {productQty} chiếc → bậc “{row.tier}”
    </Text>
  )
}

// ---------- 3. Nội dung in ----------
function PrintContentSection({
  state,
  setState,
  onAddImages,
  onRemoveImage,
}: {
  state: QuoteState
  setState: SetQuote
  onAddImages: (files: File[]) => void
  onRemoveImage: (id: string) => void
}) {
  return (
    <SectionCard step={3} title="Nội dung in">
      <Form.Item label="Chữ cần in lên tag">
        <Input.TextArea
          autoSize={{ minRows: 5 }}
          value={state.printContent}
          onChange={(e) => setState((s) => ({ ...s, printContent: e.target.value }))}
          placeholder={'VD:\nMặt trước: Mộc Handmade – Since 2020\nMặt sau: Thank you for shopping with us ♡\nFont chữ viết tay, in màu nâu'}
        />
      </Form.Item>
      <span className={s.fieldLabel}>Ảnh / thiết kế cần in</span>
      <ImageDropzone onFiles={onAddImages} />
      <ImageThumbs images={state.printImages} onRemove={onRemoveImage} />
      <Text type="secondary" className={s.help}>
        Hiện thành mục “Nội dung in” trên báo giá. Để trống cả chữ lẫn ảnh thì không hiện. Danh sách câu trong ô
        này dùng để tạo file mẫu câu (nút “Mẫu câu” ở trên).
      </Text>
    </SectionCard>
  )
}

// ---------- 4. Bảng đơn giá ----------
// Bảng giá cấu hình ở Quản lý sản phẩm; báo giá giữ bản chụp lúc tạo (đổi giá sau này không làm sai báo giá cũ).
function PriceTableSection({ state, setState, catalog }: { state: QuoteState; setState: SetQuote; catalog: Product[] }) {
  const { modal } = App.useApp()
  const refresh = () =>
    modal.confirm({
      title: 'Lấy bảng giá mới nhất?',
      content: 'Thay bảng giá của báo giá này bằng giá hiện tại trong Quản lý sản phẩm (các sản phẩm mác áo đang bán).',
      okText: 'Lấy giá mới',
      cancelText: 'Huỷ',
      onOk: () => setState((s) => ({ ...s, products: structuredClone(catalog) })),
    })

  return (
    <SectionCard
      step={4}
      title="Bảng đơn giá theo số lượng"
      extra={
        <Button size="small" icon={<ReloadOutlined />} onClick={refresh} disabled={!catalog.length}>
          Lấy bảng giá mới nhất
        </Button>
      }
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        Đơn giá tự tính theo bảng này, dựa trên tổng số lượng của từng loại tag. Bảng giá sửa ở mục{' '}
        <Link to="/san-pham">Sản phẩm</Link>; báo giá giữ giá tại lúc tạo.
      </Text>
      <div style={{ margin: '12px 0 16px' }}>
        <Checkbox
          checked={state.showPriceTables}
          onChange={(e) => setState((s) => ({ ...s, showPriceTables: e.target.checked }))}
        >
          Hiện bảng giá trên báo giá
        </Checkbox>
      </div>
      <Flex vertical gap={12}>
        {state.products.map((p) => (
          <Card key={p.id} size="small" type="inner" title={p.name}>
            {p.tiers.map((t, ti) => (
              <div key={t.min} className={s.tierRow}>
                <Text>{tierLabel(p.tiers, ti)}</Text>
                <Text strong style={{ textAlign: 'right' }}>
                  {t.price == null ? 'Thương lượng' : `${fmtMoney(t.price)}/chiếc`}
                </Text>
              </div>
            ))}
          </Card>
        ))}
      </Flex>
    </SectionCard>
  )
}

// ---------- 5. Tiêu đề & ghi chú ----------
function SettingsSection({ state, setState }: { state: QuoteState; setState: SetQuote }) {
  const patch = (p: Partial<QuoteState>) => setState((s) => ({ ...s, ...p }))
  return (
    <SectionCard step={5} title="Tiêu đề & ghi chú">
      <Form.Item label="Font chữ">
        <Select<FontKey>
          value={state.font}
          onChange={(font) => patch({ font })}
          options={Object.entries(FONTS).map(([value, f]) => ({ value: value as FontKey, label: f.label }))}
        />
      </Form.Item>
      <Form.Item>
        <Checkbox checked={state.showPayment} onChange={(e) => patch({ showPayment: e.target.checked })}>
          Hiện QR thanh toán trên báo giá
        </Checkbox>
      </Form.Item>
      <Form.Item label="Tiêu đề">
        <Input value={state.title} onChange={(e) => patch({ title: e.target.value })} />
      </Form.Item>
      <Form.Item label="Dòng phụ dưới tiêu đề">
        <Input value={state.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
      </Form.Item>
      <Form.Item
        label="Thông tin sản phẩm thêm (mỗi dòng một ý)"
        extra="Kích thước và màu tag được tự thêm vào mục “Thông tin sản phẩm” theo đơn."
        style={{ marginBottom: 0 }}
      >
        <Input.TextArea autoSize={{ minRows: 4 }} value={state.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </Form.Item>
    </SectionCard>
  )
}
