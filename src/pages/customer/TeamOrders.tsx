import { useEffect, useState, useMemo } from 'react';
import { Card, Table, Tag, Typography, App, Empty, Space, Input, Select, Statistic, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService, computeIncome, type OrderWithLines } from '../../services/orderService';
import { authService } from '../../services/authService';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待收货', color: 'processing' },
  received: { text: '已收货,待售出', color: 'blue' },
  sold: { text: '已售出', color: 'success' },
};

const LEVEL_LABEL: Record<number | 'null', string> = {
  1: '一级代理',
  2: '二级代理',
  3: '三级代理',
  null: '客户',
};

export default function TeamOrders() {
  const { message } = App.useApp();
  const user = authService.getCurrentUser();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setOrders(await orderService.listByAgent(user));
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, message]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (keyword && !o.username.includes(keyword) && !o.id.includes(keyword)) return false;
      return true;
    });
  }, [orders, statusFilter, keyword]);

  const stats = useMemo(() => {
    const soldOrders = orders.filter((o) => o.status === 'sold');
    const totalIncome = user ? soldOrders.reduce((s, o) => s + computeIncome(o, user.id), 0) : 0;
    const pendingIncome = user
      ? orders.filter((o) => o.status !== 'sold').reduce((s, o) => s + computeIncome(o, user.id), 0)
      : 0;
    return { total: orders.length, soldCount: soldOrders.length, totalIncome, pendingIncome };
  }, [orders, user]);

  const columns: ColumnsType<OrderWithLines> = [
    { title: '订单号', dataIndex: 'id', width: 100, render: (id) => <code style={{ fontSize: 12 }}>{id.slice(0, 8)}</code> },
    { title: '下单人', dataIndex: 'username', width: 120 },
    {
      title: '下单人级别',
      dataIndex: 'user_level',
      width: 100,
      render: (lv: number | null) => {
        const label = LEVEL_LABEL[lv ?? 'null'];
        return <Tag>{label}</Tag>;
      },
    },
    { title: '提交时间', dataIndex: 'created_at', width: 160, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '订单金额', dataIndex: 'total_amount', width: 110, render: (v) => `¥${Number(v).toFixed(2)}` },
    {
      title: '我的收益',
      width: 110,
      render: (_, r) => (user ? <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{computeIncome(r, user.id).toFixed(2)}</span> : '—'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (s: string) => {
        const st = STATUS_MAP[s] ?? { text: s, color: 'default' };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    { title: '售出时间', dataIndex: 'sold_at', width: 160, render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="团队订单总数" value={stats.total} /></Card></Col>
        <Col span={6}><Card><Statistic title="已售出" value={stats.soldCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已到账收益" value={stats.totalIncome} prefix="¥" precision={2} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待结算收益" value={stats.pendingIncome} prefix="¥" precision={2} valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>

      <Card
        title={<Typography.Title level={4} style={{ margin: 0 }}>团队订单</Typography.Title>}
        extra={
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="订单号/下单人" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 200 }} allowClear />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待收货' },
                { value: 'received', label: '已收货' },
                { value: 'sold', label: '已售出' },
              ]}
            />
          </Space>
        }
      >
        {loading ? null : filtered.length === 0 ? (
          <Empty description="暂无团队订单" />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} />
        )}
      </Card>
    </div>
  );
}
