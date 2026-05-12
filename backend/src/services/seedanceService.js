/**
 * Seedance 视频生成服务（真实 API）
 * 
 * 通过 New API（https://metamind.yun）调用 Seedance 视频生成
 * 接口格式兼容 OpenAI，异步任务模式
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
    this.tasks = new Map();
    
    if (!USE_MOCK) {
      console.log(`🎬 Seedance 已配置: ${this.apiEndpoint} / ${this.defaultModel}`);
    }
  }

  /**
   * 提交视频生成任务
   * @param {object} promptGroup - { groupId, shots, referenceImages, prompts }
   * @returns {Promise<{ taskId: string }>}
   */
  async submitTask(promptGroup) {
    if (USE_MOCK) {
      console.log(`\n🎬 [Mock Seedance] 提交生成任务: ${promptGroup.groupId}`);
      return this.mockSubmit(promptGroup);
    }

    const promptText = typeof promptGroup.prompts === 'string' 
      ? promptGroup.prompts 
      : this.buildPromptText(promptGroup);

    const totalDuration = promptGroup.shots.reduce((s, sh) => s + (sh.duration || 4), 0);

    // 构建请求体
    const requestBody = {
      model: this.defaultModel,
      prompt: promptText,
      size: '1536x1024',
      duration: Math.min(totalDuration, 15),
      n: 1
    };

    // 如果有参考图，加入
    if (promptGroup.referenceImages && promptGroup.referenceImages.length > 0) {
      // 参考图作为 prompt 的一部分描述
      const refText = promptGroup.referenceImages.slice(0, 5).join(', ');
      requestBody.reference_images = promptGroup.referenceImages.slice(0, 5);
    }

    console.log(`\n🎬 [Seedance] 提交任务: ${promptGroup.groupId}`);
    console.log(`   模型: ${this.defaultModel}, 时长: ${totalDuration}s`);
    console.log(`   参考图: ${promptGroup.referenceImages?.length || 0}张`);

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
      
      // 保存任务信息
      this.tasks.set(taskId, {
        taskId,
        groupId: promptGroup.groupId,
        status: result.status || 'queued',
        progress: result.progress || 0,
        createdAt: new Date().toISOString(),
        promptGroup
      });

      console.log(`   ✅ 任务已提交: ${taskId}`);
      return { taskId };
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
      console.error(`   ❌ 提交失败: ${errMsg}`);
      throw new Error(`视频生成提交失败: ${errMsg}`);
    }
  }

  /**
   * 查询任务状态
   * @param {string} taskId
   * @returns {Promise<{ status, progress, result? }>}
   */
  async getTaskStatus(taskId) {
    if (USE_MOCK) {
      return this.mockStatus(taskId);
    }

    try {
      const resp = await axios.get(
        `${this.apiEndpoint}/v1/video/tasks/${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 15000
        }
      );

      const data = resp.data;
      const status = data.status || 'unknown';
      const progress = data.progress || 0;

      // 更新内存状态
      if (this.tasks.has(taskId)) {
        const task = this.tasks.get(taskId);
        task.status = status;
        task.progress = progress;
        if (status === 'completed' || status === 'succeeded') {
          task.result = {
            videoUrl: data.output?.[0] || data.video_url || data.url || data.result?.[0],
            duration: data.duration || 15,
            resolution: data.resolution || '1536x1024'
          };
        }
      }

      return {
        taskId,
        status,
        progress,
        result: this.tasks.get(taskId)?.result || null,
        error: data.error || null
      };
    } catch (err) {
      console.error(`   ❌ 查询任务失败: ${taskId}`, err.message);
      return { taskId, status: 'unknown', progress: 0, error: err.message };
    }
  }

  /**
   * 构建提示词文本
   */
  buildPromptText(promptGroup) {
    const lines = [];
    const shots = promptGroup.shots || [];
    
    shots.forEach((shot, idx) => {
      const startTime = shots.slice(0, idx).reduce((s, sh) => s + (sh.duration || 0), 0);
      const endTime = startTime + (shot.duration || 0);
      
      lines.push(`[${startTime.toFixed(1)}s-${endTime.toFixed(1)}s]`);
      lines.push(`镜头: ${shot.shotType || '中景'} | 运镜: ${shot.camera || '固定'}`);
      if (shot.characters?.length) lines.push(`角色: ${shot.characters.join(', ')}`);
      if (shot.actions) lines.push(`动作: ${shot.actions}`);
      if (shot.facialAU) lines.push(`表情: ${shot.facialAU} (${shot.expression || ''})`);
      if (shot.dialogue) lines.push(`台词: ${shot.dialogue}`);
      if (shot.sound) lines.push(`音效: ${shot.sound}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  // ============ Mock 实现 ============

  async mockSubmit(promptGroup) {
    console.log(`   [Mock] 模型: ${this.defaultModel}`);
    const taskId = `task_${Date.now()}_${uuidv4().slice(0, 6)}`;
    
    this.tasks.set(taskId, {
      taskId, groupId: promptGroup.groupId,
      status: 'queued', progress: 0,
      createdAt: new Date().toISOString(),
      promptGroup
    });

    this.simulateProgress(taskId, 15);
    return { taskId };
  }

  async mockStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return { status: 'not_found', progress: 0 };
    return {
      taskId,
      status: task.status,
      progress: task.progress,
      result: task.result || null,
      error: task.error || null
    };
  }

  simulateProgress(taskId, estimatedSec) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const steps = Math.ceil(estimatedSec / 5);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      task.progress = Math.min(95, Math.round((step / steps) * 100));
      task.status = task.progress >= 95 ? 'generating_final' : 'generating';
      if (step >= steps) {
        clearInterval(interval);
        task.status = 'completed';
        task.progress = 100;
        task.result = {
          videoUrl: `/data/generated/${task.groupId}.mp4`,
          duration: 15,
          resolution: '1536x1024'
        };
        const outDir = path.join(__dirname, '..', '..', 'data', 'generated');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const placeholder = path.join(outDir, `${task.groupId}.mp4`);
        if (!fs.existsSync(placeholder)) {
          fs.writeFileSync(placeholder, `# ${task.groupId} placeholder`);
        }
      }
    }, 5000);
  }
}

module.exports = new SeedanceService();
