import { Image, Scroll, Text, View, token } from "nsh";
import { MenuItem, NavPage, NavStack, createNavStack } from "nsh/base";

import { Logo } from "../../components/Logo";
import { iconHoverMotion } from "../../components/ui/motion";
import appearanceIcon from "./icons/appearance.svg";
import backupIcon from "./icons/backup.svg";
import generalIcon from "./icons/general.svg";
import providersIcon from "./icons/providers.svg";
import shortcutsIcon from "./icons/shortcuts.svg";
import { AppearancePage } from "./pages/appearance/AppearancePage";
import { BackupPage } from "./pages/backup/BackupPage";
import { GeneralPage } from "./pages/general/GeneralPage";
import { ProvidersPage } from "./pages/providers/ProvidersPage";
import { ShortcutsPage } from "./pages/shortcuts/ShortcutsPage";

const settingsPages = [
	{
		id: "general",
		label: "通用",
		icon: generalIcon,
		render: () => <GeneralPage />,
	},
	{
		id: "providers",
		label: "服务商",
		icon: providersIcon,
		render: () => <ProvidersPage />,
	},
	{
		id: "appearance",
		label: "外观",
		icon: appearanceIcon,
		render: () => <AppearancePage />,
	},
	{
		id: "shortcuts",
		label: "快捷键",
		icon: shortcutsIcon,
		render: () => <ShortcutsPage />,
	},
	{
		id: "backup",
		label: "备份恢复",
		icon: backupIcon,
		render: () => <BackupPage />,
	},
] as const;

type SettingsRoute = (typeof settingsPages)[number];

export function SettingsWindow() {
	const nav = createNavStack<SettingsRoute>([settingsPages[0]]);
	const activeNav = () => nav.routes()[nav.routes().length - 1];

	return (
		<View
			testID="settings-center"
			role="region"
			accessibilityLabel="设置中心"
			class="flex-1 flex-row bg-background text-foreground"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				paddingRight: "env(safe-area-inset-right)",
				paddingBottom: "env(safe-area-inset-bottom)",
				paddingLeft: "env(safe-area-inset-left)",
			}}
		>
			<View
				testID="settings-sidebar"
				class="w-48 shrink-0 border-r border-sidebar-border bg-sidebar md:w-60"
				desktop={{ windowDrag: true }}
			>
				<Logo />

				<View
					role="navigation"
					accessibilityLabel="设置分类"
					class="gap-1 px-2 pb-4"
				>
					<Each of={settingsPages}>
						{(page) => {
							const iconMotion = iconHoverMotion();
							return (
								<View onMouseEnter={() => void iconMotion.play()}>
									<MenuItem
										testID={`settings-${page().id}`}
										role="link"
										accessibilityLabel={page().label}
										onSelect={() => {
											if (activeNav().id !== page().id) nav.replace(page());
										}}
										class="h-11 flex-row items-center gap-3 rounded-xl border border-transparent px-3 hover:bg-sidebar-accent focus-visible:border-sidebar-foreground"
										classList={{
											"bg-sidebar-accent": activeNav().id === page().id,
										}}
									>
										<Image
											style={{
												...iconMotion.style,
												tintColor: token("sidebar-foreground"),
											}}
											src={page().icon}
											class="h-5 w-5 shrink-0"
											accessibilityElementsHidden
											importantForAccessibility="no-hide-descendants"
										/>
										<Text
											class="text-sm text-sidebar-foreground"
											classList={{
												"font-semibold": activeNav().id === page().id,
											}}
										>
											{page().label}
										</Text>
									</MenuItem>
								</View>
							);
						}}
					</Each>
				</View>
			</View>
			<View class="min-w-0 flex-1 p-4">
				<NavStack state={nav} testID="settings-router" class="min-w-0 flex-1">
					{(page) => (
						<NavPage
							title={page.label}
							headerVisible={false}
							animation="default"
						>
							<Scroll class="flex-1 rounded-xl border border-border bg-background">
								<View
									testID="settings-content"
									role="region"
									accessibilityLabel={page.label}
									class="p-6"
								>
									{page.render()}
								</View>
							</Scroll>
						</NavPage>
					)}
				</NavStack>
			</View>
		</View>
	);
}
