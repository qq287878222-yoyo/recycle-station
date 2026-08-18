import { getPostgrest } from '../utils/supabase';
import type { Category } from '../types/database';

export const categoryService = {
  async list(includeInactive = false): Promise<Category[]> {
    const supabase = await getPostgrest();
    let query = supabase.from('categories').select('*').order('sort').order('created_at');
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Category[];
  },

  async create(record: { name: string; sort?: number; active?: boolean }): Promise<Category> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase.from('categories').insert(record).select().single();
    if (error) throw error;
    return data as Category;
  },

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Category;
  },

  async remove(id: string): Promise<void> {
    const supabase = await getPostgrest();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },
};
