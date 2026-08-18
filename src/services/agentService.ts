import { getPostgrest } from '../utils/supabase';
import { hashPassword } from './authService';
import type { AppUser } from '../types/database';

export const agentService = {
  async listAll(): Promise<AppUser[]> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('agent_level', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AppUser[];
  },

  async createLevel1(params: { username: string; password: string; phone?: string; adminId: string }): Promise<AppUser> {
    const supabase = await getPostgrest();
    const { data: existing } = await supabase.from('app_users').select('id').eq('username', params.username).maybeSingle();
    if (existing) throw new Error('用户名已被占用');
    const { data, error } = await supabase
      .from('app_users')
      .insert({
        username: params.username,
        password_hash: hashPassword(params.password),
        phone: params.phone ?? null,
        role: 'agent',
        agent_level: 1,
        parent_id: params.adminId,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AppUser;
  },
};
