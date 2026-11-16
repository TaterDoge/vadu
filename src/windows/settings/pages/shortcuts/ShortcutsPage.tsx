import {
	Image,
	Text,
	View,
	cleanup,
	effect,
	keymap,
	lifecycle,
	signal,
	token,
	type ViewRef,
} from "nsh";
import { Button, Switch } from "nsh/base";
import { Settings, type AppSettings, type SettingsReply } from "vadu/native";

import { Item } from "../../../../components/ui/Item";
import { Kbd, KbdGroup } from "../../../../components/ui/Kbd";
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
				resettable: false,
			},
			{
				id: "pin-translate",
				title: "浮窗内切换固定窗口",
				description: "在浮窗内切换图钉（固定窗口），仅浮窗聚焦时生效",
				icon: pinIcon,
				resettable: false,
			},
		],
	},
];

export function ShortcutsPage() {
	const settings = signal<AppSettings | null>(null);
	const recording = signal<string | null>(null);
	const message = signal("");
	const pending = signal(false);
	let captureKeys: string[] = [];
	let disposed = false;
	cleanup(() => { disposed = true; });

	async function apply(action: () => Promise<SettingsReply>) {
		if (pending() || disposed) return false;
		pending.set(true);
		try {
			const reply = await action();
			if (disposed) return false;
			if (reply.error || !reply.settings) {
				message.set(reply.error?.message ?? "未取得配置，未提交本次修改。");
				return false;
			}
			settings.set(reply.settings);
			return true;
		} catch {
			if (!disposed) message.set("无法访问配置，请稍后重试。");
			return false;
		} finally {
			if (!disposed) pending.set(false);
		}
	}

	void apply(async () => {
		captureKeys = await Settings.captureKeys();
		return Settings.read();
	});

	function cancel() {
		recording.set(null);
		message.set("");
	}

	async function save(id: string, keystroke: string) {
		if (await apply(() => Settings.setShortcut(id, keystroke))) {
			if (recording() === id) recording.set(null);
			message.set("快捷键已更新。系统快捷键注册尚未接线。");
		}
	}

	effect(() => {
		const id = recording();
		if (!id) return;

		const stopCapture = keymap.bind(
			Object.fromEntries(
				captureKeys.map((key) => [key, () => { void save(id, key); }]),
			),
			{ when: "always" },
		);
		const stopEscape = keymap.bind("escape", cancel, { when: "always" });
		const stopTab = keymap.bind(
			{ tab: cancel, "shift+tab": cancel },
			{ when: "always", passThrough: true },
		);
		return () => {
			stopCapture();
			stopEscape();
			stopTab();
		};
	});

	effect(() => {
		if (lifecycle() !== "active" && recording()) cancel();
	});

	return (
		<View testID="settings-shortcuts-page" class="gap-6">
			<Text class="text-(length:--text-xs) leading-5 text-muted-foreground">
				点击键帽录入，按 Esc / Tab 或移开焦点取消。配置自动保存，快捷键注册尚未接线。
			</Text>
			<If when={message()}>
				<Text
					testID="shortcut-message"
					role="alert"
					class="text-(length:--text-xs) leading-5 text-muted-foreground"
				>
					{message()}
				</Text>
			</If>
			<Each of={shortcutGroups}>
				{(group) => (
					<View class="gap-4">
						<Text
							role="header"
							accessibilityLevel={2}
							class="text-(length:--text-sm) font-semibold text-foreground"
						>
							{group().title}
						</Text>
						<Each of={group().items}>
							{(shortcut) => {
								let field: ViewRef | undefined;
								const isRecording = () => recording() === shortcut().id;
								const label = () => {
									const binding = settings()?.shortcuts.find(
										(item) => item.id === shortcut().id,
									);
									return binding ? keymap.label(binding.keystroke) : "不可用";
								};

								return (
									<Item
										testID={"shortcut-" + shortcut().id}
										title={shortcut().title}
										description={shortcut().description}
										media={
											<Image
												src={shortcut().icon}
												style={{ tintColor: token("foreground") }}
												class="h-5 w-5"
												accessibilityElementsHidden
												importantForAccessibility="no-hide-descendants"
											/>
										}
										actions={
											<>
												<KbdGroup
													ref={(node) => { field = node; }}
													testID={"shortcut-" + shortcut().id + "-input"}
													accessible
													role="button"
													disabled={!settings()}
													accessibilityLabel={
														shortcut().title + "快捷键 " +
														(isRecording() ? "正在录入，按 Esc 取消" : label())
													}
													accessibilityState={{ selected: isRecording() }}
													class="rounded-(--radius-lg) border border-transparent p-1 hover:bg-accent focus-visible:border-primary disabled:opacity-40"
													classList={{ "bg-accent border-primary": isRecording() }}
													onPress={() => {
														if (pending()) return;
														field?.focus();
														message.set("");
														recording.set(shortcut().id);
													}}
													onBlur={() => { if (isRecording()) cancel(); }}
												>
													<If
														when={isRecording()}
														else={
															<Each of={label().match(/[⌃⌥⇧⌘]|[^⌃⌥⇧⌘+]+/g) ?? []}>
																{(key) => <Kbd>{key()}</Kbd>}
															</Each>
														}
													>
														<Kbd>请按快捷键…</Kbd>
													</If>
												</KbdGroup>
												<If when={shortcut().resettable}>
													<Button
														disabled={!settings() || pending()}
														onPress={async () => {
															if (await apply(() => Settings.resetShortcut(shortcut().id))) {
																recording.set(null);
																message.set("快捷键已恢复默认。");
															}
														}}
														accessibilityLabel={
															"重置" + shortcut().title + "快捷键"
														}
														class="h-8 w-8 items-center justify-center rounded-(--radius-lg) disabled:opacity-40"
													>
														<Image
															src={resetIcon}
															style={{ tintColor: token("foreground") }}
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
													accessibilityLabel={
														"启用" + shortcut().title + "快捷键"
													}
													class="shrink-0 disabled:opacity-50"
													trackClass="w-9 rounded-full bg-input p-0.5"
													thumbClass="h-4 w-4 rounded-full bg-background"
												/>
											</>
										}
									/>
								);
							}}
						</Each>
					</View>
				)}
			</Each>
		</View>
	);
}
