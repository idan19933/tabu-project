import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getExtractionStatus } from '../../api';
import { usePolling } from '../../hooks/usePolling';
import type { ExtractionStatusResponse, DocumentExtractionStatus } from '../../types';

interface Props {
  projectId: string;
}

function DocStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'Completed':
      return <CheckCircle size={16} className="text-emerald-500" />;
    case 'Processing':
      return <Loader2 size={16} className="text-primary-500 animate-spin" />;
    case 'Failed':
      return <AlertTriangle size={16} className="text-red-500" />;
    default:
      return <Clock size={16} className="text-slate-400" />;
  }
}

function DocStatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    Pending: 'ממתין',
    Processing: 'מעבד...',
    Completed: 'הושלם',
    Failed: 'נכשל',
  };
  return <span className="text-xs">{labels[status] || status}</span>;
}

function TabuBadge({ data }: { data: Record<string, unknown> }) {
  const block = data.block ? String(data.block) : null;
  const parcel = data.parcel ? String(data.parcel) : '-';
  if (!block) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4"
    >
      <p className="text-sm font-semibold text-emerald-700 mb-1">נתוני טאבו זוהו</p>
      <p className="text-xs text-emerald-600">
        גוש: {block} | חלקה: {parcel}
      </p>
    </motion.div>
  );
}

export default function AIProcessingView({ projectId }: Props) {
  const navigate = useNavigate();
  const [typewriterText, setTypewriterText] = useState('');

  const fetchStatus = useCallback(
    () => getExtractionStatus(projectId),
    [projectId],
  );

  const { data: status } = usePolling<ExtractionStatusResponse>(
    fetchStatus,
    2000,
    true,
  );

  const progress = status?.extraction_progress;
  const currentStep = progress?.current_step || 'מאתחל חילוץ...';
  const percentage = progress?.percentage || 0;

  // Typewriter effect for current step
  useEffect(() => {
    setTypewriterText('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < currentStep.length) {
        setTypewriterText(currentStep.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [currentStep]);

  // Auto-advance when extraction is done
  useEffect(() => {
    if (status?.active_simulation_status === 'Pending_Review' && status.active_simulation_id) {
      setTimeout(() => {
        navigate(`/simulations/${status.active_simulation_id}/review`);
      }, 1500);
    }
  }, [status, navigate]);

  const docs = status?.documents || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-6"
    >
      {/* Header with Bot icon */}
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center"
        >
          <Bot size={24} className="text-purple-600" />
        </motion.div>
        <div>
          <h3 className="font-semibold text-lg">AI מעבד את המסמכים</h3>
          <p className="text-sm text-slate-500">{typewriterText}<span className="animate-pulse">|</span></p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-1.5">
          <span>התקדמות</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-l from-purple-500 to-primary-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Per-document status cards */}
      <div className="space-y-2">
        {docs.map((doc: DocumentExtractionStatus, i: number) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <DocStatusIcon status={doc.extraction_status} />
              <span className="text-sm font-medium">{doc.document_type}</span>
            </div>
            <DocStatusLabel status={doc.extraction_status} />
          </motion.div>
        ))}
      </div>

      {/* Tabu data preview */}
      {status?.tabu_data && (
        <TabuBadge data={status.tabu_data} />
      )}
    </motion.div>
  );
}
