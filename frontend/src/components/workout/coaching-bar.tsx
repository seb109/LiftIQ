'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WorkoutStats } from '@/lib/api';
import { FailGlyph } from '@/components/ui/icons';

const NEUTRAL_MESSAGE = 'Good form. Keep going.';
/** Minimum ms a correction must persist before updating the display (debounce). */
const CORRECTION_DEBOUNCE_MS = 1200;

interface CoachingBarProps {
  stats: WorkoutStats | null;
}

/** The current cue, large enough to read mid-set. A correction gets a glyph and a tinted strip. */
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
    // this effect's cleanup: that made every change get cleared before it could fire
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
      className={`flex min-h-14 items-center gap-3 rounded-surface border px-4 py-3 transition-colors ${
        isViolation ? 'border-fail bg-fail-tint' : 'border-rule bg-transparent'
      }`}
    >
      {isViolation && <FailGlyph className="size-6 shrink-0 text-fail" />}
      <p id="coaching-text" aria-live="polite" className="text-xl font-medium">
        {displayed}
      </p>
    </div>
  );
}
