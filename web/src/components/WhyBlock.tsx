import React, { useState } from 'react';
import { DriverItem } from '../types/payload';
import { Language, t } from '../lib/i18n';
import { InfoIcon, ChevronRightIcon } from './Icons';

interface WhyBlockProps {
  drivers: DriverItem[];
  lang: Language;
}

export const WhyBlock: React.FC<WhyBlockProps> = ({ drivers, lang }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!drivers || drivers.length === 0) {
    return null;
  }

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <InfoIcon size={18} color="var(--accent-indigo)" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('whyTitle', lang)}
          </h2>
        </div>
        <button
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: 'var(--text-muted)',
            display: 'flex',
          }}
          aria-label="Toggle section"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {drivers.map((d, i) => {
            let sentence = '';
            if (d.type === 'regional_smoke') {
              if (lang === 'hi') {
                sentence = 'पंजाब और हरियाणा की पराली का धुआँ दोपहर से शाम के बीच दिल्ली पहुँचने की संभावना है।';
              } else {
                sentence = `Smoke from agricultural fires in the northwest may arrive between 2:00 pm and 8:30 pm (${d.confidence} confidence).`;
              }
            } else if (d.type === 'local_trapping') {
              if (lang === 'hi') {
                sentence = 'सुबह की शांत हवा और ठंडी परत स्थानीय गाड़ियों और निर्माण के धुएँ को रोक रही है।';
              } else {
                sentence = 'Calm morning winds and shallow boundary layer trap local city emissions.';
              }
            } else if (d.type === 'dust') {
              if (lang === 'hi') {
                sentence = 'क्षेत्रीय शुष्क हवाओं के कारण हवा में धूल और मोटे कण बढ़े हुए हैं।';
              } else {
                sentence = 'Elevated coarse particles indicate regional dust transport.';
              }
            }

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '20px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-indigo)',
                    marginTop: '7px',
                    flexShrink: 0,
                  }}
                />
                <span>{sentence}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
