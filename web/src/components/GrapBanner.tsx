import React from 'react';
import { GrapInfo } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { AlertCircleIcon } from './Icons';

interface GrapBannerProps {
  grap: GrapInfo;
  lang: Language;
}

export const GrapBanner: React.FC<GrapBannerProps> = ({ grap, lang }) => {
  return (
    <div
      style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      <AlertCircleIcon size={18} color="var(--cat-moderate)" style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ fontSize: '13px', lineHeight: '20px' }}>
        <div style={{ color: '#FCD34D', fontWeight: 600 }}>
          {t('officialGrapTitle', lang)}: {t('grapStage', lang)} {grap.stage}
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
            ({lang === 'hi' ? 'लागू तिथि' : 'Effective'}: {grap.effective_date})
          </span>
        </div>
        <div style={{ marginTop: '4px' }}>
          <a
            href={grap.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#FCD34D', textDecoration: 'underline', fontSize: '12px' }}
          >
            {t('readCaqmOrder', lang)} →
          </a>
        </div>
      </div>
    </div>
  );
};
