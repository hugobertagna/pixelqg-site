/* PixelQG — « Mon compte » page: auth, licence, devices, download, profile, admin licences, purchase. */
(function () {
  'use strict';
  var P = window.PQG;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var pageUrl = location.origin && location.origin !== 'null' ? location.origin + location.pathname : undefined;

  // A password-reset link signs the user in: keep the "new password" form until it is saved.
  var state = { sb: null, user: null, license: null, renderId: 0, recovery: /type=recovery/.test(location.hash) };

  // ---------- purchase card ----------
  // While payment is closed, the card offers the launch waitlist instead of a buy button.
  function setBuy(mode) {
    var text = $('buy-text');
    P.show($('btn-buy'), false); P.show($('btn-buy-soon'), false); P.show($('btn-buy-login'), false);
    P.show($('buy-waitlist'), P.configured && !P.paymentOpen && mode !== 'owned');
    if (mode === 'soon') {
      text.textContent = 'Les comptes ouvrent très bientôt. La licence sera liée à ton compte PixelQG.';
      P.show($('btn-buy-soon'), true);
    } else if (mode === 'signedout') {
      if (P.paymentOpen) {
        text.textContent = 'La licence est liée à ton compte PixelQG : crée ton compte ou connecte-toi d’abord.';
        P.show($('btn-buy-login'), true);
      } else {
        text.textContent = 'Le paiement en ligne ouvre très bientôt. En attendant, crée ton compte pour profiter de l’essai gratuit de 7 jours, et laisse ton e-mail pour être prévenu au lancement.';
      }
    } else if (mode === 'owned') {
      text.textContent = 'Tu as déjà une licence active sur ce compte. Merci pour ton soutien !';
    } else if (mode === 'buy') {
      if (!P.paymentOpen) {
        text.textContent = 'Le paiement en ligne ouvre très bientôt : laisse ton e-mail pour être prévenu au lancement. Ta licence sera liée à ce compte.';
        if (P.prefillWaitlist) P.prefillWaitlist(state.user.email);
        return;
      }
      text.textContent = 'Ta licence sera liée à ce compte (' + state.user.email + ') dès le paiement validé.';
      var a = $('btn-buy');
      a.href = P.checkoutUrl(state.user);
      a.rel = 'noopener';
      P.show(a, true);
    }
  }

  // ---------- auth forms ----------
  var FORMS = ['login', 'signup', 'forgot', 'reset'];
  function showForm(name) {
    FORMS.forEach(function (f) { P.show($('form-' + f), f === name); });
    var tabs = name === 'login' || name === 'signup';
    document.querySelector('.auth .tabs').hidden = !tabs;
    $('tab-login').setAttribute('aria-selected', String(name === 'login'));
    $('tab-signup').setAttribute('aria-selected', String(name === 'signup'));
    $('tab-login').tabIndex = name === 'signup' ? -1 : 0;
    $('tab-signup').tabIndex = name === 'signup' ? 0 : -1;
    $('auth-title').textContent = { login: 'Connexion', signup: 'Créer un compte', forgot: 'Mot de passe oublié', reset: 'Nouveau mot de passe' }[name];
    P.say($('auth-status'), '');
  }
  function busy(form, on) { form.querySelectorAll('button, input').forEach(function (x) { x.disabled = on; }); }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function wireAuth() {
    $('tab-login').addEventListener('click', function () { showForm('login'); });
    $('tab-signup').addEventListener('click', function () { showForm('signup'); });
    document.querySelector('.auth .tabs').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var next = $('tab-login').getAttribute('aria-selected') === 'true' ? 'signup' : 'login';
      showForm(next); $('tab-' + next).focus();
    });
    document.querySelectorAll('.auth [data-show]').forEach(function (b) {
      b.addEventListener('click', function () { showForm(b.dataset.show); });
    });

    $('form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, email = f.email.value.trim(), pw = f.password.value;
      if (!emailOk(email) || !pw) return P.say($('auth-status'), 'Indique ton e-mail et ton mot de passe.', 'error');
      busy(f, true); P.say($('auth-status'), 'Connexion…');
      state.sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
        busy(f, false);
        if (r.error) return P.say($('auth-status'), P.authMessage(r.error), 'error');
        f.reset(); render(r.data.session);
      });
    });

    $('form-signup').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, email = f.email.value.trim(), pw = f.password.value;
      if (!emailOk(email)) return P.say($('auth-status'), 'Cette adresse e-mail n’a pas l’air valide.', 'error');
      if (pw.length < 8) return P.say($('auth-status'), 'Choisis un mot de passe d’au moins 8 caractères.', 'error');
      busy(f, true); P.say($('auth-status'), 'Création du compte…');
      state.sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: pageUrl } }).then(function (r) {
        busy(f, false);
        if (r.error) return P.say($('auth-status'), P.authMessage(r.error), 'error');
        var u = r.data.user;
        if (u && Array.isArray(u.identities) && u.identities.length === 0) {
          return P.say($('auth-status'), 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.', 'error');
        }
        f.reset();
        if (r.data.session) return render(r.data.session);
        showForm('login');
        P.say($('auth-status'), 'Compte créé ! Clique sur le lien reçu par e-mail pour confirmer ton adresse, puis connecte-toi ici.', 'ok');
      });
    });

    $('form-forgot').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, email = f.email.value.trim();
      if (!emailOk(email)) return P.say($('auth-status'), 'Cette adresse e-mail n’a pas l’air valide.', 'error');
      busy(f, true);
      state.sb.auth.resetPasswordForEmail(email, { redirectTo: pageUrl }).then(function (r) {
        busy(f, false);
        if (r.error) return P.say($('auth-status'), P.authMessage(r.error), 'error');
        P.say($('auth-status'), 'Si un compte existe pour cet e-mail, tu vas recevoir un lien pour choisir un nouveau mot de passe.', 'ok');
      });
    });

    $('form-reset').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, pw = f.password.value;
      if (pw.length < 8) return P.say($('auth-status'), 'Choisis un mot de passe d’au moins 8 caractères.', 'error');
      busy(f, true);
      state.sb.auth.updateUser({ password: pw }).then(function (r) {
        busy(f, false);
        if (r.error) return P.say($('auth-status'), P.authMessage(r.error), 'error');
        f.reset();
        state.recovery = false;
        state.sb.auth.getSession().then(function (s) { render(s.data.session); P.say($('acct-status'), 'Mot de passe modifié.', 'ok'); });
      });
    });
  }

  // ---------- signed-in view ----------
  function loadLicense() {
    // select('*') keeps working whether or not the trial_ends_at column is deployed yet.
    return state.sb.from('licenses').select('*').eq('user_id', state.user.id).maybeSingle()
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function loadDevices() {
    return state.sb.from('devices').select('id, device_hash, name, first_seen, last_seen').order('last_seen', { ascending: false })
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }

  function paintLicense(lic) {
    state.license = lic;
    var chip = $('lic-chip'), text = $('lic-text');
    var st = P.licenseState(lic);
    var contact = P.cfg.contact || 'l’adresse de contact';
    var view = {
      paid: ['Licence active', 'ok', 'Licence liée à ce compte depuis le ' + (lic && P.fmtDate(lic.created_at)) + '. Tu peux activer PixelQG sur 3 PC.'],
      trial: ['Essai gratuit : encore ' + st.days + (st.days > 1 ? ' jours' : ' jour'), 'trial',
        'Ton essai se termine le ' + P.fmtDate(new Date(st.ends).toISOString()) + '. Achète PixelQG pour continuer ensuite : tes réglages sont conservés.'],
      'trial-ended': ['Essai terminé', 'off', 'Ton essai gratuit de 7 jours est terminé. Achète PixelQG pour continuer à l’utiliser.'],
      revoked: ['Licence retirée', 'off', 'Cette licence n’est plus active. Une question ? Écris-nous à ' + contact + '.'],
      refunded: ['Licence remboursée', 'off', 'Cette licence a été remboursée. Une question ? Écris-nous à ' + contact + '.'],
      none: ['Aucune licence', 'warn', 'Télécharge PixelQG, lance-le et connecte-toi avec ce compte : ton essai gratuit de 7 jours démarre automatiquement (sans carte bancaire, un essai par PC).'],
    }[st.kind];
    chip.textContent = view[0];
    chip.dataset.tone = view[1];
    text.textContent = view[2];
    // Any signed-in account can download the app: the trial starts in the app itself.
    P.show($('btn-download'), true);
    setBuy(st.kind === 'paid' ? 'owned' : 'buy');
  }

  function paintDevices(list) {
    var ul = P.clear($('dev-list'));
    $('dev-count').textContent = '(' + list.length + ' / 3)';
    P.show($('dev-empty'), list.length === 0);
    list.forEach(function (d) {
      var btn = P.el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Libérer ce PC' });
      var armed = null;
      btn.addEventListener('click', function () {
        if (!armed) {
          btn.textContent = 'Confirmer ?';
          armed = setTimeout(function () { armed = null; btn.textContent = 'Libérer ce PC'; }, 4000);
          return;
        }
        clearTimeout(armed); armed = null; btn.disabled = true;
        P.invoke(state.sb, 'license', { action: 'release', device_hash: d.device_hash, device_name: d.name || '' })
          .then(function () { P.say($('dev-status'), 'PC libéré : tu peux activer PixelQG sur un autre PC.', 'ok'); return loadDevices().then(paintDevices); })
          .catch(function (e) { btn.disabled = false; btn.textContent = 'Libérer ce PC'; P.say($('dev-status'), e.message, 'error'); });
      });
      ul.append(P.el('li', { class: 'dev' },
        P.el('div', null,
          P.el('p', { class: 'dev__name', text: d.name || 'PC sans nom' }),
          P.el('p', { class: 'dev__meta', text: 'Activé le ' + P.fmtDate(d.first_seen) + ' · vu le ' + P.fmtDateTime(d.last_seen) })),
        btn));
    });
  }

  function paintProfile(profile) {
    var name = (profile && profile.display_name) || '';
    $('me-name').textContent = name || 'Membre';
    $('display-name').value = name;
    P.show($('admin'), !!(profile && profile.is_admin));
  }

  function wireMe() {
    $('btn-logout').addEventListener('click', function () {
      state.sb.auth.signOut().then(function () { render(null); P.say($('acct-status'), 'Tu es déconnecté.', 'info'); });
    });

    $('btn-download').addEventListener('click', function () {
      var b = $('btn-download'); b.disabled = true;
      P.say($('dl-status'), 'Préparation du téléchargement…');
      P.invoke(state.sb, 'download').then(function (d) {
        b.disabled = false;
        if (!d || !/^https:\/\//.test(d.url || '')) throw new Error('Le lien de téléchargement est indisponible pour le moment.');
        P.say($('dl-status'), 'Téléchargement de ' + (d.name || 'PixelQG') + (d.size ? ' (' + P.fmtSize(d.size) + ')' : '') + ' lancé. Le lien reste valable 10 minutes.', 'ok');
        window.location.assign(d.url);
      }).catch(function (e) { b.disabled = false; P.say($('dl-status'), e.message, 'error'); });
    });

    $('form-name').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, v = f.display_name.value.trim().replace(/\s+/g, ' ');
      if (v.length > 40) return P.say($('name-status'), '40 caractères maximum.', 'error');
      busy(f, true);
      state.sb.from('profiles').update({ display_name: v || null }).eq('id', state.user.id).then(function (r) {
        busy(f, false);
        if (r.error) return P.say($('name-status'), P.dbMessage(r.error), 'error');
        $('me-name').textContent = v || 'Membre';
        P.say($('name-status'), 'Nom enregistré.', 'ok');
      });
    });

    $('form-admin').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, action = e.submitter && e.submitter.value === 'revoke' ? 'revoke' : 'grant';
      var email = f.email.value.trim().toLowerCase();
      if (!emailOk(email)) return P.say($('admin-status'), 'Indique l’e-mail d’un compte existant.', 'error');
      busy(f, true);
      P.invoke(state.sb, 'admin-license', { action: action, email: email }).then(function (lic) {
        busy(f, false);
        var st = lic && lic.status ? ' (statut : ' + lic.status + ')' : '';
        P.say($('admin-status'), (action === 'grant' ? 'Licence attribuée à ' : 'Licence retirée pour ') + email + st + '.', 'ok');
        if (email === String(state.user.email || '').toLowerCase()) loadLicense().then(paintLicense);
      }).catch(function (err) { busy(f, false); P.say($('admin-status'), err.message, 'error'); });
    });
  }

  // After Stripe redirects to ?achat=ok, poll for up to 60 s until the webhook has created the licence.
  function pollPurchase() {
    if (params.get('achat') !== 'ok') return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (state.license && state.license.status === 'active') { P.show($('acct-thanks'), true); return; }
    P.say($('acct-status'), 'Paiement reçu ! On active ta licence…', 'info');
    var started = Date.now();
    (function tick() {
      loadLicense().then(function (lic) {
        if (lic && lic.status === 'active') {
          paintLicense(lic);
          P.say($('acct-status'), '');
          P.show($('acct-thanks'), true);
          $('acct-thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (Date.now() - started < 60000) setTimeout(tick, 3000);
        else P.say($('acct-status'), 'Ta licence n’est pas encore visible. Rafraîchis la page dans une minute ; si rien ne change, écris-nous à ' + (P.cfg.contact || 'l’adresse de contact') + '.', 'error');
      }).catch(function () { if (Date.now() - started < 60000) setTimeout(tick, 3000); });
    })();
  }

  function showRecovery() {
    P.show($('acct-auth'), true); P.show($('acct-me'), false);
    showForm('reset');
    setBuy('signedout');
  }

  function render(session) {
    var id = ++state.renderId;
    state.user = session ? session.user : null;
    if (state.recovery && state.user) return showRecovery();
    P.show($('acct-auth'), !state.user);
    P.show($('acct-me'), !!state.user);
    if (!state.user) {
      P.show($('acct-thanks'), false);
      setBuy('signedout');
      // « Essai gratuit » links land on compte.html#inscription: open the sign-up tab.
      if (location.hash === '#inscription') {
        showForm('signup');
        $('acct-auth').scrollIntoView({ block: 'start' });
      }
      return;
    }
    $('me-email').textContent = state.user.email || '';
    $('me-name').textContent = 'Membre';
    P.say($('acct-status'), '');
    Promise.all([
      state.sb.from('profiles').select('display_name, is_admin').eq('id', state.user.id).maybeSingle(),
      loadLicense(),
      loadDevices(),
    ]).then(function (res) {
      if (id !== state.renderId) return;
      paintProfile(res[0].data);
      paintLicense(res[1]);
      paintDevices(res[2]);
      pollPurchase();
    }).catch(function (e) {
      if (id !== state.renderId) return;
      P.say($('acct-status'), P.dbMessage(e), 'error');
    });
  }

  // ---------- start ----------
  if (!P.configured) {
    P.show($('acct-soon'), true);
    setBuy('soon');
    return;
  }
  wireAuth();
  wireMe();
  P.client().then(function (sb) {
    state.sb = sb;
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        state.recovery = true;
        showRecovery();
        $('acct-auth').scrollIntoView({ block: 'start' });
      } else if (event === 'SIGNED_OUT') render(null);
    });
    return sb.auth.getSession().then(function (r) { render(r.data.session); });
  }).catch(function (e) {
    P.say($('acct-status'), e.message || 'Connexion impossible pour le moment.', 'error');
    setBuy('soon');
  });
})();
