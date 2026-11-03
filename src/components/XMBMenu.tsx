import React, { useState, useEffect, useRef } from 'react';
import { XMBCategory, Track, VideoItem, GameItem, PSPTheme, PSP_MONTHLY_THEMES } from '../types/xmb';
import { CategoryIcon, PSGlyph, SensMeIcon } from './XMBIcons';
import {
  NOSTALGIC_PSP_TRACKS,
  SENSME_PLAYLISTS,
  searchTracks,
  getListeningHistory,
  clearListeningHistory,
} from '../services/itunes';
import videosData from '../data/videos.json';
import gamesData from '../data/games.json';
import { sound } from '../services/sound';
import { useAudio } from './AudioEngine';
import { AudioVisualizer } from './AudioVisualizer';

export type XMBViewMode = 'menu' | 'sublist' | 'player' | 'video_player' | 'game_screen';

interface NavigationFrame {
  view: XMBViewMode;
  catIndex: number;
  itemIndex: number;
  subItemIndex: number;
  subListType?: 'ms' | 'sensme' | 'history' | 'search_results' | 'video' | 'game';
}

interface XMBMenuProps {
  currentTheme: PSPTheme;
  onThemeChange: (theme: PSPTheme) => void;
  externalCommand?: { action: string; timestamp: number } | null;
}

