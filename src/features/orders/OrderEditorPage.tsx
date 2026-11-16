import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Popconfirm, Result, Spin, Typography } from 'antd'
import { CarOutlined, DeleteOutlined, DownloadOutlined, LockOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons'
import { toBlob } from 'html-to-image'
import { Link, useNavigate, useParams } from 'react-router'
import { EditorPage } from '../../components/EditorPage'
import { PaymentStatusCard, PaymentTag } from '../../components/PaymentStatus'
import type { PaymentActions, PaymentValue } from '../../components/PaymentStatus'
import { ShippingCard } from '../../components/ShippingCard'
import { ShippingLabel } from '../../components/ShippingLabel'
import { SaveIndicator } from '../../components/Status'
import { downloadBlob, uid } from '../../lib/file'
import { firestoreErrorText, useDocOnce } from '../../lib/firestoreHooks'
import { slug } from '../../lib/format'
import { addImage, readImageForFirestore, removeImage, useImages } from '../../lib/images'
import type { PendingImage } from '../../lib/images'
import { EMPTY_SHIPPING, paymentAmounts } from '../../lib/payment'
import type { StatusAtPatch } from '../../lib/statusFields'
import { useAutosave } from '../../lib/useAutosave'
import { useBeforeUnload } from '../../lib/useBeforeUnload'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useShipping } from '../../lib/useShipping'
import { useProducts } from '../products/repo'
import type { ProductDoc } from '../products/types'
import { MAX_ORDER_IMAGE, ORDER_PAYMENT_NOTES, shirtProductsOf } from './constants'
import { OrderForm } from './OrderForm'
import { OrderSlip } from './OrderSlip'
import {
  createOrder,
  deleteOrder,
  markOrderLabelPrinted,
  orderContentOf,
  orderRef,
  saveOrderContent,
  saveOrderShipping,
  markOrderPaid,
  markOrderShipped,
  setOrderPaidPercent,
  toOrder,
  revertOrderToPaid,
  revertOrderToUnpaid,
} from './repo'
import { defaultOrderContent, itemsSummary, orderCode, orderTotals } from './state'
import type { OrderContent, OrderDoc } from './types'

type ImageKind = 'tag' | 'embroidery'

/** /don-ao/moi — form trống, chưa ghi gì; /don-ao/:id — sửa đơn đã có (tự lưu) */
export default function OrderEditorPage() {
  const { id } = useParams()
  return id ? <ExistingOrder key={id} id={id} /> : <NewOrder />
}

/** Đơn mới: áo đầu tiên theo sản phẩm áo đang bán đầu tiên (Quản lý sản phẩm). Chưa ghi gì. */
function NewOrder() {
  const { products } = useProducts()
  if (!products) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }
  return <NewOrderReady firstShirt={shirtProductsOf(products)[0]} />
}

function NewOrderReady({ firstShirt }: { firstShirt: ProductDoc | undefined }) {
  // Cố định nội dung ban đầu: "đã sửa chưa" so sánh theo tham chiếu với nó
  const [initial] = useState(() => defaultOrderContent(firstShirt))
  return <OrderEditor order={null} initial={initial} />
}

function ExistingOrder({ id }: { id: string }) {
  const ref = useMemo(() => orderRef(id), [id])
  const { data, loading, notFound, error } = useDocOnce(ref, toOrder)
  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }
  if (error) return <Result status="error" title="Không tải được đơn áo" subTitle={firestoreErrorText(error)} />
  if (notFound || !data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy đơn áo"
        extra={
          <Link to="/don-ao">
            <Button type="primary">Về danh sách đơn</Button>
          </Link>
        }
      />
    )
  }
  return <OrderEditor order={data} initial={orderContentOf(data)} />
}

