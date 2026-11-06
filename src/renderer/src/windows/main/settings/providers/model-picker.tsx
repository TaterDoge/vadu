import { useEffect, useId, useRef, useState } from "react";
import { AnimateIcon } from "@animate-ui/react/icons";
import { Activity } from "@renderer/components/animate-ui/icons/activity";
import { List } from "@renderer/components/animate-ui/icons/list";
import { RefreshCw } from "@renderer/components/animate-ui/icons/refresh-cw";
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
  secretsSignature,
} from "./provider-editor";
import { useModelHealthCheck } from "./use-model-health";

type ModelPickerProps = {
  config: Record<string, unknown>;
  configInvalid?: boolean;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
  placeholder?: string;
  pluginId: string;
  profileId: string;
  required?: boolean;
  secrets: Record<string, string>;
  title?: string;
};

// 未保存草稿也允许拉模型列表/做健康检测：密钥随本次请求临时传递，不落盘、不入日志。
function ModelPicker({
  config,
  configInvalid = false,
  disabled = false,
  model,
  onModelChange,
  placeholder,
  pluginId,
  profileId,
  required = false,
  secrets,
  title = "模型",
}: ModelPickerProps) {
  const [cached, setCached] = useState<ModelInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const configSig = modelsConfigSignature(config);
  const secretsSig = secretsSignature(secrets);
  // 密钥变化同样作废旧响应：中途改 Key 后不应沿用旧列表
  const sig = `${configSig}\u0000${secretsSig}`;
  const seqRef = useRef(0);
  const profileIdRef = useRef(profileId);
  const pluginIdRef = useRef(pluginId);
  const sigRef = useRef(sig);
  const healthCheck = useModelHealthCheck({
    config,
    configInvalid,
    disabled,
    model,
    pluginId,
    profileId,
    secrets,
  });

  // 切换服务商或请求配置/密钥时丢弃旧响应，避免把上一接口的模型填入当前配置。
  useEffect(() => {
    seqRef.current += 1;
    profileIdRef.current = profileId;
    pluginIdRef.current = pluginId;
    sigRef.current = sig;
    setCached(null);
    setError(null);
    setBusy(false);
    setQuery("");
    setOpen(false);
  }, [pluginId, profileId, sig]);

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
    seqRef.current += 1;
    const seq = seqRef.current;
    const requestedProfileId = profileId;
    const requestedPluginId = pluginId;
    const requestedSig = sig;
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
      sigRef,
    };
    // 只传用户已输入的密钥明文，空值不发送
    const pendingSecrets = Object.fromEntries(
      Object.entries(secrets).filter(([, value]) => value !== "")
    );
    try {
      const result = await window.vadu.plugins.listModels(
        requestedPluginId,
        requestedProfileId,
        config,
        Object.keys(pendingSecrets).length > 0 ? pendingSecrets : undefined
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
  const healthChecking = healthCheck.checking;
  // 同一页面可能同时渲染面板表单与新增 dialog 表单，id 不能硬编码
  const controlId = useId();
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="font-medium text-sm" htmlFor={controlId}>
            {title}
            {required ? <span className="text-destructive"> *</span> : null}
          </label>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <AnimateIcon animateOnHover asChild>
              <Button
                aria-busy={healthChecking}
                aria-label={
                  healthChecking ? "正在健康检测当前模型" : "健康检测当前模型"
                }
                disabled={disabled || healthChecking}
                onClick={healthCheck.run}
                size="sm"
                title="会实际发起一次固定短文本翻译，可能产生少量费用"
                type="button"
                variant="outline"
              >
                {healthChecking ? (
                  <RefreshCw
                    aria-hidden="true"
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Activity aria-hidden="true" className="size-3.5" />
                )}
                <span>{healthChecking ? "检测中…" : "健康检测"}</span>
              </Button>
            </AnimateIcon>
            <AnimateIcon animateOnHover asChild>
              <ComboboxTrigger
                render={<Button size="sm" type="button" variant="outline" />}
              >
                <List aria-hidden="true" className="size-4" />
                <span>选择模型</span>
              </ComboboxTrigger>
            </AnimateIcon>
          </div>
        </div>
        <Input
          disabled={disabled}
          id={controlId}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder={placeholder ?? "输入或选择模型"}
          value={model}
        />
      </div>
      <ComboboxContent align="end">
        <div className="flex items-center gap-1.5 border-b p-2">
          <ComboboxInput aria-label="搜索模型" placeholder="搜索模型…" />
          <AnimateIcon animateOnHover asChild>
            <Button
              aria-label="刷新模型列表"
              disabled={busy || disabled}
              onClick={refresh}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  "size-3.5",
                  busy && "animate-spin motion-reduce:animate-none"
                )}
              />
            </Button>
          </AnimateIcon>
        </div>
        {showLoading ? (
          <p
            aria-live="polite"
            className="flex items-center gap-1.5 px-2.5 py-3 text-muted-foreground text-sm"
          >
            <RefreshCw
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
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
                <span className="wrap-anywhere" title={entry.id}>
                  {modelDisplayLabel(entry)}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}

export { ModelPicker };
