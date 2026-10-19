/* PixelQG — shared helpers for the account and Workshop pages (Supabase).
 * User data is only ever written with textContent / text nodes, never innerHTML. */
(function () {
  'use strict';

  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;

  var cfg = {
    url: typeof SUPABASE_URL === 'string' ? SUPABASE_URL.trim() : '',
    key: typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY.trim() : '',
    checkout: typeof CHECKOUT_URL === 'string' ? CHECKOUT_URL.trim() : '',
    provider: typeof PAYMENT_PROVIDER === 'string' && PAYMENT_PROVIDER.trim().toLowerCase() === 'stripe' ? 'stripe' : 'lemonsqueezy',
    contact: typeof CONTACT_EMAIL === 'string' ? CONTACT_EMAIL.trim() : '',
  };
  // Accounts are "open" only once real values replace the placeholders in config.js
  // (https, or a local Supabase stack such as `supabase start` on http://127.0.0.1:54321).
  var configured = /^(https:\/\/[^\s"'<>]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?)$/.test(cfg.url) && cfg.key.length > 20 && cfg.key.indexOf('__') !== 0;
  var paymentOpen = /^https:\/\/[^\s"'<>]+$/.test(cfg.checkout);
  var providerName = cfg.provider === 'stripe' ? 'Stripe' : 'Lemon Squeezy';

  // Checkout link tied to the signed-in account, so the payment webhook can find the licence owner.
  function checkoutUrl(user) {
    if (!paymentOpen || !user) return null;
    var u = new URL(cfg.checkout);
    if (cfg.provider === 'stripe') {
      u.searchParams.set('client_reference_id', user.id);
      if (user.email) u.searchParams.set('prefilled_email', user.email);
    } else {
      u.searchParams.set('checkout[custom][user_id]', user.id);
      if (user.email) u.searchParams.set('checkout[email]', user.email);
    }
    return u.toString();
  }

  // Licence summary: paid ('active'), running trial, ended trial, revoked/refunded, or none.
  var DAY = 86400000;
  function licenseState(lic, now) {
    now = now || Date.now();
    if (!lic) return { kind: 'none' };
    if (lic.status === 'active') return { kind: 'paid' };
    if (lic.status === 'trial') {
      var end = Date.parse(lic.trial_ends_at || '');
      if (end > now) return { kind: 'trial', days: Math.max(1, Math.ceil((end - now) / DAY)), ends: end };
      return { kind: 'trial-ended' };
    }
    return { kind: lic.status === 'refunded' ? 'refunded' : 'revoked' };
  }

  // Small DOM builder: el('p', { class: 'x', text: 'y' }, child, 'text', ...)
  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      [].concat(c).forEach(function (x) { if (x != null && x !== false) n.append(x); });
    }
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function show(node, on) { if (node) node.hidden = !on; }

  // Status line (role=status) with a tone: info | ok | error
  function say(node, text, tone) {
    if (!node) return;
    node.textContent = text || '';
    node.dataset.tone = tone || 'info';
    node.hidden = !text;
  }

  var dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  var dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '' : dateFmt.format(d); }
  function fmtDateTime(iso) { var d = new Date(iso); return isNaN(d) ? '' : dateTimeFmt.format(d); }
  function fmtSize(bytes) {
    if (!bytes) return '';
    return bytes > 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.round(bytes / 1024) + ' Ko';
  }

  // Loads supabase-js (pinned) once and returns a client, or null while accounts are not configured.
  var clientPromise = null;
  function client() {
    if (!configured) return Promise.resolve(null);
    if (clientPromise) return clientPromise;
    clientPromise = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = SUPABASE_JS;
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Impossible de charger le module de connexion. Vérifie ta connexion internet.')); };
      document.head.appendChild(s);
    }).then(function () {
      return window.supabase.createClient(cfg.url, cfg.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    });
    return clientPromise;
  }

  // Friendly French messages for Supabase Auth / PostgREST errors.
  function authMessage(err) {
    var m = String((err && (err.message || err.error_description)) || err || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/email not confirmed/i.test(m)) return 'Confirme d’abord ton adresse e-mail grâce au lien reçu par mail.';
    if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
    if (/password.*(at least|short|weak)|weak password/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Trop d’essais d’affilée. Réessaie dans quelques minutes.';
    if (/invalid.*email|email.*invalid/i.test(m)) return 'Cette adresse e-mail n’a pas l’air valide.';
    if (/failed to fetch|network/i.test(m)) return 'Connexion impossible. Vérifie ta connexion internet.';
    return 'Oups, une erreur est survenue. Réessaie dans un instant.';
  }
  function dbMessage(err) {
    var code = err && err.code;
    if (code === '23505') return 'Ce dépôt est déjà publié dans le Workshop.';
    if (code === '42501') return 'Il faut une licence PixelQG active pour faire ça.';
    if (code === '23514') return 'Un des champs ne respecte pas le format attendu.';
    return authMessage(err);
  }

  // Calls an Edge Function and turns HTTP errors into the French message the function returned.
  function invoke(sb, name, body) {
    return sb.functions.invoke(name, { body: body || {} }).then(function (res) {
      if (!res.error) return res.data;
      var ctx = res.error.context;
      var status = ctx && ctx.status;
      var fallback = {
        401: 'Ta session a expiré : reconnecte-toi.',
        402: 'Aucune licence active sur ce compte.',
        403: 'Action réservée aux administrateurs.',
        404: 'Introuvable.',
        409: 'Trop d’appareils : libère un PC depuis ton compte.',
      }[status] || 'Le serveur n’a pas pu répondre. Réessaie dans un instant.';
      var read = ctx && typeof ctx.json === 'function' ? ctx.json().catch(function () { return null; }) : Promise.resolve(null);
      return read.then(function (j) {
        var e = new Error((j && (j.error || j.message)) || fallback);
        e.status = status;
        throw e;
      });
    });
  }

  // Normalises a pasted GitHub link ("github.com/a/b/", ".git", "/tree/main"…) to https://github.com/owner/repo.
  function normaliseRepo(input) {
    var s = String(input || '').trim();
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    s = s.replace(/^http:\/\//i, 'https://').replace(/^https:\/\/www\.github\.com/i, 'https://github.com');
    var m = s.match(/^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)/i);
    if (!m) return null;
    var url = 'https://github.com/' + m[1] + '/' + m[2].replace(/\.git$/i, '');
    return REPO_RE.test(url) ? url : null;
  }
  function safeRepo(url) { return REPO_RE.test(String(url || '')) ? url : null; }

  function parseTags(input) {
    var out = [];
    String(input || '').split(/[,;]/).forEach(function (t) {
      t = t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 24);
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }

  // Name the payment provider wherever the copy mentions it.
  document.querySelectorAll('[data-provider-name]').forEach(function (n) { n.textContent = providerName; });

  window.PQG = {
    cfg: cfg, configured: configured, paymentOpen: paymentOpen, providerName: providerName,
    checkoutUrl: checkoutUrl, licenseState: licenseState,
    client: client, el: el, clear: clear, show: show, say: say,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtSize: fmtSize,
    authMessage: authMessage, dbMessage: dbMessage, invoke: invoke,
    normaliseRepo: normaliseRepo, safeRepo: safeRepo, parseTags: parseTags, REPO_RE: REPO_RE,
  };
})();
