import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    '缺少 Supabase 环境变量: 请在 .env.local (本地开发) 或 Vercel 项目设置中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
  },
});

// 兼容旧调用签名: services 层用 await getPostgrest() 拿实例
export const getPostgrest = async (): Promise<SupabaseClient> => supabase;
