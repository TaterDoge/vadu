import { randomUUID } from "crypto";

import {
  Image,
  Overlay,
  Scroll,
  Text,
  View,
  cleanup,
  computed,
  effect,
  safeArea,
  signal,
  token,
} from "nsh";
import {
  Button,
  Dialog,
  Input,
  Select,
  Tab,
  Tabs,
  Toast,
  type ToastEntry,
  ToastManager,
  ToastStack,
} from "nsh/base";
import { currentWindow } from "nsh/desktop";
import { Profiles, type ProviderProfile, Secrets } from "vadu/native";

import {
  Settings,
  SettingsError,
  providerConnectionsSupported,
} from "../../../../settings";
import providerIcon from "../../icons/providers.svg";
import filterIcon from "./filter.svg";
import gripIcon from "./grip.svg";
import {
  ProviderEditor,
  type ProviderFields,
  providerButtonClass,
  providerHeadingClass,
  providerOptionsClass,
} from "./ProviderEditor";

const capabilities = ["翻译", "识别", "语音"] as const;
type Capability = (typeof capabilities)[number];
type Draft = ProviderFields & { id?: string };
type Confirmation = {
  title: string;
  description: string;
  button: string;
  action: () => Promise<void>;
};

const defaultTemperature = "0.3";
const emptyFields: ProviderFields = {
  name: "",
  protocol: "chat-completions",
  baseUrl: "",
  model: "",
  enabled: true,
  temperature: defaultTemperature,
  providerOptions: "",
  headers: "",
};
const filters = [
  { value: "all", title: "全部状态" },
  { value: "enabled", title: "仅已启用" },
  { value: "disabled", title: "仅已停用" },
];

