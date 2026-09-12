'use client';

import React from 'react';
import { ConnectionState } from '@/lib/use-workout-session';

const STATE_CONFIG: Record<ConnectionState, { dot: string; label: string; pulse: boolean }> = {
  IDLE:         { dot: 'bg-zinc-600',  label: 'Idle',          pulse: false },
  CONNECTING:   { dot: 'bg-amber-400', label: 'Connecting…',   pulse: true  },
  READY:        { dot: 'bg-lime-400',  label: 'Camera ready',  pulse: false },
  LIVE:         { dot: 'bg-lime-400',  label: 'Live',          pulse: true  },
  PAUSED:       { dot: 'bg-amber-400', label: 'Paused',        pulse: false },
  RECONNECTING: { dot: 'bg-amber-400', label: 'Reconnecting…', pulse: true  },
  STOPPING:     { dot: 'bg-amber-400', label: 'Finishing…',    pulse: true  },
  COMPLETED:    { dot: 'bg-lime-400',  label: 'Complete',      pulse: false },
  ERROR:        { dot: 'bg-red-500',   label: 'Error',         pulse: false },
};

interface ConnectionStatusProps {
  state: ConnectionState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const cfg = STATE_CONFIG[state];
  return (
    <div
      id="connection-status"
      className="inline-flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded-full px-3 py-1.5"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-medium text-slate-300">{cfg.label}</span>
    </div>
  );
}
