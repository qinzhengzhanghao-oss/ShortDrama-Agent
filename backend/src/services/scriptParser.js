/**
 * 剧本解析服务
 * 调用 LLM 解析剧本，识别场次、角色、台词、环境
 * 
 * 当前为模拟实现，接入真实 LLM 时替换 parseScript 方法
 */

const { callLLM } = require('./llmService');

class ScriptParser {
  /**
   * 解析剧本内容
   * @param {string} content - 原始剧本文本
   * @param {object} assets - 项目资产 { characters, scenes, props }
   * @returns {object} 解析结果
   */
  async parseScript(content, assets) {
    // 构建资产上下文
    const assetContext = this.buildAssetContext(assets);

    const prompt = `你是一个专业的剧本解析助手。请解析以下短剧剧本，严格按照JSON格式返回结果。

## 现有资产
${assetContext}

## 解析要求
1. 识别剧本中的【场次】(scenes)，每场是一个独立的场景
2. 识别每场中出现的【角色】和【环境】
3. 识别每场中的【台词】段落，标注说话角色
4. 标记无法绑定的实体（不在此次资产列表中）

## 输出JSON格式
{
  "scenes": [
    {
      "sceneId": 1,
      "location": "场景地点描述",
      "summary": "本场概要",
      "characters": ["角色名称列表"],
      "parsed": true/false,
      "dialogue": [
        {
          "character": "角色名或 narrator（旁白描述）",
          "text": "台词内容或动作描述"
        }
      ]
    }
  ],
  "entities": [
    {
      "name": "实体名称",
      "type": "character/scene/prop",
      "bound": true/false,
      "boundId": "已绑定的资产ID或null",
      "boundType": "characters/scenes/props或null"
    }
  ],
  "title": "剧本标题(如果可识别)"
}

## 剧本内容
${content.substring(0, 30000)}

只返回JSON，不要其他说明文字。`;

    try {
      const result = await callLLM(prompt);
      return this.parseResult(result, assets);
    } catch (err) {
      // 降级：返回基础解析
      return this.basicParse(content, assets);
    }
  }

  /**
   * 构建资产上下文字符串
   */
  buildAssetContext(assets) {
    if (!assets) return '暂无已上传资产';
    let ctx = '';
    const addList = (items, label) => {
      if (items && items.length > 0) {
        ctx += `\n## ${label}\n`;
        items.forEach(item => {
          ctx += `- ${item.name} (ID: ${item.id})`;
          if (item.variants && item.variants.length > 0) {
            ctx += ` [变体: ${item.variants.map(v => v.name).join(', ')}]`;
          }
          ctx += '\n';
        });
      }
    };
    addList(assets.characters, '角色');
    addList(assets.scenes, '场景');
    addList(assets.props, '道具');
    return ctx || '暂无已上传资产';
  }

  /**
   * 解析 LLM 返回的 JSON
   */
  parseResult(rawResult, assets) {
    // 尝试提取 JSON
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // JSON 解析失败，走基础解析
      }
    }
    return this.basicParse(rawResult, assets);
  }

  /**
   * 基础解析（降级方案）
   */
  basicParse(content, assets) {
    const lines = content.split('\n').filter(l => l.trim());
    const scenes = [];
    const entities = [];
    let currentScene = null;
    let knownChars = (assets?.characters || []).map(c => c.name);

    // 简单按空行分割场景
    let sceneIdx = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检测场景标题
      if (/^第[零一二三四五六七八九十百千\d]+[场幕]/.test(trimmed) || 
          /^场景\d*[:：]/i.test(trimmed) ||
          /^[A-Z\s]+$/.test(trimmed) && trimmed.length > 2 && trimmed.length < 30) {
        if (currentScene) scenes.push(currentScene);
        currentScene = {
          sceneId: ++sceneIdx,
          location: trimmed,
          summary: '',
          characters: [],
          dialogue: []
        };
        continue;
      }

      if (!currentScene) {
        currentScene = {
          sceneId: ++sceneIdx,
          location: '开场',
          summary: '',
          characters: [],
          dialogue: []
        };
      }

      // 检测台词（角色名+冒号开头）
      const dialogueMatch = trimmed.match(/^([^：:]+)[：:](.+)/);
      if (dialogueMatch) {
        const charName = dialogueMatch[1].trim();
        currentScene.dialogue.push({
          character: charName,
          text: dialogueMatch[2].trim()
        });
        if (!currentScene.characters.includes(charName)) {
          currentScene.characters.push(charName);
        }
        // 尝试绑定角色
        if (knownChars.includes(charName)) {
          const char = assets.characters.find(c => c.name === charName);
          if (!entities.find(e => e.name === charName)) {
            entities.push({
              name: charName,
              type: 'character',
              bound: true,
              boundId: char.id,
              boundType: 'characters'
            });
          }
        }
      } else {
        // 描述性文字作为旁白
        currentScene.dialogue.push({
          character: 'narrator',
          text: trimmed
        });
      }
    }
    if (currentScene) scenes.push(currentScene);

    return {
      scenes,
      entities,
      title: '解析剧本'
    };
  }
}

module.exports = new ScriptParser();
