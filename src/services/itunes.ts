import { Track } from '../types/xmb';

// 2005 Nostalgic Tracks matching PSP European / US release era
export const NOSTALGIC_PSP_TRACKS: Track[] = [
  {
    id: 'psp-1',
    title: 'Feel Good Inc.',
    artist: 'Gorillaz',
    album: 'Demon Days (2005)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/be/89/a4be89b6-ee85-f5b2-3e28-1b250529e798/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/65/56/1c655615-585e-b816-d3c4-ec0aa9c0dae8/825646187282.jpg/600x600bb.jpg',
  },
  {
    id: 'psp-2',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/3c/6e/c3/3c6ec35b-179d-3f0d-e2d1-21ff065c2763/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/73/0c/39/730c39f0-d5a2-cf29-d6e6-92f75a7c5b6b/0724384960650.jpg/600x600bb.jpg',
  },
  {
    id: 'psp-3',
    title: 'In the End',
    artist: 'Linkin Park',
    album: 'Hybrid Theory',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/c3/13/46/c3134608-f463-54aa-3705-cb668ca92e48/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4e/c3/ce/4ec3ce4a-b5e1-872f-53c8-5cbdf93a6e81/093624853329.jpg/600x600bb.jpg',
  },
  {
    id: 'psp-4',
    title: 'Speed of Sound',
    artist: 'Coldplay',
    album: 'X&Y (2005)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b9/7a/b7/b97ab751-2407-7434-2e91-c917dcb17ca2/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c8/10/7c/c8107cd1-9aa2-e87a-a436-15ba12995964/0724347478659.jpg/600x600bb.jpg',
  },
  {
    id: 'psp-5',
    title: 'Boulevard of Broken Dreams',
    artist: 'Green Day',
    album: 'American Idiot',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/44/ff/b9/44ffb9d4-c483-3467-fdb9-601445ec6611/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/64/70/4c/64704c7f-1786-f04b-32ae-9b216ce70498/093624877721.jpg/600x600bb.jpg',
  },
  {
    id: 'psp-6',
    title: 'Lady (Hear Me Tonight)',
    artist: 'Modjo',
    album: 'Modjo',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/31/32/c9/3132c968-0761-fa08-e4b5-685fc9a4ae10/m4a.mp3',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/f2/17/dc/f217dcd0-244e-0a56-2713-305ce7b5d3a5/00731458763529.rgb.jpg/600x600bb.jpg',
  }
];

export async function searchTracks(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;
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
