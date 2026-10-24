import { isAcceleratorModifier } from "@shared/hotkey";
import {
  type RegisterableHotkey,
  validateHotkey,
} from "@tanstack/react-hotkeys";

/**
 * Electron accelerator（CommandOrControl+…）→ TanStack chord（Mod+…，Mod=mac ⌘ / 其它 Ctrl）。
 * 配置可能被手改或来自旧版本，TanStack 不认的组合返回 null，调用方按「未绑定」处理。
 */
export function toChord(accelerator: string | null): RegisterableHotkey | null {
  if (!accelerator) {
    return null;
  }
  const tokens = accelerator.split("+");
  // 主键 = 非修饰符 token；手改配置可能乱序，不能假设主键在末位
  const mainKey = tokens.find((token) => !isAcceleratorModifier(token)) ?? "";
  const hasMod =
    tokens.includes("CommandOrControl") || tokens.includes("Command");
  const modifiers = tokens.flatMap((token) => {
    if (token === mainKey) {
      return [];
    }
    if (token === "CommandOrControl" || token === "Command") {
      return ["Mod"];
    }
    // TanStack 禁止 Mod+Control / Mod+Meta（Mod 已含对应键），录到双重修饰时丢次要键
    if (hasMod && (token === "Control" || token === "Super")) {
      return [];
    }
    return [token === "Super" ? "Meta" : token];
  });
  const chord = [...modifiers, mainKey].join("+");
  // validateHotkey 只收窄运行时，类型层仍要显式 cast
  return validateHotkey(chord).valid ? (chord as RegisterableHotkey) : null;
}
