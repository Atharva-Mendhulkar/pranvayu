export interface LocalityInfo {
  id: string;
  name_en: string;
  name_hi: string;
  lat: number;
  lon: number;
  station_name: string;
}

export interface VerdictRange {
  p10: number;
  p50: number;
  p90: number;
}

export interface VerdictItem {
  period_id: string;
  time: string;
  activity_type: 'light' | 'strenuous';
  verdict: 'go' | 'limit' | 'skip';
  decision_value: number;
  range: VerdictRange;
  category: string;
  threshold_used: {
    go: number;
    limit: number;
  };
}

export interface CleanWindow {
  from: string;
  to: string;
  kind: 'best' | 'least_bad';
}

export interface DayForecast {
  date: string;
  confidence: 'high' | 'medium' | 'low';
  verdicts: VerdictItem[];
  clean_window: CleanWindow;
}

export interface SeriesPoint {
  t: string;
  p10: number;
  p50: number;
  p90: number;
  observed: number | null;
}

export interface DriverItem {
  type: 'regional_smoke' | 'local_trapping' | 'dust';
  level?: string;
  confidence: string;
  eta?: {
    from: string;
    to: string;
  };
  evidence: Record<string, any>;
}

export interface SmokePath {
  level_hpa: number;
  points: [number, number][];
  tick_hours: number;
}

export interface FireDetectionItem {
  lat: number;
  lon: number;
  frp: number;
  t: string;
}

export interface SmokeInfo {
  present_now: boolean;
  level_series: Array<{
    t: string;
    p: number;
    level: string;
    median_sii?: number;
  }>;
  fires: FireDetectionItem[];
  paths: SmokePath[];
}

export interface GrapInfo {
  stage: string;
  effective_date: string;
  source_url: string;
  updated_at?: string;
  stale?: boolean;
}

export interface ForecastPayload {
  schema_version: number;
  mode: 'live' | 'replay';
  replay: {
    run_id: string;
    window: [string, string];
  } | null;
  generated_at: string;
  as_of: string;
  locality: LocalityInfo;
  freshness: {
    fires_at: string | null;
    winds_run: string | null;
    obs_at: string | null;
    cams_run: string | null;
  };
  flags: string[];
  days: DayForecast[];
  series: SeriesPoint[];
  drivers: DriverItem[];
  smoke: SmokeInfo;
  grap: GrapInfo;
  text: {
    en: string[];
    hi: string[];
  } | null;
}

export interface EvidencePayload {
  schema_version: number;
  run_id: string;
  window: [string, string];
  data_mode: string;
  n_stations: number;
  n_days: number;
  calibration_days: number;
  evaluation_days: number;
  metrics: {
    m1_events: {
      events: number;
      hit_rate: number;
      false_alarm_ratio: number;
      median_lead_h: number;
      baseline_fire_count: {
        hit_rate: number;
        false_alarm_ratio: number;
        median_lead_h: number;
      };
      baseline_wind_sector: {
        hit_rate: number;
        false_alarm_ratio: number;
        median_lead_h: number;
      };
    };
    m2_error: {
      lead_6_24: {
        mae: Record<string, number>;
        rmse: Record<string, number>;
        bias: Record<string, number>;
        skill_vs_persistence: number;
        category_agreement_exact: number;
        category_agreement_within_one: number;
      };
      lead_24_48: {
        mae: Record<string, number>;
        rmse: Record<string, number>;
        bias: Record<string, number>;
        skill_vs_persistence: number;
        category_agreement_exact: number;
        category_agreement_within_one: number;
      };
    };
    m3_verdicts: {
      confusion: Record<string, number>;
      unsafe_error_rate: number;
      mild_error_rate: number;
      over_caution_rate: number;
    };
    m4_calibration: {
      band_coverage: {
        lead_0_6: number;
        lead_6_24: number;
        lead_24_48: number;
      };
      mae_by_confidence: {
        high: number;
        medium: number;
        low: number;
      };
    };
    m5_smoke_effect: {
      excess_when_smoke: number;
      ci: [number, number];
    };
  };
  limits: string[];
  generated_at: string;
}
