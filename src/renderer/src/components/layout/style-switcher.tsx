import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { type StyleName, useStyle } from "@renderer/lib/style";

const STYLES: { value: StyleName; label: string }[] = [
  { label: "Nova · 圆角 Geist", value: "nova" },
  { label: "Lyra · 直角等宽", value: "lyra" },
];

export function StyleSwitcher(): React.ReactNode {
  const { style, setStyle } = useStyle();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="切换组件风格"
            size="icon-sm"
            title="切换组件风格"
            variant="ghost"
          />
        }
      >
        {style === "lyra" ? (
          <span aria-hidden="true" className="icon-[lucide--frame] size-4" />
        ) : (
          <span aria-hidden="true" className="icon-[lucide--palette] size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-40">
        <DropdownMenuRadioGroup
          onValueChange={(value) => setStyle(value as StyleName)}
          value={style}
        >
          <DropdownMenuLabel>组件风格</DropdownMenuLabel>
          {STYLES.map((item) => (
            <DropdownMenuRadioItem
              className="text-nowrap"
              key={item.value}
              value={item.value}
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
