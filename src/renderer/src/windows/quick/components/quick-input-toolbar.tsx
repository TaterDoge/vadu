import { type JSX, useEffect, useRef, useState } from "react";
import { AnimateIcon } from "@animate-ui/react/icons";
import { IconButton } from "@animate-ui/react/primitives/buttons/icon";
import { Check } from "@renderer/components/animate-ui/icons/check";
import { Copy } from "@renderer/components/animate-ui/icons/copy";
import { Eraser } from "@renderer/components/animate-ui/icons/eraser";
import { Pause } from "@renderer/components/animate-ui/icons/pause";
import { Volume2 } from "@renderer/components/animate-ui/icons/volume-2";
import { buttonVariants } from "@renderer/components/ui/button";
import { cn } from "cn";

const COPIED_DELAY_MS = 1500;

type QuickInputToolbarProps = {
  className?: string;
  onClear: () => void;
  onError?: (message: string) => void;
  value: string;
};

// 浮窗输入区工具条：只放图标按钮。新的输入操作加在这里，不动 quick-input 的布局
function QuickInputToolbar({
  className,
  onClear,
  onError,
  value,
}: QuickInputToolbarProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const spokenTextRef = useRef("");

  const stopPlayback = (): void => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.pause();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSpeaking(false);
  };

  const playAudio = (audio: HTMLAudioElement): void => {
    audio.onended = stopPlayback;
    audio.play().then(
      () => setSpeaking(true),
      () => {
        stopPlayback();
        onError?.("音频播放失败");
      }
    );
  };

  // 卸载时清掉回退定时器并释放音频，避免对已卸载组件 setState / Blob URL 泄漏
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) {
        audio.onended = null;
        audio.pause();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    },
    []
  );

  // 文本已变：正在朗读的旧音频不再属于当前输入，立即停止并释放
  useEffect(() => {
    if (!audioRef.current || spokenTextRef.current === value) {
      return;
    }
    const audio = audioRef.current;
    audioRef.current = null;
    audio.onended = null;
    audio.pause();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSpeaking(false);
  }, [value]);

  const copy = (): void => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(
          () => setCopied(false),
          COPIED_DELAY_MS
        );
      })
      .catch(console.error);
  };

  const toggleTts = (): void => {
    if (busy || value.trim() === "") {
      return;
    }
    const audio = audioRef.current;
    if (audio && spokenTextRef.current === value) {
      if (speaking) {
        audio.pause();
        setSpeaking(false);
      } else {
        playAudio(audio);
      }
      return;
    }
    if (audio) {
      stopPlayback();
    }
    setBusy(true);
    const text = value;
    window.vadu.tts
      .synthesize({ text })
      .then((result) => {
        if (!result.ok) {
          onError?.(result.error.message);
          return;
        }
        const { audio: bytes, mimeType } = result.data;
        const url = URL.createObjectURL(
          new Blob([bytes.buffer as ArrayBuffer], { type: mimeType })
        );
        objectUrlRef.current = url;
        const next = new Audio(url);
        audioRef.current = next;
        spokenTextRef.current = text;
        playAudio(next);
      })
      .catch((reason) => onError?.(String(reason)))
      .finally(() => setBusy(false));
  };

  let ttsTitle = "朗读输入内容";
  if (speaking) {
    ttsTitle = "暂停朗读";
  } else if (busy) {
    ttsTitle = "正在合成语音…";
  }

  return (
    <div
      className={cn("flex shrink-0 items-center justify-between", className)}
    >
      <div className="flex items-center gap-1">
        <AnimateIcon animateOnHover asChild>
          <IconButton
            aria-label={speaking ? "暂停朗读" : "朗读输入内容"}
            aria-pressed={speaking}
            className={buttonVariants({
              className: "rounded-sm p-1",
              size: "icon-xs",
              variant: "secondary",
            })}
            disabled={value.length === 0 || busy}
            onClick={toggleTts}
            // 同复制按钮：不抢焦点，朗读时仍能在文本域继续编辑
            onMouseDown={(event) => event.preventDefault()}
            title={ttsTitle}
          >
            {speaking ? (
              <Pause
                aria-hidden="true"
                className={cn("size-3.5", busy && "animate-pulse")}
              />
            ) : (
              <Volume2
                aria-hidden="true"
                className={cn("size-3.5", busy && "animate-pulse")}
              />
            )}
          </IconButton>
        </AnimateIcon>
        <AnimateIcon animateOnHover asChild>
          <IconButton
            aria-label="复制输入内容"
            className={buttonVariants({
              className: "rounded-sm p-1",
              size: "icon-xs",
              variant: "secondary",
            })}
            disabled={value.length === 0}
            onClick={copy}
            // 按下就不抢焦点：否则文本域失焦，选区与光标位置一起丢失
            onMouseDown={(event) => event.preventDefault()}
            title="复制输入内容"
          >
            {/* 两个图标叠放靠透明度过渡，复制成功时原地换成勾 */}
            <span className="relative inline-flex size-3.5 items-center justify-center">
              <Copy
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-opacity duration-150",
                  copied && "opacity-0"
                )}
              />
              <Check
                aria-hidden="true"
                className={cn(
                  "absolute size-3.5 transition-opacity duration-150",
                  copied ? "opacity-100" : "opacity-0"
                )}
              />
            </span>
          </IconButton>
        </AnimateIcon>
      </div>
      <AnimateIcon animateOnHover asChild>
        <IconButton
          aria-label="清空输入"
          className={buttonVariants({
            className: "rounded-sm p-1",
            size: "icon-xs",
            variant: "secondary",
          })}
          disabled={value.length === 0}
          onClick={onClear}
          // 同上：清空后光标还留在文本域，可以直接继续输入
          onMouseDown={(event) => event.preventDefault()}
          title="清空输入"
        >
          <Eraser aria-hidden="true" className="size-3.5" />
        </IconButton>
      </AnimateIcon>
    </div>
  );
}

export { QuickInputToolbar };
