import { cleanup } from 'nsh';
import { Tray, type WindowRef } from 'nsh/desktop';
import { svgDataUri } from 'supernsh-icons';

import { lucideLetterV } from './icons';

export function setupTray(window: WindowRef) {
  window.on('closePress', () => window.hide());
  Tray.set({
    icon: svgDataUri(lucideLetterV),
    tooltip: 'Vadu',
    menu: [
      { label: '打开设置', onSelect: () => window.focus() },
      { type: 'separator' },
      { label: '退出', role: 'quit' },
    ],
  });
  cleanup(() => Tray.set(null));
}
