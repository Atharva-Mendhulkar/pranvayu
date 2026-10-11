import React from 'react';
import { CleanWindow } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { ShieldCheckIcon, ClockIcon } from './Icons';

interface HeadlineProps {
  headlineText: string;
  cleanWindow: CleanWindow;
  confidence: 'high' | 'medium' | 'low';
  lang: Language;
}

export const Headline: React.FC<HeadlineProps> = ({
  headlineText,
  cleanWindow,
  confidence,
  lang,
}) => {
  const confText = t(confidence, lang);

  return (
    <section style={{ marginBottom: '20px' }}>
      <h1
        style={{
          fontSize: '26px',
          lineHeight: '34px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px',
          marginBottom: '12px',
        }}
      >
        {headlineText}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Clean Window Badge */}
        <div className="clean-window-badge">
          <ClockIcon size={14} color="#34D399" />
          <span>
            {t('cleanestTime', lang)}: <strong>{cleanWindow.from} – {cleanWindow.to}</strong> ({cleanWindow.kind === 'best' ? 'Optimal' : 'Least Bad'})
          </span>
        </div>

        {/* Confidence Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontSize: '12px',
            color: '#A5B4FC',
            fontWeight: 600,
          }}
        >
          <ShieldCheckIcon size={14} color="#818CF8" />
          <span>
            {t('howSure', lang)}: {confText}
          </span>
        </div>
      </div>
    </section>
  );
};
