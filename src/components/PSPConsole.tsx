import React, { useState, useCallback } from 'react';
import { WaveBackground } from './WaveBackground';
import { XMBMenu } from './XMBMenu';
import { PSPTheme, PSP_MONTHLY_THEMES } from '../types/xmb';
import { useAudio } from './AudioEngine';
import { sound } from '../services/sound';
import { useGamepad } from '../hooks/useGamepad';

// Mode Debug visuel pour calibrer les hitboxes chirurgicalement
const DEBUG_HITBOXES = true;

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

export const PSPConsole: React.FC = () => {
  const currentMonth = new Date().getMonth() + 1;
  const [theme, setTheme] = useState<PSPTheme>(
    PSP_MONTHLY_THEMES[currentMonth] || PSP_MONTHLY_THEMES[10]
  );
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
      sound.playTick();
      const next = (theme.month % 12) + 1;
      setTheme(PSP_MONTHLY_THEMES[next]);
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
      sendCommand('left');
    },
    onR: () => {
      sound.playTick();
      sendCommand('right');
    },
  });

  const activeChassis = PSP_CHASSIS_CONFIG.models['psp-street-e1000-black'];

  // Helper styling for debug hitboxes with 1:1 circular ratio
  const getHitboxStyle = (pos: React.CSSProperties, isCircle = false): React.CSSProperties => ({
    ...pos,
    borderRadius: isCircle ? '50%' : (pos.borderRadius || '4px'),
    aspectRatio: isCircle ? '1 / 1' : undefined,
    ...(DEBUG_HITBOXES
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
    <div className="min-h-screen w-full bg-[#08090c] flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-['Inter',sans-serif]">
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

              {/* Interface XMB, navigation, lecteur vidéo MP4 et lecteur audio */}
              <XMBMenu
                currentTheme={theme}
                onThemeChange={setTheme}
                externalCommand={externalCommand}
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
            (Calibration chirurgicale & Mode Debug avec ratio 1:1)
            ======================================================== */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* ----- D-PAD (Directional Cross) ----- */}
          {/* Haut : (26.5%, 9.3%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('up');
            }}
            title="D-Pad Haut"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '26.5%', left: '9.3%', width: '4.8%', height: '9.5%', borderRadius: '4px' })}
          />

          {/* Bas : (49.5%, 9.3%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('down');
            }}
            title="D-Pad Bas"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '49.5%', left: '9.3%', width: '4.8%', height: '9.5%', borderRadius: '4px' })}
          />

          {/* Gauche : (38%, 3.7%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('left');
            }}
            title="D-Pad Gauche"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '38%', left: '3.7%', width: '5.6%', height: '8.5%', borderRadius: '4px' })}
          />

          {/* Droite : (38%, 13.1%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('right');
            }}
            title="D-Pad Droite"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '38%', left: '13.1%', width: '5.6%', height: '8.5%', borderRadius: '4px' })}
          />

          {/* ----- ACTION BUTTONS (△ ◯ ✕ □) - Ratio 1:1 circulaire ----- */}
          {/* Triangle : (23.5%, 87%) */}
          <button
            onClick={() => {
              sound.playOption();
              sendCommand('triangle');
            }}
            title="Triangle (Options)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '23.5%', left: '87%', width: '5.5%' }, true)}
          />

          {/* Rond : (37%, 92.5%) */}
          <button
            onClick={() => {
              sound.playBack();
              sendCommand('circle');
            }}
            title="Rond (Retour / Annuler)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '37%', left: '92.5%', width: '5.5%' }, true)}
          />

          {/* Croix : (50.5%, 87%) */}
          <button
            onClick={() => {
              sound.playEnter();
              sendCommand('cross');
            }}
            title="Croix (Valider)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '50.5%', left: '87%', width: '5.5%' }, true)}
          />

          {/* Carré : (37%, 81.5%) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('square');
            }}
            title="Carré (Lecteur / Play-Pause)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '37%', left: '81.5%', width: '5.5%' }, true)}
          />

          {/* ----- BARRE INFÉRIEURE : PS/Home, Vol -, Vol +, Select, Start ----- */}
          {/* Touche PS / Home (Logo PS en bas à gauche : left 25.2%, top 91%) */}
          <button
            onClick={() => {
              sound.playBack();
              sendCommand('home');
            }}
            title="Touche PS / Accueil"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '91%', left: '25.2%', width: '4.6%', height: '7.5%', borderRadius: '6px' })}
          />

          {/* Volume - */}
          <button
            onClick={() => {
              adjustVolume(-0.05);
              sound.playTick();
            }}
            title="Volume -"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '91%', left: '31.5%', width: '3.6%', height: '7.5%', borderRadius: '6px' })}
          />

          {/* Volume + */}
          <button
            onClick={() => {
              adjustVolume(0.05);
              sound.playTick();
            }}
            title="Volume +"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '91%', left: '38.5%', width: '3.6%', height: '7.5%', borderRadius: '6px' })}
          />

          {/* SELECT */}
          <button
            onClick={() => {
              sound.playTick();
              const next = (theme.month % 12) + 1;
              setTheme(PSP_MONTHLY_THEMES[next]);
            }}
            title="SELECT (Changer le thème)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '91%', left: '66.2%', width: '6.5%', height: '7.5%', borderRadius: '6px' })}
          />

          {/* START */}
          <button
            onClick={() => {
              togglePlay();
            }}
            title="START (Play / Pause)"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer active:scale-[0.92] transition-transform duration-75"
            style={getHitboxStyle({ top: '91%', left: '74.5%', width: '6.5%', height: '7.5%', borderRadius: '6px' })}
          />

          {/* Gâchette L (Epaule gauche) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('left');
            }}
            title="Gâchette L (Catégorie Gauche)"
            className="absolute pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle({ top: '0%', left: '14%', width: '15%', height: '7%', borderRadius: '10px 10px 0 0' })}
          />

          {/* Gâchette R (Epaule droite) */}
          <button
            onClick={() => {
              sound.playTick();
              sendCommand('right');
            }}
            title="Gâchette R (Catégorie Droite)"
            className="absolute pointer-events-auto cursor-pointer active:scale-[0.94] transition-transform duration-75"
            style={getHitboxStyle({ top: '0%', left: '71%', width: '15%', height: '7%', borderRadius: '10px 10px 0 0' })}
          />
        </div>
      </div>

      {/* SHORTCUTS & ACCESSIBILITY BAR */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50 bg-white/[0.03] border border-white/10 px-5 py-2 rounded-full">
        <span>🎮 <b className="text-white/80">Manette connectée</b> (auto-détection)</span>
        <span>•</span>
        <span>⌨️ <b className="text-white/80">Flèches</b> : Naviguer</span>
        <span>•</span>
        <span><b className="text-blue-400">X / Entrée</b> : Valider</span>
        <span>•</span>
        <span><b className="text-red-400">O / Échap</b> : Retour</span>
        <span>•</span>
        <span><b className="text-pink-400">S / Espace</b> : Lecteur Plein Écran</span>
        <span>•</span>
        <span><b className="text-emerald-400">A</b> : Options</span>
        <span>•</span>
        <span><b className="text-white/80">H</b> : PS Home</span>
        {DEBUG_HITBOXES && (
          <span className="text-amber-400 font-mono ml-2">⚠️ Mode Debug Hitboxes Actif</span>
        )}
      </div>
    </div>
  );
};
