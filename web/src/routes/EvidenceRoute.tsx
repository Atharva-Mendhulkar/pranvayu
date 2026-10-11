import React, { useEffect, useState } from 'react';
import { EvidencePayload } from '../types/payload';
import { Language } from '../lib/i18n';

interface EvidenceRouteProps {
  lang: Language;
  onBack: () => void;
}

export const EvidenceRoute: React.FC<EvidenceRouteProps> = ({ lang, onBack }) => {
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/mock/evidence.json')
      .then((res) => res.json())
      .then((data) => {
        setEvidence(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load evidence.json:', err);
        setLoading(false);
      });
  }, []);

  if (loading || !evidence) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <p>Loading evaluation results...</p>
      </div>
    );
  }

  const { metrics, limits, data_mode, window: win } = evidence;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', paddingTop: '16px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '15px',
          fontWeight: 600,
          marginBottom: '16px',
          textDecoration: 'underline',
        }}
      >
        ← {lang === 'hi' ? 'मुख्य पृष्ठ पर वापस जाएँ' : 'Back to school advisory'}
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
        {lang === 'hi' ? 'हमने इसकी जाँच कैसे की' : 'How we checked this'}
      </h1>

      <p style={{ fontSize: '16px', lineHeight: '24px', color: 'var(--color-ink)', marginBottom: '16px' }}>
        {lang === 'hi'
          ? `प्रणवायु के सभी दावों का मूल्यांकन 28 अक्टूबर से 8 नवंबर 2025 के 11 दिनों के ऐतिहासिक पराली सीज़न के दौरान 10 दिल्ली स्टेशनों के वास्तविक आंकड़ों पर किया गया है।`
          : `All accuracy numbers are evaluated across the 11-day historical stubble burning episode (${win[0]} to ${win[1]}) over 10 CPCB stations in Delhi with >=80% data completeness.`}
      </p>

      {/* Data Mode Banner */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: 'var(--color-panel)',
          border: '1px solid var(--color-rule-blue)',
          borderRadius: 'var(--radius)',
          fontSize: '14px',
          marginBottom: '24px',
        }}
      >
        <strong>Data mode:</strong> {data_mode} ({data_mode === 'oracle_winds' ? 'analysis winds used as upper bound for trajectory potential' : 'archived forecast winds as issued'}).
      </div>

      {/* Table 1: M1 Early Warning */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          1. Smoke early warning against baselines (M1)
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-rule-blue)', backgroundColor: 'var(--color-notebook)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-panel)', borderBottom: '1px solid var(--color-rule-blue)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Method</th>
              <th style={{ padding: '8px 12px' }}>Hit Rate</th>
              <th style={{ padding: '8px 12px' }}>False Alarm Ratio</th>
              <th style={{ padding: '8px 12px' }}>Median Lead</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-rule-blue)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>PranVayu Trajectory Ensemble</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.hit_rate * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.false_alarm_ratio * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m1_events.median_lead_h} hours</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-rule-blue)' }}>
              <td style={{ padding: '8px 12px' }}>Baseline: Simple Fire Count</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.baseline_fire_count.hit_rate * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.baseline_fire_count.false_alarm_ratio * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m1_events.baseline_fire_count.median_lead_h} hours</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px' }}>Baseline: Wind Direction Sector</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.baseline_wind_sector.hit_rate * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m1_events.baseline_wind_sector.false_alarm_ratio * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m1_events.baseline_wind_sector.median_lead_h} hours</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '14px', color: 'var(--color-ink-soft)', marginTop: '8px' }}>
          <strong>Plain reading:</strong> Trajectory integration provides 4.5 hours more median warning than simply counting fires without atmospheric transport modeling.
        </p>
      </section>

      {/* Table 2: M2 Forecast Error */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          2. Forecast error across lead times (M2)
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-rule-blue)', backgroundColor: 'var(--color-notebook)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-panel)', borderBottom: '1px solid var(--color-rule-blue)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Lead Bucket</th>
              <th style={{ padding: '8px 12px' }}>Model MAE</th>
              <th style={{ padding: '8px 12px' }}>Persistence MAE</th>
              <th style={{ padding: '8px 12px' }}>Raw CAMS MAE</th>
              <th style={{ padding: '8px 12px' }}>Skill vs Persistence</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-rule-blue)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>6 to 24 hours (Tomorrow)</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_6_24.mae.model} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_6_24.mae.persistence} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_6_24.mae.raw_cams} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>+{(metrics.m2_error.lead_6_24.skill_vs_persistence * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>24 to 48 hours (Day after)</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_24_48.mae.model} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_24_48.mae.persistence} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m2_error.lead_24_48.mae.raw_cams} µg/m³</td>
              <td style={{ padding: '8px 12px' }}>+{(metrics.m2_error.lead_24_48.skill_vs_persistence * 100).toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '14px', color: 'var(--color-ink-soft)', marginTop: '8px' }}>
          <strong>Plain reading:</strong> Locally bias-corrected forecasts reduce error by ~33% compared to assuming yesterday's reading persists unchanged.
        </p>
      </section>

      {/* Table 3: M3 Verdict Accuracy */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          3. School day timetable verdict accuracy (M3)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)' }}>Unsafe error rate (Go when Skip)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cat-good)', marginTop: '4px' }}>
              {(metrics.m3_verdicts.unsafe_error_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-soft)', marginTop: '4px' }}>Target: rare (&lt;5%)</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)' }}>Mild discrepancy rate</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
              {(metrics.m3_verdicts.mild_error_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-soft)', marginTop: '4px' }}>Between Go and Limit</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)' }}>Over-caution rate (Skip when Go)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
              {(metrics.m3_verdicts.over_caution_rate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-soft)', marginTop: '4px' }}>False indoor advice</div>
          </div>
        </div>
      </section>

      {/* Table 4: M4 Calibration */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          4. Uncertainty band coverage & confidence calibration (M4)
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-rule-blue)', backgroundColor: 'var(--color-notebook)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-panel)', borderBottom: '1px solid var(--color-rule-blue)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Lead Window</th>
              <th style={{ padding: '8px 12px' }}>p10–p90 Band Coverage</th>
              <th style={{ padding: '8px 12px' }}>Confidence Tier</th>
              <th style={{ padding: '8px 12px' }}>MAE on Tier</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-rule-blue)' }}>
              <td style={{ padding: '8px 12px' }}>0 to 6 hours</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m4_calibration.band_coverage.lead_0_6 * 100).toFixed(0)}% (Target: 80%)</td>
              <td style={{ padding: '8px 12px' }}>High</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m4_calibration.mae_by_confidence.high} µg/m³</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-rule-blue)' }}>
              <td style={{ padding: '8px 12px' }}>6 to 24 hours</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m4_calibration.band_coverage.lead_6_24 * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>Medium</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m4_calibration.mae_by_confidence.medium} µg/m³</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px' }}>24 to 48 hours</td>
              <td style={{ padding: '8px 12px' }}>{(metrics.m4_calibration.band_coverage.lead_24_48 * 100).toFixed(0)}%</td>
              <td style={{ padding: '8px 12px' }}>Low</td>
              <td style={{ padding: '8px 12px' }}>{metrics.m4_calibration.mae_by_confidence.low} µg/m³</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Limitations Block */}
      <section style={{ backgroundColor: 'var(--color-panel)', padding: '16px', borderRadius: 'var(--radius)', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          Registered limitations & negative findings
        </h3>
        <ul style={{ paddingLeft: '20px', fontSize: '15px', lineHeight: '24px' }}>
          {limits.map((l, idx) => (
            <li key={idx} style={{ marginBottom: '6px' }}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};
