import React, { useEffect, useRef } from 'react';
import { VisualizerMode } from '../types/xmb';

interface AudioVisualizerProps {
  isPlaying: boolean;
  mode?: VisualizerMode;
  analyser?: AnalyserNode | null;
  className?: string;
}

interface BubbleParticle {
  x: number;
  baseX: number;
  y: number;
  baseRadius: number;
  radius: number;
  speedY: number;
  swaySpeed: number;
  swayAmp: number;
  phase: number;
  isGold: boolean;
  alpha: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  mode = 'bubbles',
  analyser = null,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;
    let energy = isPlaying ? 1.0 : 0.0;

    // Synchronisation de la résolution interne du buffer avec getBoundingClientRect()
    const syncResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.max(100, Math.round((rect.width || 320) * dpr));
      const targetH = Math.max(40, Math.round((rect.height || 112) * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    syncResolution();

    // --- MODE 1 : INITIALISATION DES BULLES LUMINESCENTES PSP ---
    const bubbleCount = 42;
    const bubbles: BubbleParticle[] = [];
    const initW = canvas.width;
    const initH = canvas.height;

    for (let i = 0; i < bubbleCount; i++) {
      const baseX = Math.random() * initW;
      const baseRadius = 3.0 + Math.random() * 8.5;
      bubbles.push({
        x: baseX,
        baseX,
        y: Math.random() * initH,
        baseRadius,
        radius: baseRadius,
        speedY: 0.3 + Math.random() * 0.8,
        swaySpeed: 1.0 + Math.random() * 1.6,
        swayAmp: 6 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        isGold: Math.random() < 0.18,
        alpha: 0.35 + Math.random() * 0.5,
      });
    }

    // --- MODE 2 : INITIALISATION DE LA MATRICE LED ---
    const colCount = 20;
    const rowCount = 12;
    const levels = new Array(colCount).fill(0);
    const peaks = new Array(colCount).fill(0);
    const peakHold = new Array(colCount).fill(0);

    // Buffer d'analyse fréquentielle Web Audio API (si disponible)
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      syncResolution();

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Gestion de l'énergie et décélération inertielle fluide sans freeze
      const targetEnergy = isPlaying ? 1.0 : 0.0;
      energy += (targetEnergy - energy) * 0.06;
      t += 0.016 * (0.2 + energy * 0.8);

      // Détection du signal réel FFT pour les fichiers locaux
      let realKick = 0;
      let hasFFT = false;

      if (isPlaying && analyser && freqData) {
        try {
          analyser.getByteFrequencyData(freqData);
          // Analyse de la bande de basses 40-100 Hz (indices 1 à 4)
          const k1 = freqData[1] || 0;
          const k2 = freqData[2] || 0;
          const k3 = freqData[3] || 0;
          const k4 = freqData[4] || 0;
          realKick = (k1 + k2 + k3 + k4) / (4 * 255);
          if (realKick > 0.04) hasFFT = true;
        } catch {
          hasFFT = false;
        }
      }

      if (mode === 'bubbles') {
        // ========================================================
        // MODE 1 : UNDERWATER BUBBLES (Bulles luminescentes PSP)
        // ========================================================
        // Pulsation hybride : kick FFT réel si présent, simulation sinusoïdale sinon
        const beatFactor = hasFFT
          ? 1 + realKick * 0.85 * energy
          : 1 + Math.pow(Math.max(0, Math.sin(t * 4.2)), 3) * 0.45 * energy;

        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];

          // Flottement vertical & oscillation sinusoïdale
          b.y -= b.speedY * (0.35 + energy * 0.75);
          b.x = b.baseX + Math.sin(t * b.swaySpeed + b.phase) * b.swayAmp;

          // Réapparition continue par le bas
          if (b.y < -b.radius * 2) {
            b.y = height + b.radius * 2;
            b.baseX = Math.random() * width;
            b.x = b.baseX;
            b.phase = Math.random() * Math.PI * 2;
          }

          // Pulsation douce du rayon interpolée au rythme musical
          const targetR = b.baseRadius * beatFactor;
          b.radius += (targetR - b.radius) * 0.18;

          const r = Math.max(1.5, b.radius);
          ctx.save();

          // Lueur diffuse
          ctx.shadowColor = b.isGold ? 'rgba(251, 191, 36, 0.75)' : 'rgba(56, 189, 248, 0.75)';
          ctx.shadowBlur = 10 * (0.4 + energy * 0.6);

          // Dégradé radial semi-transparent
          const grad = ctx.createRadialGradient(
            b.x - r * 0.35,
            b.y - r * 0.35,
            r * 0.08,
            b.x,
            b.y,
            r
          );

          if (b.isGold) {
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.35, `rgba(251, 191, 36, ${b.alpha * 0.85})`);
            grad.addColorStop(0.85, `rgba(217, 119, 6, ${b.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
          } else {
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.35, `rgba(56, 189, 248, ${b.alpha * 0.85})`);
            grad.addColorStop(0.85, `rgba(14, 165, 233, ${b.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Anneau extérieur fin et éclat spéculaire
          ctx.strokeStyle = b.isGold
            ? `rgba(253, 230, 138, ${b.alpha * 0.8})`
            : `rgba(186, 230, 253, ${b.alpha * 0.8})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Reflet blanc de verre sur le bord supérieur
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(b.x - r * 0.35, b.y - r * 0.35, Math.max(0.6, r * 0.22), 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      } else if (mode === 'matrix') {
        // ========================================================
        // MODE 2 : LED MATRIX BLOCKS (Égaliseur à blocs rétro)
        // ========================================================
        const colGap = 4;
        const rowGap = 3;
        const colWidth = Math.max(4, (width - (colCount - 1) * colGap) / colCount);
        const rowHeight = Math.max(3, (height - 6 - (rowCount - 1) * rowGap) / rowCount);

        for (let c = 0; c < colCount; c++) {
          let raw = 0;

          if (hasFFT && freqData) {
            // Lecture du spectre FFT réel pour fichiers locaux
            const binIdx = Math.min(freqData.length - 1, Math.floor((c / colCount) * (freqData.length * 0.75)));
            const val = (freqData[binIdx] || 0) / 255;
            raw = Math.min(1, Math.max(0, val * energy));
          } else {
            // Simulation harmonique multi-fréquentielle pour flux distants iTunes
            const bass = c < 6
              ? Math.pow(Math.max(0, Math.sin(t * 3.5)), 3) * 0.7 + Math.sin(t * 4.8 + c * 0.3) * 0.25
              : 0;
            const mids = c >= 6 && c < 14
              ? (Math.sin(t * 5.2 + c * 0.45) + Math.cos(t * 3.4 - c * 0.3) + 2) * 0.22
              : 0;
            const treble = c >= 14
              ? (Math.sin(t * 8.5 + c * 0.6) + Math.cos(t * 10.2 - c * 0.5) + 2) * 0.22
              : 0;
            raw = Math.min(1, Math.max(0, (bass + mids + treble + 0.1) * energy));
          }

          levels[c] += (raw - levels[c]) * 0.32;
          const activeBlocks = Math.round(levels[c] * rowCount);

          // Persistance de crête (Peak Hold & Gravity Fall)
          if (activeBlocks >= peaks[c]) {
            peaks[c] = activeBlocks;
            peakHold[c] = 14;
          } else {
            if (peakHold[c] > 0) {
              peakHold[c]--;
            } else {
              peaks[c] = Math.max(0, peaks[c] - 0.25);
            }
          }

          const x = c * (colWidth + colGap);

          // Rendu des segments LED du bas vers le haut
          for (let r = 0; r < rowCount; r++) {
            const y = height - 3 - (r + 1) * (rowHeight + rowGap);
            const isLit = r < activeBlocks;
            const isPeak = Math.floor(peaks[c]) === r && peaks[c] > 0;

            if (isLit) {
              // Dégradé officiel : Ambre chaud (bas) ➔ Ambre doré ➔ Cyan électrique (sommet)
              let color = 'rgba(245, 158, 11, 0.95)';
              if (r >= 5 && r < 8) {
                color = 'rgba(251, 191, 36, 0.95)';
              } else if (r >= 8) {
                color = 'rgba(6, 182, 212, 0.98)';
              }

              ctx.fillStyle = color;
              ctx.fillRect(x, y, colWidth, rowHeight);
            } else {
              // LED éteinte (matrice physique)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
              ctx.fillRect(x, y, colWidth, rowHeight);
            }

            // Capuchon lumineux de crête persistant
            if (isPeak) {
              ctx.save();
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 6;
              ctx.fillRect(x, y, colWidth, rowHeight);
              ctx.restore();
            }
          }
        }
      } else if (mode === 'waveform') {
        // ========================================================
        // MODE 3 : NEON WAVE / OSCILLOSCOPE (Ligne d'onde continue)
        // ========================================================
        const centerY = height / 2;
        const kickBoost = hasFFT ? 1 + realKick * 0.9 : 1;
        const maxAmp = (height / 2 - 8) * Math.max(0.08, energy) * kickBoost;

        // Ligne de balayage d'arrière-plan discrète
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Onde 2 : Harmonique Magenta / Électrique
        ctx.save();
        ctx.strokeStyle = 'rgba(217, 70, 239, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#d946ef';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const y =
            centerY +
            (Math.sin(x * 0.045 - t * 6.5 + 1.2) * 0.6 + Math.cos(x * 0.02 + t * 3.2) * 0.4) *
              (maxAmp * 0.75);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Onde 3 : Harmonique Haute Fréquence Émeraude
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const y = centerY + Math.sin(x * 0.09 + t * 8.5) * (maxAmp * 0.35);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Onde 1 : Onde Maîtresse Cyan Néon (#00f0ff)
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const y =
            centerY +
            (Math.sin(x * 0.03 + t * 5.2) * 0.5 +
              Math.sin(x * 0.06 - t * 3.8) * 0.35 +
              Math.sin(x * 0.015 + t * 2.2) * 0.2) *
              maxAmp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, mode, analyser]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
    />
  );
};
