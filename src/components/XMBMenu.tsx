import React, { useState, useEffect, useRef } from 'react';
import { XMBCategory, Track, PSPTheme, PSP_MONTHLY_THEMES } from '../types/xmb';
import { CategoryIcon, PSGlyph, SensMeIcon } from './XMBIcons';
import {
  NOSTALGIC_PSP_TRACKS,
  SENSME_PLAYLISTS,
  searchTracks,
  getListeningHistory,
  clearListeningHistory,
} from '../services/itunes';
import { sound } from '../services/sound';
import { useAudio } from './AudioEngine';
import { AudioVisualizer } from './AudioVisualizer';

export type XMBViewMode = 'menu' | 'sublist' | 'player';

interface NavigationFrame {
  view: XMBViewMode;
  catIndex: number;
  itemIndex: number;
  subItemIndex: number;
  subListType?: 'ms' | 'sensme' | 'history' | 'search_results';
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
    playTrack,
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
    'ms' | 'sensme' | 'history' | 'search_results'
  >('ms');

  // Dynamic tracks state
  const [nostalgicTracks] = useState<Track[]>(NOSTALGIC_PSP_TRACKS);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // Search modal state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);

  // Real-time clock & battery
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

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

  // Strict 4-Category XMB Hierarchy (Paramètres, Musique, Recherche, Historique)
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

