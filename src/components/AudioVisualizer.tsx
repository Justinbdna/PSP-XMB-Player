import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  analyser?: AnalyserNode | null;
  isYouTube?: boolean;
  bpm?: number;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  analyser = null,
  isYouTube = false,
  bpm = 120,
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
    const heights = new Array(barCount).fill(4);
    const peaks = new Array(barCount).fill(4);
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      t += 0.08;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(3, (width - (barCount - 1) * 3) / barCount);

      // Détecter si l'analyseur Web Audio API délivre un signal réel
      let hasRealSignal = false;
      if (isPlaying && analyser && freqData) {
        try {
          analyser.getByteFrequencyData(freqData);
          for (let k = 0; k < freqData.length; k++) {
            if (freqData[k] > 0) {
              hasRealSignal = true;
              break;
            }
          }
        } catch {
          hasRealSignal = false;
        }
      }

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 4;
        if (isPlaying) {
          if (hasRealSignal && freqData) {
            // Lecture directe du spectre FFT Web Audio API
            const binIdx = Math.min(freqData.length - 1, Math.floor((i / barCount) * (freqData.length * 0.75)));
            const val = freqData[binIdx] || 0;
            const norm = val / 255;
            targetHeight = Math.max(5, norm * (height - 6));
          } else if (isYouTube) {
            // Animation procédurale calée sur le BPM pour flux YouTube
            const tempo = bpm || 120;
            const beatFreq = (tempo / 60) * 0.75;
            const beatPulse = Math.pow(Math.max(0, Math.sin(t * beatFreq * Math.PI)), 2);
            const harmonic = Math.sin(t * 2.4 + i * 0.35);
            const bass = i < 7 ? beatPulse * 18 : 0;
            const mid = i >= 7 && i < 18 ? Math.sin(t * 3.8 + i * 0.5) * 6 : 0;
            const raw = (harmonic + 1) / 2;
            targetHeight = Math.max(5, raw * (height - 12) + bass + mid);
          } else {
            // Simulation harmonique multi-fréquentielle fluide
            const harmonic1 = Math.sin(t * 1.8 + i * 0.45);
            const harmonic2 = Math.cos(t * 2.6 - i * 0.3);
            const harmonic3 = Math.sin(t * 4.2 + i * 0.8) * 0.5;
            const bassBoost = i < 8 ? (8 - i) * 2.5 : 0;
            const raw = (harmonic1 + harmonic2 + harmonic3 + 2.5) / 5;
            targetHeight = Math.max(5, raw * (height - 8) + bassBoost);
          }
        }

        // Interpolation lissée
        heights[i] += (targetHeight - heights[i]) * 0.3;

        // Indicateur de pic en chute libre
        if (heights[i] > peaks[i]) {
          peaks[i] = heights[i];
        } else {
          peaks[i] = Math.max(heights[i], peaks[i] - 1.2);
        }

        const x = i * (barWidth + 3);
        const y = height - heights[i];
        const barH = heights[i];

        // Dégradé néon authentique PSP
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)'); // Emerald base
        gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.9)'); // Cyan mid
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)'); // White tip

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barH);

        // Ligne de crête
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x, Math.max(0, height - peaks[i] - 2), barWidth, 1.5);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, analyser, isYouTube, bpm]);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={48}
      className={`w-full h-12 ${className}`}
    />
  );
};
