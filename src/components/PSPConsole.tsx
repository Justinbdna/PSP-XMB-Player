import React, { useState, useCallback, useEffect, useRef } from 'react';
import { WaveBackground } from './WaveBackground';
import { XMBMenu } from './XMBMenu';
import { PSPTheme, PSP_OFFICIAL_THEMES } from '../types/xmb';
import { useAudio } from './AudioEngine';
import { sound } from '../services/sound';
import { useGamepad } from '../hooks/useGamepad';

// Chassis Configuration allowing easy switching between models/colors later
export const PSP_CHASSIS_CONFIG = {
  activeModel: 'psp-street-e1000-black',
  models: {
    'psp-street-e1000-black': {
      id: 'psp-street-e1000-black',
      name: 'Sony PSP Street (E1000) Noir Mat',
      image: '/psp-street-e1000.png',
      aspectRatio: 1024 / 433, // ~2.36:1
    },
  },
};

export interface PSPConsoleProps {
  debugHitboxes?: boolean;
}

export const PSPConsole: React.FC<PSPConsoleProps> = ({ debugHitboxes = false }) => {
  // Initialisation du thème officiel depuis le localStorage ou Novembre par défaut
  const getInitialTheme = (): PSPTheme => {
    try {
      const savedKey = localStorage.getItem('psp_wave_theme');
      if (savedKey && PSP_OFFICIAL_THEMES[savedKey]) {
        return PSP_OFFICIAL_THEMES[savedKey];
      }
    } catch {
      // Ignorer erreur localStorage
    }
    return PSP_OFFICIAL_THEMES.novembre;
  };

  const [theme, setThemeState] = useState<PSPTheme>(getInitialTheme);

  // Sauvegarde et mise à jour du thème dans le Canvas & localStorage
  const setTheme = useCallback((newTheme: PSPTheme) => {
    setThemeState(newTheme);
    try {
      if (newTheme.id) {
        localStorage.setItem('psp_wave_theme', newTheme.id);
      }
    } catch (e) {
      console.warn('Erreur de persistance du thème:', e);
    }
  }, []);

  const [externalCommand, setExternalCommand] = useState<{
    action: string;
    timestamp: number;
  } | null>(null);

  const { togglePlay, showVolumeOSD, volume } = useAudio();

  // Machine à états d'alimentation : 'off' (veille) -> 'booting' (coldboot) -> 'on' (XMB)
  const [powerState, setPowerState] = useState<'off' | 'booting' | 'on'>('off');
  const coldBootVideoRef = useRef<HTMLVideoElement | null>(null);

  const handlePowerOn = useCallback(() => {
    setPowerState((prev) => {
      if (prev !== 'off') return prev;
      return 'booting';
    });
  }, []);

  const skipBoot = useCallback(() => {
    setPowerState((prev) => (prev === 'booting' ? 'on' : prev));
  }, []);

  useEffect(() => {
    if (powerState === 'booting' && coldBootVideoRef.current) {
      coldBootVideoRef.current.volume = 0.35; // 35 % pour éviter toute saturation
      coldBootVideoRef.current.play().catch(() => {
        // repli silencieux
      });
    }
  }, [powerState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (powerState === 'off' && (e.key === 'Home' || e.key === 'h' || e.key === 'H')) {
        handlePowerOn();
      } else if (powerState === 'booting' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        skipBoot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [powerState, handlePowerOn, skipBoot]);

  // Chantier 1 : Détection mode portrait (Rotate Guard) et auto-scale dézoomé de 10%
  const [scale, setScale] = useState<number>(1);
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return vw <= 950 && vh > vw;
  });

  useEffect(() => {
    const updateScale = () => {
      // Zone visible réelle tenant compte des barres de navigation Safari
      const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;

      // Détection mode portrait (Rotate Guard sous 950px)
      const portrait = vw <= 950 && vh > vw;
      setIsPortrait(portrait);

      // Utilisation maximale de la zone disponible
      const paddingX = 20;
      const paddingY = 4; // Bord à bord vertical strict

      const targetWidth = 940;
      const targetHeight = 460;

      const availableWidth = Math.max(300, vw - paddingX);
      const availableHeight = Math.max(200, vh - paddingY);

      const scaleX = availableWidth / targetWidth;
      const scaleY = availableHeight / targetHeight;

      // Dézoom de 10% pour un cadrage équilibré
      const computedScale = Math.min(scaleX, scaleY) * 0.90;

      setScale(Math.max(0.30, computedScale));
    };

    updateScale();

    // Écoute des redimensionnements de la zone Safari
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateScale);
      window.visualViewport.addEventListener('scroll', updateScale);
    }
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateScale);
        window.visualViewport.removeEventListener('scroll', updateScale);
      }
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

  // Send command to XMB screen without losing focus
  const sendCommand = useCallback((action: string) => {
    if (powerState === 'off') {
      if (action === 'home') {
        handlePowerOn();
      }
      return;
    }
    if (powerState === 'booting') {
      if (action === 'cross' || action === 'start' || action === 'home') {
        skipBoot();
      }
      return;
    }
    (document.activeElement as HTMLElement)?.blur();
    setExternalCommand({ action, timestamp: Date.now() });
  }, [powerState, handlePowerOn, skipBoot]);

  // Standard Gamepad Controller Integration via navigator.getGamepads()
  useGamepad({
    onUp: () => {
      sound.playTick();
      sendCommand('up');
    },
    onDown: () => {
      sound.playTick();
      sendCommand('down');
    },
    onLeft: () => {
      sound.playTick();
      sendCommand('left');
    },
    onRight: () => {
      sound.playTick();
      sendCommand('right');
    },
    onCross: () => {
      sound.playEnter();
      sendCommand('cross');
    },
    onCircle: () => {
      sound.playBack();
      sendCommand('circle');
    },
    onSquare: () => {
      sound.playTick();
      sendCommand('square');
    },
    onTriangle: () => {
      sound.playOption();
      sendCommand('triangle');
    },
    onSelect: () => {
      sendCommand('select');
    },
    onStart: () => {
      togglePlay();
    },
    onHome: () => {
      if (powerState === 'off') {
        handlePowerOn();
        return;
      }
      sound.playBack();
      sendCommand('home');
    },
    onL: () => {
      sound.playTick();
      sendCommand('trigger_l');
    },
    onR: () => {
      sound.playTick();
      sendCommand('trigger_r');
    },
  });

  const activeChassis = PSP_CHASSIS_CONFIG.models['psp-street-e1000-black'];

  // Helper styling for debug hitboxes with 1:1 circular ratio
  const getHitboxStyle = (pos: React.CSSProperties, isCircle = false): React.CSSProperties => ({
    ...pos,
    borderRadius: isCircle ? '50%' : (pos.borderRadius || '4px'),
    aspectRatio: (isCircle || pos.aspectRatio) ? (pos.aspectRatio || '1 / 1') : undefined,
    ...(debugHitboxes
      ? {
          outline: '2px solid rgba(255, 0, 0, 0.7)',
          backgroundColor: 'rgba(255, 0, 0, 0.2)',
          opacity: 1,
          zIndex: 50,
        }
      : {
          opacity: 0,
        }),
  });

  return (
    <div className="relative min-h-screen h-screen w-full bg-[#08090c] flex flex-col items-center justify-center p-1 sm:p-6 overflow-hidden font-['Inter',sans-serif]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(40,55,75,0.18),rgba(0,0,0,0.96))] pointer-events-none"></div>

      {/* ========================================================
          CHANTIER 1 : ÉCRAN DE GARDE EN MODE PORTRAIT (ROTATE GUARD)
          ======================================================== */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center text-white text-center p-6 select-none">
          {/* Smartphone avec animation douce */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="w-12 h-20 border-2 border-white/80 rounded-2xl flex flex-col items-center justify-between p-2 shadow-[0_0_25px_rgba(255,255,255,0.2)] animate-pulse">
              <div className="w-4 h-1 bg-white/40 rounded-full" />
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-emerald-400 animate-spin"
                  style={{ animationDuration: '4s' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <div className="w-2 h-2 border border-white/40 rounded-full" />
            </div>
          </div>
          <h2 className="text-base font-semibold tracking-wide">Mode Paysage Requis</h2>
          <p className="text-xs text-white/60 mt-1 max-w-xs font-mono">
            Pivote ton appareil à l'horizontale pour utiliser la console.
          </p>
        </div>
      )}

      {/* ========================================================
          CONTENEUR GLOBAL AU RATIO FIXE DE LA CONSOLE (~2.36:1)
          Mécanique d'Architecture Calque Style Apple Music 404
          ======================================================== */}
      <div
        className="relative z-10 w-[940px] max-w-none aspect-[1024/433] select-none flex items-center justify-center drop-shadow-[0_35px_50px_rgba(0,0,0,0.95)] flex-shrink-0"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          '--psp-chassis-url': `url(${activeChassis.image})`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        } as React.CSSProperties}
      >
        {/* ========================================================
            CALQUE 1 — FOND : BOÎTIER PSP STREET E1000 VERROUILLÉ
            (Non sélectionnable, non déplaçable, non téléchargeable)
            ======================================================== */}
        <img
          src={activeChassis.image}
          alt={activeChassis.name}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
          style={{
            WebkitUserDrag: 'none',
            userSelect: 'none',
          } as React.CSSProperties & { WebkitUserDrag: string }}
          draggable={false}
        />

        {/* ========================================================
            CALQUE 2 — VIEWPORT ÉCRAN LCD (#psp-screen)
            Coordonnées exactes : left 21.6% | top 7.5% | width 56.8% | height 77.2%
            ======================================================== */}
        <div
          id="psp-screen"
          className="absolute z-10 overflow-hidden bg-black"
          style={{
            left: '21.6%',
            top: '7.5%',
            width: '56.8%',
            height: '77.2%',
            borderRadius: '4px',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.95)',
          }}
        >
          {powerState === 'on' ? (
            <>
              {/* Fond dynamique sinusoïdal PSP en Canvas 2D */}
              <WaveBackground theme={theme} />

              {/* Interface XMB, navigation, lecteur vidéo MP4, lecteur audio et jeux */}
              <XMBMenu
                currentTheme={theme}
                onThemeChange={setTheme}
                externalCommand={externalCommand}
                debugHitboxes={debugHitboxes}
              />

              {/* Authentic PSP Volume OSD Overlay */}
              {showVolumeOSD && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#121620]/95 backdrop-blur-md border border-white/25 rounded-md px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl animate-fade-in pointer-events-none">
                  <span className="text-xs text-white/90">🔊</span>
                  <div className="flex gap-[2px] items-center">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const filled = i < Math.round(volume * 24);
                      return (
                        <div
                          key={i}
                          className={`w-1.5 h-3 rounded-[1px] transition-colors ${
                            filled
                              ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]'
                              : 'bg-white/15'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white/90 min-w-[20px] text-right">
                    {Math.round(volume * 30)}
                  </span>
                </div>
              )}

              {/* Reflet subtil de vitre LCD */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06]"></div>
            </>
          ) : powerState === 'booting' ? (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <video
                ref={coldBootVideoRef}
                src="/media/coldboot.mp4"
                playsInline
                autoPlay
                onEnded={() => setPowerState('on')}
                onError={() => setPowerState('on')}
                onClick={skipBoot}
                className="w-full h-full object-cover select-none cursor-pointer"
              />
            </div>
          ) : (
            <div
              className="w-full h-full bg-black cursor-pointer flex flex-col items-center justify-center"
              onClick={handlePowerOn}
            />
          )}
        </div>

        {/* ========================================================
            CALQUE 3 — COMMANDES / HOTSPOTS INVISIBLES
            (Recalibrage chirurgical au centre d'ancrage transform -50%, -50%)
            ======================================================== */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* ----- 1. GÂCHETTES SUPÉRIEURES (L & R TRIGGERS) ----- */}
          {/* Gâchette L (Gauche) : (8.5%, 3.5%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('trigger_l');
            }}
            aria-label="Gâchette L (Précédent / Catégorie Gauche)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle({ top: '3.5%', left: '8.5%', width: '14%', height: '7%', borderRadius: '4px' })}
          />

          {/* Gâchette R (Droite) : (91.5%, 3.5%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('trigger_r');
            }}
            aria-label="Gâchette R (Suivant / Catégorie Droite)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle({ top: '3.5%', left: '91.5%', width: '14%', height: '7%', borderRadius: '4px' })}
          />

          {/* ----- 2. D-PAD (CROIX DIRECTIONNELLE GAUCHE) - Centre à (11.2%, 44%) ----- */}
          {/* Haut : left 11.2%, top 32.5%, width 4.8%, aspect-ratio 1 / 1, border-radius 6px */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('up');
            }}
            aria-label="D-Pad Haut"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '32.5%', left: '11.2%', width: '4.8%', aspectRatio: '1 / 1', borderRadius: '6px' })}
          />

          {/* Bas : left 11.2%, top 55.5%, width 4.8%, aspect-ratio 1 / 1, border-radius 6px */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('down');
            }}
            aria-label="D-Pad Bas"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '55.5%', left: '11.2%', width: '4.8%', aspectRatio: '1 / 1', borderRadius: '6px' })}
          />

          {/* Gauche : left 6.2%, top 44.0%, width 4.8%, aspect-ratio 1 / 1, border-radius 6px */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('left');
            }}
            aria-label="D-Pad Gauche"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '44.0%', left: '6.2%', width: '4.8%', aspectRatio: '1 / 1', borderRadius: '6px' })}
          />

          {/* Droite : left 16.2%, top 44.0%, width 4.8%, aspect-ratio 1 / 1, border-radius 6px */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('right');
            }}
            aria-label="D-Pad Droite"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '44.0%', left: '16.2%', width: '4.8%', aspectRatio: '1 / 1', borderRadius: '6px' })}
          />

          {/* ----- 3. BOUTONS D'ACTION (CLUSTER DROIT : △, ◯, ✕, ▢) - Centre à (89.5%, 44%) ----- */}
          {/* Triangle (△ - Haut) : left 89.5%, top 29.5%, width 5.6%, cercle parfait */}
          <button
            onClick={() => {
              sound.playOption();
              sendCommand('triangle');
            }}
            aria-label="Triangle (Options contextuelles)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '29.5%', left: '89.5%', width: '5.6%' }, true)}
          />

          {/* Croix (✕ - Bas) : left 89.5%, top 58.5%, width 5.6%, cercle parfait */}
          <button
            onClick={() => {
              sound.playEnter();
              sendCommand('cross');
            }}
            aria-label="Croix (Valider / Lecture)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '58.5%', left: '89.5%', width: '5.6%' }, true)}
          />

          {/* Carré (▢ - Gauche) : left 83.5%, top 44.0%, width 5.6%, cercle parfait */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('square');
            }}
            aria-label="Carré (Bascule Play / Pause immédiate)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '44.0%', left: '83.5%', width: '5.6%' }, true)}
          />

          {/* Rond (◯ - Droite) : left 95.5%, top 44.0%, width 5.6%, cercle parfait */}
          <button
            onClick={() => {
              sound.playBack();
              sendCommand('circle');
            }}
            aria-label="Rond (Retour arrière)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '44.0%', left: '95.5%', width: '5.6%' }, true)}
          />

          {/* ----- 4. BARRE INFÉRIEURE : BOUTONS TACTILES PSP STREET (+20% surface cliquable) ----- */}
          {/* Touche PS / Home : left 25.2%, top 92%, width 5%, height 6% */}
          <button
            onClick={() => {
              if (powerState === 'off') {
                handlePowerOn();
                return;
              }
              sound.playBack();
              sendCommand('home');
            }}
            aria-label="Touche PS / Accueil (Allumage en veille)"
            className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75 ${
              powerState === 'off' ? 'animate-pulse' : ''
            }`}
            style={{
              ...getHitboxStyle({ top: '92%', left: '25.2%', width: '5%', height: '6%', borderRadius: '4px' }),
              ...(powerState === 'off'
                ? {
                    opacity: 1,
                    boxShadow: '0 0 15px rgba(6, 182, 212, 0.7), inset 0 0 8px rgba(6, 182, 212, 0.5)',
                    border: '1.5px solid rgba(6, 182, 212, 0.9)',
                    backgroundColor: 'rgba(6, 182, 212, 0.25)',
                    zIndex: 40,
                  }
                : {}),
            }}
          />

          {/* Volume - : left 31.0%, top 92%, width 4.5%, height 6% */}
          <button
            onClick={() => {
              sendCommand('vol_down');
              sound.playTick();
            }}
            aria-label="Volume -"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '31.0%', width: '4.5%', height: '6%', borderRadius: '4px' })}
          />

          {/* Volume + : recalibré chirurgicalement sur (+) à left 38.6%, top 92%, width 4.5%, height 6% */}
          <button
            onClick={() => {
              sendCommand('vol_up');
              sound.playTick();
            }}
            aria-label="Volume +"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '38.6%', width: '4.5%', height: '6%', borderRadius: '4px' })}
          />

          {/* SELECT : change le visualiseur dans le lecteur audio ou le thème en boucle */}
          <button
            onClick={() => {
              sendCommand('select');
            }}
            aria-label="SELECT"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '66.5%', width: '6%', height: '6%', borderRadius: '4px' })}
          />

          {/* START : left 74.5%, top 92%, width 6%, height 6% */}
          <button
            onClick={() => {
              sendCommand('start');
            }}
            aria-label="START (Pause / Play / Mixeur)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '74.5%', width: '6%', height: '6%', borderRadius: '4px' })}
          />
        </div>
      </div>

      {/* COMMANDES MATÉRIELLES DU CHÂSSIS & CAPSULE D'AIDE INTERACTIVE */}
      {powerState === 'off' ? (
        <button
          onClick={handlePowerOn}
          className="max-w-4xl mx-auto mt-4 px-6 py-2.5 bg-black/70 hover:bg-black/90 border border-cyan-500/30 hover:border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] rounded-full transition-all flex items-center justify-center select-none cursor-pointer group active:scale-95"
        >
          <p className="text-xs font-mono text-cyan-400 font-medium tracking-wide group-hover:text-cyan-300 transition-colors">
            💡 Appuie sur le bouton PlayStation Ⓢ pour allumer la PSP
          </p>
        </button>
      ) : powerState === 'booting' ? (
        <div className="max-w-4xl mx-auto mt-4 px-6 py-2.5 bg-black/70 border border-white/10 rounded-full transition-all flex items-center justify-center select-none shadow-lg">
          <p className="text-xs font-mono text-white/60 animate-pulse">
            Démarrage du système Sony Computer Entertainment...
          </p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto mt-4 px-5 py-2 bg-black/40 hover:bg-black/80 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-full transition-opacity duration-300 opacity-25 hover:opacity-90 flex items-center justify-center select-none shadow-lg">
          <p className="text-[11px] font-mono text-white/50 tracking-wide select-none">
            🎮 D-Pad • Ⓢ Menu Home • VOL +/- • SELECT • START
          </p>
        </div>
      )}
    </div>
  );
};
