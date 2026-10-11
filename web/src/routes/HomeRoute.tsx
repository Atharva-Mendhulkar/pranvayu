import React, { useState } from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';
import { DelhiFluidMap, HotspotData } from '../components/DelhiFluidMap';
import { CollapsibleSideMenu } from '../components/CollapsibleSideMenu';
import { generateDeterministicHeadline, ClientRulesConfig } from '../lib/rules';
import { PlayIcon, PauseIcon, WindIcon, ActivityIcon, ClockIcon } from '../components/Icons';

interface HomeRouteProps {
  payload: ForecastPayload;
  selectedDayIndex: number;
  lang: Language;
  rulesConfig: ClientRulesConfig | null;
  onNavigate: (route: string) => void;
  onSelectLocality: (locId: string) => void;
  isSideMenuOpen: boolean;
  onToggleSideMenu: () => void;
  onOpenInfoModal: () => void;
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

export const HomeRoute: React.FC<HomeRouteProps> = ({
  payload,
  selectedDayIndex,
  lang,
  rulesConfig,
  onNavigate,
  onSelectLocality,
  isSideMenuOpen,
  onToggleSideMenu,
  onOpenInfoModal,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const [dayVerdicts, setDayVerdicts] = useState(currentDay.verdicts);

  // Map state
  const [mapViewMode, setMapViewMode] = useState<'top' | 'horizontal'>('top');
  const [hourOffset, setHourOffset] = useState<number>(8); // Morning school period
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [windSpeedKmh] = useState<number>(14);
  const [windDirDeg] = useState<number>(315);

  React.useEffect(() => {
    setDayVerdicts(currentDay.verdicts);
  }, [currentDay]);

  // Autoplay scrubber
  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setHourOffset((prev) => (prev + 1) % 48);
    }, 1200);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const headlineText = generateDeterministicHeadline(dayVerdicts, currentDay.clean_window, lang);

  const formatHourLabel = (offset: number) => {
    const isToday = offset < 24;
    const hour = offset % 24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const dayStr = isToday ? (lang === 'hi' ? 'आज' : 'Today') : (lang === 'hi' ? 'कल' : 'Tomorrow');
    return `${dayStr} ${String(displayHour).padStart(2, '0')}:00 ${ampm} (+${offset}h)`;
  };

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. Full-Screen Delhi NCR Atmospheric Dynamics Map */}
      <DelhiFluidMap
        hotspots={DEFAULT_HOTSPOTS}
        viewMode={mapViewMode}
        windDirectionDeg={windDirDeg}
        windSpeedKmh={windSpeedKmh}
        hourOffset={hourOffset}
        lang={lang}
        onSelectLocality={onSelectLocality}
        onToggleViewMode={setMapViewMode}
        isFullScreen={true}
        onOpenInfoModal={onOpenInfoModal}
        isSideMenuOpen={isSideMenuOpen}
      />

      {/* 2. Floating Atmospheric Clean Window & Headline Card (Bottom Left) */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 35,
          width: '360px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-glass)',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ActivityIcon size={16} color="var(--accent-indigo)" />
          <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#818CF8', letterSpacing: '0.5px' }}>
            {payload.locality.name_en} · {currentDay.date}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              background: currentDay.confidence === 'high' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: currentDay.confidence === 'high' ? '#34D399' : '#FBBF24',
              border: `1px solid ${currentDay.confidence === 'high' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
            }}
          >
            {currentDay.confidence} confidence
          </span>
        </div>

        <h1 style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35, marginBottom: '10px' }}>
          {headlineText}
        </h1>

        {/* Cleanest Window of the day */}
        {currentDay.clean_window && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34D399',
              fontSize: '12.5px',
              fontWeight: 700,
            }}
          >
            <ClockIcon size={14} color="#34D399" />
            <span>
              {lang === 'hi' ? 'सबसे स्वच्छ अवधि:' : 'Cleanest Window:'}{' '}
              {currentDay.clean_window.from} – {currentDay.clean_window.to}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600 }}>
              {currentDay.clean_window.kind === 'best' ? 'Optimal' : 'Least Bad'}
            </span>
          </div>
        )}
      </div>

      {/* 3. Floating 48-Hour Forecast Scrubber Bar (Bottom Center) */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: isSideMenuOpen ? 'clamp(395px, 48%, calc(100vw - 720px))' : '50%',
          transform: isSideMenuOpen ? 'none' : 'translateX(-50%)',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 35,
          width: '460px',
          maxWidth: 'calc(100vw - 420px)',
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '12px 18px',
          boxShadow: 'var(--shadow-glass)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                background: isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-indigo)',
                color: '#FFFFFF',
                borderRadius: '8px',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.14)',
              }}
            >
              {isPlaying ? <PauseIcon size={12} color="#FFFFFF" /> : <PlayIcon size={12} color="#FFFFFF" />}
              <span>{isPlaying ? (lang === 'hi' ? 'रोकें' : 'Pause') : (lang === 'hi' ? 'चलाएँ' : 'Play 48h')}</span>
            </button>

            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF' }}>
              {formatHourLabel(hourOffset)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <WindIcon size={13} color="var(--accent-cyan)" />
            <span>14 km/h NW → SE stubble corridor</span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={47}
          value={hourOffset}
          onChange={(e) => setHourOffset(Number(e.target.value))}
          style={{
            width: '100%',
            height: '5px',
            cursor: 'pointer',
            accentColor: 'var(--accent-indigo)',
          }}
          aria-label="Forecast hour scrubber"
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '4px',
          }}
        >
          <span>Now (+0h)</span>
          <span>Tomorrow (+24h)</span>
          <span>+48h</span>
        </div>
      </div>

      {/* 4. Collapsible Side Menu on the Side */}
      <CollapsibleSideMenu
        isOpen={isSideMenuOpen}
        onToggle={onToggleSideMenu}
        payload={payload}
        selectedDayIndex={selectedDayIndex}
        dayVerdicts={dayVerdicts}
        onVerdictsChange={setDayVerdicts}
        lang={lang}
        rulesConfig={rulesConfig}
        onNavigate={onNavigate}
      />
    </main>
  );
};
