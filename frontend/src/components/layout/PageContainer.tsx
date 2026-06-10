import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Standard page wrapper — avoids double padding with AppShell main. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('mx-auto w-full max-w-7xl space-y-4 sm:space-y-6', className)}>{children}</div>;
}

/** Horizontal scroll fallback for tables on small screens. */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-1 overflow-x-auto sm:mx-0', className)}>
      <div className="inline-block min-w-full align-middle">{children}</div>
    </div>
  );
}
