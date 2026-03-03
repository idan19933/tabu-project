import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { compareSimulations, getProjects, getProjectSimulations } from '../api';
import AnimatedPage from '../components/ui/AnimatedPage';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { useAsync } from '../hooks/useAsync';
import { useState, useEffect } from 'react';
import type { CompareOut, SimulationBrief } from '../types';
import { clsx } from 'clsx';

function formatNum(n: number | undefined | null) {
  if (n === undefined || n === null) return '-';
  return new Intl.NumberFormat('he-IL').format(n);
}

function DeltaCell({ a, b, reverse }: { a: number; b: number; reverse?: boolean }) {
  const diff = b - a;
  const pct = a !== 0 ? ((diff / Math.abs(a)) * 100).toFixed(1) : '\u2014';
  const positive = reverse ? diff < 0 : diff > 0;
  const negative = reverse ? diff > 0 : diff < 0;
  return (
    <span
      className={clsx(
        'text-xs font-medium',
        positive && 'text-emerald-600',
        negative && 'text-red-600',
        !positive && !negative && 'text-slate-400',
      )}
    >
      {diff > 0 ? '+' : ''}{formatNum(diff)} ({pct}%)
    </span>
  );
}

export default function ComparePage() {
  const [params] = useSearchParams();
  const preA = params.get('a');
  const preB = params.get('b');

  const { data: projects } = useAsync(() => getProjects(), []);
  const [projectId, setProjectId] = useState('');
  const [sims, setSims] = useState<SimulationBrief[]>([]);
  const [simA, setSimA] = useState(preA || '');
  const [simB, setSimB] = useState(preB || '');
  const [comparison, setComparison] = useState<CompareOut | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      getProjectSimulations(projectId).then(setSims);
    }
  }, [projectId]);

  useEffect(() => {
    if (simA && simB) {
      setLoading(true);
      compareSimulations(simA, simB)
        .then(setComparison)
        .finally(() => setLoading(false));
    }
  }, [simA, simB]);

  const a = comparison?.simulation_a;
  const b = comparison?.simulation_b;

  const RESULT_ROWS = [
    { label: 'רווח יזמי', key: 'profit' as const },
    { label: 'שיעור רווחיות (%)', key: 'profitability_rate' as const },
    { label: 'IRR (%)', key: 'irr' as const },
    { label: 'NPV', key: 'npv' as const },
  ];

  const PLANNING_ROWS = [
    { label: 'מספר קומות', key: 'number_of_floors' as const },
    { label: 'מכפיל זכויות', key: 'multiplier_far' as const },
    { label: 'שטח דירה ממוצע', key: 'avg_apt_size_sqm' as const },
    { label: 'אחוזי תשואה', key: 'returns_percent' as const },
    { label: 'יחס חנייה', key: 'parking_standard_ratio' as const },
  ];

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">השוואת סימולציות</h1>

        {/* Selectors (only show if no pre-selected) */}
        {!preA && (
          <Card className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">פרויקט</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">בחר פרויקט</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">סימולציה א'</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={simA}
                  onChange={(e) => setSimA(e.target.value)}
                >
                  <option value="">בחר</option>
                  {sims.filter((s) => s.status === 'Completed').map((s) => (
                    <option key={s.id} value={s.id}>{s.version_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">סימולציה ב'</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={simB}
                  onChange={(e) => setSimB(e.target.value)}
                >
                  <option value="">בחר</option>
                  {sims.filter((s) => s.status === 'Completed' && s.id !== simA).map((s) => (
                    <option key={s.id} value={s.id}>{s.version_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center h-32">
            <Spinner size={32} />
          </div>
        )}

        {a && b && (
          <>
            {/* Results comparison */}
            {a.simulation_results && b.simulation_results && (
              <Card className="mb-4">
                <h2 className="font-semibold mb-3">תוצאות</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-right py-2">מדד</th>
                      <th className="text-right py-2">{a.version_name}</th>
                      <th className="text-right py-2">{b.version_name}</th>
                      <th className="text-right py-2">הפרש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESULT_ROWS.map((row, i) => {
                      const va = a.simulation_results![row.key];
                      const vb = b.simulation_results![row.key];
                      return (
                        <motion.tr
                          key={row.key}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="border-b border-slate-100"
                        >
                          <td className="py-2 font-medium">{row.label}</td>
                          <td className="py-2">{formatNum(va)}</td>
                          <td className="py-2">{formatNum(vb)}</td>
                          <td className="py-2">
                            <DeltaCell a={va} b={vb} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Planning comparison */}
            {a.planning_parameters && b.planning_parameters && (
              <Card>
                <h2 className="font-semibold mb-3">פרמטרים תכנוניים</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-right py-2">פרמטר</th>
                      <th className="text-right py-2">{a.version_name}</th>
                      <th className="text-right py-2">{b.version_name}</th>
                      <th className="text-right py-2">הפרש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLANNING_ROWS.map((row, i) => {
                      const va = (a.planning_parameters as unknown as Record<string, number>)[row.key];
                      const vb = (b.planning_parameters as unknown as Record<string, number>)[row.key];
                      return (
                        <motion.tr
                          key={row.key}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          className="border-b border-slate-100"
                        >
                          <td className="py-2 font-medium">{row.label}</td>
                          <td className="py-2">{formatNum(va)}</td>
                          <td className="py-2">{formatNum(vb)}</td>
                          <td className="py-2">
                            <DeltaCell a={va} b={vb} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
