import { useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, Flex, Form, Input, InputNumber, Popconfirm, Radio, Result, Row, Select, Spin, Switch, Table, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/context'
import { MoneyInput } from '../../components/MoneyInput'
import { PageShell } from '../../components/PageShell'
import { firestoreErrorText, useDocOnce } from '../../lib/firestoreHooks'
import { fmtMoney } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { PRODUCT_TYPES, sortTiers, tierLabel } from './catalog'
import { createProduct, deleteProduct, productRef, saveProduct, toProduct } from './repo'
import type { PriceTier, ProductContent, ProductDoc, ProductType } from './types'

const { Text } = Typography

const blank = (type: ProductType): ProductContent => ({
  type,
  name: '',
  active: true,
  note: '',
  tiers: [
    { min: 1, price: null },
    { min: 10, price: null },
    { min: 20, price: null },
    { min: 50, price: null },
    { min: 100, price: null },
  ],
  price: null,
  colors: [],
  sizes: [],
  spec: '',
  sortOrder: 10,
})

/** /san-pham/moi, /san-pham/:id — form sản phẩm, lưu khi bấm nút (không tự lưu: giá là thứ quan trọng) */
export default function ProductEditorPage() {
  const { id } = useParams()
  return id ? <ExistingProduct key={id} id={id} /> : <ProductEditor product={null} initial={blank('tag')} />
}

function ExistingProduct({ id }: { id: string }) {
  const ref = useMemo(() => productRef(id), [id])
  const { data, loading, notFound, error } = useDocOnce(ref, toProduct)
  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }
  if (error) return <Result status="error" title="Không tải được sản phẩm" subTitle={firestoreErrorText(error)} />
  if (notFound || !data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy sản phẩm"
        extra={
          <Link to="/san-pham">
            <Button type="primary">Về danh sách sản phẩm</Button>
          </Link>
        }
      />
    )
  }
  return <ProductEditor product={data} initial={data} />
}

/** Bậc giá: bậc đầu phải từ 1 chiếc, số lượng tăng dần, không trùng */
function validateTiers(list: PriceTier[] | undefined) {
  if (!list?.length) return Promise.reject(new Error('Cần ít nhất 1 bậc giá'))
  if (list[0]?.min !== 1) return Promise.reject(new Error('Bậc đầu tiên phải tính từ 1 chiếc'))
  for (let i = 1; i < list.length; i++) {
    if (!(list[i]?.min > list[i - 1]?.min)) return Promise.reject(new Error('Số lượng của các bậc phải tăng dần, không trùng'))
  }
  return Promise.resolve()
}

