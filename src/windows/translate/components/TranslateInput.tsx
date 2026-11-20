import { Clipboard, type InputRef, Text, View, signal } from "nsh";
import { Input } from "nsh/base";

import { IconButton } from "../../../components/IconButton";
import copyIcon from "../icons/copy.svg";
import eraserIcon from "../icons/eraser.svg";
import volumeIcon from "../icons/volume.svg";

export function TranslateInput(props: { inputRef: (node: InputRef) => void }) {
	let input: InputRef | undefined;
	const text = signal("");
	const copyFailed = signal(false);
	const hasText = () => text().trim().length > 0;
	const toolClass = () => (hasText() ? "hover:bg-foreground/5" : "opacity-40");

	async function copySource() {
		try {
			await Clipboard.writeText(text());
			copyFailed.set(false);
		} catch {
			copyFailed.set(true);
		}
	}

	function clearSource() {
		text.set("");
		copyFailed.set(false);
		input?.focus();
	}

	return (
		<View
			testID="translation-source-panel"
			class="min-h-0 overflow-hidden rounded-xl bg-muted p-1"
			style={{ flex: 3 }}
		>
			<Input
				ref={(node) => {
					input = node;
					props.inputRef(node);
				}}
				value={text()}
				onChange={({ value }) => text.set(value)}
				testID="translation-source-input"
				accessibilityLabel="原文"
				multiline
				placeholder="输入要翻译的文本…"
				autoFocus
				style={{ caretColor: "blue" }}
				class="min-h-0 flex-1 bg-transparent px-1 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground"
			/>
			<View class="h-6 shrink-0 flex-row items-center gap-1">
				<IconButton label="朗读原文" icon={volumeIcon} class={toolClass()} />
				<IconButton
					label="复制原文"
					icon={copyIcon}
					class={toolClass()}
					disabled={!hasText()}
					onPress={copySource}
				/>
				<View class="flex-1">
					<If when={copyFailed()}>
						<Text role="alert" class="text-xs text-destructive">
							复制原文失败
						</Text>
					</If>
				</View>
				<IconButton
					label="清空原文"
					icon={eraserIcon}
					class={toolClass()}
					disabled={!hasText()}
					onPress={clearSource}
				/>
			</View>
		</View>
	);
}
