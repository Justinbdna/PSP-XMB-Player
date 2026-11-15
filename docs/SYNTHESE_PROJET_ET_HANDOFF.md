# Synthèse Technique & Guide de Reprise PC — PSP XMB Player

> **Branche :** `CHOR` (créée depuis `main` @ `d675014`)  
> **Dépôt distant :** `https://github.com/Justinbdna/PSP-XMB-Player.git`  
> **Objectif de ce document :** Consolider l'architecture actuelle du projet, l'historique technique des trois sessions de développement majeures, l'état exact des branches Git (`main` / `staging` / `CHOR`) et la procédure complète de reprise sur **PC Gamer Windows**.

---

## 1. État Actuel du Dépôt Git

| Branche | Commit HEAD | Rôle & Différences |
| :--- | :--- | :--- |
| **`main`** | `d675014` | Production stable (déployée sur Vercel). Aucun panneau DevTools affiché (`<PSPConsole debugHitboxes={false} />`). |
| **`staging`** | `bbec335` | Identique à `main`, avec uniquement l'activation de `<StagingDebugPanel />` dans `src/App.tsx` (tiroir `²` ou `Ctrl+D` + overlay hitboxes rouges). |
| **`CHOR`** | *(présente branche)* | Basée sur `main` (`d675014`). Ajoute la mise à jour documentaire complète (`README.md`, `docs/XMB_ARCHITECTURE_AUDIT.md`, `docs/SYNTHESE_PROJET_ET_HANDOFF.md`) pour le transfert vers Windows. |

---

## 2. Stack Technique & Carte du Code

### Stack Principale
- **Frontend :** React `^19.0.0`, TypeScript, Vite `^6.1.0`, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`.
- **Métadonnées locales :** `music-metadata` + Node.js (`fs`, `path`, `zlib`) via scripts `scripts/sync-*.mjs`.
- **Émulation J2ME :** `FreeJ2ME-Web` (`public/emulators/freej2me/`) propulsé par **CheerpJ** (CDN `https://cjrtnc.leaningtech.com/20260317_2978/loader.js`) avec support WebGL2 (`libgles2.js`), MIDI WebAudio (`libmidi`), médias (`libmedia`) et pont `postMessage`.

### Arborescence Commentée (`src/`, `scripts/`, `public/`)

