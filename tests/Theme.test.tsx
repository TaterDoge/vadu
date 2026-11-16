import { type App, expect, open, test } from "nsh/test";

function status(app: App) {
	const text = app.texts().find((text) => text.startsWith("主题状态 "));
	expect(text).toBeDefined();
	return JSON.parse(text!.slice("主题状态 ".length));
}

const viewport = { width: 960, height: 900, platform: "macos" } as const;

test("主题默认跟随系统，手动选择优先，切回系统后继续响应", async () => {
	const app = await open("./fixtures/Theme.tsx", {
		...viewport,
		colorScheme: "dark",
	});
	await app.press("id:settings-appearance");
	expect(status(app)).toMatchObject({
		appearance: "system",
		scheme: "dark",
		accent: "neutral",
		style: "nova",
	});
	expect(app.spanStyle("text:Aa 0123456789 · 你好").color).toBe("#fafafaff");

	await app.setColorScheme("light");
	expect(status(app).scheme).toBe("light");
	expect(app.spanStyle("text:Aa 0123456789 · 你好").color).toBe("#0a0a0aff");
	await app.press("id:appearance-dark");
	await app.setColorScheme("dark");
	await app.setColorScheme("light");
	expect(status(app)).toMatchObject({ appearance: "dark", scheme: "dark" });

	await app.press("id:appearance-light");
	await app.setColorScheme("dark");
	expect(status(app)).toMatchObject({ appearance: "light", scheme: "light" });
	await app.press("id:appearance-system");
	expect(status(app)).toMatchObject({ appearance: "system", scheme: "dark" });
	await app.setColorScheme("light");
	expect(status(app).scheme).toBe("light");
});

test("六种强调色使用主题色值，深浅前景可读，恢复中性不残留覆盖", async () => {
	const app = await open("./fixtures/Theme.tsx", viewport);
	await app.press("id:settings-appearance");

	for (const scheme of ["light", "dark"] as const) {
		await app.setColorScheme(scheme);
		const neutral = status(app);
		for (const accent of ["blue", "emerald", "amber", "rose", "violet"]) {
			await app.press("id:accent-" + accent);
			const selected = status(app);
			expect(selected.primary).toBe(selected[accent]);
			expect(selected.sidebarPrimary).toBe(selected.primary);
			expect(selected.sidebarForeground).toBe(selected.primaryForeground);
			expect(selected.border).toBe(neutral.border);
			expect(selected.neutral).toBe(neutral.primary);
			expect(app.spanStyle("text:强调色预览").color).toBe(
				accent === "amber" || scheme === "dark" ? "#0a0a0aff" : "#fafafaff",
			);
		}
		await app.press("id:accent-neutral");
		expect(status(app)).toMatchObject({
			primary: neutral.primary,
			primaryForeground: neutral.primaryForeground,
			sidebarPrimary: neutral.sidebarPrimary,
			sidebarForeground: neutral.sidebarForeground,
		});
	}
});

test("Nova 与 Lyra 切换字体 圆角 字号，导航卸载后保留并可恢复", async () => {
	const app = await open("./fixtures/Theme.tsx", viewport);
	await app.press("id:settings-appearance");
	expect(status(app)).toMatchObject({
		font: "Geist Mono",
		keyFont: "Lucida Grande",
		radius: 10,
		radiusXl: 14,
	});
	expect(app.spanStyle("text:Aa 0123456789 · 你好").fontSize).toBe(20);
	expect(app.spanStyle("text:强调色预览").fontSize).toBe(14);

	await app.press("id:accent-amber");
	await app.press("id:style-lyra");
	expect(status(app)).toMatchObject({
		style: "lyra",
		accent: "amber",
		font: "JetBrains Mono",
		keyFont: "Lucida Grande",
		radius: 0,
		radiusXl: 0,
	});
	expect(app.spanStyle("text:Aa 0123456789 · 你好").fontSize).toBe(18);
	expect(app.spanStyle("text:强调色预览").fontSize).toBe(12);
	await app.press("id:settings-shortcuts");
	expect(app.spanStyle("text:全局快捷键").fontSize).toBe(12);
	expect(app.spanStyle("id:shortcut-toggle-translate >> text:⌘").fontSize).toBe(
		12,
	);
	await app.press("id:settings-appearance");
	expect(status(app).style).toBe("lyra");

	await app.press("id:style-nova");
	expect(status(app)).toMatchObject({
		style: "nova",
		accent: "amber",
		font: "Geist Mono",
		radius: 10,
		radiusXl: 14,
	});
	expect(app.spanStyle("text:强调色预览").fontSize).toBe(14);
});

test("外观单选组支持方向键，翻译窗口打开期间共享主题且重开不重置", async () => {
	const app = await open("./fixtures/Theme.tsx", viewport);
	for (let index = 0; index < 3; index++) await app.keyboard.press("tab");
	await app.keyboard.press("enter");
	for (let index = 0; index < 3; index++) await app.keyboard.press("tab");
	await app.keyboard.press("right");
	expect(status(app).appearance).toBe("light");
	await app.keyboard.press("right");
	expect(status(app).appearance).toBe("dark");

	await app.press("id:open-translate");
	expect(app.window("translate").state()).not.toBeNull();
	await app.press("id:accent-blue");
	await app.press("id:style-lyra");
	expect(status(app)).toMatchObject({
		appearance: "dark",
		accent: "blue",
		style: "lyra",
	});
	await app.window("translate").pressClose();
	await app.press("id:open-translate");
	expect(app.window("translate").state()).not.toBeNull();
	expect(status(app)).toMatchObject({
		appearance: "dark",
		accent: "blue",
		style: "lyra",
	});
});
