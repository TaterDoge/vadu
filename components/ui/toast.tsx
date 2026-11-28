// A toast: the look (`toastLook` and its companions) at the top, and the `Toast` that wears it below.
// Derived from NSH examples/nsh-gallery-ui (Apache-2.0, © Longbridge); modified. See NOTICE.

import {
  CircleCheck,
  CircleX,
  type IconNode,
  Info,
  TriangleAlert,
  X,
} from 'lucide';
import type { JSX, TextStyle, ViewStyle } from 'nsh';
import { Overlay, platform, safeArea, signal, split, Text, View } from 'nsh';
import {
  Toast as BaseToast,
  type ToastEntry,
  ToastManager,
  type ToastProps as BaseToastProps,
  ToastStack,
} from 'nsh/base';

import { Icon } from '../../lib/ui/icons';
import { pressSink, pressTransition } from '../../lib/ui/motion';
import {
  alpha,
  colors,
  control,
  feedback,
  font,
  rounded,
  shape,
  surface,
  surfaceBorderWidth,
  terminal,
} from '../../lib/ui/theme';
import {
  Button,
  buttonLabel,
  buttonLook,
  type ButtonLookOptions,
} from './button';
import { Spinner } from './spinner';

const pointer = platform.desktop;

/**
 * A toast (`nsh/base`'s `Toast`'s `style`): a row 12 points apart on the inverse surface
 * (`surface("inverse")`), the theme's `popup.corner`, edge width following the surface's border (zero
 * where transparent), 12 by 14 points of padding. Its title takes `toastTitle`,
 * its description `toastText`.
 */
export function toastLook(): ViewStyle {
  const inverse = surface('inverse').style;
  const edge = inverse.borderColor;
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...rounded(control('popup').corner),
    borderWidth: surfaceBorderWidth(
      typeof edge === 'string' ? edge : undefined,
    ),
    ...inverse,
  };
}

/** A toast's title: 14 points semibold. */
export function toastTitle(): TextStyle {
  // No type role has this size: a toast's title is 14 in both tiers.
  return {
    fontSize: 14,
    fontWeight: font.weight('title'),
    color: surface('inverse').ink,
  };
}

/** A toast's description: 13 points in the inverse surface's ink, its figures tabular. */
export function toastText(): TextStyle {
  // No type role has this size: a toast's description is 13 in both tiers.
  return {
    fontSize: 13,
    color: surface('inverse').ink,
    fontVariant: ['tabular-nums'],
  };
}

/**
 * The size of a toast's action: 28 points tall with a pointer, 10 points of padding at its sides;
 * `small` on a touch screen (36, a hit slop making 44), so the toast stays a compact row.
 */
const toastActionSize: ButtonLookOptions = pointer
  ? { style: { paddingHorizontal: 10 } }
  : { size: 'sm' };

/**
 * A toast's action (an Undo, a Retry), spread on a `Button` or a pressable view: the theme's
 * primary button, its fill and ink from `control("button")`. Its label takes `toastActionLabel`.
 */
export function toastActionLook() {
  return buttonLook('default', toastActionSize);
}

/** The label of a `toastActionLook` (`buttonLabel("default")`). */
export function toastActionLabel(): TextStyle {
  const label = buttonLabel('default', toastActionSize);
  return {
    get color() {
      return control('button').selected.ink;
    },
    get fontSize() {
      return label.fontSize;
    },
    get fontWeight() {
      return label.fontWeight;
    },
  };
}

/** A toast's close button (its cross): a circle 24 points across (the theme's
 * `radius-container` corners, half its side in the NSH Gallery theme), bare until the
 * pointer is over it, sinking to 90% while pressed (none with reduced
 * motion); keyboard focus `feedback.focusRing()`. */
export function toastCloseLook() {
  return {
    style: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      ...rounded(shape.container),
      ...pressTransition('background-color'),
    } as ViewStyle,
    get hoverStyle(): ViewStyle {
      return feedback.hoverStyle('foreground');
    },
    get activeStyle(): ViewStyle {
      return {
        ...(feedback.pressOverlay > 0
          ? feedback.press('surface', { ink: 'foreground' }).activeStyle
          : { backgroundColor: alpha(surface('inverse').ink, 0.1) }),
        ...pressSink(0.9).activeStyle,
      };
    },
    get focusVisibleStyle(): ViewStyle {
      return feedback.focusRing();
    },
  };
}

