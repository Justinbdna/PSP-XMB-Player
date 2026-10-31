import { Track } from '../types/xmb';

// 2005 Nostalgic Tracks matching PSP release era with verified live streamable iTunes previews
export const NOSTALGIC_PSP_TRACKS: Track[] = [
  {
    id: 'psp-850571371',
    title: 'Feel Good Inc.',
    artist: 'Gorillaz',
    album: 'Demon Days (2005)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9a/a7/90/9aa790e3-651e-9674-26ac-14aba4d3b8d1/mzaf_10454527198707970464.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1c/0f/81/1c0f818a-e458-dd84-6f1b-ccbdf5fe14d6/825646291045.jpg/600x600bb.jpg',
    durationMs: 221173,
  },
  {
    id: 'psp-697195462',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5d/93/d8/5d93d83f-ad1e-da4d-1d79-9937bdff24ec/mzaf_14396932211949300852.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg/600x600bb.jpg',
    durationMs: 320357,
  },
  {
    id: 'psp-590431785',
    title: 'In the End',
    artist: 'Linkin Park',
    album: 'Hybrid Theory',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d9/33/34/d933341d-ba95-dc3b-11a3-34d6632dd62e/mzaf_10942671303595386057.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/53/a7/7f/53a77fab-c54c-a57b-8130-248fc12d0c80/093624948995.jpg/600x600bb.jpg',
    durationMs: 216294,
  },
  {
    id: 'psp-1123076830',
    title: 'Speed of Sound',
    artist: 'Coldplay',
    album: 'X&Y (2005)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/71/43/70/71437058-1d39-b12c-2b37-a1b14a5d26f0/mzaf_5970876114034094619.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/0c/82/48/0c8248a8-4a5b-d30d-8056-f32d650d2fc9/190295978068.jpg/600x600bb.jpg',
    durationMs: 288393,
  },
  {
    id: 'psp-gd-holiday',
    title: 'Holiday',
    artist: 'Green Day',
    album: 'American Idiot (2004)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/86/f1/d0/86f1d039-f2d6-2f5b-b34b-2b63504fa6d0/mzaf_3363059623415356317.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/64/70/4c/64704c7f-1786-f04b-32ae-9b216ce70498/093624877721.jpg/600x600bb.jpg',
    durationMs: 232000,
  },
  {
    id: 'psp-692624266',
    title: 'Lady (Hear Me Tonight)',
    artist: 'Modjo',
    album: 'Modjo',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/39/a0/2a/39a02a04-7e77-c309-9128-02e61098a7b7/mzaf_7220909039799435982.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f5/25/2b/f5252b6e-0659-890b-7e9d-0e691944b95b/cover.jpg/600x600bb.jpg',
    durationMs: 307154,
  },
];

// SensMe™ channels playlists (Lounge, Relax, Energetic, Emotional)
export const SENSME_PLAYLISTS: Record<string, Track[]> = {
  relax: [
    {
      id: 'sensme-1',
      title: 'Speed of Sound',
      artist: 'Coldplay',
      album: 'X&Y',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/71/43/70/71437058-1d39-b12c-2b37-a1b14a5d26f0/mzaf_5970876114034094619.plus.aac.p.m4a',
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/0c/82/48/0c8248a8-4a5b-d30d-8056-f32d650d2fc9/190295978068.jpg/600x600bb.jpg',
    },
    {
      id: 'sensme-2',
      title: 'Lady (Hear Me Tonight)',
      artist: 'Modjo',
      album: 'Modjo',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/39/a0/2a/39a02a04-7e77-c309-9128-02e61098a7b7/mzaf_7220909039799435982.plus.aac.p.m4a',
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f5/25/2b/f5252b6e-0659-890b-7e9d-0e691944b95b/cover.jpg/600x600bb.jpg',
    },
  ],
  energetic: [
    {
      id: 'sensme-3',
      title: 'Feel Good Inc.',
      artist: 'Gorillaz',
      album: 'Demon Days',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9a/a7/90/9aa790e3-651e-9674-26ac-14aba4d3b8d1/mzaf_10454527198707970464.plus.aac.p.m4a',
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1c/0f/81/1c0f818a-e458-dd84-6f1b-ccbdf5fe14d6/825646291045.jpg/600x600bb.jpg',
    },
    {
      id: 'sensme-4',
      title: 'Holiday',
      artist: 'Green Day',
      album: 'American Idiot',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/86/f1/d0/86f1d039-f2d6-2f5b-b34b-2b63504fa6d0/mzaf_3363059623415356317.plus.aac.p.m4a',
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/64/70/4c/64704c7f-1786-f04b-32ae-9b216ce70498/093624877721.jpg/600x600bb.jpg',
    },
  ],
};

// Search tracks directly using Apple iTunes Search API
export async function searchTracks(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`;
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

// Dynamically refresh nostalgic 2005 tracks directly from Apple iTunes API in live streaming
export async function fetchLiveNostalgicTracks(): Promise<Track[]> {
  const iconicQueries = [
    'Gorillaz Feel Good Inc',
    'Daft Punk One More Time',
    'Linkin Park In The End',
    'Coldplay Speed of Sound',
    'Green Day Holiday',
    'Modjo Lady Hear Me Tonight',
  ];

  try {
    const promises = iconicQueries.map(async (q) => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`);
        if (!res.ok) return null;
        const data = await res.json();
        const item = data.results?.[0];
        if (!item || !item.previewUrl) return null;
        return {
          id: `psp-${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'PSP 2005 Classics',
          previewUrl: item.previewUrl,
          artworkUrl: (item.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg'),
          durationMs: item.trackTimeMillis,
        } as Track;
      } catch {
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter((t): t is Track => t !== null);
    if (results.length > 0) {
      return results;
    }
  } catch (err) {
    console.warn('Could not fetch dynamic iTunes tracks, using pre-validated list:', err);
  }
  return NOSTALGIC_PSP_TRACKS;
}
