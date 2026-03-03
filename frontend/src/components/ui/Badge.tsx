import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { SimulationStatus } from '../../types';

const STATUS_STYLES: Record<SimulationStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  AI_Extracting: 'bg-purple-100 text-purple-700',
  Pending_Review: 'bg-amber-100 text-amber-700',
  Approved_For_Calc: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABELS: Record<SimulationStatus, string> = {
  Draft: 'טיוטה',
  AI_Extracting: 'חילוץ AI',
  Pending_Review: 'ממתין לבדיקה',
  Approved_For_Calc: 'מאושר לחישוב',
  Completed: 'הושלם',
};

export default function Badge({ status }: { status: SimulationStatus }) {
  const isExtracting = status === 'AI_Extracting';

  const badge = (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );

  if (isExtracting) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {badge}
      </motion.span>
    );
  }

  return badge;
}
