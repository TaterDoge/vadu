import { type ComponentType, type JSX, useState } from "react";
import { SidebarProvider } from "@renderer/components/ui/sidebar";
import { Toaster } from "@renderer/components/ui/sonner";
import { TooltipProvider } from "@renderer/components/ui/tooltip";
import { AccentProvider } from "@renderer/lib/accent";
import { IS_MAC } from "@renderer/lib/platform";
import { StyleProvider } from "@renderer/lib/style";
import { ThemeProvider } from "@renderer/lib/theme";

import { AppSidebar } from "./components/app-sidebar";
import { DEFAULT_SECTION, type SectionId } from "./components/nav";
import { PageFrame } from "./components/page-frame";
import { AppearancePage } from "./settings/appearance";
import { GeneralPage } from "./settings/general";
import { ProvidersPage } from "./settings/providers";
import { ShortcutsPage } from "./settings/shortcuts";

/** 已实现的分区；其余分区保留在导航里做后续里程碑入口，先渲染占位 */
const SECTIONS: Partial<Record<SectionId, ComponentType>> = {
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
  const Section = SECTIONS[section];

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
              <PageFrame>{Section ? <Section /> : <NotReady />}</PageFrame>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </AccentProvider>
      </StyleProvider>
    </ThemeProvider>
  );
}

export default App;
