import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videosDir = path.resolve(__dirname, '../public/videos');
const outputJson = path.resolve(__dirname, '../src/data/videos.json');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'video';
}

function cleanTitle(filename) {
  const nameWithoutExt = filename.replace(/\.mp4$/i, '');
  return nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function syncVideos() {
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  const files = fs.readdirSync(videosDir);
  const mp4Files = files.filter((f) => f.toLowerCase().endsWith('.mp4'));

  const videos = mp4Files.map((file, index) => {
    const fullPath = path.join(videosDir, file);
    const stats = fs.statSync(fullPath);
    const sizeInMb = (stats.size / (1024 * 1024)).toFixed(1);

    const baseTitle = cleanTitle(file);
    const idSlug = `vid-${index + 1}-${slugify(baseTitle).slice(0, 32)}`;

    // Try extracting artist and title if formatted as "Artist - Title"
    const dashParts = baseTitle.split(' - ');
    let artist = 'Sélection Personnelle';
    let title = baseTitle;
    if (dashParts.length >= 2) {
      artist = dashParts[0].trim();
      title = dashParts.slice(1).join(' - ').trim();
    }

    return {
      id: idSlug,
      title,
      artist,
      thumbnail: '',
      url: `/videos/${encodeURI(file)}`,
      fileSizeBytes: stats.size,
      sizeDisplay: `${sizeInMb} Mo`,
      duration: '--:--',
      codec: 'MPEG-4 AVC / H.264',
    };
  });

  fs.writeFileSync(outputJson, JSON.stringify(videos, null, 2), 'utf-8');
  console.log(`[sync-videos] ✅ ${videos.length} vidéo(s) synchronisée(s) vers src/data/videos.json`);
}

syncVideos();
