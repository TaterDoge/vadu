import { useSyncExternalStore } from "react";
import type {
  AppearancePatch,
  AppearanceSettings,
  IpcResult,
} from "@shared/ipc";
import { ACCENT_NAMES, STYLE_NAMES, THEME_NAMES } from "@shared/ipc";
import { toast } from "sonner";

/**
 * 外观真值在主进程 AppSettings。这里只做三件事：
 * 启动时用 localStorage 缓存先画一帧、把旧版本 localStorage 偏好补写一次、
 * 以及把主进程事件同步到当前窗口。
 */

const CACHE_KEY = "vadu:appearance";
const LEGACY_KEYS = {
  accent: "vadu:accent",
  style: "vadu:style",
  theme: "vadu:theme",
} as const;

const DEFAULTS: AppearanceSettings = {
  accent: "neutral",
  style: "nova",
  theme: "system",
};

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function isAppearance(value: unknown): value is AppearanceSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "theme" in value &&
    "style" in value &&
    "accent" in value &&
    oneOf(THEME_NAMES, value.theme) &&
    oneOf(STYLE_NAMES, value.style) &&
    oneOf(ACCENT_NAMES, value.accent)
  );
}

function readCache(): AppearanceSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isAppearance(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacy(): AppearancePatch {
  const legacy: AppearancePatch = {};
  try {
    for (const key of ["theme", "style", "accent"] as const) {
      const value = localStorage.getItem(LEGACY_KEYS[key]);
      if (key === "theme" && oneOf(THEME_NAMES, value)) {
        legacy.theme = value;
      } else if (key === "style" && oneOf(STYLE_NAMES, value)) {
        legacy.style = value;
      } else if (key === "accent" && oneOf(ACCENT_NAMES, value)) {
        legacy.accent = value;
      }
    }
  } catch {
    // 存储被禁用时退回默认外观，不阻断窗口启动
  }
  return legacy;
}

function removeLegacy(): void {
  try {
    for (const key of Object.values(LEGACY_KEYS)) {
      localStorage.removeItem(key);
    }
  } catch {
    // 删不掉只影响下次启动再迁移一次，主进程缺字段判断会保证幂等
  }
}

const cached = readCache();
let state: AppearanceSettings = cached ?? {
  ...DEFAULTS,
  ...readLegacy(),
};
/** 最近一次由主进程确认的值；旧 localStorage 值只有缓存语义，不算确认值 */
let confirmed: AppearanceSettings | null = null;
let revision = 0;
let hydration: Promise<void> | null = null;
let hydrated = false;
let eventUnsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();

function setState(next: AppearanceSettings, writeCache = true): void {
  state = next;
  if (writeCache) {
    confirmed = next;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      // 缓存写不进去不影响主进程真值
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function failRead(message: string): void {
  toast.error("读取外观设置失败", { description: message });
}

function failPersistence(message: string): void {
  toast.error("外观设置保存失败", { description: message });
}

/** 回读主进程真值；期间发生本地/另一窗口更新时，不让旧响应覆盖新状态 */
function readMainAppearance(): Promise<void> {
  const startRevision = revision;
  return window.vadu.config
    .getAppearance()
    .then((result: IpcResult<AppearanceSettings>) => {
      if (!result.ok) {
        failRead(result.error.message);
        return;
      }
      if (revision === startRevision) {
        setState(result.data);
      }
    })
    .catch((reason: unknown) => {
      failRead(String(reason));
    });
}

function bindEvents(): void {
  if (eventUnsubscribe) {
    return;
  }
  eventUnsubscribe = window.vadu.config.onAppearanceChanged((appearance) => {
    // 另一窗口已写入：本窗口的旧请求失败时不要回滚成更早的值
    revision += 1;
    if (isAppearance(appearance)) {
      setState(appearance);
    }
  });
}

function unbindEvents(): void {
  eventUnsubscribe?.();
  eventUnsubscribe = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    // 事件绑定跟随订阅生命周期：首次挂载绑定，全部卸载后解绑
    bindEvents();
    hydrateAppearance().catch((reason: unknown) => {
      console.error("[appearance] 初始化失败", reason);
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unbindEvents();
    }
  };
}

function getSnapshot(): AppearanceSettings {
  return state;
}

export function useAppearance(): AppearanceSettings {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function updateAppearance(patch: AppearancePatch): void {
  revision += 1;
  const currentRevision = revision;
  // 乐观更新让切换动画立即生效；只提交本次 patch，避免旧窗口的 style/accent 覆盖另一窗口
  setState({ ...state, ...patch }, false);
  window.vadu.config
    .setAppearance(patch)
    .then(async (result: IpcResult<AppearanceSettings>): Promise<void> => {
      if (result.ok) {
        if (currentRevision === revision) {
          setState(result.data);
        }
        return;
      }
      // 失败一定要可见；只回滚已确认值，再回读主进程，避免首次加载的旧缓存冒充真值
      failPersistence(result.error.message);
      if (currentRevision === revision) {
        if (confirmed) {
          setState(confirmed, false);
        }
        await readMainAppearance();
      }
    })
    .catch(async (reason: unknown): Promise<void> => {
      failPersistence(String(reason));
      if (currentRevision === revision) {
        if (confirmed) {
          setState(confirmed, false);
        }
        await readMainAppearance();
      }
    });
}

export function hydrateAppearance(): Promise<void> {
  if (hydration) {
    // 全部卸载后重新挂载：不重复迁移，但回读一次主进程，防止缓存过期
    return hydrated ? readMainAppearance() : hydration;
  }
  hydration = (async () => {
    try {
      let migrated = true;
      try {
        const legacy = readLegacy();
        if (Object.keys(legacy).length > 0) {
          const result = await window.vadu.config.migrateAppearance(legacy);
          migrated = result.ok;
          if (!result.ok) {
            console.error("[appearance] 旧偏好迁移失败", result.error);
            toast.error("旧外观偏好迁移失败，已保留旧键待下次重试", {
              description: result.error.message,
            });
          }
        }
      } catch (reason: unknown) {
        // invoke 失败也要继续回读主进程真值；旧键留着下次再迁
        migrated = false;
        console.error("[appearance] 旧偏好迁移失败", reason);
        toast.error("旧外观偏好迁移失败，已保留旧键待下次重试", {
          description: String(reason),
        });
      }
      if (migrated) {
        removeLegacy();
      }
      await readMainAppearance();
    } finally {
      // 初始化即使异常，重新挂载也应允许再次回读，而不是复用同一失败 promise
      hydrated = true;
    }
  })();
  return hydration;
}

export type { AccentName, StyleName, Theme } from "@shared/ipc";
