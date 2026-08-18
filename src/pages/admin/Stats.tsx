import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Empty, App, Table } from 'antd';
import { ShoppingOutlined, DollarOutlined, UserOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { orderService, type OrderWithLines } from '../../services/orderService';

const COLORS = ['#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

export default function AdminStats() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setOrders(await orderService.listAll());
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [message]);

  const stats = useMemo(() => {
    const total = orders.length;
    const sold = orders.filter((o) => o.status === 'sold');
    const soldRevenue = sold.reduce((s, o) => s + Number(o.sold_amount ?? 0), 0);
    const uniqueCustomers = new Set(orders.map((o) => o.user_id)).size;

    // 按品类统计数量
    const categoryMap = new Map<string, number>();
    orders.forEach((o) => {
      o.order_items?.forEach((li) => {
        categoryMap.set(li.item_name, (categoryMap.get(li.item_name) ?? 0) + Number(li.quantity));
      });
    });
    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // 最近 7 天订单趋势
    const dayMap = new Map<string, { count: number; amount: number }>();
    for (let i = 6; i >= 0; i--) {
      const key = dayjs().subtract(i, 'day').format('MM-DD');
      dayMap.set(key, { count: 0, amount: 0 });
    }
    orders.forEach((o) => {
      const key = dayjs(o.created_at).format('MM-DD');
      const cur = dayMap.get(key);
      if (cur) {
        cur.count += 1;
        cur.amount += Number(o.total_amount);
      }
    });
    const trendData = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      订单数: v.count,
      金额: Number(v.amount.toFixed(2)),
    }));

    // Top 客户
    const custMap = new Map<string, { name: string; orderCount: number; amount: number }>();
    orders.forEach((o) => {
      const cur = custMap.get(o.user_id) ?? { name: o.username, orderCount: 0, amount: 0 };
      cur.orderCount += 1;
      cur.amount += Number(o.sold_amount ?? o.total_amount);
      custMap.set(o.user_id, cur);
    });
    const topCustomers = Array.from(custMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      total,
      soldCount: sold.length,
      soldRevenue,
      uniqueCustomers,
      categoryData,
      trendData,
      topCustomers,
    };
  }, [orders]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Typography.Title level={3}>数据统计</Typography.Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="订单总数" value={stats.total} prefix={<ShoppingOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="已售出订单" value={stats.soldCount} valueStyle={{ color: '#52c41a' }} prefix={<InboxOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="累计售出金额" value={stats.soldRevenue} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="活跃客户数" value={stats.uniqueCustomers} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="最近 7 天订单趋势" size="small">
            {orders.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="订单数" stroke="#1890ff" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="金额" stroke="#f5222d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="回收品类分布(数量 Top 6)" size="small">
            {stats.categoryData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.categoryData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {stats.categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Top 10 客户">
        {stats.topCustomers.length === 0 ? <Empty /> : (
          <Row gutter={16}>
            <Col span={12}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stats.topCustomers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#52c41a" name="累计金额(¥)" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col span={12}>
              <Table
                size="small"
                rowKey="name"
                pagination={false}
                dataSource={stats.topCustomers}
                columns={[
                  { title: '排名', render: (_, __, i) => i + 1, width: 60 },
                  { title: '客户', dataIndex: 'name' },
                  { title: '订单数', dataIndex: 'orderCount', width: 80 },
                  { title: '累计金额', dataIndex: 'amount', render: (v) => `¥${Number(v).toFixed(2)}`, width: 120 },
                ]}
              />
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
}
