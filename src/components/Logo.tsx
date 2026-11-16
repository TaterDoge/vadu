import { Text, View } from "nsh";

export function Logo() {
	return (
		<View class="flex-row items-center gap-3 px-5 pb-8 pt-10">
			<View
				class="h-8 w-8 items-center justify-center rounded-xl bg-neutral-900"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<Text class="text-lg font-bold text-white">v</Text>
			</View>
			<View>
				<Text class="text-base font-semibold text-neutral-950">vadu</Text>
				<Text class="text-xs text-neutral-500">管理面板</Text>
			</View>
		</View>
	);
}
