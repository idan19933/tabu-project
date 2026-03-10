import {
  ArrowRight,
  BarChart3,
  TrendingUp,
  Percent,
  DollarSign,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  LayoutGrid,
  Layers,
  Lightbulb,
  Database,
} from 'lucide-react';
import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { getSimulation, getProjectSimulations, downloadReport, getDeltaAnalysis, getParameterSensitivity, getAlternatives, runPipeline } from '../api';
import ScenariosComparison from '../components/results/ScenariosComparison';
import AIRecommendations from '../components/results/AIRecommendations';
import DataSourcesPanel from '../components/results/DataSourcesPanel';
import toast from 'react-hot-toast';
import AnimatedPage from '../components/ui/AnimatedPage';
import Card from '../components/ui/Card';
import CountUp from '../components/ui/CountUp';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: decimals }).format(n);
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  formatFn,
  index,
}: {
  icon: typeof DollarSign;
  label: string;
  value: number;
  color: string;
  formatFn: (n: number) => string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <CountUp value={value} formatFn={formatFn} className="text-lg font-bold" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: typeof DollarSign;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-right cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-slate-500" />}
          <h3 className="font-semibold">{title}</h3>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function DetailRow({ label, value, unit = '' }: { label: string; value: string | number | null | undefined; unit?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium">{value != null ? `${value}${unit}` : '—'}</span>
    </div>
  );
}

function SensitivityMatrix({
  netRevenue,
  totalCosts,
}: {
  netRevenue: number;
  totalCosts: number;
}) {
  const pctChanges = [-20, -10, 0, 10, 20];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              הכנסות \ עלויות
            </th>
            {pctChanges.map((p) => (
              <th key={p} className="border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                {p > 0 ? '+' : ''}{p}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pctChanges.map((revPct) => (
            <tr key={revPct}>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium">
                {revPct > 0 ? '+' : ''}{revPct}% הכנסות
              </td>
              {pctChanges.map((costPct) => {
                const adjRev = netRevenue * (1 + revPct / 100);
                const adjCost = totalCosts * (1 + costPct / 100);
                const profit = adjRev - adjCost;
                const isBase = revPct === 0 && costPct === 0;
                return (
                  <td
                    key={costPct}
                    className={`border border-slate-200 px-3 py-2 text-center font-mono text-xs ${
                      isBase ? 'bg-yellow-50 font-bold'
                        : profit < 0 ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {formatCurrency(profit)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DELTA_LABELS: Record<string, string> = {
  profit: 'רווח',
  expected_profit: 'רווח צפוי',
  profitability_rate: 'שיעור רווחיות',
  profit_percent: '% רווח',
  irr: 'IRR',
  npv: 'NPV',
  total_revenue: 'סה"כ הכנסות',
  net_revenue: 'הכנסות נטו',
  total_costs: 'סה"כ עלויות',
  total_costs_incl_vat: 'עלויות כולל מע"מ',
  total_costs_excl_vat: 'עלויות ללא מע"מ',
};

function DeltaSection({ simId }: { simId: string }) {
  const { data: delta, loading } = useAsync(() => getDeltaAnalysis(simId), [simId]);

  if (loading || !delta || !delta.has_delta) return null;

  return (
    <CollapsibleSection title="השוואה לחישוב קודם (Delta)" icon={TrendingUp} defaultOpen>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(delta.deltas).map(([field, d]) => {
          const improved = field.includes('cost') ? d.change < 0 : d.change > 0;
          return (
            <div
              key={field}
              className={`rounded-lg p-3 border ${improved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <p className="text-xs text-slate-500">{DELTA_LABELS[field] ?? field}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm text-slate-400 line-through">{formatCurrency(d.before)}</span>
                <span className="text-sm font-bold">{formatCurrency(d.after)}</span>
              </div>
              <p className={`text-xs font-medium mt-0.5 ${improved ? 'text-green-700' : 'text-red-700'}`}>
                {d.change_pct > 0 ? '+' : ''}{d.change_pct.toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function ParameterSensitivitySection({ simId }: { simId: string }) {
  const { data: sens, loading } = useAsync(() => getParameterSensitivity(simId), [simId]);

  if (loading || !sens || sens.parameters.length === 0) return null;

  const changePcts = [-20, -10, 10, 20];

  return (
    <CollapsibleSection title="רגישות לפרמטר בודד" icon={BarChart3}>
      <p className="text-sm text-slate-500 mb-3">
        שינוי ברווח היזמי בהשפעת שינוי של כל פרמטר בנפרד
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-right">פרמטר</th>
              <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-center">ערך בסיס</th>
              {changePcts.map(p => (
                <th key={p} className="border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  {p > 0 ? '+' : ''}{p}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sens.parameters.map(param => (
              <tr key={param.field}>
                <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium">{param.label}</td>
                <td className="border border-slate-200 px-3 py-2 text-center font-mono text-xs">
                  {formatNum(param.base_value, 1)}
                </td>
                {changePcts.map(pct => {
                  const v = param.variants.find(x => x.change_pct === pct);
                  if (!v) return <td key={pct} className="border border-slate-200 px-3 py-2 text-center">—</td>;
                  const diff = v.profit - sens.base_profit;
                  return (
                    <td
                      key={pct}
                      className={`border border-slate-200 px-3 py-2 text-center font-mono text-xs ${
                        diff > 0 ? 'bg-green-50 text-green-700' : diff < 0 ? 'bg-red-50 text-red-700' : ''
                      }`}
                    >
                      {formatCurrency(v.profit)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}

type ResultsTab = 'results' | 'alternatives' | 'ai' | 'sources';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sim, loading } = useAsync(() => getSimulation(id!), [id]);
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>('results');
  const { data: alternatives, loading: altLoading, error: altError, refetch: refetchAlt } = useAsync(
    () => (id ? getAlternatives(id) : Promise.resolve(null)),
    [id],
  );

  const { data: siblings } = useAsync(
    () => (sim ? getProjectSimulations(sim.project_id) : Promise.resolve([])),
    [sim?.project_id],
  );

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
    });
  }, []);

  useEffect(() => {
    if (sim?.simulation_results) {
      const timer = setTimeout(fireConfetti, 600);
      return () => clearTimeout(timer);
    }
  }, [sim, fireConfetti]);

  const handleDownload = async (type: 'management' | 'economic') => {
    if (!id) return;
    setDownloading(type);
    try {
      await downloadReport(id, type);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהורדת הדוח');
    } finally {
      setDownloading(null);
    }
  };

  if (loading || !sim) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const r = sim.simulation_results;
  if (!r) {
    return (
      <div className="text-center py-20 text-slate-400">
        <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
        <p>אין תוצאות עדיין לסימולציה זו</p>
      </div>
    );
  }

  const profit = r.expected_profit ?? r.profit;
  const profitRate = r.profit_percent ?? r.profitability_rate;
  const totalCosts = r.total_costs_incl_vat ?? r.total_costs ?? 0;
  const netRevenue = r.net_revenue ?? r.total_revenue ?? 0;

  const barData = [
    { name: 'הכנסות', value: netRevenue },
    { name: 'עלויות', value: totalCosts },
    { name: 'רווח', value: profit },
  ];

  const mixData = sim.apartment_mix.map((a) => ({
    name: a.apartment_type,
    value: a.quantity,
  }));

  const otherSims =
    siblings?.filter((s) => s.id !== sim.id && s.status === 'Completed') || [];

  // Revenue breakdown bar data
  const revenueBreakdown = [
    { name: 'מגורים', value: r.residential_revenue ?? 0 },
    { name: 'מסחרי', value: r.commercial_revenue ?? 0 },
  ];

  // Cost breakdown bar data
  const costBreakdown = [
    { name: 'בנייה', value: r.construction_cost ?? 0 },
    { name: 'מימון', value: r.financing_cost ?? 0 },
    { name: 'תכנון', value: r.planning_cost ?? 0 },
    { name: 'היטלים', value: r.levies_cost ?? 0 },
  ];

  // Cash flow line data
  const cashFlowData = (r.monthly_cash_flows ?? []).map((cf, i) => ({
    month: i + 1,
    value: cf,
    cumulative: (r.monthly_cash_flows ?? []).slice(0, i + 1).reduce((s, v) => s + v, 0),
  }));

  return (
    <AnimatedPage>
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(`/projects/${sim.project_id}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-4 cursor-pointer transition-colors"
        >
          <ArrowRight size={16} />
          חזרה לפרויקט
        </button>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold">{sim.version_name} — תוצאות</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload('management')}
              disabled={downloading === 'management'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Download size={14} />
              {downloading === 'management' ? 'מוריד...' : 'דוח ניהולי'}
            </button>
            <button
              onClick={() => handleDownload('economic')}
              disabled={downloading === 'economic'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Download size={14} />
              {downloading === 'economic' ? 'מוריד...' : 'דוח כלכלי'}
            </button>

            {otherSims.length > 0 && (
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) navigate(`/compare?a=${sim.id}&b=${e.target.value}`);
                }}
              >
                <option value="" disabled>השווה עם...</option>
                {otherSims.map((s) => (
                  <option key={s.id} value={s.id}>{s.version_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 mb-6 gap-1">
          {([
            { key: 'results' as const, label: 'תוצאות', icon: BarChart3 },
            { key: 'alternatives' as const, label: 'חלופות', icon: Layers },
            { key: 'ai' as const, label: 'המלצות AI', icon: Lightbulb },
            { key: 'sources' as const, label: 'מקורות נתונים', icon: Database },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Alternatives Tab */}
        {activeTab === 'alternatives' && (
          altLoading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Spinner size={20} />
              <span className="text-sm text-slate-400">טוען חלופות...</span>
            </div>
          ) : altError || (!alternatives?.scenarios?.length) ? (
            <div className="text-center py-12 space-y-3">
              <Layers size={32} className="mx-auto text-slate-300" />
              <p className="text-sm text-slate-400">
                {altError ? `שגיאה: ${altError}` : 'אין חלופות — יש להריץ את צינור הסוכנים'}
              </p>
              <button
                onClick={async () => {
                  if (!id) return;
                  try {
                    toast.loading('מריץ צינור סוכנים מחדש...', { id: 'rerun' });
                    await runPipeline(id);
                    toast.success('הצינור הופעל — חזור לתוצאות בעוד דקה', { id: 'rerun' });
                    setTimeout(() => { refetchAlt(); }, 30000);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'שגיאה', { id: 'rerun' });
                  }
                }}
                className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
              >
                הפעל חישוב עם חלופות
              </button>
            </div>
          ) : (
            <ScenariosComparison scenarios={alternatives.scenarios!} />
          )
        )}

        {/* AI Recommendations Tab */}
        {activeTab === 'ai' && (
          altLoading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Spinner size={20} />
              <span className="text-sm text-slate-400">טוען המלצות...</span>
            </div>
          ) : altError || (!alternatives?.optimizations?.length && !alternatives?.ai_validation_notes) ? (
            <div className="text-center py-12 space-y-3">
              <Lightbulb size={32} className="mx-auto text-slate-300" />
              <p className="text-sm text-slate-400">
                {altError ? `שגיאה: ${altError}` : 'אין המלצות — יש להריץ את צינור הסוכנים'}
              </p>
              <button
                onClick={async () => {
                  if (!id) return;
                  try {
                    toast.loading('מריץ צינור סוכנים מחדש...', { id: 'rerun-ai' });
                    await runPipeline(id);
                    toast.success('הצינור הופעל — חזור לתוצאות בעוד דקה', { id: 'rerun-ai' });
                    setTimeout(() => { refetchAlt(); }, 30000);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'שגיאה', { id: 'rerun-ai' });
                  }
                }}
                className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
              >
                הפעל חישוב עם המלצות AI
              </button>
            </div>
          ) : (
            <AIRecommendations
              optimizations={alternatives?.optimizations ?? null}
              aiNotes={alternatives?.ai_validation_notes ?? null}
            />
          )
        )}

        {/* Data Sources Tab */}
        {activeTab === 'sources' && id && (
          <DataSourcesPanel simId={id} />
        )}

        {/* Results Tab — existing content */}
        {activeTab === 'results' && (<>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon={DollarSign}
            label="רווח יזמי"
            value={profit}
            formatFn={formatCurrency}
            color={profit >= 0 ? 'bg-primary-600' : 'bg-red-600'}
            index={0}
          />
          <KPICard
            icon={Percent}
            label="שיעור רווחיות"
            value={profitRate}
            formatFn={(n) => `${n.toFixed(1)}%`}
            color="bg-emerald-600"
            index={1}
          />
          <KPICard
            icon={TrendingUp}
            label="IRR"
            value={r.irr}
            formatFn={(n) => `${n.toFixed(1)}%`}
            color="bg-amber-500"
            index={2}
          />
          <KPICard
            icon={BarChart3}
            label="NPV"
            value={r.npv}
            formatFn={formatCurrency}
            color="bg-purple-600"
            index={3}
          />
        </div>

        {/* Additional KPIs row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card>
            <p className="text-xs text-slate-500">סה&quot;כ הכנסות</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(netRevenue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500">סה&quot;כ עלויות (כולל מע&quot;מ)</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalCosts)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500">רווחיות סטנדרט 21%</p>
            <p className="text-lg font-bold">{formatNum(r.profit_percent_standard21, 1)}%</p>
          </Card>
        </div>

        {/* Delta Analysis */}
        {id && (
          <div className="mb-6">
            <DeltaSection simId={id} />
          </div>
        )}

        {/* Financial summary + apartment mix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <Card>
              <h3 className="font-semibold mb-4">סיכום פיננסי</h3>
              <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#10b981' : i === 1 ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <Card>
              <h3 className="font-semibold mb-4">תמהיל דירות</h3>
              <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
                <PieChart>
                  <Pie
                    data={mixData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {mixData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Section: מצב יוצא */}
        <div className="space-y-4 mb-6">
          <CollapsibleSection title="מצב יוצא (Proposed State)" icon={Building2} defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
              <DetailRow label='סה"כ יחידות חדשות' value={formatNum(r.total_new_units ?? r.total_units)} />
              <DetailRow label='שטחי תמורות (מ"ר)' value={formatNum(r.total_return_floorplate, 1)} />
              <DetailRow label='סה"כ שטח (מ"ר)' value={formatNum(r.total_floorplate ?? r.total_residential_area, 1)} />
              <DetailRow label="יחידות יזם" value={formatNum(r.developer_units)} />
              <DetailRow label='שטח יזם (מ"ר)' value={formatNum(r.developer_floorplate, 1)} />
              <DetailRow label='גודל ממוצע דירת יזם (מ"ר)' value={formatNum(r.avg_developer_unit_size, 1)} />
              <DetailRow label="יחס שילוב" value={formatNum(r.combination_ratio, 2)} />
            </div>
          </CollapsibleSection>
        </div>

        {/* Section: פרוגרמה */}
        <div className="space-y-4 mb-6">
          <CollapsibleSection title="פרוגרמה (Building Program)" icon={LayoutGrid}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
              <DetailRow label='שטחי שירות (מ"ר)' value={formatNum(r.service_areas, 1)} />
              <DetailRow label='סה"כ מעל קרקע (מ"ר)' value={formatNum(r.total_above_ground, 1)} />
              <DetailRow label='שטח קומה (מ"ר)' value={formatNum(r.floor_area, 1)} />
              <DetailRow label="מספר בניינים" value={formatNum(r.max_buildings)} />
              <DetailRow label='מעל קרקע לבניין (מ"ר)' value={formatNum(r.above_ground_per_building, 1)} />
              <DetailRow label='שטח פיתוח (מ"ר)' value={formatNum(r.development_land, 1)} />
              <DetailRow label='מגורים לבניין (מ"ר)' value={formatNum(r.residential_per_building, 1)} />
              <DetailRow label="יח' החזר לבניין" value={formatNum(r.return_units_per_building, 1)} />
              <DetailRow label="יח' יזם לבניין" value={formatNum(r.developer_units_per_building, 1)} />
              <DetailRow label='שטח יזם לבניין (מ"ר)' value={formatNum(r.developer_floorplate_per_building, 1)} />
              <DetailRow label="חניות" value={formatNum(r.total_parking_spots)} />
              <DetailRow label='שטח חניה (מ"ר)' value={formatNum(r.total_parking_area, 1)} />
              <DetailRow label="קומות חניה" value={formatNum(r.parking_floors, 1)} />
              <DetailRow label='שטח מרפסות (מ"ר)' value={formatNum(r.total_balcony_area, 1)} />
            </div>
          </CollapsibleSection>
        </div>

        {/* Revenue & Cost Breakdown */}
        <div className="space-y-4 mb-6">
          <CollapsibleSection title="פירוט הכנסות ועלויות" icon={DollarSign} defaultOpen>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">הכנסות</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="name" width={60} />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-sm mt-2 text-slate-600">
                  <span className="font-medium">סה&quot;כ הכנסות (נטו): </span>
                  {formatCurrency(netRevenue)}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">עלויות</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={costBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="name" width={60} />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2 text-sm text-slate-600">
                  <div>
                    <span className="font-medium">עלויות ללא מע&quot;מ: </span>
                    {formatCurrency(r.total_costs_excl_vat ?? 0)}
                  </div>
                  <div>
                    <span className="font-medium">עלויות כולל מע&quot;מ: </span>
                    {formatCurrency(totalCosts)}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Cash Flow Chart */}
        {cashFlowData.length > 0 && (
          <div className="mb-6">
            <CollapsibleSection title="תזרים מזומנים חודשי" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={220} className="sm:!h-[300px]">
                <LineChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" label={{ value: 'חודש', position: 'insideBottom', offset: -5 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip
                    formatter={((v: number | undefined, name: string | undefined) => [
                      formatCurrency(v ?? 0),
                      name === 'value' ? 'תזרים חודשי' : 'מצטבר',
                    ]) as never}
                    labelFormatter={(l) => `חודש ${l}`}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="value" />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="cumulative"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs text-slate-500 mt-2 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block" /> תזרים חודשי
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block border-dashed" /> מצטבר
                </span>
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Sensitivity Matrix */}
        {netRevenue > 0 && totalCosts > 0 && (
          <div className="mb-6">
            <CollapsibleSection title="ניתוח רגישות">
              <p className="text-sm text-slate-500 mb-3">
                שינוי ברווח היזמי בהתאם לשינויים באחוזי ההכנסות והעלויות
              </p>
              <SensitivityMatrix netRevenue={netRevenue} totalCosts={totalCosts} />
            </CollapsibleSection>
          </div>
        )}

        {/* Per-parameter Sensitivity */}
        {id && (
          <div className="mb-6">
            <ParameterSensitivitySection simId={id} />
          </div>
        )}

        </>)}
      </div>
    </AnimatedPage>
  );
}
