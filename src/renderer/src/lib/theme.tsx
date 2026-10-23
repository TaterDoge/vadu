import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** 与 AppSettings.theme 保持同一套取值，后续接 vadu:config:saveSettings 时可直接落盘 */
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

  const systemResolved: ResolvedTheme = systemDark ? "dark" : "light";
  const resolved: ResolvedTheme = theme === "system" ? systemResolved : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    // 原生滚动条与表单控件不读 class，必须靠 color-scheme 才跟着变
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((next: Theme): void => {
    setStoredTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
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
