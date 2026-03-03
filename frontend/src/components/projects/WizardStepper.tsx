import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

const STEPS = [
  { key: 'tabu', label: 'העלאת נסח טאבו' },
  { key: 'docs', label: 'העלאת מסמכים' },
  { key: 'ai', label: 'עיבוד AI' },
  { key: 'review', label: 'בדיקה ואישור' },
  { key: 'calc', label: 'חישוב' },
  { key: 'results', label: 'תוצאות' },
];

interface Props {
  currentStep: number; // 0-indexed
}

export default function WizardStepper({ currentStep }: Props) {
  return (
    <div className="mb-8">
      {/* Mobile: show only current step */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        <div
          className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2',
            'bg-primary-600 border-primary-600 text-white',
          )}
        >
          {currentStep + 1}
        </div>
        <span className="text-sm font-semibold text-primary-600">
          {STEPS[currentStep]?.label}
        </span>
        <span className="text-xs text-slate-400">
          ({currentStep + 1}/{STEPS.length})
        </span>
      </div>

      {/* Desktop: show all steps */}
      <div className="hidden sm:flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <motion.div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors',
                    isCompleted && 'bg-emerald-500 border-emerald-500 text-white',
                    isActive && 'bg-primary-600 border-primary-600 text-white',
                    !isCompleted && !isActive && 'bg-white border-slate-300 text-slate-400',
                  )}
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={isActive ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {isCompleted ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Check size={18} />
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                </motion.div>
                <span
                  className={clsx(
                    'text-xs mt-1.5 truncate max-w-[80px] lg:max-w-none',
                    isActive ? 'text-primary-600 font-semibold' : 'text-slate-400',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 mt-[-16px]">
                  <div
                    className={clsx(
                      'h-full transition-colors',
                      i < currentStep ? 'bg-emerald-400' : 'bg-slate-200',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Derive current wizard step from project state.
 * Uses the LATEST simulation's status (not the "highest" across all).
 * Returns 0-5.
 */
export function deriveWizardStep(project: {
  documents: { document_type: string; extraction_status?: string }[];
  simulations: { status: string; created_at: string }[];
  tabu_data?: unknown;
}): number {
  const hasTabuData = !!project.tabu_data;
  const hasTabuDoc = project.documents.some((d) => d.document_type === 'tabu');
  const hasProcessingDocs = project.documents.some((d) => d.extraction_status === 'Processing');

  // If any doc is still processing, show AI step
  if (hasProcessingDocs) return 2;

  // Use the LATEST simulation's status to determine step
  const sims = [...project.simulations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sims[0];

  if (latest) {
    if (latest.status === 'Completed') return 5;
    if (latest.status === 'Approved_For_Calc') return 4;
    if (latest.status === 'Pending_Review') return 3;
    if (latest.status === 'AI_Extracting') return 2;
    // Draft — show upload more docs step if we have tabu
    if (hasTabuData || hasTabuDoc) return 1;
  }

  if (hasTabuData || hasTabuDoc) return 1;
  return 0;
}
