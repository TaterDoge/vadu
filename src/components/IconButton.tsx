import { Button } from 'nsh/base';
import type { IconData } from 'supernsh-icons';

import { buttonFrameClass } from './ui/buttonStyles';
import { Icon } from './ui/Icon';

export function IconButton(props: {
  label: string;
  icon: IconData;
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
      tooltip={props.onPress ? props.label : props.label + '（暂未实现）'}
      class={`${buttonFrameClass} selected:bg-accent h-6 w-6 items-center justify-center rounded-md border-transparent hover:bg-muted ${props.class ?? ''}`}
    >
      <Icon icon={props.icon} />
    </Button>
  );
}
