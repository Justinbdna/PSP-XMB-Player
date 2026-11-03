# Audit d'Architecture & Veille Technique : Sony XMB (XrossMediaBar)
**Projet :** PSP-XMB-Player — Émulateur Web Creative Tech (Sony PSP Street E1000)  
**Auteur :** Creative Tech & Retro Systems Engineering  
**Version Firmware de Référence :** Sony PlayStation Portable v6.61  

---

## 1. Matrice des Flux XMB & Hiérarchie Spatiale 2D

L'interface **XMB (XrossMediaBar)**, brevetée par Sony Corporation et récompensée par un Technology & Engineering Emmy Award en 2006, repose sur une navigation bidimensionnelle orthogonale stricte :
- **Axe Horizontal (Catégories) :** Navigation entre les univers majeurs (Paramètres, Photo, Musique, Vidéo, Jeu, Réseau).
- **Axe Vertical (Items & Contenus) :** Arborescence hiérarchique dépliée sous l'icône de catégorie active.

```
                      [ Paramètres ] ── [ Musique ] ── [ Vidéo ] ── [ Jeu ] ── [ Recherche ] ── [ Historique ]
                                             │
                                   ┌─────────┴─────────┐
                                   │ [ Memory Stick™ ] │ (Item sélectionné : 120% scale + Glow)
                                   ├───────────────────┤
                                   │ [Lecture en cours]│ (Opacité 40% - 60%)
                                   └───────────────────┘
```

### 1.1 Dynamique de Focus & Mise à l'Échelle
- **Icon Scale Ratio :**
  - Icône inactive : `30px × 30px`, opacité `0.45` à `0.55`, filtre de luminosité atténué.
  - Icône active (au croisement du réticule) : `40px × 40px` (mise à l'échelle de **+120%**), opacité `1.0`, halo lumineux blanc diffus (`box-shadow: 0 0 24px rgba(255,255,255,0.45)`).
- **Coordonnées d'Ancrage du Réticule :**
  - Le centre de gravité du réticule horizontal est calé à **120px** du bord gauche du viewport LCD 16:9 (480×272).
  - La translation s'opère selon la formule :
    $$\Delta X = 120\text{px} - (\text{Index Catégorie} \times 84\text{px})$$
  - La colonne verticale active est positionnée à `left: 108px` avec une translation fluide :
    $$\Delta Y = 30\text{px} - (\text{Index Item} \times 46\text{px})$$
- **Courbes d'Animation Bézier :**
  - Accélération et décélération mimant l'inertie du firmware Sony : `cubic-bezier(0.25, 1, 0.5, 1)` avec une durée de **250ms à 300ms**.

---

## 2. Typographie Système & Ratios d'Affichage

### 2.1 Polices Officielles et Remplacements Web
- **Police d'Origine :** *New Rodin (Shin Go / 新ゴ)* conçue par Morisawa pour les glyphes japonais et latins de Sony, complétée par une variante adoucie de *Helvetica Rounded / Frutiger*.
- **Équivalents Web Modernes :**
  - Principal : `'Inter', 'Helvetica Neue', sans-serif` avec `letter-spacing: 0.02em`.
  - Horloge & Métadonnées : Police monospace rétro (`'JetBrains Mono', 'SF Mono', monospace`) avec `font-weight: 700`.

### 2.2 Ratios & Éléments Typographiques
- **Titres de Catégories :** `10px`, `font-weight: 600`, interlettrage `+0.05em`, ombrage `drop-shadow(0 1px 2px rgba(0,0,0,0.85))`.
- **Intitulés d'Items :** `11px` à `12px`, `font-weight: 600`, couleur `#ffffff`.
- **Sous-titres & Métadonnées :** `8.5px` à `9px`, couleur `rgba(255, 255, 255, 0.70)`.
- **Biseautage des Textes (Text Beveling) :** Léger décalage d'un pixel en bas avec opacité réduite simulant le filtre de rétroéclairage LCD TFT de la console.

---

## 3. Sound Design Officiel & Synthèse Web Audio API

L'interface de la PSP intègre une identité sonore minimaliste, purement synthétique, sans aucun souffle d'échantillonnage. Chaque événement UI correspond à une combinaison d'ondes sinusoïdales à décroissance exponentielle rapide :

| Événement UI | Touche | Forme d'Onde | Fréquences Estimées | Enveloppe Temporelle | Rôle Psychologique |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Déplacement Curseur (Tick)** | D-Pad / Stick | Sinusoïdale (`sine`) | $1\,850\text{ Hz} \rightarrow 2\,200\text{ Hz}$ | Attaque $0\text{ms}$, Décroissance $35\text{ms}$ | Feedback tactile discret, sans fatigue auditive |
| **Validation (Enter)** | Croix (✕) | Sinusoïdale double | $1\,050\text{ Hz} + 2\,100\text{ Hz}$ (harmonique) | Attaque $2\text{ms}$, Résonance $140\text{ms}$ | Sensation d'affirmation, ouverture vers l'avant |
| **Annulation / Retour (Back)** | Rond (◯) | Sinusoïdale descendante | $1\,480\text{ Hz} \rightarrow 740\text{ Hz}$ | Attaque $2\text{ms}$, Décroissance $120\text{ms}$ | Rétractation spatiale, descente de niveau |
| **Options Contextuelles** | Triangle (△) | Sinusoïdale cristalline | $2\,400\text{ Hz} \rightarrow 3\,200\text{ Hz}$ | Attaque $1\text{ms}$, Décroissance $90\text{ms}$ | Signal aigu d'ouverture latérale |
| **Erreur / Limite** | Hors bornes | Carrée / Triangle amortie | $220\text{ Hz} \rightarrow 180\text{ Hz}$ | Attaque $5\text{ms}$, Décroissance $160\text{ms}$ | Alerte sourde sans agressivité |
| **Incrément Volume** | Vol + / Vol - | Sinusoïdale courte | $1\,200\text{ Hz}$ (modulée par palier) | Attaque $1\text{ms}$, Décroissance $40\text{ms}$ | Jauge auditive synchronisée avec l'OSD |

---

## 4. Recommandations d'Implémentation Web

1. **Isolation Web Audio :** Maintenir un singleton `AudioContext` partagé réveillé au premier geste utilisateur pour contourner les restrictions d'autoplay des navigateurs.
2. **Canvas 2D Wave Acceleration :** Utiliser `requestAnimationFrame` avec calcul trigonométrique pur ($y = A \sin(\omega t + \phi)$) pour éviter tout impact sur le thread DOM principal.
3. **Z-Index Layering Strict :**
   - Calque 1 : Boîtier Châssis physique (`z-0`)
   - Calque 2 : Viewport LCD 16:9 (`z-10`)
   - Calque 3 : Hotspots invisibles calibrés (`z-20`)
   - Calque 4 : Debug Tooling & Overlays (`z-50`)

