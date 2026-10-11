import React, { useState, useEffect } from 'react';
import { ForecastPayload } from './types/payload';
import { Language, t } from './lib/i18n';
import { ClientRulesConfig } from './lib/rules';
import { Header } from './components/Header';
import { HomeRoute } from './routes/HomeRoute';
import { MethodRoute } from './routes/MethodRoute';
import { LeafletModal } from './components/LeafletModal';
import { AlertCircleIcon, InfoIcon, RefreshIcon } from './components/Icons';

const LOCALITIES_LIST = [
  { id: 'dwarka', name_en: 'Dwarka', name_hi: 'द्वारका' },
  { id: 'rohini', name_en: 'Rohini', name_hi: 'रोहिणी' },
  { id: 'anand_vihar', name_en: 'Anand Vihar', name_hi: 'आनंद विहार' },
  { id: 'ito', name_en: 'ITO', name_hi: 'आईटीओ' },
  { id: 'rk_puram', name_en: 'R K Puram', name_hi: 'आर के पुरम' },
  { id: 'punjabi_bagh', name_en: 'Punjabi Bagh', name_hi: 'पंजाबी बाग' },
  { id: 'mandir_marg', name_en: 'Mandir Marg', name_hi: 'मंदिर मार्ग' },
  { id: 'jahangirpuri', name_en: 'Jahangirpuri', name_hi: 'जहाँगीरपुरी' },
  { id: 'bawana', name_en: 'Bawana', name_hi: 'बवाना' },
  { id: 'okhla', name_en: 'Okhla', name_hi: 'ओखला' },
  { id: 'wazirpur', name_en: 'Wazirpur', name_hi: 'वज़ीरपुर' },
  { id: 'siri_fort', name_en: 'Siri Fort', name_hi: 'सिरी फोर्ट' },
];

export const App: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const debugState = searchParams.get('state');
  const initialLoc = searchParams.get('loc') || localStorage.getItem('pv_locality') || 'dwarka';

  const [selectedLocality, setSelectedLocality] = useState<string>(initialLoc);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('pv_lang') as Language) || 'en';
  });
  const initialPage = searchParams.get('page') === 'method' ? 'method' : 'dashboard';
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'method'>(initialPage);

  const [isSideMenuOpen, setIsSideMenuOpen] = useState<boolean>(true);
  const [isLeafletModalOpen, setIsLeafletModalOpen] = useState<boolean>(false);

  const [payload, setPayload] = useState<ForecastPayload | null>(null);
  const [rulesConfig, setRulesConfig] = useState<ClientRulesConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load rules.json
  useEffect(() => {
    fetch('/rules.json')
      .then((res) => res.json())
      .then((data) => setRulesConfig(data))
      .catch((err) => console.error('Error loading rules.json:', err));
  }, []);

  // Load payload for locality
  useEffect(() => {
    if (debugState === 'loading') {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    fetch(`/mock/${selectedLocality}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ForecastPayload) => {
        if (debugState === 'nosmoke' || debugState === 'offseason') {
          data.smoke.present_now = false;
          data.smoke.fires = [];
          data.drivers = data.drivers.filter((d) => d.type !== 'regional_smoke');
        }
        if (debugState === 'low') {
          data.days.forEach((d) => {
            d.confidence = 'low';
          });
        }
        setPayload(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load forecast payload:', err);
        fetch('/mock/dwarka.json')
          .then((r) => r.json())
          .then((d) => {
            setPayload(d);
            setIsLoading(false);
          });
      });
  }, [selectedLocality, debugState]);

  const handleLocalityChange = (loc: string) => {
    setSelectedLocality(loc);
    localStorage.setItem('pv_locality', loc);
  };

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('pv_lang', newLang);
  };

  if (isLoading || !payload) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading atmospheric air intelligence...</div>
      </div>
    );
  }

  const dayDates = payload.days.map((d) => d.date);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', background: 'var(--bg-root)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* State Debug / Notice Banners */}
      {debugState === 'stale' && (
        <div className="state-banner">
          <AlertCircleIcon size={16} color="currentColor" />
          <span>{t('staleObsBanner', lang)}</span>
        </div>
      )}
      {debugState === 'partial' && (
        <div className="state-banner">
          <AlertCircleIcon size={16} color="currentColor" />
          <span>{t('staleWindsBanner', lang)}</span>
        </div>
      )}
      {debugState === 'down' && (
        <div className="state-banner">
          <InfoIcon size={16} color="currentColor" />
          <span>{t('apiDownBanner', lang)}</span>
        </div>
      )}
      {debugState === 'replay' && (
        <div className="replay-banner">
          <RefreshIcon size={16} color="currentColor" />
          <span>{t('replayBanner', lang)}</span>
        </div>
      )}

      {/* 64px Perplexity Top Navigation */}
      <Header
        selectedLocality={selectedLocality}
        onLocalityChange={handleLocalityChange}
        selectedDayIndex={selectedDayIndex}
        onDayChange={setSelectedDayIndex}
        lang={lang}
        onLangChange={handleLangChange}
        localitiesList={LOCALITIES_LIST}
        dayDates={dayDates}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isSideMenuOpen={isSideMenuOpen}
        onToggleSideMenu={() => setIsSideMenuOpen(!isSideMenuOpen)}
      />

      {/* Main Workspace: 74% Real Map + 380px Intelligence Sidebar */}
      {currentPage === 'dashboard' && (
        <HomeRoute
          payload={payload}
          selectedDayIndex={selectedDayIndex}
          lang={lang}
          rulesConfig={rulesConfig}
          onNavigate={(route) => {
            if (route === 'method' || route === 'evidence' || route === 'smoke') {
              setCurrentPage('method');
            }
          }}
          onSelectLocality={handleLocalityChange}
          isSideMenuOpen={isSideMenuOpen}
          onToggleSideMenu={() => setIsSideMenuOpen(!isSideMenuOpen)}
          onOpenInfoModal={() => setIsLeafletModalOpen(true)}
        />
      )}

      {/* Page 2: How We Estimate (How It Works) */}
      {currentPage === 'method' && (
        <div style={{ flex: 1, width: '100vw', height: 'calc(100vh - 64px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)' }}>
          <MethodRoute
            lang={lang}
            onBack={() => setCurrentPage('dashboard')}
          />
        </div>
      )}

      {/* Leaflet Information & Documentation Modal */}
      <LeafletModal
        isOpen={isLeafletModalOpen}
        onClose={() => setIsLeafletModalOpen(false)}
      />
    </div>
  );
};
