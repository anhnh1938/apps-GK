import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Empty, Result, Spin, Typography } from 'antd'
import { DownloadOutlined, EditOutlined, LockOutlined, PrinterOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router'
import { EditorPage } from '../../components/EditorPage'
import { ImageThumbs, SectionCard } from '../../components/SectionCard'
import { SaveIndicator } from '../../components/Status'
import { firestoreErrorText, useDocOnce } from '../../lib/firestoreHooks'
import { slug } from '../../lib/format'
import { useImages } from '../../lib/images'
import { useAutosave } from '../../lib/useAutosave'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { quoteRef, savePrintContent, toQuote } from '../quote/repo'
import type { QuoteDoc } from '../quote/types'
import { MAX_PT, PER_PAGE, SHEET_VARS } from './constants'
import { exportSheets } from './exportPng'
import { SheetPages } from './SheetPages'
import type { FitResult } from './SheetPages'
import { isNumberedList, parseList, serializeList, toSentences } from './state'
import type { Sentence } from './state'
import s from './SentencesPage.module.css'

const { Text } = Typography

const lineCount = (t: string) => Math.max(1, t.split('\n').length)
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')

/** /bao-gia/:id/mau-cau — file mẫu câu, lấy trực tiếp từ "Nội dung in" + ảnh nội dung in của báo giá */
export default function SentencesPage() {
  const { id = '' } = useParams()
  const ref = useMemo(() => quoteRef(id), [id])
  const { data, loading, notFound, error } = useDocOnce(ref, toQuote)

  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }
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
  return <SentencesEditor key={id} quote={data} />
}

