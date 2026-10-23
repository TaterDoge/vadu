import { SidebarInset } from "@renderer/components/ui/sidebar";

import { type SectionId, getNavItem } from "./nav";

type PageFrameProps = {
  section: SectionId;
  children?: React.ReactNode;
};

/** 右侧内容区骨架：标题区 + 可滚动内容槽。 */
export function PageFrame({
  section,
  children,
}: PageFrameProps): React.ReactNode {
  const item = getNavItem(section);

  return (
    <SidebarInset className="min-w-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-6 pt-8 pb-4">
          <h1 className="font-heading font-semibold text-xl tracking-tight">
            {item.label}
          </h1>
          <p className="text-muted-foreground text-sm">{item.description}</p>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-10">
          {children}
        </div>
      </div>
    </SidebarInset>
  );
}
