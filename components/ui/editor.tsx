// Editor: `editorClasses`, `editorFrame`, the `Editor` that wears them and the `EditorFindBar`
// that finds in it.

import { ArrowDown, ArrowUp, Replace, ReplaceAll, X } from 'lucide';
import {
  cleanup,
  type InputRef,
  signal,
  split,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'nsh';
import {
  Editor as BaseEditor,
  type EditorClasses,
  type EditorProps as BaseEditorProps,
  type EditorRef,
  type EditorSearch,
  type EditorSearchResult,
} from 'nsh/base';

import { mergeClasses } from '../../lib/ui/class-names';
import { Icon } from '../../lib/ui/icons';
import {
  fieldCorners,
  fieldEdgeWidths,
  fieldRestEdge,
} from '../../lib/ui/indicator';
import { fieldLook } from '../../lib/ui/look';
import { popupSurface } from '../../lib/ui/popup';
import { colors, control, finish, platformMaterial } from '../../lib/ui/theme';
import { buttonGlyph } from './button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './input-group';
import { Toggle } from './toggle';

/**
 * An editor's parts, as classes: line numbers and fold markers muted, the lines with a caret
 * and their numbers in the text color, the caret's line a faint `muted` band behind the text,
 * selected text a tint of the brand, the carets and the indent guides in the text and border
 * colors, the placeholder muted, search matches in the warning tone (the one on the selection
 * stronger), and diagnostics underlined in the theme's semantic colors — `destructive` for an
 * error, `warn` for a warning, `info` for information, `muted-foreground` for a hint.
 */
export const editorClasses: EditorClasses = {
  gutter: 'bg-muted/40',
  lineNumber: 'text-muted-foreground',
  activeLineNumber: 'text-foreground',
  foldMarker: 'text-muted-foreground',
  activeLine: 'bg-muted/50',
  selection: 'bg-brand/25',
  caret: 'bg-foreground',
  composition: 'text-foreground',
  searchMatch: 'bg-warn/25',
  currentSearchMatch: 'bg-warn/40',
  matchingBracket: 'border-border',
  indentGuide: 'bg-border',
  placeholder: 'text-muted-foreground',
  diagnosticError: 'text-destructive',
  diagnosticWarning: 'text-warn',
  diagnosticInfo: 'text-info',
  diagnosticHint: 'text-muted-foreground',
  unnecessaryText: 'text-muted-foreground',
  deprecatedText: 'text-muted-foreground',
  whitespace: 'text-muted-foreground/60',
  ruler: 'bg-border',
};

/**
 * The surface the editor sits on (its `style`): the field's well — the field color, a hairline
 * of the field's edge, the control tier's corners and the finish a field has — the same well a text
 * field has, so a file and a value look like the two kinds of field they are. Read where it is
 * used, so it follows the appearance and the theme; an app's `style` goes over it.
 */
export function editorFrame(): ViewStyle {
  const field = fieldLook(control().field);
  return {
    backgroundColor: colors.field,
    ...fieldEdgeWidths(field),
    ...fieldRestEdge(field),
    ...fieldCorners(field),
    ...finish.inset,
  };
}

/**
 * Every prop of `nsh/base` Editor: the text model, the highlighting, the editing keys, folding,
 * search and diagnostics stay in base.
 */
export type EditorProps = BaseEditorProps;

/**
 * An editor on the field's well. Pass `language` for the highlighting and the editing rules
 * (`"typescript"`, `"json"`, `"css"`, or an extension or file name), `value` and `onChange` to
 * control the text, `diagnostics` to mark problems; `classes` and `styles` paint its parts over
 * `editorClasses`, and `style` goes over `editorFrame()`. It fills the box the app gives
 * it and scrolls its rows inside.
 */
export function Editor(props: EditorProps) {
  const [, rest] = split(props, ['class', 'style', 'classes', 'styles']);
  return (
    <BaseEditor
      {...rest}
      class={props.class}
      style={[editorFrame(), props.style ?? null]}
      classes={mergeClasses(editorClasses, props.classes)}
      styles={props.styles}
    />
  );
}

/** How long the bar says what Replace all replaced, in milliseconds. */
const REPLACED_FOR = 2000;

/**
 * What the bar says about the search: which match of how many the selection is on, that there are
 * none, or that the query is not a regular expression; nothing while the query is empty.
 */
function matchLabel(
  search: EditorSearch,
  result: EditorSearchResult | null | undefined,
): string {
  if (!search.query) return '';
  if (result?.error) return 'Invalid pattern';
  const count = result?.count ?? 0;
  if (count === 0) return 'No results';
  const current = result?.current;
  return current === undefined || current === null
    ? `${count} matches`
    : `${current + 1} of ${count}`;
}

/**
 * A find bar's props: the editor it finds in, the search it edits, what the editor found, and what
 * the bar's close button does. The app shows the bar while the keys in it are the ones it wants
 * (a `View` around it, or an `Overlay` anchored to the editor), so nothing here says whether it is
 * open.
 */
export type EditorFindBarProps = {
  /** The editor to find in: the `ref` a `Editor` hands the app. */
  editor?: EditorRef | null;
  /**
   * What to find — the same search the app hands the editor's `search`, so the bar writes the
   * query and the three modes the editor matches by; the empty search while nothing is found.
   */
  search?: EditorSearch | null;
  /**
   * A change to the search (a typed query, a mode switched): set it back on the editor's `search`.
   * Every other field of `search` (the scope of an editor's find in selection) goes back as it
   * came.
   */
  onSearchChange?: (search: EditorSearch) => void;
  /** What the editor found (its `onSearchChange`), for the count: how many matches, and which one. */
  result?: EditorSearchResult | null;
  /** The close button was pressed: hide the bar (the app's `keymap` closes it on Escape too). */
  onClose?: () => void;
  /** The bar's own classes, after `popupSurface`'s. */
  class?: string;
  /** Over the bar's look: its width, and where it sits. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The find bar of an editor: the query with its count, its three matching modes and the two
 * buttons that step through the matches, and a line that replaces: a replacement, one match, or
 * all of them, its count shown in the place of the search's for a moment. Escape, and the keys
 * that open the bar, are the app's `keymap`; Return in the query finds the next match.
 */
export function EditorFindBar(props: EditorFindBarProps) {
  const [, rest] = split(props, [
    'class',
    'style',
    'editor',
    'search',
    'onSearchChange',
    'result',
    'onClose',
  ]);
  const replacement = signal('');
  const replaced = signal<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  cleanup(() => clearTimeout(timer));
  // The search as it is now: the app's, or the empty one while nothing is searched for.
  const search = () => props.search ?? { query: '' };
  const set = (change: Partial<EditorSearch>) =>
    props.onSearchChange?.({ ...search(), ...change });
  const replace = () => props.editor?.replace(replacement());
  const replaceAll = () => {
    void props.editor?.replaceAll(replacement()).then(({ count }) => {
      replaced.set(count);
      clearTimeout(timer);
      timer = setTimeout(() => replaced.set(null), REPLACED_FOR);
    });
  };
  const count = () => {
    const replaces = replaced();
    return replaces === null
      ? matchLabel(search(), props.result)
      : `Replaced ${replaces}`;
  };
  const glyph = buttonGlyph('ghost', { size: 'sm' });
  return (
    <View
      {...platformMaterial('overlay')}
      {...rest}
      class={props.class}
      style={[{ ...popupSurface(), gap: 4 }, props.style ?? null]}
    >
      <InputGroup invalid={!!props.result?.error}>
        <InputGroupInput
          ref={(node: InputRef) => {
            node.focus();
            // The query comes selected, as a find box opens: a key replaces what it holds.
            if (search().query) node.setSelection(0, search().query.length);
          }}
          value={search().query}
          onChange={({ value }) => set({ query: value })}
          onSubmit={() => props.editor?.run('findNext')}
          submitBehavior="submit"
          placeholder="Find"
          accessibilityLabel="Find"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <InputGroupAddon align="inline-end">
          <Text
            style={{
              numberOfLines: 1,
              paddingHorizontal: 4,
              fontFamily: 'monospace',
              fontSize: 11,
              color: colors.mutedForeground,
              fontVariant: ['tabular-nums'],
            }}
          >
            {count()}
          </Text>
          <Toggle
            pressed={!!search().caseSensitive}
            onChange={() => set({ caseSensitive: !search().caseSensitive })}
            text
            size="sm"
            accessibilityLabel="Match case"
          >
            Aa
          </Toggle>
          <Toggle
            pressed={!!search().wholeWord}
            onChange={() => set({ wholeWord: !search().wholeWord })}
            text
            size="sm"
            accessibilityLabel="Whole word"
          >
            W
          </Toggle>
          <Toggle
            pressed={!!search().regex}
            onChange={() => set({ regex: !search().regex })}
            text
            size="sm"
            accessibilityLabel="Regular expression"
          >
            .*
          </Toggle>
          <InputGroupButton
            size="icon-xs"
            accessibilityLabel="Previous match"
            onPress={() => props.editor?.run('findPrevious')}
          >
            <Icon icon={ArrowUp} {...glyph} />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            accessibilityLabel="Next match"
            onPress={() => props.editor?.run('findNext')}
          >
            <Icon icon={ArrowDown} {...glyph} />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            accessibilityLabel="Close the find bar"
            onPress={() => props.onClose?.()}
          >
            <Icon icon={X} {...glyph} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput
          value={replacement()}
          onChange={({ value }) => replacement.set(value)}
          onSubmit={replace}
          submitBehavior="submit"
          placeholder="Replace"
          accessibilityLabel="Replace"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            accessibilityLabel="Replace this match"
            onPress={replace}
          >
            <Icon icon={Replace} {...glyph} />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            accessibilityLabel="Replace all matches"
            onPress={replaceAll}
          >
            <Icon icon={ReplaceAll} {...glyph} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </View>
  );
}

/**
 * The session an app drives the editor with, from `nsh/base`, so `@/components/ui/editor` is the
 * only import.
 */
export type {
  EditorBounds,
  EditorClasses,
  EditorCodeActionRequest,
  EditorCommand,
  EditorCompletionAcceptEvent,
  EditorCompletionItem,
  EditorCompletionKind,
  EditorCompletionRequest,
  EditorCompletionTrigger,
  EditorContextMenuEvent,
  EditorDecoration,
  EditorDefinitionRequest,
  EditorDefinitionTrigger,
  EditorDiagnostic,
  EditorDiagnosticCodeDescription,
  EditorDiagnosticRelatedInformation,
  EditorDiagnosticSeverity,
  EditorDiagnosticTag,
  EditorEdit,
  EditorFoldRange,
  EditorGutterMark,
  EditorGutterPlacement,
  EditorHoverEvent,
  EditorInlineCompletionRequest,
  EditorLocation,
  EditorOverviewRulerLane,
  EditorOverviewRulerMark,
  EditorPosition,
  EditorRange,
  EditorRect,
  EditorRef,
  EditorReplaceAll,
  EditorSearch,
  EditorSearchResult,
  EditorSelection,
  EditorStyles,
  EditorTextPressEvent,
  EditorToken,
} from 'nsh/base';
