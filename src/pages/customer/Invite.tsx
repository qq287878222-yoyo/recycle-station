import { useMemo } from 'react';
import { Card, Typography, App, Button, Space, Alert, Result } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { authService } from '../../services/authService';

const NEXT_LEVEL_TEXT: Record<number, string> = {
  0: '一级代理',
  1: '二级代理',
  2: '三级代理',
  3: '客户',
};

export default function Invite() {
  const { message } = App.useApp();
  const user = authService.getCurrentUser();

  const inviteUrl = useMemo(() => {
    if (!user) return '';
    const url = new URL(window.location.origin + '/register');
    url.searchParams.set('invite', user.username);
    return url.toString();
  }, [user]);

  if (!user) return null;

  // 只有 agent 或 admin 才能邀请
  if (user.role !== 'agent') {
    return <Result status="info" title="您暂无邀请权限" subTitle="仅代理账户可发展下级" />;
  }

  const nextLevel = NEXT_LEVEL_TEXT[user.agent_level ?? 3];

  const copyText = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(msg);
    } catch {
      message.warning('复制失败,请手动复制');
    }
  };

  return (
    <div>
      <Typography.Title level={3}>我的邀请码</Typography.Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`通过您的邀请码注册的用户将成为 ${nextLevel}`}
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#666' }}>邀请码</div>
        <Space>
          <Typography.Title level={2} style={{ margin: 0, color: '#52c41a' }}>{user.username}</Typography.Title>
          <Button icon={<CopyOutlined />} onClick={() => copyText(user.username, '邀请码已复制')}>复制</Button>
        </Space>
      </Card>

      <Card>
        <div style={{ marginBottom: 8, color: '#666' }}>邀请链接</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text code copyable={false} style={{ fontSize: 14 }}>{inviteUrl}</Typography.Text>
          <Button type="primary" icon={<CopyOutlined />} onClick={() => copyText(inviteUrl, '链接已复制')}>复制链接</Button>
        </Space>
      </Card>
    </div>
  );
}
