# Source de la vidéo PixelQG

L'animation est entièrement dessinée en code (canvas HTML), puis rendue image par image
dans **Microsoft Edge en mode headless** (aucune fenêtre ne s'ouvre) et encodée avec **ffmpeg**.

## Re-générer les vidéos

```bash
node video-src/render.js              # video/pixelqg-demo.mp4 (65 s, 1920x1080, 30 i/s) + affiche + images/og-image.jpg
node video-src/render.js --mode loop  # video/hero-loop.mp4 (8 s en boucle, 1200x750) + affiche
node video-src/render.js --mode social-a   # social/pixelqg-aveugle.mp4 (clip vertical 1080x1920, aussi social-b et social-c)
node video-src/render.js --mode tuto  # video/tuto-installation.mp4 (63 s, tuto d'installation, musique seule) + affiche
```

### Tuto d'installation : les captures

`tuto.js` utilise de vraies images dès qu'elles existent dans `tuto/shots/` :

- `node video-src/tuto/capture-site.js` : le haut du site et la position du bouton « Télécharger » (`site.png`, `site-shot.js`).
- `node video-src/tuto/capture-app.mjs` : l'appli avec un faux profil (USERPROFILE=C:\Users\alex, faux CLI Claude Code) :
  bureau vide, fenêtre « Nouveau pix » remplie, arrivée du pix (`app-*.png`, `type/`, `walk/`, `app-shots.js`).
  Le script s'arrête si le vrai nom d'utilisateur ou un e-mail apparaît. Sans ces captures, la vidéo reprend
  les captures du README de l'appli (`tuto/assets/app-bureau.png`, `app-fiche.png`).
- L'installeur, sans l'installer : `PixelQG-Setup-1.0.0.exe /preview video-src\tuto\shots\setup-start.png`, puis
  `PixelQG-Setup-1.0.0.exe /preview video-src\tuto\shots\setup-fin.png fin`. Sans ces deux images, la fenêtre est
  redessinée d'après `launcher/PixelQG-Setup.cs` et marquée « illustration ».

L'avertissement SmartScreen et le bureau Windows ne peuvent pas être capturés : ce sont des reconstitutions marquées « illustration ».

Options : `--workers 4` (navigateurs en parallèle), `--mute` (sans musique), `--crf 21` (qualité),
`--stills 3,10.9,22.5 --out dossier` (quelques images PNG seulement, pour vérifier vite).
Durée : environ 1 minute pour la vidéo complète.

Prérequis : Node.js 20+, Microsoft Edge (chemin par défaut, ou variable `EDGE_PATH`), ffmpeg dans le PATH.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page qui contient le canvas. Ouvre `index.html?mode=main&preview` dans un navigateur pour la prévisualiser avec une barre de lecture. |
| `scenes.js` | Le storyboard : scènes, textes, agents, caméra, transitions. **C'est ici qu'on modifie la vidéo.** |
| `social.js` | Les trois clips verticaux pour TikTok, Reels et Shorts (musique seule, voir `social/LISEZMOI.md`). |
| `tuto.js` | Le tuto d'installation (site → SmartScreen → installeur → raccourci → premier pix). Captures dans `tuto/`. |
| `office.js` | Le bureau en pixel art (400x250 px), les salles, les déplacements des agents, la caméra. |
| `lib.js` | Outils : courbes d'animation, couleurs, mascotte PixelQG, transitions pixel. |
| `pixelfont.js` | La police pixel PixelQG (aussi utilisée par le site via `tools/build-font.js`). |
| `soundtrack.js` | Musique chiptune et bruitages, générés par le code (aucun fichier audio externe). |
| `render.js` / `cdp.js` | Rendu image par image via le protocole DevTools, puis encodage H.264 + AAC. |

Le rendu est déterministe : la même seconde donne toujours la même image.
