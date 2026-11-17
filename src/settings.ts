import { Storage, keymap, platform, signal } from "nsh";

const CONFIG_KEY = "vadu.config";
const SCHEMA_VERSION = 1;
const DEFAULT_SHORTCUTS = [
	{ id: "toggle-translate", keystroke: "mod+shift+m" },
	{ id: "open-settings", keystroke: "mod+," },
	{ id: "pin-translate", keystroke: "mod+p" },
];

export type ShortcutBinding = {
	id: string;
	keystroke: string;
};

export type AppSettings = {
	shortcuts: ShortcutBinding[];
};

export class SettingsError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
	}
}

function hasFields(
	value: unknown,
	fields: string[],
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === fields.length &&
		fields.every((field) => Object.hasOwn(value, field))
	);
}

function commandModifier() {
	// 由 NSH 判断 Apple / 浏览器键盘约定，不从显示文本反推整组按键。
	return keymap.label("mod+k") === keymap.label("cmd+k") ? "cmd" : "ctrl";
}

// shortcut: 保留键规则对齐 NSH 0.5.0，升级 SDK 时同步核对。
function isReserved(keystroke: string) {
	switch (platform.os) {
		case "macos":
		case "ios":
			return ["cmd+q", "cmd+h", "alt+cmd+h", "cmd+m", "ctrl+cmd+f"].includes(
				keystroke,
			);
		case "windows":
		case "linux":
		case "android":
			return ["ctrl+q", "alt+f4", "f11"].includes(keystroke);
		default:
			return false;
	}
}

function parseShortcut(text: string) {
	const invalid = () =>
		new SettingsError(
			"INVALID_CONFIG",
			"请按 Command / Ctrl / Alt 与其他键的组合，或 F1–F24。",
		);
	if (text.length > 128) throw invalid();
	try {
		keymap.label(text);
	} catch {
		throw invalid();
	}

	const parts = text.toLowerCase().split("+");
	const key = parts.pop()!;
	const command = commandModifier();
	const aliases: Record<string, string> = {
		control: "ctrl",
		option: "alt",
		opt: "alt",
		command: "cmd",
		meta: "cmd",
		super: "cmd",
		win: "cmd",
		mod: command,
		cmdorctrl: command,
		commandorcontrol: command,
	};
	const modifiers = parts.map((part) => aliases[part] ?? part);
	if (
		!modifiers.some((part) => ["ctrl", "alt", "cmd"].includes(part)) &&
		!/^f\d+$/.test(key)
	) {
		throw invalid();
	}
	const keyAliases: Record<string, string> = {
		return: "enter",
		esc: "escape",
		del: "delete",
		arrowup: "up",
		arrowdown: "down",
		arrowleft: "left",
		arrowright: "right",
		plus: "=",
		minus: "-",
	};
	const canonical = [
		...["ctrl", "alt", "shift", "cmd"].filter((part) => modifiers.includes(part)),
		keyAliases[key] ?? key,
	].join("+");
	if (isReserved(canonical)) {
		throw new SettingsError(
			"INVALID_CONFIG",
			"此组合键由系统保留，请选择其他快捷键。",
		);
	}
	return canonical;
}

function validate(settings: AppSettings) {
	if (
		settings.shortcuts.length !== DEFAULT_SHORTCUTS.length ||
		DEFAULT_SHORTCUTS.some(
			({ id }) =>
				settings.shortcuts.filter((binding) => binding.id === id).length !== 1,
		)
	) {
		throw new SettingsError(
			"INVALID_CONFIG",
			"快捷键配置不完整或包含未知动作，原配置已保留。",
		);
	}
	const strokes = settings.shortcuts.map(({ keystroke }) =>
		parseShortcut(keystroke),
	);
	if (new Set(strokes).size !== strokes.length) {
		throw new SettingsError(
			"SHORTCUT_CONFLICT",
			"此快捷键已用于其他动作，请选择其他组合。",
		);
	}
}

