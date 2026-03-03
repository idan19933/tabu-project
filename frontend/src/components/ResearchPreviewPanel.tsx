import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Lock,
  ShieldCheck,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { previewResearch, applyResearch } from '../api';
import Button from './ui/Button';
import Card from './ui/Card';
import type { ResearchPreviewField, ResearchPreviewResponse, ResearchSummary } from '../types';

interface ResearchPreviewPanelProps {
  projectId: string;
  simulationId: string;
  researchSummary: ResearchSummary | null;
  onApplied: () => void;
  onDismiss: () => void;
}

const SECTION_ORDER = ['תכנון', 'עלויות', 'הכנסות'];

function formatValue(val: number | null | undefined, isPct: boolean): string {
  if (val === null || val === undefined) return '—';
  if (isPct) return `${val}%`;
  if (Math.abs(val) >= 1_000_000) return `₪${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `₪${(val / 1_000).toFixed(0)}K`;
  return val % 1 === 0 ? val.toString() : val.toFixed(1);
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors = level === 'high'
    ? 'bg-emerald-100 text-emerald-700'
    : level === 'medium'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-slate-100 text-slate-500';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors}`}>
      {level === 'high' ? 'גבוה' : level === 'medium' ? 'בינוני' : level || '—'}
    </span>
  );
}

