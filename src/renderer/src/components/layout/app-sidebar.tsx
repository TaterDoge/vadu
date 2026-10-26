import { AnimatedThemeToggler } from "@renderer/components/ui/animated-theme-toggler";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

import { NAV_GROUPS, type SectionId } from "./nav";
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
      {/* macOS 红黄绿按钮浮在窗口左上角，让出 h-7 拖拽带的高度 */}
      <SidebarHeader className={cn(IS_MAC && "pt-7")}>
        <div className="flex h-10 items-center gap-2 overflow-hidden px-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground text-xs">
            v
          </div>
          {collapsed ? null : (
            <div className="min-w-0 leading-tight">
              <div className="truncate font-medium text-sm">vadu</div>
              <div className="truncate text-muted-foreground text-xs">
                管理面板
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
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
