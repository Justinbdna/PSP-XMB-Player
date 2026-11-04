// Service Audio Natif Sony PSP - Remplacement des bruitages synthétiques par les SFX authentiques
class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 1.0;
  private systemOkBuffer: AudioBuffer | null = null;
  private systemOkAudio: HTMLAudioElement | null = null;

  constructor() {
    this.preload();
  }

  // Préchargement natif hybride : Buffer Web Audio pour zéro latence + repli HTML5 Audio
  private preload() {
    if (typeof window === 'undefined') return;

    // 1. Préchargement HTML5 Audio pour disponibilité immédiate
    try {
      this.systemOkAudio = new Audio('/audio/sfx/system_ok.mp3');
      this.systemOkAudio.preload = 'auto';
      this.systemOkAudio.volume = 0.28;
      this.systemOkAudio.load();
    } catch {}

    // 2. Préchargement et décodage du buffer Web Audio (lecture polyphonique et instantanée)
    try {
      fetch('/audio/sfx/system_ok.mp3')
        .then((res) => {
          if (!res.ok) throw new Error('Échec du téléchargement SFX');
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtxClass) return;

          // Décodage avec OfflineAudioContext pour éviter d'activer l'AudioContext avant interaction utilisateur
          const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
          if (OfflineCtxClass) {
            const offlineCtx = new OfflineCtxClass(1, 44100, 44100);
            return offlineCtx.decodeAudioData(arrayBuffer);
          } else {
            const ctx = this.getContext();
            return ctx.decodeAudioData(arrayBuffer);
          }
        })
        .then((decodedBuffer) => {
          if (decodedBuffer) {
            this.systemOkBuffer = decodedBuffer;
          }
        })
        .catch(() => {
          // Repli automatique sur HTML5 Audio
        });
    } catch {}
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Déplacement de curseur : suppression des oscillateurs synthétiques artificiels (sons IA)
  public playTick() {
    // Synthèse artificielle createOscillator dépréciée et retirée
  }

  public playCursor() {
    this.playTick();
  }

  // Bruitage officiel Sony PSP (✕, validation de dossiers, morceaux et actions système)
  public playEnter() {
    if (this.isMuted || this.volume <= 0.001) return;

    // 1. Lecture prioritaire via Web Audio API Buffer (zéro latence & polyphonie)
    try {
      if (this.systemOkBuffer) {
        const ctx = this.getContext();
        const source = ctx.createBufferSource();
        source.buffer = this.systemOkBuffer;

        const gainNode = ctx.createGain();
        // Calibré discret entre 0.25 et 0.30 (28 %) pour un rendu feutré et non agressif
        gainNode.gain.setValueAtTime(0.28 * this.volume, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
        return;
      }
    } catch {
      // repli en cas de suspension de contexte
    }

    // 2. Repli fluide sur HTML5 Audio
    try {
      if (this.systemOkAudio) {
        const soundClone = this.systemOkAudio.cloneNode() as HTMLAudioElement;
        soundClone.volume = Math.max(0, Math.min(1, 0.28 * this.volume));
        soundClone.play().catch(() => {});
      }
    } catch {}
  }

  // Retour arrière (◯) : suppression de l'oscillateur synthétique
  public playBack() {
    // Synthèse artificielle createOscillator dépréciée et retirée
  }

  // Options (△) : suppression de l'oscillateur synthétique
  public playOption() {
    // Synthèse artificielle createOscillator dépréciée et retirée
  }
}

export const sound = new SoundService();
