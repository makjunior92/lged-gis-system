import { X } from 'lucide-react';

import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useT();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="fixed left-1/2 top-1/2 z-50 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-800">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label={t('common.cancel')}
          >
            <X size={16} />
          </button>
        </div>
        <p id="confirm-dialog-message" className="px-4 py-4 text-sm text-slate-600">
          {message}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel ?? t('common.no')}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel ?? t('common.yes')}
          </Button>
        </div>
      </div>
    </>
  );
}
