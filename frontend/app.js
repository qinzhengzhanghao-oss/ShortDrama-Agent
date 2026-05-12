/**
 * ShortDrama-Agent 主应用
 * v2: 所有步骤可查看 + 独立确认按钮
 */

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {
    const loading = ref(true);
    const projects = ref([]);
    const currentProjectId = ref('');
    const currentStep = ref('assets');
    const showNewProjectModal = ref(false);
    const newProjectName = ref('');
    const newProjectStyle = ref('真人');
    const projectStatus = ref({});

    // 已完成的步骤（记录确认状态）
    const completedSteps = ref({
      characters: false,
      scenes: false,
      script: false,
      storyboard: false,
      prompts: false,
      generate: false
    });

    // 步骤定义 — 所有步骤都可用（有项目即可）
    const steps = [
      { id: 'assets',    icon: '📦', label: '资产管理',      enabled: (pid) => !!pid },
      { id: 'script',    icon: '📄', label: '剧本解析',      enabled: (pid) => !!pid },
      { id: 'storyboard',icon: '🎞️', label: '分镜审核',      enabled: (pid) => !!pid },
      { id: 'prompts',   icon: '📝', label: '提示词审核',    enabled: (pid) => !!pid },
      { id: 'generate',  icon: '⚡', label: '视频生成',      enabled: (pid) => !!pid },
    ];

    onMounted(async () => {
      await loadProjects();
      loading.value = false;
    });

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
        return;
      }
      await refreshProjectStatus();
    }

    async function refreshProjectStatus() {
      try {
        const data = await api.getProject(currentProjectId.value);
        const p = data.project;
        projectStatus.value = { ...p, assets: p.assets || {} };
      } catch (e) {
        console.error('刷新状态失败:', e);
      }
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

    // 导航 — 所有步骤都可点
    function navigateTo(stepId) {
      if (!currentProjectId.value && stepId !== 'assets') return;
      currentStep.value = stepId;
    }

    // ============ 各步骤确认处理 ============

    async function onConfirmCharacters() {
      completedSteps.value.characters = true;
      tryToNext('script');
    }

    async function onConfirmScenes() {
      completedSteps.value.scenes = true;
      tryToNext('script');
    }

    function tryToNext(nextStepId) {
      // 资产阶段需要角色和场景都确认
      if (nextStepId === 'script') {
        if (completedSteps.value.characters && completedSteps.value.scenes) {
          navigateTo('script');
        }
      } else {
        navigateTo(nextStepId);
      }
    }

    async function onConfirmScript() {
      completedSteps.value.script = true;
      navigateTo('storyboard');
    }

    async function onConfirmStoryboard() {
      completedSteps.value.storyboard = true;
      navigateTo('prompts');
    }

    async function onConfirmPrompts() {
      completedSteps.value.prompts = true;
      // 自动提交生成
      try {
        await api.submitGeneration(currentProjectId.value);
        navigateTo('generate');
      } catch (e) {
        console.error('提交生成失败:', e);
      }
    }

    // 各步骤组件的事件绑定
    const assetManagerEvents = {
      'confirm-characters': onConfirmCharacters,
      'confirm-scenes': onConfirmScenes
    };

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
      completedSteps,
      onProjectChange,
      navigateTo,
      createProject,
      onConfirmScript,
      onConfirmStoryboard,
      onConfirmPrompts,
      assetManagerEvents,
      refreshProjectStatus
    };
  }
});

app.component('asset-manager', AssetManager);
app.component('script-manager', ScriptManager);
app.component('storyboard-review', StoryboardReview);
app.component('prompt-review', PromptReview);
app.component('generation-dashboard', GenerationDashboard);

app.mount('#app');
