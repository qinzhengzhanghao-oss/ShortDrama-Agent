# ShortDrama-Agent 🎬

短剧自动化生产系统。从剧本+本地化资产管理到连续镜头视频组的自动化生产。

## 架构

```
frontend/  (Vue3 SPA → GitHub Pages)
    ↓ API
backend/   (Node.js Express → 本地运行)
    ├── DeepSeek LLM (剧本解析/分镜/提示词)
    ├── Seedance API (视频生成)
    └── 腾讯云 COS (图片/视频存储)
```

## 快速开始

### 1. 启动后端

```powershell
cd backend
npm install
$env:LLM_API_KEY = "sk-你的key"
node src/index.js
```

### 2. 启动内网穿透（让 GitHub Pages 访问本地）

```powershell
cd short-drama-agent
.\ngrok.exe http 3000
# 复制显示的 Forwarding URL (https://xxxx.ngrok-free.app)
```

### 3. 更新前端 API 地址

编辑 `frontend/utils/api.js`，将 `API_BASE_URL` 改为 ngrok 地址。

### 4. 部署前端

```bash
./deploy.sh
```

访问 GitHub Pages URL 即可使用。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3000 |
| LLM_API_KEY | DeepSeek API Key | - |
| LLM_ENDPOINT | DeepSeek 接口地址 | https://api.deepseek.com |
| LLM_MODEL | 模型名称 | deepseek-chat |
| SEEDANCE_API_KEY | 视频 API Key | - |
| SEEDANCE_API_URL | 视频 API 地址 | - |
| COS_SECRET_ID | 腾讯云 SecretId | - |
| COS_SECRET_KEY | 腾讯云 SecretKey | - |
| COS_BUCKET | COS 存储桶 | - |
| COS_REGION | COS 地域 | ap-guangzhou |

## 功能流程

1. **资产管理** → 创建角色/场景/道具，上传参考图
2. **剧本上传** → 拖拽 TXT/PDF/DOCX，LLM 解析，实体绑定
3. **分镜生成** → 智能分镜 + 编组(≤15秒) + 滑动窗口接点
4. **提示词审核** → 时间线化提示词 + 接点锁定
5. **视频生成** → 并行调度 + 进度仪表盘 + 下载管理
