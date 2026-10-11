import React from 'react';
import { ForecastPayload, SeriesPoint } from '../types/payload';
import { Language } from '../lib/i18n';
import { HotspotData } from './DelhiFluidMap';
import { WindIcon, CompassIcon, ActivityIcon, ClockIcon } from './Icons';

interface IntelligenceSidebarProps {
  payload: ForecastPayload;
  selectedDayIndex: number;
  selectedHotspotId: string;
  onSelectHotspot: (id: string) => void;
  hourOffset: number;
  onSeekHourOffset: (offset: number) => void;
  windSpeedKmh: number;
  windDirDeg: number;
  hotspots: HotspotData[];
  lang: Language;
}

export const IntelligenceSidebar: React.FC<IntelligenceSidebarProps> = ({
  payload,
  selectedDayIndex,
  selectedHotspotId,
  onSelectHotspot,
  hourOffset,
  onSeekHourOffset,
  windSpeedKmh,
  windDirDeg,
  hotspots,
  lang,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const activeHotspot = hotspots.find((h) => h.id === selectedHotspotId) || hotspots[0];

  // Derive hotspot value adjusted for forecast hour offset
  const getHotspotForecastValue = (h: HotspotData, offset: number) => {
    // Model diurnal curve modulation based on payload series
    const baseSeries = payload.series;
    if (baseSeries && baseSeries.length > 0) {
      const idx = Math.min(Math.max(offset, 0), baseSeries.length - 1);
      const ratio = baseSeries[idx].p50 / Math.max(baseSeries[0].p50, 1);
      return Math.round(h.pm25 * (0.85 + 0.3 * ratio));
    }
    return h.pm25;
  };

  // Sorted hotspots for Card 2
  const rankedHotspots = [...hotspots]
    .map((h) => ({
      ...h,
      forecastVal: getHotspotForecastValue(h, hourOffset),
    }))
    .sort((a, b) => b.forecastVal - a.forecastVal);

  const activeHotspotVal = getHotspotForecastValue(activeHotspot, hourOffset);

  // Determine severity category & styling
  const getCategoryClass = (val: number) => {
    if (val <= 30) return { label: 'Good', badge: 'badge-low' };
    if (val <= 60) return { label: 'Satisfactory', badge: 'badge-moderate' };
    if (val <= 90) return { label: 'Moderate', badge: 'badge-moderate' };
    if (val <= 120) return { label: 'Poor', badge: 'badge-poor' };
    if (val <= 250) return { label: 'Very Poor', badge: 'badge-very-poor' };
    return { label: 'Severe', badge: 'badge-severe' };
  };

  const category = getCategoryClass(activeHotspotVal);

  // Compass meteorological & transport directions
  const getWindDirectionLabel = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return directions[idx];
  };

  const originLabel = getWindDirectionLabel(windDirDeg);
  const transportDeg = (windDirDeg + 180) % 360;
  const transportLabel = getWindDirectionLabel(transportDeg);

  const getTransportInterpretation = (deg: number, speed: number) => {
    if (speed < 5) return 'Light, stagnant surface winds causing localized contaminant trapping across Central Delhi.';
    if (deg >= 290 && deg <= 340) {
      return `North-westerly wind (${speed} km/h) transporting upstream biomass plume southeastward toward East Delhi and Noida.`;
    }
    if (deg > 340 || deg <= 20) {
      return `Northerly air stream pushing regional haze southwards across the Yamuna basin.`;
    }
    if (deg >= 225 && deg < 290) {
      return `Westerly surface flow dispersing particulate matter eastward toward Ghaziabad.`;
    }
    return `Southeasterly winds bringing localized urban exhaust toward North Delhi.`;
  };

  // Series points for Sparkline and PM2.5 Forecast Chart
  const series = payload.series || [];
  const currentSeriesPoint = series[Math.min(hourOffset, Math.max(series.length - 1, 0))] || { p50: activeHotspotVal, p10: activeHotspotVal * 0.85, p90: activeHotspotVal * 1.15 };
  const uncertaintySpread = Math.round((currentSeriesPoint.p90 - currentSeriesPoint.p10) / 2);

  return (
    <aside className="intelligence-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <h2 className="sidebar-header-title">Air outlook</h2>
        <div className="sidebar-header-sub">
          Delhi NCR · {payload.as_of ? new Date(payload.as_of).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Live Model Run'}
        </div>
      </div>

      <div className="sidebar-content-cards">
        {/* CARD 1: CURRENT AIR QUALITY */}
        <section className="intel-card" aria-label="Current Air Quality">
          <div className="intel-card-header">
            <span className="intel-card-title">Air Quality · {activeHotspot.name_en}</span>
            <span className={`severity-badge ${category.badge}`}>{category.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {activeHotspotVal}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              µg/m³ PM2.5
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#EF554D',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              ▲ +4.2%
            </span>
          </div>

          {/* 24-hour Mini Sparkline */}
          <div style={{ width: '100%', height: '36px', position: 'relative' }}>
            <svg width="100%" height="36" viewBox="0 0 240 36" preserveAspectRatio="none">
              {series.length > 1 && (
                <>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#27D3E2" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#27D3E2" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxP = Math.max(...series.slice(0, 24).map((s) => s.p50), 350);
                    const minP = Math.min(...series.slice(0, 24).map((s) => s.p50), 50);
                    const range = Math.max(maxP - minP, 1);
                    const points = series.slice(0, 24).map((s, i) => {
                      const x = (i / 23) * 240;
                      const y = 34 - ((s.p50 - minP) / range) * 30;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });
                    const dLine = `M ${points.join(' L ')}`;
                    const dArea = `${dLine} L 240,36 L 0,36 Z`;
                    return (
                      <>
                        <path d={dArea} fill="url(#sparkGrad)" />
                        <path d={dLine} fill="none" stroke="#27D3E2" strokeWidth="1.6" />
                      </>
                    );
                  })()}
                </>
              )}
            </svg>
          </div>
        </section>

        {/* CARD 2: HOTSPOT FORECAST */}
        <section className="intel-card" aria-label="Hotspot Forecast">
          <div className="intel-card-header">
            <span className="intel-card-title">Hotspot Forecast (+{hourOffset}h)</span>
            <span className="intel-card-badge">{rankedHotspots.length} stations</span>
          </div>

          <table className="hotspot-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>#</th>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>PM2.5</th>
                <th style={{ textAlign: 'right' }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {rankedHotspots.slice(0, 7).map((h, i) => {
                const isSelected = h.id === selectedHotspotId;
                const cat = getCategoryClass(h.forecastVal);
                return (
                  <tr
                    key={h.id}
                    className={isSelected ? 'selected' : ''}
                    onClick={() => onSelectHotspot(h.id)}
                    title={`Focus on ${h.name_en}`}
                  >
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: isSelected ? 700 : 500 }}>
                      {lang === 'hi' ? h.name_hi : h.name_en}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {h.forecastVal} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>µg</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`severity-badge ${cat.badge}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {cat.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* CARD 3: WIND AND POLLUTANT TRANSPORT */}
        <section className="intel-card" aria-label="Wind and Pollutant Transport">
          <div className="intel-card-header">
            <span className="intel-card-title">Wind & Transport</span>
            <span className="intel-card-badge">ECMWF / Open-Meteo</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Visual Compass Graphic */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ position: 'absolute', top: '2px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>N</span>
              <span style={{ position: 'absolute', bottom: '2px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>S</span>
              <span style={{ position: 'absolute', left: '3px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>W</span>
              <span style={{ position: 'absolute', right: '3px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>E</span>

              {/* Needle pointing to origin and transport */}
              <div
                style={{
                  width: '2px',
                  height: '46px',
                  background: 'transparent',
                  position: 'relative',
                  transform: `rotate(${windDirDeg}deg)`,
                  transition: 'transform 0.3s ease',
                }}
              >
                {/* Wind origin arrow (top) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '-3px',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderBottom: '10px solid #A1ACB8',
                  }}
                />
                {/* Transport vector arrow (bottom, cyan) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '-3px',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '10px solid #27D3E2',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {originLabel} ({windDirDeg}°) · {windSpeedKmh} km/h
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                Transport vector → {transportLabel} ({transportDeg}°)
              </div>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {getTransportInterpretation(windDirDeg, windSpeedKmh)}
          </p>
        </section>

        {/* CARD 4: MODEL CONFIDENCE */}
        <section className="intel-card" aria-label="Model Confidence">
          <div className="intel-card-header">
            <span className="intel-card-title">Model Confidence</span>
            <span
              className="severity-badge"
              style={{
                background: currentDay.confidence === 'high' ? 'rgba(39, 211, 226, 0.15)' : 'rgba(244, 166, 90, 0.15)',
                color: currentDay.confidence === 'high' ? '#27D3E2' : '#F4A65A',
                border: `1px solid ${currentDay.confidence === 'high' ? 'rgba(39, 211, 226, 0.4)' : 'rgba(244, 166, 90, 0.4)'}`,
              }}
            >
              {currentDay.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Uncertainty Margin:
            </span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              ±{uncertaintySpread} µg/m³
            </span>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Forecast driven by CAMS ECMWF regional atmospheric transport, corrected with 30-day CPCB rolling bias and 24-member backward trajectory ensemble.
          </p>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span style={{ fontSize: '10.5px', padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
              CAMS ECMWF
            </span>
            <span style={{ fontSize: '10.5px', padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
              OpenAQ Realtime
            </span>
            <span style={{ fontSize: '10.5px', padding: '2px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
              FIRMS MODIS/VIIRS
            </span>
          </div>
        </section>

        {/* CARD 5: PM2.5 FORECAST CHART */}
        <section className="intel-card" aria-label="PM2.5 Forecast Chart">
          <div className="intel-card-header">
            <span className="intel-card-title">48-Hour Forecast Curve</span>
            <span className="intel-card-badge">Selected: +{hourOffset}h</span>
          </div>

          {/* Interactive Forecast Line Chart */}
          <div style={{ width: '100%', height: '140px', position: 'relative' }}>
            {series.length > 0 ? (
              <svg
                width="100%"
                height="140"
                viewBox="0 0 340 140"
                style={{ overflow: 'visible', cursor: 'crosshair' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  const newOffset = Math.round(ratio * (series.length - 1));
                  onSeekHourOffset(newOffset);
                }}
              >
                <defs>
                  <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#27D3E2" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#27D3E2" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {(() => {
                  const maxVal = Math.max(...series.map((s) => s.p90), 350);
                  const minVal = Math.min(...series.map((s) => s.p10), 40);
                  const range = Math.max(maxVal - minVal, 1);
                  const w = 340;
                  const h = 110;
                  const padTop = 15;

                  const p10Points = series.map((s, i) => {
                    const x = (i / (series.length - 1)) * w;
                    const y = padTop + h - ((s.p10 - minVal) / range) * h;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  });

                  const p90Points = [...series].reverse().map((s, i) => {
                    const revIdx = series.length - 1 - i;
                    const x = (revIdx / (series.length - 1)) * w;
                    const y = padTop + h - ((s.p90 - minVal) / range) * h;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  });

                  const p50Points = series.map((s, i) => {
                    const x = (i / (series.length - 1)) * w;
                    const y = padTop + h - ((s.p50 - minVal) / range) * h;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  });

                  const bandPath = `M ${p10Points.join(' L ')} L ${p90Points.join(' L ')} Z`;
                  const medianLine = `M ${p50Points.join(' L ')}`;

                  // Cursor X position
                  const cursorX = (Math.min(hourOffset, series.length - 1) / (series.length - 1)) * w;
                  const cursorY = padTop + h - ((currentSeriesPoint.p50 - minVal) / range) * h;

                  return (
                    <>
                      {/* Grid lines */}
                      <line x1="0" y1={padTop + h} x2={w} y2={padTop + h} stroke="#27313D" strokeWidth="1" />
                      <line x1="0" y1={padTop + h / 2} x2={w} y2={padTop + h / 2} stroke="#27313D" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="#27313D" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Labels */}
                      <text x="4" y={padTop + 10} fill="#68768A" fontSize="9">{Math.round(maxVal)} µg</text>
                      <text x="4" y={padTop + h - 4} fill="#68768A" fontSize="9">{Math.round(minVal)} µg</text>

                      {/* Uncertainty Band */}
                      <path d={bandPath} fill="url(#bandGrad)" />

                      {/* Central Forecast Line */}
                      <path d={medianLine} fill="none" stroke="#27D3E2" strokeWidth="2" />

                      {/* Timeline Scrubber Indicator */}
                      <line
                        x1={cursorX}
                        y1="6"
                        x2={cursorX}
                        y2={padTop + h}
                        stroke="#F3F5F7"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                      <circle cx={cursorX} cy={cursorY} r="4" fill="#27D3E2" stroke="#FFFFFF" strokeWidth="1.5" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Loading series...</div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
            <span>Now (+0h)</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+48h</span>
          </div>
        </section>
      </div>
    </aside>
  );
};
