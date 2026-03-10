import { useState } from 'react';
import {
  Lock,
  Globe,
  Calculator,
  Database,
  UserPen,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Info,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getDataSources } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import Spinner from '../ui/Spinner';
import type { ProvenanceField, SourceType, LiveDataSources } from '../../types';

interface DataSourcesPanelProps {
  simId: string;
}

const SOURCE_CONFIG: Record<SourceType, { label: string; icon: typeof Lock; color: string; bg: string; border: string }> = {
  tabu:            { label: 'טאבו',          icon: Lock,       color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  live_api:        { label: 'API ממשלתי',    icon: Zap,        color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  market_research: { label: 'מחקר שוק',      icon: Globe,      color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  calculated:      { label: 'חישוב',         icon: Calculator,  color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  default:         { label: 'ברירת מחדל',    icon: Database,    color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  user_input:      { label: 'קלט משתמש',     icon: UserPen,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  unknown:         { label: 'לא ידוע',       icon: HelpCircle,  color: 'text-slate-400',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const SOURCE_ORDER: SourceType[] = ['tabu', 'live_api', 'market_research', 'calculated', 'default', 'user_input', 'unknown'];

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

function formatValue(val: number | string): string {
  if (typeof val === 'string') return val;
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M ₪`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K ₪`;
  if (val % 1 !== 0) return val.toFixed(1);
  return val.toString();
}

function SourceSection({
  sourceType,
  fields,
  defaultExpanded,
}: {
  sourceType: SourceType;
  fields: ProvenanceField[];
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg overflow-hidden ${config.border}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-2.5 ${config.bg} cursor-pointer transition-colors hover:opacity-90`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className={config.color} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          <span className="text-xs text-slate-400">({fields.length} שדות)</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {fields.map((f) => (
            <div key={f.field} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50/50">
              <div className="flex-1 min-w-0">
                <span className="text-slate-700">{f.label_he}</span>
                {f.source_detail && (
                  <span className="text-[11px] text-slate-400 mr-2">— {f.source_detail}</span>
                )}
              </div>
              <div className="text-left font-mono text-slate-600 shrink-0 mr-4">
                {formatValue(f.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveDataSourcesBadges({ sources }: { sources: LiveDataSources }) {
  const items: { key: string; label: string; detail: string; ok: boolean }[] = [];

  if (sources.cbs_construction_index) {
    const cbs = sources.cbs_construction_index;
    items.push({
      key: 'cbs',
      label: 'מדד CBS',
      detail: cbs.status === 'success'
        ? `${cbs.value} (${cbs.date})${cbs.yoy_change_pct != null ? ` | שנתי: ${cbs.yoy_change_pct}%` : ''}`
        : cbs.reason || 'לא זמין',
      ok: cbs.status === 'success',
    });
  }
  if (sources.geocode) {
    const geo = sources.geocode;
    items.push({
      key: 'geocode',
      label: 'מיקום מאומת',
      detail: geo.status === 'success'
        ? `${geo.lat?.toFixed(4)}, ${geo.lon?.toFixed(4)}`
        : geo.reason || 'לא זמין',
      ok: geo.status === 'success',
    });
  }
  if (sources.nadlan_deals) {
    const nd = sources.nadlan_deals;
    items.push({
      key: 'nadlan',
      label: 'עסקאות נדל"ן',
      detail: nd.status === 'success'
        ? `${nd.count} עסקאות`
        : nd.reason || 'לא זמין',
      ok: nd.status === 'success',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1.5">
        <Zap size={12} />
        נתונים חיים מ-API ממשלתי
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-xs">
            {item.ok ? (
              <CheckCircle2 size={11} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={11} className="text-slate-400 shrink-0" />
            )}
            <span className={item.ok ? 'text-green-700 font-medium' : 'text-slate-400'}>
              {item.label}:
            </span>
            <span className={item.ok ? 'text-green-600' : 'text-slate-400'}>
              {item.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DataSourcesPanel({ simId }: DataSourcesPanelProps) {
  const { data, loading, error } = useAsync(() => getDataSources(simId), [simId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2">
        <Spinner size={20} />
        <span className="text-sm text-slate-400">טוען מקורות נתונים...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 space-y-2">
        <AlertTriangle size={32} className="mx-auto text-slate-300" />
        <p className="text-sm text-slate-400">
          {error ? `שגיאה: ${error}` : 'אין נתונים זמינים'}
        </p>
      </div>
    );
  }

  const grouped = data.grouped_by_source;

  // Summary counts
  const countBySource: Record<string, number> = {};
  for (const [src, fields] of Object.entries(grouped)) {
    countBySource[src] = fields.length;
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-2">
        {SOURCE_ORDER.filter((s) => countBySource[s]).map((sourceType) => {
          const config = SOURCE_CONFIG[sourceType];
          const Icon = config.icon;
          return (
            <div
              key={sourceType}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.border} ${config.bg} ${config.color}`}
            >
              <Icon size={12} />
              {config.label}: {countBySource[sourceType]}
            </div>
          );
        })}
      </div>

      {/* Confidence badges */}
      {data.confidence && Object.keys(data.confidence).length > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <ShieldCheck size={12} className="text-slate-400 shrink-0" />
          <span>רמת ביטחון:</span>
          {Object.entries(data.confidence).map(([key, level]) => (
            <span key={key} className="inline-flex items-center gap-1">
              {key === 'location' ? 'מיקום' : key === 'costs' ? 'עלויות' : key === 'prices' ? 'מחירים' : key}
              <ConfidenceBadge level={level} />
            </span>
          ))}
        </div>
      )}

      {/* Live API data sources */}
      {data.live_data_sources && Object.keys(data.live_data_sources).length > 0 && (
        <LiveDataSourcesBadges sources={data.live_data_sources} />
      )}

      {/* Web search sources */}
      {data.data_sources && Object.keys(data.data_sources).length > 0 && (
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-slate-600 mb-1.5">מקורות חיפוש:</p>
          <div className="space-y-1">
            {Object.entries(data.data_sources).map(([key, val]) => {
              const display = Array.isArray(val) ? val.join(', ') : val;
              if (!display) return null;
              return (
                <div key={key} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <ExternalLink size={10} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <span className="font-medium">
                      {key === 'location' ? 'מיקום' : key === 'costs' || key === 'construction_costs' ? 'עלויות' : key === 'prices' || key === 'sales_prices' ? 'מחירים' : key === 'planning' ? 'תכנון' : key === 'comparable_projects' ? 'פרויקטים דומים' : key}:
                    </span>{' '}
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparable projects */}
      {data.comparable_projects && (
        <div className="bg-blue-50 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-blue-700 mb-1">פרויקטים להשוואה:</p>
          <p className="text-xs text-blue-600">{data.comparable_projects}</p>
        </div>
      )}

      {/* Grouped sections */}
      <div className="space-y-2">
        {SOURCE_ORDER.filter((s) => grouped[s]?.length).map((sourceType, idx) => (
          <SourceSection
            key={sourceType}
            sourceType={sourceType}
            fields={grouped[sourceType]}
            defaultExpanded={idx < 2}
          />
        ))}
      </div>

      {/* Validation fixes */}
      {data.validation_fixes && data.validation_fixes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
            <Info size={12} />
            תיקונים אוטומטיים ({data.validation_fixes.length})
          </div>
          <ul className="text-[11px] text-amber-600 space-y-0.5 list-disc list-inside">
            {data.validation_fixes.map((fix, idx) => (
              <li key={idx}>{fix}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
