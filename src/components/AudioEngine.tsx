import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import { Track } from '../types/xmb';
import { saveTrackToHistory } from '../services/itunes';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  showVolumeOSD: boolean;
  audioError: string | null;
  analyser: AnalyserNode | null;
  playTrack: (track: Track) => void;
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [showVolumeOSD, setShowVolumeOSD] = useState<boolean>(false);
  const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const onPlay = () => {
        if (activeTypeRef.current === type) {
          setIsPlaying(true);
          setAudioError(null);
        }
      };
      const onPause = () => {
        if (activeTypeRef.current === type) {
          setIsPlaying(false);
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
          setIsPlaying(false);
          setCurrentTime(0);
        }
      };
      const onError = (e: Event) => {
        if (activeTypeRef.current === type) {
          console.warn(`HTML5 Audio playback error [${type}]:`, e);
          setIsPlaying(false);
          setAudioError('Erreur de lecture');
        }
      };

      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      return () => {
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
      cleanDirect();
      cleanLocal();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.warn);
      }
    };
  }, []);

  // Synchronisation dynamique du volume sur les deux instances
  useEffect(() => {
    if (directAudioRef.current) directAudioRef.current.volume = volume;
    if (localAudioRef.current) localAudioRef.current.volume = volume;
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

  // Moteur de lecture hybride (Chantier 4)
  const playTrack = (track: Track) => {
    saveTrackToHistory(track);
    setCurrentTrack(track);
    setAudioError(null);

    const isLocal = isLocalTrack(track);
    const audioSrc = track.url || track.previewUrl;

    if (!audioSrc || audioSrc.trim() === '') {
      setAudioError('Fichier audio introuvable');
      return;
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
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.8;
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(console.warn);
      }

      if (localAudioRef.current && audioCtxRef.current && analyserRef.current && !sourceNodeRef.current) {
        try {
          const source = audioCtxRef.current.createMediaElementSource(localAudioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
          sourceNodeRef.current = source;
        } catch (e) {
          console.warn('Web Audio node connection error:', e);
        }
      }

      setActiveAnalyser(analyserRef.current);

      if (localAudioRef.current) {
        localAudioRef.current.src = audioSrc;
        localAudioRef.current.currentTime = 0;
        localAudioRef.current.volume = volume;
        setDuration(track.durationMs ? track.durationMs / 1000 : 30);

        localAudioRef.current.play().then(() => {
          setIsPlaying(true);
          setAudioError(null);
        }).catch((err) => {
          console.warn('Local play prevented:', err);
          setIsPlaying(false);
        });
      }
    } else {
      // 2. FLUX ITUNES CDN (Tiers) -> Sortie matérielle directe sans blocage Safari
      if (localAudioRef.current) {
        localAudioRef.current.pause();
      }
      activeTypeRef.current = 'direct';
      setActiveAnalyser(null);

      if (directAudioRef.current) {
        directAudioRef.current.src = audioSrc;
        directAudioRef.current.currentTime = 0;
        directAudioRef.current.volume = volume;
        setDuration(track.durationMs ? track.durationMs / 1000 : 30);

        directAudioRef.current.play().then(() => {
          setIsPlaying(true);
          setAudioError(null);
        }).catch((err) => {
          console.warn('Direct play prevented:', err);
          setIsPlaying(false);
        });
      }
    }
  };

  const pauseTrack = () => {
    const audio = getActiveAudio();
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const audio = getActiveAudio();
    if (!audio) return;
    if (!currentTrack) return;

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(console.warn);
    }

    if (isPlaying) {
      pauseTrack();
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        setAudioError(null);
      }).catch((err) => {
        console.warn('Resume failed:', err);
        setIsPlaying(false);
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
    setVolumeState(clamped);
    if (directAudioRef.current) directAudioRef.current.volume = clamped;
    if (localAudioRef.current) localAudioRef.current.volume = clamped;
    triggerVolumeOSD();
  };

  const adjustVolume = (delta: number) => {
    setVolumeState((prev) => {
      const next = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      if (directAudioRef.current) directAudioRef.current.volume = next;
      if (localAudioRef.current) localAudioRef.current.volume = next;
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
        playTrack,
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
