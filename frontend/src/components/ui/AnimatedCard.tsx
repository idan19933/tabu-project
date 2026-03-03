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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={
        hover
          ? {
              y: -4,
              boxShadow: '0 20px 40px rgba(79, 70, 229, 0.08), 0 8px 16px rgba(0, 0, 0, 0.04)',
            }
          : undefined
      }
      className={clsx(
        'relative bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-5 shadow-sm',
        hover && 'cursor-pointer transition-colors duration-300',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
