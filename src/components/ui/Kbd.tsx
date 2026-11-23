import { split, Text, token, View, type ViewProps } from 'nsh';

export function Kbd(props: ViewProps) {
  const [own, rest] = split(props, ['children', 'class']);

  // 高度与最小宽度定死，单键才是方帽；只靠 padding 撑高会变成又窄又高的胶囊。
  return (
    <View
      {...rest}
      class={
        'pointer-events-none h-7 w-fit min-w-7 shrink-0 flex-row items-center justify-center rounded-md bg-muted p-1 select-none ' +
        (own.class ?? '')
      }
    >
      {/* 快捷键符号独立选字体，避免跟随等宽字体时缺字。 */}
      <Text
        class="text-xs leading-5 font-medium text-muted-foreground"
        style={{ fontFamily: token('font-key') }}
      >
        {own.children}
      </Text>
    </View>
  );
}

export function KbdGroup(props: ViewProps) {
  const [own, rest] = split(props, ['children', 'class']);

  return (
    <View
      {...rest}
      class={'w-fit flex-row items-center gap-1 ' + (own.class ?? '')}
    >
      {own.children}
    </View>
  );
}
