import type { ComponentType, ReactNode } from "react";
import OpenAI from "@lobehub/icons/es/OpenAI";

/**
 * 插件 → 服务商图标。新插件在这里加一行即可。
 * 必须走 `@lobehub/icons/es/<Name>` 单图标深路径：从包根导入会把 800+ 个图标
 * 全塞进 bundle（实测 +1.6 MB），并顺带拉进 @lobehub/ui 的 peer 依赖。
 */
const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  "vadu.ai": OpenAI,
};

type Props = {
  pluginId: string;
  size?: number;
};

/** 图标自带 fill: currentColor，跟随明暗主题；未登记的插件不显示图标 */
export function PluginIcon({ pluginId, size = 16 }: Props): ReactNode {
  const Icon = ICONS[pluginId];
  return Icon ? <Icon size={size} /> : null;
}
