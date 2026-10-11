import React from 'react';
import { ForecastPayload } from '../types/payload';
import { Language } from '../lib/i18n';

interface SmokeRouteProps {
  payload: ForecastPayload;
  lang: Language;
  onBack: () => void;
}

export const SmokeRoute: React.FC<SmokeRouteProps> = ({ payload, lang, onBack }) => {
  const { smoke, locality } = payload;
  const fires = smoke.fires || [];
  const paths = smoke.paths || [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '16px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '15px',
          fontWeight: 600,
          marginBottom: '16px',
          textDecoration: 'underline',
        }}
      >
        ← {lang === 'hi' ? 'मुख्य पृष्ठ पर वापस जाएँ' : 'Back to school advisory'}
      </button>

      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
        {lang === 'hi' ? 'पराली का धुआँ और वायु पथ' : 'Stubble smoke tracking & air paths'}
      </h1>

      <p style={{ color: 'var(--color-ink-soft)', marginBottom: '24px' }}>
        {lang === 'hi'
          ? `${locality.name_hi} के लिए उपग्रह द्वारा दर्ज सक्रिय आग और 72 घंटे के वायु प्रक्षेपवक्र (बैकवर्ड ट्रैजेक्टरी)।`
          : `Active fires from VIIRS satellite sensors and 72-hour backward air trajectories ending at ${locality.name_en}.`}
      </p>

      {/* Trajectory & Fire SVG Regional Map */}
      <div
        style={{
          border: '1px solid var(--color-rule-blue)',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--color-notebook)',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          {lang === 'hi' ? 'क्षेत्रीय मानचित्र (पंजाब/हरियाणा से दिल्ली)' : 'Regional trajectory map (Punjab/Haryana → Delhi)'}
        </h3>

        <svg
          viewBox="0 0 500 320"
          style={{ width: '100%', height: 'auto', background: 'var(--color-panel)', borderRadius: 'var(--radius)' }}
          role="img"
          aria-label="Regional map of fire locations and wind trajectory lines"
        >
          {/* Coordinate box: Lat 28.0 - 32.0 (N), Lon 74.0 - 78.0 (E) */}
          {/* Delhi receptor: ~28.6, 77.1 */}
          {/* Delhi point */}
          <circle cx="380" cy="260" r="7" fill="var(--color-ink)" />
          <text x="392" y="265" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {locality.name_en}
          </text>

          {/* Air trajectory lines (sample paths) */}
          {paths.map((p, idx) => {
            const pathColors = ['#14233C', '#4A5B78', '#2447C8'];
            const color = pathColors[idx % pathColors.length];
            const pts = p.points;
            if (pts.length < 2) return null;

            // Map lat/lon to svg coords
            const svgPts = pts.map(([lat, lon]) => {
              const x = 50 + ((lon - 74.0) / 4.0) * 400;
              const y = 290 - ((lat - 28.0) / 4.0) * 260;
              return `${x},${y}`;
            });

            return (
              <g key={idx}>
                <polyline
                  points={svgPts.join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray={idx === 1 ? '4,4' : 'none'}
                />
                <text x="70" y={40 + idx * 20} fontSize="11" fill={color} fontWeight="600">
                  — {p.level_hpa} hPa ({p.points.length} pts)
                </text>
              </g>
            );
          })}

          {/* Active fires */}
          {fires.slice(0, 40).map((f, i) => {
            const x = 50 + ((f.lon - 74.0) / 4.0) * 400;
            const y = 290 - ((f.lat - 28.0) / 4.0) * 260;
            const r = Math.min(10, Math.max(3, Math.sqrt(f.frp) * 0.8));
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={r} fill="#E00000" opacity="0.65" />
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
          <span>● Red circles: Active fire clusters (size = FRP intensity)</span>
          <span>— Dark lines: Backward wind pathways (975, 950, 925 hPa)</span>
        </div>
      </div>

      {/* Explanatory Paragraphs per 02-UX-SPEC section 3 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            {lang === 'hi' ? 'मॉडल कैसे काम करता है' : 'What the model does'}
          </h3>
          <p style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--color-ink)' }}>
            {lang === 'hi'
              ? 'प्रणवायु ईसीएमडब्ल्यूएफ (ECMWF) के दबाव-स्तरीय हवाओं के आंकड़ों पर 24 वायु पार्सल का एक समूह (एन्सेम्बल) चलाता है। यह देखता है कि दिल्ली पहुँचने वाली हवा पिछले 72 घंटों में पंजाब और हरियाणा के किन खेतों से होकर गुज़री है।'
              : 'PranVayu integrates an ensemble of 24 backward trajectories per level across ECMWF forecast winds at 975, 950, and 925 hPa. It tracks whether air parcels arriving over Delhi traversed active crop residue fire clusters over Punjab and Haryana during the preceding 72 hours.'}
          </p>
        </div>

        <div style={{ background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            {lang === 'hi' ? 'आगमन समय (ETA) की सीमा क्यों होती है' : 'Why the arrival window is broad'}
          </h3>
          <p style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--color-ink)' }}>
            {lang === 'hi'
              ? 'हवा की गति और दिशा में छोटे बदलाव भी धुएँ के आगमन के समय को कुछ घंटे आगे या पीछे कर सकते हैं। इसलिए हम एक निश्चित समय देने के बजाय 4 से 6 घंटे की संभावना सीमा (ETA विंडो) देते हैं।'
              : 'Small perturbations in wind speed and meteorological direction can shift arrival times by several hours over a 300 km path. The model reports an arrival window rather than a single point in time, reflecting atmospheric uncertainty.'}
          </p>
        </div>

        <div style={{ background: 'var(--color-notebook)', border: '1px solid var(--color-rule-blue)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            {lang === 'hi' ? 'मॉडल क्या नहीं जान सकता (सीमाएं)' : 'What satellite and models cannot know'}
          </h3>
          <p style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--color-ink)' }}>
            {lang === 'hi'
              ? 'उपग्रह केवल दिन में ओवरपास के समय आग दर्ज करते हैं; बादलों के नीचे या रात में जलाई गई पराली उपग्रह से छिप सकती है। साथ ही, धुआँ ज़मीन के स्तर पर कितना उतरेगा, यह स्थानीय सतह के तापमान पर निर्भर करता है।'
              : 'Satellites only view Delhi-NCR during daytime orbital passes; cloud cover or night-time burns remain undetected. Furthermore, satellite radiative power cannot measure the exact fraction of smoke plume mass that entrains down to ground breathing level.'}
          </p>
        </div>
      </section>
    </div>
  );
};
