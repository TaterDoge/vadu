import { Text, View } from "nsh";
import { Window } from "nsh/desktop";

import "../../theme";

export function TranslateWindow() {
	return (
		<View
			class="flex-1 bg-background text-foreground"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				paddingRight: "env(safe-area-inset-right)",
				paddingBottom: "env(safe-area-inset-bottom)",
				paddingLeft: "env(safe-area-inset-left)",
			}}
		>
			<View
				testID="translation-workspace"
				role="region"
				accessibilityLabel="翻译工作台"
				class="flex-1 gap-3 p-6"
			>
				<Text
					role="header"
					accessibilityLevel={1}
					class="text-(length:--text-xl) font-semibold leading-6 text-foreground"
				>
					翻译工作台
				</Text>
				<Text class="text-(length:--text-sm) leading-6 text-muted-foreground">
					翻译功能尚未迁移。
				</Text>
			</View>
		</View>
	);
}

export function openTranslateWindow() {
	const window = Window.open(TranslateWindow, {
		id: "translate",
		title: "翻译工作台",
		defaultSize: { width: 720, height: 520 },
		defaultPosition: "center",
	});
	window.focus();
	return window;
}
