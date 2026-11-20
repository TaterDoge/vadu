import { Image, type ImageAsset, type InputRef, Text, View, token } from "nsh";
import { Button, Input } from "nsh/base";
import { Window, currentWindow } from "nsh/desktop";

import "../../theme";
import pinIcon from "../settings/pages/shortcuts/pin.svg";
import chevronDownIcon from "./icons/chevron-down.svg";
import copyIcon from "./icons/copy.svg";
import eraserIcon from "./icons/eraser.svg";
import layersIcon from "./icons/layers.svg";
import volumeIcon from "./icons/volume.svg";

function PlaceholderIconButton(props: { label: string; icon: ImageAsset }) {
	return (
		<Button
			disabled
			accessibilityLabel={props.label}
			tooltip={props.label + "（暂未实现）"}
			class="h-6 w-6 items-center justify-center rounded-md"
		>
			<Image
				src={props.icon}
				class="h-4 w-4"
				style={{ tintColor: token("foreground") }}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			/>
		</Button>
	);
}

export function TranslateWindow() {
	let inputRef: InputRef | undefined;
	const window = currentWindow();

	window.on("focusChange", ({ focused }) => {
		if (focused) {
			inputRef?.focus();
		} else {
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
				<PlaceholderIconButton label="固定窗口" icon={pinIcon} />
				<PlaceholderIconButton label="服务配置" icon={layersIcon} />
			</View>
			<View class="min-h-0 flex-1 gap-2 px-2 pb-4">
				<View
					testID="translation-source-panel"
					class="min-h-0 overflow-hidden rounded-xl bg-muted p-1"
					style={{ flex: 3 }}
				>
					<Input
						ref={inputRef}
						testID="translation-source-input"
						accessibilityLabel="原文"
						multiline
						placeholder="输入要翻译的文本…"
						autoFocus
						style={{ caretColor: "blue" }}
						class="min-h-0 flex-1 bg-transparent px-1 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground"
					/>
					<View class="h-6 shrink-0 flex-row items-center gap-1">
						<PlaceholderIconButton label="朗读原文" icon={volumeIcon} />
						<PlaceholderIconButton label="复制原文" icon={copyIcon} />
						<View class="flex-1" />
						<PlaceholderIconButton label="清空原文" icon={eraserIcon} />
					</View>
				</View>
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
		// level: "aboveDock",
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
