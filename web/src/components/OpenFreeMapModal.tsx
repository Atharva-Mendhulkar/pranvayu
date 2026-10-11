import React from 'react';
import {
  OpenFreeMapLogo,
  GithubIcon,
  XSocialIcon,
  BlueskyIcon,
  XIcon,
  CheckCircleIcon,
} from './Icons';

interface OpenFreeMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpenFreeMapModal: React.FC<OpenFreeMapModalProps> = ({ isOpen, onClose }) => {
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
            <OpenFreeMapLogo size={32} />
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                OpenFreeMap
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                Free, open-source vector map tiles powered by OpenStreetMap
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

        {/* Social / Repo Links Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          <a
            href="https://github.com/hyperknot/openfreemap"
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
            <span>GitHub: openfreemap</span>
          </a>

          <a
            href="https://github.com/hyperknot/openfreemap-styles"
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
            <GithubIcon size={14} />
            <span>openfreemap-styles</span>
          </a>

          <a
            href="https://x.com/hyperknot"
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
            <span>X: @hyperknot</span>
          </a>

          <a
            href="https://x.com/OpenFreeMapOrg"
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
            <span>@OpenFreeMapOrg</span>
          </a>

          <a
            href="https://bsky.app/profile/hyperknot.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(2, 132, 199, 0.25)',
              border: '1px solid rgba(2, 132, 199, 0.4)',
              color: '#38BDF8',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <BlueskyIcon size={13} />
            <span>bsky: @hyperknot.com</span>
          </a>
        </div>

        {/* Content body */}
        <div style={{ fontSize: '13.5px', lineHeight: '22px', color: '#94A3B8' }}>
          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              What is OpenFreeMap?
            </h3>
            <p>
              OpenFreeMap lets you display custom maps on your website and apps for free.
              You can either self-host or use the public instance. Everything is open-source, including
              the full production setup — there’s no ‘open-core’ model here. The map data comes from OpenStreetMap.
            </p>
            <p style={{ marginTop: '6px' }}>
              Using the public instance is completely free: there are no limits on the number of map views or requests.
              There’s no registration, no user database, no API keys, and no cookies. Weekly full planet downloads are provided
              in both Btrfs and MBTiles formats.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              Available Styles
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {['Positron', 'Bright', 'Liberty', 'Dark', 'Fiord', '3D Peaks'].map((st) => (
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

          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              Who is behind this project?
            </h3>
            <p>
              Created by <strong style={{ color: '#F8FAFC' }}>Zsolt Ero</strong>. After 9 years of running map tile infrastructure for MapHub,
              he open-sourced it and launched OpenFreeMap so developers no longer face huge bills or complex self-hosting setups.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              How is it free and what is the tech stack?
            </h3>
            <p>
              There is no complex tile server running; only nginx serving a Btrfs image with 300 million hard-linked files on dedicated servers.
              Planetiler makes it possible to generate global tiles in hours instead of weeks. Commercial usage is 100% allowed under MIT.
            </p>
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
                OpenFreeMap © OpenMapTiles · Data from OpenStreetMap
              </span>
            </div>

            <a
              href="https://github.com/sponsors/hyperknot"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                textDecoration: 'none',
              }}
            >
              Sponsor on GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
