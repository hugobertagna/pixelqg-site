# PixelQG — comptes, licences et Workshop (contrat partagé)

Objectif : PixelQG (l'appli) ne s'utilise qu'avec un compte qui a payé. Chaque compte payant reçoit une licence,
et chaque PC activé reçoit un certificat signé lié au compte et à la machine. Sur le site : comptes, achat lié au
compte, et une rubrique « Workshop » où les acheteurs publient leurs dépôts GitHub de skills. Contact :
pro.hugobertagna@gmail.com. Tout le texte visible est en français (tutoiement). Commentaires de code en anglais.

Honnêteté : l'appli tourne en JavaScript sur le PC de l'utilisateur, donc un développeur motivé peut toujours
modifier le code pour retirer la vérification. Ce système empêche le partage simple (copier le dossier, prêter
son compte au-delà de 3 PC), pas un piratage déterminé.

## 1. Supabase (Postgres + Auth + Edge Functions + Storage) — `pixelqg-site/supabase/`

Fichiers : `supabase/migrations/20261019000000_accounts.sql`, `supabase/functions/<name>/index.ts`, `supabase/README.md`.

### Tables (schéma public, RLS activé sur toutes)
```
profiles(id uuid pk → auth.users on delete cascade, email text, display_name text check (length ≤ 40),
         is_admin boolean not null default false, created_at timestamptz default now())
licenses(id uuid pk default gen_random_uuid(), user_id uuid unique not null → auth.users on delete cascade,
         status text not null check (status in ('active','revoked','refunded')) default 'active',
         source text not null default 'stripe' check (source in ('stripe','admin')),
         stripe_session_id text unique, stripe_payment_intent text unique, amount_total int, currency text,
         created_at timestamptz default now(), revoked_at timestamptz)
devices(id uuid pk default gen_random_uuid(), license_id uuid not null → licenses on delete cascade,
        device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'), name text check (length ≤ 60),
        first_seen timestamptz default now(), last_seen timestamptz default now(), unique(license_id, device_hash))
workshop_items(id uuid pk default gen_random_uuid(), user_id uuid not null → auth.users on delete cascade,
        repo_url text not null unique check (repo_url ~ '^https://github\.com/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'),
        title text not null check (length between 3 and 80), description text not null check (length between 10 and 600),
        tags text[] not null default '{}' check (cardinality(tags) ≤ 6),
        status text not null default 'published' check (status in ('published','hidden')),
        created_at timestamptz default now(), updated_at timestamptz default now())
workshop_comments(id uuid pk default gen_random_uuid(), item_id uuid not null → workshop_items on delete cascade,
        user_id uuid not null → auth.users on delete cascade, body text not null check (length between 2 and 1000),
        status text not null default 'published' check (status in ('published','hidden')), created_at timestamptz default now())
```
- Trigger `on auth.users insert` → insert profiles(id, email) (security definer function, search_path fixed).
- `public.has_active_license(uid uuid) returns boolean` security definer stable: exists active license for uid.
- `public.is_admin(uid uuid) returns boolean` security definer stable.
- View for the Workshop listing with the author's display name: `workshop_public` (runs with its owner's rights on purpose, exposes only published rows and display names) joining
  published items with `profiles.display_name` (fallback « Membre »). Never expose emails publicly.

### RLS (aucune écriture client sur licenses/devices : seulement les Edge Functions avec la clé service)
- profiles : select/update own row (update only display_name); admins select all.
- licenses : select own; admins select all; no insert/update/delete for clients.
- devices : select where license belongs to auth.uid(); no client writes.
- workshop_items : select where status='published' (anon + authenticated) or own or admin;
  insert/update/delete own only when `has_active_license(auth.uid())` (update cannot change user_id; status
  'hidden' can only be set by admins); admins may update status.
- workshop_comments : select published (anon + authenticated); insert own when has_active_license; delete own; admins update status.

