import React, { useEffect, useRef } from 'react';
import { PSPTheme } from '../types/xmb';

interface WaveBackgroundProps {
  theme: PSPTheme;
}

export const WaveBackground: React.FC<WaveBackgroundProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 480;
      canvas.height = canvas.parentElement?.clientHeight || 272;
    };

    resize();
    window.addEventListener('resize', resize);

    const drawWave = (
      amplitude: number,
      frequency: number,
      speed: number,
      color: string,
      yOffsetPercent: number,
      phaseOffset: number
    ) => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height * yOffsetPercent;

      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x <= width; x += 4) {
        // Sony PSP characteristic multi-harmonic sine wave
        const y1 = Math.sin(x * frequency + step * speed + phaseOffset) * amplitude;
        const y2 = Math.cos(x * (frequency * 0.5) - step * (speed * 0.7)) * (amplitude * 0.5);
        const y = centerY + y1 + y2;

        if (x === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const render = () => {
      step += 0.02;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Draw PSP Theme Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, theme.bgGradient[0]);
      grad.addColorStop(1, theme.bgGradient[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle radial backlight glow from top
      const radialGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.2,
        10,
        width * 0.5,
        height * 0.2,
        width * 0.7
      );
      radialGlow.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
      radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Draw 3 layers of fluid waves
      drawWave(28, 0.007, 0.8, theme.waveColor1, 0.65, 0);
      drawWave(36, 0.005, 0.5, theme.waveColor2, 0.58, 2.5);
      drawWave(20, 0.009, 1.1, theme.waveColor3, 0.72, 4.2);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: 'block' }}
    />
  );
};
