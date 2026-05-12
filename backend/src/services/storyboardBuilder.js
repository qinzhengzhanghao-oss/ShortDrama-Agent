/**
 * 分镜生成服务
 * 调用 LLM 生成精细分镜 + 智能镜头编组
 */

const path = require('path');
const llmService = require('./llmService');

class StoryboardBuilder {
  /**
   * 生成完整分镜
   */
  async generate(project) {
    const { scriptParsed, assets } = project;

    const scenesJson = JSON.stringify(scriptParsed.scenes, null, 2);
    const assetsJson = this.assetsForPrompt(assets);
    const entitiesJson = JSON.stringify(scriptParsed.entities, null, 2);

    const prompt = `你是一个顶级的分镜脚本生成专家。请根据以下剧本内容，生成精细的分镜头脚本。

## 现有剧本
${scenesJson.substring(0, 15000)}

## 已绑定的资产
${assetsJson}

## 分镜规则
1. **时长**: 每个镜头 3-8 秒
2. **景别**（必须间隔跳跃，不能连续同景别）: 远景/全景/中景/中近景/近景/特写
3. **运镜**: 固定/缓慢推进/缓慢后退/横移/上升/下降/摇摄/跟拍
4. **角色动作**: 三段式描述（预备→过程→结束），自然不夸张
5. **表情**: 使用 AU 编码 + 自然语言补充（如 AU4+AU7 皱眉专注）
6. **台词**: 有声台词注明，默认可不写
7. **音效**: 标注环境音、动作音
8. **接点标记**: 如果某镜头需要跨组衔接，标记 isBridge=true

## 输出JSON格式
{
  "shots": [
    {
      "id": 1,
      "duration": 4.5,
      "shotType": "中景",
      "camera": "固定",
      "scene": "办公室-茶水间",
      "characters": ["林远"],
      "actions": "林远站在饮水机前，右手握着杯子，目光低垂。",
      "expression": "面无表情，但握杯的手指微微收紧",
      "facialAU": "AU4(轻皱眉)+AU15(嘴角下压)",
      "dialogue": "",
      "sound": "饮水机咕噜声",
      "isBridgeShot": false,
      "bridgeToGroup": null
    }
  ]
}

只返回JSON，不要额外说明。
`;

    const result = await llmService.callLLM(prompt, { temperature: 0.8 });

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackShots(project);
    } catch (e) {
      return this.fallbackShots(project);
    }
  }

  /**
   * 智能镜头编组
   * 每组总时长尽量 ≤15 秒，超时触发滑动窗口拆分
   */
  groupShots(shots) {
    const groups = [];
    let currentGroup = { groupId: `Group_01`, shots: [], totalDuration: 0 };
    let groupIndex = 1;

    for (let i = 0; i < shots.length; i++) {
      const shot = { ...shots[i] };
      const newDuration = currentGroup.totalDuration + shot.duration;

      if (newDuration > 15 && currentGroup.shots.length > 0) {
        // 如果>15秒，当前组加上这个镜头会超
        // 策略：尽量凑到接近15秒
        
        // 检查当前组如果加这个镜头会超多少
        if (newDuration <= 18 && currentGroup.shots.length >= 2) {
          // 稍微超一点也接受（上限18秒）
          shot.isBridgeShot = false;
          currentGroup.shots.push(shot);
          currentGroup.totalDuration = newDuration;
        } else {
          // 真正需要拆分
          // 当前组结束，此镜头作为下一组的第一个
          // 同时前一组最后一个镜头标记为接点
          if (currentGroup.shots.length > 0) {
            const lastShot = currentGroup.shots[currentGroup.shots.length - 1];
            lastShot.isBridgeShot = true;
            lastShot.bridgeToGroup = `Group_${String(groupIndex + 1).padStart(2, '0')}`;
          }
          
          currentGroup.totalDuration = parseFloat(currentGroup.totalDuration.toFixed(1));
          groups.push(currentGroup);
          
          groupIndex++;
          // 新一组以当前镜头开始，并且复制上一个镜头的接点信息
          const bridgeShot = { ...shots[i - 1], isBridgeShot: true, bridgeToGroup: `Group_${String(groupIndex).padStart(2, '0')}` };
          currentGroup = {
            groupId: `Group_${String(groupIndex).padStart(2, '0')}`,
            shots: [bridgeShot, shot],
            totalDuration: (bridgeShot.duration || 0) + shot.duration
          };
        }
      } else {
        shot.isBridgeShot = false;
        currentGroup.shots.push(shot);
        currentGroup.totalDuration = newDuration;
      }
    }

    if (currentGroup.shots.length > 0) {
      currentGroup.totalDuration = parseFloat(currentGroup.totalDuration.toFixed(1));
      groups.push(currentGroup);
    }

    return groups;
  }

  assetsForPrompt(assets) {
    if (!assets) return '暂无资产';
    const res = {};
    ['characters', 'scenes', 'props'].forEach(type => {
      res[type] = (assets[type] || []).map(e => ({
        name: e.name,
        variants: (e.variants || []).map(v => ({
          name: v.name,
          desc: v.description,
          refImage: v.images[v.mainImageIndex]?.url || null
        }))
      }));
    });
    return JSON.stringify(res, null, 2);
  }

  fallbackShots(project) {
    // 降级：从剧本生成基础分镜
    const shots = [];
    const scenes = project.scriptParsed?.scenes || [];
    let id = 1;
    const shotTypes = ['全景', '中景', '近景', '特写', '中近景', '全景'];

    scenes.forEach(scene => {
      (scene.dialogue || []).forEach((d, i) => {
        if (i % 2 !== 0) return; // 减少镜头数
        shots.push({
          id: id++,
          duration: 4,
          shotType: shotTypes[id % shotTypes.length],
          camera: '固定',
          scene: scene.location,
          characters: d.character === 'narrator' ? [] : [d.character],
          actions: d.character === 'narrator' ? d.text : (d.text.substring(0, 30)),
          expression: '自然',
          facialAU: '',
          dialogue: d.character !== 'narrator' ? d.text : '',
          sound: '',
          isBridgeShot: false,
          bridgeToGroup: null
        });
      });
    });

    return { shots };
  }
}

module.exports = new StoryboardBuilder();
