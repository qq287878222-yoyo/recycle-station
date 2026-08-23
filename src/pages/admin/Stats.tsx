import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Empty, App, Table, Space, DatePicker, Select } from 'antd';
import { ShoppingOutlined, DollarOutlined, InboxOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { orderService, type OrderWithLines } from '../../services/orderService';

const COLORS = ['#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

const { RangePicker } = DatePicker;

export default function AdminStats() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');

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

  /** 仅按日期过滤,用于级别分布对比 */
  const dateFiltered = useMemo(() => {
    if (!dateRange) return orders;
    return orders.filter((o) => {
      const d = dayjs(o.created_at);
      return !d.isBefore(dateRange[0].startOf('day')) && !d.isAfter(dateRange[1].endOf('day'));
    });
  }, [orders, dateRange]);

  /** 日期 + 下单人级别过滤 */
  const filteredOrders = useMemo(() => {
    if (levelFilter === 'all') return dateFiltered;
    return dateFiltered.filter((o) =>
      levelFilter === 'customer' ? o.user_level == null : Number(o.user_level) === Number(levelFilter)
    );
  }, [dateFiltered, levelFilter]);

  /** 各级别订单统计(基于日期筛选结果) */
  const levelStats = useMemo(() => {
    const groups: { key: string; name: string; orders: OrderWithLines[] }[] = [
      { key: '1', name: '一级代理', orders: dateFiltered.filter((o) => o.user_level === 1) },
      { key: '2', name: '二级代理', orders: dateFiltered.filter((o) => o.user_level === 2) },
      { key: '3', name: '三级代理', orders: dateFiltered.filter((o) => o.user_level === 3) },
      { key: 'customer', name: '客户', orders: dateFiltered.filter((o) => o.user_level == null) },
    ];
    return groups.map((g) => ({
      key: g.key,
      name: g.name,
      count: g.orders.length,
      amount: Number(g.orders.reduce((s, o) => s + Number(o.total_amount), 0).toFixed(2)),
      soldRevenue: Number(g.orders.reduce((s, o) => s + Number(o.sold_amount ?? 0), 0).toFixed(2)),
    }));
  }, [dateFiltered]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const sold = filteredOrders.filter((o) => o.status === 'sold');
    const soldRevenue = sold.reduce((s, o) => s + Number(o.sold_amount ?? 0), 0);
    const totalAmount = filteredOrders.reduce((s, o) => s + Number(o.total_amount), 0);
    const uniqueCustomers = new Set(filteredOrders.map((o) => o.user_id)).size;

    // 按品类统计数量
    const categoryMap = new Map<string, number>();
    filteredOrders.forEach((o) => {
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
    filteredOrders.forEach((o) => {
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
    filteredOrders.forEach((o) => {
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
      totalAmount,
      uniqueCustomers,
      categoryData,
      trendData,
      topCustomers,
    };
  }, [filteredOrders]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col><Typography.Title level={3} style={{ margin: 0 }}>数据统计</Typography.Title></Col>
        <Col>
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(v) => setDateRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
              allowClear
            />
            <Select value={levelFilter} onChange={setLevelFilter} style={{ width: 160 }}
              options={[
                { value: 'all', label: '全部下单人' },
                { value: '1', label: '一级代理订单' },
                { value: '2', label: '二级代理订单' },
                { value: '3', label: '三级代理订单' },
                { value: 'customer', label: '客户订单' },
              ]} />
          </Space>
        </Col>
      </Row>

      <Card title={<Space><TeamOutlined />各级别下单统计</Space>} size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={14}>
            {dateFiltered.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={levelStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="订单数" fill="#1890ff" />
                  <Bar yAxisId="right" dataKey="amount" name="订单金额(¥)" fill="#faad14" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Col>
          <Col span={10}>
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={levelStats}
              columns={[
                { title: '下单人级别', dataIndex: 'name' },
                { title: '订单数', dataIndex: 'count', width: 80 },
                { title: '订单金额', dataIndex: 'amount', width: 110, render: (v) => `¥${Number(v).toFixed(2)}` },
                { title: '售出金额', dataIndex: 'soldRevenue', width: 110, render: (v) => `¥${Number(v).toFixed(2)}` },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="订单总数" value={stats.total} prefix={<ShoppingOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="订单总金额" value={stats.totalAmount} precision={2} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="已售出订单" value={stats.soldCount} valueStyle={{ color: '#52c41a' }} prefix={<InboxOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="累计售出金额" value={stats.soldRevenue} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="最近 7 天订单趋势" size="small">
            {filteredOrders.length === 0 ? <Empty /> : (
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

      <div style={{ color: '#999', fontSize: 12, marginTop: 12 }}>
        提示:上方日期与级别筛选会同时作用于各级别下单统计之外的全部图表;活跃客户数 {stats.uniqueCustomers}
      </div>
    </div>
  );
}
