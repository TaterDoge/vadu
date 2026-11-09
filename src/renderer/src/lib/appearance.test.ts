import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import type {
  AppearancePatch,
  AppearanceSettings,
  IpcResult,
} from "@shared/ipc";
import ts from "typescript";

const CACHE_KEY = "vadu:appearance";
const LEGACY_KEYS = ["vadu:theme", "vadu:style", "vadu:accent"] as const;

const MAIN: AppearanceSettings = {
  accent: "neutral",
  style: "nova",
  theme: "system",
};

type ToastError = { description?: string; message: string };

type LoadOptions = {
  cache?: AppearanceSettings;
  legacy?: AppearancePatch;
  main?: AppearanceSettings;
  migrate?: (legacy: AppearancePatch) => Promise<IpcResult<AppearanceSettings>>;
  get?: () => Promise<IpcResult<AppearanceSettings>>;
  set?: (patch: AppearancePatch) => Promise<IpcResult<AppearanceSettings>>;
};

function okay(data: AppearanceSettings): IpcResult<AppearanceSettings> {
  return { data, ok: true };
}

function loadAppearance(options: LoadOptions = {}) {
  const storage = new Map<string, string>();
  if (options.cache) {
    storage.set(CACHE_KEY, JSON.stringify(options.cache));
  }
  for (const key of LEGACY_KEYS) {
    const name = key.slice("vadu:".length) as keyof AppearancePatch;
    if (options.legacy?.[name] !== undefined) {
      storage.set(key, String(options.legacy[name]));
    }
  }

  const main = options.main ?? MAIN;
  const calls = {
    get: 0,
    migrate: [] as AppearancePatch[],
    set: [] as AppearancePatch[],
  };
  const toastErrors: ToastError[] = [];
  const eventListeners: ((appearance: AppearanceSettings) => void)[] = [];
  let eventUnsubscribes = 0;
  let snapshot: (() => AppearanceSettings) | null = null;
  const unsubscribes: (() => void)[] = [];

  const config = {
    getAppearance: () => {
      calls.get += 1;
      return options.get ? options.get() : Promise.resolve(okay(main));
    },
    migrateAppearance: (legacy: AppearancePatch) => {
      calls.migrate.push(legacy);
      return options.migrate
        ? options.migrate(legacy)
        : Promise.resolve(okay(main));
    },
    onAppearanceChanged: (fn: (appearance: AppearanceSettings) => void) => {
      eventListeners.push(fn);
      return () => {
        eventUnsubscribes += 1;
        const index = eventListeners.indexOf(fn);
        if (index >= 0) {
          eventListeners.splice(index, 1);
        }
      };
    },
    setAppearance: (patch: AppearancePatch) => {
      calls.set.push(patch);
      return options.set
        ? options.set(patch)
        : Promise.resolve(okay({ ...main, ...patch }));
    },
  };

  const exports: Record<string, unknown> = {};
  const source = readFileSync(
    join(import.meta.dirname, "appearance.ts"),
    "utf8"
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    console: { error: () => undefined },
    exports,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    require: (name: string) => {
      if (name === "react") {
        return {
          useSyncExternalStore: (
            subscribe: (listener: () => void) => () => void,
            getSnapshot: () => AppearanceSettings
          ) => {
            snapshot = getSnapshot;
            unsubscribes.push(subscribe(() => undefined));
            return getSnapshot();
          },
        };
      }
      if (name === "@shared/ipc") {
        return {
          ACCENT_NAMES: [
            "neutral",
            "blue",
            "emerald",
            "amber",
            "rose",
            "violet",
          ],
          STYLE_NAMES: ["nova", "lyra"],
          THEME_NAMES: ["system", "light", "dark"],
        };
      }
      if (name === "sonner") {
        return {
          toast: {
            error: (message: string, opts?: { description?: string }) => {
              toastErrors.push({ description: opts?.description, message });
            },
          },
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    window: { vadu: { config } },
  });

  return {
    calls,
    eventListeners,
    get eventUnsubscribes() {
      return eventUnsubscribes;
    },
    exports: exports as {
      hydrateAppearance: () => Promise<void>;
      updateAppearance: (patch: AppearancePatch) => void;
      useAppearance: () => AppearanceSettings;
    },
    state: () => {
      if (!snapshot) {
        throw new Error("useAppearance 尚未调用");
      }
      return snapshot();
    },
    storage,
    toastErrors,
    unsubscribes,
  };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** 测试里用真实模块导出的 hook；单独取值避免静态 hook 规则误判 */
function mount(harness: ReturnType<typeof loadAppearance>): AppearanceSettings {
  const read = harness.exports.useAppearance;
  return read();
}

async function assertMigrationFallback(
  migrate: (legacy: AppearancePatch) => Promise<IpcResult<AppearanceSettings>>
): Promise<void> {
  const harness = loadAppearance({
    legacy: { accent: "rose", style: "lyra", theme: "dark" },
    main: MAIN,
    migrate,
  });
  mount(harness);
  await harness.exports.hydrateAppearance();

  assert.deepEqual({ ...harness.state() }, MAIN);
  assert.equal(harness.calls.get, 1);
  for (const key of LEGACY_KEYS) {
    assert.equal(
      harness.storage.has(key),
      true,
      `迁移失败必须保留旧键 ${key} 供下次重试`
    );
  }
  assert.equal(harness.storage.get(CACHE_KEY), JSON.stringify(MAIN));
  assert.equal(
    harness.toastErrors.some((entry) => entry.message.includes("迁移失败")),
    true
  );
}

test("迁移失败或 invoke reject 仍回读主进程真值，旧键保留", async () => {
  await assertMigrationFallback(() =>
    Promise.resolve({
      error: {
        code: "INVALID_CONFIG",
        message: "磁盘写入失败",
        retryable: false,
      },
      ok: false,
    })
  );
  await assertMigrationFallback(() => Promise.reject(new Error("ipc down")));
});

test("updateAppearance 只发送 patch，本地乐观显示合并值", async () => {
  const initial = { accent: "rose", style: "lyra", theme: "system" } as const;
  const saved = deferred<IpcResult<AppearanceSettings>>();
  const harness = loadAppearance({
    cache: initial,
    main: initial,
    set: () => saved.promise,
  });
  mount(harness);
  await harness.exports.hydrateAppearance();

  harness.exports.updateAppearance({ theme: "dark" });
  assert.deepEqual(harness.calls.set, [{ theme: "dark" }]);
  assert.deepEqual({ ...harness.state() }, { ...initial, theme: "dark" });

  saved.resolve(okay({ ...initial, theme: "dark" }));
  await flush();
  assert.deepEqual({ ...harness.state() }, { ...initial, theme: "dark" });
});

for (const rejected of [false, true]) {
  test(`首次读取未完成时保存失败仍回读真值（reject=${rejected}）`, async () => {
    const stale = { accent: "rose", style: "lyra", theme: "dark" } as const;
    const firstRead = deferred<IpcResult<AppearanceSettings>>();
    let reads = 0;
    const harness = loadAppearance({
      cache: stale,
      get: () => {
        reads += 1;
        return reads === 1 ? firstRead.promise : Promise.resolve(okay(MAIN));
      },
      set: () =>
        rejected
          ? Promise.reject(new Error("保存失败"))
          : Promise.resolve({
              error: {
                code: "INTERNAL",
                message: "保存失败",
                retryable: false,
              },
              ok: false,
            }),
    });
    mount(harness);
    harness.exports.updateAppearance({ theme: "light" });
    await flush();

    assert.equal(reads, 2);
    assert.deepEqual({ ...harness.state() }, MAIN);
    assert.equal(harness.storage.get(CACHE_KEY), JSON.stringify(MAIN));
    assert.equal(
      harness.toastErrors.some((entry) => entry.message === "外观设置保存失败"),
      true
    );

    firstRead.resolve(okay(stale));
    await harness.exports.hydrateAppearance();
    assert.deepEqual({ ...harness.state() }, MAIN);
  });
}

test("过时保存失败仍提示，但不回滚更新的主进程值", async () => {
  const initial = {
    accent: "neutral",
    style: "nova",
    theme: "system",
  } as const;
  const first = deferred<IpcResult<AppearanceSettings>>();
  const second = deferred<IpcResult<AppearanceSettings>>();
  const pending = [first, second];
  const harness = loadAppearance({
    cache: initial,
    main: initial,
    set: () => {
      const next = pending.shift();
      if (!next) {
        throw new Error("unexpected setAppearance call");
      }
      return next.promise;
    },
  });
  mount(harness);
  await harness.exports.hydrateAppearance();

  harness.exports.updateAppearance({ theme: "dark" });
  harness.exports.updateAppearance({ style: "lyra" });
  // 另一窗口先写入：revision 前进，旧请求的失败不得把它改回去
  const latest = { accent: "blue", style: "lyra", theme: "light" } as const;
  harness.eventListeners[0]?.(latest);
  await flush();

  first.resolve({
    error: {
      code: "INTERNAL",
      message: "旧保存失败",
      retryable: false,
    },
    ok: false,
  });
  await flush();

  assert.deepEqual({ ...harness.state() }, latest);
  assert.equal(
    harness.toastErrors.some(
      (entry) =>
        entry.message === "外观设置保存失败" &&
        entry.description === "旧保存失败"
    ),
    true
  );

  second.resolve(okay(latest));
  await flush();
  assert.deepEqual({ ...harness.state() }, latest);
});

test("首个订阅绑定事件，全部卸载解绑；重挂回读主进程", async () => {
  const nextMain = { accent: "amber", style: "lyra", theme: "dark" } as const;
  let main = MAIN;
  const harness = loadAppearance({
    get: () => Promise.resolve(okay(main)),
    main,
  });
  harness.calls.get = 0;

  mount(harness);
  mount(harness);
  await harness.exports.hydrateAppearance();
  assert.equal(harness.eventListeners.length, 1);

  harness.unsubscribes[0]?.();
  assert.equal(harness.eventUnsubscribes, 0);
  harness.unsubscribes[1]?.();
  assert.equal(harness.eventUnsubscribes, 1);

  main = nextMain;
  mount(harness);
  await harness.exports.hydrateAppearance();
  assert.equal(harness.eventListeners.length, 1);
  assert.equal(harness.eventUnsubscribes, 1);
  assert.deepEqual({ ...harness.state() }, nextMain);
});

test("hydrate 成功后删除旧 localStorage 键", async () => {
  const harness = loadAppearance({
    legacy: { accent: "rose", style: "lyra", theme: "dark" },
    main: MAIN,
  });
  mount(harness);
  await harness.exports.hydrateAppearance();
  assert.equal(harness.storage.has("vadu:theme"), false);
  assert.equal(harness.storage.has("vadu:style"), false);
  assert.equal(harness.storage.has("vadu:accent"), false);
  assert.deepEqual({ ...harness.state() }, MAIN);
});
