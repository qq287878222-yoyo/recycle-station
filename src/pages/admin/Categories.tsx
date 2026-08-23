import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Switch, App, Typography, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { categoryService } from '../../services/categoryService';
import type { Category } from '../../types/database';

interface FormValues {
  name: string;
  sort: number;
  active: boolean;
}

export default function AdminCategories() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm<FormValues>();

  const load = async () => {
    setLoading(true);
    try { setRows(await categoryService.list(true)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sort: 0, active: true });
    setModalOpen(true);
  };

  const openEdit = (r: Category) => {
    setEditing(r);
    form.setFieldsValue({ name: r.name, sort: r.sort, active: r.active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await categoryService.update(editing.id, values);
        message.success('已更新');
      } else {
        await categoryService.create(values);
        message.success('已创建');
      }
      setModalOpen(false);
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleDelete = async (r: Category) => {
    try {
      await categoryService.remove(r.id);
      message.success('已删除');
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const columns: ColumnsType<Category> = [
    { title: '名称', dataIndex: 'name' },
    { title: '排序', dataIndex: 'sort', width: 80 },
    { title: '状态', dataIndex: 'active', width: 100, render: (v: boolean) => v ? <Tag color="success">启用</Tag> : <Tag>停用</Tag> },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除?关联该分类的物品会解除关联" onConfirm={() => handleDelete(r)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>分类管理</Typography.Title>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增分类</Button>}
    >
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={false} />

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入分类名' }]}>
            <Input placeholder="如 纸类" />
          </Form.Item>
          <Form.Item label="排序" name="sort" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="启用" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
