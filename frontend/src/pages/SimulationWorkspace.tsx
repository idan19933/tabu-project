import {
  ArrowRight,
  Upload,
  Play,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Loader2,
  Sparkles,
  Brain,
} from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getSimulation,
  getMissingFields,
  runPipeline,
  uploadDocumentToSimulation,
  getSimulationDocuments,
  getResearch,
} from '../api';
import AnimatedPage from '../components/ui/AnimatedPage';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import AgentProgress from '../components/AgentProgress';
import ResearchPreviewPanel from '../components/ResearchPreviewPanel';
import { useAsync } from '../hooks/useAsync';
import { useAgentStream } from '../hooks/useAgentStream';
import type { DocumentBrief, AgentStatus, ResearchSummary } from '../types';

function hasRunningAgent(agentStatus: Record<string, unknown> | null | undefined): boolean {
  if (!agentStatus || typeof agentStatus !== 'object') return false;
  return Object.values(agentStatus).some(
    (step) => typeof step === 'object' && step !== null && (step as Record<string, unknown>).status === 'running',
  );
}

/** Check if any doc is still being extracted */
function hasProcessingDocs(docs: DocumentBrief[] | null): boolean {
  if (!docs) return false;
  return docs.some((d) => d.extraction_status === 'Processing' || d.extraction_status === 'Pending');
}

const EXTRACTION_MESSAGES = [
  'AI קורא את המסמך...',
  'מזהה סוג מסמך...',
  'מחלץ פרמטרים תכנוניים...',
  'מחלץ נתוני עלויות...',
  'מחלץ נתוני הכנסות...',
  'ממזג נתונים לסימולציה...',
];

