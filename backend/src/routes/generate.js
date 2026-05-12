/**
 * 视频生成路由
 * 提交生成任务、轮询进度、下载、manifest
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const seedanceService = require('../services/seedanceService');

// 内存中的任务状态（真实场景应使用数据库）
const taskStore = new Map();

// POST /api/generate/:projectId/submit — 提交所有生成组
router.post('/:projectId/submit', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    if (!project.prompts || project.prompts.length === 0) {
      return res.status(400).json({ error: '请先生成提示词' });
    }

    const concurrency = req.body.concurrency || 3;
    const taskId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 初始化任务记录
    const taskRecord = {
      taskId,
      projectId,
      status: 'submitting',
      createdAt: new Date().toISOString(),
      groups: project.prompts.map(p => ({
        groupId: p.groupId,
        status: 'queued',
        progress: 0,
        error: null,
        result: null
      })),
      concurrency,
      totalGroups: project.prompts.length,
      completedGroups: 0,
      failedGroups: 0
    };

    taskStore.set(taskId, taskRecord);
    project.generation = { taskId, ...taskRecord };
    fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');

    // 异步启动生成
    this.startGeneration(project, taskRecord, concurrency);

    res.json({ taskId, totalGroups: taskRecord.totalGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/generate/:projectId/tasks — 获取所有生成任务
router.get('/:projectId/tasks', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    res.json({ tasks: project.generation ? [project.generation] : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/generate/:projectId/task/:taskId — 获取单个任务状态
router.get('/:projectId/task/:taskId', (req, res) => {
  const task = taskStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json({ task });
});

// POST /api/generate/:projectId/retry/:groupId — 重试单个组
router.post('/:projectId/retry/:groupId', async (req, res) => {
  try {
    const { projectId, groupId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const taskId = project.generation?.taskId;
    const task = taskStore.get(taskId);
    if (!task) return res.status(400).json({ error: '没有活跃任务' });

    const group = task.groups.find(g => g.groupId === groupId);
    if (!group) return res.status(404).json({ error: '组不存在' });

    group.status = 'queued';
    group.progress = 0;
    group.error = null;
    group.result = null;

    // 立即重试
    const promptGroup = project.prompts.find(p => p.groupId === groupId);
    if (promptGroup) {
      seedanceService.submitTask({
        groupId,
        shots: promptGroup.timelineShots,
        referenceImages: promptGroup.referenceImages,
        prompts: promptGroup.prompt
      }).then(async (resp) => {
        // 轮询
        while (true) {
          await new Promise(r => setTimeout(r, 3000));
          const status = await seedanceService.getTaskStatus(resp.taskId);
          group.status = status.status;
          group.progress = status.progress;
          if (status.status === 'SUCCESS' || status.status === 'completed') {
            group.result = status.result;
            task.completedGroups++;
          } else if (status.status === 'FAILED' || status.status === 'failed') {
            group.error = status.error || '生成失败';
            task.failedGroups++;
          }
          if (status.status === 'SUCCESS' || status.status === 'completed' || status.status === 'FAILED' || status.status === 'failed') break;
        }
      });
    }

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/generate/:projectId/manifest — 获取 manifest
router.get('/:projectId/manifest', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const manifest = buildManifest(project);
    res.json({ manifest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/generate/:projectId/manifest/download — 下载 manifest.json
router.get('/:projectId/manifest/download', (req, res) => {
  try {
    const { projectId } = req.params;
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
    if (!fs.existsSync(projPath)) return res.status(404).json({ error: '项目不存在' });

    const project = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    const manifest = buildManifest(project);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="manifest_${projectId}.json"`);
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/generate/:projectId/zip — 打包下载所有视频
router.get('/:projectId/zip', (req, res) => {
  try {
    const { projectId } = req.params;
    const genDir = path.join(__dirname, '..', '..', 'data', 'generated');
    
    // 收集该项目的视频文件
    const files = fs.readdirSync(genDir).filter(f => f.startsWith(projectId));
    if (files.length === 0) return res.status(404).json({ error: '没有已生成的视频文件' });

    // 使用流式压缩（需要 archiver 包，暂时用简单方式）
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 5 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${projectId}_videos.zip"`);

    archive.pipe(res);
    files.forEach(f => {
      archive.file(path.join(genDir, f), { name: f });
    });
    archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 构建 Manifest
 */
