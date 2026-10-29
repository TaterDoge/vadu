import { type JSX, useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { useInAppHotkeys } from "@renderer/hooks/use-in-app-hotkeys";
import {
  useEscapeToHide,
  useFocusOnShow,
} from "@renderer/hooks/use-quick-window";
import { ThemeProvider } from "@renderer/lib/theme";
import { useHotkeys } from "@tanstack/react-hotkeys";

import { QuickInput } from "./components/quick-input";

function QuickAppInner(): JSX.Element {
  const [source, setSource] = useState("");
  const [pinned, setPinned] = useState(false);
  const inputRef = useFocusOnShow<HTMLTextAreaElement>();
  useEscapeToHide();

  // 渲染层重载（HMR / Ctrl+R）会把本地状态清零，但主进程仍固定中；
  // 主进程才是唯一事实来源：读回来再渲染图标，否则图标与置顶层级错位，看起来像“没生效”
  useEffect(() => {
    window.vadu.app
      .getQuickWindowPinned()
      .then((result) => {
        if (result.ok) {
          setPinned(result.data);
        }
      })
      .catch((reason) => console.error(reason));
  }, []);

  // 用主进程写入后的真值回填，而不是本地取反：置顶层级由主进程决定
  const togglePin = (): void => {
    window.vadu.app
      .setQuickWindowPinned(!pinned)
      .then((result) => {
        if (result.ok) {
          setPinned(result.data);
        }
      })
      .catch((reason) => console.error(reason));
  };

  useHotkeys(
    useInAppHotkeys({
      openSettings: () => window.vadu.app.showSettings().catch(console.error),
      togglePin,
    })
  );

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      {/* frame:false 无边框窗口，顶栏整体可拖拽 */}
      <div className="drag-region flex h-8 shrink-0 items-center justify-between px-3">
        <Button
          aria-label={pinned ? "取消固定窗口" : "固定窗口"}
          className="no-drag"
          onClick={togglePin}
          size="icon-sm"
          title={pinned ? "取消固定窗口" : "固定窗口"}
          variant="ghost"
        >
          {pinned ? (
            <span
              aria-hidden="true"
              className="icon-[lucide--pin-off] size-4"
            />
          ) : (
            <span aria-hidden="true" className="icon-[lucide--pin] size-4" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="功能菜单"
                className="no-drag"
                size="icon-sm"
                title="功能菜单"
                variant="ghost"
              />
            }
          >
            <span aria-hidden="true" className="icon-[lucide--layers] size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onClick={() => window.vadu.app.showSettings()}>
              打开设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.vadu.app.toggleQuickWindow()}
              variant="destructive"
            >
              收起浮窗
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
        {/* 每次唤起都自动聚焦，焦点环常亮成噪音；输入区靠 bg-muted 的底色成块，不再画边框 */}
        <QuickInput
          onChange={setSource}
          placeholder="输入要翻译的文本"
          ref={inputRef}
          value={source}
        />
        {/* M2 流式翻译接入前的结果区占位 */}
        <div className="shrink-0 rounded-lg bg-muted px-3 py-3 text-muted-foreground text-sm">
          翻译结果
        </div>
      </div>
    </div>
  );
}

export function QuickApp(): JSX.Element {
  return (
    <ThemeProvider>
      <QuickAppInner />
    </ThemeProvider>
  );
}
