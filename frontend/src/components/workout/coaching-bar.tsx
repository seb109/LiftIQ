'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WorkoutStats } from '@/lib/api';

const NEUTRAL_MESSAGE = 'Good form — keep going.';
/** Minimum ms a correction must persist before updating the display (debounce). */
const CORRECTION_DEBOUNCE_MS = 1200;

interface CoachingBarProps {
  stats: WorkoutStats | null;
}

export function CoachingBar({ stats }: CoachingBarProps) {
  const [displayed, setDisplayed] = useState<string>(NEUTRAL_MESSAGE);
  const [isViolation, setIsViolation] = useState(false);
  const lastViolationRef = useRef<string>('');
  const pendingRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!stats) return;

    const topViolation = stats.form_violations?.[0] ?? '';
    const feedback = stats.feedback ?? '';

    // Prefer form violation > rep feedback > neutral
    const newMessage = topViolation || feedback || NEUTRAL_MESSAGE;
    const newIsViolation = Boolean(topViolation);

    // Debounce to avoid flickering. `stats` is a new object on every poll (~800 ms),
    // shorter than the debounce window, so the pending timer must NOT be cancelled by
    // this effect's cleanup — that made every change get cleared before it could fire
    // and the bar never left its initial message. Only cancel when the message
    // reverts to what is already displayed; leave an already-pending change alone.
    if (newMessage === lastViolationRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      pendingRef.current = null;
      return;
    }
    if (pendingRef.current === newMessage) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingRef.current = newMessage;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      pendingRef.current = null;
      lastViolationRef.current = newMessage;
      setDisplayed(newMessage);
      setIsViolation(newIsViolation);
    }, CORRECTION_DEBOUNCE_MS);
  }, [stats]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div
      id="coaching-bar"
      className={[
        'px-5 py-3.5 rounded-xl border flex items-center gap-3 transition-colors duration-500',
        isViolation
          ? 'bg-red-950/40 border-red-800/50'
          : 'bg-zinc-900/60 border-zinc-800/60',
      ].join(' ')}
    >
      <span className={`text-lg shrink-0 ${isViolation ? 'text-red-400' : 'text-lime-400'}`}>
        {isViolation ? '⚠' : '✓'}
      </span>
      <p
        id="coaching-text"
        className={`text-sm font-medium transition-colors duration-300 ${
          isViolation ? 'text-red-300' : 'text-slate-300'
        }`}
      >
        {displayed}
      </p>
    </div>
  );
}
