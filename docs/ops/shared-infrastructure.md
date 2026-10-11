# 共享基础设施

> 这份文档描述**所有项目共用**的机器、网络与约定。各项目的部署细节见同目录下的
> 项目专属文档。
>
> 它是跨项目事实的**唯一归属地**：其它仓库的运维文档只引用本文件，不复制内容。
> 修改机器层面的东西（域名、端口、证书、备份、nginx）请只改这里。
>
> 最后核对：2026-10-10

## 1. 机器

| 项 | 值 |
|---|---|
| 公网 IP | `43.153.179.124`（腾讯云，`VM-0-8-ubuntu`，Ubuntu / 内核 6.8.0-101） |
| SSH | 用户 `arknights`，家目录 `/home/arknights` |
| sudo | **需要密码**（无免密），因此自动化脚本无法执行 nginx 等特权操作 |
| Node / npm | `v20.20.2` / `10.8.2` |
| Python | `/usr/bin/python3`（3.12） |
| 进程管理 | pm2（用户 `arknights`，配置在 `~/.pm2`） |
| Web 服务器 | nginx/1.24.0 |
| 系统服务 | `pm2-arknights.service` 已 `enabled`，开机自动恢复 pm2 进程列表 |
| 资源 | 磁盘 59G（用 16%）、内存 3.6G（可用约 2.6G）、负载极低 |

## 1.1 项目代号

五个项目各有中文代号，**日常沟通统一用它**，不再靠目录名或仓库名 ——
`landing` 目录对应的却是 `my-landing` 仓库，这类不一致已经造成过混淆。

**唯一归属地**：`.dsh-ops/names.env`（本地工作区）。查询：`python3 ~/bin/names.py [代号]`。

| 代号 | slug | 是什么 | 服务器目录 | GitHub 仓库 |
|---|---|---|---|---|
| **公招** | `gongzhao` | 明日方舟公开招募统计 | `arknights-recruit` | `LockhartANR/arknights-recruit` |
| **首页** | `shouye` | 个人首页 / 入口页 | `landing` | `LockhartANR/my-landing` |
| **博客** | `boke` | 博客（Hexo） | `blog` | `LockhartANR/blog` |
| **镜像** | `jingxiang` | Bangumi 私人反代镜像站 | `bangumi-mirror` | `LockhartANR/bangumi-mirror` |
| **图鉴** | `tujian` | 干员数据源（仅本地） | `prts-fetcher` | `LockhartANR/PRTS-fetcher` |

**为什么中文单字/双字**：对话里短、发音唯一、不需要额外记忆、能直接猜出是什么。
**为什么留 ASCII slug**：bash/POSIX 变量名不允许非 ASCII，脚本需要它。

**代号不进代码**：目录名、文件名、pm2 进程名、nginx `server_name` **一律保持现状** ——
改这些收益远小于风险和改动量。代号只用于人读的地方（对话、文档、提交信息、巡检输出）。
健康检查已按此改造，输出形如「镜像 (认证) -> HTTP 0」。

## 2. 域名与项目映射

| 域名 | 内容 | 由谁托管 | 仓库 |
|---|---|---|---|
| `lockhart.ren` / `www.lockhart.ren` | 个人首页 | nginx 静态文件 | `LockhartANR/my-landing` |
| `ark.lockhart.ren` | 明日方舟公招统计 | nginx 静态 + `/api` 反代 `127.0.0.1:3000` | `LockhartANR/arknights-recruit` |
| `blog.lockhart.ren` | Hexo 博客 | nginx 静态文件 | `LockhartANR/blog` |
| `bgm.lockhart.ren` | Bangumi 私人反代镜像（**需登录**） | nginx(认证) → Mirrox `127.0.0.1:3001` | `LockhartANR/bangumi-mirror` |
| `*.bgm.lockhart.ren` | 同上，覆盖 api / lain / fast / next / doujin | 同一条通配路由 | 同上 |
| `bangumi.lockhart.ren` | **已废弃**，返回 502（后端已移除，域名保留） | 残留 nginx 块 → 已停止的 `127.0.0.1:8000` | 同上 |

**本地目录名与 GitHub 仓库名不一致的地方（容易搞错）**：

| 服务器目录 | GitHub 仓库 |
|---|---|
| `/home/arknights/landing` | `LockhartANR/my-landing` ← 不同名 |
| `/home/arknights/arknights-recruit` | `LockhartANR/arknights-recruit` |
| `/home/arknights/blog` | `LockhartANR/blog` |
| `/home/arknights/bangumi-mirror` | `LockhartANR/bangumi-mirror` |

