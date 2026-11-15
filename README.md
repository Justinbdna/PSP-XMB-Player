# PSP XMB Player

Application web interactive recréant l'expérience **Sony PSP™ (XrossMediaBar)** dans le navigateur, avec châssis interactifs multi-modèles, séquences *Cold Boot* / *Game Boot* authentiques, lecteurs audio DSP et vidéo MP4, recherche iTunes et émulation de jeux mobiles **Motorola J2ME**.

> 📚 **Documentation complète & Reprise PC Windows :** consultez [`docs/SYNTHESE_PROJET_ET_HANDOFF.md`](./docs/SYNTHESE_PROJET_ET_HANDOFF.md) pour la synthèse technique des sessions de développement, l'état des branches (`main`, `staging`, `CHOR`) et la procédure de récupération Git sur Windows.

---

## Fonctionnalités Principales

- **Multi-Skin Hardware (`Paramètres → Skin PSP`) :**
  - **Sony PSP-2000 Silver** *(par défaut)* : boîtier haute résolution avec voyant LED `POWER` vert, touche physique Écran (`▭`) pour la luminosité et touche Note de musique (`♪`).
  - **Sony PSP Street (E1000) Noir Mat** : châssis mat avec halo lumineux sur la touche PlayStation en veille.
- **Démarrage & Audio Système Authentiques :**
  - Séquence d'allumage interactive (`public/media/startup.mp4`) débloquant proprement l'audio navigateur, séquence UMD (`public/media/startgame.mp4`) au lancement des jeux, et bruitage natif (`public/audio/sfx/system_ok.mp3`) sur validation.
- **Interface XMB™ complète (6 catégories) :**
  - **Paramètres :** 5 thèmes officiels (*Novembre*, *Juillet*, *Avril*, *Décembre*, *Midnight*), sélection du *Skin PSP*, sous-menu interactif *Luminosité de l'écran* (`100%`, `80%`, `60%`, `40%`, `20% · Mode Nuit`), activation/désactivation du bip touches, informations système.
  - **Musique :** lecture de fichiers MP3 locaux (`public/audio/` avec extraction ID3 & pochettes via `sync-audio.mjs`), extraits **Apple iTunes Search API**, visualiseur Web Audio temps réel (`Underwater Bubbles`, `LED Matrix Blocks`, `Neon Wave Oscilloscope`) sur les pistes locales, et mini-lecteur intégré dans la barre d'état.
  - **Vidéo :** lecteur MP4 plein écran (`public/videos/` + miniatures JPEG + culling progressif `±3`) avec barre de scrubbing interactive, sauts `±5s`, changement de piste `L`/`R` et bascule de format d'affichage.
  - **Jeu :** émulation **J2ME Motorola (`176×220`)** propulsée par **FreeJ2ME-Web** (CheerpJ WebAssembly + WebGL2) incluant 6 titres `.jar` (*Assassin's Creed*, *AC 2*, *AC Brotherhood*, *Asphalt 4*, *SimCity Deluxe*, *Sonic Unleashed*), pavé numérique tactile, **Mixeur Audio PSP** (jeu vs musique XMB) et le mini-jeu démo intégré *Mini Jeu Rétro*.
  - **Recherche & Historique :** recherche en direct sur iTunes (15 résultats) avec retour conservant les résultats, et historique persistant en `localStorage`.
- **Ergonomie Desktop, Mobile & Manettes :**
  - Mise à l'échelle adaptative avec gestion *Safe Area / Dynamic Island* (`env(safe-area-inset-*)`), garde portrait mobile, support complet de l'API **W3C Gamepad** et raccourcis clavier.

---

## Démarrage Rapide

```bash
npm install
npm run dev
```

Scripts disponibles dans [`package.json`](./package.json) :

| Commande | Action |
| :--- | :--- |
| `npm run dev` | Synchronise les médias locaux (`sync-audio`, `sync-videos`, `sync-games`) puis lance Vite dev server |
| `npm run build` | Synchronise les médias locaux puis compile le bundle de production dans `dist/` |
| `npm run preview` | Prévisualise localement le build `dist/` |
| `npm run sync:audio` | Génère `src/data/local-tracks.json` + pochettes depuis `public/audio/` |
| `npm run sync:videos` | Génère `src/data/videos.json` + mappe `public/videos/thumbnails/` depuis `public/videos/` |
| `npm run sync:games` | Génère `src/data/games.json` + icônes `public/games/thumbnails/` depuis `public/games/*.jar` |

> ⚠️ **Note sur les médias locaux :** `.gitignore` versionne 8 MP3, 4 MP4, les vidéos système `public/media/` et les 6 ROMs `.jar`, tout en ignorant les ajouts locaux supplémentaires. Au lancement de `npm run dev` ou `npm run build`, les scripts `sync-*` adaptent automatiquement les catalogues JSON aux fichiers présents sur la machine.

---

## Commandes Clavier & Manette

| Touche PSP | Clavier | Manette |
| :--- | :--- | :--- |
| **D-Pad** | Flèches `↑` `↓` `←` `→` | Croix / Stick gauche |
| **✕ Valider** | `X` ou `Entrée` | Croix / `A` |
| **◯ Retour** | `O`, `Échap` ou `Retour arrière` | Rond / `B` |
| **▢ Play / Pause / Mixeur** | `S` ou `Espace` | Carré / `X` |
| **△ Options** | `A` ou `T` | Triangle / `Y` |
| **L / R** | `Q` ou `[` (`L`) · `E` ou `]` (`R`) | `L1` / `R1` |
| **♪ Note de musique** | `M` *(ou touche physique PSP-2000)* | — |
| **▭ Luminosité** | `B` *(ou touche physique PSP-2000)* | — |
| **SELECT / HOME** | `Tab` ou `V` (`SELECT`) · `H` ou `Home` (`HOME`) | `Select` / `Home` |
| **DevTools *(branche `staging`)*** | `²` ou `Ctrl+D` | — |

---

## Documentation Complémentaire

- [`docs/SYNTHESE_PROJET_ET_HANDOFF.md`](./docs/SYNTHESE_PROJET_ET_HANDOFF.md) — Synthèse complète des discussions, architecture, branches et guide PC Windows.
- [`docs/XMB_ARCHITECTURE_AUDIT.md`](./docs/XMB_ARCHITECTURE_AUDIT.md) — Audit initial de conception de la grille XMB, typographie et moteur audio d'origine.
