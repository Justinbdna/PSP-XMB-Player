import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
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
    const barCount = 28;
    const heights = new Array(barCount).fill(2);
    const peaks = new Array(barCount).fill(2);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(3, (width - (barCount - 1) * 3) / barCount);

      if (isPlaying) {
        t += 0.085;
      }

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 2;

        if (isPlaying) {
          // 1. Basses nerveuses et percutantes (bandes 0 à 6)
          const kick = Math.pow(Math.max(0, Math.sin(t * 1.6)), 4) * 18;
          const bassHarmonic = Math.sin(t * 2.8 + i * 0.3) * 6;
          const bassBoost = i < 7 ? kick + bassHarmonic : 0;

          // 2. Médiums dynamiques et stables (bandes 7 à 17)
          const midHarmonic1 = Math.sin(t * 2.2 + i * 0.35);
          const midHarmonic2 = Math.cos(t * 1.5 - i * 0.25);
          const midBoost = i >= 7 && i < 18 ? (midHarmonic1 + midHarmonic2 + 2) * 5 : 0;

          // 3. Aigus scintillants et rapides (bandes 18 à 27)
          const trebleHarmonic = Math.sin(t * 4.6 + i * 0.6) * 4 + Math.cos(t * 6.0 - i * 0.4) * 3;
          const trebleBoost = i >= 18 ? Math.max(0, trebleHarmonic + 4) : 0;

          // Somme pondérée
          const raw = (Math.sin(t * 1.4 + i * 0.2) + 1.2) / 2.4;
          const baseHeight = raw * (height - 10);

          targetHeight = Math.max(4, Math.min(height - 4, baseHeight + bassBoost + midBoost + trebleBoost));
          // Interpolation réactive montante
          heights[i] += (targetHeight - heights[i]) * 0.32;
        } else {
          // Gravité d'inertie douce pour extinction à l'arrêt
          heights[i] = Math.max(2, heights[i] * 0.88 - 0.3);
        }

        // Décroissance du marqueur de crête (peak indicator)
        if (heights[i] > peaks[i]) {
          peaks[i] = heights[i];
        } else {
          peaks[i] = Math.max(heights[i], peaks[i] - 0.7);
        }

        const x = i * (barWidth + 3);
        const y = height - heights[i];
        const barH = Math.max(2, heights[i]);

        // Dégradé néon Hi-Fi officiel PSP (Émeraude ➔ Cyan ➔ Blanc)
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(52, 211, 153, 0.45)'); // Emerald base
        gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.9)'); // Cyan mid
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.98)'); // White tip

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barH);

        // Capuchon lumineux de pic
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x, Math.max(0, height - peaks[i] - 2), barWidth, 1.5);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={48}
      className={`w-full h-12 ${className}`}
    />
  );
};
