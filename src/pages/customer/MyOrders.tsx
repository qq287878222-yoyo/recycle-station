import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Empty, Spin, Descriptions, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { orderService, type OrderWithLines } from '../../services/orderService';
import { authService } from '../../services/authService';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待收货', color: 'processing' },
  received: { text: '已收货,待售出', color: 'blue' },
  sold: { text: '已售出', color: 'success' },
};

export default function MyOrders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) return;
    (async () => {
      try {
        const data = await orderService.listByUser(user.id);
        setOrders(data);
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [message]);

  const columns: ColumnsType<OrderWithLines> = [
    { title: '订单编号', dataIndex: 'id', width: 100, render: (id: string) => <code style={{ fontSize: 12 }}>{id.slice(0, 8)}</code> },
    { title: '提交时间', dataIndex: 'created_at', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '货品数', width: 80, render: (_, r) => r.order_items?.length ?? 0 },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      width: 110,
      render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{Number(v).toFixed(2)}</span>,
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
    { title: '收货时间', dataIndex: 'received_at', width: 160, render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
  ];

  return (
    <Card title={<Typography.Title level={4} style={{ margin: 0 }}>我的订单</Typography.Title>}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : orders.length === 0 ? (
        <Empty description="您还没有任何订单" />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={orders}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions bordered size="small" column={1} labelStyle={{ width: 100 }}>
                <Descriptions.Item label="备注">{record.remark || '无'}</Descriptions.Item>
                <Descriptions.Item label="货品明细">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={record.order_items ?? []}
                    columns={[
                      { title: '货品', dataIndex: 'item_name' },
                      { title: '单价', dataIndex: 'unit_price', render: (v) => `¥${Number(v).toFixed(2)}` },
                      { title: '数量', render: (_, r) => `${r.quantity} ${r.unit ?? ''}` },
                      { title: '小计', dataIndex: 'subtotal', render: (v) => `¥${Number(v).toFixed(2)}` },
                    ]}
                  />
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      )}
    </Card>
  );
}
