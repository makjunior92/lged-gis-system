import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useT } from '@/contexts/I18nContext';
import type { Project } from '@/types/project';

interface Props {
  project: Project;
  showThreshold?: boolean;
}

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;
const RING_DURATION_MS = 900;
const SCORE_POP_DELAY_MS = 720;

function scoreArcColor(score: number): string | null {
  if (score <= 0) return null;
  if (score < 50) return '#dc2626';
  if (score < 80) return '#ca8a04';
  return '#16a34a';
}

function useAnimatedScore(score: number) {
  const [popScore, setPopScore] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    setPopScore(false);
    setShowLabel(false);

    const delay = score <= 0 ? 200 : SCORE_POP_DELAY_MS;
    const popTimer = window.setTimeout(() => setPopScore(true), delay);
    const labelTimer = window.setTimeout(() => setShowLabel(true), delay + 160);

    return () => {
      window.clearTimeout(popTimer);
      window.clearTimeout(labelTimer);
    };
  }, [score]);

  return { popScore, showLabel };
}

function ScoreRing({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const scoreOffset = RING_C * (1 - pct / 100);
  const arcColor = scoreArcColor(score);
  const thresholdRad = (threshold / 100) * 2 * Math.PI - Math.PI / 2;
  const tickX = 50 + RING_R * Math.cos(thresholdRad);
  const tickY = 50 + RING_R * Math.sin(thresholdRad);
  const { popScore, showLabel } = useAnimatedScore(score);

  const ringStyle = {
    '--ring-c': RING_C,
    '--ring-offset': scoreOffset,
    '--ring-duration': `${RING_DURATION_MS}ms`,
  } as React.CSSProperties;

  return (
    <div className="relative h-28 w-28 shrink-0" style={ringStyle}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          className="text-slate-200"
          stroke="currentColor"
          strokeWidth="7"
        />
        {arcColor && pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RING_R}
            fill="none"
            stroke={arcColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C}
            className="score-ring-arc"
            style={ringStyle}
          />
        )}
        <circle cx={tickX} cy={tickY} r="3.5" fill="#475569" className="score-tick-fade" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-3xl font-bold tabular-nums leading-none text-slate-900 ${
            popScore ? 'score-number-pop' : 'scale-75 opacity-0'
          }`}
          style={{ color: arcColor ?? '#0f172a' }}
        >
          {score}
        </span>
        <span
          className={`mt-0.5 text-xs text-slate-500 ${
            showLabel ? 'score-label-fade' : 'opacity-0'
          }`}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

export default function AssessmentScoreCard({ project, showThreshold = true }: Props) {
  const { t } = useT();
  const assessment = project.assessment;
  if (!assessment) return null;

  const threshold = assessment.pass_threshold;
  const score = assessment.total_score;
  const passed = assessment.passed;

  return (
    <div
      className={`rounded-lg border p-4 ${passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {passed ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{t('assessment.title')}</h3>
            <p className="text-sm text-slate-600">
              {passed ? t('assessment.passed') : t('assessment.failed')}
              {showThreshold && ` · ${t('assessment.threshold', { score: threshold })}`}
            </p>
          </div>
        </div>
        <ScoreRing score={score} threshold={threshold} />
      </div>

      {assessment.breakdown.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {assessment.breakdown.map((item) => (
            <li
              key={item.rule_key}
              className={`rounded border px-3 py-2 ${item.passed ? 'border-slate-200 bg-white/70' : 'border-amber-300 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {item.display_name ?? item.rule_key}
                  {item.rule_type === 'veto' && (
                    <span className="ml-2 text-xs uppercase text-red-600">{t('assessment.veto')}</span>
                  )}
                </span>
                {item.rule_type === 'weighted' && (
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {item.earned}/{item.max}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-slate-600">{item.message}</p>
              {item.matches && item.matches.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-slate-500">
                  {item.matches.map((m) => (
                    <li key={m.project_id}>
                      {m.project_code} — {m.project_name} ({m.reason})
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
