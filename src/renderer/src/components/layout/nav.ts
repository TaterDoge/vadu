import type { IconClass } from "@renderer/lib/icons";

export type SectionId =
  | "translate"
  | "glossary"
  | "plugins"
  | "providers"
  | "appearance"
  | "general"
  | "shortcuts";

export type NavItem = {
  id: SectionId;
  label: string;
  description: string;
  /** Iconify 类名，构建期由 @iconify/tailwind4 内联成 data URI，运行时无请求 */
  icon: IconClass;
};

export const NAV_ITEMS: NavItem[] = [
  {
    description: "输入原文、选择 profile、查看流式译文",
    icon: "icon-[lucide--languages]",
    id: "translate",
    label: "翻译面板",
  },
  {
    description: "全局术语条目，翻译前由 core 统一注入",
    icon: "icon-[lucide--book-text]",
    id: "glossary",
    label: "术语表",
  },
  {
    description: "已安装插件的状态、权限与来源",
    icon: "icon-[lucide--blocks]",
    id: "plugins",
    label: "插件",
  },
  {
    description: "profile 与其 endpoint、模型、密钥",
    icon: "icon-[lucide--server]",
    id: "providers",
    label: "服务商",
  },
  {
    description: "启动行为、主题、默认 profile、历史条数",
    icon: "icon-[lucide--settings]",
    id: "general",
    label: "通用",
  },
  {
    description: "主题色与组件风格",
    icon: "icon-[lucide--palette]",
    id: "appearance",
    label: "外观",
  },
  {
    description: "全局与局内快捷键的录制、清除与冲突提示",
    icon: "icon-[lucide--keyboard]",
    id: "shortcuts",
    label: "快捷键",
  },
];

export const DEFAULT_SECTION: SectionId = "translate";

export function getNavItem(id: SectionId): NavItem {
  const found = NAV_ITEMS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`未登记的分区: ${id}`);
  }
  return found;
}