export function ProvidersPage() {
  const capability = signal<Capability>("翻译");
  const query = signal("");
  const filter = signal("all");
  const draft = signal<Draft | null>(null);
  const error = signal("");
  const apiKey = signal("");
  const revealedKey = signal("");
  const keyVisible = signal(false);
  const keyStatus = signal("");
  const keyConfigured = signal(false);
  const models = signal<string[]>([]);
  const modelPickerOpen = signal(false);
  const busy = signal(true);
  const advancedOpen = signal(false);
  const compact = signal(false);
  const confirmation = signal<Confirmation | null>(null);
  const providers = () => Settings.current()?.profiles ?? [];
  const saved = computed(() => providers().find((p) => p.id === draft()?.id));
  const connection = computed(() => {
    const profile = saved();
    const value = draft();
    return providerConnectionsSupported &&
      profile &&
      value?.baseUrl.trim() === profile.baseUrl &&
      value.protocol === profile.protocol
      ? profile
      : null;
  });
  // 未保存时也能用已确认的地址和本次输入的密钥获取模型。
  const canFetchModels = computed(() => {
    const value = draft();
    if (
      !providerConnectionsSupported ||
      !value ||
      value.protocol !== "chat-completions" ||
      !value.baseUrl.trim()
    )
      return false;
    return apiKey().trim() !== "" || connection() !== null;
  });
  const visibleProviders = computed(() => {
    if (capability() !== "翻译") return [];
    const name = query().trim().toLowerCase();
    const status = filter();
    return providers().filter(
      (p) =>
        p.name.toLowerCase().includes(name) &&
        (status === "all" || p.enabled === (status === "enabled")),
    );
  });
  const toastManager = new ToastManager();
  const toasts = signal<ToastEntry[]>([]);
  let toastTimer: ReturnType<typeof setInterval> | undefined;
  let toastExpanded = false;
  let mounted = true;
  let keyStatusVersion = 0;
  cleanup(() => {
    mounted = false;
    hideKey();
    if (toastTimer !== undefined) clearInterval(toastTimer);
    toastManager.dispose();
  });

  function syncToasts() {
    toasts.set(toastManager.visible(1));
  }

  function showToast(message: string) {
    toastManager.push("provider", message, { timeout: 3000 });
    syncToasts();
    if (toastTimer !== undefined) return;
    toastTimer = setInterval(() => {
      if (toastManager.advance(toastExpanded).changed) syncToasts();
      if (toastManager.isEmpty()) {
        clearInterval(toastTimer);
        toastTimer = undefined;
      }
    }, 50);
  }

  void Settings.read()
    .then(({ profiles }) => {
      if (mounted) edit(profiles[0] ?? null);
    })
    .catch((cause) => {
      if (mounted) error.set(errorMessage(cause));
    })
    .finally(() => {
      if (mounted) busy.set(false);
    });

  const window = currentWindow();
  effect(() => {
    const state = window.state();
    if (state && (!state.visible || !state.focused)) hideKey();
  });

  effect(() => {
    const profile = connection();
    hideKey();
    keyConfigured.set(false);
    keyStatus.set(profile ? "正在读取本地存储…" : "");
    if (!profile) return;
    const version = ++keyStatusVersion;
    void Secrets.has(profile.id)
      .then(({ configured, error }) => {
        if (!mounted || version !== keyStatusVersion) return;
        keyConfigured.set(configured);
        keyStatus.set(
          error?.message ?? (configured ? "已保存 API Key" : "未设置 API Key"),
        );
      })
      .catch(() => {
        if (mounted && version === keyStatusVersion)
          keyStatus.set("无法读取本地存储。");
      });
    cleanup(() => {
      keyStatusVersion++;
    });
  });
  const scrollY = signal(0);
  const pointerY = signal(0);
  const drag = signal<{
    rows: ProviderProfile[];
    from: number;
    startY: number;
    step: number;
  } | null>(null);
  let rowStep = 0;
  const preview = computed(() => {
    const current = drag();
    if (!current || current.rows !== visibleProviders()) return null;
    const { rows, from, startY, step } = current;
    const delta = pointerY() + scrollY() - startY;
    const offset = Math.max(
      -from * step,
      Math.min((rows.length - 1 - from) * step, delta),
    );
    return { from, to: Math.round(from + offset / step), offset, step };
  });

  function moveProvider(from: number, to: number) {
    const rows = visibleProviders();
    if (from === to || !rows[from] || !rows[to]) return;
    const sorted = rows.slice();
    const [moved] = sorted.splice(from, 1);
    sorted.splice(to, 0, moved);
    void run(async () => {
      await Settings.orderProfiles(sorted.map(({ id }) => id));
    });
  }

  function startDrag(from: number, pageY: number) {
    pointerY.set(pageY);
    drag.set({
      rows: visibleProviders(),
      from,
      startY: pageY + scrollY(),
      step: rowStep,
    });
    return true;
  }

  function dropProvider(pageY: number) {
    pointerY.set(pageY);
    const target = preview();
    drag.set(null);
    if (target) moveProvider(target.from, target.to);
  }

  function rowOffset(index: number) {
    const target = preview();
    if (!target) return 0;
    const { from, to, offset, step } = target;
    if (index === from) return offset;
    if (from < index && index <= to) return -step;
    if (to <= index && index < from) return step;
    return 0;
  }

  function errorMessage(cause: unknown) {
    return cause instanceof SettingsError
      ? cause.message
      : "操作失败，请重试。";
  }

  async function run(
    action: () => Promise<void>,
    onError?: (message: string) => void,
  ) {
    if (busy()) return;
    busy.set(true);
    if (!onError) error.set("");
    try {
      await action();
    } catch (cause) {
      if (mounted) (onError ?? error.set)(errorMessage(cause));
    } finally {
      if (mounted) busy.set(false);
    }
  }

  function patchDraft(patch: Partial<ProviderFields>) {
    const value = draft();
    if (!value || busy()) return;
    if (
      (patch.baseUrl !== undefined && patch.baseUrl !== value.baseUrl) ||
      (patch.protocol !== undefined && patch.protocol !== value.protocol)
    ) {
      modelPickerOpen.set(false);
      models.set([]);
    }
    draft.set({ ...value, ...patch });
    error.set("");
  }

  function edit(value: Draft | null) {
    advancedOpen.set(false);
    hideKey();
    apiKey.set("");
    modelPickerOpen.set(false);
    models.set([]);
    draft.set(value);
    error.set("");
  }

  function selectCapability(value: Capability) {
    if (busy() || value === capability()) return;
    capability.set(value);
    query.set("");
    filter.set("all");
    edit(visibleProviders()[0] ?? null);
  }

  function requestSave() {
    const value = draft();
    if (!value || busy()) return;
    try {
      const create = value.id === undefined;
      const { profile, origin } = Settings.checkProfile({
        id: value.id ?? randomUUID(),
        name: value.name.trim(),
        protocol: value.protocol,
        baseUrl: value.baseUrl.trim(),
        model: value.model.trim(),
        enabled: value.enabled,
        temperature: value.temperature.trim() || defaultTemperature,
        providerOptions: value.providerOptions.trim(),
        headers: value.headers.trim(),
      });
      const action = async () => {
        const key = apiKey().trim();
        hideKey();
        apiKey.set("");
        const { keyError } = await Settings.saveProfile(profile, create, key);
        if (!mounted) return;
        if (create) {
          query.set("");
          filter.set("all");
        }
        draft.set(profile);
        if (keyError) {
          error.set(`服务商配置已保存，API Key 保存失败。${keyError}`);
          return;
        }
        if (key) {
          keyStatusVersion++;
          models.set([]);
          keyConfigured.set(true);
          keyStatus.set("已保存 API Key");
        }
        showToast("服务商已保存。");
      };
      if (profile.baseUrl !== saved()?.baseUrl) {
        confirmation.set({
          title: "允许连接服务商？",
          description: `地址 ${profile.baseUrl}\n授权来源 ${origin}。模型请求和翻译会发送到该地址。${origin.startsWith("http:") ? "HTTP 不加密，原文和 API Key 可能被网络中间方读取。" : ""}`,
          button: "确认地址并保存",
          action,
        });
      } else {
        void run(action);
      }
    } catch (cause) {
      error.set(errorMessage(cause));
    }
  }

  function hideKey() {
    revealedKey.set("");
    keyVisible.set(false);
  }

  function toggleKey() {
    if (keyVisible()) {
      hideKey();
      return;
    }
    if (busy()) return;
    if (apiKey()) {
      keyVisible.set(true);
      return;
    }

    const profile = connection();
    if (!profile || !keyConfigured()) return;
    keyVisible.set(true);
    void run(async () => {
      try {
        const { key, error } = await Secrets.reveal(profile.id);
        if (!mounted || !keyVisible() || connection() !== profile) return;
        if (error) throw new SettingsError(error.code, error.message);
        if (key) {
          revealedKey.set(key);
        } else {
          keyConfigured.set(false);
          keyStatus.set("未设置 API Key");
        }
      } finally {
        if (mounted && !revealedKey()) hideKey();
      }
    });
  }

  function changeModelPicker(open: boolean) {
    if (open && (busy() || !canFetchModels())) return;
    modelPickerOpen.set(open);
    if (open && models().length === 0) fetchModels(true);
  }

  function fetchModels(choose: boolean) {
    const value = draft();
    if (!value || value.protocol !== "chat-completions" || busy()) return;
    const profile = connection();
    const key = apiKey().trim();
    if (!profile && !key) return;
    const address = value.baseUrl.trim();
    const action = async () => {
      const { models: found, error } =
        profile && !key
          ? await Profiles.listModels(profile.id)
          : await Profiles.listModelsDraft(address, key);
      if (!found)
        throw new SettingsError(
          error?.code ?? "NETWORK",
          error?.message ?? "无法获取模型列表。",
        );
      if (!mounted) return;
      if (choose) {
        models.set(found);
        showToast(
          found.length
            ? `已获取 ${found.length} 个模型。`
            : "模型列表为空，可以手动输入模型 ID。",
        );
      } else {
        showToast(`模型接口正常，发现 ${found.length} 个模型。`);
      }
    };
    if (profile) {
      void run(action, showToast);
      return;
    }
    confirmation.set({
      title: "允许连接服务商？",
      description: `地址 ${address}\n模型请求和翻译会发送到该地址。${address.toLowerCase().startsWith("http:") ? "HTTP 不加密，原文和 API Key 可能被网络中间方读取。" : ""}`,
      button: "确认地址并获取模型",
      action,
    });
  }

  function checkModel() {
    const profile = connection();
    const model = draft()?.model.trim();
    if (profile?.protocol !== "chat-completions" || !model) return;
    void run(async () => {
      const error = await Profiles.checkModel(profile.id, model);
      if (error) throw new SettingsError(error.code, error.message);
      showToast(`模型 ${model} 可以正常对话。`);
    }, showToast);
  }

  function requestDelete() {
    const profile = saved();
    if (!profile || busy()) return;
    confirmation.set({
      title: "删除服务商？",
      description: `删除「${profile.name}」及其 API Key。`,
      button: "确认删除",
      action: async () => {
        await Settings.removeProfile(profile.id);
        if (mounted) edit(visibleProviders()[0] ?? null);
      },
    });
  }

  function confirm() {
    const selected = confirmation();
    if (!selected) return;
    confirmation.set(null);
    void run(selected.action);
  }

  return (
    <View
      testID="settings-providers-page"
      class="min-h-0 min-w-0 flex-1 gap-3 px-4 py-2"
    >
      <Tabs
        accessibilityLabel="服务商类别"
        class="shrink-0 flex-row self-start rounded-xl bg-muted p-1"
      >
        <Each of={capabilities}>
          {(item) => (
            <Tab
              accessibilityLabel={item()}
              selected={capability() === item()}
              onPress={() => selectCapability(item())}
              class="selected:bg-background items-center rounded-lg border border-transparent px-2 py-0.5 focus-visible:border-foreground"
            >
              <Text
                classList={{
                  "font-semibold text-foreground": capability() === item(),
                  "text-muted-foreground": capability() !== item(),
                }}
                class="text-sm leading-5"
              >
                {item()}
              </Text>
            </Tab>
          )}
        </Each>
      </Tabs>
      <View
        class={
          compact()
            ? "min-h-0 min-w-0 flex-1 gap-3"
            : "min-h-0 min-w-0 flex-1 flex-row gap-6"
        }
        onLayout={({ bounds }) => compact.set(bounds.size.width < 440)}
      >
        <View
          class={
            compact() ? "min-h-36 flex-1 gap-2" : "min-h-0 w-48 shrink-0 gap-2"
          }
        >
          <View
            testID="providers-count"
            class="shrink-0 flex-row items-center justify-between"
          >
            <Text role="header" class={providerHeadingClass}>
              服务商
            </Text>
          </View>
          <View class="h-8 shrink-0 flex-row items-center gap-1 rounded-lg border border-border px-1.5">
            <Input
              accessibilityLabel="搜索服务商"
              value={query()}
              onChange={({ value }) => query.set(value)}
              placeholder="搜索服务商"
              class="h-7 min-w-0 flex-1 rounded-md border border-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-foreground"
            />
            <Select
              accessibilityLabel="按启用状态筛选"
              items={filters}
              value={filter()}
              onChange={({ value }) => filter.set(value ?? "all")}
              align="end"
              cover={false}
              popupClass="min-w-28 rounded-lg border border-border bg-popover p-1 text-popover-foreground"
              itemClass={providerOptionsClass}
              trigger={
                <View
                  class={
                    "h-6 w-6 shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-accent focus-visible:border-foreground " +
                    (filter() === "all" ? "" : "bg-accent")
                  }
                >
                  <Image
                    src={filterIcon}
                    class="h-4 w-4"
                    style={{ tintColor: token("muted-foreground") }}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </View>
              }
            />
          </View>
          <If
            when={visibleProviders().length > 0}
            else={
              <Text class="min-h-0 flex-1 text-xs leading-4 text-muted-foreground">
                {capability() !== "翻译"
                  ? `${capability()}服务尚未接入`
                  : query().trim() || filter() !== "all"
                    ? "没有匹配的服务商"
                    : "暂无服务商"}
              </Text>
            }
          >
            <Scroll
              testID="providers-list-scroll"
              class="min-h-0 flex-1"
              contentClass="gap-2"
              onScroll={({ offset }) => scrollY.set(offset.y)}
            >
              <Each of={visibleProviders()} key={(p) => p.id}>
                {(item, index) => (
                  <View
                    onLayout={({ bounds }) => {
                      // 列表从 y=0 开始，第二行的坐标包含行高和间距。
                      if (index() === 1) rowStep = bounds.origin.y;
                    }}
                    class="h-9 flex-row items-center rounded-lg border pl-1 focus-within:border-foreground hover:bg-accent"
                    classList={{
                      "border-transparent": draft()?.id !== item().id,
                      "border-border bg-muted": draft()?.id === item().id,
                      "shadow-md": preview()?.from === index(),
                    }}
                    style={{
                      backgroundColor:
                        preview()?.from === index()
                          ? token("background")
                          : undefined,
                      zIndex: preview()?.from === index() ? 1 : 0,
                      transform: [{ translateY: rowOffset(index()) }],
                    }}
                  >
                    <View
                      testID={`provider-grip-${item().id}`}
                      class="h-full w-5 shrink-0 items-center justify-center"
                      style={{
                        cursor:
                          preview()?.from === index() ? "grabbing" : "grab",
                      }}
                      classList={{ "opacity-0": visibleProviders().length < 2 }}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      onStartShouldSetResponder={() =>
                        !busy() && visibleProviders().length > 1 && rowStep > 0
                      }
                      onResponderGrant={({ pageY }) =>
                        startDrag(index(), pageY)
                      }
                      onResponderMove={({ pageY }) => pointerY.set(pageY)}
                      onResponderRelease={({ pageY }) => dropProvider(pageY)}
                      onResponderTerminate={() => drag.set(null)}
                    >
                      <Image
                        src={gripIcon}
                        class="h-3.5 w-3.5"
                        style={{ tintColor: token("muted-foreground") }}
                      />
                    </View>
                    <View
                      testID={`provider-row-${item().id}`}
                      role="button"
                      focusable
                      accessibilityLabel={
                        item().name + (item().enabled ? "，已启用" : "，已停用")
                      }
                      accessibilityState={{
                        selected: draft()?.id === item().id,
                      }}
                      accessibilityActions={[
                        ...(index() > 0
                          ? [{ name: "move-up", label: "上移" }]
                          : []),
                        ...(index() + 1 < visibleProviders().length
                          ? [{ name: "move-down", label: "下移" }]
                          : []),
                      ]}
                      onAccessibilityAction={({ actionName }) => {
                        if (actionName === "move-up")
                          moveProvider(index(), index() - 1);
                        if (actionName === "move-down")
                          moveProvider(index(), index() + 1);
                      }}
                      onPress={() => {
                        if (!busy() && draft()?.id !== item().id) edit(item());
                      }}
                      class="h-full min-w-0 flex-1 flex-row items-center gap-2 pr-2 pl-2"
                    >
                      <Image
                        src={providerIcon}
                        class="h-4 w-4 shrink-0"
                        style={{ tintColor: token("foreground") }}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                      <Text
                        class="min-w-0 flex-1 text-xs text-foreground"
                        style={{ numberOfLines: 1, textOverflow: "ellipsis" }}
                      >
                        {item().name}
                      </Text>
                      <View
                        class={
                          "h-2 w-2 shrink-0 rounded-full " +
                          (item().enabled
                            ? "bg-accent-emerald"
                            : "border border-muted-foreground")
                        }
                      />
                    </View>
                  </View>
                )}
              </Each>
            </Scroll>
          </If>
          <If when={capability() === "翻译"}>
            <Button
              accessibilityLabel="新增翻译服务商"
              disabled={busy()}
              onPress={() => edit(emptyFields)}
              class={`${providerButtonClass} shrink-0 border-border hover:bg-accent`}
            >
              <Text class={providerHeadingClass}>新增翻译服务商</Text>
            </Button>
          </If>
        </View>
        <Scroll testID="provider-editor-scroll" class="min-h-0 min-w-0 flex-1">
          <If
            when={draft()}
            else={
              <Text class="text-sm text-muted-foreground">
                {error() ||
                  (busy()
                    ? "正在读取服务商…"
                    : capability() === "翻译"
                      ? "选择或新增服务商"
                      : "")}
              </Text>
            }
          >
            {(value) => (
              <ProviderEditor
                title={`${value().id === undefined ? "新增" : "编辑"}${capability()}服务商`}
                value={value()}
                error={error()}
                busy={busy()}
                connectionReady={connection() !== null}
                canFetchModels={canFetchModels()}
                keyInputSupported={providerConnectionsSupported}
                apiKey={apiKey()}
                revealedKey={revealedKey()}
                keyVisible={keyVisible()}
                keyStatus={keyStatus()}
                keyConfigured={keyConfigured()}
                models={models()}
                modelPickerOpen={modelPickerOpen()}
                onModelPickerOpenChange={changeModelPicker}
                onKeyChange={(value) => {
                  if (busy() || revealedKey()) return;
                  apiKey.set(value);
                  if (!value) hideKey();
                }}
                onToggleKey={toggleKey}
                onCheckModel={checkModel}
                onFetchModels={fetchModels}
                advancedOpen={advancedOpen()}
                onToggleAdvanced={() => advancedOpen.set(!advancedOpen())}
                onChange={patchDraft}
                onSave={requestSave}
                onDelete={value().id === undefined ? undefined : requestDelete}
              />
            )}
          </If>
        </Scroll>
      </View>
      <Overlay
        class="inset-x-0 bottom-0 items-center p-4"
        style={{
          paddingBottom: safeArea().bottom + 16,
          pointerEvents: "box-none",
        }}
      >
        <ToastStack
          closeOnEscape={false}
          style={{ width: 340, maxWidth: "100%" }}
          placement="bottomRight"
          onExpandedChange={({ expanded }) => {
            toastExpanded = expanded;
          }}
        >
          <Each of={toasts()} key={(toast: ToastEntry) => toast.id}>
            {(toast) => (
              <Toast
                testID="provider-toast"
                transitionStatus={toast().status}
                accessibilityLabel={String(toast().value)}
                onDismissRequest={() => {
                  if (toastManager.dismiss(toast().id)) syncToasts();
                }}
                class="rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 ease-out"
                startingClass="opacity-0 translate-y-4"
                endingClass="opacity-0 scale-95"
                swipingClass="transition-none"
              >
                <Text class="text-sm text-card-foreground">
                  {String(toast().value)}
                </Text>
              </Toast>
            )}
          </Each>
        </ToastStack>
      </Overlay>
      <Dialog
        testID="provider-confirm-dialog"
        open={confirmation() !== null}
        role="alertdialog"
        accessibilityLabel={confirmation()?.title ?? "确认操作"}
        accessibilityDescription={confirmation()?.description}
        animation="fade"
        closeOnBackdropPress={false}
        onOpenChange={({ open }) => {
          if (!open) confirmation.set(null);
        }}
        backdropClass="bg-background/75"
        class="m-auto w-80 max-w-[90%] gap-3 rounded-xl border border-border bg-popover p-4 shadow-lg"
      >
        <Text class={providerHeadingClass}>{confirmation()?.title}</Text>
        <Scroll class="max-h-40">
          <Text class="text-sm leading-5 text-muted-foreground">
            {confirmation()?.description}
          </Text>
        </Scroll>
        <View class="flex-row flex-wrap justify-end gap-2">
          <Button
            accessibilityLabel="取消"
            onPress={() => confirmation.set(null)}
            class={`${providerButtonClass} border-border hover:bg-accent`}
          >
            <Text class={providerHeadingClass}>取消</Text>
          </Button>
          <Button
            accessibilityLabel={confirmation()?.button ?? "确认"}
            onPress={confirm}
            class={`${providerButtonClass} border-transparent bg-foreground hover:opacity-90`}
          >
            <Text class="text-sm font-semibold text-background">
              {confirmation()?.button}
            </Text>
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
