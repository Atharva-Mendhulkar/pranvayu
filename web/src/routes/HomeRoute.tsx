import React, { useState, useEffect } from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';
import { DelhiFluidMap, HotspotData, MapAdvisoryInfo } from '../components/DelhiFluidMap';
import { IntelligenceSidebar } from '../components/IntelligenceSidebar';
import { generateDeterministicHeadline, ClientRulesConfig } from '../lib/rules';
import { SCHOOLS } from '../data/schools';
import { MONITORING_STATIONS } from '../data/stations';
import { InspectedLocation } from '../lib/continuousField';

interface HomeRouteProps {
  payload: ForecastPayload;
  selectedDayIndex: number;
  lang: Language;
  rulesConfig: ClientRulesConfig | null;
  onNavigate: (route: string) => void;
  onSelectLocality: (locId: string) => void;
  isSideMenuOpen?: boolean;
  onToggleSideMenu?: () => void;
  onOpenInfoModal?: () => void;
}

const DEFAULT_HOTSPOTS: HotspotData[] = [
  { id: 'anand_vihar', name_en: 'Anand Vihar', name_hi: 'आनंद विहार', lat: 28.65, lon: 77.31, pm25: 318, verdict: 'skip', category: 'Severe' },
  { id: 'wazirpur', name_en: 'Wazirpur', name_hi: 'वज़ीरपुर', lat: 28.70, lon: 77.17, pm25: 295, verdict: 'skip', category: 'Severe' },
  { id: 'bawana', name_en: 'Bawana', name_hi: 'बवाना', lat: 28.78, lon: 77.05, pm25: 284, verdict: 'skip', category: 'Severe' },
  { id: 'jahangirpuri', name_en: 'Jahangirpuri', name_hi: 'जहाँगीरपुरी', lat: 28.73, lon: 77.17, pm25: 272, verdict: 'skip', category: 'Severe' },
  { id: 'punjabi_bagh', name_en: 'Punjabi Bagh', name_hi: 'पंजाबी बाग', lat: 28.67, lon: 77.13, pm25: 242, verdict: 'skip', category: 'Very Poor' },
  { id: 'ito', name_en: 'ITO', name_hi: 'आईटीओ', lat: 28.63, lon: 77.24, pm25: 218, verdict: 'skip', category: 'Very Poor' },
  { id: 'okhla', name_en: 'Okhla', name_hi: 'ओखला', lat: 28.53, lon: 77.27, pm25: 212, verdict: 'skip', category: 'Very Poor' },
  { id: 'rohini', name_en: 'Rohini', name_hi: 'रोहिणी', lat: 28.73, lon: 77.12, pm25: 205, verdict: 'skip', category: 'Very Poor' },
  { id: 'rk_puram', name_en: 'R K Puram', name_hi: 'आर के पुरम', lat: 28.56, lon: 77.18, pm25: 188, verdict: 'limit', category: 'Very Poor' },
  { id: 'dwarka', name_en: 'Dwarka', name_hi: 'द्वारका', lat: 28.59, lon: 77.05, pm25: 165, verdict: 'limit', category: 'Very Poor' },
  { id: 'siri_fort', name_en: 'Siri Fort', name_hi: 'सिरी फोर्ट', lat: 28.55, lon: 77.22, pm25: 148, verdict: 'limit', category: 'Poor' },
  { id: 'mandir_marg', name_en: 'Mandir Marg', name_hi: 'मंदिर मार्ग', lat: 28.63, lon: 77.20, pm25: 135, verdict: 'limit', category: 'Poor' },
];

