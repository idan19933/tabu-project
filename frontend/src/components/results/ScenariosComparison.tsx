import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Card from '../ui/Card';
import type { Scenario } from '../../types';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number | undefined) {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

const SCENARIO_COLORS = ['#ef4444', '#3b82f6', '#10b981'];

const ROWS: { key: keyof Scenario['results']; label: string; format: 'currency' | 'pct' }[] = [
  { key: 'profit', label: 'רווח', format: 'currency' },
  { key: 'profitability_rate', label: 'רווחיות', format: 'pct' },
  { key: 'irr', label: 'IRR', format: 'pct' },
  { key: 'npv', label: 'NPV', format: 'currency' },
  { key: 'total_revenue', label: 'סה"כ הכנסות', format: 'currency' },
  { key: 'total_costs', label: 'סה"כ עלויות', format: 'currency' },
];

export default function ScenariosComparison({ scenarios }: { scenarios: Scenario[] }) {
  if (!scenarios || scenarios.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">אין חלופות להצגה</p>;
  }

  const baseProfit = scenarios.find((s) => s.name_en === 'base')?.results?.profit ?? 0;

  // Bar chart data
  const chartData = scenarios.map((s) => ({
    name: s.name,
    profit: s.results?.profit ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                  מדד
                </th>
                {scenarios.map((s, i) => (
                  <th
                    key={s.name_en}
                    className="border border-slate-200 bg-slate-50 px-4 py-2 text-center"
                    style={{ color: SCENARIO_COLORS[i] }}
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="border border-slate-200 bg-slate-50 px-4 py-2 font-medium">
                    {row.label}
                  </td>
                  {scenarios.map((s) => {
                    const val = s.results?.[row.key];
                    const isBase = s.name_en === 'base';
                    const valNum = typeof val === 'number' ? val : 0;
                    let delta = '';
                    if (!isBase && baseProfit !== 0 && row.key === 'profit') {
                      const diff = ((valNum - baseProfit) / Math.abs(baseProfit)) * 100;
                      delta = `(${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)`;
                    }

                    return (
                      <td
                        key={s.name_en}
                        className={`border border-slate-200 px-4 py-2 text-center font-mono text-xs ${
                          isBase ? 'bg-blue-50 font-bold' : ''
                        }`}
                      >
                        {row.format === 'currency'
                          ? formatCurrency(valNum)
                          : formatPct(val as number)}
                        {delta && (
                          <span
                            className={`block text-xs mt-0.5 ${
                              valNum > baseProfit ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {delta}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Profit Comparison Chart */}
      <Card>
        <h4 className="text-sm font-semibold mb-3">השוואת רווח</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip formatter={(v) => formatCurrency(v as number)} />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={SCENARIO_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Scenario descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scenarios.map((s, i) => (
          <div
            key={s.name_en}
            className="rounded-lg border p-3 text-sm"
            style={{ borderColor: SCENARIO_COLORS[i] + '40' }}
          >
            <p className="font-medium" style={{ color: SCENARIO_COLORS[i] }}>
              {s.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