/** `order` = null: form tạo mới — chỉ ghi lên Firestore khi bấm "Tạo đơn áo". */
function OrderEditor({ order, initial }: { order: OrderDoc | null; initial: OrderContent }) {
  const isNew = order == null
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const ref = useMemo(() => (order ? orderRef(order.id) : null), [order])
  const [content, setContent] = useState<OrderContent>(initial)
  const [pay, setPay] = useState<PaymentValue>({ status: order?.status ?? 'unpaid', paidPercent: order?.paidPercent ?? null })
  const [statusAt, setStatusAt] = useState(order?.statusAt ?? {})
  const [pending, setPending] = useState<PendingImage[]>([])
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const slipRef = useRef<HTMLDivElement>(null)
  const name = content.recipient.name
  // Đã mang ra bưu cục → khoá: không sửa nội dung, không xoá (rules Firestore cũng chặn).
  // Vẫn sửa được % đã nhận và thông tin vận chuyển / in mã.
  // Đã nhận tiền trở đi: nhập vận chuyển + in mã. Đã mang ra bưu cục → khoá nội dung (rules cũng chặn).
  const shippable = !isNew && pay.status !== 'unpaid'
  const locked = !isNew && pay.status === 'shipped'
  useDocumentTitle(name ? `Đơn áo · ${name}` : isNew ? 'Đơn áo mới' : 'Đơn áo')

  const { products } = useProducts()
  const shirts = useMemo(() => shirtProductsOf(products), [products])

  // Đã có trên Firestore: tự lưu. Form mới: không lưu gì cho tới khi bấm "Tạo đơn áo".
  const save = useCallback((c: OrderContent) => saveOrderContent(order?.id ?? '', c), [order?.id])
  const autosave = useAutosave(content, save, { enabled: !isNew && !locked })
  const totals = useMemo(() => orderTotals(content), [content])

  // Vận chuyển (khi đã mang ra bưu cục)
  const saveShipping = useCallback(
    (s: { carrier: string; trackingCode: string }) => saveOrderShipping(order?.id ?? '', s),
    [order?.id],
  )
  const markPrinted = useCallback(() => markOrderLabelPrinted(order?.id ?? ''), [order?.id])
  const shipping = useShipping(order?.shipping ?? EMPTY_SHIPPING, saveShipping, markPrinted, !isNew)

  const dirty = isNew && (content !== initial || pending.length > 0)
  useBeforeUnload(dirty)

  const { images: storedTag } = useImages(ref, 'tag')
  const { images: storedEmb } = useImages(ref, 'embroidery')
  // Form mới: ảnh còn giữ trên máy (pending), hiển thị như ảnh đã lưu
  const pendingOf = (kind: ImageKind) => pending.filter((p) => p.kind === kind).map((p) => ({ ...p, createdAt: null }))
  const tagImages = isNew ? pendingOf('tag') : storedTag
  const embroideryImages = isNew ? pendingOf('embroidery') : storedEmb

  const onAddImages = (kind: ImageKind, files: File[]) => {
    if (locked) return
    for (const file of files.filter((f) => f.type.startsWith('image/'))) {
      const fail = (err: unknown) => {
        console.error(err)
        message.error(`Không thêm được ảnh “${file.name}”: ${firestoreErrorText(err)}`)
      }
      if (ref) addImage(ref, kind, file, MAX_ORDER_IMAGE).catch(fail)
      else
        readImageForFirestore(file, MAX_ORDER_IMAGE).then(
          (src) => setPending((list) => [...list, { id: uid(), kind, name: file.name, src }]),
          fail,
        )
    }
  }
  const onRemoveImage = (imageId: string) => {
    if (locked) return
    if (!ref) return setPending((list) => list.filter((img) => img.id !== imageId))
    removeImage(ref, imageId).catch((err) => message.error(firestoreErrorText(err)))
  }

  // Trạng thái: hiện ngay trên giao diện rồi ghi; ghi lỗi thì trả lại như cũ + báo lỗi (và ném lại cho hộp thoại)
  // `at`: mốc giờ đổi theo (Date = vừa xong bước đó, null = bỏ mốc khi lùi lại)
  const applyPayment = async (next: PaymentValue, at: StatusAtPatch | null, write: (id: string) => Promise<void>) => {
    if (!order) return
    const prev = { pay, statusAt }
    setPay(next)
    if (at) setStatusAt((cur) => ({ ...cur, ...at }))
    try {
      await write(order.id)
    } catch (err) {
      setPay(prev.pay)
      setStatusAt(prev.statusAt)
      message.error(firestoreErrorText(err))
      throw err
    }
  }
  const paymentActions: PaymentActions = {
    paid: (percent) => applyPayment({ status: 'paid', paidPercent: percent }, { paid: new Date() }, (id) => markOrderPaid(id, percent)),
    percent: (percent) => applyPayment({ ...pay, paidPercent: percent }, null, (id) => setOrderPaidPercent(id, percent)),
    // Đã mang ra bưu cục → đơn bị khoá: lưu nốt nội dung đang sửa trước, sau đó rules không cho ghi nội dung nữa
    shipped: () =>
      applyPayment({ ...pay, status: 'shipped' }, { shipped: new Date() }, async (id) => {
        await saveOrderContent(id, content)
        await markOrderShipped(id)
      }),
    backToUnpaid: () =>
      applyPayment({ status: 'unpaid', paidPercent: null }, { paid: null, shipped: null }, (id) => revertOrderToUnpaid(id)),
    // Lùi về "Đã nhận tiền" → đơn mở khoá, sửa / xoá được lại
    backToPaid: () => applyPayment({ ...pay, status: 'paid' }, { shipped: null }, (id) => revertOrderToPaid(id)),
  }

  const create = async () => {
    setCreating(true)
    try {
      // Đơn mới luôn bắt đầu ở "Chưa nhận tiền"; đổi trạng thái sau khi tạo
      const id = await createOrder(content, pending)
      message.success(`Đã tạo đơn ${orderCode(id)}`)
      navigate(`/don-ao/${id}`, { replace: true })
    } catch (err) {
      message.error(`Không tạo được đơn: ${firestoreErrorText(err)}`)
      setCreating(false)
    }
  }

  const back = () => {
    if (!dirty) return navigate('/don-ao')
    modal.confirm({
      title: 'Bỏ đơn đang soạn?',
      content: 'Đơn này chưa được tạo nên sẽ không được lưu.',
      okText: 'Bỏ',
      okButtonProps: { danger: true },
      cancelText: 'Ở lại',
      onOk: () => navigate('/don-ao'),
    })
  }

  const fileBase = ['Don-ao', slug(name), order ? orderCode(order.id).slice(1) : 'moi'].filter(Boolean).join('-')
  const print = () => {
    const title = document.title
    window.addEventListener('afterprint', () => (document.title = title), { once: true })
    document.title = fileBase
    window.print()
  }
  const exportPng = async () => {
    const node = slipRef.current
    if (!node) return
    setExporting(true)
    try {
      await document.fonts.ready
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', style: { boxShadow: 'none', margin: '0' } })
      if (!blob) throw new Error('Ảnh rỗng')
      downloadBlob(blob, fileBase + '.png')
    } catch (err) {
      console.error(err)
      message.error('Không thể xuất ảnh. Vui lòng thử lại!')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <EditorPage
        back="/don-ao"
        onBack={back}
        title={order ? `${orderCode(order.id)} · ${name || 'chưa có tên người nhận'}` : name || 'Đơn áo mới'}
        subtitle={
          isNew ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              Chưa lưu — bấm “Tạo đơn áo” để lưu lên Firebase
            </Typography.Text>
          ) : locked ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <LockOutlined /> Đã mang ra bưu cục — chỉ xem
            </Typography.Text>
          ) : (
            <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          )
        }
        actions={
          <>
            {order && <PaymentTag {...pay} />}
            {order && !locked && (
              <Popconfirm
                title="Xoá đơn này?"
                description="Xoá cả ảnh tag / thêu. Không hoàn tác được."
                okText="Xoá"
                okButtonProps={{ danger: true }}
                cancelText="Huỷ"
                onConfirm={() =>
                  deleteOrder(order.id).then(
                    () => {
                      message.success('Đã xoá đơn')
                      navigate('/don-ao')
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
            {shippable && (
              <Button icon={<CarOutlined />} onClick={shipping.print}>
                In mã vận chuyển
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={print}>
              In phiếu
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportPng} type={isNew ? 'default' : 'primary'}>
              {exporting ? 'Đang xuất ảnh…' : 'Xuất ảnh PNG'}
            </Button>
            {isNew && (
              <Button type="primary" icon={<SaveOutlined />} loading={creating} onClick={create}>
                Tạo đơn áo
              </Button>
            )}
          </>
        }
        form={
          <>
            {order && (
              <PaymentStatusCard
                value={pay}
                actions={paymentActions}
                grand={totals.grand}
                statusAt={statusAt}
                notes={ORDER_PAYMENT_NOTES}
              />
            )}
            {shippable && (
              <ShippingCard
                value={shipping.value}
                onChange={shipping.setValue}
                printedAt={shipping.printedAt}
                saveStatus={shipping.autosave.status}
                savedAt={shipping.autosave.savedAt}
                onPrint={shipping.print}
              />
            )}
            {locked && (
              <Alert
                type="info"
                showIcon
                icon={<LockOutlined />}
                title="Đơn đã mang ra bưu cục — không sửa, không xoá được"
                description="Vẫn in phiếu, xuất ảnh, sửa % đã nhận, nhập mã vận đơn và in mã vận chuyển được."
              />
            )}
            <OrderForm
              content={content}
              setContent={setContent}
              totals={totals}
              shirts={shirts}
              tagImages={tagImages}
              embroideryImages={embroideryImages}
              onAddImages={onAddImages}
              onRemoveImage={onRemoveImage}
              readOnly={locked}
            />
          </>
        }
        previewLabel="Xem trước phiếu đơn"
        preview={
          <OrderSlip
            ref={slipRef}
            id={order?.id ?? null}
            createdAt={order?.createdAt ?? null}
            status={pay.status}
            paidPercent={pay.paidPercent}
            content={content}
            totals={totals}
            tagImages={tagImages}
            embroideryImages={embroideryImages}
          />
        }
        previewWidth="800px"
      />
      {shippable && order && (
        <ShippingLabel
          data={{
            code: orderCode(order.id),
            carrier: shipping.value.carrier,
            trackingCode: shipping.value.trackingCode,
            recipient: content.recipient,
            contents: itemsSummary(content.items),
            cod: paymentAmounts(totals.grand, pay.status, pay.paidPercent).remaining,
            note: content.note,
          }}
        />
      )}
    </>
  )
}
