import { lazy, Suspense } from 'react'
import { Button, Result, Spin } from 'antd'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { missingFirebaseConfig } from './lib/firebase'

// Mỗi trang tải riêng khi mở
const LoginPage = lazy(() => import('./auth/LoginPage'))
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const ProductListPage = lazy(() => import('./features/products/ProductListPage'))
const ProductEditorPage = lazy(() => import('./features/products/ProductEditorPage'))
const QuoteListPage = lazy(() => import('./features/quote/QuoteListPage'))
const QuoteEditorPage = lazy(() => import('./features/quote/QuoteEditorPage'))
const SentencesPage = lazy(() => import('./features/sentences/SentencesPage'))
const OrderListPage = lazy(() => import('./features/orders/OrderListPage'))
const OrderEditorPage = lazy(() => import('./features/orders/OrderEditorPage'))

function NotFound() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      extra={
        <Link to="/">
          <Button type="primary">Về trang chính</Button>
        </Link>
      }
    />
  )
}

function App() {
  if (missingFirebaseConfig.length) {
    return (
      <Result
        status="warning"
        title="Thiếu config Firebase"
        subTitle={`Copy .env.example thành .env.local và điền: ${missingFirebaseConfig.join(', ')} (VITE_FIREBASE_*), rồi chạy lại npm run dev.`}
      />
    )
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="app-loading">
              <Spin size="large" />
            </div>
          }
        >
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="bao-gia" element={<QuoteListPage />} />
              {/* /moi: form trống, chỉ ghi Firestore khi bấm "Tạo" */}
              <Route path="bao-gia/moi" element={<QuoteEditorPage />} />
              <Route path="bao-gia/:id" element={<QuoteEditorPage />} />
              <Route path="bao-gia/:id/mau-cau" element={<SentencesPage />} />
              <Route path="don-ao" element={<OrderListPage />} />
              <Route path="don-ao/moi" element={<OrderEditorPage />} />
              <Route path="don-ao/:id" element={<OrderEditorPage />} />
              <Route path="san-pham" element={<ProductListPage />} />
              <Route path="san-pham/moi" element={<ProductEditorPage />} />
              <Route path="san-pham/:id" element={<ProductEditorPage />} />
              {/* Trang mẫu câu đứng riêng cũ → mẫu câu giờ mở từ từng báo giá */}
              <Route path="mau-cau" element={<Navigate to="/bao-gia" replace />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
