import type {
  CallOptions,
  ModelInfo,
  PluginConfig,
  PluginRuntime,
  TranslateRequest,
  TranslatorPlugin,
} from "../../../shared/plugin";
import { coded } from "./errors";
import { listOpenAiModels } from "./models";
import { protocolOf } from "./protocol";
import { translate } from "./translate";

function missingKey(): Error & { code: string } {
  const error = new Error("缺少 API Key，请先在设置中填写") as Error & {
    code: string;
  };
  error.code = "AUTH_FAILED";
  return error;
}

export function createPlugin(runtime: PluginRuntime): TranslatorPlugin {
  const apiKey = (): string => {
    const value = runtime.secrets.get("apiKey");
    if (!value) {
      throw missingKey();
    }
    return value;
  };

  return {
    listModels(config: PluginConfig): Promise<ModelInfo[]> {
      const key = apiKey();
      if (protocolOf(config) !== "openai") {
        // anthropic / gemini 的模型端点形状不同，未实现；UI 失败后回落到 preset 候选
        throw coded(
          "INVALID_CONFIG",
          "该协议暂不支持拉取模型列表，请手动填写模型名"
        );
      }
      return listOpenAiModels({ apiKey: key, config, runtime });
    },
    translate(req: TranslateRequest, opts: CallOptions): AsyncIterable<string> {
      return translate({
        apiKey: apiKey(),
        opts,
        protocol: protocolOf(req.config),
        req,
        runtime,
      });
    },
  };
}
