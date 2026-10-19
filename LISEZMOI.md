# Site de vente PixelQG

Site statique, sans étape de build : ouvre `index.html` directement, ou mets-le sur n'importe quel
hébergeur statique (Netlify, GitHub Pages, Cloudflare Pages…).

## À faire avant de vendre

1. **Lien de paiement** : ouvre `config.js` et colle ton lien dans `CHECKOUT_URL`
   (Stripe Payment Link, Lemon Squeezy, Gumroad…). Tous les boutons « Acheter » l'utiliseront.
   Tant qu'il est vide, les boutons mènent à la carte Prix avec la mention « La vente ouvre très bientôt ».
2. **Contact** : renseigne `CONTACT_EMAIL` dans `config.js`.
3. **Pages légales** : complète les champs `[entre crochets]` de `legal/mentions-legales.html` et `legal/cgv.html`.
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
