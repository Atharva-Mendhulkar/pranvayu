import React from 'react';
import { Language, t } from '../lib/i18n';
import { MapIcon, LayersIcon, CalendarIcon, ActivityIcon } from './Icons';

interface HeaderProps {
  selectedLocality: string;
  onLocalityChange: (loc: string) => void;
  selectedDayIndex: number;
  onDayChange: (idx: number) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  localitiesList: Array<{ id: string; name_en: string; name_hi: string }>;
  dayDates: string[];
  currentPage: 'dashboard' | 'method';
  onPageChange: (page: 'dashboard' | 'method') => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLocality,
  onLocalityChange,
  selectedDayIndex,
  onDayChange,
  lang,
  onLangChange,
  localitiesList,
  dayDates,
  currentPage,
  onPageChange,
}) => {
  const getDayLabel = (dateStr: string, idx: number) => {
    if (idx === 0) return t('today', lang);
    if (idx === 1) return t('tomorrow', lang);
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <header className="header-glass">
      {/* Brand Section */}
      <div className="brand-section">
        <div className="brand-logo">
          <ActivityIcon size={22} color="var(--accent-indigo)" />
          <span>PranVayu</span>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>
            (प्राणवायु)
          </span>
        </div>
        <div className="brand-badge">
          Delhi NCR Air Intelligence
        </div>
      </div>

      {/* Main Page Switcher (Dashboard vs How We Estimate) */}
      <div className="nav-page-tabs">
        <button
          className={`nav-page-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onPageChange('dashboard')}
        >
          <MapIcon size={15} />
          <span>{lang === 'hi' ? 'वायु डैशबोर्ड व मानचित्र' : 'Advisory Dashboard'}</span>
        </button>

        <button
          className={`nav-page-btn ${currentPage === 'method' ? 'active' : ''}`}
          onClick={() => onPageChange('method')}
        >
          <LayersIcon size={15} />
          <span>{lang === 'hi' ? 'प्रणाली व प्रमाण' : 'How We Estimate'}</span>
        </button>
      </div>

      {/* Controls & Locality Selector */}
      <div className="header-controls">
        {/* Locality Selector */}
        <select
          className="glass-select"
          value={selectedLocality}
          onChange={(e) => onLocalityChange(e.target.value)}
          aria-label="Select locality"
        >
          {localitiesList.map((loc) => (
            <option key={loc.id} value={loc.id} style={{ background: '#0F172A', color: '#F8FAFC' }}>
              {lang === 'hi' ? loc.name_hi : loc.name_en}
            </option>
          ))}
        </select>

        {/* Day Switcher */}
        {currentPage === 'dashboard' && (
          <div className="glass-pills" role="tablist">
            {dayDates.slice(0, 2).map((dateStr, idx) => (
              <button
                key={dateStr}
                className={`glass-pill-btn ${selectedDayIndex === idx ? 'active' : ''}`}
                onClick={() => onDayChange(idx)}
                role="tab"
                aria-selected={selectedDayIndex === idx}
              >
                {getDayLabel(dateStr, idx)}
              </button>
            ))}
          </div>
        )}

        {/* Language Switcher */}
        <div className="glass-pills">
          <button
            className={`glass-pill-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => onLangChange('en')}
          >
            EN
          </button>
          <button
            className={`glass-pill-btn ${lang === 'hi' ? 'active' : ''}`}
            onClick={() => onLangChange('hi')}
          >
            हिन्दी
          </button>
        </div>
      </div>
    </header>
  );
};
