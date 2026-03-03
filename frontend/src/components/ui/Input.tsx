import { clsx } from 'clsx';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className, id, ...props }: Props) {
  const inputId = id || label?.replace(/\s/g, '_');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'rounded-xl border border-slate-200 bg-white/60 backdrop-blur-sm px-4 py-2.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400',
          'placeholder:text-slate-400',
          'transition-all duration-200',
          className,
        )}
        {...props}
      />
    </div>
  );
}
