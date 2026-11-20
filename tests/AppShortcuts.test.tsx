import { type OpenOptions, expect, open, test } from "nsh/test";

async function openWindows(options: OpenOptions = {}) {
	return open("./fixtures/Windows.tsx", {
		width: 1200,
		height: 800,
		platform: "macos",
		host: {},
		...options,
	});
}

test("翻译窗口 Command + 逗号恢复设置窗口并保留分类", async () => {
	const app = await openWindows();
	const main = app.window("main");
	await app.press("id:settings-appearance");
	await main.pressClose();
	await app.host.send("open-translate");
	await app.keyboard.press("cmd+,");
	expect(main.state()).toMatchObject({ visible: true, focused: true });
	expect(app.count("label:外观")).toBe(2);
	expect(app.window("translate").state()).toMatchObject({ visible: false });

	await app.host.send("minimize-settings");
	await app.waitUntil(() => main.state()?.minimized === true);
	await app.host.send("open-translate");
	await app.keyboard.press("cmd+,");
	expect(main.state()).toMatchObject({
		visible: true,
		focused: true,
		minimized: false,
	});
	expect(app.count("label:外观")).toBe(2);
});

test("单击翻译窗设置按钮恢复设置窗口并保留分类", async () => {
	const app = await openWindows();
	const main = app.window("main");
	await app.press("id:settings-appearance");
	await main.pressClose();
	await app.host.send("open-translate");
	await app.press("id:translation-toolbar >> label:打开设置");
	expect(main.state()).toMatchObject({ visible: true, focused: true });
	expect(app.count("label:外观")).toBe(2);
	expect(app.window("translate").state()).toMatchObject({ visible: false });
});

test("翻译窗口首次唤起即把键盘输入交给原文输入", async () => {
	const app = await openWindows();
	await app.host.send("open-translate");
	await app.keyboard.press("a");
	expect(app.value("id:translation-source-input")).toBe("a");
});

test("翻译窗口 Command + W 隐藏窗口，重新唤起后保留原文与输入焦点", async () => {
	const app = await openWindows();
	await app.host.send("open-translate");
	await app.type("id:translation-source-input", "a");
	await app.keyboard.press("cmd+w");
	expect(app.window("translate").state()).toMatchObject({ visible: false });
	await app.host.send("open-translate");
	await app.keyboard.press("b");
	expect(app.value("id:translation-source-input")).toBe("ab");
});

test("设置窗口录入不触发翻译窗口动作，浮窗隐藏或关闭后解绑", async () => {
	const app = await openWindows();
	const main = app.window("main");
	await app.host.send("open-translate");
	await app.host.send("open-settings");
	await app.press("id:settings-shortcuts");
	await app.press("id:shortcut-open-settings-input");
	expect(app.shows("id:shortcut-open-settings-input >> text:请按下快捷键…")).toBe(true);
	await app.keyboard.press("cmd+,");
	expect(app.shows("id:shortcut-open-settings-input >> text:请按下快捷键…")).toBe(false);
	expect(JSON.parse(app.storage()["vadu.config"]).settings.shortcuts[1]).toEqual({
		id: "open-settings",
		keystroke: "mod+,",
	});

	await main.pressClose();
	await app.host.send("hide-translate");
	await app.keyboard.press("cmd+,");
	expect(main.state()).toMatchObject({ visible: false });

	await app.host.send("open-translate");
	await app.window("translate").pressClose();
	await app.keyboard.press("cmd+,");
	expect(main.state()).toMatchObject({ visible: false });

	await app.host.send("open-translate");
	await app.keyboard.press("cmd+,");
	expect(main.state()).toMatchObject({ visible: true, focused: true });
});

test("打开设置改绑为 Command + W 后优先于隐藏，重新启动仍生效", async () => {
	const app = await openWindows();
	await app.host.send("open-translate");
	await app.host.send("open-settings");
	await app.press("id:settings-shortcuts");
	await app.press("id:shortcut-open-settings-input");
	await app.keyboard.press("cmd+w");
	const storage = app.storage();

	await app.host.send("open-translate");
	await app.keyboard.press("cmd+,");
	expect(app.window("main").state()).toMatchObject({ focused: false });
	await app.keyboard.press("cmd+w");
	expect(app.window("main").state()).toMatchObject({ visible: true, focused: true });

	const reopened = await openWindows({ storage });
	expect(reopened.count("id:settings-shortcuts-page")).toBe(0);
	await reopened.window("main").pressClose();
	await reopened.host.send("open-translate");
	await reopened.keyboard.press("cmd+,");
	expect(reopened.window("main").state()).toMatchObject({ visible: false });
	await reopened.keyboard.press("cmd+w");
	expect(reopened.window("main").state()).toMatchObject({ visible: true, focused: true });
});

test("配置损坏时不偷偷启用默认局内绑定或覆盖配置", async () => {
	const storage = { "vadu.config": "{" };
	const app = await openWindows({ storage });
	await app.window("main").pressClose();
	await app.host.send("open-translate");
	await app.keyboard.press("cmd+,");
	expect(app.window("main").state()).toMatchObject({ visible: false });
	expect(app.storage()).toEqual(storage);
});