```text
PSP-XMB-Player/
├── index.html                           # Meta viewport-fit=cover, Apple WebApp, Google Fonts (Chakra Petch / Inter)
├── package.json                         # Scripts dev/build chaînant sync-audio + sync-videos + sync-games
├── .gitignore                           # Whitelist sélective des médias public/audio/*.mp3 et public/videos/*.mp4
├── scripts/
│   ├── sync-audio.mjs                   # Scan MP3 locaux + extraction tags ID3 & pochettes -> src/data/local-tracks.json
│   ├── sync-videos.mjs                  # Scan MP4 + miniatures JPEG + encodage NFC -> src/data/videos.json
│   └── sync-games.mjs                   # Scan .jar + MANIFEST.MF + icônes PNG -> src/data/games.json
├── public/
│   ├── psp-2000-silver.png              # Châssis PSP-2000 Silver (1024×444, modèle par défaut)
│   ├── psp-street-e1000.png             # Châssis PSP Street E1000 Noir Mat (1024×433)
│   ├── media/
│   │   ├── startup.mp4                  # Animation Cold Boot Sony PSP
│   │   └── startgame.mp4                # Animation Game Boot UMD
│   ├── audio/sfx/system_ok.mp3          # Son natif de validation XMB
│   ├── games/*.jar & thumbnails/*.png   # 6 ROMs Motorola J2ME (176×220) + icônes extraites
│   └── emulators/freej2me/              # Runtime FreeJ2ME-Web (run.html, freej2me-web.jar, libjs/, libmedia/, libmidi/, src/)
└── src/
    ├── App.tsx                          # Montage AudioProvider + PSPConsole (StagingDebugPanel sur branche staging)
    ├── types/xmb.ts                     # PSP_CHASSIS_CONFIG, BRIGHTNESS_LEVELS, PSP_OFFICIAL_THEMES, interfaces Track/VideoItem/GameItem
    ├── components/
    │   ├── PSPConsole.tsx               # Alimentation off/booting/on, Rotate Guard, Dynamic Island Safe Area, LED Power, OSD, hitboxes
    │   ├── XMBMenu.tsx                  # Cœur XMB (6 colonnes), piles nav, lecteurs audio/vidéo, sous-menus Skin & Luminosité, iTunes modal
    │   ├── AudioEngine.tsx              # Double moteur <audio> : directAudio (iTunes sans conflit CORS) + localAudio (Web Audio AnalyserNode)
    │   ├── AudioVisualizer.tsx          # Visualiseur 3 modes temps réel : bubbles / matrix / waveform
    │   ├── WaveBackground.tsx           # Vagues sinusoïdales HTML5 Canvas (avec prop paused en jeu J2ME)
    │   ├── XMBIcons.tsx                 # Icônes XMB, PSGlyph (△ ◯ ✕ □), PSPKeycap, DisplayKeycap, MusicNoteKeycap
    │   ├── YouTubeAudioBridge.tsx       # Passerelle historique (héritage architecture)
    │   ├── debug/StagingDebugPanel.tsx  # Tiroir DevTools staging (² / Ctrl+D : FPS, état XMB, Audio DSP, toggle hitboxes)
    │   └── games/
    │       ├── J2MEPlayer.tsx           # Hôte iframe FreeJ2ME-Web, pavé numérique tactile gauche, Mixeur Audio docké droite
    │       └── RetroBrickGame.tsx       # Mini-jeu démo intégré (casse-briques 480×272 avec mixeur audio interne)
    ├── hooks/useGamepad.ts              # Polling W3C Gamepad API à 60 FPS (croix/stick + boutons Standard Mapping)
    ├── services/
    │   ├── sound.ts                     # Préchargement system_ok.mp3 (OfflineAudioContext + HTML5 Audio), 0 oscillateur IA
    │   └── itunes.ts                    # Playlist démo SensMe™, recherche iTunes Search API (country=FR, limit=15), historique localStorage
    └── data/
        ├── playlist.json                # Extraits iTunes par défaut
        ├── local-tracks.json            # Généré par sync-audio.mjs
        ├── videos.json                  # Généré par sync-videos.mjs
        └── games.json                   # Généré par sync-games.mjs
```

---

## 3. Synthèse Détaillée des 3 Discussions Fondatrices

### Phase A — Boot Animation & Intégration SFX Natifs
*Discussion d'origine : **PSP Boot Animation And SFX Integration** (4–7 novembre 2026 — commits `684f716` à `188a15a`)*

1. **Machine d'état d'alimentation (`powerState: 'off' | 'booting' | 'on'`) :**
   - Contournement propre des politiques d'autoplay Safari/iOS/Chrome : la console démarre en veille (`off`), écran noir, avec une capsule d'accueil sous la console incitant à cliquer sur le bouton d'allumage (ou touche clavier `H` / `Home`).
   - Lancement de `public/media/startup.mp4` (`volume = 0.35`) avec **fondu de sortie fluide de 1s** en fin de lecture (`300ms` si l'utilisateur passe l'intro avec `Entrée`, `Espace`, `Échap`, `✕`, `START` ou `HOME`).
   - Nettoyage des anciens doublons vidéo : conservation exclusive de `public/media/startup.mp4` et `public/media/startgame.mp4`.
2. **Audio natif calibré (`src/services/sound.ts`) :**
   - Suppression des anciens oscillateurs synthétiques (`createOscillator` jugés « sons IA ») sur les clics de curseur, retour et options.
   - Préchargement de `/audio/sfx/system_ok.mp3` via HTML5 `Audio` (`volume = 0.28`) et décodage vers `AudioBuffer` via `OfflineAudioContext` pour une latence minimale à la validation (`✕`).
3. **Ergonomie de l'en-tête & glyphes officiels :**
   - Mise à l'échelle du châssis par conteneur proportionnel (`width: ${940 * scale}px`) afin de conserver des hitboxes millimétrées quel que soit l'écran.
   - Déplacement de la mini-capsule audio dans la barre d'état en haut à droite à côté de l'horloge et de l'indicateur batterie (avec titre défilant).
   - Création des composants SVG `<PSGlyph />` fidèles au code couleur PlayStation dans `src/components/XMBIcons.tsx`.

---

### Phase B — Optimisation Critique du Chargement Web & Déploiement Vercel
*Discussion d'origine : **Optimizing PSP Web App Loading** ("Optimize PSP Web Uploading", 9 novembre 2026 — commits `3d72ef8` / `9199f42`)*

