import { cleanup, createMotion, reduceMotion, View } from 'nsh';

import { Icon } from '../../../../components/ui/Icon';
import { svgSpinners3DotsScale } from '../../../../icons';

function PulseDot(props: { delay: number }) {
  // 原图每 800ms 循环一次：前 750ms 缩放，末尾 50ms 保持原大小。
  const motion = createMotion({
    enter: {
      keyframes: {
        scale: [
          1,
          { offset: 375 / 800, value: 0.2 / 3 },
          { offset: 750 / 800, value: 1 },
          1,
        ],
      },
      duration: 800,
      delay: props.delay,
      iterations: 'infinite',
      easing: 'linear',
    },
  });
  cleanup(() => motion.stop());
  return (
    <View class="size-1 rounded-full bg-foreground" style={motion.style} />
  );
}

export function HealthCheckSpinner() {
  return (
    <If when={!reduceMotion()} else={<Icon icon={svgSpinners3DotsScale} />}>
      <View
        testID="health-check-dots"
        class="size-4 shrink-0 flex-row items-center justify-around"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <PulseDot delay={0} />
        <PulseDot delay={150} />
        <PulseDot delay={300} />
      </View>
    </If>
  );
}