function decode(saved: string | null): AppSettings {
	if (saved === null) {
		return { shortcuts: DEFAULT_SHORTCUTS.map((binding) => ({ ...binding })) };
	}
	const invalid = () =>
		new SettingsError(
			"INVALID_CONFIG",
			"配置格式损坏或不受支持，原配置已保留，未覆盖。",
		);
	let value: unknown;
	try {
		value = JSON.parse(saved);
	} catch {
		throw invalid();
	}
	if (!hasFields(value, ["schemaVersion", "settings"])) throw invalid();
	if (value.schemaVersion !== SCHEMA_VERSION) {
		throw new SettingsError(
			"UNSUPPORTED_VERSION",
			"配置版本不受支持，请使用对应版本的应用；原配置未覆盖。",
		);
	}
	if (
		!hasFields(value.settings, ["shortcuts"]) ||
		!Array.isArray(value.settings.shortcuts)
	) {
		throw invalid();
	}
	const shortcuts = value.settings.shortcuts.map((binding: unknown) => {
		if (
			!hasFields(binding, ["id", "keystroke"]) ||
			typeof binding.id !== "string" ||
			typeof binding.keystroke !== "string"
		) {
			throw invalid();
		}
		return { id: binding.id, keystroke: binding.keystroke };
	});
	const settings = { shortcuts };
	validate(settings);
	return settings;
}

async function loadSettings() {
	return decode(await Storage.getItem(CONFIG_KEY));
}

// Storage 只保证单个调用有序；整段读改写也必须串行，避免跨页覆盖。
let writes: Promise<unknown> = Promise.resolve();
const current = signal<AppSettings | null>(null);

async function read(): Promise<AppSettings> {
	await writes;
	const settings = await loadSettings();
	current.set(settings);
	return settings;
}

function setShortcut(id: string, keystroke: string): Promise<AppSettings> {
	const update = writes.then(async () => {
		const settings = await loadSettings();
		const binding = settings.shortcuts.find((item) => item.id === id);
		if (!binding) throw new SettingsError("INVALID_CONFIG", "未知快捷键动作。");
		const command = commandModifier();
		binding.keystroke = parseShortcut(keystroke)
			.split("+")
			.map((part) => (part === command ? "mod" : part))
			.join("+");
		validate(settings);
		try {
			await Storage.setItem(
				CONFIG_KEY,
				JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings }),
			);
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "ERR_NSH_QUOTA_EXCEEDED"
			) {
				throw new SettingsError(
					"STORAGE_FULL",
					"配置存储空间不足，修改未保存。",
				);
			}
			throw error;
		}
		current.set(settings);
		return settings;
	});
	writes = update.catch(() => {});
	return update;
}

function resetShortcut(id: string): Promise<AppSettings> {
	const binding = DEFAULT_SHORTCUTS.find((item) => item.id === id);
	if (!binding) {
		return Promise.reject(
			new SettingsError("INVALID_CONFIG", "未知快捷键动作。"),
		);
	}
	return setShortcut(id, binding.keystroke);
}

export const Settings = {
	read,
	setShortcut,
	resetShortcut,
	current: () => current(),
};

export function captureShortcutKeys() {
	const keys = [
		..."abcdefghijklmnopqrstuvwxyz0123456789`-=[]\\;',./",
		"space",
		"enter",
		"escape",
		"tab",
		"backspace",
		"delete",
		"insert",
		"up",
		"down",
		"left",
		"right",
		"home",
		"end",
		"pageup",
		"pagedown",
		...Array.from({ length: 24 }, (_, index) => `f${index + 1}`),
	];
	const result: string[] = [];
	for (let mask = 0; mask < 16; mask++) {
		const modifiers = ["ctrl", "alt", "shift", "cmd"].filter(
			(_, index) => mask & (1 << index),
		);
		for (const key of keys) {
			const stroke = [...modifiers, key].join("+");
			if (
				!["escape", "tab", "shift+tab"].includes(stroke) &&
				!isReserved(stroke)
			) {
				result.push(stroke);
			}
		}
	}
	return result;
}
