'use client';

import React from 'react';

interface EndWorkoutDialogProps {
  isOpen: boolean;
  isStopping: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndWorkoutDialog({ isOpen, isStopping, onConfirm, onCancel }: EndWorkoutDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      id="end-workout-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-workout-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
        <div className="space-y-1">
          <h2 id="end-workout-title" className="text-lg font-bold text-white">End workout?</h2>
          <p className="text-sm text-slate-400">Your current progress will be saved and an AI report will be generated.</p>
        </div>

        <div className="flex gap-3">
          <button
            id="cancel-end-workout"
            onClick={onCancel}
            disabled={isStopping}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-slate-300 hover:bg-zinc-800 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-end-workout"
            onClick={onConfirm}
            disabled={isStopping}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isStopping ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finishing…
              </>
            ) : 'End Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
