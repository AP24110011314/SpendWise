import { useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  open,
  isOpen,
  onClose,
  title,
  message,
  confirmText,
  confirmLabel = 'Confirm',
  cancelText,
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'danger',
  loading,
}) {
  const isShown = Boolean(open ?? isOpen);
  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;
  const buttonVariant = variant === 'destructive' ? 'danger' : variant;

  if (!isShown) return null;

  return (
    <Modal open={isShown} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-300">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {finalCancelLabel}
          </Button>
          <Button variant={buttonVariant} onClick={onConfirm} loading={loading}>
            {finalConfirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}