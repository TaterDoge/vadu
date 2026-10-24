/**
 * Electron accelerator 语法（如 CommandOrControl+Shift+T），主进程直接拿去注册。
 * 本模块不依赖 node/electron，渲染层只负责录入与显示。
 */

const MODIFIER_ORDER = [
  "CommandOrControl",
  "Command",
  "Control",
  "Alt",
  "Shift",
  "Super",
] as const;

const MODIFIERS = new Set<string>(MODIFIER_ORDER);

const SPECIAL_KEYS = new Set([
  "Space",
  "Tab",
  "Return",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Up",
  "Down",
  "Left",
  "Right",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const CODE_TO_KEY: Record<string, string> = {
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  Backquote: "`",
  Backslash: "\\",
  Backspace: "Backspace",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Delete: "Delete",
  End: "End",
  Enter: "Return",
  Equal: "=",
  Escape: "Escape",
  Home: "Home",
  Insert: "Insert",
  Minus: "-",
  PageDown: "PageDown",
  PageUp: "PageUp",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
  Space: "Space",
  Tab: "Tab",
};

/** Electron accelerator 接受单个标点键（如 ⌘,），录入与校验都要认得它们 */
const PUNCTUATION_MAIN_KEYS = new Set([
  ",",
  ".",
  "/",
  ";",
  "'",
  "[",
  "]",
  "\\",
  "-",
  "=",
  "`",
]);

const KEY_CODE_RE = /^Key[A-Z]$/;
const DIGIT_CODE_RE = /^Digit[0-9]$/;
const FUNCTION_KEY_RE = /^F([1-9]|1[0-9]|2[0-4])$/;
const LETTER_KEY_RE = /^[A-Z]$/;
const DIGIT_KEY_RE = /^[0-9]$/;

function mainKeyFromCode(code: string): string | null {
  if (KEY_CODE_RE.test(code)) {
    return code.slice(3);
  }
  if (DIGIT_CODE_RE.test(code)) {
    return code.slice(5);
  }
  if (FUNCTION_KEY_RE.test(code)) {
    return code;
  }
  return CODE_TO_KEY[code] ?? null;
}

function isSupportedMainKey(key: string): boolean {
  return (
    LETTER_KEY_RE.test(key) ||
    DIGIT_KEY_RE.test(key) ||
    FUNCTION_KEY_RE.test(key) ||
    SPECIAL_KEYS.has(key) ||
    PUNCTUATION_MAIN_KEYS.has(key)
  );
}

/** 供渲染层把 accelerator 拆成修饰符与主键时复用，别再抄一份修饰符名单 */
export function isAcceleratorModifier(token: string): boolean {
  return MODIFIERS.has(token);
}

export function acceleratorFromEvent(
  event: KeyboardEvent,
  isMac: boolean
): string | null {
  // 主修饰键：mac 用 meta，其它平台用 ctrl；另一侧的修饰键降级为次级
  const primary = isMac ? event.metaKey : event.ctrlKey;
  const secondary = isMac ? event.ctrlKey : event.metaKey;
  const present = new Set<string>();
  if (primary) {
    present.add("CommandOrControl");
  }
  if (secondary) {
    present.add(isMac ? "Control" : "Super");
  }
  if (event.altKey) {
    present.add("Alt");
  }
  if (event.shiftKey) {
    present.add("Shift");
  }
  // Shift 不是唯一修饰键，必须另有 CommandOrControl/Control/Super/Alt 之一
  const hasRequiredModifier =
    present.has("CommandOrControl") ||
    present.has("Control") ||
    present.has("Super") ||
    present.has("Alt");
  if (!hasRequiredModifier) {
    return null;
  }
  const mainKey = mainKeyFromCode(event.code);
  if (!mainKey) {
    return null;
  }
  const parts = MODIFIER_ORDER.filter((modifier) => present.has(modifier));
  return [...parts, mainKey].join("+");
}

export function isSupportedAccelerator(value: string): boolean {
  const tokens = value.split("+");
  const mainKey = tokens.at(-1);
  if (tokens.length < 2 || !mainKey || !isSupportedMainKey(mainKey)) {
    return false;
  }
  const seen = new Set<string>();
  let hasNonShiftModifier = false;
  for (const token of tokens.slice(0, -1)) {
    if (!MODIFIERS.has(token) || seen.has(token)) {
      return false;
    }
    seen.add(token);
    if (token !== "Shift") {
      hasNonShiftModifier = true;
    }
  }
  return hasNonShiftModifier;
}

const MAC_SYMBOLS: Record<string, string> = {
  Alt: "⌥",
  Command: "⌘",
  CommandOrControl: "⌘",
  Control: "⌃",
  Shift: "⇧",
  Super: "⌘",
};

const OTHER_PLATFORM_LABELS: Record<string, string> = {
  Alt: "Alt",
  Command: "Cmd",
  CommandOrControl: "Ctrl",
  Control: "Ctrl",
  Shift: "Shift",
  Super: "Win",
};

/** 返回逐键标签交给 Kbd 逐颗渲染；直接拼字符串会丢掉每颗键的独立样式 */
export function formatAccelerator(value: string, isMac: boolean): string[] {
  if (!value) {
    return [];
  }
  const labels = isMac ? MAC_SYMBOLS : OTHER_PLATFORM_LABELS;
  return value.split("+").map((token) => labels[token] ?? token);
}
