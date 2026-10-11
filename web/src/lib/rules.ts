import { SeriesPoint, VerdictItem, CleanWindow } from '../types/payload';
import { Language } from './i18n';

export interface ClientRulesConfig {
  activities: {
    light: { go_max: number; limit_max: number };
    strenuous: { go_max: number; limit_max: number };
  };
  period_durations_min: Record<string, number>;
  clean_window: {
    start_hour: number;
    end_hour: number;
    window_minutes: number;
    step_minutes: number;
  };
}

export function evaluateClientVerdict(
  series: SeriesPoint[],
  dateStr: string,
  timeStr: string,
  activityType: 'light' | 'strenuous',
  durationMin: number,
  confidence: 'high' | 'medium' | 'low',
  rulesCfg: ClientRulesConfig
): VerdictItem {
  // Target UTC timestamp from dateStr (YYYY-MM-DD) and timeStr (HH:MM IST, +05:30)
  const [h, m] = timeStr.split(':').map(Number);
  const istDate = new Date(`${dateStr}T${timeStr}:00+05:30`);
  const targetTs = Math.floor(istDate.getTime() / 1000);
  const endTs = targetTs + durationMin * 60;

  // Find overlapping points in series
  const matched = series.filter((pt) => {
    const ptTs = Math.floor(new Date(pt.t).getTime() / 1000);
    return ptTs >= targetTs - 1800 && ptTs <= endTs + 1800;
  });

  let p10 = 80;
  let p50 = 100;
  let p90 = 130;

  if (matched.length > 0) {
    p10 = Math.round(matched.reduce((acc, p) => acc + p.p10, 0) / matched.length);
    p50 = Math.round(matched.reduce((acc, p) => acc + p.p50, 0) / matched.length);
    p90 = Math.round(matched.reduce((acc, p) => acc + p.p90, 0) / matched.length);
  }

  // Decision value
  let decVal = p50;
  if (confidence === 'medium') {
    decVal = Math.round((p50 + p90) / 2);
  } else if (confidence === 'low') {
    decVal = p90;
  }

  // Thresholds
  const actCfg = rulesCfg.activities[activityType] || rulesCfg.activities.light;
  const goMax = actCfg.go_max;
  const limitMax = actCfg.limit_max;

  let verdict: 'go' | 'limit' | 'skip' = 'skip';
  if (decVal <= goMax) {
    verdict = 'go';
  } else if (decVal <= limitMax) {
    verdict = 'limit';
  }

  // CPCB category
  let category = 'severe';
  if (decVal <= 30) category = 'good';
  else if (decVal <= 60) category = 'satisfactory';
  else if (decVal <= 90) category = 'moderate';
  else if (decVal <= 120) category = 'poor';
  else if (decVal <= 250) category = 'very_poor';

  return {
    period_id: 'custom',
    time: timeStr,
    activity_type: activityType,
    verdict,
    decision_value: decVal,
    range: { p10, p50, p90 },
    category,
    threshold_used: { go: goMax, limit: limitMax },
  };
}

export function generateDeterministicHeadline(
  verdicts: VerdictItem[],
  cleanWindow: CleanWindow,
  lang: Language
): string {
  const gos = verdicts.filter((v) => v.verdict === 'go');
  const skips = verdicts.filter((v) => v.verdict === 'skip');

  if (lang === 'hi') {
    if (gos.length === verdicts.length) {
      return 'आज बाहर का समय ठीक है।';
    }
    if (skips.length === verdicts.length) {
      return `सब कुछ अंदर रखें। सबसे कम खराब समय ${cleanWindow.from} से ${cleanWindow.to} है।`;
    }
    const hasAssemblySkip = skips.some((v) => v.period_id === 'assembly');
    const peGo = gos.find((v) => v.period_id === 'pe');
    if (hasAssemblySkip && peGo) {
      return `बाहर की असेंबली न रखें। ${peGo.time} का पीटी ठीक है।`;
    }
    return `कुछ गतिविधियां अंदर रखें और बाकी बाहर की जा सकती हैं।`;
  }

  // English
  if (gos.length === verdicts.length) {
    return 'Outdoor time is fine today.';
  }
  if (skips.length === verdicts.length) {
    return `Keep everything indoors. The least bad time is ${cleanWindow.from} to ${cleanWindow.to}.`;
  }
  const hasAssemblySkip = skips.some((v) => v.period_id === 'assembly');
  const peGo = gos.find((v) => v.period_id === 'pe');
  if (hasAssemblySkip && peGo) {
    return `Skip the outdoor assembly. PE at ${peGo.time} is fine.`;
  }
  return 'Outdoor activities are manageable with caution.';
}
