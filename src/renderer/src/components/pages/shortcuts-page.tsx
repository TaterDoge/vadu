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
import { IS_MAC } from "@renderer/lib/platform";
import { acceleratorFromEvent, formatAccelerator } from "@shared/hotkey";
import type { HotkeyState } from "@shared/ipc";
import { AlertCircleIcon, KeyboardIcon, Trash2Icon } from "lucide-react";

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

function ShortcutsPage(): ReactNode {
  const [state, setState] = useState<HotkeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const result = await window.vadu.hotkey.get();
    if (result.ok) {
      setState(result.data);
      return;
    }
    setError(result.error.message ?? result.error.code);
  }, []);

  useEffect(() => {
    load().catch((reason) => console.error(reason));
  }, [load]);

  const applyAccelerator = useCallback(
    async (accelerator: string | null): Promise<void> => {
      setHint(null);
      setError(null);
      const result = await window.vadu.hotkey.set(accelerator);
      if (!result.ok) {
        setError(result.error.message ?? result.error.code);
        return;
      }
      setState(result.data);
      if (accelerator !== null && !result.data.registered) {
        setHint("该组合已被系统或其他应用占用，请换一个");
      }
    },
    []
  );

  const stopRecording = useCallback((): void => {
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
        stopRecording();
        return;
      }
      const accelerator = acceleratorFromEvent(event, IS_MAC);
      if (accelerator === null) {
        setHint(
          "需要包含 ⌘/Ctrl/Alt 等修饰键，且主键须是字母、数字、F1–F24 或方向键"
        );
        return;
      }
      settled = true;
      stopRecording();
      applyAccelerator(accelerator).catch((reason) => console.error(reason));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, stopRecording, applyAccelerator]);

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

  const startRecording = (): void => {
    setHint(null);
    setError(null);
    setRecording(true);
    window.vadu.hotkey.suspend(true).catch((reason) => console.error(reason));
  };

  return (
    <div className="flex flex-col gap-4">
      <Item
        className={recording ? "border-ring ring-3 ring-ring/50" : undefined}
        size="default"
        variant="outline"
      >
        <ItemMedia variant="icon">
          <KeyboardIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>显示 / 隐藏窗口</ItemTitle>
          <ItemDescription>
            {recording
              ? "正在录制，按下组合键（Esc 取消）"
              : "按一次唤起并聚焦窗口，再按一次隐藏到后台"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <AcceleratorKeys accelerator={state?.accelerator ?? null} />
          <Button
            disabled={state === null || recording}
            onClick={startRecording}
            size="sm"
            variant={recording ? "secondary" : "outline"}
          >
            {recording ? "录制中…" : "录制"}
          </Button>
          <Button
            aria-label="清除快捷键"
            disabled={recording || !state?.accelerator}
            onClick={() => {
              applyAccelerator(null).catch((reason) => console.error(reason));
            }}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </ItemActions>
      </Item>

      {hint ? (
        <Alert>
          <AlertCircleIcon />
          <AlertDescription>{hint}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { ShortcutsPage };
