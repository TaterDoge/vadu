import { type JSX, useEffect, useRef, useState } from "react";
import { AnimateIcon } from "@animate-ui/react/icons";
import { Layers } from "@renderer/components/animate-ui/icons/layers";
import { Pin } from "@renderer/components/animate-ui/icons/pin";
import { PinOff } from "@renderer/components/animate-ui/icons/pin-off";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { useInAppHotkeys } from "@renderer/hooks/use-in-app-hotkeys";
import {
  useEscapeToHide,
  useFocusOnShow,
} from "@renderer/hooks/use-quick-window";
import { AccentProvider } from "@renderer/lib/accent";
import { StyleProvider } from "@renderer/lib/style";
import { ThemeProvider } from "@renderer/lib/theme";
import type { TranslateEvent, TranslateWarning } from "@shared/ipc";
import { useHotkeys } from "@tanstack/react-hotkeys";

import { QuickInput } from "./components/quick-input";

const PLUGIN_ID = "vadu.ai";
const WARNING_MESSAGES: Record<TranslateWarning, string> = {
  EMPTY_OUTPUT: "服务商返回空译文，请重试",
  OUTPUT_TOO_LONG: "译文异常过长，请检查",
  PLACEHOLDER_MISMATCH: "变量可能被翻译，请检查",
};
const TARGET_LANGUAGES = [
  { label: "中文", value: "zh" },
  { label: "English", value: "en" },
  { label: "日本語", value: "ja" },
] as const;

type Status = "idle" | "translating" | "cancelled" | "error";

