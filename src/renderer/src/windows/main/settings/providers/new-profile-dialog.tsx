import type { FormEvent } from "react";
import { AnimateIcon } from "@animate-ui/react/icons";
import { Dialog } from "@animate-ui/react/primitives/base-ui/dialog";
import { X } from "@renderer/components/animate-ui/icons/x";
import { Button } from "@renderer/components/ui/button";
import type { PluginDescriptor, PluginKind } from "@shared/ipc";

import { FORM_FOR_KIND } from "./components/providers-form";
import { KIND_ADD } from "./kinds";
import type { EditorState } from "./provider-editor";

/** 新增 dialog 的编辑态：baseline 用于判断关闭时是否需要确认 */
type Creating = { baseline: EditorState; editor: EditorState };

type NewProfileDialogProps = {
  creating: Creating | null;
  dirty: boolean;
  error: string | null;
  info: string | null;
  kind: PluginKind;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
  onPatch: (patch: Partial<EditorState>) => void;
  /** 用户要求关闭；有未保存内容时由页面转入 confirm 态 */
  onRequestClose: () => void;
  onSave: (event?: FormEvent) => Promise<void>;
  pending: boolean;
  plugin: PluginDescriptor | null;
  saving: boolean;
  secretAvailable: boolean;
};

function NewProfileDialog({
  creating,
  dirty,
  error,
  info,
  kind,
  onCancelDiscard,
  onConfirmDiscard,
  onPatch,
  onRequestClose,
  onSave,
  pending,
  plugin,
  saving,
  secretAvailable,
}: NewProfileDialogProps) {
  const Form = FORM_FOR_KIND[kind];
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) {
          onRequestClose();
        }
      }}
      open={creating !== null}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          aria-label={KIND_ADD[kind]}
          className="fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg outline-none"
        >
          <AnimateIcon animateOnHover asChild>
            <Dialog.Close
              render={
                <Button
                  // StaggerList 的行残留 filter，会建 stacking context 压住按钮，必须抬 z-index
                  className="absolute top-3 right-3 z-10"
                  disabled={saving}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">取消新增</span>
            </Dialog.Close>
          </AnimateIcon>
          {creating ? (
            <Form
              dirty={dirty}
              editor={creating.editor}
              error={error}
              info={info}
              isNew
              onCancelDiscard={onCancelDiscard}
              onConfirmDiscard={onConfirmDiscard}
              onDelete={() => undefined}
              onPatch={onPatch}
              onSave={onSave}
              pending={pending}
              plugin={plugin}
              saving={saving}
              schema={plugin?.configSchema}
              secretAvailable={secretAvailable}
              secretHas={{}}
              selectedId={null}
            />
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type { Creating };
export { NewProfileDialog };
