import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GameItem } from '../../types/xmb';
import { useAudio } from '../AudioEngine';
import { sound } from '../../services/sound';
import { Music, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, Grid3X3, X } from 'lucide-react';

interface J2MEPlayerProps {
  game: GameItem;
  onExit: () => void;
  onReady?: () => void;
  externalCommand?: { action: string; timestamp: number } | null;
  visible?: boolean;
}

const PSP_TO_J2ME_KEY: Record<string, { code: string; symbol?: string }> = {
  up: { code: 'ArrowUp' },
  down: { code: 'ArrowDown' },
  left: { code: 'ArrowLeft' },
  right: { code: 'ArrowRight' },
  cross: { code: 'Enter' },
  square: { code: 'F1' },
  trigger_l: { code: 'F1' },
  triangle: { code: 'F2' },
  trigger_r: { code: 'F2' },
  start: { code: 'Escape' },
};

const FORWARDED_KEYBOARD_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Escape',
  'F1',
  'F2',
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'Space',
  'Digit0',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadMultiply',
  'NumpadDivide',
]);

const KEYPAD_BUTTONS: { label: string; sub?: string; code: string; symbol?: string }[] = [
  { label: '1', code: 'Digit1', symbol: '1' },
  { label: '2', sub: 'ABC', code: 'Digit2', symbol: '2' },
  { label: '3', sub: 'DEF', code: 'Digit3', symbol: '3' },
  { label: '4', sub: 'GHI', code: 'Digit4', symbol: '4' },
  { label: '5', sub: 'JKL', code: 'Digit5', symbol: '5' },
  { label: '6', sub: 'MNO', code: 'Digit6', symbol: '6' },
  { label: '7', sub: 'PQRS', code: 'Digit7', symbol: '7' },
  { label: '8', sub: 'TUV', code: 'Digit8', symbol: '8' },
  { label: '9', sub: 'WXYZ', code: 'Digit9', symbol: '9' },
  { label: '*', code: 'KeyE', symbol: '*' },
  { label: '0', sub: '+', code: 'Digit0', symbol: '0' },
  { label: '#', code: 'KeyR', symbol: '#' },
];

function getInitialGameVolume(): number {
  try {
    const saved = localStorage.getItem('psp_j2me_game_volume');
    if (saved !== null) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) return Math.max(0, Math.min(1, parsed));
    }
  } catch {
    // Ignore storage read errors
  }
  return 1.0;
}

