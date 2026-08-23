-- ============================================
-- Recycle Station V6 - 手工单标识 + 配送方式 + 快递单号 增量迁移
--
-- 新增能力:
-- 1. 管理员手工创建的订单带 is_manual 标记,订单列表展示"手工"标识
-- 2. 下单时选择配送方式:送货上门(door) / 快递寄送(express)
-- 3. 快递寄送的订单记录快递单号,管理员可按快递单号搜索
--
-- 使用方式:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. 粘贴本文件全部内容 → Run
-- 3. 本脚本为增量 ALTER,不会删除已有数据
-- ============================================

-- 是否管理员手工单:存量订单默认 false
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- 配送方式:'door'=送货上门 'express'=快递寄送;存量订单为 NULL 视为送货上门
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IS NULL OR delivery_method IN ('door', 'express'));

-- 快递单号(快递寄送时填写)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