function QuickAppInner(): JSX.Element {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState<string>("zh");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState("");
  const [warnings, setWarnings] = useState<TranslateWarning[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const inputRef = useFocusOnShow<HTMLTextAreaElement>();
  const frameRef = useRef<HTMLDivElement>(null);
  useEscapeToHide();

  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refreshProfile = (): void => {
      revision += 1;
      const currentRevision = revision;
      window.vadu.config
        .listProfiles(PLUGIN_ID)
        .then((listResult) => {
          if (!alive || currentRevision !== revision) {
            return;
          }
          if (listResult.ok) {
            // 只允许已启用的服务商参与翻译
            setProfileId(
              listResult.data.find((entry) => entry.enabled)?.id ?? null
            );
          } else {
            setProfileId(null);
            setErrorMessage(listResult.error.message);
          }
        })
        .catch((reason) => {
          if (alive && currentRevision === revision) {
            setProfileId(null);
            setErrorMessage(String(reason));
          }
        });
    };
    refreshProfile();
    window.addEventListener("focus", refreshProfile);
    return () => {
      alive = false;
      window.removeEventListener("focus", refreshProfile);
    };
  }, []);

  // 先订阅再发 start：requestId 由渲染层预生成，不会丢事件
  useEffect(() => {
    const unsubscribe = window.vadu.translate.onEvent(
      (event: TranslateEvent) => {
        if (event.requestId !== requestIdRef.current) {
          return;
        }
        if (event.type === "delta") {
          setResult((prev) => prev + event.text);
          return;
        }
        if (event.type === "done") {
          setResult(event.text);
          setWarnings(event.warnings);
          setStatus("idle");
          requestIdRef.current = null;
          return;
        }
        setErrorMessage(event.error.message);
        setStatus("error");
        requestIdRef.current = null;
      }
    );
    return () => {
      const requestId = requestIdRef.current;
      requestIdRef.current = null;
      unsubscribe();
      if (requestId) {
        window.vadu.translate.cancel(requestId);
      }
    };
  }, []);

  // 渲染层重载（HMR / Ctrl+R）会把本地状态清零，但主进程仍固定中；
  // 主进程才是唯一事实来源：读回来再渲染图标，否则图标与置顶层级错位，看起来像“没生效”
  useEffect(() => {
    window.vadu.app
      .getQuickWindowPinned()
      .then((pinResult) => {
        if (pinResult.ok) {
          setPinned(pinResult.data);
        }
      })
      .catch((reason) => console.error(reason));
  }, []);

  const togglePin = (): void => {
    window.vadu.app
      .setQuickWindowPinned(!pinned)
      .then((pinResult) => {
        if (pinResult.ok) {
          setPinned(pinResult.data);
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

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }
    let frame = 0;
    const report = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.vadu.app
          .setQuickWindowContentHeight(
            Math.ceil(element.getBoundingClientRect().height)
          )
          .catch(console.error);
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const canTranslate =
    source.trim() !== "" && profileId !== null && status !== "translating";

  const translate = (): void => {
    if (!canTranslate) {
      return;
    }
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setStatus("translating");
    setResult("");
    setErrorMessage(null);
    setWarnings([]);
    const failStart = (message: string): void => {
      if (requestIdRef.current !== requestId) {
        return;
      }
      requestIdRef.current = null;
      setErrorMessage(message);
      setStatus("error");
    };
    window.vadu.translate
      .start({
        pluginId: PLUGIN_ID,
        profileId: profileId as string,
        requestId,
        source: "auto",
        target,
        text: source,
      })
      .then((response) => {
        if (!response.ok) {
          failStart(response.error.message);
        }
      })
      .catch((reason) => failStart(String(reason)));
  };

  const cancel = (): void => {
    const requestId = requestIdRef.current;
    if (!requestId) {
      return;
    }
    requestIdRef.current = null;
    window.vadu.translate.cancel(requestId);
    setStatus("cancelled");
  };

  const reset = (): void => {
    cancel();
    setWarnings([]);
    setSource("");
    setResult("");
    setStatus("idle");
    setErrorMessage(null);
  };

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="flex flex-col" ref={frameRef}>
        {/* frame:false 无边框窗口，顶栏整体可拖拽 */}
        <div className="drag-region flex h-8 shrink-0 items-center justify-between px-3">
          <AnimateIcon animateOnHover asChild>
            <Button
              aria-label={pinned ? "取消固定窗口" : "固定窗口"}
              className="no-drag"
              onClick={togglePin}
              size="icon-sm"
              title={pinned ? "取消固定窗口" : "固定窗口"}
              variant="ghost"
            >
              {pinned ? (
                <PinOff aria-hidden="true" className="size-4" />
              ) : (
                <Pin aria-hidden="true" className="size-4" />
              )}
            </Button>
          </AnimateIcon>
          <DropdownMenu>
            <AnimateIcon animateOnHover asChild>
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
                <Layers aria-hidden="true" className="size-4" />
              </DropdownMenuTrigger>
            </AnimateIcon>
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
        <div className="flex flex-col gap-2 px-2 pb-2">
          <QuickInput
            onChange={setSource}
            onError={setErrorMessage}
            placeholder="输入要翻译的文本"
            ref={inputRef}
            value={source}
          />

          <div className="flex items-center gap-1.5">
            <Select
              onValueChange={(value) => setTarget(value ?? "zh")}
              value={target}
            >
              <SelectTrigger className="min-w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGES.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status === "translating" ? (
              <Button className="flex-1" onClick={cancel} variant="outline">
                取消
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={!canTranslate}
                onClick={translate}
              >
                {profileId ? "翻译" : "请先在设置中配置 AI 服务商"}
              </Button>
            )}
            {status === "translating" ? (
              <span className="text-muted-foreground text-xs">翻译中…</span>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {errorMessage}
            </div>
          ) : null}

          {warnings.map((warning) => (
            <div
              className="rounded-lg bg-muted px-3 py-2 text-sm"
              key={warning}
              role="status"
            >
              {WARNING_MESSAGES[warning]}
            </div>
          ))}

          {result !== "" || status === "cancelled" ? (
            <div className="min-h-24 rounded-lg bg-muted px-3 py-3 text-sm">
              <div className="whitespace-pre-wrap break-words">{result}</div>
              {status === "cancelled" ? (
                <div className="mt-2 text-muted-foreground text-xs">
                  已取消，已显示的内容保留
                </div>
              ) : null}
            </div>
          ) : (
            <div className="min-h-24 rounded-lg bg-muted px-3 py-3 text-muted-foreground text-sm">
              翻译结果
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={source === "" && result === ""}
              onClick={reset}
              size="sm"
              variant="ghost"
            >
              清空
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuickApp(): JSX.Element {
  // 浮窗是独立窗口，主题/风格/主题色都得自己挂：localStorage 同源共享，但 data-* 属性不会
  return (
    <ThemeProvider>
      <StyleProvider>
        <AccentProvider>
          <QuickAppInner />
        </AccentProvider>
      </StyleProvider>
    </ThemeProvider>
  );
}
