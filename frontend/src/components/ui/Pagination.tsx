import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/I18nContext';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const { t } = useT();
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const safeTotalPages = Math.max(totalPages, 1);

  function go(p: number) {
    const clamped = Math.min(Math.max(p, 1), safeTotalPages);
    if (clamped !== page) onPageChange(clamped);
  }

  const btn = cn(
    'inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600',
    'hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed',
  );

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-600">
      <div>
        {t('common.showing')} <span className="font-medium text-slate-800">{first}</span>–
        <span className="font-medium text-slate-800">{last}</span> {t('common.of')}{' '}
        <span className="font-medium text-slate-800">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button className={btn} onClick={() => go(1)} disabled={page <= 1} aria-label={t('common.firstPage')}>
          <ChevronsLeft size={16} />
        </button>
        <button className={btn} onClick={() => go(page - 1)} disabled={page <= 1} aria-label={t('common.previousPage')}>
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-slate-700">
          {t('common.page')} <span className="font-semibold">{page}</span> {t('common.of')} {safeTotalPages}
        </span>
        <button className={btn} onClick={() => go(page + 1)} disabled={page >= safeTotalPages} aria-label={t('common.nextPage')}>
          <ChevronRight size={16} />
        </button>
        <button className={btn} onClick={() => go(safeTotalPages)} disabled={page >= safeTotalPages} aria-label={t('common.lastPage')}>
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
