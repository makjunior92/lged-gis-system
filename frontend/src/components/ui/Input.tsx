import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className, id, ...rest }, ref) => {
    const inputId = id ?? `in-${Math.random().toString(36).slice(2, 9)}`;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label} {required && <span className="text-danger-500">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500',
            error ? 'border-danger-500' : 'border-slate-300',
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="text-xs text-danger-500">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export default Input;
