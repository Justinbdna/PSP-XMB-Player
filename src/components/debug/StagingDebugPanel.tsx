import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../AudioEngine';

export interface StagingDebugPanelProps {
  debugHitboxes: boolean;
  onToggleHitboxes: (enabled: boolean) => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const StagingDebugPanel: React.FC<StagingDebugPanelProps> = ({
  debugHitboxes,
  onToggleHitboxes,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [gamepadName, setGamepadName] = useState<string>('Aucune manette');
  const [lastInput, setLastInput] = useState<{
    key: string;
    source: 'Clavier' | 'Manette';
    time: number;
  } | null>(null);

  // État XMB synchronisé via événements
  const [xmbState, setXmbState] = useState({
    viewMode: 'menu',
    catIndex: 1,
    itemIndex: 0,
    subItemIndex: 0,
    categoryName: 'Musique',
    subListType: 'ms',
  });

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isRealDSP,
    audioContextState,
  } = useAudio();

  const prevGamepadButtons = useRef<boolean[]>([]);

  // Raccourci clavier global pour ouvrir/fermer le tiroir (`²` ou `Ctrl+D`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '²' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Capture des entrées clavier pour le moniteur de diagnostic
      const keyMap: { [key: string]: string } = {
        arrowup: 'D-Pad Haut',
        arrowdown: 'D-Pad Bas',
        arrowleft: 'D-Pad Gauche',
        arrowright: 'D-Pad Droite',
        enter: '✕ Entrée',
        x: '✕ Croix',
        escape: '◯ Échap',
        backspace: '◯ Retour',
        o: '◯ Rond',
        a: '△ Triangle (A)',
        t: '△ Triangle (T)',
        s: '▢ Carré (S)',
        ' ': '▢ Espace',
        q: 'Gâchette L (Q)',
        '[': 'Gâchette L ([)',
        e: 'Gâchette R (E)',
        ']': 'Gâchette R (])',
        tab: 'SELECT (Tab)',
        v: 'SELECT (V)',
        h: 'PS Home (H)',
      };

      const keyLower = e.key.toLowerCase();
      if (keyMap[keyLower]) {
        setLastInput({
          key: keyMap[keyLower],
          source: 'Clavier',
          time: Date.now(),
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Écoute de l'état du menu XMB
  useEffect(() => {
    const onXmbDebug = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setXmbState(detail);
      }
    };

    window.addEventListener('psp_xmb_debug', onXmbDebug);
    return () => window.removeEventListener('psp_xmb_debug', onXmbDebug);
  }, []);

  // Mesure des FPS réels et scrutation de la manette à chaque frame
  useEffect(() => {
    let animId: number;
    let frames = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      frames++;
      if (now - lastTime >= 500) {
        const calculatedFps = Math.round((frames * 1000) / (now - lastTime));
        setFps(calculatedFps);
        frames = 0;
        lastTime = now;
      }

      // Scrutation Gamepad API
      if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0] || Array.from(gamepads).find(Boolean);

        if (gp) {
          const name = gp.id.length > 25 ? gp.id.slice(0, 25) + '…' : gp.id;
          setGamepadName(name);

          const buttonLabels: { [key: number]: string } = {
            0: '✕ Croix (0)',
            1: '◯ Rond (1)',
            2: '▢ Carré (2)',
            3: '△ Triangle (3)',
            4: 'L1 Gâchette L (4)',
            5: 'R1 Gâchette R (5)',
            8: 'SELECT (8)',
            9: 'START (9)',
            12: 'D-Pad Haut (12)',
            13: 'D-Pad Bas (13)',
            14: 'D-Pad Gauche (14)',
            15: 'D-Pad Droite (15)',
            16: 'PS / Home (16)',
          };

          gp.buttons.forEach((b, idx) => {
            if (b?.pressed && !prevGamepadButtons.current[idx]) {
              const label = buttonLabels[idx] || `Bouton ${idx}`;
              setLastInput({
                key: label,
                source: 'Manette',
                time: Date.now(),
              });
            }
          });

          prevGamepadButtons.current = gp.buttons.map((b) => b?.pressed ?? false);
        } else {
          setGamepadName('Aucune manette');
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Couleur d'affichage des FPS
  const fpsColorClass =
    fps >= 55
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : fps >= 30
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-red-400 bg-red-500/10 border-red-500/30';

  return (
    <>
      {/* 1. BOUTON FLOTTANT DISCRET D'ACCÈS AU TIROIR */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed top-3 right-3 z-50 bg-black/75 backdrop-blur-md border border-white/20 text-white/90 text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/10 hover:border-cyan-400 transition-all font-mono shadow-lg flex items-center gap-1.5 select-none"
        title="Ouvrir la suite de diagnostic Staging (Touche ² ou Ctrl+D)"
      >
        <span className="text-cyan-400">🛠️</span>
        <span className="font-bold tracking-wider">STAGING DEVTOOLS</span>
        <span className="text-[10px] bg-white/15 px-1 rounded text-white/70">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* 2. VOLET FLOTTANT RÉTRACTABLE DE DIAGNOSTIC */}
      {isOpen && (
        <div className="fixed top-12 right-3 w-84 max-h-[85vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/15 p-4 rounded-xl shadow-2xl text-xs font-mono text-zinc-300 z-50 space-y-3.5 animate-fade-in select-none">
          {/* En-tête */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-sm">DEV DIAGNOSTIC</span>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] px-1.5 py-0.2 rounded font-bold">
                STAGING
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-sm"
              title="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Module 1 : Performance (FPS réel) */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-white/5">
            <span className="text-zinc-400">Performance (FPS)</span>
            <div className={`px-2 py-0.5 rounded border font-bold text-[11px] ${fpsColorClass}`}>
              {fps} FPS
            </div>
          </div>

          {/* Module 2 : Interrupteur Hitboxes */}
          <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-zinc-900/60 border border-white/5 hover:bg-zinc-900 transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-white/90">Calque des Hitboxes</span>
              <span className="text-[9px] text-zinc-400">Contours rouges des boutons</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={debugHitboxes}
                onChange={(e) => onToggleHitboxes(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </div>
          </label>

          {/* Module 3 : Inspecteur Audio & DSP */}
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-zinc-400 font-bold text-[10px] uppercase">Audio & DSP</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                  audioContextState === 'running'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                AudioCtx: {audioContextState}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-zinc-500">Mode DSP :</span>
              <span
                className={`font-semibold ${
                  !currentTrack
                    ? 'text-zinc-500'
                    : isRealDSP
                    ? 'text-cyan-300'
                    : 'text-amber-300'
                }`}
              >
                {!currentTrack
                  ? 'Inactif'
                  : isRealDSP
                  ? 'Local (DSP FFT Réel)'
                  : 'iTunes (Simulation)'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-zinc-500">Volume Master :</span>
              <span className="text-white font-bold">{Math.round(volume * 100)}%</span>
            </div>

            {currentTrack && (
              <div className="flex flex-col gap-0.5 pt-1 text-[10px] text-zinc-400 border-t border-white/5">
                <span className="truncate text-white font-semibold">
                  {currentTrack.title} — {currentTrack.artist}
                </span>
                <div className="flex justify-between text-zinc-500 font-mono">
                  <span>{isPlaying ? '▶ Lecture active' : '❚❚ En pause'}</span>
                  <span>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Module 4 : Moniteur des Entrées (Manette & Clavier) */}
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-zinc-400 font-bold text-[10px] uppercase">Entrées Matérielles</span>
              <span className="text-[9px] text-zinc-400">{gamepadName}</span>
            </div>

            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-zinc-500">Dernière action :</span>
              {lastInput ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">
                    {lastInput.source}
                  </span>
                  <span className="text-cyan-300 font-bold">{lastInput.key}</span>
                </div>
              ) : (
                <span className="text-zinc-600">Aucune entrée</span>
              )}
            </div>
          </div>

          {/* Module 5 : Inspecteur d'état XMB */}
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-zinc-400 font-bold text-[10px] uppercase">État XMB</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                {xmbState.viewMode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
              <div className="flex justify-between bg-black/40 p-1.5 rounded border border-white/5">
                <span className="text-zinc-500">Catégorie :</span>
                <span className="text-white font-bold">{xmbState.categoryName}</span>
              </div>
              <div className="flex justify-between bg-black/40 p-1.5 rounded border border-white/5">
                <span className="text-zinc-500">CatIndex :</span>
                <span className="text-white font-bold">{xmbState.catIndex}</span>
              </div>
              <div className="flex justify-between bg-black/40 p-1.5 rounded border border-white/5">
                <span className="text-zinc-500">ItemIndex :</span>
                <span className="text-white font-bold">{xmbState.itemIndex}</span>
              </div>
              <div className="flex justify-between bg-black/40 p-1.5 rounded border border-white/5">
                <span className="text-zinc-500">SubItem :</span>
                <span className="text-white font-bold">{xmbState.subItemIndex}</span>
              </div>
            </div>
          </div>

          {/* Raccourci rappel */}
          <div className="text-[9px] text-zinc-500 text-center pt-1 border-t border-white/5">
            Raccourci bascule : Touche <b className="text-zinc-400">²</b> ou <b className="text-zinc-400">Ctrl+D</b>
          </div>
        </div>
      )}
    </>
  );
};
