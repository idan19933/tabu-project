import { ChevronDown, ChevronUp, FileText, Plus, Users, Shield, AlertTriangle, Landmark, Building2, Copy, Upload, Brain, Lock, Search, Loader2, MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createSimulation, cloneSimulation, getProject, uploadDocument, triggerResearch } from '../api';
import toast from 'react-hot-toast';
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
        className="flex items-center justify-between w-full text-right cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={16} className="text-white" />
          </div>
          <h3 className="font-medium text-sm">{title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {count}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="mt-3 border-t pt-3">{children}</div>}
    </Card>
  );
}

function TabuPreview({ data }: { data: Record<string, unknown> }) {
  const tabu = data as TabuData;
  const owners = (tabu.owners ?? []) as TabuOwner[];
  const rightsHolders = (tabu.rights ?? tabu.rights_holders ?? []) as TabuOwner[];
  const liens = (tabu.liens ?? []) as TabuLien[];
  const mortgages = (tabu.mortgages ?? []) as TabuMortgage[];
  const warnings = (tabu.warnings ?? []) as (string | { type: string; details: string; date?: string })[];

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-3">נתוני טאבו</h2>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600">
            <Building2 size={16} className="text-white" />
          </div>
          <h3 className="font-medium">פרטי נכס</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
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

  const hasTabuData = !!project?.tabu_data;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            נוצר {new Date(project.created_at).toLocaleDateString('he-IL')}
          </p>
        </div>
        {hasTabuData && (
          <Button onClick={() => setShowNewSim(true)}>
            <Plus size={16} />
            סימולציה חדשה
          </Button>
        )}
      </div>

      {/* Tabu Data — Upload Gate or Preview */}
      {hasTabuData ? (
        <TabuPreview data={project.tabu_data!} />
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
      ) : (
        /* No tabu — Upload zone */
        <section className="mb-6">
          <Card>
            <div
              className="border-2 border-dashed border-purple-300 rounded-lg p-10 text-center hover:border-purple-500 hover:bg-purple-50/50 transition-all cursor-pointer"
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
                  <Upload size={40} className="mx-auto text-purple-400 mb-3" />
                  <p className="text-base font-semibold text-slate-700 mb-1">
                    העלה נסח טאבו (PDF)
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
          {/* Lock message */}
          <div className="flex items-center gap-2 mt-3 px-1">
            <Lock size={14} className="text-slate-400" />
            <p className="text-sm text-slate-400">
              יש להעלות נסח טאבו לפני יצירת סימולציה
            </p>
          </div>
        </section>
      )}

      {/* Market Research Status */}
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
          <h2 className="text-lg font-semibold mb-3">מסמכים ({project.documents.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    className={`text-xs px-2 py-0.5 rounded-full ${
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

      {/* Simulations — only visible when tabu exists */}
      {hasTabuData && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">סימולציות</h2>
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
            <div className="space-y-2">
              {project.simulations.map((sim) => (
                <Card key={sim.id} hover>
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => simClick(sim.id, sim.status)}
                    >
                      <h3 className="font-medium">{sim.version_name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
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
      )}

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
