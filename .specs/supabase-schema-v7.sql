-- ============================================
-- Recycle Station V7 - 图片上传存储桶 增量迁移
--
-- 新增能力:物品目录的图片改为直接上传文件,
-- 存到 Supabase Storage 的公共桶 item-images
--
-- 使用方式:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. 粘贴本文件全部内容 → Run
-- ============================================

-- 创建公共存储桶(已存在则跳过)
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- 桶级策略(新版 Supabase 用 buckets 表的 RLS)
DROP POLICY IF EXISTS item_images_bucket_read   ON storage.buckets;
DROP POLICY IF EXISTS item_images_bucket_insert ON storage.buckets;
DROP POLICY IF EXISTS item_images_bucket_update ON storage.buckets;
DROP POLICY IF EXISTS item_images_bucket_delete ON storage.buckets;

CREATE POLICY item_images_bucket_read   ON storage.buckets FOR SELECT USING (id = 'item-images');
CREATE POLICY item_images_bucket_insert ON storage.buckets FOR INSERT WITH CHECK (id = 'item-images');
CREATE POLICY item_images_bucket_update ON storage.buckets FOR UPDATE USING (id = 'item-images');
CREATE POLICY item_images_bucket_delete ON storage.buckets FOR DELETE USING (id = 'item-images');

-- 对象级策略:公开可读,允许上传/覆盖/删除
DROP POLICY IF EXISTS item_images_public_read ON storage.objects;
DROP POLICY IF EXISTS item_images_upload      ON storage.objects;
DROP POLICY IF EXISTS item_images_delete      ON storage.objects;

CREATE POLICY item_images_public_read ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
CREATE POLICY item_images_upload      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item-images');
CREATE POLICY item_images_delete      ON storage.objects FOR DELETE USING (bucket_id = 'item-images');
