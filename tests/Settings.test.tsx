import { expect, open, test } from "nsh/test";

const defaults = [
	{ id: "toggle-translate", keystroke: "mod+shift+m" },
	{ id: "open-settings", keystroke: "mod+," },
	{ id: "pin-translate", keystroke: "mod+p" },
];

function config(shortcuts: unknown[] = defaults) {
	return { schemaVersion: 1, settings: { shortcuts } };
}

function status(app: Awaited<ReturnType<typeof open>>) {
	const text = app.texts().find((text) => text.startsWith("配置状态 "));
	return JSON.parse(text!.slice("配置状态 ".length));
}

const invalidDocuments = [
	{ name: "空值", value: null },
	{ name: "未知顶层字段", value: { ...config(), extra: true } },
	{
		name: "未知设置字段",
		value: { schemaVersion: 1, settings: { shortcuts: defaults, extra: true } },
	},
	{
		name: "未知绑定字段",
		value: config([{ ...defaults[0], extra: true }, ...defaults.slice(1)]),
	},
	{ name: "缺少动作", value: config(defaults.slice(1)) },
	{ name: "重复动作", value: config([defaults[0], defaults[0], defaults[2]]) },
	{
		name: "未知动作",
		value: config([{ id: "unknown", keystroke: "alt+k" }, ...defaults.slice(1)]),
	},
	{
		name: "快捷键不是字符串",
		value: config([{ ...defaults[0], keystroke: 7 }, ...defaults.slice(1)]),
	},
];

for (const { name, value } of invalidDocuments) {
	test(`配置拒绝${name}并保留原数据`, async () => {
		const storage = { "vadu.config": JSON.stringify(value) };
		const app = await open("fixtures/Settings.tsx", { platform: "macos", storage });
		await app.press("id:read");
		expect(status(app)).toEqual({ code: "INVALID_CONFIG" });
		expect(app.storage()).toEqual(storage);
	});
}

for (const keystroke of [
	"k", "shift+k", "mod++", "mod+unknown", "mod+f25", "ctrl+ctrl+k",
	"mod+q", "mod+h", "alt+mod+h", "mod+m", "ctrl+cmd+f", "x".repeat(129),
]) {
	test(`配置拒绝非法或保留快捷键：${keystroke}`, async () => {
		const storage = { "vadu.config": JSON.stringify(config([{ ...defaults[0], keystroke }, ...defaults.slice(1)])) };
		const app = await open("fixtures/Settings.tsx", { platform: "macos", storage });
		await app.press("id:read");
		expect(status(app)).toEqual({ code: "INVALID_CONFIG" });
		expect(app.storage()).toEqual(storage);
	});
}

for (const [first, second] of [
	["Command+P", "mod+p"],
	["mod+return", "cmd+enter"],
	["mod+plus", "cmd+="],
]) {
	test(`别名组合也检查冲突：${first} / ${second}`, async () => {
		const storage = {
			"vadu.config": JSON.stringify(config([
				{ ...defaults[0], keystroke: first },
				{ ...defaults[1], keystroke: second },
				{ ...defaults[2], keystroke: "alt+k" },
			])),
		};
		const app = await open("fixtures/Settings.tsx", { platform: "macos", storage });
		await app.press("id:read");
		expect(status(app)).toEqual({ code: "SHORTCUT_CONFLICT" });
		expect(app.storage()).toEqual(storage);
	});
}

for (const platform of ["macos", "windows", "linux"] as const) {
	test(`${platform} 两项并发保存不互相覆盖，键表可绑定且无重复`, async () => {
		const apple = platform === "macos";
		const app = await open("fixtures/Settings.tsx", {
			platform,
			host: { params: { first: apple ? "Command+Alt+K" : "CTRL+SHIFT+K" } },
		});
		await app.press("id:update");
		const settings = {
			shortcuts: [
				{ ...defaults[0], keystroke: apple ? "alt+mod+k" : "mod+shift+k" },
				{ ...defaults[1], keystroke: "alt+j" },
				defaults[2],
			],
		};
		expect(status(app)).toEqual({
			results: [{ status: "fulfilled" }, { status: "fulfilled" }],
			settings,
		});
		expect(JSON.parse(app.storage()["vadu.config"])).toEqual({
			schemaVersion: 1, settings,
		});
		await app.press("id:check-keys");
		expect(status(app)).toEqual({
			unique: true, navigationExcluded: true, lastFunctionKey: true,
		});
	});

	if (platform !== "macos") {
		for (const keystroke of ["ctrl+q", "alt+f4", "f11"]) {
			test(`${platform} 拒绝保留键 ${keystroke}`, async () => {
				const storage = { "vadu.config": JSON.stringify(config([{ ...defaults[0], keystroke }, ...defaults.slice(1)])) };
				const app = await open("fixtures/Settings.tsx", { platform, storage });
				await app.press("id:read");
				expect(status(app)).toEqual({ code: "INVALID_CONFIG" });
				expect(app.storage()).toEqual(storage);
			});
		}
	}
}

test("校验失败不阻塞后续保存队列", async () => {
	const app = await open("fixtures/Settings.tsx", {
		platform: "macos",
		host: { params: { first: "mod+p" } },
	});
	await app.press("id:update");
	expect(status(app).results).toEqual([
		{ status: "rejected", code: "SHORTCUT_CONFLICT" },
		{ status: "fulfilled" },
	]);
	expect(JSON.parse(app.storage()["vadu.config"])).toEqual(config([
		defaults[0], { ...defaults[1], keystroke: "alt+j" }, defaults[2],
	]));
});

test("意外读取异常显示安全提示，禁用编辑且不覆盖数据", async () => {
	const storage = { unrelated: "retained" };
	const app = await open("../App.tsx", {
		platform: "macos",
		storage,
		modules: {
			nsh: {
				"Storage.getItem": () => {
					throw new Error("private failure detail");
				},
			},
		},
	});
	await app.press("id:settings-shortcuts");
	expect(app.shows("text:无法访问配置，请稍后重试。")).toBe(true);
	expect(app.enabled("id:shortcut-toggle-translate-input")).toBe(false);
	expect(app.storage()).toEqual(storage);
});

test("意外写入失败不修改原值，后续保存仍读取最新文档", async () => {
	let saved: string | null = null;
	let writes = 0;
	const app = await open("fixtures/Settings.tsx", {
		platform: "macos",
		modules: {
			nsh: {
				"Storage.getItem": () => saved,
				"Storage.setItem": (_key: string, value: string) => {
					if (writes++ === 0) throw new Error("private failure detail");
					saved = value;
				},
			},
		},
	});
	await app.press("id:update");
	expect(status(app)).toEqual({
		results: [{ status: "rejected", code: "INTERNAL" }, { status: "fulfilled" }],
		settings: {
			shortcuts: [defaults[0], { ...defaults[1], keystroke: "alt+j" }, defaults[2]],
		},
	});
	expect(JSON.parse(saved!)).toEqual(config([
		defaults[0], { ...defaults[1], keystroke: "alt+j" }, defaults[2],
	]));
});
