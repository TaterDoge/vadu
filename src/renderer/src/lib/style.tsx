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

/** shadcn 的 style 名。两种 style 的组件代码只差 token 级细节，靠 data-style 覆盖 CSS 变量即可 */
export type StyleName = "nova" | "lyra";

type StyleContextValue = {
  style: StyleName;
  setStyle: (style: StyleName) => void;
};

const STORAGE_KEY = "vadu:style";
const DEFAULT_STYLE: StyleName = "nova";

const StyleContext = createContext<StyleContextValue | null>(null);

function readStoredStyle(): StyleName {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "lyra" ? "lyra" : DEFAULT_STYLE;
}

export function StyleProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [style, setStoredStyle] = useState<StyleName>(readStoredStyle);

  // 属性直接落 DOM，不等 React 渲染：浮窗靠它跟随主窗口的切换
  const applyStyle = useCallback((next: StyleName): void => {
    setStoredStyle(next);
    document.documentElement.dataset.style = next;
  }, []);

  useStorageSync(STORAGE_KEY, readStoredStyle, applyStyle);

  useEffect(() => {
    document.documentElement.dataset.style = style;
  }, [style]);

  const setStyle = useCallback(
    (next: StyleName): void => {
      applyStyle(next);
      localStorage.setItem(STORAGE_KEY, next);
    },
    [applyStyle]
  );

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