export default function SimulationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sim, loading, refetch } = useAsync(() => getSimulation(id!), [id]);
  const { data: docs, loading: docsLoading, refetch: refetchDocs } = useAsync(
    () => getSimulationDocuments(id!),
    [id],
  );
  const { data: missing, loading: missingLoading, refetch: refetchMissing } = useAsync(
    () => getMissingFields(id!),
    [id],
  );

  const [uploading, setUploading] = useState(false);
  const [pipelineTriggered, setPipelineTriggered] = useState(false);
  const [triggeringPipeline, setTriggeringPipeline] = useState(false);
  const [researchApplied, setResearchApplied] = useState(false);
  const [researchSummary, setResearchSummary] = useState<Record<string, string> | null>(null);
  const [researchStatus, setResearchStatus] = useState<string | null>(null);
  const autoConnectedRef = useRef(false);
  const researchCheckedRef = useRef(false);
  const [extractionMsgIdx, setExtractionMsgIdx] = useState(0);
  const extractionCompleteRef = useRef(false);

  const { status: agentStatus, isRunning, isComplete, lastEvent, connect } = useAgentStream(
    pipelineTriggered ? id! : null,
  );

  // --- Extraction polling: poll docs every 2s while any are Processing/Pending ---
  const isExtracting = hasProcessingDocs(docs);

  useEffect(() => {
    if (!isExtracting) return;
    extractionCompleteRef.current = false;
    const interval = setInterval(() => {
      refetchDocs();
    }, 2000);
    return () => clearInterval(interval);
  }, [isExtracting, refetchDocs]);

  // When extraction finishes (was extracting, now all done), refresh everything
  useEffect(() => {
    if (!docs || docs.length === 0) return;
    const allDone = docs.every(
      (d) => d.extraction_status === 'Completed' || d.extraction_status === 'Failed',
    );
    const anyCompleted = docs.some((d) => d.extraction_status === 'Completed');
    if (allDone && anyCompleted && !extractionCompleteRef.current) {
      extractionCompleteRef.current = true;
      toast.success('חילוץ הושלם — שדות עודכנו');
      // Refresh missing fields and simulation data
      refetchMissing();
      refetch();
    }
  }, [docs, refetchMissing, refetch]);

  // Cycle extraction messages while extracting
  useEffect(() => {
    if (!isExtracting) {
      setExtractionMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setExtractionMsgIdx((i) => (i + 1) % EXTRACTION_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isExtracting]);

  // Auto-detect running pipeline on page load
  useEffect(() => {
    if (sim && !autoConnectedRef.current && hasRunningAgent(sim.agent_status as unknown as Record<string, unknown>)) {
      autoConnectedRef.current = true;
      setPipelineTriggered(true);
      // connect() will be called by the effect below after re-render
    }
  }, [sim]);

  // Connect SSE when pipeline is triggered (after re-render so connect has correct simulationId)
  useEffect(() => {
    if (pipelineTriggered) {
      connect();
    }
  }, [pipelineTriggered, connect]);

  // Auto-refetch and navigate to results when pipeline completes
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        refetch();
        refetchMissing();
        toast.success('החישוב הושלם — מעבר לתוצאות');
        setTimeout(() => navigate(`/simulations/${id}/results`), 2000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, refetch, refetchMissing, navigate, id]);

  // Check if market research is available and offer to apply
  useEffect(() => {
    if (!sim || researchCheckedRef.current) return;
    researchCheckedRef.current = true;
    getResearch(sim.project_id).then((res) => {
      setResearchStatus(res.status);
      if (res.status === 'completed' && res.summary) {
        setResearchSummary(res.summary as Record<string, string>);
      }
    }).catch(() => {
      // Silently fail — research is optional
    });
  }, [sim]);

  // Poll research status if running
  useEffect(() => {
    if (researchStatus !== 'running' || !sim) return;
    const interval = setInterval(() => {
      getResearch(sim.project_id).then((res) => {
        setResearchStatus(res.status);
        if (res.status === 'completed' && res.summary) {
          setResearchSummary(res.summary as Record<string, string>);
          toast.success('מחקר שוק הושלם — ניתן להחיל ערכי ברירת מחדל');
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [researchStatus, sim]);

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !sim || !id) return;
      setUploading(true);
      extractionCompleteRef.current = false;
      try {
        for (const file of Array.from(files)) {
          if (!file.name.toLowerCase().endsWith('.pdf')) {
            toast.error(`${file.name} — רק קבצי PDF נתמכים`);
            continue;
          }
          await uploadDocumentToSimulation(sim.project_id, id, file, 'general');
          toast.success(`${file.name} הועלה — AI מתחיל חילוץ`);
        }
        // Immediately refetch to show the new docs with "Pending" status
        refetchDocs();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בהעלאה');
      } finally {
        setUploading(false);
      }
    },
    [sim, id, refetchDocs],
  );

  // Fallback: poll simulation while pipeline is running (in case SSE drops)
  useEffect(() => {
    if (!pipelineTriggered || isComplete) return;
    const interval = setInterval(() => {
      refetch();
    }, 4000);
    return () => clearInterval(interval);
  }, [pipelineTriggered, isComplete, refetch]);

  // Detect pipeline completion from polled data (SSE fallback)
  useEffect(() => {
    if (!pipelineTriggered || isComplete) return;
    if (sim?.status === 'Completed' && sim?.simulation_results) {
      toast.success('החישוב הושלם — מעבר לתוצאות');
      setTimeout(() => navigate(`/simulations/${id}/results`), 2000);
    }
  }, [sim, pipelineTriggered, isComplete, navigate, id]);

  const handleRunPipeline = async () => {
    if (!id) return;
    setTriggeringPipeline(true);
    try {
      await runPipeline(id);
      setPipelineTriggered(true);
      // connect() will be called by the useEffect above after re-render
      toast.success('הצינור הופעל — מעקב בזמן אמת');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהפעלת הצינור');
    } finally {
      setTriggeringPipeline(false);
    }
  };

  if (loading || !sim) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner size={32} />
        <p className="text-sm text-slate-400">טוען סימולציה...</p>
      </div>
    );
  }

  const hasResults = !!sim.simulation_results;
  const completedDocs = docs?.filter((d) => d.extraction_status === 'Completed').length ?? 0;
  const totalDocs = docs?.length ?? 0;

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`/projects/${sim.project_id}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-4 cursor-pointer transition-colors"
        >
          <ArrowRight size={16} />
          חזרה לפרויקט
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{sim.version_name}</h1>
          <div className="flex items-center gap-2">
            {hasResults && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/simulations/${id}/results`)}
              >
                <BarChart3 size={16} />
                צפה בתוצאות
              </Button>
            )}
          </div>
        </div>

        {/* 1. Upload Zone */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            <Upload size={18} className="inline ml-2" />
            העלאת מסמכים
          </h2>
          <Card>
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.multiple = true;
                input.onchange = () => handleFileUpload(input.files);
                input.click();
              }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Spinner size={24} />
                  <span className="text-sm text-slate-500">מעלה קבצים...</span>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">
                    גרור קבצי PDF לכאן או לחץ להעלאה
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    AI יזהה אוטומטית את סוג המסמך (תב&quot;ע / כלכלי / שמאות)
                  </p>
                </>
              )}
            </div>

            {/* Uploaded docs list */}
            {docsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size={16} />
                <span className="text-xs text-slate-400 mr-2">טוען מסמכים...</span>
              </div>
            ) : docs && docs.length > 0 ? (
              <div className="mt-4 space-y-2">
                <AnimatePresence>
                  {docs.map((doc: DocumentBrief) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        doc.extraction_status === 'Processing'
                          ? 'bg-purple-50 border border-purple-100'
                          : doc.extraction_status === 'Completed'
                            ? 'bg-emerald-50 border border-emerald-100'
                            : doc.extraction_status === 'Failed'
                              ? 'bg-red-50 border border-red-100'
                              : 'bg-slate-50'
                      }`}
                    >
                      {doc.extraction_status === 'Processing' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          <Brain size={18} className="text-purple-500" />
                        </motion.div>
                      ) : doc.extraction_status === 'Completed' ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        >
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        </motion.div>
                      ) : (
                        <FileText size={18} className="text-slate-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">
                          {doc.document_type === 'general' ? 'מסמך כללי' : doc.document_type}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(doc.upload_date).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          doc.extraction_status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.extraction_status === 'Processing'
                              ? 'bg-purple-100 text-purple-700'
                              : doc.extraction_status === 'Failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {doc.extraction_status === 'Completed'
                          ? 'חולץ בהצלחה'
                          : doc.extraction_status === 'Processing'
                            ? (
                              <span className="flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" />
                                מחלץ...
                              </span>
                            )
                            : doc.extraction_status === 'Failed'
                              ? 'נכשל'
                              : (
                                <span className="flex items-center gap-1">
                                  <Loader2 size={10} className="animate-spin" />
                                  בתור
                                </span>
                              )}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : null}

            {/* Live extraction progress bar */}
            <AnimatePresence>
              {isExtracting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="bg-purple-50 rounded-lg border border-purple-100 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Brain size={20} className="text-purple-600" />
                      </motion.div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-800">
                          AI מחלץ נתונים ({completedDocs}/{totalDocs})
                        </p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={extractionMsgIdx}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-xs text-purple-500"
                          >
                            {EXTRACTION_MESSAGES[extractionMsgIdx]}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                        initial={{ width: '5%' }}
                        animate={{
                          width: totalDocs > 0
                            ? `${Math.max(10, (completedDocs / totalDocs) * 100)}%`
                            : '10%',
                        }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Extraction complete celebration */}
            <AnimatePresence>
              {!isExtracting && completedDocs > 0 && extractionCompleteRef.current && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-center gap-3 bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-100"
                >
                  <Sparkles size={16} className="text-emerald-500" />
                  <span className="text-sm text-emerald-700 font-medium">
                    חילוץ הושלם — {completedDocs} מסמכים עובדו בהצלחה
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </section>

        {/* 1.5 Market Research Preview Panel */}
        {researchStatus === 'completed' && researchSummary && !researchApplied && sim && id && (
          <section className="mb-6">
            <ResearchPreviewPanel
              projectId={sim.project_id}
              simulationId={id}
              researchSummary={researchSummary as ResearchSummary}
              onApplied={() => {
                setResearchApplied(true);
                refetch();
                refetchMissing();
              }}
              onDismiss={() => setResearchApplied(true)}
            />
          </section>
        )}

        {researchStatus === 'completed' && researchApplied && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">
                  ערכי ברירת מחדל מבוססי שוק הוחלו בהצלחה
                </span>
              </div>
            </Card>
          </motion.section>
        )}

        {researchStatus === 'running' && (
          <section className="mb-6">
            <Card>
              <div className="flex items-center gap-3 py-1">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-800">סוכן מחקר שוק פועל...</p>
                  <p className="text-xs text-blue-500">מחפש נתוני שוק לאזור הנכס</p>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* 2. Missing Fields Panel */}
        {missingLoading ? (
          <section className="mb-6">
            <Card>
              <div className="flex items-center gap-2 py-4 justify-center">
                <Spinner size={16} />
                <span className="text-sm text-slate-400">בודק שדות חסרים...</span>
              </div>
            </Card>
          </section>
        ) : missing && !missing.ready ? (
          <motion.section
            key="missing-fields"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h2 className="text-lg font-semibold mb-3">
              <AlertTriangle size={18} className="inline ml-2 text-amber-500" />
              שדות חסרים
            </h2>
            <Card>
              <div className="space-y-3">
                {missing.missing_planning.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">תכנון:</p>
                    <div className="flex flex-wrap gap-1">
                      {missing.missing_planning.map((f) => (
                        <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {missing.missing_cost.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">עלויות:</p>
                    <div className="flex flex-wrap gap-1">
                      {missing.missing_cost.map((f) => (
                        <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {missing.missing_revenue.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">הכנסות:</p>
                    <div className="flex flex-wrap gap-1">
                      {missing.missing_revenue.map((f) => (
                        <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {missing.missing_mix && (
                  <p className="text-sm text-amber-600">חסר תמהיל דירות</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  העלה מסמכים נוספים או מלא ידנית דרך{' '}
                  <button
                    onClick={() => navigate(`/simulations/${id}/edit`)}
                    className="text-primary-600 underline cursor-pointer"
                  >
                    עריכת פרמטרים
                  </button>
                </p>
              </div>
            </Card>
          </motion.section>
        ) : missing?.ready && !pipelineTriggered && !hasResults ? (
          <motion.section
            key="ready-for-calc"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">כל השדות מוכנים לחישוב</p>
                  <p className="text-xs text-slate-500">
                    ניתן להפעיל את צינור הסוכנים לחישוב מלא עם חלופות
                  </p>
                </div>
              </div>
            </Card>
          </motion.section>
        ) : null}

        {/* 3. Agent Pipeline — only shown when all fields are ready, or pipeline already triggered/has results */}
        {(missing?.ready || pipelineTriggered || hasResults) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                <Play size={18} className="inline ml-2" />
                צינור סוכנים
              </h2>
              {!pipelineTriggered && !hasResults && (
                <Button onClick={handleRunPipeline} disabled={isRunning || triggeringPipeline}>
                  {triggeringPipeline ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      מפעיל...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      הפעל חישוב מלא
                    </>
                  )}
                </Button>
              )}
            </div>

            {(pipelineTriggered || sim.agent_status) && (() => {
              // Use SSE status only if it has real updates (not all pending)
              const sseHasUpdates = pipelineTriggered && agentStatus &&
                Object.values(agentStatus).some(s => s.status !== 'pending');
              return (
                <AgentProgress
                  status={
                    sseHasUpdates
                      ? agentStatus
                      : (sim.agent_status as AgentStatus) || agentStatus || {
                          extraction: { status: 'pending' },
                          research: { status: 'pending' },
                          calculation: { status: 'pending' },
                          alternatives: { status: 'pending' },
                        }
                  }
                  lastEvent={sseHasUpdates ? lastEvent : null}
                />
              );
            })()}

            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center gap-3"
                >
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">הצינור הושלם!</span>
                  <Button onClick={() => navigate(`/simulations/${id}/results`)}>
                    <BarChart3 size={16} />
                    צפה בתוצאות
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* 4. Inline Results Summary */}
        <AnimatePresence>
          {hasResults && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="text-lg font-semibold mb-3">סיכום תוצאות</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <p className="text-xs text-slate-500">רווח</p>
                  <p className="text-lg font-bold">
                    {new Intl.NumberFormat('he-IL', {
                      style: 'currency',
                      currency: 'ILS',
                      maximumFractionDigits: 0,
                    }).format(sim.simulation_results!.expected_profit ?? sim.simulation_results!.profit)}
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-slate-500">IRR</p>
                  <p className="text-lg font-bold">
                    {sim.simulation_results!.irr?.toFixed(1)}%
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-slate-500">רווחיות</p>
                  <p className="text-lg font-bold">
                    {(sim.simulation_results!.profit_percent ?? sim.simulation_results!.profitability_rate)?.toFixed(1)}%
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-slate-500">NPV</p>
                  <p className="text-lg font-bold">
                    {new Intl.NumberFormat('he-IL', {
                      style: 'currency',
                      currency: 'ILS',
                      maximumFractionDigits: 0,
                    }).format(sim.simulation_results!.npv)}
                  </p>
                </Card>
              </div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/simulations/${id}/results`)}
                >
                  צפה בתוצאות מלאות →
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </AnimatedPage>
  );
}
