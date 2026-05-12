/**
 * 项目管理路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getProjectPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function loadProject(id) {
  const p = getProjectPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveProject(project) {
  fs.writeFileSync(getProjectPath(project.id), JSON.stringify(project, null, 2), 'utf-8');
}

// GET /api/projects - 列出所有项目
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const projects = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
      return {
        id: data.id,
        name: data.name,
        style: data.style,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        thumbCount: (data.assets?.characters?.length || 0) + (data.assets?.scenes?.length || 0)
      };
    });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - 创建新项目
router.post('/', (req, res) => {
  try {
    const { name, style } = req.body;
    if (!name) return res.status(400).json({ error: '项目名称不能为空' });

    const project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      style: style || '真人',
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assets: { characters: [], scenes: [], props: [] },
      script: null,
      scriptParsed: null,
      storyboard: null,
      groups: null,
      prompts: null,
      generation: null,
      manifest: null
    };

    saveProject(project);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id - 获取项目详情
router.get('/:id', (req, res) => {
  try {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id - 更新项目
router.patch('/:id', (req, res) => {
  try {
    const project = loadProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    Object.assign(project, req.body, { updatedAt: new Date().toISOString() });
    saveProject(project);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id - 删除项目
router.delete('/:id', (req, res) => {
  try {
    const p = getProjectPath(req.params.id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
