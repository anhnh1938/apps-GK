import { useState } from 'react'
import { App as AntApp, Button, Card, Flex, Layout, Menu, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt' },
]

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const { message } = AntApp.useApp()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" collapsible collapsed={collapsed} trigger={null}>
        <div className="app-logo">{collapsed ? 'GK' : 'apps-GK'}</div>
        <Menu mode="inline" defaultSelectedKeys={['dashboard']} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer }}>
          <Button
            type="text"
            aria-label={collapsed ? 'Mở menu' : 'Thu gọn menu'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Header>
        <Content style={{ margin: 24 }}>
          <Card title="apps-GK">
            <Flex vertical gap="middle" align="flex-start">
              <Typography.Paragraph style={{ margin: 0 }}>
                Base React + Vite + TypeScript + Ant Design.
              </Typography.Paragraph>
              <Button type="primary" onClick={() => message.success('antd đã sẵn sàng')}>
                Thử antd
              </Button>
            </Flex>
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
