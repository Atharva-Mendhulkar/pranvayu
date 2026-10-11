import React from 'react';
import { SmokeInfo } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { FlameIcon, ChevronRightIcon } from './Icons';

interface SmokeCardProps {
  smoke: SmokeInfo;
  lang: Language;
  onViewDetails?: () => void;
}

export const SmokeCard: React.FC<SmokeCardProps> = ({ smoke, lang, onViewDetails }) => {
  const fireCount = smoke.fires.length;
  const hasSmoke = smoke.present_now || smoke.level_series.some((s) => s.level !== 'low');

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlameIcon size={18} color="var(--cat-poor)" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {lang === 'hi' ? 'पराली का धुआँ व उपग्रह ट्रैकिंग' : 'Regional Stubble Smoke Tracking'}
          </h3>
        </div>

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
            }}
          >
            <span>{lang === 'hi' ? 'विश्लेषण' : 'Ensemble Trajectories'}</span>
            <ChevronRightIcon size={14} />
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '20px' }}>
          {hasSmoke ? (
            lang === 'hi' ? (
              <>
                नासा VIIRS उपग्रह द्वारा पंजाब व हरियाणा में <strong>{fireCount} सक्रिय पराली की आग</strong> दर्ज की गई हैं।
                24-सदस्यीय बैकवर्ड प्रक्षेपवक्र मॉडल दिल्ली में संभावित आगमन दर्शाता है।
              </>
            ) : (
              <>
                NASA VIIRS satellites detect <strong>{fireCount} active fire clusters</strong> in Punjab & Haryana.
                24-member backward trajectory ensemble indicates an arrival window over Delhi today.
              </>
            )
          ) : (
            t('noSmokeSignal', lang)
          )}
        </div>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '16px' }}>
        {t('smokeCardDisclaimer', lang)}
      </p>
    </div>
  );
};
