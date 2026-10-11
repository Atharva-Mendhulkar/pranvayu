import React from 'react';
import { Language, t } from '../lib/i18n';
import { MapIcon, LayersIcon, ActivityIcon, MenuIcon, OpenFreeMapLogo } from './Icons';

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
  onOpenOpenFreeMapModal?: () => void;
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
  isSideMenuOpen,
  onToggleSideMenu,
  onOpenOpenFreeMapModal,
}) => {
  const getDayLabel = (dateStr: string, idx: number) => {
    if (idx === 0) return t('today', lang);
    if (idx === 1) return t('tomorrow', lang);
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <header className="header-glass-pill">
      {/* Brand Section */}
      <div className="brand-section">
        <div className="brand-logo">
          <ActivityIcon size={22} color="#2563EB" />
          <span>PranVayu</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>
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
          <MapIcon size={14} />
          <span>{lang === 'hi' ? 'वायु डैशबोर्ड' : 'Advisory Dashboard'}</span>
        </button>

        <button
          className={`nav-page-btn ${currentPage === 'method' ? 'active' : ''}`}
          onClick={() => onPageChange('method')}
        >
          <LayersIcon size={14} />
          <span>{lang === 'hi' ? 'प्रणाली व प्रमाण' : 'How We Estimate'}</span>
        </button>
      </div>

      {/* Controls: Locality, Day, Lang, OpenFreeMap, Menu */}
      <div className="header-controls">
        {/* Locality Selector */}
        <select
          className="glass-select"
          value={selectedLocality}
          onChange={(e) => onLocalityChange(e.target.value)}
          aria-label="Select locality"
        >
          {localitiesList.map((loc) => (
            <option key={loc.id} value={loc.id} style={{ background: '#FFFFFF', color: '#0F172A' }}>
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

        {/* OpenFreeMap Logo & Info Button */}
        {onOpenOpenFreeMapModal && (
          <button
            onClick={onOpenOpenFreeMapModal}
            title="OpenFreeMap Info & Styles"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9999px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#1E293B',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <OpenFreeMapLogo size={16} />
            <span>OpenFreeMap</span>
          </button>
        )}

        {/* Collapsible Advisory Side Menu Toggle Button */}
        {currentPage === 'dashboard' && onToggleSideMenu && (
          <button
            onClick={onToggleSideMenu}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: isSideMenuOpen ? '#2563EB' : '#0F172A',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.15s ease',
            }}
          >
            <MenuIcon size={14} color="#FFFFFF" />
            <span>{lang === 'hi' ? 'परामर्श मेनू' : 'School Timetable & Forecast'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