/**
 * `nsh/base`'s Toast in the look of `toastLook`. Every base prop passes through; `style` goes
 * over the look's. Without `children`, it draws `title` and `description` in `toastTitle` and
 * `toastText`; with them, the children are drawn as given.
 */
export type ToastProps = Omit<BaseToastProps, 'children'> & {
  /** Convenience title when `children` is omitted. */
  title?: string;
  /** Convenience description when `children` is omitted. */
  description?: string;
  children?: JSX.Element;
};

/** The column that holds `title` and `description`: it takes the row's room and may shrink. */
const toastTextColumn: ViewStyle = { flex: 1, gap: 2, minWidth: 0 };

/** A toast banner. */
export function Toast(props: ToastProps) {
  const [, rest] = split(props, ['title', 'description', 'children', 'style']);
  return (
    <BaseToast
      {...surface('inverse').platformProps}
      {...rest}
      style={[toastLook(), props.style ?? null]}
    >
      {props.children ?? (
        <View style={toastTextColumn}>
          {props.title ? <Text style={toastTitle()}>{props.title}</Text> : null}
          {props.description ? (
            <Text style={toastText()}>{props.description}</Text>
          ) : null}
        </View>
      )}
    </BaseToast>
  );
}

/** What a toast is about. Sonner's names: `success`, `error`, `warning`, `info`, `loading`. */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

/** A button on a toast. `label` is what `onDismiss` hears when this button closes it. */
export interface ToastAction {
  label: string;
  onClick?: () => void;
}

/**
 * What `toast` takes, after sonner: an id to replace, a description, how long it stays
 * (`Infinity` until dismissed), a type, an action, a close button. `progress` is the bar under
 * the text (0 to 1); sonner has no progress, and the upload scene needs one.
 */
export interface ToastOptions {
  id?: string;
  description?: string;
  /** Milliseconds it stays. Omitted is 4000, sonner's default. `Infinity` stays until dismissed. */
  duration?: number;
  type?: ToastType;
  action?: ToastAction;
  /** `true` is a close button labelled "Close"; a string is that button's accessible label. */
  closeButton?: boolean | string;
  /** A bar under the text, 0 to 1. `null` clears it. */
  progress?: number | null;
  /** Called once the toast is gone. The action's label when that closed it, otherwise `null`. */
  onDismiss?: (reason: string | null) => void;
}

/** A change `toast.update` applies in place. `null` clears `description`, `action` or `progress`. */
export type ToastUpdate = {
  title?: string;
  description?: string | null;
  type?: ToastType;
  action?: ToastAction | null;
  closeButton?: boolean | string;
  progress?: number | null;
  duration?: number;
};

/** One moment of the queue, for a log. `expanded` is the stack opening or closing. */
export interface ToastEvent {
  phase: 'push' | 'presented' | 'ending' | 'removed' | 'expanded';
  id?: string;
  expanded?: boolean;
}

/** What one toast shows. The manager holds the id; this holds the words. */
interface ToastRecord {
  title: string;
  description?: string;
  type?: ToastType;
  action?: ToastAction;
  closeButton?: boolean | string;
  progress?: number;
  onDismiss?: (reason: string | null) => void;
}

const kinds: Record<
  Exclude<ToastType, 'loading'>,
  { icon: IconNode; tint: () => string }
> = {
  success: { icon: CircleCheck, tint: () => colors.success },
  error: { icon: CircleX, tint: () => colors.destructive },
  warning: { icon: TriangleAlert, tint: () => colors.warning },
  info: { icon: Info, tint: () => colors.info },
};

/** How many show at once, and how often the lifecycle advances. */
const LIMIT = 3;
const TICK = 50;
/** Sonner's default: four seconds, then it leaves. */
const DEFAULT_DURATION = 4000;

/**
 * The toasts there are: one store per process, as sonner's one `Toaster` — an app mounts `Toaster`
 * once, and a second one would show the same toasts rather than its own.
 */
const manager = new ToastManager(terminal ? { exitDuration: 0 } : undefined);
const shown = signal<ToastEntry[]>([]);
const expanded = signal(false);
const records = signal<Record<string, ToastRecord>>({});
const reasons = new Map<string, string>();
/** Time left for a toast whose duration changed after it was pushed. The manager keeps the
 * timeout from the push, so a new finite duration counts here. A finite timeout from the push
 * itself is not cleared. */
