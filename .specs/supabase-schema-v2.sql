-- ============================================
-- Recycle Station V2 - Supabase 云版初始化脚本
-- 结构变更:分级代理 + 分类表 + 4 档价格 + 售卖流程
--
-- 使用方式:
-- 1. 在 https://supabase.com 创建项目
-- 2. Dashboard → SQL Editor → New query
-- 3. 粘贴本文件全部内容 → Run
-- 4. 提示 Success. No rows returned 即为成功
-- ⚠️ 注意:本脚本会 DROP 已存在的表并重建,若已有生产数据请先备份
-- ============================================

DROP TABLE IF EXISTS order_items   CASCADE;
DROP TABLE IF EXISTS orders        CASCADE;
DROP TABLE IF EXISTS recycle_items CASCADE;
DROP TABLE IF EXISTS categories    CASCADE;
DROP TABLE IF EXISTS app_users     CASCADE;

-- 1. 用户表(新增 agent_level / parent_id)
CREATE TABLE app_users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20) DEFAULT 'customer' NOT NULL,   -- admin / agent / customer
  agent_level   INT,                                       -- 0=admin, 1/2/3=agent, NULL=customer
  parent_id     UUID,                                      -- 直接邀请人 (软引用,不加 FK 避免删用户时级联)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_parent ON app_users(parent_id);
CREATE INDEX idx_users_role   ON app_users(role);

-- 2. 分类表
CREATE TABLE categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       VARCHAR(64) UNIQUE NOT NULL,
  sort       INT DEFAULT 0,
  active     BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 回收物品(分类 FK + 4 档价格)
CREATE TABLE recycle_items (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name           VARCHAR(128) NOT NULL,
  image_url      TEXT,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_customer NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 客户下单价 (最低)
  price_l3       NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 三级代理下单价
  price_l2       NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 二级代理下单价
  price_l1       NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 一级代理下单价 (最高)
  unit           VARCHAR(20) DEFAULT 'kg' NOT NULL,
  description    TEXT,
  active         BOOLEAN DEFAULT TRUE NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_items_category ON recycle_items(category_id);

-- 4. 订单主表(代理链 + 售卖字段)
CREATE TABLE orders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,
  username     VARCHAR(64) NOT NULL,
  user_level   INT,                              -- 下单人级别快照 NULL=customer, 1/2/3=agent
  l1_agent_id  UUID,                             -- 上线链: 一级代理
  l2_agent_id  UUID,                             --         二级代理
  l3_agent_id  UUID,                             --         三级代理 (直接上线, 客户下单时非空)
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,-- 下单人应得金额 (= Σ 下单价 × qty)
  status       VARCHAR(20) DEFAULT 'pending' NOT NULL,  -- pending / received / sold
  received_at  TIMESTAMPTZ,
  sold_amount  NUMERIC(10, 2),
  sold_buyer   VARCHAR(128),
  sold_at      TIMESTAMPTZ,
  remark       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_l1      ON orders(l1_agent_id);
CREATE INDEX idx_orders_l2      ON orders(l2_agent_id);
CREATE INDEX idx_orders_l3      ON orders(l3_agent_id);
CREATE INDEX idx_orders_status  ON orders(status);

-- 5. 订单明细(下单价 + 4 档价快照)
CREATE TABLE order_items (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id                 UUID NOT NULL,
  item_name               VARCHAR(128) NOT NULL,
  unit                    VARCHAR(20),
  quantity                NUMERIC(10, 2) NOT NULL,
  unit_price              NUMERIC(10, 2) NOT NULL,           -- 下单价 (与 user_level 对应)
  price_customer_snapshot NUMERIC(10, 2),
  price_l3_snapshot       NUMERIC(10, 2),
  price_l2_snapshot       NUMERIC(10, 2),
  price_l1_snapshot       NUMERIC(10, 2),
  subtotal                NUMERIC(10, 2) NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- RLS(演示阶段允许所有操作)
-- ============================================
ALTER TABLE app_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_all     ON app_users     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY categories_all    ON categories    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY recycle_items_all ON recycle_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY orders_all        ON orders        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY order_items_all   ON order_items   FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 种子数据
-- ============================================

-- 管理员
INSERT INTO app_users (username, password_hash, phone, role, agent_level)
VALUES ('admin', 'admin123', '13800000000', 'admin', 0);

-- 分类
INSERT INTO categories (name, sort) VALUES
  ('纸类', 1),
  ('塑料', 2),
  ('金属', 3),
  ('纺织', 4),
  ('电器', 5);

-- 物品
INSERT INTO recycle_items (name, image_url, category_id, price_customer, price_l3, price_l2, price_l1, unit, description) VALUES
  ('废纸箱',   'https://img.icons8.com/color/96/000000/cardboard-box.png',    (SELECT id FROM categories WHERE name='纸类'),  1.20, 1.35, 1.55,  1.80, 'kg', '干燥无污染的废纸箱'),
  ('塑料瓶',   'https://img.icons8.com/color/96/000000/plastic-bottle.png',   (SELECT id FROM categories WHERE name='塑料'),  0.80, 0.95, 1.15,  1.40, 'kg', '饮料瓶等塑料容器'),
  ('易拉罐',   'https://img.icons8.com/color/96/000000/canned-food.png',      (SELECT id FROM categories WHERE name='金属'),  6.00, 6.80, 7.60,  8.50, 'kg', '铝制易拉罐'),
  ('废旧衣物', 'https://img.icons8.com/color/96/000000/shirt.png',            (SELECT id FROM categories WHERE name='纺织'),  0.50, 0.60, 0.75,  0.90, 'kg', '干净的旧衣物'),
  ('废旧家电', 'https://img.icons8.com/color/96/000000/electronics.png',     (SELECT id FROM categories WHERE name='电器'), 20.00,23.00,27.00, 32.00, '台', '小家电,包括电视、微波炉等');
