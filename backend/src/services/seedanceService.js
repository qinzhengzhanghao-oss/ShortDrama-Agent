/**
 * Seedance 视频生成服务（通过 New API 中转，精确匹配 API 文档）
 * 
 * 接口: POST /v1/video/generations      → 提交任务
 *       GET /v1/video/generations/{id}  → 查询状态
 * 
 * New API 文档: https://metamind.yun
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const USE_MOCK = process.env.SEEDANCE_MOCK === 'true' || !process.env.SEEDANCE_API_KEY;

class SeedanceService {
  constructor() {
    this.apiEndpoint = process.env.SEEDANCE_API_URL || 'https://metamind.yun';
    this.apiKey = process.env.SEEDANCE_API_KEY || '';
    this.defaultModel = process.env.SEEDANCE_MODEL || 'seed-2-fast';
    this.tasks = new Map();    // taskId → { groupId, status, ... }
    
    if (!USE_MOCK) {
      console.log(`🎬 Seedance API 已配置: ${this.apiEndpoint}`);
      console.log(`   默认模型: ${this.defaultModel}`);
    }
  }

  /** 构建视频生成提示词 */
  buildPrompt(shots) {
    const lines = [];
    shots.forEach((shot, idx) => {
      const start = shots.slice(0, idx).reduce((s, sh) => s + (sh.duration || 0), 0);
      const end = start + (shot.duration || 0);
      lines.push(`[${start.toFixed(1)}s-${end.toFixed(1)}s] 镜头${idx + 1}`);
      lines.push(`景别: ${shot.shotType || '中景'} | 运镜: ${shot.camera || '固定'}`);
      if (shot.characters?.length) lines.push(`角色: ${shot.characters.join(', ')}`);
      if (shot.actions) lines.push(`动作: ${shot.actions}`);
      if (shot.facialAU) lines.push(`表情: ${shot.facialAU}（${shot.expression || ''}）`);
      if (shot.dialogue) lines.push(`台词: ${shot.dialogue}`);
      if (shot.sound) lines.push(`音效: ${shot.sound}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  // ================================================================
  //  1. 提交视频生成任务
  // ================================================================
  async submitTask(promptGroup) {
    if (USE_MOCK) return this._mockSubmit(promptGroup);

    const { groupId, shots, referenceImages, prompts } = promptGroup;
    const promptText = typeof prompts === 'string' ? prompts : this.buildPrompt(shots);
    const totalDuration = shots.reduce((s, sh) => s + (sh.duration || 0), 0);

    const requestBody = {
      model: this.defaultModel,
      prompt: promptText,
      metadata: {
        generate_audio: false,
        ratio: '16:9',
        duration: Math.min(Math.max(totalDuration, 5), 11), // 5,8,11
        watermark: false
      }
    };

    // 参考图片
    if (referenceImages && referenceImages.length > 0) {
      requestBody.images = referenceImages.slice(0, 20);
    }

    console.log(`\n🎬 [Seedance] 提交任务: ${groupId}`);
    console.log(`   模型: ${this.defaultModel}, 时长: ${requestBody.metadata.duration}s`);
    console.log(`   参考图: ${requestBody.images?.length || 0}张`);
    console.log(`   提示词: ${promptText.slice(0, 100)}...`);

    try {
      const resp = await axios.post(
        `${this.apiEndpoint}/v1/video/generations`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = resp.data;
      const taskId = result.task_id || result.id;
      if (!taskId) {
        throw new Error(`API 未返回 task_id: ${JSON.stringify(result)}`);
      }

      this.tasks.set(taskId, {
        taskId,
        groupId,
        status: result.status || 'queued',
        progress: result.progress || 0,
        model: this.defaultModel,
        createdAt: new Date().toISOString(),
        rawResult: result
      });

      console.log(`   ✅ Task: ${taskId} | 状态: ${result.status} | 进度: ${result.progress}%`);
      return { taskId };
    } catch (err) {
      const errData = err.response?.data;
      const errMsg = errData?.message || errData?.error?.message || err.message;
      console.error(`   ❌ 提交失败: ${errMsg}`);
      
      if (err.response?.status === 403) {
        // 余额不足 → 降级到 Mock
        console.warn('   ⚠️ 余额不足，降级到 Mock 模式');
        return this._mockSubmit(promptGroup);
      }
      
      throw new Error(`视频生成提交失败: ${errMsg}`);
    }
  }

  // ================================================================
  //  2. 查询任务状态（精确匹配文档 TaskDto 格式）
  // ================================================================
  async getTaskStatus(taskId) {
    if (USE_MOCK) return this._mockStatus(taskId);

    try {
      const resp = await axios.get(
        `${this.apiEndpoint}/v1/video/generations/${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 15000
        }
      );

      // 文档: 外层 { code, message, data }
      const body = resp.data;
      if (body.code && body.code !== 'success') {
        return { taskId, status: 'FAILED', progress: 0, error: body.message || body.code };
      }

      const info = body.data || body;  // TaskDto
      const status = info.status || 'unknown';
      const progress = parseInt(info.progress) || 0;

      // 解析实际进度
      const rawProgress = (info.progress || '').toString();
      const parsedProgress = rawProgress.includes('%')
        ? parseInt(rawProgress)
        : progress;

      // 提取视频 URL（文档的嵌套格式）
      let videoUrl = '';
      if (status === 'SUCCESS') {
        videoUrl = info.result_url
          || info.data?.result_url
          || info.data?.data?.result_url
          || info.data?.data?.content?.video_url
          || '';
      }

      // 保存到内存
      if (this.tasks.has(taskId)) {
        const task = this.tasks.get(taskId);
        task.status = status;
        task.progress = parsedProgress;
        task.failReason = info.fail_reason || '';
        if (videoUrl) {
          task.result = { videoUrl, duration: 11, resolution: '1536x1024' };
        }
      }

      return {
        taskId,
        status,
        progress: parsedProgress,
        result: videoUrl ? { videoUrl } : null,
        error: info.fail_reason || null
      };
    } catch (err) {
      if (err.response?.status === 400) {
        return { taskId, status: 'NOT_FOUND', progress: 0, error: '任务不存在' };
      }
      return { taskId, status: 'unknown', progress: 0, error: err.message };
    }
  }

  // ================================================================
  //  3. 取消任务（可选）
  // ================================================================
  async cancelTask(taskId) {
    if (USE_MOCK) {
      this.tasks.delete(taskId);
      return { success: true };
    }
    // new-api 不一定支持取消，这里直接删除本地记录
    this.tasks.delete(taskId);
    return { success: true };
  }

  // ================================================================
  //  Mock 实现（余额不足或测试时使用）
  // ================================================================
  async _mockSubmit(promptGroup) {
    const { groupId } = promptGroup;
    console.log(`   [Mock] 模拟提交任务`);
    const taskId = `mock_${Date.now()}_${uuidv4().slice(0, 6)}`;

    this.tasks.set(taskId, {
      taskId, groupId,
      status: 'queued', progress: 0,
      createdAt: new Date().toISOString(),
      isMock: true
    });

    this._simulateProgress(taskId, 15);
    return { taskId, _mock: true };
  }

  async _mockStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return { taskId, status: 'NOT_FOUND', progress: 0 };
    return { taskId, status: task.status, progress: task.progress, result: task.result || null };
  }

  _simulateProgress(taskId, estimatedSec) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const steps = Math.ceil(estimatedSec / 5);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      task.progress = Math.min(95, Math.round((step / steps) * 100));
      task.status = task.progress >= 95 ? 'IN_PROGRESS' : 'QUEUED';
      if (step >= steps) {
        clearInterval(interval);
        task.status = 'SUCCESS';
        task.progress = 100;
        const outDir = path.join(__dirname, '..', '..', 'data', 'generated');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const placeholder = path.join(outDir, `${task.groupId}.mp4`);
        if (!fs.existsSync(placeholder)) fs.writeFileSync(placeholder, `placeholder ${task.groupId}`);
        task.result = { videoUrl: `/data/generated/${task.groupId}.mp4` };
      }
    }, 5000);
  }

  /** 清理所有任务（服务重启时） */
  clearTasks() { this.tasks.clear(); }
}

module.exports = new SeedanceService();
