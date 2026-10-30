import { SidebarInset } from "@renderer/components/ui/sidebar";

type PageFrameProps = {
  children?: React.ReactNode;
};

/** 右侧内容区骨架：页面自带标题，这里只提供滚动槽与内容宽度。 */
export function PageFrame({ children }: PageFrameProps): React.ReactNode {
  return (
    <SidebarInset className="min-w-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pt-8 pb-10">
          {children}
        </div>
      </div>
    </SidebarInset>
  );
}