export const XMBMenu: React.FC<XMBMenuProps> = ({
  currentTheme,
  onThemeChange,
  externalCommand,
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playTrack,
    pauseTrack,
    togglePlay,
    seekRelative,
  } = useAudio();

  // Navigation View & Stack
  const [viewMode, setViewMode] = useState<XMBViewMode>('menu');
  const [navStack, setNavStack] = useState<NavigationFrame[]>([]);

  // Navigation Coordinates
  const [catIndex, setCatIndex] = useState<number>(1); // Default to 'Music' (index 1)
  const [itemIndex, setItemIndex] = useState<number>(0); // Default to 'Memory Stick™'
  const [subItemIndex, setSubItemIndex] = useState<number>(0);
  const [subListType, setSubListType] = useState<
    'ms' | 'sensme' | 'history' | 'search_results' | 'video' | 'game'
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Games state
  const [gamesList] = useState<GameItem[]>(gamesData as GameItem[]);
  const [currentGame, setCurrentGame] = useState<GameItem | null>(null);

  // Dynamic tracks state
  const [nostalgicTracks] = useState<Track[]>(NOSTALGIC_PSP_TRACKS);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // Contextual options side panel (Touche Triangle)
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);

  // Search modal state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);

  // Real-time clock & battery
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  // Auto-hide video HUD after 3.5s of inactivity
  const triggerVideoHUD = () => {
    setShowVideoHUD(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowVideoHUD(false);
    }, 3500);
  };

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

  // Strict 6-Category XMB Hierarchy (Paramètres, Musique, Jeu, Vidéo, Recherche, Historique)
  const categories: XMBCategory[] = [
    {
      id: 'settings',
      name: 'Paramètres',
      icon: 'settings',
      items: [
        { id: 'theme-color', label: 'Couleur du thème', sublabel: currentTheme.name, icon: 'theme', type: 'setting' },
        { id: 'sound-toggle', label: 'Bip sonore des touches', sublabel: sound.getMuted() ? 'Désactivé' : 'Activé', icon: 'audio', type: 'action' },
        { id: 'about-psp', label: 'Informations système', sublabel: 'Sony PSP Street E1000 - v6.61', icon: 'info', type: 'action' },
      ],
    },
    {
      id: 'music',
      name: 'Musique',
      icon: 'music',
      items: [
        { id: 'music-ms', label: 'Memory Stick™', sublabel: `${nostalgicTracks.length} morceaux`, icon: 'ms', type: 'folder' },
        { id: 'music-sensme', label: 'SensMe™ channels', sublabel: 'Playlists Relax & Énergie', icon: 'sensme', type: 'folder' },
        { id: 'music-now', label: 'Lecture en cours', sublabel: currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'Ouvrir l\'écran lecteur', icon: 'now', type: 'action' },
      ],
    },
    {
      id: 'game',
      name: 'Jeu',
      icon: 'game',
      items: [
        { id: 'game-ms', label: 'Memory Stick™ (Jeux)', sublabel: `${gamesList.length} titre UMD`, icon: 'game', type: 'folder' },
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
    if (subListType === 'ms') return nostalgicTracks;
    if (subListType === 'sensme') return [...SENSME_PLAYLISTS.relax, ...SENSME_PLAYLISTS.energetic];
    if (subListType === 'history') return historyTracks;
    if (subListType === 'search_results') return searchResults;
    return nostalgicTracks;
  })();

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
    gamesList,
    currentGame,
    isOptionsOpen,
    isSearchModalOpen,
    currentTrack,
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
      gamesList,
      currentGame,
      isOptionsOpen,
      isSearchModalOpen,
      currentTrack,
    };
  });

  // Push current frame onto navigation state stack
  const pushState = (
    newView: XMBViewMode,
    nextSubListType?: 'ms' | 'sensme' | 'history' | 'search_results' | 'video' | 'game'
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
  };

  // Pop state stack (Touche Rond ◯ / Échap / Backspace)
  // Quitte le lecteur pour revenir à la liste XMB SANS COUPER LE SON en arrière-plan
  const popState = () => {
    sound.playBack();
    const current = stateRef.current;

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
    } else if (current.viewMode !== 'menu') {
      setViewMode('menu');
      setItemIndex(0);
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

  // Refactorisation stricte de la navigation directionnelle selon la logique Sony
  const handleNav = (dir: 'left' | 'right' | 'up' | 'down') => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    // Si le volet d'options est ouvert, fermer avec gauche/droite
    if (s.isOptionsOpen) {
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
      sound.playTick();
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
            : s.currentSubList.length;
        setSubItemIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, listLength - 1)));
      } else if (dir === 'down') {
        sound.playTick();
        const listLength =
          s.subListType === 'game'
            ? s.gamesList.length
            : s.subListType === 'video'
            ? s.videosList.length
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

  // Touche Croix (✕ / Entrée) : Entrer dans un dossier ou lancer la lecture plein écran
  const handleValidate = () => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    sound.playEnter();

    // 1. In Game Screen: Action / trigger feedback
    if (s.viewMode === 'game_screen') {
      setInfoPopup('Démarrage du Mini-Jeu Rétro...\nPrêt pour intégration Canvas / iframe externe.');
      setTimeout(() => setInfoPopup(null), 2500);
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

    // 4. In Sublist: play selected game, video, or audio track
    if (s.viewMode === 'sublist') {
      if (s.subListType === 'game') {
        const selectedGame = s.gamesList[s.subItemIndex];
        if (selectedGame) {
          pauseTrack();
          setCurrentGame(selectedGame);
          pushState('game_screen', 'game');
        }
        return;
      }
      if (s.subListType === 'video') {
        const selectedVideo = s.videosList[s.subItemIndex];
        if (selectedVideo) {
          pauseTrack();
          setCurrentVideo(selectedVideo);
          setIsVideoPlaying(true);
          pushState('video_player', 'video');
        }
        return;
      }
      const selectedTrack = s.currentSubList[s.subItemIndex];
      if (selectedTrack) {
        playTrack(selectedTrack);
        pushState('player');
      }
      return;
    }

    // 5. In Main XMB Menu (Validation de dossier ou action)
    const currentItem = s.activeItems[s.itemIndex];
    if (!currentItem) return;

    if (currentItem.type === 'folder') {
      let targetType: 'ms' | 'sensme' | 'history' | 'video' | 'game' = 'ms';
      if (currentItem.id === 'music-sensme') targetType = 'sensme';
      if (currentItem.id === 'history-list') targetType = 'history';
      if (currentItem.id === 'video-ms') targetType = 'video';
      if (currentItem.id === 'game-ms') targetType = 'game';
      pushState('sublist', targetType);
    } else if (currentItem.type === 'search') {
      setIsSearchModalOpen(true);
    } else if (currentItem.id === 'music-now') {
      if (currentTrack) {
        pushState('player');
      } else if (nostalgicTracks.length > 0) {
        playTrack(nostalgicTracks[0]);
        pushState('player');
      }
    } else if (currentItem.id === 'search-daft-punk') {
      executeSearch('Daft Punk');
    } else if (currentItem.id === 'history-clear') {
      clearListeningHistory();
      setHistoryTracks([]);
      setInfoPopup('Historique effacé avec succès.');
      setTimeout(() => setInfoPopup(null), 2500);
    } else if (currentItem.id === 'theme-color') {
      const nextMonth = (currentTheme.month % 12) + 1;
      onThemeChange(PSP_MONTHLY_THEMES[nextMonth]);
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
    setIsOptionsOpen((prev) => !prev);
  };

  // Touche Carré (▢ / Touche Espace) : Déclencher immédiatement la bascule Play / Pause
  const handleSquare = () => {
    sound.playTick();
    const s = stateRef.current;
    if (s.viewMode === 'video_player') {
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

    // Bascule Play / Pause audio immédiate partout (lecteur, menu ou sous-dossier)
    if (s.currentTrack) {
      togglePlay();
    } else if (nostalgicTracks.length > 0) {
      playTrack(nostalgicTracks[0]);
    }
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
    if (!externalCommand) return;
    const { action } = externalCommand;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      handleNav(action);
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
    }
  }, [externalCommand]);

  // Global Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      } else if (key === 'x' || e.key === 'Enter') {
        e.preventDefault();
        handleValidate();
      } else if (key === 'o' || e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        popState();
      } else if (key === 'a') {
        e.preventDefault();
        handleOptions();
      } else if (key === 's' || e.key === ' ') {
        e.preventDefault();
        handleSquare();
      } else if (key === 'h' || e.key === 'Home') {
        e.preventDefault();
        handleHome();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden text-white font-['Inter',sans-serif]">
      {/* 1. TOP STATUS BAR */}
      <div className="absolute top-2 left-3 right-3 flex justify-between items-center z-30 text-[10px] font-medium tracking-wider text-white/80 drop-shadow">
        <div className="flex items-center gap-1.5 text-white/60 text-[9px] uppercase font-mono">
          {viewMode === 'game_screen' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              UMD™ GAME
            </span>
          ) : viewMode === 'video_player' ? (
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              LECTEUR VIDÉO UMD
            </span>
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

        <div className="flex items-center gap-2.5">
          {isPlaying && viewMode !== 'player' && (
            <div
              onClick={() => pushState('player')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 cursor-pointer hover:bg-white/20 animate-pulse"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[9px] text-emerald-300 font-mono">PLAY</span>
            </div>
          )}
          <span className="font-mono text-white/90">{dateStr}</span>
          <span className="font-mono font-bold text-white">{timeStr}</span>

          {/* 3-Segment PSP Battery Indicator */}
          <div className="flex items-center gap-1 bg-white/10 px-1 py-0.5 rounded border border-white/20">
            <div className="w-3.5 h-1.5 border border-white/90 rounded-[1px] p-[1px] flex gap-[1px]">
              <div className="bg-white/95 w-1 h-full rounded-[0.5px]"></div>
              <div className="bg-white/95 w-1 h-full rounded-[0.5px]"></div>
              <div className="bg-white/95 w-1 h-full rounded-[0.5px]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED FULLSCREEN GAME VIEWPORT (#psp-screen) */}
      {viewMode === 'game_screen' && currentGame ? (
        <div
          id="psp-game-viewport"
          className="absolute inset-0 bg-[#07090e] z-20 flex flex-col justify-between p-4 overflow-hidden animate-fade-in"
        >
          {/* Retro arcade grid & horizon scanlines */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.15),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.35)_51%)] bg-[length:100%_4px] pointer-events-none opacity-50" />

          {/* Top Game Bar */}
          <div className="relative z-10 flex items-center justify-between border-b border-emerald-500/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono text-[9px] font-bold text-emerald-400 tracking-wider">
                UMD™ GAME INSERTED
              </span>
            </div>
            <span className="font-mono text-[8px] text-white/50">
              PSP™ Street E1000 • v6.61
            </span>
          </div>

          {/* Main Game Showcase */}
          <div className="relative z-10 flex items-center justify-center gap-6 my-auto">
            {/* Retro UMD Game Cartridge Visual */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-black to-slate-900 border-2 border-emerald-400/40 shadow-[0_0_30px_rgba(16,185,129,0.25)] flex flex-col items-center justify-center p-2 relative">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400/60 flex items-center justify-center bg-emerald-500/10 mb-1">
                <CategoryIcon type="game" active={true} />
              </div>
              <span className="text-[7.5px] font-mono font-bold text-emerald-300 uppercase tracking-wider text-center">
                UMD™ DISC
              </span>
            </div>

            {/* Game Metadata & Ready Badge */}
            <div className="flex flex-col max-w-[270px]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[7.5px] font-bold">
                  {currentGame.genre || 'ARCADE'}
                </span>
                <span className="text-[8px] font-mono text-white/40">
                  {currentGame.size || '14.2 MB'}
                </span>
              </div>
              <h2 className="text-[15px] font-bold text-white drop-shadow">
                {currentGame.title}
              </h2>
              <p className="text-[10px] text-white/70 font-medium mb-2.5">
                {currentGame.description || currentGame.sublabel || 'Mini-jeu d\'arcade rétro PSP'}
              </p>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-md bg-white/10 border border-white/20 text-[9px] text-white/90 font-mono flex items-center gap-1.5 shadow-sm">
                  <span>🎮</span> Appuyer sur <b className="text-blue-400">✕</b> pour interagir
                </div>
              </div>
            </div>
          </div>

          {/* Canvas container slot for future interactive game engines / iframes */}
          <div id="psp-game-canvas" className="hidden" />

          {/* Bottom Prompt Bar */}
          <div className="relative z-10 flex items-center justify-between text-[8px] font-mono text-white/50 border-t border-white/10 pt-2">
            <span>PlayStation Portable • Moteur de jeu interactif</span>
            <span>Appuyer sur ◯ pour quitter le jeu</span>
          </div>
        </div>
      ) : viewMode === 'video_player' && currentVideo ? (
        /* 3. DEDICATED FULLSCREEN VIDEO PLAYER (LECTEUR VIDÉO MP4 PLEIN ÉCRAN) */
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center overflow-hidden">
          {/* Native HTML5 16:9 Video with object-cover */}
          <video
            ref={videoRef}
            src={currentVideo.url}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-black"
            onTimeUpdate={() => {
              if (videoRef.current) {
                setVideoProgress({
                  current: videoRef.current.currentTime,
                  duration: videoRef.current.duration || 0,
                });
              }
            }}
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            onEnded={() => {
              setIsVideoPlaying(false);
              triggerVideoHUD();
            }}
          />

          {/* Authentic PSP Video Player HUD Overlay */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-3 pointer-events-none transition-opacity duration-300 ${
              showVideoHUD || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Top Video Header */}
            <div className="flex justify-between items-center bg-gradient-to-b from-black/80 via-black/40 to-transparent p-2 rounded-t-lg -mx-3 -mt-3">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-[8px] font-bold">
                  {isVideoPlaying ? 'LECTURE' : 'PAUSE'}
                </span>
                <span className="text-[11px] font-bold text-white drop-shadow truncate max-w-[280px]">
                  {currentVideo.title}
                </span>
              </div>
              <span className="text-[8px] font-mono text-white/50">
                {currentVideo.codec || 'MPEG-4 AVC'}
              </span>
            </div>

            {/* Center Play/Pause indicator when paused */}
            {!isVideoPlaying && (
              <div className="self-center flex items-center justify-center w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white/80 shadow-2xl backdrop-blur-sm">
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}

            {/* Bottom Progress & Video Controls Bar */}
            <div className="bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 rounded-b-lg -mx-3 -mb-3 flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] font-mono text-white/80">
                <span>
                  {Math.floor(videoProgress.current / 60)}:
                  {String(Math.floor(videoProgress.current % 60)).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-white/50">
                  {currentVideo.artist || 'Sélection Personnelle'}
                </span>
                <span>
                  {Math.floor(videoProgress.duration / 60)}:
                  {String(Math.floor(videoProgress.duration % 60)).padStart(2, '0')}
                </span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${
                      videoProgress.duration > 0
                        ? Math.min(100, (videoProgress.current / videoProgress.duration) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'player' && currentTrack ? (
        /* 4. DEDICATED AUDIO PLAYER SCREEN (ÉCRAN DE LECTURE DÉDIÉ) */
        <div className="absolute inset-0 pt-7 pb-6 px-5 flex flex-col justify-between z-20 animate-fade-in bg-gradient-to-b from-black/40 via-transparent to-black/60">
          <div className="flex items-center gap-4 flex-1 my-auto">
            {/* Album Artwork Square with Glass Reflection */}
            <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-2xl border-2 border-white/25 flex-shrink-0 group">
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/15 pointer-events-none"></div>
            </div>

            {/* Track Info & Visualizer */}
            <div className="flex flex-col justify-center flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[8px] font-bold">
                  {isPlaying ? 'LECTURE' : 'EN PAUSE'}
                </span>
                <span className="text-[8px] font-mono text-white/40">
                  AAC 256kbps • 44.1kHz
                </span>
              </div>

              <h2 className="text-[14px] font-bold text-white truncate drop-shadow">
                {currentTrack.title}
              </h2>
              <p className="text-[11px] text-white/80 font-medium truncate mb-2">
                {currentTrack.artist} — <span className="text-white/60">{currentTrack.album}</span>
              </p>

              {/* Dynamic Rhythmic Spectrum Visualizer */}
              <div className="w-full bg-black/40 backdrop-blur-sm rounded-lg p-1 border border-white/10 shadow-inner">
                <AudioVisualizer isPlaying={isPlaying} />
              </div>
            </div>
          </div>

          {/* Progress Bar & Timestamps */}
          <div className="w-full mt-auto mb-1">
            <div className="flex justify-between items-center text-[9px] font-mono text-white/70 mb-1">
              <span>
                {Math.floor(currentTime / 60)}:
                {String(Math.floor(currentTime % 60)).padStart(2, '0')}
              </span>
              <span>
                {Math.floor(duration / 60)}:
                {String(Math.floor(duration % 60)).padStart(2, '0')}
              </span>
            </div>
            <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.min(100, (currentTime / (duration || 30)) * 100)}%` }}
              ></div>
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
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setItemIndex(idx);
                        handleValidate();
                      }}
                      className={`h-11 flex items-center px-3 gap-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-gradient-to-r from-white/25 via-white/10 to-transparent border-l-3 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                          : 'opacity-40 hover:opacity-75'
                      }`}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-white/10 text-white flex-shrink-0">
                        {item.id === 'music-sensme' ? (
                          <SensMeIcon size={16} />
                        ) : item.type === 'folder' ? (
                          '📁'
                        ) : item.type === 'search' ? (
                          '🔍'
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
              // Sublist View (Memory Stick, SensMe, Search Results, History, Videos, Games)
              <div
                className="flex flex-col transition-transform duration-250 ease-out"
                style={{
                  transform: `translateY(calc(30px - ${subItemIndex * 48}px))`,
                }}
              >
                {subListType === 'game' ? (
                  // Games list from src/data/games.json
                  gamesList.map((game, idx) => {
                    const isSelected = idx === subItemIndex;
                    return (
                      <div
                        key={game.id}
                        onClick={() => {
                          setSubItemIndex(idx);
                          pauseTrack();
                          setCurrentGame(game);
                          pushState('game_screen', 'game');
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
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
                  // Video clips list from src/data/videos.json with elegant fallback for empty thumbnail
                  videosList.map((video, idx) => {
                    const isSelected = idx === subItemIndex;
                    return (
                      <div
                        key={video.id}
                        onClick={() => {
                          setSubItemIndex(idx);
                          pauseTrack();
                          setCurrentVideo(video);
                          setIsVideoPlaying(true);
                          pushState('video_player', 'video');
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                            : 'opacity-45 hover:opacity-75'
                        }`}
                      >
                        {/* Miniature avec fallback visuel élégant (icône pellicule UMD sur fond dégradé sombre) */}
                        <div className="relative w-12 h-8 rounded overflow-hidden flex-shrink-0 shadow border border-white/20 bg-gradient-to-br from-[#1a2333] via-[#0f1522] to-black flex items-center justify-center">
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-cyan-400">
                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                                <line x1="7" y1="2" x2="7" y2="22" />
                                <line x1="17" y1="2" x2="17" y2="22" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <line x1="2" y1="7" x2="7" y2="7" />
                                <line x1="2" y1="17" x2="7" y2="17" />
                                <line x1="17" y1="17" x2="22" y2="17" />
                                <line x1="17" y1="7" x2="22" y2="7" />
                              </svg>
                              <span className="text-[6.5px] font-mono font-bold text-cyan-300 tracking-wider">MP4</span>
                            </div>
                          )}
                          {video.thumbnail && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <span className="text-[8px] text-white/90">▶</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold truncate text-white drop-shadow">
                              {video.title}
                            </span>
                            {video.duration && video.duration !== '--:--' && (
                              <span className="text-[8px] px-1 rounded bg-cyan-500/80 text-white font-mono flex-shrink-0">
                                {video.duration}
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
                ) : currentSubList.length === 0 ? (
                  <div className="text-white/60 text-xs italic px-3 py-6">
                    {subListType === 'history'
                      ? 'Aucun titre dans l\'historique d\'écoute.'
                      : 'Aucun morceau disponible.'}
                  </div>
                ) : (
                  currentSubList.map((track, idx) => {
                    const isSelected = idx === subItemIndex;
                    const isCurrent = currentTrack?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          setSubItemIndex(idx);
                          playTrack(track);
                          pushState('player');
                        }}
                        className={`h-12 flex items-center px-3 gap-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-white/30 via-white/15 to-transparent border-l-3 border-emerald-400 shadow-[0_0_20px_rgba(78,205,196,0.3)]'
                            : 'opacity-45 hover:opacity-75'
                        }`}
                      >
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="w-8 h-8 rounded object-cover flex-shrink-0 shadow border border-white/20"
                        />
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
        <div className="absolute top-0 right-0 bottom-0 w-48 bg-gradient-to-l from-black/95 via-black/90 to-black/60 backdrop-blur-md border-l border-white/20 p-3 z-40 flex flex-col justify-between animate-fade-in shadow-2xl">
          <div>
            <div className="flex items-center justify-between border-b border-white/15 pb-1.5 mb-2.5">
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                <PSGlyph type="triangle" size={10} />
                OPTIONS
              </span>
              <button
                onClick={() => setIsOptionsOpen(false)}
                className="text-white/50 hover:text-white text-[10px] px-1 rounded bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Context details */}
            <div className="flex flex-col gap-2 text-[9px]">
              {viewMode === 'player' && currentTrack ? (
                <>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Titre</span>
                    <span className="font-semibold text-white truncate block">{currentTrack.title}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Artiste</span>
                    <span className="text-white/80 truncate block">{currentTrack.artist}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Format</span>
                    <span className="text-emerald-300 font-mono text-[8px]">AAC 256kbps • 44.1kHz</span>
                  </div>
                </>
              ) : viewMode === 'video_player' && currentVideo ? (
                <>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Clip Vidéo</span>
                    <span className="font-semibold text-white truncate block">{currentVideo.title}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Codec</span>
                    <span className="text-cyan-300 font-mono text-[8px]">{currentVideo.codec || 'MPEG-4 AVC'}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Résolution</span>
                    <span className="text-white/70 font-mono text-[8px]">480 × 272 (16:9)</span>
                  </div>
                </>
              ) : viewMode === 'game_screen' && currentGame ? (
                <>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Jeu UMD</span>
                    <span className="font-semibold text-white truncate block">{currentGame.title}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Éditeur</span>
                    <span className="text-emerald-300 text-[8px]">{currentGame.publisher || 'SCE'}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Genre / Taille</span>
                    <span className="text-white/70 font-mono text-[8px]">{currentGame.genre} • {currentGame.size}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Système</span>
                    <span className="font-semibold text-white block">Sony PSP Street</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Firmware</span>
                    <span className="text-white/70 font-mono text-[8px]">v6.61 (Authentique)</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Catégorie active</span>
                    <span className="text-white/80 block">{activeCategory.name}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[7.5px] uppercase">Volume principal</span>
                    <span className="text-white/70 font-mono text-[8px]">{Math.round(volume * 30)} / 30</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 text-[7.5px] text-white/40 font-mono">
            △ ou ◯ pour fermer
          </div>
        </div>
      )}

      {/* 8. INFO POPUP NOTIFICATION */}
      {infoPopup && (
        <div className="absolute top-12 right-4 max-w-xs bg-black/90 backdrop-blur-md border border-white/25 rounded-xl p-2.5 text-[10px] text-white shadow-2xl z-40 animate-fade-in whitespace-pre-line">
          {infoPopup}
        </div>
      )}

      {/* 9. BOTTOM CONTROLS BAR (Calée au bas de l'écran LCD) */}
      <div className="absolute bottom-1 left-3 right-3 flex items-center justify-between text-[8.5px] text-white/60 font-medium z-30 pointer-events-none">
        {viewMode === 'game_screen' ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>Démarrer / Action</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Quitter le jeu</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="triangle" size={11} />
              <span>Options</span>
            </span>
          </div>
        ) : viewMode === 'video_player' ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>{isVideoPlaying ? 'Pause' : 'Play'}</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Quitter la vidéo</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="triangle" size={11} />
              <span>Options</span>
            </span>
            <span className="text-white/40">◀/▶ Reculer/Avancer (5s)</span>
          </div>
        ) : viewMode === 'player' ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Retour XMB</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="triangle" size={11} />
              <span>Options</span>
            </span>
            <span className="text-white/40">◀/▶ Reculer/Avancer (5s)</span>
          </div>
        ) : (
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
        )}
        <div className="text-white/35 font-mono text-[8px]">
          PSP™ Street E1000
        </div>
      </div>
    </div>
  );
};
