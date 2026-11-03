import { Track } from '../types/xmb';
import defaultPlaylist from '../data/playlist.json';

// Local editable JSON playlist loaded by default
export const NOSTALGIC_PSP_TRACKS: Track[] = defaultPlaylist as Track[];

// SensMe™ channels playlists (Relax & Energetic)
export const SENSME_PLAYLISTS: Record<string, Track[]> = {
  relax: [
    NOSTALGIC_PSP_TRACKS[0], // Sade Like a Tattoo
    NOSTALGIC_PSP_TRACKS[1], // Sade No Ordinary Love
    NOSTALGIC_PSP_TRACKS[2], // Sade Kiss of Life
    NOSTALGIC_PSP_TRACKS[3], // Tears for Fears
    NOSTALGIC_PSP_TRACKS[4], // Player Baby Come Back
  ],
  energetic: [
    NOSTALGIC_PSP_TRACKS[5], // Black Eyed Peas My Humps
    NOSTALGIC_PSP_TRACKS[6], // Gorillaz Feel Good Inc
    NOSTALGIC_PSP_TRACKS[7], // Daft Punk One More Time
    NOSTALGIC_PSP_TRACKS[11], // 50 Cent Candy Shop
    NOSTALGIC_PSP_TRACKS[12], // Madonna Hung Up
    NOSTALGIC_PSP_TRACKS[13], // Gwen Stefani Hollaback Girl
  ],
};

// Search tracks directly using Apple iTunes Search API (15 results limit)
export async function searchTracks(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);
    const data = await res.json();
    return (data.results || [])
      .filter((item: any) => item.previewUrl)
      .map((item: any) => ({
        id: String(item.trackId),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single',
        previewUrl: item.previewUrl,
        artworkUrl: (item.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg'),
        durationMs: item.trackTimeMillis,
      }));
  } catch (error) {
    console.error('Failed to search tracks from iTunes:', error);
    return [];
  }
}

// Listening History in localStorage
const HISTORY_STORAGE_KEY = 'psp_listening_history';

export function getListeningHistory(): Track[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read listening history:', e);
    return [];
  }
}

export function saveTrackToHistory(track: Track): void {
  try {
    const current = getListeningHistory();
    const filtered = current.filter((t) => t.id !== track.id);
    const updated = [track, ...filtered].slice(0, 25);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save to history:', e);
  }
}

export function clearListeningHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear history:', e);
  }
}
