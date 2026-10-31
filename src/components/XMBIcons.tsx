import React from 'react';

export const CategoryIcon: React.FC<{ type: string; active?: boolean }> = ({ type, active }) => {
  const color = active ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
  const size = active ? 40 : 30;

  switch (type) {
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'photo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'music':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'video':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
      );
    case 'game':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
          <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
        </svg>
      );
    case 'network':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    default:
      return null;
  }
};

// PlayStation face button glyphs (△ ◯ ✕ □)
export const PSGlyph: React.FC<{ type: 'cross' | 'circle' | 'triangle' | 'square'; size?: number }> = ({
  type,
  size = 14,
}) => {
  switch (type) {
    case 'cross':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <line x1="6.5" y1="6.5" x2="13.5" y2="13.5" stroke="#5da9e9" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="13.5" y1="6.5" x2="6.5" y2="13.5" stroke="#5da9e9" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'circle':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="4.2" stroke="#ea526f" strokeWidth="2.2" />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <polygon points="10,5.5 14.5,14 5.5,14" stroke="#4ecdc4" strokeWidth="2" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'square':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          <rect x="6" y="6" width="8" height="8" stroke="#f48498" strokeWidth="2" fill="none" />
        </svg>
      );
  }
};

// Official PlayStation brand symbol
export const PlayStationLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 22,
  className = '',
}) => (
  <svg
    width={size}
    height={(size * 28) / 36}
    viewBox="0 0 36 28"
    fill="currentColor"
    className={className}
  >
    <path
      d="M17.4 1.5c-.8 0-1.4.6-1.4 1.4v18.7c0 .8.6 1.4 1.4 1.4h3.6c.8 0 1.4-.6 1.4-1.4V2.9c0-.8-.6-1.4-1.4-1.4h-3.6z"
      opacity="0.95"
    />
    <path
      d="M16 21.6l-7.3 2.6c-2.4.9-4.1 2.3-4.8 4-.5 1.2-.3 2.4.6 3.2.9.8 2.3 1.1 3.8.7 2-.5 3.7-1.8 4.8-3.5.7-1.1 1.1-2.4 1.1-3.7v-3.3h1.8z"
      opacity="0.65"
      transform="scale(0.85) translate(2, -3)"
    />
    <path
      d="M34.2 19.3c-1.9-.7-4-.7-5.7-.1-1.3.4-2.6 1.2-3.4 2.2-.6.6-1 1.3-1.1 2.1-.2 1 0 2 .5 2.8.9 1.2 2.3 1.7 3.7 1.7 2 0 4-1 5.2-2.7 1-1.4 1.5-3.1 1.4-4.8 0-.4-.3-.7-.6-1.2zm-4.2 6.8c-1.2 0-2.2-.6-2.7-1.6-.2-.5-.2-1.1-.1-1.6.2-.5.6-1 1.1-1.3 1-.6 2.3-.7 3.4-.3.2.1.5.2.7.4.1 1.3-.4 2.6-1.3 3.4-.3.6-.8 1-1.1 1z"
      opacity="0.75"
      transform="scale(0.85) translate(1, -3)"
    />
  </svg>
);

// SensMe™ Heart Icon
export const SensMeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="url(#sensme-grad)"
    />
    <defs>
      <linearGradient id="sensme-grad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60a5fa" />
        <stop offset="0.5" stopColor="#a855f7" />
        <stop offset="1" stopColor="#ec4899" />
      </linearGradient>
    </defs>
  </svg>
);

