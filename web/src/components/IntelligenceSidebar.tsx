import React from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';
import { HotspotData } from './DelhiFluidMap';
import { MonitoringStation, School, SchoolPeriodVerdict } from '../types/intelligence';
import { WindIcon, SchoolIcon, StationIcon, ActivityIcon, ClockIcon } from './Icons';
import { InspectedLocation, getPaletteTier } from '../lib/continuousField';

interface IntelligenceSidebarProps {
  payload: ForecastPayload;
  selectedDayIndex: number;
  selectedHotspotId: string;
  onSelectHotspot: (id: string) => void;
  selectedStationId?: string;
  onSelectStation?: (id: string) => void;
  selectedSchoolId?: string;
  onSelectSchool?: (id: string) => void;
  inspectedLocation?: InspectedLocation | null;
  onInspectLocation?: (loc: InspectedLocation | null) => void;
  hourOffset: number;
  onSeekHourOffset: (offset: number) => void;
  windSpeedKmh: number;
  windDirDeg: number;
  hotspots: HotspotData[];
  stations: MonitoringStation[];
  schools: School[];
  lang: Language;
}

export const IntelligenceSidebar: React.FC<IntelligenceSidebarProps> = ({
  payload,
  selectedDayIndex,
  selectedHotspotId,
  onSelectHotspot,
  selectedStationId,
  onSelectStation,
  selectedSchoolId,
  onSelectSchool,
  inspectedLocation,
  onInspectLocation,
  hourOffset,
  onSeekHourOffset,
  windSpeedKmh,
  windDirDeg,
  hotspots,
  stations,
  schools,
  lang,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const activeHotspot = hotspots.find((h) => h.id === selectedHotspotId) || hotspots[0];
  const activeStation = stations.find((s) => s.id === (selectedStationId || selectedHotspotId)) || stations[0];
  const activeSchool = schools.find((s) => s.id === selectedSchoolId);

  // Derive forecast value modulated for diurnal cycle
  const getHotspotForecastValue = (basePm: number, offset: number) => {
    const baseSeries = payload.series;
    if (baseSeries && baseSeries.length > 0) {
      const idx = Math.min(Math.max(offset, 0), baseSeries.length - 1);
      const ratio = baseSeries[idx].p50 / Math.max(baseSeries[0].p50, 1);
      return Math.round(basePm * (0.85 + 0.3 * ratio));
    }
    return basePm;
  };

  // Helper: Severity categorization (7-tier standard)
  const getCategoryClass = (val: number) => {
    const tier = getPaletteTier(val);
    return {
      label: tier.label_en,
      label_hi: tier.label_hi,
      badge: tier.badge,
      color: tier.hex,
    };
  };

  // Ranked hotspots
  const rankedHotspots = [...hotspots]
    .map((h) => ({
      ...h,
      forecastVal: getHotspotForecastValue(h.pm25, hourOffset),
    }))
    .sort((a, b) => b.forecastVal - a.forecastVal);

  const activeHotspotVal = getHotspotForecastValue(activeHotspot.pm25, hourOffset);
  const category = getCategoryClass(activeHotspotVal);

  // Compass directions
  const getWindDirectionLabel = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return directions[idx];
  };

  const originLabel = getWindDirectionLabel(windDirDeg);
  const transportDeg = (windDirDeg + 180) % 360;
  const transportLabel = getWindDirectionLabel(transportDeg);

  const getTransportInterpretation = (deg: number, speed: number) => {
    if (speed < 5) return 'Light surface winds causing localized stagnation across Central Delhi.';
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

  // Series points for uncertainty spread & forecast curve
  const series = payload.series || [];
  const currentSeriesPoint = series[Math.min(hourOffset, Math.max(series.length - 1, 0))] || {
    p50: activeHotspotVal,
    p10: activeHotspotVal * 0.85,
    p90: activeHotspotVal * 1.15,
  };
  const uncertaintySpread = Math.round((currentSeriesPoint.p90 - currentSeriesPoint.p10) / 2);

  // Compute school periods verdicts for a given school
  const computeSchoolPeriods = (school: School): SchoolPeriodVerdict[] => {
    const schoolBasePm = (() => {
      const match = stations.find((s) => s.id === school.nearest_station_id);
      return match ? match.current_obs_pm25 : 200;
    })();

    // Factors for periods (Morning arrival 07:30, Assembly 08:30, PE 11:00, Dispersal 14:30)
    const periods = [
      { id: 'arrival', time: '07:30 - 08:30', name_en: 'Morning Arrival', name_hi: 'सुबह आगमन', factor: 1.18 },
      { id: 'assembly', time: '08:30 - 09:00', name_en: 'Outdoor Assembly', name_hi: 'प्रार्थना सभा', factor: 1.12 },
      { id: 'pe', time: '10:30 - 12:00', name_en: 'Recess & PE', name_hi: 'खेल कूद व मध्यांतर', factor: 0.92 },
      { id: 'dispersal', time: '14:00 - 15:00', name_en: 'Afternoon Dispersal', name_hi: 'दोपहर छुट्टी', factor: 0.85 },
    ];

    return periods.map((p) => {
      const forecastVal = Math.round(schoolBasePm * p.factor * (1 + (hourOffset / 48) * 0.15));
      const v: 'go' | 'limit' | 'skip' = forecastVal > 220 ? 'skip' : forecastVal > 110 ? 'limit' : 'go';
      const cat = getCategoryClass(forecastVal);
      return {
        period_id: p.id,
        time: p.time,
        name_en: p.name_en,
        name_hi: p.name_hi,
        forecast_pm25: forecastVal,
        verdict: v,
        category: cat.label,
      };
    });
  };

  return (
    <aside className="intelligence-sidebar" aria-label="Geospatial Air Intelligence">
      {/* 1. SIDEBAR HEADER */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="sidebar-header-title">Air intelligence</h2>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '2px',
              background: 'rgba(39, 211, 226, 0.12)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(39, 211, 226, 0.3)',
              letterSpacing: '0.4px',
            }}
          >
            +{hourOffset}H FORECAST
          </span>
        </div>
        <div className="sidebar-header-sub">
          Delhi NCR · CPCB / DPCC Network · PINN Dispersion
        </div>
      </div>

      <div className="sidebar-content-cards">
        {/* 2. INSPECTED LOCATION OR CURRENT CONDITIONS */}
        {inspectedLocation ? (
          <section
            className="sidebar-section"
            aria-label="Inspected Spatial Estimate"
            style={{ borderLeft: inspectedLocation.validity === 'missing' ? '3px solid var(--border-medium)' : '3px solid var(--accent-cyan)' }}
          >
            <div className="sidebar-section-header">
              <span className="sidebar-section-title" style={{ color: inspectedLocation.validity === 'missing' ? 'var(--text-muted)' : 'var(--accent-cyan)' }}>
                {inspectedLocation.validity === 'missing' ? 'Out of Domain · ' : 'Spatial Estimate · '}
                {inspectedLocation.lat.toFixed(3)}°N, {inspectedLocation.lon.toFixed(3)}°E
              </span>
              <span className={`severity-badge ${inspectedLocation.tier.badge}`}>
                {lang === 'hi' ? inspectedLocation.tier.label_hi : inspectedLocation.tier.label_en}
              </span>
            </div>

            {inspectedLocation.validity === 'missing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '-0.5px' }}>
                    --
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    µg/m³ PM2.5
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    No Data
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    padding: '8px 10px',
                    borderRadius: '3px',
                    background: 'rgba(28, 36, 45, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    color: '#E2E8F0',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>{lang === 'hi' ? 'चयनित समय क्षितिज के लिए इस स्थान पर अनुमान उपलब्ध नहीं है।' : 'An estimate is unavailable at this location for the selected horizon.'}</strong>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {lang === 'hi'
                      ? 'यह स्थान समर्थित दिल्ली एनसीआर मॉडलिंग बेसिन (28.25°N–28.95°N, 76.75°E–77.60°E) से बाहर है। मॉडल कोई मनमाना मान प्रस्तुत नहीं करता।'
                      : 'This coordinate is outside the supported Delhi NCR modeling basin (28.25°N–28.95°N, 76.75°E–77.60°E). Boundary meteorology is unavailable.'}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '10.5px',
                    padding: '6px 8px',
                    borderRadius: '3px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nearest Monitoring Station:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {inspectedLocation.nearestStation.name_en} ({inspectedLocation.nearestStation.distanceKm} km)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Station Observation:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {inspectedLocation.nearestStation.observedPm25} µg/m³ ({inspectedLocation.nearestStation.agency})
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                    {inspectedLocation.estimatedPm25}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    µg/m³ PM2.5
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--accent-cyan)',
                    }}
                  >
                    ±{inspectedLocation.uncertaintySpread} µg/m³ σ
                  </span>
                </div>

                {/* Provenance and Distance to Observation Anchor */}
                <div
                  style={{
                    fontSize: '10.5px',
                    padding: '6px 8px',
                    borderRadius: '3px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Data Provenance:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {inspectedLocation.provenanceLabel_en}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nearest Physical Sensor:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {inspectedLocation.nearestStation.name_en} ({inspectedLocation.nearestStation.distanceKm} km)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sensor Observation:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {inspectedLocation.nearestStation.observedPm25} µg/m³ ({inspectedLocation.nearestStation.agency} verified)
                    </span>
                  </div>
                </div>

                {/* Component Decomposition */}
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--border-subtle)', paddingTop: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Regional Background:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{inspectedLocation.components.background} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>NW Biomass Advection:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{inspectedLocation.components.smokeAdvection} µg/m³</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Urban Core Dispersion:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{inspectedLocation.components.urbanDispersion} µg/m³</span>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              <button
                type="button"
                className="segmented-pill-btn active"
                style={{ flex: 1, padding: '4px 6px', fontSize: '10.5px', textAlign: 'center' }}
                onClick={() => {
                  if (onSelectStation) onSelectStation(inspectedLocation.nearestStation.id);
                  onSelectHotspot(inspectedLocation.nearestStation.id);
                }}
              >
                Focus Station ({inspectedLocation.nearestStation.agency})
              </button>
              <button
                type="button"
                className="segmented-pill-btn"
                style={{ padding: '4px 8px', fontSize: '10.5px' }}
                onClick={() => {
                  if (onInspectLocation) onInspectLocation(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : (
          <section className="sidebar-section" aria-label="Current Air Quality">
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">
                Current Conditions · {activeHotspot.name_en}
              </span>
              <span className={`severity-badge ${category.badge}`}>{category.label}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {activeHotspotVal}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                µg/m³ PM2.5
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--pollution-very-high)',
                }}
              >
                AQI ~{Math.min(500, Math.round(activeHotspotVal * 1.35))}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Nearest Sensor: {activeStation.name_en}</span>
              <span>Freshness: 14m ago</span>
            </div>

            {/* Mini 24h Trend */}
            <div style={{ width: '100%', height: '28px', position: 'relative', marginTop: '2px' }}>
              <svg width="100%" height="28" viewBox="0 0 240 28" preserveAspectRatio="none">
                {series.length > 1 && (
                  <>
                    <defs>
                      <linearGradient id="sparkGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#27D3E2" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#27D3E2" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const maxP = Math.max(...series.slice(0, 24).map((s) => s.p50), 350);
                      const minP = Math.min(...series.slice(0, 24).map((s) => s.p50), 50);
                      const range = Math.max(maxP - minP, 1);
                      const points = series.slice(0, 24).map((s, i) => {
                        const x = (i / 23) * 240;
                        const y = 26 - ((s.p50 - minP) / range) * 24;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      });
                      const dLine = `M ${points.join(' L ')}`;
                      const dArea = `${dLine} L 240,28 L 0,28 Z`;
                      return (
                        <>
                          <path d={dArea} fill="url(#sparkGrad2)" />
                          <path d={dLine} fill="none" stroke="#27D3E2" strokeWidth="1.5" />
                        </>
                      );
                    })()}
                  </>
                )}
              </svg>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', marginTop: '4px', fontStyle: 'italic' }}>
              Click any coordinate on the map to inspect unmonitored air estimates.
            </div>
          </section>
        )}

        {/* 3. INFERRED HOTSPOTS SECTION */}
        <section className="sidebar-section" aria-label="Inferred Hotspots">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Inferred Hotspot Cores</span>
            <span className="sidebar-section-badge">{rankedHotspots.length} Plumes</span>
          </div>

          <table className="hotspot-table">
            <thead>
              <tr>
                <th style={{ width: '24px' }}>#</th>
                <th>Plume Core</th>
                <th style={{ textAlign: 'right' }}>PM2.5</th>
                <th style={{ textAlign: 'right' }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {rankedHotspots.slice(0, 5).map((h, i) => {
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
                      {h.forecastVal} <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>µg</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`severity-badge ${cat.badge}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                        {cat.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 4. WIND & TRANSPORT SECTION */}
        <section className="sidebar-section" aria-label="Wind and Transport">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Wind & Transport</span>
            <span className="sidebar-section-badge">ECMWF / Open-Meteo</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Visual Compass Needle */}
            <div
              style={{
                width: '56px',
                height: '56px',
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
              <span style={{ position: 'absolute', top: '2px', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>N</span>
              <span style={{ position: 'absolute', bottom: '2px', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>S</span>
              <span style={{ position: 'absolute', left: '3px', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>W</span>
              <span style={{ position: 'absolute', right: '3px', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>E</span>

              <div
                style={{
                  width: '2px',
                  height: '40px',
                  background: 'transparent',
                  position: 'relative',
                  transform: `rotate(${windDirDeg}deg)`,
                  transition: 'transform 0.3s ease',
                }}
              >
                {/* Wind origin arrow */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '-3px',
                    width: 0,
                    height: 0,
                    borderLeft: '3px solid transparent',
                    borderRight: '3px solid transparent',
                    borderBottom: '8px solid #A1ACB8',
                  }}
                />
                {/* Transport vector arrow (cyan) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '-3px',
                    width: 0,
                    height: 0,
                    borderLeft: '3px solid transparent',
                    borderRight: '3px solid transparent',
                    borderTop: '8px solid #27D3E2',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {originLabel} ({windDirDeg}°) · {windSpeedKmh} km/h
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                Transport vector → {transportLabel} ({transportDeg}°)
              </div>
            </div>
          </div>

          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {getTransportInterpretation(windDirDeg, windSpeedKmh)}
          </p>
        </section>

        {/* 5. CPCB/DPCC MONITORING NETWORK */}
        <section className="sidebar-section" aria-label="Monitoring Stations">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Monitoring Network</span>
            <span className="sidebar-section-badge">12 CPCB / DPCC</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stations.slice(0, 4).map((st) => {
              const isSelected = selectedStationId === st.id || selectedHotspotId === st.id;
              const cat = getCategoryClass(st.current_obs_pm25);
              return (
                <div
                  key={st.id}
                  onClick={() => {
                    if (onSelectStation) onSelectStation(st.id);
                    onSelectHotspot(st.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '3px',
                    background: isSelected ? 'rgba(39, 211, 226, 0.08)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: st.agency === 'CPCB' ? 'rgba(39, 211, 226, 0.15)' : 'rgba(161, 172, 184, 0.12)',
                        color: st.agency === 'CPCB' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      }}
                    >
                      {st.agency}
                    </span>
                    <span style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)' }}>
                      {lang === 'hi' ? st.name_hi : st.name_en}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {st.current_obs_pm25} µg
                    </span>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. SCHOOL AIR-QUALITY OUTLOOK SECTION */}
        <section className="sidebar-section" aria-label="School Air Quality Outlook">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">School Air Outlook</span>
            <span className="sidebar-section-badge">15 Institutions</span>
          </div>

          {activeSchool ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {lang === 'hi' ? activeSchool.name_hi : activeSchool.name_en}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {activeSchool.school_type} · ~{activeSchool.student_count.toLocaleString()} students
                  </div>
                </div>
                <button
                  onClick={() => onSelectSchool && onSelectSchool('')}
                  style={{ fontSize: '10px', color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                >
                  View All
                </button>
              </div>

              {/* Provenance note */}
              <div
                style={{
                  fontSize: '10.5px',
                  padding: '5px 8px',
                  borderRadius: '3px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {activeSchool.station_distance_km <= 3.5 ? (
                  <>
                    <strong style={{ color: 'var(--text-primary)' }}>Observation anchor:</strong> Nearby {activeSchool.nearest_station_id} station ({activeSchool.station_distance_km} km)
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--text-primary)' }}>Model inference:</strong> Direct coordinate estimate ({activeSchool.lat.toFixed(3)}°N, {activeSchool.lon.toFixed(3)}°E)
                  </>
                )}
              </div>

              {/* School Activity Schedule Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {computeSchoolPeriods(activeSchool).map((period) => {
                  const verdictBadge =
                    period.verdict === 'skip'
                      ? 'badge-severe'
                      : period.verdict === 'limit'
                      ? 'badge-poor'
                      : 'badge-low';
                  const verdictLabel =
                    period.verdict === 'skip' ? 'SKIP' : period.verdict === 'limit' ? 'LIMIT' : 'GO';

                  return (
                    <div
                      key={period.period_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderBottom: '1px solid rgba(39, 49, 61, 0.4)',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lang === 'hi' ? period.name_hi : period.name_en}
                        </div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{period.time}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {period.forecast_pm25} µg
                        </span>
                        <span className={`severity-badge ${verdictBadge}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                          {verdictLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actionable School Advisory */}
              <div
                style={{
                  fontSize: '11px',
                  lineHeight: 1.35,
                  color: 'var(--text-primary)',
                  borderLeft: '2px solid var(--accent-cyan)',
                  paddingLeft: '8px',
                  marginTop: '2px',
                }}
              >
                Morning assembly and outdoor physical education should be held indoors. N95 filtering masks recommended for school bus arrival.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {schools.slice(0, 4).map((sc) => {
                const periods = computeSchoolPeriods(sc);
                const worstVerdict = periods.some((p) => p.verdict === 'skip')
                  ? 'SKIP OUTDOOR'
                  : 'LIMIT OUTDOOR';
                const badgeClass = worstVerdict.includes('SKIP') ? 'badge-severe' : 'badge-poor';

                return (
                  <div
                    key={sc.id}
                    onClick={() => onSelectSchool && onSelectSchool(sc.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '3px',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {lang === 'hi' ? sc.name_hi : sc.name_en}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                        {sc.station_distance_km} km from {sc.nearest_station_id}
                      </div>
                    </div>

                    <span className={`severity-badge ${badgeClass}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                      {worstVerdict}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                Click any school on map or list to inspect timetable
              </div>
            </div>
          )}
        </section>

        {/* 7. MODEL UNCERTAINTY & ATTRIBUTION */}
        <section className="sidebar-section" aria-label="Model Uncertainty">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Model Uncertainty</span>
            <span
              className="severity-badge"
              style={{
                background: currentDay.confidence === 'high' ? 'var(--accent-cyan-dim)' : 'rgba(161, 172, 184, 0.10)',
                color: currentDay.confidence === 'high' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: `1px solid ${currentDay.confidence === 'high' ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
              }}
            >
              {currentDay.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Uncertainty Margin:
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              ±{uncertaintySpread} µg/m³
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Stubble smoke influence: <strong>Moderate</strong>. Arrival window estimated 16:00 to 21:00 IST via NW transport corridor.
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span style={{ fontSize: '9.5px', padding: '1px 5px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)' }}>
              CAMS ECMWF
            </span>
            <span style={{ fontSize: '9.5px', padding: '1px 5px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)' }}>
              CPCB Ground Bias
            </span>
            <span style={{ fontSize: '9.5px', padding: '1px 5px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)' }}>
              VIIRS Active Fire
            </span>
          </div>
        </section>

        {/* 8. 48-HOUR FORECAST CURVE */}
        <section className="sidebar-section" aria-label="Forecast Curve">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">48-Hour Forecast Curve</span>
            <span className="sidebar-section-badge">+{hourOffset}h</span>
          </div>

          <div style={{ width: '100%', height: '110px', position: 'relative' }}>
            {series.length > 0 ? (
              <svg
                width="100%"
                height="110"
                viewBox="0 0 304 110"
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
                  <linearGradient id="bandGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#27D3E2" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#27D3E2" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {(() => {
                  const maxVal = Math.max(...series.map((s) => s.p90), 350);
                  const minVal = Math.min(...series.map((s) => s.p10), 40);
                  const range = Math.max(maxVal - minVal, 1);
                  const w = 304;
                  const h = 84;
                  const padTop = 14;

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

                  const cursorX = (Math.min(hourOffset, series.length - 1) / (series.length - 1)) * w;
                  const cursorY = padTop + h - ((currentSeriesPoint.p50 - minVal) / range) * h;

                  return (
                    <>
                      <line x1="0" y1={padTop + h} x2={w} y2={padTop + h} stroke="#27313D" strokeWidth="1" />
                      <line x1="0" y1={padTop + h / 2} x2={w} y2={padTop + h / 2} stroke="#27313D" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1={padTop} x2={w} y2={padTop} stroke="#27313D" strokeWidth="1" strokeDasharray="3 3" />

                      <text x="2" y={padTop + 8} fill="#68768A" fontSize="8.5">{Math.round(maxVal)} µg</text>
                      <text x="2" y={padTop + h - 3} fill="#68768A" fontSize="8.5">{Math.round(minVal)} µg</text>

                      <path d={bandPath} fill="url(#bandGrad2)" />
                      <path d={medianLine} fill="none" stroke="#27D3E2" strokeWidth="1.8" />

                      <line
                        x1={cursorX}
                        y1="4"
                        x2={cursorX}
                        y2={padTop + h}
                        stroke="#F3F5F7"
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                      />
                      <circle cx={cursorX} cy={cursorY} r="3.5" fill="#27D3E2" stroke="#FFFFFF" strokeWidth="1.2" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '16px' }}>Loading forecast series...</div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
            <span>Now (+0h)</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+48h</span>
          </div>
        </section>

        {/* 9. PRIORITY ADVISORIES SECTION */}
        <section className="sidebar-section" aria-label="Priority Advisories" style={{ borderBottom: 'none' }}>
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Priority Advisories</span>
            <span className="severity-badge badge-severe" style={{ fontSize: '9px' }}>ALERT</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              <strong>School Guidance:</strong> Cancel outdoor athletics and morning assembly. Keep classroom filtration active.
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong>Vulnerable Individuals:</strong> Children, seniors, and asthmatic residents should restrict outdoor exposure.
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
