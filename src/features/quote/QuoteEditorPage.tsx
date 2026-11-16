import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Result, Spin, Tooltip, Typography } from 'antd'
import { CarOutlined, DownloadOutlined, FileTextOutlined, LockOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons'
import { toBlob } from 'html-to-image'
import { Link, useNavigate, useParams } from 'react-router'
import { EditorPage } from '../../components/EditorPage'
import { PaymentStatusCard, PaymentTag } from '../../components/PaymentStatus'
import type { PaymentValue } from '../../components/PaymentStatus'
import { ShippingCard } from '../../components/ShippingCard'
import { ShippingLabel } from '../../components/ShippingLabel'
import { SaveIndicator } from '../../components/Status'
import { downloadBlob, uid } from '../../lib/file'
import { firestoreErrorText, useDocOnce } from '../../lib/firestoreHooks'
import { fmtDate, slug } from '../../lib/format'
import { addImage, readImageForFirestore, removeImage, useImages } from '../../lib/images'
import type { PendingImage } from '../../lib/images'
import { EMPTY_SHIPPING, paymentAmounts } from '../../lib/payment'
import { useAutosave } from '../../lib/useAutosave'
import { useBeforeUnload } from '../../lib/useBeforeUnload'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { usePasteImages } from '../../lib/usePasteImages'
import { useShipping } from '../../lib/useShipping'
import { useProducts } from '../products/repo'
import { computeQuote, quoteItemsSummary } from './calc'
import { MAX_PRINT_IMAGE, tagProductsOf } from './constants'
import { QuoteForm } from './QuoteForm'
import { QuotePreview } from './QuotePreview'
import {
  contentOf,
  createQuote,
  latestQuoteContent,
  markQuoteLabelPrinted,
  quoteRef,
  saveQuoteContent,
  saveQuoteShipping,
  setQuoteStatus,
  toQuote,
} from './repo'
import { defaultContent } from './state'
import type { Product, QuoteContent, QuoteDoc, QuoteState } from './types'

/** Tên file khi lưu: Bao-gia-<ten-khach>-<dd-mm-yyyy> */
const fileBase = (c: QuoteContent) =>
  ['Bao-gia', slug(c.customer.name) || 'Goc-Ke-Studio', slug(fmtDate(c.date))].filter(Boolean).join('-')

/** Mã báo giá ngắn in trên tem vận chuyển */
const quoteCode = (id: string) => 'BG-' + id.slice(-6).toUpperCase()

const Loading = () => (
  <div className="app-loading">
    <Spin size="large" />
  </div>
)

/** /bao-gia/moi — form trống, chưa ghi gì; /bao-gia/:id — sửa báo giá đã có (tự lưu) */
export default function QuoteEditorPage() {
  const { id } = useParams()
  return id ? <ExistingQuote key={id} id={id} /> : <NewQuote />
}

function ExistingQuote({ id }: { id: string }) {
  const ref = useMemo(() => quoteRef(id), [id])
  const { data, loading, notFound, error } = useDocOnce(ref, toQuote)
  if (loading) return <Loading />
  if (error) return <Result status="error" title="Không tải được báo giá" subTitle={firestoreErrorText(error)} />
  if (notFound || !data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy báo giá"
        extra={
          <Link to="/bao-gia">
            <Button type="primary">Về danh sách báo giá</Button>
          </Link>
        }
      />
    )
  }
  return <QuoteEditor quote={data} initial={contentOf(data)} />
}

/**
 * Báo giá mới: bảng giá = sản phẩm mác áo đang bán (Quản lý sản phẩm);
 * tiêu đề / ghi chú / font theo báo giá gần nhất. Chỉ đọc, chưa ghi gì.
 */
function NewQuote() {
  const { products } = useProducts()
  const [template, setTemplate] = useState<QuoteContent | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    latestQuoteContent().then(
      (t) => alive && setTemplate(t),
      () => alive && setTemplate(null),
    )
    return () => {
      alive = false
    }
  }, [])
  if (!products || template === undefined) return <Loading />
  return <NewQuoteReady template={template} catalog={tagProductsOf(products)} />
}

function NewQuoteReady({ template, catalog }: { template: QuoteContent | null; catalog: Product[] }) {
  // Cố định nội dung ban đầu: "đã sửa chưa" so sánh theo tham chiếu với nó
  const [initial] = useState(() => defaultContent(template, catalog))
  return <QuoteEditor quote={null} initial={initial} />
}