全部域名的 80 端口由 Certbot 生成的块 301 跳转到 HTTPS。

## 3. 项目目录布局

```
/home/arknights/
├── arknights-recruit/   Node + Express，pm2 进程 arknights-recruit，端口 3000
├── landing/             Vue 3 静态站，nginx 直接托管
├── blog/                Hexo 静态站，nginx 直接托管
├── bangumi-mirror/      反代方案的文档与配置样例（程序本身在 ~/bgm-proxy）
├── bgm-proxy/           Mirrox 配置与认证服务
│   ├── config/config.toml   Mirrox 路由与改写（pm2: bgm-proxy，127.0.0.1:3001）
│   └── auth/                认证服务（pm2: bgm-auth，127.0.0.1:3002）
├── bin/mirrox           Mirrox 二进制（v0.3.3，外部下载，未纳入版本管理）
├── certs/bgm.lockhart.ren/  通配证书（acme.sh 自动续期）
├── bin/                 跨项目的运维脚本
│   └── check-nginx-config.py
├── backups/             数据库备份（由 backup-databases.py 写入）
├── env-backups/         .env 与历史文件的备份
└── .pm2/                pm2 配置与日志
```

## 4. nginx

配置文件：`/etc/nginx/sites-available/arknights`，已软链到 `sites-enabled/`。
**必须用 sudo 读写**（`sudoedit`，不要用 `nano` 直接改，避免权限与原子性问题）。

**这份配置由 Certbot 共同管理** —— `listen 443 ssl`、证书路径、80→443 重定向块都带
`managed by Certbot` 标记。因此：

> ⚠️ **不要用任何仓库里的 `nginx.conf` 直接覆盖线上配置。**
> 历史上 `arknights-recruit/nginx.conf` 一度停留在「只有 80 端口」的旧版本，
> 照旧说明覆盖会让全部域名的 HTTPS 立即中断。

改配置的正确流程：

```bash
sudo cp /etc/nginx/sites-available/arknights /etc/nginx/sites-available/arknights.bak-$(date +%Y%m%d)
sudoedit /etc/nginx/sites-available/arknights
sudo nginx -t && sudo systemctl reload nginx
```

改完把内容反哺回 `arknights-recruit/nginx.conf`（它现在是线上配置的同步副本）。

### 配置漂移检测

`arknights-recruit/scripts/check_nginx_config.py` 只读比对仓库副本与线上配置：

```bash
/usr/bin/python3 /home/arknights/arknights-recruit/scripts/check_nginx_config.py
# 一致时退出 0：OK - repo nginx.conf is equivalent to the live config
```

它比对「有效指令多重集 + `server {` 块数量」。**不能用哈希或 diff**：仓库副本多一段
警示注释（哈希永不相等），且块顺序历史上与线上不同（顺序敏感的 diff 会把纯重排
误报为差异）。

### 无 sudo 时如何校验 nginx 语法

`nginx -t` 需要读证书私钥，非 root 会 `Permission denied`。可以自己在 `/tmp` 里包一个
最小 main 上下文再测（脚本见 `arknights-recruit/scripts/` 同名工具）。判读要点：
**只要报错是 `cannot load certificate ... Permission denied`，就说明语法解析已通过**
（该错误发生在证书加载阶段，晚于语法校验）。

## 5. TLS 证书

有**两套**证书体系，分别由不同工具管理：

| 用途 | 覆盖域名 | 管理工具 | 位置 |
|---|---|---|---|
| 主证书 | `lockhart.ren` / `www.` / `ark.` / `blog.` | certbot（系统级） | `/etc/letsencrypt/live/lockhart.ren/` |
| bgm 通配证书 | `bgm.lockhart.ren` + `*.bgm.lockhart.ren` | **acme.sh**（用户级） | `~/.acme.sh/` → 安装到 `~/certs/bgm.lockhart.ren/` |

### bgm 通配证书为什么用 acme.sh 而不是 certbot

通配证书只能走 **DNS-01 验证**。服务器**没有免密 sudo**，certbot 是系统级安装、
加插件需要 sudo，因此改用装在 home 目录下的 acme.sh，完全不需要提权。

```bash
~/.acme.sh/acme.sh --list
~/.acme.sh/acme.sh --renew -d bgm.lockhart.ren --ecc --force
```

