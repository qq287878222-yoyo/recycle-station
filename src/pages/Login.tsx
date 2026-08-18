import { useState } from 'react';
import { Card, Form, Input, Button, Typography, App, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

interface FormValues {
  username: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: FormValues) => {
    setLoading(true);
    try {
      const user = await authService.login(values.username, values.password);
      message.success(`欢迎回来, ${user.username}`);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (e) {
      message.error((e as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>♻️</div>
          <Typography.Title level={3} style={{ margin: 0 }}>回收站</Typography.Title>
        </div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>登 录</Button>
          </Form.Item>
        </Form>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ textAlign: 'center' }}>
          <Link to="/register">没有账号？立即注册</Link>
        </div>
      </Card>
    </div>
  );
}
