import React, { useState } from 'react';
import { VerdictItem, SeriesPoint } from '../types/payload';
import { VerdictIcon } from './VerdictIcon';
import { Language, t } from '../lib/i18n';
import { evaluateClientVerdict, ClientRulesConfig } from '../lib/rules';
import { ClockIcon, ActivityIcon, CheckCircleIcon, AlertCircleIcon } from './Icons';

interface TimetableProps {
  verdicts: VerdictItem[];
  series: SeriesPoint[];
  dateStr: string;
  confidence: 'high' | 'medium' | 'low';
  lang: Language;
  rulesConfig?: ClientRulesConfig | null;
  onVerdictsChange?: (newVerdicts: VerdictItem[]) => void;
}

export const Timetable: React.FC<TimetableProps> = ({
  verdicts,
  series,
  dateStr,
  confidence,
  lang,
  rulesConfig,
  onVerdictsChange,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedTimes, setEditedTimes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    verdicts.forEach((v) => {
      init[v.period_id] = v.time;
    });
    return init;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((curr) => (curr === id ? null : id));
  };

  const handleTimeChange = (id: string, newTime: string) => {
    setEditedTimes((curr) => ({ ...curr, [id]: newTime }));
  };

  const handleSaveTimes = () => {
    if (!rulesConfig || !onVerdictsChange) {
      setIsEditing(false);
      return;
    }

    const updated = verdicts.map((v) => {
      const newTime = editedTimes[v.period_id] || v.time;
      const duration = rulesConfig.period_durations_min[v.period_id] || 30;
      const recalculated = evaluateClientVerdict(
        series,
        dateStr,
        newTime,
        v.activity_type,
        duration,
        confidence,
        rulesConfig
      );
      return {
        ...v,
        time: newTime,
        verdict: recalculated.verdict,
        decision_value: recalculated.decision_value,
        range: recalculated.range,
        category: recalculated.category,
      };
    });

    onVerdictsChange(updated);
    setIsEditing(false);
  };

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockIcon size={18} color="var(--accent-indigo)" />
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
            {lang === 'hi' ? 'स्कूल समय-सारिणी परामर्श' : 'School Day Timetable'}
          </h2>
        </div>

        <button
          onClick={() => (isEditing ? handleSaveTimes() : setIsEditing(true))}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 600,
            background: isEditing ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.05)',
            color: isEditing ? '#FFFFFF' : 'var(--text-secondary)',
            border: '1px solid var(--border-glass-light)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          {isEditing ? (lang === 'hi' ? 'समय सहेजें' : 'Save Times') : (lang === 'hi' ? 'समय बदलें' : 'Adjust Times')}
        </button>
      </div>

      {/* Cards List */}
      <div className="timetable-glass-container">
        {verdicts.map((v) => {
          const isExpanded = expandedId === v.period_id;
          const periodLabel = t(`periods.${v.period_id}`, lang);
          const verdictClass = `verdict-${v.verdict}`;

          return (
            <div key={v.period_id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                className="timetable-card"
                onClick={() => !isEditing && toggleExpand(v.period_id)}
                role="button"
                tabIndex={0}
                style={{
                  cursor: isEditing ? 'default' : 'pointer',
                  borderColor: isExpanded ? 'var(--border-glass-light)' : 'var(--border-glass)',
                }}
              >
                {/* Time & Period Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      minWidth: '68px',
                      textAlign: 'center',
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="time"
                        value={editedTimes[v.period_id] || v.time}
                        onChange={(e) => handleTimeChange(v.period_id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: '#0F172A',
                          color: '#FFFFFF',
                          border: '1px solid var(--accent-indigo)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '12px',
                        }}
                      />
                    ) : (
                      v.time
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#FFFFFF' }}>
                      {periodLabel}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t(`activities.${v.activity_type}`, lang)} • {v.category}
                    </div>
                  </div>
                </div>

                {/* Verdict Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`verdict-badge ${verdictClass}`}>
                    <VerdictIcon verdict={v.verdict} />
                    <span>{t(v.verdict, lang)}</span>
                  </div>
                </div>
              </div>

              {/* Expansion Detail Drawer */}
              {isExpanded && !isEditing && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid var(--border-glass-light)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                    padding: '12px 18px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: '20px',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <ActivityIcon size={16} color="var(--accent-cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>PM2.5 ~ {v.range.p50} µg/m³</strong>{' '}
                      (Uncertainty band: {v.range.p10} to {v.range.p90}) at {v.time}.
                      <br />
                      {v.verdict === 'skip' ? (
                        <span style={{ color: '#F87171' }}>
                          Exceeds safety limit ({v.threshold_used.limit} µg/m³). Relocate indoors or cancel outdoor activity.
                        </span>
                      ) : v.verdict === 'limit' ? (
                        <span style={{ color: '#FBBF24' }}>
                          Caution window ({v.threshold_used.go}–{v.threshold_used.limit} µg/m³). Limit strenuous exertion.
                        </span>
                      ) : (
                        <span style={{ color: '#34D399' }}>
                          Within safe limits (under {v.threshold_used.go} µg/m³). Outdoor activities permitted.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
