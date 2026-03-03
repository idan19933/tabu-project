import { ArrowRight, CheckCircle, AlertTriangle, XCircle, ThumbsUp, PenLine } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { approveSimulation, getSimulation } from '../api';
import toast from 'react-hot-toast';
import AnimatedPage from '../components/ui/AnimatedPage';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';
import { useState } from 'react';

function ConfidenceBadge({ score }: { score?: number }) {
  if (score === undefined) return null;
  if (score >= 0.8)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle size={12} /> ביטחון גבוה
      </span>
    );
  if (score >= 0.5)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle size={12} /> ביטחון בינוני
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <XCircle size={12} /> ביטחון נמוך
    </span>
  );
}

const PLANNING_LABELS: Record<string, string> = {
  planning_stage: 'שלב תכנוני',
  returns_percent: 'אחוזי תשואה',
  multiplier_far: 'מכפיל זכויות',
  avg_apt_size_sqm: 'שטח דירה ממוצע (מ"ר)',
  service_area_sqm: 'שטח שירות (מ"ר)',
  number_of_floors: 'מספר קומות',
  coverage_above_ground: '% כיסוי מעל קרקע',
  coverage_underground: '% כיסוי מתחת לקרקע',
  gross_area_per_parking: 'שטח ברוטו לחנייה (מ"ר)',
  parking_standard_ratio: 'יחס חנייה',
  typ_floor_area_min: 'שטח קומה מינ\' (מ"ר)',
  typ_floor_area_max: 'שטח קומה מקס\' (מ"ר)',
  apts_per_floor_min: 'דירות לקומה מינ\'',
  apts_per_floor_max: 'דירות לקומה מקס\'',
};

const COST_LABELS: Record<string, string> = {
  construction_duration_months: 'משך בנייה (חודשים)',
  cost_per_sqm_residential: 'עלות בנייה מגורים (₪/מ"ר)',
  cost_per_sqm_service: 'עלות בנייה שירות (₪/מ"ר)',
  cost_per_sqm_commercial: 'עלות בנייה מסחרי (₪/מ"ר)',
  cost_per_sqm_balcony: 'עלות מרפסת (₪/מ"ר)',
  cost_per_sqm_development: 'עלות פיתוח (₪/מ"ר)',
  betterment_levy: 'היטל השבחה (₪)',
  purchase_tax: 'מס רכישה (₪)',
  financing_interest_rate: 'ריבית מימון (%)',
  vat_rate: 'מע"מ (%)',
  cpi_linkage_pct: 'הצמדה למדד (%)',
};

const REVENUE_LABELS: Record<string, string> = {
  price_per_sqm_residential: 'מחיר מגורים (₪/מ"ר)',
  price_per_sqm_commercial: 'מחיר מסחרי (₪/מ"ר)',
  price_per_sqm_parking: 'מחיר חניה ליחידה (₪)',
  price_per_sqm_storage: 'מחיר מחסן (₪/מ"ר)',
  sales_pace_per_month: 'קצב מכירות (יח\'/חודש)',
  marketing_discount_pct: 'הנחה שיווקית (%)',
};

export default function ReviewApprovePage() {
  const { id } = useParams<{ id: string }>();
  const { data: sim, loading } = useAsync(() => getSimulation(id!), [id]);
  const [approving, setApproving] = useState(false);
  const navigate = useNavigate();

  const handleApprove = async () => {
    if (!id) return;
    setApproving(true);
    try {
      await approveSimulation(id);
      toast.success('הסימולציה אושרה לחישוב');
      navigate(`/simulations/${id}/edit`);
    } finally {
      setApproving(false);
    }
  };

  if (loading || !sim) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const pp = sim.planning_parameters;
  const cp = sim.cost_parameters;
  const rp = sim.revenue_parameters;
  const meta = pp?.ai_extraction_metadata || cp?.ai_extraction_metadata || rp?.ai_extraction_metadata;
  const confidence = (meta as Record<string, unknown>)?.confidence_scores as Record<string, number> | undefined;

  return (
    <AnimatedPage>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(`/projects/${sim.project_id}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-4 cursor-pointer transition-colors"
        >
          <ArrowRight size={16} />
          חזרה לפרויקט
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{sim.version_name}</h1>
            <Badge status={sim.status} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(`/simulations/${id}/edit`)}>
              <PenLine size={16} /> עריכה
            </Button>
            <Button onClick={handleApprove} disabled={approving || sim.status !== 'Pending_Review'}>
              {approving ? <Spinner size={16} /> : <><ThumbsUp size={16} /> אישור לחישוב</>}
            </Button>
          </div>
        </div>

        {pp && (
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">פרמטרים תכנוניים</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(PLANNING_LABELS).map(([key, label]) => {
                const val = (pp as unknown as Record<string, unknown>)[key];
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <Input value={String(val ?? '')} readOnly className="flex-1" />
                      <ConfidenceBadge score={confidence?.[key]} />
                    </div>
                  </div>
                );
              })}
            </div>
            {pp.building_lines_notes && (
              <div className="mt-3">
                <span className="text-xs text-slate-500">הערות קווי בניין</span>
                <p className="text-sm bg-slate-50 rounded p-2 mt-1">{pp.building_lines_notes}</p>
              </div>
            )}
            {pp.public_tasks_notes && (
              <div className="mt-3">
                <span className="text-xs text-slate-500">הערות משימות ציבוריות</span>
                <p className="text-sm bg-slate-50 rounded p-2 mt-1">{pp.public_tasks_notes}</p>
              </div>
            )}
          </Card>
        )}

        {cp && (
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">פרמטרי עלויות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(COST_LABELS).map(([key, label]) => {
                const val = (cp as unknown as Record<string, unknown>)[key];
                if (val == null) return null;
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <Input value={String(val)} readOnly className="flex-1" />
                      <ConfidenceBadge score={confidence?.[key]} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {rp && (
          <Card className="mb-4">
            <h2 className="font-semibold mb-3">פרמטרי הכנסות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(REVENUE_LABELS).map(([key, label]) => {
                const val = (rp as unknown as Record<string, unknown>)[key];
                if (val == null) return null;
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <Input value={String(val)} readOnly className="flex-1" />
                      <ConfidenceBadge score={confidence?.[key]} />
                    </div>
                  </div>
                );
              })}
              {rp.price_per_unit_by_type && Object.keys(rp.price_per_unit_by_type).length > 0 && (
                <div className="col-span-2">
                  <span className="text-xs text-slate-500">מחירים לפי סוג יחידה</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {Object.entries(rp.price_per_unit_by_type).map(([type, price]) => (
                      <div key={type} className="flex justify-between text-sm bg-slate-50 rounded px-2 py-1">
                        <span>{type}</span>
                        <span className="font-medium">₪{Number(price).toLocaleString('he-IL')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {sim.apartment_mix.length > 0 && (
          <Card>
            <h2 className="font-semibold mb-3">תמהיל דירות</h2>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-right py-2">סוג</th>
                    <th className="text-right py-2">כמות</th>
                    <th className="text-right py-2">% מהתמהיל</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.apartment_mix.map((a, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{a.apartment_type}</td>
                      <td className="py-2">{a.quantity}</td>
                      <td className="py-2">{a.percentage_of_mix}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AnimatedPage>
  );
}
