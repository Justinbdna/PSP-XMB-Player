# 🎮 PSP XMB Player

> **Un hommage interactif à la PlayStation Portable (PSP) et à sa légendaire interface XrossMediaBar (XMB), propulsé par React, Vite et l'API iTunes.**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Fonctionnalités Clés

- **🕹️ Châssis PSP Réaliste (Option Console) :** Modélisation de la console en finition *Piano Black* avec reflets métalliques, croix directionnelle, touches géométriques translucides (△ ◯ ✕ □) et gâchettes L/R.
- **🌊 Vagues Dynamiques (Canvas 60fps) :** Recréation mathématique exacte des vagues PSP en `<canvas>` 2D, avec changement automatique de la palette de couleurs selon le mois de l'année (ou via le bouton *SELECT*).
- **🎵 Moteur Musical & Streaming iTunes :** 
  - Pré-chargement des morceaux cultes de 2005 (Gorillaz, Daft Punk, Linkin Park, Coldplay, Green Day, Modjo) sur la *Memory Stick Duo*.
  - Recherche instantanée d'artistes et d'albums mondiaux via l'API publique iTunes Search (extraits 30s + pochettes HD).
- **🔊 Sons Système Authentiques :** Synthèse audio en temps réel sans latence grâce à la Web Audio API (le célèbre « tick » de déplacement et le carillon de confirmation Sony).
- **⌨️ Double Contrôle Intuitif :**
  - **Au clavier :** Flèches directionnelles, touche **X** pour valider, **O** pour revenir, **A** pour les options (Triangle), **S** pour lecture/pause (Carré).
  - **À la souris / tactile :** Clic direct sur n'importe quel bouton de la coque de la console.

---

## 🎮 Commandes & Raccourcis

| Action | Bouton PSP | Touche Clavier | Effet |
| :--- | :---: | :---: | :--- |
| **Naviguer** | D-Pad (▲ ▼ ◀ ▶) | `Flèches` | Défilement horizontal des catégories / vertical des morceaux |
| **Valider** | **✕** (Croix) | `X` ou `Entrée` | Ouvrir un dossier, lancer une piste |
| **Retour** | **◯** (Rond) | `O` ou `Échap` / `Backspace` | Revenir en arrière |
| **Options** | **△** (Triangle) | `A` | Informations détaillées du morceau / Catégorie |
| **Play / Pause** | **□** (Carré) | `S` ou `Espace` | Mettre en pause ou relancer la musique |
| **Volume** | `VOL -` / `VOL +` | Clic boutons | Ajuster le volume sonore |
| **Thème** | `SELECT` | Clic bouton | Faire défiler les 12 couleurs de thèmes mensuels |

---

## 🚀 Installation & Lancement Local

```bash
# 1. Cloner le dépôt
git clone https://github.com/ton-profil/PSP-XMB-Player.git
cd PSP-XMB-Player

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

---

## ⚖️ Avertissement Légal & Propriété Intellectuelle (Fair Use)

> [!NOTE]
> **Projet éducatif, hommage et portfolio à but strictement non commercial.**
> *PlayStation*, *PSP*, *XrossMediaBar*, *XMB*, ainsi que les symboles géométriques (△ ◯ ✕ □) sont des marques déposées de **Sony Interactive Entertainment Inc.**
> Ce projet web est un travail de fan indépendant et n'est en aucun cas affilié, sponsorisé ou approuvé par Sony Interactive Entertainment.
> Les extraits musicaux et visuels proviennent du service d'écoute public de promotion fourni par l'API Apple iTunes Search.
