/**
 * 剧本解析路由 — 上传 + 解析 + 实体绑定
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
const upload = multer({ dest: path.join(UPLOAD_DIR, 'scripts_temp') });

// 解析服务
const scriptParser = require('../services/scriptParser');

// POST /api/scripts/:projectId/upload — 上传剧本文件
router.post('/:projectId/upload', upload.single('script'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const file = req.file;
    if (!file) return res.status(400).json({ error: '请上传剧本文件' });

    // 读取文件内容
    const content = fs.readFileSync(file.path, 'utf-8');
    
    // 解析
    const parsed = await scriptParser.parseScript(content, project.assets);
    
    // 保存到项目
    project.script = content;
    project.scriptParsed = parsed;
    project.updatedAt = new Date().toISOString();
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    // 清理临时文件
    fs.unlinkSync(file.path);

    res.json({ parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scripts/:projectId/bind — 手动绑定实体
router.post('/:projectId/bind', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bindings } = req.body; // [{entityName, entityId, entityType}]

    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });
    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    if (!project.scriptParsed) return res.status(400).json({ error: '请先上传剧本' });

    // 更新绑定
    for (const b of bindings) {
      project.scriptParsed.entities = project.scriptParsed.entities.map(e => {
        if (e.name === b.entityName) {
          return { ...e, boundId: b.entityId, boundType: b.entityType, bound: true };
        }
        return e;
      });
    }

    project.updatedAt = new Date().toISOString();
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    res.json({ parsed: project.scriptParsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scripts/:projectId — 获取剧本解析结果
router.get('/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });
    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    res.json({ 
      script: project.script,
      parsed: project.scriptParsed 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
