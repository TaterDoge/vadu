import type {
  CallOptions,
  PluginRuntime,
  TtsPlugin,
  TtsRequest,
  TtsResult,
} from "../../../shared/plugin";

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

export function createPlugin(runtime: PluginRuntime): TtsPlugin {
  return {
    async synthesize(req: TtsRequest, opts: CallOptions): Promise<TtsResult> {
      const apiKey = runtime.secrets.get("apiKey");
      if (!apiKey) {
        throw missingKey();
      }
      const baseURL = String(req.config.baseURL ?? "").replace(
        TRAILING_SLASH_RE,
        ""
      );
      const format = req.config.format === "wav" ? "wav" : "mp3";
      const res = await runtime.fetch(`${baseURL}/audio/speech`, {
        body: JSON.stringify({
          input: req.text,
          model: req.config.model,
          response_format: format,
          speed: req.config.speed,
          voice: req.config.voice,
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
      return {
        audio: new Uint8Array(await res.arrayBuffer()),
        mimeType: format === "wav" ? "audio/wav" : "audio/mpeg",
      };
    },
  };
}
