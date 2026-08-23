import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Switch, Upload, App, Typography, Tag, Popconfirm, Select, Row, Col } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import * as XLSX from 'xlsx';
import { itemService } from '../../services/itemService';
import { categoryService } from '../../services/categoryService';
import type { RecycleItem, RecycleItemInsert, Category } from '../../types/database';

interface FormValues {
  name: string;
  image_url?: string;
  category_id?: string | null;
  price_customer: number;
  price_l3: number;
  price_l2: number;
  price_l1: number;
  unit: string;
  description?: string;
  active: boolean;
}

export default function AdminItems() {
  const { message, modal } = App.useApp();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecycleItem | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [it, cat] = await Promise.all([itemService.list(true), categoryService.list(true)]);
      setItems(it);
      setCategories(cat);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    items.filter((r) => {
      if (keyword) {
        const hay = `${r.name} ${r.categories?.name ?? ''} ${r.description ?? ''}`;
        if (!hay.includes(keyword)) return false;
      }
      if (categoryFilter !== 'all' && r.category_id !== categoryFilter) return false;
      return true;
    }), [items, keyword, categoryFilter]);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const catIdByName = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.name, c.id));
    return m;
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      active: true, unit: 'kg',
      price_customer: 0, price_l3: 0, price_l2: 0, price_l1: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (r: RecycleItem) => {
    setEditing(r);
    form.setFieldsValue({
      name: r.name,
      image_url: r.image_url || '',
      category_id: r.category_id ?? undefined,
      price_customer: Number(r.price_customer),
      price_l3: Number(r.price_l3),
      price_l2: Number(r.price_l2),
      price_l1: Number(r.price_l1),
      unit: r.unit,
      description: r.description || '',
      active: r.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // 校验价格递增
    const { price_customer, price_l3, price_l2, price_l1 } = values;
    if (!(price_customer <= price_l3 && price_l3 <= price_l2 && price_l2 <= price_l1)) {
      message.warning('价格需递增: 客户价 ≤ 三级 ≤ 二级 ≤ 一级');
      return;
    }
    try {
      if (editing) {
        await itemService.update(editing.id, values);
        message.success('已更新');
      } else {
        await itemService.create(values as Partial<RecycleItemInsert>);
        message.success('已创建');
      }
      setModalOpen(false);
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleDelete = async (r: RecycleItem) => {
    try {
      await itemService.remove(r.id);
      message.success('已删除');
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['名称', '单位', '分类', '客户价', '三级代理价', '二级代理价', '一级代理价', '描述', '图片URL', '上架(true/false)'],
      ['废纸箱', 'kg', '纸类', 1.2, 1.35, 1.55, 1.80, '干燥无污染的废纸箱', 'https://example.com/1.png', true],
      ['塑料瓶', 'kg', '塑料', 0.8, 0.95, 1.15, 1.40, '饮料瓶', '', true],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '回收物品');
    XLSX.writeFile(wb, '回收物品导入模板.xlsx');
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
          const records: Partial<RecycleItemInsert>[] = [];
          for (const row of rows) {
            const name = String(row['名称'] ?? '').trim();
            if (!name) continue;
            const parse = (key: string) => {
              const v = row[key];
              return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
            };
            const catName = String(row['分类'] ?? '').trim();
            const category_id = catName ? catIdByName.get(catName) ?? null : null;
            const activeRaw = row['上架(true/false)'] ?? row['上架'] ?? true;
            records.push({
              name,
              unit: String(row['单位'] ?? 'kg').trim() || 'kg',
              category_id,
              price_customer: parse('客户价'),
              price_l3: parse('三级代理价'),
              price_l2: parse('二级代理价'),
              price_l1: parse('一级代理价'),
              description: String(row['描述'] ?? '').trim() || null,
              image_url: String(row['图片URL'] ?? '').trim() || null,
              active: activeRaw === true || String(activeRaw).toLowerCase() === 'true',
            });
          }
          if (!records.length) { message.warning('未从文件中解析到有效数据'); return; }
          modal.confirm({
            title: '确认导入',
            content: `将导入 ${records.length} 条数据,是否继续?`,
            onOk: async () => {
              try {
                const count = await itemService.batchCreate(records);
                message.success(`已成功导入 ${count} 条`);
                load();
              } catch (err) { message.error((err as Error).message); }
            },
          });
        } catch (err) { message.error(`解析失败: ${(err as Error).message}`); }
      };
      reader.readAsArrayBuffer(file);
      return false;
    },
  };

  const columns: ColumnsType<RecycleItem> = [
    { title: '图片', dataIndex: 'image_url', width: 70, render: (url: string) => url ? <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} /> : '—' },
    { title: '名称', dataIndex: 'name', width: 120 },
    { title: '分类', dataIndex: 'category_id', width: 100, render: (id: string | null) => id ? <Tag color="green">{catNameById.get(id)}</Tag> : '—' },
    { title: '单位', dataIndex: 'unit', width: 60 },
    { title: '客户价', dataIndex: 'price_customer', width: 90, render: (v) => <span style={{ color: '#f5222d' }}>¥{Number(v).toFixed(2)}</span> },
    { title: '三级代理', dataIndex: 'price_l3', width: 90, render: (v) => `¥${Number(v).toFixed(2)}` },
    { title: '二级代理', dataIndex: 'price_l2', width: 90, render: (v) => `¥${Number(v).toFixed(2)}` },
    { title: '一级代理', dataIndex: 'price_l1', width: 90, render: (v) => `¥${Number(v).toFixed(2)}` },
    { title: '状态', dataIndex: 'active', width: 80, render: (v: boolean) => v ? <Tag color="success">上架</Tag> : <Tag>下架</Tag> },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)} size="small">编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(r)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>物品目录管理</Typography.Title>}
      extra={
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="搜索名称/分类/描述" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 140 }}
            options={[{ value: 'all', label: '全部分类' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
          <Upload {...uploadProps}><Button icon={<UploadOutlined />}>Excel 导入</Button></Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增货品</Button>
        </Space>
      }
    >
      <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} scroll={{ x: 1200 }} />

      <Modal
        title={editing ? '编辑货品' : '新增货品'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="如 废纸箱" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="单位" name="unit" rules={[{ required: true }]}><Input placeholder="kg / 台" /></Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="上架" name="active" valuePropName="checked"><Switch /></Form.Item>
            </Col>
          </Row>
          <Form.Item label="分类" name="category_id">
            <Select allowClear placeholder="选择分类" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>4 档价格必须递增: 客户价 ≤ 三级 ≤ 二级 ≤ 一级</Typography.Text>
          <Row gutter={8}>
            <Col span={6}>
              <Form.Item label="客户价" name="price_customer" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="三级代理" name="price_l3" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="二级代理" name="price_l2" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="一级代理" name="price_l1" rules={[{ required: true }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="图片 URL" name="image_url"><Input placeholder="https://..." /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