DNS 凭据在 `~/.secrets/dnspod.env`（600 权限）。

**关键细节**：`lockhart.ren` 的 DNS 托管在 **DNSPod（腾讯云）**，
权威 NS 为 `writer.dnspod.net` / `stallion.dnspod.net`。

- 必须用 acme.sh 的 **`dns_tencent`** 插件（腾讯云 API v3）。
  实测 `dns_dp`（DNSPod 经典 API）**失败**。
- 首次签发遇到过 `No TXT record found`：acme.sh 默认自查通过后立即让 CA 验证，
  但 TXT 记录尚未传播到权威 NS。加 `--dnssleep 180` 即可。
- 证书安装到 `~/certs/` **必须 chmod 644**（目录 755），因为 nginx 以 `www-data`
  运行，读不到 `arknights` 家目录下的 700 路径。

## 5.1 ⚠️ nginx 的默认站点陷阱

`/etc/nginx/sites-enabled/` 里**只有 `arknights` 一个软链**，
且**没有任何 server 块声明 `default_server`**。

后果：**访问一个没有被任何 `server_name` 匹配的域名时，nginx 会落到配置里
第一个 `listen 443` 的块** —— 当前是 `lockhart.ren` 的首页。

表现是「打开某个链接却进了首页」，而不是报错或连不上。
排查「站点串了」时先想到这条。

（`sites-available/default` 里虽有 `listen 80 default_server`，但它没被启用。）

## 5.2 nginx 版本相关的语法

当前 **nginx 1.24.0**。

- `http2 on;` 是 **1.25.1+** 语法，在 1.24 上会报 `unknown directive "http2"`。
  必须写成 `listen 443 ssl http2;`。
- `http_auth_request` 模块**已编译在内**，`auth_request` 可用。



Let's Encrypt，证书在 `/etc/letsencrypt/live/lockhart.ren/`，四个域名共用一张
（含 `www.lockhart.ren`）。由 `certbot.timer` 自动续期，**无需人工干预**。

```bash
sudo certbot certificates          # 查看有效期
sudo certbot renew --dry-run       # 演练续期
```

## 6. 数据库备份

脚本：`/home/arknights/bin/backup-databases.py`（**不在任何仓库里**，只存在于服务器）。
写入 `/home/arknights/backups/`，日志 `backups/backup.log`。

| 数据库 | 保留份数 | 大小 |
|---|---|---|
| `arknights` | 30 | 约 7.5 KB |

原先的 `bangumi` 库（117 MB）已随旧应用移除，脚本中的对应条目也已删除。

调度：cron 每日 04:00，以及 `arknights-recruit/update.sh` 每次部署前。

**为什么不能 `cp data.db`**：两个库都是 WAL 模式。`arknights` 的主库文件只有 4 KB，
而 1033 条记录全在约 1.8 MB 的 `data.db-wal` 里 —— `cp data.db` 会得到一个
**「完整性检查通过但一张表都没有」的空库**，比报错更危险。备份脚本用 SQLite 官方
backup API 读一致性快照，并在接受前用 `PRAGMA integrity_check` + 表行数比对校验。

```bash
# 手动备份
/usr/bin/python3 /home/arknights/bin/backup-databases.py
# 看日志
tail -20 /home/arknights/backups/backup.log
```

### 恢复流程（已演练，2026-10-10）

恢复 `arknights` 库（该库由 pm2 进程占用，必须先停）：

```bash
cd /home/arknights/arknights-recruit/server
pm2 stop arknights-recruit
cp data.db data.db.before-restore          # 留退路
gzip -dc /home/arknights/backups/arknights/<快照>.db.gz > data.db
rm -f data.db-wal data.db-shm              # 关键：清掉旧 WAL，否则会被重放
pm2 start arknights-recruit
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

**演练实测结果**（2026-10-10，在 `/tmp` 中旁路进行，未影响生产）：

| 步骤 | 结果 |
|---|---|
| 天真做法 `cp data.db` | `integrity_check` 报 `ok`，但 `no such table: users` —— 空库 |
| 从快照 gzip 恢复 | `integrity` ok、表结构齐全、`journal_mode=wal`、行数与线上一致 |

`bgm.lockhart.ren` 是纯反代，**没有数据库**，无需备份。
需要备份的是 `~/bgm-proxy/`下的配置与密钥，详见该仓库的 `docs/ops/runbook.md`。

## 7. 推送代码到 GitHub

服务器**能直连** `github.com`（HTTPS 与 SSH 22 端口都通）。推送到 GitHub 目前走
fine-grained token，存放在 `~/.git-credentials`：

```
https://x-access-token:<token>@github.com
```

**必须带 `x-access-token:` 用户名段**。只写 `https://<token>@github.com` 会被 git 解析成
「只有密码、没有用户名」，报 `could not read Username for 'https://github.com'`。