const lingering = new Map<string, number>();
const listeners = new Set<(event: ToastEvent) => void>();
let ticking: ReturnType<typeof setInterval> | undefined;
let count = 0;

function emit(event: ToastEvent) {
  for (const listener of listeners) listener(event);
}

function sync() {
  shown.set(manager.visible(LIMIT));
}

function tick() {
  if (!expanded()) {
    for (const [id, left] of lingering) {
      if (left - TICK > 0) lingering.set(id, left - TICK);
      else {
        lingering.delete(id);
        manager.dismiss(id);
      }
    }
  }
  const advanced = manager.advance(expanded());
  for (const id of advanced.presented) emit({ phase: 'presented', id });
  for (const id of advanced.ending) emit({ phase: 'ending', id });
  for (const gone of advanced.removed) {
    const reason = reasons.get(gone.id) ?? null;
    const record = records()[gone.id];
    reasons.delete(gone.id);
    lingering.delete(gone.id);
    const { [gone.id]: _dropped, ...rest } = records();
    records.set(rest);
    record?.onDismiss?.(reason);
    emit({ phase: 'removed', id: gone.id });
  }
  if (advanced.changed) sync();
  if (manager.isEmpty() && ticking !== undefined) {
    clearInterval(ticking);
    ticking = undefined;
  }
}

function run() {
  sync();
  ticking ??= setInterval(tick, TICK);
}

function timeoutOf(duration: number | undefined): number | undefined {
  const value = duration ?? DEFAULT_DURATION;
  return Number.isFinite(value) ? value : undefined;
}

function remember(id: string, record: ToastRecord) {
  records.set({ ...records(), [id]: record });
}

