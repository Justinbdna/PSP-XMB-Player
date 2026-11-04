import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMBCategory, Track, VideoItem, GameItem, PSPTheme, PSP_OFFICIAL_THEMES, VisualizerMode, XMBContextInfo } from '../types/xmb';
import { CategoryIcon, PSGlyph } from './XMBIcons';
import {
  NOSTALGIC_PSP_TRACKS,
  searchTracks,
  getListeningHistory,
  clearListeningHistory,
} from '../services/itunes';
import videosData from '../data/videos.json';
import gamesData from '../data/games.json';
import localTracksData from '../data/local-tracks.json';
import { sound } from '../services/sound';
import { useAudio } from './AudioEngine';
import { AudioVisualizer } from './AudioVisualizer';
import { RetroBrickGame } from './games/RetroBrickGame';

export type XMBViewMode = 'menu' | 'sublist' | 'player' | 'video_player' | 'game_screen';

interface NavigationFrame {
  view: XMBViewMode;
  catIndex: number;
  itemIndex: number;
  subItemIndex: number;
  subListType?: 'ms' | 'itunes' | 'history' | 'search_results' | 'video' | 'game' | 'theme' | 'music';
}

const VISUALIZER_OPTIONS: { id: VisualizerMode; label: string }[] = [
  { id: 'waveform', label: 'Neon Wave Oscilloscope' },
  { id: 'matrix', label: 'LED Matrix Blocks' },
  { id: 'bubbles', label: 'Underwater Bubbles' },
];

