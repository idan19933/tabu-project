import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { SimulationStatus } from '../../types';

const STATUS_STYLES: Record<SimulationStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  AI_Extracting: 'bg-violet-50 text-violet-700 ring-violet-200',
  Pending_Review: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved_For_Calc: 'bg-primary-50 text-primary-700 ring-primary-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
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
        'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        STATUS_STYLES[status],
      )}
    >
      {isExtracting && (
        <span className="relative flex h-2 w-2 me-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
        </span>
      )}
      {STATUS_LABELS[status]}
    </span>
  );

  if (isExtracting) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {badge}
      </motion.span>
    );
  }

  return badge;
}
