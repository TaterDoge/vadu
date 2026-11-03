import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import type { ModelInfo } from "@shared/ipc";
import { cn } from "cn";

import {
  isModelRequestInvalid,
  modelDisplayLabel,
  modelsConfigSignature,
} from "./provider-editor";

const NEW_PROFILE_ID = "__new__";

type ModelPickerProps = {
  config: Record<string, unknown>;
  disabled?: boolean;
  hasSavedKey: boolean;
  model: string;
  onModelChange: (model: string) => void;
  pluginId: string;
  profileId: string;
};

/**
 * 模型列表获取组件（渲染层唯一入口）：只把「已保存的 profileId + 表单配置」
 * 交给主进程，密钥只从已保存的密钥桶读取，origin 走受控 fetch 白名单。
 * 失败降级为手动输入（模型字段本身仍是文本输入框）。
 */
function ModelPicker({
  config,
  disabled = false,
  hasSavedKey,
  model,
  onModelChange,
  pluginId,
  profileId,
}: ModelPickerProps): ReactNode {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configSig = modelsConfigSignature(config);
  const seqRef = useRef(0);
  const profileIdRef = useRef(profileId);
  const pluginIdRef = useRef(pluginId);
  const configSigRef = useRef(configSig);

  // 切换服务商或影响模型列表的配置变化时递增请求序号并丢弃旧结果
  useEffect(() => {
    seqRef.current += 1;
    profileIdRef.current = profileId;
    pluginIdRef.current = pluginId;
    configSigRef.current = configSig;
    setModels([]);
    setError(null);
    setBusy(false);
  }, [configSig, pluginId, profileId]);

  const refresh = async (): Promise<void> => {
    if (busy) {
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
        setModels([]);
        setError(result.error.message);
        return;
      }
      setModels(result.data);
    } catch (reason) {
      if (isModelRequestInvalid(ctx, refs)) {
        return;
      }
      setBusy(false);
      setModels([]);
      setError(String(reason));
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">获取模型列表</span>
        <Button
          aria-label="刷新模型列表"
          disabled={busy || disabled}
          onClick={refresh}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className={cn(
              "icon-[lucide--refresh-cw] size-4",
              busy && "animate-spin motion-reduce:animate-none"
            )}
          />
        </Button>
      </div>
      <Select
        disabled={models.length === 0 || disabled}
        onValueChange={(value) => {
          if (value !== null) {
            onModelChange(value);
          }
        }}
        value={model}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择模型（或手动在上方输入）" />
        </SelectTrigger>
        <SelectContent>
          {models.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {modelDisplayLabel(entry)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <p className="text-muted-foreground text-xs">
        模型列表来自已保存的接口与密钥；获取失败时可直接手动输入模型名。
      </p>
    </div>
  );
}

export { ModelPicker, NEW_PROFILE_ID };
