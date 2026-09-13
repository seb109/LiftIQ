'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CameraErrorReason } from '@/lib/use-workout-session';

const ERROR_ICONS: Record<CameraErrorReason, string> = {
  NotAllowedError:      '🔒',
  NotFoundError:        '📷',
  NotReadableError:     '⚠️',
  OverconstrainedError: '⚙️',
  SecurityError:        '🔐',
  UnsupportedBrowser:   '🌐',
  Unknown:              '❌',
};

const ERROR_HINTS: Record<CameraErrorReason, string> = {
  NotAllowedError:      'Click the camera icon in the address bar and select "Allow", then click Try Again.',
  NotFoundError:        'Check that your webcam is connected and not blocked by another app.',
  NotReadableError:     'Close any other app that may be using the camera (Zoom, Teams, OBS, etc.) and try again.',
  OverconstrainedError: 'Your camera does not support the required settings. Try a different camera.',
  SecurityError:        'Camera access requires a secure context. Open the app via http://localhost:3001 (not a network IP).',
  UnsupportedBrowser:   'Please open LiftIQ in Chrome, Firefox, or Edge to use the live workout feature.',
  Unknown:              'Check your camera connection and browser permissions, then try again.',
};

interface CameraPermissionErrorProps {
  onRetry: () => void;
  errorReason: CameraErrorReason | null;
  startError: string | null;
}

export function CameraPermissionError({ onRetry, errorReason, startError }: CameraPermissionErrorProps) {
  const router  = useRouter();
  const reason  = errorReason ?? 'Unknown';
  const icon    = ERROR_ICONS[reason];
  const hint    = ERROR_HINTS[reason];
  const message = startError ?? 'Camera access failed.';

  return (
    <div
      id="camera-permission-error"
      className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-6 text-center space-y-6"
    >
      <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/50 flex items-center justify-center text-3xl">
        {icon}
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold text-white">Camera unavailable</h2>
        <p className="text-sm text-red-300">{message}</p>
        <p className="text-xs text-slate-400 mt-1">{hint}</p>
      </div>

      {reason === 'SecurityError' && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-xs text-slate-400 max-w-sm text-left space-y-1">
          <p className="text-slate-300 font-semibold">Secure context required</p>
          <p>
            <code className="text-lime-400">getUserMedia()</code> only works on{' '}
            <code className="text-lime-400">localhost</code>,{' '}
            <code className="text-lime-400">127.0.0.1</code>, or HTTPS.
            Opening the app via a LAN IP address (e.g. 192.168.x.x) is not a secure context.
          </p>
        </div>
      )}

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
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
