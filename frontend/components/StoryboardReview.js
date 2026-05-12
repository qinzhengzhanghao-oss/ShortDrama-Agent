/**
 * StoryboardReview 组件 — 分镜审核与编组
 */

const StoryboardReview = {
  name: 'StoryboardReview',
  props: { projectId: String },
  template: `
    <div>
      <!-- 生成按钮 -->
      <div v-if="!storyboard" style="text-align:center;padding:40px;">
        <p style="margin-bottom:16px;color:var(--text-secondary);">剧本已解析完毕，准备生成分镜脚本</p>
        <button class="btn btn-primary" @click="generate" :disabled="generating">
          {{ generating ? '生成中...' : '🎬 生成分镜脚本' }}
        </button>
      </div>

      <!-- 分镜显示 -->
      <div v-if="storyboard">
        <!-- 编组列表 -->
        <div v-for="group in groups" :key="group.groupId" class="group-section">
          <div class="group-header" :class="{ 'over-time': group.totalDuration > 15, 'bridge': hasBridge(group) }"
               @click="group._expanded = !group._expanded">
            <div>
              <strong>{{ group.groupId }}</strong>
              <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">
                {{ group.shots.length }} 个镜头 | {{ group.totalDuration }}秒
              </span>
              <span v-if="group.totalDuration > 15" style="margin-left:8px;color:var(--warning);font-size:12px;">
                ⚠️ 超时 (最大15秒)
              </span>
              <span v-if="hasBridge(group)" style="margin-left:8px;color:var(--primary);font-size:12px;">
                🔗 含接点镜头
              </span>
            </div>
            <span>{{ group._expanded ? '收起' : '展开' }}</span>
          </div>

          <div v-if="group._expanded" class="shot-list">
            <div v-for="shot in group.shots" :key="shot.id" class="shot-card">
              <div class="shot-number">{{ shot.id }}</div>
              <div class="shot-content">
                <div class="meta">
                  <span class="tag">{{ shot.shotType }}</span>
                  <span class="tag">{{ shot.camera }}</span>
                  <span class="tag">{{ shot.duration }}秒</span>
                  <span class="tag warning" v-if="shot.isBridgeShot">🔒 接点镜头</span>
                </div>
                <div style="font-size:13px;margin-bottom:4px;">
                  <span v-if="shot.characters && shot.characters.length">{{ shot.characters.join(', ') }} | </span>
                  {{ shot.scene }}
                </div>
                <div style="font-size:13px;color:var(--text-secondary);">{{ shot.actions }}</div>
                <div v-if="shot.dialogue" style="font-size:12px;color:var(--warning);margin-top:4px;">
                  💬 {{ shot.dialogue }}
                </div>
                <div v-if="shot.sound" style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                  🔊 {{ shot.sound }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 确认按钮 -->
        <div style="margin-top:20px;display:flex;gap:8px;">
          <button class="btn" @click="regenerate">重新生成</button>
          <button class="btn btn-primary" @click="confirmAndBuildPrompts">✅ 确认分镜，构建提示词</button>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      storyboard: null,
      groups: [],
      generating: false
    };
  },
  watch: {
    projectId: {
      immediate: true,
      handler(val) {
        if (val) this.loadExisting();
      }
    }
  },
  methods: {
    async loadExisting() {
      try {
        const data = await api.getStoryboard(this.projectId);
        if (data.storyboard) {
          this.storyboard = data.storyboard;
          this.groups = (data.groups || []).map(g => ({ ...g, _expanded: true }));
        }
      } catch (e) {
        console.error('加载分镜失败:', e);
      }
    },

    async generate() {
      this.generating = true;
      try {
        const data = await api.generateStoryboard(this.projectId);
        this.storyboard = data.storyboard;
        this.groups = (data.groups || []).map(g => ({ ...g, _expanded: true }));
      } catch (e) {
        alert('生成分镜失败: ' + e.message);
      } finally {
        this.generating = false;
      }
    },

    async regenerate() {
      if (confirm('重新生成将覆盖当前分镜，确定？')) {
        await this.generate();
      }
    },

    async confirmAndBuildPrompts() {
      // 确保所有组展开以便看到提示词
      this.groups.forEach(g => { g._expanded = true; });
      // 更新项目状态
      await api.updateProject(this.projectId, { status: 'storyboard_ready' });
    },

    hasBridge(group) {
      return group.shots.some(s => s.isBridgeShot);
    }
  }
};
