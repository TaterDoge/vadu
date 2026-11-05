import type { AriaAttributes, ComponentType, ReactNode } from "react";
import { CircleAlert } from "@renderer/components/animate-ui/icons/circle-alert";

/* 图标统一「组件 + 类名尺寸」：shadcn 容器的 [&_svg]:size-* 现在选得中真 svg，显式 size-* 类名压过图标自带的 width/height */
export type IconComponent = ComponentType<{
  "aria-hidden"?: AriaAttributes["aria-hidden"];
  className?: string;
}>;

/* Alert 把图标样式挂在 svg 选择器上（row-span / translate / size），容器那侧的两列布局由调用点补 grid-cols-[auto_1fr] gap-x-2 */
export function AlertIcon(): ReactNode {
  return (
    <CircleAlert
      aria-hidden="true"
      className="row-span-2 size-4 translate-y-0.5"
    />
  );
}
