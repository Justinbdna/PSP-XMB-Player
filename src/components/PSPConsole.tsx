import React, { useState, useCallback, useEffect, useRef } from 'react';
import { WaveBackground } from './WaveBackground';
import { XMBMenu } from './XMBMenu';
import {
  PSPTheme,
  PSP_OFFICIAL_THEMES,
  XMBContextInfo,
  PSPModelId,
  PSP_CHASSIS_CONFIG,
  PSPHotspotRect,
  BRIGHTNESS_LEVELS,
  BrightnessLevel,
  getBrightnessMeta,
} from '../types/xmb';
import { useAudio } from './AudioEngine';
import { sound } from '../services/sound';
import { useGamepad } from '../hooks/useGamepad';

export { PSP_CHASSIS_CONFIG };

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

  const getInitialModelId = (): PSPModelId => {
    try {
      const saved = localStorage.getItem('psp_console_model');
      if (saved === 'psp-2000-silver' || saved === 'psp-street-e1000-black') {
        return saved;
      }
    } catch {
      // Ignorer erreur localStorage
    }
    return PSP_CHASSIS_CONFIG.activeModel;
  };

  const [modelId, setModelId] = useState<PSPModelId>(getInitialModelId);
  const activeChassis = PSP_CHASSIS_CONFIG.models[modelId];

  const handleModelChange = useCallback((nextModelId: PSPModelId) => {
    setModelId(nextModelId);
    try {
      localStorage.setItem('psp_console_model', nextModelId);
    } catch (e) {
      console.warn('Erreur de persistance du modèle PSP:', e);
    }
  }, []);

  const getInitialBrightness = (): BrightnessLevel => {
    try {
      const saved = Number(localStorage.getItem('psp_screen_brightness'));
      if ((BRIGHTNESS_LEVELS as readonly number[]).includes(saved)) {
        return saved as BrightnessLevel;
      }
    } catch {
      // Ignorer erreur localStorage
    }
    return 100;
  };

  const [brightness, setBrightness] = useState<BrightnessLevel>(getInitialBrightness);
  const [showBrightnessOSD, setShowBrightnessOSD] = useState<boolean>(false);
  const brightnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessMeta = getBrightnessMeta(brightness);

  const [externalCommand, setExternalCommand] = useState<{
    action: string;
    timestamp: number;
  } | null>(null);
  const [xmbContext, setXmbContext] = useState<XMBContextInfo>('xmb_menu');

  const { togglePlay, showVolumeOSD, volume } = useAudio();

  // Machine à états d'alimentation : 'off' (veille) -> 'booting' (coldboot) -> 'on' (XMB)
  const [powerState, setPowerState] = useState<'off' | 'booting' | 'on'>('off');
  const [isBootFading, setIsBootFading] = useState<boolean>(false);
  const coldBootVideoRef = useRef<HTMLVideoElement | null>(null);

  const cycleBrightness = useCallback(() => {
    if (powerState === 'off') return;
    sound.playTick();
    setBrightness((prev) => {
      const idx = BRIGHTNESS_LEVELS.indexOf(prev);
      const next = BRIGHTNESS_LEVELS[(idx + 1) % BRIGHTNESS_LEVELS.length];
      try {
        localStorage.setItem('psp_screen_brightness', String(next));
      } catch {}
      return next;
    });
    setShowBrightnessOSD(true);
    if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current);
    brightnessTimerRef.current = setTimeout(() => setShowBrightnessOSD(false), 2200);
  }, [powerState]);

  useEffect(() => {
    return () => {
      if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current);
    };
  }, []);

  const handlePowerOn = useCallback(() => {
    setPowerState((prev) => {
      if (prev !== 'off') return prev;
      return 'booting';
    });
  }, []);

  // Fin de vidéo : mini fondu de sortie fluide d'une seconde
  const handleBootEnded = useCallback(() => {
    setIsBootFading(true);
    setTimeout(() => {
      setPowerState('on');
      setIsBootFading(false);
    }, 1000);
  }, []);

  const skipBoot = useCallback(() => {
    setIsBootFading(true);
    setTimeout(() => {
      setPowerState('on');
      setIsBootFading(false);
    }, 300);
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
      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);

      if (powerState === 'off' && !isEditable && (e.key === 'Home' || e.key === 'h' || e.key === 'H')) {
        handlePowerOn();
      } else if (powerState === 'booting' && !isEditable && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        skipBoot();
      } else if (powerState !== 'off' && !isEditable && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        cycleBrightness();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [powerState, handlePowerOn, skipBoot, cycleBrightness]);

  // Chantier 1 : Détection mode portrait (Rotate Guard) et auto-scale adaptatif safe-area / Dynamic Island
  const safeAreaProbeRef = useRef<HTMLDivElement | null>(null);
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

      // Lecture des marges matérielles réelles (Dynamic Island / encoche / indicateur Home iOS)
      let safeTop = 0;
      let safeRight = 0;
      let safeBottom = 0;
      let safeLeft = 0;
      if (safeAreaProbeRef.current) {
        const cs = window.getComputedStyle(safeAreaProbeRef.current);
        safeTop = parseFloat(cs.paddingTop) || 0;
        safeRight = parseFloat(cs.paddingRight) || 0;
        safeBottom = parseFloat(cs.paddingBottom) || 0;
        safeLeft = parseFloat(cs.paddingLeft) || 0;
      }

      // Détection mode portrait (Rotate Guard sous 950px)
      const portrait = vw <= 950 && vh > vw;
      setIsPortrait(portrait);

      const hasHorizontalCutout = safeLeft > 0 || safeRight > 0;
      const symmetricCutoutX = Math.max(0, Math.max(safeLeft, safeRight) - 10) * 2;
      const paddingX = hasHorizontalCutout ? Math.max(20, symmetricCutoutX) : vw <= 960 ? 16 : 20;
      const paddingY = Math.max(4, safeTop + safeBottom);

      const targetWidth = 940;
      const chassisHeightAtBase = Math.round(targetWidth * (activeChassis.imageHeight / activeChassis.imageWidth));
      const targetHeight = powerState === 'off' ? chassisHeightAtBase + 62 : chassisHeightAtBase + 8;

      const availableWidth = Math.max(300, vw - paddingX);
      const availableHeight = Math.max(200, vh - paddingY);

      const scaleX = availableWidth / targetWidth;
      const scaleY = availableHeight / targetHeight;

      // Marge équilibrée : préserve le dégagement devant la Dynamic Island (~48pt), légèrement plus large ailleurs
      const fillFactor = hasHorizontalCutout ? 0.995 : vw <= 960 || vh <= 500 ? 0.92 : 0.93;
      const computedScale = Math.min(scaleX, scaleY) * fillFactor;

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
  }, [powerState, activeChassis.id, activeChassis.imageWidth, activeChassis.imageHeight]);

  // Send command to XMB screen without losing focus
  const sendCommand = useCallback((action: string) => {
    if (powerState === 'off') {
      if (action === 'home') {
        handlePowerOn();
      }
      return;
    }
    if (powerState === 'booting' && !isBootFading) {
      if (action === 'cross' || action === 'start' || action === 'home') {
        skipBoot();
      }
      return;
    }
    (document.activeElement as HTMLElement)?.blur();
    setExternalCommand({ action, timestamp: Date.now() });
  }, [powerState, isBootFading, handlePowerOn, skipBoot]);

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

  // Helper styling for debug hitboxes with 1:1 circular ratio
  const getHitboxStyle = (pos: PSPHotspotRect, forceCircle = false): React.CSSProperties => {
    const { isCircle: rectCircle, ...cssProps } = pos;
    const circleMode = forceCircle || Boolean(rectCircle);
    return {
      ...cssProps,
      borderRadius: circleMode ? '50%' : (cssProps.borderRadius || '4px'),
      aspectRatio: (circleMode || cssProps.aspectRatio) ? (cssProps.aspectRatio || '1 / 1') : undefined,
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
    };
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#08090c] flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden font-['Inter',sans-serif]">
      {/* Probe invisible pour mesurer env(safe-area-inset-*) en pixels CSS */}
      <div
        ref={safeAreaProbeRef}
        aria-hidden="true"
        className="fixed top-0 left-0 w-0 h-0 pointer-events-none opacity-0"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      />
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
          1. CONTENEUR GLOBAL AU RATIO DU CHÂSSIS ACTIF
          ======================================================== */}
      <div
        className="relative flex items-center justify-center transition-transform duration-200 flex-shrink-0"
        style={{
          width: `${940 * scale}px`,
          height: `${(940 * activeChassis.imageHeight / activeChassis.imageWidth) * scale}px`,
        }}
      >
        <div
          className="relative z-10 w-[940px] max-w-none select-none flex items-center justify-center drop-shadow-[0_35px_50px_rgba(0,0,0,0.95)] flex-shrink-0"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            aspectRatio: `${activeChassis.imageWidth} / ${activeChassis.imageHeight}`,
            '--psp-chassis-url': `url(${activeChassis.image})`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          } as React.CSSProperties}
        >
        {/* ========================================================
            CALQUE 1 — FOND : BOÎTIER PSP ACTIF VERROUILLÉ
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

        {/* Voyant LED POWER vert (flanc droit PSP-2000) */}
        {activeChassis.powerLed && (
          <div
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center"
            style={{ top: activeChassis.powerLed.top, left: activeChassis.powerLed.left }}
          >
            {powerState !== 'off' ? (
              <span
                className={`w-[7px] h-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_3px_rgba(52,211,153,0.95),0_0_18px_6px_rgba(16,185,129,0.55)] transition-opacity duration-300 ${
                  powerState === 'booting' ? 'animate-pulse' : ''
                }`}
              />
            ) : (
              <span className="w-[6px] h-[6px] rounded-full bg-[#14201b]/70" />
            )}
          </div>
        )}

        {/* ========================================================
            CALQUE 2 — VIEWPORT ÉCRAN LCD (#psp-screen)
            Coordonnées calibrées dynamiquement selon le modèle actif
            ======================================================== */}
        <div
          id="psp-screen"
          className="absolute z-10 overflow-hidden bg-black"
          style={{
            left: activeChassis.screen.left,
            top: activeChassis.screen.top,
            width: activeChassis.screen.width,
            height: activeChassis.screen.height,
            borderRadius: '4px',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.95)',
          }}
        >
          {powerState !== 'off' ? (
            <>
              {/* Fond dynamique sinusoïdal PSP en Canvas 2D (en pause pendant un jeu pour économiser CPU/GPU) */}
              <WaveBackground theme={theme} paused={xmbContext === 'game'} />

              {/* Interface XMB, navigation, lecteur vidéo MP4, lecteur audio et jeux */}
              <XMBMenu
                currentTheme={theme}
                onThemeChange={setTheme}
                currentChassis={activeChassis}
                onModelChange={handleModelChange}
                brightness={brightness}
                onCycleBrightness={cycleBrightness}
                externalCommand={externalCommand}
                debugHitboxes={debugHitboxes}
                onContextChange={setXmbContext}
              />

              {/* Voile d'assombrissement écran (5 paliers : 100% -> 20% Nuit) */}
              {brightnessMeta.dimOpacity > 0 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-40 bg-black pointer-events-none transition-opacity duration-200"
                  style={{ opacity: brightnessMeta.dimOpacity }}
                />
              )}

              {/* OSD Volume XMB verre fumé (glassmorphism transparent) */}
              {showVolumeOSD && (
                <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-b from-white/[0.16] via-white/[0.08] to-black/35 backdrop-blur-xl border border-white/25 rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28)] animate-fade-in pointer-events-none">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/90 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  <div className="flex gap-[2.5px] items-center">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const filled = i < Math.round(volume * 20);
                      return (
                        <div
                          key={i}
                          className={`w-[3px] h-2.5 rounded-full transition-all duration-150 ${
                            filled
                              ? 'bg-white/95 shadow-[0_0_6px_rgba(255,255,255,0.7)]'
                              : 'bg-white/15'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[9.5px] font-medium tracking-wider text-white/90 min-w-[18px] text-right tabular-nums">
                    {Math.round(volume * 30)}
                  </span>
                </div>
              )}

              {/* OSD Luminosité XMB verre fumé (glassmorphism transparent à 5 paliers) */}
              {showBrightnessOSD && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 z-50 bg-gradient-to-b from-white/[0.16] via-white/[0.08] to-black/35 backdrop-blur-xl border border-white/25 rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28)] animate-fade-in pointer-events-none transition-all ${
                    showVolumeOSD ? 'bottom-16' : 'bottom-7'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/90 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <div className="flex gap-1.5 items-center">
                    {Array.from({ length: BRIGHTNESS_LEVELS.length }).map((_, i) => {
                      const filled = i < brightnessMeta.step;
                      return (
                        <div
                          key={i}
                          className={`w-4 h-1.5 rounded-full transition-all duration-200 ${
                            filled
                              ? brightnessMeta.isNight
                                ? 'bg-white/75 shadow-[0_0_6px_rgba(255,255,255,0.45)]'
                                : 'bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.75)]'
                              : 'bg-white/15'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[9.5px] font-medium tracking-wider text-white/90 whitespace-nowrap tabular-nums">
                    {brightnessMeta.isNight ? `${brightness}% · Nuit` : `${brightness}%`}
                  </span>
                </div>
              )}

              {/* Reflet subtil de vitre LCD */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06]"></div>

              {/* Superposition vidéo de démarrage avec mini fondu de sortie fluide d'une seconde */}
              {powerState === 'booting' && (
                <div
                  className={`absolute inset-0 z-30 bg-black flex items-center justify-center transition-opacity duration-1000 ${
                    isBootFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <video
                    ref={coldBootVideoRef}
                    src="/media/startup.mp4"
                    playsInline
                    autoPlay
                    onEnded={handleBootEnded}
                    onError={handleBootEnded}
                    onClick={skipBoot}
                    className="w-full h-full object-cover select-none cursor-pointer"
                  />
                </div>
              )}
            </>
          ) : (
            <div
              className="w-full h-full bg-black cursor-pointer flex flex-col items-center justify-center"
              onClick={handlePowerOn}
            />
          )}
        </div>

        {/* ========================================================
            CALQUE 3 — COMMANDES / HOTSPOTS INVISIBLES PAR MODÈLE
            ======================================================== */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* ----- 1. GÂCHETTES SUPÉRIEURES (L & R TRIGGERS) ----- */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('trigger_l');
            }}
            aria-label="Gâchette L (Précédent / Catégorie Gauche)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.triggerL)}
          />
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('trigger_r');
            }}
            aria-label="Gâchette R (Suivant / Catégorie Droite)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.triggerR)}
          />

          {/* ----- 2. D-PAD (CROIX DIRECTIONNELLE GAUCHE) ----- */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('up');
            }}
            aria-label="D-Pad Haut"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.dpadUp)}
          />
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('down');
            }}
            aria-label="D-Pad Bas"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.dpadDown)}
          />
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('left');
            }}
            aria-label="D-Pad Gauche"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.dpadLeft)}
          />
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('right');
            }}
            aria-label="D-Pad Droite"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.dpadRight)}
          />

          {/* ----- 3. BOUTONS D'ACTION (△, ◯, ✕, ▢) ----- */}
          <button
            onClick={() => {
              sound.playOption();
              sendCommand('triangle');
            }}
            aria-label="Triangle (Options contextuelles)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.triangle, true)}
          />
          <button
            onClick={() => {
              sound.playEnter();
              sendCommand('cross');
            }}
            aria-label="Croix (Valider / Lecture)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.cross, true)}
          />
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('square');
            }}
            aria-label="Carré (Bascule Play / Pause immédiate)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.square, true)}
          />
          <button
            onClick={() => {
              sound.playBack();
              sendCommand('circle');
            }}
            aria-label="Rond (Retour arrière)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.circle, true)}
          />

          {/* ----- 4. BARRE INFÉRIEURE DU CHÂSSIS ----- */}
          <button
            onClick={() => {
              if (powerState === 'off') {
                handlePowerOn();
                return;
              }
              sound.playBack();
              sendCommand('home');
            }}
            aria-label="Touche HOME / PS (Allumage en veille)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75 flex items-center justify-center overflow-visible z-30"
            style={{
              ...getHitboxStyle(activeChassis.hotspots.home),
              opacity: debugHitboxes ? 1 : powerState === 'off' ? 1 : 0,
            }}
          >
            {powerState === 'off' && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-transparent border border-white/60 shadow-[0_0_16px_5px_rgba(255,255,255,0.9),0_0_32px_10px_rgba(255,255,255,0.45)] animate-pulse pointer-events-none z-30" />
            )}
          </button>

          <button
            onClick={() => {
              sendCommand('vol_down');
              sound.playTick();
            }}
            aria-label="Volume -"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.volDown)}
          />

          <button
            onClick={() => {
              sendCommand('vol_up');
              sound.playTick();
            }}
            aria-label="Volume +"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.volUp)}
          />

          {/* Bouton Écran / Luminosité physique (uniquement PSP-2000, zone invisible) */}
          {activeChassis.hotspots.display && (
            <button
              onClick={cycleBrightness}
              aria-label="Luminosité de l'écran (5 paliers)"
              title="Luminosité de l'écran (▭ / B)"
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
              style={getHitboxStyle(activeChassis.hotspots.display)}
            />
          )}

          {/* Bouton Note de Musique physique (uniquement PSP-2000, zone invisible) */}
          {activeChassis.hotspots.musicNote && (
            <button
              onClick={() => {
                if (powerState === 'off') return;
                sound.playOption();
                sendCommand('music_note');
              }}
              aria-label="Touche Note de Musique (Mixeur Audio / Lecture)"
              title="Note de Musique (♪ / M)"
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
              style={getHitboxStyle(activeChassis.hotspots.musicNote)}
            />
          )}

          <button
            onClick={() => {
              sendCommand('select');
            }}
            aria-label="SELECT"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.select)}
          />

          <button
            onClick={() => {
              sendCommand('start');
            }}
            aria-label="START (Pause / Play / Mixeur)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle(activeChassis.hotspots.start)}
          />
        </div>
      </div>
    </div>

      {/* 2. La capsule d'aide : uniquement en veille pour indiquer le bouton d'allumage */}
      {powerState === 'off' && (
        <div className="mt-6 z-30 flex items-center justify-center flex-shrink-0">
          <button
            onClick={handlePowerOn}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xl transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] group cursor-pointer"
          >
            <p className="text-xs font-mono text-white/90 group-hover:text-white tracking-wide flex items-center gap-2">
              <span className="text-base text-cyan-300">↖</span>{' '}
              {activeChassis.id === 'psp-2000-silver'
                ? 'Cliquez sur le bouton HOME pour allumer'
                : 'Cliquez sur le bouton PlayStation pour allumer'}
            </p>
          </button>
        </div>
      )}
    </div>
  );
};
