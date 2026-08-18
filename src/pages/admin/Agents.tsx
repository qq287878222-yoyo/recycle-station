import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, App, Typography, Tag, Row, Col, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { agentService } from '../../services/agentService';
import { authService } from '../../services/authService';
import type { AppUser } from '../../types/database';

const LEVEL_MAP: Record<string, { text: string; color: string }> = {
  '0': { text: '管理员', color: 'red' },
  '1': { text: '一级代理', color: 'gold' },
  '2': { text: '二级代理', color: 'blue' },
  '3': { text: '三级代理', color: 'cyan' },
  null: { text: '客户', color: 'default' },
};

interface TreeNode extends AppUser {
  children?: TreeNode[];
}

export default function AdminAgents() {
  const { message } = App.useApp();
  const admin = authService.getCurrentUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<{ username: string; password: string; phone?: string }>();

  const load = async () => {
    setLoading(true);
    try { setUsers(await agentService.listAll()); }
    catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // 构造树:以管理员为根
  const { tree, stats } = useMemo(() => {
    const byId = new Map<string, TreeNode>();
    users.forEach((u) => byId.set(u.id, { ...u, children: [] }));
    const roots: TreeNode[] = [];
    byId.forEach((n) => {
      if (n.role === 'admin') roots.push(n);
      else if (n.parent_id && byId.get(n.parent_id)) byId.get(n.parent_id)!.children!.push(n);
      else roots.push(n); // 无父挂根
    });
    const count = {
      l1: users.filter((u) => u.role === 'agent' && u.agent_level === 1).length,
      l2: users.filter((u) => u.role === 'agent' && u.agent_level === 2).length,
      l3: users.filter((u) => u.role === 'agent' && u.agent_level === 3).length,
      customer: users.filter((u) => u.role === 'customer').length,
    };
    return { tree: roots, stats: count };
  }, [users]);

  const handleCreate = async () => {
    if (!admin) return;
    const values = await form.validateFields();
    try {
      await agentService.createLevel1({ ...values, adminId: admin.id });
      message.success('已创建一级代理');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const columns: ColumnsType<TreeNode> = [
    { title: '用户名', dataIndex: 'username' },
    {
      title: '级别',
      key: 'level',
      width: 120,
      render: (_, r) => {
        const key = r.role === 'admin' ? '0' : r.role === 'customer' ? 'null' : String(r.agent_level);
        const info = LEVEL_MAP[key];
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '手机', dataIndex: 'phone', width: 140 },
    { title: '注册时间', dataIndex: 'created_at', width: 160, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    {
      title: '邀请码', width: 140,
      render: (_, r) => r.role !== 'customer' ? <code>{r.username}</code> : '—',
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="一级代理" value={stats.l1} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="二级代理" value={stats.l2} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="三级代理" value={stats.l3} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="客户" value={stats.customer} /></Card></Col>
      </Row>

      <Card
        title={<Typography.Title level={4} style={{ margin: 0 }}>代理与用户树</Typography.Title>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建一级代理</Button>}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tree}
          loading={loading}
          pagination={false}
          defaultExpandAllRows
          expandable={{ rowExpandable: (r) => !!r.children?.length }}
        />
      </Card>

      <Modal
        title="新建一级代理"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少 3 个字符' }]}>
            <Input prefix={<UserOutlined />} placeholder="一级代理用户名" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码 (至少 6 位)" />
          </Form.Item>
          <Form.Item label="手机" name="phone" rules={[{ pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号(可选)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
