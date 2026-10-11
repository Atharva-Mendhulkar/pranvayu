import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../lib/i18n';
import {
  PlayIcon,
  PauseIcon,
  WindIcon,
  ActivityIcon,
  ShieldCheckIcon,
  SchoolIcon,
  StationIcon,
  AlertTriangleIcon,
} from '../components/Icons';

interface MethodRouteProps {
  lang: Language;
  onBack: () => void;
}

interface StageData {
  id: string;
  num: string;
  title_en: string;
  title_hi: string;
  caption_en: string;
  caption_hi: string;
  enters_en: string;
  enters_hi: string;
  engine_en: string;
  engine_hi: string;
  exits_en: string;
  exits_hi: string;
  limit_en: string;
  limit_hi: string;
}

const STAGES: StageData[] = [
  {
    id: 'observe',
    num: '01',
    title_en: 'Observe',
    title_hi: 'निरीक्षण',
    caption_en: 'Ground stations provide local observations, not complete coverage.',
    caption_hi: 'सतही निगरानी केंद्र केवल स्थानीय आंकड़े देते हैं, संपूर्ण कवरेज नहीं।',
    enters_en: 'Hourly PM2.5 observations from 12 CPCB and DPCC continuous surface stations (BAM/TEOM analyzers) across Delhi NCR.',
    enters_hi: 'दिल्ली एनसीआर के 12 सीपीसीबी व डीपीसीसी सतही निगरानी केंद्रों से प्राप्त प्रति घंटा पीएम2.5 आंकड़े।',
    engine_en: 'Ingests station telemetry, flags stale readings, verifies plausible sensor bounds, and anchors baseline ground concentrations.',
    engine_hi: 'सेंसर टेलीमेट्री की जांच करता है, पुराने आंकड़ों को पहचानता है और सतही सांद्रता को स्थानीय रूप से निर्धारित करता है।',
    exits_en: 'Sparse point-measurement vector anchored to exact geographic monitoring coordinates.',
    exits_hi: 'निश्चित भौगोलिक निर्देशांकों पर आधारित सीमित बिंदु-मापन वेक्टर।',
    limit_en: 'Coverage is hyper-local; 12 monitors across 1,484 km² leave residential colonies unmeasured.',
    limit_hi: 'कवरेज सीमित है; 1,484 वर्ग किमी में केवल 12 केंद्र होने से अधिकांश रिहायशी कॉलोनियां बिना माप रह जाती हैं।',
  },
  {
    id: 'meteorology',
    num: '02',
    title_en: 'Ingest Meteorology',
    title_hi: 'मौसम विज्ञान',
    caption_en: 'Observations and atmospheric inputs constrain the estimate.',
    caption_hi: 'सतही माप और वायुमंडलीय कारक मिलकर अनुमान को भौतिक रूप से सीमित करते हैं।',
    enters_en: 'Open-Meteo multi-level winds (975, 950, 925 hPa), boundary layer heights (PBLH), and NASA VIIRS active fire detections.',
    enters_hi: 'ओपन-मीटियो बहु-स्तरीय हवाएं (975, 950, 925 hPa), सीमा परत ऊंचाई (PBLH) और नासा उपग्रह सक्रिय आग का पता।',
    engine_en: 'Calculates meteorological transport direction, boundary layer ventilation, and 24-member backward kinematic trajectory integration.',
    engine_hi: 'परिवहन दिशा, सीमा परत वेंटिलेशन और पराली तक 24-सदस्यीय पश्च प्रक्षेपवक्र (backward trajectory) की गणना करता है।',
    exits_en: 'Synoptic transport vectors, dynamic boundary-layer dilution factors, and qualitative smoke arrival timing.',
    exits_hi: 'वायुमंडलीय परिवहन वेक्टर, गतिशील तनुकरण कारक और संभावित धुआं आगमन समय।',
    limit_en: 'Dense cloud cover during satellite overpasses can obscure thermal fire anomalies upstream.',
    limit_hi: 'उपग्रह पारगमन के समय घने बादल पंजाब-हरियाणा में सक्रिय आग की थर्मल पहचान को छिपा सकते हैं।',
  },
  {
    id: 'estimate',
    num: '03',
    title_en: 'Spatial Estimation',
    title_hi: 'स्थानिक अनुमान',
    caption_en: 'Estimate PM2.5 between stations using the implemented model.',
    caption_hi: 'कार्यान्वित मॉडल की सहायता से निगरानी केंद्रों के मध्य पीएम2.5 का अनुमान।',
    enters_en: 'Sparse ground readings, regional background ventilation, and upstream biomass advection coordinates.',
    enters_hi: 'सीमित सतही माप, क्षेत्रीय पृष्ठभूमि वेंटिलेशन और उत्तर-पश्चिमी बायोमास धुआं प्रवेश बिंदु।',
    engine_en: 'Synthesizes regional background, stubble transport plume, and co-axial two-component Gaussian cores (1350m) and halos (3200m).',
    engine_hi: 'क्षेत्रीय पृष्ठभूमि, धुआं परिवहन जीभ और शहरी हॉटस्पॉट कोर (1350 मी) व हेलो (3200 मी) का संयोजन करता है।',
    exits_en: 'Continuous PM2.5 concentration field across Delhi NCR (28.25°–28.95°N, 76.75°–77.60°E) with distance-scaled uncertainty.',
    exits_hi: 'संपूर्ण दिल्ली बेसिन में सतत पीएम2.5 सांद्रता क्षेत्र और दूरी-आधारित अनिश्चितता अंतराल।',
    limit_en: 'Street-level trash fires and micro-scale road dust resuspension cannot be isolated without micro-sensors.',
    limit_hi: 'गली-मोहल्लों में कचरा जलाने या स्थानीय धूल को बिना अति-सूक्ष्म सेंसरों के पूरी तरह अलग नहीं किया जा सकता।',
  },
  {
    id: 'transport',
    num: '04',
    title_en: 'Atmospheric Transport',
    title_hi: 'वायुमंडलीय परिवहन',
    caption_en: 'Model how atmospheric transport affects the spatial distribution.',
    caption_hi: 'वायुमंडलीय गति किस प्रकार सांद्रता वितरण को बदलती है, इसका भौतिक मॉडलिंग।',
    enters_en: 'Continuous spatial concentration field and time-dependent atmospheric wind transport vectors.',
    enters_hi: 'सतत स्थानिक सांद्रता क्षेत्र और समय-आधारित वायुमंडलीय पवन परिवहन वेक्टर।',
    engine_en: 'Advects particulate mass downwind with Pasquill-Gifford dispersion and forward geodesic increments along wind streamlines.',
    engine_hi: 'हवा की धारा के साथ पार्टिकुलेट मास को पास्किल-गिफर्ड फैलाव और भूगर्भीय वेग के साथ आगे बढ़ाता है।',
    exits_en: 'Hourly 48-hour forward spatial plume displacement tracking trans-Yamuna ventilation and stagnation zones.',
    exits_hi: '48 घंटे का स्थानिक विस्थापन पूर्वानुमान, जो यमुना घाटी प्रवाह और ठहराव क्षेत्रों को दर्शाता है।',
    limit_en: 'Assumes quasi-steady atmospheric flow within each 3-hour meteorological forecast assimilation window.',
    limit_hi: 'प्रत्येक 3-घंटे के मौसम पूर्वानुमान अंतराल में हवा को अर्ध-स्थिर (quasi-steady) मानकर चलता है।',
  },
  {
    id: 'advise',
    num: '05',
    title_en: 'School Advisory',
    title_hi: 'विद्यालय परामर्श',
    caption_en: 'Translate location-specific estimates into timetable guidance.',
    caption_hi: 'स्थान-विशिष्ट सांद्रता अनुमानों को विद्यालय समय-सारणी परामर्श में बदलना।',
    enters_en: 'Geographic coordinates of 15 Delhi schools, hourly spatial PM2.5 estimates, and diurnal school schedules.',
    enters_hi: '15 दिल्ली स्कूलों के भौगोलिक निर्देशांक, प्रति घंटा स्थानिक पीएम2.5 अनुमान और दिनचर्या सारणी।',
    engine_en: 'Applies diurnal exposure curves, evaluates CAQM thresholds (≤110 Go, 111–220 Limit, >220 Skip), and identifies cleanest windows.',
    engine_hi: 'दैनिक गतिविधि कारकों को जोड़कर सीएक्यूएम सीमा-मानों (≤110 Go, 111–220 Limit, >220 Skip) का मूल्यांकन करता है।',
    exits_en: 'Actionable Go / Limit / Skip verdicts per outdoor period and verified cleanest play hours for parents.',
    exits_hi: 'प्रत्येक स्कूल अवधि के लिए स्पष्ट गो/लिमिट/स्किप निर्णय और खेलने के लिए सबसे साफ समय खिड़की।',
    limit_en: 'Advisories govern outdoor physical exertion; they do not assess indoor classroom HEPA filtration.',
    limit_hi: 'परामर्श बाहरी खेलकूद के लिए है; यह स्कूल के कमरों के अंदर एयर-फिल्टर की स्थिति नहीं दर्शाता।',
  },
];

