import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioDir = path.resolve(__dirname, '../public/audio');
const outputJson = path.resolve(__dirname, '../src/data/local-tracks.json');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'track';
}

function cleanTitle(filename) {
  const nameWithoutExt = filename.replace(/\.(mp3|m4a|wav|aac|ogg)$/i, '');
  return nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function syncAudio() {
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const supportedExtensions = ['.mp3', '.m4a', '.wav', '.aac', '.ogg'];
  const files = fs.readdirSync(audioDir);
  const audioFiles = files.filter((f) =>
    supportedExtensions.some((ext) => f.toLowerCase().endsWith(ext))
  );

  const tracks = audioFiles.map((file, index) => {
    const fullPath = path.join(audioDir, file);
    const stats = fs.statSync(fullPath);

    const baseTitle = cleanTitle(file);
    const idSlug = `local-${index + 1}-${slugify(baseTitle).slice(0, 32)}`;

    // Try extracting "Artist - Title" format
    const dashParts = baseTitle.split(' - ');
    let artist = 'Artiste Inconnu';
    let title = baseTitle;
    let album = 'Memory Stick™';

    if (dashParts.length >= 2) {
      artist = dashParts[0].trim();
      title = dashParts.slice(1).join(' - ').trim();
    }

    return {
      id: idSlug,
      title,
      artist,
      album,
      url: `/audio/${encodeURI(file)}`,
      previewUrl: `/audio/${encodeURI(file)}`,
      artworkUrl: '',
      fileSizeBytes: stats.size,
      durationMs: 180000,
      sourceType: 'local',
      bpm: 120,
    };
  });

  // Ensure target dir exists
  const targetDir = path.dirname(outputJson);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputJson, JSON.stringify(tracks, null, 2), 'utf-8');
  console.log(`[sync:audio] Synchronisation terminée : ${tracks.length} morceau(x) ingéré(s) dans src/data/local-tracks.json`);
}

syncAudio();

