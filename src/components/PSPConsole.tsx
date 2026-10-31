import React, { useState } from 'react';
import { WaveBackground } from './WaveBackground';
import { XMBMenu } from './XMBMenu';
import { PSPTheme, PSP_MONTHLY_THEMES } from '../types/xmb';
import { useAudio } from './AudioEngine';
import { sound } from '../services/sound';
import { PlayStationLogo } from './XMBIcons';

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
  const [powerOn, setPowerOn] = useState<boolean>(true);

  const sendCommand = (action: string) => {
    (document.activeElement as HTMLElement)?.blur();
    setExternalCommand({ action, timestamp: Date.now() });
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0d11] flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-['Inter',sans-serif]">
      {/* Background ambient desk lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(50,70,100,0.18),rgba(0,0,0,0.95))] pointer-events-none"></div>

      {/* Responsive Scaling Wrapper */}
      <div className="relative z-10 w-full max-w-[1140px] aspect-[1020/460] select-none flex items-center justify-center">
        
        {/* ========================================================
            THE PSP HARDWARE CHASSIS (PIANO BLACK WITH METALLIC TRIM)
            ======================================================== */}
        <div
          className="relative w-full h-full rounded-[85px] p-[10px] flex items-center justify-between"
          style={{
            background: 'linear-gradient(145deg, #1f2229 0%, #0d0f12 35%, #050608 100%)',
            boxShadow: `
              0 30px 60px -12px rgba(0,0,0,0.9),
              0 0 0 2px rgba(255,255,255,0.1),
              inset 0 2px 4px rgba(255,255,255,0.35),
              inset 0 -4px 8px rgba(0,0,0,0.85)
            `,
          }}
        >
          {/* Metallic Side Trim Accents (Silver Rails) */}
          <div className="absolute left-[3px] top-[15%] bottom-[15%] w-[4px] rounded-full bg-gradient-to-b from-transparent via-[#9ea7b5] to-transparent opacity-60"></div>
          <div className="absolute right-[3px] top-[15%] bottom-[15%] w-[4px] rounded-full bg-gradient-to-b from-transparent via-[#9ea7b5] to-transparent opacity-60"></div>

          {/* L & R Shoulder Triggers (Transparent Acrylic Tops) */}
          <div
            onClick={() => {
              sound.playTick();
              sendCommand('left');
            }}
            className="absolute -top-3 left-16 w-28 h-6 rounded-t-xl bg-gradient-to-b from-white/30 to-white/5 border-t border-l border-r border-white/40 cursor-pointer active:translate-y-1 transition shadow-lg flex items-center justify-center text-[11px] font-bold text-white/70"
          >
            L
          </div>
          <div
            onClick={() => {
              sound.playTick();
              sendCommand('right');
            }}
            className="absolute -top-3 right-16 w-28 h-6 rounded-t-xl bg-gradient-to-b from-white/30 to-white/5 border-t border-l border-r border-white/40 cursor-pointer active:translate-y-1 transition shadow-lg flex items-center justify-center text-[11px] font-bold text-white/70"
          >
            R
          </div>

          {/* ========================================================
              LEFT GRIP POD (PLAYSTATION LOGO + D-PAD + ANALOG STICK + MS DUO / WLAN AT BOTTOM)
              ======================================================== */}
          <div className="w-[18%] h-[88%] flex flex-col items-center justify-between py-2 pl-4 z-10">
            {/* Top Left: PlayStation Brand Logo */}
            <div className="self-start ml-4 mt-1">
              <PlayStationLogo size={26} className="text-[#aab5c6] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] opacity-85" />
            </div>

            {/* D-PAD (Directional Cross) */}
            <div className="relative w-28 h-28 flex items-center justify-center my-auto">
              {/* Center Cross Plate Base */}
              <div className="absolute w-24 h-24 rounded-full bg-[#121418] shadow-inner border border-white/5"></div>

              {/* UP Button */}
              <button
                onClick={() => sendCommand('up')}
                className="absolute top-0 w-8 h-10 rounded-t-md bg-gradient-to-b from-[#2a2e38] to-[#171a21] border-t border-white/25 active:scale-95 active:from-[#1b1e25] transition flex items-center justify-center text-white/70 shadow-md"
              >
                ▲
              </button>

              {/* DOWN Button */}
              <button
                onClick={() => sendCommand('down')}
                className="absolute bottom-0 w-8 h-10 rounded-b-md bg-gradient-to-t from-[#2a2e38] to-[#171a21] border-b border-white/25 active:scale-95 active:from-[#1b1e25] transition flex items-center justify-center text-white/70 shadow-md"
              >
                ▼
              </button>

              {/* LEFT Button */}
              <button
                onClick={() => sendCommand('left')}
                className="absolute left-0 w-10 h-8 rounded-l-md bg-gradient-to-r from-[#2a2e38] to-[#171a21] border-l border-white/25 active:scale-95 active:from-[#1b1e25] transition flex items-center justify-center text-white/70 shadow-md"
              >
                ◀
              </button>

              {/* RIGHT Button */}
              <button
                onClick={() => sendCommand('right')}
                className="absolute right-0 w-10 h-8 rounded-r-md bg-gradient-to-l from-[#2a2e38] to-[#171a21] border-r border-white/25 active:scale-95 active:from-[#1b1e25] transition flex items-center justify-center text-white/70 shadow-md"
              >
                ▶
              </button>

              {/* Center D-Pad pivot ring */}
              <div className="w-5 h-5 rounded-full bg-[#14171d] border border-black/80 pointer-events-none"></div>
            </div>

            {/* ANALOG STICK (PSP NUB) */}
            <div
              className="relative w-14 h-14 rounded-full bg-[#111317] border border-white/10 flex items-center justify-center shadow-inner cursor-pointer active:scale-95 transition my-1"
              title="Stick Analogique PSP"
            >
              {/* Textured knurled surface */}
              <div
                className="w-11 h-11 rounded-full border border-black/90 shadow-md flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 40% 40%, #30353f 0%, #15181f 70%)',
                }}
              >
                <div className="w-7 h-7 rounded-full border border-white/10 opacity-40"></div>
              </div>
            </div>

            {/* Bottom Left: MS DUO LED + WLAN Indicators (Position authentique PSP en bas à gauche) */}
            <div className="flex flex-col gap-1 items-start self-start ml-3 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                <span className="text-[8px] font-bold tracking-wider text-white/50 font-mono">MS DUO</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                <span className="text-[8px] font-bold tracking-wider text-white/40 font-mono">WLAN</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              CENTER SCREEN (16:9 BEZEL + LCD DISPLAY + BOTTOM BAR)
              ======================================================== */}
          <div className="flex-1 h-[94%] flex flex-col items-center justify-between px-2 pt-1 pb-1 z-10">
            {/* THE 16:9 LCD SCREEN CONTAINER */}
            <div
              className="relative w-full flex-1 my-1 rounded-2xl overflow-hidden border-2 border-[#2b303c]"
              style={{
                boxShadow: `
                  inset 0 0 25px rgba(0,0,0,0.85),
                  0 0 0 1px rgba(0,0,0,0.9),
                  0 6px 12px rgba(0,0,0,0.6)
                `,
              }}
            >
              {powerOn ? (
                <>
                  {/* Layer 0: Canvas Wave Dynamic Background */}
                  <WaveBackground theme={theme} />

                  {/* Layer 1: XMB Menu System */}
                  <XMBMenu
                    currentTheme={theme}
                    onThemeChange={setTheme}
                    externalCommand={externalCommand}
                  />

                  {/* Layer 2: Authentic PSP Volume OSD Overlay */}
                  {showVolumeOSD && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#121620]/90 backdrop-blur-md border border-white/25 rounded-md px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl animate-fade-in pointer-events-none">
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

                  {/* Subtle LCD Scanline / Glass Reflection Overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08]"></div>
                </>
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center text-white/30 text-xs">
                  Console éteinte (Actionnez le bouton Power)
                </div>
              )}
            </div>

            {/* BOTTOM UTILITY BAR (HOME, VOL-, VOL+, ♫, SELECT, START) */}
            <div className="w-full flex items-center justify-between px-6 pb-1 text-white/60">
              {/* HOME / PS Button (Retour au menu d'accueil) */}
              <button
                onClick={() => {
                  sound.playBack();
                  sendCommand('home');
                }}
                className="px-2.5 py-1 rounded-md bg-[#181b22] border border-white/15 text-[10px] font-bold text-white/80 active:scale-95 shadow flex items-center gap-1"
                title="Menu d'accueil (Home)"
              >
                <span>HOME</span>
              </button>

              {/* Volume & Audio Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    adjustVolume(-0.05);
                    sound.playTick();
                  }}
                  className="w-7 h-5 rounded bg-[#181b22] border border-white/15 text-[11px] font-bold text-white/80 active:scale-95 shadow flex items-center justify-center"
                  title="Volume Moins"
                >
                  -
                </button>
                <span className="text-[9px] font-mono text-white/50 px-1">VOL</span>
                <button
                  onClick={() => {
                    adjustVolume(0.05);
                    sound.playTick();
                  }}
                  className="w-7 h-5 rounded bg-[#181b22] border border-white/15 text-[11px] font-bold text-white/80 active:scale-95 shadow flex items-center justify-center"
                  title="Volume Plus"
                >
                  +
                </button>

                {/* Music Note Button (♫) */}
                <button
                  onClick={() => {
                    togglePlay();
                    sound.playTick();
                  }}
                  className="ml-2 w-7 h-5 rounded bg-[#181b22] border border-white/15 text-[11px] font-bold text-white/90 active:scale-95 shadow flex items-center justify-center text-emerald-400"
                  title="Lecture / Pause (♫)"
                >
                  ♫
                </button>
              </div>

              {/* PSP Metallic Center Logo */}
              <span className="text-[13px] font-black tracking-[0.2em] text-[#b0bac9] font-mono drop-shadow">
                PSP
              </span>

              {/* Select & Start Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sound.playTick();
                    const next = (theme.month % 12) + 1;
                    setTheme(PSP_MONTHLY_THEMES[next]);
                  }}
                  className="px-2 py-0.5 rounded bg-[#181b22] border border-white/15 text-[9px] font-bold text-white/80 active:scale-95 shadow"
                  title="Changer le thème"
                >
                  SELECT
                </button>
                <button
                  onClick={() => {
                    togglePlay();
                  }}
                  className="px-2 py-0.5 rounded bg-[#181b22] border border-white/15 text-[9px] font-bold text-white/80 active:scale-95 shadow"
                  title="Play / Pause"
                >
                  START
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              RIGHT GRIP POD (SONY BRANDING + ACTION BUTTONS △ ◯ ✕ □ + POWER SWITCH)
              ======================================================== */}
          <div className="w-[18%] h-[88%] flex flex-col items-center justify-between py-2 pr-4 z-10">
            {/* Top Right: SONY Branding (Position authentique de la console) */}
            <div className="self-end mr-4 mt-1">
              <span className="text-[13px] font-black tracking-[0.22em] text-[#ccd5e2] font-mono drop-shadow">
                SONY
              </span>
            </div>

            {/* ACTION BUTTONS (TRIANGLE, CIRCLE, CROSS, SQUARE) */}
            <div className="relative w-28 h-28 flex items-center justify-center my-auto">
              {/* TRIANGLE (▲) - Key A */}
              <button
                onClick={() => sendCommand('triangle')}
                className="absolute top-0 w-9 h-9 rounded-full border border-white/20 active:scale-90 transition flex items-center justify-center shadow-lg"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #2a2f3b 0%, #101217 80%)',
                }}
                title="Triangle (Touche A / Options)"
              >
                <span className="text-emerald-400 font-bold text-sm drop-shadow-[0_0_6px_#34d399]">
                  ▲
                </span>
              </button>

              {/* CIRCLE (◯) - Key O / Retour */}
              <button
                onClick={() => sendCommand('circle')}
                className="absolute right-0 w-9 h-9 rounded-full border border-white/20 active:scale-90 transition flex items-center justify-center shadow-lg"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #2a2f3b 0%, #101217 80%)',
                }}
                title="Rond (Touche O / Retour)"
              >
                <span className="text-red-400 font-bold text-sm drop-shadow-[0_0_6px_#f87171]">
                  ●
                </span>
              </button>

              {/* CROSS (✕) - Key X / Valider */}
              <button
                onClick={() => sendCommand('cross')}
                className="absolute bottom-0 w-9 h-9 rounded-full border border-white/20 active:scale-90 transition flex items-center justify-center shadow-lg"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #2a2f3b 0%, #101217 80%)',
                }}
                title="Croix (Touche X / Valider)"
              >
                <span className="text-blue-400 font-extrabold text-sm drop-shadow-[0_0_6px_#60a5fa]">
                  ✕
                </span>
              </button>

              {/* SQUARE (□) - Key S / Play-Pause */}
              <button
                onClick={() => sendCommand('square')}
                className="absolute left-0 w-9 h-9 rounded-full border border-white/20 active:scale-90 transition flex items-center justify-center shadow-lg"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #2a2f3b 0%, #101217 80%)',
                }}
                title="Carré (Touche S / Play-Pause)"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="drop-shadow-[0_0_8px_#f472b6]">
                  <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#f472b6" strokeWidth="2.4" />
                </svg>
              </button>
            </div>

            {/* Speaker Grille simulation */}
            <div className="grid grid-cols-3 gap-1 self-center my-1">
              <div className="w-1 h-1 rounded-full bg-white/20"></div>
              <div className="w-1 h-1 rounded-full bg-white/20"></div>
              <div className="w-1 h-1 rounded-full bg-white/20"></div>
            </div>

            {/* POWER / HOLD LED indicator */}
            <div className="flex items-center gap-1.5 self-end mr-3 mb-1">
              <span className="text-[9px] font-bold tracking-wider text-white/40 font-mono">POWER</span>
              <span
                onClick={() => setPowerOn(!powerOn)}
                className={`w-2 h-2 rounded-full cursor-pointer transition ${
                  powerOn
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                    : 'bg-red-900'
                }`}
              ></span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SHORTCUTS CHEAT-SHEET FOR DESKTOP USER */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-white/50 bg-white/[0.03] border border-white/10 px-5 py-2 rounded-full">
        <span>⌨️ <b className="text-white/80">Flèches</b> : Naviguer</span>
        <span>•</span>
        <span><b className="text-blue-400">X</b> : Valider</span>
        <span>•</span>
        <span><b className="text-red-400">O</b> : Retour</span>
        <span>•</span>
        <span><b className="text-emerald-400">A</b> : Options (Triangle)</span>
        <span>•</span>
        <span><b className="text-pink-400">S</b> : Play/Pause (Carré)</span>
        <span>•</span>
        <span className="text-white/70">🖱️ Tu peux aussi cliquer directement sur les boutons de la PSP !</span>
      </div>
    </div>
  );
};
