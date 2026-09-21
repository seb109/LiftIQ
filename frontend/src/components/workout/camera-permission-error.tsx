'use client';

import React from 'react';
import { CameraErrorReason } from '@/lib/use-workout-session';
import { Button, ButtonLink } from '@/components/ui/button';
import { CameraOff } from '@/components/ui/icons';

const ERROR_HINTS: Record<CameraErrorReason, string> = {
  NotAllowedError:      'Select the camera icon in your browser\'s address bar, choose Allow, then try again.',
  NotFoundError:        'Check that your camera is connected and not blocked by another app.',
  NotReadableError:     'Close any other app that may be using the camera (Zoom, Teams, OBS) and try again.',
  OverconstrainedError: 'Your camera does not support the required settings. Try a different camera.',
  SecurityError:        'Camera access needs a secure connection. Open LiftIQ over HTTPS, or on localhost while developing.',
  UnsupportedBrowser:   'Open LiftIQ in a current version of Chrome, Firefox, Edge or Safari to use live workouts.',
  Unknown:              'Check your camera connection and browser permissions, then try again.',
};

interface CameraPermissionErrorProps {
  onRetry: () => void;
  errorReason: CameraErrorReason | null;
  startError: string | null;
}

export function CameraPermissionError({ onRetry, errorReason, startError }: CameraPermissionErrorProps) {
  const reason  = errorReason ?? 'Unknown';
  const message = startError ?? 'Camera access failed.';

  return (
    <div id="camera-permission-error" role="alert" className="mx-auto max-w-lg space-y-6 py-8">
      <CameraOff className="size-10 text-ink-2" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Camera unavailable</h1>
        <p className="text-fail">{message}</p>
        <p className="text-ink-2">{ERROR_HINTS[reason]}</p>
      </div>

      {reason === 'SecurityError' && (
        <p className="border-t border-rule pt-4 text-sm text-ink-2">
          Browsers only allow camera access on <code className="font-mono text-ink">localhost</code>,{' '}
          <code className="font-mono text-ink">127.0.0.1</code> or HTTPS. A plain network address such as
          192.168.x.x does not qualify.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button id="retry-camera-btn" onClick={onRetry}>
          Try again
        </Button>
        <ButtonLink id="back-from-camera-error-btn" href="/" variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
