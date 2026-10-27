import type { ReactElement, ReactNode } from "react";
import { Effects } from "@animate-ui/react/primitives/effects/effect";
import { shift, transition } from "@animate-ui/react/utils/motion";

/**
 * 列表进入：每行像 dropdown-menu 那样从右往左淡入并脱离模糊，逐行错开。
 * 不渲染容器，间距/排版留在调用方的父元素上。
 */
function StaggerList({ children }: { children: ReactNode }): ReactNode {
  return (
    <Effects
      blur
      fade
      // 33ms 步长与菜单行入场一致；行多时 Effects 不做加长补偿，几十行以上会显拖沓
      holdDelay={33}
      // 菜单位移是固定 8px，比导航整体的 shift.navigation 更收敛
      slide={{ direction: "left", offset: shift.handoff + 2 }}
      transition={transition.menu}
    >
      {/* Effects 会把条件渲染留下的 null 行过滤掉 */}
      {children as ReactElement[]}
    </Effects>
  );
}

export { StaggerList };
