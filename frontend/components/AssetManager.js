/**
 * AssetManager 组件 — 资产管理
 * v3: 实体层级即可传图 + 确认按钮
 * 角色/场景创建后直接展示图片上传区，变体为可选功能
 */

const AssetManager = {
  name: 'AssetManager',
  props: { projectId: String },
  template: `
    <div>
      <!-- ========== 角色 ========== -->
      <div class="asset-section">
        <h3>👤 角色 (Characters)</h3>
        
        <!-- 角色列表 -->
        <div v-for="(entity, eIdx) in characters" :key="entity.id" class="entity-card">
          <div class="entity-header" @click="entity._expanded = !entity._expanded">
            <span>{{ entity.name }}</span>
            <div>
              <button class="btn btn-sm" @click.stop="addVariant(entity)">+变体</button>
              <button class="btn btn-sm btn-danger" @click.stop="deleteEntity('characters', entity, eIdx)">删除</button>
            </div>
          </div>

          <div class="entity-body" v-if="entity._expanded">
            <!-- 描述 -->
            <div class="form-group">
              <label>角色描述</label>
              <textarea v-model="entity.description" @change="saveEntity(entity)" placeholder="描述角色的外观特征..."></textarea>
            </div>

            <!-- 角色本身图片 -->
            <div class="variant-images">
              <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary);">参考图片（点击设为主参考图）</label>
              <div v-for="(img, i) in entity.images" :key="i" style="position:relative;display:inline-block;">
                <img :src="img.url" :class="{ 'main-image': i === entity.mainImageIndex }"
                     @click="setEntityMainImage(entity, i)"
                     :title="i === entity.mainImageIndex ? '主参考图' : '点击设为主参考图'"
                     style="width:100px;height:100px;object-fit:cover;border-radius:6px;margin:4px;cursor:pointer;">
                <button class="btn btn-sm btn-danger" style="position:absolute;top:0;right:0;padding:0 6px;font-size:10px;line-height:18px;border-radius:0 6px 0 6px;" @click="deleteEntityImage(entity, i)">×</button>
              </div>
              <div class="upload-zone" @click="document.getElementById('entity_img_' + entity.id).click()">
                <input type="file" multiple accept="image/*" style="display:none" :id="'entity_img_' + entity.id" @change="uploadEntityImages(entity, $event)">
                + 上传图片
              </div>
            </div>

            <!-- 变体（可选） -->
            <div v-if="entity.variants && entity.variants.length > 0" style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border);">
              <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">变体</label>
              <div v-for="(variant, vIdx) in entity.variants" :key="variant.id" class="variant-item" style="padding:8px;margin-bottom:8px;background:var(--bg-code);border-radius:6px;">
                <div class="form-row" style="display:flex;gap:8px;align-items:center;">
                  <input :value="variant.name" @input="updateVariant(entity, variant, 'name', $event.target.value)" placeholder="变体名称" style="flex:1;">
                  <button class="btn btn-sm btn-danger" @click="deleteVariant(entity, vIdx)">×</button>
                </div>
                <div class="variant-images" style="margin-top:8px;">
                  <div v-for="(img, i) in variant.images" :key="i" style="position:relative;display:inline-block;">
                    <img :src="img.url" style="width:80px;height:80px;object-fit:cover;border-radius:6px;margin:4px;">
                    <button class="btn btn-sm btn-danger" style="position:absolute;top:0;right:0;padding:0 4px;font-size:8px;line-height:14px;border-radius:0 6px 0 6px;" @click="deleteVariantImage(entity, variant, i)">×</button>
                  </div>
                  <div class="upload-zone" style="width:80px;height:80px;display:inline-flex;" @click="document.getElementById('var_img_' + entity.id + '_' + variant.id).click()">
                    <input type="file" multiple accept="image/*" style="display:none" :id="'var_img_' + entity.id + '_' + variant.id" @change="uploadVariantImages(entity, variant, $event)">
                    +上传
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button class="btn btn-sm" style="margin-top:8px;" @click="addEntity('characters')">+ 添加角色</button>
        
        <!-- 角色确认 -->
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);text-align:right;">
          <button class="btn btn-primary" v-if="characters.length > 0" @click="$emit('confirm-characters')">确认角色 →</button>
          <span v-else style="color:var(--text-secondary);font-size:13px;">请先添加至少一个角色</span>
        </div>
      </div>

      <!-- ========== 场景 ========== -->
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

          <div class="entity-body" v-if="entity._expanded">
            <div class="form-group">
              <label>场景描述</label>
              <textarea v-model="entity.description" @change="saveEntity(entity)" placeholder="描述场景的外观特征..."></textarea>
            </div>

            <!-- 场景本身图片 -->
            <div class="variant-images">
              <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary);">参考图片（点击设为主参考图）</label>
              <div v-for="(img, i) in entity.images" :key="i" style="position:relative;display:inline-block;">
                <img :src="img.url" :class="{ 'main-image': i === entity.mainImageIndex }"
                     @click="setEntityMainImage(entity, i)"
                     :title="i === entity.mainImageIndex ? '主参考图' : '点击设为主参考图'"
                     style="width:100px;height:100px;object-fit:cover;border-radius:6px;margin:4px;cursor:pointer;">
                <button class="btn btn-sm btn-danger" style="position:absolute;top:0;right:0;padding:0 6px;font-size:10px;line-height:18px;border-radius:0 6px 0 6px;" @click="deleteEntityImage(entity, i)">×</button>
              </div>
              <div class="upload-zone" @click="document.getElementById('entity_img_' + entity.id).click()">
                <input type="file" multiple accept="image/*" style="display:none" :id="'entity_img_' + entity.id" @change="uploadEntityImages(entity, $event)">
                + 上传图片
              </div>
            </div>

            <!-- 变体（可选） -->
            <div v-if="entity.variants && entity.variants.length > 0" style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border);">
              <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">变体</label>
              <div v-for="(variant, vIdx) in entity.variants" :key="variant.id" class="variant-item" style="padding:8px;margin-bottom:8px;background:var(--bg-code);border-radius:6px;">
                <div class="form-row" style="display:flex;gap:8px;align-items:center;">
                  <input :value="variant.name" @input="updateVariant(entity, variant, 'name', $event.target.value)" placeholder="变体名称" style="flex:1;">
                  <button class="btn btn-sm btn-danger" @click="deleteVariant(entity, vIdx)">×</button>
                </div>
                <div class="variant-images" style="margin-top:8px;">
                  <div v-for="(img, i) in variant.images" :key="i" style="position:relative;display:inline-block;">
                    <img :src="img.url" style="width:80px;height:80px;object-fit:cover;border-radius:6px;margin:4px;">
                    <button class="btn btn-sm btn-danger" style="position:absolute;top:0;right:0;padding:0 4px;font-size:8px;line-height:14px;border-radius:0 6px 0 6px;" @click="deleteVariantImage(entity, variant, i)">×</button>
                  </div>
                  <div class="upload-zone" style="width:80px;height:80px;display:inline-flex;" @click="document.getElementById('var_img_' + entity.id + '_' + variant.id).click()">
                    <input type="file" multiple accept="image/*" style="display:none" :id="'var_img_' + entity.id + '_' + variant.id" @change="uploadVariantImages(entity, variant, $event)">
                    +上传
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button class="btn btn-sm" style="margin-top:8px;" @click="addEntity('scenes')">+ 添加场景</button>
        
        <!-- 场景确认 -->
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);text-align:right;">
          <button class="btn btn-primary" v-if="scenes.length > 0" @click="$emit('confirm-scenes')">确认场景 →</button>
          <span v-else style="color:var(--text-secondary);font-size:13px;">请先添加至少一个场景</span>
        </div>
      </div>
    </div>
  `,
  data() {
    return { characters: [], scenes: [] };
  },
  watch: {
    projectId: { immediate: true, handler(val) { if (val) this.loadAssets(); } }
  },
  methods: {
    async loadAssets() {
      try {
        const data = await api.getProject(this.projectId);
        const assets = data.project.assets || {};
        this.characters = (assets.characters || []).map(c => ({ ...c, _expanded: false, images: c.images || [] }));
        this.scenes = (assets.scenes || []).map(s => ({ ...s, _expanded: false, images: s.images || [] }));
      } catch (e) { console.error('加载资产失败:', e); }
    },

    async addEntity(type) {
      const name = prompt(`输入${type === 'characters' ? '角色' : '场景'}名称:`);
      if (!name) return;
      try {
        const data = await api.createEntity(this.projectId, type, name);
        const entity = { ...data.entity, _expanded: true, images: [], variants: [] };
        if (type === 'characters') this.characters.push(entity);
        else this.scenes.push(entity);
      } catch (e) { console.error('添加实体失败:', e); }
    },

    async deleteEntity(type, entity, index) {
      if (!confirm(`确定删除 "${entity.name}"？`)) return;
      try {
        await api.deleteEntity(this.projectId, type, entity.id);
        if (type === 'characters') this.characters.splice(index, 1);
        else this.scenes.splice(index, 1);
      } catch (e) { console.error('删除实体失败:', e); }
    },

    async saveEntity(entity) {
      try {
        await api.updateEntity(this.projectId, entity.type, entity.id, { description: entity.description });
      } catch (e) { console.error('保存描述失败:', e); }
    },

    // ---- 实体图片 ----
    async uploadEntityImages(entity, event) {
      const files = event.target.files;
      if (!files.length) return;
      try {
        const data = await api.uploadEntityImages(this.projectId, entity.type, entity.id, files);
        entity.images.push(...data.images);
      } catch (e) { console.error('上传图片失败:', e); }
      event.target.value = '';
    },

    async setEntityMainImage(entity, index) {
      entity.mainImageIndex = index;
      try {
        await api.updateEntity(this.projectId, entity.type, entity.id, { mainImageIndex: index });
      } catch (e) { console.error('设置主参考图失败:', e); }
    },

    async deleteEntityImage(entity, index) {
      try {
        await api.deleteEntityImage(this.projectId, entity.type, entity.id, index);
        entity.images.splice(index, 1);
      } catch (e) { console.error('删除图片失败:', e); }
    },

    // ---- 变体 ----
    async addVariant(entity) {
      const name = prompt('变体名称:', `变体${(entity.variants || []).length + 1}`);
      if (!name) return;
      try {
        const data = await api.createVariant(this.projectId, entity.type, entity.id, name);
        data.variant.images = [];
        if (!entity.variants) entity.variants = [];
        entity.variants.push(data.variant);
      } catch (e) { console.error('添加变体失败:', e); }
    },

    deleteVariant(entity, index) {
      entity.variants.splice(index, 1);
    },

    async updateVariant(entity, variant, field, value) {
      variant[field] = value;
      try {
        await api.updateVariant(this.projectId, entity.type, entity.id, variant.id, { [field]: value });
      } catch (e) { console.error('更新变体失败:', e); }
    },

    async uploadVariantImages(entity, variant, event) {
      const files = event.target.files;
      if (!files.length) return;
      try {
        const data = await api.uploadImages(this.projectId, entity.type, entity.id, variant.id, files);
        variant.images.push(...data.images);
      } catch (e) { console.error('上传变体图片失败:', e); }
      event.target.value = '';
    },

    deleteVariantImage(entity, variant, index) {
      variant.images.splice(index, 1);
    }
  }
};
