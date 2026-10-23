import { type JSX, useState } from "react";
import { IS_MAC } from "@renderer/lib/platform";

import { AppSidebar } from "./components/layout/app-sidebar";
import { DEFAULT_SECTION, type SectionId } from "./components/layout/nav";
import { PageFrame } from "./components/layout/page-frame";
import { ShortcutsPage } from "./components/pages/shortcuts-page";
import { SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { StyleProvider } from "./lib/style";
import { ThemeProvider } from "./lib/theme";

function App(): JSX.Element {
  const [section, setSection] = useState<SectionId>(DEFAULT_SECTION);

  return (
    <ThemeProvider>
      <StyleProvider>
        <TooltipProvider>
          <SidebarProvider className="h-svh min-h-0 overflow-hidden">
            {/* macOS 无标题栏，红黄绿按钮浮在内容上：只留一条透明拖拽带，不占布局分区 */}
            {IS_MAC ? (
              <div className="drag-region fixed inset-x-0 top-0 z-50 h-7" />
            ) : null}
            <AppSidebar onSectionChange={setSection} section={section} />
            <PageFrame section={section}>
              {section === "shortcuts" ? <ShortcutsPage /> : null}
            </PageFrame>
          </SidebarProvider>
        </TooltipProvider>
      </StyleProvider>
    </ThemeProvider>
  );
}

export default App;
