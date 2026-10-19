// Shared, dependency-free reading controls. Loaded only on article pages.
const article = document.querySelector('.article-page');
const body = article?.querySelector('.article-body');
const tools = document.querySelector('.article-tools');

if (article && body && tools) {
  document.body.append(tools); // Keep fixed controls outside transformed page wrappers.
  tools.hidden = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const navbar = document.querySelector('.portfolio-nav');
  const progress = tools.querySelector('.article-progress');
  const progressFill = progress.firstElementChild;
  const backTop = tools.querySelector('.article-back-top');
  const rail = tools.querySelector('.article-rail');
  const ticks = tools.querySelector('.article-rail-ticks');
  const toc = tools.querySelector('.article-toc');
  const tocList = toc.querySelector('ol');
  const tocScroll = toc.querySelector('nav');
  const tocTriggers = [...tools.querySelectorAll('[data-toc-trigger]')];
  const tocClose = toc.querySelector('[data-toc-close]');
  const share = article.querySelector('.article-share');
  const shareTrigger = share.querySelector('.article-share-trigger');
  const shareOptions = share.querySelector('.article-share-options');
  const headingElements = [...body.querySelectorAll('h2,h3')];
  const usedIds = new Set([...document.querySelectorAll('[id]')]
    .filter(element => !headingElements.includes(element)).map(element => element.id));

  const sections = headingElements.map((heading, index) => {
    const title = heading.textContent.replace(/\s+/g, ' ').trim() || `Section ${index + 1}`;
    const base = heading.id || title.normalize('NFKD').replace(/\p{Mark}/gu, '')
      .toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    let id = base, suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;
    const subsection = heading.tagName === 'H3';
    const tick = document.createElement('span');
    tick.className = 'article-rail-tick' + (subsection ? ' is-subsection' : '');
    tick.append(document.createElement('span'));
    ticks.append(tick);
    const item = document.createElement('li');
    if (subsection) item.className = 'is-subsection';
    const link = document.createElement('a');
    link.href = '#' + encodeURIComponent(id);
    link.textContent = title;
    item.append(link);
    tocList.append(item);
    for (const anchor of [link]) {
      anchor.addEventListener('click', event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        closeToc(false);
        closeShare(false);
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        // Native anchors retain URL/history behavior and honor CSS reduced motion.
      });
    }
    return { heading, tick, link };
  });
  if (sections.length) {
    rail.hidden = false;
    tools.querySelector('.article-mobile-toc').hidden = false;
  }

  let tocOpener = null, tocOpen = false, tocOpenTimer, tocCloseTimer, tocHideTimer;
  let hoverBlockedUntil = 0, openedByHover = false, pointerInRail = false, pointerInToc = false;
  const hoverRail = matchMedia('(min-width: 1100px) and (hover: hover) and (pointer: fine)');
  function closeToc(returnFocus = true) {
    clearTimeout(tocOpenTimer);
    clearTimeout(tocCloseTimer);
    if (!tocOpen) return;
    tocOpen = false;
    hoverBlockedUntil = performance.now() + 350;
    tocTriggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    if (returnFocus) (tocOpener?.getClientRects().length ? tocOpener : tocTriggers.find(trigger => trigger.getClientRects().length))?.focus({ preventScroll: true });
    toc.inert = true;
    toc.classList.remove('is-open');
    // Keep the panel mounted until its fade finishes; reopening cancels this hide.
    if (reduced.matches) toc.hidden = true;
    else tocHideTimer = setTimeout(() => { if (!tocOpen) toc.hidden = true; }, 180);
  }
  function closeShare(returnFocus = true) {
    if (shareOptions.hidden) return;
    shareOptions.hidden = true;
    shareTrigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) shareTrigger.focus({ preventScroll: true });
  }
  function openToc(trigger, focus = true) {
    clearTimeout(tocOpenTimer);
    clearTimeout(tocCloseTimer);
    clearTimeout(tocHideTimer);
    if (tocOpen) {
      if (focus) { openedByHover = false; tocClose.focus({ preventScroll: true }); }
      return;
    }
    closeShare(false);
    tocOpener = trigger;
    openedByHover = !focus;
    tocOpen = true;
    const wasHidden = toc.hidden;
    toc.hidden = false;
    toc.inert = false;
    // Establish the transparent starting frame without moving the hit area.
    if (wasHidden) void toc.offsetWidth;
    toc.classList.add('is-open');
    tocTriggers.forEach(button => button.setAttribute('aria-expanded', 'true'));
    if (focus) tocClose.focus({ preventScroll: true });
    revealActiveLink();
    navbar?.classList.remove('article-nav-away');
  }
  tocTriggers.forEach(trigger => trigger.addEventListener('click', () => {
    if (tocOpen && !openedByHover) closeToc();
    else openToc(trigger);
  }));
  rail.addEventListener('pointerenter', event => {
    pointerInRail = true;
    clearTimeout(tocCloseTimer);
    if (!tocOpen && hoverRail.matches && event.pointerType !== 'touch' && performance.now() >= hoverBlockedUntil) {
      // Let a click reach the rail before a hover panel can cover it.
      tocOpenTimer = setTimeout(() => {
        if (pointerInRail && hoverRail.matches && !tocOpen) openToc(tocTriggers[0], false);
      }, 120);
    }
  });
  function scheduleTocClose() {
    clearTimeout(tocCloseTimer);
    if (hoverRail.matches && openedByHover && tocOpen) tocCloseTimer = setTimeout(() => {
      if (!pointerInRail && !pointerInToc && !toc.matches(':focus-within')) closeToc(false);
    }, 300);
  }
  rail.addEventListener('pointerleave', event => {
    pointerInRail = false;
    clearTimeout(tocOpenTimer);
    if (toc.contains(event.relatedTarget)) { pointerInToc = true; clearTimeout(tocCloseTimer); }
    else scheduleTocClose();
  });
  toc.addEventListener('pointerenter', () => { pointerInToc = true; clearTimeout(tocCloseTimer); });
  toc.addEventListener('pointerleave', event => {
    pointerInToc = false;
    if (rail.contains(event.relatedTarget)) { pointerInRail = true; clearTimeout(tocCloseTimer); }
    else scheduleTocClose();
  });
  tocClose.addEventListener('click', () => closeToc());
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    clearTimeout(tocOpenTimer);
    if (tocOpen) { closeToc(); event.preventDefault(); }
    else if (!shareOptions.hidden) { closeShare(); event.preventDefault(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!toc.contains(event.target) && !tocTriggers.some(trigger => trigger.contains(event.target))) closeToc(false);
    if (!share.contains(event.target)) closeShare(false);
  });
  document.addEventListener('focusin', event => {
    if (tocOpen && !toc.contains(event.target) && !tocTriggers.includes(event.target)) closeToc(false);
    if (!share.contains(event.target)) closeShare(false);
    if (navbar?.contains(event.target)) navbar.classList.remove('article-nav-away');
  });

  // The canonical URL excludes tracking parameters and section fragments.
  const postUrl = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
  postUrl.hash = '';
  postUrl.search = '';
  const title = article.querySelector('h1').textContent.trim();
  const destinations = {
    x: ['https://twitter.com/intent/tweet', { text: title, url: postUrl.href }],
    linkedin: ['https://www.linkedin.com/sharing/share-offsite/', { url: postUrl.href }],
    threads: ['https://www.threads.com/intent/post', { text: `${title}\n${postUrl.href}` }],
  };
  for (const [name, [base, parameters]] of Object.entries(destinations)) {
    const destination = new URL(base);
    destination.search = new URLSearchParams(parameters).toString();
    share.querySelector(`[data-share="${name}"]`).href = destination.href;
  }
  share.hidden = false;
  shareTrigger.addEventListener('click', () => {
    if (!shareOptions.hidden) { closeShare(); return; }
    closeToc(false);
    shareOptions.hidden = false;
    shareTrigger.setAttribute('aria-expanded', 'true');
    share.querySelector('[data-copy-link]').focus({ preventScroll: true });
    navbar?.classList.remove('article-nav-away');
  });
  let copyTimer;
  share.querySelector('[data-copy-link]').addEventListener('click', async () => {
    const label = share.querySelector('[data-copy-label]');
    const status = share.querySelector('[data-share-status]');
    const fallback = share.querySelector('.article-copy-fallback');
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(postUrl.href);
      label.textContent = 'Copied!';
      status.textContent = 'Link copied to clipboard.';
      fallback.hidden = true;
      copyTimer = setTimeout(() => { label.textContent = 'Copy link'; status.textContent = ''; }, 2500);
    } catch {
      // Denied clipboard permissions still leave an accessible way to copy.
      label.textContent = 'Copy link';
      fallback.hidden = false;
      const input = fallback.querySelector('input');
      input.value = postUrl.href;
      input.focus({ preventScroll: true });
      input.select();
      status.textContent = 'Select and copy the article link below.';
    }
  });

  backTop.addEventListener('click', () => {
    const backLink = article.querySelector('.article-back');
    backLink.focus({ preventScroll: true });
    navbar?.classList.remove('article-nav-away');
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  let active = -1, lastY = scrollY, movement = 0, frame = 0;
  function revealActiveLink() {
    const link = sections[active]?.link;
    const tick = sections[active]?.tick;
    if (tick && rail.getClientRects().length) {
      const box = tick.getBoundingClientRect(), viewport = ticks.getBoundingClientRect();
      if (box.top < viewport.top) ticks.scrollTop += box.top - viewport.top;
      else if (box.bottom > viewport.bottom) ticks.scrollTop += box.bottom - viewport.bottom;
    }
    if (!tocOpen || !link) return;
    const box = link.getBoundingClientRect(), viewport = tocScroll.getBoundingClientRect();
    if (box.top < viewport.top) tocScroll.scrollTop += box.top - viewport.top - 8;
    else if (box.bottom > viewport.bottom) tocScroll.scrollTop += box.bottom - viewport.bottom + 8;
  }
  function update() {
    frame = 0;
    const y = Math.max(0, scrollY);
    const delta = y - lastY;
    const bodyBox = body.getBoundingClientRect();
    const offset = innerWidth < 810 ? 110 : 128;
    const distance = Math.max(1, bodyBox.height - innerHeight + offset);
    const value = Math.max(0, Math.min(1, (offset - bodyBox.top) / distance));
    progressFill.style.transform = `scaleX(${value})`;
    progress.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    backTop.classList.toggle('is-visible', y > 400);
    backTop.tabIndex = y > 400 ? 0 : -1;
    let next = sections.length ? 0 : -1;
    sections.forEach(({ heading }, index) => {
      if (heading.getBoundingClientRect().top <= offset + 2) next = index;
    });
    if (value === 1 && sections.length) next = sections.length - 1;
    if (next !== active) {
      active = next;
      sections.forEach(({ tick, link }, index) => {
        tick.classList.toggle('is-active', index === active);
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      revealActiveLink();
    }
    if (delta) {
      movement = Math.sign(delta) === Math.sign(movement) ? movement + delta : delta;
      const keepVisible = y < 160 || navbar?.matches(':focus-within,.is-open') || tocOpen || !shareOptions.hidden;
      if (keepVisible) navbar?.classList.remove('article-nav-away');
      else if (Math.abs(movement) >= 12) navbar?.classList.toggle('article-nav-away', movement > 0);
    }
    lastY = y;
  }
  function scheduleUpdate() { if (!frame) frame = requestAnimationFrame(update); }
  addEventListener('scroll', scheduleUpdate, { passive: true });
  addEventListener('resize', scheduleUpdate, { passive: true });
  addEventListener('pageshow', () => { navbar?.classList.remove('article-nav-away'); scheduleUpdate(); });
  new ResizeObserver(scheduleUpdate).observe(body);
  document.fonts.ready.then(scheduleUpdate);
  // Deep links also work for headings whose IDs were generated at runtime.
  addEventListener('load', () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    sections.find(section => section.heading.id === id)?.heading.scrollIntoView({ behavior: 'instant' });
    scheduleUpdate();
  }, { once: true });
  update();
}
