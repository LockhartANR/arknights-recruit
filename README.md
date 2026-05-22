# 明日方舟公招统计

多用户 Web 应用，用于记录和统计《明日方舟》公开招募的星级分布。

## 技术栈

- **前端**：Vue 3 + Vue Router + Pinia + ECharts
- **后端**：Express + better-sqlite3
- **认证**：JWT（jsonwebtoken + bcryptjs）

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url>
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
# 后端 API 测试（vitest + supertest，33 个用例）
cd server && npm test

# 前端 E2E 测试（Playwright，21 个用例）
cd client && npm run test:e2e
```

## 部署到服务器

```bash
# 1. 服务器安装 Node.js 22+
# 2. 克隆项目
git clone <repo-url> && cd arknights-recruit

# 3. 安装依赖
cd server && npm install
cd ../client && npm install

# 4. 配置环境变量
cd ../server
cp .env.example .env
# 编辑 .env：
#   JWT_SECRET=<openssl rand -hex 32 生成>
#   CORS_ORIGIN=http://你的域名或IP:3000

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

浏览器访问 `http://<服务器IP>:3000`，注册账号后即可使用。

更新部署：`git pull` → `cd client && npx vite build` → `pm2 restart arknights-recruit`。

## 项目结构

```
server/           Express REST API + SQLite
  routes/         auth.js（注册/登录）、records.js（CRUD + 统计 + 批量导入 + 批量删除）
  middleware/     auth.js（JWT 验证中间件）
  db.js           SQLite 数据库初始化与迁移
client/           Vue 3 SPA
  src/
    views/        登录、注册、录入、记录管理、统计页面
    stores/       Pinia 认证状态管理
    utils/        API 请求封装（自动附加 JWT）
    components/   导航栏、记录列表、图表、CSV 导入
    composables/  统计数据获取封装
```

## 许可

MIT License
