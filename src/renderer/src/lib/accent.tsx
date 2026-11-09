import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
} from "react";

import type { AccentName } from "./appearance";
import { updateAppearance, useAppearance } from "./appearance";

type AccentContextValue = {
  accent: AccentName;
  setAccent: (accent: AccentName) => void;
};

const AccentContext = createContext<AccentContextValue | null>(null);

export function AccentProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { accent } = useAppearance();

  // layout effect：被动 effect 在首帧之后才跑，浅色主题下已存色会先画一帧中性再变
  useLayoutEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setAccent = useCallback((next: AccentName): void => {
    updateAppearance({ accent: next });
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
