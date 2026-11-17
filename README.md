# 明日方舟公招统计

记录和统计《明日方舟》公开招募的星级与干员分布，支持多用户、记录管理、CSV 导入与统计图表。

在线访问：[ark.lockhart.ren](https://ark.lockhart.ren)。前端使用 Vue 3、Pinia、ECharts；后端使用 Express、SQLite 和 JWT。

## 本地开发

使用 Node.js 24，在 server/ 和 client/ 各执行一次 npm ci。把 server/.env.example 复制为 server/.env，设置本地 JWT_SECRET 和注册邀请码。不要使用生产配置。

```sh
# 终端一
cd server
npm run dev
```

```sh
# 终端二
cd client
npm run dev
```

访问 http://localhost:5173。开发模式使用 server/development.db，与默认运行数据库分开。

## 验证与构建

```sh
cd server
npm test
cd ../client
npm run build
npx playwright install chromium
npm run test:e2e
cd ..
python ops/verify.py
```

E2E 会启动独立的测试服务和测试数据库，运行前停止同端口的本地开发服务。数据库和环境文件不提交 Git。

## 自行部署

在隔离环境安装后端依赖并构建 client/dist/。按自己的环境设置 JWT_SECRET、INVITE_CODE、CORS_ORIGIN、DB_PATH 和 PORT，然后从 server/ 运行 npm start。后端可托管前端静态文件；如配置反向代理，应保留 /api 路径并设置正确的代理信任范围，参考 server/app.js。

SQLite 运行文件需要持久化并单独备份，不能被发布包覆盖。公网部署时自行配置 HTTPS、进程管理与访问控制。仓库不包含线上服务器配置；CI 只负责测试和打包。

## 干员数据

数据来自 [PRTS-fetcher](https://github.com/LockhartANR/PRTS-fetcher)。更新时运行 node --use-system-ca sync-operators.js，也可以用 --local 从同级 prts-fetcher/output/ 读取。已有干员数据和图片包含在仓库内。

MIT License；游戏素材及相关权利归各自权利人所有。
