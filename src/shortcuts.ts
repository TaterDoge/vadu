import { cleanup, computed, effect, keymap, platform, signal } from "nsh";
import { GlobalShortcut, Window } from "nsh/desktop";

import { Settings, SettingsError } from "./settings";
import {
	openTranslateWindow,
	toggleTranslatePin,
} from "./windows/translate/TranslateWindow";

const shortcutActions = [
	{
		id: "toggle-translate",
		scope: "global",
		run: openTranslateWindow,
	},
	{
		id: "open-settings",
		scope: "translate",
		run: () => Window.get("main")?.focus(),
	},
	{
		id: "pin-translate",
		scope: "translate",
		run: toggleTranslatePin,
	},
	{
		id: "hide-translate",
		scope: "translate",
		keystroke: "cmd+w",
		run: () => Window.get("translate")?.hide(),
	},
] as const;

export const shortcutRecording = signal(false);
export const translateShortcutStatus = signal("正在读取快捷键配置…");

export function setupShortcuts() {
	let disposed = false;
	cleanup(() => {
		disposed = true;
	});
	void Settings.read().catch((error) => {
		if (!disposed) {
			translateShortcutStatus.set(
				error instanceof SettingsError
					? error.message
					: "无法读取快捷键配置，未启用。",
			);
		}
	});

	for (const action of shortcutActions) {
		const keystroke = computed(() => {
			const bindings = Settings.current()?.shortcuts;
			if (!bindings) return;
			if (action.id === "hide-translate") {
				if (platform.os !== "macos") return;
				// 用户已分配的组合优先，包括 mod+w 等别名。
				const label = keymap.label(action.keystroke);
				if (bindings.some(({ keystroke }) => keymap.label(keystroke) === label)) {
					return;
				}
				return action.keystroke;
			}
			return bindings.find(({ id }) => id === action.id)?.keystroke;
		});

		effect(() => {
			const shortcut = keystroke();
			const recording = shortcutRecording();
			if (!shortcut) return;
			if (recording) {
				if (action.scope === "global") {
					translateShortcutStatus.set("录入期间已暂停");
				}
				return;
			}
			if (action.scope !== "global") {
				const state = Window.get(action.scope)?.state();
				// keymap 绑定共享应用 engine，失焦时解绑，避免截获其他窗口的按键。
				if (!state?.visible || !state.focused) return;
				return keymap.bind(shortcut, action.run, { when: "always" });
			}

			let active = true;
			translateShortcutStatus.set("正在注册…");
			cleanup(() => {
				active = false;
				GlobalShortcut.unregister(shortcut);
			});
			void (async () => {
				try {
					const registered = await GlobalShortcut.register(shortcut, () => {
						if (active) action.run();
					});
					if (active) {
						translateShortcutStatus.set(
							registered
								? "已启用"
								: "注册失败：组合键可能已被占用，或当前平台不支持。请更换组合键。",
						);
					}
				} catch {
					if (active) {
						translateShortcutStatus.set("注册失败，请重新录入快捷键后重试。");
					}
				}
			})();
		});
	}
}
