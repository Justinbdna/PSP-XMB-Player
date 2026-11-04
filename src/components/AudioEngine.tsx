import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Track } from '../types/xmb';
import { saveTrackToHistory } from '../services/itunes';
import itunesPlaylist from '../data/playlist.json';
import localTracksData from '../data/local-tracks.json';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  showVolumeOSD: boolean;
  audioError: string | null;
  analyser: AnalyserNode | null;
  isRealDSP: boolean;
  playlist: Track[];
  setPlaylist: (tracks: Track[]) => void;
  playTrack: (track: Track, newPlaylist?: Track[]) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  pauseTrack: () => void;
  togglePlay: () => void;
  seekRelative: (deltaSeconds: number) => void;
  setVolume: (val: number) => void;
  adjustVolume: (delta: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

const isLocalTrack = (track: Track): boolean => {
  const url = track.url || track.previewUrl || '';
  return track.sourceType === 'local' || url.startsWith('/') || url.includes('/audio/');
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Deux instances distinctes pour garantir 0 conflit WebKit CORS :
  // 1. directAudio : pour flux distants iTunes (sortie matérielle 100% directe)
  // 2. localAudio : pour fichiers locaux (relié à AnalyserNode Web Audio API)
  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeTypeRef = useRef<'direct' | 'local'>('direct');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const currentTrackRef = useRef<Track | null>(null);

  const [playlist, setPlaylistState] = useState<Track[]>(itunesPlaylist as Track[]);
  const playlistRef = useRef<Track[]>(itunesPlaylist as Track[]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolumeState] = useState<number>(0.85);
  const volumeRef = useRef<number>(0.85);

  const [showVolumeOSD, setShowVolumeOSD] = useState<boolean>(false);
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);
  const [isRealDSP, setIsRealDSP] = useState<boolean>(false);

  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFadingRef = useRef<boolean>(false);
  const playSeqRef = useRef<number>(0);
  const onEndedRef = useRef<() => void>(() => {});

  const setPlaylist = useCallback((tracks: Track[]) => {
    playlistRef.current = tracks;
    setPlaylistState(tracks);
  }, []);

  const stopFade = () => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
      isFadingRef.current = false;
    }
  };

  // Atténuation rapide du volume de l'audio actif vers 0 (Chantier 3 - Fade-out)
  const fadeOut = (audio: HTMLAudioElement, durationMs = 220): Promise<void> => {
    return new Promise((resolve) => {
      stopFade();
      if (!audio || audio.paused || audio.volume <= 0.01) {
        if (audio) audio.volume = 0;
        resolve();
        return;
      }
      isFadingRef.current = true;
      const startVol = audio.volume;
      const steps = 9;
      const stepTime = Math.max(10, Math.floor(durationMs / steps));
      let step = 0;

      fadeIntervalRef.current = setInterval(() => {
        step++;
        const frac = Math.max(0, 1 - step / steps);
        audio.volume = startVol * frac;

        if (step >= steps) {
          stopFade();
          audio.volume = 0;
          resolve();
        }
      }, stepTime);
    });
  };

  // Montée progressive du volume vers le volume cible (Chantier 3 - Fade-in)
  const fadeIn = (audio: HTMLAudioElement, targetVolume = volumeRef.current, durationMs = 300): Promise<void> => {
    return new Promise((resolve) => {
      stopFade();
      if (!audio) {
        resolve();
        return;
      }
      isFadingRef.current = true;
      audio.volume = 0;
      const steps = 12;
      const stepTime = Math.max(10, Math.floor(durationMs / steps));
      let step = 0;

      fadeIntervalRef.current = setInterval(() => {
        step++;
        const frac = Math.min(1, step / steps);
        const currentTarget = targetVolume > 0 ? targetVolume : volumeRef.current;
        audio.volume = currentTarget * frac;

        if (step >= steps) {
          stopFade();
          audio.volume = currentTarget;
          resolve();
        }
      }, stepTime);
    });
  };

  // Initialisation des éléments audio et des écouteurs d'événements
  useEffect(() => {
    const directAudio = new Audio();
    directAudio.volume = volume;
    directAudio.preload = 'auto';
    directAudioRef.current = directAudio;

    const localAudio = new Audio();
    localAudio.volume = volume;
    localAudio.preload = 'auto';
    localAudioRef.current = localAudio;

    const attachListeners = (audio: HTMLAudioElement, type: 'direct' | 'local') => {
      const onCanPlay = () => {
        console.log(`[AudioEngine] Prêt à lire [${type}] :`, audio.src);
      };
      const onPlay = () => {
        if (activeTypeRef.current === type) {
          setIsPlaying(true);
          isPlayingRef.current = true;
          setAudioError(null);
        }
      };
      const onPause = () => {
        if (activeTypeRef.current === type) {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      };
      const onTimeUpdate = () => {
        if (activeTypeRef.current === type) {
          setCurrentTime(audio.currentTime);
        }
      };
      const onLoadedMetadata = () => {
        if (activeTypeRef.current === type && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };
      const onEnded = () => {
        if (activeTypeRef.current === type) {
          console.log(`[AudioEngine] Piste terminée [${type}], enchaînement automatique...`);
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentTime(0);
          onEndedRef.current();
        }
      };
      const onError = (e: Event) => {
        if (activeTypeRef.current === type) {
          console.error(`[AudioEngine] Erreur chargement audio [${type}] :`, audio.error, audio.src, e);
          setIsPlaying(false);
          isPlayingRef.current = false;
          setAudioError('Erreur de lecture');
        }
      };

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      return () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.pause();
        audio.src = '';
      };
    };

    const cleanDirect = attachListeners(directAudio, 'direct');
    const cleanLocal = attachListeners(localAudio, 'local');

    return () => {
      stopFade();
      cleanDirect();
      cleanLocal();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.warn);
      }
    };
  }, []);

  // Synchronisation dynamique du volume sur les deux instances (hors animation de fondu)
  useEffect(() => {
    volumeRef.current = volume;
    if (!isFadingRef.current) {
      if (directAudioRef.current) directAudioRef.current.volume = volume;
      if (localAudioRef.current) localAudioRef.current.volume = volume;
    }
  }, [volume]);

  const triggerVolumeOSD = () => {
    setShowVolumeOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowVolumeOSD(false);
    }, 2200);
  };

  const getActiveAudio = (): HTMLAudioElement | null => {
    return activeTypeRef.current === 'local' ? localAudioRef.current : directAudioRef.current;
  };

  // Moteur de lecture avec fondu doux (Fade-out / Fade-in) et double flux DSP
  const playTrack = async (track: Track, newPlaylist?: Track[]) => {
    const seq = ++playSeqRef.current;

    if (newPlaylist && newPlaylist.length > 0) {
      playlistRef.current = newPlaylist;
      setPlaylistState(newPlaylist);
    } else if (
      !playlistRef.current.length ||
      !playlistRef.current.some(
        (t) => (t.id && t.id === track.id) || t.url === track.url || t.previewUrl === track.previewUrl
      )
    ) {
      if (isLocalTrack(track)) {
        playlistRef.current = localTracksData as Track[];
        setPlaylistState(localTracksData as Track[]);
      } else {
        playlistRef.current = itunesPlaylist as Track[];
        setPlaylistState(itunesPlaylist as Track[]);
      }
    }

    currentTrackRef.current = track;
    setCurrentTrack(track);
    saveTrackToHistory(track);
    setAudioError(null);

    const isLocal = isLocalTrack(track);
    const rawUrl = track.url || track.previewUrl || '';

    if (!rawUrl || rawUrl.trim() === '') {
      setAudioError('Fichier audio introuvable');
      return;
    }

    // Normalisation stricte de l'URL pour gérer les espaces et caractères spéciaux
    const decoded = decodeURI(rawUrl);
    const finalAudioSrc = rawUrl.startsWith('http') ? rawUrl : encodeURI(decoded);

    // 1. Fondu de sortie (fade-out) sur le lecteur actif s'il jouait déjà
    const prevAudio = getActiveAudio();
    if (prevAudio && !prevAudio.paused && isPlayingRef.current) {
      await fadeOut(prevAudio, 220);
      if (seq !== playSeqRef.current) return;
      prevAudio.pause();
    } else {
      stopFade();
      if (prevAudio) prevAudio.pause();
    }

    if (isLocal) {
      // 1. FICHIER LOCAL (Même origine) -> Passage par Web Audio API & AnalyserNode
      if (directAudioRef.current) {
        directAudioRef.current.pause();
      }
      activeTypeRef.current = 'local';

      // Initialisation paresseuse de l'AudioContext lors du premier fichier local
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.75;
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }
      } else if (analyserRef.current) {
        analyserRef.current.fftSize = 512;
        analyserRef.current.smoothingTimeConstant = 0.75;
      }

      // Réveil asynchrone de l'AudioContext sur Safari (WebKit)
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        try {
          await audioCtxRef.current.resume();
        } catch (e) {
          console.warn('[AudioEngine] Erreur reprise AudioContext:', e);
        }
      }

      // Connexion robuste au nœud d'analyse FFT et à la sortie audio
      if (localAudioRef.current && audioCtxRef.current && analyserRef.current && !sourceNodeRef.current) {
        try {
          const source = audioCtxRef.current.createMediaElementSource(localAudioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
          sourceNodeRef.current = source;
          setActiveAnalyser(analyserRef.current);
          setIsRealDSP(true);
        } catch (e) {
          console.warn('[AudioEngine] Échec connexion graphe Web Audio, repli matériel direct :', e);
          setActiveAnalyser(null);
          setIsRealDSP(false);
        }
      } else if (analyserRef.current) {
        setActiveAnalyser(analyserRef.current);
        setIsRealDSP(true);
      }

      if (localAudioRef.current) {
        localAudioRef.current.volume = 0;
        localAudioRef.current.src = finalAudioSrc;
        localAudioRef.current.currentTime = 0;
        setDuration(track.durationMs ? track.durationMs / 1000 : 30);

        try {
          await localAudioRef.current.play();
          if (seq !== playSeqRef.current) return;
          setIsPlaying(true);
          isPlayingRef.current = true;
          setAudioError(null);
          console.log('[AudioEngine] Lecture locale démarrée avec fondu :', finalAudioSrc);
          await fadeIn(localAudioRef.current, volumeRef.current, 300);
        } catch (err) {
          console.warn('[AudioEngine] Lecture locale empêchée par le navigateur :', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      }
    } else {
      // 2. FLUX ITUNES CDN (Tiers) -> Sortie matérielle directe sans blocage Safari
      if (localAudioRef.current) {
        localAudioRef.current.pause();
      }
      activeTypeRef.current = 'direct';
      setActiveAnalyser(null);
      setIsRealDSP(false);

      if (directAudioRef.current) {
        directAudioRef.current.volume = 0;
        directAudioRef.current.src = finalAudioSrc;
        directAudioRef.current.currentTime = 0;
        setDuration(track.durationMs ? track.durationMs / 1000 : 30);

        try {
          await directAudioRef.current.play();
          if (seq !== playSeqRef.current) return;
          setIsPlaying(true);
          isPlayingRef.current = true;
          setAudioError(null);
          console.log('[AudioEngine] Lecture iTunes démarrée avec fondu :', finalAudioSrc);
          await fadeIn(directAudioRef.current, volumeRef.current, 300);
        } catch (err) {
          console.warn('[AudioEngine] Lecture directe empêchée :', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      }
    }
  };

  // Enchaînement piste suivante (bouclage en fin de liste)
  const nextTrack = useCallback(() => {
    const list = playlistRef.current;
    if (!list || list.length === 0) return;
    const current = currentTrackRef.current;
    let currIdx = -1;
    if (current) {
      currIdx = list.findIndex(
        (t) =>
          (t.id && t.id === current.id) ||
          (t.url && t.url === current.url) ||
          (t.previewUrl && t.previewUrl === current.previewUrl)
      );
    }
    const nextIdx = (currIdx + 1) % list.length;
    const next = list[nextIdx];
    if (next) {
      playTrack(next);
    }
  }, []);

  // Enchaînement piste précédente (bouclage au début de liste)
  const previousTrack = useCallback(() => {
    const list = playlistRef.current;
    if (!list || list.length === 0) return;
    const current = currentTrackRef.current;
    let currIdx = -1;
    if (current) {
      currIdx = list.findIndex(
        (t) =>
          (t.id && t.id === current.id) ||
          (t.url && t.url === current.url) ||
          (t.previewUrl && t.previewUrl === current.previewUrl)
      );
    }
    const prevIdx = currIdx > 0 ? currIdx - 1 : list.length - 1;
    const prev = list[prevIdx];
    if (prev) {
      playTrack(prev);
    }
  }, []);

  // Connexion de la référence pour l'écouteur `onEnded`
  onEndedRef.current = () => {
    nextTrack();
  };

  const pauseTrack = () => {
    const audio = getActiveAudio();
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const togglePlay = async () => {
    const audio = getActiveAudio();
    if (!audio) return;
    if (!currentTrack) {
      if (playlistRef.current.length > 0) {
        playTrack(playlistRef.current[0]);
      }
      return;
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
      } catch (e) {
        console.warn('[AudioEngine] Erreur reprise AudioContext:', e);
      }
    }

    if (isPlaying) {
      pauseTrack();
    } else {
      audio.volume = 0;
      audio.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
        setAudioError(null);
        fadeIn(audio, volumeRef.current, 250);
      }).catch((err) => {
        console.warn('[AudioEngine] Reprise échouée:', err);
        setIsPlaying(false);
        isPlayingRef.current = false;
      });
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    const audio = getActiveAudio();
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(duration, audio.currentTime + deltaSeconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (!isFadingRef.current) {
      if (directAudioRef.current) directAudioRef.current.volume = clamped;
      if (localAudioRef.current) localAudioRef.current.volume = clamped;
    }
    triggerVolumeOSD();
  };

  const adjustVolume = (delta: number) => {
    setVolumeState((prev) => {
      const next = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      volumeRef.current = next;
      if (!isFadingRef.current) {
        if (directAudioRef.current) directAudioRef.current.volume = next;
        if (localAudioRef.current) localAudioRef.current.volume = next;
      }
      return next;
    });
    triggerVolumeOSD();
  };

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        showVolumeOSD,
        audioError,
        analyser: activeAnalyser,
        isRealDSP,
        playlist,
        setPlaylist,
        playTrack,
        nextTrack,
        previousTrack,
        pauseTrack,
        togglePlay,
        seekRelative,
        setVolume,
        adjustVolume,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
