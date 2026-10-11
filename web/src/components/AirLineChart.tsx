import React, { useState } from 'react';
import { SeriesPoint, CleanWindow } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { BarChartIcon } from './Icons';

interface AirLineChartProps {
  series: SeriesPoint[];
  cleanWindow?: CleanWindow;
  smokeEta?: { from: string; to: string } | null;
  lang: Language;
}

export const AirLineChart: React.FC<AirLineChartProps> = ({
  series,
  cleanWindow,
  smokeEta,
  lang,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div className="chart-container-glass" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
        No chart series data available.
      </div>
    );
  }

  const displayPoints = series.slice(0, 48);

  const svgWidth = 560;
  const svgHeight = 290;
  const margin = { top: 25, right: 25, bottom: 45, left: 55 };

  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const maxSeriesVal = Math.max(...displayPoints.map((p) => p.p90), 200);
  const yMax = Math.min(450, Math.ceil(maxSeriesVal / 50) * 50);

  const getX = (index: number) => {
    return margin.left + (index / (displayPoints.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(yMax, val));
    return margin.top + plotHeight - (clamped / yMax) * plotHeight;
  };

  // Build SVG path for p10-p90 uncertainty band
  let bandPath = '';
  displayPoints.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.p90);
    bandPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  for (let i = displayPoints.length - 1; i >= 0; i--) {
    const p = displayPoints[i];
    const x = getX(i);
    const y = getY(p.p10);
    bandPath += ` L ${x} ${y}`;
  }
  bandPath += ' Z';

  // Build SVG path for p50 median line
  let linePath = '';
  displayPoints.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.p50);
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  const cpcbThresholds = [
    { label: 'Moderate (60)', val: 60, col: 'var(--cat-moderate)' },
    { label: 'Poor (90)', val: 90, col: 'var(--cat-poor)' },
    { label: 'Very Poor (120)', val: 120, col: 'var(--cat-very-poor)' },
    { label: 'Severe (250)', val: 250, col: 'var(--cat-severe)' },
  ];

  return (
    <div className="chart-container-glass" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChartIcon size={18} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {lang === 'hi' ? '48-घंटे PM2.5 वायु रेखा' : '48-Hour Atmospheric Forecast'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818CF8' }} />
            Median p50
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '6px', borderRadius: '2px', background: 'rgba(99, 102, 241, 0.25)' }} />
            p10–p90 band
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Grid lines and CPCB thresholds */}
          {cpcbThresholds.map((th) => {
            if (th.val > yMax) return null;
            const y = getY(th.val);
            return (
              <g key={th.val}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + plotWidth}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="4 4"
                />
                <text
                  x={margin.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {th.val}
                </text>
              </g>
            );
          })}

          {/* Uncertainty Band */}
          <path d={bandPath} fill="url(#bandGradient)" />

          {/* Median Forecast Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#818CF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Past Observed Points */}
          {displayPoints.map((p, idx) => {
            if (p.observed === null || p.observed === undefined) return null;
            const cx = getX(idx);
            const cy = getY(p.observed);
            return (
              <circle
                key={`obs-${idx}`}
                cx={cx}
                cy={cy}
                r="3"
                fill="#38BDF8"
                stroke="#090D16"
                strokeWidth="1.5"
              />
            );
          })}

          {/* X Axis Ticks */}
          {[0, 12, 24, 36, 47].map((ptIndex) => {
            const x = getX(ptIndex);
            const label = ptIndex === 0 ? 'Now' : `+${ptIndex}h`;
            return (
              <g key={ptIndex}>
                <line
                  x1={x}
                  y1={margin.top + plotHeight}
                  x2={x}
                  y2={margin.top + plotHeight + 5}
                  stroke="rgba(255, 255, 255, 0.2)"
                />
                <text
                  x={x}
                  y={margin.top + plotHeight + 18}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="11"
                  fontFamily="sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Interactive Hover Focus Bar */}
          {focusedIndex !== null && (
            <g>
              <line
                x1={getX(focusedIndex)}
                y1={margin.top}
                x2={getX(focusedIndex)}
                y2={margin.top + plotHeight}
                stroke="#38BDF8"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(focusedIndex)}
                cy={getY(displayPoints[focusedIndex].p50)}
                r="5"
                fill="#818CF8"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Invisible Overlay for Mouse Move Tracking */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const idx = Math.round((mouseX / plotWidth) * (displayPoints.length - 1));
              if (idx >= 0 && idx < displayPoints.length) {
                setFocusedIndex(idx);
              }
            }}
            onMouseLeave={() => setFocusedIndex(null)}
          />
        </svg>
      </div>

      {/* Focused Point Tooltip Details */}
      {focusedIndex !== null && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-glass-light)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Hour: <strong>+{focusedIndex}h</strong>
          </span>
          <span>
            Median PM2.5: <strong style={{ color: '#818CF8' }}>{Math.round(displayPoints[focusedIndex].p50)} µg/m³</strong>
          </span>
          <span>
            Uncertainty Range: {Math.round(displayPoints[focusedIndex].p10)} – {Math.round(displayPoints[focusedIndex].p90)} µg/m³
          </span>
        </div>
      )}
    </div>
  );
};
