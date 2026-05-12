/**
 * PromptReview 组件 — 提示词审核
 */

const PromptReview = {
  name: 'PromptReview',
  props: { projectId: String },
  template: `
    <div>
      <div v-if="!prompts" style="text-align:center;padding:40px;">
        <p style="margin-bottom:16px;color:var(--text-secondary);">正在构建提示词...</p>
        <button class="btn btn-primary" @click="loadOrBuild">📝 加载/构建提示词</button>
      </div>

      <div v-if="prompts">
        <!-- 全局确认 -->
        <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center;">
          <span>已确认: {{ confirmedCount }} / {{ prompts.length }}</span>
          <button class="btn btn-success btn-sm" @click="confirmAll" :disabled="confirmedCount === prompts.length">
            全部确认
          </button>
        </div>

        <div v-for="(prompt, idx) in prompts" :key="prompt.groupId" class="prompt-card">
          <div class="prompt-header">
            <span>
              <strong>{{ prompt.groupId }}</strong>
              <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">
                {{ prompt.timelineShots?.length || 0 }} 个镜头
              </span>
            </span>
            <div style="display:flex;gap:8px;align-items:center;">
              <!-- 参考图缩略图 -->
              <div class="ref-images" style="padding:0;">
                <img v-for="img in prompt.referenceImages?.slice(0, 3)" :key="img" :src="img" title="参考图"
                     @error="onImgError">
              </div>
              <button class="btn btn-sm" :class="prompt.confirmed ? 'btn-success' : 'btn-primary'"
                      @click="confirmPrompt(idx)">
                {{ prompt.confirmed ? '✅ 已确认' : '确认' }}
              </button>
            </div>
          </div>
          <textarea :value="prompt.prompt" 
                    @input="updatePrompt(idx, $event.target.value)"
                    :readonly="prompt.locked"></textarea>
          <div v-if="prompt.locked" style="padding:4px 16px;font-size:11px;color:var(--warning);background:rgba(245,158,11,0.05);">
            🔒 不可编辑（该提示词包含接点镜头）
          </div>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      prompts: null
    };
  },
  computed: {
    confirmedCount() {
      return this.prompts ? this.prompts.filter(p => p.confirmed).length : 0;
    }
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
        if (data.prompts) {
          this.prompts = data.prompts;
        }
      } catch (e) {
        console.error('加载提示词失败:', e);
      }
    },

    async loadOrBuild() {
      try {
        const data = await api.generateStoryboard(this.projectId);
        if (data.prompts) {
          this.prompts = data.prompts;
        }
      } catch (e) {
        alert('加载提示词失败: ' + e.message);
      }
    },

    async updatePrompt(idx, value) {
      if (this.prompts[idx].locked) return;
      this.prompts[idx].prompt = value;
    },

    async confirmPrompt(idx) {
      this.prompts[idx].confirmed = true;
      this.prompts[idx].locked = true;
      try {
        await api.updatePrompts(this.projectId, this.prompts);
      } catch (e) {
        console.error('确认提示词失败:', e);
      }
    },

    async confirmAll() {
      this.prompts.forEach((p, idx) => {
        p.confirmed = true;
        p.locked = true;
      });
      try {
        await api.updatePrompts(this.projectId, this.prompts);
      } catch (e) {
        console.error('全部确认失败:', e);
      }
    },

    onImgError(e) {
      e.target.style.display = 'none';
    }
  }
};
