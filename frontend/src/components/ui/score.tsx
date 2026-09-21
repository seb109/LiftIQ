import React from 'react';
import { CautionGlyph, FailGlyph, PassGlyph } from './icons';

export type ScoreTone = 'pass' | 'caution' | 'fail';

/** One banding for every score in the product. */
export function scoreBand(score: number): { tone: ScoreTone; label: string } {
  if (score >= 85) return { tone: 'pass', label: 'Strong' };
  if (score >= 70) return { tone: 'caution', label: 'Adequate' };
  return { tone: 'fail', label: 'Needs work' };
}

const toneText: Record<ScoreTone, string> = {
  pass: 'text-pass',
  caution: 'text-caution',
  fail: 'text-fail',
};

const glyph = { pass: PassGlyph, caution: CautionGlyph, fail: FailGlyph } as const;

/**
 * A form score with its state stated three ways (glyph shape, word, colour) so it
 * never depends on colour alone. Renders "n/a" when there is no score.
 */
export const ScoreValue: React.FC<{
  score: number | null | undefined;
  showLabel?: boolean;
  /** Large display numeral (dashboard and summary figures) instead of inline text. */
  figure?: boolean;
  className?: string;
}> = ({ score, showLabel = false, figure = false, className = '' }) => {
  if (score === null || score === undefined) {
    return <span className={`text-ink-2 ${figure ? 'font-display text-stat' : ''} ${className}`}>n/a</span>;
  }
  const { tone, label } = scoreBand(score);
  const Glyph = glyph[tone];
  return (
    <span
      className={`inline-flex items-center tabular-nums ${toneText[tone]} ${
        figure ? 'gap-2 font-display text-stat' : 'gap-1.5 font-medium'
      } ${className}`}
    >
      <Glyph className={`shrink-0 ${figure ? 'size-8' : 'size-4'}`} />
      {Math.round(score)}%
      {showLabel && <span className="font-normal">{label}</span>}
    </span>
  );
};
