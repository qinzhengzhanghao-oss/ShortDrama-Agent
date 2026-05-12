/**
 * 资产管理路由 — 上传图片、管理变体
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

// 按项目+实体类型组织
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId;
    const entityType = req.params.entityType || 'misc';
    const entityId = req.params.entityId || 'temp';
    const dir = path.join(UPLOAD_DIR, projectId, entityType, entityId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`不支持的文件格式: ${ext}`));
  }
});

/** ============ 资产定义管理 ============ */

// 辅助: 加载项目资产
function loadProjectAssets(projectId) {
  const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${projectId}.json`);
  if (!fs.existsSync(projPath)) return null;
  return JSON.parse(fs.readFileSync(projPath, 'utf-8'));
}

function saveProjectAssets(project, data) {
  project.assets = data;
  project.updatedAt = new Date().toISOString();
  const projPath = path.join(__dirname, '..', '..', 'data', 'projects', `${project.id}.json`);
  fs.writeFileSync(projPath, JSON.stringify(project, null, 2), 'utf-8');
}

// POST /api/assets/:projectId/:entityType - 创建实体
router.post('/:projectId/:entityType', (req, res) => {
  try {
    const { projectId, entityType } = req.params;
    if (!['characters', 'scenes', 'props'].includes(entityType)) {
      return res.status(400).json({ error: '实体类型必须是 characters/scenes/props' });
    }
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = {
      id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: req.body.name || '未命名',
      type: entityType,
      variants: [],
      createdAt: new Date().toISOString()
    };

    project.assets[entityType].push(entity);
    saveProjectAssets(project, project.assets);
    res.json({ entity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assets/:projectId/:entityType/:entityId
router.delete('/:projectId/:entityType/:entityId', (req, res) => {
  try {
    const { projectId, entityType, entityId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const idx = project.assets[entityType].findIndex(e => e.id === entityId);
    if (idx === -1) return res.status(404).json({ error: '实体不存在' });
    project.assets[entityType].splice(idx, 1);
    saveProjectAssets(project, project.assets);

    // 清理上传文件
    const dir = path.join(UPLOAD_DIR, projectId, entityType, entityId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** ============ 实体更新 ============ */

// PATCH /api/assets/:projectId/:entityType/:entityId - 更新实体属性
router.patch('/:projectId/:entityType/:entityId', (req, res) => {
  try {
    const { projectId, entityType, entityId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });

    if (req.body.description !== undefined) entity.description = req.body.description;
    if (req.body.mainImageIndex !== undefined) entity.mainImageIndex = req.body.mainImageIndex;

    saveProjectAssets(project, project.assets);
    res.json({ entity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** ============ 实体图片上传 ============ */

// POST /api/assets/:projectId/:entityType/:entityId/upload - 上传实体图片
router.post('/:projectId/:entityType/:entityId/upload', upload.array('images', 10), (req, res) => {
  try {
    const { projectId, entityType, entityId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });

    const uploaded = req.files.map((f, i) => ({
      url: `/data/uploads/${projectId}/${entityType}/${entityId}/${f.filename}`,
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      uploadedAt: new Date().toISOString()
    }));

    if (!entity.images) entity.images = [];
    entity.images.push(...uploaded);
    saveProjectAssets(project, project.assets);
    res.json({ images: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assets/:projectId/:entityType/:entityId/images/:imageIndex - 删除实体图片
router.delete('/:projectId/:entityType/:entityId/images/:imageIndex', (req, res) => {
  try {
    const { projectId, entityType, entityId, imageIndex } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });

    const idx = parseInt(imageIndex);
    if (idx < 0 || !entity.images || idx >= entity.images.length) return res.status(400).json({ error: '图片索引无效' });

    const img = entity.images[idx];
    const filePath = path.join(UPLOAD_DIR, projectId, entityType, entityId, img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    entity.images.splice(idx, 1);
    saveProjectAssets(project, project.assets);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** ============ 变体管理 ============ */

// POST /api/assets/:projectId/:entityType/:entityId/variants - 创建变体
router.post('/:projectId/:entityType/:entityId/variants', (req, res) => {
  try {
    const { projectId, entityType, entityId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });

    const variant = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: req.body.name || '默认',
      description: req.body.description || '',
      images: [],
      mainImageIndex: 0,
      createdAt: new Date().toISOString()
    };

    entity.variants.push(variant);
    saveProjectAssets(project, project.assets);
    res.json({ variant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/assets/:projectId/:entityType/:entityId/variants/:variantId
router.patch('/:projectId/:entityType/:entityId/variants/:variantId', (req, res) => {
  try {
    const { projectId, entityType, entityId, variantId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });

    const variant = entity.variants.find(v => v.id === variantId);
    if (!variant) return res.status(404).json({ error: '变体不存在' });

    if (req.body.name !== undefined) variant.name = req.body.name;
    if (req.body.description !== undefined) variant.description = req.body.description;
    if (req.body.mainImageIndex !== undefined) variant.mainImageIndex = req.body.mainImageIndex;

    saveProjectAssets(project, project.assets);
    res.json({ variant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** ============ 图片上传 ============ */

// POST /api/assets/:projectId/:entityType/:entityId/variants/:variantId/upload
router.post('/:projectId/:entityType/:entityId/variants/:variantId/upload', upload.array('images', 10), (req, res) => {
  try {
    const { projectId, entityType, entityId, variantId } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });
    const variant = entity.variants.find(v => v.id === variantId);
    if (!variant) return res.status(404).json({ error: '变体不存在' });

    const uploaded = req.files.map((f, i) => ({
      url: `/data/uploads/${projectId}/${entityType}/${entityId}/${f.filename}`,
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      uploadedAt: new Date().toISOString()
    }));

    variant.images.push(...uploaded);
    saveProjectAssets(project, project.assets);
    res.json({ images: uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assets/:projectId/:entityType/:entityId/variants/:variantId/images/:imageIndex
router.delete('/:projectId/:entityType/:entityId/variants/:variantId/images/:imageIndex', (req, res) => {
  try {
    const { projectId, entityType, entityId, variantId, imageIndex } = req.params;
    const project = loadProjectAssets(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const entity = project.assets[entityType].find(e => e.id === entityId);
    if (!entity) return res.status(404).json({ error: '实体不存在' });
    const variant = entity.variants.find(v => v.id === variantId);
    if (!variant) return res.status(404).json({ error: '变体不存在' });

    const idx = parseInt(imageIndex);
    if (idx < 0 || idx >= variant.images.length) return res.status(400).json({ error: '图片索引无效' });

    const img = variant.images[idx];
    const filePath = path.join(UPLOAD_DIR, projectId, entityType, entityId, img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    variant.images.splice(idx, 1);
    if (variant.mainImageIndex >= variant.images.length) variant.mainImageIndex = Math.max(0, variant.images.length - 1);

    saveProjectAssets(project, project.assets);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
