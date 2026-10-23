import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "@renderer/components/ui/button";
import { useTheme } from "@renderer/lib/theme";
import { cn } from "cn";
import { MoonIcon, SunIcon } from "lucide-react";

export type TransitionVariant =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "rectangle"
  | "star";

type AnimatedThemeTogglerProps = {
  className?: string;
  duration?: number;
  variant?: TransitionVariant;
  /** 从视口中心扩散，而不是从按钮中心 */
  fromCenter?: boolean;
};

function polygonCollapsed(point: string, vertexCount: number): string {
  return `polygon(${Array.from({ length: vertexCount }, () => point).join(", ")})`;
}

// 坐标全部用百分比：Chrome 在非整数缩放的屏幕上会把 px 值渲染到错位置
function getClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  const toX = (x: number): string => `${(x / viewportWidth) * 100}%`;
  const toY = (y: number): string => `${(y / viewportHeight) * 100}%`;
  const point = (x: number, y: number): string => `${toX(x)} ${toY(y)}`;
  // circle() 的百分比半径相对 hypot(w, h) / sqrt(2) 解析
  const toRadius = (r: number): string =>
    `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;
  const circle: [string, string] = [
    `circle(0% at ${point(cx, cy)})`,
    `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
  ];

  switch (variant) {
    case "square": {
      const halfSide =
        Math.max(cx, viewportWidth - cx, cy, viewportHeight - cy) * 1.05;
      return [
        polygonCollapsed(point(cx, cy), 4),
        `polygon(${[
          point(cx - halfSide, cy - halfSide),
          point(cx + halfSide, cy - halfSide),
          point(cx + halfSide, cy + halfSide),
          point(cx - halfSide, cy + halfSide),
        ].join(", ")})`,
      ];
    }
    case "triangle": {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      return [
        polygonCollapsed(point(cx, cy), 3),
        `polygon(${[
          point(cx, cy - scale),
          point(cx + dx, cy + 0.5 * scale),
          point(cx - dx, cy + 0.5 * scale),
        ].join(", ")})`,
      ];
    }
    case "diamond": {
      const r = maxRadius * Math.SQRT2;
      return [
        polygonCollapsed(point(cx, cy), 4),
        `polygon(${[
          point(cx, cy - r),
          point(cx + r, cy),
          point(cx, cy + r),
          point(cx - r, cy),
        ].join(", ")})`,
      ];
    }
    case "hexagon": {
      const r = maxRadius * Math.SQRT2;
      const verts = Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        return point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      });
      return [
        polygonCollapsed(point(cx, cy), 6),
        `polygon(${verts.join(", ")})`,
      ];
    }
    case "rectangle": {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      return [
        polygonCollapsed(point(cx, cy), 4),
        `polygon(${[
          point(cx - halfW, cy - halfH),
          point(cx + halfW, cy - halfH),
          point(cx + halfW, cy + halfH),
          point(cx - halfW, cy + halfH),
        ].join(", ")})`,
      ];
    }
    case "star": {
      // 略微放大，避免最后一帧露出 1px 缝
      const r = maxRadius * Math.SQRT2 * 1.03;
      const star = (radius: number): string => {
        const verts: string[] = [];
        for (let i = 0; i < 5; i += 1) {
          const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(
            point(cx + radius * Math.cos(outer), cy + radius * Math.sin(outer))
          );
          const inner = outer + Math.PI / 5;
          verts.push(
            point(
              cx + radius * 0.42 * Math.cos(inner),
              cy + radius * 0.42 * Math.sin(inner)
            )
          );
        }
        return `polygon(${verts.join(", ")})`;
      };
      return [star(Math.max(2, r * 0.025)), star(r)];
    }
    default:
      return circle;
  }
}

export function AnimatedThemeToggler({
  className,
  duration = 400,
  variant = "circle",
  fromCenter = false,
}: AnimatedThemeTogglerProps): React.ReactNode {
  const { resolved, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const animRef = useRef<Animation | null>(null);
  const busyRef = useRef(false);
  const isDark = resolved === "dark";

  const cancelAnim = useCallback(() => {
    animRef.current?.cancel();
    animRef.current = null;
  }, []);

  useEffect(() => cancelAnim, [cancelAnim]);

  const toggle = useCallback(() => {
    const button = buttonRef.current;
    if (!button || busyRef.current) {
      return;
    }

    const next = isDark ? "light" : "dark";
    const applyTheme = (): void => {
      // flushSync 不保证被动 effect 已跑完，这里先同步落 class，避免快照拍到旧主题
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };

    if (typeof document.startViewTransition !== "function") {
      applyTheme();
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const { top, left, width, height } = button.getBoundingClientRect();
    const cx = fromCenter ? viewportWidth / 2 : left + width / 2;
    const cy = fromCenter ? viewportHeight / 2 : top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(cx, viewportWidth - cx),
      Math.max(cy, viewportHeight - cy)
    );
    const clipPath = getClipPaths(
      variant,
      cx,
      cy,
      maxRadius,
      viewportWidth,
      viewportHeight
    );

    const root = document.documentElement;
    root.dataset.magicuiThemeVt = "active";
    root.style.setProperty(
      "--magicui-theme-toggle-vt-duration",
      `${duration}ms`
    );
    // Firefox 在 ready 之前会画出未裁剪的新主题，先用 CSS 把收拢态钉住
    root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);

    const cleanup = (): void => {
      busyRef.current = false;
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty("--magicui-theme-toggle-vt-duration");
      root.style.removeProperty("--magicui-theme-vt-clip-from");
      cancelAnim();
    };

    busyRef.current = true;
    const transition = document.startViewTransition(() => {
      // 同步切 class，让 View Transitions 在新快照里拿到新主题
      flushSync(applyTheme);
    });
    transition.finished.finally(cleanup).catch(() => undefined);

    transition.ready
      .then(() => {
        animRef.current = root.animate(
          { clipPath },
          {
            duration,
            easing: variant === "star" ? "linear" : "ease-in-out",
            fill: "forwards",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => undefined);
  }, [cancelAnim, duration, fromCenter, isDark, setTheme, variant]);

  return (
    <Button
      aria-label={isDark ? "切换到浅色" : "切换到深色"}
      className={cn(className)}
      onClick={toggle}
      ref={buttonRef}
      size="icon-sm"
      title={isDark ? "切换到浅色" : "切换到深色"}
      variant="ghost"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
