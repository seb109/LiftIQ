import React from 'react';
import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/** Where you are, and a way back up. The last crumb is the current page and is not a link. */
export const Breadcrumb: React.FC<{ items: Crumb[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb">
    <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={item.label} className="flex items-center gap-2">
            {item.href && !last ? (
              <Link href={item.href} className="underline-offset-4 hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink' : undefined}>
                {item.label}
              </span>
            )}
            {!last && <span aria-hidden="true">/</span>}
          </li>
        );
      })}
    </ol>
  </nav>
);
