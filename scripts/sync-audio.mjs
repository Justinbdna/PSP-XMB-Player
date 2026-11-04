import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioDir = path.resolve(__dirname, '../public/audio');
const coversDir = path.resolve(__dirname, '../public/audio/covers');
const outputJson = path.resolve(__dirname, '../src/data/local-tracks.json');

function slugify(text) {
  return (
    text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'track'
  );
}

function cleanTitle(filename) {
  const nameWithoutExt = filename.replace(/\.(mp3|m4a|aac|flac|wav|ogg)$/i, '');
  return nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

async function syncAudio() {
  // 1. Préparation des répertoires
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }

  const supportedExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.wav'];
  const allEntries = fs.readdirSync(audioDir);
  const audioFiles = allEntries.filter((file) => {
    const fullPath = path.join(audioDir, file);
    if (!fs.statSync(fullPath).isFile()) return false;
    return supportedExtensions.some((ext) => file.toLowerCase().endsWith(ext));
  });

  const tracks = [];

  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const fullPath = path.join(audioDir, file);
    const stats = fs.statSync(fullPath);

    const baseFallback = cleanTitle(file);
    const dashParts = baseFallback.split(' - ');
    let fallbackArtist = 'Artiste inconnu';
    let fallbackTitle = baseFallback;

    if (dashParts.length >= 2) {
      fallbackArtist = dashParts[0].trim();
      fallbackTitle = dashParts.slice(1).join(' - ').trim();
    }

    let title = fallbackTitle;
    let artist = fallbackArtist;
    let album = 'Album inconnu';
    let durationMs = 180000;
    let artworkUrl = '';
    let codecDisplay = 'Audio PCM • 44.1kHz';
    let bpm = 120;

    const idSlug = `local-${i + 1}-${slugify(fallbackTitle).slice(0, 32)}`;

    try {
      const metadata = await parseFile(fullPath);
      if (metadata.common.title && metadata.common.title.trim() !== '') {
        title = metadata.common.title.trim();
      }
      if (metadata.common.artist && metadata.common.artist.trim() !== '') {
        artist = metadata.common.artist.trim();
      }
      if (metadata.common.album && metadata.common.album.trim() !== '') {
        album = metadata.common.album.trim();
      }
      if (metadata.common.bpm) {
        bpm = Math.round(metadata.common.bpm);
      }
      if (metadata.format.duration && metadata.format.duration > 0) {
        durationMs = Math.round(metadata.format.duration * 1000);
      }

      if (metadata.format.codec) {
        const kbps = metadata.format.bitrate ? ` • ${Math.round(metadata.format.bitrate / 1000)}kbps` : '';
        codecDisplay = `${metadata.format.codec}${kbps}`;
      } else {
        const ext = path.extname(file).replace('.', '').toUpperCase();
        codecDisplay = `${ext} • 44.1kHz`;
      }

      // 3. Extraction de la pochette d'album intégrée (Cover Art)
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        let ext = '.jpg';
        if (pic.format && pic.format.includes('png')) {
          ext = '.png';
        } else if (pic.format && pic.format.includes('webp')) {
          ext = '.webp';
        }

        const coverFilename = `${idSlug}${ext}`;
        const coverPath = path.join(coversDir, coverFilename);
        fs.writeFileSync(coverPath, Buffer.from(pic.data));
        artworkUrl = `/audio/covers/${coverFilename}`;
      }
    } catch (err) {
      console.warn(`[sync-audio] Avertissement parsing ID3 pour "${file}":`, err.message);
    }

    tracks.push({
      id: idSlug,
      title,
      artist,
      album,
      url: `/audio/${file}`,
      previewUrl: `/audio/${file}`,
      artworkUrl,
      fileSizeBytes: stats.size,
      sizeDisplay: formatFileSize(stats.size),
      durationMs,
      codec: codecDisplay,
      sourceType: 'local',
      bpm,
    });
  }

  // 4. Tri par artiste puis par titre
  tracks.sort((a, b) => {
    const compArtist = a.artist.localeCompare(b.artist, 'fr', { sensitivity: 'base' });
    if (compArtist !== 0) return compArtist;
    return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  });

  // Écriture du catalogue JSON
  const targetDir = path.dirname(outputJson);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputJson, JSON.stringify(tracks, null, 2), 'utf-8');
  console.log(`[sync-audio] 🎵 ${tracks.length} morceau(x) synchronisé(s) avec pochettes`);
}

syncAudio().catch((err) => {
  console.error('[sync-audio] Erreur critique lors de la synchronisation audio:', err);
  process.exit(1);
});
