import { CheckCircle2, Loader2, AlertCircle, Circle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { AgentStatus, AgentStepStatus } from '../types';

const STEPS = [
  { key: 'extraction', label: 'חילוץ נתונים', emoji: '📄' },
  { key: 'research', label: 'חיפוש חכם', emoji: '🔍' },
  { key: 'calculation', label: 'חישוב', emoji: '🧮' },
  { key: 'alternatives', label: 'חלופות', emoji: '📊' },
] as const;

const STEP_LABELS: Record<string, string> = {
  extraction: 'מחלץ נתונים מהמסמכים...',
  research: 'מחפש ערכים חסרים...',
  calculation: 'מחשב כדאיות כלכלית...',
  alternatives: 'מייצר תרחישים וחלופות...',
};

function StepIcon({ status, emoji }: { status: AgentStepStatus['status']; emoji: string }) {
  switch (status) {
    case 'completed':
      return (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <CheckCircle2 size={28} className="text-emerald-500" />
        </motion.div>
      );
    case 'running':
      return (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <span className="text-2xl">{emoji}</span>
          {/* Spinning ring behind the emoji */}
          <motion.div
            className="absolute inset-[-4px] rounded-full border-2 border-blue-400 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      );
    case 'error':
      return <AlertCircle size={28} className="text-red-500" />;
    default:
      return <Circle size={28} className="text-slate-300" />;
  }
}

function stepDetail(step: AgentStepStatus): string | null {
  if (step.status === 'completed') {
    if ('docs_processed' in step) return `${step.docs_processed} מסמכים עובדו`;
    if ('fields_found' in step) return `${step.fields_found} שדות נמצאו`;
    if ('scenarios_count' in step) return `${step.scenarios_count} תרחישים`;
    return 'הושלם';
  }
  if (step.error) return step.error;
  return null;
}

function getActiveIndex(status: AgentStatus): number {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const s = (status[STEPS[i].key as keyof AgentStatus] as AgentStepStatus) || { status: 'pending' };
    if (s.status === 'running') return i;
    if (s.status === 'completed' || s.status === 'error') return i + 1;
  }
  return 0;
}

function ConnectorLine({ filled, active }: { filled: boolean; active: boolean }) {
  return (
    <div className="hidden sm:flex items-center flex-shrink-0 w-12 relative">
      {/* Background track */}
      <div className="h-[3px] w-full bg-slate-200 rounded-full overflow-hidden">
        {/* Animated fill */}
        <motion.div
          className="h-full rounded-full"
          initial={{ width: '0%' }}
          animate={{
            width: filled ? '100%' : active ? '50%' : '0%',
            backgroundColor: filled ? '#10b981' : '#3b82f6',
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {/* Animated particle on active connector */}
      {active && (
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-300"
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

interface Props {
  status: AgentStatus;
  lastEvent?: string | null;
}

export default function AgentProgress({ status, lastEvent }: Props) {
  const activeIndex = getActiveIndex(status);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isAnyRunning = STEPS.some(
    (s) => ((status[s.key as keyof AgentStatus] as AgentStepStatus) || { status: 'pending' }).status === 'running',
  );
  const allDone = STEPS.every((s) => {
    const st = ((status[s.key as keyof AgentStatus] as AgentStepStatus) || { status: 'pending' }).status;
    return st === 'completed' || st === 'error' || st === 'skipped';
  });

  // Elapsed timer
  useEffect(() => {
    if (!isAnyRunning) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isAnyRunning]);

  const runningStep = STEPS.find(
    (s) => ((status[s.key as keyof AgentStatus] as AgentStepStatus) || { status: 'pending' }).status === 'running',
  );

  return (
    <div className="space-y-4">
      {/* Pipeline visualization */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-hidden">
        {/* Step nodes + connectors */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const stepStatus = (status[step.key as keyof AgentStatus] as AgentStepStatus) || {
              status: 'pending' as const,
            };
            const isActive = stepStatus.status === 'running';
            const isDone = stepStatus.status === 'completed';
            const isError = stepStatus.status === 'error';
            const detail = stepDetail(stepStatus);

            return (
              <div key={step.key} className="contents">
                {/* Step card */}
                <motion.div
                  className={`flex flex-col items-center gap-1.5 relative ${
                    isActive ? 'z-10' : ''
                  }`}
                  animate={isActive ? { y: [0, -3, 0] } : { y: 0 }}
                  transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {/* Glow ring for active step */}
                  {isActive && (
                    <motion.div
                      className="absolute -inset-3 rounded-2xl bg-blue-100/60"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  {/* Icon circle */}
                  <div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                      isDone
                        ? 'border-emerald-400 bg-emerald-50'
                        : isActive
                          ? 'border-blue-400 bg-blue-50'
                          : isError
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <StepIcon status={stepStatus.status} emoji={step.emoji} />
                  </div>

                  {/* Label */}
                  <span
                    className={`text-xs font-medium text-center max-w-[80px] transition-colors ${
                      isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Detail badge */}
                  <AnimatePresence>
                    {detail && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {detail}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Connector between steps */}
                {i < STEPS.length - 1 && (
                  <ConnectorLine
                    filled={i < activeIndex - 1 || (i < activeIndex && !isActive)}
                    active={i === activeIndex - 1 && isAnyRunning}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Active step description bar */}
        <AnimatePresence mode="wait">
          {runningStep && (
            <motion.div
              key={runningStep.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mt-5 flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100"
            >
              <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />
              <span className="text-sm text-blue-700 flex-1">
                {STEP_LABELS[runningStep.key]}
              </span>
              <span className="text-xs text-blue-400 font-mono tabular-nums">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion celebration */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-3 bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-100"
            >
              <Sparkles size={16} className="text-emerald-500" />
              <span className="text-sm text-emerald-700 font-medium">
                כל השלבים הושלמו בהצלחה — מעבר לתוצאות...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live event ticker */}
      <AnimatePresence>
        {lastEvent && !allDone && (
          <motion.div
            key={lastEvent}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            {lastEvent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
