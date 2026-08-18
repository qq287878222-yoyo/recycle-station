// ================== 用户 ==================
export type UserRole = 'admin' | 'agent' | 'customer';

// agent_level: 0=admin, 1/2/3=agent, null=普通客户
export type AgentLevel = 0 | 1 | 2 | 3 | null;

export interface AppUser {
  id: string;
  username: string;
  password_hash: string;
  phone: string | null;
  role: UserRole;
  agent_level: AgentLevel;
  parent_id: string | null;
  created_at: string;
}

// ================== 分类 ==================
export interface Category {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  created_at: string;
}

// ================== 物品 ==================
export interface RecycleItem {
  id: string;
  name: string;
  image_url: string | null;
  category_id: string | null;
  price_customer: number;
  price_l3: number;
  price_l2: number;
  price_l1: number;
  unit: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  // join 出来的分类信息
  categories?: Pick<Category, 'id' | 'name'> | null;
}

export type RecycleItemInsert = Omit<RecycleItem, 'id' | 'created_at' | 'updated_at' | 'categories'>;

// 根据用户级别取物品的价格(下单价 / 显示价)
export function priceForUser(
  item: RecycleItem,
  user: Pick<AppUser, 'role' | 'agent_level'> | null
): number {
  if (!user || user.role === 'customer') return Number(item.price_customer);
  if (user.role === 'admin') return Number(item.price_l1);
  switch (user.agent_level) {
    case 1: return Number(item.price_l1);
    case 2: return Number(item.price_l2);
    case 3: return Number(item.price_l3);
    default: return Number(item.price_customer);
  }
}

// ================== 订单 ==================
export type OrderStatus = 'pending' | 'received' | 'sold';

export interface Order {
  id: string;
  user_id: string;
  username: string;
  user_level: number | null;
  l1_agent_id: string | null;
  l2_agent_id: string | null;
  l3_agent_id: string | null;
  total_amount: number;
  status: OrderStatus;
  received_at: string | null;
  sold_amount: number | null;
  sold_buyer: string | null;
  sold_at: string | null;
  remark: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  item_name: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  price_customer_snapshot: number | null;
  price_l3_snapshot: number | null;
  price_l2_snapshot: number | null;
  price_l1_snapshot: number | null;
  subtotal: number;
}
