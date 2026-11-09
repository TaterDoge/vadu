import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

import type { StyleName } from "./appearance";
import { updateAppearance, useAppearance } from "./appearance";

export type { StyleName } from "./appearance";

type StyleContextValue = {
  style: StyleName;
  setStyle: (style: StyleName) => void;
};

const StyleContext = createContext<StyleContextValue | null>(null);

export function StyleProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { style } = useAppearance();

  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);

  const setStyle = useCallback((next: StyleName): void => {
    updateAppearance({ style: next });
  }, []);

  const value = useMemo<StyleContextValue>(
    () => ({ setStyle, style }),
    [setStyle, style]
  );

  return <StyleContext value={value}>{children}</StyleContext>;
}

export function useStyle(): StyleContextValue {
  const context = useContext(StyleContext);
  if (!context) {
    throw new Error("useStyle 必须在 StyleProvider 内使用");
  }
  return context;
}
