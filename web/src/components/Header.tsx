import React from 'react';
import { Language, t } from '../lib/i18n';
import { ActivityIcon } from './Icons';

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
  isSideMenuOpen?: boolean;
  onToggleSideMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLocality,
  onLocalityChange,
  selectedDayIndex,
  onDayChange,
  lang,
  onLangChange,
  localitiesList,
  currentPage,
  onPageChange,
}) => {
  return (
    <header className="app-top-nav">
      {/* Brand Section */}
      <div className="nav-left-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onPageChange('dashboard')}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(39, 211, 226, 0.12)',
              border: '1px solid rgba(39, 211, 226, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIcon size={16} color="var(--accent-cyan)" />
          </div>
          <div className="brand-title-wrap">
            <span className="brand-main-title">PranVayu</span>
            <span className="brand-sub-title">Delhi NCR Air Intelligence</span>
          </div>
        </div>

        {/* Page Switcher Tabs */}
        <div className="nav-page-tabs" role="tablist">
          <button
            className={`nav-page-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onPageChange('dashboard')}
            role="tab"
            aria-selected={currentPage === 'dashboard'}
          >
            <span>{lang === 'hi' ? 'पूर्वावलोकन' : 'Overview'}</span>
          </button>

          <button
            className={`nav-page-btn ${currentPage === 'method' ? 'active' : ''}`}
            onClick={() => onPageChange('method')}
            role="tab"
            aria-selected={currentPage === 'method'}
          >
            <span>{lang === 'hi' ? 'प्रणाली व प्रमाण' : 'How it works'}</span>
          </button>
        </div>
      </div>

      {/* Right Controls: Region, Day, Lang */}
      <div className="nav-right-controls">
        {/* Region Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            {lang === 'hi' ? 'क्षेत्र:' : 'Region:'}
          </span>
          <select
            className="select-dark"
            value={selectedLocality}
            onChange={(e) => onLocalityChange(e.target.value)}
            aria-label="Select region"
          >
            {localitiesList.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {lang === 'hi' ? loc.name_hi : loc.name_en}
              </option>
            ))}
          </select>
        </div>

        {/* Day Switcher */}
        {currentPage === 'dashboard' && (
          <div className="segmented-pills" role="tablist">
            <button
              className={`segmented-pill-btn ${selectedDayIndex === 0 ? 'active' : ''}`}
              onClick={() => onDayChange(0)}
              role="tab"
              aria-selected={selectedDayIndex === 0}
            >
              {lang === 'hi' ? 'आज' : 'Today'}
            </button>
            <button
              className={`segmented-pill-btn ${selectedDayIndex === 1 ? 'active' : ''}`}
              onClick={() => onDayChange(1)}
              role="tab"
              aria-selected={selectedDayIndex === 1}
            >
              {lang === 'hi' ? 'कल' : 'Tomorrow'}
            </button>
          </div>
        )}

        {/* Language Switcher */}
        <div className="segmented-pills">
          <button
            className={`segmented-pill-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => onLangChange('en')}
          >
            EN
          </button>
          <button
            className={`segmented-pill-btn ${lang === 'hi' ? 'active' : ''}`}
            onClick={() => onLangChange('hi')}
          >
            हिन्दी
          </button>
        </div>
      </div>
    </header>
  );
};
