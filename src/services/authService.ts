import { getPostgrest } from '../utils/supabase';
import type { AppUser, AgentLevel } from '../types/database';

const CURRENT_USER_KEY = 'current_user';

// 简易的密码哈希 (仅演示,生产应使用 bcrypt/argon2)
export const hashPassword = (password: string): string => password;

/**
 * 根据邀请人级别推导新用户级别
 * 管理员邀请  → L1 (agent)
 * L1 邀请    → L2 (agent)
 * L2 邀请    → L3 (agent)
 * L3 邀请    → customer
 * customer  → 不能邀请
 */
function deriveNewUserLevel(inviter: Pick<AppUser, 'role' | 'agent_level'>): {
  role: 'agent' | 'customer';
  agent_level: AgentLevel;
} {
  if (inviter.role === 'admin') return { role: 'agent', agent_level: 1 };
  if (inviter.role === 'agent') {
    switch (inviter.agent_level) {
      case 1: return { role: 'agent', agent_level: 2 };
      case 2: return { role: 'agent', agent_level: 3 };
      case 3: return { role: 'customer', agent_level: null };
      default: throw new Error('邀请人级别异常');
    }
  }
  throw new Error('该邀请人无邀请权限');
}

export const authService = {
  async register(params: {
    username: string;
    password: string;
    phone: string;
    inviteCode: string; // 邀请人的 username
  }): Promise<AppUser> {
    const { username, password, phone, inviteCode } = params;
    const supabase = await getPostgrest();

    if (!inviteCode?.trim()) throw new Error('必须填写邀请码');

    const { data: existing } = await supabase
      .from('app_users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (existing) throw new Error('用户名已被占用');

    const { data: inviter } = await supabase
      .from('app_users')
      .select('id, role, agent_level, username')
      .eq('username', inviteCode.trim())
      .maybeSingle();
    if (!inviter) throw new Error('邀请码无效,请确认邀请人用户名');

    const { role, agent_level } = deriveNewUserLevel(inviter as AppUser);

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username,
        password_hash: hashPassword(password),
        phone,
        role,
        agent_level,
        parent_id: inviter.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AppUser;
  },

  async login(username: string, password: string): Promise<AppUser> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('用户不存在');
    if (data.password_hash !== hashPassword(password)) throw new Error('密码错误');
    const user = data as AppUser;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  },

  logout(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser(): AppUser | null {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  },
};

/**
 * 解析下单人的代理上线链
 * - customer 下单 → { l1, l2, l3 } 都填(l3 是直接邀请他的三级代理)
 * - L3 下单       → { l1, l2, l3: null }
 * - L2 下单       → { l1, l2: null, l3: null }
 * - L1 下单       → 全为 null(直接归管理员)
 */
export async function resolveAgentChain(user: Pick<AppUser, 'id' | 'role' | 'agent_level'>): Promise<{
  l1_agent_id: string | null;
  l2_agent_id: string | null;
  l3_agent_id: string | null;
}> {
  if (user.role === 'admin') {
    return { l1_agent_id: null, l2_agent_id: null, l3_agent_id: null };
  }
  const supabase = await getPostgrest();
  // 从当前用户向上追溯,收集直接祖先(不含自己),遇到 admin 停止
  const ancestors: Pick<AppUser, 'id' | 'agent_level' | 'role' | 'parent_id'>[] = [];
  let currentId: string | null = user.id;
  for (let hop = 0; hop < 5 && currentId; hop++) {
    const { data }: { data: { id: string; agent_level: number | null; role: string; parent_id: string | null } | null } =
      await supabase
        .from('app_users')
        .select('id, agent_level, role, parent_id')
        .eq('id', currentId)
        .maybeSingle();
    if (!data) break;
    if (hop > 0) {
      if (data.role === 'admin') break;
      ancestors.push(data as never);
    }
    currentId = data.parent_id;
  }
  // ancestors 从直接上线开始,依次向上
  // agent_level: L3(3) → L2(2) → L1(1) 依次
  const map = new Map<number, string>();
  for (const a of ancestors) {
    if (a.agent_level && a.agent_level >= 1 && a.agent_level <= 3) {
      map.set(a.agent_level, a.id);
    }
  }
  return {
    l1_agent_id: map.get(1) ?? null,
    l2_agent_id: map.get(2) ?? null,
    l3_agent_id: map.get(3) ?? null,
  };
}
