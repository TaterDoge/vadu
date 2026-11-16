import { Text, View } from "nsh";
import { Window } from "nsh/desktop";

export function TranslateWindow() {
	return (
		<View
			class="flex-1 bg-slate-50"
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
					class="text-2xl font-semibold text-slate-900"
				>
					翻译工作台
				</Text>
				<Text class="text-sm leading-6 text-slate-600">
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
