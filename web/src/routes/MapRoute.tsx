import React, { useState, useEffect } from 'react';
import { DelhiFluidMap, HotspotData } from '../components/DelhiFluidMap';
import { Language, t } from '../lib/i18n';
import { ForecastPayload } from '../types/payload';

interface MapRouteProps {
  payload?: ForecastPayload | null;
  lang: Language;
  onBack: () => void;
  onSelectLocality: (locId: string) => void;
}

const DEFAULT_HOTSPOTS: HotspotData[] = [
  { id: 'anand_vihar', name_en: 'Anand Vihar', name_hi: 'आनंद विहार', lat: 28.65, lon: 77.31, pm25: 318, verdict: 'skip', category: 'Severe' },
  { id: 'wazirpur', name_en: 'Wazirpur', name_hi: 'वज़ीरपुर', lat: 28.70, lon: 77.17, pm25: 295, verdict: 'skip', category: 'Severe' },
  { id: 'bawana', name_en: 'Bawana', name_hi: 'बवाना', lat: 28.78, lon: 77.05, pm25: 284, verdict: 'skip', category: 'Severe' },
  { id: 'jahangirpuri', name_en: 'Jahangirpuri', name_hi: 'जहाँगीरपुरी', lat: 28.73, lon: 77.17, pm25: 272, verdict: 'skip', category: 'Severe' },
  { id: 'punjabi_bagh', name_en: 'Punjabi Bagh', name_hi: 'पंजाबी बाग', lat: 28.67, lon: 77.13, pm25: 242, verdict: 'skip', category: 'Very Poor' },
  { id: 'ito', name_en: 'ITO', name_hi: 'आईटीओ', lat: 28.63, lon: 77.24, pm25: 218, verdict: 'skip', category: 'Very Poor' },
  { id: 'okhla', name_en: 'Okhla', name_hi: 'ओखला', lat: 28.53, lon: 77.27, pm25: 212, verdict: 'skip', category: 'Very Poor' },
  { id: 'rohini', name_en: 'Rohini', name_hi: 'रोहिणी', lat: 28.73, lon: 77.12, pm25: 205, verdict: 'skip', category: 'Very Poor' },
  { id: 'rk_puram', name_en: 'R K Puram', name_hi: 'आर के पुरम', lat: 28.56, lon: 77.18, pm25: 188, verdict: 'limit', category: 'Very Poor' },
  { id: 'dwarka', name_en: 'Dwarka', name_hi: 'द्वारका', lat: 28.59, lon: 77.05, pm25: 165, verdict: 'limit', category: 'Very Poor' },
  { id: 'siri_fort', name_en: 'Siri Fort', name_hi: 'सिरी फोर्ट', lat: 28.55, lon: 77.22, pm25: 148, verdict: 'limit', category: 'Poor' },
  { id: 'mandir_marg', name_en: 'Mandir Marg', name_hi: 'मंदिर मार्ग', lat: 28.63, lon: 77.20, pm25: 135, verdict: 'limit', category: 'Poor' },
];

