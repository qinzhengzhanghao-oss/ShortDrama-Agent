/**
 * ShortDrama-Agent 后端入口
 * 本地运行：node src/index.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 加载 .env 文件（如果有的话）
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    });
    console.log('📝 已加载 .env 配置文件');
  }
} catch (e) {
  // 忽略 .env 加载错误
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 确保数据目录存在
const DATA_DIR = path.join(__dirname, '..', 'data');
['uploads', 'generated', 'projects'].forEach(dir => {
  const p = path.join(DATA_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ============ 路由 ============
app.use('/api/projects', require('./routes/projects'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/scripts', require('./routes/scripts'));
app.use('/api/storyboard', require('./routes/storyboard'));
app.use('/api/generate', require('./routes/generate'));

// 静态文件服务（本地图片/视频预览）
app.use('/data', express.static(DATA_DIR));

// 提供前端文件
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// 所有非 API 路由返回前端入口
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/data/')) return;
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ============ 启动 ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 ShortDrama-Agent 后端已启动`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}\n`);
});
