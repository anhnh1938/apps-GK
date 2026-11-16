import { useState } from 'react'
import { Alert, App, Button, Card, Input, Popconfirm, Segmented, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/context'
import { SubText } from '../../components/ListToolbar'
import { PageShell } from '../../components/PageShell'
import { firestoreErrorText } from '../../lib/firestoreHooks'
import { matchText } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { priceSummary, PRODUCT_TYPES } from './catalog'
import { createDefaultProducts, deleteProduct, setProductActive, useProducts } from './repo'
import type { ProductDoc, ProductType } from './types'
import fs from '../../components/Form.module.css'

/** /san-pham — danh sách sản phẩm (mác áo có bảng giá theo số lượng; áo có giá; cả hai có màu / size) */
export default function ProductListPage() {
  useDocumentTitle('Sản phẩm')
  const { message } = App.useApp()
  const navigate = useNavigate()
  const auth = useAuth()
  const isAdmin = auth.status === 'ready' && auth.member.role === 'admin'
  const { products, isFallback, error } = useProducts()
  const [type, setType] = useState<ProductType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [seeding, setSeeding] = useState(false)
  const canEdit = isAdmin && !isFallback

  const rows = (products ?? []).filter((p) => (type === 'all' || p.type === type) && matchText([p.name, p.note], search))

  const seed = async () => {
    setSeeding(true)
    try {
      await createDefaultProducts()
      message.success('Đã tạo 4 sản phẩm mặc định')
    } catch (err) {
      message.error(firestoreErrorText(err))
    } finally {
      setSeeding(false)
    }
  }

  const columns: TableColumnsType<ProductDoc> = [
    {
      title: 'Sản phẩm',
      render: (_, p) => (
        <>
          {canEdit ? (
            <Link to={`/san-pham/${p.id}`}>
              <b>{p.name}</b>
            </Link>
          ) : (
            <b>{p.name}</b>
          )}
          {(p.spec || p.note) && <SubText>{[p.spec, p.note].filter(Boolean).join(' · ')}</SubText>}
        </>
      ),
    },
    {
      title: 'Loại',
      width: 130,
      render: (_, p) => {
        const t = PRODUCT_TYPES.find((x) => x.value === p.type)
        return <Tag color={t?.color}>{t?.label}</Tag>
      },
    },
    { title: 'Giá', width: 260, render: (_, p) => priceSummary(p) },
    {
      title: 'Màu / size',
      render: (_, p) =>
        p.colors.length || p.sizes.length ? (
          <>
            {p.colors.length
              ? p.colors.map((c, i) => (
                  <span key={c.name} style={{ whiteSpace: 'nowrap' }}>
                    <span className={fs.swatch} style={{ background: c.hex }} />
                    {c.name}
                    {i < p.colors.length - 1 && ', '}
                  </span>
                ))
              : '—'}
            <SubText>{p.sizes.join(' · ')}</SubText>
          </>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Đang bán',
      width: 100,
      render: (_, p) => (
        <Switch
          size="small"
          checked={p.active}
          disabled={!canEdit}
          onChange={(v) => setProductActive(p.id, v).catch((err) => message.error(firestoreErrorText(err)))}
        />
      ),
    },
    {
      key: 'actions',
      width: 96,
      align: 'right',
      render: (_, p) => (
        <>
          <Tooltip title="Sửa">
            <Button type="text" icon={<EditOutlined />} disabled={!canEdit} onClick={() => navigate(`/san-pham/${p.id}`)} />
          </Tooltip>
          <Popconfirm
            title="Xoá sản phẩm này?"
            description="Báo giá / đơn đã tạo vẫn giữ giá cũ. Muốn ngừng bán tạm thời thì tắt “Đang bán”."
            okText="Xoá"
            okButtonProps={{ danger: true }}
            cancelText="Huỷ"
            disabled={!canEdit}
            onConfirm={() =>
              deleteProduct(p.id).then(
                () => message.success('Đã xoá sản phẩm'),
                (err) => message.error(firestoreErrorText(err)),
              )
            }
          >
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!canEdit} aria-label="Xoá" />
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <PageShell
      title="Sản phẩm"
      subtitle="Mác áo: bảng giá theo số lượng đặt · Áo: giá, màu, size"
      actions={
        isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/san-pham/moi')}>
            Thêm sản phẩm
          </Button>
        )
      }
    >
      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Không đọc được danh sách sản phẩm từ Firebase — đang hiện 4 sản phẩm mặc định"
          description={`${firestoreErrorText(error)} Nếu vừa cập nhật app, hãy publish lại firebase/firestore.rules (có phần gk_products).`}
        />
      )}
      {isFallback && !error && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Chưa có sản phẩm nào trên Firebase — app đang tạm dùng 4 sản phẩm mặc định bên dưới"
          description={isAdmin ? 'Bấm “Tạo sản phẩm mặc định” để lưu chúng lên Firebase rồi sửa giá, hoặc thêm sản phẩm mới.' : 'Nhờ tài khoản admin tạo sản phẩm.'}
          action={
            isAdmin && (
              <Button type="primary" loading={seeding} onClick={seed}>
                Tạo sản phẩm mặc định
              </Button>
            )
          }
        />
      )}
      {!isAdmin && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Chỉ tài khoản admin được thêm / sửa / xoá sản phẩm." />
      )}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 16 }}>
          <Segmented<ProductType | 'all'>
            value={type}
            onChange={setType}
            options={[{ value: 'all', label: 'Tất cả' }, ...PRODUCT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
          <Input.Search allowClear placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
        </div>
        <Table<ProductDoc>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={products == null}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Chưa có sản phẩm nào' }}
        />
      </Card>
    </PageShell>
  )
}
