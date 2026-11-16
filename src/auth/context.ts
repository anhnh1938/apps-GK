import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

/** Document gk_members/{email} — chủ shop tạo trong Firebase Console cho từng người được dùng app */
export interface Member {
  email: string
  name: string
  role: string
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Đăng nhập được nhưng chưa có trong gk_members (hoặc không đọc được vì rules) */
  | { status: 'noAccess'; user: User; message: string }
  | { status: 'ready'; user: User; member: Member }

export const AuthContext = createContext<AuthState>({ status: 'loading' })

export const useAuth = () => useContext(AuthContext)

/** Câu báo lỗi đăng nhập Firebase dễ hiểu */
export function authErrorText(error: unknown) {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
    case 'auth/missing-password':
      return 'Sai email hoặc mật khẩu.'
    case 'auth/too-many-requests':
      return 'Đăng nhập sai quá nhiều lần. Thử lại sau ít phút.'
    case 'auth/network-request-failed':
      return 'Không kết nối được Firebase. Kiểm tra mạng.'
    case 'auth/user-disabled':
      return 'Tài khoản đã bị khoá.'
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Firebase chưa bật đăng nhập Email/Mật khẩu (Firebase Console → Authentication → Sign-in method).'
    default:
      return `Không đăng nhập được${code ? ` (${code})` : ''}.`
  }
}
