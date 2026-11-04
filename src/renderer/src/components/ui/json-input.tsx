import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";
import { clsx } from "clsx";

type JsonInputProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "defaultValue"
> & {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  height?: number;
  placeholder?: string;
};

export function JsonInput({
  value,
  onChange,
  disabled,
  height = 150,
  placeholder,
  className,
  ...props
}: JsonInputProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (text: string): void => {
    onChange(text);

    if (text.trim() === "") {
      setError(null);
      return;
    }

    try {
      JSON.parse(text);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "格式错误");
    }
  };

  return (
    <div className={clsx("flex flex-col gap-1.5", className)} {...props}>
      <textarea
        className={clsx(
          "resize-none rounded-md border bg-background p-2 font-mono text-sm outline-none",
          error && "border-destructive"
        )}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={Math.ceil(height / 20)}
        value={value}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
