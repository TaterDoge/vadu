import type { JSX, Ref } from "react";
import { Textarea } from "@renderer/components/ui/textarea";
import { cn } from "cn";

import { QuickInputToolbar } from "./quick-input-toolbar";

type QuickInputProps = {
  className?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ref?: Ref<HTMLTextAreaElement>;
  value: string;
};

// 浮窗输入区：文本域 + 工具条。工具条的图标按钮都在 quick-input-toolbar 里维护
function QuickInput({
  className,
  onChange,
  placeholder,
  ref,
  value,
}: QuickInputProps): JSX.Element {
  return (
    <div
      className={cn("flex shrink-0 flex-col rounded-lg bg-muted", className)}
    >
      <Textarea
        className="max-h-60 min-h-24 resize-none border-0 bg-transparent text-sm caret-primary focus-visible:ring-0"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ref={ref}
        value={value}
      />
      <QuickInputToolbar
        className="px-1 pb-1"
        onClear={() => onChange("")}
        value={value}
      />
    </div>
  );
}

export { QuickInput };