/** Hears every push, present, end, removal and expand. Returns the unsubscribe. */
export function onToastEvent(
  listener: (event: ToastEvent) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function raise(title: string, options?: ToastOptions): string {
  const id = options?.id ?? `toast-${++count}`;
  const previous = records()[id];
  if (previous) {
    reasons.delete(id);
    lingering.delete(id);
    previous.onDismiss?.(null);
  }
  if (terminal)
    for (const entry of shown()) if (entry.id !== id) manager.dismiss(entry.id);
  const record: ToastRecord = { title, onDismiss: options?.onDismiss };
  if (options?.description) record.description = options.description;
  if (options?.type) record.type = options.type;
  if (options?.action) record.action = options.action;
  if (options?.closeButton) record.closeButton = options.closeButton;
  if (typeof options?.progress === 'number') record.progress = options.progress;
  remember(id, record);
  manager.push(id, id, { timeout: timeoutOf(options?.duration) });
  emit({ phase: 'push', id });
  run();
  return id;
}

/**
 * Shows a toast and returns its id (`toast-1`, `toast-2`, …, or `options.id`). The same id
 * replaces the toast that held it. `toast.success` and the other types set `type`.
 */
export function toast(title: string, options?: ToastOptions): string {
  return raise(title, options);
}

toast.success = (title: string, options?: ToastOptions) =>
  raise(title, { ...options, type: 'success' });
toast.error = (title: string, options?: ToastOptions) =>
  raise(title, { ...options, type: 'error' });
toast.warning = (title: string, options?: ToastOptions) =>
  raise(title, { ...options, type: 'warning' });
toast.info = (title: string, options?: ToastOptions) =>
  raise(title, { ...options, type: 'info' });
toast.loading = (title: string, options?: ToastOptions) =>
  raise(title, { ...options, type: 'loading' });

/**
 * Changes the toast `id` where it is, without showing it again (a loading note becoming its
 * result, a bar moving). A finite `duration` starts a new wait beside the one the push set.
 * False when no such toast is showing.
 */
toast.update = (id: string, change: ToastUpdate): boolean => {
  const record = records()[id];
  if (!record) return false;
  const next: ToastRecord = { ...record };
  if (change.title !== undefined) next.title = change.title;
  if ('description' in change) {
    if (change.description) next.description = change.description;
    else delete next.description;
  }
  if ('type' in change) next.type = change.type;
  if ('action' in change) {
    if (change.action) next.action = change.action;
    else delete next.action;
  }
  if ('closeButton' in change) next.closeButton = change.closeButton;
  if ('progress' in change) {
    if (change.progress === null || change.progress === undefined)
      delete next.progress;
    else next.progress = change.progress;
  }
  remember(id, next);
  if (change.duration !== undefined) {
    if (Number.isFinite(change.duration)) lingering.set(id, change.duration);
    else lingering.delete(id);
  }
  return true;
};

/** Closes the toast `id`, or every toast when `id` is omitted. */
toast.dismiss = (id?: string) => {
  if (id === undefined) manager.dismissAll();
  else manager.dismiss(id);
  run();
};

function choose(id: string, label: string) {
  records()[id]?.action?.onClick?.();
  reasons.set(id, label);
  toast.dismiss(id);
}

function closeLabel(value: boolean | string | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : 'Close';
}

/** The mark of a type: a spinner while loading, a lucide glyph otherwise. */
function KindMark(props: { type: ToastType }) {
  if (props.type === 'loading')
    return <Spinner side={18} tint={surface('inverse').ink} />;
  const spec = kinds[props.type];
  return <Icon icon={spec.icon} size={18} tint={spec.tint()} />;
}

/** One toast in the stack. */
function ToastItem(props: { entry: ToastEntry }) {
  const record = (): ToastRecord => records()[props.entry.id] ?? { title: '' };
  const type = () => record().type;
  const progress = () => record().progress;
  const action = () => record().action;
  const close = () => closeLabel(record().closeButton);
  return (
    <Toast
      testID={props.entry.id}
      transitionStatus={props.entry.status}
      accessibilityLabel={[record().title, record().description]
        .filter(Boolean)
        .join('. ')}
      onDismissRequest={() => toast.dismiss(props.entry.id)}
      class="transition-all duration-200 ease-out"
      startingClass="opacity-0 translate-y-4"
      endingClass="opacity-0 scale-95"
      swipingClass="transition-none"
    >
      <If when={type()}>
        <KindMark type={type()!} />
      </If>
      <View style={toastTextColumn}>
        <Text style={toastTitle()}>{record().title}</Text>
        <If when={record().description}>
          <Text style={toastText()}>{record().description}</Text>
        </If>
        <If when={progress() !== undefined}>
          <View
            style={{
              height: 4,
              marginTop: 6,
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: control('progress').grooveColor,
            }}
          >
            <View
              // The fill's side follows the reading direction: `scaleX` turns about the bar's
              // reading start, the left edge left to right.
              class="origin-left rtl:origin-right"
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor:
                  type() === 'success' ? colors.success : colors.primary,
                transform: [
                  { scaleX: Math.max(0, Math.min(1, progress() ?? 0)) },
                ],
              }}
            />
          </View>
        </If>
      </View>
      <If when={action()}>
        <Button
          {...toastActionLook()}
          onPress={() => choose(props.entry.id, action()!.label)}
          accessibilityLabel={action()!.label}
        >
          <Text style={toastActionLabel()}>{action()!.label}</Text>
        </Button>
      </If>
      <If when={close()}>
        <View
          role="button"
          accessibilityLabel={close()}
          onPress={() => toast.dismiss(props.entry.id)}
          {...toastCloseLook()}
        >
          <Icon icon={X} size={14} tint={surface('inverse').ink} />
        </View>
      </If>
    </Toast>
  );
}

/** Where the toasts show: the top of the window, centered. */
export function Toaster(props: { closeOnEscape?: boolean }) {
  const newest = () =>
    shown()
      .filter((entry) => entry.status !== 'ending')
      .at(-1);
  if (terminal) {
    return (
      <ToastStack
        closeOnEscape={props.closeOnEscape}
        onCancel={() => {
          const id = newest()?.id;
          if (id) toast.dismiss(id);
        }}
      >
        <Each of={shown()} key={(entry) => entry.id}>
          {(entry) => <ToastItem entry={entry()} />}
        </Each>
      </ToastStack>
    );
  }
  return (
    <Overlay
      style={{
        pointerEvents: 'box-none',
        left: 0,
        right: 0,
        top: 0,
        padding: 16,
        paddingTop: safeArea().top + 16,
        alignItems: 'center',
      }}
    >
      <ToastStack
        closeOnEscape={props.closeOnEscape}
        placement="topCenter"
        style={{ width: 340, maxWidth: '100%' }}
        onExpandedChange={({ expanded: open }) => {
          expanded.set(open);
          emit({ phase: 'expanded', expanded: open });
        }}
        onCancel={() => {
          const id = newest()?.id;
          if (id) toast.dismiss(id);
        }}
      >
        <Each of={shown()} key={(entry) => entry.id}>
          {(entry) => <ToastItem entry={entry()} />}
        </Each>
      </ToastStack>
    </Overlay>
  );
}
