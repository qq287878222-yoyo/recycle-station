import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Typography, Space, Button, Modal, Form, InputNumber, Input, App, Descriptions, Statistic, Row, Col, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, DollarOutlined, SearchOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService, computeAdminProfit, type OrderWithLines } from '../../services/orderService';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待收货', color: 'processing' },
  received: { text: '已收货,待售出', color: 'blue' },
  sold: { text: '已售出', color: 'success' },
};

const LEVEL_LABEL: Record<string, string> = {
  '1': '一级代理',
  '2': '二级代理',
  '3': '三级代理',
  null: '客户',
};

export default function AdminOrders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [soldModal, setSoldModal] = useState<{ open: boolean; order: OrderWithLines | null }>({ open: false, order: null });
  const [form] = Form.useForm<{ sold_amount: number; sold_buyer?: string }>();

  const load = async () => {
    setLoading(true);
    try { setOrders(await orderService.listAll()); }
    catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (keyword && !o.username.includes(keyword) && !o.id.includes(keyword)) return false;
      return true;
    }), [orders, statusFilter, keyword]);

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length;
    const received = orders.filter((o) => o.status === 'received').length;
    const sold = orders.filter((o) => o.status === 'sold');
    const revenue = sold.reduce((s, o) => s + Number(o.sold_amount ?? 0), 0);
    const profit = sold.reduce((s, o) => s + computeAdminProfit(o), 0);
    return { total: orders.length, pending, received, soldCount: sold.length, revenue, profit };
  }, [orders]);

  const openSoldModal = (order: OrderWithLines) => {
    const items = order.order_items ?? [];
    const cost = items.reduce((sum, li) => {
      const l1 = Number(li.price_l1_snapshot ?? 0);
      const unit = Number(li.unit_price);
      const inPrice = order.user_level === 1 ? unit : l1;
      return sum + inPrice * Number(li.quantity);
    }, 0);
    form.setFieldsValue({ sold_amount: Number((cost * 1.5).toFixed(2)) });
    setSoldModal({ open: true, order });
  };

  const handleReceived = async (order: OrderWithLines) => {
    try {
      await orderService.markReceived(order.id);
      message.success('已确认收货');
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleSold = async () => {
    if (!soldModal.order) return;
    const values = await form.validateFields();
    try {
      await orderService.markSold(soldModal.order.id, values);
      message.success('已完成售卖');
      setSoldModal({ open: false, order: null });
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const columns: ColumnsType<OrderWithLines> = [
    { title: '订单号', dataIndex: 'id', width: 100, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 8)}</code> },
    { title: '下单人', dataIndex: 'username', width: 100 },
    { title: '级别', dataIndex: 'user_level', width: 90, render: (lv: number | null) => <Tag>{LEVEL_LABEL[String(lv)]}</Tag> },
    { title: '提交时间', dataIndex: 'created_at', width: 160, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '货品数', width: 70, render: (_, r) => r.order_items?.length ?? 0 },
    { title: '订单金额', dataIndex: 'total_amount', width: 100, render: (v) => `¥${Number(v).toFixed(2)}` },
    { title: '售出金额', dataIndex: 'sold_amount', width: 100, render: (v: number | null) => v != null ? <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{Number(v).toFixed(2)}</span> : '—' },
    { title: '售出利润', width: 100, render: (_, r) => r.status === 'sold' ? <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{computeAdminProfit(r).toFixed(2)}</span> : '—' },
    { title: '状态', dataIndex: 'status', width: 120, render: (s: string) => { const st = STATUS_MAP[s] ?? { text: s, color: 'default' }; return <Tag color={st.color}>{st.text}</Tag>; } },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Button type="primary" size="small" icon={<InboxOutlined />} onClick={() => handleReceived(r)}>确认收货</Button>
          )}
          {r.status === 'received' && (
            <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openSoldModal(r)}>最终售卖</Button>
          )}
          {r.status === 'sold' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="订单总数" value={stats.total} /></Card></Col>
        <Col span={4}><Card><Statistic title="待收货" value={stats.pending} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="待售出" value={stats.received} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="已售出" value={stats.soldCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card><Statistic title="售出总额" value={stats.revenue} prefix="¥" precision={2} /></Card></Col>
        <Col span={4}><Card><Statistic title="累计利润" value={stats.profit} prefix="¥" precision={2} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      <Card
        title={<Typography.Title level={4} style={{ margin: 0 }}>订单管理</Typography.Title>}
        extra={
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="订单号/下单人" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 200 }} allowClear />
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待收货' },
                { value: 'received', label: '待售出' },
                { value: 'sold', label: '已售出' },
              ]} />
          </Space>
        }
      >
        <Table
          rowKey="id" loading={loading} columns={columns} dataSource={filtered} scroll={{ x: 1200 }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions bordered size="small" column={2} labelStyle={{ width: 100 }}>
                <Descriptions.Item label="备注" span={2}>{record.remark || '无'}</Descriptions.Item>
                <Descriptions.Item label="收货时间">{record.received_at ? dayjs(record.received_at).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
                <Descriptions.Item label="售出时间">{record.sold_at ? dayjs(record.sold_at).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
                <Descriptions.Item label="买家" span={2}>{record.sold_buyer || '—'}</Descriptions.Item>
                <Descriptions.Item label="货品明细" span={2}>
                  <Table
                    size="small" pagination={false} rowKey="id" dataSource={record.order_items ?? []}
                    columns={[
                      { title: '货品', dataIndex: 'item_name' },
                      { title: '下单价', dataIndex: 'unit_price', render: (v) => `¥${Number(v).toFixed(2)}` },
                      { title: '数量', render: (_, r) => `${r.quantity} ${r.unit ?? ''}` },
                      { title: '小计', dataIndex: 'subtotal', render: (v) => `¥${Number(v).toFixed(2)}` },
                    ]}
                  />
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      </Card>

      <Modal
        title={<Space><DollarOutlined />最终售卖</Space>}
        open={soldModal.open}
        onCancel={() => setSoldModal({ open: false, order: null })}
        onOk={handleSold}
        okText="确认售卖"
      >
        {soldModal.order && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="订单号"><code>{soldModal.order.id.slice(0, 8)}</code></Descriptions.Item>
              <Descriptions.Item label="下单人">{soldModal.order.username}</Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{Number(soldModal.order.total_amount).toFixed(2)}</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical">
              <Form.Item label="实际售出金额" name="sold_amount" rules={[{ required: true, message: '请输入售出金额' }]} extra="卖给外部买家的价格,系统据此计算利润">
                <InputNumber min={0} precision={2} addonBefore="¥" style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item label="买家/备注" name="sold_buyer">
                <Input placeholder="可填买家名称或备注" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
