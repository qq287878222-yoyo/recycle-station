-- ============================================
-- Recycle Station V4 - 用户联系与收款信息增量迁移
--
-- 新增能力:代理/客户维护微信号、微信收款码、支付宝收款码,
-- 管理员在订单管理中可查看下单人的这些信息。
--
-- 使用方式:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. 粘贴本文件全部内容 → Run
-- 3. 本脚本为增量 ALTER,不会删除已有数据
-- ============================================

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS wechat        VARCHAR(64);   -- 微信号
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS wechat_qrcode TEXT;          -- 微信收款码(图片,演示环境存 base64)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS alipay_qrcode TEXT;          -- 支付宝收款码(图片,演示环境存 base64)
