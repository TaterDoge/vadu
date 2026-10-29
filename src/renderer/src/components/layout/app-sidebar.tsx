import { AnimatedThemeToggler } from "@renderer/components/ui/animated-theme-toggler";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@renderer/components/ui/sidebar";
import { IS_MAC } from "@renderer/lib/platform";
import { cn } from "cn";

import { StaggerList } from "../ui/stagger-list";
import { NAV_ITEMS, type SectionId } from "./nav";
import { StyleSwitcher } from "./style-switcher";

type AppSidebarProps = {
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
};

export function AppSidebar({
  section,
  onSectionChange,
}: AppSidebarProps): React.ReactNode {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      {/* macOS 无原生标题栏按钮：顶部让出 h-7 拖拽带，别让内容落进拖拽区 */}
      <SidebarHeader className={cn(IS_MAC && "pt-7")}>
        <div className="flex h-10 items-center gap-2 overflow-hidden px-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground text-xs">
            v
          </div>
          {/* 交给 primitive 的折叠动画：折叠时与分组标签一起收起，而不是直接消失 */}
          <div
            className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden"
            data-sidebar="sidebar-title"
          >
            <div className="truncate font-medium text-sm">vadu</div>
            <div className="truncate text-muted-foreground text-xs">
              管理面板
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <StaggerList>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={section === item.id}
                      onClick={() => onSectionChange(item.id)}
                      tooltip={item.label}
                    >
                      {/* Iconify 是空 span + mask，shadcn 的 [&_svg]:size-4 选不中，尺寸要自己写 */}
                      <span
                        aria-hidden="true"
                        className={cn(item.icon, "size-4 shrink-0")}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </StaggerList>
      </SidebarContent>

      <SidebarFooter
        className={cn(
          "flex-row items-center justify-between gap-1",
          // 折叠后只有 3rem 宽，两个按钮并排会溢出
          collapsed && "flex-col"
        )}
      >
        <AnimatedThemeToggler />
        <StyleSwitcher />
        <SidebarTrigger />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
