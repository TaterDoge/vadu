import type { IconClass } from "@renderer/lib/icons";

export type SectionId =
  | "glossary"
  | "plugins"
  | "providers"
  | "appearance"
  | "general"
  | "shortcuts";

export type NavItem = {
  id: SectionId;
  label: string;
  /** Iconify 类名，构建期由 @iconify/tailwind4 内联成 data URI，运行时无请求 */
  icon: IconClass;
};

export const NAV_ITEMS: NavItem[] = [
  {
    icon: "icon-[lucide--book-text]",
    id: "glossary",
    label: "术语表",
  },
  {
    icon: "icon-[lucide--blocks]",
    id: "plugins",
    label: "插件",
  },
  {
    icon: "icon-[lucide--server]",
    id: "providers",
    label: "服务商",
  },
  {
    icon: "icon-[lucide--settings]",
    id: "general",
    label: "通用",
  },
  {
    icon: "icon-[lucide--palette]",
    id: "appearance",
    label: "外观",
  },
  {
    icon: "icon-[lucide--keyboard]",
    id: "shortcuts",
    label: "快捷键",
  },
];

export const DEFAULT_SECTION: SectionId = "general";