export const J2MEPlayer: React.FC<J2MEPlayerProps> = ({
  game,
  onExit,
  onReady,
  externalCommand,
  visible = true,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastCommandTsRef = useRef<number>(externalCommand?.timestamp || 0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialVolRef = useRef<number>(getInitialGameVolume());

  const [isReady, setIsReady] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [activeMixerChannel, setActiveMixerChannel] = useState<0 | 1>(0);
  const [gameVolume, setGameVolumeState] = useState<number>(initialVolRef.current);

  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  const isMixerOpenRef = useRef(isMixerOpen);
  isMixerOpenRef.current = isMixerOpen;
  const activeMixerChannelRef = useRef<0 | 1>(activeMixerChannel);
  activeMixerChannelRef.current = activeMixerChannel;
  const gameVolumeRef = useRef<number>(gameVolume);
  gameVolumeRef.current = gameVolume;

  const {
    currentTrack,
    isPlaying,
    volume: musicVolume,
    playlist,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume: setMusicVolume,
  } = useAudio();

  const musicVolumeRef = useRef<number>(musicVolume);
  musicVolumeRef.current = musicVolume;

  const handleToggleMusicPlayback = useCallback(() => {
    if (!currentTrack && playlist.length > 0) {
      playTrack(playlist[0], playlist);
    } else {
      togglePlay();
    }
  }, [currentTrack, playlist, playTrack, togglePlay]);

  const width = game.resolution?.width || 176;
  const height = game.resolution?.height || 220;

  const emulatorUrl = useMemo(() => {
    const params = new URLSearchParams({
      rom: game.romUrl || '',
      width: String(width),
      height: String(height),
      phone: 'Motorola',
      fractionScale: '1',
      embed: '1',
      volume: String(initialVolRef.current),
    });
    return `/emulators/freej2me/run.html?${params.toString()}`;
  }, [game.id, game.romUrl, width, height]);

  const postToEmulator = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(payload, '*');
  }, []);

  const updateGameVolume = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(1, nextVol));
      setGameVolumeState(clamped);
      try {
        localStorage.setItem('psp_j2me_game_volume', String(clamped));
      } catch {
        // Ignore storage write errors
      }
      postToEmulator({ type: 'freej2me:setVolume', volume: clamped });
    },
    [postToEmulator]
  );

  const sendKeyEvent = useCallback(
    (down: boolean, code: string, symbol?: string) => {
      postToEmulator({ type: 'freej2me:key', down, code, symbol });
    },
    [postToEmulator]
  );

  const sendKeyTap = useCallback(
    (code: string, symbol?: string) => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      sendKeyEvent(true, code, symbol);
      tapTimeoutRef.current = setTimeout(() => {
        sendKeyEvent(false, code, symbol);
      }, 110);
    },
    [sendKeyEvent]
  );

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // Listen to emulator lifecycle events from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'freej2me:ready') {
        setIsReady(true);
        postToEmulator({ type: 'freej2me:setVolume', volume: gameVolume });
        onReady?.();
      } else if (data.type === 'freej2me:exit') {
        onExit();
      } else if (data.type === 'freej2me:error') {
        setErrorMsg(String(data.message || 'Impossible de lancer ce jeu Java ME.'));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameVolume, onExit, onReady, postToEmulator]);

  // Refocus emulator canvas when becoming visible or closing mixer
  useEffect(() => {
    if (visible && isReady && !isMixerOpen) {
      postToEmulator({ type: 'freej2me:focus' });
    }
  }, [visible, isReady, isMixerOpen, postToEmulator]);

  // Forward parent-window keyboard events into the emulator iframe
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'm') {
        e.preventDefault();
        sound.playOption();
        setIsMixerOpen((prev) => !prev);
        return;
      }

      if (isMixerOpenRef.current) {
        if (e.key === 'Escape' || lower === 'o') {
          e.preventDefault();
          sound.playBack();
          setIsMixerOpen(false);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          sound.playTick();
          setActiveMixerChannel((prev) => (prev === 0 ? 1 : 0));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          sound.playTick();
          if (activeMixerChannelRef.current === 0) {
            updateGameVolume(gameVolumeRef.current - 0.05);
          } else {
            setMusicVolume(Math.max(0, musicVolumeRef.current - 0.05), false);
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          sound.playTick();
          if (activeMixerChannelRef.current === 0) {
            updateGameVolume(gameVolumeRef.current + 0.05);
          } else {
            setMusicVolume(Math.min(1, musicVolumeRef.current + 0.05), false);
          }
        } else if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleToggleMusicPlayback();
        } else if (lower === 'q' || e.key === '[') {
          e.preventDefault();
          sound.playTick();
          previousTrack();
        } else if (lower === 'e' || e.key === ']') {
          e.preventDefault();
          sound.playTick();
          nextTrack();
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setShowKeypad((prev) => !prev);
        return;
      }

      if (lower === 'h' || e.key === 'Home') {
        e.preventDefault();
        onExit();
        return;
      }

      if (FORWARDED_KEYBOARD_CODES.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) {
          const symbol = e.key.length === 1 ? e.key : undefined;
          sendKeyEvent(true, e.code, symbol);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isMixerOpenRef.current) return;
      if (FORWARDED_KEYBOARD_CODES.has(e.code)) {
        e.preventDefault();
        const symbol = e.key.length === 1 ? e.key : undefined;
        sendKeyEvent(false, e.code, symbol);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    visible,
    onExit,
    sendKeyEvent,
    handleToggleMusicPlayback,
    nextTrack,
    previousTrack,
    setMusicVolume,
    updateGameVolume,
  ]);

  // Handle PSP chassis buttons & gamepad commands
  useEffect(() => {
    if (!externalCommand || externalCommand.timestamp <= lastCommandTsRef.current) {
      return;
    }
    lastCommandTsRef.current = externalCommand.timestamp;
    const { action } = externalCommand;

    if (action === 'music_note') {
      sound.playOption();
      setIsMixerOpen((prev) => !prev);
      return;
    }

    if (action === 'home') {
      onExit();
      return;
    }

    if (isMixerOpenRef.current) {
      if (action === 'circle' || action === 'start') {
        sound.playBack();
        setIsMixerOpen(false);
      } else if (action === 'up' || action === 'down') {
        sound.playTick();
        setActiveMixerChannel((prev) => (prev === 0 ? 1 : 0));
      } else if (action === 'left') {
        sound.playTick();
        if (activeMixerChannelRef.current === 0) {
          updateGameVolume(gameVolumeRef.current - 0.05);
        } else {
          setMusicVolume(Math.max(0, musicVolumeRef.current - 0.05), false);
        }
      } else if (action === 'right') {
        sound.playTick();
        if (activeMixerChannelRef.current === 0) {
          updateGameVolume(gameVolumeRef.current + 0.05);
        } else {
          setMusicVolume(Math.min(1, musicVolumeRef.current + 0.05), false);
        }
      } else if (action === 'cross' || action === 'square') {
        handleToggleMusicPlayback();
      } else if (action === 'trigger_l') {
        sound.playTick();
        previousTrack();
      } else if (action === 'trigger_r') {
        sound.playTick();
        nextTrack();
      } else if (action === 'vol_up') {
        setMusicVolume(Math.min(1, musicVolume + 0.1));
      } else if (action === 'vol_down') {
        setMusicVolume(Math.max(0, musicVolume - 0.1));
      }
      return;
    }

    if (action === 'circle') {
      if (showKeypad) {
        setShowKeypad(false);
      } else {
        onExit();
      }
      return;
    }

    if (action === 'select') {
      sound.playTick();
      setShowKeypad((prev) => !prev);
      return;
    }

    if (action === 'vol_up') {
      updateGameVolume(gameVolume + 0.1);
      return;
    }

    if (action === 'vol_down') {
      updateGameVolume(gameVolume - 0.1);
      return;
    }

    const mapped = PSP_TO_J2ME_KEY[action];
    if (mapped && isReadyRef.current) {
      sendKeyTap(mapped.code, mapped.symbol);
    }
  }, [
    externalCommand,
    gameVolume,
    handleToggleMusicPlayback,
    musicVolume,
    nextTrack,
    onExit,
    previousTrack,
    sendKeyTap,
    setMusicVolume,
    showKeypad,
    updateGameVolume,
  ]);

  const applyAudioPreset = (nextGameVol: number, nextMusicVol: number, ensureMusicPlaying: boolean) => {
    updateGameVolume(nextGameVol);
    setMusicVolume(nextMusicVol, false);
    if (ensureMusicPlaying && !isPlaying) {
      if (!currentTrack && playlist.length > 0) {
        playTrack(playlist[0], playlist);
      } else {
        togglePlay();
      }
    }
  };

  return (
    <div
      className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Left black bar: sleek smoked-glass keypad */}
      {showKeypad && visible && (
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[114px] z-20 flex flex-col gap-1.5 bg-white/[0.06] backdrop-blur-xl border border-white/15 rounded-xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onPointerDown={() => sendKeyEvent(true, 'F1')}
              onPointerUp={() => sendKeyEvent(false, 'F1')}
              onPointerLeave={() => sendKeyEvent(false, 'F1')}
              className="py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/30 text-[9px] font-medium tracking-wide text-white/90 border border-white/15 cursor-pointer transition-colors"
            >
              Soft G
            </button>
            <button
              type="button"
              onPointerDown={() => sendKeyEvent(true, 'F2')}
              onPointerUp={() => sendKeyEvent(false, 'F2')}
              onPointerLeave={() => sendKeyEvent(false, 'F2')}
              className="py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/30 text-[9px] font-medium tracking-wide text-white/90 border border-white/15 cursor-pointer transition-colors"
            >
              Soft D
            </button>
          </div>
          <div className="h-px bg-white/10" />
          <div className="grid grid-cols-3 gap-1">
            {KEYPAD_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                type="button"
                onPointerDown={() => sendKeyEvent(true, btn.code, btn.symbol)}
                onPointerUp={() => sendKeyEvent(false, btn.code, btn.symbol)}
                onPointerLeave={() => sendKeyEvent(false, btn.code, btn.symbol)}
                className="h-7 rounded-md bg-white/[0.07] hover:bg-white/[0.16] active:bg-white/30 text-white border border-white/10 flex flex-col items-center justify-center leading-none cursor-pointer transition-colors shadow-inner"
              >
                <span className="text-[10px] font-semibold">{btn.label}</span>
                {btn.sub && <span className="text-[5.5px] tracking-wider text-white/45 mt-0.5">{btn.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Center 176x220 Motorola viewport surrounded by pure black sidebars */}
      <div
        className="relative h-full max-w-full bg-black flex items-center justify-center"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <iframe
          ref={iframeRef}
          src={emulatorUrl}
          title={game.title}
          className="w-full h-full border-0 bg-black"
          allow="autoplay"
        />
      </div>

      {/* Subtle smoked-glass pills on the right black bar */}
      {visible && (
        <div className="absolute right-2.5 bottom-2.5 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowKeypad((prev) => !prev)}
            title="Clavier téléphone (SELECT)"
            className={`px-2 py-1 rounded-lg backdrop-blur-md border text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-all ${
              showKeypad
                ? 'bg-white/20 border-white/35 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]'
                : 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-white/65 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-2.5 h-2.5" />
            <span>123</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMixerOpen((prev) => !prev)}
            title="Mixeur Audio (♪ / M)"
            className={`px-2 py-1 rounded-lg backdrop-blur-md border text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-all ${
              isMixerOpen || isPlaying
                ? 'bg-white/20 border-white/35 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]'
                : 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-white/65 hover:text-white'
            }`}
          >
            <Music className="w-2.5 h-2.5" />
            <span>{isPlaying ? 'ON' : '♪'}</span>
          </button>
        </div>
      )}

      {/* Loading screen shown only if boot video finished before CheerpJ is ready */}
      {visible && !isReady && !errorMsg && (
        <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center text-white px-6 text-center">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/85 animate-spin mb-3" />
          <p className="text-xs font-semibold tracking-wide text-white/90">{game.title}</p>
          <p className="text-[10px] font-mono text-white/45 mt-1">
            Chargement du moteur Java ME (176×220)...
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-mono text-white/80 border border-white/15 cursor-pointer"
          >
            Retour XMB (◯)
          </button>
        </div>
      )}

      {/* Error state */}
      {visible && errorMsg && (
        <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center text-white px-6 text-center">
          <p className="text-xs font-semibold text-white">Erreur de lancement</p>
          <p className="text-[10px] font-mono text-white/60 mt-1 max-w-xs">{errorMsg}</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 px-3.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-[10px] font-mono text-white border border-white/20 cursor-pointer"
          >
            Retour au XMB
          </button>
        </div>
      )}

      {/* Compact PSP Glassmorphism Audio Mixer Overlay */}
      {visible && isMixerOpen && (
        <div
          className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsMixerOpen(false)}
        >
          <div
            className="w-full max-w-[258px] bg-[#0e1117]/80 backdrop-blur-xl border border-white/20 rounded-xl p-2.5 text-white shadow-[0_14px_38px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Music className="w-3 h-3 text-white/80" />
                <span className="text-[10.5px] font-semibold tracking-wide text-white/95">
                  Mixeur Audio PSP
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMixerOpen(false)}
                className="p-0.5 rounded hover:bg-white/10 text-white/55 hover:text-white cursor-pointer transition-colors"
                aria-label="Fermer le mixeur"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* XMB Music player controls */}
            <div className="bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 mb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[9.5px] font-medium truncate text-white/95">
                    {currentTrack ? currentTrack.title : 'Aucune musique'}
                  </p>
                  <p className="text-[8px] text-white/50 truncate">
                    {currentTrack ? currentTrack.artist : 'Lecture pour lancer la playlist'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={previousTrack}
                    className="p-1 rounded-md bg-white/[0.08] hover:bg-white/[0.18] text-white/85 cursor-pointer transition-colors"
                    aria-label="Piste précédente"
                  >
                    <SkipBack className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMusicPlayback}
                    className="p-1 rounded-md bg-white/90 hover:bg-white text-black cursor-pointer transition-colors"
                    aria-label="Lecture / Pause musique"
                  >
                    {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={nextTrack}
                    className="p-1 rounded-md bg-white/[0.08] hover:bg-white/[0.18] text-white/85 cursor-pointer transition-colors"
                    aria-label="Piste suivante"
                  >
                    <SkipForward className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Game volume slider */}
            <div
              onClick={() => setActiveMixerChannel(0)}
              className={`mb-1.5 rounded-lg px-1.5 py-1 border transition-colors ${
                activeMixerChannel === 0
                  ? 'bg-white/[0.06] border-white/15'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-between text-[9.5px] mb-1">
                <span className="flex items-center gap-1 text-white/85">
                  {gameVolume <= 0.01 ? (
                    <VolumeX className="w-2.5 h-2.5 text-white/50" />
                  ) : (
                    <Volume2 className="w-2.5 h-2.5 text-white/80" />
                  )}
                  Son du jeu
                </span>
                <span className="font-mono text-white/75">{Math.round(gameVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(gameVolume * 100)}
                onChange={(e) => {
                  setActiveMixerChannel(0);
                  updateGameVolume(Number(e.target.value) / 100);
                }}
                className="w-full accent-white cursor-pointer h-1 bg-white/15 rounded-lg"
              />
            </div>

            {/* XMB Music volume slider */}
            <div
              onClick={() => setActiveMixerChannel(1)}
              className={`mb-2 rounded-lg px-1.5 py-1 border transition-colors ${
                activeMixerChannel === 1
                  ? 'bg-white/[0.06] border-white/15'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-between text-[9.5px] mb-1">
                <span className="flex items-center gap-1 text-white/85">
                  <Music className="w-2.5 h-2.5 text-white/80" />
                  Musique XMB
                </span>
                <span className="font-mono text-white/75">{Math.round(musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(musicVolume * 100)}
                onChange={(e) => {
                  setActiveMixerChannel(1);
                  setMusicVolume(Number(e.target.value) / 100, false);
                }}
                className="w-full accent-white cursor-pointer h-1 bg-white/15 rounded-lg"
              />
            </div>

            {/* Quick mix presets */}
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => applyAudioPreset(1.0, 0, false)}
                className="py-1 px-1 rounded-md bg-white/[0.07] hover:bg-white/[0.16] text-[8.5px] text-white/85 border border-white/10 cursor-pointer transition-colors"
              >
                Jeu seul
              </button>
              <button
                type="button"
                onClick={() => applyAudioPreset(0.45, 0.75, true)}
                className="py-1 px-1 rounded-md bg-white/[0.07] hover:bg-white/[0.16] text-[8.5px] text-white/85 border border-white/10 cursor-pointer transition-colors"
              >
                Mix 45/75
              </button>
              <button
                type="button"
                onClick={() => applyAudioPreset(0, 0.9, true)}
                className="py-1 px-1 rounded-md bg-white/[0.12] hover:bg-white/[0.22] text-[8.5px] text-white border border-white/20 cursor-pointer transition-colors"
              >
                Musique
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
