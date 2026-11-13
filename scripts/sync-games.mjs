import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gamesDir = path.resolve(__dirname, '../public/games');
const thumbsDir = path.resolve(__dirname, '../public/games/thumbnails');
const outputJson = path.resolve(__dirname, '../src/data/games.json');

const BUILTIN_GAMES = [
  {
    id: 'game-1',
    title: 'Mini Jeu Rétro',
    publisher: 'PlayStation Portable Studio',
    sublabel: 'UMD™ Game (Démo)',
    description: "Mini-jeu d'arcade rétro PSP 480x272",
    genre: 'Arcade / Rétro',
    size: '14.2 MB',
    icon: 'game',
    thumbnail: '',
    engine: 'builtin',
  },
];

function slugify(text) {
  return (
    text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'game'
  );
}

function cleanFilenameTitle(filename) {
  return filename
    .replace(/\.jar$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDisplayTitle(rawTitle) {
  let cleaned = rawTitle.replace(/_s\b/gi, "'s");
  if (!cleaned.includes(' ')) {
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return cleaned
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Extracts a single file buffer from a .jar (ZIP) archive using Node's built-in zlib.
 */
function extractZipEntry(zipBuffer, targetPath) {
  const normalizedTarget = targetPath.replace(/^\/+/, '').toLowerCase();

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minOffset = Math.max(0, zipBuffer.length - 65557);
  for (let i = zipBuffer.length - 22; i >= minOffset; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > zipBuffer.length || zipBuffer.readUInt32LE(cdOffset) !== 0x02014b50) {
      break;
    }
    const compressionMethod = zipBuffer.readUInt16LE(cdOffset + 10);
    const compressedSize = zipBuffer.readUInt32LE(cdOffset + 20);
    const nameLen = zipBuffer.readUInt16LE(cdOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(cdOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cdOffset + 42);

    const entryName = zipBuffer.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
    if (entryName.replace(/^\/+/, '').toLowerCase() === normalizedTarget) {
      if (localHeaderOffset + 30 > zipBuffer.length || zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        return null;
      }
      const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) return compressedData;
      if (compressionMethod === 8) return zlib.inflateRawSync(compressedData);
      return null;
    }

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  return null;
}

function parseManifest(manifestText) {
  const unfolded = manifestText.replace(/\r?\n /g, '');
  const fields = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const sepIdx = line.indexOf(':');
    if (sepIdx > 0) {
      const key = line.slice(0, sepIdx).trim();
      const value = line.slice(sepIdx + 1).trim();
      if (key) fields[key] = value;
    }
  }
  return fields;
}

function findExistingThumbnail(slug, idSlug) {
  const exts = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const base of [slug, idSlug]) {
    for (const ext of exts) {
      const candidate = `${base}${ext}`;
      if (fs.existsSync(path.join(thumbsDir, candidate))) {
        return `/games/thumbnails/${candidate}`;
      }
    }
  }
  return '';
}

function resolveOrExtractThumbnail(zipBuffer, iconEntryPath, slug, idSlug) {
  const existing = findExistingThumbnail(slug, idSlug);
  if (existing) return existing;

  if (!iconEntryPath) return '';
  const iconBuffer = extractZipEntry(zipBuffer, iconEntryPath);
  if (!iconBuffer || iconBuffer.length === 0) return '';

  const ext = path.extname(iconEntryPath).toLowerCase() || '.png';
  const filename = `${slug}${ext}`;
  fs.writeFileSync(path.join(thumbsDir, filename), iconBuffer);
  return `/games/thumbnails/${filename}`;
}

function syncGames() {
  if (!fs.existsSync(gamesDir)) {
    fs.mkdirSync(gamesDir, { recursive: true });
  }
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }

  const jarFiles = fs
    .readdirSync(gamesDir)
    .filter((f) => f.toLowerCase().endsWith('.jar') && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));

  const j2meGames = jarFiles.map((file, index) => {
    const fullPath = path.join(gamesDir, file);
    const stats = fs.statSync(fullPath);
    const zipBuffer = fs.readFileSync(fullPath);

    let manifest = {};
    try {
      const manifestBuf = extractZipEntry(zipBuffer, 'META-INF/MANIFEST.MF');
      if (manifestBuf) {
        manifest = parseManifest(manifestBuf.toString('utf8'));
      }
    } catch {
      // Fall back to filename metadata if manifest cannot be read
    }

    const rawName = manifest['MIDlet-Name'] || cleanFilenameTitle(file);
    const title = normalizeDisplayTitle(rawName);
    const publisher = manifest['MIDlet-Vendor'] || 'Motorola J2ME';
    const version = manifest['MIDlet-Version'] || '';
    const description =
      manifest['MIDlet-Description'] ||
      `Jeu Java ME (MIDP 2.0) • Motorola 176×220${version ? ` • v${version}` : ''}`;

    const slug = slugify(title);
    const idSlug = `j2me-${index + 1}-${slug.slice(0, 32)}`;

    const midlet1Parts = (manifest['MIDlet-1'] || '').split(',').map((s) => s.trim());
    const iconEntry = manifest['MIDlet-Icon'] || midlet1Parts[1] || '';
    const thumbnail = resolveOrExtractThumbnail(zipBuffer, iconEntry, slug, idSlug);

    const normalizedFile = file.normalize('NFC');
    const encodedFilename = encodeURI(normalizedFile).replace(/\[/g, '%5B').replace(/\]/g, '%5D');

    return {
      id: idSlug,
      title,
      publisher,
      sublabel: 'J2ME™ Motorola (176×220)',
      description,
      genre: 'J2ME • Motorola K1',
      size: formatSize(stats.size),
      fileSizeBytes: stats.size,
      icon: 'game',
      thumbnail,
      engine: 'j2me',
      romUrl: `/games/${encodedFilename}`,
      version: version || undefined,
      resolution: { width: 176, height: 220 },
    };
  });

  const allGames = [...j2meGames, ...BUILTIN_GAMES];
  fs.writeFileSync(outputJson, JSON.stringify(allGames, null, 2), 'utf-8');
  console.log(
    `[sync-games] ✅ ${j2meGames.length} jeu(x) J2ME + ${BUILTIN_GAMES.length} démo synchronisé(s) vers src/data/games.json`
  );
}

syncGames();
