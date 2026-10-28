import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { StaggerList } from "@renderer/components/ui/stagger-list";
import { Switch } from "@renderer/components/ui/switch";
import type { IconClass } from "@renderer/lib/icons";
import { ALERT_ICON } from "@renderer/lib/icons";
import { IS_MAC } from "@renderer/lib/platform";
import { acceleratorFromEvent, formatAccelerator } from "@shared/hotkey";
import {
  DEFAULT_HOTKEYS,
  type HotkeyState,
  type InAppHotkeyAction,
  type InAppHotkeyState,
} from "@shared/ipc";
import { cn } from "cn";

function AcceleratorKeys({
  accelerator,
}: {
  accelerator: string | null;
}): ReactNode {
  const keys = accelerator ? formatAccelerator(accelerator, IS_MAC) : [];
  if (keys.length === 0) {
    return <span className="px-1 text-muted-foreground text-xs">未设置</span>;
  }
  return (
    // 悬停时底色由组合键容器接管，键帽要抬成背景色才不会糊成一片
    <KbdGroup>
      {keys.map((key) => (
        <Kbd
          className="h-6 min-w-6 text-[0.7rem] group-hover/keys:bg-background"
          key={key}
        >
          {key}
        </Kbd>
      ))}
    </KbdGroup>
  );
}

/** 提示条列表项：文案长短不一，进入靠外层 StaggerList */
function HintAlert({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "default" | "destructive";
}): ReactNode {
  return (
    <Alert className="grid-cols-[auto_1fr] gap-x-2" variant={variant}>
      {children}
    </Alert>
  );
}

/** 录制一次组合键；Esc 取消，录到的合法 accelerator 经 onCapture 交给调用方保存 */
function useHotkeyRecorder(onCapture: (accelerator: string) => void): {
  cancel: () => void;
  hint: string | null;
  recording: boolean;
  start: () => void;
} {
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const stop = useCallback((): void => {
    setRecording(false);
    setHint(null);
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
    // 点空白处与 Esc 同义：结束录制并收起提示
    window.addEventListener("pointerdown", stop, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", stop, true);
    };
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

  return { cancel: stop, hint, recording, start };
}

function HotkeyItem({
  accelerator,
  defaultAccelerator,
  description,
  disabled,
  icon,
  onChange,
  title,
}: {
  accelerator: string | null;
  /** 出厂默认绑定，同时决定是否显示重置按钮 */
  defaultAccelerator: string;
  description: string;
  disabled: boolean;
  /** Iconify 类名，构建期由 @iconify/tailwind4 内联成 data URI */
  icon: IconClass;
  onChange: (accelerator: string | null) => void;
  title: string;
}): ReactNode {
  const { cancel, hint, recording, start } = useHotkeyRecorder(onChange);
  const lastBound = useRef(accelerator);
  useEffect(() => {
    if (accelerator) {
      lastBound.current = accelerator;
    }
  }, [accelerator]);

  const modified = accelerator !== defaultAccelerator;
  // shortcut: 关掉开关后只在本行内存里留着上次绑定，重载设置页后退回出厂值
  const toggle = (enabled: boolean): void => {
    onChange(enabled ? (lastBound.current ?? defaultAccelerator) : null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Item size="default" variant="outline">
        <ItemMedia variant="icon">
          <span aria-hidden="true" className={cn(icon, "size-4")} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <button
            aria-label={recording ? "取消录制" : `重新绑定「${title}」的快捷键`}
            className={cn(
              "group/keys inline-flex h-9 cursor-pointer items-center rounded-lg px-1.5 outline-none transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
              recording && "bg-muted"
            )}
            disabled={disabled}
            onClick={recording ? cancel : start}
            type="button"
          >
            {recording ? (
              <span className="px-1 text-muted-foreground text-xs">
                按下快捷键
              </span>
            ) : (
              <AcceleratorKeys accelerator={accelerator} />
            )}
          </button>
          {modified && !recording ? (
            <Button
              aria-label={`把「${title}」恢复为默认快捷键`}
              onClick={() => onChange(defaultAccelerator)}
              size="icon-xs"
              variant="ghost"
            >
              <span
                aria-hidden="true"
                className="icon-[lucide--rotate-ccw] size-3.5"
              />
            </Button>
          ) : null}
          <Switch
            aria-label={`启用「${title}」`}
            checked={accelerator !== null}
            disabled={disabled || recording}
            onCheckedChange={toggle}
          />
        </ItemActions>
      </Item>

      {hint ? (
        <HintAlert variant="default">
          <span aria-hidden="true" className={ALERT_ICON} />
          <AlertDescription>{hint}</AlertDescription>
        </HintAlert>
      ) : null}
    </div>
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
    // StaggerList 不渲染外层容器（每项各包一层），间距必须留在外层 div 上
    <div className="flex flex-col gap-4">
      {/* 每次切入本分区重跑一场入场，与 dropdown-menu 的行入场同一套节奏 */}
      <StaggerList>
        <h2 className="font-medium text-sm">全局快捷键</h2>
        <HotkeyItem
          accelerator={state?.accelerator ?? null}
          defaultAccelerator={DEFAULT_HOTKEYS.global}
          description="按一次唤起并聚焦翻译窗口，再按一次隐藏到后台"
          disabled={state === null}
          icon="icon-[lucide--keyboard]"
          onChange={applyGlobal}
          title="唤起 / 隐藏翻译浮窗"
        />

        <h2 className="font-medium text-sm">局内快捷键</h2>
        <HotkeyItem
          accelerator={inApp?.openSettings ?? null}
          defaultAccelerator={DEFAULT_HOTKEYS.inApp.openSettings}
          description="在翻译浮窗内打开设置页面，仅浮窗聚焦时生效"
          disabled={inApp === null}
          icon="icon-[lucide--settings]"
          onChange={(accelerator) => applyInApp("openSettings", accelerator)}
          title="浮窗内打开设置"
        />

        <HotkeyItem
          accelerator={inApp?.togglePin ?? null}
          defaultAccelerator={DEFAULT_HOTKEYS.inApp.togglePin}
          description="在浮窗内切换图钉（固定窗口），仅浮窗聚焦时生效"
          disabled={inApp === null}
          icon="icon-[lucide--pin]"
          onChange={(accelerator) => applyInApp("togglePin", accelerator)}
          title="浮窗内切换固定窗口"
        />

        {hint ? (
          <HintAlert>
            <span aria-hidden="true" className={ALERT_ICON} />
            <AlertDescription>{hint}</AlertDescription>
          </HintAlert>
        ) : null}

        {error ? (
          <HintAlert variant="destructive">
            <span aria-hidden="true" className={ALERT_ICON} />
            <AlertDescription>{error}</AlertDescription>
          </HintAlert>
        ) : null}
      </StaggerList>
    </div>
  );
}

export { ShortcutsPage };
