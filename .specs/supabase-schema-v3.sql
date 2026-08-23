-- ============================================
-- Recycle Station V3 - 订单分账字段增量迁移
--
-- 新增能力:管理员在订单管理中确认"分账",
-- 记录订单是否已把上级代理差价分出。
--
-- 使用方式:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. 粘贴本文件全部内容 → Run
-- 3. 本脚本为增量 ALTER,不会删除已有数据
-- ============================================

-- 订单分账状态: unsplit(未分账) / split(已分账)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_status VARCHAR(20) DEFAULT 'unsplit' NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_split_status ON orders(split_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at);
