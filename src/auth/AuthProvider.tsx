import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, COL, db } from '../lib/firebase'
import { firestoreErrorText } from '../lib/firestoreHooks'
import { AuthContext } from './context'
import type { AuthState } from './context'

/** Theo dõi đăng nhập; đăng nhập xong thì kiểm tra email có trong gk_members không. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setState({ status: 'signedOut' })
        const email = (user.email ?? '').toLowerCase()
        try {
          const snap = await getDoc(doc(db, COL.members, email))
          if (!snap.exists()) {
            return setState({
              status: 'noAccess',
              user,
              message: `Tài khoản ${email} chưa được cấp quyền dùng app. Nhờ chủ shop thêm document gk_members/${email} trong Firebase Console.`,
            })
          }
          const d = snap.data()
          setState({ status: 'ready', user, member: { email, name: d.name || email, role: d.role || 'staff' } })
        } catch (err) {
          setState({ status: 'noAccess', user, message: firestoreErrorText(err) })
        }
      }),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
