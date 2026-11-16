import { Typography } from 'antd'
import { CheckCircleOutlined, CloudSyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { SaveStatus } from '../lib/useAutosave'

const timeText = (d: Date | null) => (d ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')

/** Dòng nhỏ báo tình trạng tự lưu */
export function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
  if (status === 'error')
    return (
      <Typography.Text type="danger" style={{ fontSize: 12 }}>
        <ExclamationCircleOutlined /> Lưu lỗi — đang thử lại khi bạn sửa tiếp
      </Typography.Text>
    )
  if (status === 'saving' || status === 'pending')
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        <CloudSyncOutlined /> Đang lưu…
      </Typography.Text>
    )
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      <CheckCircleOutlined /> {savedAt ? `Đã lưu lúc ${timeText(savedAt)}` : 'Đã lưu trên Firebase'}
    </Typography.Text>
  )
}
