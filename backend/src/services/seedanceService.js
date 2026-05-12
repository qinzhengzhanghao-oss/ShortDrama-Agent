/**
 * Seedance 视频生成服务（模拟实现）
 * 
 * 真实接入时：
 * 1. 将 USE_MOCK 改为 false
 * 2. 填写真实 API endpoint、鉴权方式
 * 3. 按实际请求/响应格式调整 submitTask / getTaskStatus
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const USE_MOCK = true;

class SeedanceService {
  constructor() {
    this.apiEndpoint = process.env.SEEDANCE_API_URL || 'https://api.seedance.io/v1';
    this.apiKey = process.env.SEEDANCE_API_KEY || '';
    this.tasks = new Map(); // 内存中的任务状态
  }

  /**
   * 提交视频生成任务
   * @param {object} promptGroup - 提示词组 { groupId, shots, referenceImages, prompts }
   * @returns {Promise<{ taskId: string }>}
   */
  async submitTask(promptGroup) {
    if (USE_MOCK) {
      console.log(`\n🎬 [Mock Seedance] 提交生成任务: ${promptGroup.groupId}`);
      console.log(`   包含 ${promptGroup.shots.length} 个镜头`);
      console.log(`   参考图: ${promptGroup.referenceImages?.length || 0} 张`);

      const taskId = `task_${Date.now()}_${uuidv4().slice(0, 6)}`;
      const mockTask = {
        taskId,
        groupId: promptGroup.groupId,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
        estimatedSeconds: 30 + Math.random() * 60
      };

      this.tasks.set(taskId, {
        ...mockTask,
        promptGroup
      });

      // 模拟异步完成
      this.simulateProgress(taskId, mockTask.estimatedSeconds);

      return { taskId };
    }

    // 真实 API 调用
    // const response = await axios.post(`${this.apiEndpoint}/generate`, {
    //   prompt: this.buildPrompt(promptGroup),
    //   reference_images: promptGroup.referenceImages,
    //   duration: promptGroup.shots.reduce((s, sh) => s + sh.duration, 0),
    //   // ... 其他参数
    // }, {
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
    // });
    // return { taskId: response.data.task_id };

    throw new Error('Seedance API 未配置');
  }

  /**
   * 查询任务状态
   * @param {string} taskId
   * @returns {Promise<{ status, progress, result?}>}
   */
  async getTaskStatus(taskId) {
    if (USE_MOCK) {
      const task = this.tasks.get(taskId);
      if (!task) return { status: 'not_found' };
      return {
        taskId,
        status: task.status,
        progress: task.progress,
        result: task.result || null,
        error: task.error || null
      };
    }

    // 真实 API
    // const resp = await axios.get(`${this.apiEndpoint}/tasks/${taskId}`, {
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
    // });
    // return resp.data;
  }

  /**
   * 模拟进度（Mock 用）
   */
  simulateProgress(taskId, estimatedSec) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const steps = Math.ceil(estimatedSec / 5); // 每5秒更新一次
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = Math.min(95, Math.round((step / steps) * 100));

      const task_ = this.tasks.get(taskId);
      if (!task_) { clearInterval(interval); return; }

      task_.progress = progress;
      task_.status = progress >= 95 ? 'generating_final' : 'generating';

      if (step >= steps) {
        clearInterval(interval);
        task_.status = 'completed';
        task_.progress = 100;
        task_.result = {
          videoUrl: `/data/generated/${task_.groupId}.mp4`,
          duration: 15,
          resolution: '1536x1024'
        };
        // 创建一个占位视频文件
        const outDir = path.join(__dirname, '..', '..', 'data', 'generated');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const placeholder = path.join(outDir, `${task_.groupId}.mp4`);
        if (!fs.existsSync(placeholder)) {
          fs.writeFileSync(placeholder, `# ${task_.groupId} placeholder video`);
        }
        console.log(`   ✅ [Mock Seedance] ${task_.groupId} 生成完成`);
      }
    }, 5000);
  }
}

module.exports = new SeedanceService();
