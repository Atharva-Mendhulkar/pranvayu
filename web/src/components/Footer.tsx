import React from 'react';
import { ForecastPayload } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { ShareIcon, RefreshIcon } from './Icons';

interface FooterProps {
  payload: ForecastPayload;
  lang: Language;
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ payload, lang, onNavigate }) => {
  const localityName = lang === 'hi' ? payload.locality.name_hi : payload.locality.name_en;

  const handleShare = () => {
    const todayForecast = payload.days[0];
    const skips = todayForecast.verdicts.filter((v) => v.verdict === 'skip');
    const gos = todayForecast.verdicts.filter((v) => v.verdict === 'go');
    const clean = todayForecast.clean_window;

    let text = `${localityName} school day air advisory:\n`;
    if (skips.length > 0) {
      text += `• Skip: ${skips.map((s) => s.period_id).join(', ')}\n`;
    }
    if (gos.length > 0) {
      text += `• Fine: ${gos.map((g) => g.period_id).join(', ')}\n`;
    }
    text += `• Cleanest window: ${clean.from} to ${clean.to}\n`;
    text += `Check full timetable at: https://pranvayu.delhi.in?loc=${payload.locality.id}`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <footer
      style={{
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Freshness Meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <RefreshIcon size={13} color="var(--accent-indigo)" />
        <span>
          {t('dataFreshness', lang)}: FIRMS ~1h • Winds ~3h • OpenAQ ~40m • ECMWF CAMS IFS
        </span>
      </div>

      {/* Actions & Links */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <button
          onClick={handleShare}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: 'var(--radius-sm)',
            color: '#818CF8',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <ShareIcon size={14} />
          <span>{t('shareWhatsApp', lang)}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
          <button
            onClick={() => onNavigate('evidence')}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {t('howWeChecked', lang)}
          </button>
          <span style={{ color: 'var(--border-glass)' }}>•</span>
          <button
            onClick={() => onNavigate('method')}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {t('methodCredits', lang)}
          </button>
        </div>
      </div>
    </footer>
  );
};
