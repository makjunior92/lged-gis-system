import { cn } from '@/lib/utils';

export default function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-r-transparent',
        className,
      )}
    />
  );
}
