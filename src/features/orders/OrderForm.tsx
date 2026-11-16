import type { Dispatch, SetStateAction } from 'react'
import { Button, Col, Flex, Form, Input, InputNumber, Radio, Row, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { MoneyInput } from '../../components/MoneyInput'
import { ImageDropzone, ImageThumbs, SectionCard } from '../../components/SectionCard'
import { fmtMoney } from '../../lib/format'
import type { StoredImage } from '../../lib/images'
import s from '../../components/Form.module.css'
import { colorOf, withCurrent } from '../products/catalog'
import type { ProductDoc } from '../products/types'
import { newOrderItem } from './state'
import type { OrderContent, OrderItem, OrderTotals } from './types'

const { Text } = Typography

type SetOrder = Dispatch<SetStateAction<OrderContent>>

interface Props {
  content: OrderContent
  setContent: SetOrder
  totals: OrderTotals
  /** Sản phẩm áo đang bán (Quản lý sản phẩm) */
  shirts: ProductDoc[]
  tagImages: StoredImage[]
  embroideryImages: StoredImage[]
  onAddImages: (kind: 'tag' | 'embroidery', files: File[]) => void
  onRemoveImage: (id: string) => void
  /** Khoá cả form (đơn đã mang ra bưu cục) */
  readOnly?: boolean
}

export function OrderForm({
  content,
  setContent,
  totals,
  shirts,
  tagImages,
  embroideryImages,
  onAddImages,
  onRemoveImage,
  readOnly,
}: Props) {
  const patch = (p: Partial<OrderContent>) => setContent((c) => ({ ...c, ...p }))
  const setRecipient = (p: Partial<OrderContent['recipient']>) =>
    setContent((c) => ({ ...c, recipient: { ...c.recipient, ...p } }))
  const r = content.recipient

  return (
    <Form layout="vertical" component="div" className={s.form} disabled={readOnly}>
      <SectionCard step={1} title="Người nhận">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item label="Tên người nhận">
              <Input value={r.name} onChange={(e) => setRecipient({ name: e.target.value })} placeholder="VD: Nguyễn Văn A" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Số điện thoại">
              <Input
                value={r.phone}
                onChange={(e) => setRecipient({ phone: e.target.value })}
                inputMode="tel"
                placeholder="09xx xxx xxx"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Địa chỉ giao hàng" style={{ marginBottom: 0 }}>
              <Input.TextArea
                autoSize={{ minRows: 2 }}
                value={r.address}
                onChange={(e) => setRecipient({ address: e.target.value })}
                placeholder="Số nhà, đường, phường, quận, tỉnh"
              />
            </Form.Item>
          </Col>
        </Row>
      </SectionCard>

      <ItemsSection content={content} setContent={setContent} shirts={shirts} />

      <SectionCard step={3} title="Nội dung in tag">
        <Form.Item label="Chữ in lên tag" extra="Mỗi tag tối đa 6 dòng, in được ảnh / icon màu. Giá áo đã gồm tối đa 2 tag.">
          <Input.TextArea
            autoSize={{ minRows: 3 }}
            value={content.tagContent}
            onChange={(e) => patch({ tagContent: e.target.value })}
            placeholder={'VD:\nTag cổ: Gửi anh một cái ôm dưới hình hài chiếc áo\nTag gấu: 16.11.2026'}
          />
        </Form.Item>
        <span className={s.fieldLabel}>Ảnh in tag</span>
        <ImageDropzone onFiles={(files) => onAddImages('tag', files)} hint="PNG, JPG — ảnh / icon cần in lên tag" />
        <ImageThumbs images={tagImages} onRemove={readOnly ? undefined : onRemoveImage} />
      </SectionCard>

      <SectionCard step={4} title="Nội dung thêu">
        <Form.Item label="Chữ thêu">
          <Input.TextArea
            autoSize={{ minRows: 3 }}
            value={content.embroideryContent}
            onChange={(e) => patch({ embroideryContent: e.target.value })}
            placeholder={'VD: Thêu ngực trái “T&L”, chỉ trắng'}
          />
        </Form.Item>
        <span className={s.fieldLabel}>Ảnh mẫu thêu</span>
        <ImageDropzone onFiles={(files) => onAddImages('embroidery', files)} hint="PNG, JPG — hình / logo cần thêu" />
        <ImageThumbs images={embroideryImages} onRemove={readOnly ? undefined : onRemoveImage} />
      </SectionCard>

      <SectionCard step={5} title="Phí ship & ghi chú">
        <span className={s.fieldLabel}>Phí vận chuyển</span>
        <MoneyInput value={content.ship} placeholder="Để trống nếu không tính phí vận chuyển" onChange={(v) => patch({ ship: v })} />
        <Text type="secondary" className={s.help}>
          Để trống: không tính · Nhập 0: “Miễn phí”.
        </Text>
        <Form.Item label="Ghi chú" style={{ margin: '16px 0 0' }}>
          <Input.TextArea
            autoSize={{ minRows: 2 }}
            value={content.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="VD: Giao trước 20/11, gói quà, kèm thiệp…"
          />
        </Form.Item>
        <dl className={s.summary}>
          <div className={s.summaryRow}>
            <dt>Số áo</dt>
            <dd>{totals.qty} áo</dd>
          </div>
          <div className={s.summaryRow}>
            <dt>Tiền áo</dt>
            <dd>{fmtMoney(totals.goods)}</dd>
          </div>
          <div className={s.summaryRow}>
            <dt>Phí vận chuyển</dt>
            <dd>{content.ship == null ? 'Không tính' : content.ship === 0 ? 'Miễn phí' : fmtMoney(content.ship)}</dd>
          </div>
          <div className={s.summaryTotal}>
            <dt>Tổng thanh toán</dt>
            <dd>{fmtMoney(totals.grand)}</dd>
          </div>
        </dl>
      </SectionCard>
    </Form>
  )
}

function ItemsSection({ content, setContent, shirts }: { content: OrderContent; setContent: SetOrder; shirts: ProductDoc[] }) {
  const patchItem = (id: string, p: Partial<OrderItem>) =>
    setContent((c) => ({ ...c, items: c.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }))
  // Đổi loại áo: giữ màu / size nếu loại mới có, giá về giá loại mới
  const changeType = (it: OrderItem, productId: string) => {
    const product = shirts.find((p) => p.id === productId)
    if (!product) return
    const next = newOrderItem(product, it)
    patchItem(it.id, { productId: next.productId, name: next.name, color: next.color, size: next.size, price: next.price })
  }
  const addItem = () =>
    setContent((c) => {
      const last = c.items.at(-1)
      const product = shirts.find((p) => p.id === last?.productId) ?? shirts[0]
      return { ...c, items: [...c.items, newOrderItem(product, last)] }
    })
  const removeItem = (id: string) => setContent((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) }))

  return (
    <SectionCard
      step={2}
      title="Áo"
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={addItem} disabled={!shirts.length}>
          Thêm áo
        </Button>
      }
    >
      {!shirts.length && (
        <Text type="warning" className={s.help} style={{ marginBottom: 12 }}>
          Chưa có sản phẩm áo nào đang bán — thêm ở mục <Link to="/san-pham">Sản phẩm</Link>.
        </Text>
      )}
      <div className={s.items}>
        {content.items.length === 0 && <p className={s.empty}>Chưa có áo nào.</p>}
        {content.items.map((it, i) => {
          const product = shirts.find((p) => p.id === it.productId)
          // Áo đã ngừng bán / bị xoá: vẫn hiện đúng lựa chọn cũ của đơn
          const typeOptions = [
            ...shirts.map((p) => ({ value: p.id, label: `${p.name} · ${p.price == null ? '—' : fmtMoney(p.price)}` })),
            ...(product ? [] : [{ value: it.productId, label: `${it.name} (ngừng bán)`, disabled: true }]),
          ]
          // Màu / size của sản phẩm; lựa chọn cũ của đơn không còn trong sản phẩm thì vẫn hiện thêm
          const colors = withCurrent(product?.colors ?? [], it.color && colorOf(it.color), (c) => c.name)
          const sizes = withCurrent(product?.sizes ?? [], it.size, (v) => v)
          const total = it.price == null ? null : it.price * it.qty
          return (
            <div key={it.id} className={s.item}>
              <Flex align="center" gap={8}>
                <span className={s.itemNo}>{i + 1}.</span>
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  value={it.productId}
                  onChange={(e) => changeType(it, e.target.value)}
                  options={typeOptions}
                  style={{ flex: 1 }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  title="Xoá áo này"
                  aria-label={`Xoá áo ${i + 1}`}
                  onClick={() => removeItem(it.id)}
                />
              </Flex>
              {product?.spec && (
                <Text type="secondary" className={s.help}>
                  {product.spec}
                </Text>
              )}
              <div className={s.options}>
                <Flex align="center" gap={6} wrap>
                  <span className={s.optLabel}>Màu áo</span>
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    value={it.color}
                    onChange={(e) => patchItem(it.id, { color: e.target.value })}
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
                <Flex align="center" gap={6} wrap>
                  <span className={s.optLabel}>Size</span>
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    value={it.size}
                    onChange={(e) => patchItem(it.id, { size: e.target.value })}
                    options={sizes.map((v) => ({ value: v, label: v }))}
                  />
                </Flex>
              </div>
              <div className={s.itemGrid}>
                <label>
                  <span className={s.fieldLabel}>Số lượng</span>
                  <InputNumber<number>
                    min={1}
                    precision={0}
                    inputMode="numeric"
                    value={it.qty}
                    onChange={(v) => patchItem(it.id, { qty: Math.max(1, Math.floor(v ?? 1)) })}
                    style={{ width: '100%' }}
                    styles={{ input: { textAlign: 'center' } }}
                  />
                </label>
                <label>
                  <span className={s.fieldLabel}>Đơn giá</span>
                  <MoneyInput value={it.price} placeholder="0" onChange={(v) => patchItem(it.id, { price: v })} />
                </label>
                <div>
                  <span className={s.fieldLabel}>Thành tiền</span>
                  <div className={s.lineTotal}>{total == null ? '—' : fmtMoney(total)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