function ProductEditor({ product, initial }: { product: ProductDoc | null; initial: ProductContent }) {
  const isNew = product == null
  const { message } = App.useApp()
  const navigate = useNavigate()
  const auth = useAuth()
  const isAdmin = auth.status === 'ready' && auth.member.role === 'admin'
  const [form] = Form.useForm<ProductContent>()
  const [saving, setSaving] = useState(false)
  const type = Form.useWatch('type', form) ?? initial.type
  const tiers = (Form.useWatch('tiers', form) ?? initial.tiers) as PriceTier[]
  const name = Form.useWatch('name', form) ?? initial.name
  useDocumentTitle(name ? `Sản phẩm · ${name}` : 'Sản phẩm mới')

  const submit = async () => {
    let values: ProductContent
    try {
      values = { ...initial, ...(await form.validateFields()) }
    } catch {
      return
    }
    setSaving(true)
    try {
      if (product) {
        await saveProduct(product.id, values)
        message.success('Đã lưu sản phẩm')
        form.setFieldsValue({ tiers: sortTiers(values.tiers ?? []) })
      } else {
        await createProduct(values)
        message.success('Đã tạo sản phẩm')
        navigate('/san-pham', { replace: true })
      }
    } catch (err) {
      message.error(firestoreErrorText(err))
    } finally {
      setSaving(false)
    }
  }

  const sortedTiers = sortTiers((tiers ?? []).filter((t) => t && t.min > 0))

  return (
    <PageShell
      back="/san-pham"
      title={name || (isNew ? 'Sản phẩm mới' : 'Sản phẩm')}
      subtitle={isNew ? 'Bấm “Tạo sản phẩm” để lưu' : 'Sửa xong bấm “Lưu”'}
      actions={
        isAdmin && (
          <>
            {product && (
              <Popconfirm
                title="Xoá sản phẩm này?"
                description="Báo giá / đơn đã tạo vẫn giữ giá cũ."
                okText="Xoá"
                okButtonProps={{ danger: true }}
                cancelText="Huỷ"
                onConfirm={() =>
                  deleteProduct(product.id).then(
                    () => {
                      message.success('Đã xoá sản phẩm')
                      navigate('/san-pham')
                    },
                    (err) => message.error(firestoreErrorText(err)),
                  )
                }
              >
                <Button danger icon={<DeleteOutlined />}>
                  Xoá
                </Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
              {isNew ? 'Tạo sản phẩm' : 'Lưu'}
            </Button>
          </>
        )
      }
    >
      <div style={{ maxWidth: 820 }}>
        {!isAdmin && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Chỉ tài khoản admin được sửa sản phẩm." />
        )}
        <Form form={form} layout="vertical" initialValues={initial} disabled={!isAdmin} requiredMark={false}>
          <Card style={{ marginBottom: 20 }}>
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, whitespace: true, message: 'Nhập tên sản phẩm' }]}>
                  <Input placeholder="VD: Tag in chữ, Áo thun…" />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item name="type" label="Loại">
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    options={PRODUCT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="active" label="Đang bán" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="sortOrder" label="Thứ tự hiển thị">
                  <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="note" label="Ghi chú">
                  <Input placeholder="VD: Giá đã gồm tối đa 2 tag" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {type === 'tag' ? (
            <Card title="Bảng giá theo số lượng đặt">
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Đơn giá áp dụng theo <b>tổng số lượng</b> của loại tag này trong một báo giá. Mỗi bậc: đặt từ N chiếc trở
                lên (tới bậc kế tiếp). Để trống đơn giá = “Thương lượng”.
              </Text>
              <Form.List name="tiers" rules={[{ validator: (_, v) => validateTiers(v) }]}>
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, i) => (
                      <Flex key={field.key} gap={12} align="flex-start">
                        <Form.Item
                          name={[field.name, 'min']}
                          label={i === 0 ? 'Từ (chiếc)' : undefined}
                          rules={[{ required: true, message: 'Nhập số lượng' }]}
                          style={{ width: 160 }}
                        >
                          <InputNumber min={1} precision={0} disabled={i === 0} style={{ width: '100%' }} suffix="chiếc" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'price']} label={i === 0 ? 'Đơn giá' : undefined} style={{ flex: 1 }}>
                          <MoneyInput value={null} onChange={() => {}} suffix="đ/chiếc" placeholder="Thương lượng" />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Xoá bậc giá"
                          disabled={fields.length <= 1 || i === 0}
                          onClick={() => remove(field.name)}
                          style={{ marginTop: i === 0 ? 30 : 0 }}
                        />
                      </Flex>
                    ))}
                    <Form.ErrorList errors={errors} />
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const last = sortedTiers.at(-1)?.min ?? 1
                        add({ min: last < 10 ? 10 : last * 2, price: null })
                      }}
                    >
                      Thêm bậc giá
                    </Button>
                  </>
                )}
              </Form.List>

              <Table
                style={{ marginTop: 20 }}
                size="small"
                pagination={false}
                rowKey="min"
                dataSource={sortedTiers}
                columns={[
                  { title: 'Số lượng', render: (_, __, i) => tierLabel(sortedTiers, i) },
                  {
                    title: 'Đơn giá',
                    align: 'right',
                    render: (_, t) => (t.price == null ? 'Thương lượng' : `${fmtMoney(t.price)}/chiếc`),
                  },
                ]}
                title={() => <Text strong>Xem trước bảng giá (như trên báo giá)</Text>}
              />
            </Card>
          ) : (
            <Card title="Giá, màu & size">
              <Row gutter={16}>
                <Col xs={24} md={10}>
                  <Form.Item name="price" label="Giá 1 áo" rules={[{ required: true, message: 'Nhập giá áo' }]}>
                    <MoneyInput value={null} onChange={() => {}} placeholder="VD: 229.000" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={14}>
                  <Form.Item name="spec" label="Mô tả (chất liệu, form…)">
                    <Input placeholder="VD: Cotton 100% · 250 gsm · cổ tròn" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="colors" label="Màu" extra="Gõ tên màu rồi Enter">
                    <Select mode="tags" placeholder="VD: Đen, Trắng, Xanh than" open={false} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="sizes" label="Size" extra="Gõ size rồi Enter">
                    <Select mode="tags" placeholder="VD: S, M, L, XL" open={false} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      </div>
    </PageShell>
  )
}
