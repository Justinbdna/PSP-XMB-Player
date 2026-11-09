import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videosDir = path.resolve(__dirname, '../public/videos');
const altVideosDir = path.resolve(__dirname, '../public/media/videos');
const thumbsDir = path.resolve(__dirname, '../public/videos/thumbnails');
const outputJson = path.resolve(__dirname, '../src/data/videos.json');

function slugify(text) {
  return (
    text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'video'
  );
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
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }

  // 1. Recherche des fichiers vidéo dans public/videos/ puis public/media/videos/
  const candidateDirs = [
    { dir: videosDir, urlPrefix: '/videos' },
    ...(fs.existsSync(altVideosDir) ? [{ dir: altVideosDir, urlPrefix: '/media/videos' }] : []),
  ];

  const foundFiles = [];
  for (const { dir, urlPrefix } of candidateDirs) {
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir);
      for (const f of dirFiles) {
        if (f.toLowerCase().endsWith('.mp4') && !f.startsWith('.')) {
          foundFiles.push({ file: f, dir, urlPrefix });
        }
      }
    }
  }

  // Si aucun fichier n'est trouvé, fournir un repli propre (vidéo démo PSP officielle)
  if (foundFiles.length === 0) {
    const fallbackVideos = [
      {
        id: 'vid-demo-psp',
        title: 'Bande Démo PSP PlayStation',
        artist: 'Sony Computer Entertainment',
        thumbnail: '',
        url: '/media/startup.mp4',
        fileSizeBytes: 3066622,
        sizeDisplay: '3.0 Mo',
        duration: '0:12',
        codec: 'MPEG-4 AVC / H.264',
      },
    ];
    fs.writeFileSync(outputJson, JSON.stringify(fallbackVideos, null, 2), 'utf-8');
    console.log('[sync-videos] ℹ️ Aucune vidéo MP4 locale trouvée. Repli vidéo démo configuré.');
    return;
  }

  const videos = foundFiles.map(({ file, dir, urlPrefix }, index) => {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    const sizeInMb = (stats.size / (1024 * 1024)).toFixed(1);

    const baseTitle = cleanTitle(file);
    const slug = slugify(baseTitle);
    const idSlug = `vid-${index + 1}-${slug.slice(0, 32)}`;

    // Détection artiste / titre si formaté "Artiste - Titre"
    const dashParts = baseTitle.split(' - ');
    let artist = 'Sélection Personnelle';
    let title = baseTitle;
    if (dashParts.length >= 2) {
      artist = dashParts[0].trim();
      title = dashParts.slice(1).join(' - ').trim();
    }

    // Recherche de miniature optimisée par slug stable ou par id
    const thumbFilename = `${slug}.jpg`;
    const thumbPath = path.join(thumbsDir, thumbFilename);
    const altThumbPath = path.join(thumbsDir, `${idSlug}.jpg`);
    let thumbnail = '';
    if (fs.existsSync(thumbPath)) {
      thumbnail = `/videos/thumbnails/${thumbFilename}`;
    } else if (fs.existsSync(altThumbPath)) {
      thumbnail = `/videos/thumbnails/${idSlug}.jpg`;
    }

    // Normalisation NFC et encodage conforme d'URL
    const normalizedFile = file.normalize('NFC');
    const encodedFilename = encodeURI(normalizedFile).replace(/\[/g, '%5B').replace(/\]/g, '%5D');

    return {
      id: idSlug,
      title,
      artist,
      thumbnail,
      url: `${urlPrefix}/${encodedFilename}`,
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

