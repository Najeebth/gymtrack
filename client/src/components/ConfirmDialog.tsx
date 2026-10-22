import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { animate } from 'motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { EXPO_OUT, prefersReducedMotion } from '../utils/motion';
import type { ConfirmOptions } from '../context/ConfirmContext';

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal confirm dialog rendered by ConfirmProvider. Use useConfirm(), not this directly.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = tone === 'danger';

  useEffect(() => {
    // Return focus to whatever opened the dialog (e.g. the delete button)
    const opener = document.activeElement as HTMLElement | null;
    // Destructive actions start on Cancel, so a stray Enter can't delete anything
    (danger ? cancelRef : confirmRef).current?.focus();

    if (panelRef.current && !prefersReducedMotion()) {
      animate(panelRef.current, { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] }, { duration: 0.2, ease: EXPO_OUT });
    }
    return () => opener?.focus?.();
  }, [danger]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Keep Escape from also closing what's underneath (chat panel, nav drawer)
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      // Trap focus between the two buttons while the dialog is open
      const order = [cancelRef.current, confirmRef.current];
      const index = order.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      order[(index + (e.shiftKey ? order.length - 1 : 1)) % order.length]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-brand-navy/50" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="relative w-full max-w-sm bg-white rounded-2xl border border-brand-border shadow-2xl p-5"
      >
        <div className="flex gap-3">
          <div
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
              danger ? 'bg-red-50 text-brand-danger' : 'bg-brand-orange/10 text-brand-orange'
            }`}
          >
            {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </div>
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="text-base font-bold text-brand-navy">
              {title}
            </h2>
            {message && (
              <div id={messageId} className="mt-1.5 text-sm text-brand-muted">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-brand-border bg-white text-sm font-semibold text-brand-navy hover:bg-slate-50 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              danger
                ? 'bg-brand-danger hover:bg-red-700 focus-visible:ring-brand-danger/50'
                : 'bg-brand-orange hover:bg-brand-orange-hover focus-visible:ring-brand-orange/50'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
