# 部署到 Vercel + Supabase 云版

## 一、创建 Supabase 云项目(免费额度)

1. 打开 https://supabase.com,用 GitHub 登录
2. New Project → 填名称(如 `recycle-station`)、数据库密码、区域(推荐 Singapore/Tokyo)
3. 等待项目创建完成(约 2 分钟)
4. 左侧菜单 **SQL Editor** → New Query
5. 打开本项目 `.specs/supabase-schema.sql`,**复制全部内容** → 粘贴 → 点 **Run**
6. 左侧菜单 **Table Editor**,应能看到 4 张表:`app_users` / `recycle_items` / `orders` / `order_items`
7. 左侧菜单 **Project Settings → API**,记下:
   - **Project URL** (形如 `https://abcxyz.supabase.co`)
   - **anon public key** (`eyJhbGciOi...`)

## 二、本地跑起来(可选)

```bash
# 1. 复制环境变量模板
cp .env.example .env.local

# 2. 编辑 .env.local,填入上一步拿到的 URL 和 anon key
# VITE_SUPABASE_URL=https://abcxyz.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# 3. 安装依赖并启动
npm i --yes --legacy-peer-deps
npm run dev
```

浏览器打开 http://localhost:3000

默认管理员账号:`admin` / `admin123`

## 三、部署到 Vercel

### 方法 A:GitHub → Vercel(推荐)

1. 把代码推到 GitHub(公开或私有仓库都可以)
2. 打开 https://vercel.com,用 GitHub 登录
3. **New Project** → 选择刚才的 GitHub 仓库 → Import
4. 展开 **Environment Variables**,加两个变量:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://abcxyz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
5. 点 **Deploy**,等待 1-2 分钟

部署成功后 Vercel 会自动分配一个 `xxx.vercel.app` 域名,支持公网访问。

### 方法 B:Vercel CLI

```bash
npm i -g vercel
vercel login
vercel                     # 首次部署,交互式配置
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod              # 正式部署
```

## 四、自定义域名(可选)

Vercel 控制台 → 项目 → Settings → Domains → Add,按引导配置 DNS 即可。

## 五、注意事项

1. **anon key 可以暴露给前端**——它是公钥,配合 Supabase 的 RLS(行级安全)保证数据安全
2. 当前 SQL 脚本的 RLS 策略是「允许所有操作」,只适合演示。**生产环境**必须改成基于 `auth.uid()` 的严格策略,并把认证改用 Supabase Auth
3. 密码目前是明文存储(为演示简化)。生产上必须换成 Supabase Auth 或至少 bcrypt 哈希
4. Supabase 免费计划:500 MB 数据库、2 GB 出站流量、50 K 月活用户,小规模够用
