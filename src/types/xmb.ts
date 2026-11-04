export type VisualizerMode = 'bubbles' | 'matrix' | 'waveform';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  artworkUrl: string;
  durationMs?: number;
  url?: string;
  youtubeId?: string;
  sourceType?: 'itunes' | 'local' | 'youtube';
  bpm?: number;
  codec?: string;
  fileSizeBytes?: number;
  sizeDisplay?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  artist?: string;
  thumbnail: string;
  url: string;
  duration?: string;
  codec?: string;
  fileSizeBytes?: number;
  sizeDisplay?: string;
}

export interface GameItem {
  id: string;
  title: string;
  publisher?: string;
  sublabel?: string;
  description?: string;
  genre?: string;
  size?: string;
  icon?: string;
}

export interface XMBItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  type: 'action' | 'track' | 'folder' | 'setting' | 'search' | 'game';
  payload?: any;
}

export interface XMBCategory {
  id: string;
  name: string;
  icon: string;
  items: XMBItem[];
}

export interface PSPTheme {
  id?: string;
  name: string;
  month: number;
  bgGradient: [string, string];
  waveColor1: string;
  waveColor2: string;
  waveColor3: string;
}

export const PSP_OFFICIAL_THEMES: Record<string, PSPTheme> = {
  novembre: {
    id: 'novembre',
    name: 'Novembre (Ambre / Bronze)',
    month: 11,
    bgGradient: ['#331c15', '#140805'],
    waveColor1: 'rgba(215, 110, 75, 0.35)',
    waveColor2: 'rgba(175, 75, 45, 0.25)',
    waveColor3: 'rgba(245, 160, 130, 0.15)',
  },
  juillet: {
    id: 'juillet',
    name: 'Juillet (Bleu Lagon)',
    month: 7,
    bgGradient: ['#0d2b45', '#04101e'],
    waveColor1: 'rgba(50, 170, 245, 0.35)',
    waveColor2: 'rgba(25, 125, 200, 0.25)',
    waveColor3: 'rgba(125, 215, 255, 0.15)',
  },
  avril: {
    id: 'avril',
    name: 'Avril (Rose Sakura)',
    month: 4,
    bgGradient: ['#3e1c2d', '#180710'],
    waveColor1: 'rgba(240, 130, 180, 0.35)',
    waveColor2: 'rgba(210, 95, 145, 0.25)',
    waveColor3: 'rgba(255, 180, 215, 0.15)',
  },
  decembre: {
    id: 'decembre',
    name: 'Décembre (Rouge Rubis)',
    month: 12,
    bgGradient: ['#3a0f18', '#160307'],
    waveColor1: 'rgba(235, 60, 85, 0.35)',
    waveColor2: 'rgba(190, 30, 55, 0.25)',
    waveColor3: 'rgba(255, 125, 145, 0.15)',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight (Noir profond & reflets argent)',
    month: 0,
    bgGradient: ['#14171d', '#05070a'],
    waveColor1: 'rgba(180, 195, 215, 0.35)',
    waveColor2: 'rgba(130, 145, 165, 0.25)',
    waveColor3: 'rgba(220, 235, 255, 0.15)',
  },
};

export const PSP_MONTHLY_THEMES: Record<number, PSPTheme> = {
  1: {
    name: 'Janvier - Argent',
    month: 1,
    bgGradient: ['#2b3036', '#14171a'],
    waveColor1: 'rgba(210, 220, 230, 0.35)',
    waveColor2: 'rgba(160, 175, 190, 0.25)',
    waveColor3: 'rgba(230, 240, 250, 0.15)',
  },
  2: {
    name: 'Février - Jaune Soleil',
    month: 2,
    bgGradient: ['#423812', '#1a1604'],
    waveColor1: 'rgba(245, 205, 60, 0.35)',
    waveColor2: 'rgba(215, 175, 30, 0.25)',
    waveColor3: 'rgba(255, 235, 120, 0.15)',
  },
  3: {
    name: 'Mars - Vert Tendre',
    month: 3,
    bgGradient: ['#1c381c', '#081408'],
    waveColor1: 'rgba(110, 215, 120, 0.35)',
    waveColor2: 'rgba(75, 175, 85, 0.25)',
    waveColor3: 'rgba(160, 245, 170, 0.15)',
  },
  4: {
    name: 'Avril - Rose Cerisier',
    month: 4,
    bgGradient: ['#3e1c2d', '#180710'],
    waveColor1: 'rgba(240, 130, 180, 0.35)',
    waveColor2: 'rgba(210, 95, 145, 0.25)',
    waveColor3: 'rgba(255, 180, 215, 0.15)',
  },
  5: {
    name: 'Mai - Vert Émeraude',
    month: 5,
    bgGradient: ['#0f352b', '#041510'],
    waveColor1: 'rgba(45, 210, 160, 0.35)',
    waveColor2: 'rgba(25, 165, 120, 0.25)',
    waveColor3: 'rgba(115, 245, 205, 0.15)',
  },
  6: {
    name: 'Juin - Lilas',
    month: 6,
    bgGradient: ['#2d1c3a', '#100717'],
    waveColor1: 'rgba(180, 130, 240, 0.35)',
    waveColor2: 'rgba(140, 95, 205, 0.25)',
    waveColor3: 'rgba(215, 180, 255, 0.15)',
  },
  7: {
    name: 'Juillet - Bleu Azur',
    month: 7,
    bgGradient: ['#0d2b45', '#04101e'],
    waveColor1: 'rgba(50, 170, 245, 0.35)',
    waveColor2: 'rgba(25, 125, 200, 0.25)',
    waveColor3: 'rgba(125, 215, 255, 0.15)',
  },
  8: {
    name: 'Août - Ambre Doré',
    month: 8,
    bgGradient: ['#3d280d', '#170e03'],
    waveColor1: 'rgba(245, 165, 50, 0.35)',
    waveColor2: 'rgba(210, 125, 25, 0.25)',
    waveColor3: 'rgba(255, 205, 115, 0.15)',
  },
  9: {
    name: 'Septembre - Violet Royal',
    month: 9,
    bgGradient: ['#281238', '#0e0417'],
    waveColor1: 'rgba(195, 80, 235, 0.35)',
    waveColor2: 'rgba(150, 45, 195, 0.25)',
    waveColor3: 'rgba(230, 140, 255, 0.15)',
  },
  10: {
    name: 'Octobre - Or Automnal',
    month: 10,
    bgGradient: ['#3a220b', '#150a02'],
    waveColor1: 'rgba(235, 145, 40, 0.35)',
    waveColor2: 'rgba(195, 105, 20, 0.25)',
    waveColor3: 'rgba(255, 190, 95, 0.15)',
  },
  11: {
    name: 'Novembre - Brun Rustique',
    month: 11,
    bgGradient: ['#331c15', '#140805'],
    waveColor1: 'rgba(215, 110, 75, 0.35)',
    waveColor2: 'rgba(175, 75, 45, 0.25)',
    waveColor3: 'rgba(245, 160, 130, 0.15)',
  },
  12: {
    name: 'Décembre - Rouge Rubis',
    month: 12,
    bgGradient: ['#3a0f18', '#160307'],
    waveColor1: 'rgba(235, 60, 85, 0.35)',
    waveColor2: 'rgba(190, 30, 55, 0.25)',
    waveColor3: 'rgba(255, 125, 145, 0.15)',
  },
};
