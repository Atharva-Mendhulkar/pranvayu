import React from 'react';
import { ForecastPayload } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { ClientRulesConfig } from '../lib/rules';
import { Timetable } from './Timetable';
import { AirLineChart } from './AirLineChart';
import { WhyBlock } from './WhyBlock';
import { SmokeCard } from './SmokeCard';
import { GrapBanner } from './GrapBanner';
import { XIcon, ActivityIcon } from './Icons';

interface CollapsibleSideMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  payload: ForecastPayload;
  selectedDayIndex: number;
  dayVerdicts: ForecastPayload['days'][0]['verdicts'];
  onVerdictsChange: (newVerdicts: ForecastPayload['days'][0]['verdicts']) => void;
  lang: Language;
  rulesConfig: ClientRulesConfig | null;
  onNavigate: (route: string) => void;
}

export const CollapsibleSideMenu: React.FC<CollapsibleSideMenuProps> = ({
  isOpen,
  onToggle,
  payload,
  selectedDayIndex,
  dayVerdicts,
  onVerdictsChange,
  lang,
  rulesConfig,
  onNavigate,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const smokeDriver = payload.drivers.find((d) => d.type === 'regional_smoke');
  const smokeEta = smokeDriver?.eta || null;

  return (
    <>
      {/* Floating Side Drawer Panel */}
      <aside
        style={{
          position: 'fixed',
          top: '80px',
          right: '16px',
          bottom: '16px',
          width: '450px',
          maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(203, 213, 225, 0.9)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.6)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(248, 250, 252, 0.85)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActivityIcon size={18} color="#2563EB" />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                {lang === 'hi' ? 'दैनिक वायु परामर्श व समय-सारणी' : 'School Day Air Advisory'}
              </h2>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {payload.locality.name_en} · {currentDay.date}
              </span>
            </div>
          </div>

          <button
            onClick={onToggle}
            aria-label="Collapse advisory menu"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* 1. School Day Timetable */}
          <section>
            <Timetable
              verdicts={dayVerdicts}
              series={payload.series}
              dateStr={currentDay.date}
              confidence={currentDay.confidence}
              lang={lang}
              rulesConfig={rulesConfig}
              onVerdictsChange={onVerdictsChange}
            />
          </section>

          {/* 2. Regional Stubble Smoke Tracking */}
          <section>
            <SmokeCard
              smoke={payload.smoke}
              lang={lang}
              onViewDetails={() => onNavigate('method')}
            />
          </section>

          {/* 3. 48-Hour Atmospheric Forecast Chart */}
          <section>
            <AirLineChart
              series={payload.series}
              cleanWindow={currentDay.clean_window}
              smokeEta={smokeEta}
              lang={lang}
            />
          </section>

          {/* 4. Why Explanation Block */}
          <section>
            <WhyBlock drivers={payload.drivers} lang={lang} />
          </section>

          {/* 5. Official update: CAQM GRAP Stage II */}
          <section>
            <GrapBanner grap={payload.grap} lang={lang} />
          </section>
        </div>
      </aside>
    </>
  );
};