  // Active sub-list tracks
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
      isSearchModalOpen,
      currentTrack,
    };
  });

  // Push current frame onto navigation state stack
  const pushState = (newView: XMBViewMode, nextSubListType?: 'ms' | 'sensme' | 'history' | 'search_results') => {
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
  };

  // Pop state stack (Circle button / Escape)
  const popState = () => {
    sound.playBack();
    const current = stateRef.current;

    if (current.isSearchModalOpen) {
      setIsSearchModalOpen(false);
      return;
    }
    if (infoPopup) {
      setInfoPopup(null);
      return;
    }

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

  // Home Button (Reset stack to root XMB)
  const handleHome = () => {
    sound.playBack();
    setNavStack([]);
    setViewMode('menu');
    setItemIndex(0);
    setSubItemIndex(0);
    setIsSearchModalOpen(false);
    setInfoPopup(null);
  };

  // Navigation logic
  const handleNav = (dir: 'left' | 'right' | 'up' | 'down') => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    // In Dedicated Player View: Left/Right seeks -5s/+5s
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

    if (dir === 'left') {
      if (s.viewMode === 'sublist') {
        popState();
        return;
      }
      sound.playTick();
      setCatIndex((prev) => (prev > 0 ? prev - 1 : s.categories.length - 1));
      setItemIndex(0);
    } else if (dir === 'right') {
      if (s.viewMode === 'sublist') {
        const track = s.currentSubList[s.subItemIndex];
        if (track) {
          sound.playEnter();
          playTrack(track);
          pushState('player');
        }
        return;
      }
      const curItem = s.activeItems[s.itemIndex];
      if (curItem?.type === 'folder') {
        sound.playEnter();
        let targetType: 'ms' | 'sensme' | 'history' = 'ms';
        if (curItem.id === 'music-sensme') targetType = 'sensme';
        if (curItem.id === 'history-list') targetType = 'history';
        pushState('sublist', targetType);
        return;
      }
      sound.playTick();
      setCatIndex((prev) => (prev < s.categories.length - 1 ? prev + 1 : 0));
      setItemIndex(0);
    } else if (dir === 'up') {
      sound.playTick();
      if (s.viewMode === 'sublist') {
        setSubItemIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, s.currentSubList.length - 1)
        );
      } else {
        setItemIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, s.activeItems.length - 1)
        );
      }
    } else if (dir === 'down') {
      sound.playTick();
      if (s.viewMode === 'sublist') {
        setSubItemIndex((prev) =>
          prev < s.currentSubList.length - 1 ? prev + 1 : 0
        );
      } else {
        setItemIndex((prev) =>
          prev < s.activeItems.length - 1 ? prev + 1 : 0
        );
      }
    }
  };

  // Validation logic (Cross button / Enter)
  const handleValidate = () => {
    const s = stateRef.current;
    if (s.isSearchModalOpen) return;

    sound.playEnter();

    // 1. In Dedicated Player: Toggle Play/Pause
    if (s.viewMode === 'player') {
      togglePlay();
      return;
    }

    // 2. In Sublist: play selected track and open player screen
    if (s.viewMode === 'sublist') {
      const selectedTrack = s.currentSubList[s.subItemIndex];
      if (selectedTrack) {
        playTrack(selectedTrack);
        pushState('player');
      }
      return;
    }

    // 3. In Main XMB Menu
    const currentItem = s.activeItems[s.itemIndex];
    if (!currentItem) return;

    if (currentItem.type === 'folder') {
      let targetType: 'ms' | 'sensme' | 'history' = 'ms';
      if (currentItem.id === 'music-sensme') targetType = 'sensme';
      if (currentItem.id === 'history-list') targetType = 'history';
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

  // Options / Triangle
  const handleOptions = () => {
    const s = stateRef.current;
    sound.playOption();
    if (s.viewMode === 'player' && currentTrack) {
      setInfoPopup(`Morceau : ${currentTrack.title}\nArtiste : ${currentTrack.artist}\nAlbum : ${currentTrack.album}\nFormat : Audio AAC 256kbps 44.1kHz`);
    } else if (s.viewMode === 'sublist') {
      const track = s.currentSubList[s.subItemIndex];
      if (track) {
        setInfoPopup(`Titre : ${track.title}\nArtiste : ${track.artist}\nAlbum : ${track.album}`);
      }
    } else {
      setInfoPopup(`Système : Sony PSP Street (E1000)\nVersion : 6.61\nCatégorie : ${activeCategory.name}`);
    }
    setTimeout(() => setInfoPopup(null), 3500);
  };

  // Square (□) action: switch to/from Player or Play/Pause
  const handleSquare = () => {
    const s = stateRef.current;
    sound.playTick();
    if (s.viewMode === 'player') {
      togglePlay();
    } else if (currentTrack) {
      pushState('player');
    } else if (nostalgicTracks.length > 0) {
      playTrack(nostalgicTracks[0]);
      pushState('player');
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
          {viewMode === 'player' ? (
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

      {/* 2. DEDICATED PLAYER SCREEN (ÉCRAN DE LECTURE DÉDIÉ) */}
      {viewMode === 'player' && currentTrack ? (
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
        /* 3. XMB DUAL-AXIS MENU (Catégories Horizontales + Items Verticaux) */
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
              // Sublist View (Memory Stick, SensMe, Search Results, History)
              <div
                className="flex flex-col transition-transform duration-250 ease-out"
                style={{
                  transform: `translateY(calc(30px - ${subItemIndex * 48}px))`,
                }}
              >
                {currentSubList.length === 0 ? (
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

      {/* 4. SEARCH MODAL DIALOG */}
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

      {/* 5. INFO POPUP NOTIFICATION */}
      {infoPopup && (
        <div className="absolute top-12 right-4 max-w-xs bg-black/90 backdrop-blur-md border border-white/25 rounded-xl p-2.5 text-[10px] text-white shadow-2xl z-40 animate-fade-in whitespace-pre-line">
          {infoPopup}
        </div>
      )}

      {/* 6. BOTTOM CONTROLS BAR (Calée au bas de l'écran LCD) */}
      <div className="absolute bottom-1 left-3 right-3 flex items-center justify-between text-[8.5px] text-white/60 font-medium z-30 pointer-events-none">
        {viewMode === 'player' ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Retour XMB</span>
            </span>
            <span className="text-white/40">◀/▶ Reculer/Avancer (5s)</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <PSGlyph type="cross" size={11} />
              <span>Valider</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="circle" size={11} />
              <span>Retour</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="triangle" size={11} />
              <span>Options</span>
            </span>
            <span className="flex items-center gap-1">
              <PSGlyph type="square" size={11} />
              <span>Lecteur</span>
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
