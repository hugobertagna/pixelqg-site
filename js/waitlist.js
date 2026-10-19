/* PixelQG — « Préviens-moi au lancement »: launch waitlist shown while online payment is not open.
 * Anonymous insert into public.waitlist (select is not allowed); a duplicate e-mail counts as success. */
(function () {
  'use strict';
  var P = window.PQG;
  if (!P) return;
  var EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>".]{2,}$/;

  function wire(wrap) {
    var form = wrap.querySelector('form[data-waitlist]');
    var status = wrap.querySelector('.status-line');
    var input = form && form.querySelector('input[type=email]');
    if (!form || !input) return;
    // Only while payment is closed and accounts (Supabase) are configured.
    if (P.paymentOpen || !P.configured) { wrap.hidden = true; return; }
    wrap.hidden = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        P.say(status, 'Cette adresse e-mail n’a pas l’air valide.', 'error');
        input.focus();
        return;
      }
      var btn = form.querySelector('button');
      btn.disabled = true; input.disabled = true;
      P.say(status, 'Inscription…');
      P.client().then(function (sb) {
        return sb.from('waitlist').insert({ email: email, source: 'site' });
      }).then(function (r) {
        if (r.error && r.error.code !== '23505') throw r.error;
        form.reset();
        P.say(status, 'C’est noté : tu seras prévenu au lancement.', 'ok');
      }).catch(function (err) {
        var offline = /fetch|network|charger/i.test(String(err && err.message));
        P.say(status, offline ? P.authMessage(err) : 'Inscription impossible pour le moment. Réessaie dans un instant.', 'error');
      }).then(function () { btn.disabled = false; input.disabled = false; });
    });
  }

  document.querySelectorAll('[data-waitlist-wrap]').forEach(wire);
  // compte.js can pre-fill the e-mail of the signed-in account.
  P.prefillWaitlist = function (email) {
    document.querySelectorAll('form[data-waitlist] input[type=email]').forEach(function (i) { if (!i.value) i.value = email || ''; });
  };
})();
