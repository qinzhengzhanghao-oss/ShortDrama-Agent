#!/bin/bash
# deploy.sh — 部署前端到 GitHub Pages
# 用法: ./deploy.sh "可选 commit 信息"

set -e

# 配置
SITE_NAME="short-drama-agent"
BUILD_DIR="dist"
COMMIT_MSG="${1:-自动部署 $(date +'%Y-%m-%d %H:%M')}"

echo "🚀 开始部署 $SITE_NAME 到 GitHub Pages..."

# 进入前端目录
cd "$(dirname "$0")/frontend"

# 创建构建目录（直接复制，无构建步骤）
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 复制文件
echo "📦 复制前端文件..."
cp index.html "$BUILD_DIR/"
cp -r assets "$BUILD_DIR/"
cp -r components "$BUILD_DIR/"
cp -r utils "$BUILD_DIR/"
cp -r public/* "$BUILD_DIR/" 2>/dev/null || true

# 创建 .nojekyll 防止 GitHub Pages 忽略 _ 开头的文件
echo "" > "$BUILD_DIR/.nojekyll"

# 初始化 git（如果还没初始化）
if [ ! -d "../.git" ]; then
  echo "📝 初始化 git 仓库..."
  cd ..
  git init
  git checkout -b main
  cd frontend
fi

# 部署到 gh-pages 分支
echo "📤 部署到 gh-pages 分支..."
cd ..
git add -A
git commit -m "$COMMIT_MSG" 2>/dev/null || echo "  没有新的变更"
git subtree push --prefix frontend/dist origin gh-pages 2>/dev/null || {
  # 如果 subtree 失败，用分离分支方式
  git branch -D gh-pages 2>/dev/null || true
  git checkout --orphan gh-pages
  rm -f .git/index
  git add -A
  git commit -m "$COMMIT_MSG"
  git push -f origin gh-pages
  git checkout main 2>/dev/null || git checkout main
}

echo "✅ 部署完成！"
echo "   GitHub Pages URL: https://<你的用户名>.github.io/short-drama-agent/"
