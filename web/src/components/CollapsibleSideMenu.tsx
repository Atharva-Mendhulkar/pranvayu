import React from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';
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
    <aside
      style={{
        position: 'fixed',
        top: '84px',
        right: '20px',
        bottom: '24px',
        width: '460px',
        maxWidth: 'calc(100vw - 40px)',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isOpen ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ActivityIcon size={18} color="var(--accent-indigo)" />
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
              {lang === 'hi' ? 'दैनिक वायु परामर्श व समय-सारणी' : 'School Day Air Advisory'}
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-secondary)',
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
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
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
  );
};
