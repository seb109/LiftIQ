'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface CameraPermissionErrorProps {
  onRetry: () => void;
}

export function CameraPermissionError({ onRetry }: CameraPermissionErrorProps) {
  const router = useRouter();
  return (
    <div
      id="camera-permission-error"
      className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-6 text-center space-y-6"
    >
      <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/50 flex items-center justify-center text-3xl">
        📷
      </div>
      <div className="space-y-2 max-w-xs">
        <h2 className="text-xl font-bold text-white">Camera access is required</h2>
        <p className="text-sm text-slate-400">
          Allow camera access in your browser settings to start a live workout. LiftIQ uses your camera for
          real-time pose detection only — nothing is recorded.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          id="retry-camera-btn"
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-sm transition-colors"
        >
          Try Again
        </button>
        <button
          id="back-from-camera-error-btn"
          onClick={() => router.push('/')}
          className="px-6 py-2.5 rounded-xl border border-zinc-700 text-slate-300 hover:bg-zinc-800 font-semibold text-sm transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
