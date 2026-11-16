import { expect, open, test } from "nsh/test";

test("Item 渲染可选插槽并保持属性和子控件响应式", async () => {
	const app = await open("./fixtures/Item.tsx", {
		width: 960,
		height: 620,
		platform: "macos",
	});

	expect(app.shows("id:full-item >> text:提醒 0")).toBe(true);
	expect(app.shows("id:full-item >> text:图标")).toBe(true);
	expect(app.shows("id:plain-item >> text:无附加内容")).toBe(true);
	await app.press("id:increment");
	expect(app.shows("id:full-item >> text:提醒 1")).toBe(true);
	await app.press("id:toggle");
	expect(app.shows("text:提醒已开启")).toBe(true);
	expect(app.enabled("id:disabled-action")).toBe(false);
	await expect(app.press("id:disabled-action")).rejects.toMatchObject({
		code: "ERR_NSH_TEST_DISABLED",
	});

	await app.press("id:toggle-details");
	expect(app.count("id:full-item")).toBe(0);
	expect(app.shows("id:compact-item >> text:提醒 1")).toBe(true);
	expect(app.count("text:图标")).toBe(0);
	expect(app.count("id:increment")).toBe(0);
	expect(app.texts().join(" ").includes("这是一段较长的设置说明")).toBe(false);

	await app.press("id:toggle-details");
	expect(app.count("id:full-item")).toBe(1);
	expect(app.shows("id:full-item >> text:图标")).toBe(true);
	expect(app.texts().join(" ").includes("这是一段较长的设置说明")).toBe(true);
	expect(app.shows("text:提醒已开启")).toBe(true);
	expect(app.enabled("id:disabled-action")).toBe(false);
	await app.press("id:increment");
	expect(app.shows("id:full-item >> text:提醒 2")).toBe(true);
});

test("Item 在窄窗口与尺寸变化后保留操作区和键盘交互", async () => {
	const app = await open("./fixtures/Item.tsx", {
		width: 360,
		height: 640,
		platform: "macos",
	});

	await app.keyboard.press("tab");
	await app.keyboard.press("enter");
	expect(app.shows("id:full-item >> text:提醒 1")).toBe(true);
	await app.keyboard.press("tab");
	await app.keyboard.press("space");
	expect(app.shows("text:提醒已开启")).toBe(true);

	await app.setViewport(960, 620);
	await app.press("id:toggle");
	expect(app.shows("text:提醒已关闭")).toBe(true);
	await app.setViewport(320, 640);
	await app.press("id:increment");
	expect(app.shows("id:full-item >> text:提醒 2")).toBe(true);
});