function SentencesEditor({ quote }: { quote: QuoteDoc }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const ref = useMemo(() => quoteRef(quote.id), [quote.id])
  const customer = quote.customer.name
  const locked = quote.status !== 'unpaid' // đã nhận tiền → báo giá khoá
  useDocumentTitle(customer ? `Mẫu câu · ${customer}` : 'Mẫu câu')

  // Mẫu câu không có bản sao riêng: tách từ "Nội dung in"; sửa xuống dòng ở đây thì ghi ngược vào "Nội dung in".
  // Thêm / xoá câu làm trong báo giá.
  const numbered = useMemo(() => isNumberedList(quote.printContent), [quote.printContent])
  const [items, setItems] = useState<Sentence[]>(() => toSentences(parseList(quote.printContent)))
  const save = useCallback(
    (list: Sentence[]) => savePrintContent(quote.id, serializeList(list.map((it) => it.text), numbered)),
    [quote.id, numbered],
  )
  const autosave = useAutosave(items, save, { enabled: !locked })

  const [activeIndex, setActiveIndex] = useState(-1)
  const [fit, setFit] = useState<FitResult | null>(null)
  const [exportLabel, setExportLabel] = useState<string | null>(null)
  const sheetsRef = useRef<HTMLDivElement>(null)
  const textareas = useRef(new Map<string, HTMLTextAreaElement>())

  // Gõ xong 0,2 giây mới vẽ lại các tờ, cho đỡ giật
  const texts = useMemo(() => items.map((it) => it.text), [items])
  const sheetTexts = useDebouncedValue(texts, 200)

  const editItem = (id: string, text: string) => setItems((list) => list.map((it) => (it.id === id ? { ...it, text } : it)))

  // Bấm vào ô trên tờ → nhảy tới câu đó. Đọc items qua ref để hàm không đổi mỗi lần gõ (SheetPages là memo).
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })
  const focusItem = useCallback((n: number) => {
    const it = itemsRef.current[n - 1]
    const ta = it && textareas.current.get(it.id)
    ta?.closest('li')?.scrollIntoView({ block: 'nearest' })
    ta?.focus({ preventScroll: true })
  }, [])

  // Đang sửa câu nào thì cuộn ô của câu đó trên tờ vào tầm nhìn
  const onFocusItem = (i: number) => {
    setActiveIndex(i)
    sheetsRef.current?.querySelector(`[data-n="${i + 1}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  // Ô ảnh = ảnh "Ảnh / thiết kế cần in" của báo giá
  const { images } = useImages(ref, 'print')

  const exportPng = async () => {
    const pages = [...(sheetsRef.current?.querySelectorAll<HTMLElement>('[data-sheet-page]') ?? [])]
    if (!pages.length) return
    setExportLabel('Đang chuẩn bị…')
    try {
      await exportSheets(pages, `Mau-cau-${slug(customer) || quote.id}`, setExportLabel)
    } catch (err) {
      console.error(err)
      message.error(`Xuất ảnh bị lỗi: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExportLabel(null)
    }
  }

  // ----- Trạng thái co chữ -----
  const overflow = useMemo(() => new Set(fit?.overflow), [fit])
  const shrunk = fit ? Object.entries(fit.sizes).filter(([n, pt]) => pt < MAX_PT && !overflow.has(+n)).length : 0
  const ptLabel = (n: number) => {
    const pt = fit?.sizes[n]
    if (pt == null) return null
    if (overflow.has(n)) return <Text type="danger">Tràn ô: bớt dòng hoặc ngắt lại</Text>
    if (pt < MAX_PT) return <Text type="warning">Co chữ còn {pt}pt</Text>
    return <Text type="secondary">{pt}pt</Text>
  }

  return (
    <EditorPage
      back={`/bao-gia/${quote.id}`}
      title={`Mẫu câu · ${customer || 'báo giá chưa có tên khách'}`}
      subtitle={
        locked ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <LockOutlined /> Báo giá đã chuyển tiền — chỉ xem
          </Text>
        ) : (
          <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
        )
      }
      style={SHEET_VARS}
      actions={
        <>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/bao-gia/${quote.id}`)}>
            Sửa báo giá
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
            In / Lưu PDF
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={exportLabel != null} onClick={() => void exportPng()}>
            {exportLabel ?? 'Xuất ảnh PNG (600 DPI)'}
          </Button>
        </>
      }
      form={
        <>
          {locked && (
            <Alert
              type="info"
              showIcon
              icon={<LockOutlined />}
              title="Báo giá đã chuyển tiền — chỉ xem"
              description="Vẫn in và xuất ảnh được. Cần sửa thì đổi trạng thái báo giá về “Chưa chuyển”."
            />
          )}
          <SectionCard step={1} title="Danh sách câu">
            {fit && items.length > 0 && (
              <Text className={s.status}>
                <b>{fit.textCount}</b> câu · <b>{fit.pageCount}</b> tờ A4 ({PER_PAGE} ô/tờ)
                {shrunk > 0 && <Text type="warning"> · {shrunk} câu bị co chữ</Text>}
                {overflow.size > 0 && (
                  <Text type="danger" strong>
                    {' '}
                    · {overflow.size} câu tràn ô
                  </Text>
                )}
              </Text>
            )}
            {items.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Báo giá chưa có câu nào trong mục “Nội dung in”."
              >
                <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/bao-gia/${quote.id}`)}>
                  Sửa báo giá
                </Button>
              </Empty>
            ) : (
              <ol className={s.items}>
                {items.map((it, i) => (
                  <li key={it.id} className={cx(s.item, i === activeIndex && s.itemActive)}>
                    <div className={s.itemHead}>
                      <span className={s.itemNo}>{i + 1}.</span>
                      <span className={s.pt}>{it.text.trim() ? ptLabel(i + 1) : null}</span>
                    </div>
                    <textarea
                      ref={(el) => {
                        if (!el) return
                        textareas.current.set(it.id, el)
                        return () => {
                          textareas.current.delete(it.id)
                        }
                      }}
                      className={s.textarea}
                      wrap="off"
                      spellCheck={false}
                      readOnly={locked}
                      aria-label={`Câu ${i + 1}`}
                      rows={lineCount(it.text)}
                      value={it.text}
                      onChange={(e) => editItem(it.id, e.target.value)}
                      onFocus={() => onFocusItem(i)}
                    />
                  </li>
                ))}
              </ol>
            )}
            <Text type="secondary" className={s.help}>
              Câu lấy trực tiếp từ mục “Nội dung in” của báo giá. Ô sửa là vùng chữ của thẻ phóng to: chỉnh xuống dòng ở
              đây được lưu thẳng vào báo giá. Thêm / xoá câu thì bấm “Sửa báo giá”.
            </Text>
          </SectionCard>

          {images.length > 0 && (
            <SectionCard step={2} title="Ảnh trong ô">
              <ImageThumbs images={images} />
              <Text type="secondary" className={s.help}>
                Lấy từ mục “Ảnh / thiết kế cần in” của báo giá — mỗi ảnh là 1 ô, xếp sau các câu.
              </Text>
            </SectionCard>
          )}
        </>
      }
      previewLabel="Xem trước bản in"
      previewExtra="Bấm vào ô để sửa câu đó"
      preview={
        <div ref={sheetsRef}>
          <SheetPages
            texts={sheetTexts}
            images={images}
            activeN={activeIndex >= 0 ? activeIndex + 1 : null}
            onCellClick={focusItem}
            onFit={setFit}
          />
        </div>
      }
      previewWidth="calc(var(--page-w) + 16px)"
      stickyPreview
    />
  )
}
