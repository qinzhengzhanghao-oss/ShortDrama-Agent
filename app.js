/**
 * ShortDrama-Agent 主应用
 */

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {
    // ============ 状态 ============
    const loading = ref(true);
    const projects = ref([]);
    const currentProjectId = ref('');
    const currentStep = ref('assets');
    const showNewProjectModal = ref(false);
    const newProjectName = ref('');
    const newProjectStyle = ref('真人');
    const projectStatus = ref({});

    // 步骤定义
    const steps = [
      { id: 'assets',    icon: '📦', label: '资产管理',      enabled: (pid) => !!pid },
      { id: 'script',    icon: '📄', label: '剧本解析',      enabled: (pid, st) => !!pid && st.assetsValid },
      { id: 'storyboard',icon: '🎞️', label: '分镜审核',      enabled: (pid, st) => !!pid && st.scriptReady },
      { id: 'prompts',   icon: '📝', label: '提示词审核',    enabled: (pid, st) => !!pid && st.storyboardReady },
      { id: 'generate',  icon: '⚡', label: '视频生成',      enabled: (pid, st) => !!pid && st.promptsConfirmed },
    ];

    // ============ 生命周期 ============
    onMounted(async () => {
      await loadProjects();
      loading.value = false;
    });

    // ============ 方法 ============
    async function loadProjects() {
      try {
        const data = await api.listProjects();
        projects.value = data.projects || [];
      } catch (e) {
        console.error('加载项目失败:', e);
      }
    }

    async function onProjectChange() {
      if (!currentProjectId.value) {
        currentStep.value = 'assets';
        projectStatus.value = {};
        return;
      }
      await refreshProjectStatus();
    }

    async function refreshProjectStatus() {
      try {
        const data = await api.getProject(currentProjectId.value);
        const p = data.project;
        const assets = p.assets;
        
        // 计算各状态
        const hasCharacters = assets?.characters?.length > 0;
        const hasScenes = assets?.scenes?.length > 0;
        const allAssetsHaveImages = checkAllAssetsHaveImages(assets);
        const hasScript = !!p.scriptParsed;
        const hasStoryboard = !!p.storyboard;
        const hasPrompts = !!p.prompts;
        const promptsConfirmed = p.prompts?.every(pr => pr.confirmed);

        projectStatus.value = {
          assetsValid: hasCharacters && hasScenes && allAssetsHaveImages,
          scriptReady: hasScript,
          storyboardReady: hasStoryboard,
          promptsConfirmed: hasPrompts && promptsConfirmed,
          generationStarted: !!p.generation,
          ...p
        };

        // 自动跳转到合适的步骤
        if (p.status === 'completed') {
          currentStep.value = 'generate';
        } else if (hasPrompts && promptsConfirmed) {
          currentStep.value = 'generate';
        } else if (hasStoryboard) {
          currentStep.value = 'storyboard';
        } else if (hasScript) {
          currentStep.value = 'script';
        } else {
          currentStep.value = 'assets';
        }
      } catch (e) {
        console.error('刷新项目状态失败:', e);
      }
    }

    function checkAllAssetsHaveImages(assets) {
      if (!assets) return false;
      for (const type of ['characters', 'scenes']) {
        for (const entity of (assets[type] || [])) {
          for (const variant of (entity.variants || [])) {
            if (variant.images.length === 0) return false;
          }
        }
      }
      return true;
    }

    async function createProject() {
      if (!newProjectName.value.trim()) return;
      try {
        const data = await api.createProject(newProjectName.value.trim(), newProjectStyle.value);
        projects.value.push(data.project);
        currentProjectId.value = data.project.id;
        showNewProjectModal.value = false;
        newProjectName.value = '';
        await refreshProjectStatus();
      } catch (e) {
        console.error('创建项目失败:', e);
      }
    }

    function navigateTo(stepId) {
      const step = steps.find(s => s.id === stepId);
      if (!step || !step.enabled(currentProjectId.value, projectStatus.value)) return;
      currentStep.value = stepId;
    }

    async function nextStep() {
      const idx = steps.findIndex(s => s.id === currentStep.value);
      if (idx < steps.length - 1) {
        await refreshProjectStatus();
        currentStep.value = steps[idx + 1].id;
      }
    }

    // 资产警告
    const assetWarning = computed(() => {
      if (!projectStatus.value.assets) return '请创建角色和场景资产';
      const assets = projectStatus.value.assets;
      for (const type of ['characters', 'scenes', 'props']) {
        for (const entity of (assets[type] || [])) {
          for (const variant of (entity.variants || [])) {
            if (variant.images.length === 0) return `"${entity.name}" 缺少参考图片`;
          }
        }
      }
      const hasChars = (assets.characters?.length || 0) > 0;
      const hasScenes = (assets.scenes?.length || 0) > 0;
      if (!hasChars || !hasScenes) return '至少需要创建角色和场景资产';
      return null;
    });

    const allAssetsValid = computed(() => !assetWarning.value);

    // 脚本准备
    const scriptReady = computed(() => projectStatus.value.scriptReady);

    // 分镜准备
    const storyboardReady = computed(() => projectStatus.value.storyboardReady);

    // 提示词确认
    const allPromptsConfirmed = computed(() => projectStatus.value.promptsConfirmed);

    async function submitGeneration() {
      try {
        const data = await api.submitGeneration(currentProjectId.value);
        currentStep.value = 'generate';
        await refreshProjectStatus();
      } catch (e) {
        console.error('提交生成失败:', e);
      }
    }

    async function refreshTaskStatus() {
      await refreshProjectStatus();
    }

    return {
      loading,
      projects,
      currentProjectId,
      currentStep,
      steps,
      showNewProjectModal,
      newProjectName,
      newProjectStyle,
      projectStatus,
      assetWarning,
      allAssetsValid,
      scriptReady,
      storyboardReady,
      allPromptsConfirmed,
      onProjectChange,
      navigateTo,
      nextStep,
      createProject,
      submitGeneration,
      refreshTaskStatus
    };
  }
});

app.component('asset-manager', AssetManager);
app.component('script-manager', ScriptManager);
app.component('storyboard-review', StoryboardReview);
app.component('prompt-review', PromptReview);
app.component('generation-dashboard', GenerationDashboard);

app.mount('#app');
