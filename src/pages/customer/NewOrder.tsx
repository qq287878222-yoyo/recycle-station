import { useEffect, useMemo, useState } from 'react';
import { Card, Table, InputNumber, Button, Typography, App, Statistic, Row, Col, Input, Space, Tag, Empty, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { itemService } from '../../services/itemService';
import { orderService } from '../../services/orderService';
import { authService } from '../../services/authService';
import { categoryService } from '../../services/categoryService';
import { priceForUser, type RecycleItem, type Category } from '../../types/database';

interface CartLine {
  item: RecycleItem;
  quantity: number;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const user = authService.getCurrentUser();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await itemService.list(false);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        setCategories(await categoryService.list());
      } catch { /* 分类加载失败不阻断下单 */ }
    })();
  }, []);

  const filteredItems = useMemo(
    () => (categoryFilter === 'all' ? items : items.filter((it) => it.category_id === categoryFilter)),
    [items, categoryFilter]
  );

  const lines: CartLine[] = useMemo(
    () =>
      items
        .filter((it) => (cart[it.id] ?? 0) > 0)
        .map((it) => ({ item: it, quantity: cart[it.id] })),
    [items, cart]
  );

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * priceForUser(l.item, user), 0),
    [lines, user]
  );

  const updateQty = (id: string, qty: number | null) => {
    setCart((prev) => {
      const next = { ...prev };
      if (!qty || qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!lines.length) {
      message.warning('请至少选择一项货品');
      return;
    }
    if (!user) {
      message.error('登录已过期');
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      const order = await orderService.createOrder({
        user,
        remark,
        lines: lines.map((l) => ({ item: l.item, quantity: l.quantity })),
      });
      message.success(`订单提交成功,总金额 ¥${order.total_amount}`);
      setCart({});
      setRemark('');
      navigate('/my-orders');
    } catch (e) {
      message.error((e as Error).message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const itemColumns: ColumnsType<RecycleItem> = [
    {
      title: '货品',
      key: 'name',
      render: (_, r) => (
        <Space>
          {r.image_url && <img src={r.image_url} alt={r.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            {r.categories?.name && <Tag color="green">{r.categories.name}</Tag>}
          </div>
        </Space>
      ),
    },
    {
      title: '单价',
      key: 'price',
      width: 130,
      render: (_, r) => <span style={{ color: '#f5222d' }}>¥{priceForUser(r, user).toFixed(2)} / {r.unit}</span>,
    },
    {
      title: '数量',
      key: 'quantity',
      width: 180,
      render: (_, r) => (
        <InputNumber
          min={0}
          precision={2}
          step={r.unit === '台' ? 1 : 0.5}
          value={cart[r.id] ?? 0}
          onChange={(v) => updateQty(r.id, v)}
          addonAfter={r.unit}
          style={{ width: 150 }}
        />
      ),
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 120,
      render: (_, r) => {
        const q = cart[r.id] ?? 0;
        return <span style={{ fontWeight: 600 }}>¥{(q * priceForUser(r, user)).toFixed(2)}</span>;
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>提交回收订单</Typography.Title>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="按模板填写回收货品"
            size="small"
            extra={
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 160 }}
                options={[
                  { value: 'all', label: '全部分类' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            }
          >
            <Table
              rowKey="id"
              loading={loading}
              columns={itemColumns}
              dataSource={filteredItems}
              pagination={false}
              size="small"
              scroll={{ y: 460 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="订单预览" size="small">
            {lines.length === 0 ? (
              <Empty description="暂未选择货品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <Table
                  rowKey={(r) => r.item.id}
                  size="small"
                  pagination={false}
                  dataSource={lines}
                  columns={[
                    { title: '货品', dataIndex: ['item', 'name'] },
                    { title: '数量', width: 90, render: (_, r: CartLine) => `${r.quantity} ${r.item.unit}` },
                    { title: '小计', width: 90, render: (_, r: CartLine) => `¥${(r.quantity * priceForUser(r.item, user)).toFixed(2)}` },
                    {
                      key: 'action',
                      width: 40,
                      render: (_, r: CartLine) => (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => updateQty(r.item.id, 0)} />
                      ),
                    },
                  ]}
                />
                <Input.TextArea
                  placeholder="备注(可选,如联系方式、上门时间等)"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={2}
                  style={{ marginTop: 12 }}
                />
              </>
            )}

            <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 4 }}>
              <Statistic
                title="预计总金额"
                value={total}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#f5222d', fontSize: 32 }}
              />
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                最终金额以管理员实际收货确认为准
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              block
              icon={<SendOutlined />}
              disabled={!lines.length}
              loading={submitting}
              onClick={handleSubmit}
              style={{ marginTop: 16 }}
            >
              提交订单
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
