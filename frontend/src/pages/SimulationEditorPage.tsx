import { Calculator, Copy, Save, Minus, Plus, CheckCircle, XCircle, AlertTriangle, ArrowRight, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  approveSimulation,
  calculateSimulation,
  cloneSimulation,
  getSimulation,
  updateSimulation,
} from '../api';
import { ApiError } from '../api/client';
import InlineUpload from '../components/projects/InlineUpload';
import AnimatedPage from '../components/ui/AnimatedPage';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';
import type { ApartmentMix, CostParameters, PlanningParameters, RevenueParameters } from '../types';

const EMPTY_PLANNING: PlanningParameters = {
  returns_percent: 0, multiplier_far: 0, avg_apt_size_sqm: 0,
  service_area_sqm: 0, number_of_floors: 0, coverage_above_ground: 0,
  coverage_underground: 0, gross_area_per_parking: 0,
  building_lines_notes: null, public_tasks_notes: null,
  parking_standard_ratio: 0, typ_floor_area_min: 0,
  typ_floor_area_max: 0, apts_per_floor_min: 0, apts_per_floor_max: 0,
  return_area_per_apt: 0, service_area_percent: 15,
  public_area_sqm: 0, parking_floor_area: 0,
  balcony_area_per_unit: 12, blue_line_area: 0,
  planning_stage: null,
};

const EMPTY_COST: CostParameters = {
  construction_duration_months: 36, cost_per_sqm_residential: 0,
  cost_per_sqm_service: 0, cost_per_sqm_commercial: 0,
  cost_per_sqm_balcony: 0, cost_per_sqm_development: 0,
  betterment_levy: 0, purchase_tax: 0, planning_consultants: 0,
  permits_fees: 0, electricity_connection: 0, bank_supervision: 0,
  engineering_management: 0, tenant_supervision: 0, management_overhead: 0,
  marketing_advertising: 0, tenant_lawyer: 0, initiation_fee: 0,
  rent_subsidy: 0, evacuation_cost: 0, moving_cost: 0,
  contingency: 0, developer_lawyer: 0, demolition: 0,
  construction_total: 0, parking_construction: 0,
  financing_interest_rate: 5.5, vat_rate: 17,
  cpi_linkage_pct: 0,
};

const EMPTY_REVENUE: RevenueParameters = {
  price_per_sqm_residential: 0, price_per_sqm_commercial: 0,
  price_per_unit_by_type: {},
  sales_pace_per_month: 0, marketing_discount_pct: 0,
  price_per_sqm_parking: 0, price_per_sqm_storage: 0,
};

const REQUIRED_PLANNING = new Set(['returns_percent', 'number_of_floors', 'coverage_above_ground', 'parking_standard_ratio', 'avg_apt_size_sqm', 'gross_area_per_parking']);
const REQUIRED_COST = new Set(['cost_per_sqm_residential', 'construction_duration_months']);
const REQUIRED_REVENUE = new Set(['price_per_sqm_residential']);

interface ValidationResult {
  ready: boolean;
  missing_planning: string[];
  missing_cost: string[];
  missing_revenue: string[];
  missing_mix: boolean;
  warnings: string[];
}

function SectionCard({ title, children, defaultOpen = true, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mb-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full cursor-pointer">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          {badge}
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function StatusBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full"><CheckCircle size={10} className="inline" /></span>;
  return <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">{count} חסר</span>;
}

function ValidationBadge({ ok, label, missing }: { ok: boolean; label: string; missing: number }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {ok ? <><CheckCircle size={12} /> {label}: מלא</> : <><AlertTriangle size={12} /> {label}: חסר {missing}</>}
    </span>
  );
}

function MissingBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <XCircle size={16} className="text-red-500" />
        <span className="text-sm font-medium text-red-700">{title}:</span>
      </div>
      <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
        {items.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}

