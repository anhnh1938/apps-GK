import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { App, Button, Card, Checkbox, Col, Flex, Form, Input, InputNumber, Radio, Row, Select, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { MoneyInput } from '../../components/MoneyInput'
import { ImageDropzone, ImageThumbs, SectionCard } from '../../components/SectionCard'
import { fmtMoney } from '../../lib/format'
import { colorOf, printKindUnit, tierLabel, withCurrent } from '../products/catalog'
import { printCounts, shipText } from './calc'
import type { PricedLine, QuoteCalc } from './calc'
import { CUSTOM, FONTS } from './constants'
import { fitToProduct, newItem } from './state'
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
        {/* Ngày báo giá không có ô sửa: tự lấy ngày bấm "Tạo báo giá" (createQuote) */}
        <Col span={24}>
          <Form.Item label="Số điện thoại">
            <Input
              value={c.phone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              inputMode="tel"
              placeholder="09xx xxx xxx"
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

/**
 * Màu tag / kích thước theo sản phẩm mác áo (chụp vào báo giá). Lựa chọn cũ không còn trong sản phẩm vẫn hiện,
 * để báo giá cũ hiện đúng. Sản phẩm không có màu / kích thước thì ẩn hàng đó.
 */
function TagOptions({ product, item, onChange }: { product: Product; item: QuoteItem; onChange: (patch: Partial<QuoteItem>) => void }) {
  const colors = withCurrent(product.colors, item.color && colorOf(item.color), (c) => c.name)
  const sizes = withCurrent(product.sizes, item.size, (v) => v)
  if (!colors.length && !sizes.length) return null
  return (
    <div className={s.options}>
      {colors.length > 0 && (
        <Flex align="center" gap={6} wrap>
          <span className={s.optLabel}>Màu tag</span>
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={item.color}
            onChange={(e) => onChange({ color: e.target.value })}
            options={colors.map((c) => ({
              value: c.name,
              label: (
                <>
                  <span className={s.swatch} style={{ background: c.hex }} />
                  {c.name}
                </>
              ),
            }))}
          />
        </Flex>
      )}
      {sizes.length > 0 && (
        <Flex align="center" gap={6} wrap>
          <span className={s.optLabel}>Kích thước</span>
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={item.size}
            onChange={(e) => onChange({ size: e.target.value })}
            options={sizes.map((v) => ({ value: v, label: v }))}
          />
        </Flex>
      )}
    </div>
  )
}

// ---------- 2. Chi tiết đơn hàng ----------
function ItemsSection({ state, calc, setState }: { state: QuoteState; calc: QuoteCalc; setState: SetQuote }) {
  const [focusId, setFocusId] = useState<string | null>(null)

  const patchItem = (id: string, patch: Partial<QuoteItem>) =>
    setState((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const removeItem = (id: string) => setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }))

  // Số lượng mác áo tự tính từ "Nội dung in": tag in chữ = số câu, tag in hình = số ảnh (withAutoQty).
  // Mỗi cách tính chỉ một dòng; dòng "Sản phẩm khác" vẫn nhập số lượng / đơn giá tay.
  const counts = printCounts(state.printContent, state.printImages.length)
  const usedKinds = new Set(calc.rows.flatMap((r) => (r.product ? [r.product.printKind] : [])))
  const addItem = (product?: Product) => {
    const next = product ?? state.products.find((p) => !usedKinds.has(p.printKind))
    const item = next ? newItem({ productId: next.id }, next) : { ...newItem({ productId: CUSTOM }), manual: true }
    setState((s) => ({ ...s, items: [...s.items, item] }))
    if (!next) setFocusId(item.id)
  }
  // Có câu / ảnh nhưng chưa có dòng tag tương ứng → gợi ý thêm
  const missing = (['text', 'image'] as const).flatMap((kind) => {
    const p = state.products.find((x) => x.printKind === kind)
    return p && counts[kind] > 0 && !usedKinds.has(kind) ? [{ product: p, count: counts[kind] }] : []
  })

  const optionsFor = (item: QuoteItem) => [
    ...state.products.map((p) => ({
      value: p.id,
      label: p.name,
      // Đã có dòng khác cùng cách tính (số câu / số ảnh) → không chọn được
      disabled: calc.rows.some((r) => r.item.id !== item.id && r.product?.printKind === p.printKind),
    })),
    { value: CUSTOM, label: 'Sản phẩm khác…' },
  ]

  return (
    <SectionCard
      step={2}
      title="Chi tiết đơn hàng"
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={() => addItem()}>
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
                  options={optionsFor(item)}
                  onChange={(v: string) =>
                    patchItem(
                      item.id,
                      v === CUSTOM
                        ? { productId: v, manual: true, price: null }
                        : // Đổi loại tag: màu / kích thước không có ở loại mới thì về lựa chọn đầu của loại đó
                          { productId: v, manual: false, ...fitToProduct(state.products.find((p) => p.id === v), item) },
                    )
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
                <TagOptions product={product} item={item} onChange={(patch) => patchItem(item.id, patch)} />
              ) : (
                <Input
                  style={{ marginTop: 8 }}
                  value={item.name}
                  onChange={(e) => patchItem(item.id, { name: e.target.value })}
                  placeholder="Tên sản phẩm / dịch vụ"
                />
              )}

              {product ? (
                // Mác áo: số lượng / đơn giá tự tính — chỉ ghi chú số lượng lấy từ đâu
                <div className={s.hint}>
                  <AutoQtyHint
                    row={row}
                    count={counts[product.printKind]}
                    duplicate={calc.rows.slice(0, i).some((r) => r.product?.printKind === product.printKind)}
                  />
                </div>
              ) : (
                <>
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
                        onChange={(v) => patchItem(item.id, { price: v, manual: true })}
                      />
                    </label>
                    <div>
                      <span className={s.fieldLabel}>Thành tiền</span>
                      <div className={s.lineTotal}>{row.total == null ? '—' : fmtMoney(row.total)}</div>
                    </div>
                  </div>
                  {item.qty > 0 && row.price == null && (
                    <div className={s.hint}>
                      <Text type="warning">⚠ Nhập đơn giá cho sản phẩm này.</Text>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      {missing.length > 0 && (
        <Flex vertical gap={6} style={{ marginTop: 12 }}>
          {missing.map(({ product, count }) => (
            <Flex key={product.id} align="center" gap={8} wrap>
              <Text type="warning">
                ⚠ Có {count} {printKindUnit(product.printKind)} ở “Nội dung in” nhưng chưa có dòng {product.name}.
              </Text>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addItem(product)}>
                Thêm {product.name}
              </Button>
            </Flex>
          ))}
        </Flex>
      )}

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

/** Dòng mác áo: số lượng lấy từ "Nội dung in" (số câu / số ảnh), đơn giá theo bậc của bảng giá */
function AutoQtyHint({ row, count, duplicate }: { row: PricedLine; count: number; duplicate: boolean }) {
  const { item, product, price, tier } = row
  if (!product) return null
  const unit = printKindUnit(product.printKind)
  if (duplicate) {
    return <Text type="warning">⚠ Đã có dòng tính theo số {unit} ở trên — dòng này không tính tiền. Xoá dòng hoặc đổi loại.</Text>
  }
  if (!item.qty) return <Text type="secondary">Số lượng = số {unit} ở “Nội dung in” (chưa có {unit} nào).</Text>
  // Báo giá đã khoá giữ số lượng đã lưu — có thể khác số câu / ảnh hiện tại (dữ liệu cũ)
  const source = item.qty === count ? `${count} ${unit} ở “Nội dung in” → ` : ''
  if (price == null) {
    return <Text type="warning">⚠ {source}{item.qty} chiếc: giá thương lượng — sửa bảng giá ở mục Sản phẩm.</Text>
  }
  return (
    <Text type="secondary">
      {source}
      {item.qty} chiếc · bậc “{tier}”
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
  const counts = printCounts(state.printContent, state.printImages.length)
  return (
    <SectionCard step={3} title="Nội dung in">
      <Form.Item
        label={`Chữ cần in lên tag · ${counts.text} câu`}
        extra="Đánh số 1. 2. 3. … (hoặc cách nhau một dòng trống). Mỗi câu = 1 tag in chữ."
      >
        <Input.TextArea
          autoSize={{ minRows: 5 }}
          value={state.printContent}
          onChange={(e) => setState((s) => ({ ...s, printContent: e.target.value }))}
          placeholder={'VD:\n1. Gửi anh một cái ôm\ndưới hình hài chiếc áo.\n2. Chúc mừng sinh nhật!\n3. Cảm ơn vì đã luôn ở bên'}
        />
      </Form.Item>
      <span className={s.fieldLabel}>Ảnh / thiết kế cần in · {counts.image} ảnh (mỗi ảnh = 1 tag in hình)</span>
      <ImageDropzone onFiles={onAddImages} />
      <ImageThumbs images={state.printImages} onRemove={onRemoveImage} />
      <Text type="secondary" className={s.help}>
        Số lượng ở “Chi tiết đơn hàng” tự tính từ đây. Hiện thành mục “Nội dung in” trên báo giá; để trống cả chữ lẫn
        ảnh thì không hiện. Danh sách câu dùng để tạo file mẫu câu (nút “Mẫu câu” ở trên).
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
