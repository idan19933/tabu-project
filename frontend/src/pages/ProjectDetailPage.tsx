import { ChevronDown, ChevronUp, FileText, Plus, Users, Shield, AlertTriangle, Landmark, Building2, Copy, Upload, Brain, Search, Loader2, MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createSimulation, cloneSimulation, getProject, uploadDocument, triggerResearch } from '../api';
import toast from 'react-hot-toast';
import BuildingMap from '../components/BuildingMap';
import AnimatedPage from '../components/ui/AnimatedPage';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';
import type { TabuData, TabuOwner, TabuLien, TabuMortgage } from '../types';

function TabuSection({
  title,
  icon: Icon,
  count,
  color,
  children,
}: {
  title: string;
  icon: typeof Users;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-right cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
            <Icon size={16} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-medium">
            {count}
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function normalizeOwners(raw: unknown[]): TabuOwner[] {
  return raw.map((item) =>
    typeof item === 'string' ? { name: item } : (item as TabuOwner),
  );
}

function normalizeLiens(raw: unknown[]): TabuLien[] {
  return raw.map((item) =>
    typeof item === 'string' ? { type: item } : (item as TabuLien),
  );
}

function normalizeMortgages(raw: unknown[]): TabuMortgage[] {
  return raw.map((item) =>
    typeof item === 'string' ? { creditor: item } : (item as TabuMortgage),
  );
}

function TabuPreview({ data }: { data: Record<string, unknown> }) {
  const tabu = data as TabuData;
  const owners = normalizeOwners((tabu.owners ?? []) as unknown[]);
  const rightsHolders = normalizeOwners(((tabu.rights ?? tabu.rights_holders ?? []) as unknown[]));
  const liens = normalizeLiens((tabu.liens ?? []) as unknown[]);
  const mortgages = normalizeMortgages((tabu.mortgages ?? []) as unknown[]);
  const warnings = (tabu.warnings ?? []) as (string | { type: string; details: string; date?: string })[];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>נתוני טאבו</h2>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/20">
            <Building2 size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-slate-800">פרטי נכס</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          {tabu.block && (
            <div>
              <span className="text-slate-500 text-xs">גוש</span>
              <p className="font-medium">{String(tabu.block)}</p>
            </div>
          )}
          {tabu.parcel && (
            <div>
              <span className="text-slate-500 text-xs">חלקה</span>
              <p className="font-medium">{String(tabu.parcel)}</p>
            </div>
          )}
          {tabu.sub_parcel && (
            <div>
              <span className="text-slate-500 text-xs">תת-חלקה</span>
              <p className="font-medium">{String(tabu.sub_parcel)}</p>
            </div>
          )}
          {tabu.area_sqm && (
            <div>
              <span className="text-slate-500 text-xs">שטח (מ&quot;ר)</span>
              <p className="font-medium">{String(tabu.area_sqm)}</p>
            </div>
          )}
          {tabu.address && (
            <div className="sm:col-span-2">
              <span className="text-slate-500 text-xs">כתובת</span>
              <p className="font-medium">{String(tabu.address)}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-2 mt-2">
        <TabuSection title="בעלים" icon={Users} count={owners.length} color="bg-blue-600">
          <div className="space-y-2">
            {owners.map((o, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-medium">{o.name}</span>
                  {o.id && <span className="text-slate-400 text-xs mr-2">({o.id})</span>}
                  {o.floor && <span className="text-slate-400 text-xs mr-2">קומה {o.floor}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {o.area_sqm && <span className="text-xs text-slate-500">{o.area_sqm} מ&quot;ר</span>}
                  {o.share && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{o.share}</span>}
                </div>
              </div>
            ))}
          </div>
        </TabuSection>

        <TabuSection title="בעלי זכויות" icon={Shield} count={rightsHolders.length} color="bg-indigo-600">
          <div className="space-y-2">
            {rightsHolders.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-medium">{r.name}</span>
                  {r.id && <span className="text-slate-400 text-xs mr-2">({r.id})</span>}
                </div>
                {r.share && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{r.share}</span>}
              </div>
            ))}
          </div>
        </TabuSection>

        <TabuSection title="שעבודים / עיקולים" icon={Shield} count={liens.length} color="bg-amber-500">
          <div className="space-y-2">
            {liens.map((l, i) => (
              <div key={i} className="text-sm py-1 border-b border-slate-100 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">{l.type}</span>
                  {l.date && <span className="text-xs text-slate-400">{l.date}</span>}
                </div>
                {l.authority && <p className="text-xs text-slate-500 mt-0.5">גורם: {l.authority}</p>}
                {l.regulation && <p className="text-xs text-slate-500">תקנה: {l.regulation}</p>}
                {l.holder && <p className="text-xs text-slate-500">לטובת: {l.holder}</p>}
                {l.amount && <p className="text-xs text-slate-500">סכום: {l.amount}</p>}
                {l.details && <p className="text-xs text-slate-500">{l.details}</p>}
              </div>
            ))}
          </div>
        </TabuSection>

        <TabuSection title="משכנתאות" icon={Landmark} count={mortgages.length} color="bg-amber-600">
          <div className="space-y-2">
            {mortgages.map((m, i) => (
              <div key={i} className="text-sm py-1 border-b border-slate-100 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">{m.creditor || m.lender || 'לא צוין'}</span>
                  {m.rank && <span className="text-xs text-slate-400">דרגה: {m.rank}</span>}
                </div>
                {m.company_id && <p className="text-xs text-slate-500 mt-0.5">ח.פ: {m.company_id}</p>}
                {m.share && <p className="text-xs text-slate-500">חלק: {m.share}</p>}
                {m.sub_parcel && <p className="text-xs text-slate-500">תת-חלקה: {m.sub_parcel}</p>}
                {m.amount && <p className="text-xs text-slate-500">סכום: {m.amount}</p>}
                {m.details && <p className="text-xs text-slate-500">{m.details}</p>}
              </div>
            ))}
          </div>
        </TabuSection>

        <TabuSection title="הערות אזהרה" icon={AlertTriangle} count={warnings.length} color="bg-red-600">
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="text-sm py-1 border-b border-red-100 last:border-0 bg-red-50 rounded px-2">
                {typeof w === 'string' ? (
                  <p className="text-xs text-red-600">{w}</p>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium text-red-700">{w.type}</span>
                      {w.date && <span className="text-xs text-red-400">{w.date}</span>}
                    </div>
                    <p className="text-xs text-red-600 mt-0.5">{w.details}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </TabuSection>
      </div>
    </section>
  );
}

const TABU_EXTRACTION_MESSAGES = [
  'קורא נסח טאבו...',
  'מחלץ בעלויות...',
  'מזהה משכנתאות...',
  'בודק שעבודים ועיקולים...',
  'מחלץ הערות אזהרה...',
  'מעבד נתוני נכס...',
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, loading, refetch } = useAsync(() => getProject(id!), [id]);
  const [showNewSim, setShowNewSim] = useState(false);
  const [simName, setSimName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extractionMsgIdx, setExtractionMsgIdx] = useState(0);
  const navigate = useNavigate();
  const extractionDoneRef = useRef(false);

  // Is tabu currently being extracted?
  const isTabuExtracting = project?.documents.some(
    (d) =>
      d.document_type === 'tabu' &&
      (d.extraction_status === 'Processing' || d.extraction_status === 'Pending'),
  ) ?? false;

  // Does a tabu document exist at all (regardless of extraction result)?
  const hasTabuDoc = project?.documents.some((d) => d.document_type === 'tabu') ?? false;
  // Does the project have AI-extracted tabu data?
  const hasTabuData = !!project?.tabu_data;
  // Did the tabu doc complete extraction but yield no data (mis-classified or error)?
  const tabuDocCompletedEmpty =
    hasTabuDoc &&
    !hasTabuData &&
    !isTabuExtracting &&
    (project?.documents.some(
      (d) => d.document_type === 'tabu' && d.extraction_status === 'Completed',
    ) ?? false);

  const researchStatus = project?.market_research_status;
  const researchData = project?.market_research_data;
  const isResearchRunning = researchStatus === 'running';
  const isResearchDone = researchStatus === 'completed' && !!researchData;

  // Poll project while tabu extraction or research is in progress
  useEffect(() => {
    if (!isTabuExtracting && !isResearchRunning) return;
    extractionDoneRef.current = false;
    const interval = setInterval(() => refetch(), 2000);
    return () => clearInterval(interval);
  }, [isTabuExtracting, isResearchRunning, refetch]);

  // Toast when extraction completes
  useEffect(() => {
    if (!project) return;
    const tabuDoc = project.documents.find((d) => d.document_type === 'tabu');
    if (
      tabuDoc?.extraction_status === 'Completed' &&
      project.tabu_data &&
      !extractionDoneRef.current
    ) {
      extractionDoneRef.current = true;
      toast.success('נסח טאבו חולץ בהצלחה');
    }
  }, [project]);

  // Cycle extraction messages
  useEffect(() => {
    if (!isTabuExtracting) {
      setExtractionMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setExtractionMsgIdx((i) => (i + 1) % TABU_EXTRACTION_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isTabuExtracting]);

  const handleTabuUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !id) return;
      const file = files[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('רק קבצי PDF נתמכים');
        return;
      }
      setUploading(true);
      extractionDoneRef.current = false;
      try {
        await uploadDocument(id, file, 'tabu');
        toast.success('נסח טאבו הועלה — AI מתחיל חילוץ');
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בהעלאה');
      } finally {
        setUploading(false);
      }
    },
    [id, refetch],
  );

  const handleCreateSim = async () => {
    if (!simName.trim() || !id) return;
    try {
      const sim = await createSimulation(id, simName.trim());
      setSimName('');
      setShowNewSim(false);
      toast.success('סימולציה נוצרה — העלה מסמכים בסביבת העבודה');
      navigate(`/simulations/${sim.id}/workspace`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה ביצירת סימולציה');
    }
  };

  const handleCloneSim = async (simId: string) => {
    try {
      const cloned = await cloneSimulation(simId);
      toast.success('הסימולציה שוכפלה');
      navigate(`/simulations/${cloned.id}/workspace`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשכפול');
    }
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const simClick = (simId: string, status: string) => {
    if (status === 'Completed') navigate(`/simulations/${simId}/results`);
    else navigate(`/simulations/${simId}/workspace`);
  };

  return (
    <AnimatedPage>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>
            {project.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            נוצר {new Date(project.created_at).toLocaleDateString('he-IL')}
          </p>
        </div>
        <Button onClick={() => setShowNewSim(true)}>
          <Plus size={16} />
          סימולציה חדשה
        </Button>
      </div>

      {/* Tabu Data — Upload zone / extracting / completed-empty / preview */}
      {hasTabuData ? (
        <>
          <TabuPreview data={project.tabu_data!} />
          {/* Building Map — show when gush/chelka available */}
          {(project.tabu_data as Record<string, unknown>)?.block && (project.tabu_data as Record<string, unknown>)?.parcel && (
            <section className="mb-6">
              <BuildingMap
                gush={String((project.tabu_data as Record<string, unknown>).block)}
                chelka={String((project.tabu_data as Record<string, unknown>).parcel)}
                address={(project.tabu_data as Record<string, unknown>).address as string | undefined}
                city={(project.tabu_data as Record<string, unknown>).city as string | undefined}
              />
            </section>
          )}
        </>
      ) : isTabuExtracting ? (
        /* Tabu extraction in progress */
        <section className="mb-6">
          <Card>
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Brain size={48} className="text-purple-600" />
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-purple-800 mb-1">
                  AI מחלץ נתוני טאבו...
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={extractionMsgIdx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-xs text-purple-500"
                  >
                    {TABU_EXTRACTION_MESSAGES[extractionMsgIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="w-64 h-2 bg-purple-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  animate={{ width: ['10%', '70%', '40%', '85%', '60%'] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </Card>
        </section>
      ) : tabuDocCompletedEmpty ? (
        /* Tabu doc uploaded but extraction produced no data — allow manual flow */
        <section className="mb-6">
          <Card>
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500 shrink-0">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  נסח טאבו הועלה — חילוץ AI לא הצליח לייצר נתונים
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ניתן ליצור סימולציה ולהזין פרמטרים ידנית, או להעלות קובץ חדש
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.onchange = () => handleTabuUpload(input.files);
                  input.click();
                }}
              >
                <Upload size={14} />
                העלה שוב
              </Button>
            </div>
          </Card>
        </section>
      ) : (
        /* No tabu doc at all — show upload zone (optional, not blocking) */
        <section className="mb-6">
          <Card>
            <div
              className="border-2 border-dashed border-primary-200 rounded-2xl p-10 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-all duration-300 cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleTabuUpload(e.dataTransfer.files);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.onchange = () => handleTabuUpload(input.files);
                input.click();
              }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Spinner size={32} />
                  <span className="text-sm text-slate-500">מעלה נסח טאבו...</span>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary-50 mx-auto mb-4 flex items-center justify-center">
                    <Upload size={28} className="text-primary-400" />
                  </div>
                  <p className="text-base font-bold text-slate-800 mb-1">
                    העלה נסח טאבו (PDF) — אופציונלי
                  </p>
                  <p className="text-sm text-slate-500">
                    גרור קובץ לכאן או לחץ להעלאה
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    AI יחלץ אוטומטית בעלויות, משכנתאות, שעבודים והערות אזהרה
                  </p>
                </>
              )}
            </div>
          </Card>
          <div className="flex items-center gap-2 mt-3 px-1">
            <p className="text-sm text-slate-400">
              ניתן גם ליצור סימולציה ולהזין את הפרמטרים ידנית ללא נסח טאבו
            </p>
          </div>
        </section>
      )}

      {/* Market Research Status */}
      {hasTabuData && !isResearchRunning && !isResearchDone && researchStatus !== 'failed' && (
        <section className="mb-6">
          <Card>
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100">
                <Search size={20} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">מחקר שוק אוטומטי</p>
                <p className="text-xs text-slate-400">חיפוש נתוני שוק, מחירים ועלויות בנייה לאזור הנכס</p>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await triggerResearch(id!);
                    refetch();
                    toast.success('מחקר שוק הופעל');
                  } catch {
                    toast.error('שגיאה בהפעלת מחקר שוק');
                  }
                }}
              >
                <Search size={14} />
                הפעל מחקר
              </Button>
            </div>
          </Card>
        </section>
      )}

      {hasTabuData && isResearchRunning && (
        <section className="mb-6">
          <Card>
            <div className="flex items-center gap-3 py-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Search size={20} className="text-blue-600" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  סוכן מחקר שוק פועל...
                </p>
                <p className="text-xs text-blue-500">
                  מחפש נתוני שוק, עלויות בנייה ומחירי מכירה לאזור הנכס
                </p>
              </div>
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </Card>
        </section>
      )}

      {hasTabuData && isResearchDone && (
        <section className="mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600">
                <MapPin size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-800">
                  ניתוח שוק אוטומטי הושלם
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {(researchData as Record<string, Record<string, string>>)?.research_summary?.neighborhood && (
                    <>שכונה: {(researchData as Record<string, Record<string, string>>).research_summary.neighborhood} | </>
                  )}
                  {(researchData as Record<string, Record<string, string>>)?.research_summary?.zoning && (
                    <>ייעוד: {(researchData as Record<string, Record<string, string>>).research_summary.zoning} | </>
                  )}
                  {(researchData as Record<string, Record<string, string>>)?.research_summary?.market_trend && (
                    <>מגמה: {(researchData as Record<string, Record<string, string>>).research_summary.market_trend}</>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await triggerResearch(id!, true);
                    refetch();
                    toast.success('מחקר שוק הופעל מחדש');
                  } catch {
                    toast.error('שגיאה בהפעלת מחקר שוק');
                  }
                }}
              >
                <Search size={14} />
                הפעל מחדש
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              ערכי ברירת מחדל מבוססי שוק יוחלו אוטומטית בסימולציה חדשה
            </p>
          </Card>
        </section>
      )}

      {hasTabuData && researchStatus === 'failed' && (
        <section className="mb-6">
          <Card>
            <div className="flex items-center gap-3 py-1">
              <AlertTriangle size={18} className="text-amber-500" />
              <div className="flex-1">
                <p className="text-sm text-amber-700">מחקר שוק נכשל</p>
                <p className="text-xs text-slate-400">ניתן להפעיל ידנית או להזין פרמטרים בסימולציה</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await triggerResearch(id!);
                    refetch();
                    toast.success('מחקר שוק הופעל מחדש');
                  } catch {
                    toast.error('שגיאה בהפעלת מחקר שוק');
                  }
                }}
              >
                <Search size={14} />
                נסה שוב
              </Button>
            </div>
          </Card>
        </section>
      )}

      {/* Documents (read-only list) */}
      {project.documents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>
            מסמכים ({project.documents.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.documents.map((doc) => (
              <Card key={doc.id}>
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-primary-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.document_type}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(doc.upload_date).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium ring-1 ring-inset ${
                      doc.extraction_status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : doc.extraction_status === 'Processing'
                          ? 'bg-violet-50 text-violet-700 ring-violet-200'
                          : doc.extraction_status === 'Failed'
                            ? 'bg-red-50 text-red-700 ring-red-200'
                            : 'bg-slate-50 text-slate-500 ring-slate-200'
                    }`}
                  >
                    {doc.extraction_status === 'Completed'
                      ? 'הושלם'
                      : doc.extraction_status === 'Processing'
                        ? 'מעבד'
                        : doc.extraction_status === 'Failed'
                          ? 'נכשל'
                          : 'ממתין'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Simulations — always visible */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Rubik, Heebo, sans-serif' }}>סימולציות</h2>
        </div>
        {!project.simulations.length ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-slate-400">אין סימולציות עדיין</p>
              <Button size="sm" onClick={() => setShowNewSim(true)}>
                <Plus size={14} /> צור סימולציה ראשונה
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {project.simulations.map((sim) => (
              <Card key={sim.id} hover>
                <div className="flex items-center justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => simClick(sim.id, sim.status)}
                  >
                    <h3 className="font-semibold text-slate-800">{sim.version_name}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(sim.created_at).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={sim.status} />
                    {(sim.status === 'Completed' || sim.status === 'Approved_For_Calc') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCloneSim(sim.id); }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title="שכפל סימולציה"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal open={showNewSim} onClose={() => setShowNewSim(false)} title="סימולציה חדשה">
        <div className="space-y-4">
          <Input
            label="שם הגרסה"
            placeholder="לדוגמה: תוכנית בסיס"
            value={simName}
            onChange={(e) => setSimName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSim()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowNewSim(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateSim} disabled={!simName.trim()}>
              צור סימולציה
            </Button>
          </div>
        </div>
      </Modal>
    </AnimatedPage>
  );
}
