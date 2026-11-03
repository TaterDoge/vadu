import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useStorageSync } from "./use-storage-sync";

/**
 * 主题真值目前只存在渲染层 localStorage（`AppSettings.theme` 是接 config 通道后的落盘点）。
 * 在那之前不要再从主进程读它，否则会出现两个互相矛盾的值。
 */
export type Theme = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "vadu:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

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
  const [theme, setStoredTheme] = useState<Theme>(readStoredTheme);
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

  const applyTheme = useCallback((next: Theme): void => {
    setStoredTheme(next);
    paintTheme(resolveTheme(next, window.matchMedia(DARK_QUERY).matches));
  }, []);

  useStorageSync(STORAGE_KEY, readStoredTheme, applyTheme);

  const resolved = resolveTheme(theme, systemDark);

  useEffect(() => {
    paintTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback(
    (next: Theme): void => {
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    },
    [applyTheme]
  );

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
