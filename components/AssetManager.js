/**
 * AssetManager 组件 — 资产管理
 */

const AssetManager = {
  name: 'AssetManager',
  props: { projectId: String },
  template: `
    <div>
      <!-- 角色 -->
      <div class="asset-section">
        <h3>👤 角色 (Characters)</h3>
        <div v-for="(entity, eIdx) in characters" :key="entity.id" class="entity-card">
          <div class="entity-header" @click="entity._expanded = !entity._expanded">
            <span>{{ entity.name }}</span>
            <div>
              <button class="btn btn-sm" @click.stop="addVariant(entity)">+变体</button>
              <button class="btn btn-sm btn-danger" @click.stop="deleteEntity('characters', entity, eIdx)">删除</button>
            </div>
          </div>
          <div class="variant-list" v-if="entity._expanded">
            <div v-for="(variant, vIdx) in entity.variants" :key="variant.id" class="variant-item">
              <div class="form-group">
                <label>变体名称</label>
                <input :value="variant.name" @input="updateVariant(entity, variant, 'name', $event.target.value)" placeholder="如: 日常装、西装">
              </div>
              <div class="form-group">
                <label>外观描述</label>
                <textarea :value="variant.description" @input="updateVariant(entity, variant, 'description', $event.target.value)" placeholder="描述该变体的外观特征..."></textarea>
              </div>
              <div class="variant-images">
                <div v-for="(img, i) in variant.images" :key="i" style="position:relative;">
                  <img :src="img.url" :class="{ 'main-image': i === variant.mainImageIndex }" 
                       @click="setMainImage(entity, variant, i)" :title="i === variant.mainImageIndex ? '主参考图' : '点击设为主参考图'">
                  <button class="btn btn-sm btn-danger" style="position:absolute;top:-4px;right:-4px;padding:0 4px;font-size:10px;line-height:16px;" @click="deleteImage(entity, variant, i)">×</button>
                </div>
                <div class="upload-zone" @click="document.getElementById('char_upload_' + entity.id + '_' + variant.id).click()">
                  <input type="file" multiple accept="image/*" style="display:none"
                         :id="'char_upload_' + entity.id + '_' + variant.id"
                         @change="uploadImages(entity, variant, $event)">
                  + 上传图片
                </div>
              </div>
      </div>

      <!-- 场景 -->
      <div class="asset-section">
        <h3>🏠 场景 (Scenes)</h3>
        <div v-for="(entity, eIdx) in scenes" :key="entity.id" class="entity-card">
          <div class="entity-header" @click="entity._expanded = !entity._expanded">
            <span>{{ entity.name }}</span>
            <div>
              <button class="btn btn-sm" @click.stop="addVariant(entity)">+变体</button>
              <button class="btn btn-sm btn-danger" @click.stop="deleteEntity('scenes', entity, eIdx)">删除</button>
            </div>
          </div>
          <div class="variant-list" v-if="entity._expanded">
            <div v-for="(variant, vIdx) in entity.variants" :key="variant.id" class="variant-item">
              <div class="form-group">
                <label>变体名称</label>
                <input :value="variant.name" @input="updateVariant(entity, variant, 'name', $event.target.value)" placeholder="如: 白天、夜晚">
              </div>
              <div class="form-group">
                <label>场景描述</label>
                <textarea :value="variant.description" @input="updateVariant(entity, variant, 'description', $event.target.value)" placeholder="描述该场景的外观特征..."></textarea>
              </div>
              <div class="variant-images">
                <div v-for="(img, i) in variant.images" :key="i" style="position:relative;">
                  <img :src="img.url" :class="{ 'main-image': i === variant.mainImageIndex }"
                       @click="setMainImage(entity, variant, i)" :title="i === variant.mainImageIndex ? '主参考图' : '点击设为主参考图'">
                  <button class="btn btn-sm btn-danger" style="position:absolute;top:-4px;right:-4px;padding:0 4px;font-size:10px;line-height:16px;" @click="deleteImage(entity, variant, i)">×</button>
                </div>
                <div class="upload-zone" @click="document.getElementById('scene_upload_' + entity.id + '_' + variant.id).click()">
                  <input type="file" multiple accept="image/*" style="display:none"
                         :id="'scene_upload_' + entity.id + '_' + variant.id"
                         @change="uploadImages(entity, variant, $event)">
                  + 上传图片
                </div>
              </div>,
  data() {
    return {
      characters: [],
      scenes: [],
      props: []
    };
  },
  watch: {
    projectId: {
      immediate: true,
      handler(val) {
        if (val) this.loadAssets();
      }
    }
  },
  methods: {
    async loadAssets() {
      try {
        const data = await api.getProject(this.projectId);
        const assets = data.project.assets || {};
        this.characters = (assets.characters || []).map(c => ({ ...c, _expanded: false }));
        this.scenes = (assets.scenes || []).map(s => ({ ...s, _expanded: false }));
        this.props = (assets.props || []).map(p => ({ ...p, _expanded: false }));
      } catch (e) {
        console.error('加载资产失败:', e);
      }
    },

    async addEntity(type) {
      const name = prompt(`输入${type === 'characters' ? '角色' : type === 'scenes' ? '场景' : '道具'}名称:`);
      if (!name) return;
      try {
        const data = await api.createEntity(this.projectId, type, name);
        const entity = { ...data.entity, _expanded: true, variants: [] };
        if (type === 'characters') this.characters.push(entity);
        else if (type === 'scenes') this.scenes.push(entity);
        // 自动添加默认变体
        await this.addVariant(entity);
      } catch (e) {
        console.error('添加实体失败:', e);
      }
    },

    async deleteEntity(type, entity, index) {
      if (!confirm(`确定删除 "${entity.name}"？`)) return;
      try {
        await api.deleteEntity(this.projectId, type, entity.id);
        if (type === 'characters') this.characters.splice(index, 1);
        else if (type === 'scenes') this.scenes.splice(index, 1);
      } catch (e) {
        console.error('删除实体失败:', e);
      }
    },

    async addVariant(entity) {
      const name = prompt('变体名称:', entity.variants.length === 0 ? '默认' : `变体${entity.variants.length + 1}`);
      if (!name) return;
      try {
        const data = await api.createVariant(this.projectId, entity.type, entity.id, name);
        data.variant.images = [];
        entity.variants.push(data.variant);
      } catch (e) {
        console.error('添加变体失败:', e);
      }
    },

    async updateVariant(entity, variant, field, value) {
      variant[field] = value;
      try {
        await api.updateVariant(this.projectId, entity.type, entity.id, variant.id, { [field]: value });
      } catch (e) {
        console.error('更新变体失败:', e);
      }
    },

    triggerUpload: null, // 不再使用 inline click 替代了

    async uploadImages(entity, variant, event) {
      const files = event.target.files;
      if (!files.length) return;
      try {
        const data = await api.uploadImages(this.projectId, entity.type, entity.id, variant.id, files);
        variant.images.push(...data.images);
      } catch (e) {
        console.error('上传图片失败:', e);
      }
      event.target.value = '';
    },

    async setMainImage(entity, variant, index) {
      variant.mainImageIndex = index;
      try {
        await api.updateVariant(this.projectId, entity.type, entity.id, variant.id, { mainImageIndex: index });
      } catch (e) {
        console.error('设置主参考图失败:', e);
      }
    },

    async deleteImage(entity, variant, index) {
      try {
        await api.deleteImage(this.projectId, entity.type, entity.id, variant.id, index);
        variant.images.splice(index, 1);
      } catch (e) {
        console.error('删除图片失败:', e);
      }
    }
  }
};
