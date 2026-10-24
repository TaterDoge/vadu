import {
  BlocksIcon,
  BookTextIcon,
  KeyboardIcon,
  LanguagesIcon,
  type LucideIcon,
  ServerIcon,
  SettingsIcon,
} from "lucide-react";

export type SectionId =
  | "translate"
  | "glossary"
  | "plugins"
  | "providers"
  | "general"
  | "shortcuts";

export type NavItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        description: "输入原文、选择 profile、查看流式译文",
        icon: LanguagesIcon,
        id: "translate",
        label: "翻译面板",
      },
      {
        description: "全局术语条目，翻译前由 core 统一注入",
        icon: BookTextIcon,
        id: "glossary",
        label: "术语表",
      },
    ],
    label: "翻译",
  },
  {
    items: [
      {
        description: "已安装插件的状态、权限与来源",
        icon: BlocksIcon,
        id: "plugins",
        label: "插件",
      },
      {
        description: "profile 与其 endpoint、模型、密钥",
        icon: ServerIcon,
        id: "providers",
        label: "服务商",
      },
    ],
    label: "能力",
  },
  {
    items: [
      {
        description: "启动行为、主题、默认 profile、历史条数",
        icon: SettingsIcon,
        id: "general",
        label: "通用",
      },
      {
        description: "全局与局内快捷键的录制、清除与冲突提示",
        icon: KeyboardIcon,
        id: "shortcuts",
        label: "快捷键",
      },
    ],
    label: "应用",
  },
];

export const DEFAULT_SECTION: SectionId = "translate";

export function getNavItem(id: SectionId): NavItem {
  for (const group of NAV_GROUPS) {
    const found = group.items.find((item) => item.id === id);
    if (found) {
      return found;
    }
  }
  throw new Error(`未登记的分区: ${id}`);
}
