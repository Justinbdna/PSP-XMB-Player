import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../services/sound';
import { useAudio } from '../AudioEngine';

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

const TRACKS = [
  { id: 'master', label: 'Général' },
  { id: 'bgm', label: 'Musique' },
  { id: 'sfx', label: 'Bruitages' },
];

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
  const { setVolume: setEngineVolume } = useAudio();

  // Niveaux de volume indépendants unifiés de 0 à 100 (Chantier 1)
  const [masterVol, setMasterVol] = useState<number>(100); // 0 à 100
  const [bgmVol, setBgmVol] = useState<number>(85);        // 0 à 100
  const [sfxVol, setSfxVol] = useState<number>(100);       // 0 à 100
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [selectedTrack, setSelectedTrack] = useState<number>(0); // 0: Général, 1: Musique, 2: Bruitages

  const masterVolRef = useRef<number>(100);
  masterVolRef.current = masterVol;
  const bgmVolRef = useRef<number>(85);
  bgmVolRef.current = bgmVol;
  const sfxVolRef = useRef<number>(100);
  sfxVolRef.current = sfxVol;
  const isMixerOpenRef = useRef<boolean>(isMixerOpen);
  isMixerOpenRef.current = isMixerOpen;
  const selectedTrackRef = useRef<number>(selectedTrack);
  selectedTrackRef.current = selectedTrack;

  // Réinitialisation du volume des bruitages à la sortie
  useEffect(() => {
    return () => {
      sound.setVolume(1.0);
    };
  }, []);

  // Transmission décimale propre vers Web Audio (0.0 à 1.0)
  const applyAudioVolumes = useCallback(
    (m: number, b: number, s: number) => {
      const effectiveBgm = (m / 100) * (b / 100); // valeur entre 0.0 et 1.0
      const effectiveSfx = (m / 100) * (s / 100); // valeur entre 0.0 et 1.0

      // Met à jour la musique sans déclencher l'OSD global de la console
      setEngineVolume(effectiveBgm, false);

      // Met à jour les bruitages de rebond
      try {
        sound.setVolume(effectiveSfx);
      } catch (e) {}
    },
    [setEngineVolume]
  );

  // Fonction de mise à jour unifiée par pas de 5 % (+5 ou -5)
  const stepChannelVolume = useCallback(
    (channelIndex: number, delta: number) => {
      sound.playTick();
      if (channelIndex === 0) {
        setMasterVol((prev) => {
          const next = Math.max(0, Math.min(100, prev + delta));
          masterVolRef.current = next;
          applyAudioVolumes(next, bgmVolRef.current, sfxVolRef.current);
          return next;
        });
      } else if (channelIndex === 1) {
        setBgmVol((prev) => {
          const next = Math.max(0, Math.min(100, prev + delta));
          bgmVolRef.current = next;
          applyAudioVolumes(masterVolRef.current, next, sfxVolRef.current);
          return next;
        });
      } else if (channelIndex === 2) {
        setSfxVol((prev) => {
          const next = Math.max(0, Math.min(100, prev + delta));
          sfxVolRef.current = next;
          applyAudioVolumes(masterVolRef.current, bgmVolRef.current, next);
          return next;
        });
      }
    },
    [applyAudioVolumes]
  );

  // Sélection rapide d'une piste
  const selectTrack = useCallback((idx: number) => {
    selectedTrackRef.current = idx;
    setSelectedTrack(idx);
    sound.playTick();
  }, []);

  // Réglage direct au clic / glisser sur la jauge
  const setTrackVolumeDirect = useCallback(
    (channelIndex: number, clientX: number, gaugeElement: HTMLElement) => {
      const rect = gaugeElement.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = Math.max(
        0,
        Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 20) * 5)
      );
      selectTrack(channelIndex);
      if (channelIndex === 0) {
        setMasterVol(pct);
        masterVolRef.current = pct;
        applyAudioVolumes(pct, bgmVolRef.current, sfxVolRef.current);
      } else if (channelIndex === 1) {
        setBgmVol(pct);
        bgmVolRef.current = pct;
        applyAudioVolumes(masterVolRef.current, pct, sfxVolRef.current);
      } else if (channelIndex === 2) {
        setSfxVol(pct);
        sfxVolRef.current = pct;
        applyAudioVolumes(masterVolRef.current, bgmVolRef.current, pct);
      }
    },
    [applyAudioVolumes, selectTrack]
  );

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('psp_brick_highscore') || '350', 10);
    } catch {
      return 350;
    }
  });

  // État interne mutable accessible sans latence par la boucle requestAnimationFrame
  const gameRef = useRef({
    state: 'ready' as 'ready' | 'playing' | 'gameover' | 'victory',
    paddleX: 208, // Centré sur l'écran 480 px
    paddleW: 64,
    paddleH: 8,
    ballX: 240,
    ballY: 243,
    ballVx: 2.8,
    ballVy: -2.8,
    ballRadius: 4,
    ballAttached: false,
    bricks: [] as Brick[],
    particles: [] as Particle[],
    keys: { left: false, right: false },
    score: 0,
    lives: 3,
  });

  // Initialisation des briques
  const initBricks = () => {
    const rows = 4;
    const cols = 9;
    const brickW = 44;
    const brickH = 11;
    const padding = 6;
    const offsetTop = 48;
    const offsetLeft = 18;

    const rowColors = [
      { color: '#ef4444', points: 40 }, // Rouge
      { color: '#f59e0b', points: 30 }, // Ambre
      { color: '#06b6d4', points: 20 }, // Cyan
      { color: '#10b981', points: 10 }, // Émeraude
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
    try { sound.playEnter(); } catch (e) {}
    const g = gameRef.current;
    g.state = 'playing';
    g.paddleX = 208;
    const paddleY = 272 - 24;
    g.ballX = 240;
    g.ballY = paddleY - g.ballRadius - 1;
    g.ballAttached = false;
    g.ballVx = (Math.random() > 0.5 ? 1 : -1) * 3;
    g.ballVy = -4;
    g.bricks = initBricks();
    g.particles = [];
    g.score = 0;
    g.lives = 3;
  };

  const launchBall = useCallback(() => {
    if (isMixerOpenRef.current) return;
    const g = gameRef.current;
    if (g.state === 'ready' || g.state === 'gameover' || g.state === 'victory') {
      startNewGame();
      g.ballAttached = false;
      g.ballVx = (Math.random() > 0.5 ? 1 : -1) * 3;
      g.ballVy = -4;
      try { sound.playEnter(); } catch (e) {}
      return;
    }
    if (g.state === 'playing') {
      if (g.ballAttached) {
        g.ballAttached = false;
        try { sound.playEnter(); } catch (e) {}
        g.ballVx = (Math.random() > 0.5 ? 1 : -1) * 3;
        g.ballVy = -4;
      }
    }
  }, []);

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

  // Mise à jour fluide de la position de la raquette au trackpad / souris / tactile
  const updatePaddlePosition = (clientX: number) => {
    if (isMixerOpenRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const paddleW = gameRef.current.paddleW;
    const targetX = (clientX - rect.left) * scaleX - paddleW / 2;
    const clampedX = Math.max(8, Math.min(canvas.width - 8 - paddleW, targetX));
    gameRef.current.paddleX = clampedX;
    if (gameRef.current.ballAttached) {
      gameRef.current.ballX = clampedX + paddleW / 2;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    updatePaddlePosition(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updatePaddlePosition(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      updatePaddlePosition(e.touches[0].clientX);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isMixerOpenRef.current) return;
    updatePaddlePosition(e.clientX);
    launchBall();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMixerOpenRef.current) return;
    updatePaddlePosition(e.clientX);
    launchBall();
  };

  // Contrôles clavier
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Touches d'ouverture/fermeture du mixeur audio
      if (key === 'tab' || key === 'v' || key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        setIsMixerOpen((prev) => {
          const next = !prev;
          isMixerOpenRef.current = next;
          if (next) sound.playOption();
          else sound.playBack();
          return next;
        });
        return;
      }

      // Si le mixeur est ouvert : navigation et réglages du mixeur par pas de 5 %
      if (isMixerOpenRef.current) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ' || key === 'z' || key === 'w') {
          const next = selectedTrackRef.current > 0 ? selectedTrackRef.current - 1 : 2;
          selectTrack(next);
        } else if (e.key === 'ArrowDown' || e.code === 'KeyS' || key === 's') {
          const next = selectedTrackRef.current < 2 ? selectedTrackRef.current + 1 : 0;
          selectTrack(next);
        } else if (e.key === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ' || key === 'q' || key === 'a') {
          stepChannelVolume(selectedTrackRef.current, -5);
        } else if (e.key === 'ArrowRight' || e.code === 'KeyD' || key === 'd') {
          stepChannelVolume(selectedTrackRef.current, 5);
        } else if (e.key === 'Enter' || key === 'x') {
          sound.playEnter();
          // La touche ✕ / Entrée valide uniquement, ne ferme JAMAIS le mixeur
        } else if (e.key === 'Escape' || key === 'o' || e.key === 'Backspace') {
          setIsMixerOpen(false);
          isMixerOpenRef.current = false;
          sound.playBack();
        }
        return;
      }

      // Contrôles normaux en jeu
      if (e.key === 'ArrowLeft' || key === 'q') {
        gameRef.current.keys.left = true;
      } else if (e.key === 'ArrowRight' || key === 'd') {
        gameRef.current.keys.right = true;
      } else if (e.key === 'Enter' || key === 'x' || e.key === ' ') {
        e.preventDefault();
        launchBall();
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
  }, [onExit, launchBall, selectTrack, stepChannelVolume]);

  // Commandes externes issues des boutons matériels PSP
  useEffect(() => {
    if (!externalCommand) return;
    const { action } = externalCommand;

    // Bascule du mixeur audio sur START ou SELECT
    if (action === 'start' || action === 'select') {
      setIsMixerOpen((prev) => {
        const next = !prev;
        isMixerOpenRef.current = next;
        if (next) sound.playOption();
        else sound.playBack();
        return next;
      });
      return;
    }

    // Si le mixeur est actif
    if (isMixerOpenRef.current) {
      if (action === 'up' || action === 'dpad_up') {
        const next = selectedTrackRef.current > 0 ? selectedTrackRef.current - 1 : 2;
        selectTrack(next);
      } else if (action === 'down' || action === 'dpad_down') {
        const next = selectedTrackRef.current < 2 ? selectedTrackRef.current + 1 : 0;
        selectTrack(next);
      } else if (action === 'left' || action === 'dpad_left') {
        stepChannelVolume(selectedTrackRef.current, -5);
      } else if (action === 'right' || action === 'dpad_right') {
        stepChannelVolume(selectedTrackRef.current, 5);
      } else if (action === 'vol_up') {
        stepChannelVolume(selectedTrackRef.current, 5);
      } else if (action === 'vol_down') {
        stepChannelVolume(selectedTrackRef.current, -5);
      } else if (action === 'cross') {
        sound.playEnter(); // Valide uniquement, ne ferme JAMAIS le mixeur
      } else if (action === 'circle') {
        setIsMixerOpen(false);
        isMixerOpenRef.current = false;
        sound.playBack();
      }
      return;
    }

    // Commandes physiques de volume en jeu standard (mixeur fermé -> règle Général)
    if (action === 'vol_up') {
      stepChannelVolume(0, 5);
      return;
    } else if (action === 'vol_down') {
      stepChannelVolume(0, -5);
      return;
    }

    // Commandes en jeu standard
    if (action === 'left' || action === 'dpad_left') {
      gameRef.current.paddleX = Math.max(10, gameRef.current.paddleX - 28);
      if (gameRef.current.ballAttached) {
        gameRef.current.ballX = gameRef.current.paddleX + gameRef.current.paddleW / 2;
      }
      sound.playTick();
    } else if (action === 'right' || action === 'dpad_right') {
      gameRef.current.paddleX = Math.min(
        480 - 10 - gameRef.current.paddleW,
        gameRef.current.paddleX + 28
      );
      if (gameRef.current.ballAttached) {
        gameRef.current.ballX = gameRef.current.paddleX + gameRef.current.paddleW / 2;
      }
      sound.playTick();
    } else if (action === 'cross') {
      launchBall();
    } else if (action === 'circle') {
      sound.playBack();
      onExit();
    }
  }, [externalCommand, onExit, launchBall, selectTrack, stepChannelVolume]);

  // Boucle de rendu Canvas 2D (480x272 pixels natifs PSP)
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
      const paddleY = H - 24;

      // 1. Mise à jour de la logique physique (strictement suspendue si le mixeur est ouvert)
      if (g.state === 'playing' && !isMixerOpenRef.current) {
        // Déplacement raquette au clavier
        const paddleSpeed = 5.2;
        if (g.keys.left) {
          g.paddleX = Math.max(10, g.paddleX - paddleSpeed);
        }
        if (g.keys.right) {
          g.paddleX = Math.min(W - 10 - g.paddleW, g.paddleX + paddleSpeed);
        }

        // Balle attachée à la raquette
        if (g.ballAttached) {
          g.ballX = g.paddleX + g.paddleW / 2;
          g.ballY = paddleY - g.ballRadius - 1;
        } else {
          // Déplacement libre de la balle
          g.ballX += g.ballVx;
          g.ballY += g.ballVy;

          // Rebond murs gauche / droite
          if (g.ballX - g.ballRadius <= 8) {
            g.ballX = 8 + g.ballRadius;
            g.ballVx = Math.abs(g.ballVx);
            sound.playTick();
          } else if (g.ballX + g.ballRadius >= W - 8) {
            g.ballX = W - 8 - g.ballRadius;
            g.ballVx = -Math.abs(g.ballVx);
            sound.playTick();
          }

          // Rebond mur haut (sous le bandeau de score à y = 40)
          if (g.ballY - g.ballRadius <= 40) {
            g.ballY = 40 + g.ballRadius;
            g.ballVy = Math.abs(g.ballVy);
            sound.playTick();
          }

          // Rebond raquette
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
            const maxAngle = Math.PI / 3; // 60 degrés max
            const angle = hitPos * maxAngle;
            g.ballVx = Math.sin(angle) * speed;
            g.ballVy = -Math.abs(Math.cos(angle) * speed);
            g.ballY = paddleY - g.ballRadius - 1;
          }

          // Collisions briques
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

              // Mise à jour record
              if (g.score > highScore) {
                setHighScore(g.score);
                try {
                  localStorage.setItem('psp_brick_highscore', String(g.score));
                } catch {}
              }

              // Détermination de l'axe de rebond
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

          // Condition de victoire
          if (remainingBricks === 0) {
            g.state = 'victory';
            sound.playOption();
          }

          // Balle perdue en bas
          if (g.ballY - g.ballRadius > H) {
            g.lives--;
            if (g.lives <= 0) {
              sound.playBack();
              g.state = 'gameover';
            } else {
              sound.playBack();
              g.ballAttached = true;
              g.ballX = g.paddleX + g.paddleW / 2;
              g.ballY = paddleY - g.ballRadius - 1;
              g.ballVx = 0;
              g.ballVy = 0;
            }
          }
        }
      }

      // Mise à jour des particules (strictement suspendue si le mixeur est ouvert)
      if (!isMixerOpenRef.current) {
        for (let i = g.particles.length - 1; i >= 0; i--) {
          const p = g.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035;
          if (p.alpha <= 0) {
            g.particles.splice(i, 1);
          }
        }
      }

      // 2. Rendu Graphique (Canvas 2D)
      // Fond dégradé
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0c1017');
      bg.addColorStop(0.5, '#070a0f');
      bg.addColorStop(1, '#020406');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grille rétro
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 40; y < H; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Cadre délimitant l'aire de jeu
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 40, W - 12, H - 40 - 18);

      // Bandeau haut épuré (sous la Top Status Bar du PSP)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 20, W, 20);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(W, 40);
      ctx.stroke();

      // SCORE (à gauche)
      ctx.textAlign = 'left';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('SCORE', 16, 33);
      ctx.fillStyle = '#34d399';
      ctx.fillText(String(g.score).padStart(5, '0'), 56, 33);

      // RECORD (au centre)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('RECORD', W / 2 - 20, 33);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(String(highScore).padStart(5, '0'), W / 2 + 26, 33);

      // VIES (à droite - billes luminescentes)
      ctx.textAlign = 'right';
      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        ctx.arc(W - 44 + l * 13, 30, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = l < g.lives ? '#ef4444' : 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = l < g.lives ? '#f87171' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.textAlign = 'left';

      // Rendu des briques
      for (const b of g.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 2.5);
        ctx.fill();

        // Reflet supérieur
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 2);
      }

      // Rendu des particules
      for (const p of g.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Rendu de la raquette
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

      // Rendu de la balle avec aura néon
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, g.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Écrans modaux (Ready / Game Over / Victory)
      if (g.state === 'ready') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(80, 80, 320, 105);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 80, 320, 105);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BRICK BREAKER', W / 2, 112);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px monospace';
        ctx.fillText('[Clic] ou [✕] pour lancer la balle', W / 2, 138);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8.5px monospace';
        ctx.fillText('Trackpad / Souris pour déplacer • [◯] Quitter', W / 2, 160);
        ctx.textAlign = 'left';
      } else if (g.state === 'gameover') {
        ctx.fillStyle = 'rgba(15, 5, 8, 0.88)';
        ctx.fillRect(80, 80, 320, 105);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 80, 320, 105);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, 112);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.fillText(`Score final : ${g.score} points`, W / 2, 138);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.fillText('[Clic] ou [✕] Rejouer • [◯] Retour', W / 2, 160);
        ctx.textAlign = 'left';
      } else if (g.state === 'victory') {
        ctx.fillStyle = 'rgba(5, 20, 15, 0.88)';
        ctx.fillRect(80, 80, 320, 105);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(80, 80, 320, 105);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR ! VICTOIRE', W / 2, 112);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.fillText(`Score : ${g.score} points !`, W / 2, 138);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.fillText('[Clic] ou [✕] Recommencer • [◯] Retour', W / 2, 160);
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
        onPointerMove={handlePointerMove}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onPointerDown={handlePointerDown}
        onClick={handleCanvasClick}
        className="w-full h-full object-contain bg-black cursor-pointer touch-none"
      />

      {/* Ligne d'aide unique et épurée au bas de l'écran (Chantier 1) */}
      <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center text-[8.5px] font-mono text-white/60 pointer-events-none z-10 tracking-wide">
        [Trackpad] Déplacer • [Clic / ✕] Lancer • [SELECT] Mixeur • [◯] Quitter
      </div>

      {/* Overlay Rétro Mixeur Multipiste - Format Panoramique Glassmorphism Sobre */}
      {isMixerOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => {
            setIsMixerOpen(false);
            sound.playBack();
          }}
        >
          <div
            className="w-[370px] sm:w-[390px] py-3.5 px-5 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête sobre */}
            <div className="mb-2.5">
              <h3 className="text-sm font-medium tracking-wide text-white/90">Mixeur audio</h3>
            </div>

            {/* Pistes et curseurs épurés */}
            <div className="space-y-1">
              {TRACKS.map((t, idx) => {
                const isSelected = selectedTrack === idx;
                const val = idx === 0 ? masterVol : idx === 1 ? bgmVol : sfxVol;
                return (
                  <div
                    key={t.id}
                    onClick={() => selectTrack(idx)}
                    className={`flex items-center transition-all ${
                      isSelected
                        ? 'bg-white/5 rounded-lg py-1 px-2 border border-white/5 text-white'
                        : 'py-1 px-2 border border-transparent text-white/70 hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Libellé : text-xs text-white/70 w-16 */}
                    <span className={`text-xs w-16 truncate ${isSelected ? 'text-white font-medium' : 'text-white/70'}`}>
                      {t.label}
                    </span>

                    {/* Jauge : h-1 bg-white/15 rounded-full overflow-hidden flex-1 cursor-pointer mx-3 */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setTrackVolumeDirect(idx, e.clientX, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) {
                          e.stopPropagation();
                          setTrackVolumeDirect(idx, e.clientX, e.currentTarget);
                        }
                      }}
                      className="relative h-1 bg-white/15 rounded-full overflow-hidden flex-1 cursor-pointer mx-3"
                    >
                      <div
                        className="h-full bg-white/90 rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                        style={{ width: `${val}%` }}
                      />
                    </div>

                    {/* Pourcentage : text-xs font-mono text-white/60 w-8 text-right */}
                    <span className="text-xs font-mono text-white/60 w-8 text-right">
                      {val}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pied de fenêtre minimaliste sur une seule ligne */}
            <p className="text-[10px] text-white/40 tracking-wider font-mono text-center pt-2 mt-2 border-t border-white/5">
              ▲/▼ Piste • ◄/► Volume • [◯ / SELECT] Fermer
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
