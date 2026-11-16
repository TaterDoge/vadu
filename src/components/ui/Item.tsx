import { type JSX, type ViewProps, Text, View, split } from "nsh";

export type ItemProps = Omit<ViewProps, "children"> & {
	title: string;
	description?: string;
	media?: JSX.Element;
	actions?: JSX.Element;
};

export function Item(props: ItemProps) {
	const [own, rest] = split(props, [
		"title",
		"description",
		"media",
		"actions",
		"class",
	]);

	return (
		<View
			{...rest}
			class={
				"flex-row flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 " +
				(own.class ?? "")
			}
		>
			<View class="min-w-0 grow shrink basis-64 flex-row items-start gap-3">
				<If when={own.media}>
					<View class="shrink-0 pt-0.5">{own.media}</View>
				</If>
				<View class="min-w-0 flex-1 gap-1">
					<Text class="text-sm font-semibold leading-5 text-neutral-950">
						{own.title}
					</Text>
					<If when={own.description}>
						<Text class="text-xs leading-5 text-neutral-500">
							{own.description}
						</Text>
					</If>
				</View>
			</View>
			<If when={own.actions}>
				<View class="ml-auto max-w-full shrink-0 flex-row flex-wrap items-center justify-end gap-3">
					{own.actions}
				</View>
			</If>
		</View>
	);
}
