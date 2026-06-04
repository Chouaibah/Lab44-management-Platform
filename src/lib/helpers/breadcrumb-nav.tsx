'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useLab44Store } from '@/store/lab44';
import type { AppView } from '@/types';

export function BreadcrumbNav({ items }: { items: { label: string; view?: AppView }[] }) {
  const { setView } = useLab44Store();
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2 px-3 py-1.5 rounded-lg bg-muted/30 backdrop-blur-sm">
      {items.map((item, idx) => (
        <React.Fragment key={`bc-${item.label}-${idx}`}>
          {idx > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
          {item.view ? (
            <button
              onClick={() => item.view && setView(item.view)}
              className="hover:text-foreground transition-colors hover:underline px-1 py-0.5 rounded text-xs font-medium"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground font-medium text-xs">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}