/**
 * 提示词构建服务
 * 按生成组构建时间线化提示词
 * 接点镜头提示词在前后组中强制一致
 */

class PromptBuilder {
  /**
   * 为所有生成组构建提示词
   * @param {object} project - 项目数据
   * @param {object} storyboard - 分镜数据
   * @param {Array} groups - 编组数组
   * @returns {Array} 提示词数组
   */
  async build(project, storyboard, groups) {
    const prompts = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const prompt = await this.buildGroupPrompt(project, group, i, groups);
      prompts.push(prompt);
    }

    // 确保接点镜头提示词一致
    this.ensureBridgeConsistency(prompts);

    return prompts;
  }

  /**
   * 构建单个生成组的提示词
   */
  async buildGroupPrompt(project, group, groupIndex, allGroups) {
    const refImages = this.collectReferenceImages(project, group);
    
    // 构建时间线化提示词
    const timelineShots = group.shots.map((shot, idx) => {
      const startTime = group.shots.slice(0, idx).reduce((s, sh) => s + (sh.duration || 0), 0);
      const endTime = startTime + (shot.duration || 0);

      return {
        shotId: shot.id,
        startTime: parseFloat(startTime.toFixed(1)),
        endTime: parseFloat(endTime.toFixed(1)),
        duration: shot.duration,
        shotType: shot.shotType,
        camera: shot.camera,
        characters: shot.characters,
        actions: shot.actions,
        expression: shot.expression,
        facialAU: shot.facialAU,
        dialogue: shot.dialogue,
        sound: shot.sound,
        isBridge: shot.isBridgeShot || false
      };
    });

    // 构建自然语言提示词
    const promptText = this.buildNaturalPrompt(group, project, timelineShots);

    return {
      groupId: group.groupId,
      prompt: promptText,
      timelineShots,
      referenceImages: refImages.map(img => img.url),
      bridgePrompt: null, // 接点镜头专用提示词
      locked: false, // 审核后锁定
      confirmed: false
    };
  }

  /**
   * 构建自然语言提示词（时间线化格式）
   */
  buildNaturalPrompt(group, project, timelineShots) {
    const lines = [];
    lines.push(`# ${group.groupId} - ${project.name}`);
    lines.push(`总时长: ${group.totalDuration}秒`);
    lines.push('');

    timelineShots.forEach((shot, idx) => {
      const bridgeMark = shot.isBridge ? ' [接点镜头]' : '';
      lines.push(`--- 镜头 ${shot.shotId}${bridgeMark} ---`);
      lines.push(`时间: ${shot.startTime}s - ${shot.endTime}s`);
      lines.push(`景别: ${shot.shotType} | 运镜: ${shot.camera}`);
      if (shot.characters.length > 0) lines.push(`角色: ${shot.characters.join(', ')}`);
      lines.push(`动作: ${shot.actions}`);
      if (shot.facialAU) lines.push(`表情: ${shot.facialAU} (${shot.expression})`);
      if (shot.dialogue) lines.push(`台词: ${shot.dialogue}`);
      if (shot.sound) lines.push(`音效: ${shot.sound}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * 收集参考图 URL
   */
  collectReferenceImages(project, group) {
    const images = [];
    const { assets } = project;

    // 收集该组所有引用角色的图片
    const charNames = new Set();
    group.shots.forEach(shot => {
      (shot.characters || []).forEach(c => charNames.add(c));
    });

    (assets?.characters || []).forEach(char => {
      if (charNames.has(char.name)) {
        char.variants.forEach(v => {
          if (v.mainImageIndex !== undefined && v.images[v.mainImageIndex]) {
            images.push({ name: char.name, url: v.images[v.mainImageIndex].url });
          }
        });
      }
    });

    // 收集场景图片
    const sceneNames = new Set();
    group.shots.forEach(shot => {
      if (shot.scene) sceneNames.add(shot.scene);
    });

    (assets?.scenes || []).forEach(scene => {
      if (sceneNames.has(scene.name)) {
        scene.variants.forEach(v => {
          if (v.mainImageIndex !== undefined && v.images[v.mainImageIndex]) {
            images.push({ name: scene.name, url: v.images[v.mainImageIndex].url });
          }
        });
      }
    });

    return images;
  }

  /**
   * 确保接点镜头在前后组的提示词一致
   */
  ensureBridgeConsistency(prompts) {
    for (let i = 0; i < prompts.length; i++) {
      const current = prompts[i];
      const next = prompts[i + 1];
      if (!next) continue;

      // 当前组最后一个镜头如果是接点
      const lastShot = current.timelineShots[current.timelineShots.length - 1];
      if (lastShot && lastShot.isBridge) {
        // 下一组的第一个镜头应该是接点的拷贝
        const firstShot = next.timelineShots[0];
        if (firstShot) {
          // 锁定接点镜头提示词（在文本中标记）
          const bridgePrompt = this.buildBridgePrompt(lastShot);
          current.bridgePrompt = bridgePrompt;
          next.bridgePrompt = bridgePrompt;
          
          // 在 prompt 文本中标记锁定
          current.prompt = current.prompt.replace(
            `--- 镜头 ${lastShot.shotId}[接点镜头] ---`,
            `--- 镜头 ${lastShot.shotId}[🔒 接点镜头-锁定] ---`
          );
          next.prompt = next.prompt.replace(
            `--- 镜头 ${firstShot.shotId} ---`,
            `--- 镜头 ${firstShot.shotId}[🔒 接点镜头-锁定] ---`
          );
        }
      }
    }
  }

  /**
   * 构建接点镜头专用提示词（锁定不可编辑）
   */
  buildBridgePrompt(shot) {
    return [
      `[接点镜头 - 不可编辑]`,
      `时间: ${shot.startTime}s - ${shot.endTime}s`,
      `景别: ${shot.shotType} | 运镜: ${shot.camera}`,
      `动作: ${shot.actions}`,
      shot.facialAU ? `表情: ${shot.facialAU}` : null,
      shot.dialogue ? `台词: ${shot.dialogue}` : null,
      shot.sound ? `音效: ${shot.sound}` : null
    ].filter(Boolean).join('\n');
  }
}

module.exports = new PromptBuilder();
