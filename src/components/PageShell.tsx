import type { CSSProperties, ReactNode } from 'react'
import { Button, Flex, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import s from './PageShell.module.css'

const { Title, Text } = Typography

export interface PageShellProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Nút quay lại (đường dẫn) */
  back?: string
  /** Thay cho việc chuyển thẳng tới `back` (VD hỏi xác nhận khi chưa lưu) */
  onBack?: () => void
  /** Nút ở thanh công cụ (bên phải) */
  actions?: ReactNode
  style?: CSSProperties
  children: ReactNode
}

/** Khung trang chung: thanh công cụ dính trên cùng (không in) + nội dung. */
export function PageShell({ title, subtitle, back, onBack, actions, style, children }: PageShellProps) {
  const navigate = useNavigate()
  return (
    <div className={s.page} style={style}>
      <div className={`${s.toolbar} no-print`}>
        <div className={s.heading}>
          {back && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              aria-label="Quay lại"
              onClick={() => (onBack ? onBack() : navigate(back))}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <Title level={4} style={{ margin: 0 }} ellipsis>
              {title}
            </Title>
            {subtitle && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {subtitle}
              </Text>
            )}
          </div>
        </div>
        {actions && (
          <Flex wrap gap={8} align="center">
            {actions}
          </Flex>
        )}
      </div>
      {children}
    </div>
  )
}
