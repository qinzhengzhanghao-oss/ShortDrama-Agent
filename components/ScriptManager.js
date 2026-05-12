/**
 * ScriptManager 组件 — 剧本上传与解析
 */

const ScriptManager = {
  name: 'ScriptManager',
  props: { projectId: String },
  template: `
    <div>
      <!-- 上传区域 -->
      <div class="upload-area" :class="{ 'has-file': uploadedFile }"
           @dragover.prevent="dragOver = true" @dragleave="dragOver = false"
           @drop.prevent="handleDrop">
        <div v-if="!uploadedFile && !parsing">
          <p style="font-size:16px;margin-bottom:8px;">📄 拖拽或点击上传剧本文件</p>
          <p style="font-size:13px;color:var(--text-secondary);">支持 TXT / PDF / DOCX 格式</p>
        </div>
        <div v-if="uploadedFile && !parsing">
          <p>✅ {{ uploadedFile.name }}</p>
          <p style="font-size:12px;color:var(--text-secondary);">大小: {{ formatSize(uploadedFile.size) }}</p>
        </div>
        <div v-if="parsing">
          <div class="loading-spinner" style="margin:0 auto;"></div>
          <p style="margin-top:8px;">正在解析剧本...</p>
        </div>
        <input type="file" ref="fileInput" accept=".txt,.pdf,.docx" style="display:none" @change="handleFileSelect">
      </div>

      <!-- 上传后按钮 -->
      <div v-if="uploadedFile && !parsing" style="margin-bottom:16px;">
        <button class="btn btn-primary" @click="parseScript" :disabled="parsing">解析剧本</button>
        <button class="btn" style="margin-left:8px;" @click="reset">重新选择</button>
      </div>

      <!-- 解析结果 -->
      <div v-if="parsed">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📋 解析结果</span>
            <span>{{ parsed.title || '未命名剧本' }}</span>
          </div>
          <div class="card" v-for="scene in parsed.scenes" :key="scene.sceneId">
            <div class="card-header">
              <span>第{{ scene.sceneId }}场: {{ scene.location }}</span>
              <span class="status-badge" :class="scene.parsed !== false ? 'status-completed' : 'status-queued'">
                {{ scene.parsed !== false ? '已解析' : '待确认' }}
              </span>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">{{ scene.summary }}</p>
            <div v-for="(d, idx) in scene.dialogue" :key="idx" style="padding:4px 0;font-size:13px;border-bottom:1px solid var(--border);">
              <strong v-if="d.character !== 'narrator'">{{ d.character }}:</strong>
              <span v-else style="color:var(--text-secondary);font-style:italic;">[旁白]</span>
              {{ d.text }}
            </div>
          </div>
        </div>

        <!-- 实体绑定 -->
        <div class="card" style="margin-top:16px;">
          <div class="card-header">
            <span class="card-title">🔗 实体绑定</span>
            <button class="btn btn-sm btn-primary" @click="autoBind">自动绑定</button>
          </div>
          <div v-for="entity in parsed.entities" :key="entity.name" 
               style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <span :style="{ color: entity.bound ? 'var(--success)' : 'var(--danger)' }">
              {{ entity.bound ? '✅' : '❌' }}
            </span>
            <span>{{ entity.name }}</span>
            <span style="color:var(--text-secondary);font-size:11px;">({{ entity.type }})</span>
            <span v-if="entity.bound" style="color:var(--success);font-size:11px;">已绑定</span>
            <div v-if="!entity.bound" style="display:flex;gap:4px;align-items:center;">
              <select v-model="entity._bindTarget" style="padding:2px 4px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;">
                <option value="">-- 选择绑定 --</option>
                <optgroup label="角色" v-if="characters.length">
                  <option v-for="c in characters" :key="c.id" :value="'characters:'+c.id">{{ c.name }}</option>
                </optgroup>
                <optgroup label="场景" v-if="scenes.length">
                  <option v-for="s in scenes" :key="s.id" :value="'scenes:'+s.id">{{ s.name }}</option>
                </optgroup>
              </select>
              <button class="btn btn-sm" @click="manualBind(entity)">绑定</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      uploadedFile: null,
      parsing: false,
      parsed: null,
      characters: [],
      scenes: [],
      dragOver: false
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
        const data = await api.getScript(this.projectId);
        if (data.parsed) {
          this.parsed = data.parsed;
          if (!this.parsed.entities) this.parsed.entities = [];
          this.parsed.entities.forEach(e => { e._bindTarget = ''; });
        }
        // 加载资产列表供绑定用
        const proj = await api.getProject(this.projectId);
        const assets = proj.project.assets || {};
        this.characters = assets.characters || [];
        this.scenes = assets.scenes || [];
        if (proj.project.script) {
          this.uploadedFile = { name: '已上传剧本', size: proj.project.script.length };
        }
      } catch (e) {
        console.error('加载剧本失败:', e);
      }
    },

    handleFileSelect(e) {
      if (e.target.files.length) {
        this.uploadedFile = e.target.files[0];
        this.parsed = null;
      }
    },

    handleDrop(e) {
      this.dragOver = false;
      if (e.dataTransfer.files.length) {
        this.uploadedFile = e.dataTransfer.files[0];
        this.parsed = null;
      }
    },

    async parseScript() {
      if (!this.uploadedFile) return;
      this.parsing = true;
      try {
        const data = await api.uploadScript(this.projectId, this.uploadedFile);
        this.parsed = data.parsed;
        if (!this.parsed.entities) this.parsed.entities = [];
        this.parsed.entities.forEach(e => { e._bindTarget = ''; });
      } catch (e) {
        alert('解析失败: ' + e.message);
      } finally {
        this.parsing = false;
      }
    },

    async autoBind() {
      for (const entity of (this.parsed?.entities || [])) {
        if (entity.bound) continue;
        // 尝试自动匹配
        const char = this.characters.find(c => c.name === entity.name);
        if (char) {
          entity._bindTarget = `characters:${char.id}`;
          await this.manualBind(entity);
        }
      }
    },

    async manualBind(entity) {
      if (!entity._bindTarget) return;
      const [type, id] = entity._bindTarget.split(':');
      try {
        await api.bindEntities(this.projectId, [
          { entityName: entity.name, entityId: id, entityType: type }
        ]);
        entity.bound = true;
        entity.boundId = id;
        entity.boundType = type;
      } catch (e) {
        console.error('绑定失败:', e);
      }
    },

    reset() {
      this.uploadedFile = null;
      this.parsed = null;
    },

    formatSize(bytes) {
      if (bytes < 1024) return bytes + 'B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
      return (bytes / 1024 / 1024).toFixed(1) + 'MB';
    }
  }
};
