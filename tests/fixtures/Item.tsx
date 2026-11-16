import { Text, View, mount, signal } from "nsh";
import { Button, Switch } from "nsh/base";

import { Item } from "../../src/components/ui/Item";

function ItemFixture() {
	const details = signal(true);
	const count = signal(0);
	const enabled = signal(false);

	// 插槽需真正变为 undefined，以验证 Item 自身容器的挂载与卸载，而非隐藏常驻 If 的子节点。
	return (
		<View class="flex-1 gap-4 p-4">
			<Item
				testID={details() ? "full-item" : "compact-item"}
				title={"提醒 " + count()}
				description={
					details() ? "这是一段较长的设置说明，在窄窗口中应换行显示，不能挤出操作区。" : undefined
				}
				media={details() ? <Text>图标</Text> : undefined}
				actions={
					details() ? (
						<>
							<Button
								testID="increment"
								onPress={() => count.update((value) => value + 1)}
								class="rounded-lg border border-neutral-200 p-2 focus-visible:border-neutral-500"
							>
								<Text>增加</Text>
							</Button>
							<Switch
								testID="toggle"
								accessibilityLabel="启用提醒"
								checked={enabled()}
								onChange={({ checked }) => enabled.set(checked)}
								class="rounded-lg border border-transparent p-1 focus-visible:border-neutral-500"
								trackClass="w-9 rounded-full bg-neutral-200 p-0.5 checked:bg-neutral-950"
								thumbClass="h-4 w-4 rounded-full bg-white checked:translate-x-4"
							/>
							<Button testID="disabled-action" disabled>
								<Text>不可用</Text>
							</Button>
						</>
					) : undefined
				}
			/>
			<Item testID="plain-item" title="无附加内容" />
			<Button
				testID="toggle-details"
				onPress={() => details.update((value) => !value)}
			>
				<Text>切换附加内容</Text>
			</Button>
			<Text>{enabled() ? "提醒已开启" : "提醒已关闭"}</Text>
		</View>
	);
}

mount(ItemFixture);