1. **Diagnostic réseau Safari / Mobile :**
   - Les vignettes vidéo basées sur `<video src="...#t=1" preload="metadata">` combinées à des MP4 dont l'atome `moov` se trouvait en fin de fichier forçaient Safari à effectuer **~53,2 Mo de requêtes HTTP 206 Range** dès le chargement de la liste XMB.
2. **Pipeline de miniatures & Culling DOM :**
   - Suppression totale des balises `<video>` dans les listes XMB ; affichage de miniatures JPEG statiques stockées dans `public/videos/thumbnails/`.
   - **Culling progressif** dans `src/components/XMBMenu.tsx` sur les sous-listes *Musique*, *Vidéo*, *Historique* et *Résultats de recherche* : seules les entrées dans la fenêtre `Math.abs(idx - subItemIndex) <= 3` rendent leur miniature (`loading="lazy"`, `decoding="async"`).
   - Passage des pochettes iTunes à `160x160bb.jpg` dans les listes (`src/services/itunes.ts`) avec montée en résolution à `600x600bb.jpg` uniquement dans le lecteur audio plein écran.
   - Passage des balises `<audio>` de `AudioEngine.tsx` en `preload = 'metadata'`.
3. **Normalisation Unicode macOS (NFD) vs Linux/Vercel (NFC) :**
   - Dans `scripts/sync-videos.mjs`, les noms de fichiers contenant des accents créés sous macOS (décomposition NFD, ex. `Beyoncé`, `MON BÉBÉ`) échouaient en HTTP 404 sur les serveurs Linux sensibles à l'encodage NFC.
   - Correction par `file.normalize('NFC')` suivi de `encodeURI(...)` avec échappement explicite de `[` (`%5B`) et `]` (`%5D`), plus ajout d'un repli automatique vers `/media/startup.mp4` (`vid-demo-psp`) si `public/videos/` est vide.

---

### Phase C — Émulation Motorola J2ME, Multi-Skin Hardware, UI Mobile & Calibrage
*Discussion actuelle : **Émulation De Jeux Motorola Sur Mac** (12–15 novembre 2026 — commits `cb2d8a7` à `d675014`)*

1. **Émulation Java ME (MIDP 2.0) via `FreeJ2ME-Web` :**
   - Intégration de `public/emulators/freej2me/` exécutant 6 ROMs Motorola K1 (`176×220`) via **CheerpJ (WebAssembly)** et rendu 3D M3G sur WebGL2 :
     1. *Assassin's Creed Brotherhood* (`ASBR_Motorola_K1_EN_IGP_EU_126.jar`, 284 Ko, v1.2.6)
     2. *Asphalt 4* (`Asphalt4_MotorolaE770_EN_IGPL_EU_119_K1.jar`, 297 Ko, v1.1.9)
     3. *Assassin's Creed* (`Assassin_sCreed_Motorola_K1_Z3_W510_EN_IGP_110.jar`, 309 Ko, v1.1.0)
     4. *Assassin's Creed 2* (`Assassin_sCreed2_Motorola_k1_Z3_W510_W5_EN_IGP_EU_132.jar`, 302 Ko, v1.3.2)
     5. *SimCity Deluxe* (`electronicarts_simcitydeluxe_en_Motorola_K1_v1_11_57.jar`, 157 Ko, v1.11.57)
     6. *Sonic Unleashed* (`SonicUnleashed_Motorola_K1_Z3_W510_W490_EN_IGP_EU_121.jar`, 286 Ko, v1.2.1)
     *(+ démo intégrée `Mini Jeu Rétro` / `RetroBrickGame.tsx` en 480×272).*
   - Script `scripts/sync-games.mjs` : lecture directe des archives ZIP `.jar` via `zlib`, parsing `META-INF/MANIFEST.MF` et extraction automatique des icônes vers `public/games/thumbnails/`.
   - **Fluidité & Audio Safari :** préchargement silencieux via iframe `?preload=1` dès que l'utilisateur atteint la colonne *Jeu* ; chargement réel de la ROM dissimulé derrière `startgame.mp4` ; mise en pause de `WaveBackground` pendant le jeu ; déblocage `AudioContext` Safari (`resumeGameAudio` / `libmedia.unlockAll()`) dans `main.js`/`libmedia.js` ; destruction complète de l'iframe à la sortie pour libérer la RAM mobile.
   - **Interface en jeu (`src/components/games/J2MEPlayer.tsx`) :**
     - Bande noire gauche : pavé numérique tactile repliable (`1–9`, `*`, `0`, `#`, `Soft G`, `Soft D`, bouton `123`).
     - Bande noire droite : **Mixeur Audio PSP** ancré latéralement (`w-[116px]`) sans jamais recouvrir ni assombrir le canvas 176×220 du jeu. Permet de doser indépendamment *Son du jeu* (persisté dans `psp_j2me_game_volume`) et *Musique XMB*, avec préréglages `Jeu`, `45/75` et `Audio`, et contrôles lecture/piste suivante/précédente.

