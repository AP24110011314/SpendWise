import { Fragment, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Modal({ open, isOpen, onClose, title, children, className = '', size = 'md' }) {
  const isShown = Boolean(open ?? isOpen);

  useEffect(() => {
    if (isShown) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isShown]);

  if (!isShown) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  const modalContent = (
    <Fragment>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div
          className={`w-full ${sizes[size]} max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 my-auto ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {(title || onClose) && (
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain scrollbar-thin">
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  );

  return createPortal(modalContent, document.body);
}