import { useState } from 'react'
import { Alert, App, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { Navigate, useLocation } from 'react-router'
import logo from '../assets/logo.png'
import { auth } from '../lib/firebase'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { authErrorText, useAuth } from './context'
import s from './LoginPage.module.css'

interface Fields {
  email: string
  password: string
}

/** Đăng nhập email + mật khẩu. Không có nút đăng ký: tài khoản do chủ shop tạo trong Firebase Console. */
export default function LoginPage() {
  useDocumentTitle('Đăng nhập')
  const state = useAuth()
  const location = useLocation()
  const { modal } = App.useApp()
  const [form] = Form.useForm<Fields>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'ready' || state.status === 'noAccess') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  const onFinish = async ({ email, password }: Fields) => {
    setSubmitting(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(authErrorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async () => {
    const email = (form.getFieldValue('email') ?? '').trim()
    if (!email) {
      setError('Nhập email trước rồi bấm “Quên mật khẩu?”.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email)
      modal.success({ title: 'Đã gửi email đặt lại mật khẩu', content: `Kiểm tra hộp thư ${email}.` })
    } catch (err) {
      setError(authErrorText(err))
    }
  }

  return (
    <div className={s.screen}>
      <Card className={s.card}>
        <div className={s.brand}>
          <img src={logo} alt="" />
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Góc Kể Studio
            </Typography.Title>
            <Typography.Text type="secondary">Đăng nhập để quản lý báo giá và đơn áo</Typography.Text>
          </div>
        </div>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} disabled={state.status === 'loading'}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
            <Input prefix={<MailOutlined />} autoComplete="email" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            Đăng nhập
          </Button>
        </Form>
        <Button type="link" block onClick={resetPassword} style={{ marginTop: 8 }}>
          Quên mật khẩu?
        </Button>
      </Card>
    </div>
  )
}
