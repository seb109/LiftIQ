'use client';

import React from 'react';
import { ConnectionState } from '@/lib/use-workout-session';

const STATE_CONFIG: Record<ConnectionState, { dot: string; label: string; pulse: boolean }> = {
  IDLE:         { dot: 'bg-ink-2',   label: 'Idle',           pulse: false },
  CONNECTING:   { dot: 'bg-caution', label: 'Connecting',     pulse: false },
  READY:        { dot: 'bg-caution', label: 'Camera ready',   pulse: false },
  LIVE:         { dot: 'bg-pass',    label: 'Live',           pulse: true  },
  PAUSED:       { dot: 'bg-caution', label: 'Paused',         pulse: false },
  RECONNECTING: { dot: 'bg-caution', label: 'Reconnecting',   pulse: false },
  STOPPING:     { dot: 'bg-caution', label: 'Finishing',      pulse: false },
  COMPLETED:    { dot: 'bg-pass',    label: 'Complete',       pulse: false },
  ERROR:        { dot: 'bg-fail',    label: 'Connection lost', pulse: false },
};

interface ConnectionStatusProps {
  state: ConnectionState;
}

/** The only pulsing element in the product: it means the camera feed is live. */
export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const cfg = STATE_CONFIG[state];
  return (
    <div id="connection-status" role="status" className="inline-flex items-center gap-2 text-sm font-medium">
      <span className={`size-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {cfg.label}
    </div>
  );
}