2. **Architecture Multi-Skin (`PSPChassisSpec`) & Rétroéclairage 5 Paliers :**
   - Refactorisation de `src/types/xmb.ts` via `PSP_CHASSIS_CONFIG` (persisté dans `psp_console_model`) :
     - **Sony PSP-2000 Silver** (`1024×444`, châssis par défaut) : inclut le voyant LED vert `POWER` sur le flanc droit (`top: 67.80%, left: 96.10%`) ainsi que les deux touches physiques manquantes sur la Street — Écran `[▭]` (Luminosité) et Note de musique `♪`.
     - **Sony PSP Street (E1000) Noir Mat** (`1024×433`) : sélectionnable dans `Paramètres → Skin PSP`. Le halo pulsant en veille sur la touche `HOME` / PlayStation est désormais restreint au châssis `psp-street-e1000-black` (sur la PSP-2000 la touche porte le texte `HOME` et dispose déjà de la capsule + du voyant `POWER`).
   - **5 niveaux de luminosité (`BRIGHTNESS_LEVELS = [100, 80, 60, 40, 20]`) :** accessibles via la touche physique `[▭]` de la PSP-2000, la touche clavier `B`, et le sous-menu interactif `Paramètres → Luminosité de l’écran` pilotable avec `◄` / `►` (le palier 20 % active un *Mode Nuit* atténuant fortement le rétroéclairage).

3. **Ergonomie Mobile, Safe Area Dynamic Island & Esthétique Glassmorphism XMB :**
   - **Suppression de la barre externe** sous le châssis dès que `powerState !== 'off'`, récupérant ~54 px de hauteur logique pour agrandir la console sur desktop et mobile.
   - **Sonde CSS Dynamic Island (`safeAreaProbeRef`) :** mesure réelle des variables `env(safe-area-inset-*)` en pixels CSS pour protéger automatiquement le châssis devant les encoches / *Dynamic Island* iPhone en mode paysage (`fillFactor` ajusté dynamiquement).
   - **Uniformisation visuelle des touches :** création de `<PSPKeycap>`, `<DisplayKeycap>`, `<MusicNoteKeycap>` dans `XMBIcons.tsx`, suppression des pastilles redondantes `START` / `HOME` en bas à droite et correction de `handleStart` pour éviter de déclencher involontairement la musique hors contexte.
   - **Glassmorphism XMB & HUD Vidéo :** refonte des OSD (Luminosité & Volume) et des popups système en verre fumé XMB ; refonte complète du lecteur MP4 avec barre de progression cliquable (scrubbing + curseur lumineux), bouton Play/Pause SVG + icône géométrique centrale en pause, retrait du badge `LECTURE`, sauts `±5s` aux flèches, enchaînement `L`/`R`, synchronisation du volume et gestion `onError`.
   - **Recalibrage de précision :** ajustement de `#psp-screen` et de toutes les hitboxes (notamment gâchettes `L`/`R` et barre du bas) pour les deux châssis, validé visuellement via `StagingDebugPanel`.
   - **Correctif recherche iTunes :** conservation du contexte `subListType = 'search_results'` et du dossier `Résultats : "..."` lors du retour (`◯`) depuis le lecteur audio plein écran.

---

## 4. Commandes & Raccourcis Actuels

