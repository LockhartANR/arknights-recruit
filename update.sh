#!/bin/bash
#
# 部署脚本：备份 → 拉取 → 安装 → 构建 → 重启 → 重载 Nginx
#
# 与旧版的关键差异：
#   1. 部署前强制备份数据库；备份失败则不部署
#   2. 前端构建到临时目录，成功后原子切换，避免半成品 dist 对外服务
#   3. 任何一步失败都会自动回滚到部署前的 commit 并重新构建、重启
#   4. Nginx 重载失败不再伪装成成功
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

BACKUP_SCRIPT="$(dirname "$PROJECT_ROOT")/bin/backup-databases.py"
LANDING_DIR="$PROJECT_ROOT/../landing"
PM2_APP="arknights-recruit"

PREV_REV="$(git rev-parse HEAD)"
ROLLED_BACK=0

log()  { printf '\033[1;34m>>>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m xx\033[0m %s\n' "$*" >&2; exit 1; }

rollback() {
  local code=$?
  if [ "$code" -eq 0 ] || [ "$ROLLED_BACK" -eq 1 ]; then
    return
  fi
  ROLLED_BACK=1

  local now_rev
  now_rev="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

  warn "部署失败（退出码 $code）"
  if [ "$now_rev" = "$PREV_REV" ]; then
    warn "代码未发生变更（仍为 $PREV_REV），无需回滚代码；请检查上面的错误"
    return
  fi

  warn "回滚代码 $now_rev -> $PREV_REV"
  git reset --hard "$PREV_REV" || warn "git reset 失败，需要人工介入"

  if [ -d client ]; then
    log "重新构建前端"
    ( cd client && npm install --silent && npx vite build ) || warn "回滚构建失败"
  fi

  log "重启进程"
  pm2 restart "$PM2_APP" || warn "回滚重启失败"

  warn "已回滚到 $PREV_REV。数据库未受影响（备份在 ~/backups/）"
}
trap rollback EXIT

# ---------------------------------------------------------------- 1. 前置检查
log "检查工作区状态"
if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交的改动，请先处理（git status）后再部署"
fi
ok "工作区干净，当前版本 $PREV_REV"

# ---------------------------------------------------------------- 2. 备份
if [ -x "$BACKUP_SCRIPT" ] || [ -f "$BACKUP_SCRIPT" ]; then
  log "部署前备份数据库"
  if /usr/bin/python3 "$BACKUP_SCRIPT"; then
    ok "备份完成（~/backups/）"
  else
    die "数据库备份失败，已中止部署（不在无备份的情况下动生产）"
  fi
else
  warn "未找到备份脚本 $BACKUP_SCRIPT，跳过备份"
fi

# ---------------------------------------------------------------- 3. 拉取
log "拉取最新代码"
git pull --ff-only
NEW_REV="$(git rev-parse HEAD)"
if [ "$NEW_REV" = "$PREV_REV" ]; then
  ok "已是最新版本（$NEW_REV），仍将重新构建并重启"
else
  ok "代码更新 $PREV_REV -> $NEW_REV"
  git --no-pager log --oneline "$PREV_REV..$NEW_REV"
fi

# ---------------------------------------------------------------- 4. 后端依赖
log "安装后端依赖"
( cd server && npm install --silent )
ok "后端依赖就绪"

# ---------------------------------------------------------------- 5. 前端构建
log "构建前端（client）"
( cd client && npm install --silent && npx vite build --outDir dist.new --emptyOutDir )
if [ -d client/dist ]; then
  rm -rf client/dist.prev
  mv client/dist client/dist.prev
fi
mv client/dist.new client/dist
rm -rf client/dist.prev
ok "前端已原子切换到 client/dist"

# ---------------------------------------------------------------- 6. 首页构建
if [ -d "$LANDING_DIR" ]; then
  log "构建首页（landing）"
  ( cd "$LANDING_DIR" && git pull --ff-only && npm install --silent \
      && npx vite build --outDir dist.new --emptyOutDir )
  if [ -d "$LANDING_DIR/dist" ]; then
    rm -rf "$LANDING_DIR/dist.prev"
    mv "$LANDING_DIR/dist" "$LANDING_DIR/dist.prev"
  fi
  mv "$LANDING_DIR/dist.new" "$LANDING_DIR/dist"
  rm -rf "$LANDING_DIR/dist.prev"
  ok "首页已原子切换到 landing/dist"
else
  warn "未找到 $LANDING_DIR，跳过首页构建"
fi

# ---------------------------------------------------------------- 7. 重启
log "重启 $PM2_APP"
pm2 restart "$PM2_APP" --update-env
sleep 3
PM2_PID="$(pm2 pid "$PM2_APP" 2>/dev/null | tr -d '[:space:]')"
if ! printf '%s' "$PM2_PID" | grep -qE '^[0-9]+$'; then
  die "进程未在运行（pm2 pid 返回 '$PM2_PID'）"
fi
ok "进程已重启（pid $PM2_PID）"

# ---------------------------------------------------------------- 8. 健康检查
log "健康检查"
sleep 2

LOCAL_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)"
if [ "$LOCAL_CODE" != "200" ]; then
  die "本机 :3000 健康检查失败（HTTP $LOCAL_CODE）"
fi
ok "本机 :3000 -> HTTP $LOCAL_CODE"

PUBLIC_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://ark.lockhart.ren/ || echo 000)"
if [ "$PUBLIC_CODE" = "200" ]; then
  ok "公网 https://ark.lockhart.ren -> HTTP $PUBLIC_CODE"
else
  warn "公网健康检查返回 HTTP $PUBLIC_CODE，请确认"
fi

# ---------------------------------------------------------------- 9a. Nginx 配置漂移检测
# 只检测并告警，绝不自动覆盖。线上 /etc/nginx/sites-available/arknights 由 Certbot
# 共同管理，盲覆盖会让 5 个域名 HTTPS 立即中断。
NGINX_CHECK="$PROJECT_ROOT/scripts/check_nginx_config.py"
if [ -f "$NGINX_CHECK" ]; then
  log "检测 nginx 配置漂移"
  if /usr/bin/python3 "$NGINX_CHECK"; then
    ok "仓库 nginx.conf 与线上配置一致"
  else
    warn "仓库 nginx.conf 与线上配置不一致 —— 本次不会自动同步"
    warn "线上配置由 Certbot 管理，盲覆盖会导致全部域名 HTTPS 中断"
    warn "需要人工处理：先 sudoedit /etc/nginx/sites-available/arknights，"
    warn "确认改动无误后执行：sudo nginx -t && sudo systemctl reload nginx"
  fi
else
  warn "未找到 $NGINX_CHECK，跳过配置漂移检测"
fi

# ---------------------------------------------------------------- 9b. Nginx
log "校验并重载 Nginx"
if sudo -n nginx -t 2>/dev/null; then
  if sudo -n systemctl reload nginx; then
    ok "Nginx 已重载"
  else
    warn "Nginx 重载失败，请人工检查"
  fi
else
  warn "无免密 sudo，跳过 Nginx 校验与重载（应用代码部署不受影响）"
  warn "仅在本次改动涉及 nginx 配置时才需要人工执行：sudo nginx -t && sudo systemctl reload nginx"
fi

# ---------------------------------------------------------------- 10. 汇总
log "部署完成"
printf '    版本 : %s\n' "$NEW_REV"
printf '    备份 : %s\n' "$(ls -1t "$(dirname "$PROJECT_ROOT")"/backups/arknights/*.db.gz 2>/dev/null | head -1 || echo '无')"
pm2 list