export default function SimulationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sim, loading, refetch } = useAsync(() => getSimulation(id!), [id]);
  const navigate = useNavigate();

  const [planning, setPlanning] = useState<PlanningParameters>(EMPTY_PLANNING);
  const [mix, setMix] = useState<ApartmentMix[]>([]);
  const [cost, setCost] = useState<CostParameters>(EMPTY_COST);
  const [revenue, setRevenue] = useState<RevenueParameters>(EMPTY_REVENUE);
  const [saving, setSaving] = useState(false);
  const [validationModal, setValidationModal] = useState<ValidationResult | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (sim) {
      setPlanning(sim.planning_parameters || EMPTY_PLANNING);
      setMix(sim.apartment_mix.length > 0 ? sim.apartment_mix : []);
      setCost(sim.cost_parameters || EMPTY_COST);
      setRevenue(sim.revenue_parameters || EMPTY_REVENUE);
    }
  }, [sim]);

  const buildPayload = () => ({
    planning_parameters: planning,
    apartment_mix: mix.map(({ apartment_type, quantity, percentage_of_mix }) => ({ apartment_type, quantity, percentage_of_mix })),
    cost_parameters: cost,
    revenue_parameters: revenue,
  });

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateSimulation(id, buildPayload());
      toast.success('הנתונים נשמרו בהצלחה');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally { setSaving(false); }
  };

  const handleCalculate = async () => {
    if (!id || !sim) return;
    setSaving(true);
    try {
      await updateSimulation(id, buildPayload());
      if (['Pending_Review', 'Draft', 'AI_Extracting'].includes(sim.status)) await approveSimulation(id);
      await calculateSimulation(id);
      toast.success('החישוב הושלם!');
      navigate(`/simulations/${id}/results`);
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'MISSING_FIELDS') {
        setValidationModal(err.data.validation as ValidationResult);
      } else {
        toast.error(err instanceof Error ? err.message : 'שגיאה בחישוב');
      }
    } finally { setSaving(false); }
  };

  const handleClone = async () => {
    if (!id) return;
    try {
      const cloned = await cloneSimulation(id);
      toast.success('הסימולציה שוכפלה');
      navigate(`/simulations/${cloned.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשכפול');
    }
  };

  const updatePlanning = (field: string, value: string) => {
    const numFields = new Set(['returns_percent','multiplier_far','avg_apt_size_sqm','service_area_sqm','coverage_above_ground','coverage_underground','gross_area_per_parking','parking_standard_ratio','typ_floor_area_min','typ_floor_area_max','return_area_per_apt','service_area_percent','public_area_sqm','parking_floor_area','balcony_area_per_unit','blue_line_area']);
    const intFields = new Set(['number_of_floors','apts_per_floor_min','apts_per_floor_max']);
    const strFields = new Set(['planning_stage','building_lines_notes','public_tasks_notes']);
    let parsed: unknown = value;
    if (strFields.has(field)) parsed = value || null;
    else if (numFields.has(field)) parsed = parseFloat(value) || 0;
    else if (intFields.has(field)) parsed = parseInt(value) || 0;
    setPlanning({ ...planning, [field]: parsed });
  };

  const updateCost = (field: string, value: string) => {
    const val = field === 'construction_duration_months' ? parseInt(value) || 0 : parseFloat(value) || 0;
    setCost({ ...cost, [field]: val });
  };

  const updateRevenue = (field: string, value: string) => {
    setRevenue({ ...revenue, [field]: parseFloat(value) || 0 });
  };

  const updateMixRow = (index: number, field: string, value: string) => {
    const updated = [...mix];
    if (field === 'apartment_type') updated[index] = { ...updated[index], apartment_type: value };
    else if (field === 'quantity') updated[index] = { ...updated[index], quantity: parseInt(value) || 0 };
    else if (field === 'percentage_of_mix') updated[index] = { ...updated[index], percentage_of_mix: parseFloat(value) || 0 };
    setMix(updated);
  };
  const addMixRow = () => setMix([...mix, { apartment_type: '', quantity: 0, percentage_of_mix: 0 }]);
  const removeMixRow = (i: number) => setMix(mix.filter((_, idx) => idx !== i));

  const isMissing = (obj: Record<string, unknown>, field: string, req: Set<string>) => {
    if (!req.has(field)) return false;
    const val = obj[field];
    return val === null || val === undefined || val === 0;
  };

  const missingP = [...REQUIRED_PLANNING].filter(f => isMissing(planning as unknown as Record<string, unknown>, f, REQUIRED_PLANNING)).length;
  const missingC = [...REQUIRED_COST].filter(f => isMissing(cost as unknown as Record<string, unknown>, f, REQUIRED_COST)).length;
  const missingR = [...REQUIRED_REVENUE].filter(f => isMissing(revenue as unknown as Record<string, unknown>, f, REQUIRED_REVENUE)).length;
  const hasMix = mix.length > 0 && mix.some(m => m.quantity > 0);

  if (loading || !sim) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(`/projects/${sim.project_id}`)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-4 cursor-pointer transition-colors">
          <ArrowRight size={16} /> חזרה לפרויקט
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{sim.version_name}</h1>
            <Badge status={sim.status} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClone}><Copy size={16} /> שכפול</Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving}><Save size={16} /> שמור</Button>
            <Button onClick={handleCalculate} disabled={saving}><Calculator size={16} /> חשב</Button>
          </div>
        </div>

        {/* Validation Summary */}
        <Card className="mb-4">
          <h2 className="font-semibold mb-2 text-sm">מוכנות לחישוב</h2>
          <div className="flex flex-wrap gap-2">
            <ValidationBadge ok={missingP === 0} label="תכנון" missing={missingP} />
            <ValidationBadge ok={missingC === 0} label="עלויות" missing={missingC} />
            <ValidationBadge ok={missingR === 0} label="הכנסות" missing={missingR} />
            <ValidationBadge ok={hasMix} label="תמהיל" missing={hasMix ? 0 : 1} />
          </div>
        </Card>

        {/* Upload */}
        <div className="mb-4">
          <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 cursor-pointer transition-colors">
            {showUpload ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <Upload size={14} />
            {showUpload ? 'הסתר' : 'העלאת מסמך למילוי אוטומטי'}
          </button>
          {showUpload && (
            <div className="mt-3">
              <InlineUpload projectId={sim.project_id} onUploaded={() => { refetch(); setShowUpload(false); }} />
              <p className="text-xs text-slate-400 mt-2">העלה תב&quot;ע או דוח כלכלי. ה-AI ימלא את השדות אוטומטית.</p>
            </div>
          )}
        </div>

        {/* Section 1: Planning Parameters */}
        <SectionCard title="מצב יוצא — פרמטרים תכנוניים" badge={<StatusBadge count={missingP} />}>
          {/* Planning stage dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">שלב תכנוני</label>
            <select
              value={planning.planning_stage ?? ''}
              onChange={e => updatePlanning('planning_stage', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— בחר שלב —</option>
              <option value="טרום תכנוני">טרום תכנוני</option>
              <option value="תכנית מופקדת">תכנית מופקדת</option>
              <option value="תכנית מאושרת">תכנית מאושרת</option>
              <option value="היתר בנייה">היתר בנייה</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              ['returns_percent','% החזר (תמורות)'],['avg_apt_size_sqm','שטח דירה ממוצע (מ"ר)'],['return_area_per_apt','שטח החזר לדירה (מ"ר)'],
              ['number_of_floors','מספר קומות'],['coverage_above_ground','% כיסוי מעל קרקע'],['coverage_underground','% כיסוי מתחת לקרקע'],
              ['multiplier_far','מכפיל זכויות (FAR)'],['blue_line_area','שטח קו כחול (מ"ר)'],['parking_standard_ratio','יחס חנייה לדירה'],
              ['gross_area_per_parking','שטח ברוטו לחנייה (מ"ר)'],['service_area_sqm','שטח שירות (מ"ר)'],['service_area_percent','% שטח שירות'],
              ['public_area_sqm','שטח ציבורי/מסחרי (מ"ר)'],['parking_floor_area','שטח קומת חניה (מ"ר)'],['balcony_area_per_unit','מרפסת לדירה (מ"ר)'],
              ['typ_floor_area_min',"שטח קומה מינ' (מ\"ר)"],['typ_floor_area_max',"שטח קומה מקס' (מ\"ר)"],['apts_per_floor_min',"דירות לקומה מינ'"],['apts_per_floor_max',"דירות לקומה מקס'"],
            ] as [string,string][]).map(([field, label]) => {
              const miss = isMissing(planning as unknown as Record<string, unknown>, field, REQUIRED_PLANNING);
              return (
                <div key={field}>
                  <Input label={label} value={String((planning as unknown as Record<string, unknown>)[field] ?? 0)} onChange={e => updatePlanning(field, e.target.value)} className={miss ? 'bg-amber-50 border-amber-300' : ''} />
                  {miss && <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> נדרש</span>}
                </div>
              );
            })}
          </div>

          {/* Notes textareas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">הערות קווי בניין</label>
              <textarea
                value={planning.building_lines_notes ?? ''}
                onChange={e => updatePlanning('building_lines_notes', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-20 resize-y"
                placeholder="הערות על קווי בניין..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">הערות משימות ציבוריות</label>
              <textarea
                value={planning.public_tasks_notes ?? ''}
                onChange={e => updatePlanning('public_tasks_notes', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm h-20 resize-y"
                placeholder="הערות על משימות ציבוריות..."
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 2: Apartment Mix */}
        <SectionCard title="תמהיל דירות" badge={<StatusBadge count={hasMix ? 0 : 1} />}>
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="secondary" onClick={addMixRow}><Plus size={14} /> הוסף שורה</Button>
          </div>
          {mix.length === 0 && <div className="text-center py-4 text-sm text-amber-600 bg-amber-50 rounded-lg"><AlertTriangle size={16} className="mx-auto mb-1" />נדרשת לפחות שורה אחת</div>}
          {mix.length > 0 && (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-500 border-b"><th className="text-right py-2">סוג דירה</th><th className="text-right py-2 w-24">כמות</th><th className="text-right py-2 w-24">% תמהיל</th><th className="w-10"></th></tr></thead>
                <tbody>
                  {mix.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5"><input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={row.apartment_type} onChange={e => updateMixRow(i,'apartment_type',e.target.value)} /></td>
                      <td className="py-1.5"><input type="number" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={row.quantity} onChange={e => updateMixRow(i,'quantity',e.target.value)} /></td>
                      <td className="py-1.5"><input type="number" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={row.percentage_of_mix} onChange={e => updateMixRow(i,'percentage_of_mix',e.target.value)} /></td>
                      <td><button onClick={() => removeMixRow(i)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Minus size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Section 3: Cost Parameters */}
        <SectionCard title="עלויות" badge={<StatusBadge count={missingC} />}>
          <h3 className="font-medium mb-3 text-sm text-slate-600">עלויות בנייה (₪/מ&quot;ר)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {([
              ['cost_per_sqm_residential','מגורים'],['cost_per_sqm_service','שירות'],['cost_per_sqm_commercial','מסחרי'],
              ['cost_per_sqm_balcony','מרפסות'],['cost_per_sqm_development','פיתוח'],['parking_construction','חניה (סה"כ ₪)'],['construction_total','סה"כ בנייה (₪, ידני)'],
            ] as [string,string][]).map(([field, label]) => {
              const miss = isMissing(cost as unknown as Record<string, unknown>, field, REQUIRED_COST);
              return (
                <div key={field}>
                  <Input label={label} value={String((cost as unknown as Record<string, unknown>)[field] ?? 0)} onChange={e => updateCost(field, e.target.value)} className={miss ? 'bg-amber-50 border-amber-300' : ''} />
                  {miss && <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> נדרש</span>}
                </div>
              );
            })}
          </div>

          <h3 className="font-medium mb-3 text-sm text-slate-600">עלויות נוספות (₪)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {([
              ['betterment_levy','היטל השבחה'],['purchase_tax','מס רכישה'],['planning_consultants','תכנון ויועצים'],
              ['permits_fees','היתרים ואגרות'],['electricity_connection','חיבור חשמל'],['bank_supervision','פיקוח בנק'],
              ['engineering_management','ניהול הנדסי'],['tenant_supervision','פיקוח דיירים'],['management_overhead','הנהלה וכלליות'],
              ['marketing_advertising','שיווק ופרסום'],['tenant_lawyer','עו"ד דיירים'],['initiation_fee','דמי ייזום'],
              ['rent_subsidy','סבסוד שכ"ד'],['evacuation_cost','עלות פינוי'],['moving_cost','הובלות'],
              ['contingency','בלת"מ'],['developer_lawyer','עו"ד יזם'],['demolition','הריסה'],
            ] as [string,string][]).map(([field, label]) => (
              <div key={field}>
                <Input label={label} value={String((cost as unknown as Record<string, unknown>)[field] ?? 0)} onChange={e => updateCost(field, e.target.value)} />
              </div>
            ))}
          </div>

          <h3 className="font-medium mb-3 text-sm text-slate-600">מימון ומיסים</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              ['construction_duration_months','משך בנייה (חודשים)'],['financing_interest_rate','ריבית מימון (%)'],['vat_rate','מע"מ (%)'],['cpi_linkage_pct','הצמדה למדד (%)'],
            ] as [string,string][]).map(([field, label]) => {
              const miss = isMissing(cost as unknown as Record<string, unknown>, field, REQUIRED_COST);
              return (
                <div key={field}>
                  <Input label={label} value={String((cost as unknown as Record<string, unknown>)[field] ?? 0)} onChange={e => updateCost(field, e.target.value)} className={miss ? 'bg-amber-50 border-amber-300' : ''} />
                  {miss && <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> נדרש</span>}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Section 4: Revenue Parameters */}
        <SectionCard title="הכנסות" badge={<StatusBadge count={missingR} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              ['price_per_sqm_residential','מחיר מגורים (₪/מ"ר)'],['price_per_sqm_commercial','מחיר מסחרי (₪/מ"ר)'],
              ['price_per_sqm_parking','מחיר חניה ליחידה (₪)'],['price_per_sqm_storage','מחיר מחסן (₪/מ"ר)'],
              ['sales_pace_per_month','קצב מכירות (יח\'/חודש)'],['marketing_discount_pct','הנחה שיווקית (%)'],
            ] as [string,string][]).map(([field, label]) => {
              const miss = isMissing(revenue as unknown as Record<string, unknown>, field, REQUIRED_REVENUE);
              return (
                <div key={field}>
                  <Input label={label} value={String((revenue as unknown as Record<string, unknown>)[field] ?? 0)} onChange={e => updateRevenue(field, e.target.value)} className={miss ? 'bg-amber-50 border-amber-300' : ''} />
                  {miss && <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> נדרש</span>}
                </div>
              );
            })}
          </div>
          {mix.length > 0 && mix.some(m => m.apartment_type) && (
            <>
              <h3 className="font-medium mt-6 mb-3 text-sm text-slate-600">מחיר ליחידה לפי סוג (אופציונלי)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mix.filter(m => m.apartment_type).map(m => (
                  <div key={m.apartment_type}>
                    <Input
                      label={`${m.apartment_type} (₪/יח')`}
                      value={String(revenue.price_per_unit_by_type?.[m.apartment_type] ?? 0)}
                      onChange={e => setRevenue({ ...revenue, price_per_unit_by_type: { ...revenue.price_per_unit_by_type, [m.apartment_type]: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Validation Modal */}
      <Modal open={!!validationModal} onClose={() => setValidationModal(null)} title="שדות חסרים לחישוב">
        {validationModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={18} /><p className="text-sm">מלא את השדות החסרים כדי להריץ חישוב</p>
            </div>
            {validationModal.missing_planning.length > 0 && <MissingBlock title="פרמטרים תכנוניים חסרים" items={validationModal.missing_planning} />}
            {((validationModal.missing_cost?.length || 0) > 0 || (validationModal.missing_revenue?.length || 0) > 0) && (
              <MissingBlock title="פרמטרי עלויות/הכנסות חסרים" items={[...(validationModal.missing_cost || []), ...(validationModal.missing_revenue || [])]} />
            )}
            {validationModal.missing_mix && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2"><XCircle size={16} className="text-red-500" /><span className="text-sm font-medium text-red-700">חסר תמהיל דירות — הוסף לפחות שורה אחת</span></div>
              </div>
            )}
            {(validationModal.warnings?.length || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-amber-500" /><span className="text-sm font-medium text-amber-700">אזהרות:</span></div>
                <ul className="list-disc list-inside text-xs text-amber-600 space-y-0.5">{validationModal.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            <button onClick={() => setValidationModal(null)} className="w-full text-center text-sm text-slate-500 hover:text-slate-700 pt-2 cursor-pointer transition-colors">חזרה לעריכה</button>
          </div>
        )}
      </Modal>
    </AnimatedPage>
  );
}