| Action PSP | Clavier Desktop | Manette (Standard W3C) |
| :--- | :--- | :--- |
| **Allumer (en veille)** | `H` ou `Home` (ou clic bouton PS / `HOME` / capsule) | `Home` (Bouton 16) |
| **Passer le boot** | `Entrée`, `Espace`, `Échap` | — |
| **D-Pad (Navigation / Sauts ±5s vidéo)** | Flèches `↑` `↓` `←` `→` | Croix directionnelle ou Stick analogique gauche |
| **✕ (Valider / Entrer / Play·Pause vidéo)** | `X` ou `Entrée` | `Croix / A` (Bouton 0) |
| **◯ (Retour / Quitter)** | `O`, `Échap` ou `Retour arrière` | `Rond / B` (Bouton 1) |
| **▢ (Play·Pause musique / Mixeur J2ME / Ratio vidéo)** | `S` ou `Espace` | `Carré / X` (Bouton 2) |
| **△ (Options contextuelles / Mixeur / Masque HUD)** | `A` ou `T` | `Triangle / Y` (Bouton 3) |
| **L / R (Piste préc.·suiv. / Jeu)** | `Q` ou `[` (`L`) / `E` ou `]` (`R`) *(et `A` en sous-menu pour `L`)* | Gâchettes `L1` (4) / `R1` (5) |
| **♪ Note de musique (Lecture·Pause / Mixeur J2ME)** | `M` (ou icône physique `♪` sur PSP-2000) | — |
| **▭ Luminosité (5 paliers)** | `B` (ou icône physique `[▭]` sur PSP-2000) | — |
| **SELECT (Visualiseur audio)** | `Tab` ou `V` | `Select / Share` (Bouton 8) |
| **HOME (Retour accueil XMB)** | `H` ou `Home` | `Home` (Bouton 16) |
| **Tiroir DevTools *(branche `staging` uniquement)*** | `²` ou `Ctrl+D` | — |

---

## 5. Guide de Reprise sur PC Gamer Windows

### A. Récupérer le projet et la branche `CHOR` via Git

**Option 1 — Premier clone sur le PC Windows :**
```powershell
git clone https://github.com/Justinbdna/PSP-XMB-Player.git
cd PSP-XMB-Player
git fetch origin
git checkout -b CHOR origin/CHOR
```

**Option 2 — Dépôt déjà cloné sur le PC Windows :**
```powershell
git fetch origin
git checkout -B CHOR origin/CHOR
# Pour basculer ensuite sur la prod ou les outils de calibrage :
# git checkout main && git pull origin main
# git checkout staging && git pull origin staging
```

### B. Prérequis & Démarrage en Local (Windows PowerShell / Terminal)
- **Node.js :** version LTS récente recommandée (environnement testé sur Mac avec Node `v24.11.0` et npm `11.6.1` ; Vite `^6.1.0` requiert Node 18+/20+).
- **Installation et lancement :**
  ```powershell
  npm install
  npm run dev
  ```
- Les scripts `scripts/sync-audio.mjs`, `scripts/sync-videos.mjs` et `scripts/sync-games.mjs` utilisent uniquement l'API standard Node (`fs`, `path`, `zlib`) et `music-metadata` : ils fonctionnent à l'identique sous Windows et s'exécutent automatiquement avant `npm run dev` et `npm run build`.
- **Vérification TypeScript & build de production :**
  ```powershell
  npx tsc --noEmit
  npm run build
  npm run preview
  ```

### C. ⚠️ Point d'Attention Critique : Médias `.gitignore` (Mac vs GitHub vs PC Windows)

Le fichier `.gitignore` **exclut par défaut** `public/audio/*.{mp3,m4a,wav,aac,flac}` et `public/videos/*.mp4`, en ne versionnant qu'une **liste blanche explicite** afin de ne pas alourdir le dépôt GitHub :

- **Suivis sur GitHub (automatiquement récupérés par `git checkout CHOR`) :**
  - **Audio (`8` fichiers MP3 dans `public/audio/`) :**
    `01 Gatitas.mp3`, `13 Kiss of Life.mp3`, `Ariana Grande - Into You (Audio).mp3`, `Ayra Starr - Rush.mp3`, `Bad Bunny, Omar Courtz & Dei V - VeLDÁ.mp3`, `Beyoncé - BREAK MY SOUL.mp3`, `Briyney Spears - I'm A Slave 4 U.mp3`, `Tears For Fears - Everybody Wants To Rule The World (Single Version).mp3` *(+ `public/audio/sfx/system_ok.mp3` et les pochettes `public/audio/covers/*.jpg`)*.
  - **Vidéos (`4` clips MP4 dans `public/videos/`) :**
    `8belial x Bad Gyal - ORILLA (Prod. Virtual Flavor) [Official Music Video].mp4`, `Beyoncé - Baby Boy (Video) ft. Sean Paul.mp4`, `Lady Gaga - Poker Face (Official Music Video).mp4`, `THEODORA - MON BÉBÉ (Free kitty version).mp4` *(+ `public/videos/thumbnails/*.jpg`)*.
  - **Vidéos système (`2` MP4 dans `public/media/`) :** `startup.mp4` et `startgame.mp4`.
  - **Jeux (`6` archives `.jar` dans `public/games/`) :** tous les jeux Motorola + leurs miniatures `public/games/thumbnails/*.png` + l'intégralité de `public/emulators/freej2me/` sont versionnés sur GitHub.

