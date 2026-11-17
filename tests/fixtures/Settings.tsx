import { Text, View, host, keymap, mount, signal } from "nsh";
import { Button } from "nsh/base";

import { Settings, SettingsError, captureShortcutKeys } from "../../src/settings";

function SettingsFixture() {
	const status = signal("{}");

	async function read() {
		try {
			status.set(JSON.stringify({ settings: await Settings.read() }));
		} catch (error) {
			status.set(JSON.stringify({
				code: error instanceof SettingsError ? error.code : "INTERNAL",
			}));
		}
	}

	async function update() {
		const first = host.params.first;
		const updates = [
			Settings.setShortcut(
				"toggle-translate",
				typeof first === "string" ? first : "Command+Alt+K",
			),
			Settings.setShortcut("open-settings", "alt+j"),
		];
		const latest = Settings.read();
		const results = await Promise.allSettled(updates);
		const settings = await latest;
		status.set(JSON.stringify({
			results: results.map((result) =>
				result.status === "fulfilled"
					? { status: result.status }
					: {
							status: result.status,
							code: result.reason instanceof SettingsError
								? result.reason.code
								: "INTERNAL",
						},
			),
			settings,
		}));
	}

	function checkCaptureKeys() {
		const keys = captureShortcutKeys();
		try {
			const stop = keymap.bind(
				Object.fromEntries(keys.map((key) => [key, () => {}])),
			);
			stop();
			status.set(JSON.stringify({
				unique: new Set(keys).size === keys.length,
				navigationExcluded: ["escape", "tab", "shift+tab"].every(
					(key) => !keys.includes(key),
				),
				lastFunctionKey: keys.includes("ctrl+alt+shift+cmd+f24"),
			}));
		} catch {
			status.set(JSON.stringify({ error: "键表包含无效或系统保留组合" }));
		}
	}

	return (
		<View>
			<Button testID="read" onPress={read}>
				<Text>读取配置</Text>
			</Button>
			<Button testID="update" onPress={update}>
				<Text>同时保存两项</Text>
			</Button>
			<Button testID="check-keys" onPress={checkCaptureKeys}>
				<Text>校验键表</Text>
			</Button>
			<Text>{`配置状态 ${status()}`}</Text>
		</View>
	);
}

mount(SettingsFixture);
