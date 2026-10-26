import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@renderer/components/ui/alert";
import { Button } from "@renderer/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@renderer/components/ui/item";
import { Kbd, KbdGroup } from "@renderer/components/ui/kbd";
import type { IconClass } from "@renderer/lib/icons";
import { ALERT_ICON } from "@renderer/lib/icons";
import { IS_MAC } from "@renderer/lib/platform";
import { acceleratorFromEvent, formatAccelerator } from "@shared/hotkey";
import type {
  HotkeyState,
  InAppHotkeyAction,
  InAppHotkeyState,
} from "@shared/ipc";
import { cn } from "cn";

function AcceleratorKeys({
  accelerator,
}: {
  accelerator: string | null;
}): ReactNode {
  const keys = accelerator ? formatAccelerator(accelerator, IS_MAC) : [];
  if (keys.length === 0) {
    return <span className="text-muted-foreground text-sm">未设置</span>;
  }
  return (
    <KbdGroup>
      {keys.map((key) => (
        <Kbd className="h-6 min-w-6 text-[0.7rem]" key={key}>
          {key}
        </Kbd>
      ))}
    </KbdGroup>
  );
}

/** 录制一次组合键；Esc 取消，录到的合法 accelerator 经 onCapture 交给调用方保存 */
function useHotkeyRecorder(onCapture: (accelerator: string) => void): {
  hint: string | null;
  recording: boolean;
  start: () => void;
} {
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const stop = useCallback((): void => {
    setRecording(false);
    window.vadu.hotkey.suspend(false).catch((reason) => console.error(reason));
  }, []);

  useEffect(() => {
    if (!recording) {
      return;
    }
    // 监听器要等重渲染后的 cleanup 才摘除，闭包标志防止同一次录制被处理两遍
    let settled = false;
    const onKeyDown = (event: KeyboardEvent): void => {
      // 录制期间吞掉所有按键，防止 Cmd+W 之类关闭窗口
      event.preventDefault();
      event.stopPropagation();
      if (settled) {
        return;
      }
      if (event.key === "Escape") {
        settled = true;
        stop();
        return;
      }
      const accelerator = acceleratorFromEvent(event, IS_MAC);
      if (accelerator === null) {
        setHint(
          "需要包含 ⌘/Ctrl/Alt 等修饰键，且主键须是字母、数字、F1–F24、方向键或标点键"
        );
        return;
      }
      settled = true;
      stop();
      onCapture(accelerator);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, stop, onCapture]);

  // 录制中途切走分区会让 suspend 永远不恢复，整个应用再也唤不起来；
  // 未录制时调用是空操作，所以卸载时无条件恢复
  useEffect(
    () => () => {
      window.vadu.hotkey
        .suspend(false)
        .catch((reason) => console.error(reason));
    },
    []
  );

  const start = useCallback((): void => {
    setHint(null);
    setRecording(true);
    window.vadu.hotkey.suspend(true).catch((reason) => console.error(reason));
  }, []);

  return { hint, recording, start };
}

function HotkeyItem({
  accelerator,
  description,
  disabled,
  icon,
  onCapture,
  onClear,
  title,
}: {
  accelerator: string | null;
  description: string;
  disabled: boolean;
  /** Iconify 类名，构建期由 @iconify/tailwind4 内联成 data URI */
  icon: IconClass;
  onCapture: (accelerator: string) => void;
  onClear: () => void;
  title: string;
}): ReactNode {
  const { hint, recording, start } = useHotkeyRecorder(onCapture);
  const displayDescription = recording
    ? "正在录制，按下组合键（Esc 取消）"
    : description;
  return (
    <>
      <Item
        className={recording ? "border-ring ring-3 ring-ring/50" : undefined}
        size="default"
        variant="outline"
      >
        <ItemMedia variant="icon">
          <span aria-hidden="true" className={cn(icon, "size-4")} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{displayDescription}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <AcceleratorKeys accelerator={accelerator} />
          <Button
            disabled={disabled || recording}
            onClick={start}
            size="sm"
            variant={recording ? "secondary" : "outline"}
          >
            {recording ? "录制中…" : "录制"}
          </Button>
          <Button
            aria-label={`清除「${title}」快捷键`}
            disabled={disabled || recording || !accelerator}
            onClick={onClear}
            size="icon-sm"
            variant="ghost"
          >
            <span
              aria-hidden="true"
              className="icon-[lucide--trash-2] size-4"
            />
          </Button>
        </ItemActions>
      </Item>

      {hint ? (
        <Alert className="grid-cols-[auto_1fr] gap-x-2">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{hint}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

function ShortcutsPage(): ReactNode {
  const [state, setState] = useState<HotkeyState | null>(null);
  const [inApp, setInApp] = useState<InAppHotkeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([window.vadu.hotkey.get(), window.vadu.hotkey.getInApp()])
      .then(([globalResult, inAppResult]) => {
        if (globalResult.ok) {
          setState(globalResult.data);
        } else {
          setError(globalResult.error.message ?? globalResult.error.code);
        }
        if (inAppResult.ok) {
          setInApp(inAppResult.data);
        } else {
          setError(inAppResult.error.message ?? inAppResult.error.code);
        }
      })
      .catch((reason) => console.error(reason));
  }, []);

  const applyGlobal = useCallback((accelerator: string | null): void => {
    setHint(null);
    setError(null);
    window.vadu.hotkey
      .set(accelerator)
      .then((result) => {
        if (!result.ok) {
          setError(result.error.message ?? result.error.code);
          return;
        }
        setState(result.data);
        if (accelerator !== null && !result.data.registered) {
          setHint("该组合已被系统或其他应用占用，请换一个");
        }
      })
      .catch((reason) => console.error(reason));
  }, []);

  const applyInApp = useCallback(
    (action: InAppHotkeyAction, accelerator: string | null): void => {
      setHint(null);
      setError(null);
      window.vadu.hotkey
        .setInApp(action, accelerator)
        .then((result) => {
          if (result.ok) {
            setInApp(result.data);
            return;
          }
          setError(result.error.message ?? result.error.code);
        })
        .catch((reason) => console.error(reason));
    },
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-medium text-sm">全局快捷键</h2>
      <HotkeyItem
        accelerator={state?.accelerator ?? null}
        description="按一次唤起并聚焦翻译窗口，再按一次隐藏到后台；应用设置窗口从托盘打开"
        disabled={state === null}
        icon="icon-[lucide--keyboard]"
        onCapture={applyGlobal}
        onClear={() => applyGlobal(null)}
        title="唤起 / 隐藏翻译浮窗"
      />

      <h2 className="font-medium text-sm">局内快捷键</h2>
      <HotkeyItem
        accelerator={inApp?.openSettings ?? null}
        description="在翻译浮窗内打开设置页面，仅浮窗聚焦时生效（默认 ⌘,）"
        disabled={inApp === null}
        icon="icon-[lucide--settings]"
        onCapture={(accelerator) => applyInApp("openSettings", accelerator)}
        onClear={() => applyInApp("openSettings", null)}
        title="浮窗内打开设置"
      />

      <HotkeyItem
        accelerator={inApp?.togglePin ?? null}
        description="在翻译浮窗内切换图钉（固定窗口），仅浮窗聚焦时生效（默认 ⌘P）"
        disabled={inApp === null}
        icon="icon-[lucide--pin]"
        onCapture={(accelerator) => applyInApp("togglePin", accelerator)}
        onClear={() => applyInApp("togglePin", null)}
        title="浮窗内切换固定窗口"
      />

      {hint ? (
        <Alert className="grid-cols-[auto_1fr] gap-x-2">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{hint}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert className="grid-cols-[auto_1fr] gap-x-2" variant="destructive">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { ShortcutsPage };
