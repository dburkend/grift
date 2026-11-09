// ==UserScript==
// @name         ESPN – Hide Women's Sports
// @namespace    https://github.com/dburkend
// @version      1.0.0
// @description  Hides WNBA, NWSL, women's college, LPGA, PWHL, espnW and other women's-sports content from ESPN.com (headlines, cards, scoreboard, nav).
// @match        https://www.espn.com/*
// @match        https://espn.com/*
// @match        https://*.espn.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/dburkend/grift/espn-filter/espn-no-womens.user.js
// @updateURL    https://raw.githubusercontent.com/dburkend/grift/espn-filter/espn-no-womens.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ---- What counts as women's sports -------------------------------------
  // URL patterns ESPN uses for women's leagues/sections.
  const HREF_RE = new RegExp(
    [
      '/wnba(/|$|\\?)',
      '/womens-',                 // womens-college-basketball, womens-college-volleyball, etc.
      '/espnw(/|$|\\?)',
      '/nwsl',
      '/lpga',
      '/pwhl',
      'usa\\.nwsl',               // soccer league slugs
      'fifa\\.wwc',               // Women's World Cup
      'fifa\\.w\\.',              // women's internationals
      'uefa\\.wchampions',        // Women's Champions League
      'uefa\\.weuro',             // Women's Euro
      '\\.w\\.1',                 // e.g. eng.w.1 (WSL), esp.w.1
      'tour=lpga',
      'league=wnba',
    ].join('|'),
    'i'
  );

  // Headline / label text.
  const STRONG_TEXT_RE =
    /\b(WNBA|NWSL|LPGA|PWHL|espnW|Unrivaled|Athletes Unlimited|WCBB)\b|\bwom[ae]n['’]?s?\b|\bW\.? ?Basketball\b/i;

  // The "card" to remove when a match is found — nearest wins.
  const CONTAINER_SEL = [
    '.contentItem',
    '.headlineStack__listItem',
    '.Scoreboard',
    '.scoreboard',
    '.ScoreCell',
    '.Carousel__Slide',
    '.ContentList__Item',
    '.news-feed-item',
    '[data-testid="ContentItem"]',
    'article',
    'li',
  ].join(',');

  const NEVER_HIDE = new Set(['HTML', 'BODY', 'MAIN', 'HEADER', 'NAV', 'UL', 'OL']);

  // ---- If you land on a women's-sports page, bounce to the homepage ------
  if (HREF_RE.test(location.pathname + location.search)) {
    location.replace('https://www.espn.com/');
    return;
  }

  // Hide before paint where we can (pure CSS, for the obvious URL cases).
  const css = `
    li:has(> a[href*="/wnba"]), li:has(> a[href*="/womens-"]), li:has(> a[href*="/espnw"]),
    li:has(> a[href*="/nwsl"]), li:has(> a[href*="usa.nwsl"]), li:has(> a[href*="/lpga"]),
    .contentItem:has(a[href*="/wnba/"]), .contentItem:has(a[href*="/womens-"]),
    .contentItem:has(a[href*="/espnw/"]), .contentItem:has(a[href*="usa.nwsl"]),
    .Scoreboard:has(a[href*="/wnba/"]), .Scoreboard:has(a[href*="/womens-"]),
    [data-espn-hidden] { display: none !important; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  // ---- Matching -----------------------------------------------------------
  function textIsWomens(t) {
    return !!t && STRONG_TEXT_RE.test(t);
  }

  function hide(el) {
    if (!el || el.hasAttribute('data-espn-hidden')) return;
    let target = el.closest(CONTAINER_SEL) || el;
    if (NEVER_HIDE.has(target.tagName)) target = el;
    target.setAttribute('data-espn-hidden', '');
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;

    // 1) Links pointing at women's sections.
    root.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('[data-espn-hidden]')) return;
      // Links inside the body text of an article you're reading: leave the article alone.
      if (a.closest('p, .article-body, .Story__Body, [class*="article-body"]')) return;
      const href = a.getAttribute('href') || '';
      if (HREF_RE.test(href)) { hide(a); return; }
      // 2) Links whose visible headline text is women's sports.
      const label = (a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '');
      if (label.length < 400 && textIsWomens(label)) hide(a);
    });

    // 3) Headlines / titles that aren't links themselves.
    root
      .querySelectorAll(
        'h1, h2, h3, .contentItem__title, .headlineStack__header, .Card__Header__Title, .ScoreboardScoreCell__Note, [data-mptype="headline"]'
      )
      .forEach((h) => {
        if (h.closest('[data-espn-hidden]')) return;
        if (h.closest('.article-body, .Story__Body, [class*="article-body"]')) return;
        if (textIsWomens(h.textContent)) {
          // Hide the card, but if the heading is a whole-section title
          // (e.g. "WNBA Scores"), hide its section.
          const section = h.closest('section, .Card, .headlineStack');
          if (section && section.querySelector('h1, h2, h3, .Card__Header__Title') === h) {
            if (!NEVER_HIDE.has(section.tagName)) section.setAttribute('data-espn-hidden', '');
          } else {
            hide(h);
          }
        }
      });
  }

  // ---- Run now and on every change (ESPN is a single-page app) -----------
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scan(document.body); });
  }

  function start() {
    scan(document.body);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  // Catch in-app navigation to a women's page.
  const check = () => {
    if (HREF_RE.test(location.pathname + location.search)) location.replace('https://www.espn.com/');
  };
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); check(); return r; };
  });
  window.addEventListener('popstate', check);
})();
