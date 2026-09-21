'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface EndWorkoutDialogProps {
  isOpen: boolean;
  isStopping: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndWorkoutDialog({ isOpen, isStopping, onConfirm, onCancel }: EndWorkoutDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Keyboard behaviour for a modal: focus starts on the safe choice (Cancel), Tab stays inside
  // the dialog, Escape closes it, and focus returns to whatever opened it.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isStopping) {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [isOpen, isStopping, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      id="end-workout-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-workout-title"
      aria-describedby="end-workout-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm space-y-5 rounded-surface border border-rule bg-surface p-6 shadow-overlay"
      >
        <div className="space-y-1">
          <h2 id="end-workout-title" className="text-xl font-semibold">End this workout?</h2>
          <p id="end-workout-description" className="text-ink-2">
            Your progress is saved and a coaching report is written from it.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            id="cancel-end-workout"
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={isStopping}
            className="flex-1"
          >
            Keep going
          </Button>
          <Button
            id="confirm-end-workout"
            variant="danger"
            onClick={onConfirm}
            isLoading={isStopping}
            className="flex-1"
          >
            {isStopping ? 'Finishing' : 'End workout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
