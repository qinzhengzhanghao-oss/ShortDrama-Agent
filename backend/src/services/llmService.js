/**
 * LLM 调用服务
 * 
 * 配置方式（按优先级）：
 * 1. 设置环境变量 LLM_API_KEY 和 LLM_ENDPOINT
 * 2. 或创建 .env 文件
 * 
 * DeepSeek 默认配置：
 *   ENDPOINT: https://api.deepseek.com
 *   MODEL: deepseek-chat
 */

const USE_MOCK = process.env.LLM_MOCK === 'true' || !process.env.LLM_API_KEY;

class LLMService {
  constructor() {
    this.endpoint = process.env.LLM_ENDPOINT || 'https://api.deepseek.com';
    this.apiKey = process.env.LLM_API_KEY || '';
    this.model = process.env.LLM_MODEL || 'deepseek-chat';
    this.client = null;
    
    if (!USE_MOCK && this.apiKey) {
      this.initClient();
    }
  }

  initClient() {
    try {
      const OpenAI = require('openai');
      this.client = new OpenAI({
        baseURL: this.endpoint,
        apiKey: this.apiKey
      });
      console.log(`🧠 LLM 已配置: ${this.endpoint} / ${this.model}`);
    } catch (e) {
      console.warn('⚠️ 初始化 LLM 客户端失败，将使用 Mock 模式:', e.message);
    }
  }

  /**
   * 调用大语言模型
   * @param {string} prompt - 提示词
   * @param {object} options - { model, temperature, maxTokens }
   * @returns {Promise<string>} LLM 回复
   */
  async callLLM(prompt, options = {}) {
    if (USE_MOCK || !this.client) {
      console.log(`\n🧠 [Mock LLM] 调用模型: ${options.model || this.model}`);
      console.log(`   提示词长度: ${prompt.length} 字符`);
      return this.getMockResponse(prompt);
    }

    try {
      console.log(`\n🧠 [LLM] 调用 ${this.model}，提示词 ${prompt.length} 字符`);
      const startTime = Date.now();
      
      const resp = await this.client.chat.completions.create({
        model: options.model || this.model,
        messages: [
          { 
            role: 'system', 
            content: '你是一个专业的短剧制作助手。请始终使用中文回复，严格按要求的JSON格式输出，不要添加无关说明。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 8192
      });

      const elapsed = Date.now() - startTime;
      const result = resp.choices[0].message.content;
      console.log(`   ✅ 响应完成，耗时 ${elapsed}ms，${result.length} 字符`);
      
      return result;
    } catch (err) {
      console.error('❌ LLM 调用失败:', err.message);
      // 失败时降级到 Mock
      console.warn('   ⚠️ 降级到 Mock 模式');
      return this.getMockResponse(prompt);
    }
  }

  getMockResponse(prompt) {
    // 剧本解析
    if (prompt.includes('剧本解析') || prompt.includes('解析剧本')) {
      return JSON.stringify({
        scenes: [
          {
            sceneId: 1,
            location: '办公室-茶水间',
            summary: '林远在茶水间遇到同事张伟，得知公司正在准备裁员消息。',
            characters: ['林远', '张伟'],
            dialogue: [
              { character: '张伟', text: '林远，你听说了吗？公司要裁员了，名单据说下周就出来。' },
              { character: 'narrator', text: '林远握着杯子的手微微收紧了一下，随即恢复平静。' },
              { character: '林远', text: '听说了。该来的总会来的，干好自己手头的事吧。' }
            ]
          },
          {
            sceneId: 2,
            location: '会议室',
            summary: '部门主管李明宣布裁员名单，林远的名字赫然在列。',
            characters: ['李明', '林远'],
            dialogue: [
              { character: '李明', text: '这次公司架构调整，需要裁减部分人员……林远。' },
              { character: 'narrator', text: '会议室安静了几秒，所有人的目光都集中在林远身上。' }
            ]
          }
        ],
        entities: [
          { name: '林远', type: 'character', bound: false, boundId: null, boundType: null },
          { name: '张伟', type: 'character', bound: false, boundId: null, boundType: null },
          { name: '李明', type: 'character', bound: false, boundId: null, boundType: null },
          { name: '办公室-茶水间', type: 'scene', bound: false, boundId: null, boundType: null },
          { name: '会议室', type: 'scene', bound: false, boundId: null, boundType: null }
        ],
        title: '裁员风波'
      });
    }

    // 分镜生成
    if (prompt.includes('分镜')) {
      const shots = [];
      const types = ['全景', '中景', '近景', '特写', '中近景', '中景'];
      for (let i = 0; i < 8; i++) {
        shots.push({
          id: i + 1,
          duration: 4,
          shotType: types[i % types.length],
          camera: ['固定', '缓慢推进', '横移', '固定'][i % 4],
          scene: '办公室',
          characters: ['林远'],
          actions: '林远坐在工位上，手指快速地敲击着键盘。',
          expression: '眉头微皱，目光专注',
          facialAU: 'AU4(皱眉)+AU7(眼睑收紧)',
          dialogue: '',
          sound: '键盘敲击声',
          isBridgeShot: i === 3,
          bridgeToGroup: i === 3 ? 'Group_02' : null
        });
      }
      const groups = [
        { groupId: 'Group_01', shots: shots.slice(0, 4), totalDuration: 16 },
        { groupId: 'Group_02', shots: shots.slice(4), totalDuration: 16 }
      ];
      return JSON.stringify({ shots, groups });
    }

    return JSON.stringify({ result: 'ok', message: 'Mock LLM response' });
  }
}

const llmService = new LLMService();
module.exports = llmService;
