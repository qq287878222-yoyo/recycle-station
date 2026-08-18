import { useEffect, useMemo, useState } from 'react';
import { Card, Statistic, Row, Col, Typography, App, Table, Tag, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { orderService, computeIncome, type OrderWithLines } from '../../services/orderService';
import { authService } from '../../services/authService';

export default function Income() {
  const { message } = App.useApp();
  const user = authService.getCurrentUser();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { paidRows, pendingRows, totalPaid, totalPending } = useMemo(() => {
    const paid: (OrderWithLines & { income: number })[] = [];
    const pending: (OrderWithLines & { income: number })[] = [];
    let totalP = 0, totalPend = 0;
    for (const o of orders) {
      if (!user) continue;
      const inc = computeIncome(o, user.id);
      if (o.status === 'sold') {
        paid.push({ ...o, income: inc });
        totalP += inc;
      } else {
        pending.push({ ...o, income: inc });
        totalPend += inc;
      }
    }
    return { paidRows: paid, pendingRows: pending, totalPaid: totalP, totalPending: totalPend };
  }, [orders, user]);

  const cols: ColumnsType<OrderWithLines & { income: number }> = [
    { title: '订单号', dataIndex: 'id', width: 100, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 8)}</code> },
    { title: '下单人', dataIndex: 'username', width: 120 },
    { title: '订单金额', dataIndex: 'total_amount', width: 110, render: (v) => `¥${Number(v).toFixed(2)}` },
    { title: '我的收益', dataIndex: 'income', width: 110, render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{v.toFixed(2)}</span> },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => s === 'sold' ? <Tag color="success">已售出</Tag> : s === 'received' ? <Tag color="blue">已收货</Tag> : <Tag>待收货</Tag>,
    },
    { title: '售出时间', dataIndex: 'sold_at', width: 160, render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
  ];

  return (
    <div>
      <Typography.Title level={3}>我的收益</Typography.Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <Statistic title="已到账收益(sold)" value={totalPaid} prefix="¥" precision={2} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic title="待结算收益(pending / received)" value={totalPending} prefix="¥" precision={2} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Card title="已到账明细" style={{ marginBottom: 16 }}>
        {paidRows.length === 0 ? <Empty /> : (
          <Table rowKey="id" columns={cols} dataSource={paidRows} loading={loading} pagination={{ pageSize: 10 }} />
        )}
      </Card>
      <Card title="待结算明细">
        {pendingRows.length === 0 ? <Empty /> : (
          <Table rowKey="id" columns={cols} dataSource={pendingRows} loading={loading} pagination={{ pageSize: 10 }} />
        )}
      </Card>
    </div>
  );
}
