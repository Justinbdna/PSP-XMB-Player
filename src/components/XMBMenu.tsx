import React, { useState, useEffect } from 'react';
import { XMBCategory, Track, PSPTheme, PSP_MONTHLY_THEMES } from '../types/xmb';
import { CategoryIcon, PSGlyph } from './XMBIcons';
import { NOSTALGIC_PSP_TRACKS, searchTracks } from '../services/itunes';
import { sound } from '../services/sound';
import { useAudio } from './AudioEngine';

interface XMBMenuProps {
  currentTheme: PSPTheme;
  onThemeChange: (theme: PSPTheme) => void;
  onTriggerAction?: (action: string) => void;
  externalCommand?: { action: string; timestamp: number } | null;
}

export const XMBMenu: React.FC<XMBMenuProps> = ({
  currentTheme,
  onThemeChange,
  externalCommand,
}) => {
  const { currentTrack, isPlaying, currentTime, duration, playTrack, togglePlay } = useAudio();

  // Navigation Coordinates
  const [catIndex, setCatIndex] = useState<number>(2); // Default to 'Music' (index 2)
  const [itemIndex, setItemIndex] = useState<number>(0);
  const [inSubLevel, setInSubLevel] = useState<boolean>(false);
  const [subItemIndex, setSubItemIndex] = useState<number>(0);

  // Search & dynamic tracks state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [infoPopup, setInfoPopup] = useState<string | null>(null);

  // Real-time clock & battery
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      );
      setDateStr(
        now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // XMB Hierarchy Definition
  const categories: XMBCategory[] = [
    {
      id: 'settings',
      name: 'Paramètres',
      icon: 'settings',
      items: [
        { id: 'theme-color', label: 'Couleur du thème', sublabel: currentTheme.name, icon: 'theme', type: 'setting' },
        { id: 'sound-toggle', label: 'Bip sonore des touches', sublabel: sound.getMuted() ? 'Désactivé' : 'Activé', icon: 'audio', type: 'action' },
        { id: 'about-psp', label: 'Informations système', sublabel: 'PSP XMB Player v1.0.0', icon: 'info', type: 'action' },
      ],
    },
    {
      id: 'photo',
      name: 'Photo',
      icon: 'photo',
      items: [
        { id: 'photo-ms', label: 'Memory Stick™', sublabel: '6 images trouvées', icon: 'ms', type: 'action' },
        { id: 'photo-cam', label: 'Appareil photo numérique PSP', sublabel: 'Aucun appareil connecté', icon: 'cam', type: 'action' },
      ],
    },
    {
      id: 'music',
      name: 'Musique',
      icon: 'music',
      items: [
        { id: 'music-ms', label: 'Memory Stick™ (Titres cultes 2005)', sublabel: `${NOSTALGIC_PSP_TRACKS.length} morceaux`, icon: 'ms', type: 'folder' },
        { id: 'music-search', label: 'Rechercher sur iTunes...', sublabel: 'Accès streaming gratuit', icon: 'search', type: 'search' },
        { id: 'music-now', label: 'Lecture en cours', sublabel: currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'Aucune piste', icon: 'now', type: 'action' },
      ],
    },
    {
      id: 'video',
      name: 'Vidéo',
      icon: 'video',
      items: [
        { id: 'video-ms', label: 'Memory Stick™ Vidéos', sublabel: 'Format MP4 / AVC 480x272', icon: 'ms', type: 'action' },
        { id: 'video-umd', label: 'Lecteur UMD™ Vidéo', sublabel: 'Aucun disque inséré', icon: 'umd', type: 'action' },
      ],
    },
    {
      id: 'game',
      name: 'Jeu',
      icon: 'game',
      items: [
        { id: 'game-umd', label: 'UMD™ (Universal Media Disc)', sublabel: 'Insérer un disque PSP', icon: 'umd', type: 'action' },
        { id: 'game-ms', label: 'Memory Stick™ Jeux', sublabel: 'Démos & Homebrews', icon: 'ms', type: 'action' },
      ],
    },
    {
      id: 'network',
      name: 'Réseau',
      icon: 'network',
      items: [
        { id: 'net-browser', label: 'Navigateur Internet', sublabel: 'Moteur NetFront v3', icon: 'web', type: 'action' },
        { id: 'net-radio', label: 'Radio par Internet', sublabel: 'Flux en direct', icon: 'radio', type: 'action' },
      ],
    },
  ];

  const activeCategory = categories[catIndex];
  const activeItems = activeCategory.items;
  const currentSubList =
    activeCategory.id === 'music' && itemIndex === 0
      ? NOSTALGIC_PSP_TRACKS
      : searchResults;

  // Handle Navigation
  const handleNav = (dir: 'left' | 'right' | 'up' | 'down') => {
    if (isSearchModalOpen) return;

    if (dir === 'left') {
      if (inSubLevel) {
        sound.playBack();
        setInSubLevel(false);
        setSubItemIndex(0);
        return;
      }
      sound.playTick();
      setCatIndex((prev) => (prev > 0 ? prev - 1 : categories.length - 1));
      setItemIndex(0);
    } else if (dir === 'right') {
      if (inSubLevel) return;
      sound.playTick();
      setCatIndex((prev) => (prev < categories.length - 1 ? prev + 1 : 0));
      setItemIndex(0);
    } else if (dir === 'up') {
      sound.playTick();
      if (inSubLevel) {
        setSubItemIndex((prev) => (prev > 0 ? prev - 1 : currentSubList.length - 1));
      } else {
        setItemIndex((prev) => (prev > 0 ? prev - 1 : activeItems.length - 1));
      }
    } else if (dir === 'down') {
      sound.playTick();
      if (inSubLevel) {
        setSubItemIndex((prev) => (prev < currentSubList.length - 1 ? prev + 1 : 0));
      } else {
        setItemIndex((prev) => (prev < activeItems.length - 1 ? prev + 1 : 0));
      }
    }
  };

  // Handle Validation (✕ / Key X / Enter)
  const handleValidate = () => {
    if (isSearchModalOpen) return;

    sound.playEnter();

    // 1. In sub-level: click to play track
    if (inSubLevel) {
      const selectedTrack = currentSubList[subItemIndex];
      if (selectedTrack) {
        playTrack(selectedTrack);
      }
      return;
    }

    // 2. Main level
    const currentItem = activeItems[itemIndex];
    if (!currentItem) return;

    if (currentItem.type === 'folder') {
      setInSubLevel(true);
      setSubItemIndex(0);
    } else if (currentItem.type === 'search') {
      setIsSearchModalOpen(true);
    } else if (currentItem.id === 'music-now') {
      togglePlay();
    } else if (currentItem.id === 'theme-color') {
      // Rotate monthly theme
      const nextMonth = (currentTheme.month % 12) + 1;
      onThemeChange(PSP_MONTHLY_THEMES[nextMonth]);
    } else if (currentItem.id === 'sound-toggle') {
      sound.toggleMute();
      setItemIndex((prev) => prev); // force re-render
    } else {
      setInfoPopup(`${currentItem.label} : ${currentItem.sublabel || 'Disponible sur le système'}`);
      setTimeout(() => setInfoPopup(null), 3000);
    }
  };

  // Handle Cancel (◯ / Key O / Escape)
  const handleCancel = () => {
    sound.playBack();
    if (isSearchModalOpen) {
      setIsSearchModalOpen(false);
      return;
    }
    if (infoPopup) {
      setInfoPopup(null);
      return;
    }
    if (inSubLevel) {
      setInSubLevel(false);
      setSubItemIndex(0);
    }
  };

  // Handle Options (△ / Key A)
  const handleOptions = () => {
    sound.playOption();
    if (inSubLevel) {
      const track = currentSubList[subItemIndex];
      if (track) {
        setInfoPopup(`Titre : ${track.title}\nArtiste : ${track.artist}\nAlbum : ${track.album}`);
      }
    } else {
      setInfoPopup(`Catégorie : ${activeCategory.name}\nPSP System Software v6.61`);
    }
    setTimeout(() => setInfoPopup(null), 3500);
  };

  // Handle Search Execution
  const executeSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    const results = await searchTracks(queryText);
    setSearchResults(results);
    setIsSearching(false);
    setIsSearchModalOpen(false);
    setInSubLevel(true);
    setSubItemIndex(0);
  };

  // External commands listener (from hardware shell buttons clicks)
  useEffect(() => {
    if (!externalCommand) return;
    const { action } = externalCommand;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      handleNav(action);
    } else if (action === 'cross') {
      handleValidate();
    } else if (action === 'circle') {
      handleCancel();
    } else if (action === 'triangle') {
      handleOptions();
    } else if (action === 'square') {
      togglePlay();
    }
  }, [externalCommand]);

  // Global Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent interfering when typing in search input
      if (isSearchModalOpen && e.target instanceof HTMLInputElement) return;

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
        handleCancel();
      } else if (key === 'a') {
        e.preventDefault();
        handleOptions();
      } else if (key === 's' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catIndex, itemIndex, inSubLevel, subItemIndex, currentSubList, isSearchModalOpen, infoPopup]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden text-white font-['Inter',sans-serif]">
      {/* 1. TOP STATUS BAR */}
      <div className="absolute top-2 left-4 right-4 flex justify-between items-center z-20 text-[11px] font-medium tracking-wider text-white/80 drop-shadow">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-widest text-white/90">SONY</span>
          <span className="text-white/40">|</span>
          <span className="text-white/70 uppercase text-[10px]">{activeCategory.name}</span>
        </div>

        <div className="flex items-center gap-3">
          {isPlaying && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 animate-pulse">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-emerald-300 font-mono">EN LECTURE</span>
            </div>
          )}
          <span>{dateStr}</span>
          <span className="font-mono font-bold text-white">{timeStr}</span>

          {/* Battery Icon */}
          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
            <div className="w-4 h-2 border border-white/80 rounded-sm p-[1px] flex gap-[1px]">
              <div className="bg-white/90 w-1 h-full rounded-[0.5px]"></div>
              <div className="bg-white/90 w-1 h-full rounded-[0.5px]"></div>
              <div className="bg-white/90 w-1 h-full rounded-[0.5px]"></div>
            </div>
            <span className="text-[9px] font-mono">100%</span>
          </div>
        </div>
      </div>

      {/* 2. HORIZONTAL CATEGORIES BAR (X AXIS) */}
      <div
        className="absolute top-10 left-0 right-0 h-16 flex items-center z-10 transition-transform duration-300 ease-out"
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
                  setInSubLevel(false);
                }
              }}
              className={`w-20 flex-shrink-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                isActive ? 'scale-110 opacity-100' : 'scale-90 opacity-40 hover:opacity-70'
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-all duration-300 ${
                  isActive ? 'bg-white/15 shadow-[0_0_20px_rgba(255,255,255,0.4)] backdrop-blur-md' : ''
                }`}
              >
                <CategoryIcon type={cat.icon} active={isActive} />
              </div>
              {isActive && (
                <span className="mt-1 text-[11px] font-semibold tracking-wider text-white drop-shadow">
                  {cat.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. VERTICAL COLUMN (Y AXIS) */}
      <div
        className="absolute left-[108px] top-28 bottom-12 w-[340px] z-10 transition-all duration-300 ease-out overflow-hidden"
      >
        {!inSubLevel ? (
          // Main Category Items List
          <div
            className="flex flex-col transition-transform duration-250 ease-out"
            style={{
              transform: `translateY(calc(40px - ${itemIndex * 48}px))`,
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
                  className={`h-12 flex items-center px-3 gap-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-white/25 via-white/15 to-transparent border-l-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.25)]'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  <div className="w-7 h-7 rounded flex items-center justify-center bg-white/10 text-white flex-shrink-0">
                    {item.type === 'folder' ? '📁' : item.type === 'search' ? '🔍' : '🎵'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold truncate text-white drop-shadow">
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className="text-[10px] text-white/70 truncate">
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Sub-level (Tracks List from Memory Stick or Search Results)
          <div
            className="flex flex-col transition-transform duration-250 ease-out"
            style={{
              transform: `translateY(calc(40px - ${subItemIndex * 52}px))`,
            }}
          >
            {currentSubList.length === 0 ? (
              <div className="text-white/60 text-xs italic px-4 py-8">
                Aucun morceau trouvé.
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
                    }}
                    className={`h-13 flex items-center px-3 gap-3 rounded-lg cursor-pointer transition-all duration-200 ${
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
                        <span className="text-[12px] font-bold truncate text-white drop-shadow">
                          {track.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 rounded bg-emerald-500/80 text-white font-mono">
                            {isPlaying ? 'PLAY' : 'PAUSE'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/75 truncate">
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

      {/* 4. NOW PLAYING FLOATING MINI-PLAYER (Bottom-Right) */}
      {currentTrack && (
        <div className="absolute right-4 bottom-10 w-64 p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 shadow-2xl flex items-center gap-3 z-20">
          <img
            src={currentTrack.artworkUrl}
            alt={currentTrack.title}
            className={`w-11 h-11 rounded-lg object-cover shadow border border-white/30 ${
              isPlaying ? 'animate-pulse' : ''
            }`}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] font-bold truncate text-white drop-shadow">
              {currentTrack.title}
            </span>
            <span className="text-[10px] text-white/70 truncate">
              {currentTrack.artist}
            </span>
            {/* Progress bar */}
            <div className="w-full bg-white/20 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${(currentTime / (duration || 30)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SEARCH MODAL DIALOG */}
      {isSearchModalOpen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#252a34] to-[#12161f] border border-white/30 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
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
            <p className="text-[10px] text-white/60 mb-2">
              Tape un nom d'artiste ou de morceau pour charger des extraits en streaming :
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
                placeholder="Ex: Daft Punk, Nirvana, Aya..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-black/50 border border-white/25 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition"
              >
                {isSearching ? '...' : 'OK'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. INFO POPUP NOTIFICATION */}
      {infoPopup && (
        <div className="absolute top-16 right-6 max-w-xs bg-black/80 backdrop-blur-md border border-white/25 rounded-xl p-3 text-xs text-white shadow-2xl z-40 animate-fade-in whitespace-pre-line">
          {infoPopup}
        </div>
      )}

      {/* 7. BOTTOM ACTION CONTROLS HINTS */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] text-white/75 font-medium z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <PSGlyph type="cross" size={13} />
            <span>Valider (X)</span>
          </span>
          <span className="flex items-center gap-1">
            <PSGlyph type="circle" size={13} />
            <span>Retour (O)</span>
          </span>
          <span className="flex items-center gap-1">
            <PSGlyph type="triangle" size={13} />
            <span>Options (A)</span>
          </span>
          <span className="flex items-center gap-1">
            <PSGlyph type="square" size={13} />
            <span>Play/Pause (S)</span>
          </span>
        </div>
        <div className="text-white/50 text-[9px]">
          PSP™ PlayStation Portable
        </div>
      </div>
    </div>
  );
};
