import { expect, open, test } from "nsh/test";

test("主窗口启动显示，关闭后隐藏，重新聚焦保留分类", async () => {
	const app = await open("./fixtures/Windows.tsx", {
		width: 1200,
		height: 800,
		platform: "macos",
		host: {},
	});
	const main = app.window("main");

	expect(main.state()).toMatchObject({ visible: true });
	await app.press("id:settings-appearance");

	for (let i = 0; i < 2; i++) {
		await main.pressClose();
		expect(main.state()).toMatchObject({ visible: false });

		await app.host.send("open-settings");
		expect(main.state()).toMatchObject({ visible: true, focused: true });
		expect(app.count("label:外观")).toBe(2);
	}
});
