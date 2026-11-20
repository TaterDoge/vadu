import {
	Image,
	type InputRef,
	Text,
	View,
	cleanup,
	effect,
	signal,
	token,
} from "nsh";
import { Button } from "nsh/base";
import { Window, currentWindow } from "nsh/desktop";

import { IconButton } from "../../components/IconButton";
import "../../theme";
import settingsIcon from "../settings/icons/general.svg";
import pinIcon from "../settings/pages/shortcuts/pin.svg";
import { TranslateInput } from "./components/TranslateInput";
import chevronDownIcon from "./icons/chevron-down.svg";

const pinned = signal(false);

export function toggleTranslatePin() {
	pinned.set(!pinned());
}

export function TranslateWindow() {
	let inputRef: InputRef | undefined;
	const window = currentWindow();
	effect(() => window.set({ level: pinned() ? "aboveDock" : "normal" }));
	cleanup(() => pinned.set(false));

	window.on("focusChange", ({ focused }) => {
		if (focused) {
			inputRef?.focus();
		} else if (!pinned()) {
			window.hide();
		}
	});

	return (
		<View
			testID="translation-workspace"
			role="region"
			accessibilityLabel="翻译工作台"
			class="min-w-0 flex-1 overflow-hidden rounded-xl bg-background text-foreground"
		>
			<View
				testID="translation-toolbar"
				class="h-8 shrink-0 flex-row items-center justify-between px-3"
				desktop={{ windowDrag: true }}
			>
				<IconButton
					label={pinned() ? "取消固定窗口" : "固定窗口"}
					icon={pinIcon}
					selected={pinned()}
					onPress={toggleTranslatePin}
				/>
				<IconButton
					label="打开设置"
					icon={settingsIcon}
					onPress={() => Window.get("main")?.focus()}
				/>
			</View>
			<View class="min-h-0 flex-1 gap-2 px-2 pb-4">
				<TranslateInput
					inputRef={(node) => {
						inputRef = node;
					}}
				/>
				<View class="h-8 shrink-0 flex-row gap-2">
					<Button
						testID="translation-language"
						disabled
						accessibilityLabel="目标语言"
						tooltip="目标语言（暂未实现）"
						class="w-24 flex-row items-center justify-between rounded-lg border border-border bg-background px-3"
					>
						<Text class="text-sm leading-5 text-foreground">zh</Text>
						<Image
							src={chevronDownIcon}
							class="h-3 w-3"
							style={{ tintColor: token("muted-foreground") }}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
						/>
					</Button>
					<Button
						testID="translation-submit"
						disabled
						accessibilityLabel="翻译"
						tooltip="翻译（暂未实现）"
						class="flex-1 items-center justify-center rounded-lg bg-foreground"
					>
						<Text class="text-sm font-semibold leading-5 text-background">
							翻译
						</Text>
					</Button>
				</View>
				<View
					testID="translation-result"
					role="region"
					accessibilityLabel="翻译结果"
					class="min-h-0 rounded-xl bg-muted p-3"
					style={{ flex: 2 }}
				>
					<Text class="text-sm leading-5 text-muted-foreground">翻译结果</Text>
				</View>
			</View>
		</View>
	);
}

export function openTranslateWindow() {
	const window = Window.open(TranslateWindow, {
		id: "translate",
		// activate: true,
		// minimizable: true,
		// maximizable: true,
		frame: "none",
		transparent: true,
		backdrop: "none",
		workspaces: "all",
		defaultSize: { width: 480, height: 320 },
		minSize: { width: 480, height: 320 },
		sizeToContent: false,
		defaultPosition: "center",
		shadow: true,
	});
	window.focus();
	return window;
}
