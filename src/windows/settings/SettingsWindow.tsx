import {
  History,
  Keyboard,
  Palette,
  Server,
  Settings as SettingsIcon,
} from 'lucide';
import { Scroll, Text, View, windowSize } from 'nsh';
import { currentWindow } from 'nsh/desktop';

import { Card } from '@/components/ui/card';
import { createNavStack, NavPage, NavStack } from '@/components/ui/nav-stack';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  sidebarMenuButtonLook,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toast';
import { Icon } from '@/lib/ui/icons';
import { rounded, shape } from '@/lib/ui/theme';

import { Logo } from '../../components/Logo';
import { Settings } from '../../feature/settings';
import { setupTheme } from '../../feature/settings/appearance/theme';
import { setupShortcuts } from '../../feature/settings/shortcuts/runtime';
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
    icon: SettingsIcon,
    render: () => <GeneralPage />,
  },
  {
    id: 'providers',
    label: '服务商',
    icon: Server,
    render: () => <ProvidersPage />,
  },
  {
    id: 'appearance',
    label: '外观',
    icon: Palette,
    render: () => <AppearancePage />,
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    icon: Keyboard,
    render: () => <ShortcutsPage />,
  },
  {
    id: 'backup',
    label: '备份恢复',
    icon: History,
    render: () => <BackupPage />,
  },
] as const;

type SettingsRoute = (typeof settingsPages)[number];

export function SettingsWindow() {
  setupTray(currentWindow());
  setupTheme();
  setupShortcuts(Settings.read());
  const nav = createNavStack<SettingsRoute>([settingsPages[0]]);
  const activeNav = () => nav.routes()[nav.routes().length - 1];

  return (
    <SidebarProvider
      testID="settings-center"
      role="region"
      accessibilityLabel="设置中心"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      <Sidebar
        testID="settings-sidebar"
        collapsible="none"
        width={windowSize().width < 768 ? 192 : 240}
        desktop={{ windowDrag: true }}
      >
        <SidebarContent testID="settings-sidebar-scroll">
          <Logo />
          <View role="navigation" accessibilityLabel="设置分类" class="px-3">
            <SidebarMenu>
              {settingsPages.map((page) => {
                const active = () => activeNav().id === page.id;
                const look = sidebarMenuButtonLook({ size: 'lg', active });
                return (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      testID={`settings-${page.id}`}
                      role="link"
                      size="lg"
                      accessibilityLabel={page.label}
                      isActive={active()}
                      onPress={() => {
                        if (!active()) nav.replace(page);
                      }}
                    >
                      <Icon
                        icon={page.icon}
                        size={look.glyph.size}
                        tint={look.glyph.tint}
                      />
                      <Text style={look.label}>{page.label}</Text>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </View>
        </SidebarContent>
      </Sidebar>
      <View
        class="m-4 min-w-0 flex-1 overflow-hidden"
        style={rounded(shape.container)}
      >
        <NavStack state={nav} testID="settings-router" class="min-w-0 flex-1">
          {(page) => (
            <NavPage headerVisible={false} animation="default">
              <Card
                testID="settings-content"
                role="region"
                accessibilityLabel={page.label}
                class="min-h-0 flex-1"
                style={{ paddingVertical: 0 }}
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
              </Card>
            </NavPage>
          )}
        </NavStack>
      </View>
      <Toaster closeOnEscape={false} />
    </SidebarProvider>
  );
}
