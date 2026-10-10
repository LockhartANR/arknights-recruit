# arknights-recruit 运维

> 跨项目共用的事实（机器、域名、nginx、TLS、备份、推送）见
> [`shared-infrastructure.md`](shared-infrastructure.md)，本文只写本项目特有的部分。

| 项 | 值 |
|---|---|
| 线上地址 | https://ark.lockhart.ren |
| 服务器目录 | `/home/arknights/arknights-recruit` |
| GitHub | `LockhartANR/arknights-recruit` |
| pm2 进程 | `arknights-recruit`（fork 模式，端口 3000，`.env` 提供配置） |
| 技术栈 | Vue 3 SPA + Express + SQLite（better-sqlite3） |
| 数据库 | `server/data.db`（WAL 模式） |
| 静态产物 | `client/dist/`（由 nginx 直接托管） |

## 部署

```bash
ssh ark-prod
cd ~/arknights-recruit && ./update.sh
```

`update.sh` 具备的保障（**改动时不要削弱这些能力**）：

1. 工作区脏则拒绝部署
2. 先备份数据库，备份失败即中止
3. `git pull --ff-only`
4. 前端构建到 `dist.new`，成功后原子切换（避免半成品对外服务）
5. 同步构建 `../landing`
6. `pm2 restart` 后校验 pid 真实存在
7. 健康检查：`127.0.0.1:3000` 必须 200；公网失败仅告警
8. **任何一步失败自动回滚**到部署前 commit 并重建、重启（`trap rollback EXIT`）
9. **9a** nginx 配置漂移检测（只告警，绝不自动覆盖）
10. **9a2** 未推送提交检测（服务器本地有未推送提交时告警）
11. **9b** `sudo -n nginx -t` + reload（无免密 sudo 则跳过）
12. **9c** 构建陈旧检测（代码有变更但产物指纹未变则告警）

第 9a/9a2/9c 三项都针对同一类问题：**部署「成功」但改动没生效**。

已知限制：服务器 `sudo` 需密码，脚本必然跳过 nginx 校验与重载。涉及 nginx 的改动
必须人工执行 `sudo nginx -t && sudo systemctl reload nginx`。

### 没有 pin 住 nginx 带来的安全边界

`update.sh` **不会**部署 `nginx.conf`。仓库里那份是线上配置的同步副本，用于核对与
反哺，不参与自动部署。这是刻意的 —— 线上配置由 Certbot 共同管理，自动覆盖会让
全部域名 HTTPS 中断。

## 前端 bundle 体积

单个 JS chunk 曾达 **1,256 KB（gzip 421 KB）**，根因是 `YearStats.vue` /
`MonthlyStats.vue` 各自 `import * as echarts from 'echarts'` 整包引入，而页面只用饼图。

已改为按需引入，集中在 `client/src/utils/echarts.js` 注册
`PieChart` / `TooltipComponent` / `LegendComponent` / `CanvasRenderer`：

| | 之前 | 之后 |
|---|---|---|
| 单个 JS chunk | 1,256,016 B | 626,410 B |
| gzip | 421.71 KB | 216.41 KB |

> ⚠️ **新增图表类型时必须在 `client/src/utils/echarts.js` 里追加注册**，否则构建能过、
> 运行时图表空白。例如柱状图要 `import { BarChart } from 'echarts/charts'` 并加入
> `echarts.use([...])`。

后续若继续优化：把统计页做成路由级动态 import，让首屏不再承担 echarts 体积。

## 验证图表改动的正确方法

本环境**跑不了 Vite 构建**（沙箱 `spawn EPERM`）、**也启动不了浏览器**
（Playwright 用 `--remote-debugging-pipe`，同样需要管道 stdio）。所以不要声称
「浏览器验证通过」。

可用的是**子系统级验证**：把组件真实的 `<script setup>` 代码抽出，剥掉 import，
注入真实 echarts 注册模块与受控桩后执行，断言 `setOption` 收到的 option 完整且
echarts 注册层不报 `not imported`。该探针做过反向验证（把组件改回整包引入时退出码
变为 1），因此它**会真正失败**，不是恒真的假测试。

