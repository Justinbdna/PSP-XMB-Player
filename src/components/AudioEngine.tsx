import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Track } from '../types/xmb';
import { saveTrackToHistory } from '../services/itunes';
import { YouTubeAudioBridge, YouTubeAudioBridgeHandle } from './YouTubeAudioBridge';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  showVolumeOSD: boolean;
  isYouTubeActive: boolean;
  audioError: string | null;
  analyser: AnalyserNode | null;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  togglePlay: () => void;
  seekRelative: (deltaSeconds: number) => void;
  setVolume: (val: number) => void;
  adjustVolume: (delta: number) => void;
  resumeAudioContext: () => void;
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ytBridgeRef = useRef<YouTubeAudioBridgeHandle | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isYouTubeActive, setIsYouTubeActive] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [showVolumeOSD, setShowVolumeOSD] = useState<boolean>(false);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialisation et réveil de l'AudioContext Web Audio API
  const resumeAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch((err) => console.warn('AudioContext resume prevented:', err));
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }, []);

  // Cycle de vie de l'élément HTML5 Audio natif
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!isYouTubeActive) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };

    const onPlay = () => {
      if (!isYouTubeActive) {
        setIsPlaying(true);
        setAudioError(null);
        resumeAudioContext();

        // Connexion sécurisée de la source audio à l'analyseur spectral (une seule fois)
        if (audioRef.current && audioCtxRef.current && analyserRef.current && !sourceNodeRef.current) {
          try {
            const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
            source.connect(analyserRef.current);
            analyserRef.current.connect(audioCtxRef.current.destination);
            sourceNodeRef.current = source;
          } catch (err) {
            console.warn('Web Audio createMediaElementSource bypass:', err);
          }
        }
      }
    };

    const onPause = () => {
      if (!isYouTubeActive) setIsPlaying(false);
    };

    const onEnded = () => {
      if (!isYouTubeActive) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    const onError = (e: Event) => {
      console.warn('HTML5 Audio playback error event:', e);
      if (!isYouTubeActive) {
        setIsPlaying(false);
        setAudioError('Erreur de lecture');
      }
    };

    const onStalled = () => {
      console.warn('HTML5 Audio stream stalled');
    };

    const onWaiting = () => {
      // Tampon en cours
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('waiting', onWaiting);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('waiting', onWaiting);
      audio.pause();
      audio.src = '';
    };
  }, [isYouTubeActive, resumeAudioContext, volume]);

  const triggerVolumeOSD = () => {
    setShowVolumeOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowVolumeOSD(false);
    }, 2200);
  };

  // Lancement d'une piste avec priorité absolue au moteur HTML5 natif
  const playTrack = (track: Track) => {
    saveTrackToHistory(track);
    setCurrentTrack(track);
    setAudioError(null);
    resumeAudioContext();

    // Règle d'or : si une previewUrl est disponible, utiliser directement l'audio HTML5
    if (track.previewUrl && track.previewUrl.trim() !== '') {
      setIsYouTubeActive(false);
      ytBridgeRef.current?.pause();

      if (!audioRef.current) return;
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.src = track.previewUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.volume = volume;
      setDuration(track.durationMs ? track.durationMs / 1000 : 30);

      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAudioError(null);
      }).catch((err) => {
        console.warn('HTML5 play() prevented by browser policy:', err);
        setAudioError('Lecture bloquée');
        setIsPlaying(false);
      });
    } else if (track.youtubeId) {
      // Passerelle YouTube utilisée uniquement si aucune previewUrl n'existe
      setIsYouTubeActive(true);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(track.durationMs ? track.durationMs / 1000 : 30);
      ytBridgeRef.current?.play(track.youtubeId);
      ytBridgeRef.current?.setVolume(volume);
    }
  };

  const pauseTrack = () => {
    if (isYouTubeActive) {
      ytBridgeRef.current?.pause();
      setIsPlaying(false);
    } else if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    resumeAudioContext();

    if (isYouTubeActive) {
      if (isPlaying) {
        ytBridgeRef.current?.pause();
        setIsPlaying(false);
      } else {
        ytBridgeRef.current?.resume();
        setIsPlaying(true);
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.warn('Resume failed:', err);
          setAudioError('Lecture bloquée');
        });
      }
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    resumeAudioContext();
    if (isYouTubeActive) {
      ytBridgeRef.current?.seekRelative(deltaSeconds);
    } else if (audioRef.current) {
      const nextTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + deltaSeconds));
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    ytBridgeRef.current?.setVolume(clamped);
    triggerVolumeOSD();
  };

  const adjustVolume = (delta: number) => {
    setVolumeState((prev) => {
      const next = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      if (audioRef.current) {
        audioRef.current.volume = next;
      }
      ytBridgeRef.current?.setVolume(next);
      return next;
    });
    triggerVolumeOSD();
  };

  // Revers de secours : si YouTube renvoie une erreur (droits 101/150), basculer sur HTML5
  const handleYouTubeError = (code: number) => {
    console.warn('YouTube Audio Bridge error code:', code);
    if (currentTrack?.previewUrl && currentTrack.previewUrl.trim() !== '') {
      console.log('Basculement immédiat vers le flux de secours HTML5 Audio');
      setIsYouTubeActive(false);
      ytBridgeRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.crossOrigin = 'anonymous';
        audioRef.current.src = currentTrack.previewUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.warn);
      }
    } else {
      setAudioError('Erreur de lecture');
      setIsPlaying(false);
    }
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
        isYouTubeActive,
        audioError,
        analyser: analyserRef.current,
        playTrack,
        pauseTrack,
        togglePlay,
        seekRelative,
        setVolume,
        adjustVolume,
        resumeAudioContext,
      }}
    >
      {children}
      <YouTubeAudioBridge
        ref={ytBridgeRef}
        isActive={isYouTubeActive}
        onStateChange={(ytIsPlaying) => {
          if (isYouTubeActive) {
            setIsPlaying(ytIsPlaying);
          }
        }}
        onTimeUpdate={(ytCurrent, ytDuration) => {
          if (isYouTubeActive) {
            setCurrentTime(ytCurrent);
            if (ytDuration > 0) {
              setDuration(ytDuration);
            }
          }
        }}
        onEnded={() => {
          if (isYouTubeActive) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }}
        onError={handleYouTubeError}
      />
    </AudioContext.Provider>
  );
};
