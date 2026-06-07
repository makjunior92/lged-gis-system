import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, className, id, children, ...rest }, ref) => {
    const selectId = id ?? `sel-${Math.random().toString(36).slice(2, 9)}`;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
            {label} {required && <span className="text-danger-500">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500',
            error ? 'border-danger-500' : 'border-slate-300',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

export default Select;
