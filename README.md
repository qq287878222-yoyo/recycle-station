# Recycle Station 回收站

一个基于 React + TypeScript + Vite + Supabase 的回收物品管理演示项目。

- **客户端**:注册/登录、浏览可回收货品、按模板下单(实时计算总金额)、查看订单
- **管理端**:物品目录 CRUD、Excel 批量导入、订单管理与确认收货打款、数据统计看板

## 技术栈

- React 19 + TypeScript + Vite
- Ant Design 5
- React Router v6
- Recharts(图表)
- xlsx(Excel 导入)
- Supabase(PostgreSQL + REST + RLS)

## 快速开始

### 1. 创建 Supabase 云项目

打开 https://supabase.com,创建新项目,进入 **SQL Editor**,粘贴 `.specs/supabase-schema.sql` 全部内容,点 **Run**。

进入 **Project Settings → API**,记下:
- Project URL
- anon / publishable key

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

### 3. 本地运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

默认管理员账号:`admin` / `admin123`

### 4. 部署到 Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

也可以推到 GitHub 后从 Vercel 控制台 Import。**记得在 Vercel 环境变量里配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。**

详细部署步骤见 `.specs/DEPLOY.md`。

## 目录结构

```
src/
├── main.tsx                 入口
├── App.tsx                  路由
├── utils/supabase.ts        Supabase 客户端
├── types/database.ts        表结构类型
├── services/                数据访问层
│   ├── authService.ts
│   ├── itemService.ts
│   └── orderService.ts
├── components/RequireAuth.tsx
├── layouts/
│   ├── CustomerLayout.tsx
│   └── AdminLayout.tsx
└── pages/
    ├── Login.tsx / Register.tsx
    ├── customer/            客户端页面
    └── admin/               管理端页面
```

## 注意事项

- 演示用途,密码明文存储。生产使用请改用 Supabase Auth 或至少 bcrypt 哈希
- 当前 RLS 策略为「允许所有操作」,生产环境必须改为基于 `auth.uid()` 的严格策略
- Supabase 免费计划有 500 MB 数据库、5 GB 出站流量限制
