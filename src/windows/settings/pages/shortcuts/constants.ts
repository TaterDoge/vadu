import { GLOBAL_SHORTCUT_ID } from '../../../../feature/settings/shortcuts/config';
import { lucideKeyboard, lucidePin, lucideSettings } from '../../../../icons';

export const shortcutGroups = [
  {
    title: '全局快捷键',
    items: [
      {
        id: GLOBAL_SHORTCUT_ID,
        title: '唤起翻译浮窗',
        description: '唤起并聚焦翻译窗口，未固定时失焦自动隐藏',
        icon: lucideKeyboard,
      },
    ],
  },
  {
    title: '局内快捷键',
    items: [
      {
        id: 'open-settings',
        title: '浮窗内打开设置',
        description: '在翻译浮窗内打开设置页面，仅浮窗聚焦时生效',
        icon: lucideSettings,
      },
      {
        id: 'pin-translate',
        title: '浮窗内切换固定窗口',
        description: '固定后保持置顶，再按一次恢复失焦自动隐藏',
        icon: lucidePin,
      },
    ],
  },
];
