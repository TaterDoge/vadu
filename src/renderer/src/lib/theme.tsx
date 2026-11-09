import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Theme } from "./appearance";
import { updateAppearance, useAppearance } from "./appearance";

export type { Theme } from "./appearance";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === "system") {
    return systemDark ? "dark" : "light";
  }
  return theme;
}

/** 写 html：原生滚动条与表单控件不读 class，必须靠 color-scheme 才跟着变 */
function paintTheme(next: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { theme } = useAppearance();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setSystemDark(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(theme, systemDark);

  useEffect(() => {
    paintTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback((next: Theme): void => {
    updateAppearance({ theme: next });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ resolved, setTheme, theme }),
    [resolved, setTheme, theme]
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用");
  }
  return context;
}