- **Présents uniquement sur le Mac (`16` MP3 et `9` MP4 ignorés par `.gitignore`) :**
  - *Audio locaux non poussés :* `09 Paradise.mp3`, `12 Like a Tattoo.mp3`, `Bad Gyal - Give Me.mp3`, et le reste de l'album/catalogue Sade (`Cherish the Day`, `Hang on to Your Love`, `Is It a Crime`, `Jezebel`, `Love Is Stronger Than Pride`, `Never as Good as the First Time`, `No Ordinary Love`, `Nothing Can Come Between Us`, `Pearls`, `Please Send Me Someone to Love`, `Smooth Operator (Single Version)`, `The Sweetest Taboo`, `Your Love Is King`).
  - *Vidéos locales non poussées :* `BAD GYAL - FIEBRE PROD KING DOUDOU slow wine.mp4`, `Bad Gyal - Aprendiendo El Sexo.mp4`, `Bad Gyal - Flow 2000 (Official Video).mp4`, `Beyoncé - Crazy In Love ft. JAY Z.mp4`, `Beyoncé, Shakira - Beautiful Liar.mp4`, `Lady Gaga - Bad Romance (Official Music Video).mp4`, `PNL - J'Suis QLF [Clip Officiel].mp4`, `PNL - Le monde ou rien [Clip Officiel].mp4`, `Rihanna - Rude Boy.mp4`.

**Comportement sur le PC Windows :** Au premier `npm run dev` ou `npm run build`, `sync-audio.mjs` et `sync-videos.mjs` scanneront `public/audio/` et `public/videos/` sur ton PC et mettront à jour `src/data/local-tracks.json` (8 titres) et `src/data/videos.json` (4 clips) **sans aucune erreur**. Si tu veux retrouver la collection complète (24 MP3 / 13 MP4) sur ton PC gamer, copie manuellement le contenu de `public/audio/` et `public/videos/` depuis le Mac (clé USB, réseau local ou cloud).

### D. Dépendance Externe CheerpJ (Jeux J2ME)
- `public/emulators/freej2me/run.html` charge le runtime CheerpJ depuis `https://cjrtnc.leaningtech.com/20260317_2978/loader.js`.
- Une connexion Internet est donc nécessaire au premier chargement d'un jeu Motorola J2ME (ou tant que le cache navigateur n'est pas rempli).

### E. Débug & Calibrage sur Windows (`staging`)
- Pour activer les overlays de hitboxes rouges et l'inspecteur temps réel (FPS, entrées clavier/manette, état Audio DSP/Context, coordonnées XMB), bascule sur `staging` ou passe temporairement `<PSPConsole debugHitboxes={true} />` dans `src/App.tsx`, puis appuie sur `²` ou `Ctrl+D`.

---

## 6. Pistes d'Évolution & Roadmap Ouverte

1. **Étape suivante évoquée — Émulation PSP native (`PPSSPP` WebAssembly) :** supporter des homebrews/démos `.iso` / `.cso` en plus du moteur Java ME Motorola actuel.
2. **Qualité & Tests automatisés :** ajouter une suite Vitest (logique XMB, `sync-*`, `sound.ts`) et des tests E2E Playwright (boot `powerState`, switch skin `PSP-2000` / `Street`, lecteur vidéo, lancement `J2MEPlayer`).
3. **Auto-hébergement CheerpJ / Gestion des gros médias :** envisager Git LFS ou un stockage objet CDN externe pour les vidéos MP4 supplémentaires si le catalogue doit croître sans alourdir Git.
4. **Enrichissement audio :** extension de la lecture iTunes ou intégration complète de flux alternatifs, tout en conservant le double moteur anti-CORS WebKit (`directAudio` / `localAudio`).