/** `quote` = null: form tạo mới — chỉ ghi lên Firestore khi bấm "Tạo báo giá". */
function QuoteEditor({ quote, initial }: { quote: QuoteDoc | null; initial: QuoteContent }) {
  const isNew = quote == null
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const ref = useMemo(() => (quote ? quoteRef(quote.id) : null), [quote])
  const [content, setContent] = useState<QuoteContent>(initial)
  const [pay, setPay] = useState<PaymentValue>({ status: quote?.status ?? 'unpaid', paidPercent: quote?.paidPercent ?? null })
  const [statusAt, setStatusAt] = useState(quote?.statusAt ?? {})
  const [pending, setPending] = useState<PendingImage[]>([])
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  useDocumentTitle(content.customer.name ? `Báo giá · ${content.customer.name}` : isNew ? 'Báo giá mới' : 'Báo giá')

  // Đã nhận tiền (hoặc đã mang ra bưu cục) → khoá: chỉ xem, không sửa, không xoá. Rules Firestore cũng chặn.
  const locked = !isNew && pay.status !== 'unpaid'
  const shipped = !isNew && pay.status === 'shipped'

  // Đã có trên Firestore: tự lưu nội dung. Form mới: không lưu gì cho tới khi bấm "Tạo".
  const save = useCallback((c: QuoteContent) => saveQuoteContent(quote?.id ?? '', c), [quote?.id])
  const autosave = useAutosave(content, save, { enabled: !isNew && !locked })

  // Vận chuyển (khi đã mang ra bưu cục) — sửa được kể cả khi báo giá đã khoá
  const saveShipping = useCallback(
    (s: { carrier: string; trackingCode: string }) => saveQuoteShipping(quote?.id ?? '', s),
    [quote?.id],
  )
  const markPrinted = useCallback(() => markQuoteLabelPrinted(quote?.id ?? ''), [quote?.id])
  const shipping = useShipping(quote?.shipping ?? EMPTY_SHIPPING, saveShipping, markPrinted, !isNew)

  const dirty = isNew && (content !== initial || pending.length > 0)
  useBeforeUnload(dirty)

  const { products: catalogProducts } = useProducts()
  const catalog = useMemo(() => tagProductsOf(catalogProducts), [catalogProducts])

  const { images: stored } = useImages(ref, 'print')
  const images = isNew ? pending : stored
  const state: QuoteState = useMemo(() => ({ ...content, printImages: images }), [content, images])
  const calc = useMemo(() => computeQuote(content), [content])

  const onAddImages = useCallback(
    (files: File[]) => {
      if (locked) return
      for (const file of files.filter((f) => f.type.startsWith('image/'))) {
        const fail = (err: unknown) => {
          console.error(err)
          message.error(`Không thêm được ảnh “${file.name}”: ${firestoreErrorText(err)}`)
        }
        if (ref) addImage(ref, 'print', file, MAX_PRINT_IMAGE).catch(fail)
        else
          readImageForFirestore(file, MAX_PRINT_IMAGE).then(
            (src) => setPending((list) => [...list, { id: uid(), kind: 'print', name: file.name, src }]),
            fail,
          )
      }
    },
    [ref, message, locked],
  )
  // Dán ảnh (Ctrl+V) ở bất kỳ đâu trên trang → thêm vào "Nội dung in"
  usePasteImages(onAddImages)
  const onRemoveImage = (imageId: string) => {
    if (locked) return
    if (!ref) return setPending((list) => list.filter((img) => img.id !== imageId))
    removeImage(ref, imageId).catch((err) => message.error(firestoreErrorText(err)))
  }

  // Trạng thái chỉ đi một chiều (PaymentStatusSelect chặn sẵn): Chưa nhận → Đã nhận (%) → Đã mang ra bưu cục
  const changePay = async (next: PaymentValue) => {
    const prev = pay
    setPay(next)
    setStatusAt((at) => ({ ...at, [next.status]: at[next.status] ?? new Date() }))
    if (!quote) return
    try {
      // Sắp khoá: lưu nốt nội dung đang sửa trước, vì đã nhận tiền thì rules không cho ghi nội dung nữa
      if (prev.status === 'unpaid') await saveQuoteContent(quote.id, content)
      await setQuoteStatus(quote.id, next.status, next.paidPercent)
    } catch (err) {
      setPay(prev)
      message.error(firestoreErrorText(err))
    }
  }

  const create = async () => {
    setCreating(true)
    try {
      // Báo giá mới luôn bắt đầu ở "Chưa nhận tiền"; đổi trạng thái sau khi tạo
      const id = await createQuote(content, 'unpaid', null, pending)
      message.success('Đã tạo báo giá')
      navigate(`/bao-gia/${id}`, { replace: true })
    } catch (err) {
      message.error(`Không tạo được báo giá: ${firestoreErrorText(err)}`)
      setCreating(false)
    }
  }

  const back = () => {
    if (!dirty) return navigate('/bao-gia')
    modal.confirm({
      title: 'Bỏ báo giá đang soạn?',
      content: 'Báo giá này chưa được tạo nên sẽ không được lưu.',
      okText: 'Bỏ',
      okButtonProps: { danger: true },
      cancelText: 'Ở lại',
      onOk: () => navigate('/bao-gia'),
    })
  }

  // Chrome lấy tên file PDF từ document.title lúc gọi in → đổi title trước window.print()
  const print = useCallback(() => {
    const title = document.title
    window.addEventListener('afterprint', () => (document.title = title), { once: true })
    document.title = fileBase(content)
    window.print()
  }, [content])

  // Ctrl+P cũng đi qua print() để có tên file đúng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        print()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [print])

  const exportPng = async () => {
    const node = previewRef.current
    if (!node) return
    setExporting(true)
    try {
      await document.fonts.ready
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', style: { boxShadow: 'none', margin: '0' } })
      if (!blob) throw new Error('Ảnh rỗng')
      downloadBlob(blob, fileBase(content) + '.png')
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
        back="/bao-gia"
        onBack={back}
        title={content.customer.name || (isNew ? 'Báo giá mới' : 'Báo giá chưa có tên khách')}
        subtitle={
          isNew ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              Chưa lưu — bấm “Tạo báo giá” để lưu lên Firebase
            </Typography.Text>
          ) : locked ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <LockOutlined /> Đã nhận tiền — chỉ xem
            </Typography.Text>
          ) : (
            <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          )
        }
        actions={
          <>
            {!isNew && <PaymentTag {...pay} />}
            {isNew ? (
              <Tooltip title="Tạo báo giá trước, rồi mới xem file mẫu câu">
                <Button icon={<FileTextOutlined />} disabled>
                  Mẫu câu
                </Button>
              </Tooltip>
            ) : (
              <Button icon={<FileTextOutlined />} onClick={() => navigate(`/bao-gia/${quote.id}/mau-cau`)}>
                Mẫu câu
              </Button>
            )}
            {shipped && (
              <Button icon={<CarOutlined />} onClick={shipping.print}>
                In mã vận chuyển
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={print}>
              In / Lưu PDF
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportPng} type={isNew ? 'default' : 'primary'}>
              {exporting ? 'Đang xuất ảnh…' : 'Xuất ảnh PNG'}
            </Button>
            {isNew && (
              <Button type="primary" icon={<SaveOutlined />} loading={creating} onClick={create}>
                Tạo báo giá
              </Button>
            )}
          </>
        }
        form={
          <>
            {!isNew && (
              <PaymentStatusCard
                value={pay}
                onChange={(v) => void changePay(v)}
                grand={calc.grand}
                statusAt={statusAt}
                paidNote="Sau khi nhận tiền, báo giá sẽ bị khoá: không sửa, không xoá được nữa. Không chuyển ngược lại được."
              />
            )}
            {shipped && (
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
                title="Báo giá đã nhận tiền — không sửa, không xoá được"
                description="Vẫn in, xuất ảnh, xem file mẫu câu, cập nhật trạng thái / % đã nhận / vận chuyển được."
              />
            )}
            <QuoteForm
              state={state}
              calc={calc}
              setState={setContent}
              onAddImages={onAddImages}
              onRemoveImage={onRemoveImage}
              readOnly={locked}
              catalog={catalog}
            />
          </>
        }
        previewLabel="Xem trước báo giá"
        preview={<QuotePreview ref={previewRef} state={state} calc={calc} payment={pay} />}
        previewWidth="800px"
      />
      {shipped && quote && (
        <ShippingLabel
          data={{
            code: quoteCode(quote.id),
            carrier: shipping.value.carrier,
            trackingCode: shipping.value.trackingCode,
            recipient: content.customer,
            contents: quoteItemsSummary(content),
            cod: paymentAmounts(calc.grand, pay.status, pay.paidPercent).remaining,
          }}
        />
      )}
    </>
  )
}
