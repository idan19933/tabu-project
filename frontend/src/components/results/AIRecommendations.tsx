import { Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import Card from '../ui/Card';
import type { Optimization } from '../../types';

function confidenceColor(confidence: number) {
  if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-700';
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return 'ביטחון גבוה';
  if (confidence >= 0.5) return 'ביטחון בינוני';
  return 'ביטחון נמוך';
}

export default function AIRecommendations({
  optimizations,
  aiNotes,
}: {
  optimizations: Optimization[] | null;
  aiNotes: string | null;
}) {
  if (!optimizations?.length && !aiNotes) {
    return <p className="text-sm text-slate-400 text-center py-8">אין המלצות להצגה</p>;
  }

  return (
    <div className="space-y-4">
      {/* AI Validation Notes */}
      {aiNotes && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100 shrink-0">
              <AlertCircle size={16} className="text-purple-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">הערות AI על החישוב</h4>
              <div className="text-sm text-slate-600 whitespace-pre-line">{aiNotes}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Optimizations */}
      {optimizations && optimizations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            המלצות לשיפור
          </h4>
          {optimizations.map((opt, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 shrink-0">
                  <TrendingUp size={16} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{opt.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">
                      השפעה: {opt.impact_estimate}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${confidenceColor(opt.confidence)}`}
                    >
                      {confidenceLabel(opt.confidence)} ({(opt.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  {opt.parameter && opt.suggested_value != null && (
                    <p className="text-xs text-slate-400 mt-1">
                      {opt.parameter}: {opt.suggested_value}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
