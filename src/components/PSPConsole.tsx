import React, { useState, useCallback } from 'react';
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


  const { adjustVolume, togglePlay, showVolumeOSD, volume } = useAudio();
  const [powerOn] = useState<boolean>(true);

  // Send command to XMB screen without losing focus
  const sendCommand = useCallback((action: string) => {
    (document.activeElement as HTMLElement)?.blur();
    setExternalCommand({ action, timestamp: Date.now() });
  }, []);

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
    <div className="relative min-h-screen w-full bg-[#08090c] flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-['Inter',sans-serif]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(40,55,75,0.18),rgba(0,0,0,0.96))] pointer-events-none"></div>


      {/* ========================================================
          CONTENEUR GLOBAL AU RATIO FIXE DE LA CONSOLE (~2.36:1)
          Mécanique d'Architecture Calque Style Apple Music 404
          ======================================================== */}
      <div
        className="relative z-10 w-full max-w-[1024px] aspect-[1024/433] select-none flex items-center justify-center drop-shadow-[0_35px_50px_rgba(0,0,0,0.95)]"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          '--psp-chassis-url': `url(${activeChassis.image})`,
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
          {powerOn ? (
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
          ) : (
            <div className="w-full h-full bg-black flex items-center justify-center text-white/30 text-xs">
              Console éteinte
            </div>
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
              sound.playBack();
              sendCommand('home');
            }}
            aria-label="Touche PS / Accueil"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '25.2%', width: '5%', height: '6%', borderRadius: '4px' })}
          />

          {/* Volume - : left 31.0%, top 92%, width 4.5%, height 6% */}
          <button
            onClick={() => {
              adjustVolume(-0.05);
              sound.playTick();
            }}
            aria-label="Volume -"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '92%', left: '31.0%', width: '4.5%', height: '6%', borderRadius: '4px' })}
          />

          {/* Volume + : recalibré chirurgicalement sur (+) à left 38.6%, top 92%, width 4.5%, height 6% */}
          <button
            onClick={() => {
              adjustVolume(0.05);
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

      {/* SHORTCUTS & ACCESSIBILITY BAR */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50 bg-white/[0.03] border border-white/10 px-5 py-2 rounded-full">
        <span>🎮 <b className="text-white/80">Manette connectée</b> (auto-détection)</span>
        <span>•</span>
        <span>⌨️ <b className="text-white/80">Flèches</b> : Naviguer</span>
        <span>•</span>
        <span><b className="text-cyan-400">L / R (Q / E)</b> : Précédent / Suivant</span>
        <span>•</span>
        <span><b className="text-blue-400">X / Entrée</b> : Valider / Lecture</span>
        <span>•</span>
        <span><b className="text-red-400">O / Échap</b> : Retour</span>
        <span>•</span>
        <span><b className="text-pink-400">▢ / Espace</b> : Play / Pause</span>
        <span>•</span>
        <span><b className="text-emerald-400">△ / T</b> : Options</span>
        <span>•</span>
        <span><b className="text-amber-400">SELECT / Tab</b> : Visualiseur</span>
        <span>•</span>
        <span><b className="text-white/80">H</b> : PS Home</span>
      </div>
    </div>
  );
};
