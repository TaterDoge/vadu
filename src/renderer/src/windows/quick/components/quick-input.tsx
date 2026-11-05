import {
  type ClipboardEvent,
  type JSX,
  type Ref,
  useRef,
  useState,
} from "react";
import { Textarea } from "@renderer/components/ui/textarea";
import { cn } from "cn";

import { QuickInputToolbar } from "./quick-input-toolbar";

type QuickInputProps = {
  className?: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  ref?: Ref<HTMLTextAreaElement>;
  value: string;
};

// 经函数边界打断 Biome 常量折叠（初次读取 gate.active 在写入之前，会被判恒为 false）
function isGateActive(gate: { active: boolean }): boolean {
  return gate.active;
}

// 浮窗输入区：文本域 + 工具条。工具条的图标按钮都在 quick-input-toolbar 里维护
function QuickInput({
  className,
  onChange,
  onError,
  placeholder,
  ref,
  value,
}: QuickInputProps): JSX.Element {
  // 闸门：识别进行中忽略新粘贴，避免并发请求叠加
  const recognizingRef = useRef({ active: false });
  const [recognizing, setRecognizing] = useState(false);

  const handlePaste = async (
    event: ClipboardEvent<HTMLTextAreaElement>
  ): Promise<void> => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) {
      return;
    }
    event.preventDefault();
    if (isGateActive(recognizingRef.current)) {
      return;
    }
    recognizingRef.current.active = true;
    setRecognizing(true);
    try {
      const file = imageItem.getAsFile();
      if (!file) {
        throw new Error("无法读取剪贴板图片");
      }
      const buffer = await file.arrayBuffer();
      const result = await window.vadu.ocr.recognize({
        image: new Uint8Array(buffer),
        mimeType: file.type || "image/png",
      });
      if (result.ok) {
        const text = result.data.text.trim();
        if (text) {
          onChange(text);
        } else {
          onError?.("未识别到文字");
        }
      } else {
        onError?.(result.error.message);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
    } finally {
      recognizingRef.current.active = false;
      setRecognizing(false);
    }
  };

  return (
    <div
      className={cn("flex shrink-0 flex-col rounded-lg bg-muted", className)}
    >
      <Textarea
        className="max-h-60 min-h-24 resize-none border-0 bg-transparent text-sm caret-primary focus-visible:ring-0"
        onChange={(event) => onChange(event.target.value)}
        onPaste={handlePaste}
        placeholder={recognizing ? "识别中…" : placeholder}
        ref={ref}
        value={value}
      />
      <QuickInputToolbar
        className="px-1 pb-1"
        onClear={() => onChange("")}
        onError={onError}
        value={value}
      />
    </div>
  );
}

export { QuickInput };
