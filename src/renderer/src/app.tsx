import { type ComponentType, type JSX, useState } from "react";
import { IS_MAC } from "@renderer/lib/platform";

import { AppSidebar } from "./components/layout/app-sidebar";
import { DEFAULT_SECTION, type SectionId } from "./components/layout/nav";
import { PageFrame } from "./components/layout/page-frame";
import { AppearancePage } from "./components/pages/appearance-page";
import { GeneralPage } from "./components/pages/general-page";
import { ProvidersPage } from "./components/pages/providers-page";
import { ShortcutsPage } from "./components/pages/shortcuts-page";
import { SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { AccentProvider } from "./lib/accent";
import { StyleProvider } from "./lib/style";
import { ThemeProvider } from "./lib/theme";

/** 已实现的分区；其余分区保留在导航里做后续里程碑入口，先渲染占位 */
const PAGES: Partial<Record<SectionId, ComponentType>> = {
  appearance: AppearancePage,
  general: GeneralPage,
  providers: ProvidersPage,
  shortcuts: ShortcutsPage,
};

function NotReady(): JSX.Element {
  return (
    <p className="text-muted-foreground text-sm">
      这个分区还没接上，等对应里程碑落地后可用。
    </p>
  );
}

function App(): JSX.Element {
  const [section, setSection] = useState<SectionId>(DEFAULT_SECTION);
  const Page = PAGES[section];

  return (
    <ThemeProvider>
      <StyleProvider>
        <AccentProvider>
          <TooltipProvider>
            <SidebarProvider className="h-svh min-h-0 overflow-hidden">
              {/* macOS 无标题栏且原生按钮已关：顶部只留一条透明拖拽带，不占布局分区 */}
              {IS_MAC ? (
                <div className="drag-region fixed inset-x-0 top-0 z-50 h-7" />
              ) : null}
              <AppSidebar onSectionChange={setSection} section={section} />
              <PageFrame>{Page ? <Page /> : <NotReady />}</PageFrame>
            </SidebarProvider>
          </TooltipProvider>
        </AccentProvider>
      </StyleProvider>
    </ThemeProvider>
  );
}

export default App;
