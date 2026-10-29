import { type JSX, useEffect, useRef, useState } from "react";
import { IconButton } from "@animate-ui/react/primitives/buttons/icon";
import { buttonVariants } from "@renderer/components/ui/button";
import { cn } from "cn";

const COPIED_DELAY_MS = 1500;

type QuickInputToolbarProps = {
  className?: string;
  onClear: () => void;
  value: string;
};

// 浮窗输入区工具条：只放图标按钮。新的输入操作加在这里，不动 quick-input 的布局
function QuickInputToolbar({
  className,
  onClear,
  value,
}: QuickInputToolbarProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  // 卸载时清掉回退定时器，避免对已卸载组件 setState
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

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

  // shortcut: TTS 服务未接入，这里只切换图标状态；接上朗读后在此启动/暂停音频并同步真实播放状态
  const toggleTts = (): void => setSpeaking((prev) => !prev);

  return (
    <div
      className={cn("flex shrink-0 items-center justify-between", className)}
    >
      <div className="flex items-center gap-1">
        <IconButton
          aria-label={speaking ? "暂停朗读" : "朗读输入内容"}
          aria-pressed={speaking}
          className={buttonVariants({
            className: "rounded-sm p-1",
            size: "icon-xs",
            variant: "secondary",
          })}
          disabled={value.length === 0}
          onClick={toggleTts}
          // 同复制按钮：不抢焦点，朗读时仍能在文本域继续编辑
          onMouseDown={(event) => event.preventDefault()}
          title={speaking ? "暂停朗读" : "朗读输入内容"}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-3.5",
              speaking ? "icon-[lucide--pause]" : "icon-[lucide--volume-2]"
            )}
          />
        </IconButton>
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
            <span
              aria-hidden="true"
              className={cn(
                "icon-[lucide--copy] size-3.5 transition-opacity duration-150",
                copied && "opacity-0"
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "icon-[lucide--check] absolute size-3.5 transition-opacity duration-150",
                copied ? "opacity-100" : "opacity-0"
              )}
            />
          </span>
        </IconButton>
      </div>
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
        <span aria-hidden="true" className="icon-[lucide--eraser] size-3.5" />
      </IconButton>
    </div>
  );
}

export { QuickInputToolbar };
