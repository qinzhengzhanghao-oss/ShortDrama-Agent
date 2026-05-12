/**
 * 分镜生成路由
 * 生成分镜脚本 + 智能编组 + 提示词构建
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const llmService = require('../services/llmService');
const storyboardBuilder = require('../services/storyboardBuilder');
const promptBuilder = require('../services/promptBuilder');

// POST /api/storyboard/:projectId/generate — 生成分镜
router.post('/:projectId/generate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    if (!project.scriptParsed) return res.status(400).json({ error: '请先上传并解析剧本' });

    // 生成分镜
    const storyboard = await storyboardBuilder.generate(project);
    
    // 智能编组
    const groups = storyboardBuilder.groupShots(storyboard.shots);

    // 构建提示词
    const prompts = await promptBuilder.build(project, storyboard, groups);

    // 保存到项目
    project.storyboard = storyboard;
    project.groups = groups;
    project.prompts = prompts;
    project.updatedAt = new Date().toISOString();
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    res.json({ storyboard, groups, prompts });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// GET /api/storyboard/:projectId — 获取分镜
router.get('/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });
    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    res.json({ 
      storyboard: project.storyboard, 
      groups: project.groups, 
      prompts: project.prompts 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/storyboard/:projectId — 更新分镜（人工调整）
router.put('/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const { storyboard, groups } = req.body;

    if (storyboard) project.storyboard = storyboard;
    if (groups) project.groups = groups;
    project.updatedAt = new Date().toISOString();
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    res.json({ storyboard: project.storyboard, groups: project.groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/storyboard/:projectId/prompts — 更新提示词（确认审核）
router.put('/:projectId/prompts', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const { prompts } = req.body;

    // 只更新非锁定字段
    if (prompts && project.prompts) {
      prompts.forEach((newP, idx) => {
        if (project.prompts[idx]) {
          // 接点镜头提示词不可编辑
          Object.keys(newP).forEach(key => {
            if (key !== 'bridgePrompt') {
              project.prompts[idx][key] = newP[key];
            }
          });
        }
      });
    }

    project.updatedAt = new Date().toISOString();
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    res.json({ prompts: project.prompts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
