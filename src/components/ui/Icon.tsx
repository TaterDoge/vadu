import { token, View, type ViewStyle } from 'nsh';
import { Icon as SuperIcon, type IconProps } from 'supernsh-icons';

// 窗口内的图标由相邻文字或按钮命名，外层同时承接侧栏的悬停动画。
export function Icon(
  props: Pick<IconProps, 'icon' | 'size' | 'color'> & { style?: ViewStyle },
) {
  return (
    <View
      class="shrink-0"
      style={props.style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SuperIcon
        icon={props.icon}
        size={props.size ?? 16}
        color={props.color ?? token('foreground')}
      />
    </View>
  );
}
