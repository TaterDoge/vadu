import type { ReactNode } from "react";
import {
  AvatarGroup,
  AvatarGroupTooltip,
  AvatarGroupTooltipArrow,
} from "@animate-ui/react/primitives/avatar-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@renderer/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { ACCENT_NAMES, type AccentName, useAccent } from "@renderer/lib/accent";
import { type StyleName, useStyle } from "@renderer/lib/style";
import { type Theme, useTheme } from "@renderer/lib/theme";
import { cn } from "cn";

/** 只给读屏和无障碍用的名字：色板本身不显示文字 */
const ACCENT_LABELS: Record<AccentName, string> = {
  amber: "琥珀",
  blue: "蓝",
  emerald: "青",
  neutral: "中性",
  rose: "玫红",
  violet: "紫",
};

const THEME_OPTIONS: { icon: string; label: string; value: Theme }[] = [
  { icon: "icon-[lucide--monitor]", label: "跟随系统", value: "system" },
  { icon: "icon-[lucide--sun]", label: "明亮", value: "light" },
  { icon: "icon-[lucide--moon]", label: "暗色", value: "dark" },
];

const STYLE_OPTIONS: { icon: string; label: string; value: StyleName }[] = [
  { icon: "icon-[lucide--squircle]", label: "圆角", value: "nova" },
  { icon: "icon-[lucide--square]", label: "直角", value: "lyra" },
];

function AppearancePage(): ReactNode {
  const { accent, setAccent } = useAccent();
  const { style, setStyle } = useStyle();
  const { theme, setTheme } = useTheme();

  return (
    <ItemGroup>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <span aria-hidden="true" className="icon-[lucide--sun-moon]" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>主题</ItemTitle>
          <ItemDescription>跟随系统，或固定明亮 / 暗色</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Select
            items={THEME_OPTIONS}
            onValueChange={(value) => {
              if (value) {
                setTheme(value);
              }
            }}
            value={theme}
          >
            <SelectTrigger aria-label="主题" className="w-28">
              <SelectValue>
                {(value: Theme | null) => {
                  const option = THEME_OPTIONS.find(
                    (item) => item.value === value
                  );
                  return option ? (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(option.icon, "size-4")}
                      />
                      {option.label}
                    </>
                  ) : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span
                    aria-hidden="true"
                    className={cn(option.icon, "size-4")}
                  />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>

      <Item variant="outline">
        <ItemMedia variant="icon">
          <span aria-hidden="true" className="icon-[lucide--palette]" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>主题色</ItemTitle>
          <ItemDescription>按钮、焦点环与选中态的强调色</ItemDescription>
        </ItemContent>
        <ItemActions>
          <AvatarGroup className="gap-2" sideOffset={8} translate="-30%">
            {ACCENT_NAMES.map((name) => (
              <label
                className="cursor-pointer rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50"
                key={name}
              >
                <input
                  aria-label={ACCENT_LABELS[name]}
                  checked={accent === name}
                  className="sr-only"
                  name="accent"
                  onChange={() => setAccent(name)}
                  type="radio"
                  value={name}
                />
                {/* 色块自带 data-accent：不用在 TS 里再抄一份色值，深浅两套自动跟随当前模式 */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block size-6 rounded-full bg-primary transition-shadow",
                    accent === name &&
                      "ring-1 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  data-accent={name}
                />
                <AvatarGroupTooltip className="rounded-md bg-foreground px-2 py-1 text-background text-xs">
                  <AvatarGroupTooltipArrow className="size-2.5 fill-foreground" />
                  {ACCENT_LABELS[name]}
                </AvatarGroupTooltip>
              </label>
            ))}
          </AvatarGroup>
        </ItemActions>
      </Item>

      <Item variant="outline">
        <ItemMedia variant="icon">
          <span aria-hidden="true" className="icon-[lucide--frame]" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>组件风格</ItemTitle>
          <ItemDescription>
            圆角与字体：Nova 用 Geist Mono，Lyra 用更小的 JetBrains Mono
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Select
            items={STYLE_OPTIONS}
            onValueChange={(value) => {
              if (value) {
                setStyle(value);
              }
            }}
            value={style}
          >
            <SelectTrigger aria-label="组件风格" className="w-24">
              <SelectValue>
                {(value: StyleName | null) => {
                  const option = STYLE_OPTIONS.find(
                    (item) => item.value === value
                  );
                  return option ? (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(option.icon, "size-4")}
                      />
                      {option.label}
                    </>
                  ) : null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span
                    aria-hidden="true"
                    className={cn(option.icon, "size-4")}
                  />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>
    </ItemGroup>
  );
}

export { AppearancePage };
