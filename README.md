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

## 生产构建

```bash
cd client && npm run build
# 然后: cd ../server && node index.js
# Express 会自动 serve client/dist/
```

## 项目结构

```
server/           Express REST API + SQLite
  routes/         auth.js（注册/登录）、records.js（数据 CRUD + 统计）
  middleware/     auth.js（JWT 验证中间件）
  db.js           SQLite 数据库初始化与迁移
client/           Vue 3 SPA
  src/
    views/        登录、注册、录入、统计页面
    stores/       Pinia 认证状态管理
    utils/        API 请求封装（自动附加 JWT）
    components/   导航栏、记录列表、图表组件
    composables/  统计数据获取封装
```

## 许可

MIT License