凭据由 `git config --global credential.helper store` 启用（注意不是 `cache` ——
`cache` 是内存态，重启即失效）。

⚠️ **token 明文落盘**：任何能读取该主机（或其快照、备份）的人都能凭它写入被授权的仓库。
请限定到具体仓库、设置较短有效期，并在不再需要时到 GitHub 撤销。

### 备选：SSH deploy key（无需长串复制、无过期）

服务器上已生成专用密钥 `~/.ssh/id_ed25519_github`（无口令）。把这把公钥加到 GitHub
即可用 SSH 推送：

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJWOkPK25+IX/gnl5M5an8zg/1i29BRIZ3gQJ+GoDDg arknights@VM-0-8-ubuntu (DSH ops)
```

## 7.1 健康检查（自动，每 5 分钟）

脚本：`/home/arknights/bin/health-check.py`，由 cron 每 5 分钟运行，
输出追加到 `~/backups/health.log`，最近一次结果在 `~/bin/health-status.txt`。

**它为什么存在**：这台机器原本的定时任务只有数据库备份与证书续期，
**没有任何可用性检查**。结果是 blog 全站 403、旧应用移除后 bangumi 域名一直 502、
以及若干个重定向死循环 —— 坏了都没人知道，直到有人自己打开站点发现。
健康检查把「静默坏掉」变成「有记录」。

检查七项：

| 项 | 说明 |
|---|---|
| 站点可达 | 四个域名，各自有预期状态码（`bgm` 未登录时 302 是正常的，不是故障） |
| 回环服务 | 直连 3000 / 3001 / 3002 验证服务本身，绕过 nginx |
| pm2 进程 | 期望在线的三个进程是否都 online |
| 上游 DNS | 从 Mirrox 配置里提取上游域名逐个解析（上游不通则镜像站必挂） |
| 证书有效期 | **通过 TLS 连接取实际在用的证书**，见下方说明 |
| 磁盘剩余 | 低于 3 GB 告警 |
| 备份新鲜度 | 最新备份超过 36 小时告警 |

退出码 0 = 正常，1 = 有异常。健康时静默，只在有问题时打印。

### 证书为什么从 TLS 连接取而不是读文件

`/etc/letsencrypt/live/` 是 `drwx------` **root-only**，普通用户读不到，
而脚本正是以普通用户运行（服务器没有免密 sudo）。第一版读文件因此报了假告警。
改为 `openssl s_client` 连接各域名取证书，好处有两个：**不需要提权**，
而且读到的是**实际对外服务的那张证书** —— 若证书换了但 nginx 没重载，
读文件会误判正常，读连接才能发现。

## 7.2 静态资源缓存策略

各站点此前**完全没有 Cache-Control**，只有 nginx 默认给的 ETag / Last-Modified，
浏览器每次访问都要回源校验一次（返回 304，那一次往返省不掉）。现已按文件是否带
内容指纹区分处理：

| 站点 | 路径 | 体积 | 策略 | 依据 |
|---|---|---|---|---|
| arknights-recruit | `/assets/` | 660 KB | `expires 1y` | Vite 产物，文件名带内容 hash，改名即换文件 |
| arknights-recruit | `/operators/` | **18 MB**（432 张头像） | `expires 30d` | 按干员 id 命名、**不带 hash**，数据同步时同名文件内容会变，故不给长缓存 |
| landing | `/assets/` | 67 KB | `expires 1y` | 同 Vite，带 hash |
| bgm.lockhart.ren | — | — | 不动 | 上游 bgm.tv 自己就带缓存头（`/img/` 30 天、`/js/` 8 天），镜像透传即可 |
| blog | — | 516 KB | **刻意不做** | Hexo 产物文件名**不带 hash**，长缓存会让读者长期看到旧 CSS/JS |

**HTML 与 API 一律不加缓存头**：`index.html` 必须每次回源校验，否则前端更新后
用户会拿着旧 index.html 去请求已删除的旧 hash 资源，直接白屏。

### 一个实测结论：`expires` 自己就会生成 Cache-Control

```nginx
expires 1y;                                  # 生成 Cache-Control: max-age=31536000
expires 1y;
add_header Cache-Control "public, immutable"; # 多余的，会让响应出现两行 Cache-Control
```

用临时 nginx 实例实测确认：只用 `expires` 时 `Cache-Control` 出现 1 次，
两者都写时出现 2 次（浏览器取较大值，功能等价但不整洁）。
**另外：`immutable` 在 `max-age` 已达一年的情况下实际收益为零** ——
浏览器本来就不会在一年内主动回源。所以最终只保留 `expires`。

维护脚本：`~/bin/patch-cache-headers.py`（幂等，可重复运行），
`~/bin/sync-nginx-to-repo.py`（把线上配置同步回仓库副本）。

## 8. 日常巡检

```bash
# 进程
pm2 list
pm2 describe arknights-recruit | grep -E 'status|restarts|uptime'
pm2 describe bgm-proxy         | grep -E 'status|restarts|uptime'
pm2 describe bgm-auth          | grep -E 'status|restarts|uptime'

