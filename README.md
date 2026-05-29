# 明日方舟公招统计

多用户 Web 应用，用于记录和统计《明日方舟》公开招募的星级与干员分布。

部署于 [ark.lockhart.ren](https://ark.lockhart.ren)，与以下姊妹项目配合使用：

- [my-landing](https://github.com/LockhartANR/my-landing) — 网站首页，导航入口
- 博客（待建） — 技术博客

## 技术栈

- **前端**：Vue 3 + Vue Router + Pinia + ECharts
- **后端**：Express + better-sqlite3
- **认证**：JWT（jsonwebtoken + bcryptjs）

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/LockhartANR/arknights-recruit.git
cd arknights-recruit

# 2. 安装依赖
cd server && npm install
cd ../client && npm install

# 3. 配置环境变量
cd ../server
cp .env.example .env
# 编辑 .env，将 JWT_SECRET 换成随机字符串：
# openssl rand -hex 32

# 4. 启动开发服务器
# 终端 1：后端
cd server && node index.js

# 终端 2：前端
cd client && npm run dev
```

浏览器打开 `http://localhost:5173`，注册账号后即可使用。

## 运行测试

```bash
# 后端 API 测试（vitest + supertest）
cd server && npm test

# 前端 E2E 测试（Playwright）
cd client && npm run test:e2e
```

## 干员数据同步

干员数据来自 [PRTS-fetcher](https://github.com/LockhartANR/PRTS-fetcher)，仓库已内置 431 条干员数据。当上游数据更新时，运行同步脚本：

```bash
# 从 GitHub 拉取最新数据
node --use-system-ca sync-operators.js

# 或从本地 ../prts-fetcher/output/ 读取（降级模式）
node sync-operators.js --local
```

脚本会自动更新 `client/public/operators.json` 和 `client/public/operators/*.png`，前端无需改动。

## 部署到服务器

### 方式一：Express 直接对外（简单）

```bash
# 1. 服务器安装 Node.js 22+
# 2. 克隆项目
git clone https://github.com/LockhartANR/arknights-recruit.git && cd arknights-recruit

# 3. 安装依赖
cd server && npm install
cd ../client && npm install

# 4. 配置环境变量
cd ../server
cp .env.example .env
# 编辑 .env：
#   PORT=3000
#   JWT_SECRET=<openssl rand -hex 32 生成>
#   CORS_ORIGIN=https://ark.lockhart.ren

# 5. 构建前端
cd ../client && npx vite build

# 6. 启动（pm2 保活 + 开机自启）
cd ../server
npm install -g pm2
pm2 start index.js --name arknights-recruit
pm2 save && pm2 startup

# 7. 开放防火墙 3000 端口
sudo ufw allow 3000
# 云服务器还需要在安全组放行 TCP 3000
```

浏览器访问 `http://<服务器IP>:3000`。

### 方式二：Nginx 反向代理（推荐生产环境）

项目根目录下的 `nginx.conf` 已配好子域名路由：`lockhart.ren`（首页）、`ark.lockhart.ren`（本应用）、`blog.lockhart.ren`（博客），`/api` 代理到 Express。直接部署即可：

```bash
# 1. 确保已部署首页（my-landing）和博客占位，路径如下：
#    /home/arknights/landing/dist/       — 首页
#    /home/arknights/blog/public/        — 博客占位
# 2. 部署配置
sudo cp nginx.conf /etc/nginx/sites-available/arknights
sudo ln -sf /etc/nginx/sites-available/arknights /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

此后 Express 只需监听本地回环，静态文件由 Nginx 直接返回，性能更好。更新部署时运行 `./update.sh` 即可。

### 更新部署

```bash
./update.sh   # 拉代码 → 装依赖 → 构建前端 → 重启服务 → 重载 Nginx
```

## 项目结构

```
server/              Express REST API + SQLite
  routes/
    auth.js          注册、登录
    records.js       记录 CRUD + 统计 + 批量导入 + 批量删除
    operators.js     干员列表查询
  middleware/
    auth.js          JWT 验证中间件
  db.js              SQLite 数据库初始化与迁移
  app.js             Express 应用配置
  index.js           入口 + 生产环境静态文件托管
  tests/             后端 API 测试
client/              Vue 3 SPA
  src/
    views/
      LoginPage.vue      登录
      RegisterPage.vue   注册
      InputPage.vue      数据录入（星级 + 干员选择 + 批量导入）
      RecordsPage.vue    记录管理（分页、筛选、行内编辑、批量删除）
      StatisticsPage.vue 统计图表（按年/月筛选）
    stores/
      auth.js            Pinia 认证状态管理
    utils/
      api.js             API 请求封装（自动附加 JWT）
    components/
      NavBar.vue          导航栏
      RecentRecords.vue   最近记录列表
      OperatorSelector.vue 干员选择器
      CsvImport.vue        CSV / JSON 批量导入
      MonthlyStats.vue     月度统计表
      YearStats.vue        年度统计表
    composables/
      useStats.js      统计数据获取
      useOperators.js  干员数据获取
  public/
    operators.json     干员数据库（431 条）
    operators/         干员头像（431 个 PNG）
nginx.conf            子域名 Nginx 路由配置（lockhart.ren / ark.lockhart.ren / blog.lockhart.ren）
sync-operators.js     干员数据同步脚本（从 PRTS-fetcher 拉取）
update.sh             一键更新部署脚本
```

## 数据库

SQLite，自动创建（`server/data.db`），WAL 模式。

```sql
users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  created_at DATETIME
)

records (
  id INTEGER PRIMARY KEY,
  stars TEXT,            -- 单个星级 "1" / "2" / "3" / "4" / "5" / "6"
  count INTEGER,          -- 固定为 1
  operator_id TEXT,       -- 干员 ID，对应 operators.json
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME
)
```

旧版多星级 JSON 数组数据会在首次启动时自动迁移为单行记录。

## 许可

MIT License
