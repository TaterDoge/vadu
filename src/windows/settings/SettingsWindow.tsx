import {
  History,
  Keyboard,
  Palette,
  Server,
  Settings as SettingsIcon,
} from 'lucide';
import { effect, Scroll, signal, Text, View, windowSize } from 'nsh';
import { currentWindow } from 'nsh/desktop';

import { Card } from '@/components/ui/card';
import { createNavStack, NavPage, NavStack } from '@/components/ui/nav-stack';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  sidebarMenuButtonLook,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
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

const SETTINGS_SIDEBAR_BREAKPOINT = 768;
const SETTINGS_SIDEBAR_WIDTH = 216;
const SETTINGS_SIDEBAR_COLLAPSED_WIDTH = 64;
const SETTINGS_SIDEBAR_COLLAPSED_ICON_SIZE = 20;

function SidebarFooterActions() {
  const sidebar = useSidebar();
  return (
    <SidebarFooter
      style={{ alignItems: sidebar.open ? 'flex-start' : 'center' }}
    >
      <SidebarTrigger
        accessibilityLabel={
          sidebar.state === 'expanded' ? '折叠侧栏' : '展开侧栏'
        }
      />
    </SidebarFooter>
  );
}

function SettingsSidebarMenu(props: {
  activeNav: () => SettingsRoute;
  onSelect: (page: SettingsRoute) => void;
}) {
  const sidebar = useSidebar();
  return (
    <View role="navigation" accessibilityLabel="设置分类" class="px-3">
      <SidebarMenu>
        {settingsPages.map((page) => {
          const active = () => props.activeNav().id === page.id;
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
                  if (!active()) props.onSelect(page);
                }}
              >
                <Icon
                  icon={page.icon}
                  size={
                    sidebar.state === 'expanded'
                      ? look.glyph.size
                      : SETTINGS_SIDEBAR_COLLAPSED_ICON_SIZE
                  }
                  tint={look.glyph.tint}
                />
                <If when={sidebar.state === 'expanded'}>
                  <Text style={look.label}>{page.label}</Text>
                </If>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </View>
  );
}

export function SettingsWindow() {
  setupTray(currentWindow());
  setupTheme();
  setupShortcuts(Settings.read());
  const nav = createNavStack<SettingsRoute>([settingsPages[0]]);
  const activeNav = () => nav.routes()[nav.routes().length - 1];
  const sidebarOpen = signal(windowSize().width >= SETTINGS_SIDEBAR_BREAKPOINT);
  let isNarrow = windowSize().width < SETTINGS_SIDEBAR_BREAKPOINT;
  effect(() => {
    const nextIsNarrow = windowSize().width < SETTINGS_SIDEBAR_BREAKPOINT;
    if (nextIsNarrow === isNarrow) return;
    isNarrow = nextIsNarrow;
    sidebarOpen.set(!nextIsNarrow);
  });

  return (
    <SidebarProvider
      open={sidebarOpen()}
      onOpenChange={({ open }) => sidebarOpen.set(open)}
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
        collapsible="icon"
        width={SETTINGS_SIDEBAR_WIDTH}
        collapsedWidth={SETTINGS_SIDEBAR_COLLAPSED_WIDTH}
        desktop={{ windowDrag: true }}
      >
        <SidebarContent testID="settings-sidebar-scroll">
          <Logo />
          <SettingsSidebarMenu
            activeNav={activeNav}
            onSelect={(page) => nav.replace(page)}
          />
        </SidebarContent>
        <SidebarFooterActions />
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