### Edge Functions (Deno, `Deno.serve`, no npm dependency except `jsr:@supabase/supabase-js@2`)
Secrets (set by the owner in the Supabase dashboard, never committed): `STRIPE_WEBHOOK_SECRET`,
`LICENSE_PRIVATE_KEY` (Ed25519 PKCS#8 DER, base64). Built-in: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
CORS for the site origins `https://pixelqg-site.pages.dev` and `http://localhost:5500` (+ OPTIONS).
- `stripe-webhook` (verify_jwt = false): verify `Stripe-Signature` manually (HMAC-SHA256 over `${t}.${rawBody}`,
  constant-time compare against every `v1`, 300 s tolerance). Events:
  - `checkout.session.completed` with `payment_status = 'paid'`: `client_reference_id` must be a UUID of an existing
    auth user → upsert license (user_id) status active, store session id, payment_intent, amount, currency. Idempotent.
  - `charge.refunded` (full refund) → license status 'refunded', revoked_at now (match by payment_intent).
  - Anything else → 200 ignored. Bad signature → 400.
- `license` (verify_jwt = true; user JWT in Authorization): JSON body `{ action, device_hash, device_name }`.
  - `activate`: requires active license (else 402 « Aucune licence active sur ce compte. »). Upserts the device
    (max **3** devices per license, else 409 « Trop d'appareils : libère un PC depuis ton compte. »), updates last_seen,
    returns `{ certificate, license: { status, created_at }, devices: n }`.
  - `release`: deletes this device_hash for the caller's license → `{ ok: true }`.
  - `status`: `{ license: {status, created_at} | null, devices: [{name, first_seen, last_seen}] }`.
- `admin-license` (verify_jwt = true): caller must be `is_admin`. Body `{ action: "grant" | "revoke", email }`.
  `grant` upserts an active license with `source = 'admin'` for the auth user with that e-mail (404 « Aucun compte avec
  cet e-mail. » otherwise); `revoke` sets status 'revoked' + revoked_at. Returns the license. This is how licences are
  given out until Stripe is wired (Stripe comes LAST, by the owner's decision).
- `download` (verify_jwt = true): requires active license; returns a 10-minute signed URL for the newest object in
  the private Storage bucket `releases` (`{ url, name, size }`).

### Certificate format (signed by `license`, verified offline by the app)
`certificate = base64url(JSON payload) + "." + base64url(Ed25519 signature over the base64url payload string)`.
Payload: `{ "v": 1, "lic": license_id, "sub": user_id, "email": email, "dev": device_hash, "iat": unix_s, "exp": unix_s }`
with `exp = iat + 14 days`. The app refreshes it online at every start (and every 6 h while running); offline it
keeps working until `exp`. Public key (SPKI DER, base64) is embedded in the app (`server/license-key.js`):
`MCowBQYDK2VwAyEAi6ECBEikU3CZ27dJtxjpYAB5E4bTn2VPgwc+rNJcGnw=`
The matching private key lives only on the owner's PC (`~/.pixelqg/secrets/license-private-key.txt`) and in the
Supabase secret `LICENSE_PRIVATE_KEY`. Never commit, print or log it.

## 2. The app gate (`pixelqg-app`)
- `server/cloud-config.js` exports `{ SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL: "https://pixelqg-site.pages.dev" }`
  (placeholders `__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__` until deployment fills them).
- `server/license.js`: device hash = sha256("pixelqg:" + Windows MachineGuid (reg query
  HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid, hidden) or a fallback from hostname + first MAC) as lowercase hex;
  store `~/.pixelqg/license.json` `{ certificate, email, refresh_token }` (file mode 600 where supported);
  verify signature + `dev` + `exp`; login = Supabase Auth REST `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`
  (apikey header = anon key) → then call the `license` function `activate`; refresh = `grant_type=refresh_token`.
- Gate: without a valid certificate every `/api/*` route except `/api/license/*` and a minimal `/api/config`
  answers 402 `{ ok:false, error:"Licence requise", code:"license_required" }`; SSE and terminal sockets refused;
  no agent can be spawned. Routes: `GET /api/license` (state), `POST /api/license/login {email,password}`,
  `POST /api/license/logout` (calls `release`, deletes the local file), `POST /api/license/refresh`.
- Tests keep running through a `startServer({ license: { bypass: true } })` option only (never an env var or CLI flag).
  If cloud-config still holds placeholders, the gate is open with a « mode développeur » banner (release builds always
  have real values).
- UI: a full-screen pixel-style login window (email, password, « Se connecter », links « Créer un compte » and
  « Acheter PixelQG » to SITE_URL + "/compte.html"), clear French errors (402/409/wrong password/offline), and in the
  HUD menu the licence email + « Se déconnecter de ce PC ».

## 3. The site (`pixelqg-site`)
- `config.js`: `CHECKOUT_URL` (Stripe Payment Link, may stay empty), `CONTACT_EMAIL = "pro.hugobertagna@gmail.com"`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public values; placeholders until deployment).
- supabase-js from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js` (pinned).
- Navbar everywhere: … « Workshop » (→ workshop.html) and « Mon compte » (→ compte.html).
- `compte.html`: sign up / sign in / forgot password (Supabase Auth email + password, redirect back to compte.html);
  signed in: licence status, devices list, « Télécharger PixelQG » (calls `download`, only with an active licence),
  « Acheter PixelQG — 10 € » → `CHECKOUT_URL + "?client_reference_id=" + user.id + "&prefilled_email=" + email`
  (only when signed in; otherwise ask to sign in first), display name editing, sign out.
  After Stripe redirects to `compte.html?achat=ok`, poll the licence for up to 60 s and celebrate when active.
- All existing « Acheter » buttons go to `compte.html#acheter`.
- `workshop.html`: public list (cards: title, description, tags, author display name, GitHub link opening in a new
  tab, date), search + tag filter; licence holders get « Publier un skill » (repo URL validated client-side with the
  same regex, title, description, tags) and can edit/delete their own items; comments under each item (read for
  everyone, write for licence holders); visitors without licence see why and a link to buy. Text rendered with
  textContent only (never innerHTML with user data). A note: « Les dépôts sont publiés par la communauté : vérifie
  leur contenu avant de les utiliser. »
- Footer and legal pages show the contact e-mail.