# 错误日志（正常应为 0 字节或无新增）
tail -50 ~/.pm2/logs/arknights-recruit-error.log
tail -50 ~/.pm2/logs/bgm-proxy-out.log
tail -50 ~/.pm2/logs/bgm-auth-out.log

# 备份是否每天成功
tail -20 ~/backups/backup.log

# 资源
df -h / ; free -h

# 端口
ss -tlnp | grep -E ':(80|443|3000|8000)\b'

# 四个站点
for u in https://lockhart.ren/ https://ark.lockhart.ren/ https://blog.lockhart.ren/ https://bgm.lockhart.ren/; do
  printf '%-32s -> %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $u)"
done
```

## 9. 本机连服务器的坑（DSH 沙箱内）

- SSH 无法写 `~/.ssh/known_hosts`，需要用工作区内的专用配置：
  `ssh -F D:/code/Codefields/.dsh-ops/ssh.config ark-prod`
- **`ControlMaster` 必须关闭** —— Windows 沙箱下报 `getsockname failed: Not a socket`
- 脚本经 stdin 投递时，PowerShell here-string 会给**最后一行**附加 `\r`，导致
  `git push origin main` 变成 `main\r` 这类诡异错误。
  **可靠做法：把脚本 base64 后写到服务器再 `bash` 执行**，完全绕开行尾转换。
- 本机 `vite build`、`vitest`、Playwright 都因沙箱禁止管道 stdio 而报 `spawn EPERM`，
  因此本地无法构建或测试，验证一律在服务器上做。

## 10. 常见坑速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 某站点返回 403 | 站点根目录存在但没有 `index.html`（从未构建成功） | 跑该项目的构建脚本 |
| 静态站改了代码但线上没变 | 只改了源码，没重新构建 | 跑构建脚本，确认产物文件哈希变化 |
| `nginx -t` 报权限错 | 非 root 读不到证书私钥 | 这是**预期**的，语法已通过；真正生效需人工 `sudo nginx -t` |
| `could not read Username for github.com` | 凭据缺少用户名段 | 改成 `https://x-access-token:<token>@github.com` |
| `spawn EPERM`（本机） | 沙箱禁止管道 stdio | 改在服务器上执行 |
| `git pull` 说已是最新但线上代码是旧的 | 服务器本地有未推送的提交 | `git log origin/main..HEAD` 查，并推送 |
| `http2`/`unknown directive` | nginx 1.24 不支持 `http2 on;` | 改成 `listen 443 ssl http2;` |
| 打开某域名却进了首页 | 无 `default_server`，落到第一个 443 块 | 见 5.1 节 |
| 页面一直「加载中」、登录按钮没反应 | 浏览器自动请求的资源（如 `/favicon.ico`）被鉴权拦住，形成重定向循环 | 给这类资源加免鉴权规则（204） |
| 表单提交后转一圈回原页、服务端日志里看不到该 POST | 表单 `action` 是相对路径，服务挂在 `/__auth/` 前缀下却生成了不带前缀的地址，被鉴权拦住 | 服务需知道自己被挂载的前缀，生成的链接必须带前缀 |
| `pm2 restart` 后配置没生效 | pm2 复用启动时捕获的环境，不重新执行启动脚本 | 用 `pm2 delete` + `pm2 start` |
| shell 脚本里 `source` 含 `$` 的值导致其被破坏 | bash 把值里的 `$x` 当变量引用展开 | 用 Python 逐行读取后交给 `env`，不让 shell 解析值 |