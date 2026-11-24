import { cleanup, Overlay, safeArea, signal, Text } from 'nsh';
import { Toast, type ToastEntry, ToastManager, ToastStack } from 'nsh/base';

export function createPageToast(id: string) {
  const toastManager = new ToastManager();
  const toasts = signal<ToastEntry[]>([]);
  let toastTimer: ReturnType<typeof setInterval> | undefined;
  let toastExpanded = false;
  let persistentToast = false;
  cleanup(() => {
    clearInterval(toastTimer);
    toastManager.dispose();
  });

  function syncToast() {
    toasts.set(toastManager.visible(1));
  }

  function startToastTimer() {
    if (toastTimer !== undefined) return;
    toastTimer = setInterval(() => {
      if (toastManager.advance(toastExpanded).changed) syncToast();
      if (
        toastManager.isEmpty() ||
        (persistentToast &&
          toasts().every((toast) => toast.status === 'present'))
      ) {
        clearInterval(toastTimer);
        toastTimer = undefined;
      }
    }, 50);
  }

  function showToast(text: string, persistent = false) {
    persistentToast = persistent;
    toastManager.push(id, text, { timeout: persistent ? null : 3000 });
    syncToast();
    startToastTimer();
  }

  function dismissToast() {
    if (!toastManager.dismiss(id)) return;
    persistentToast = false;
    syncToast();
    startToastTimer();
  }

  function ToastOutlet() {
    return (
      <Overlay
        class="inset-x-0 bottom-0 items-center p-4"
        style={{
          paddingBottom: safeArea().bottom + 16,
          pointerEvents: 'box-none',
        }}
      >
        <ToastStack
          closeOnEscape={false}
          style={{ width: 340, maxWidth: '100%' }}
          placement="bottomRight"
          onExpandedChange={({ expanded }) => {
            toastExpanded = expanded;
          }}
        >
          <Each of={toasts()} key={(toast: ToastEntry) => toast.id}>
            {(toast) => (
              <Toast
                testID={id + '-toast'}
                transitionStatus={toast().status}
                accessibilityLabel={String(toast().value)}
                onDismissRequest={dismissToast}
                class="rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 ease-out"
                startingClass="opacity-0 translate-y-4"
                endingClass="opacity-0 scale-95"
                swipingClass="transition-none"
              >
                <Text class="text-sm text-card-foreground">
                  {String(toast().value)}
                </Text>
              </Toast>
            )}
          </Each>
        </ToastStack>
      </Overlay>
    );
  }

  return {
    showToast,
    dismissPersistent: () => {
      if (persistentToast) dismissToast();
    },
    ToastOutlet,
  };
}
