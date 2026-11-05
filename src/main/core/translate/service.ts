/**
 * 翻译编排：把渲染层请求映射为插件调用，消费 AsyncIterable<string> 并转发事件。
 * 事件走 vadu:translate:event（send），start 只登记并立即返回 requestId。
 */

import type { WebContents } from "electron";

import { VaduError, toSerializedError } from "../../../shared/errors";
import type {
  Profile,
  TranslateEvent,
  TranslateParams,
  TranslateWarning,
} from "../../../shared/ipc";
import { IPC } from "../../../shared/ipc";
import type { TranslateRequest } from "../../../shared/plugin";
import { readProfiles, readSettings } from "../config/store";
import { hostTranslate } from "../plugin/host";
import { registry } from "../plugin/registry";
import { type ActiveTask, taskRegistry } from "./tasks";

const PLACEHOLDER_RE =
  /\{\{[^}]+\}\}|%[sd]\b|\{0\}|<[a-zA-Z][^>]*>|\$\{[^}]+\}/g;

export function collectPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((match) => match[0]).sort();
}

export function computeWarnings(
  source: string,
  output: string
): TranslateWarning[] {
  const warnings: TranslateWarning[] = [];
  const sourceSet = collectPlaceholders(source);
  const outputSet = collectPlaceholders(output);
  if (
    sourceSet.length > 0 &&
    JSON.stringify(sourceSet) !== JSON.stringify(outputSet)
  ) {
    warnings.push("PLACEHOLDER_MISMATCH");
  }
  if (output.trim() === "") {
    warnings.push("EMPTY_OUTPUT");
  } else if (source.length > 0 && output.length > source.length * 20) {
    warnings.push("OUTPUT_TOO_LONG");
  }
  return warnings;
}

function emit(task: ActiveTask, event: TranslateEvent): void {
  if (task.suppressed) {
    return;
  }
  task.sender.send(IPC.translate.event, event);
}

async function run(
  task: ActiveTask,
  profile: Profile,
  params: TranslateParams
): Promise<void> {
  const plugin = registry.getTranslator(profile.pluginId);
  const startedAt = Date.now();
  try {
    if (!plugin) {
      throw new Error("插件未加载");
    }
    const req: TranslateRequest = {
      config: profile.config,
      glossary: plugin.descriptor.capabilities.glossary
        ? readSettings().glossary
        : undefined,
      source: params.source,
      target: params.target,
      text: params.text,
      tone: params.tone,
    };
    let accumulated = "";
    for await (const delta of hostTranslate({
      create: plugin.create,
      opts: { requestId: params.requestId, signal: task.controller.signal },
      pluginId: profile.pluginId,
      profile,
      req,
    })) {
      accumulated += delta;
      emit(task, { requestId: params.requestId, text: delta, type: "delta" });
    }
    if (!task.suppressed) {
      emit(task, {
        elapsedMs: Date.now() - startedAt,
        requestId: params.requestId,
        text: accumulated,
        type: "done",
        warnings: computeWarnings(params.text, accumulated),
      });
    }
  } catch (error) {
    if (task.suppressed) {
      return;
    }
    const serialized = toSerializedError(error);
    if (serialized.code === "ABORTED") {
      return;
    }
    emit(task, {
      error: serialized,
      requestId: params.requestId,
      type: "error",
    });
  } finally {
    task.cleanup?.();
    taskRegistry.remove(params.requestId);
  }
}

export function startTranslate(
  params: TranslateParams,
  sender: WebContents
): { requestId: string } {
  const profiles = readProfiles().filter(
    (entry) => entry.pluginId === params.pluginId
  );
  const profile = profiles.find((entry) => entry.id === params.profileId);
  if (!profile) {
    throw new Error("profile 不存在");
  }
  if (!profile.enabled) {
    throw new VaduError("INVALID_CONFIG", "该服务商已停用，请先在设置中启用");
  }
  if (!registry.isReady(profile.pluginId)) {
    throw new Error("插件未就绪");
  }
  const task = taskRegistry.register(params.requestId, sender);
  if (!task) {
    throw new Error("requestId 重复");
  }
  const onDestroyed = (): void => {
    taskRegistry.disposeBySender(sender.id);
  };
  sender.once("destroyed", onDestroyed);
  task.cleanup = () => {
    sender.removeListener("destroyed", onDestroyed);
  };
  // 不等待翻译完成：立即返回 requestId，结果全走事件通道
  run(task, profile, params).catch((error) => {
    console.error(`[translate] ${params.requestId} 任务异常：${String(error)}`);
  });
  return { requestId: params.requestId };
}

export function cancelTranslate(
  requestId: string,
  sender: WebContents
): boolean {
  return taskRegistry.cancel(requestId, sender.id);
}
