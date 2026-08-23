import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Typography, Space, Button, Modal, Form, InputNumber, Input, App, Descriptions, Statistic, Row, Col, Select, DatePicker, Divider, Tooltip, Image } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, DollarOutlined, SearchOutlined, InboxOutlined, PlusOutlined, PayCircleOutlined, UserOutlined, PhoneOutlined, WechatOutlined, AlipayOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { orderService, computeAdminProfit, computeSplitShares, type OrderWithLines } from '../../services/orderService';
import { agentService } from '../../services/agentService';
import { itemService } from '../../services/itemService';
import type { AppUser, RecycleItem } from '../../types/database';

const { RangePicker } = DatePicker;

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

const LEVEL_TAG_COLOR: Record<string, string> = {
  '1': 'red',
  '2': 'orange',
  '3': 'blue',
  null: 'default',
};

type SortKey = 'time_desc' | 'time_asc' | 'amount_desc' | 'amount_asc';

export default function AdminOrders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [customerKeyword, setCustomerKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('time_desc');
  const [soldModal, setSoldModal] = useState<{ open: boolean; order: OrderWithLines | null }>({ open: false, order: null });
  const [splitModal, setSplitModal] = useState<{ open: boolean; order: OrderWithLines | null }>({ open: false, order: null });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm<{ sold_amount: number; sold_buyer?: string }>();
  const [addForm] = Form.useForm<{ user_id: string; lines: { item_id: string; quantity: number }[]; remark?: string }>();

  const load = async () => {
    setLoading(true);
    try { setOrders(await orderService.listAll()); }
    catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    agentService.listAll().then(setUsers).catch(() => {});
    itemService.list().then(setItems).catch(() => {});
  }, []);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userName = (id: string | null) => (id ? userMap.get(id)?.username ?? '未知用户' : '—');

  /** 订单的直接上家代理 id:L2→L1、L3→L2、客户→L3、L1→管理员 */
  const directParent = (o: OrderWithLines): { name: string; level: string } => {
    if (o.user_level === 1) return { name: '管理员', level: 'admin' };
    if (o.user_level === 2) return { name: userName(o.l1_agent_id), level: '1' };
    if (o.user_level === 3) return { name: userName(o.l2_agent_id), level: '2' };
    return { name: userName(o.l3_agent_id), level: '3' };
  };

  const filtered = useMemo(() => {
    let list = orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (keyword && !o.id.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (customerKeyword && !o.username.toLowerCase().includes(customerKeyword.toLowerCase())) return false;
      if (dateRange) {
        const d = dayjs(o.created_at);
        if (d.isBefore(dateRange[0].startOf('day')) || d.isAfter(dateRange[1].endOf('day'))) return false;
      }
      return true;
    });
    switch (sortKey) {
      case 'amount_desc': list = [...list].sort((a, b) => Number(b.total_amount) - Number(a.total_amount)); break;
      case 'amount_asc': list = [...list].sort((a, b) => Number(a.total_amount) - Number(b.total_amount)); break;
      case 'time_asc': list = [...list].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf()); break;
      default: list = [...list].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
    }
    return list;
  }, [orders, statusFilter, keyword, customerKeyword, dateRange, sortKey]);

  const stats = useMemo(() => {
    const pending = filtered.filter((o) => o.status === 'pending').length;
    const received = filtered.filter((o) => o.status === 'received').length;
    const sold = filtered.filter((o) => o.status === 'sold');
    const revenue = sold.reduce((s, o) => s + Number(o.sold_amount ?? 0), 0);
    const profit = sold.reduce((s, o) => s + computeAdminProfit(o), 0);
    return { total: filtered.length, pending, received, soldCount: sold.length, revenue, profit };
  }, [filtered]);

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

  const handleSplit = async () => {
    if (!splitModal.order) return;
    try {
      await orderService.markSplit(splitModal.order.id);
      message.success('分账完成');
      setSplitModal({ open: false, order: null });
      load();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleAddOrder = async () => {
    const values = await addForm.validateFields();
    const user = users.find((u) => u.id === values.user_id);
    if (!user) { message.error('请选择下单人'); return; }
    const lines = (values.lines ?? [])
      .map((l) => ({ item: items.find((it) => it.id === l.item_id), quantity: l.quantity }))
      .filter((l) => l.item && l.quantity > 0) as { item: RecycleItem; quantity: number }[];
    if (!lines.length) { message.warning('请至少添加一项货品'); return; }
    try {
      const order = await orderService.createOrder({ user, lines, remark: values.remark });
      message.success(`手工订单创建成功,总金额 ¥${order.total_amount}`);
      setAddModalOpen(false);
      addForm.resetFields();
      load();
    } catch (e) { message.error((e as Error).message || '创建失败'); }
  };

  const columns: ColumnsType<OrderWithLines> = [
    { title: '订单号', dataIndex: 'id', width: 100, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 8)}</code> },
    { title: '下单人', dataIndex: 'username', width: 100 },
    { title: '级别', dataIndex: 'user_level', width: 90, render: (lv: number | null) => <Tag>{LEVEL_LABEL[String(lv)]}</Tag> },
    {
      title: '上家代理', key: 'parent', width: 150,
      render: (_, r) => {
        const p = directParent(r);
        if (p.level === 'admin') return <Tag color="purple">管理员直属</Tag>;
        if (p.name === '—') return '—';
        const tipText = r.user_level === 3 ? '三级代理的上线二级代理' : r.user_level === 2 ? '二级代理的上线一级代理' : '客户的直属三级代理';
        return (
          <Tooltip title={`${tipText}:${LEVEL_LABEL[p.level]} ${p.name}`}>
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <Tag color={LEVEL_TAG_COLOR[p.level]} style={{ marginRight: 4, flexShrink: 0 }}>{LEVEL_LABEL[p.level]}</Tag>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          </Tooltip>
        );
      },
    },
    { title: '提交时间', dataIndex: 'created_at', width: 160, render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '货品数', width: 70, render: (_, r) => r.order_items?.length ?? 0 },
    {
      title: '订单金额', dataIndex: 'total_amount', width: 100,
      sorter: (a, b) => Number(a.total_amount) - Number(b.total_amount),
      render: (v) => `¥${Number(v).toFixed(2)}`,
    },
    { title: '售出金额', dataIndex: 'sold_amount', width: 100, render: (v: number | null) => v != null ? <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{Number(v).toFixed(2)}</span> : '—' },
    { title: '售出利润', width: 100, render: (_, r) => r.status === 'sold' ? <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{computeAdminProfit(r).toFixed(2)}</span> : '—' },
    {
      title: '上级分账', key: 'split', width: 240,
      render: (_, r) => {
        const shares = computeSplitShares(r);
        if (!shares.length) return <span style={{ color: '#999' }}>无上线分账</span>;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            {shares.map((sh) => (
              <div key={sh.level} style={{ display: 'flex', alignItems: 'center', fontSize: 12, minWidth: 0 }}>
                <Tag color={LEVEL_TAG_COLOR[String(sh.level)]} style={{ marginRight: 4, flexShrink: 0 }}>{LEVEL_LABEL[String(sh.level)]}</Tag>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName(sh.agent_id)}</span>
                <b style={{ color: '#fa8c16', flexShrink: 0, marginLeft: 4 }}>¥{sh.amount.toFixed(2)}</b>
              </div>
            ))}
          </Space>
        );
      },
    },
    { title: '状态', dataIndex: 'status', width: 120, render: (s: string) => { const st = STATUS_MAP[s] ?? { text: s, color: 'default' }; return <Tag color={st.color}>{st.text}</Tag>; } },
    {
      title: '操作', key: 'action', width: 230, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Button type="primary" size="small" icon={<InboxOutlined />} onClick={() => handleReceived(r)}>确认收货</Button>
          )}
          {r.status === 'received' && (
            <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openSoldModal(r)}>最终售卖</Button>
          )}
          {r.status === 'sold' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />}
          {computeSplitShares(r).length > 0 && (
            r.split_status === 'split' ? (
              <Tooltip title={r.split_at ? `分账时间:${dayjs(r.split_at).format('YYYY-MM-DD HH:mm')}` : ''}>
                <Tag color="success" icon={<PayCircleOutlined />}>已分账</Tag>
              </Tooltip>
            ) : (
              <Button size="small" icon={<PayCircleOutlined />} onClick={() => setSplitModal({ open: true, order: r })}>分账</Button>
            )
          )}
        </Space>
      ),
    },
  ];

  const splitShares = splitModal.order ? computeSplitShares(splitModal.order) : [];

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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>手工添加订单</Button>
        }
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<UserOutlined />} placeholder="搜索客户/下单人" value={customerKeyword} onChange={(e) => setCustomerKeyword(e.target.value)} style={{ width: 180 }} allowClear />
          <Input prefix={<SearchOutlined />} placeholder="订单号" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 160 }} allowClear />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '待收货' },
              { value: 'received', label: '待售出' },
              { value: 'sold', label: '已售出' },
            ]} />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
            allowClear
          />
          <Select value={sortKey} onChange={setSortKey} style={{ width: 150 }}
            options={[
              { value: 'time_desc', label: '最新订单在前' },
              { value: 'time_asc', label: '最早订单在前' },
              { value: 'amount_desc', label: '金额从高到低' },
              { value: 'amount_asc', label: '金额从低到高' },
            ]} />
        </Space>

        <Table
          rowKey="id" loading={loading} columns={columns} dataSource={filtered} scroll={{ x: 1600 }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions bordered size="small" column={2} labelStyle={{ width: 100 }}>
                <Descriptions.Item label="备注" span={2}>{record.remark || '无'}</Descriptions.Item>
                <Descriptions.Item label="联系方式" span={2}>
                  {(() => {
                    const u = userMap.get(record.user_id);
                    if (!u || (!u.phone && !u.wechat && !u.wechat_qrcode && !u.alipay_qrcode)) {
                      return <span style={{ color: '#999' }}>下单人未填写联系/收款信息</span>;
                    }
                    return (
                      <Space size={20} wrap align="start">
                        {u.phone && <span><PhoneOutlined /> {u.phone}</span>}
                        {u.wechat && <span><WechatOutlined /> 微信:{u.wechat}</span>}
                        {u.wechat_qrcode && (
                          <div style={{ textAlign: 'center' }}>
                            <Image src={u.wechat_qrcode} width={64} height={64} style={{ objectFit: 'contain' }} />
                            <div style={{ fontSize: 12, color: '#999' }}><WechatOutlined /> 微信收款码</div>
                          </div>
                        )}
                        {u.alipay_qrcode && (
                          <div style={{ textAlign: 'center' }}>
                            <Image src={u.alipay_qrcode} width={64} height={64} style={{ objectFit: 'contain' }} />
                            <div style={{ fontSize: 12, color: '#999' }}><AlipayOutlined /> 支付宝收款码</div>
                          </div>
                        )}
                      </Space>
                    );
                  })()}
                </Descriptions.Item>
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

      <Modal
        title={<Space><PayCircleOutlined />订单分账</Space>}
        open={splitModal.open}
        onCancel={() => setSplitModal({ open: false, order: null })}
        onOk={handleSplit}
        okText="确认分账"
      >
        {splitModal.order && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="订单号"><code>{splitModal.order.id.slice(0, 8)}</code></Descriptions.Item>
              <Descriptions.Item label="下单人">{splitModal.order.username}({LEVEL_LABEL[String(splitModal.order.user_level)]})</Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{Number(splitModal.order.total_amount).toFixed(2)}(下单人应得)</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '8px 0' }}>需分给上线代理的差价</Divider>
            <Table
              size="small" pagination={false} rowKey="agent_id" dataSource={splitShares}
              columns={[
                { title: '代理级别', dataIndex: 'level', render: (lv: number) => <Tag color={LEVEL_TAG_COLOR[String(lv)]}>{LEVEL_LABEL[String(lv)]}</Tag> },
                { title: '代理', dataIndex: 'agent_id', render: (id: string) => userName(id) },
                { title: '分账金额', dataIndex: 'amount', render: (v: number) => <b style={{ color: '#fa8c16' }}>¥{v.toFixed(2)}</b> },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}><b>合计分出</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><b style={{ color: '#f5222d' }}>¥{splitShares.reduce((s, sh) => s + sh.amount, 0).toFixed(2)}</b></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              确认后订单标记为"已分账",表示差价已结算给对应上线代理
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={<Space><PlusOutlined />手工添加订单</Space>}
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        onOk={handleAddOrder}
        okText="创建订单"
        width={640}
      >
        <Form form={addForm} layout="vertical" initialValues={{ lines: [{ quantity: 1 }] }}>
          <Form.Item
            label="下单人(按该用户级别计价并自动绑定其上线代理链)"
            name="user_id"
            rules={[{ required: true, message: '请选择下单人' }]}
          >
            <Select
              showSearch
              placeholder="搜索并选择客户/代理"
              optionFilterProp="label"
              options={users
                .filter((u) => u.role !== 'admin')
                .map((u) => ({
                  value: u.id,
                  label: `${u.username}(${LEVEL_LABEL[String(u.agent_level)]}${u.phone ? ` / ${u.phone}` : ''})`,
                }))}
            />
          </Form.Item>

          <Divider style={{ margin: '4px 0 12px' }}>货品明细</Divider>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 4 }}>
                    <Form.Item
                      {...field} name={[field.name, 'item_id']} noStyle
                      rules={[{ required: true, message: '请选择货品' }]}
                    >
                      <Select
                        showSearch
                        placeholder="选择货品"
                        style={{ width: 280 }}
                        optionFilterProp="label"
                        options={items.map((it) => ({ value: it.id, label: `${it.name}(¥${it.price_customer}~${it.price_l1}/${it.unit})` }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...field} name={[field.name, 'quantity']} noStyle
                      rules={[{ required: true, message: '请输入数量' }]}
                    >
                      <InputNumber min={0.01} precision={2} placeholder="数量" style={{ width: 120 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button type="text" danger size="small" onClick={() => remove(field.name)}>删除</Button>
                    )}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ quantity: 1 })} block icon={<PlusOutlined />}>
                  添加货品
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item label="备注" name="remark" style={{ marginTop: 12 }}>
            <Input placeholder="备注(可选)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
