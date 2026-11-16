import type { ReactNode } from 'react'
import { Button, Card, Upload } from 'antd'
import { CloseOutlined, PictureOutlined } from '@ant-design/icons'
import s from './SectionCard.module.css'

/** Thẻ một bước trong form: số bước (hoặc icon) tròn nâu + tiêu đề in hoa */
export function SectionCard({
  step,
  title,
  extra,
  children,
}: {
  step: ReactNode
  title: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      title={
        <span className={s.title}>
          <span className={s.step}>{step}</span>
          {title}
        </span>
      }
      extra={extra}
    >
      {children}
    </Card>
  )
}

/** Ô kéo thả / bấm chọn ảnh (không upload — chỉ trả file cho `onFiles`) */
export function ImageDropzone({
  onFiles,
  hint = 'Có thể dán ảnh bằng Ctrl+V · PNG, JPG',
}: {
  onFiles: (files: File[]) => void
  hint?: string
}) {
  return (
    <Upload.Dragger
      accept="image/*"
      multiple
      showUploadList={false}
      beforeUpload={(file) => {
        onFiles([file])
        return Upload.LIST_IGNORE
      }}
    >
      <p className="ant-upload-drag-icon">
        <PictureOutlined />
      </p>
      <p className="ant-upload-text">Kéo thả ảnh vào đây hoặc bấm để chọn ảnh</p>
      <p className="ant-upload-hint">{hint}</p>
    </Upload.Dragger>
  )
}

/** Lưới ảnh nhỏ; có `onRemove` thì mỗi ảnh có nút xoá */
export function ImageThumbs({
  images,
  onRemove,
}: {
  images: { id: string; src: string; name?: string }[]
  onRemove?: (id: string) => void
}) {
  if (!images.length) return null
  return (
    <div className={s.thumbs}>
      {images.map((img, i) => {
        const label = img.name || `Ảnh ${i + 1}`
        return (
          <div key={img.id} className={s.thumb} title={label}>
            <img src={img.src} alt={label} />
            {onRemove && (
              <Button
                className={s.thumbRemove}
                size="small"
                shape="circle"
                icon={<CloseOutlined />}
                title="Xoá ảnh"
                aria-label={`Xoá ${label}`}
                onClick={() => onRemove(img.id)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
