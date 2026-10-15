import { createEffect, createMemo, on, onCleanup, type Accessor } from "solid-js";

interface DialogFocusOptions {
  open: Accessor<boolean>;
  busy?: Accessor<boolean>;
  onClose: () => void;
  initialFocus?: () => HTMLElement | undefined | null;
  fallbackFocus?: () => HTMLElement | undefined | null;
}

interface DialogSession {
  returnFocus: () => HTMLElement | undefined | null;
}

const sessions: DialogSession[] = [];
let closingSession: DialogSession | undefined;

export function isComposingKey(event: KeyboardEvent) {
  return event.isComposing || event.keyCode === 229;
}

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    "a[href], button, input, select, textarea, [tabindex], [contenteditable='true']",
  )).filter((element) => element.tabIndex >= 0
    && !element.matches(":disabled")
    && !element.closest("[inert], [hidden], [aria-hidden='true']")
    && getComputedStyle(element).visibility !== "hidden"
    && element.getClientRects().length > 0);
}

/** Keeps modal focus local and carries the original trigger across dialog handoffs. */
export function useDialogFocus(options: DialogFocusOptions) {
  let dialog: HTMLElement | undefined;
  const isOpen = createMemo(options.open);

  const focusInitial = () => {
    const target = options.initialFocus?.() ?? dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]");
    const fallback = dialog ? focusableElements(dialog)[0] ?? dialog : undefined;
    (target && !target.matches(":disabled") ? target : fallback)?.focus();
  };

  createEffect(on(isOpen, (open) => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : undefined;
    const previous = sessions[sessions.length - 1] ?? closingSession;
    const session: DialogSession = {
      returnFocus: () => trigger?.isConnected && trigger.getClientRects().length > 0 && !trigger.matches(":disabled")
        ? trigger : previous?.returnFocus() ?? options.fallbackFocus?.(),
    };
    sessions.push(session);
    let active = true;
    queueMicrotask(() => {
      if (active && sessions[sessions.length - 1] === session && dialog?.isConnected) focusInitial();
    });

    const containFocus = (event: FocusEvent) => {
      if (sessions[sessions.length - 1] === session && dialog?.isConnected && !dialog.contains(event.target as Node)) {
        focusInitial();
      }
    };
    document.addEventListener("focusin", containFocus);
    onCleanup(() => {
      active = false;
      document.removeEventListener("focusin", containFocus);
      const index = sessions.indexOf(session);
      if (index >= 0) sessions.splice(index, 1);
      closingSession = session;
      queueMicrotask(() => {
        if (closingSession === session) closingSession = undefined;
      });
      // Let the submitting action release its busy state before focusing a trigger
      // that was disabled during the write.
      requestAnimationFrame(() => {
        // A replacement modal owns its focus; the closing modal must not steal it.
        if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
        const current = document.activeElement;
        if (current instanceof HTMLElement && current !== document.body && current.isConnected && !dialog?.contains(current)) return;
        session.returnFocus()?.focus();
      });
    });
  }));

  const requestClose = () => {
    if (!options.busy?.()) options.onClose();
  };

  return {
    setDialogRef: (element: HTMLElement) => { dialog = element; },
    requestClose,
    onBackdropMouseDown: (event: MouseEvent) => {
      if (event.target === event.currentTarget) requestClose();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (isComposingKey(event)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      } else if (event.key === "Tab" && dialog) {
        const focusable = focusableElements(dialog);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;
        if (!first || !dialog.contains(current) || current === dialog
          || (!event.shiftKey && current === last) || (event.shiftKey && current === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
          if (!first) dialog.focus();
        }
        event.stopPropagation();
      }
    },
  };
}
