import { Image, Text, View } from "nsh";
import { Button, Switch } from "nsh/base";

import { Item } from "../../../../components/ui/Item";
import generalIcon from "../../icons/general.svg";
import shortcutsIcon from "../../icons/shortcuts.svg";
import pinIcon from "./pin.svg";
import resetIcon from "./reset.svg";

const shortcutGroups = [
	{
		title: "全局快捷键",
		items: [
			{
				id: "toggle-translate",
				title: "唤起 / 隐藏翻译浮窗",
				description: "按一次唤起并聚焦翻译窗口，再按一次隐藏到后台",
				icon: shortcutsIcon,
				keys: ["⌘", "⇧", "M"],
				keyLabel: "Command + Shift + M",
				resettable: true,
			},
		],
	},
	{
		title: "局内快捷键",
		items: [
			{
				id: "open-settings",
				title: "浮窗内打开设置",
				description: "在翻译浮窗内打开设置页面，仅浮窗聚焦时生效",
				icon: generalIcon,
				keys: ["⌘", ","],
				keyLabel: "Command + 逗号",
				resettable: false,
			},
			{
				id: "pin-translate",
				title: "浮窗内切换固定窗口",
				description: "在浮窗内切换图钉（固定窗口），仅浮窗聚焦时生效",
				icon: pinIcon,
				keys: ["⌘", "P"],
				keyLabel: "Command + P",
				resettable: false,
			},
		],
	},
];

export function ShortcutsPage() {
	return (
		<View testID="settings-shortcuts-page" class="gap-6">
			<Text class="text-xs leading-5 text-neutral-500">
				快捷键录入、保存与注册尚未迁移，以下仅为 macOS 默认快捷键预览。
			</Text>
			<Each of={shortcutGroups}>
				{(group) => (
					<View class="gap-4">
						<Text
							role="header"
							accessibilityLevel={2}
							class="text-sm font-semibold text-neutral-950"
						>
							{group().title}
						</Text>
						<Each of={group().items}>
							{(shortcut) => (
								<Item
									testID={"shortcut-" + shortcut().id}
									title={shortcut().title}
									description={shortcut().description}
									media={
										<Image
											src={shortcut().icon}
											class="h-5 w-5"
											accessibilityElementsHidden
											importantForAccessibility="no-hide-descendants"
										/>
									}
									actions={
										<>
											<View
												accessible
												accessibilityLabel={"默认快捷键 " + shortcut().keyLabel}
												class="flex-row gap-1"
											>
												<Each of={shortcut().keys}>
													{(key) => (
														<View class="h-7 min-w-7 items-center justify-center rounded-lg bg-neutral-100 px-2">
															<Text class="text-xs font-medium text-neutral-500">
																{key()}
															</Text>
														</View>
													)}
												</Each>
											</View>
											<If when={shortcut().resettable}>
												<Button
													disabled
													accessibilityLabel={"重置" + shortcut().title + "快捷键"}
													class="h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
												>
													<Image
														src={resetIcon}
														class="h-5 w-5"
														accessibilityElementsHidden
														importantForAccessibility="no-hide-descendants"
													/>
												</Button>
											</If>
											<Switch
												testID={"shortcut-" + shortcut().id + "-enabled"}
												checked={false}
												disabled
												accessibilityLabel={"启用" + shortcut().title + "快捷键"}
												class="shrink-0 disabled:opacity-50"
												trackClass="w-9 rounded-full bg-neutral-200 p-0.5"
												thumbClass="h-4 w-4 rounded-full bg-white"
											/>
										</>
									}
								/>
							)}
						</Each>
					</View>
				)}
			</Each>
		</View>
	);
}
