import { useState } from 'react';
import { Card, Form, Input, Button, Typography, App, Row, Col, Tag, Upload, Image, Space, Alert } from 'antd';
import { UserOutlined, PhoneOutlined, WechatOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const LEVEL_LABEL: Record<string, string> = {
  '0': '管理员',
  '1': '一级代理',
  '2': '二级代理',
  '3': '三级代理',
  null: '客户',
};

/** 收款码上传控件:读取图片为 base64 存入表单(演示环境无对象存储) */
function QrCodeField({ value, onChange }: { value?: string; onChange?: (v: string | null) => void }) {
  const { message } = App.useApp();

  const beforeUpload = (file: RcFile) => {
    if (!file.type.startsWith('image/')) {
      message.error('请上传图片文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('图片不能超过 2MB');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => onChange?.(reader.result as string);
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  if (!value) {
    return (
      <Upload beforeUpload={beforeUpload} showUploadList={false} accept="image/*">
        <div
          style={{
            width: 120, height: 120, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '1px dashed #d9d9d9', borderRadius: 8, cursor: 'pointer', color: '#999',
          }}
        >
          <PlusOutlined style={{ fontSize: 20 }} />
          <span style={{ fontSize: 12 }}>上传收款码</span>
        </div>
      </Upload>
    );
  }

  return (
    <Space align="start">
      <Image src={value} width={120} height={120} style={{ objectFit: 'contain', borderRadius: 8 }} />
      <Space direction="vertical" size={4}>
        <Upload beforeUpload={beforeUpload} showUploadList={false} accept="image/*">
          <Button size="small">更换</Button>
        </Upload>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onChange?.(null)}>删除</Button>
      </Space>
    </Space>
  );
}

export default function Profile() {
  const { message } = App.useApp();
  const user = authService.getCurrentUser();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 登录态丢失时用声明式跳转,避免渲染期调用 navigate 导致异常
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await authService.updateProfile(user.id, {
        phone: values.phone?.trim() || null,
        wechat: values.wechat?.trim() || null,
        wechat_qrcode: values.wechat_qrcode ?? null,
        alipay_qrcode: values.alipay_qrcode ?? null,
      });
      message.success('个人资料已保存,管理员处理订单时可查看');
    } catch (e) {
      message.error((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={3}>个人资料</Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size={16}>
          <span><UserOutlined /> 用户名:<b>{user.username}</b></span>
          <Tag color={user.role === 'agent' ? 'gold' : 'default'}>
            {LEVEL_LABEL[String(user.agent_level)]}
          </Tag>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="填写电话、微信号和收款码后,管理员在处理你的订单时可以直接联系你并完成打款"
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            phone: user.phone ?? '',
            wechat: user.wechat ?? '',
            wechat_qrcode: user.wechat_qrcode ?? null,
            alipay_qrcode: user.alipay_qrcode ?? null,
          }}
        >
          <Form.Item label="电话号码" name="phone" rules={[{ pattern: /^[\d+\-\s]{5,20}$/, message: '电话格式不正确' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="如:13800000000" maxLength={20} />
          </Form.Item>

          <Form.Item label="微信号" name="wechat" rules={[{ max: 64, message: '微信号过长' }]}>
            <Input prefix={<WechatOutlined />} placeholder="用于管理员联系你" maxLength={64} />
          </Form.Item>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="微信收款码" name="wechat_qrcode" extra="支持 jpg/png,不超过 2MB">
                <QrCodeField />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="支付宝收款码" name="alipay_qrcode" extra="支持 jpg/png,不超过 2MB">
                <QrCodeField />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" size="large" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存资料
          </Button>
        </Form>
      </Card>
    </div>
  );
}
