import { Blocks } from "@renderer/components/animate-ui/icons/blocks";
import { BookText } from "@renderer/components/animate-ui/icons/book-text";
import { Keyboard } from "@renderer/components/animate-ui/icons/keyboard";
import { Palette } from "@renderer/components/animate-ui/icons/palette";
import { Server } from "@renderer/components/animate-ui/icons/server";
import { Settings } from "@renderer/components/animate-ui/icons/settings";
import type { IconComponent } from "@renderer/lib/icons";

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
  /** animate-ui 图标组件；悬停动画由 app-sidebar 的 AnimateIcon 在整行上触发 */
  icon: IconComponent;
};

export const NAV_ITEMS: NavItem[] = [
  {
    icon: BookText,
    id: "glossary",
    label: "术语表",
  },
  {
    icon: Blocks,
    id: "plugins",
    label: "插件",
  },
  {
    icon: Server,
    id: "providers",
    label: "服务商",
  },
  {
    icon: Settings,
    id: "general",
    label: "通用",
  },
  {
    icon: Palette,
    id: "appearance",
    label: "外观",
  },
  {
    icon: Keyboard,
    id: "shortcuts",
    label: "快捷键",
  },
];

export const DEFAULT_SECTION: SectionId = "general";
