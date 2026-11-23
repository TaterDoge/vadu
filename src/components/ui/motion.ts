import { cleanup, createMotion } from 'nsh';

// 在组件体内创建一次，避免响应式绑定重跑时重建动画。
export function iconHoverMotion() {
  const motion = createMotion();
  cleanup(() => motion.stop());

  return {
    style: motion.style,
    play: () =>
      motion.play({
        keyframes: {
          translateY: [0, -2, 0],
          rotate: ['0deg', '-7deg', '0deg'],
        },
        duration: 300,
        easing: 'easeInOut',
      }),
  };
}
