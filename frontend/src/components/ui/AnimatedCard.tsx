import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  children: ReactNode;
  hover?: boolean;
  index?: number;
  className?: string;
  onClick?: () => void;
}

export default function AnimatedCard({ children, hover, index = 0, className, onClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={hover ? { y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.08)' } : undefined}
      className={clsx(
        'bg-white rounded-xl border border-slate-200 p-4',
        hover && 'cursor-pointer transition-colors',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
