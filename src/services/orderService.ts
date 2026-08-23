import { getPostgrest } from '../utils/supabase';
import { resolveAgentChain } from './authService';
import type { AppUser, Order, OrderItem, RecycleItem } from '../types/database';
import { priceForUser } from '../types/database';

export interface OrderLineInput {
  item: RecycleItem;
  quantity: number;
}

export interface OrderWithLines extends Order {
  order_items?: OrderItem[];
}

export const orderService = {
  /**
   * 创建订单:按下单人级别选价,同时绑定完整代理链
   */
  async createOrder(params: {
    user: AppUser;
    lines: OrderLineInput[];
    remark?: string;
  }): Promise<Order> {
    const { user, lines, remark } = params;
    if (!lines.length) throw new Error('订单至少包含 1 项货品');

    const chain = await resolveAgentChain(user);
    const supabase = await getPostgrest();

    const orderItemsPayload = lines.map((l) => {
      const unitPrice = priceForUser(l.item, user);
      return {
        item_id: l.item.id,
        item_name: l.item.name,
        unit: l.item.unit,
        quantity: l.quantity,
        unit_price: unitPrice,
        price_customer_snapshot: Number(l.item.price_customer),
        price_l3_snapshot: Number(l.item.price_l3),
        price_l2_snapshot: Number(l.item.price_l2),
        price_l1_snapshot: Number(l.item.price_l1),
        subtotal: Number((l.quantity * unitPrice).toFixed(2)),
      };
    });

    const total = orderItemsPayload.reduce((s, l) => s + l.subtotal, 0);

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        username: user.username,
        user_level: user.agent_level,
        l1_agent_id: chain.l1_agent_id,
        l2_agent_id: chain.l2_agent_id,
        l3_agent_id: chain.l3_agent_id,
        total_amount: Number(total.toFixed(2)),
        status: 'pending',
        remark: remark ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    const withOrderId = orderItemsPayload.map((li) => ({ ...li, order_id: order.id }));
    const { error: linesError } = await supabase.from('order_items').insert(withOrderId);
    if (linesError) throw linesError;
    return order as Order;
  },

  async listByUser(userId: string): Promise<OrderWithLines[]> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrderWithLines[];
  },

  async listAll(): Promise<OrderWithLines[]> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrderWithLines[];
  },

  /**
   * 团队订单:根据代理级别查对应字段的订单
   */
  async listByAgent(user: AppUser): Promise<OrderWithLines[]> {
    if (user.role !== 'agent' || !user.agent_level) return [];
    const field = user.agent_level === 1 ? 'l1_agent_id' : user.agent_level === 2 ? 'l2_agent_id' : 'l3_agent_id';
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq(field, user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrderWithLines[];
  },

  async markReceived(orderId: string): Promise<Order> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data as Order;
  },

  async markSold(orderId: string, params: { sold_amount: number; sold_buyer?: string }): Promise<Order> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'sold',
        sold_amount: params.sold_amount,
        sold_buyer: params.sold_buyer ?? null,
        sold_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data as Order;
  },

  /**
   * 确认分账:标记该订单已把上级代理差价分出
   */
  async markSplit(orderId: string): Promise<Order> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .update({ split_status: 'split', split_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data as Order;
  },

  /**
   * 仓库库存来源订单:已确认(received/sold)且尚未结算的订单,
   * 确认收货后自动累计进库存,结算清除后不再计入
   */
  async listStockOrders(): Promise<OrderWithLines[]> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', ['received', 'sold'])
      .is('settled_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrderWithLines[];
  },

  /**
   * 一键清除库存:把当前所有在库订单标记为已结算,
   * 之后新确认的订单重新累计
   */
  async settleWarehouse(): Promise<number> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('orders')
      .update({ settled_at: new Date().toISOString() })
      .in('status', ['received', 'sold'])
      .is('settled_at', null)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },
};

/**
 * 计算某订单对目标用户的收益:
 * - customer(下单人):total_amount
 * - L3 参与:Σ (price_l3 - unit_price) × qty
 * - L2 参与:出价 = L3 参与则 price_l3 否则 unit_price; 收益 Σ (price_l2 - 出价) × qty
 * - L1 参与:出价 = L2 参与则 price_l2 否则 L3 参与则 price_l3 否则 unit_price
 */
export function computeIncome(order: OrderWithLines, userId: string): number {
  const items = order.order_items ?? [];
  const isL1 = order.l1_agent_id === userId;
  const isL2 = order.l2_agent_id === userId;
  const isL3 = order.l3_agent_id === userId;
  const isCustomer = order.user_id === userId;

  if (isCustomer) return Number(order.total_amount);

  return items.reduce((sum, li) => {
    const qty = Number(li.quantity);
    const unit = Number(li.unit_price);
    const l1 = Number(li.price_l1_snapshot ?? 0);
    const l2 = Number(li.price_l2_snapshot ?? 0);
    const l3 = Number(li.price_l3_snapshot ?? 0);

    if (isL3) return sum + (l3 - unit) * qty;
    if (isL2) {
      const out = order.l3_agent_id ? l3 : unit;
      return sum + (l2 - out) * qty;
    }
    if (isL1) {
      const out = order.l2_agent_id ? l2 : order.l3_agent_id ? l3 : unit;
      return sum + (l1 - out) * qty;
    }
    return sum;
  }, 0);
}

/** 管理员售出利润 = sold_amount - 进货成本 */
export function computeAdminProfit(order: OrderWithLines): number {
  if (order.status !== 'sold' || order.sold_amount == null) return 0;
  const items = order.order_items ?? [];
  const cost = items.reduce((sum, li) => {
    const qty = Number(li.quantity);
    const l1 = Number(li.price_l1_snapshot ?? 0);
    const unit = Number(li.unit_price);
    // L1 自己下的订单:管理员进价 = unit_price;否则 = l1_snapshot
    const inPrice = order.user_level === 1 ? unit : l1;
    return sum + inPrice * qty;
  }, 0);
  return Number(order.sold_amount) - cost;
}

export interface SplitShare {
  level: 1 | 2 | 3;
  agent_id: string;
  amount: number;
}

/**
 * 计算订单需要分给各级上线代理的金额(差价分账):
 * - L3:Σ (price_l3 - 下单价) × qty
 * - L2:Σ (price_l2 - (有L3则 price_l3 否则下单价)) × qty
 * - L1:Σ (price_l1 - (有L2则 price_l2,有L3则 price_l3,否则下单价)) × qty
 */
export function computeSplitShares(order: OrderWithLines): SplitShare[] {
  const shares: SplitShare[] = [];
  if (order.l3_agent_id) {
    shares.push({ level: 3, agent_id: order.l3_agent_id, amount: computeIncome(order, order.l3_agent_id) });
  }
  if (order.l2_agent_id) {
    shares.push({ level: 2, agent_id: order.l2_agent_id, amount: computeIncome(order, order.l2_agent_id) });
  }
  if (order.l1_agent_id) {
    shares.push({ level: 1, agent_id: order.l1_agent_id, amount: computeIncome(order, order.l1_agent_id) });
  }
  return shares;
}
