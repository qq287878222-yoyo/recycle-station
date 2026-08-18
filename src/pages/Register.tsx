import { useState } from 'react';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, GiftOutlined } from '@ant-design/icons';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';

interface FormValues {
  username: string;
  password: string;
  phone: string;
  inviteCode: string;
}

export default function Register() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [search] = useSearchParams();

  const onFinish = async (values: FormValues) => {
    setLoading(true);
    try {
      await authService.register(values);
      message.success('注册成功,请登录');
      navigate('/login');
    } catch (e) {
      message.error((e as Error).message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>♻️</div>
          <Typography.Title level={3} style={{ margin: 0 }}>注册</Typography.Title>
          <Typography.Text type="secondary">需要邀请人的用户名作为邀请码</Typography.Text>
        </div>
        <Form
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ inviteCode: search.get('invite') ?? '' }}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 个字符' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码 (至少 6 位)" size="large" />
          </Form.Item>
          <Form.Item
            name="inviteCode"
            rules={[{ required: true, message: '必须填写邀请码(邀请人的用户名)' }]}
            extra="邀请码 = 邀请人的用户名"
          >
            <Input prefix={<GiftOutlined />} placeholder="邀请码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>注 册</Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Link to="/login">已有账号,去登录</Link>
        </div>
      </Card>
    </div>
  );
}
