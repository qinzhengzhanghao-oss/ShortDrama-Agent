/**
 * GenerationDashboard 组件 — 视频生成进度与下载
 */

const GenerationDashboard = {
  name: 'GenerationDashboard',
  props: { projectId: String },
  template: `
    <div>
      <!-- 概览 -->
      <div class="dashboard-overview">
        <div class="stat-card">
          <div class="stat-value" style="color:var(--primary);">{{ totalGroups }}</div>
          <div class="stat-label">总组数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success);">{{ completedGroups }}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--warning);">{{ generatingGroups }}</div>
          <div class="stat-label">生成中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--danger);">{{ failedGroups }}</div>
          <div class="stat-label">失败</div>
        </div>
      </div>

      <!-- 全局进度条 -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>全局进度</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div v-if="estimatedTimeRemaining" style="font-size:12px;color:var(--text-secondary);">
          预计剩余: {{ estimatedTimeRemaining }}
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-for="group in groupList" :key="group.groupId" class="task-card">
        <div class="task-header">
          <div>
            <strong>{{ group.groupId }}</strong>
            <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">
              {{ group.shotCount }} 个镜头
            </span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="status-badge" :class="'status-' + group.status">
              {{ statusLabel(group.status) }}
            </span>
            <button v-if="group.status === 'failed'" class="btn btn-sm btn-warning" @click="retryGroup(group.groupId)">重试</button>
            <button v-if="group.status === 'completed' && group.result" class="btn btn-sm btn-success" @click="downloadSingle(group)">下载</button>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar" v-if="group.status === 'generating' || group.status === 'queued'">
          <div class="progress-fill" :style="{ width: group.progress + '%' }"></div>
        </div>

        <!-- 错误信息 -->
        <div v-if="group.error" style="color:var(--danger);font-size:12px;padding:4px 0;">
          ❌ {{ group.error }}
        </div>

        <!-- 预览 -->
        <div v-if="group.status === 'completed' && group.result" style="margin-top:8px;">
          <video :src="group.result.videoUrl" controls style="max-width:320px;border-radius:4px;" 
                 @error="onVideoError">
            您的浏览器不支持视频播放
          </video>
        </div>
      </div>

      <!-- 下载管理 -->
      <div class="card" style="margin-top:20px;" v-if="completedGroups > 0">
        <div class="card-header">
          <span class="card-title">📥 下载管理</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" @click="downloadAllZIP">📦 下载全部 (ZIP)</button>
          <button class="btn" @click="downloadManifest">📋 下载 Manifest</button>
        </div>

        <!-- 自动下载设置 -->
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" v-model="autoDownload">
            开启自动下载（生成完成后自动保存）
          </label>
          <div v-if="autoDownload" style="margin-top:8px;">
            <button class="btn btn-sm" @click="selectDownloadFolder">
              📁 {{ downloadFolder || '选择保存文件夹...' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      groups: [],
      taskId: null,
      autoDownload: false,
      downloadFolder: '',
      pollTimer: null
    };
  },
  computed: {
    totalGroups() { return this.groups.length; },
    completedGroups() { return this.groups.filter(g => g.status === 'completed').length; },
    generatingGroups() { return this.groups.filter(g => g.status === 'generating' || g.status === 'queued').length; },
    failedGroups() { return this.groups.filter(g => g.status === 'failed').length; },
    progressPercent() {
      if (this.totalGroups === 0) return 0;
      const done = this.groups.filter(g => g.status === 'completed').length;
      const inprog = this.groups.filter(g => g.status === 'generating').length;
      return Math.round(((done + inprog * 0.5) / this.totalGroups) * 100);
    },
    estimatedTimeRemaining() {
      const gen = this.groups.filter(g => g.status === 'generating' || g.status === 'queued');
      if (gen.length === 0) return '';
      const elapsed = Date.now() - (this._startTime || Date.now());
      const done = this.completedGroups;
      if (done === 0) return '计算中...';
      const avg = elapsed / done;
      const remaining = Math.round((avg * gen.length) / 1000);
      if (remaining < 60) return `${remaining}秒`;
      return `${Math.round(remaining / 60)}分钟`;
    },
    groupList() {
      return this.groups;
    }
  },
  watch: {
    projectId: {
      immediate: true,
      handler(val) {
        if (val) {
          this.loadExisting();
          this.startPolling();
        }
      }
    }
  },
  mounted() {
    this._startTime = Date.now();
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    async loadExisting() {
      try {
        const data = await api.getTaskStatus(this.projectId);
        const tasks = data.tasks || [];
        if (tasks.length > 0) {
          const task = tasks[0];
          this.taskId = task.taskId;
          this.groups = (task.groups || []).map(g => ({
            ...g,
            shotCount: 0
          }));
        }
      } catch (e) {
        console.error('加载任务状态失败:', e);
      }
    },

    startPolling() {
      this.pollTimer = setInterval(() => this.loadExisting(), 5000);
    },

    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },

    async retryGroup(groupId) {
      try {
        await api.retryGroup(this.projectId, groupId);
      } catch (e) {
        console.error('重试失败:', e);
      }
    },

    downloadSingle(group) {
      const url = group.result?.videoUrl || `/data/generated/${group.groupId}.mp4`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${group.groupId}.mp4`;
      a.click();
    },

    downloadAllZIP() {
      api.downloadZip(this.projectId);
    },

    downloadManifest() {
      api.downloadManifest(this.projectId);
    },

    async selectDownloadFolder() {
      try {
        // File System Access API
        const dirHandle = await window.showDirectoryPicker();
        this.downloadFolder = dirHandle.name;
        // 保存目录句柄供后续自动下载使用
        this._dirHandle = dirHandle;
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('选择文件夹失败:', e);
        }
      }
    },

    onVideoError(e) {
      e.target.style.display = 'none';
      const parent = e.target.parentElement;
      if (parent) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color:var(--text-secondary);font-size:12px;';
        msg.textContent = '⏳ 视频暂不可用（Mock 模式下为占位文件）';
        parent.appendChild(msg);
      }
    },

    statusLabel(status) {
      const labels = {
        queued: '排队中',
        generating: '生成中',
        generating_final: '合成中',
        completed: '已完成',
        failed: '失败',
        not_found: '未找到'
      };
      return labels[status] || status;
    }
  }
};