export const HomeRoute: React.FC<HomeRouteProps> = ({
  payload,
  selectedDayIndex,
  lang,
  onSelectLocality,
}) => {
  const currentDay = payload.days[selectedDayIndex] || payload.days[0];
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(payload.locality.id || 'anand_vihar');
  const [selectedStationId, setSelectedStationId] = useState<string>(payload.locality.id || 'anand_vihar');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [inspectedLocation, setInspectedLocation] = useState<InspectedLocation | null>(null);

  // Synchronized forecast time offset across Map, Sidebar, Chart, Timeline
  const [hourOffset, setHourOffset] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Meteorological wind vector (from NW 315° at 14 km/h)
  const [windSpeedKmh] = useState<number>(14);
  const [windDirDeg] = useState<number>(315);

  // Sync selected hotspot if locality changes from header or URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locParam = params.get('locality');
    if (locParam) {
      setSelectedHotspotId(locParam);
      setSelectedStationId(locParam);
      onSelectLocality(locParam);
    } else if (payload.locality.id) {
      setSelectedHotspotId(payload.locality.id);
      setSelectedStationId(payload.locality.id);
    }
  }, [payload.locality.id, onSelectLocality]);

  // Timeline scrubber autoplay loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setHourOffset((prev) => (prev + 1) % 49);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleSelectHotspot = (id: string) => {
    setSelectedHotspotId(id);
    setSelectedStationId(id);
    setInspectedLocation(null);
    onSelectLocality(id);
  };

  const handleSelectStation = (id: string) => {
    setSelectedStationId(id);
    setSelectedHotspotId(id);
    setInspectedLocation(null);
    onSelectLocality(id);
  };

  const handleSelectSchool = (id: string) => {
    setSelectedSchoolId(id);
    setInspectedLocation(null);
    const foundSchool = SCHOOLS.find((s) => s.id === id);
    if (foundSchool && foundSchool.locality_id) {
      setSelectedStationId(foundSchool.nearest_station_id);
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Derive honest advisory information
  const headline = generateDeterministicHeadline(currentDay.verdicts, currentDay.clean_window, lang);
  const mapAdvisory: MapAdvisoryInfo = {
    status: `${currentDay.verdicts.some((v) => v.verdict === 'skip') ? 'Severe' : 'Very Poor'} · ${currentDay.confidence} confidence`,
    situation: headline,
    recommendation: currentDay.clean_window
      ? (lang === 'hi'
          ? `सबसे स्वच्छ अवधि: ${currentDay.clean_window.from} से ${currentDay.clean_window.to}। बाहरी गतिविधियाँ इस समय तक सीमित रखें।`
          : `Cleanest window: ${currentDay.clean_window.from} to ${currentDay.clean_window.to}. Limit strenuous outdoor periods.`)
      : (lang === 'hi'
          ? 'संवेदनशील वर्ग बाहरी गतिविधियों से बचें। मास्क का उपयोग करें।'
          : 'Sensitive groups should avoid outdoor physical exertion.'),
    confidence: `${currentDay.confidence} confidence`,
    updatedAt: payload.as_of ? new Date(payload.as_of).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '08:00 IST',
  };

  return (
    <main className="app-workspace-layout">
      {/* Dominant Geospatial Intelligence Map Workspace */}
      <div className="map-workspace-pane">
        <DelhiFluidMap
          hotspots={DEFAULT_HOTSPOTS}
          stations={MONITORING_STATIONS}
          schools={SCHOOLS}
          selectedHotspotId={selectedHotspotId}
          onSelectHotspot={handleSelectHotspot}
          selectedStationId={selectedStationId}
          onSelectStation={handleSelectStation}
          selectedSchoolId={selectedSchoolId}
          onSelectSchool={handleSelectSchool}
          onSelectLocality={onSelectLocality}
          inspectedLocation={inspectedLocation}
          onInspectLocation={setInspectedLocation}
          hourOffset={hourOffset}
          onSeekHourOffset={setHourOffset}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          windDirectionDeg={windDirDeg}
          windSpeedKmh={windSpeedKmh}
          advisory={mapAdvisory}
          lang={lang}
        />
      </div>

      {/* Restrained Perplexity-inspired Intelligence Sidebar (340px) */}
      <IntelligenceSidebar
        payload={payload}
        selectedDayIndex={selectedDayIndex}
        selectedHotspotId={selectedHotspotId}
        onSelectHotspot={handleSelectHotspot}
        selectedStationId={selectedStationId}
        onSelectStation={handleSelectStation}
        selectedSchoolId={selectedSchoolId}
        onSelectSchool={handleSelectSchool}
        inspectedLocation={inspectedLocation}
        onInspectLocation={setInspectedLocation}
        hourOffset={hourOffset}
        onSeekHourOffset={setHourOffset}
        windSpeedKmh={windSpeedKmh}
        windDirDeg={windDirDeg}
        hotspots={DEFAULT_HOTSPOTS}
        stations={MONITORING_STATIONS}
        schools={SCHOOLS}
        lang={lang}
      />
    </main>
  );
};
