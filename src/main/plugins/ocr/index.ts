import type {
  CallOptions,
  OcrPlugin,
  OcrRequest,
  OcrResult,
  PluginRuntime,
} from "../../../shared/plugin";

// 与 manifest 里 prompt 字段的 default 保持一致：旧 profile 可能没有存 prompt
const DEFAULT_PROMPT = "按阅读顺序输出图中的文字，不要翻译，不要解释";

function missingKey(): Error & { code: string } {
  const error = new Error("缺少 API Key，请先在设置中填写") as Error & {
    code: string;
  };
  error.code = "AUTH_FAILED";
  return error;
}

const TRAILING_SLASH_RE = /\/+$/;

function httpError(status: number): Error & { code: string; status: number } {
  let code = "INTERNAL";
  if (status === 401 || status === 403) {
    code = "AUTH_FAILED";
  } else if (status === 429) {
    code = "RATE_LIMITED";
  }
  const error = new Error(`上游返回 ${status}`) as Error & {
    code: string;
    status: number;
  };
  error.code = code;
  error.status = status;
  return error;
}

export function createPlugin(runtime: PluginRuntime): OcrPlugin {
  return {
    async recognize(req: OcrRequest, opts: CallOptions): Promise<OcrResult> {
      const apiKey = runtime.secrets.get("apiKey");
      if (!apiKey) {
        throw missingKey();
      }
      const baseURL = String(req.config.baseURL ?? "").replace(
        TRAILING_SLASH_RE,
        ""
      );
      const base64 = Buffer.from(req.image.data).toString("base64");
      const res = await runtime.fetch(`${baseURL}/chat/completions`, {
        body: JSON.stringify({
          messages: [
            {
              content: [
                {
                  text: String(req.config.prompt ?? DEFAULT_PROMPT),
                  type: "text",
                },
                {
                  image_url: {
                    url: `data:${req.image.mimeType};base64,${base64}`,
                  },
                  type: "image_url",
                },
              ],
              role: "user",
            },
          ],
          model: req.config.model,
        }),
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: opts.signal,
      });
      if (!res.ok) {
        throw httpError(res.status);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return { text: data.choices?.[0]?.message?.content?.trim() ?? "" };
    },
  };
}
