import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        {
          'bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/25 hover:shadow-lg hover:shadow-primary-500/30 hover:from-primary-400 hover:to-primary-500 active:from-primary-600 active:to-primary-700':
            variant === 'primary',
          'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow':
            variant === 'secondary',
          'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-md shadow-red-500/25 hover:from-red-400 hover:to-red-500':
            variant === 'danger',
          'text-slate-600 hover:bg-slate-100/80 hover:text-slate-800': variant === 'ghost',
        },
        {
          'px-3.5 py-1.5 text-sm': size === 'sm',
          'px-5 py-2.5 text-sm': size === 'md',
          'px-7 py-3 text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
