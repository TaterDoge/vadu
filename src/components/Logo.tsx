import { Text, View } from "nsh";

export function Logo() {
	return (
		<View class="flex-row items-center gap-3 px-5 pb-8 pt-10">
			<View
				class="h-8 w-8 items-center justify-center rounded-(--radius-xl) bg-sidebar-primary"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<Text class="text-lg font-bold text-sidebar-primary-foreground">v</Text>
			</View>
			<View>
				<Text class="text-(length:--text-base) font-semibold text-sidebar-foreground">
					vadu
				</Text>
				<Text class="text-(length:--text-xs) text-muted-foreground">
					管理面板
				</Text>
			</View>
		</View>
	);
}