export const MethodRoute: React.FC<MethodRouteProps> = ({ lang, onBack }) => {
  const [activeStage, setActiveStage] = useState<number>(2); // Default to Stage 03: Spatial Estimation
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isPhysicsOpen, setIsPhysicsOpen] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  // Auto-advance stages every 6s when playing (full 30s tour)
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const current = STAGES[activeStage];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        color: 'var(--text-primary)',
      }}
    >
      {/* =====================================================================
          1. TOP HEADER & INTERACTIVE TOUR CONTROLS
          ===================================================================== */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                background: 'rgba(39, 211, 226, 0.08)',
                border: '1px solid rgba(39, 211, 226, 0.25)',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ← {lang === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
            </button>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                background: '#111720',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #252D37',
              }}
            >
              OBSERVATIONS → MODEL → SPATIAL FORECAST
            </span>
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.3px',
              margin: '0 0 2px 0',
              color: 'var(--text-primary)',
            }}
          >
            {lang === 'hi' ? 'प्राणवायु कैसे काम करता है' : 'HOW PRANVAYU WORKS'}
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {lang === 'hi'
              ? 'सीमित निगरानी केंद्रों से भौतिकी-आधारित स्थानिक वायु अनुमान तक।'
              : 'From sparse monitoring stations to physics-informed spatial estimates.'}
          </div>
        </div>

        {/* Central Core Question & Playback Tour Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              fontStyle: 'italic',
              background: 'rgba(39, 211, 226, 0.06)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(39, 211, 226, 0.20)',
            }}
          >
            &ldquo;
            {lang === 'hi'
              ? 'जहाँ कोई निगरानी केंद्र नहीं है, वहाँ वायु गुणवत्ता क्या है?'
              : 'What is the air quality where no monitoring station exists?'}
            &rdquo;
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: isPlaying ? 'var(--text-primary)' : 'var(--accent-cyan)',
                background: '#111720',
                border: '1px solid #252D37',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Pause 30-second tour' : 'Play 30-second tour'}
            >
              {isPlaying ? <PauseIcon size={12} color="var(--accent-cyan)" /> : <PlayIcon size={12} color="var(--accent-cyan)" />}
              <span>{isPlaying ? (lang === 'hi' ? 'रोकें' : 'Pause Tour') : (lang === 'hi' ? 'दौरा चलाएं' : 'Play Tour')}</span>
            </button>

            {/* Stepper Pills */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {STAGES.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveStage(idx);
                    setIsPlaying(false);
                  }}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 7px',
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: activeStage === idx ? 'var(--accent-cyan)' : '#252D37',
                    background: activeStage === idx ? 'rgba(39, 211, 226, 0.15)' : '#0D1117',
                    color: activeStage === idx ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {s.num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. CENTRAL ANIMATED PIPELINE (5 CONNECTED STAGES)
          ===================================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '10px',
            position: 'relative',
          }}
        >
          {/* Stage 01: OBSERVE */}
          <div
            className={`pipeline-stage-card ${activeStage === 0 ? 'active' : ''}`}
            onClick={() => {
              setActiveStage(0);
              setIsPlaying(false);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>01. OBSERVE</span>
              <StationIcon size={13} color="var(--accent-cyan)" />
            </div>

            {/* Visual 1: Sparse ground observations map */}
            <div
              style={{
                height: '92px',
                background: '#080B0F',
                borderRadius: '4px',
                border: '1px solid #1C242D',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 180 90">
                {/* Delhi territory outline */}
                <path
                  d="M 30,25 Q 70,12 110,20 Q 155,30 145,65 Q 120,80 80,75 Q 35,70 30,25 Z"
                  fill="none"
                  stroke="#1C242D"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                {/* Station 1: Anand Vihar */}
                <g transform="translate(130, 42)">
                  <circle cx="0" cy="0" r="8" fill="none" stroke="#D94E49" strokeWidth="1" className="radar-ring" />
                  <circle cx="0" cy="0" r="3.5" fill="#D94E49" />
                  <text x="5" y="-3" fill="#D94E49" fontSize="8" fontWeight="700">318</text>
                </g>
                {/* Station 2: Dwarka */}
                <g transform="translate(52, 60)">
                  <circle cx="0" cy="0" r="7" fill="none" stroke="#E77A43" strokeWidth="1" className="radar-ring" style={{ animationDelay: '0.6s' }} />
                  <circle cx="0" cy="0" r="3" fill="#E77A43" />
                  <text x="-16" y="2" fill="#E77A43" fontSize="8" fontWeight="700">165</text>
                </g>
                {/* Station 3: Rohini */}
                <g transform="translate(68, 26)">
                  <circle cx="0" cy="0" r="7" fill="none" stroke="#E77A43" strokeWidth="1" className="radar-ring" style={{ animationDelay: '1.2s' }} />
                  <circle cx="0" cy="0" r="3" fill="#E77A43" />
                  <text x="4" y="-3" fill="#E77A43" fontSize="8" fontWeight="700">205</text>
                </g>
                {/* Station 4: RK Puram */}
                <g transform="translate(90, 50)">
                  <circle cx="0" cy="0" r="3" fill="#D2A34D" />
                  <text x="4" y="3" fill="#D2A34D" fontSize="7.5" fontWeight="600">180</text>
                </g>
                {/* Empty vast space interrogatives */}
                <text x="88" y="34" fill="#3A4656" fontSize="9" fontWeight="700">?</text>
                <text x="40" y="42" fill="#3A4656" fontSize="9" fontWeight="700">?</text>
                <text x="120" y="70" fill="#3A4656" fontSize="9" fontWeight="700">?</text>
              </svg>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              {lang === 'hi' ? STAGES[0].title_hi : STAGES[0].title_en}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '14px' }}>
              {lang === 'hi' ? STAGES[0].caption_hi : STAGES[0].caption_en}
            </div>
          </div>

          {/* Stage 02: INGEST METEOROLOGY */}
          <div
            className={`pipeline-stage-card ${activeStage === 1 ? 'active' : ''}`}
            onClick={() => {
              setActiveStage(1);
              setIsPlaying(false);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>02. INGEST</span>
              <WindIcon size={13} color="var(--accent-cyan)" />
            </div>

            {/* Visual 2: Ingest meteorology vectors */}
            <div
              style={{
                height: '92px',
                background: '#080B0F',
                borderRadius: '4px',
                border: '1px solid #1C242D',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 180 90">
                {/* Incoming NW wind arrows */}
                <path d="M 15,15 L 75,45" stroke="#27D3E2" strokeWidth="1.5" className="flow-streamline" />
                <polygon points="75,45 66,41 68,48" fill="#27D3E2" />

                <path d="M 45,10 L 115,45" stroke="#27D3E2" strokeWidth="1.8" className="flow-streamline" style={{ animationDelay: '0.3s' }} />
                <polygon points="115,45 106,41 108,48" fill="#27D3E2" />

                <path d="M 85,15 L 145,50" stroke="#27D3E2" strokeWidth="1.5" className="flow-streamline" style={{ animationDelay: '0.6s' }} />
                <polygon points="145,50 136,46 138,53" fill="#27D3E2" />

                {/* Satellite active fire anomaly tag */}
                <g transform="translate(18, 18)">
                  <circle cx="0" cy="0" r="3" fill="#E77A43" />
                  <text x="5" y="3" fill="#E77A43" fontSize="7" fontWeight="600">VIIRS FIRMS</text>
                </g>

                {/* Boundary layer label badge */}
                <rect x="80" y="65" width="85" height="16" rx="3" fill="#111720" stroke="#252D37" strokeWidth="0.8" />
                <text x="86" y="76" fill="#A1ACB8" fontSize="7.5" fontWeight="600">NW 14 km/h · PBLH 850m</text>
              </svg>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              {lang === 'hi' ? STAGES[1].title_hi : STAGES[1].title_en}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '14px' }}>
              {lang === 'hi' ? STAGES[1].caption_hi : STAGES[1].caption_en}
            </div>
          </div>

          {/* Stage 03: SPATIAL ESTIMATION (THE NOVELTY CENTERPIECE) */}
          <div
            className={`pipeline-stage-card ${activeStage === 2 ? 'active' : ''}`}
            onClick={() => {
              setActiveStage(2);
              setIsPlaying(false);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-cyan)' }}>03. ESTIMATE ★</span>
              <ActivityIcon size={13} color="var(--accent-cyan)" />
            </div>

            {/* Visual 3: Continuous spatial concentration field */}
            <div
              style={{
                height: '92px',
                background: '#080B0F',
                borderRadius: '4px',
                border: '1px solid #1C242D',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 180 90">
                <defs>
                  {/* Clean regional emerald gradient */}
                  <radialGradient id="cleanField" cx="45%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#18382E" stopOpacity="0.85" />
                    <stop offset="60%" stopColor="#2F7656" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#080B0F" stopOpacity="0" />
                  </radialGradient>
                  {/* Upstream stubble advection plume */}
                  <linearGradient id="plumeAdvect" x1="0%" y1="0%" x2="100%" y2="80%">
                    <stop offset="10%" stopColor="#D2A34D" stopOpacity="0.60" />
                    <stop offset="60%" stopColor="#9AAB55" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#18382E" stopOpacity="0.20" />
                  </linearGradient>
                  {/* Anand Vihar hot core */}
                  <radialGradient id="hotCore" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#D94E49" stopOpacity="0.95" />
                    <stop offset="45%" stopColor="#E77A43" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#D2A34D" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Base basin continuous green field */}
                <rect x="0" y="0" width="180" height="90" fill="url(#cleanField)" />
                {/* Advection tongue */}
                <path d="M 20,10 Q 90,30 150,65 Q 130,85 70,55 Z" fill="url(#plumeAdvect)" className="pulse-field" />
                {/* Anand Vihar hotspot core */}
                <circle cx="130" cy="45" r="22" fill="url(#hotCore)" />
                {/* Wazirpur hotspot core */}
                <circle cx="85" cy="32" r="15" fill="url(#hotCore)" />

                {/* Continuous contour lines */}
                <path d="M 40,25 Q 90,45 140,40" stroke="#9AAB55" strokeWidth="0.8" fill="none" opacity="0.6" />
                <path d="M 45,45 Q 95,65 145,60" stroke="#2F7656" strokeWidth="0.8" fill="none" opacity="0.6" />

                {/* Measurement anchors */}
                <circle cx="130" cy="45" r="2.5" fill="#FFF" />
                <circle cx="52" cy="60" r="2" fill="#FFF" />
                <circle cx="68" cy="26" r="2" fill="#FFF" />

                <text x="8" y="80" fill="#2F7656" fontSize="7.5" fontWeight="700">Verified Clean (SW)</text>
                <text x="100" y="16" fill="#D94E49" fontSize="7.5" fontWeight="700">Hotspot Plume (East)</text>
              </svg>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '3px' }}>
              {lang === 'hi' ? STAGES[2].title_hi : STAGES[2].title_en}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '14px' }}>
              {lang === 'hi' ? STAGES[2].caption_hi : STAGES[2].caption_en}
            </div>
          </div>

          {/* Stage 04: ATMOSPHERIC TRANSPORT */}
          <div
            className={`pipeline-stage-card ${activeStage === 3 ? 'active' : ''}`}
            onClick={() => {
              setActiveStage(3);
              setIsPlaying(false);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>04. TRANSPORT</span>
              <WindIcon size={13} color="var(--accent-cyan)" />
            </div>

            {/* Visual 4: Particle advection & transport */}
            <div
              style={{
                height: '92px',
                background: '#080B0F',
                borderRadius: '4px',
                border: '1px solid #1C242D',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 180 90">
                {/* Streamlines */}
                <path d="M 20,20 C 60,35 110,45 160,65" stroke="rgba(39, 211, 226, 0.45)" strokeWidth="1" fill="none" />
                <path d="M 30,40 C 70,55 120,65 170,80" stroke="rgba(39, 211, 226, 0.45)" strokeWidth="1" fill="none" />
                <path d="M 10,10 C 50,25 100,35 150,55" stroke="rgba(39, 211, 226, 0.35)" strokeWidth="0.8" fill="none" />

                {/* Moving Particles */}
                <circle cx="50" cy="30" r="2.2" fill="#E77A43" className="particle-flow-dot" />
                <circle cx="85" cy="42" r="2.5" fill="#D94E49" className="particle-flow-dot" style={{ animationDelay: '0.4s' }} />
                <circle cx="115" cy="50" r="2.0" fill="#E77A43" className="particle-flow-dot" style={{ animationDelay: '0.8s' }} />
                <circle cx="70" cy="53" r="1.8" fill="#D2A34D" className="particle-flow-dot" style={{ animationDelay: '1.2s' }} />
                <circle cx="135" cy="58" r="2.2" fill="#D94E49" className="particle-flow-dot" style={{ animationDelay: '1.5s' }} />

                {/* Horizon displacement tag */}
                <rect x="12" y="66" width="60" height="15" rx="3" fill="#111720" stroke="#252D37" strokeWidth="0.8" />
                <text x="17" y="77" fill="#27D3E2" fontSize="7.5" fontWeight="700">t = +0h → +24h</text>
              </svg>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              {lang === 'hi' ? STAGES[3].title_hi : STAGES[3].title_en}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '14px' }}>
              {lang === 'hi' ? STAGES[3].caption_hi : STAGES[3].caption_en}
            </div>
          </div>

          {/* Stage 05: SCHOOL ADVISORY */}
          <div
            className={`pipeline-stage-card ${activeStage === 4 ? 'active' : ''}`}
            onClick={() => {
              setActiveStage(4);
              setIsPlaying(false);
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>05. ADVISE</span>
              <SchoolIcon size={13} color="var(--accent-cyan)" />
            </div>

            {/* Visual 5: School advisory card over field */}
            <div
              style={{
                height: '92px',
                background: '#080B0F',
                borderRadius: '4px',
                border: '1px solid #1C242D',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '8px 10px',
                marginBottom: '8px',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)' }}>Sanskriti School</span>
                <span
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(210, 163, 77, 0.20)',
                    color: '#D2A34D',
                    border: '1px solid rgba(210, 163, 77, 0.40)',
                  }}
                >
                  LIMIT
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>148</span>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>µg/m³ PM2.5 (Mod)</span>
              </div>

              <div style={{ fontSize: '8px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Arrival (07:30): <strong style={{ color: '#D94E49' }}>Skip</strong></span>
                <span>Recess (11:30): <strong style={{ color: '#2F7656' }}>Go</strong></span>
              </div>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              {lang === 'hi' ? STAGES[4].title_hi : STAGES[4].title_en}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '14px' }}>
              {lang === 'hi' ? STAGES[4].caption_hi : STAGES[4].caption_en}
            </div>
          </div>
        </div>

        {/* Animated Directional Data Flow Beam between Stages */}
        <div
          style={{
            height: '2px',
            background: '#1C242D',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '1px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${activeStage * 20}%`,
              width: '20%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #27D3E2, transparent)',
              transition: 'left 0.4s ease-out',
            }}
          />
        </div>

        {/* Selected Stage Explanation Panel (Tightly Structured 40-60 Words) */}
        <div
          style={{
            background: '#0D1117',
            border: '1px solid #252D37',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '3px' }}>
              {lang === 'hi' ? 'प्रवेश (What Enters)' : 'What Enters This Stage'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {lang === 'hi' ? current.enters_hi : current.enters_en}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '3px' }}>
              {lang === 'hi' ? 'इंजन प्रक्रिया (Engine Action)' : 'What The Engine Does'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {lang === 'hi' ? current.engine_hi : current.engine_en}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '3px' }}>
              {lang === 'hi' ? 'निर्गम (What Comes Out)' : 'What Comes Out'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {lang === 'hi' ? current.exits_hi : current.exits_en}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#E77A43', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangleIcon size={11} color="#E77A43" />
              <span>{lang === 'hi' ? 'मुख्य सीमा (Key Limitation)' : 'Most Important Limitation'}</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {lang === 'hi' ? current.limit_hi : current.limit_en}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. SPATIAL ESTIMATION NOVELTY: COMPACT COMPARISON VISUAL
          ===================================================================== */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Comparison Card: Measured vs. Estimated */}
        <div
          style={{
            background: '#0D1117',
            border: '1px solid #252D37',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {lang === 'hi' ? 'स्थानिक अनुमान नवीनता' : 'Spatial Estimation Novelty'}
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
              {lang === 'hi' ? 'वास्तविक मॉडल डेटा पर आधारित' : 'Illustrative example · Actual continuous field logic'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Left: MEASURED (Sparse Points Only) */}
            <div
              style={{
                background: '#080B0F',
                border: '1px solid #1C242D',
                borderRadius: '4px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>RAW MEASURED</span>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>Sparse 12 Stations</span>
              </div>

              {/* Graphic: 4 isolated dots with empty void */}
              <div
                style={{
                  height: '75px',
                  background: '#05070A',
                  borderRadius: '3px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed #252D37',
                }}
              >
                <div style={{ position: 'absolute', top: '15px', right: '15px', textAlign: 'center' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D94E49', margin: '0 auto' }} />
                  <span style={{ fontSize: '7.5px', color: '#D94E49', fontWeight: 700 }}>Anand Vihar: 318</span>
                </div>
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', textAlign: 'center' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E77A43', margin: '0 auto' }} />
                  <span style={{ fontSize: '7.5px', color: '#E77A43', fontWeight: 700 }}>Dwarka: 165</span>
                </div>
                <div style={{ fontSize: '10px', color: '#3A4656', fontWeight: 600 }}>
                  [ Unmonitored Void ]
                </div>
              </div>

              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                {lang === 'hi'
                  ? 'निगरानी केंद्रों के बीच 95%+ क्षेत्र में कोई वास्तविक माप नहीं होता।'
                  : 'Vast neighborhoods between stations have zero sensor readings.'}
              </div>
            </div>

            {/* Right: ESTIMATED (Continuous Physics Field) */}
            <div
              style={{
                background: '#080B0F',
                border: '1px solid rgba(39, 211, 226, 0.35)',
                borderRadius: '4px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-cyan)' }}>PHYSICS-ESTIMATED</span>
                <span style={{ fontSize: '8.5px', color: 'var(--accent-cyan)' }}>Continuous Basin</span>
              </div>

              {/* Graphic: Continuous emerald/amber field with target reticle at Najafgarh */}
              <div
                style={{
                  height: '75px',
                  background: 'linear-gradient(135deg, #18382E 0%, #2F7656 35%, #D2A34D 70%, #D94E49 100%)',
                  borderRadius: '3px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* Station anchors */}
                <div style={{ position: 'absolute', top: '15px', right: '15px', width: '5px', height: '5px', borderRadius: '50%', background: '#FFF' }} />
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', width: '5px', height: '5px', borderRadius: '50%', background: '#FFF' }} />

                {/* Highlighted unmonitored location (Najafgarh) */}
                <div
                  style={{
                    background: 'rgba(11, 15, 20, 0.90)',
                    border: '1px solid #27D3E2',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Najafgarh (14.2 km from station)</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    52 µg/m³ <span style={{ fontSize: '8px', fontWeight: 600, color: '#A1ACB8' }}>±37.6 µg/m³</span>
                  </div>
                  <div style={{ fontSize: '7px', color: 'var(--text-secondary)' }}>Model-derived · Not measured</div>
                </div>
              </div>

              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                {lang === 'hi'
                  ? 'भौतिकी-आधारित विसर्जन और दूरी-आधारित अनिश्चितता के साथ संपूर्ण बेसिन का अनुमान।'
                  : 'Physics-informed dispersion with distance-scaled uncertainty spread.'}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            4. THE PHYSICS BEHIND THE ESTIMATE (COLLAPSIBLE COMPACT PANEL)
            ===================================================================== */}
        <div
          style={{
            background: '#0D1117',
            border: '1px solid #252D37',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setIsPhysicsOpen(!isPhysicsOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>{isPhysicsOpen ? '▼' : '▶'}</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {lang === 'hi' ? 'अनुमान के पीछे का भौतिक विज्ञान' : 'The Physics Behind the Estimate'}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              {isPhysicsOpen ? (lang === 'hi' ? 'संक्षिप्त करें' : 'Collapse') : (lang === 'hi' ? 'विस्तार करें' : 'Expand')}
            </span>
          </div>

          {/* Conceptual Governing Equation */}
          <div
            style={{
              background: '#080B0F',
              border: '1px solid #1C242D',
              borderRadius: '4px',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.5px',
            }}
          >
            ∂C/∂t + u · ∇C = ∇ · (K ∇C) + S
          </div>

          {isPhysicsOpen ? (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>C:</strong> PM2.5 spatial concentration field (&mu;g/m&sup3;).
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>u:</strong> Multi-level atmospheric wind velocity (Open-Meteo 975–925 hPa).
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>K:</strong> Atmospheric eddy diffusivity tensor (Pasquill-Gifford dispersion).
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>S:</strong> Source terms: satellite active fires + Delhi industrial hotspot emission clusters.
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid #1C242D', paddingTop: '6px' }}>
                * The engine implements a semi-analytical physics-informed solution (co-axial Gaussian core/halo plumes + 2nd-order backward trajectories + rolling bias correction) rather than slow supercomputer PDE grids, enabling sub-second real-time evaluation.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {lang === 'hi'
                ? 'यह मॉडल वायुमंडलीय अभिवहन (advection) और गॉसियन विसर्जन (Gaussian dispersion) का वास्तविक-समय भौतिक समाधान उपयोग करता है।'
                : 'Real-time semi-analytical advection-dispersion modeling combining regional background, biomass advection, and local urban plumes.'}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          5. TRUST AND UNCERTAINTY COMPACT FOOTER STRIP
          ===================================================================== */}
      <footer
        style={{
          background: '#0D1117',
          border: '1px solid #252D37',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27D3E2', marginTop: '4px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)' }}>MEASURED</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              Direct physical observation from BAM/TEOM sensor at verified CPCB/DPCC monitoring stations.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#D2A34D', marginTop: '4px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)' }}>ESTIMATED</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              Model-derived concentration synthesized via atmospheric physics across unmonitored neighborhoods.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', border: '1px dashed #707C8A', marginTop: '4px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>UNCERTAIN / UNAVAILABLE</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              Error spread expands with monitor distance (&plusmn;&sigma;); out-of-domain coordinates display &ndash;&ndash; &mu;g/m&sup3; and are never fabricated.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
