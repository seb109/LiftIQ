import React from 'react';

/**
 * A titled block of a page. The heading sits on a hairline rule and the content
 * sits directly on the page: structure comes from the rule and spacing, not from a box.
 */
export const Section: React.FC<{
  title: string;
  /** Right-aligned secondary text or a link, on the same line as the title. */
  meta?: React.ReactNode;
  /** Content that supplies its own top spacing (rule-separated lists) sits flush under the heading rule. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ title, meta, flush = false, className = '', children }) => (
  <section className={className}>
    <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {meta && <div className="text-sm text-ink-2">{meta}</div>}
    </div>
    <div className={flush ? undefined : 'pt-4'}>{children}</div>
  </section>
);
