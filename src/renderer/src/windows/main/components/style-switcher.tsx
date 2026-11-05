import { AnimateIcon } from "@animate-ui/react/icons";
import { Frame } from "@renderer/components/animate-ui/icons/frame";
import { Palette } from "@renderer/components/animate-ui/icons/palette";
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
  { label: "圆角", value: "nova" },
  { label: "直角", value: "lyra" },
];

export function StyleSwitcher(): React.ReactNode {
  const { style, setStyle } = useStyle();

  return (
    <DropdownMenu>
      <AnimateIcon animateOnHover asChild>
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
            <Frame aria-hidden="true" className="size-4" />
          ) : (
            <Palette aria-hidden="true" className="size-4" />
          )}
        </DropdownMenuTrigger>
      </AnimateIcon>
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