export default function ResearchPreviewPanel({
  projectId,
  simulationId,
  researchSummary,
  onApplied,
  onDismiss,
}: ResearchPreviewPanelProps) {
  const [preview, setPreview] = useState<ResearchPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'תכנון': true,
    'עלויות': true,
    'הכנסות': true,
  });

  useEffect(() => {
    setLoading(true);
    previewResearch(projectId, simulationId)
      .then(setPreview)
      .catch(() => toast.error('שגיאה בטעינת תצוגה מקדימה'))
      .finally(() => setLoading(false));
  }, [projectId, simulationId]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const result = await applyResearch(projectId, simulationId, overrides);
      const total =
        result.fields_populated.planning +
        result.fields_populated.costs +
        result.fields_populated.revenue +
        result.fields_populated.mix;
      toast.success(`הוחלו ${total} פרמטרים מנתוני שוק`);
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהחלת נתוני שוק');
    } finally {
      setApplying(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEditValue = (field: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setOverrides((prev) => ({ ...prev, [field]: num }));
    }
  };

  const getProposedValue = (f: ResearchPreviewField): number => {
    return overrides[f.field] ?? f.proposed;
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 size={20} className="animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">טוען תצוגה מקדימה...</span>
        </div>
      </Card>
    );
  }

  if (!preview) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600 shrink-0 mt-0.5">
              <MapPin size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">ניתוח שוק — תצוגה מקדימה</p>
              {researchSummary && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {researchSummary.neighborhood && <>שכונה: {researchSummary.neighborhood}</>}
                  {researchSummary.zoning && <> | ייעוד: {researchSummary.zoning}</>}
                  {researchSummary.market_trend && <> | מגמה: {researchSummary.market_trend}</>}
                </p>
              )}
            </div>
          </div>
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Quick Summary Bar */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-blue-700">{preview.summary.total_fields}</p>
            <p className="text-xs text-blue-500">שדות מוצעים</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{preview.summary.will_change}</p>
            <p className="text-xs text-emerald-500">ימולאו</p>
          </div>
          <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-slate-600">{preview.summary.will_keep}</p>
            <p className="text-xs text-slate-400">לא ישתנו (כבר מלאים)</p>
          </div>
          {preview.summary.locked_count > 0 && (
            <div className="flex-1 bg-amber-50 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-700">{preview.summary.locked_count}</p>
              <p className="text-xs text-amber-500">נעולים (טאבו)</p>
            </div>
          )}
        </div>

        {/* Confidence indicators */}
        {preview.confidence && Object.keys(preview.confidence).length > 0 && (
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
            <ShieldCheck size={12} className="text-slate-400 shrink-0" />
            <span>רמת ביטחון:</span>
            {Object.entries(preview.confidence).map(([key, level]) => (
              <span key={key} className="inline-flex items-center gap-1">
                {key === 'location' ? 'מיקום' : key === 'costs' ? 'עלויות' : key === 'prices' ? 'מחירים' : key}
                <ConfidenceBadge level={level} />
              </span>
            ))}
          </div>
        )}

        {/* Validation fixes warnings */}
        {preview.validation_fixes && preview.validation_fixes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
              <Info size={12} />
              תיקונים אוטומטיים ({preview.validation_fixes.length})
            </div>
            <ul className="text-[11px] text-amber-600 space-y-0.5 list-disc list-inside">
              {preview.validation_fixes.map((fix, idx) => (
                <li key={idx}>{fix}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Data Sources */}
        {preview.data_sources && Object.keys(preview.data_sources).length > 0 && (
          <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs font-medium text-slate-600 mb-1">מקורות מידע:</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(preview.data_sources).map(([key]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600"
                >
                  <ExternalLink size={10} />
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-2">
          {SECTION_ORDER.map((section) => {
            const fields = preview.grouped[section];
            if (!fields || fields.length === 0) return null;
            const isExpanded = expandedSections[section];
            const changeCount = fields.filter((f) => f.will_change).length;

            return (
              <div key={section} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section)}
                  className="flex items-center justify-between w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {section}
                    <span className="text-xs text-slate-400 mr-2">
                      ({changeCount}/{fields.length} ימולאו)
                    </span>
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="divide-y divide-slate-100">
                        {fields.map((f) => {
                          const proposedVal = getProposedValue(f);
                          const isEditing = editingField === f.field && !f.is_locked;
                          const hasOverride = f.field in overrides;

                          return (
                            <div
                              key={f.field}
                              className={`flex items-center gap-2 px-3 py-2 text-xs ${
                                f.is_locked
                                  ? 'bg-amber-50/50'
                                  : f.will_change
                                    ? 'bg-emerald-50/50'
                                    : 'bg-white opacity-60'
                              }`}
                            >
                              {/* Status icon */}
                              <div className="w-4 shrink-0">
                                {f.is_locked ? (
                                  <Lock size={12} className="text-amber-500" />
                                ) : f.will_change ? (
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                ) : (
                                  <AlertTriangle size={12} className="text-slate-300" />
                                )}
                              </div>

                              {/* Label */}
                              <span className={`flex-1 font-medium ${f.is_locked ? 'text-amber-700' : 'text-slate-700'}`}>
                                {f.label_he}
                                {f.is_locked && (
                                  <span className="text-[10px] text-amber-500 mr-1">(טאבו)</span>
                                )}
                              </span>

                              {/* Current */}
                              <span className="w-20 text-left text-slate-400">
                                {formatValue(f.current, f.is_pct)}
                              </span>

                              {/* Arrow */}
                              <span className="text-slate-300 px-1">{f.is_locked ? '=' : '→'}</span>

                              {/* Proposed (editable — except locked) */}
                              {f.is_locked ? (
                                <span className="w-20 text-left font-semibold text-amber-600">
                                  {formatValue(f.current, f.is_pct)}
                                </span>
                              ) : isEditing ? (
                                <input
                                  type="number"
                                  defaultValue={proposedVal}
                                  onBlur={(e) => {
                                    handleEditValue(f.field, e.target.value);
                                    setEditingField(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleEditValue(f.field, (e.target as HTMLInputElement).value);
                                      setEditingField(null);
                                    }
                                    if (e.key === 'Escape') setEditingField(null);
                                  }}
                                  autoFocus
                                  className="w-20 px-1 py-0.5 border border-blue-300 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingField(f.field)}
                                  className={`w-20 text-left font-semibold flex items-center gap-1 hover:text-blue-600 ${
                                    hasOverride ? 'text-blue-700' : f.will_change ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {formatValue(proposedVal, f.is_pct)}
                                  <Pencil size={9} className="opacity-0 group-hover:opacity-100 text-slate-300" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Apartment mix preview */}
        {preview.apartment_mix && preview.apartment_mix.length > 0 && (
          <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 bg-slate-50">
              <span className="text-sm font-medium text-slate-700">תמהיל דירות</span>
            </div>
            <div className="divide-y divide-slate-100">
              {preview.apartment_mix.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="flex-1 text-slate-700 font-medium">{item.apartment_type}</span>
                  <span className="text-slate-500">{item.quantity} יח׳</span>
                  <span className="text-slate-400">{item.percentage_of_mix}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            {Object.keys(overrides).length > 0 && (
              <span className="text-blue-500">{Object.keys(overrides).length} ערכים ערוכים ידנית</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              ביטול
            </Button>
            <Button size="sm" onClick={handleApply} disabled={applying}>
              {applying ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  מחיל...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  החל {preview.summary.will_change} שדות
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
