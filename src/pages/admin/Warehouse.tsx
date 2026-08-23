import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Typography, Space, Button, App, Statistic, Row, Col, Tag, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, PrinterOutlined, ClearOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '../../services/orderService';
import type { OrderWithLines } from '../../services/orderService';
import { itemService } from '../../services/itemService';
import type { RecycleItem } from '../../types/database';

const { Title, Text } = Typography;

interface StockRow {
  key: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
}

const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Warehouse() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderWithLines[]>([]);
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [stockOrders, allItems] = await Promise.all([orderService.listStockOrders(), itemService.list(true)]);
      setOrders(stockOrders);
      setItems(allItems);
    } catch (e) {
      message.error('加载库存失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 按货品汇总:数量累计,单价取当前一级代理价(货品已删除时用下单快照) */
  const rows = useMemo<StockRow[]>(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const agg = new Map<string, StockRow>();
    for (const o of orders) {
      for (const li of o.order_items ?? []) {
        const qty = Number(li.quantity);
        const item = itemMap.get(li.item_id);
        const price = item ? Number(item.price_l1) : Number(li.price_l1_snapshot ?? 0);
        const exist = agg.get(li.item_id);
        if (exist) {
          exist.quantity += qty;
        } else {
          agg.set(li.item_id, {
            key: li.item_id,
            name: li.item_name,
            unit: li.unit ?? '',
            quantity: qty,
            price,
            total: 0,
          });
        }
      }
    }
    const list = [...agg.values()];
    for (const r of list) r.total = Number((r.quantity * r.price).toFixed(2));
    return list.sort((a, b) => b.total - a.total);
  }, [orders, items]);

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);

  /** 导出 CSV(带 BOM,Excel 直接打开不乱码) */
  const exportCsv = () => {
    if (!rows.length) return;
    const lines = ['货品名称,单位,数量,单价(一级代理价),合计金额'];
    for (const r of rows) lines.push(`${r.name},${r.unit},${r.quantity},${r.price},${r.total}`);
    lines.push(`合计,,${totalQty},,${fmt(totalAmount)}`);
    lines.push('');
    lines.push(`导出时间:${dayjs().format('YYYY-MM-DD HH:mm')},在库订单数:${orders.length}`);
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `仓库库存清单_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已导出库存清单');
  };

  /** 打印清单:新窗口渲染打印版表格后调起系统打印 */
  const printList = () => {
    if (!rows.length) return;
    const trs = rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.unit}</td><td>${r.quantity}</td><td>¥${fmt(r.price)}</td><td>¥${fmt(r.total)}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>仓库库存结算清单</title>
<style>
  body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#222}
  h1{text-align:center;font-size:20px;margin-bottom:4px}
  .meta{text-align:center;color:#666;font-size:12px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #333;padding:6px 8px;font-size:13px;text-align:center}
  th{background:#f0f0f0}
  tfoot td{font-weight:700;background:#fafafa}
</style></head><body>
<h1>仓库库存结算清单</h1>
<div class="meta">导出时间:${dayjs().format('YYYY-MM-DD HH:mm')} ・ 在库订单数:${orders.length} ・ 货品种类:${rows.length}</div>
<table>
<thead><tr><th>#</th><th>货品名称</th><th>单位</th><th>数量</th><th>单价(一级代理价)</th><th>合计金额</th></tr></thead>
<tbody>${trs}</tbody>
<tfoot><tr><td colspan="3">合计</td><td>${totalQty}</td><td>—</td><td>¥${fmt(totalAmount)}</td></tr></tfoot>
</table>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      message.error('浏览器拦截了弹窗,请允许后重试');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  /** 一键清除库存 */
  const handleClear = () => {
    modal.confirm({
      title: '确认清除仓库库存?',
      icon: <InboxOutlined />,
      content: (
        <div>
          <p style={{ marginTop: 8 }}>
            当前在库 <Text strong>{rows.length}</Text> 种货品、共 <Text strong>{totalQty}</Text> 件,合计{' '}
            <Text strong type="danger">¥{fmt(totalAmount)}</Text>。
          </p>
          <p>
            清除后这批订单将标记为 <Tag color="green">已结算</Tag>,不再计入库存;之后新确认收货的订单会重新累计。
            请先导出/打印清单再清除。
          </p>
        </div>
      ),
      okText: '确认清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setClearing(true);
        try {
          const count = await orderService.settleWarehouse();
          message.success(`已清除库存,共结算 ${count} 笔订单`);
          await load();
        } catch (e) {
          message.error('清除失败: ' + (e as Error).message);
        } finally {
          setClearing(false);
        }
      },
    });
  };

  const columns: ColumnsType<StockRow> = [
    { title: '#', key: 'index', width: 60, render: (_, __, i) => i + 1 },
    { title: '货品名称', dataIndex: 'name' },
    { title: '单位', dataIndex: 'unit', width: 90 },
    { title: '数量', dataIndex: 'quantity', width: 120, render: (v: number) => <Text strong>{v}</Text> },
    {
      title: '单价(一级代理价)',
      dataIndex: 'price',
      width: 160,
      render: (v: number) => `¥ ${fmt(v)}`,
    },
    {
      title: '合计金额',
      dataIndex: 'total',
      width: 160,
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>¥ {fmt(v)}</Text>,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        仓库库存
      </Title>
      <Text type="secondary">
        订单在订单管理处确认收货后自动计入库存;拉去结算时导出/打印清单,然后一键清除库存,新确认的订单重新累计。
      </Text>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="在库货品种类" value={rows.length} suffix="种" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="在库总数量" value={totalQty} suffix="件" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="在库总金额(一级代理价)" value={totalAmount} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="在库订单数" value={orders.length} suffix="笔" />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ marginTop: 16 }}
        title={`库存清单(按货品汇总)`}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!rows.length}>
              导出 CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={printList} disabled={!rows.length}>
              打印清单
            </Button>
            <Button danger icon={<ClearOutlined />} onClick={handleClear} loading={clearing} disabled={!rows.length}>
              一键清除库存
            </Button>
          </Space>
        }
      >
        {rows.length ? (
          <Table<StockRow>
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={false}
            size="middle"
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong>{totalQty}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text type="secondary">—</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <Text strong style={{ color: '#cf1322' }}>¥ {fmt(totalAmount)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        ) : (
          <Empty description="暂无在库货品,订单确认收货后会自动计入库存" />
        )}
      </Card>
    </div>
  );
}
