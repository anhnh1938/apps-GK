import type { ReactNode } from 'react'
import { Button, Result, Spin } from 'antd'
import { signOut } from 'firebase/auth'
import { Navigate, useLocation } from 'react-router'
import { auth } from '../lib/firebase'
import { useAuth } from './context'

/** Chỉ cho vào khi đã đăng nhập VÀ có trong gk_members; chưa đăng nhập → /login */
export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (state.status === 'noAccess') {
    return (
      <Result
        status="403"
        title="Chưa được cấp quyền"
        subTitle={state.message}
        extra={<Button onClick={() => signOut(auth)}>Đăng xuất</Button>}
      />
    )
  }
  return children
}
