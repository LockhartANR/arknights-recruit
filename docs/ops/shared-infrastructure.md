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

## 2. 域名与项目映射

| 域名 | 内容 | 由谁托管 | 仓库 |
|---|---|---|---|
| `lockhart.ren` / `www.lockhart.ren` | 个人首页 | nginx 静态文件 | `LockhartANR/my-landing` |
| `ark.lockhart.ren` | 明日方舟公招统计 | nginx 静态 + `/api` 反代 `127.0.0.1:3000` | `LockhartANR/arknights-recruit` |
| `blog.lockhart.ren` | Hexo 博客 | nginx 静态文件 | `LockhartANR/blog` |
| `bangumi.lockhart.ren` | Bangumi 镜像 | nginx 反代 `127.0.0.1:8000` | `LockhartANR/bangumi-mirror` |

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
├── bangumi-mirror/      Python + FastAPI/uvicorn，pm2 进程 bangumi-mirror，端口 8000
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
| `bangumi` | 10 | 约 41 MB |

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

**恢复 bangumi 库**同理，但需先 `pm2 stop bangumi-mirror`，且该库有 117 MB，
解压留足磁盘空间（当前剩余约 48 G，充裕）。

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

## 8. 日常巡检

```bash
# 进程
pm2 list
pm2 describe arknights-recruit | grep -E 'status|restarts|uptime'
pm2 describe bangumi-mirror    | grep -E 'status|restarts|uptime'

# 错误日志（正常应为 0 字节或无新增）
tail -50 ~/.pm2/logs/arknights-recruit-error.log
tail -50 ~/.pm2/logs/bangumi-mirror-error.log

# 备份是否每天成功
tail -20 ~/backups/backup.log

# 资源
df -h / ; free -h

# 端口
ss -tlnp | grep -E ':(80|443|3000|8000)\b'

# 四个站点
for u in https://lockhart.ren/ https://ark.lockhart.ren/ https://blog.lockhart.ren/ https://bangumi.lockhart.ren/; do
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
