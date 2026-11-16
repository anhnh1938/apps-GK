import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

// Project Firebase dùng chung với my-apps (my-apps-7797f). Chỉ config phía trình duyệt — xem .env.example.
const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/** Tên các biến VITE_FIREBASE_* còn thiếu — App hiện màn hình báo lỗi thay vì chạy */
export const missingFirebaseConfig = Object.entries(config)
  .filter(([, v]) => !v)
  .map(([k]) => k)

function init() {
  if (missingFirebaseConfig.length) return null
  // getApps(): HMR nạp lại module này thì dùng lại app cũ, không khởi tạo 2 lần
  const app = getApps().length ? getApp() : initializeApp(config)
  const auth = getAuth(app)
  let db: Firestore
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    db = getFirestore(app)
  }
  if (env.VITE_FIREBASE_EMULATORS === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  return { app, auth, db }
}

const fb = init()
// Chỉ dùng sau khi App đã kiểm tra missingFirebaseConfig rỗng
export const auth = fb?.auth as Auth
export const db = fb?.db as Firestore

/** Tên collection Firestore — tiền tố gk_ vì project dùng chung với my-apps. Cấu trúc: docs/firestore.md */
export const COL = {
  members: 'gk_members',
  quotes: 'gk_quotes',
  orders: 'gk_orders',
  products: 'gk_products',
} as const
/** Subcollection ảnh dưới mỗi báo giá / đơn áo */
export const IMAGES = 'images'

/** Email người đang đăng nhập — ghi vào createdBy / updatedBy */
export const currentEmail = () => auth?.currentUser?.email ?? null
