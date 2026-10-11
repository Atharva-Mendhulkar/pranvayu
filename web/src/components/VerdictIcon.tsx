import React from 'react';

interface VerdictIconProps {
  verdict: 'go' | 'limit' | 'skip';
  size?: number;
}

export const VerdictIcon: React.FC<VerdictIconProps> = ({ verdict, size = 18 }) => {
  if (verdict === 'go') {
    // Filled circle
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" fill="var(--color-ink)" />
      </svg>
    );
  }

  if (verdict === 'limit') {
    // Half-filled circle (split vertically)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M 10 2 A 8 8 0 0 1 10 18 Z" fill="var(--color-ink)" />
      </svg>
    );
  }

  // Skip: Circle crossed by a diagonal bar
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" stroke="var(--color-ink)" strokeWidth="2" />
      <line x1="4.5" y1="4.5" x2="15.5" y2="15.5" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
