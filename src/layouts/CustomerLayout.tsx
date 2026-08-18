import { Layout, Menu, Button, Space, Tag } from 'antd';
import {
  AppstoreOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  LogoutOutlined,
  TeamOutlined,
  DollarOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

const { Header, Content } = Layout;

const LEVEL_TAG: Record<number, { text: string; color: string }> = {
  1: { text: '一级代理', color: 'gold' },
  2: { text: '二级代理', color: 'blue' },
  3: { text: '三级代理', color: 'cyan' },
};

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();

  const activeKey = location.pathname.split('/')[1] || 'catalog';
  const isAgent = user?.role === 'agent';

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const menuItems = [
    { key: 'catalog', icon: <AppstoreOutlined />, label: '回收目录' },
    { key: 'new-order', icon: <ShoppingCartOutlined />, label: '提交回收' },
    { key: 'my-orders', icon: <FileTextOutlined />, label: '我的订单' },
    ...(isAgent
      ? [
          { key: 'team-orders', icon: <TeamOutlined />, label: '团队订单' },
          { key: 'income', icon: <DollarOutlined />, label: '我的收益' },
          { key: 'invite', icon: <GiftOutlined />, label: '我的邀请码' },
        ]
      : []),
  ];

  const levelTag = user?.role === 'agent' && user.agent_level ? LEVEL_TAG[user.agent_level] : null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', boxShadow: '0 2px 8px #f0f1f2' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a', marginRight: 40 }}>
          ♻️ 回收站
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[activeKey]}
          style={{ flex: 1, borderBottom: 'none' }}
          onClick={(e) => navigate(`/${e.key === 'catalog' ? 'catalog' : e.key}`)}
          items={menuItems}
        />
        <Space>
          <span style={{ color: '#666' }}>你好, {user?.username}</span>
          {levelTag && <Tag color={levelTag.color}>{levelTag.text}</Tag>}
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button>
        </Space>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