这样能抓到「注册漏项」和「颜色缺失」这类问题 —— 1★/2★ 扇区无颜色的现存缺陷就是
这么发现的。

## 数据库与已知数据特征

`server/data.db`，WAL 模式。表结构见 `README.md`。

- **不能 `cp data.db` 备份** —— 主库只有 4 KB，数据全在 WAL 里。原因与恢复流程见
  [共享文档第 6 节](shared-infrastructure.md#6-数据库备份)。
- `records.stars` 存的是单值字符串（`"1"`…`"6"`），不是 JSON 数组；旧版多星级
  JSON 数组数据会在首次启动时自动迁移。
- 生产数据（2026-10-10）：`users` **仅 1 个账号**，`records` 1033 条，
  星级分布 1★ 4 / 3★ 761 / 4★ 250 / 5★ 15 / 6★ 3。
- **没有改密码 / 删账号 / 找回密码接口**。忘密码只能手工改库。

## 干员数据同步

数据来自 [`LockhartANR/PRTS-fetcher`](https://github.com/LockhartANR/PRTS-fetcher)，
经 GitHub 中转（`sync-operators.js` 从该仓库的 `output/` 拉取）。

```bash
node --use-system-ca sync-operators.js        # 从 GitHub 拉取
node sync-operators.js --local                # 从 ../prts-fetcher/output/ 读取
```

脚本更新 `client/public/operators.json` 与 `client/public/operators/*.png`，
前端无需改动。**注意这会依赖推送通道**：上游数据要先推到 GitHub，这边才拉得到。

## 配置

`server/.env`（**不在 git 里**，只存在于服务器与本地开发机）：

```
PORT=3000
JWT_SECRET=<生产密钥，与本地开发不同>
INVITE_CODE=<注册邀请码>
CORS_ORIGIN=https://ark.lockhart.ren
```

`CORS_ORIGIN` 曾被错写成 `https://lockhart.ren`。它必须是
`https://ark.lockhart.ren` —— 因为 nginx 只在 `ark.lockhart.ren` 上配了
`location /api`；`lockhart.ren` 没有该路由，访问 `https://lockhart.ren/api/*`
会落到 SPA fallback 返回首页 HTML，永远不会发起跨域 API 调用。

`app.js` 里有 `app.set('trust proxy', 'loopback')`。**不要删**：nginx 在前面注入
`X-Forwarded-For`，没有这行时 express-rate-limit 认不出客户端，全站共用同一个限流桶
（15 分钟 20 次），并且每个请求都会打一条 `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`。

## 测试

```bash
# 后端 API 测试（vitest + supertest，内存库）
cd server && npm test
# 前端 E2E（Playwright，需要浏览器）
cd client && npm run test:e2e
```

`vitest.config.js` 已把 `DB_PATH` 设为 `:memory:`。**仍需在克隆中跑**，
不要在生产仓库里直接跑 —— 生产仓库会加载 `server/.env`，任何遗漏都可能写到
`server/data.db`。`npm registry` 从服务器不可达，克隆后需复用生产
`node_modules`（`cp -a` 或软链）。

基线（2026-10-10）：后端 2 个文件 **47 个测试全部通过**，约 2.2 秒。
注意 `CLAUDE.md` 与 README 里写的「43 cases」已过时。

## 回滚

```bash
# 回滚代码到某个提交
cd ~/arknights-recruit && git reset --hard <commit> && ./update.sh

# 回滚配置
cp ~/arknights-recruit/server/.env.bak-<时间戳> ~/arknights-recruit/server/.env
pm2 restart arknights-recruit --update-env
```

历史 `.env` 备份存放在 `/home/arknights/env-backups/`（刻意放在仓库外，
避免让 `update.sh` 的「工作区必须干净」检查误报）。
