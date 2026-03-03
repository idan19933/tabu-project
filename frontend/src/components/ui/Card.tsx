import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export default function Card({ children, hover, className, ...props }: Props) {
  return (
    <div
      className={clsx(
        'relative bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-5 shadow-sm',
        hover &&
          'hover:shadow-lg hover:shadow-primary-500/5 hover:border-primary-300/60 transition-all duration-300 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
