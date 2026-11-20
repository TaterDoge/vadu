import { Image, type ImageAsset, token } from "nsh";
import { Button } from "nsh/base";

export function IconButton(props: {
	label: string;
	icon: ImageAsset;
	onPress?: () => void;
	disabled?: boolean;
	selected?: boolean;
	class?: string;
}) {
	return (
		<Button
			disabled={props.disabled || !props.onPress}
			selected={props.selected}
			onPress={props.onPress}
			accessibilityLabel={props.label}
			tooltip={props.onPress ? props.label : props.label + "（暂未实现）"}
			class={
				"h-6 hover:bg-muted w-6 items-center justify-center rounded-md selected:bg-accent focus-visible:border focus-visible:border-foreground " +
				(props.class ?? "")
			}
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
