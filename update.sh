#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo ">>> 拉取最新代码..."
git pull

echo ">>> 安装后端依赖..."
cd "$PROJECT_ROOT/server" && npm install --silent

echo ">>> 安装前端依赖..."
cd "$PROJECT_ROOT/client" && npm install --silent

echo ">>> 构建前端..."
npx vite build

echo ">>> 构建首页（如有）..."
LANDING_DIR="$PROJECT_ROOT/../landing"
if [ -d "$LANDING_DIR" ]; then
  cd "$LANDING_DIR" && git pull && npm install --silent && npx vite build
fi

echo ">>> 重启服务..."
cd "$PROJECT_ROOT/server"
pm2 restart arknights-recruit

echo ">>> 重载 Nginx（如有配置变更）..."
sudo nginx -t && sudo systemctl reload nginx || echo "Nginx 未安装或配置有误，跳过"

echo ">>> 更新完成"
pm2 status
