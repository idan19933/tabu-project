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
        'bg-white rounded-xl border border-slate-200 p-5',
        hover && 'hover:shadow-md hover:border-primary-300 transition-all cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
