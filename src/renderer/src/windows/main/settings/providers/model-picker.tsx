import { useEffect, useRef, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@renderer/components/ui/combobox";
import { Input } from "@renderer/components/ui/input";
import type { ModelInfo } from "@shared/ipc";
import { cn } from "cn";

import {
  filterModels,
  isModelRequestInvalid,
  modelDisplayLabel,
  modelsConfigSignature,
} from "./provider-editor";

const NEW_PROFILE_ID = "__new__";

type ModelPickerProps = {
  config: Record<string, unknown>;
  description?: string;
  disabled?: boolean;
  hasSavedKey: boolean;
  model: string;
  onModelChange: (model: string) => void;
  placeholder?: string;
  pluginId: string;
  profileId: string;
  required?: boolean;
  title?: string;
};

// 密钥只从已保存的 profile 读取，手动输入不依赖模型列表。
function ModelPicker({
  config,
  description,
  disabled = false,
  hasSavedKey,
  model,
  onModelChange,
  placeholder,
  pluginId,
  profileId,
  required = false,
  title = "模型",
}: ModelPickerProps) {
  const [cached, setCached] = useState<ModelInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const configSig = modelsConfigSignature(config);
  const seqRef = useRef(0);
  const profileIdRef = useRef(profileId);
  const pluginIdRef = useRef(pluginId);
  const configSigRef = useRef(configSig);

  // 切换服务商或请求配置时丢弃旧响应，避免把上一接口的模型填入当前配置。
  useEffect(() => {
    seqRef.current += 1;
    profileIdRef.current = profileId;
    pluginIdRef.current = pluginId;
    configSigRef.current = configSig;
    setCached(null);
    setError(null);
    setBusy(false);
    setQuery("");
    setOpen(false);
  }, [configSig, pluginId, profileId]);

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) {
      setQuery("");
      return;
    }
    if (cached === null && !busy) {
      refresh();
    }
  }

  const refresh = async (): Promise<void> => {
    if (busy || disabled) {
      return;
    }
    if (!profileId || profileId === NEW_PROFILE_ID) {
      setError("先保存配置，再获取模型列表");
      return;
    }
    if (!hasSavedKey) {
      setError("请先保存 API Key，再获取模型列表");
      return;
    }
    seqRef.current += 1;
    const seq = seqRef.current;
    const requestedProfileId = profileId;
    const requestedPluginId = pluginId;
    const requestedSig = configSig;
    setBusy(true);
    setError(null);
    const ctx = {
      pluginId: requestedPluginId,
      profileId: requestedProfileId,
      seq,
      sig: requestedSig,
    };
    const refs = {
      pluginIdRef,
      profileIdRef,
      seqRef,
      sigRef: configSigRef,
    };
    try {
      const result = await window.vadu.plugins.listModels(
        requestedPluginId,
        requestedProfileId,
        config
      );
      // 失效响应直接丢弃：busy/结果归当前（可能更新的）请求/切换管理
      if (isModelRequestInvalid(ctx, refs)) {
        return;
      }
      setBusy(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCached(result.data);
    } catch (reason) {
      if (isModelRequestInvalid(ctx, refs)) {
        return;
      }
      setBusy(false);
      setError(String(reason));
    }
  };

  const filtered = filterModels(cached ?? [], query);
  const controlId = "field-model";
  const showLoading = busy && cached === null;
  const showError = error !== null && !showLoading;
  const hasList = cached !== null;
  const showEmpty = hasList && cached.length === 0 && !busy && !error;
  const showNoMatch = hasList && cached.length > 0 && filtered.length === 0;
  const showList = hasList && filtered.length > 0;

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      filter={null}
      inputValue={query}
      items={filtered.map((entry) => entry.id)}
      onInputValueChange={(value, details) => {
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        ) {
          setQuery(value);
        }
      }}
      onOpenChange={handleOpenChange}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onModelChange(next);
          setOpen(false);
          setQuery("");
        }
      }}
      open={open}
      value={model}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="font-medium text-sm" htmlFor={controlId}>
            {title}
            {required ? <span className="text-destructive"> *</span> : null}
          </label>
          <ComboboxTrigger
            render={<Button size="sm" type="button" variant="outline" />}
          >
            <span aria-hidden="true" className="icon-[lucide--list] size-4" />
            <span>选择模型</span>
          </ComboboxTrigger>
        </div>
        <Input
          disabled={disabled}
          id={controlId}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder={placeholder ?? "输入或选择模型"}
          value={model}
        />
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <ComboboxContent align="end">
        <div className="flex items-center gap-1.5 border-b p-2">
          <ComboboxInput aria-label="搜索模型" placeholder="搜索模型…" />
          <Button
            aria-label="刷新模型列表"
            disabled={busy || disabled}
            onClick={refresh}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <span
              aria-hidden="true"
              className={cn(
                "icon-[lucide--refresh-cw] size-3.5",
                busy && "animate-spin motion-reduce:animate-none"
              )}
            />
          </Button>
        </div>
        {showLoading ? (
          <p
            aria-live="polite"
            className="flex items-center gap-1.5 px-2.5 py-3 text-muted-foreground text-sm"
          >
            <span
              aria-hidden="true"
              className="icon-[lucide--refresh-cw] size-3.5 animate-spin motion-reduce:animate-none"
            />
            正在加载模型列表…
          </p>
        ) : null}
        {showError ? (
          <p className="px-2.5 py-3 text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {showEmpty ? (
          <p
            aria-live="polite"
            className="px-2.5 py-3 text-muted-foreground text-sm"
          >
            没有可用模型。
          </p>
        ) : null}
        {showNoMatch ? (
          <p
            aria-live="polite"
            className="px-2.5 py-3 text-muted-foreground text-sm"
          >
            无匹配模型。
          </p>
        ) : null}
        {showList ? (
          <ComboboxList>
            {filtered.map((entry) => (
              <ComboboxItem key={entry.id} value={entry.id}>
                <span
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                  title={entry.id}
                >
                  <span className="wrap-anywhere">
                    {modelDisplayLabel(entry)}
                  </span>
                  {entry.label && entry.label !== entry.id ? (
                    <span className="wrap-anywhere text-muted-foreground text-xs">
                      {entry.id}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}

export { ModelPicker, NEW_PROFILE_ID };
