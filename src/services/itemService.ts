import { getPostgrest } from '../utils/supabase';
import type { RecycleItem, RecycleItemInsert } from '../types/database';

const SELECT_WITH_CATEGORY = '*, categories:category_id(id, name)';

export const itemService = {
  async list(includeInactive = false): Promise<RecycleItem[]> {
    const supabase = await getPostgrest();
    let query = supabase
      .from('recycle_items')
      .select(SELECT_WITH_CATEGORY)
      .order('created_at', { ascending: false });
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as RecycleItem[];
  },

  async create(record: Partial<RecycleItemInsert>): Promise<RecycleItem> {
    const supabase = await getPostgrest();
    const { data, error } = await supabase.from('recycle_items').insert(record).select().single();
    if (error) throw error;
    return data as RecycleItem;
  },

  async update(id: string, updates: Partial<RecycleItem>): Promise<RecycleItem> {
    const supabase = await getPostgrest();
    // 剔除 categories 关联字段,避免误写
    const { categories: _drop, ...rest } = updates;
    void _drop;
    const { data, error } = await supabase
      .from('recycle_items')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as RecycleItem;
  },

  async remove(id: string): Promise<void> {
    const supabase = await getPostgrest();
    const { error } = await supabase.from('recycle_items').delete().eq('id', id);
    if (error) throw error;
  },

  async batchCreate(records: Partial<RecycleItemInsert>[]): Promise<number> {
    if (!records.length) return 0;
    const supabase = await getPostgrest();
    const { data, error } = await supabase.from('recycle_items').insert(records).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },
};
