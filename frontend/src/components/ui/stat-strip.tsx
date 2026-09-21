import React from 'react';

export interface StatItem {
  label: string;
  value: React.ReactNode;
  note?: string;
}

/** Headline figures in one ruled strip: hairlines between them, no boxes. */
export const StatStrip: React.FC<{ items: StatItem[]; className?: string }> = ({ items, className = '' }) => (
  <dl
    className={`grid grid-cols-2 gap-px border-y border-rule bg-rule ${
      items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : ''
    } ${className}`}
  >
    {items.map((item) => (
      <div key={item.label} className="bg-canvas py-5 pr-4 sm:px-6 sm:first:pl-0">
        <dt className="text-sm text-ink-2">{item.label}</dt>
        <dd>
          <span className="mt-1 block font-display text-stat tabular-nums text-ink">{item.value}</span>
          {item.note && <span className="mt-1 block text-sm text-ink-2">{item.note}</span>}
        </dd>
      </div>
    ))}
  </dl>
);
