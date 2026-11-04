import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
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
  const ytBridgeRef = useRef<YouTubeAudioBridgeHandle | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isYouTubeActive, setIsYouTubeActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(90);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [showVolumeOSD, setShowVolumeOSD] = useState<boolean>(false);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!isYouTubeActive) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      }
    };

    const onPlay = () => {
      if (!isYouTubeActive) setIsPlaying(true);
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
      console.warn('Audio playback error:', e);
      if (!isYouTubeActive) setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, [isYouTubeActive]);

  const triggerVolumeOSD = () => {
    setShowVolumeOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowVolumeOSD(false);
    }, 2200);
  };

  const playTrack = (track: Track) => {
    saveTrackToHistory(track);
    setCurrentTrack(track);

    if (track.youtubeId) {
      // Bascule vers le Headless YouTube Audio Bridge
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsYouTubeActive(true);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(track.durationMs ? track.durationMs / 1000 : 90);
      ytBridgeRef.current?.play(track.youtubeId);
      ytBridgeRef.current?.setVolume(volume);
    } else {
      // Bascule vers le moteur audio HTML5 classique
      setIsYouTubeActive(false);
      ytBridgeRef.current?.pause();

      if (!audioRef.current) return;
      audioRef.current.src = track.previewUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('Playback error on track:', track.title, err);
        setIsPlaying(false);
      });
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
        audioRef.current.play().catch((err) => console.warn('Resume failed:', err));
      }
    }
  };

  const seekRelative = (deltaSeconds: number) => {
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
        playTrack,
        pauseTrack,
        togglePlay,
        seekRelative,
        setVolume,
        adjustVolume,
      }}
    >
      {children}
      <YouTubeAudioBridge
        ref={ytBridgeRef}
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
      />
    </AudioContext.Provider>
  );
};
