import { expect, open, test } from "nsh/test";

const viewport = { width: 480, height: 320, platform: "macos" } as const;

test("翻译窗口保留截图分区，业务按钮禁用且原文编辑不触发业务", async () => {
	const app = await open("./fixtures/Translate.tsx", viewport);

	expect(app.shows("label:翻译工作台")).toBe(true);
	expect(app.shows("id:translation-toolbar")).toBe(true);
	expect(app.shows("id:translation-source-panel")).toBe(true);
	expect(app.shows("id:translation-result >> text:翻译结果")).toBe(true);
	expect(app.shows("text:zh")).toBe(true);
	expect(app.shows("text:翻译功能尚未迁移。")).toBe(false);
	for (const label of [
		"固定窗口",
		"服务配置",
		"朗读原文",
		"复制原文",
		"清空原文",
		"目标语言",
		"翻译",
	]) {
		expect(app.shows("label:" + label)).toBe(true);
		expect(app.enabled("label:" + label)).toBe(false);
	}

	await app.type("id:translation-source-input", "a\n待翻译的文本");
	expect(app.value("id:translation-source-input")).toBe("a\n待翻译的文本");
	expect(app.shows("id:translation-result >> text:翻译结果")).toBe(true);
	expect(app.requests()).toEqual([]);
	expect(app.storage()).toEqual({});
});

test("翻译窗口使用语义配色，跟随系统切换深浅主题", async () => {
	const app = await open("./fixtures/Translate.tsx", {
		...viewport,
		colorScheme: "light",
	});

	expect(app.spanStyle("text:zh").color).toBe("#0a0a0aff");
	expect(app.spanStyle("id:translation-submit >> text:翻译").color).toBe(
		"#ffffffff",
	);
	expect(app.spanStyle("text:翻译结果").color).toBe("#737373ff");
	await app.setColorScheme("dark");
	expect(app.spanStyle("text:zh").color).toBe("#fafafaff");
	expect(app.spanStyle("id:translation-submit >> text:翻译").color).toBe(
		"#0a0a0aff",
	);
	expect(app.spanStyle("text:翻译结果").color).toBe("#a1a1a1ff");
});

test("翻译窗口缩放后保留输入、操作行与结果分区", async () => {
	const app = await open("./fixtures/Translate.tsx", viewport);
	await app.type("id:translation-source-input", "草稿");

	for (const [width, height] of [
		[320, 320],
		[640, 480],
		[480, 320],
	]) {
		await app.setViewport(width, height);
		expect(app.shows("id:translation-language")).toBe(true);
		expect(app.shows("id:translation-submit")).toBe(true);
		expect(app.shows("id:translation-result >> text:翻译结果")).toBe(true);
		expect(app.value("id:translation-source-input")).toBe("草稿");
	}
});
