/* PixelQG landing page — small progressive enhancements. Everything works without JS. */
(function () {
  'use strict';

  // ---- Contact link from CONTACT_EMAIL (falls back to legal/contact.html) ----
  var email = typeof CONTACT_EMAIL === 'string' ? CONTACT_EMAIL.trim() : '';
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
    document.querySelectorAll('[data-contact]').forEach(function (a) { a.href = 'mailto:' + email; });
    document.querySelectorAll('[data-contact-text]').forEach(function (a) { a.textContent = email; });
    document.querySelectorAll('[data-contact-todo]').forEach(function (el) { el.hidden = true; });
  }

  // ---- Footer year ----
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // ---- Demo video: download it fully, then play from memory ----
  // The static host answers without byte ranges, so a streamed MP4 cannot be scrubbed
  // (no going back). A local blob URL can be seeked freely in every direction.
  var demo = document.querySelector('.win--video video');
  if (demo && window.fetch && window.Blob && window.URL && URL.createObjectURL) {
    var source = demo.querySelector('source');
    var demoUrl = source ? source.getAttribute('src') : demo.getAttribute('src');
    if (demoUrl) {
      if (source) source.parentNode.removeChild(source);
      demo.removeAttribute('src');
      demo.controls = false;
      demo.load();
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn--lg video-play';
      play.textContent = '▶ Regarder la démo (1 min)';
      demo.parentNode.appendChild(play);
      var setLabel = function (text) { play.textContent = text; };
      play.addEventListener('click', function () {
        if (play.disabled) return;
        play.disabled = true;
        setLabel('Chargement… 0 %');
        fetch(demoUrl).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var total = Number(res.headers.get('content-length')) || 0;
          if (!res.body || !res.body.getReader || !total) return res.blob();
          var reader = res.body.getReader(), chunks = [], got = 0;
          var pump = function () {
            return reader.read().then(function (r) {
              if (r.done) return new Blob(chunks, { type: 'video/mp4' });
              chunks.push(r.value);
              got += r.value.length;
              setLabel('Chargement… ' + Math.min(99, Math.round(got * 100 / total)) + ' %');
              return pump();
            });
          };
          return pump();
        }).then(function (blob) {
          demo.src = URL.createObjectURL(blob);
          demo.controls = true;
          play.parentNode.removeChild(play);
          var p = demo.play();
          if (p && p.catch) p.catch(function () {});
        }).catch(function () {
          play.disabled = false;
          setLabel('Réessayer de charger la vidéo');
        });
      });
    }
  }

  // ---- Hero loop: respect reduced motion, and only play while visible ----
  var video = document.querySelector('.hero__video');
  if (video) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var visible = true;
    var sync = function () {
      if ((reduce && reduce.matches) || !visible) { video.pause(); }
      else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    };
    if (reduce && reduce.matches) { video.removeAttribute('autoplay'); video.pause(); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(video);
    }
    if (reduce && reduce.addEventListener) reduce.addEventListener('change', sync);
  }

  // ---- Live GitHub star count in the navbar (public API, refreshed every minute) ----
  var starsBox = document.querySelector('[data-gh-stars]');
  var starsCount = document.querySelector('[data-gh-count]');
  var ghLink = document.querySelector('[data-gh-link]');
  if (starsBox && starsCount && window.fetch) {
    var REPO_API = 'https://api.github.com/repos/hugobertagna/pixelqg-app';
    var last = null;
    var fmt = function (n) {
      if (n < 1000) return String(n);
      return (Math.round(n / 100) / 10).toString().replace('.', ',') + ' k';
    };
    var show = function (n) {
      starsCount.textContent = fmt(n);
      starsBox.hidden = false;
      if (ghLink) ghLink.setAttribute('aria-label', 'PixelQG sur GitHub : ' + n + (n > 1 ? ' étoiles' : ' étoile'));
      if (last !== null && n > last) {
        starsBox.classList.remove('is-bump');
        void starsBox.offsetWidth; // restart the animation
        starsBox.classList.add('is-bump');
      }
      last = n;
    };
    var load = function () {
      if (document.hidden) return;
      fetch(REPO_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (repo) {
          if (repo && typeof repo.stargazers_count === 'number') show(repo.stargazers_count);
        })
        .catch(function () { /* offline or rate-limited: keep the last value */ });
    };
    load();
    setInterval(load, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  }
})();
