import { getPostgrest } from '../utils/supabase';
import bcrypt from 'bcryptjs';
import type { AppUser, AgentLevel } from '../types/database';

const CURRENT_USER_KEY = 'current_user';

// bcrypt 哈希前缀,用于识别新格式密码(历史数据曾明文存储)
const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];
export const isBcryptHash = (hash: string): boolean =>
  BCRYPT_PREFIXES.some((p) => hash.startsWith(p));

// 密码使用 bcrypt 加盐哈希存储(兼容浏览器端,内置自动加盐)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 校验密码:新格式走 bcrypt 比对,存量明文数据做兼容校验(登录后自动升级)
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) return bcrypt.compare(password, storedHash);
  return storedHash === password;
}

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
        password_hash: await hashPassword(password),
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
    const user = data as AppUser;
    if (!(await verifyPassword(password, user.password_hash))) throw new Error('密码错误');
    // 存量明文密码:验证通过后静默升级为 bcrypt 哈希
    if (!isBcryptHash(user.password_hash)) {
      try {
        const upgraded = await hashPassword(password);
        await supabase.from('app_users').update({ password_hash: upgraded }).eq('id', user.id);
        user.password_hash = upgraded;
      } catch { /* 升级失败不阻断登录 */ }
    }
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

  /**
   * 更新当前用户资料(电话/微信号/收款码),同步刷新本地登录态缓存
   */
  async updateProfile(
    userId: string,
    updates: Pick<AppUser, 'phone' | 'wechat' | 'wechat_qrcode' | 'alipay_qrcode'>
  ): Promise<AppUser> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    const user = data as AppUser;
    // 若更新的是当前登录用户,同步本地缓存,保证页面立即生效
    const current = authService.getCurrentUser();
    if (current?.id === user.id) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    return user;
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
