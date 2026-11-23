import { type JSX, split, Text, View, type ViewProps } from 'nsh';

export type ItemProps = Omit<ViewProps, 'children'> & {
  title: string;
  description?: string;
  media?: JSX.Element;
  actions?: JSX.Element;
};

export function Item(props: ItemProps) {
  const [own, rest] = split(props, [
    'title',
    'description',
    'media',
    'actions',
    'class',
  ]);

  return (
    <View
      {...rest}
      class={
        'flex-row flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 ' +
        (own.class ?? '')
      }
    >
      <View class="min-w-0 shrink grow basis-64 flex-row items-start gap-3">
        <If when={own.media}>
          <View class="shrink-0 pt-0.5">{own.media}</View>
        </If>
        <View class="min-w-0 flex-1 gap-1">
          <Text class="text-sm leading-5 font-semibold text-card-foreground">
            {own.title}
          </Text>
          <If when={own.description}>
            <Text class="text-xs leading-5 text-muted-foreground">
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
