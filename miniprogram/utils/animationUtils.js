/**
 * 动画工具函数
 * 用于行政经理数据分析页面的卡片动画
 */

/**
 * 创建淡入+上滑动画
 * @param {number} delay - 延迟时间（毫秒）
 * @param {number} duration - 动画时长（毫秒）
 * @returns {Object} 微信小程序动画对象
 */
function createFadeInUpAnimation(delay = 0, duration = 500) {
  const animation = wx.createAnimation({
    duration: duration,
    timingFunction: 'ease-out',
    delay: delay
  });

  animation.opacity(1).translateY(0).step();
  return animation.export();
}

/**
 * 创建初始隐藏状态（用于动画前）
 * @returns {Object} 动画对象
 */
function createHiddenState() {
  const animation = wx.createAnimation({
    duration: 0
  });

  animation.opacity(0).translateY(20).step();
  return animation.export();
}

/**
 * 为KPI卡片数组创建错开动画
 * @param {number} cardCount - 卡片数量
 * @param {number} baseDelay - 基础延迟（毫秒）
 * @param {number} staggerDelay - 错开延迟（毫秒）
 * @returns {Array<Object>} 动画对象数组
 */
function createStaggeredAnimations(cardCount = 4, baseDelay = 100, staggerDelay = 100) {
  const animations = [];

  for (let i = 0; i < cardCount; i++) {
    const delay = baseDelay + (i * staggerDelay);
    animations.push(createFadeInUpAnimation(delay, 500));
  }

  return animations;
}

/**
 * 初始化卡片隐藏状态
 * @param {number} cardCount - 卡片数量
 * @returns {Array<Object>} 隐藏状态动画数组
 */
function initHiddenCards(cardCount = 4) {
  const animations = [];

  for (let i = 0; i < cardCount; i++) {
    animations.push(createHiddenState());
  }

  return animations;
}

/**
 * 执行卡片动画序列
 * @param {Object} page - 页面this上下文
 * @param {Array<string>} animationKeys - 动画data键名数组 ['card1Anim', 'card2Anim', ...]
 * @param {number} baseDelay - 基础延迟
 * @param {number} staggerDelay - 错开延迟
 */
function animateCards(page, animationKeys, baseDelay = 100, staggerDelay = 100) {
  // 先设置隐藏状态
  const hiddenStates = initHiddenCards(animationKeys.length);
  const hiddenData = {};
  animationKeys.forEach((key, index) => {
    hiddenData[key] = hiddenStates[index];
  });
  page.setData(hiddenData);

  // 延迟后执行错开动画
  setTimeout(() => {
    const animations = createStaggeredAnimations(animationKeys.length, baseDelay, staggerDelay);
    const animData = {};
    animationKeys.forEach((key, index) => {
      animData[key] = animations[index];
    });
    page.setData(animData);
  }, 50);
}

module.exports = {
  createFadeInUpAnimation,
  createHiddenState,
  createStaggeredAnimations,
  initHiddenCards,
  animateCards
};
