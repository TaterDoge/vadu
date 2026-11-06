import { useEffect, useRef, useState } from "react";
import type { ModelHealthCheckParams } from "@shared/ipc";
import { toast } from "sonner";

import { healthCheckSignature } from "./provider-editor";

type ModelHealthCheckOptions = {
  config: Record<string, unknown>;
  configInvalid: boolean;
  disabled: boolean;
  model: string;
  pluginId: string;
  profileId: string;
  secrets: Record<string, string>;
};

type ModelHealthCheck = {
  checking: boolean;
  run: () => Promise<void>;
};

function inputError(model: string, configInvalid: boolean): string | null {
  if (configInvalid) {
    return "高级选项 JSON 无效，请修正后再检测";
  }
  if (model.trim() === "") {
    return "请先填写模型";
  }
  return null;
}

function nonEmptySecrets(
  secrets: Record<string, string>
): Record<string, string> | undefined {
  const entries = Object.entries(secrets).filter(([, value]) => value !== "");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isStale(
  seq: number,
  sig: string,
  refs: { seqRef: { current: number }; sigRef: { current: string } }
): boolean {
  return seq !== refs.seqRef.current || sig !== refs.sigRef.current;
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function healthParams(
  args: Pick<
    ModelHealthCheckOptions,
    "config" | "pluginId" | "profileId" | "secrets"
  > & { requestId: string }
): ModelHealthCheckParams {
  const secretOverrides = nonEmptySecrets(args.secrets);
  return {
    config: args.config,
    pluginId: args.pluginId,
    profileId: args.profileId,
    requestId: args.requestId,
    ...(secretOverrides ? { secrets: secretOverrides } : {}),
  };
}

export function useModelHealthCheck({
  config,
  configInvalid,
  disabled,
  model,
  pluginId,
  profileId,
  secrets,
}: ModelHealthCheckOptions): ModelHealthCheck {
  const healthSig = `${pluginId}\u0000${profileId}\u0000${healthCheckSignature(
    config,
    model,
    secrets,
    configInvalid
  )}`;
  const [checking, setChecking] = useState(false);
  const seqRef = useRef(0);
  const sigRef = useRef(healthSig);
  const requestRef = useRef<string | null>(null);

  // 模型/配置/密钥/JSON 合法性变化即终止在途检测，并清掉旧检测状态。
  useEffect(() => {
    seqRef.current += 1;
    sigRef.current = healthSig;
    const requestId = requestRef.current;
    if (requestId !== null) {
      requestRef.current = null;
      window.vadu.plugins.cancelHealthCheck(requestId);
    }
    setChecking(false);
    return () => {
      seqRef.current += 1;
      const pending = requestRef.current;
      if (pending !== null) {
        requestRef.current = null;
        window.vadu.plugins.cancelHealthCheck(pending);
      }
    };
  }, [healthSig]);

  const run = async (): Promise<void> => {
    if (disabled || requestRef.current !== null) {
      return;
    }
    const invalid = inputError(model, configInvalid);
    if (invalid) {
      toast.error(`健康检测失败：${invalid}`);
      return;
    }
    seqRef.current += 1;
    const seq = seqRef.current;
    const requestId = crypto.randomUUID();
    requestRef.current = requestId;
    setChecking(true);
    const refs = { seqRef, sigRef };
    try {
      const result = await window.vadu.plugins.healthCheck(
        healthParams({ config, pluginId, profileId, requestId, secrets })
      );
      if (isStale(seq, healthSig, refs)) {
        if (requestRef.current === requestId) {
          requestRef.current = null;
        }
        return;
      }
      requestRef.current = null;
      setChecking(false);
      if (!result.ok) {
        toast.error(
          `健康检测失败：[${result.error.code}] ${result.error.message}`
        );
        return;
      }
      toast.success(
        `健康检测通过（${(result.data.elapsedMs / 1000).toFixed(1)}s）`
      );
    } catch (reason) {
      if (isStale(seq, healthSig, refs)) {
        return;
      }
      requestRef.current = null;
      setChecking(false);
      toast.error(`健康检测失败：[INTERNAL] ${reasonMessage(reason)}`);
    }
  };

  return { checking, run };
}
