-- ============================================
-- Recycle Station - Supabase 云版初始化脚本
-- 使用方式:
-- 1. 在 https://supabase.com 创建项目
-- 2. 打开 SQL Editor,粘贴本文件全部内容
-- 3. 点击 Run 执行(执行一次即可)
-- ============================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20) DEFAULT 'customer' NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 回收物品目录
CREATE TABLE IF NOT EXISTS recycle_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(128) NOT NULL,
  image_url   TEXT,
  unit_price  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit        VARCHAR(20) DEFAULT 'kg' NOT NULL,
  category    VARCHAR(64),
  description TEXT,
  active      BOOLEAN DEFAULT TRUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,
  username     VARCHAR(64) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending' NOT NULL,  -- pending / paid
  remark       TEXT,
  paid_amount  NUMERIC(10, 2),
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 订单明细
CREATE TABLE IF NOT EXISTS order_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL,
  item_name  VARCHAR(128) NOT NULL,
  unit       VARCHAR(20),
  quantity   NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal   NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- Row Level Security
-- ============================================
-- 演示项目使用 anon key 直连,允许所有操作
-- 生产环境请改为 auth.uid() 相关的严格策略

ALTER TABLE app_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_users_all       ON app_users;
DROP POLICY IF EXISTS recycle_items_all   ON recycle_items;
DROP POLICY IF EXISTS orders_all          ON orders;
DROP POLICY IF EXISTS order_items_all     ON order_items;

CREATE POLICY app_users_all       ON app_users     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY recycle_items_all   ON recycle_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY orders_all          ON orders        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY order_items_all     ON order_items   FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 种子数据: 默认管理员 + 示例物品
-- ============================================

INSERT INTO app_users (username, password_hash, phone, role)
VALUES ('admin', 'admin123', '13800000000', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO recycle_items (name, image_url, unit_price, unit, category, description) VALUES
  ('废纸箱',   'https://img.icons8.com/color/96/000000/cardboard-box.png',      1.20, 'kg', '纸类',   '干燥无污染的废纸箱'),
  ('塑料瓶',   'https://img.icons8.com/color/96/000000/plastic-bottle.png',     0.80, 'kg', '塑料',   '饮料瓶等塑料容器'),
  ('易拉罐',   'https://img.icons8.com/color/96/000000/canned-food.png',        6.00, 'kg', '金属',   '铝制易拉罐'),
  ('废旧衣物', 'https://img.icons8.com/color/96/000000/shirt.png',              0.50, 'kg', '纺织',   '干净的旧衣物'),
  ('废旧家电', 'https://img.icons8.com/color/96/000000/electronics.png',       20.00, '台', '电器',   '小家电,包括电视、微波炉等')
ON CONFLICT DO NOTHING;
