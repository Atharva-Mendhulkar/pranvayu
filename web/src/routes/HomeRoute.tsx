import React, { useState } from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';
import { Headline } from '../components/Headline';
import { Timetable } from '../components/Timetable';
import { AirLineChart } from '../components/AirLineChart';
import { WhyBlock } from '../components/WhyBlock';
import { SmokeCard } from '../components/SmokeCard';
import { GrapBanner } from '../components/GrapBanner';
import { Footer } from '../components/Footer';
import { DelhiFluidMap, HotspotData } from '../components/DelhiFluidMap';
import { generateDeterministicHeadline, ClientRulesConfig } from '../lib/rules';
import { PlayIcon, PauseIcon, WindIcon, CompassIcon, LayersIcon, ActivityIcon } from '../components/Icons';

interface HomeRouteProps {
  payload: ForecastPayload;
  selectedDayIndex: number;
  lang: Language;
  rulesConfig: ClientRulesConfig | null;
  onNavigate: (route: string) => void;
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

export const HomeRoute: React.FC<HomeRouteProps> = ({
  payload,
  selectedDayIndex,
  lang,
  rulesConfig,
  onNavigate,
  onSelectLocality,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const [dayVerdicts, setDayVerdicts] = useState(currentDay.verdicts);

  // Map state
  const [mapViewMode, setMapViewMode] = useState<'top' | 'horizontal'>('horizontal');
  const [hourOffset, setHourOffset] = useState<number>(8); // Morning PE hour (08:00)
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

  const smokeDriver = payload.drivers.find((d) => d.type === 'regional_smoke');
  const smokeEta = smokeDriver?.eta || null;

  const formatHourLabel = (offset: number) => {
    const isToday = offset < 24;
    const hour = offset % 24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const dayStr = isToday ? (lang === 'hi' ? 'आज' : 'Today') : (lang === 'hi' ? 'कल' : 'Tomorrow');
    return `${dayStr} ${String(displayHour).padStart(2, '0')}:00 ${ampm} (+${offset}h)`;
  };

  return (
    <main>
      {/* 1. Hero Atmospheric Headline & Clean Window */}
      <Headline
        headlineText={headlineText}
        cleanWindow={currentDay.clean_window}
        confidence={currentDay.confidence}
        lang={lang}
      />

      {/* 2. Integrated 3D Delhi NCR Map & Fluid Simulation Hero Card */}
      <section
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          boxShadow: 'var(--shadow-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              {lang === 'hi' ? 'दिल्ली एनसीआर 3D वायु व धुआँ मानचित्र' : 'Delhi NCR Atmospheric Dynamics Map'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {lang === 'hi'
                ? 'हॉटस्पॉट चोटियाँ और हवा के साथ बहते धुएँ के बादलों का 3D अनुकरण'
                : '3D elevation peaks showing hotspot intensity with real-time pollution cloud advection'}
            </p>
          </div>

          {/* Physics Simulation Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(34, 211, 238, 0.1)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(34, 211, 238, 0.25)',
              }}
            >
              <ActivityIcon size={12} color="var(--accent-cyan)" />
              {lang === 'hi' ? 'सक्रिय 3D भौतिकी अनुकरण' : 'Physics Simulation Active'}
            </span>
          </div>
        </div>

        {/* 3D WebGL Canvas */}
        <DelhiFluidMap
          hotspots={DEFAULT_HOTSPOTS}
          viewMode={mapViewMode}
          windDirectionDeg={windDirDeg}
          windSpeedKmh={windSpeedKmh}
          hourOffset={hourOffset}
          lang={lang}
          onSelectLocality={onSelectLocality}
          onToggleViewMode={setMapViewMode}
        />

        {/* 48-Hour Interactive Scrubber */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
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
                  fontSize: '12px',
                  fontWeight: 600,
                  background: isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-indigo)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
                <span>{isPlaying ? (lang === 'hi' ? 'रोकें' : 'Pause') : (lang === 'hi' ? 'चलाएँ' : 'Play 48h')}</span>
              </button>

              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatHourLabel(hourOffset)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <WindIcon size={13} color="var(--accent-cyan)" />
              <span>NW → SE (14 km/h stubble corridor)</span>
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
            <span>Tomorrow Morning (+24h)</span>
            <span>Forecast Horizon (+48h)</span>
          </div>
        </div>
      </section>

      {/* 3. Integrated 2-Column Responsive Dashboard */}
      <div className="dashboard-grid-2col">
        {/* Left Column: School Timetable & Stubble Smoke Tracker */}
        <div>
          <Timetable
            verdicts={dayVerdicts}
            series={payload.series}
            dateStr={currentDay.date}
            confidence={currentDay.confidence}
            lang={lang}
            rulesConfig={rulesConfig}
            onVerdictsChange={setDayVerdicts}
          />

          <SmokeCard
            smoke={payload.smoke}
            lang={lang}
            onViewDetails={() => onNavigate('method')}
          />
        </div>

        {/* Right Column: 48h Air Line Chart + Drivers + GRAP Banner */}
        <div>
          <AirLineChart
            series={payload.series}
            cleanWindow={currentDay.clean_window}
            smokeEta={smokeEta}
            lang={lang}
          />

          <WhyBlock drivers={payload.drivers} lang={lang} />

          <GrapBanner grap={payload.grap} lang={lang} />
        </div>
      </div>

      <Footer payload={payload} lang={lang} onNavigate={onNavigate} />
    </main>
  );
};
