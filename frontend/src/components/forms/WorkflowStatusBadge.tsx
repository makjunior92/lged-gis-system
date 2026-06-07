import { cn } from '@/lib/utils';
import { useT } from '@/contexts/I18nContext';
import type { WorkflowStatus } from '@/types/project';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Submitted: 'bg-blue-100 text-blue-800',
  'Under PIO Review': 'bg-amber-100 text-amber-800',
  'Forwarded to UNO': 'bg-purple-100 text-purple-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

interface Props {
  status: WorkflowStatus | string;
  className?: string;
}

export default function WorkflowStatusBadge({ status, className }: Props) {
  const { t } = useT();
  const key = 'workflowStatus.' + status.replace(/\s+/g, '');
  const label = t(key) !== key ? t(key) : status;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
    >
      {label}
    </span>
  );
}
