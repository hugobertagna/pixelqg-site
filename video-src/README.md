# Source de la vidéo PixelQG

L'animation est entièrement dessinée en code (canvas HTML), puis rendue image par image
dans **Microsoft Edge en mode headless** (aucune fenêtre ne s'ouvre) et encodée avec **ffmpeg**.

## Re-générer les vidéos

```bash
node video-src/render.js              # video/pixelqg-demo.mp4 (65 s, 1920x1080, 30 i/s) + affiche + images/og-image.jpg
node video-src/render.js --mode loop  # video/hero-loop.mp4 (8 s en boucle, 1200x750) + affiche
```

Options : `--workers 4` (navigateurs en parallèle), `--mute` (sans son), `--crf 21` (qualité),
`--stills 3,10.9,22.5 --out dossier` (quelques images PNG seulement, pour vérifier vite).
Durée : environ 1 minute pour la vidéo complète.

## Voix off

La démo a une voix off française (10 phrases courtes) posée sur la musique, qui baisse automatiquement
quand la voix parle ; le tout est normalisé à -16 LUFS.

```bash
node video-src/render.js --audio-only                  # refait seulement le son de la démo (voix Julie par défaut)
node video-src/render.js --audio-only --voice Paul     # autre voix : Julie, Paul ou Hortense
node video-src/render.js --audio-only --no-voice       # musique seule
node video-src/voiceover.js --samples                  # échantillons dans video-src/samples/
```

Les phrases et leurs instants sont en haut de `voiceover.js` (SSML : pauses, vitesse, « I.A. », « Pixel Q.G. »).
Les voix utilisées sont les voix Windows installées (synthèse via `tts.ps1`, aucun service en ligne).

Prérequis : Node.js 20+, Microsoft Edge (chemin par défaut, ou variable `EDGE_PATH`), ffmpeg dans le PATH.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page qui contient le canvas. Ouvre `index.html?mode=main&preview` dans un navigateur pour la prévisualiser avec une barre de lecture. |
| `scenes.js` | Le storyboard : scènes, textes, agents, caméra, transitions. **C'est ici qu'on modifie la vidéo.** |
| `office.js` | Le bureau en pixel art (400x250 px), les salles, les déplacements des agents, la caméra. |
| `lib.js` | Outils : courbes d'animation, couleurs, mascotte PixelQG, transitions pixel. |
| `pixelfont.js` | La police pixel PixelQG (aussi utilisée par le site via `tools/build-font.js`). |
| `soundtrack.js` | Musique chiptune et bruitages, générés par le code (aucun fichier audio externe). |
| `voiceover.js` / `tts.ps1` | Voix off : synthèse Windows (WinRT) phrase par phrase, calage sans chevauchement, mixage avec ducking. |
| `samples/` | Échantillons de voix (`voix-julie.mp3`, `voix-paul.mp3`) pour choisir. |
| `render.js` / `cdp.js` | Rendu image par image via le protocole DevTools, puis encodage H.264 + AAC. |

Le rendu est déterministe : la même seconde donne toujours la même image.
