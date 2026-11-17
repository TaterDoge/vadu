import { Text, View } from "nsh";
import { Window } from "nsh/desktop";

import "../../theme";

export function TranslateWindow() {
	return (
		<View class="flex-1 bg-background rounded-md overflow-hidden text-foreground">
			<View
				testID="translation-workspace"
				role="region"
				accessibilityLabel="翻译工作台"
				class="flex-1 gap-3 p-6"
			>
				<Text
					role="header"
					accessibilityLevel={1}
					class="text-xl font-semibold leading-6 text-foreground"
				>
					翻译工作台aa
				</Text>
				<Text class="text-sm leading-6 text-muted-foreground">
					翻译功能尚未迁移。
				</Text>
			</View>
		</View>
	);
}

export function openTranslateWindow() {
	const window = Window.open(TranslateWindow, {
		id: "translate",
		// 避免聚焦翻译浮窗时激活整个应用，把设置窗也带到前台。 错误的设置
		kind: "normal",
		// level: "aboveDock",
		minimizable: true,
		maximizable: true,
		frame: "none",
		transparent: true,
		backdrop: "none",
		workspaces: "all",
		defaultSize: { width: 480, height: 600 },
		sizeToContent: true,
		defaultPosition: "center",
		shadow: true,
	});
	window.focus();
	return window;
}

export function toggleTranslateWindow() {
	const window = Window.get("translate");
	if (window?.state()?.visible) {
		window.hide();
	} else {
		openTranslateWindow();
	}
}
