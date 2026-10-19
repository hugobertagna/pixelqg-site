# Site de PixelQG (gratuit et open source)

Site statique, sans étape de build : ouvre `index.html` directement, ou mets-le sur n'importe quel
hébergeur statique (Netlify, GitHub Pages, Cloudflare Pages…).

PixelQG est gratuit et open source (licence MIT) : le site n'a aucun paiement. Les boutons
« Télécharger gratuitement » mènent à https://github.com/hugobertagna/pixelqg-app/releases/latest
(installeur `PixelQG-Setup-*.exe`) et « Voir le code sur GitHub » à https://github.com/hugobertagna/pixelqg-app.

## À faire avant la mise en ligne

1. **Dépôts GitHub** : publie `pixelqg-app` (avec une version qui contient l'installeur), sinon les liens mènent à une page 404.
2. **Contact** : `config.js` ne contient que `CONTACT_EMAIL`. Le site n'a ni inscription ni base de données : la communauté vit sur GitHub (issues, pull requests, Discussions).
3. **Pages légales** : complète les champs `[entre crochets]` de `legal/mentions-legales.html`.
4. **Réseaux sociaux** : une fois le site en ligne, remplace `images/og-image.jpg` par l'adresse complète dans la balise `og:image` de `index.html`.

## Mettre en ligne

```bash
node tools/export-public.js
```

Cette commande crée `dist/`, qui contient seulement les fichiers publics. C'est **ce dossier** qu'il faut glisser
sur Netlify ou publier. N'envoie pas `source-captures/` : ces captures (déjà nettoyées du nom d'utilisateur Windows) montrent encore l'ancien logo de l'app.

## Structure

- `index.html`, `config.js`, `css/`, `js/`, `fonts/`, `images/`, `video/`, `legal/` : le site.
- `video-src/` : la source de la vidéo et son script de rendu (voir `video-src/README.md`).
- `tools/` : scripts de régénération (`build-images.js` recadre les captures et masque l'ancien logo,
  `build-font.js` crée la police pixel, `build-art.js` les petits sprites, `check-site.js` fait des captures de contrôle).
- `source-captures/` : captures de l'app, chemins remplacés par `C:\Users\alex` (non publiées, ignorées par git).
