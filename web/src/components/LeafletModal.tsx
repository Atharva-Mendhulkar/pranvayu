import React from 'react';
import {
  LeafletLogo,
  GithubIcon,
  XSocialIcon,
  XIcon,
  CheckCircleIcon,
  LayersIcon,
} from './Icons';

interface LeafletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeafletModal: React.FC<LeafletModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(9, 13, 22, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#F8FAFC',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LeafletLogo size={34} />
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                Leaflet
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                An open-source JavaScript library for building powerful interactive maps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.06)',
              cursor: 'pointer',
              color: '#94A3B8',
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Links Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          <a
            href="https://github.com/Leaflet/Leaflet"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <GithubIcon size={14} />
            <span>GitHub: Leaflet/Leaflet</span>
          </a>

          <a
            href="https://leafletjs.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(67, 160, 71, 0.2)',
              border: '1px solid rgba(67, 160, 71, 0.4)',
              color: '#81C784',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <LeafletLogo size={14} />
            <span>leafletjs.com</span>
          </a>

          <a
            href="https://x.com/LeafletJS"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <XSocialIcon size={13} />
            <span>X: @LeafletJS</span>
          </a>

          <a
            href="https://mapstodon.space/@leaflet"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>Mastodon: @leaflet</span>
          </a>
        </div>

        {/* Content body */}
        <div style={{ fontSize: '13.5px', lineHeight: '22px', color: '#94A3B8' }}>
          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              What is Leaflet?
            </h3>
            <p>
              Leaflet is the leading open-source JavaScript library for mobile-friendly interactive maps.
              Weighing just about 39 KB of gzipped JS, it has all the mapping features most developers ever need,
              designed with simplicity, performance and usability in mind.
            </p>
            <p style={{ marginTop: '6px' }}>
              Created by <strong style={{ color: '#F8FAFC' }}>Volodymyr Agafonkin</strong>, Leaflet powers maps
              across the web — from small blogs to global platforms like OpenStreetMap, GitHub, and Wikimedia.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              How PranVayu Couples Leaflet & Three.js Physics
            </h3>
            <p>
              PranVayu runs Leaflet as the cartographic foundation for Delhi NCR. Leaflet’s container projection
              API (<code style={{ color: 'var(--accent-cyan)' }}>map.latLngToContainerPoint</code>) synchronizes
              real monitoring station locations with custom GLSL fragment shaders in Three.js in real time on every
              pan, drag, and zoom event.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              Available Tile Layers
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {['Dark Matter (CartoDB)', 'Positron (CartoDB)', 'OpenStreetMap', 'Voyager (CartoDB)'].map((st) => (
                <span
                  key={st}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#E2E8F0',
                  }}
                >
                  {st}
                </span>
              ))}
            </div>
          </section>

          {/* Attribution Box */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircleIcon size={16} color="#10B981" />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F8FAFC' }}>
                Leaflet © 2010–2026 Volodymyr Agafonkin · Maps © OpenStreetMap contributors · CARTO
              </span>
            </div>

            <a
              href="https://leafletjs.com/download.html"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                textDecoration: 'none',
              }}
            >
              Leaflet Docs →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
