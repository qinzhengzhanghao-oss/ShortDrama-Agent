/**
 * ShortDrama-Agent API 封装
 * 配置 API_BASE_URL 指向本地后端
 */

// API 后端地址
// 本地开发：http://localhost:3000
// 内网穿透：https://xxx.ngrok-free.app
// 部署后：通过 query 参数 ?api=http://xxx 覆盖
const API_BASE_URL = (() => {
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get('api');
  if (apiParam) return apiParam + '/api';
  return 'http://localhost:3000/api';
})();

const api = {
  // ============ 项目 ============
  async listProjects() {
    const resp = await fetch(`${API_BASE_URL}/projects`);
    return resp.json();
  },

  async getProject(id) {
    const resp = await fetch(`${API_BASE_URL}/projects/${id}`);
    return resp.json();
  },

  async createProject(name, style = '真人') {
    const resp = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, style })
    });
    return resp.json();
  },

  async updateProject(id, data) {
    const resp = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return resp.json();
  },

  async deleteProject(id) {
    const resp = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
    return resp.json();
  },

  // ============ 资产 ============
  async createEntity(projectId, entityType, name) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    return resp.json();
  },

  async deleteEntity(projectId, entityType, entityId) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}`, {
      method: 'DELETE'
    });
    return resp.json();
  },

  async updateEntity(projectId, entityType, entityId, data) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return resp.json();
  },

  async uploadEntityImages(projectId, entityType, entityId, files) {
    const formData = new FormData();
    for (const f of files) formData.append('images', f);
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/upload`, {
      method: 'POST',
      body: formData
    });
    return resp.json();
  },

  async deleteEntityImage(projectId, entityType, entityId, imageIndex) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/images/${imageIndex}`, {
      method: 'DELETE'
    });
    return resp.json();
  },

  async createVariant(projectId, entityType, entityId, name, description = '') {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    return resp.json();
  },

  async updateVariant(projectId, entityType, entityId, variantId, data) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return resp.json();
  },

  async uploadImages(projectId, entityType, entityId, variantId, files) {
    const formData = new FormData();
    for (const f of files) {
      formData.append('images', f);
    }
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/variants/${variantId}/upload`, {
      method: 'POST',
      body: formData
    });
    return resp.json();
  },

  async deleteImage(projectId, entityType, entityId, variantId, imageIndex) {
    const resp = await fetch(`${API_BASE_URL}/assets/${projectId}/${entityType}/${entityId}/variants/${variantId}/images/${imageIndex}`, {
      method: 'DELETE'
    });
    return resp.json();
  },

  // ============ 剧本 ============
  async uploadScript(projectId, file) {
    const formData = new FormData();
    formData.append('script', file);
    const resp = await fetch(`${API_BASE_URL}/scripts/${projectId}/upload`, {
      method: 'POST',
      body: formData
    });
    return resp.json();
  },

  async getScript(projectId) {
    const resp = await fetch(`${API_BASE_URL}/scripts/${projectId}`);
    return resp.json();
  },

  async bindEntities(projectId, bindings) {
    const resp = await fetch(`${API_BASE_URL}/scripts/${projectId}/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bindings })
    });
    return resp.json();
  },

  // ============ 分镜 ============
  async generateStoryboard(projectId) {
    const resp = await fetch(`${API_BASE_URL}/storyboard/${projectId}/generate`, {
      method: 'POST'
    });
    return resp.json();
  },

  async getStoryboard(projectId) {
    const resp = await fetch(`${API_BASE_URL}/storyboard/${projectId}`);
    return resp.json();
  },

  async updateStoryboard(projectId, data) {
    const resp = await fetch(`${API_BASE_URL}/storyboard/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return resp.json();
  },

  async updatePrompts(projectId, prompts) {
    const resp = await fetch(`${API_BASE_URL}/storyboard/${projectId}/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts })
    });
    return resp.json();
  },

  // ============ 生成 ============
  async submitGeneration(projectId, concurrency = 3) {
    const resp = await fetch(`${API_BASE_URL}/generate/${projectId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency })
    });
    return resp.json();
  },

  async getTaskStatus(projectId) {
    const resp = await fetch(`${API_BASE_URL}/generate/${projectId}/tasks`);
    return resp.json();
  },

  async getTaskDetail(projectId, taskId) {
    const resp = await fetch(`${API_BASE_URL}/generate/${projectId}/task/${taskId}`);
    return resp.json();
  },

  async retryGroup(projectId, groupId) {
    const resp = await fetch(`${API_BASE_URL}/generate/${projectId}/retry/${groupId}`, {
      method: 'POST'
    });
    return resp.json();
  },

  async getManifest(projectId) {
    const resp = await fetch(`${API_BASE_URL}/generate/${projectId}/manifest`);
    return resp.json();
  },

  downloadManifest(projectId) {
    window.open(`${API_BASE_URL}/generate/${projectId}/manifest/download`);
  },

  downloadZip(projectId) {
    window.open(`${API_BASE_URL}/generate/${projectId}/zip`);
  }
};
