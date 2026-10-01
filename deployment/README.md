# 云部署准备

## 当前状态与推荐拓扑

服务端现在支持双模式：未设置 `DATABASE_URL` 时使用现有 JSON 和本地上传；设置 `DATABASE_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 后，菜单和订单走 PostgreSQL，图片经 Supabase Storage 上传。数据库模式要求先执行 `backend/migrations/001_initial.sql` 并建立 `product-images` bucket；一次性迁移执行 `npm run migrate:json --prefix backend`。这些云端连接变量尚未写入本机 `.env`，因此迁移和数据库模式验证仍待完成。保留 JSON 文件可作为手动回退副本。

建议：Vue/Vite 前端部署 Cloudflare Pages；Express API 部署 Render Web Service；Supabase 托管 PostgreSQL 与 Storage。以上组合可让手机在电脑关机时访问。Render 免费实例可能休眠，首次访问会较慢；正式营业建议选择常驻实例，并为 Supabase 配置备份。根目录 `render.yaml` 已准备好 Render Blueprint；Cloudflare Pages 构建时使用 `frontend` 目录、`npm ci && npm run build`、输出 `dist`，并设置 `VITE_API_BASE_URL`。`frontend/public/_redirects` 已为 Vue Router 路由提供回退。

## 数据库

在 Supabase 项目的 SQL Editor 执行 `backend/migrations/001_initial.sql`。关系包括 stores、categories、products、orders、order_items。订单行保留 `product_name` 和 `unit_price` 快照，即使以后改菜名、改价或删除菜品，历史账单仍可还原。不要把 Supabase service-role key 放进前端。JSON 导入脚本现已提供，会按事务导入数据并幂等 upsert；重跑会更新这些 JSON 导入过的记录。

迁移前备份 `data/products.json`、`data/orders.json`、`data/stores.json`。当前样本里的某个旧订单缺少 `storeId`，导入时应补为 `store-1`。包含 `/uploads/...` 的图片需要先转存到 Storage，再把公开 URL 写回产品记录。不要重复导入；应使用事务型导入脚本并核对行数与金额。

## 图片存储

在 Supabase Storage 建立 `product-images` bucket。部署适配器应使用后端 service-role key 上传，限制 JPG/PNG/WebP 且最大 5 MB，保存对象路径/公开 URL 到 `products.image`；前端使用返回 URL。Storage 的 service key 仅放 Render 环境变量。原有本地上传照片需从 `backend/uploads` 单独迁移，云端 API 不应继续依赖这个目录。

## 服务配置

Render 根目录设为 `backend`，Build 命令 `npm ci && npm run build`，Start 命令 `npm start`，健康检查路径 `/api/health`。配置：

- `NODE_ENV=production`
- `DATABASE_URL`（Postgres 连接串，优先 Supabase pooler 的 transaction/session 连接方式与目标服务匹配）
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or the older `SUPABASE_SERVICE_ROLE_KEY` name)
- `CORS_ORIGINS=https://<Cloudflare Pages 域名>`（多个来源用逗号分隔）
- `PORT` 由 Render 注入

Cloudflare Pages 项目根目录为 `frontend`，构建命令 `npm ci && npm run build`，输出目录 `dist`。设 `VITE_API_BASE_URL=https://<Render 服务域名>/api`。若使用自定义域名，CORS 来源必须是浏览器实际访问的完整 origin（含协议，不含路径）。Vite 环境变量在构建时写入静态文件，改值后需重新部署。

## 上线前必须完成

1. 将 Express 的 JSON Repository 改成 PostgreSQL Repository；`POST /api/orders` 在事务里按数据库商品当前价格重算明细和总额，忽略客户端 `total`，再写 `orders` 与 `order_items`。
2. 完成 JSON 一次性导入，验证订单数、商品数、订单总额和历史快照。
3. 将 Multer 磁盘存储换为 Supabase Storage。
4. CORS 从固定 localhost 改为 `CORS_ORIGINS` 白名单；生产必须使用 HTTPS。
5. 后台目前没有认证，订单读写、商品维护和店面设置接口均可被访问。部署前必须增加管理员认证和 API 限流；否则不要把管理 URL 对公网开放。
6. 在本地设置 `DATABASE_URL` / Storage 凭据后，运行 schema 与导入，启动后端和前端，验证健康检查、菜单、上传、下单（篡改客户端 total 仍返回按数据库价格计算的值）、改订单状态、重启后数据仍存在。再用 Render preview URL 与 Pages preview URL 验证手机浏览器访问。

切换时保留 JSON 备份及旧启动方式，先用测试店面完成验收，再导入正式数据并更新前端 API URL。电脑关机不会影响已部署的 Render、Supabase 和 Pages 服务。
