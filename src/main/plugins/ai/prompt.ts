import type { TranslateRequest } from "../../../shared/plugin";

const SYSTEM = `你是翻译引擎。把用户提供的文本翻译成目标语言。

规则：
- 只输出译文，不要解释、不要加引号、不要保留"译文："之类的前缀。
- 保持原文的段落、换行、列表层级与 Markdown 结构。
- 占位符原样保留：{{...}}、%s、%d、{0}、<tag>...</tag>、\${...} 不得翻译或改写。
- 代码块、URL、邮箱、@提及不翻译。
- 术语表优先于你的判断。
- 若原文已是目标语言，原样返回。`;

type ChatMessage = { content: string; role: "system" | "user" };

export function buildMessages(req: TranslateRequest): ChatMessage[] {
  const parts = [`目标语言（BCP-47）：${req.target}`];
  if (req.source !== "auto") {
    parts.push(`源语言（BCP-47）：${req.source}`);
  }
  if (req.tone === "formal") {
    parts.push("语体：正式书面");
  }
  if (req.tone === "casual") {
    parts.push("语体：口语化");
  }
  if (req.glossary?.length) {
    parts.push(
      `术语表（原文 => 译文）：\n${req.glossary
        .map((g) => `${g.from} => ${g.to}`)
        .join("\n")}`
    );
  }
  parts.push(`原文：\n<<<\n${req.text}\n>>>`);

  return [
    { content: SYSTEM, role: "system" },
    { content: parts.join("\n\n"), role: "user" },
  ];
}
