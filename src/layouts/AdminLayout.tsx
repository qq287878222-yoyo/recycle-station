import { Layout, Menu, Button, Space } from 'antd';
import { DatabaseOutlined, FileTextOutlined, BarChartOutlined, LogoutOutlined, TagsOutlined, TeamOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

const { Sider, Header, Content } = Layout;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();

  const activeKey = location.pathname.split('/')[2] || 'orders';

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220} style={{ boxShadow: '2px 0 6px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '20px 24px', fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
          ♻️ 回收站管理端
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={(e) => navigate(`/admin/${e.key}`)}
          items={[
            { key: 'orders', icon: <FileTextOutlined />, label: '订单管理' },
            { key: 'items', icon: <DatabaseOutlined />, label: '物品目录' },
            { key: 'categories', icon: <TagsOutlined />, label: '分类管理' },
            { key: 'agents', icon: <TeamOutlined />, label: '代理管理' },
            { key: 'stats', icon: <BarChartOutlined />, label: '数据统计' },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', boxShadow: '0 2px 8px #f0f1f2' }}>
          <Space>
            <span style={{ color: '#666' }}>管理员: {user?.username}</span>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
