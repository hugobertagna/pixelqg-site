/* PixelQG — Workshop page: community GitHub repos of skills/agents, with comments.
 * Every piece of user data is rendered with textContent (via PQG.el), never innerHTML. */
(function () {
  'use strict';
  var P = window.PQG;
  var el = P.el;
  var $ = function (id) { return document.getElementById(id); };

  var state = { sb: null, user: null, licensed: false, admin: false, items: [], q: '', tag: '', editing: null };

  // ---------- filters ----------
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function matches(it) {
    if (state.tag && (it.tags || []).indexOf(state.tag) < 0) return false;
    if (!state.q) return true;
    var hay = norm([it.title, it.description, it.author_name, (it.tags || []).join(' '), it.repo_url].join(' '));
    return norm(state.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  function paintTags() {
    var counts = {};
    state.items.forEach(function (it) { (it.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 20);
    var box = P.clear($('ws-tags'));
    P.show(box, tags.length > 0);
    if (state.tag && tags.indexOf(state.tag) < 0) tags.unshift(state.tag);
    [''].concat(tags).forEach(function (t) {
      box.append(el('button', {
        type: 'button', class: 'chip-btn', 'aria-pressed': String(state.tag === t),
        text: t ? '#' + t : 'Tous',
        onclick: function () { state.tag = t; paintTags(); paintList(); },
      }));
    });
  }

  // ---------- cards ----------
  function inlineConfirm(btn, label, run) {
    var armed = null;
    btn.addEventListener('click', function () {
      if (!armed) {
        btn.textContent = 'Confirmer ?';
        armed = setTimeout(function () { armed = null; btn.textContent = label; }, 4000);
        return;
      }
      clearTimeout(armed); armed = null; btn.disabled = true;
      run().catch(function (e) { btn.disabled = false; btn.textContent = label; P.say($('ws-status'), P.dbMessage(e), 'error'); });
    });
  }

  function card(it) {
    var mine = state.user && it.user_id === state.user.id;
    var repo = P.safeRepo(it.repo_url);
    var actions = el('div', { class: 'ws-actions' });
    if (repo) {
      actions.append(el('a', { class: 'btn btn--sm btn--ghost', href: repo, target: '_blank', rel: 'noopener noreferrer', text: 'Voir sur GitHub ↗' }));
      var copy = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Copier le lien' });
      copy.addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(repo) : Promise.reject()).then(function () {
          copy.textContent = 'Lien copié ✓';
          setTimeout(function () { copy.textContent = 'Copier le lien'; }, 2000);
        }).catch(function () { copy.textContent = repo; });
      });
      actions.append(copy);
    }
    if (mine) {
      actions.append(el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Modifier', onclick: function () { openForm(it); } }));
      var del = el('button', { type: 'button', class: 'btn btn--sm btn--danger', text: 'Supprimer' });
      inlineConfirm(del, 'Supprimer', function () {
        return state.sb.from('workshop_items').delete().eq('id', it.id).then(function (r) {
          if (r.error) throw r.error;
          P.say($('ws-status'), 'Ton skill a été supprimé.', 'ok');
          return load();
        });
      });
      actions.append(del);
    } else if (state.admin) {
      var hide = el('button', { type: 'button', class: 'btn btn--sm btn--danger', text: 'Masquer' });
      inlineConfirm(hide, 'Masquer', function () {
        return state.sb.from('workshop_items').update({ status: 'hidden' }).eq('id', it.id).then(function (r) {
          if (r.error) throw r.error;
          P.say($('ws-status'), 'Publication masquée.', 'ok');
          return load();
        });
      });
      actions.append(hide);
    }

    var tags = el('ul', { class: 'ws-tags', 'aria-label': 'Tags' });
    (it.tags || []).forEach(function (t) {
      tags.append(el('li', null, el('button', {
        type: 'button', class: 'chip-btn chip-btn--sm', text: '#' + t,
        onclick: function () { state.tag = t; paintTags(); paintList(); $('ws-tags').scrollIntoView({ block: 'nearest' }); },
      })));
    });

    var comments = el('details', { class: 'ws-comments' }, el('summary', { text: 'Commentaires' }));
    var loaded = false;
    comments.addEventListener('toggle', function () {
      if (comments.open && !loaded) { loaded = true; loadComments(it, comments); }
    });

    var updated = it.updated_at && it.updated_at !== it.created_at && new Date(it.updated_at) - new Date(it.created_at) > 60000;
    return el('li', { class: 'ws-card' },
      el('h2', { class: 'h4 ws-card__title', text: it.title }),
      el('p', { class: 'ws-meta' },
        'par ', el('strong', { text: it.author_name || 'Membre' }), mine ? ' (toi)' : '',
        ' · ', el('time', { datetime: it.created_at, text: P.fmtDate(it.created_at) }), updated ? ' · modifié' : ''),
      el('p', { class: 'ws-desc', text: it.description }),
      (it.tags || []).length ? tags : null,
      actions,
      comments);
  }

  function paintList() {
    var list = state.items.filter(matches);
    var ul = P.clear($('ws-list'));
    list.forEach(function (it) { ul.append(card(it)); });
    var n = list.length, total = state.items.length;
    $('ws-count').textContent = total ? (n === total ? total + (total > 1 ? ' dépôts partagés' : ' dépôt partagé') : n + ' sur ' + total + ' dépôts') : '';
    var empty = $('ws-empty');
    if (!total) empty.textContent = 'Aucun skill publié pour l’instant. ' + (state.licensed ? 'Sois le premier à partager le tien !' : 'Les premiers partages arrivent bientôt.');
    else empty.textContent = 'Aucun dépôt ne correspond à ta recherche.';
    P.show(empty, n === 0);
  }

  // ---------- comments ----------
  function loadComments(it, box) {
    var list = el('ul', { class: 'comment-list' });
    var status = el('p', { class: 'status-line', role: 'status', hidden: true });
    box.append(list, status);
    P.say(status, 'Chargement…');
    function refresh() {
      return state.sb.from('workshop_comments_public').select('id, item_id, user_id, body, created_at, author_name')
        .eq('item_id', it.id).order('created_at', { ascending: true }).limit(200)
        .then(function (r) {
          if (r.error) throw r.error;
          P.clear(list);
          P.say(status, r.data.length ? '' : 'Pas encore de commentaire.');
          r.data.forEach(function (c) {
            var mine = state.user && c.user_id === state.user.id;
            var tools = null;
            if (mine || state.admin) {
              var label = mine ? 'Supprimer' : 'Masquer';
              tools = el('button', { type: 'button', class: 'link-btn link-btn--danger', text: label });
              inlineConfirm(tools, label, function () {
                var q = mine ? state.sb.from('workshop_comments').delete().eq('id', c.id)
                  : state.sb.from('workshop_comments').update({ status: 'hidden' }).eq('id', c.id);
                return q.then(function (res) { if (res.error) throw res.error; return refresh(); });
              });
            }
            list.append(el('li', { class: 'comment' },
              el('p', { class: 'comment__meta' }, el('strong', { text: c.author_name || 'Membre' }), mine ? ' (toi)' : '',
                ' · ', el('time', { datetime: c.created_at, text: P.fmtDateTime(c.created_at) }), tools ? ' · ' : '', tools),
              el('p', { class: 'comment__body', text: c.body })));
          });
        }).catch(function (e) { P.say(status, P.dbMessage(e), 'error'); });
    }
    refresh();

    if (state.licensed) {
      var ta = el('textarea', { name: 'body', rows: '3', minlength: '2', maxlength: '1000', required: true, 'aria-label': 'Ton commentaire', placeholder: 'Ton avis, une astuce, un retour d’expérience…' });
      var send = el('button', { type: 'submit', class: 'btn btn--sm', text: 'Commenter' });
      var form = el('form', { class: 'form comment-form', novalidate: true }, el('div', { class: 'field' }, ta), send);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = ta.value.trim();
        if (body.length < 2) return P.say(status, 'Ton commentaire est trop court.', 'error');
        send.disabled = true;
        state.sb.from('workshop_comments').insert({ item_id: it.id, user_id: state.user.id, body: body }).then(function (r) {
          send.disabled = false;
          if (r.error) return P.say(status, P.dbMessage(r.error), 'error');
          ta.value = '';
          refresh();
        });
      });
      box.append(form);
    } else {
      box.append(el('p', { class: 'hint' }, state.user ? 'Commenter est réservé aux membres qui ont une licence. ' : 'Connecte-toi avec un compte qui a une licence pour commenter. ',
        el('a', { href: state.user ? 'compte.html#acheter' : 'compte.html', text: state.user ? 'Acheter PixelQG' : 'Se connecter' })));
    }
  }

  // ---------- publish / edit ----------
  function openForm(item) {
    var f = $('ws-form');
    state.editing = item || null;
    f.reset();
    $('ws-form-title').textContent = item ? 'Modifier ton skill' : 'Publier un skill';
    $('f-submit').textContent = item ? 'Enregistrer' : 'Publier';
    if (item) {
      f.repo.value = item.repo_url; f.title.value = item.title; f.description.value = item.description;
      f.tags.value = (item.tags || []).join(', ');
    }
    updateCount();
    P.say($('f-status'), '');
    P.show(f, true);
    $('ws-publish-btn').setAttribute('aria-expanded', 'true');
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    f.repo.focus({ preventScroll: true });
  }
  function closeForm() {
    P.show($('ws-form'), false);
    state.editing = null;
    $('ws-publish-btn').setAttribute('aria-expanded', 'false');
  }
  function updateCount() {
    var n = $('f-desc').value.trim().length;
    $('f-desc-count').textContent = '(' + n + ' / 600, 10 minimum)';
  }

  function wireForm() {
    $('ws-publish-btn').addEventListener('click', function () { $('ws-form').hidden ? openForm(null) : closeForm(); });
    $('f-cancel').addEventListener('click', closeForm);
    $('f-desc').addEventListener('input', updateCount);
    $('ws-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget, st = $('f-status');
      var repo = P.normaliseRepo(f.repo.value);
      var title = f.title.value.trim().replace(/\s+/g, ' ');
      var description = f.description.value.trim();
      var tags = P.parseTags(f.tags.value);
      if (!repo) return P.say(st, 'Lien GitHub invalide : il doit ressembler à https://github.com/utilisateur/depot', 'error');
      if (title.length < 3 || title.length > 80) return P.say(st, 'Le titre doit faire entre 3 et 80 caractères.', 'error');
      if (description.length < 10 || description.length > 600) return P.say(st, 'La description doit faire entre 10 et 600 caractères.', 'error');
      if (tags.length > 6) return P.say(st, '6 tags maximum.', 'error');
      var row = { repo_url: repo, title: title, description: description, tags: tags };
      var q = state.editing
        ? state.sb.from('workshop_items').update(row).eq('id', state.editing.id)
        : state.sb.from('workshop_items').insert(Object.assign({ user_id: state.user.id }, row));
      $('f-submit').disabled = true;
      P.say(st, state.editing ? 'Enregistrement…' : 'Publication…');
      q.then(function (r) {
        $('f-submit').disabled = false;
        if (r.error) return P.say(st, P.dbMessage(r.error), 'error');
        var msg = state.editing ? 'Modifications enregistrées.' : 'Ton skill est publié. Merci pour le partage !';
        closeForm();
        P.say($('ws-status'), msg, 'ok');
        load();
      });
    });
  }

  // ---------- access gate ----------
  function paintGate() {
    var gate = $('ws-gate'), link = $('ws-gate-link');
    P.show($('ws-publish-btn'), state.licensed);
    if (state.licensed) { P.show(gate, false); return; }
    $('ws-gate-text').textContent = state.user
      ? 'Publier et commenter est réservé aux membres qui ont une licence PixelQG.'
      : 'Pour publier un skill ou commenter, connecte-toi avec un compte qui a une licence PixelQG.';
    link.textContent = state.user ? 'Acheter PixelQG — 10 €' : 'Se connecter';
    link.href = state.user ? 'compte.html#acheter' : 'compte.html';
    P.show(gate, true);
  }

  // ---------- data ----------
  function load() {
    return state.sb.from('workshop_public')
      .select('id, user_id, repo_url, title, description, tags, created_at, updated_at, author_name')
      .order('created_at', { ascending: false }).limit(500)
      .then(function (r) {
        if (r.error) throw r.error;
        state.items = r.data || [];
        paintTags(); paintList();
      }).catch(function (e) { P.say($('ws-status'), P.dbMessage(e), 'error'); });
  }

  function loadMember() {
    if (!state.user) { state.licensed = false; state.admin = false; return Promise.resolve(); }
    return Promise.all([
      state.sb.from('licenses').select('status').eq('user_id', state.user.id).maybeSingle(),
      state.sb.from('profiles').select('is_admin').eq('id', state.user.id).maybeSingle(),
    ]).then(function (res) {
      state.licensed = !!(res[0].data && res[0].data.status === 'active');
      state.admin = !!(res[1].data && res[1].data.is_admin);
    });
  }

  // ---------- start ----------
  if (!P.configured) { P.show($('ws-soon'), true); return; }
  P.show($('ws-main'), true);
  $('ws-search').addEventListener('input', function (e) { state.q = e.target.value.trim(); paintList(); });
  wireForm();
  P.say($('ws-status'), 'Chargement du Workshop…');
  P.client().then(function (sb) {
    state.sb = sb;
    return sb.auth.getSession();
  }).then(function (r) {
    state.user = r.data.session ? r.data.session.user : null;
    return loadMember();
  }).then(function () {
    paintGate();
    P.say($('ws-status'), '');
    return load();
  }).catch(function (e) {
    P.say($('ws-status'), e.message || 'Le Workshop est indisponible pour le moment.', 'error');
  });
})();
