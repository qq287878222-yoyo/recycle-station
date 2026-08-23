-- ============================================
-- Recycle Station V5 - 仓库库存结算增量迁移
--
-- 新增能力:管理员确认收货的订单自动累计进仓库库存,
-- 导出清单后一键清除库存(标记已结算),新确认订单重新累计。
--
-- 使用方式:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. 粘贴本文件全部内容 → Run
-- 3. 本脚本为增量 ALTER,不会删除已有数据
-- ============================================

-- 订单结算时间:NULL 表示尚未结算(仍在仓库库存统计内)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_settled_at ON orders(settled_at);
