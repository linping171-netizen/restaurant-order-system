## Toshio Restaurant 扫码点菜系统

Vue 3 + Vite + TypeScript 客人点餐与店员后台；Express + TypeScript API。默认本地模式使用 JSON；设置 Supabase/PostgreSQL 环境变量后，菜单和订单改用 PostgreSQL，图片上传到 Supabase Storage。

### 目录
`frontend/` Vue 客户端；`backend/` API 与上传服务；`data/products.json` 菜单；`data/orders.json` 订单；`data/stores.json` 多店面设置；`backend/uploads/` 图片。

### 环境与启动
需要 Node.js 20+。根目录执行 `npm install`，然后 `npm install --prefix backend` 和 `npm install --prefix frontend`。复制 `backend/.env.example` 为 `.env`（默认 PORT=3000）；前端 `.env` 已配置 API 地址，也可复制 `.env.example`。

分别启动：`cd backend && npm run dev`；`cd frontend && npm run dev`。或根目录 `npm run dev` 同时启动。API 为 `http://localhost:3000/api`，客人页面 `http://localhost:5173/guest`，后台登录 `http://localhost:5173/admin/login`。使用后台前先在 `backend` 目录运行 `npm run setup:admin`，在交互提示中设置至少 12 位密码；密码仅保存为 bcrypt 哈希，随机会话密钥保存于 `backend/.env`。连接 Supabase 前先执行 `backend/migrations/001_initial.sql` 并配置 `backend/.env`；然后运行 `npm run migrate:json --prefix backend` 导入现有 JSON 和上传图片。

### 使用
在后台菜单管理中新增或编辑菜品、设置分类/价格/状态/排序；编辑时可选照片上传（JPG、PNG、WebP，5MB 内）。后台“店面管理”可编辑店名、欢迎语、公告、营业状态、地址和电话；暂停营业时禁止提交订单。删除店铺需要二次确认；有历史订单的店铺不能删除，系统至少保留一个店铺。客人端仅显示上架菜品。桌号填写后提交订单，服务端重新读取现价计算并保存商品名称、价格、数量和小计快照。客人可在本设备订单历史中查看自己提交的订单，历史访问凭证单独授权到对应订单；后台首页支持创建和切换多个店面，菜单、订单和营业设置按店面隔离。后台订单每 5 秒轮询，可更新状态。

### 管理员认证与安全
后台页面通过 `/admin/login` 登录。密码以 bcrypt 哈希保存在仅限本机的 `backend/.env`；JWT 会话使用 HttpOnly Cookie，开发环境使用 SameSite=Lax，生产环境使用 Secure + SameSite=None，并启用受信代理设置。生产部署时请将 `CORS_ORIGINS` 配置为准确的 HTTPS 前端域名。登录接口限制尝试频率，后台写操作同时校验来源。后台 API 未登录时返回 401。客人只能读取上架菜单、提交订单及凭订单访问凭证查看自己的历史订单；订单列表、单笔后台查询、状态修改和菜单修改均需管理员会话。

`.env` 与 `.env.*` 均被 Git 排除，只有 `.env.example` 可以提交。Supabase Service Role / Secret Key 只能放在 `backend/.env`，不能放入前端环境变量或代码。认证配置缺失时先运行 `cd backend` 后执行 `npm run setup:admin`。
运行中的 `data/orders.json` 不提交；仓库只包含空白模板 `data/orders.example.json`，本地订单文件仍保留在工作目录。

### API
`GET/PUT /api/store`；`GET/POST/DELETE /api/stores`；客人用 `GET /api/products` 读取上架菜单；管理员用 `GET /api/products?includeInactive=1` 查询全部菜单及新增、编辑、删除、上传照片 API；客人用 `POST /api/orders` 下单，后台订单查询与状态更新 API 需要管理员认证，客人订单历史用带订单访问凭证的 `GET /api/guest/orders/:id`。认证 API 为 `POST /api/auth/login`、`GET /api/auth/session`、`POST /api/auth/logout`。返回 `{data: ...}` 或 `{error:{message}}`。

### 云迁移规划

数据库表结构、推荐的 Cloudflare Pages + Render + Supabase 部署方式和上线前检查清单见 [`deployment/README.md`](deployment/README.md)。本次只完成部署前代码安全准备；没有创建云服务或发布公网。




