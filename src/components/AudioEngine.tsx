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

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [showVolumeOSD, setShowVolumeOSD] = useState<boolean>(false);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instanciation de l'élément HTML5 Audio natif avec sortie matérielle directe (sans interception Web Audio)
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = 'auto';
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      setAudioError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = (e: Event) => {
      console.warn('HTML5 Audio playback error event:', e);
      setIsPlaying(false);
      setAudioError('Erreur de lecture');
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
  }, []);

  // Synchronisation dynamique du volume direct
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const triggerVolumeOSD = () => {
    setShowVolumeOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowVolumeOSD(false);
    }, 2200);
  };

  // Lecture directe d'un morceau (URL CDN Apple ou fichier local /audio/...)
  const playTrack = (track: Track) => {
    saveTrackToHistory(track);
    setCurrentTrack(track);
    setAudioError(null);

    const audioSrc = (track as any).url || track.previewUrl;
    if (!audioSrc || audioSrc.trim() === '') {
      setAudioError('Fichier audio introuvable');
      return;
    }

    if (!audioRef.current) return;

    if (currentTrack?.id === track.id && audioRef.current.src.includes(audioSrc)) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => {
          console.warn('HTML5 resume prevented:', err);
          setAudioError('Lecture bloquée');
        });
      }
      return;
    }

    audioRef.current.src = audioSrc;
    audioRef.current.currentTime = 0;
    audioRef.current.volume = volume;
    setDuration(track.durationMs ? track.durationMs / 1000 : 30);

    audioRef.current.play().then(() => {
      setIsPlaying(true);
      setAudioError(null);
    }).catch((err) => {
      console.warn('HTML5 play() prevented by browser policy:', err);
      setAudioError('Cliquez pour lancer');
      setIsPlaying(false);
    });
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (!currentTrack) return;

    if (isPlaying) {
      pauseTrack();
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAudioError(null);
      }).catch((err) => {
        console.warn('Resume failed:', err);
        setAudioError('Cliquez pour lancer');
      });
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    const nextTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + deltaSeconds));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    triggerVolumeOSD();
  };

  const adjustVolume = (delta: number) => {
    setVolumeState((prev) => {
      const next = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      if (audioRef.current) {
        audioRef.current.volume = next;
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
