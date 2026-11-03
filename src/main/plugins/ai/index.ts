import type {
  CallOptions,
  ModelInfo,
  PluginConfig,
  PluginRuntime,
  TranslateRequest,
  TranslatorPlugin,
} from "../../../shared/plugin";
import { openAiListModels, openAiTranslate } from "./adapters/openai";

function missingKey(): Error & { code: string } {
  const error = new Error("缺少 API Key，请先在设置中填写") as Error & {
    code: string;
  };
  error.code = "AUTH_FAILED";
  return error;
}

export function createPlugin(runtime: PluginRuntime): TranslatorPlugin {
  return {
    listModels(config: PluginConfig): Promise<ModelInfo[]> {
      const apiKey = runtime.secrets.get("apiKey");
      if (!apiKey) {
        throw missingKey();
      }
      return openAiListModels({ apiKey, config, runtime });
    },
    translate(req: TranslateRequest, opts: CallOptions): AsyncIterable<string> {
      const apiKey = runtime.secrets.get("apiKey");
      if (!apiKey) {
        throw missingKey();
      }
      return openAiTranslate({ apiKey, opts, req, runtime });
    },
  };
}
