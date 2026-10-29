import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

/** 主题色只换强调色 token（见 styles.css 的 [data-accent]），深浅两套值由 light-dark() 按 color-scheme 选中 */
export const ACCENT_NAMES = [
  "neutral",
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
] as const;
export type AccentName = (typeof ACCENT_NAMES)[number];

type AccentContextValue = {
  accent: AccentName;
  setAccent: (accent: AccentName) => void;
};

const STORAGE_KEY = "vadu:accent";
const DEFAULT_ACCENT: AccentName = "neutral";

const AccentContext = createContext<AccentContextValue | null>(null);

function readStoredAccent(): AccentName {
  const stored = localStorage.getItem(STORAGE_KEY);
  return ACCENT_NAMES.find((name) => name === stored) ?? DEFAULT_ACCENT;
}

export function AccentProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [accent, setStoredAccent] = useState<AccentName>(readStoredAccent);

  // layout effect：被动 effect 在首帧之后才跑，浅色主题下已存色会先画一帧中性再变
  useLayoutEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setAccent = useCallback((next: AccentName): void => {
    setStoredAccent(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<AccentContextValue>(
    () => ({ accent, setAccent }),
    [accent, setAccent]
  );

  return <AccentContext value={value}>{children}</AccentContext>;
}

export function useAccent(): AccentContextValue {
  const context = useContext(AccentContext);
  if (!context) {
    throw new Error("useAccent 必须在 AccentProvider 内使用");
  }
  return context;
}