interface XMBMenuProps {
  currentTheme: PSPTheme;
  onThemeChange: (theme: PSPTheme) => void;
  externalCommand?: { action: string; timestamp: number } | null;
  debugHitboxes?: boolean;
  onContextChange?: (context: XMBContextInfo) => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const XMBMenu: React.FC<XMBMenuProps> = ({
  currentTheme,
  onThemeChange,
  externalCommand,
  debugHitboxes: _debugHitboxes = false,
  onContextChange,
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    analyser,
    isRealDSP,
    playTrack,
    nextTrack,
    previousTrack,
    pauseTrack,
    togglePlay,
    seekRelative,
    adjustVolume,
  } = useAudio();

  // Navigation View & Stack
  const [viewMode, setViewMode] = useState<XMBViewMode>('menu');
  const [navStack, setNavStack] = useState<NavigationFrame[]>([]);

  // Context info calculation for dynamic footer / didactic legend
  const currentContext: XMBContextInfo = (() => {
    switch (viewMode) {
      case 'menu':
        return 'xmb_menu';
      case 'sublist':
        return 'music_sublist';
      case 'player':
        return 'music_player';
      case 'video_player':
        return 'video_player';
      case 'game_screen':
        return 'game';
      default:
        return 'xmb_menu';
    }
  })();

  useEffect(() => {
    onContextChange?.(currentContext);
  }, [currentContext, onContextChange]);

  // Navigation Coordinates (Default category: 1 = Musique)
  const [catIndex, setCatIndex] = useState<number>(1);
  const [itemIndex, setItemIndex] = useState<number>(0);
  const [subItemIndex, setSubItemIndex] = useState<number>(0);
  const [subListType, setSubListType] = useState<
    'ms' | 'itunes' | 'history' | 'search_results' | 'video' | 'game' | 'theme' | 'music'
  >('ms');

  // Video playback state
  const [videosList] = useState<VideoItem[]>(videosData as VideoItem[]);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<{ current: number; duration: number }>({
    current: 0,
    duration: 0,
  });
  const [showVideoHUD, setShowVideoHUD] = useState<boolean>(true);
  const [videoAspectMode, setVideoAspectMode] = useState<'contain' | 'cover'>('contain');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedCommandTimestampRef = useRef<number>(0);

  // Games state
  const [gamesList] = useState<GameItem[]>(gamesData as GameItem[]);
  const [currentGame, setCurrentGame] = useState<GameItem | null>(null);

  // Official Themes list for custom theme picker
  const officialThemesList = Object.values(PSP_OFFICIAL_THEMES);

  // Dynamic tracks state (Chantier 2)
  const [localTracks] = useState<Track[]>(localTracksData as Track[]);
  const [itunesTracks] = useState<Track[]>(NOSTALGIC_PSP_TRACKS);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // Hardware Battery API (Chantier 3)
  const [isCharging, setIsCharging] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setIsCharging(Boolean(battery.charging));
          const update = () => {
            setIsCharging(Boolean(battery.charging));
          };
          battery.addEventListener('chargingchange', update);
        })
        .catch(() => {
          setIsCharging(false);
        });
    }
  }, []);

  // Contextual options side panel (Touche Triangle △)
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);
  const [optionVisualizerIndex, setOptionVisualizerIndex] = useState<number>(0);

  // Visualizer Mode State & Persistence (Chantier 1 & 2)
  const getSavedVisualizerMode = (): VisualizerMode => {
    try {
      const saved = localStorage.getItem('psp_visualizer_mode');
      if (saved === 'bubbles' || saved === 'matrix' || saved === 'waveform') {
        return saved;
      }
    } catch {}
    return 'bubbles';
  };

  const [visualizerMode, setVisualizerModeState] = useState<VisualizerMode>(getSavedVisualizerMode);

  const setVisualizerMode = useCallback((mode: VisualizerMode) => {
    setVisualizerModeState(mode);
    try {
      localStorage.setItem('psp_visualizer_mode', mode);
    } catch {}
  }, []);

  const cycleVisualizerMode = useCallback(() => {
    sound.playTick();
    const modes: VisualizerMode[] = ['bubbles', 'matrix', 'waveform'];
    const next = modes[(modes.indexOf(visualizerMode) + 1) % modes.length];
    setVisualizerMode(next);
  }, [visualizerMode, setVisualizerMode]);

  // Interpolation fluide à 60 FPS du chronomètre audio (Chantier 3)
  const [smoothTime, setSmoothTime] = useState<number>(currentTime);
  const lastSyncRef = useRef<{ time: number; timestamp: number }>({
    time: currentTime,
    timestamp: performance.now(),
  });

  useEffect(() => {
    lastSyncRef.current = {
      time: currentTime,
      timestamp: performance.now(),
    };
  }, [currentTime]);

  useEffect(() => {
    if (viewMode !== 'player') return;

    let frameId: number;
    const tick = () => {
      if (isPlaying && duration > 0) {
        const delta = (performance.now() - lastSyncRef.current.timestamp) / 1000;
        const current = Math.min(duration, lastSyncRef.current.time + delta);
        setSmoothTime(current);
      } else {
        setSmoothTime(currentTime);
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, duration, currentTime, viewMode]);

  // Search modal state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);

  // Real-time clock & battery
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  // Auto-hide video HUD after 3s of inactivity (Chantier 3)
  const triggerVideoHUD = useCallback(() => {
    setShowVideoHUD(true);
    if (hudTimerRef.current) {
      clearTimeout(hudTimerRef.current);
      hudTimerRef.current = null;
    }
    const isPlaying = videoRef.current ? !videoRef.current.paused : isVideoPlaying;
    if (isPlaying) {
      hudTimerRef.current = setTimeout(() => {
        setShowVideoHUD(false);
      }, 3000);
    }
  }, [isVideoPlaying]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, []);

  // Reset HUD visibility when switching out of video player
  useEffect(() => {
    if (viewMode !== 'video_player') {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setShowVideoHUD(true);
    }
  }, [viewMode]);

  // Synchronize master volume with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Refresh listening history on view change
  useEffect(() => {
    setHistoryTracks(getListeningHistory());
  }, [viewMode, currentTrack]);

  // Clock ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
      setDateStr(`${now.getMonth() + 1}/${now.getDate()}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Strict Official Sony XMB Categories Order:
  // Paramètres ➔ Musique ➔ Vidéo ➔ Jeu ➔ Recherche ➔ Historique
  const categories: XMBCategory[] = [
    {
      id: 'settings',
      name: 'Paramètres',
      icon: 'settings',
      items: [
        { id: 'theme-color', label: 'Thème & Couleurs', sublabel: currentTheme.name, icon: 'theme', type: 'folder' },
        { id: 'sound-toggle', label: 'Bip sonore des touches', sublabel: sound.getMuted() ? 'Désactivé' : 'Activé', icon: 'audio', type: 'action' },
        { id: 'about-psp', label: 'Informations système', sublabel: 'Sony PSP Street E1000 - v6.61', icon: 'info', type: 'action' },
      ],
    },
    {
      id: 'music',
      name: 'Musique',
      icon: 'music',
      items: [
        {
          id: 'music-ms',
          label: 'Memory Stick™',
          sublabel: `${localTracks.length} morceau${localTracks.length > 1 ? 'x' : ''}`,
          icon: 'ms',
          type: 'folder',
        },
        {
          id: 'music-itunes',
          label: 'Extraits iTunes',
          sublabel: `${itunesTracks.length} morceaux`,
          icon: 'music',
          type: 'folder',
        },
        ...(currentTrack
          ? [
              {
                id: 'music-now',
                label: 'Lecture en cours',
                sublabel: `${currentTrack.title} — ${currentTrack.artist}`,
                icon: 'now',
                type: 'action' as const,
              },
            ]
          : []),
      ],
    },
    {
      id: 'video',
      name: 'Vidéo',
      icon: 'video',
      items: [
        { id: 'video-ms', label: 'Memory Stick™ (Vidéos)', sublabel: `${videosList.length} clips MP4`, icon: 'video', type: 'folder' },
      ],
    },
    {
      id: 'game',
      name: 'Jeu',
      icon: 'game',
      items: [
        {
          id: 'game-1',
          label: 'Mini Jeu Rétro',
          sublabel: 'PlayStation Portable Studio • Casse-briques',
          icon: 'game',
          type: 'game' as const,
        },
      ],
    },
    {
      id: 'search',
      name: 'Recherche',
      icon: 'search',
      items: [
        { id: 'search-itunes', label: 'Rechercher sur iTunes...', sublabel: '15 extraits officiels en streaming', icon: 'search', type: 'search' },
        { id: 'search-daft-punk', label: 'Découvrir Daft Punk', sublabel: 'Recherche rapide en 1 clic', icon: 'music', type: 'action' },
      ],
    },
    {
      id: 'history',
      name: 'Historique',
      icon: 'history',
      items: [
        { id: 'history-list', label: 'Dernières pistes écoutées', sublabel: `${historyTracks.length} morceaux enregistrés`, icon: 'history', type: 'folder' },
        { id: 'history-clear', label: 'Effacer l\'historique', sublabel: 'Vider le localStorage', icon: 'info', type: 'action' },
      ],
    },
  ];

  const activeCategory = categories[catIndex] || categories[1];
  const activeItems = activeCategory.items;

  // Active sub-list audio tracks
  const currentSubList: Track[] = (() => {
    if (subListType === 'ms' || subListType === 'music') return localTracks;
    if (subListType === 'itunes') return itunesTracks;
    if (subListType === 'history') return historyTracks;
    if (subListType === 'search_results') return searchResults;
    return localTracks;
  })();

  // Synchroniser la sélection dans la liste avec le morceau en cours de lecture
  useEffect(() => {
    if (currentTrack && currentSubList.length > 0) {
      const idx = currentSubList.findIndex(
        (t) => (t.id && t.id === currentTrack.id) || t.url === currentTrack.url
      );
      if (idx >= 0) {
        setSubItemIndex(idx);
      }
    }
  }, [currentTrack, currentSubList]);

  // State reference to eliminate stale closures in keyboard / external / gamepad commands
  const stateRef = useRef({
    viewMode,
    navStack,
    catIndex,
    itemIndex,
    subItemIndex,
    subListType,
    categories,
    activeItems,
    currentSubList,
    videosList,
    currentVideo,
    isVideoPlaying,
    videoAspectMode,
    gamesList,
    currentGame,
    officialThemesList,
    isOptionsOpen,
    optionVisualizerIndex,
    isSearchModalOpen,
    currentTrack,
    visualizerMode,
  });

  useEffect(() => {
    stateRef.current = {
      viewMode,
      navStack,
      catIndex,
      itemIndex,
      subItemIndex,
      subListType,
      categories,
      activeItems,
      currentSubList,
      videosList,
      currentVideo,
      isVideoPlaying,
      videoAspectMode,
      gamesList,
      currentGame,
      officialThemesList,
      isOptionsOpen,
      optionVisualizerIndex,
      isSearchModalOpen,
      currentTrack,
      visualizerMode,
    };
  });

  // Émission de l'état XMB pour la suite DevTools Staging (Chantier 3)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('psp_xmb_debug', {
          detail: {
            viewMode,
            catIndex,
            itemIndex,
            subItemIndex,
            categoryName: activeCategory?.name || 'Inconnu',
            subListType,
          },
        })
      );
    }
  }, [viewMode, catIndex, itemIndex, subItemIndex, activeCategory, subListType]);

  // Push current frame onto navigation state stack
  const pushState = (
    newView: XMBViewMode,
    nextSubListType?: 'ms' | 'itunes' | 'history' | 'search_results' | 'video' | 'game' | 'theme' | 'music'
  ) => {
    const current = stateRef.current;
    setNavStack((prev) => [
      ...prev,
      {
        view: current.viewMode,
        catIndex: current.catIndex,
        itemIndex: current.itemIndex,
        subItemIndex: current.subItemIndex,
        subListType: current.subListType,
      },
    ]);
    setViewMode(newView);
    if (nextSubListType) setSubListType(nextSubListType);
    setSubItemIndex(0);
    setIsOptionsOpen(false);
    stateRef.current.viewMode = newView;
    if (nextSubListType) stateRef.current.subListType = nextSubListType;
    stateRef.current.subItemIndex = 0;
    stateRef.current.isOptionsOpen = false;
  };

  // Sortie propre et synchrone du mini-jeu (Touche ◯ / Échap) (Chantier 3)
  const handleExitGame = () => {
    try { sound.playBack(); } catch (e) {}
    setViewMode('menu');
    const gameCatIndex = categories.findIndex((c) => c.id === 'game');
    if (gameCatIndex !== -1) {
      setCatIndex(gameCatIndex);
    }
    setItemIndex(0);
    setSubItemIndex(0);
    stateRef.current.viewMode = 'menu';
    stateRef.current.catIndex = gameCatIndex !== -1 ? gameCatIndex : stateRef.current.catIndex;
    stateRef.current.itemIndex = 0;
    stateRef.current.subItemIndex = 0;
    setNavStack([]);
  };

  // Pop state stack (Touche Rond ◯ / Échap / Backspace)
  // Quitte le lecteur pour revenir à la liste XMB SANS COUPER LE SON en arrière-plan
  const popState = () => {
    sound.playBack();
    const current = stateRef.current;

    // Sortie propre et immédiate de l'écran de jeu
    if (current.viewMode === 'game_screen') {
      handleExitGame();
      return;
    }

    // Si le volet latéral d'options est ouvert, le fermer en priorité
    if (current.isOptionsOpen) {
      setIsOptionsOpen(false);
      return;
    }

    if (current.isSearchModalOpen) {
      setIsSearchModalOpen(false);
      return;
    }

    if (infoPopup) {
      setInfoPopup(null);
      return;
    }

    // Si on quitte le lecteur vidéo, on stoppe la vidéo
    if (current.viewMode === 'video_player') {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsVideoPlaying(false);
    }

    // Remonter d'un cran dans l'arborescence (sans couper la musique en arrière-plan)
    if (current.navStack.length > 0) {
      const last = current.navStack[current.navStack.length - 1];
      setNavStack((prev) => prev.slice(0, -1));
      setViewMode(last.view);
      setCatIndex(last.catIndex);
      setItemIndex(last.itemIndex);
      setSubItemIndex(last.subItemIndex);
      if (last.subListType) setSubListType(last.subListType);
      stateRef.current.viewMode = last.view;
      stateRef.current.catIndex = last.catIndex;
      stateRef.current.itemIndex = last.itemIndex;
      stateRef.current.subItemIndex = last.subItemIndex;
      if (last.subListType) stateRef.current.subListType = last.subListType;
    } else if (current.viewMode !== 'menu') {
      setViewMode('menu');
      setItemIndex(0);
      stateRef.current.viewMode = 'menu';
      stateRef.current.itemIndex = 0;
    }
  };

  // Home Button (Reset stack to root XMB, stop any playing video or game)
  const handleHome = () => {
    sound.playBack();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsVideoPlaying(false);
    setNavStack([]);
    setViewMode('menu');
    setItemIndex(0);
    setSubItemIndex(0);
    setIsOptionsOpen(false);
    setIsSearchModalOpen(false);
    setInfoPopup(null);
  };

  // Select Button (Cycle le visualiseur audio dans le lecteur ou le thème officiel dans le menu)
  const handleSelect = () => {
    if (stateRef.current.viewMode === 'player') {
      cycleVisualizerMode();
    } else {
      const themesList = Object.values(PSP_OFFICIAL_THEMES);
      const currIdx = themesList.findIndex((t) => t.id === currentTheme.id);
      const nextTheme = themesList[(currIdx + 1) % themesList.length];
      onThemeChange(nextTheme);
      sound.playTick();
    }
  };

  // Lecture de la vidéo suivante (bouclage catalogue videos.json - Chantier 1 & 2)
  const playNextVideo = useCallback(() => {
    const list = stateRef.current.videosList;
    if (!list || list.length === 0) return;
    const current = stateRef.current.currentVideo;
    const currIdx = current
      ? list.findIndex((v) => v.id === current.id || v.url === current.url)
      : -1;
    const nextIdx = (currIdx + 1) % list.length;
    const nextVideo = list[nextIdx];
    if (nextVideo) {
      setCurrentVideo(nextVideo);
      setIsVideoPlaying(true);
      triggerVideoHUD();
      sound.playTick();
      if (videoRef.current) {
        videoRef.current.src = nextVideo.url;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [triggerVideoHUD]);

  // Lecture de la vidéo précédente (bouclage catalogue videos.json - Chantier 1)
  const playPreviousVideo = useCallback(() => {
    const list = stateRef.current.videosList;
    if (!list || list.length === 0) return;
    const current = stateRef.current.currentVideo;
    const currIdx = current
      ? list.findIndex((v) => v.id === current.id || v.url === current.url)
      : -1;
    const prevIdx = currIdx > 0 ? currIdx - 1 : list.length - 1;
    const prevVideo = list[prevIdx];
    if (prevVideo) {
      setCurrentVideo(prevVideo);
      setIsVideoPlaying(true);
      triggerVideoHUD();
      sound.playTick();
      if (videoRef.current) {
        videoRef.current.src = prevVideo.url;
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [triggerVideoHUD]);

  // Gâchette L : Morceau / Vidéo précédent(e) ou Catégorie Gauche
  const handleTriggerL = () => {
    const s = stateRef.current;
    if (s.viewMode === 'video_player') {
      playPreviousVideo();
      return;
    }
    if (s.viewMode === 'player') {
      sound.playTick();
      previousTrack();
      return;
    }
    handleNav('left');
  };

  // Gâchette R : Morceau / Vidéo suivant(e) ou Catégorie Droite
  const handleTriggerR = () => {
    const s = stateRef.current;
    if (s.viewMode === 'video_player') {
      playNextVideo();
      return;
    }
    if (s.viewMode === 'player') {
      sound.playTick();
      nextTrack();
      return;
    }
    handleNav('right');
  };

  // Refactorisation stricte de la navigation directionnelle selon la logique Sony
  const handleNav = (dir: 'left' | 'right' | 'up' | 'down') => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    // Si le volet d'options est ouvert
    if (s.isOptionsOpen) {
      if (s.viewMode === 'video_player' && (dir === 'left' || dir === 'right')) {
        sound.playTick();
        setVideoAspectMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
        return;
      }
      if (dir === 'up') {
        sound.playTick();
        setOptionVisualizerIndex((prev) => (prev > 0 ? prev - 1 : VISUALIZER_OPTIONS.length - 1));
        return;
      }
      if (dir === 'down') {
        sound.playTick();
        setOptionVisualizerIndex((prev) => (prev < VISUALIZER_OPTIONS.length - 1 ? prev + 1 : 0));
        return;
      }
      if (dir === 'left' || dir === 'right') {
        setIsOptionsOpen(false);
      }
      return;
    }

    // 1. DEDICATED VIDEO PLAYER: Left/Right seeks -5s/+5s, triggers HUD
    if (s.viewMode === 'video_player') {
      triggerVideoHUD();
      if (videoRef.current) {
        if (dir === 'left') {
          sound.playTick();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        } else if (dir === 'right') {
          sound.playTick();
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration || 9999,
            videoRef.current.currentTime + 5
          );
        }
      }
      return;
    }

    // 2. DEDICATED AUDIO PLAYER: Left/Right seeks -5s/+5s
    if (s.viewMode === 'player') {
      if (dir === 'left') {
        sound.playTick();
        seekRelative(-5);
      } else if (dir === 'right') {
        sound.playTick();
        seekRelative(5);
      }
      return;
    }

    // 3. GAME SCREEN: Touches réservées au gameplay
    if (s.viewMode === 'game_screen') {
      return;
    }

    // 4. AU SEIN D'UN SOUS-DOSSIER (SUBLIST)
    if (s.viewMode === 'sublist') {
      if (dir === 'up') {
        sound.playTick();
        const listLength =
          s.subListType === 'game'
            ? s.gamesList.length
            : s.subListType === 'video'
            ? s.videosList.length
            : s.subListType === 'theme'
            ? s.officialThemesList.length
            : s.currentSubList.length;
        setSubItemIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, listLength - 1)));
      } else if (dir === 'down') {
        sound.playTick();
        const listLength =
          s.subListType === 'game'
            ? s.gamesList.length
            : s.subListType === 'video'
            ? s.videosList.length
            : s.subListType === 'theme'
            ? s.officialThemesList.length
            : s.currentSubList.length;
        setSubItemIndex((prev) => (prev < listLength - 1 ? prev + 1 : 0));
      } else if (dir === 'left') {
        popState();
      }
      // INTERDICTION FORMELLE : La flèche Droite ne lance RIEN et ne valide RIEN en sous-dossier !
      return;
    }

    // 5. AU NIVEAU RACINE DU XMB (quand aucun dossier n'est ouvert : viewMode === 'menu')
    if (s.viewMode === 'menu') {
      if (dir === 'left') {
        sound.playTick();
        // Déplace la sélection vers la catégorie horizontale précédente. Ne valide rien.
        setCatIndex((prev) => (prev > 0 ? prev - 1 : s.categories.length - 1));
        setItemIndex(0);
      } else if (dir === 'right') {
        sound.playTick();
        // Déplace la sélection vers la catégorie horizontale suivante. Ne valide rien et n'entre JAMAIS dans un dossier.
        setCatIndex((prev) => (prev < s.categories.length - 1 ? prev + 1 : 0));
        setItemIndex(0);
      } else if (dir === 'up') {
        sound.playTick();
        // Fait défiler verticalement les éléments de la catégorie active
        setItemIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, s.activeItems.length - 1)));
      } else if (dir === 'down') {
        sound.playTick();
        // Fait défiler verticalement les éléments de la catégorie active
        setItemIndex((prev) => (prev < s.activeItems.length - 1 ? prev + 1 : 0));
      }
    }
  };

  // Déclencheur dédié et autonome pour lancer le mini-jeu proprement (Chantier 1 & 2)
  const launchRetroGame = (gameItem?: any) => {
    try { sound.playEnter(); } catch (e) {} // Ne doit jamais bloquer l'exécution
    const targetGame = gameItem || gamesList[0] || { id: 'game-1', title: 'Mini Jeu Rétro' };
    setCurrentGame(targetGame);
    pushState('game_screen', 'game');
  };

  // Touche Croix (✕ / Entrée) : Entrer dans un dossier ou lancer la lecture plein écran
  const handleValidate = (overrideIndex?: number) => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    // Si le volet d'options est ouvert pendant la lecture vidéo, alterner le mode d'affichage
    if (s.isOptionsOpen) {
      if (s.viewMode === 'video_player') {
        sound.playEnter();
        setVideoAspectMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
        return;
      }
      // Valider le visualiseur sélectionné au clavier sans fermer le panneau
      const targetMode = VISUALIZER_OPTIONS[s.optionVisualizerIndex || 0];
      if (targetMode) {
        sound.playEnter();
        setVisualizerMode(targetMode.id);
      }
      return;
    }

    sound.playEnter();

    // 1. In Game Screen: Action handled inside RetroBrickGame
    if (s.viewMode === 'game_screen') {
      return;
    }

    // 2. In Video Player: Toggle Play/Pause
    if (s.viewMode === 'video_player') {
      triggerVideoHUD();
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.warn);
          setIsVideoPlaying(true);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
        }
      }
      return;
    }

    // 3. In Dedicated Audio Player: Toggle Play/Pause
    if (s.viewMode === 'player') {
      togglePlay();
      return;
    }

    // 4. In Sublist: play selected game, video, theme or audio track
    if (s.viewMode === 'sublist') {
      const activeSubIndex = overrideIndex !== undefined ? overrideIndex : s.subItemIndex;
      if (s.subListType === 'theme') {
        const selectedTheme = s.officialThemesList[activeSubIndex];
        if (selectedTheme) {
          onThemeChange(selectedTheme);
          setInfoPopup(`Thème appliqué : ${selectedTheme.name}`);
          setTimeout(() => setInfoPopup(null), 2500);
        }
        return;
      }
      if (s.subListType === 'game') {
        const selectedGame = s.gamesList[activeSubIndex] || s.gamesList[0];
        launchRetroGame(selectedGame);
        return;
      }
      if (s.subListType === 'video') {
        const selectedVideo = s.videosList[activeSubIndex];
        if (selectedVideo) {
          pauseTrack();
          setCurrentVideo(selectedVideo);
          setIsVideoPlaying(true);
          pushState('video_player', 'video');
        }
        return;
      }
      const selectedTrack = s.currentSubList[activeSubIndex];
      if (selectedTrack) {
        playTrack(selectedTrack, s.currentSubList);
        pushState('player', 'music');
      }
      return;
    }

    // 5. In Main XMB Menu (Validation de dossier ou action)
    const activeItemIdx = overrideIndex !== undefined ? overrideIndex : s.itemIndex;
    const currentItem = s.activeItems[activeItemIdx];
    if (!currentItem) return;

    if (currentItem.type === 'folder' || currentItem.id === 'music-ms' || currentItem.id === 'music-itunes') {
      try { sound.playEnter(); } catch (e) {}
      setSubItemIndex(0);
      stateRef.current.subItemIndex = 0;
      let targetType: 'ms' | 'itunes' | 'history' | 'search_results' | 'video' | 'game' | 'theme' | 'music' = 'ms';
      if (currentItem.id === 'music-ms') targetType = 'ms';
      else if (currentItem.id === 'music-itunes') targetType = 'itunes';
      else if (currentItem.id === 'theme-color') targetType = 'theme';
      else if (currentItem.id === 'history-list') targetType = 'history';
      else if (currentItem.id === 'video-ms') targetType = 'video';
      else if (currentItem.id === 'game-ms') targetType = 'game';
      pushState('sublist', targetType);
      return;
    } else if (currentItem.id === 'game-1' || currentItem.type === 'game') {
      const selectedGame = s.gamesList.find((g) => g.id === currentItem.id) || s.gamesList[0] || currentItem;
      launchRetroGame(selectedGame);
      return;
    } else if (currentItem.type === 'search') {
      setIsSearchModalOpen(true);
    } else if (currentItem.id === 'music-now') {
      if (currentTrack) {
        pushState('player', 'music');
      }
    } else if (currentItem.id === 'search-daft-punk') {
      executeSearch('Daft Punk');
    } else if (currentItem.id === 'history-clear') {
      clearListeningHistory();
      setHistoryTracks([]);
      setInfoPopup('Historique effacé avec succès.');
      setTimeout(() => setInfoPopup(null), 2500);
    } else if (currentItem.id === 'sound-toggle') {
      sound.toggleMute();
      setItemIndex((prev) => prev);
    } else {
      setInfoPopup(`${currentItem.label} : ${currentItem.sublabel || 'Disponible sur le système'}`);
      setTimeout(() => setInfoPopup(null), 3000);
    }
  };


  // Touche Triangle (△ / Touche A) : Ouvrir / fermer le volet latéral d'options contextuelles
  const handleOptions = () => {
    sound.playOption();
    if (stateRef.current.viewMode === 'video_player') {
      triggerVideoHUD();
    }
    const nextState = !stateRef.current.isOptionsOpen;
    if (nextState) {
      const currIdx = VISUALIZER_OPTIONS.findIndex((m) => m.id === stateRef.current.visualizerMode);
      setOptionVisualizerIndex(currIdx >= 0 ? currIdx : 0);
    }
    setIsOptionsOpen(nextState);
  };

  // Touche Carré (▢ / Touche Espace) : Déclencher immédiatement la bascule Play / Pause
  const handleSquare = () => {
    const s = stateRef.current;
    if (s.viewMode === 'video_player') {
      sound.playTick();
      triggerVideoHUD();
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.warn);
          setIsVideoPlaying(true);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
        }
      }
      return;
    }

    // Si aucune piste n'a été sélectionnée manuellement par l'utilisateur, ne rien faire
    if (!s.currentTrack) {
      return;
    }

    sound.playTick();
    togglePlay();
  };

  // Execute iTunes Search
  const executeSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    const results = await searchTracks(queryText);
    setSearchResults(results);
    setIsSearching(false);
    setIsSearchModalOpen(false);
    pushState('sublist', 'search_results');
  };

  // External commands listener (from invisible hotspots & gamepad)
  useEffect(() => {
    if (stateRef.current.viewMode === 'game_screen') {
      // Le jeu a le contrôle exclusif de toutes les entrées.
      // XMBMenu ne doit intercepter AUCUNE flèche, AUCUN bouton directionnel.
      return;
    }

    if (!externalCommand) return;
    if (externalCommand.timestamp <= lastProcessedCommandTimestampRef.current) {
      return;
    }
    lastProcessedCommandTimestampRef.current = externalCommand.timestamp;

    const { action } = externalCommand;

    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      handleNav(action);
    } else if (action === 'trigger_l') {
      handleTriggerL();
    } else if (action === 'trigger_r') {
      handleTriggerR();
    } else if (action === 'cross') {
      handleValidate();
    } else if (action === 'circle') {
      popState();
    } else if (action === 'triangle') {
      handleOptions();
    } else if (action === 'square') {
      handleSquare();
    } else if (action === 'home') {
      handleHome();
    } else if (action === 'select') {
      handleSelect();
    } else if (action === 'start') {
      togglePlay();
    } else if (action === 'vol_up') {
      adjustVolume(0.05);
    } else if (action === 'vol_down') {
      adjustVolume(-0.05);
    }
  }, [externalCommand]);

  // Global Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (viewMode === 'game_screen' || stateRef.current.viewMode === 'game_screen') {
        // Le jeu a le contrôle exclusif de toutes les entrées.
        // XMBMenu ne doit intercepter AUCUNE flèche, AUCUN bouton directionnel.
        return;
      }
      if (stateRef.current.isSearchModalOpen && e.target instanceof HTMLInputElement) return;

      const key = e.key.toLowerCase();

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNav('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNav('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNav('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNav('right');
      } else if (key === 'q' || e.key === '[' || (stateRef.current.viewMode !== 'menu' && key === 'a')) {
        e.preventDefault();
        handleTriggerL();
      } else if (key === 'e' || e.key === ']') {
        e.preventDefault();
        handleTriggerR();
      } else if (key === 'x' || e.key === 'Enter') {
        e.preventDefault();
        handleValidate();
      } else if (key === 'o' || e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        popState();
      } else if (key === 'a' || key === 't') {
        e.preventDefault();
        handleOptions();
      } else if (key === 's' || e.key === ' ') {
        e.preventDefault();
        handleSquare();
      } else if (key === 'h' || e.key === 'Home') {
        e.preventDefault();
        handleHome();
      } else if (e.key === 'Tab' || key === 'v') {
        e.preventDefault();
        handleSelect();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden text-white font-['Inter',sans-serif]">
      {/* 1. TOP STATUS BAR (Masquée en mode vidéo pour supprimer tout conflit d'affichage) */}
      {viewMode !== 'video_player' && (
        <div className="absolute top-2 left-3 right-3 flex justify-between items-center z-30 text-[10px] font-medium tracking-wider text-white/80 drop-shadow">
          <div className="flex items-center gap-1.5 text-white/60 text-[9px] uppercase font-mono">
            {viewMode === 'game_screen' ? (
              <span>PSP™ UMD</span>
            ) : viewMode === 'player' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LECTEUR AUDIO
              </span>
            ) : viewMode === 'sublist' ? (
              <span>PSP™ / {activeCategory.name}</span>
            ) : (
              <span>PSP™ XMB</span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Témoin de lecture / Marquee du morceau en cours (Chantier 3) */}
            {currentTrack && viewMode !== 'player' && (
              <div
                onClick={() => pushState('player')}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 cursor-pointer hover:bg-white/20 transition-all max-w-[160px] sm:max-w-[200px] overflow-hidden flex-shrink-0"
                title={`${currentTrack.title} — ${currentTrack.artist} (Ouvrir le lecteur)`}
              >
                <span
                  className={`text-[8.5px] font-bold flex-shrink-0 ${
                    isPlaying ? 'text-emerald-400 animate-pulse' : 'text-white/60'
                  }`}
                >
                  {isPlaying ? '▶' : '❚❚'}
                </span>
                <div className="overflow-hidden whitespace-nowrap flex-1 min-w-0">
                  {currentTrack.title.length + currentTrack.artist.length > 18 ? (
                    <div className="inline-flex animate-marquee">
                      <span className="text-[9px] text-white/90 font-mono pr-6">
                        {currentTrack.title} — {currentTrack.artist}
                      </span>
                      <span className="text-[9px] text-white/90 font-mono pr-6">
                        {currentTrack.title} — {currentTrack.artist}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-white/90 font-mono truncate">
                      {currentTrack.title} — {currentTrack.artist}
                    </span>
                  )}
                </div>
              </div>
            )}
            <span className="font-mono text-white/90 flex-shrink-0">{dateStr}</span>
            <span className="font-mono font-bold text-white flex-shrink-0">{timeStr}</span>

            {/* JAUGE BATTERIE OFFICIELLE SONY PSP À 4 BARRES PLEINES PERMANENTES (Chantier 3) */}
            <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
              {isCharging && (
                <span
                  className="text-[8.5px] text-amber-400 font-bold animate-pulse leading-none"
                  title="Alimentation secteur active"
                >
                  ⚡
                </span>
              )}
              <div className="relative flex items-center">
                {/* Corps rectangulaire découpé en 4 barres pleines */}
                <div className="w-5 h-2.5 border border-white/90 rounded-[1.5px] p-[1px] flex gap-[1px] items-center bg-black/40">
                  {[1, 2, 3, 4].map((bar) => (
                    <div
                      key={bar}
                      className="w-1 h-full rounded-[0.5px] bg-white/95"
                    />
                  ))}
                </div>
                {/* Ergot borne positive à droite */}
                <div className="w-[1.5px] h-1.5 bg-white/80 rounded-r-[0.5px] -ml-[0.5px]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DEDICATED FULLSCREEN GAME ENGINE (RETRO BRICK BREAKER) */}
      {viewMode === 'game_screen' ? (
        <div className="absolute inset-0 z-20 overflow-hidden bg-black animate-fade-in">
          <RetroBrickGame onExit={handleExitGame} externalCommand={externalCommand} />
        </div>
      ) : viewMode === 'video_player' && currentVideo ? (
        /* 3. DEDICATED FULLSCREEN VIDEO PLAYER (LECTEUR VIDÉO MP4 PLEIN ÉCRAN) */
        <div
          className="absolute inset-0 bg-black z-20 flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={() => {
            triggerVideoHUD();
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play().catch(console.warn);
                setIsVideoPlaying(true);
              } else {
                videoRef.current.pause();
                setIsVideoPlaying(false);
              }
            }
          }}
          onMouseMove={triggerVideoHUD}
        >
          {/* Native HTML5 Video with authentic pillarbox / zoom support */}
          <video
            ref={videoRef}
            src={currentVideo.url}
            autoPlay
            playsInline
            className={`w-full h-full ${
              videoAspectMode === 'contain' ? 'object-contain' : 'object-cover'
            } bg-black`}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setVideoProgress({
                  current: videoRef.current.currentTime,
                  duration: videoRef.current.duration || 0,
                });
              }
            }}
            onPlay={() => {
              setIsVideoPlaying(true);
              triggerVideoHUD();
            }}
            onPause={() => {
              setIsVideoPlaying(false);
              setShowVideoHUD(true);
              if (hudTimerRef.current) {
                clearTimeout(hudTimerRef.current);
                hudTimerRef.current = null;
              }
            }}
            onEnded={() => {
              playNextVideo();
            }}
          />

          {/* Barre Supérieure (Top HUD) */}
          <div
            className={`absolute top-0 left-0 right-0 p-3 flex justify-between items-center pointer-events-none bg-gradient-to-b from-black/80 to-transparent z-30 transition-opacity duration-300 ${
              showVideoHUD || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Côté Gauche (Flexbox en ligne) */}
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold border ${
                  isVideoPlaying
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {isVideoPlaying ? 'LECTURE' : 'PAUSE'}
              </span>
              <span className="truncate max-w-[280px] text-white font-medium text-[11px] drop-shadow">
                {currentVideo.title}
              </span>
            </div>

            {/* Côté Droit (Flexbox en ligne avec gap-2) */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-white/80 flex-shrink-0">
              <span className="text-white/70">{dateStr}</span>
              <span className="font-bold text-white">{timeStr}</span>
              {/* Jauge batterie 4 barres pleines permanente avec détection charge (Chantier 3) */}
              <div className="flex items-center gap-1 bg-white/10 px-1 py-0.5 rounded border border-white/20">
                {isCharging && (
                  <span className="text-[8px] text-amber-400 font-bold animate-pulse leading-none">
                    ⚡
                  </span>
                )}
                <div className="relative flex items-center">
                  <div className="w-4 h-2 border border-white/90 rounded-[1px] p-[1px] flex gap-[1px] items-center bg-black/40">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className="w-0.5 h-full rounded-[0.5px] bg-white/95"
                      />
                    ))}
                  </div>
                  <div className="w-[1px] h-1 bg-white/80 rounded-r-[0.5px] -ml-[0.5px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Indicateur Central Play / Pause (uniquement en pause) */}
          {!isVideoPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-25">
              <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white/90 shadow-2xl backdrop-blur-sm animate-fade-in">
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* Barre Inférieure (Bottom HUD) */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent z-30 transition-opacity duration-300 ${
              showVideoHUD || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Ligne 1: Timeline & Timestamps */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-white/80">
              <span className="min-w-[28px] text-right">{formatTime(videoProgress.current)}</span>
              <div className="flex-1 h-1 bg-white/20 rounded overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded transition-all duration-150"
                  style={{
                    width: `${
                      videoProgress.duration > 0
                        ? Math.min(100, (videoProgress.current / videoProgress.duration) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="min-w-[28px]">{formatTime(videoProgress.duration)}</span>
            </div>

            {/* Ligne 2: Aide mémoire touches PSP */}
            <div className="text-[8px] font-mono text-white/50 text-center">
              [L/R] Vidéo Préc./Suiv. • ✕ Play/Pause • ◯ Quitter • ◄/► ±5s
            </div>
          </div>
        </div>
      ) : viewMode === 'player' && currentTrack ? (
        /* 4. DEDICATED AUDIO PLAYER SCREEN (ÉCRAN DE LECTURE DÉDIÉ) */
        <div className="absolute inset-0 pt-7 pb-3 px-5 flex flex-col justify-between z-20 animate-fade-in bg-gradient-to-b from-black/50 via-transparent to-black/70">
          
          {/* BANDEAU SUPÉRIEUR : TYPOGRAPHIE OFFICIELLE SONY SOBRE (Chantier 2) */}
          <div className="w-full flex flex-col gap-0.5 mb-2 flex-shrink-0 min-w-0">
            <h2 className="text-sm font-medium tracking-wide text-white drop-shadow truncate">
              {currentTrack.title}
            </h2>
            <p className="text-white/60 text-xs truncate">
              {currentTrack.artist} — {currentTrack.album}
            </p>
          </div>

          {/* ZONE MÉDIA CENTRALE (POCHETTE + GRAND VISUALISEUR H-28) */}
          <div className="flex flex-row items-center gap-4 w-full flex-1 my-auto min-h-0">
            {/* À gauche : La pochette d'album ou fallback vinyle/UMD sombre */}
            <div className="relative w-28 h-28 flex-shrink-0 rounded-md overflow-hidden shadow-lg border border-white/10 group bg-zinc-900 flex items-center justify-center">
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white/30">
                <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeDasharray="2 2" />
                </svg>
                <span className="text-[8px] font-mono mt-1 text-white/40">AUDIO</span>
              </div>
              {currentTrack.artworkUrl && currentTrack.artworkUrl.trim() !== '' && (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  className={`relative z-10 w-full h-full object-cover transition-transform duration-700 ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10 pointer-events-none z-20"></div>
            </div>

            {/* À droite : Le grand visualiseur audio qui prend la même hauteur que la pochette (h-28) */}
            <div className="flex-1 h-28 bg-black/50 backdrop-blur-sm rounded-lg p-1.5 border border-white/15 shadow-inner overflow-hidden flex items-center justify-center">
              <AudioVisualizer isPlaying={isPlaying} mode={visualizerMode} analyser={analyser} isRealDSP={isRealDSP} />
            </div>
          </div>

          {/* TIMELINE ET BARRE DE COMMANDES ÉPURÉE SANS DOUBLON */}
          <div className="w-full mt-auto mb-0.5 flex flex-col gap-1 flex-shrink-0">
            <div className="flex justify-between items-center text-[9px] font-mono text-white/70">
              <span className="text-white/95 font-bold tracking-wider">{formatTime(smoothTime)}</span>
              <span className="text-white/50 tracking-wider">{formatTime(duration)}</span>
            </div>
            {/* Beveled Translucent Timeline with Glowing Playhead Pin */}
            <div className="relative w-full h-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-inner flex items-center">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.45)]"
                style={{ width: `${Math.min(100, (smoothTime / (duration || 30)) * 100)}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border border-cyan-400 shadow-[0_0_8px_#38bdf8] pointer-events-none"
                style={{ left: `${Math.min(100, Math.max(0, (smoothTime / (duration || 30)) * 100))}%` }}
              />
            </div>
            {/* Barre de commandes officielle unique et discrète */}
            <div className="text-[8px] font-mono text-white/60 text-center mt-1 tracking-wider">
              [L/R] Piste Préc./Suiv. • ✕ Pause • ◯ Retour • SELECT Visualiseur
            </div>
          </div>
        </div>
      ) : (
        /* 5. XMB DUAL-AXIS MENU (Catégories Horizontales + Items Verticaux) */
        <>
          {/* Horizontal Categories Bar */}
          <div
            className="absolute top-8 left-0 right-0 h-16 flex items-center z-10 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(calc(120px - ${catIndex * 84}px))`,
            }}
          >
            {categories.map((cat, idx) => {
              const isActive = idx === catIndex;
              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    if (idx !== catIndex) {
                      sound.playTick();
                      setCatIndex(idx);
                      setItemIndex(0);
                      setViewMode('menu');
                    }
                  }}
                  className={`w-20 flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                    isActive ? 'scale-110 opacity-100' : 'scale-90 opacity-40 hover:opacity-70'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-300 ${
                      isActive ? 'shadow-[0_0_24px_rgba(255,255,255,0.45)]' : ''
                    }`}
                  >
                    <CategoryIcon type={cat.icon} active={isActive} />
                  </div>
                  {isActive && (
                    <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-white drop-shadow">
                      {cat.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Vertical Items Column */}
          <div className="absolute left-[108px] top-26 bottom-8 w-[370px] z-10 transition-all duration-300 ease-out overflow-hidden">
            {viewMode === 'menu' ? (
              // Main Category Items List
              <div
                className="flex flex-col transition-transform duration-250 ease-out"
                style={{
                  transform: `translateY(calc(30px - ${itemIndex * 46}px))`,
                }}
              >
                {activeItems.map((item, idx) => {
                  const isSelected = idx === itemIndex;
                  const isGame = item.id === 'game-1' || item.type === 'game';
                  return (
                    <div
                      key={item.id}
                      onPointerDown={(e) => {
                        if (isGame) {
                          e.stopPropagation();
                          setItemIndex(idx);
                          stateRef.current.itemIndex = idx;
                          launchRetroGame(item);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemIndex(idx);
                        stateRef.current.itemIndex = idx;
                        if (item.type === 'folder' || item.id === 'music-ms' || item.id === 'music-itunes') {
                          try { sound.playEnter(); } catch (err) {}
                          setSubItemIndex(0);
                          stateRef.current.subItemIndex = 0;
                          let targetType: 'ms' | 'itunes' | 'history' | 'search_results' | 'video' | 'game' | 'theme' | 'music' = 'ms';
                          if (item.id === 'music-ms') targetType = 'ms';
                          else if (item.id === 'music-itunes') targetType = 'itunes';
                          else if (item.id === 'theme-color') targetType = 'theme';
                          else if (item.id === 'history-list') targetType = 'history';
                          else if (item.id === 'video-ms') targetType = 'video';
                          else if (item.id === 'game-ms') targetType = 'game';
                          pushState('sublist', targetType);
                        } else if (isGame) {
                          launchRetroGame(item);
                        } else {
                          handleValidate(idx);
                        }
                      }}
                      className={`h-11 flex items-center px-3 gap-3 rounded-lg cursor-pointer select-none transition-all duration-200 ${
                        isGame ? 'relative z-30' : ''
                      } ${
                        isSelected
                          ? 'bg-gradient-to-r from-white/25 via-white/10 to-transparent border-l-3 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                          : 'opacity-40 hover:opacity-75'
                      }`}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-white/10 text-white flex-shrink-0">
                        {item.type === 'folder' ? (
                          '📁'
                        ) : item.type === 'search' ? (
                          '🔍'
                        ) : item.icon === 'game' ? (
                          '🎮'
                        ) : (
                          '🎵'
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-semibold truncate text-white drop-shadow">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="text-[9px] text-white/70 truncate">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Sublist View (Memory Stick, Search Results, History, Videos, Games, Theme)
              <div
                className="flex flex-col transition-transform duration-250 ease-out"
                style={{
                  transform: `translateY(calc(30px - ${subItemIndex * 48}px))`,
                }}
              >
                {/* 1. Theme Color Chooser (Paramètres ➔ Thème & Couleurs) */}
                {subListType === 'theme' ? (
                  officialThemesList.map((t, idx) => {
                    const isSelected = idx === subItemIndex;
                    const isActiveTheme = currentTheme.id === t.id;
                    return (
                      <div
                        key={t.id || idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubItemIndex(idx);
                          stateRef.current.subItemIndex = idx;
                          onThemeChange(t);
                          sound.playEnter();
                          setInfoPopup(`Thème appliqué : ${t.name}`);
                          setTimeout(() => setInfoPopup(null), 2500);
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'opacity-45 hover:opacity-75'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 shadow border-2 border-white/40 flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${t.bgGradient[0]}, ${t.bgGradient[1]})`,
                          }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: t.waveColor1 }}
                          />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold truncate text-white drop-shadow">
                              {t.name}
                            </span>
                            {isActiveTheme && (
                              <span className="text-[8px] px-1 rounded bg-emerald-500/80 text-black font-mono font-bold flex-shrink-0">
                                ACTIF
                              </span>
                            )}
                          </div>
                          <span className="text-[8.5px] text-white/70 font-mono">
                            Vagues dynamiques Canvas
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : subListType === 'game' ? (
                  // Games list from src/data/games.json
                  gamesList.map((game, idx) => {
                    const isSelected = idx === subItemIndex;
                    return (
                      <div
                        key={game.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSubItemIndex(idx);
                          stateRef.current.subItemIndex = idx;
                          launchRetroGame(game);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubItemIndex(idx);
                          stateRef.current.subItemIndex = idx;
                          launchRetroGame(game);
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer select-none relative z-30 transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'opacity-45 hover:opacity-75'
                        }`}
                      >
                        <div className="relative w-12 h-8 rounded overflow-hidden flex-shrink-0 shadow border border-white/20 bg-gradient-to-br from-[#132219] via-[#0d1712] to-black flex items-center justify-center">
                          <CategoryIcon type="game" active={isSelected} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold truncate text-white drop-shadow">
                              {game.title}
                            </span>
                            <span className="text-[8px] px-1 rounded bg-emerald-500/80 text-black font-mono font-bold flex-shrink-0">
                              UMD™
                            </span>
                          </div>
                          <span className="text-[9px] text-white/75 truncate">
                            {game.publisher || 'SCE'} • {game.genre || 'Arcade'} • {game.size || '14 MB'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : subListType === 'video' ? (
                  // Vidéos list ou état neutre si vide
                  videosList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-2.5 shadow-inner">
                        <CategoryIcon type="video" active={false} />
                      </div>
                      <span className="text-[12px] font-bold text-white/80">Il n'y a pas de vidéos</span>
                      <span className="text-[9px] text-white/40 mt-1 max-w-[200px]">
                        Glisse tes fichiers MP4 dans le dossier public/videos/
                      </span>
                    </div>
                  ) : (
                    videosList.map((video, idx) => {
                      const isSelected = idx === subItemIndex;
                      return (
                        <div
                          key={video.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubItemIndex(idx);
                            stateRef.current.subItemIndex = idx;
                            handleValidate(idx);
                          }}
                          className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                              : 'opacity-45 hover:opacity-75'
                          }`}
                        >
                          {/* Miniature visuelle dynamique (Image ou frame vidéo native #t=1) */}
                          <div className="relative w-14 h-9 rounded overflow-hidden flex-shrink-0 shadow border border-white/20 bg-black/40 flex items-center justify-center">
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-14 h-9 object-cover rounded"
                              />
                            ) : (
                              <video
                                src={`${video.url}#t=1`}
                                preload="metadata"
                                muted
                                playsInline
                                className="w-14 h-9 object-cover rounded pointer-events-none bg-black/40 border border-white/10"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                              <span className="text-[8px] text-white/90 drop-shadow">▶</span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold truncate text-white drop-shadow">
                                {video.title}
                              </span>
                              {video.sizeDisplay && (
                                <span className="text-[7.5px] px-1 py-0.2 rounded bg-white/10 text-cyan-300 font-mono border border-cyan-400/30 flex-shrink-0">
                                  {video.sizeDisplay}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-white/75 truncate">
                              {video.artist || 'Sélection Personnelle'} • {video.codec || 'MPEG-4'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : currentSubList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-2.5 shadow-inner">
                      <CategoryIcon type="music" active={false} />
                    </div>
                    <span className="text-[12px] font-bold text-white/80">Il n'y a pas de morceaux</span>
                    <span className="text-[9px] text-white/40 mt-1 max-w-[220px]">
                      {subListType === 'ms'
                        ? 'Glisse tes fichiers MP3/M4A/WAV dans public/audio/'
                        : 'Aucun morceau disponible.'}
                    </span>
                  </div>
                ) : (
                  currentSubList.map((track, idx) => {
                    const isSelected = idx === subItemIndex;
                    const isCurrent = currentTrack?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubItemIndex(idx);
                          stateRef.current.subItemIndex = idx;
                          handleValidate(idx);
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-emerald-400 shadow-[0_0_20px_rgba(78,205,196,0.3)]'
                            : 'opacity-45 hover:opacity-75'
                        }`}
                      >
                        {track.artworkUrl && track.artworkUrl.trim() !== '' ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            className="w-8 h-8 rounded object-cover flex-shrink-0 shadow border border-white/20"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-900 border border-white/20 flex items-center justify-center flex-shrink-0 text-white/40">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="9" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold truncate text-white drop-shadow">
                              {track.title}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] px-1 rounded bg-emerald-500/80 text-white font-mono">
                                {isPlaying ? 'PLAY' : 'PAUSE'}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-white/75 truncate">
                            {track.artist} • {track.album}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 6. SEARCH MODAL DIALOG */}
      {isSearchModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-xs bg-gradient-to-b from-[#252a34] to-[#12161f] border border-white/30 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
              <span className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
                <span>🔍</span> RECHERCHER SUR ITUNES
              </span>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="text-white/60 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/10"
              >
                ✕
              </button>
            </div>
            <p className="text-[9px] text-white/60 mb-2">
              Saisis un artiste ou un titre (15 extraits officiels 30s) :
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(searchQuery);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                autoFocus
                placeholder="Ex: Sade, Daft Punk, Nirvana..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-black/50 border border-white/25 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition"
              >
                {isSearching ? '...' : 'OK'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. VOLET LATÉRAL D'OPTIONS CONTEXTUELLES (Touche Triangle △ / A) */}
      {isOptionsOpen && (
        <div className="absolute top-0 right-0 bottom-0 w-72 bg-zinc-950/75 backdrop-blur-2xl border-l border-white/10 p-5 flex flex-col justify-between text-white shadow-2xl z-40 select-none animate-fade-in">
          <div>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-4">
              Options
            </h3>

            {/* Context details */}
            <div className="flex flex-col gap-3.5 text-xs">
              {viewMode === 'player' && currentTrack ? (
                <>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Titre</span>
                    <span className="text-sm font-medium text-white truncate block">{currentTrack.title}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Artiste</span>
                    <span className="text-xs text-white/80 truncate block">{currentTrack.artist}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-1">Format / Échantillonnage</span>
                    <span className="inline-block px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-emerald-400">
                      AAC • 256kbps • 44.1kHz
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-2">Visualiseur Audio</span>
                    <div className="flex flex-col gap-1.5">
                      {VISUALIZER_OPTIONS.map((m, idx) => {
                        const isActive = visualizerMode === m.id;
                        const isFocused = optionVisualizerIndex === idx;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              sound.playEnter();
                              setVisualizerMode(m.id);
                              setOptionVisualizerIndex(idx);
                            }}
                            className={`transition-all ${
                              isActive
                                ? 'text-xs text-white bg-white/15 border border-white/20 font-medium rounded-xl px-3 py-2 flex items-center justify-between'
                                : isFocused
                                ? 'text-xs text-white bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center justify-between'
                                : 'text-xs text-white/60 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition-all flex items-center justify-between'
                            }`}
                          >
                            <span>{m.label}</span>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : viewMode === 'video_player' && currentVideo ? (
                <>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Clip Vidéo</span>
                    <span className="text-sm font-medium text-white truncate block">{currentVideo.title}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-1.5">Format écran</span>
                    <div
                      onClick={() => {
                        sound.playEnter();
                        setVideoAspectMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                      }}
                      className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 cursor-pointer transition-all"
                    >
                      <span
                        className={`flex-1 text-center py-1 rounded-lg text-[10px] font-medium transition-all ${
                          videoAspectMode === 'contain'
                            ? 'bg-white/20 text-white font-semibold shadow'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Normal (4:3 / 16:9)
                      </span>
                      <span
                        className={`flex-1 text-center py-1 rounded-lg text-[10px] font-medium transition-all ${
                          videoAspectMode === 'cover'
                            ? 'bg-white/20 text-white font-semibold shadow'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Plein écran (Zoom)
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Rendu actif</span>
                    <span className="text-cyan-300 font-mono text-[11px]">
                      {videoAspectMode === 'contain' ? 'Pillarbox Original' : 'Zoom Étendu 16:9'}
                    </span>
                  </div>
                </>
              ) : currentTrack ? (
                <>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Lecture en cours</span>
                    <span className="text-sm font-medium text-white truncate block">{currentTrack.title}</span>
                    <span className="text-xs text-white/70 truncate block">{currentTrack.artist}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-1">Format / Échantillonnage</span>
                    <span className="inline-block px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-emerald-400">
                      AAC • 256kbps • 44.1kHz
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-2">Visualiseur Audio</span>
                    <div className="flex flex-col gap-1.5">
                      {VISUALIZER_OPTIONS.map((m, idx) => {
                        const isActive = visualizerMode === m.id;
                        const isFocused = optionVisualizerIndex === idx;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              sound.playEnter();
                              setVisualizerMode(m.id);
                              setOptionVisualizerIndex(idx);
                            }}
                            className={`transition-all ${
                              isActive
                                ? 'text-xs text-white bg-white/15 border border-white/20 font-medium rounded-xl px-3 py-2 flex items-center justify-between'
                                : isFocused
                                ? 'text-xs text-white bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center justify-between'
                                : 'text-xs text-white/60 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition-all flex items-center justify-between'
                            }`}
                          >
                            <span>{m.label}</span>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Système</span>
                    <span className="text-sm font-medium text-white block">Sony PSP Street</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Firmware</span>
                    <span className="text-white/70 font-mono text-xs">v6.61 (Authentique)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Catégorie active</span>
                    <span className="text-white/80 text-xs block">{activeCategory.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-mono mb-0.5">Volume principal</span>
                    <span className="text-emerald-400 font-mono text-xs">{Math.round(volume * 30)} / 30</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="text-[10px] text-white/40 tracking-wider font-mono text-center pt-3 border-t border-white/5">
            [△ / ◯] Fermer • [✕] Sélectionner
          </p>
        </div>
      )}

      {/* 8. INFO POPUP NOTIFICATION */}
      {infoPopup && (
        <div className="absolute top-12 right-4 max-w-xs bg-black/90 backdrop-blur-md border border-white/25 rounded-xl p-2.5 text-[10px] text-white shadow-2xl z-40 animate-fade-in whitespace-pre-line">
          {infoPopup}
        </div>
      )}

      {/* 9. BOTTOM CONTROLS BAR (Calée au bas de l'écran LCD, masquée en lecteur vidéo, audio et jeu - Chantier 2) */}
      {viewMode !== 'video_player' && viewMode !== 'player' && viewMode !== 'game_screen' && (
        <div className="absolute bottom-1 left-3 right-3 flex items-center justify-between text-[8.5px] text-white/60 font-medium z-30 pointer-events-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>Valider / Entrer</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Retour</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="square" size={11} />
              <span>Play / Pause</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="triangle" size={11} />
              <span>Options</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
