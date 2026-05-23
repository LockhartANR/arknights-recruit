#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ">>> 拉取最新代码..."
git pull

echo ">>> 安装后端依赖..."
cd server && npm install --silent

echo ">>> 安装前端依赖..."
cd ../client && npm install --silent

echo ">>> 构建前端..."
npx vite build

echo ">>> 重启服务..."
cd ../server
pm2 restart arknights-recruit

echo ">>> 重载 Nginx（如有配置变更）..."
sudo nginx -t && sudo systemctl reload nginx || echo "Nginx 未安装或配置有误，跳过"

echo ">>> 更新完成"
pm2 status
