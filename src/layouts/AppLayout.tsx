import { Suspense, useState } from 'react'
import { Avatar, Button, Layout, Menu, Spin, Tooltip, Typography } from 'antd'
import { AppstoreOutlined, DashboardOutlined, FileTextOutlined, LogoutOutlined, SkinOutlined } from '@ant-design/icons'
import { signOut } from 'firebase/auth'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import logo from '../assets/logo.png'
import { useAuth } from '../auth/context'
import { auth } from '../lib/firebase'
import { readJSON, writeJSON } from '../lib/storage'

const { Sider, Content } = Layout

const MENU = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/bao-gia', icon: <FileTextOutlined />, label: 'Báo giá mác áo' },
  { key: '/don-ao', icon: <SkinOutlined />, label: 'Đơn áo' },
  { key: '/san-pham', icon: <AppstoreOutlined />, label: 'Sản phẩm' },
]
const COLLAPSED_KEY = 'gk-sider-collapsed'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const authState = useAuth()
  const member = authState.status === 'ready' ? authState.member : null
  const [collapsed, setCollapsed] = useState(() => readJSON<boolean>(COLLAPSED_KEY) ?? false)
  const selected = pathname === '/' ? '/' : MENU.find((m) => m.key !== '/' && pathname.startsWith(m.key))?.key

  return (
    <Layout hasSider className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider
        className="no-print"
        theme="light"
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => {
          setCollapsed(value)
          writeJSON(COLLAPSED_KEY, value)
        }}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto', borderRight: '1px solid #ece2d4' }}
      >
        <div className="app-sider">
          <Link to="/" className={collapsed ? 'app-logo app-logo--collapsed' : 'app-logo'}>
            <img src={logo} alt="Góc Kể Studio" />
            {!collapsed && <span>Góc Kể Studio</span>}
          </Link>
          <Menu
            mode="inline"
            selectedKeys={selected ? [selected] : []}
            items={MENU}
            onClick={({ key }) => navigate(key)}
            style={{ borderInlineEnd: 0, flex: 1 }}
          />
          {member && (
            <div className={collapsed ? 'app-user app-user--collapsed' : 'app-user'}>
              <Tooltip title={collapsed ? member.email : undefined} placement="right">
                <Avatar style={{ background: '#5b4335', flexShrink: 0 }}>{member.name.charAt(0).toUpperCase()}</Avatar>
              </Tooltip>
              {!collapsed && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block' }}>
                    {member.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
                    {member.email}
                  </Typography.Text>
                </div>
              )}
              <Tooltip title="Đăng xuất">
                <Button type="text" icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => signOut(auth)} />
              </Tooltip>
            </div>
          )}
        </div>
      </Sider>
      <Content className="app-main">
        <Suspense
          fallback={
            <div className="app-loading">
              <Spin size="large" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </Content>
    </Layout>
  )
}
