# Backend Supabase de PixelQG

Comptes, licences par compte, appareils (3 PC maximum par licence), Workshop communautaire et
téléchargement réservé aux acheteurs. Spécification complète : `docs/ACCOUNTS.md`.

## Contenu
| Fichier | Rôle |
|---|---|
| `migrations/20261019000000_accounts.sql` | Tables, règles d'accès (RLS), vues publiques du Workshop, bucket privé `releases` |
| `functions/license` | Active un PC et renvoie un certificat signé (Ed25519), libère un PC, état de la licence |
| `functions/admin-license` | Un admin attribue ou retire une licence par e-mail (en attendant Stripe) |
| `functions/download` | Lien de téléchargement de l'appli valable 10 minutes, licences actives seulement |
| `functions/stripe-webhook` | Paiement Stripe → licence active (branché en dernier) |
| `config.toml` | `verify_jwt` de chaque fonction (`stripe-webhook` sans JWT) |

## Déploiement (ordre)
1. Appliquer la migration sur le projet Supabase.
2. Déployer `license`, `admin-license`, `download` (verify_jwt activé) et `stripe-webhook` (verify_jwt désactivé).
3. Dans Supabase → Edge Functions → Secrets, ajouter `LICENSE_PRIVATE_KEY` : le contenu du fichier
   `license-private-key.txt` du dossier `.pixelqg\secrets` de ton profil Windows. C'est toi qui le colles : ne l'envoie jamais
   dans un chat, ne le mets jamais dans git.
4. Dans Authentication → URL Configuration : Site URL `https://pixelqg-site.pages.dev`, et en redirections
   `https://pixelqg-site.pages.dev/compte.html` et `http://localhost:5500/compte.html`.
5. Mettre l'URL du projet et la clé publique « anon » dans `config.js` (site) et `server/cloud-config.js` (appli).
   Cette clé est faite pour être publique : la sécurité vient des règles RLS.
6. Créer ton compte sur le site, puis te donner les droits admin :
   `update public.profiles set is_admin = true where email = 'ton-email';`
   Ensuite, attribue-toi une licence depuis « Mon compte » → « Attribuer une licence ».
7. (Dernier) Stripe : lien de paiement, webhook vers `.../functions/v1/stripe-webhook` avec les événements
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`,
   puis le secret `STRIPE_WEBHOOK_SECRET`.

## Publier une version de l'appli
Déposer le zip de PixelQG dans le bucket privé `releases` (Storage). Le plus récent est servi par `download`.