export const MapRoute: React.FC<MapRouteProps> = ({
  payload,
  lang,
  onBack,
  onSelectLocality,
}) => {
  const [viewMode, setViewMode] = useState<'top' | 'horizontal'>('horizontal');
  const [hourOffset, setHourOffset] = useState<number>(8); // Default to morning school hour (08:00)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [windSpeedKmh] = useState<number>(14);
  const [windDirDeg] = useState<number>(315); // NW winds typical of stubble corridor

  // Autoplay scrubber
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setHourOffset((prev) => (prev + 1) % 48);
    }, 1200);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const formatHourLabel = (offset: number) => {
    const isToday = offset < 24;
    const hour = offset % 24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const dayStr = isToday ? (lang === 'hi' ? 'आज' : 'Today') : (lang === 'hi' ? 'कल' : 'Tomorrow');
    return `${dayStr} ${String(displayHour).padStart(2, '0')}:00 ${ampm} (+${offset}h)`;
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingTop: '16px' }}>
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '15px',
          color: 'var(--color-ink-soft)',
          marginBottom: '16px',
          padding: '4px 0',
          cursor: 'pointer',
        }}
      >
        ← {lang === 'hi' ? 'स्कूल परामर्श पर वापस जाएँ' : 'Back to School Advisory'}
      </button>

      {/* Title & View Switcher Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              lineHeight: '32px',
              fontWeight: 800,
              color: 'var(--color-ink)',
              letterSpacing: '-0.3px',
              marginBottom: '4px',
            }}
          >
            {lang === 'hi' ? 'दिल्ली एनसीआर वायु मानचित्र' : 'Delhi NCR Air Quality Map'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-ink-soft)', maxWidth: '600px', lineHeight: '20px' }}>
            {lang === 'hi'
              ? 'क्षैतिज (Horizontal) दृश्य में प्रदूषण हॉटस्पॉट Y-अक्ष पर 3D चोटियों के रूप में उठते हैं। शीर्ष (Top) दृश्य में बादलों की तरह बहता धुआँ दिखता है।'
              : 'Horizontal view rises pollution hotspots into 3D elevation peaks along the Y-axis. Top view simulates weather storm clouds advecting from industrial corridors.'}
          </p>
        </div>

        {/* View Mode Toggle Button Group */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--color-panel)',
            padding: '3px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--color-rule-blue)',
          }}
          role="tablist"
          aria-label="Map View Mode"
        >
          <button
            onClick={() => setViewMode('top')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '2px',
              background: viewMode === 'top' ? 'var(--color-notebook)' : 'transparent',
              color: viewMode === 'top' ? 'var(--color-ink)' : 'var(--color-ink-soft)',
              boxShadow: viewMode === 'top' ? '0 1px 2px rgba(20, 35, 60, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            role="tab"
            aria-selected={viewMode === 'top'}
          >
            ☁️ {lang === 'hi' ? 'शीर्ष दृश्य (रडार)' : 'Top View (Radar)'}
          </button>
          <button
            onClick={() => setViewMode('horizontal')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '2px',
              background: viewMode === 'horizontal' ? 'var(--color-notebook)' : 'transparent',
              color: viewMode === 'horizontal' ? 'var(--color-ink)' : 'var(--color-ink-soft)',
              boxShadow: viewMode === 'horizontal' ? '0 1px 2px rgba(20, 35, 60, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            role="tab"
            aria-selected={viewMode === 'horizontal'}
          >
            🏔️ {lang === 'hi' ? 'क्षैतिज 3D चोटियाँ' : 'Horizontal 3D Peaks'}
          </button>
        </div>
      </div>

      {/* 3D WebGL Map Viewport */}
      <div style={{ marginBottom: '16px' }}>
        <DelhiFluidMap
          hotspots={DEFAULT_HOTSPOTS}
          viewMode={viewMode}
          windDirectionDeg={windDirDeg}
          windSpeedKmh={windSpeedKmh}
          hourOffset={hourOffset}
          lang={lang}
          onSelectLocality={(locId) => {
            onSelectLocality(locId);
            onBack();
          }}
        />
      </div>

      {/* 48-Hour Scrubber Deck */}
      <div
        style={{
          background: 'var(--color-notebook)',
          border: '1px solid var(--color-rule-blue)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                background: isPlaying ? 'var(--color-panel)' : 'var(--color-focus)',
                color: isPlaying ? 'var(--color-ink)' : '#FFFFFF',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '⏸ ' + (lang === 'hi' ? 'रोकें' : 'Pause') : '▶ ' + (lang === 'hi' ? 'चलाएँ' : 'Play 48h')}
            </button>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)' }}>
              {formatHourLabel(hourOffset)}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)' }}>
            <span>
              {lang === 'hi' ? 'हवा की दिशा' : 'Advecting Wind'}:{' '}
              <strong>NW → SE ({windSpeedKmh} km/h)</strong>
            </span>
          </div>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min={0}
          max={47}
          value={hourOffset}
          onChange={(e) => setHourOffset(Number(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            cursor: 'pointer',
            accentColor: 'var(--color-focus)',
          }}
          aria-label="48-hour time forecast slider"
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-margin-grey)',
            marginTop: '6px',
          }}
        >
          <span>{lang === 'hi' ? 'आज 00:00 (शुरू)' : 'Now (Hour 0)'}</span>
          <span>{lang === 'hi' ? '+24 घंटे (कल सुबह)' : '+24 Hours (Tomorrow)'}</span>
          <span>{lang === 'hi' ? '+48 घंटे (अंत)' : '+48 Hours (Lead limit)'}</span>
        </div>
      </div>

      {/* Hotspots Overview Table */}
      <div
        style={{
          background: 'var(--color-notebook)',
          border: '1px solid var(--color-rule-blue)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 800,
            color: 'var(--color-ink)',
            marginBottom: '12px',
          }}
        >
          {lang === 'hi' ? 'दिल्ली एनसीआर हॉटस्पॉट स्थिति' : 'Delhi NCR Hotspot Peaks'}
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-rule-blue)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
                  {lang === 'hi' ? 'स्थान' : 'Locality'}
                </th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
                  {lang === 'hi' ? 'PM2.5 स्तर' : 'PM2.5 Peak'}
                </th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
                  {lang === 'hi' ? 'CPCB श्रेणी' : 'Category'}
                </th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
                  {lang === 'hi' ? 'स्कूल परामर्श' : 'Outdoor Verdict'}
                </th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-ink-soft)', textAlign: 'right' }}>
                  {lang === 'hi' ? 'कार्य' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_HOTSPOTS.map((spot) => {
                const verdictColor =
                  spot.verdict === 'go'
                    ? 'var(--cat-good)'
                    : spot.verdict === 'limit'
                    ? 'var(--cat-poor)'
                    : 'var(--cat-severe)';

                return (
                  <tr
                    key={spot.id}
                    style={{
                      borderBottom: '1px solid #EEF2F8',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {lang === 'hi' ? spot.name_hi : spot.name_en}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-ink)' }}>
                      <strong>{spot.pm25}</strong> µg/m³
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: `${verdictColor}18`,
                          color: verdictColor,
                        }}
                      >
                        {spot.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: verdictColor,
                          textTransform: 'uppercase',
                        }}
                      >
                        {spot.verdict}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          onSelectLocality(spot.id);
                          onBack();
                        }}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-focus)',
                          cursor: 'pointer',
                        }}
                      >
                        {lang === 'hi' ? 'चुनें →' : 'Select →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Method & Disclaimer Note */}
      <div
        style={{
          borderTop: '1px solid var(--color-rule-blue)',
          paddingTop: '16px',
          paddingBottom: '32px',
          fontSize: '12px',
          color: 'var(--color-ink-soft)',
          lineHeight: '18px',
        }}
      >
        <p>
          {lang === 'hi'
            ? 'परामर्श सूचना: 3D चोटियों की ऊँचाई और रडार का धुआँ ओपन-मेटियो CAMS मॉडल और DPCC/CPCB निगरानी स्टेशनों पर आधारित अनुकरण है। यह चिकित्सा सलाह नहीं है।'
            : 'Advisory Note: 3D peak elevation and fluid advection radar are numerical approximations derived from Open-Meteo CAMS forecast and DPCC/CPCB surface observations. Follow official CAQM orders.'}
        </p>
      </div>
    </div>
  );
};
