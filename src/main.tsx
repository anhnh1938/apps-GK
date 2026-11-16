import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import { appTheme } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={viVN} theme={appTheme}>
      {/* AntApp cấp context cho message/notification/modal qua App.useApp() */}
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
