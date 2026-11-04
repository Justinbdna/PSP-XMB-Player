import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeAudioBridgeHandle {
  play: (videoId: string) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (seconds: number) => void;
  seekRelative: (delta: number) => void;
  setVolume: (volume0to1: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isReady: () => boolean;
}

export interface YouTubeAudioBridgeProps {
  isActive?: boolean;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (errorCode: number) => void;
}

export const YouTubeAudioBridge = forwardRef<YouTubeAudioBridgeHandle, YouTubeAudioBridgeProps>(
  ({ isActive = false, onStateChange, onTimeUpdate, onEnded, onError }, ref) => {
    const playerRef = useRef<any>(null);
    const isReadyRef = useRef<boolean>(false);
    const pendingVideoIdRef = useRef<string | null>(null);
    const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialisation dynamique du script YouTube IFrame Player
    useEffect(() => {
      let isCancelled = false;

      const initPlayer = () => {
        if (isCancelled || playerRef.current || !window.YT || !window.YT.Player) return;

        playerRef.current = new window.YT.Player('youtube-audio-bridge-iframe', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              isReadyRef.current = true;
              if (pendingVideoIdRef.current && playerRef.current) {
                playerRef.current.loadVideoById(pendingVideoIdRef.current);
                playerRef.current.playVideo();
                pendingVideoIdRef.current = null;
              }
            },
            onStateChange: (event: any) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
              const isPlaying = event.data === 1;
              onStateChange?.(isPlaying);
              if (event.data === 0) {
                onEnded?.();
              }
            },
            onError: (err: any) => {
              console.warn('YouTube Player Error:', err);
              onStateChange?.(false);
              onError?.(err?.data || 100);
            },
          },
        });
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.body.appendChild(tag);
        }
        const prevOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevOnReady) prevOnReady();
          initPlayer();
        };
      }

      // Ticker pour synchroniser currentTime et duration à 4 Hz
      tickerRef.current = setInterval(() => {
        if (playerRef.current && isReadyRef.current && playerRef.current.getCurrentTime) {
          try {
            const current = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            if (dur > 0) {
              onTimeUpdate?.(current, dur);
            }
          } catch {
            // Player en transition
          }
        }
      }, 250);

      return () => {
        isCancelled = true;
        if (tickerRef.current) clearInterval(tickerRef.current);
        if (playerRef.current && playerRef.current.destroy) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }, [onEnded, onError, onStateChange, onTimeUpdate]);

    useImperativeHandle(ref, () => ({
      play: (videoId: string) => {
        if (playerRef.current && isReadyRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(videoId);
          playerRef.current.playVideo();
        } else {
          pendingVideoIdRef.current = videoId;
        }
      },
      pause: () => {
        if (playerRef.current && isReadyRef.current && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
        }
      },
      resume: () => {
        if (playerRef.current && isReadyRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      },
      seekTo: (seconds: number) => {
        if (playerRef.current && isReadyRef.current && playerRef.current.seekTo) {
          playerRef.current.seekTo(seconds, true);
        }
      },
      seekRelative: (delta: number) => {
        if (playerRef.current && isReadyRef.current && playerRef.current.getCurrentTime) {
          const current = playerRef.current.getCurrentTime() || 0;
          playerRef.current.seekTo(Math.max(0, current + delta), true);
        }
      },
      setVolume: (volume0to1: number) => {
        if (playerRef.current && isReadyRef.current && playerRef.current.setVolume) {
          playerRef.current.setVolume(Math.round(volume0to1 * 100));
        }
      },
      getCurrentTime: () => {
        return playerRef.current && isReadyRef.current && playerRef.current.getCurrentTime
          ? playerRef.current.getCurrentTime()
          : 0;
      },
      getDuration: () => {
        return playerRef.current && isReadyRef.current && playerRef.current.getDuration
          ? playerRef.current.getDuration()
          : 0;
      },
      isReady: () => isReadyRef.current,
    }));

    return (
      <div
        id="youtube-audio-bridge-container"
        className={`absolute bottom-2 right-2 transition-opacity duration-300 ${
          isActive
            ? 'w-24 h-16 opacity-30 rounded overflow-hidden border border-white/20 z-10 pointer-events-auto shadow-md'
            : 'w-0 h-0 opacity-0 pointer-events-none overflow-hidden -top-[9999px]'
        }`}
        aria-hidden="true"
      >
        <div id="youtube-audio-bridge-iframe" className="w-full h-full" />
      </div>
    );
  }
);
