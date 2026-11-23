import { Scroll, Text, token, View } from 'nsh';
import { createNavStack, MenuItem, NavPage, NavStack } from 'nsh/base';
import { currentWindow } from 'nsh/desktop';

import { Logo } from '../../components/Logo';
import { buttonFrameClass } from '../../components/ui/buttonStyles';
import { Icon } from '../../components/ui/Icon';
import { iconHoverMotion } from '../../components/ui/motion';
import {
  lucideHistory,
  lucideKeyboard,
  lucidePalette,
  lucideServer,
  lucideSettings,
} from '../../icons';
import { setupShortcuts } from '../../shortcuts';
import { setupTray } from '../../tray';
import { AppearancePage } from './pages/appearance/AppearancePage';
import { BackupPage } from './pages/backup/BackupPage';
import { GeneralPage } from './pages/general/GeneralPage';
import { ProvidersPage } from './pages/providers/ProvidersPage';
import { ShortcutsPage } from './pages/shortcuts/ShortcutsPage';

const settingsPages = [
  {
    id: 'general',
    label: '通用',
    icon: lucideSettings,
    render: () => <GeneralPage />,
  },
  {
    id: 'providers',
    label: '服务商',
    icon: lucideServer,
    render: () => <ProvidersPage />,
  },
  {
    id: 'appearance',
    label: '外观',
    icon: lucidePalette,
    render: () => <AppearancePage />,
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    icon: lucideKeyboard,
    render: () => <ShortcutsPage />,
  },
  {
    id: 'backup',
    label: '备份恢复',
    icon: lucideHistory,
    render: () => <BackupPage />,
  },
] as const;

type SettingsRoute = (typeof settingsPages)[number];

export function SettingsWindow() {
  setupTray(currentWindow());
  setupShortcuts();
  const nav = createNavStack<SettingsRoute>([settingsPages[0]]);
  const activeNav = () => nav.routes()[nav.routes().length - 1];

  return (
    <View
      testID="settings-center"
      role="region"
      accessibilityLabel="设置中心"
      class="flex-1 flex-row bg-background text-foreground"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      <View
        testID="settings-sidebar"
        class="w-48 shrink-0 border-r border-sidebar-border bg-sidebar md:w-60"
        desktop={{ windowDrag: true }}
      >
        <Scroll testID="settings-sidebar-scroll" class="min-h-0 flex-1">
          <Logo />

          <View
            role="navigation"
            accessibilityLabel="设置分类"
            class="gap-1 px-2 pb-4"
          >
            <Each of={settingsPages}>
              {(page) => {
                const iconMotion = iconHoverMotion();
                return (
                  <View onMouseEnter={() => void iconMotion.play()}>
                    <MenuItem
                      testID={`settings-${page().id}`}
                      role="link"
                      accessibilityLabel={page().label}
                      onSelect={() => {
                        if (activeNav().id !== page().id) nav.replace(page());
                      }}
                      class={`${buttonFrameClass} h-11 flex-row items-center gap-3 rounded-xl border-transparent px-3 hover:bg-sidebar-accent`}
                      classList={{
                        'bg-sidebar-accent': activeNav().id === page().id,
                      }}
                    >
                      <Icon
                        icon={page().icon}
                        size={20}
                        color={token('sidebar-foreground')}
                        style={iconMotion.style}
                      />
                      <Text
                        class="text-sm text-sidebar-foreground"
                        classList={{
                          'font-semibold': activeNav().id === page().id,
                        }}
                      >
                        {page().label}
                      </Text>
                    </MenuItem>
                  </View>
                );
              }}
            </Each>
          </View>
        </Scroll>
      </View>
      <View class="min-w-0 flex-1 p-4">
        <NavStack state={nav} testID="settings-router" class="min-w-0 flex-1">
          {(page) => (
            <NavPage
              title={page.label}
              headerVisible={false}
              animation="default"
            >
              <View
                testID="settings-content"
                role="region"
                accessibilityLabel={page.label}
                class="min-h-0 flex-1 rounded-xl border border-border bg-background"
              >
                <If
                  when={page.id === 'providers'}
                  else={
                    <Scroll class="min-h-0 flex-1">
                      <View class="p-6">{page.render()}</View>
                    </Scroll>
                  }
                >
                  {page.render()}
                </If>
              </View>
            </NavPage>
          )}
        </NavStack>
      </View>
    </View>
  );
}
