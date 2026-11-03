import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../../services/sound';
import { PSGlyph } from '../XMBIcons';

interface RetroBrickGameProps {
  onExit: () => void;
  externalCommand?: { action: string; timestamp: number } | null;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

export const RetroBrickGame: React.FC<RetroBrickGameProps> = ({
  onExit,
  externalCommand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('psp_brick_highscore') || '350', 10);
    } catch {
      return 350;
    }
  });
  const [lives, setLives] = useState<number>(3);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover' | 'victory'>('ready');

  // Game internal mutable state referenced in the requestAnimationFrame loop
  const gameRef = useRef({
    state: 'ready' as 'ready' | 'playing' | 'gameover' | 'victory',
    paddleX: 208, // center in 480 wide canvas
    paddleW: 64,
    paddleH: 8,
    ballX: 240,
    ballY: 236,
    ballVx: 2.8,
    ballVy: -2.8,
    ballRadius: 4,
    bricks: [] as Brick[],
    particles: [] as Particle[],
    keys: { left: false, right: false },
    score: 0,
    lives: 3,
  });

  // Initialize Bricks
  const initBricks = () => {
    const rows = 4;
    const cols = 9;
    const brickW = 44;
    const brickH = 11;
    const padding = 6;
    const offsetTop = 42;
    const offsetLeft = 18;

    const rowColors = [
      { color: '#ef4444', points: 40 }, // Red
      { color: '#f59e0b', points: 30 }, // Amber
      { color: '#06b6d4', points: 20 }, // Cyan
      { color: '#10b981', points: 10 }, // Emerald
    ];

    const bricks: Brick[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: offsetLeft + c * (brickW + padding),
          y: offsetTop + r * (brickH + padding),
          w: brickW,
          h: brickH,
          color: rowColors[r].color,
          points: rowColors[r].points,
          alive: true,
        });
      }
    }
    return bricks;
  };

  const startNewGame = () => {
    sound.playEnter();
    const g = gameRef.current;
    g.state = 'playing';
    g.paddleX = 208;
    g.ballX = 240;
    g.ballY = 236;
    g.ballVx = (Math.random() > 0.5 ? 1 : -1) * (2.4 + Math.random() * 0.8);
    g.ballVy = -3.0;
    g.bricks = initBricks();
    g.particles = [];
    g.score = 0;
    g.lives = 3;
    setScore(0);
    setLives(3);
    setGameState('playing');
  };

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      gameRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: 2 + Math.random() * 2,
      });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || key === 'q') {
        gameRef.current.keys.left = true;
      } else if (e.key === 'ArrowRight' || key === 'd') {
        gameRef.current.keys.right = true;
      } else if (e.key === 'Enter' || key === 'x' || e.key === ' ') {
        e.preventDefault();
        if (gameRef.current.state !== 'playing') {
          startNewGame();
        }
      } else if (e.key === 'Escape' || key === 'o' || e.key === 'Backspace') {
        e.preventDefault();
        sound.playBack();
        onExit();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || key === 'q') {
        gameRef.current.keys.left = false;
      } else if (e.key === 'ArrowRight' || key === 'd') {
        gameRef.current.keys.right = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onExit]);

  // Handle External commands from PSP Console buttons
  useEffect(() => {
    if (!externalCommand) return;
    const { action } = externalCommand;

    if (action === 'left') {
      gameRef.current.paddleX = Math.max(10, gameRef.current.paddleX - 28);
      sound.playTick();
    } else if (action === 'right') {
      gameRef.current.paddleX = Math.min(
        480 - 10 - gameRef.current.paddleW,
        gameRef.current.paddleX + 28
      );
      sound.playTick();
    } else if (action === 'cross') {
      if (gameRef.current.state !== 'playing') {
        startNewGame();
      }
    } else if (action === 'circle') {
      sound.playBack();
      onExit();
    }
  }, [externalCommand, onExit]);

  // Canvas Game Engine Loop (480x272 PSP Native Screen)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameRef.current.bricks = initBricks();

    let animationId: number;

    const render = () => {
      const g = gameRef.current;
      const W = 480;
      const H = 272;

      // 1. Logic Update
      if (g.state === 'playing') {
        // Paddle movement
        const paddleSpeed = 5.2;
        if (g.keys.left) {
          g.paddleX = Math.max(10, g.paddleX - paddleSpeed);
        }
        if (g.keys.right) {
          g.paddleX = Math.min(W - 10 - g.paddleW, g.paddleX + paddleSpeed);
        }

        // Ball movement
        g.ballX += g.ballVx;
        g.ballY += g.ballVy;

        // Wall collisions
        if (g.ballX - g.ballRadius <= 8) {
          g.ballX = 8 + g.ballRadius;
          g.ballVx = Math.abs(g.ballVx);
          sound.playTick();
        } else if (g.ballX + g.ballRadius >= W - 8) {
          g.ballX = W - 8 - g.ballRadius;
          g.ballVx = -Math.abs(g.ballVx);
          sound.playTick();
        }

        if (g.ballY - g.ballRadius <= 26) {
          g.ballY = 26 + g.ballRadius;
          g.ballVy = Math.abs(g.ballVy);
          sound.playTick();
        }

        // Paddle collision
        const paddleY = H - 24;
        if (
          g.ballY + g.ballRadius >= paddleY &&
          g.ballY - g.ballRadius <= paddleY + g.paddleH &&
          g.ballX >= g.paddleX - 4 &&
          g.ballX <= g.paddleX + g.paddleW + 4 &&
          g.ballVy > 0
        ) {
          sound.playTick();
          const hitPos = (g.ballX - (g.paddleX + g.paddleW / 2)) / (g.paddleW / 2);
          const speed = Math.sqrt(g.ballVx * g.ballVx + g.ballVy * g.ballVy);
          const maxAngle = (Math.PI / 3); // 60 degrees max
          const angle = hitPos * maxAngle;
          g.ballVx = Math.sin(angle) * speed;
          g.ballVy = -Math.abs(Math.cos(angle) * speed);
          g.ballY = paddleY - g.ballRadius - 1;
        }

        // Brick collisions
        let remainingBricks = 0;
        for (const brick of g.bricks) {
          if (!brick.alive) continue;
          remainingBricks++;

          if (
            g.ballX + g.ballRadius >= brick.x &&
            g.ballX - g.ballRadius <= brick.x + brick.w &&
            g.ballY + g.ballRadius >= brick.y &&
            g.ballY - g.ballRadius <= brick.y + brick.h
          ) {
            brick.alive = false;
            sound.playTick();
            spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
            g.score += brick.points;
            setScore(g.score);

            // Update highscore
            if (g.score > highScore) {
              setHighScore(g.score);
              try {
                localStorage.setItem('psp_brick_highscore', String(g.score));
              } catch {}
            }

            // Determine rebound axis
            const overlapLeft = g.ballX + g.ballRadius - brick.x;
            const overlapRight = brick.x + brick.w - (g.ballX - g.ballRadius);
            const overlapTop = g.ballY + g.ballRadius - brick.y;
            const overlapBottom = brick.y + brick.h - (g.ballY - g.ballRadius);

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapTop || minOverlap === overlapBottom) {
              g.ballVy = -g.ballVy;
            } else {
              g.ballVx = -g.ballVx;
            }
            break;
          }
        }

        // Victory condition
        if (remainingBricks === 0) {
          g.state = 'victory';
          setGameState('victory');
          sound.playOption();
        }

        // Ball out of bottom bound
        if (g.ballY - g.ballRadius > H) {
          g.lives--;
          setLives(g.lives);
          if (g.lives <= 0) {
            sound.playBack();
            g.state = 'gameover';
            setGameState('gameover');
          } else {
            sound.playBack();
            g.ballX = g.paddleX + g.paddleW / 2;
            g.ballY = H - 36;
            g.ballVx = (Math.random() > 0.5 ? 1 : -1) * 2.8;
            g.ballVy = -2.8;
          }
        }
      }

      // Update Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.035;
        if (p.alpha <= 0) {
          g.particles.splice(i, 1);
        }
      }

      // 2. Graphic Rendering (Native PSP 480x272)
      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0c1017');
      bg.addColorStop(0.5, '#070a0f');
      bg.addColorStop(1, '#020406');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Cyber retro grid
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 26);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 26; y < H; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Border bounds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 26, W - 12, H - 28);

      // HUD Top Bar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, 25);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, 25);
      ctx.lineTo(W, 25);
      ctx.stroke();

      // Top text typography
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('SCORE', 12, 16);
      ctx.fillStyle = '#34d399';
      ctx.fillText(String(g.score).padStart(5, '0'), 52, 16);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('HIGH', 130, 16);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(String(highScore).padStart(5, '0'), 160, 16);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('VIES', 235, 16);
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l < g.lives ? '#ef4444' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(270 + l * 12, 13, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('PSP™ BRICK BREAKER', 370, 16);

      // Render Bricks
      for (const b of g.bricks) {
        if (!b.alive) continue;
        // Brick fill with drop shadow
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 2.5);
        ctx.fill();

        // Brick top highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 2);
      }

      // Render Particles
      for (const p of g.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Render Paddle
      const paddleY = H - 24;
      const paddleGrad = ctx.createLinearGradient(g.paddleX, paddleY, g.paddleX, paddleY + g.paddleH);
      paddleGrad.addColorStop(0, '#38bdf8');
      paddleGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = paddleGrad;
      ctx.beginPath();
      ctx.roundRect(g.paddleX, paddleY, g.paddleW, g.paddleH, 4);
      ctx.fill();

      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Render Ball with neon aura
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, g.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ready / Game Over / Victory Modal Overlays
      if (g.state === 'ready') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(80, 75, 320, 110);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 75, 320, 110);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BRICK BREAKER ARCADE', W / 2, 108);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px monospace';
        ctx.fillText('Appuyer sur ✕ pour lancer la balle', W / 2, 134);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8.5px monospace';
        ctx.fillText('◀ / ▶ : Déplacer raquette   •   [◯] : Quitter XMB', W / 2, 156);
        ctx.textAlign = 'left';
      } else if (g.state === 'gameover') {
        ctx.fillStyle = 'rgba(15, 5, 8, 0.85)';
        ctx.fillRect(80, 75, 320, 110);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 75, 320, 110);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, 108);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.fillText(`Score final : ${g.score} points`, W / 2, 132);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.fillText('[✕] Rejouer    •    [◯] Retour XMB', W / 2, 156);
        ctx.textAlign = 'left';
      } else if (g.state === 'victory') {
        ctx.fillStyle = 'rgba(5, 20, 15, 0.88)';
        ctx.fillRect(80, 75, 320, 110);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 75, 320, 110);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR ! VICTOIRE', W / 2, 108);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.fillText(`Score : ${g.score} points !`, W / 2, 132);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.fillText('[✕] Recommencer    •    [◯] Retour XMB', W / 2, 156);
        ctx.textAlign = 'left';
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [highScore]);

  return (
    <div
      id="psp-game-viewport"
      className="relative w-full h-full bg-black select-none overflow-hidden flex flex-col justify-between"
    >
      <canvas
        ref={canvasRef}
        width={480}
        height={272}
        className="w-full h-full object-contain bg-black cursor-none"
      />

      {/* Floating Bottom HUD helper buttons */}
      <div className="absolute bottom-1 left-3 right-3 flex items-center justify-between text-[8px] font-mono text-white/50 pointer-events-none z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-white/80">
            <PSGlyph type="cross" size={10} />
            <span>{gameState === 'playing' ? 'En jeu' : 'Démarrer'}</span>
          </span>
          <span className="flex items-center gap-1 text-white/80">
            <PSGlyph type="circle" size={10} />
            <span>Quitter le jeu</span>
          </span>
          <span className="text-emerald-400 font-bold ml-2">SCORE : {score}</span>
          <span className="text-red-400 font-bold">VIES : {lives}</span>
        </div>
        <span className="text-white/40">D-Pad ◀ / ▶ pour déplacer la raquette</span>
      </div>
    </div>
  );
};