function buildManifest(project) {
  const groups = [];
  if (project.groups && project.prompts) {
    project.prompts.forEach(prompt => {
      const group = project.groups.find(g => g.groupId === prompt.groupId);
      if (!group) return;

      const task = project.generation;
      const groupTask = task?.groups?.find(g => g.groupId === prompt.groupId);

      groups.push({
        group_id: `${project.id}_${prompt.groupId}`,
        clip_url: groupTask?.result?.videoUrl || `/data/generated/${prompt.groupId}.mp4`,
        total_duration_sec: group.totalDuration,
        shots: prompt.timelineShots.map(shot => ({
          shot_id: `${project.id}_Shot_${String(shot.shotId).padStart(3, '0')}`,
          start_sec: shot.startTime,
          end_sec: shot.endTime,
          is_bridge: shot.isBridge || false,
          bridge_pair_group: shot.isBridge ? `${project.id}_${shot.bridgeToGroup || ''}` : null
        }))
      });
    });
  }

  return {
    project_id: project.id,
    project_name: project.name,
    generated_at: new Date().toISOString(),
    groups
  };
}

/**
 * 异步启动生成
 */
async function startGeneration(project, taskRecord, concurrency) {
  const queue = [...project.prompts];
  const running = [];

  taskRecord.status = 'running';

  while (queue.length > 0 || running.length > 0) {
    while (queue.length > 0 && running.length < concurrency) {
      const promptGroup = queue.shift();
      const groupTask = taskRecord.groups.find(g => g.groupId === promptGroup.groupId);
      if (!groupTask) continue;

      groupTask.status = 'generating';

      const promise = seedanceService.submitTask({
        groupId: promptGroup.groupId,
        shots: promptGroup.timelineShots,
        referenceImages: promptGroup.referenceImages,
        prompts: promptGroup.prompt
      }).then(async (resp) => {
        // 轮询进度
        while (true) {
          await new Promise(r => setTimeout(r, 3000));
          const status = await seedanceService.getTaskStatus(resp.taskId);
          groupTask.status = status.status;
          groupTask.progress = status.progress;

          // API 状态映射: SUCCESS→completed, FAILED→failed
          const s = status.status;
          if (s === 'SUCCESS' || s === 'completed') {
            groupTask.result = status.result;
            groupTask.progress = 100;
            groupTask.status = 'completed';
            taskRecord.completedGroups++;
            return;
          } else if (s === 'FAILED' || s === 'FAILURE' || s === 'failed') {
            groupTask.error = status.error || '生成失败';
            groupTask.status = 'failed';
            taskRecord.failedGroups++;
            return;
          }
        }
      });

      running.push(promise);
    }

    // 等待任意一个完成
    if (running.length > 0) {
      await Promise.race(running);
      // 清理已完成的任务
      for (let i = running.length - 1; i >= 0; i--) {
        const p = running[i];
        // 注意：这里简化为等所有完成后再检查
      }
    }
  }

  // 所有组完成
  taskRecord.status = taskRecord.failedGroups > 0 ? 'completed_with_errors' : 'completed';
  
  // 更新项目文件
  try {
    const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${project.id}.json`);
    const proj = JSON.parse(fs.readFileSync(projPath, 'utf-8'));
    proj.generation = taskRecord;
    proj.status = 'completed';
    proj.manifest = buildManifest(proj);
    fs.writeFileSync(projPath, JSON.stringify(proj, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存生成结果失败:', e.message);
  }
}

module.exports = router;
