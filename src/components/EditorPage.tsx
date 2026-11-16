import type { CSSProperties, ReactNode } from 'react'
import { Typography } from 'antd'
import { PageShell } from './PageShell'
import type { PageShellProps } from './PageShell'
import s from './EditorPage.module.css'

const { Text } = Typography

interface Props extends Omit<PageShellProps, 'children'> {
  /** Cột trái: các SectionCard */
  form: ReactNode
  previewLabel: ReactNode
  previewExtra?: ReactNode
  /** Cột phải: bản xem trước = bản in */
  preview: ReactNode
  /** Bề rộng cột xem trước (CSS length) */
  previewWidth: string
  /** Cột xem trước dính khi cuộn, có thanh cuộn riêng */
  stickyPreview?: boolean
}

/** Trang sửa chung của các app GK: thanh công cụ + form trái + bản xem trước phải. */
export function EditorPage({ form, previewLabel, previewExtra, preview, previewWidth, stickyPreview, style, ...shell }: Props) {
  return (
    <PageShell {...shell} style={{ ...style, '--preview-w': previewWidth } as CSSProperties}>
      <div className={s.grid}>
        <div className={`${s.form} no-print`}>{form}</div>
        <section className={stickyPreview ? `${s.previewCol} ${s.sticky}` : s.previewCol}>
          <div className={`${s.previewHead} no-print`}>
            <Text strong type="secondary">
              {previewLabel}
            </Text>
            {previewExtra && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {previewExtra}
              </Text>
            )}
          </div>
          <div className={s.previewScroll}>{preview}</div>
        </section>
      </div>
    </PageShell>
  )
}
