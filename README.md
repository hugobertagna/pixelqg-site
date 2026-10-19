# Site de PixelQG

Le site vitrine de [PixelQG](https://github.com/hugobertagna/pixelqg-app), en ligne sur **[pixelqg-site.pages.dev](https://pixelqg-site.pages.dev)**.

PixelQG transforme tes agents Claude Code en *pix* qui travaillent dans un bureau en pixel art. Gratuit et open source (MIT).

## Contenu

| Dossier | Rôle |
|---|---|
| `index.html`, `css/`, `js/`, `images/` | La page, statique, sans compte ni cookie |
| `video/`, `video-src/` | La vidéo de démo et son code de rendu (canvas + Edge sans fenêtre + ffmpeg) |
| `social/` | Clips verticaux pour TikTok, Reels et Shorts |
| `tools/` | `export-public.js` prépare le dossier `dist/` publié par Cloudflare Pages |

## Lancer en local

```bash
node tools/export-public.js
```

Puis ouvre `dist/index.html`, ou sers le dossier avec n’importe quel serveur statique.

Les contributions passent par le dépôt de l’appli : [guide de contribution](https://github.com/hugobertagna/pixelqg-app/blob/main/CONTRIBUTING.md).

Licence [MIT](LICENSE). PixelQG n’est pas affilié à Anthropic.
