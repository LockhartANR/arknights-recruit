#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ">>> 拉取最新代码..."
git pull

echo ">>> 安装依赖（如有新增）..."
cd server && npm install --silent
cd ../client && npm install --silent

echo ">>> 构建前端..."
npx vite build

echo ">>> 重启服务..."
pm2 restart arknights-recruit

echo ">>> 更新完成"
pm2 status
